"""
TimeMirror 数据结构定义 —— 三层流水线版本。

设计原则：事件 → 行为信号 → 价值信号 → 长期趋势
- Layer 1（事件）：只提取客观事实，不做任何人格判断。
- Layer 2（行为）：从闭集本体里选行为/情绪模式标签 + 置信度，不做诊断。
- Layer 3（价值）：跨多条记忆聚合，从闭集本体里选价值标签 + 证据 + 置信度。

单条 Memory 只存 Layer 1 + Layer 2 的结果（不直接输出人格/价值）。
Layer 3 的价值信号是聚合产物，单独存 ValueAnalysis。
"""

from datetime import datetime
from enum import Enum
from typing import List, Dict, Any
from uuid import uuid4
from pydantic import BaseModel, Field


# ============================================================
#  枚举
# ============================================================
class Emotion(str, Enum):
    """基础情绪枚举（Layer 1 只记录文本中明确提及的）。"""
    HAPPY = "happy"
    EXCITED = "excited"
    PROUD = "proud"
    CURIOUS = "curious"
    CALM = "calm"
    CONFIDENT = "confident"
    FRUSTRATED = "frustrated"
    SAD = "sad"
    ANGRY = "angry"
    ANXIOUS = "anxious"
    SURPRISED = "surprised"
    CONFUSED = "confused"
    GRATEFUL = "grateful"
    LOVING = "loving"
    NEUTRAL = "neutral"


class Importance(int, Enum):
    """重要程度 1-10。"""
    LOW = 1
    BELOW_AVERAGE = 2
    AVERAGE = 3
    SLIGHTLY_IMPORTANT = 4
    MODERATELY_IMPORTANT = 5
    IMPORTANT = 6
    QUITE_IMPORTANT = 7
    VERY_IMPORTANT = 8
    EXTREMELY_IMPORTANT = 9
    CRITICAL = 10


# ============================================================
#  Layer 1 输出：客观事件提取
# ============================================================
class Layer1Output(BaseModel):
    """Layer 1：事件提取 —— 只提取客观事实，不解释人格。"""
    event: str = Field(..., description="一句中文客观描述发生了什么（谁+做了什么+关键细节），不加评价词")
    timestamp: datetime = Field(..., description="事件发生时间，从文本提取或按语境推测")
    people: List[str] = Field(default_factory=list, description="文本中明确出现的人物原名，不臆造角色")
    action: str = Field(..., description="主角具体做了什么（客观动作描述），不推断动机")
    emotion_explicit: List[Emotion] = Field(
        default_factory=list,
        description="文本中【明确写出来】的情绪（不是推断的）。没写就留空。"
    )
    importance: Importance = Field(default=Importance.AVERAGE, description="1-10 重要程度")

    model_config = {"use_enum_values": True}


# ============================================================
#  Layer 2 输出：行为分析
# ============================================================
class Layer2Output(BaseModel):
    """Layer 2：行为分析 —— 从闭集本体选标签 + 置信度，不做诊断。"""
    behaviors: List[str] = Field(
        default_factory=list,
        description="从 BEHAVIORS 本体里选的行为标签（英文 key），只选有证据支持的"
    )
    emotion_patterns: List[str] = Field(
        default_factory=list,
        description="从 EMOTION_PATTERNS 本体里选的情绪模式标签（英文 key）"
    )
    motivation: str = Field(default="", description="推测的动机（谨慎，标注为推测）")
    learning_style: str = Field(default="", description="体现的学习方式（若有）")
    social_behavior: str = Field(default="", description="体现的社交行为（若有）")
    behavior_confidence: float = Field(
        default=0.5, ge=0.0, le=1.0,
        description="本次行为分析的整体置信度 0-1（证据越充分越高）"
    )

    model_config = {"use_enum_values": True}


# ============================================================
#  Layer 3 输出：价值信号（聚合）
# ============================================================
class ValueSignal(BaseModel):
    """单个价值信号。"""
    value: str = Field(..., description="从 VALUES 本体里选的价值标签（英文 key）")
    confidence: float = Field(..., ge=0.0, le=1.0, description="置信度 0-1")
    evidence: List[str] = Field(
        default_factory=list,
        description="支撑证据，引用具体记忆的事件/时间，例如 '2026-03-01: 第一次吃菠菜辅食却笑着吐泡泡'"
    )


class Layer3Output(BaseModel):
    """Layer 3：跨记忆价值提取结果。"""
    values: List[ValueSignal] = Field(default_factory=list, description="识别出的长期价值信号")
    trend: str = Field(default="", description="长期趋势小结（基于价值信号的发展方向）")

    model_config = {"use_enum_values": True}


# ============================================================
#  Memory（库内单条记录，存 Layer1 + Layer2）
# ============================================================
class Memory(BaseModel):
    """库内单条记忆：Layer 1 客观事实 + Layer 2 行为信号。不直接存人格/价值。"""
    id: str = Field(default_factory=lambda: str(uuid4()), description="唯一标识")
    raw_text: str = Field(..., description="原始文本")
    timestamp: datetime = Field(..., description="事件时间")

    # Layer 1
    event: str = Field(..., description="客观事件描述")
    people: List[str] = Field(default_factory=list)
    action: str = Field(default="", description="客观动作")
    emotion_explicit: List[str] = Field(
        default_factory=list, description="文本中明确提及的情绪（字符串形式，如 'happy'）"
    )
    importance: int = Field(default=3, description="1-10 重要程度")

    # Layer 2
    behaviors: List[str] = Field(default_factory=list, description="行为标签（BEHAVIORS key）")
    emotion_patterns: List[str] = Field(default_factory=list, description="情绪模式标签")
    motivation: str = Field(default="")
    learning_style: str = Field(default="")
    social_behavior: str = Field(default="")
    behavior_confidence: float = Field(default=0.5)

    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"use_enum_values": True, "json_encoders": {datetime: lambda v: v.isoformat()}}

    def summary(self) -> str:
        """可读摘要。"""
        return (
            f"[{self.timestamp.strftime('%Y-%m-%d') if hasattr(self.timestamp,'strftime') else self.timestamp}] "
            f"{self.event}\n"
            f"  行为: {', '.join(self.behaviors) or '无'}\n"
            f"  情绪模式: {', '.join(self.emotion_patterns) or '无'}\n"
            f"  置信度: {self.behavior_confidence:.2f}"
        )


# ============================================================
#  ValueAnalysis（Layer 3 聚合结果，单独存储）
# ============================================================
class ValueAnalysis(BaseModel):
    """Layer 3 聚合分析结果。"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    scope: str = Field(..., description="分析范围，如 'all' 或 'retrieved:<query>'")
    values: List[ValueSignal] = Field(default_factory=list)
    trend: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"use_enum_values": True, "json_encoders": {datetime: lambda v: v.isoformat()}}


# ============================================================
#  SQLAlchemy ORM（聊天历史等关系型表）
# ============================================================
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class ChatHistory(Base):
    """聊天历史表。"""
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_message = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ChatHistory(id={self.id})>"
