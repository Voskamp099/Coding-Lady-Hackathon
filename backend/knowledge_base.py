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

    # ---------- 五种时间定义（用于分类 prompt） ----------
    def get_five_time_types_definition(self) -> str:
        """返回王潇·儿童五种时间的完整定义，用于分类 prompt。"""
        chunks = [c for c in self.chunks if "五种时间" in c.section or "王潇" in c.section]
        if not chunks:
            return (
                "健康(health)：运动、户外、身体发育——让身体有活力\n"
                "好玩(play)：纯粹为高兴而玩，不为收入、健康或意义\n"
                "生存(survival)：应对困难、克服恐惧、从被动到主动\n"
                "成就(achievement)：创造、完成、掌控感——我能行的体验\n"
                "心流(flow)：全情投入、忘记时间、能力与挑战匹配"
            )
        return "\n\n".join(f"## {c.title}\n{c.content}" for c in chunks)

    # ---------- 五种时间分类专用（紧凑定义 + few-shot 示例） ----------
    def get_five_time_types_classify_context(self) -> str:
        """
        返回给「时间类型分类器」用的紧凑上下文：每类一句核心定义 + 判定线索，
        再附上 RAG KB 里的真实举例做 few-shot。
        比完整 definition 短很多（省 token），但判定信号更明确、每条都能落到五类之一。
        """
        # 1) 紧凑定义（含判定线索关键词，帮助 LLM 稳定命中，非正则匹配）
        definitions = (
            "health（健康）：运动、户外、身体发育、大动作、精细动作、睡眠、饮食、生病恢复——身体的活力与成长。\n"
            "play（好玩）：纯粹为高兴而玩、好奇、探索、发现、模仿、感官体验——不为目的，玩本身就是快乐。\n"
            "survival（生存）：面对困难/恐惧/陌生/规则/挫折/分离，从被动到主动、克服、坚持、自我保护——学会应对挑战。\n"
            "achievement（成就）：创造、完成、掌控、学会新技能、里程碑、‘我能行/我做到了’的成就感。\n"
            "flow（心流）：长时间全情投入、忘记时间、深度专注、深度共情、情感顿悟——能力与挑战匹配的最高质量快乐。\n"
        )
        # 2) few-shot 示例（优先取 KB 的「举例说明」小节；取不到则用内置示例）
        examples = ""
        for c in self.chunks:
            if "五种时间" in c.section and "举例" in (c.subsection or ""):
                # 只取示例正文的前若干行，避免过长
                lines = [ln for ln in c.content.splitlines() if "|" in ln and "记录" not in ln and "---" not in ln]
                picked = lines[:8]
                if picked:
                    examples = "\n".join(picked)
                break
        if not examples:
            examples = (
                "| 扒着栏杆自主站立，兴奋手舞足蹈 | health | 身体发育突破 |\n"
                "| 按按摩椅开关觉得好玩反复按 | play | 纯粹好奇和玩 |\n"
                "| 发烧黏奶奶，第二天又要站起来 | survival | 面对疾病从脆弱到恢复 |\n"
                "| 反复掰玩具胡萝卜三四次终于掰开 | achievement | 创造完成、我能行 |\n"
                "| 蹲着看蚂蚁搬家40分钟完全沉浸 | flow | 全情投入忘记时间 |\n"
            )
        return f"# 五种时间定义\n{definitions}\n# 判定示例（记录 → 类型 → 理由）\n{examples}"

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
