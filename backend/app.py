"""
API 端点 —— 记忆创建/清空/统计 + Layer3 价值分析 + 对话。
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from backend.models import Memory
from backend.agent import agent
from backend.chat_agent import chat_agent
from backend.memory_repository import (
    count_memories,
    clear_database,
    clear_memories_for_child,
    get_all_memories,
    save_memory,
)
import uuid
from datetime import datetime, date


# ============ 输入/输出模型 ============


class CreateMemoryRequest(BaseModel):
    raw_text: str = Field(..., min_length=1, description="原始事件文本")
    child_name: Optional[str] = Field(
        default=None, description="归属孩子的名字，用于数据隔离"
    )
    metadata: Optional[Dict[str, Any]] = Field(default=None)


class CreateMemoryResponse(BaseModel):
    success: bool
    memory: Optional[Memory] = None
    message: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="用户问题")
    k: int = Field(default=8, description="检索相关记忆条数")
    with_evidence: bool = Field(default=False, description="是否返回检索证据")
    child_name: Optional[str] = Field(
        default=None, description="归属孩子的名字，用于按名字隔离检索"
    )
    user_role: Optional[str] = Field(
        default="parent",
        description="对话视角：parent=家长视角(第三人称) / child=孩子视角(第二人称)",
    )


class ChatResponse(BaseModel):
    answer: str
    retrieved_memories: List[Dict[str, Any]] = []
    value_synthesis: Optional[Dict[str, Any]] = None
    stats: Dict[str, Any] = {}


class ValueAnalysisResponse(BaseModel):
    success: bool
    values: List[Dict[str, Any]] = []
    trend: str = ""
    message: str = ""


# ============ 路由 ============

router = APIRouter(prefix="/api", tags=["timemirror"])


# ---------- 记忆 ----------


@router.post("/memories/create", response_model=CreateMemoryResponse)
async def create_memory(request: CreateMemoryRequest):
    """创建记忆（走 Layer1+Layer2 三层流水线）。"""
    try:
        memory = await agent.extract(
            raw_text=request.raw_text,
            metadata=request.metadata,
            child_name=request.child_name,
        )
        return CreateMemoryResponse(success=True, memory=memory, message="记忆创建成功")
    except Exception as e:
        return CreateMemoryResponse(
            success=False, memory=None, message=f"创建失败: {e}"
        )


@router.get("/memories/count")
async def memories_count(child_name: Optional[str] = None):
    """记忆总数。传 child_name 则仅统计该名字下的记忆。"""
    return {"count": count_memories(child_name=child_name)}


@router.get("/memories/list")
async def memories_list(child_name: Optional[str] = None, limit: int = 100):
    """列出记忆（按时间正序）。传 child_name 则只返回该名字下的记忆。"""
    mems = get_all_memories(child_name=child_name)
    return {
        "count": len(mems),
        "memories": [
            {
                "id": m.id,
                "timestamp": m.timestamp.isoformat()
                if hasattr(m.timestamp, "isoformat")
                else str(m.timestamp),
                "event": m.event,
                "raw_text": m.raw_text,
                "behaviors": m.behaviors,
                "emotion_patterns": m.emotion_patterns,
                "motivation": getattr(m, "motivation", None),
                "learning_style": getattr(m, "learning_style", None),
                "social_behavior": getattr(m, "social_behavior", None),
                "importance": m.importance,
                "metadata": m.metadata,
            }
            for m in mems[:limit]
        ],
    }


class ClearRequest(BaseModel):
    child_name: Optional[str] = Field(
        default=None, description="只清空该名字下的记忆；不传则清空全部"
    )


@router.post("/memories/clear")
async def memories_clear(request: ClearRequest = None):
    """清空数据库。必须传 child_name，只清该名字下的记忆，绝不全局清空。"""
    from backend.chat_agent import reset_index

    if not request or not request.child_name:
        # 安全措施：不传 child_name 时拒绝操作，绝不全局清空
        return {
            "success": False,
            "error": "必须指定 child_name 才能清空，不允许全局清空",
        }
    count = clear_memories_for_child(request.child_name)
    reset_index()
    return {
        "success": True,
        "cleared": {"memories": count},
        "scope": "child",
        "child_name": request.child_name,
    }


@router.get("/memories/test")
async def test_endpoint():
    return {"status": "ok", "message": "Memories API is running"}


# ---------- 演示数据一键导入（不走 LLM，秒级） ----------

_CONF_MAP = {"high": 3, "medium": 2, "low": 1}


def _map_demo_record(r: dict) -> Memory:
    """把演示 JSON 记录映射成 Memory（sample-children 儿童 / sample-life 人生 两种格式都兼容）。"""
    age = str(r.get("age", ""))
    year = r.get("year")
    date_str = r.get("date")  # 新增：支持 YYYY-MM-DD 精确日期
    # 时间戳：优先 date，其次 year，否则用 age 推算
    if date_str:
        ts = date_str
    elif year:
        try:
            ts = date(int(year), 1, 1).isoformat()
        except Exception:
            ts = datetime.now().isoformat()
    else:
        ts = f"demo-age-{age}" if age else datetime.now().isoformat()

    event = r.get("event", "")
    bg = r.get("background") or r.get("context") or ""
    decision = r.get("decision") or r.get("child_behavior") or ""
    outcome = r.get("outcome") or r.get("parent_observation") or ""
    emotion = r.get("emotion", "")
    time_types = r.get("timeTypes", [])  # 新增：五种时间分类

    raw_text = " | ".join(p for p in [event, bg, decision, outcome] if p)

    behaviors = r.get("behavior_signals") or []
    value_signals = r.get("value_signals") or []
    conf = r.get("confidence", "medium")
    importance = _CONF_MAP.get(str(conf).lower(), 2)

    return Memory(
        id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"demo-{r.get('id', '')}")),
        timestamp=ts,
        event=event,
        raw_text=raw_text,
        people=[],
        action=decision,
        emotion_explicit=[emotion] if emotion else [],
        importance=importance,
        behaviors=behaviors,
        emotion_patterns=[],
        motivation="",
        learning_style="",
        social_behavior="",
        behavior_confidence=float(_CONF_MAP.get(str(conf).lower(), 2)) / 3.0,
        metadata={
            "source": "demo_import",
            "demo_id": r.get("id"),
            "age": age,
            "year": year,
            "date": date_str,
            "time": r.get("time"),
            "emotion": emotion,
            "timeTypes": time_types,
            "value_signals": value_signals,
            "life_stage": r.get("life_stage"),
        },
        created_at=datetime.now(),
    )


def _display_name(child_name: Optional[str]) -> str:
    """复合键 parentName::childName → 只取孩子名用于显示。"""
    if not child_name:
        return ""
    if "::" in child_name:
        return child_name.split("::", 1)[1]
    return child_name


class ImportDemoRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(..., description="演示数据记录数组")
    clear_first: bool = Field(
        default=True, description="导入前是否清空该名字下的旧数据"
    )
    child_name: Optional[str] = Field(
        default=None, description="归属孩子名字，用于按名字隔离"
    )


@router.post("/memories/import-demo")
async def import_demo(request: ImportDemoRequest):
    """一键导入演示数据（不走 LLM，秒级）。按 child_name 隔离存储。"""
    child_name = request.child_name or "在的李生体"

    if request.clear_first:
        # 只清该名字下的记忆，不影响其他用户
        clear_memories_for_child(child_name)
        from backend.chat_agent import reset_index

        reset_index()

    new_count = 0
    skip_count = 0
    for r in request.records:
        mem = _map_demo_record(r)
        is_new, _ = save_memory(mem, child_name=child_name, skip_if_exists=True)
        if is_new:
            new_count += 1
        else:
            skip_count += 1

    return {
        "success": True,
        "imported": new_count,
        "skipped": skip_count,
        "total": count_memories(child_name=child_name),
        "child_name": child_name,
        "message": f"已为「{_display_name(child_name)}」导入 {new_count} 条演示数据（跳过 {skip_count} 条重复），当前共 {count_memories(child_name=child_name)} 条",
    }


# ---------- 用户批量导入（不走 LLM，秒级，前端 Memory 格式） ----------


class ImportBatchRequest(BaseModel):
    memories: List[Dict[str, Any]] = Field(
        ..., description="前端 Memory 格式的记录数组"
    )
    child_name: Optional[str] = Field(default=None, description="归属孩子名字")
    clear_first: bool = Field(
        default=False, description="导入前是否清空该名字下的旧数据"
    )


@router.post("/memories/import-batch")
async def import_batch(request: ImportBatchRequest):
    """批量导入用户上传的回忆（Excel/CSV 解析后），不走 LLM，秒级存储。按 child_name 隔离。"""
    child_name = request.child_name

    if request.clear_first and child_name:
        clear_memories_for_child(child_name)
        from backend.chat_agent import reset_index

        reset_index()

    new_count = 0
    skip_count = 0
    for m in request.memories:
        date_str = m.get("date") or datetime.now().isoformat()[:10]
        content = m.get("content", "")
        emotion = m.get("emotion", "平静")
        scene = m.get("scene", "家")
        time_types = m.get("timeTypes", [])
        tags = m.get("tags", [])

        raw_text = f"时间：{date_str}\n场景：{scene}\n情绪：{emotion}\n记录：{content}"

        mem = Memory(
            id=m.get("id") or str(uuid.uuid4()),
            timestamp=date_str,
            event=content[:200],
            raw_text=raw_text,
            people=[],
            action="",
            emotion_explicit=[emotion] if emotion else [],
            importance=2,
            behaviors=tags,
            emotion_patterns=[],
            motivation="",
            learning_style="",
            social_behavior="",
            behavior_confidence=0.6,
            metadata={
                "source": "batch_import",
                "date": date_str,
                "emotion": emotion,
                "scene": scene,
                "timeTypes": time_types,
                "tags": tags,
            },
            created_at=datetime.now(),
        )
        is_new, _ = save_memory(mem, child_name=child_name, skip_if_exists=True)
        if is_new:
            new_count += 1
        else:
            skip_count += 1

    total = count_memories(child_name=child_name) if child_name else count_memories()
    name_label = f"「{_display_name(child_name)}」" if child_name else ""
    return {
        "success": True,
        "imported": new_count,
        "skipped": skip_count,
        "total": total,
        "child_name": child_name,
        "message": f"已为{name_label}导入 {new_count} 条回忆（跳过 {skip_count} 条重复），当前共 {total} 条",
    }


# ---------- Layer3 价值分析 ----------


@router.post("/analysis/values", response_model=ValueAnalysisResponse)
async def analyze_values(scope: str = "all", child_name: Optional[str] = None):
    """对全库（或指定 child_name 范围）跑 Layer3 价值综合。"""
    try:
        mems = get_all_memories(child_name=child_name)
        if not mems:
            return ValueAnalysisResponse(
                success=False, message="该名字下还没有记忆，无法分析"
            )
        analysis = await agent.analyze_values(memories=mems, scope=scope)
        return ValueAnalysisResponse(
            success=True,
            values=[v.model_dump(mode="json") for v in analysis.values],
            trend=analysis.trend,
            message=f"识别出 {len(analysis.values)} 个价值信号",
        )
    except Exception as e:
        return ValueAnalysisResponse(success=False, message=f"分析失败: {e}")


# ---------- 对话 Agent ----------


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """对话 Agent：基于分层记忆 + 本体 + RAG + Layer3 做决策分析。"""
    result = await chat_agent.chat(
        user_message=request.message,
        k=request.k,
        with_evidence=request.with_evidence,
        child_name=request.child_name,
        user_role=request.user_role,
    )
    return ChatResponse(
        answer=result["answer"],
        retrieved_memories=result.get("retrieved_memories", []),
        value_synthesis=result.get("value_synthesis"),
        stats=result.get("stats", {}),
    )


# ---------- 五种时间 AI 分类（轻量级，用 KB 定义做 RAG） ----------


class ClassifyTimeRequest(BaseModel):
    text: str = Field(..., min_length=1, description="要分类的记忆文本")


class ClassifyTimeResponse(BaseModel):
    success: bool
    type: Optional[str] = None  # health / play / survival / achievement / flow
    label: Optional[str] = None  # 中文名
    message: str = ""


_VALID_TYPES = {
    "health": "健康",
    "play": "好玩",
    "survival": "生存",
    "achievement": "成就",
    "flow": "心流",
}


# LLM 输出 → 类型的解析映射（同时支持英文 key 和中文名，非正则分类，只是解析模型输出）
_LABEL_TO_TYPE = {v: k for k, v in _VALID_TYPES.items()}  # 健康→health ...


def _parse_time_type(raw: str) -> Optional[str]:
    """从 LLM 原始输出里解析出五类之一。先英文 key，再中文名。解析不到返回 None。"""
    if not raw:
        return None
    low = raw.strip().lower()
    # 1) 英文 key
    for t in _VALID_TYPES:
        if t in low:
            return t
    # 2) 中文名
    for label, t in _LABEL_TO_TYPE.items():
        if label in raw:
            return t
    return None


@router.post("/classify-time", response_model=ClassifyTimeResponse)
async def classify_time(request: ClassifyTimeRequest):
    """
    用 KB 里的五种时间「定义 + 举例」做 RAG few-shot，调 LLM 分类（不用正则）。
    轻量级：只发一条短 prompt（紧凑定义 + few-shot + 记忆文本），不走完整 chat pipeline。
    每条都能匹配：强制 LLM 从五类里选一个；解析同时兼容英文 key 与中文名。
    """
    from backend.knowledge_base import get_knowledge_base
    from backend.config import get_settings
    from openai import AsyncOpenAI
    import httpx

    cfg = get_settings()
    kb = get_knowledge_base()
    kb_context = kb.get_five_time_types_classify_context()

    system_prompt = (
        "你是 TimeMirror 的「儿童五种时间」分类器，依据王潇《小日常、大奇迹》的五种时间框架。\n"
        "你的唯一任务：把一条成长记录判定为且仅为五类之一。\n\n"
        f"{kb_context}\n\n"
        "# 判定规则\n"
        "1. 必须从 health / play / survival / achievement / flow 里选【恰好一个】最贴切的。\n"
        "2. 一条记录常同时含多类信号时，选【最核心、最能代表这件事意义】的那一类。\n"
        "3. 区分要点：\n"
        "   - 单纯图开心/好奇地玩 → play；克服害怕困难/面对陌生规则 → survival。\n"
        "   - 学会/完成/做到某事、有成果 → achievement；长时间忘我专注/深度共情顿悟 → flow。\n"
        "   - 跑跳爬、身体发育、饮食睡眠生病 → health。\n"
        "4. 绝不能拒答或说无法判断——一定要给出五类中的一个。\n"
        "# 输出\n"
        "只输出一个英文关键字（health / play / survival / achievement / flow），不要任何多余文字、标点或解释。"
    )
    user_prompt = f"请分类这条记录：\n{request.text[:400]}"

    try:
        client = AsyncOpenAI(
            api_key=cfg.openai_api_key,
            base_url=cfg.openai_base_url,
            http_client=httpx.AsyncClient(trust_env=False, timeout=30.0),
        )
        resp = await client.chat.completions.create(
            model=cfg.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=10,
            temperature=0.0,
        )
        raw = resp.choices[0].message.content or ""
        matched = _parse_time_type(raw)

        if not matched:
            # 极少数解析不到时兜底（保证"每条都能匹配"），不做正则分类
            matched = "play"

        return ClassifyTimeResponse(
            success=True,
            type=matched,
            label=_VALID_TYPES[matched],
            message=f"分类为：{_VALID_TYPES[matched]}",
        )
    except Exception as e:
        # LLM 失败也兜底，保证前端始终拿到一个可用分类
        return ClassifyTimeResponse(
            success=False,
            type="play",
            label="好玩",
            message=f"分类失败，默认为好玩: {e}",
        )
