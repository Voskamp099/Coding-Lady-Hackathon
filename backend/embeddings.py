"""
向量化（Embedding）模块 —— 可插拔的 Embedder 接口。

设计目的：
- Agent 2（对话 agent）需要把记忆 embedding 向量化、做分类、按需检索。
- 这里提供两种实现：
  1. StepFunEmbedder —— 调用 OpenAI 兼容的 /v1/embeddings 接口（真实语义向量）
  2. TfidfEmbedder   —— 基于 sklearn 的本地 TF-IDF（字符 n-gram，适合中文，离线可跑）
- 默认走 TF-IDF：零下载、零额外 API 费用、保证“能跑通”。
  若 StepFun 账号开通了 embedding 模型，把环境变量 EMBEDDER_PROVIDER=stepfun 即可切换。

接口约定（所有 Embedder 都实现）：
- dim -> int               向量维度
- fit(corpus: list[str])   在语料上训练（TF-IDF 需要；API 版为空操作）
- embed(texts) -> ndarray   批量向量化，shape=(n, dim)
- embed_query(text) -> ndarray  单条查询向量化，shape=(dim,)
"""

from __future__ import annotations

import os
from typing import List, Optional

import numpy as np

from backend.config import get_settings


# ============================================================
#  Embedder 抽象基类
# ============================================================
class Embedder:
    """所有 Embedder 的基类。"""

    name: str = "base"
    dim: int = 0

    def fit(self, corpus: List[str]) -> "Embedder":
        """在语料上训练（本地向量izer需要）。API 版直接返回 self。"""
        return self

    def embed(self, texts: List[str]) -> np.ndarray:
        raise NotImplementedError

    def embed_query(self, text: str) -> np.ndarray:
        return self.embed([text])[0]


# ============================================================
#  TfidfEmbedder —— 本地、离线、零下载
# ============================================================
class TfidfEmbedder(Embedder):
    """
    基于 sklearn TfidfVectorizer 的本地向量化。
    使用字符级 2-gram，对中文友好，不需要分词也不需要下载模型。
    """

    name = "tfidf"

    def __init__(self, ngram_range=(2, 4), max_features=8000):
        self._ngram_range = ngram_range
        self._max_features = max_features
        self._vec = None
        self.dim = 0

    def fit(self, corpus: List[str]) -> "TfidfEmbedder":
        from sklearn.feature_extraction.text import TfidfVectorizer

        self._vec = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=self._ngram_range,
            max_features=self._max_features,
            min_df=1,
        )
        self._vec.fit(corpus)
        self.dim = len(self._vec.get_feature_names_out())
        return self

    def embed(self, texts: List[str]) -> np.ndarray:
        if self._vec is None:
            raise RuntimeError("TfidfEmbedder 未 fit，请先在语料上调用 fit()")
        return self._vec.transform(texts).toarray().astype(np.float32)


# ============================================================
#  StepFunEmbedder —— 调用 OpenAI 兼容的 /v1/embeddings
# ============================================================
class StepFunEmbedder(Embedder):
    """
    调用 StepFun / OpenAI 兼容的 embeddings API。
    需要环境变量里配置 EMBEDDING_MODEL（默认 step-1o-embed）。
    若 API 不支持，会抛异常——调用方应回退到 TfidfEmbedder。
    """

    name = "stepfun"

    def __init__(self, model: Optional[str] = None, batch_size: int = 32):
        import httpx
        from openai import OpenAI

        cfg = get_settings()
        self._model = model or os.getenv("EMBEDDING_MODEL", "step-1o-embed")
        self._batch = batch_size
        self._client = OpenAI(
            api_key=cfg.openai_api_key,
            base_url=cfg.openai_base_url,
            http_client=httpx.Client(trust_env=False, timeout=60.0),
        )
        # 探测一次拿到真实维度
        probe = self._client.embeddings.create(model=self._model, input=["维度探测"])
        self.dim = len(probe.data[0].embedding)

    def embed(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        all_vecs: List[List[float]] = []
        for i in range(0, len(texts), self._batch):
            chunk = texts[i : i + self._batch]
            resp = self._client.embeddings.create(model=self._model, input=chunk)
            all_vecs.extend([d.embedding for d in resp.data])
        return np.array(all_vecs, dtype=np.float32)


# ============================================================
#  工厂：根据环境变量选择 Embedder，失败自动回退
# ============================================================
_default_embedder: Optional[Embedder] = None


def get_embedder(provider: Optional[str] = None) -> Embedder:
    """
    获取一个 Embedder 实例。
    - provider='stepfun' 或环境变量 EMBEDDER_PROVIDER=stepfun → 尝试 API 版
    - 其它情况 → 本地 TF-IDF
    - API 版初始化失败时自动回退到 TF-IDF，保证永远能跑通
    """
    global _default_embedder
    if _default_embedder is not None and provider is None:
        return _default_embedder

    provider = provider or os.getenv("EMBEDDER_PROVIDER", "tfidf").lower()
    if provider == "stepfun":
        try:
            _default_embedder = StepFunEmbedder()
            print(f"[embeddings] 使用 StepFun API embedding，dim={_default_embedder.dim}")
            return _default_embedder
        except Exception as e:
            print(f"[embeddings] StepFun embedding 不可用 ({e})，回退到本地 TF-IDF")

    _default_embedder = TfidfEmbedder()
    print(f"[embeddings] 使用本地 TF-IDF embedding")
    return _default_embedder
