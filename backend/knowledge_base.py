"""
心理学知识库 RAG（Retrieval-Augmented Generation）。

知识来源：RAG-knowledge-base.md —— 拾光镜四大理论基础手册
  1. 王潇·儿童五种时间（数据入口分类）
  2. 托马斯&切斯·儿童气质九维度（人格底色）
  3. 加德纳·多元智能（天赋潜能）
  4. 埃里克森·心理社会发展阶段（发展脉络）

工作方式：
- 启动时把 md 切分成若干知识块（按 ## / ### 标题），向量化。
- retrieve(query, k) 返回与 query 最相关的 k 个知识块。
- Layer 2 / Layer 3 / Chat Agent 在构造 prompt 时，把检索到的知识块注入，
  让 LLM 的分析有理论依据（而不是凭空臆断人格）。
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from backend.embeddings import Embedder, TfidfEmbedder, get_embedder


KB_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "RAG-knowledge-base.md"
)


@dataclass
class KnowledgeChunk:
    """一个知识块。"""
    chunk_id: int
    section: str        # 所属的 ## 大节标题
    subsection: str     # 所属的 ### 小节标题（可为空）
    title: str          # 展示用标题
    content: str        # 正文
    vector: Optional[np.ndarray] = None


class KnowledgeBase:
    """
    心理学理论 RAG 知识库（进程内单例）。

    用法：
        kb = KnowledgeBase()
        kb.load()                         # 加载并切分、向量化
        chunks = kb.retrieve("孩子面对失败的反应", k=3)
        block = kb.format_for_prompt(chunks)
    """

    _instance: Optional["KnowledgeBase"] = None

    def __init__(self, embedder: Optional[Embedder] = None, path: Optional[str] = None):
        self.embedder = embedder or TfidfEmbedder()
        self.path = path or KB_FILE
        self.chunks: List[KnowledgeChunk] = []
        self._matrix: Optional[np.ndarray] = None  # (n, dim)
        self._unit: Optional[np.ndarray] = None
        self._loaded = False

    @classmethod
    def get(cls) -> "KnowledgeBase":
        """单例。"""
        if cls._instance is None:
            cls._instance = KnowledgeBase()
            cls._instance.load()
        return cls._instance

    # ---------- 加载与切分 ----------
    def load(self) -> "KnowledgeBase":
        """读取 md、切分、向量化。若文件缺失则空库（不报错，保证能跑）。"""
        if self._loaded:
            return self
        self._loaded = True

        if not os.path.exists(self.path):
            print(f"[knowledge_base] 知识库文件不存在: {self.path}（RAG 将空跑）")
            return self

        with open(self.path, "r", encoding="utf-8") as f:
            text = f.read()

        self.chunks = self._split(text)
        if not self.chunks:
            return self

        # 用知识库自身语料 fit 一个 TF-IDF（独立于记忆库的 embedder）
        corpus = [self._chunk_text(c) for c in self.chunks]
        self.embedder.fit(corpus)
        vecs = self.embedder.embed(corpus)
        from backend.vector_store import _l2_normalize
        self._matrix = vecs
        self._unit = _l2_normalize(vecs)
        print(f"[knowledge_base] 加载 {len(self.chunks)} 个知识块，dim={self.embedder.dim}")
        return self

    @staticmethod
    def _chunk_text(c: KnowledgeChunk) -> str:
        return f"{c.section}\n{c.subsection}\n{c.content}"

    def _split(self, text: str) -> List[KnowledgeChunk]:
        """
        按 ## 大节切，再按 ### 小节细分。
        每个块带上所属大节标题，保证语义完整。
        """
        chunks: List[KnowledgeChunk] = []
        # 先按 ## 切大节
        big_sections = []
        current_title = "前言"
        current_lines: List[str] = []
        for line in text.splitlines():
            if line.startswith("## "):
                if current_lines:
                    big_sections.append((current_title, "\n".join(current_lines)))
                current_title = line[3:].strip()
                current_lines = []
            else:
                current_lines.append(line)
        if current_lines:
            big_sections.append((current_title, "\n".join(current_lines)))

        # 每个大节内按 ### 切小块
        cid = 0
        for section_title, section_body in big_sections:
            sub_parts = []
            cur_sub = ""
            cur_lines: List[str] = []
            for line in section_body.splitlines():
                if line.startswith("### "):
                    if cur_lines:
                        sub_parts.append((cur_sub, "\n".join(cur_lines)))
                    cur_sub = line[4:].strip()
                    cur_lines = []
                else:
                    cur_lines.append(line)
            if cur_lines:
                sub_parts.append((cur_sub, "\n".join(cur_lines)))

            # 若没有 ### 子节，整节作为一块
            if not sub_parts:
                sub_parts = [("", section_body)]

            for sub_title, content in sub_parts:
                content = content.strip()
                if len(content) < 40:
                    continue
                title = section_title + (f" · {sub_title}" if sub_title else "")
                chunks.append(KnowledgeChunk(
                    chunk_id=cid,
                    section=section_title,
                    subsection=sub_title,
                    title=title,
                    content=content,
                ))
                cid += 1
        return chunks

    # ---------- 检索 ----------
    def retrieve(self, query: str, k: int = 3) -> List[KnowledgeChunk]:
        """按语义检索 top-k 知识块。"""
        if not self.chunks or self._unit is None:
            return []
        from backend.vector_store import _l2_normalize
        q_vec = self.embedder.embed_query(query).astype(np.float32)
        q_unit = _l2_normalize(q_vec.reshape(1, -1))
        sims = (self._unit @ q_unit.T).reshape(-1)
        k = min(k, len(self.chunks))
        top_idx = np.argsort(-sims)[:k]
        return [self.chunks[i] for i in top_idx]

    # ---------- 格式化 ----------
    @staticmethod
    def format_for_prompt(chunks: List[KnowledgeChunk]) -> str:
        """把检索到的知识块格式化成可注入 prompt 的文本。"""
        if not chunks:
            return "（未检索到相关理论依据）"
        lines = ["# 相关心理学理论依据（RAG 检索结果，供分析时引用）\n"]
        for i, c in enumerate(chunks, 1):
            lines.append(f"## 依据{i}：{c.title}\n{c.content}\n")
        return "\n".join(lines)


def get_knowledge_base() -> KnowledgeBase:
    """便捷单例访问。"""
    return KnowledgeBase.get()
