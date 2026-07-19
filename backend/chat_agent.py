"""
对话 Agent（Agent 2 —— 能对话的 agent）。

基于分层记忆（Layer1 事件 + Layer2 行为）+ 本体闭集 + RAG 心理学理论 + Layer3 价值综合，
输出 6 节决策分析。对应前端“另一个文本框”。

工作流：
1. VectorIndex 检索 top-K 相关记忆。
2. 对这些记忆跑 Layer3 价值综合（value / confidence / evidence）。
3. 取全库行为/情绪模式频次画像 + 聚类。
4. RAG 检索相关心理学理论。
5. 把以上证据注入 system prompt，调 LLM。
"""

from __future__ import annotations

from typing import Dict, List, Optional

import httpx
from openai import AsyncOpenAI

from backend.config import get_settings
from backend.knowledge_base import KnowledgeBase
from backend.memory_repository import count_memories
from backend.models import Memory
from backend.ontology import (
    VALUES, BEHAVIORS, EMOTION_PATTERNS,
    VALUE_GROUPS, value_cn, behavior_cn, emotion_pattern_cn,
)
from backend.prompt import build_chat_messages
from backend.vector_store import VectorIndex, RetrievalResult, MemoryCluster


cfg = get_settings()

_chat_client = AsyncOpenAI(
    api_key=cfg.openai_api_key,
    base_url=cfg.openai_base_url,
    http_client=httpx.AsyncClient(trust_env=False, timeout=120.0),
)

_index: Optional[VectorIndex] = None
_kb = KnowledgeBase.get()


def get_index() -> VectorIndex:
    global _index
    if _index is None:
        _index = VectorIndex()
    return _index


def reset_index() -> None:
    """清掉缓存的索引（新增记忆后调用）。"""
    global _index
    _index = None


# ============================================================
#  证据格式化
# ============================================================
def _fmt_ts(m: Memory) -> str:
    ts = m.timestamp
    return ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)


def _format_memory_evidence(results: List[RetrievalResult]) -> str:
    if not results:
        return "（未检索到相关记忆）"
    lines = [f"## 相关记忆（共 {len(results)} 条，按相关性降序）\n"]
    for i, r in enumerate(results, 1):
        m = r.memory
        behaviors_cn = ", ".join(f"{b}({behavior_cn(b)})" for b in (m.behaviors or [])) or "无"
        emo_patterns_cn = ", ".join(f"{p}({emotion_pattern_cn(p)})" for p in (m.emotion_patterns or [])) or "无"
        emo_explicit = ", ".join(m.emotion_explicit or []) or "无"
        lines.append(
            f"[记忆{i}] 时间={_fmt_ts(m)} | 相关度={r.score:.3f} | 重要度={m.importance}/10 | 行为置信度={m.behavior_confidence:.2f}\n"
            f"  事件: {m.event}\n"
            f"  动作: {m.action or '无'}\n"
            f"  原文: {m.raw_text}\n"
            f"  人物: {', '.join(m.people) or '无'}\n"
            f"  明确情绪: {emo_explicit}\n"
            f"  行为信号: {behaviors_cn}\n"
            f"  情绪模式: {emo_patterns_cn}\n"
            f"  动机(推测): {m.motivation or '无'}\n"
            f"  学习方式: {m.learning_style or '无'}\n"
            f"  社交行为: {m.social_behavior or '无'}\n"
        )
    return "\n".join(lines)


def _format_value_synthesis(analysis) -> str:
    """格式化 Layer3 价值综合。"""
    if analysis is None:
        return "（未做价值综合）"
    lines = [f"## Layer3 价值综合（scope={analysis.scope}）\n"]
    if not analysis.values:
        lines.append("未识别出明确价值信号。")
    else:
        # 按置信度降序
        sorted_vals = sorted(analysis.values, key=lambda v: v.confidence, reverse=True)
        for v in sorted_vals:
            ev = " | ".join(v.evidence[:2]) if v.evidence else "无"
            lines.append(f"- {v.value}({value_cn(v.value)}) conf={v.confidence:.2f} | 证据: {ev}")
    if analysis.trend:
        lines.append(f"\n趋势: {analysis.trend}")
    return "\n".join(lines)


def _format_profile(profile: dict) -> str:
    if not profile or profile.get("total", 0) == 0:
        return "（记忆库为空）"
    lines = [f"## 全库画像（共 {profile['total']} 条记忆）\n"]
    if profile.get("top_behaviors"):
        bh = " / ".join(f"{b}({behavior_cn(b)})" for b in profile["top_behaviors"])
        lines.append(f"高频行为: {bh}")
    if profile.get("top_emotion_patterns"):
        ep = " / ".join(f"{p}({emotion_pattern_cn(p)})" for p in profile["top_emotion_patterns"])
        lines.append(f"高频情绪模式: {ep}")
    if profile.get("top_emotion_explicit"):
        lines.append("高频基本情绪: " + " / ".join(profile["top_emotion_explicit"]))
    if "importance_avg" in profile:
        lines.append(f"平均重要度: {profile['importance_avg']:.2f}/10")
    return "\n".join(lines)


