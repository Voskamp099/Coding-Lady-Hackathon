"""
三层提取流水线（Agent 1 —— 分析 agent）。

层级：
- Layer 1 事件提取：客观事实（structured output）
- Layer 2 行为分析：闭集本体标签 + 置信度 + RAG 理论依据（structured output）
- Layer 3 价值提取：跨记忆聚合，闭集本体价值 + 证据 + 置信度 + 趋势（structured output）

流水线：事件 → 行为信号 → 价值信号 → 长期趋势
单条记忆只走 Layer 1 + Layer 2；Layer 3 在多记忆上聚合（按需触发）。
"""

from __future__ import annotations

import json
from typing import List, Optional, Dict

import httpx
from openai import AsyncOpenAI

from backend.config import get_settings
from backend.knowledge_base import KnowledgeBase
from backend.models import (
    Memory, Layer1Output, Layer2Output, Layer3Output, ValueAnalysis, ValueSignal, Importance
)
from backend.memory_repository import save_memory, get_memory_by_raw_text, get_all_memories, save_value_analysis
from backend.ontology import format_ontology_for_prompt, filter_behaviors, filter_emotion_patterns, filter_values
from backend.prompt import layer1_system_prompt, layer2_system_prompt, layer3_system_prompt


cfg = get_settings()

_client = AsyncOpenAI(
    api_key=cfg.openai_api_key,
    base_url=cfg.openai_base_url,
    http_client=httpx.AsyncClient(trust_env=False, timeout=60.0),
)

_ontology_block = format_ontology_for_prompt()
_kb = KnowledgeBase.get()


# ============================================================
#  Layer 1 —— 事件提取
# ============================================================
async def run_layer1(raw_text: str) -> Layer1Output:
    """Layer 1：客观事件提取。"""
    resp = await _client.beta.chat.completions.parse(
        model=cfg.model_name,
        messages=[
            {"role": "system", "content": layer1_system_prompt()},
            {"role": "user", "content": raw_text},
        ],
        response_format=Layer1Output,
    )
    data = resp.choices[0].message.parsed
    if not data:
        raise ValueError("Layer1 LLM 未返回有效结构化数据")
    return data


# ============================================================
#  Layer 2 —— 行为分析
# ============================================================
async def run_layer2(layer1: Layer1Output, raw_text: str) -> Layer2Output:
    """Layer 2：行为分析（注入本体 + RAG）。"""
    # RAG 检索：用事件+动作作为查询，召回相关理论
    kb_query = f"{layer1.event} {layer1.action}"
    rag_chunks = _kb.retrieve(kb_query, k=3)
    rag_block = KnowledgeBase.format_for_prompt(rag_chunks)

    user_content = (
        f"原始记录：\n{raw_text}\n\n"
        f"Layer 1 客观事实：\n"
        f"- 事件：{layer1.event}\n"
        f"- 时间：{layer1.timestamp}\n"
        f"- 人物：{', '.join(layer1.people)}\n"
        f"- 动作：{layer1.action}\n"
        f"- 明确情绪：{', '.join(layer1.emotion_explicit)}\n"
    )

    resp = await _client.beta.chat.completions.parse(
        model=cfg.model_name,
        messages=[
            {"role": "system", "content": layer2_system_prompt(_ontology_block, rag_block)},
            {"role": "user", "content": user_content},
        ],
        response_format=Layer2Output,
    )
    data = resp.choices[0].message.parsed
    if not data:
        raise ValueError("Layer2 LLM 未返回有效结构化数据")

    # 过滤掉本体外的标签（防御性）
    data.behaviors = filter_behaviors(data.behaviors)
    data.emotion_patterns = filter_emotion_patterns(data.emotion_patterns)
    return data


