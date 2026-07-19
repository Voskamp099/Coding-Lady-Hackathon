# 拾光镜 TimeMirror

> 为孩子创建数字分身的 AI 时光记忆助手。父母通过"投喂"回忆（文字），让光点汇聚成孩子的轮廓，数字分身随之成长。

核心视觉是一颗用光种下的种子——每次投喂回忆，光点便多一粒，孩子的轮廓便清晰一分。

## ✨ 功能特性

| 页面 | 路由 | 说明 |
|------|------|------|
| 开机/首页 | `/` | 种子萌芽 + 星光汇聚 + 品牌三阶段渐入动画，检测本地用户数据后自动跳转 |
| 注册引导 | `/onboarding` | 新用户创建数字分身：家长信息 → 孩子信息 → 光种汇聚动画（6 种孪生形象可选） |
| 投喂回忆 | `/feed` | 五种时间标签 + 情绪标签 + 场景选择 + AI 自动分类，桌面端支持 Excel 批量导入 |
| 回忆面板 | `/mirror` | 光点粒子头像 + 记忆光球环绕 + 时间线 + 镜子碎片卡片 + 那年今日 |
| 成长界面 | `/growth` | 气质九维 / 智能八维雷达图 + 埃里克森发展阶段时间线 + 价值种子 + 孪生继承 |
| AI 对话 | `/chat` | 与数字分身对话，基于记忆库 RAG 检索增强生成 |

**后端能力：**
- 三层记忆提取流水线：Layer1 事件抽取 → Layer2 行为/价值信号识别 → Layer3 全库价值综合
- RAG 检索增强：基于向量数据库的语义检索
- 一键演示数据导入（不走 LLM，秒级灌入，评委演示用）

## 🛠 技术栈

**后端**（`backend/`）
- Python · FastAPI · Uvicorn
- SQLite（向量存储）· Pydantic Settings
- LLM：阶跃星辰 StepFun `step-3.7-flash`（兼容 OpenAI 接口）

**前端**（`frontend/`）
- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 · shadcn/ui (Radix UI)
- 自定义 Express 服务器（支持粒子动画等动态效果）

**部署**
- 后端 → Render（`render.yaml`）
- 前端 → Vercel

## 📁 项目结构

```
timemirror/
├── backend/                 # FastAPI 后端
│   ├── main.py             # 应用入口 (backend.main:app)
│   ├── app.py              # 记忆相关路由 (/api/memories/*)
│   ├── chat_agent.py       # RAG 对话 Agent
│   ├── agent.py            # 三层提取流水线
│   ├── config.py           # 配置管理
│   ├── database.py         # SQLite 数据库
│   ├── embeddings.py       # 向量嵌入
│   ├── vector_store.py     # 向量存储
│   └── ...
├── frontend/               # Next.js 前端
│   ├── src/
│   │   ├── app/            # 页面路由 (App Router)
│   │   ├── components/     # React 组件
│   │   ├── lib/            # 后端通信、工具函数
│   │   └── data/           # 前端演示数据
│   ├── scripts/            # dev.sh / build.sh
│   └── package.json
├── data/                   # 数据文件
│   ├── sample-children.json  # 演示数据（儿童成长，TM_ 系列）
│   └── sample-life.json      # 演示数据（人生记忆，LM_ 系列）
├── run.py                  # 后端启动脚本
├── prepare_data.py         # CSV 数据导入脚本
├── render.yaml             # Render 部署配置
├── requirements.txt        # Python 依赖
└── .env.example            # 后端环境变量模板
```

## 🚀 本地开发

### 前置准备

- Python 3.11+
- Node.js 20+ / pnpm 9+
- 阶跃星辰（StepFun）API Key

### 1. 克隆并安装依赖

```bash
git clone <your-repo-url>
cd timemirror

# 后端
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 前端
cd frontend
pnpm install
cd ..
```

### 2. 配置环境变量

```bash
# 后端
cp .env.example .env
# 编辑 .env，填入你的 OPENAI_API_KEY

# 前端
cp frontend/.env.example frontend/.env.local
# 本地开发默认指向 http://localhost:8000，无需修改
```

### 3. 启动服务

需要**两个终端**分别运行前后端：

```bash
# 终端 1 — 后端（:8000）
./venv/bin/python run.py

# 终端 2 — 前端（:5000）
cd frontend && pnpm dev
```

浏览器打开 **http://localhost:5000** 即可看到开机动画和全部动态效果。

> ⚠️ 动态效果（种子萌芽、粒子头像、光球环绕）需要**前后端同时运行**才能完整展示。

> 💡 如果 `pnpm dev` 报 `safe-delete` 错误（部分 pnpm 11 环境的插件拦截），改用 `npm run dev` 即可绕过。

### 4. 导入数据

```bash
# 方式 A：用 CSV 数据集导入（走 LLM 提取，较慢）
./venv/bin/python prepare_data.py --clear --max 50 --layer3

# 方式 B：一键导入演示数据（不走 LLM，秒级）
# 启动后在页面的投喂页面点击"导入演示数据"按钮即可
```

## 📡 API 概览

后端启动后访问 http://localhost:8000/docs 查看完整 Swagger 文档。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/memories/create` | 创建记忆（走 LLM 提取） |
| GET | `/api/memories/count` | 记忆总数 |
| GET | `/api/memories/list` | 记忆列表 |
| POST | `/api/memories/clear` | 清空数据库 |
| POST | `/api/memories/import-demo` | 一键导入演示数据（秒级） |
| POST | `/api/analysis/values` | 价值信号分析 |
| POST | `/api/chat` | AI 对话（RAG 增强） |

## ☁️ 部署

### 后端 → Render

1. 在 Render 创建新 Web Service，连接 GitHub 仓库
2. 配置：
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check**: `/health`
3. 环境变量（在 Render 后台填写）：
   - `OPENAI_API_KEY` — 你的 API Key
   - `OPENAI_BASE_URL` — `https://api.stepfun.com/v1`
   - `MODEL_NAME` — `step-3.7-flash`
   - `DEBUG` — `false`

`render.yaml` 已包含上述配置，也可直接用 Render 的 Blueprint 功能一键部署。

### 前端 → Vercel

1. 在 Vercel 创建新项目，连接同一个 GitHub 仓库
2. 配置：
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
   - **Build Command**: `bash ./scripts/build.sh`
3. 环境变量：
   - `BACKEND_URL` — 你的 Render 后端地址（如 `https://timemirror-backend.onrender.com`）

## 📚 相关文档

- [`DEPLOY.md`](./DEPLOY.md) — 详细部署指南
- [`RAG-knowledge-base.md`](./RAG-knowledge-base.md) — 拾光镜四大理论基础手册
- [`frontend/AGENTS.md`](./frontend/AGENTS.md) — 前端页面结构与开发规范
- [`frontend/DESIGN.md`](./frontend/DESIGN.md) — 设计文档

## 📝 说明

- `data/growth-records.csv` 为真实成长记录数据，已加入 `.gitignore` 不会上传（隐私保护）。如需导入自己的数据，准备同格式 CSV 即可。
- 演示数据（`data/sample-*.json`）为合成数据，可安全公开，供评委一键导入演示。
- 数据库 `memory.db` 为本地 SQLite，已加入 `.gitignore`，每次导入自动生成。

---

Made with 💡 for preserving every spark of growth.
