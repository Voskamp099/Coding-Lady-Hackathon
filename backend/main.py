"""FastAPI 应用入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from backend.config import get_settings
from backend.app import router as memories_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"🚀 TimeMirror 启动中...")
    logger.info(f"🤖 模型: {settings.model_name}")
    yield
    logger.info("👋 TimeMirror 关闭中...")


app = FastAPI(
    title="TimeMirror",
    description="AI Time Travel Assistant",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 注册记忆相关路由 (/api/memories/*)
app.include_router(memories_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "TimeMirror"}


@app.get("/")
async def root():
    return {"message": "Welcome to TimeMirror!", "docs": "/docs"}