# ============================================================
#  Layer 3 —— 价值提取（跨记忆聚合）
# ============================================================
async def run_layer3(
    memories: Optional[List[Memory]] = None,
    scope: str = "all",
    query_hint: str = "儿童成长价值观与行为模式",
) -> ValueAnalysis:
    """
    Layer 3：在多记忆上聚合价值信号，存入 value_analyses 表。
    :param memories: 待分析的记忆；None 则取全库。
    :param scope: 分析范围标签。
    :param query_hint: RAG 检索 query。
    """
    if memories is None:
        memories = get_all_memories()

    if not memories:
        return ValueAnalysis(id="", scope=scope, values=[], trend="记忆库为空，无法分析。")

    rag_chunks = _kb.retrieve(query_hint, k=4)
    rag_block = KnowledgeBase.format_for_prompt(rag_chunks)

    # 把每条记忆压缩成概要喂给 Layer3
    summaries = []
    for m in memories:
        ts = m.timestamp.strftime("%Y-%m-%d") if hasattr(m.timestamp, "strftime") else str(m.timestamp)
        summaries.append(
            f"[{ts}] {m.event}\n"
            f"  行为: {', '.join(m.behaviors) or '无'} | 情绪模式: {', '.join(m.emotion_patterns) or '无'}"
        )
    user_content = (
        f"共 {len(memories)} 条记忆，按时间正序：\n\n"
        + "\n".join(summaries)
        + "\n\n请基于以上多条记忆，识别长期价值信号与趋势。"
    )

    resp = await _client.beta.chat.completions.parse(
        model=cfg.model_name,
        messages=[
            {"role": "system", "content": layer3_system_prompt(_ontology_block, rag_block)},
            {"role": "user", "content": user_content},
        ],
        response_format=Layer3Output,
    )
    data: Layer3Output = resp.choices[0].message.parsed
    if not data:
        raise ValueError("Layer3 LLM 未返回有效结构化数据")

    # 防御性过滤
    for v in data.values:
        v.value = v.value if v.value in _values_set() else (v.value if filter_values([v.value]) else "growth")

    analysis = ValueAnalysis(scope=scope, values=data.values, trend=data.trend)
    save_value_analysis(analysis)
    return analysis


def _values_set():
    from backend.ontology import VALUES
    return set(VALUES.keys())


# ============================================================
#  完整单条流水线：Layer1 + Layer2 → Memory
# ============================================================
async def extract(raw_text: str, metadata: Optional[Dict] = None, child_name: Optional[str] = None) -> Memory:
    """
    单条记忆提取流水线：Layer1 → Layer2 → 组装 Memory → 存库（带去重）。

    data-based 去重：raw_text 已存在则直接返回已有记忆，不调 LLM、不新建。
    child_name: 隔离标识，存入数据库 child_name 列。
    """
    # 0. 去重短路
    existing = get_memory_by_raw_text(raw_text)
    if existing is not None:
        return existing

    # 1. Layer 1
    l1 = await run_layer1(raw_text)

    # 2. Layer 2
    l2 = await run_layer2(l1, raw_text)

    # 3. 组装 Memory
    importance_val = l1.importance
    if hasattr(importance_val, "value"):
        importance_val = importance_val.value

    memory = Memory(
        raw_text=raw_text,
        timestamp=l1.timestamp,
        event=l1.event,
        people=l1.people,
        action=l1.action,
        emotion_explicit=[e.value if hasattr(e, "value") else str(e) for e in l1.emotion_explicit],
        importance=int(importance_val),
        behaviors=l2.behaviors,
        emotion_patterns=l2.emotion_patterns,
        motivation=l2.motivation,
        learning_style=l2.learning_style,
        social_behavior=l2.social_behavior,
        behavior_confidence=l2.behavior_confidence,
        metadata=metadata or {},
    )

    is_new, stored = save_memory(memory, child_name=child_name)
    return stored


# ============================================================
#  Agent 单例（兼容旧接口 from backend.agent import agent）
# ============================================================
class ExtractionAgent:
    """分析 Agent：单条走 extract（Layer1+2），全库走 analyze_values（Layer3）。"""

    async def extract(self, raw_text: str, metadata: Optional[Dict] = None, child_name: Optional[str] = None) -> Memory:
        return await extract(raw_text, metadata, child_name)

    async def analyze_values(self, memories=None, scope="all", query_hint="儿童成长价值观与行为模式"):
        return await run_layer3(memories, scope, query_hint)


agent = ExtractionAgent()
