# app/memory_repository.py
"""
记忆仓储层 —— 三层流水线版本。

职责：
- save_memory：写入单条 Memory（Layer1+Layer2），保留 data-based 去重。
- get/count：读取记忆。
- ValueAnalysis CRUD：Layer3 聚合结果的存取。
- clear_database：清空（前端按钮 / 切换数据集）。
"""
import json
import hashlib
from typing import List, Optional

from backend.database import get_connection, clear_database as _clear_database, clear_memories_for_child as _clear_memories_for_child
from backend.models import Memory, ValueAnalysis, ValueSignal


# ============================================================
#  去重辅助
# ============================================================
def _content_hash(raw_text: str) -> str:
    return hashlib.sha256((raw_text or "").strip().encode("utf-8")).hexdigest()


def memory_exists_by_raw_text(raw_text: str, child_name: Optional[str] = None) -> bool:
    """检查某条 raw_text 是否已入库（data-based 去重）。

    child_name 给定时按账号隔离去重（不同账号可各自导入相同内容）；
    省略时全局去重（旧行为，向后兼容）。
    """
    conn = get_connection()
    cursor = conn.cursor()
    if child_name is not None:
        cursor.execute(
            "SELECT 1 FROM memories WHERE raw_text = ? AND child_name = ? LIMIT 1",
            ((raw_text or "").strip(), child_name),
        )
    else:
        cursor.execute("SELECT 1 FROM memories WHERE raw_text = ? LIMIT 1", ((raw_text or "").strip(),))
    found = cursor.fetchone() is not None
    conn.close()
    return found


def get_memory_by_raw_text(raw_text: str, child_name: Optional[str] = None) -> Optional[Memory]:
    """按 raw_text 取已存在的记忆。child_name 给定时只在该账号下查找。"""
    conn = get_connection()
    cursor = conn.cursor()
    if child_name is not None:
        cursor.execute(
            "SELECT * FROM memories WHERE raw_text = ? AND child_name = ? LIMIT 1",
            ((raw_text or "").strip(), child_name),
        )
    else:
        cursor.execute("SELECT * FROM memories WHERE raw_text = ? LIMIT 1", ((raw_text or "").strip(),))
    row = cursor.fetchone()
    conn.close()
    return _row_to_memory(row) if row else None


# ============================================================
#  序列化
# ============================================================
def _row_to_memory(row) -> Optional[Memory]:
    if row is None:
        return None
    try:
        # 把 child_name 列镜像到 metadata，方便下游不感知 schema
        child_name_col = row["child_name"] if "child_name" in row.keys() else None
        metadata = json.loads(row["metadata"]) if row["metadata"] else {}
        if child_name_col and not metadata.get("child_name"):
            metadata["child_name"] = child_name_col
        return Memory(
            id=row["id"],
            timestamp=row["timestamp"],
            event=row["event"],
            raw_text=row["raw_text"],
            people=json.loads(row["people"]) if row["people"] else [],
            action=row["action"] if "action" in row.keys() else "",
            emotion_explicit=json.loads(row["emotion_explicit"]) if row["emotion_explicit"] and "emotion_explicit" in row.keys() else [],
            importance=row["importance"],
            behaviors=json.loads(row["behaviors"]) if row["behaviors"] and "behaviors" in row.keys() else [],
            emotion_patterns=json.loads(row["emotion_patterns"]) if row["emotion_patterns" ] and "emotion_patterns" in row.keys() else [],
            motivation=row["motivation"] if "motivation" in row.keys() else "",
            learning_style=row["learning_style"] if "learning_style" in row.keys() else "",
            social_behavior=row["social_behavior"] if "social_behavior" in row.keys() else "",
            behavior_confidence=row["behavior_confidence"] if "behavior_confidence" in row.keys() else 0.5,
            metadata=metadata,
            created_at=row["created_at"] if "created_at" in row.keys() else None,
        )
    except Exception as e:
        print(f"Error deserializing memory: {e}")
        return None


