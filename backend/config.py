"""配置管理模块
支持环境变量和 .env 文件
"""

import os
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # API 配置
    api_host: str = Field(default="0.0.0.0", description="API服务地址")
    api_port: int = Field(default=8000, description="API服务端口")
    debug: bool = Field(default=True, description="调试模式")

    # OpenAI/DeepSeek/StepFun 配置
    openai_api_key: str = Field(..., description="API Key")
    openai_base_url: str = Field(
        default="https://api.deepseek.com/v1",
        description="API Base URL"
    )
    model_name: str = Field(default="deepseek-chat", description="模型名称")

    # 模型参数
    max_tokens: int = Field(default=2048, description="最大token数")
    temperature: float = Field(default=0.7, description="温度参数")

    # ---- 数据集配置（一行切换 A/B 两组数据）----
    # A: 儿童 0-7 岁 → DATASET_CSV_PATH=data/growth-records.csv, DATASET_LABEL=child_0_7
    # B: 人生 0-22 岁 → DATASET_CSV_PATH=<你的新csv>, DATASET_LABEL=life_0_22
    dataset_csv_path: str = Field(
        default="data/growth-records.csv",
        description="要导入的 CSV 数据集路径（相对项目根或绝对路径）。改这一行即可切换数据集。"
    )
    dataset_label: str = Field(
        default="child_0_7",
        description="数据集标签：child_0_7（儿童版）或 life_0_22（人生决策版）"
    )
    ingest_max_rows: int = Field(default=0, description="导入最大条数，0=全部")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# ⚠️ 关键：全局变量必须在类定义之外，不能缩进！
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """获取配置实例（单例模式）"""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

def reload_settings() -> Settings:
    """重新加载配置"""
    global _settings
    _settings = Settings()
    return _settings

# 为了兼容 from backend.config import settings
settings = get_settings()


def resolve_dataset_path() -> str:
    """把 dataset_csv_path 解析成绝对路径（相对项目根）。"""
    p = get_settings().dataset_csv_path
    if os.path.isabs(p):
        return p
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(root, p)


