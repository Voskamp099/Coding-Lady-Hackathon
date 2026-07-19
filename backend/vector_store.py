"""
向量索引 + 分类模块（Agent 2 的记忆检索层）。

职责：
1. 把库里所有 Memory 向量化（embedding）。
2. 提供语义检索：给定用户问题，返回最相关的 K 条记忆。
3. 提供分类：用 KMeans 把记忆聚成若干簇，并自动打标签（top terms + 高频 values/interests），
   供 LLM 做“价值观画像”时使用。

这是“embedding 向量化 + 做一下分类 + llm api 有需要的时候来读取”这一思路的落地。
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from backend.embeddings import Embedder, get_embedder
from backend.memory_repository import get_all_memories
from backend.models import Memory


@dataclass
class MemoryCluster:
    """一个记忆簇的分类结果。"""
    cluster_id: int
    size: int
    label: str                       # 自动起的标签（top terms）
    top_terms: List[str]             # 区分性最强的词/n-gram
    top_behaviors: List[str] = field(default_factory=list)        # 该簇高频行为标签
    top_emotion_patterns: List[str] = field(default_factory=list) # 该簇高频情绪模式
    top_emotion_explicit: List[str] = field(default_factory=list) # 该簇高频基本情绪
    importance_avg: float = 0.0
    memory_ids: List[str] = field(default_factory=list)


@dataclass
class RetrievalResult:
    """单条检索结果。"""
    memory: Memory
    score: float                     # 相似度分数


def _build_searchable_text(m: Memory) -> str:
    """
    把一条 Memory 拼成一段“可检索文本”。
    使用 Layer1 客观事件 + Layer2 行为/情绪模式标签 + 动机/学习方式/社交行为，
    让检索既能命中行为描述，也能命中行为信号与情绪模式。
    """
    parts = [
        getattr(m, "event", "") or "",
        getattr(m, "raw_text", "") or "",
        getattr(m, "action", "") or "",
        " ".join(getattr(m, "people", []) or []),
        " ".join(getattr(m, "behaviors", []) or []),
        " ".join(getattr(m, "emotion_patterns", []) or []),
        " ".join(getattr(m, "emotion_explicit", []) or []),
        getattr(m, "motivation", "") or "",
        getattr(m, "learning_style", "") or "",
        getattr(m, "social_behavior", "") or "",
    ]
    return "\n".join(p for p in parts if p)


class VectorIndex:
    """
    记忆向量索引。

    用法：
        idx = VectorIndex()           # 加载并构建索引
        idx.rebuild()                 # 记忆更新后重建
        results = idx.search("我要不要去纽约工作", k=8)
        clusters = idx.classify(n_clusters=4)
    """

    def __init__(self, embedder: Optional[Embedder] = None, memories: Optional[List[Memory]] = None):
        self.embedder = embedder or get_embedder()
        self.memories: List[Memory] = memories if memories is not None else get_all_memories()
        self.texts: List[str] = []
        self.vectors: Optional[np.ndarray] = None  # shape=(n, dim)
        self._unit: Optional[np.ndarray] = None     # 归一化后的向量，用于余弦相似
        self.rebuild()

    # ---------- 索引构建 ----------
    def rebuild(self) -> "VectorIndex":
        """重新拉取记忆并构建向量索引。"""
        self.memories = get_all_memories()
        self.texts = [_build_searchable_text(m) for m in self.memories]

        if not self.memories:
            self.vectors = np.zeros((0, self.embedder.dim or 1), dtype=np.float32)
            self._unit = self.vectors
            return self

        # TF-IDF 需要先 fit；API 版 fit 是空操作
        self.embedder.fit(self.texts)
        self.vectors = self.embedder.embed(self.texts)
        self._unit = _l2_normalize(self.vectors)
        return self

    # ---------- 语义检索 ----------
    def search(self, query: str, k: int = 8) -> List[RetrievalResult]:
        """
        按语义相似度检索 top-k 记忆。
        返回按分数降序排列的 RetrievalResult 列表。
        """
        if not self.memories:
            return []

        q_vec = self.embedder.embed_query(query).astype(np.float32)
        q_unit = _l2_normalize(q_vec.reshape(1, -1))
        # 余弦相似 = 归一化后点积
        sims = (self._unit @ q_unit.T).reshape(-1)

        k = min(k, len(self.memories))
        # 取 top-k 的下标
        top_idx = np.argsort(-sims)[:k]
        results = []
        for i in top_idx:
            results.append(RetrievalResult(memory=self.memories[i], score=float(sims[i])))
        return results

    # ---------- 分类（聚类） ----------
    def classify(self, n_clusters: int = 4) -> List[MemoryCluster]:
        """
        用 KMeans 把记忆聚成 n_clusters 簇，并自动生成标签。
        记忆数不足时簇数会自动下调。
        """
        n = len(self.memories)
        if n == 0:
            return []

        # 簇数不能超过样本数
        k = max(1, min(n_clusters, n))

        from sklearn.cluster import KMeans

        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(self.vectors)

        # 逐簇汇总
        clusters: List[MemoryCluster] = []
        for cid in range(k):
            member_idx = [i for i, lb in enumerate(labels) if lb == cid]
            if not member_idx:
                continue

            member_mems = [self.memories[i] for i in member_idx]

            # 高频 behaviors / emotion_patterns / emotion_explicit
            top_behaviors = _topk_counter(_flatten([getattr(m, "behaviors", []) or [] for m in member_mems]), 5)
            top_emotion_patterns = _topk_counter(_flatten([getattr(m, "emotion_patterns", []) or [] for m in member_mems]), 5)
            top_emotion_explicit = _topk_counter(_flatten([getattr(m, "emotion_explicit", []) or [] for m in member_mems]), 5)

            # 重要度均值
            imp_vals = [
                (m.importance.value if hasattr(m.importance, "value") else m.importance)
                for m in member_mems
            ]
            imp_avg = float(np.mean(imp_vals)) if imp_vals else 0.0

            # top terms：用簇心最近的几条记忆的 event 关键词作为标签
            center = km.cluster_centers_[cid]
            dists = np.linalg.norm(self.vectors[member_idx] - center, axis=1)
            nearest_local = np.argsort(dists)[:3]
            label_parts = [member_mems[j].event for j in nearest_local]
            label = " / ".join(label_parts)[:80]

            clusters.append(MemoryCluster(
                cluster_id=cid,
                size=len(member_idx),
                label=label,
                top_terms=[t for t in label_parts],
                top_behaviors=top_behaviors,
                top_emotion_patterns=top_emotion_patterns,
                top_emotion_explicit=top_emotion_explicit,
                importance_avg=imp_avg,
                memory_ids=[m.id for m in member_mems],
            ))

        # 按规模降序
        clusters.sort(key=lambda c: c.size, reverse=True)
        return clusters

    # ---------- 统计画像（供 LLM 用） ----------
    def global_profile(self) -> dict:
        """
        生成全库行为/情绪模式/基本情绪频次统计，给 LLM 做“画像”时当证据。
        （价值信号由 Layer3 单独产出，不在这里统计。）
        """
        if not self.memories:
            return {"total": 0}

        behaviors = _topk_counter(_flatten([getattr(m, "behaviors", []) or [] for m in self.memories]), 10)
        emotion_patterns = _topk_counter(_flatten([getattr(m, "emotion_patterns", []) or [] for m in self.memories]), 10)
        emotion_explicit = _topk_counter(_flatten([getattr(m, "emotion_explicit", []) or [] for m in self.memories]), 10)
        imp_vals = [
            (m.importance.value if hasattr(m.importance, "value") else m.importance)
            for m in self.memories
        ]
        return {
            "total": len(self.memories),
            "top_behaviors": behaviors,
            "top_emotion_patterns": emotion_patterns,
            "top_emotion_explicit": emotion_explicit,
            "importance_avg": float(np.mean(imp_vals)) if imp_vals else 0.0,
        }


# ============================================================
#  小工具
# ============================================================
def _l2_normalize(mat: np.ndarray) -> np.ndarray:
    """L2 归一化，避免除零。支持 (n,d) 或 (1,d)。"""
    norm = np.linalg.norm(mat, axis=-1, keepdims=True)
    norm = np.where(norm == 0, 1e-10, norm)
    return (mat / norm).astype(np.float32)


def _flatten(list_of_lists):
    out = []
    for sub in list_of_lists:
        if sub:
            out.extend(sub)
    return out


def _topk_counter(items: List[str], k: int) -> List[str]:
    if not items:
        return []
    c = Counter(items)
    return [item for item, _ in c.most_common(k)]