# ============================================================
#  写入
# ============================================================
def save_memory(memory: Memory, child_name: Optional[str] = None, skip_if_exists: bool = True):
    """
    写入 Memory（Layer1+Layer2）。

    data-based 去重：raw_text 已存在则跳过、不新建。
    child_name: 隔离标识。同一名字的多人进入会看到同一组记忆。
    返回 (is_new, memory)：is_new=True 新建，False 命中已有。
    """
    raw_text = (memory.raw_text or "").strip()

    # 把 child_name 镜像到 metadata，方便下游 / 前端读取
    if child_name:
        if memory.metadata is None:
            memory.metadata = {}
        memory.metadata["child_name"] = child_name

    if skip_if_exists and raw_text:
        # 按账号隔离去重：只在当前 child_name 下检查是否已存在，
        # 不同账号可各自导入相同内容（如同一套演示数据）
        existing = get_memory_by_raw_text(raw_text, child_name=child_name)
        if existing is not None:
            return False, existing

    # 给 id 加 child_name 命名空间：不同账号导入相同内容（如同一套演示数据）时
    # 原始 id 相同，INSERT OR REPLACE 会跨账号互相覆盖。加前缀后各自独立。
    if child_name:
        storage_id = f"{child_name}::{memory.id}"
        memory.id = storage_id
    else:
        storage_id = str(memory.id)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO memories
        (id, child_name, timestamp, event, raw_text, people, action, emotion_explicit, importance,
         behaviors, emotion_patterns, motivation, learning_style, social_behavior,
         behavior_confidence, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            storage_id,
            child_name,
            memory.timestamp.isoformat() if hasattr(memory.timestamp, "isoformat") else str(memory.timestamp),
            memory.event,
            raw_text,
            json.dumps(memory.people, ensure_ascii=False),
            memory.action,
            json.dumps([e for e in (memory.emotion_explicit or [])], ensure_ascii=False),
            int(memory.importance),
            json.dumps(memory.behaviors, ensure_ascii=False),
            json.dumps(memory.emotion_patterns, ensure_ascii=False),
            memory.motivation,
            memory.learning_style,
            memory.social_behavior,
            float(memory.behavior_confidence),
            json.dumps(memory.metadata, ensure_ascii=False),
            memory.created_at.isoformat() if hasattr(memory.created_at, "isoformat") else str(memory.created_at),
        ),
    )
    conn.commit()
    conn.close()
    return True, memory


# ============================================================
#  读取
# ============================================================
def get_all_memories(child_name: Optional[str] = None) -> List[Memory]:
    """
    全部记忆，按时间正序（旧→新），便于趋势分析。

    child_name: 过滤参数。传 None 返回全部；传名字则只返回该名字下的记忆。
    """
    conn = get_connection()
    cursor = conn.cursor()
    if child_name:
        cursor.execute(
            "SELECT * FROM memories WHERE child_name = ? ORDER BY timestamp ASC",
            (child_name,),
        )
    else:
        cursor.execute("SELECT * FROM memories ORDER BY timestamp ASC")
    rows = cursor.fetchall()
    conn.close()
    out = []
    for row in rows:
        m = _row_to_memory(row)
        if m is not None:
            out.append(m)
    return out


def count_memories(child_name: Optional[str] = None) -> int:
    """
    记忆总数。child_name 不为空时仅统计该名字下的记忆。
    """
    conn = get_connection()
    cursor = conn.cursor()
    if child_name:
        cursor.execute(
            "SELECT COUNT(*) AS n FROM memories WHERE child_name = ?",
            (child_name,),
        )
    else:
        cursor.execute("SELECT COUNT(*) AS n FROM memories")
    n = cursor.fetchone()["n"]
    conn.close()
    return n


def clear_database():
    """清空所有数据（保留表结构）。"""
    return _clear_database()


def clear_memories_for_child(child_name: str) -> int:
    """清空指定名字下的记忆（不影响其他名字）。返回删除条数。"""
    return _clear_memories_for_child(child_name)


# ============================================================
#  ValueAnalysis CRUD（Layer3 聚合结果）
# ============================================================
def save_value_analysis(analysis: ValueAnalysis) -> ValueAnalysis:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO value_analyses (id, scope, values_json, trend, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            str(analysis.id),
            analysis.scope,
            json.dumps([v.model_dump(mode="json") for v in analysis.values], ensure_ascii=False),
            analysis.trend,
            analysis.created_at.isoformat() if hasattr(analysis.created_at, "isoformat") else str(analysis.created_at),
        ),
    )
    conn.commit()
    conn.close()
    return analysis


def get_latest_value_analysis(scope: str = "all") -> Optional[ValueAnalysis]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM value_analyses WHERE scope = ? ORDER BY created_at DESC LIMIT 1",
        (scope,),
    )
    row = cursor.fetchone()
    conn.close()
    return _row_to_value_analysis(row) if row else None


def _row_to_value_analysis(row) -> Optional[ValueAnalysis]:
    try:
        values_data = json.loads(row["values_json"]) if row["values_json"] else []
        values = [ValueSignal(**v) for v in values_data]
        return ValueAnalysis(
            id=row["id"],
            scope=row["scope"],
            values=values,
            trend=row["trend"],
            created_at=row["created_at"],
        )
    except Exception as e:
        print(f"Error deserializing value analysis: {e}")
        return None
