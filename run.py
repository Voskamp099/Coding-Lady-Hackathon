"""启动脚本"""

import os
import uvicorn
from backend.config import get_settings


def main():
    settings = get_settings()
    # debug 模式下只监控 backend/ 源码目录，避免写 memory.db 时触发重载导致进程崩溃
    reload_dirs = None
    reload_excludes = None
    if settings.debug:
        backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
        reload_dirs = [backend_dir]
        reload_excludes = ["*.db", "*.db-*", "*.sqlite*", "memory.db*"]

    uvicorn.run(
        "backend.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        reload_dirs=reload_dirs,
        reload_excludes=reload_excludes,
    )


if __name__ == "__main__":
    main()