def _format_clusters(clusters: List[MemoryCluster]) -> str:
    if not clusters:
        return "（记忆数不足，未聚类）"
    lines = [f"## 记忆聚类（共 {len(clusters)} 簇）\n"]
    for c in clusters:
        bh = ", ".join(c.top_behaviors) or "无"
        ep = ", ".join(c.top_emotion_patterns) or "无"
        lines.append(
            f"[簇{c.cluster_id}] {c.size}条 | 标签: {c.label}\n"
            f"  高频行为: {bh} | 高频情绪模式: {ep} | 平均重要度: {c.importance_avg:.2f}/10"
        )
    return "\n".join(lines)


def _format_rag(query: str) -> str:
    chunks = _kb.retrieve(query, k=3)
    return KnowledgeBase.format_for_prompt(chunks)


def _build_evidence_block(results, analysis, index: VectorIndex, query: str) -> str:
    profile = index.global_profile()
    clusters = index.classify(n_clusters=4) if len(index.memories) >= 6 else []
    return "\n\n".join([
        _format_memory_evidence(results),
        _format_value_synthesis(analysis),
        _format_profile(profile),
        _format_clusters(clusters),
        _format_rag(query),
    ])


# ============================================================
#  对话主入口
# ============================================================
def _fallback_answer(user_message: str, analysis) -> str:
    """LLM 返回空时的兜底回答：用价值综合 + 趋势拼结构化分析。"""
    sorted_vals = sorted(analysis.values, key=lambda v: v.confidence, reverse=True)
    lines = [f"## 我从你的成长记录中读到了这些\n"]
    lines.append(f"你提出了问题：「{user_message}」\n")
    lines.append(f"我分析了你过往 {len(analysis.values)} 个价值信号：\n")
    for v in sorted_vals[:6]:
        cn = value_cn(v.value)
        ev = v.evidence[0] if v.evidence else "—"
        lines.append(f"**{cn}** (置信度 {v.confidence:.0%})")
        lines.append(f"  证据：{ev[:80]}...\n")
    if analysis.trend:
        lines.append("## 长期趋势\n")
        lines.append(analysis.trend)
    lines.append("\n## 建议\n")
    lines.append("基于以上价值信号与趋势，建议你对照当前决策，")
    lines.append("看哪些选择与你的高频价值一致、哪些冲突。")
    lines.append("与你过去价值观高度一致的选择，未来后悔的概率更低。")
    return "\n".join(lines)


class ChatAgent:
    """对话 Agent：基于分层记忆 + 本体 + RAG + Layer3 价值综合做决策分析。"""

    async def chat(self, user_message: str, k: int = 8, with_evidence: bool = True) -> Dict:
        from backend.extraction_pipeline import run_layer3

        if count_memories() == 0:
            return {
                "answer": "记忆库还是空的。请先运行 `python prepare_data.py --clear --layer3` 导入成长记录，我才能基于你的过往给你建议。",
                "retrieved_memories": [],
                "evidence": None,
                "stats": {"total_memories": 0, "retrieved": 0},
            }

        index = get_index()

        # 1. 检索
        results: List[RetrievalResult] = index.search(user_message, k=k)

        # 2. Layer3 价值综合（仅对检索到的记忆）
        retrieved_mems = [r.memory for r in results]
        try:
            analysis = await run_layer3(
                memories=retrieved_mems,
                scope=f"chat:{user_message[:30]}",
                query_hint=user_message,
            )
        except Exception as e:
            print(f"[chat_agent] Layer3 失败，跳过: {e}")
            analysis = None

        # 3. 组装证据
        evidence_block = _build_evidence_block(results, analysis, index, user_message)

        # 4. 调 LLM
        messages = build_chat_messages(user_message, evidence_block)
        answer = ""
        try:
            resp = await _chat_client.chat.completions.create(
                model=cfg.model_name,
                messages=messages,
                max_tokens=max(cfg.max_tokens, 4096),
                temperature=cfg.temperature,
            )
            answer = resp.choices[0].message.content or ""
        except Exception as e:
            answer = f"⚠️ 调用 LLM 失败: {e}"

        # 兜底：LLM 返回空时，用价值综合 + 趋势拼一个结构化回答
        if not answer.strip() and analysis and analysis.values:
            answer = _fallback_answer(user_message, analysis)

        return {
            "answer": answer,
            "retrieved_memories": [
                {
                    "id": r.memory.id,
                    "timestamp": _fmt_ts(r.memory),
                    "event": r.memory.event,
                    "score": round(r.score, 4),
                    "behaviors": r.memory.behaviors,
                    "emotion_patterns": r.memory.emotion_patterns,
                }
                for r in results
            ],
            "value_synthesis": {
                "values": [
                    {"value": v.value, "cn": value_cn(v.value),
                     "confidence": v.confidence, "evidence": v.evidence}
                    for v in (analysis.values if analysis else [])
                ],
                "trend": analysis.trend if analysis else "",
            } if analysis else None,
            "evidence": evidence_block if with_evidence else None,
            "stats": {
                "total_memories": len(index.memories),
                "retrieved": len(results),
            },
        }


chat_agent = ChatAgent()
