"""
事件提取 Agent —— 兼容入口。

实际逻辑已迁移到 app/extraction_pipeline.py（三层流水线）。
这里保留 `agent` 单例，使旧代码 `from backend.agent import agent` 继续可用。
"""

from backend.extraction_pipeline import agent, extract, run_layer1, run_layer2, run_layer3

__all__ = ["agent", "extract", "run_layer1", "run_layer2", "run_layer3"]
