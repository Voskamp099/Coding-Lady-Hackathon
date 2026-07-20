# app/database.py
"""
SQLite 数据库管理。

表结构：
- memories        单条记忆（Layer1 + Layer2 结果）
- value_analyses  Layer3 聚合价值分析结果
- chat_history    聊天历史（SQLAlchemy 管理）

提供 clear_database() —— 供前端"清空"按钮调用，切换数据集时用。
"""
import sqlite3
import os
from sqlalchemy import create_engine, text
from backend.models import Base

DB_NAME = "memory.db"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", DB_NAME)
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# SQLAlchemy Engine，用于 ChatHistory 等 ORM 表
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})


def get_connection():
    """原生 sqlite3 连接，用于 memories / value_analyses 表。"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table_name,)
    )
    return cursor.fetchone() is not None


def init_db():
    """初始化所有表（幂等）。"""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. memories 表（新版三层结构）
    #    注意：values 是 SQLite 保留字，列名用 behavior_*/emotion_* 避开
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        child_name TEXT,
        timestamp TEXT,
        event TEXT,
        raw_text TEXT,
        people TEXT,
        action TEXT,
        emotion_explicit TEXT,
        importance INTEGER,
        behaviors TEXT,
        emotion_patterns TEXT,
        motivation TEXT,
        learning_style TEXT,
        social_behavior TEXT,
        behavior_confidence REAL,
        metadata TEXT,
        created_at TEXT
    )
    """)

    # 1b. 兼容旧库：若 memories 表存在但缺新列，自动补列（迁移）
    cursor.execute("PRAGMA table_info(memories)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    migrations = {
        "child_name": "ALTER TABLE memories ADD COLUMN child_name TEXT",
        "action": "ALTER TABLE memories ADD COLUMN action TEXT",
        "emotion_explicit": "ALTER TABLE memories ADD COLUMN emotion_explicit TEXT",
        "behaviors": "ALTER TABLE memories ADD COLUMN behaviors TEXT",
        "emotion_patterns": "ALTER TABLE memories ADD COLUMN emotion_patterns TEXT",
        "motivation": "ALTER TABLE memories ADD COLUMN motivation TEXT",
        "learning_style": "ALTER TABLE memories ADD COLUMN learning_style TEXT",
        "social_behavior": "ALTER TABLE memories ADD COLUMN social_behavior TEXT",
        "behavior_confidence": "ALTER TABLE memories ADD COLUMN behavior_confidence REAL",
        "created_at": "ALTER TABLE memories ADD COLUMN created_at TEXT",
        "metadata": "ALTER TABLE memories ADD COLUMN metadata TEXT",
    }
    for col, ddl in migrations.items():
        if col not in existing_cols:
            try:
                cursor.execute(ddl)
            except sqlite3.OperationalError:
                pass  # 列已存在等情况，忽略

    # 1c. child_name 索引（按名字隔离的快速过滤）
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_memories_child_name ON memories(child_name)"
    )

    # 2. value_analyses 表（Layer3 聚合结果）
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS value_analyses (
        id TEXT PRIMARY KEY,
        scope TEXT,
        values_json TEXT,
        trend TEXT,
        created_at TEXT
    )
    """)

    conn.commit()
    conn.close()

    # 3. SQLAlchemy 管理的表（如 ChatHistory）
    Base.metadata.create_all(bind=engine)


def clear_database():
    """
    清空所有记忆与分析数据（保留表结构）。
    前端"清空"按钮 / 切换数据集时调用。
    返回 dict 报告清理情况。
    """
    conn = get_connection()
    cursor = conn.cursor()
    report = {}
    for tbl in ("memories", "value_analyses", "chat_history"):
        if _table_exists(cursor, tbl):
            cursor.execute(f"DELETE FROM {tbl}")
            report[tbl] = cursor.rowcount
        else:
            report[tbl] = 0
    conn.commit()
    conn.close()
    return report


def drop_database_file():
    """彻底删除 db 文件（更彻底的清空，下次 init 会重建）。"""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        return True
    return False


# 自动初始化
init_db()
