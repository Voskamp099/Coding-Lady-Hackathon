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
_index_for_child: Optional[str] = None  # 记录当前 _index 对应的 child_name，便于失效判断
_kb = KnowledgeBase.get()


def get_index(child_name: Optional[str] = None) -> VectorIndex:
    """
    按 child_name 缓存的向量索引。
    child_name 变化时重建。None 表示"全库"模式。
    """
    global _index, _index_for_child
    if _index is None or _index_for_child != child_name:
        _index = VectorIndex(child_name=child_name)
        _index_for_child = child_name
    return _index


def reset_index() -> None:
    """清掉缓存的索引（新增记忆后调用）。"""
    global _index, _index_for_child
    _index = None
    _index_for_child = None


# ============================================================
#  证据格式化
# ============================================================
def _fmt_ts(m: Memory) -> str:
    ts = m.timestamp
    return ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)


def _format_memory_evidence(results: List[RetrievalResult]) -> str:
    """精简版：每条记忆 1-2 行（日期+事件 + 行为标签），大幅减少 token。"""
    if not results:
        return "（未检索到相关记忆）"
    lines = [f"## 相关记忆（共 {len(results)} 条）\n"]
    for i, r in enumerate(results, 1):
        m = r.memory
        # 只取前 2 个行为标签，原文截断到 50 字，进一步压缩上下文
        behaviors_cn = ", ".join(behavior_cn(b) for b in (m.behaviors or [])[:2]) or "无"
        lines.append(
            f"[{i}] {_fmt_ts(m)} | {m.event}\n"
            f"  行为: {behaviors_cn} | 原文: {(m.raw_text or '')[:50]}"
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
    """精简版全库画像：只保留一行高频行为。"""
    if not profile or profile.get("total", 0) == 0:
        return "（记忆库为空）"
    parts = [f"共{profile['total']}条记忆"]
    if profile.get("top_behaviors"):
        bh = " / ".join(behavior_cn(b) for b in profile["top_behaviors"][:3])
        parts.append(f"高频行为: {bh}")
    if profile.get("top_emotion_explicit"):
        parts.append("高频情绪: " + " / ".join(profile["top_emotion_explicit"][:3]))
    return " | ".join(parts)


def _format_clusters(clusters: List[MemoryCluster]) -> str:
    if not clusters:
        return ""
    lines = [f"聚类: {len(clusters)} 簇"]
    for c in clusters:
        bh = ", ".join(c.top_behaviors[:2]) or "无"
        lines.append(f"  [{c.cluster_id}] {c.size}条 | {c.label} | {bh}")
    return "\n".join(lines)


def _format_rag(query: str) -> str:
    """精简 RAG：只取 1 个最相关知识块，并截断正文，显著减少上下文 token。"""
    chunks = _kb.retrieve(query, k=1)
    if not chunks:
        return "（未检索到相关理论依据）"
    lines = ["# 相关心理学理论依据（RAG，供分析参考）\n"]
    for c in chunks:
        # 理论块含大表格时会很长，截断到 400 字足够 LLM 引用
        content = (c.content or "")[:400]
        lines.append(f"## {c.title}\n{content}\n")
    return "\n".join(lines)


def _build_evidence_block(results, analysis, index: VectorIndex, query: str) -> str:
    """精简证据块：记忆证据 + 简要画像 + RAG（跳过 Layer3 和聚类以加速）。"""
    profile = index.global_profile()
    return "\n\n".join([
        _format_memory_evidence(results),
        _format_profile(profile),
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

    async def chat(
        self,
        user_message: str,
        k: int = 5,
        with_evidence: bool = True,
        child_name: Optional[str] = None,
    ) -> Dict:
        """
        对话主入口（精简版：跳过 Layer3 价值综合以减少 LLM 调用，加速响应）。
        child_name: 隔离标识。仅在 child_name 名下的记忆中被检索。
        """
        if count_memories(child_name=child_name) == 0:
            # 复合键 parentName::childName → 只取孩子名显示
            who = (child_name.split("::", 1)[1] if child_name and "::" in child_name else child_name) or "你"
            return {
                "answer": (
                    f"我还没有「{who}」的成长记忆呢。请先在「投喂」或对话里录入一些"
                    f"关于「{who}」的生活事件，我才能基于过往给你有温度的建议。"
                ),
                "retrieved_memories": [],
                "evidence": None,
                "stats": {"total_memories": 0, "retrieved": 0},
            }

        index = get_index(child_name=child_name)

        # 1. 检索 top-K 相关记忆（K=5，减少上下文长度）
        results: List[RetrievalResult] = index.search(user_message, k=k)

        # 2. 跳过 Layer3 价值综合（省一次 LLM 调用，大幅加速）
        analysis = None

        # 3. 组装证据（精简版：记忆证据 + 画像 + RAG）
        evidence_block = _build_evidence_block(results, analysis, index, user_message)

        # 4. 调 LLM
        messages = build_chat_messages(user_message, evidence_block)
        answer = ""
        try:
            resp = await _chat_client.chat.completions.create(
                model=cfg.model_name,
                # 回答目标 300-500 字（约 700-900 token），上限收到 1200，
                # 既够写完自然段落，又更快返回、更省钱（输出 token 也计费）
                max_tokens=min(cfg.max_tokens, 1200),
                messages=messages,
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
