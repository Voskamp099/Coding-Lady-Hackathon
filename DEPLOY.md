# TimeMirror 部署指南（黑客松 MVP，全免费）

## 架构

```
Vercel (前端 Next.js)  ──API代理──▶  Render (后端 Python FastAPI)
   xxx.vercel.app                       xxx.onrender.com
```

两个免费服务，各给一个公网 URL。前端通过 Next.js API 路由代理请求到后端。

---

## 第一步：推到 GitHub

```bash
cd coding-lady
git init
git add .
git commit -m "TimeMirror hackathon MVP"
# 在 GitHub 建一个 repo，然后：
git remote add origin https://github.com/<你的用户名>/timemirror.git
git push -u origin main
```

> `.gitignore` 已配好，不会传 venv / .env / memory.db / node_modules。

---

## 第二步：部署后端到 Render（免费，~5分钟）

1. 打开 <https://render.com> → 注册（可用 GitHub 登录）
2. **New +** → **Blueprint** → 选你的 GitHub repo
   - Render 会自动读 `render.yaml`，创建 `timemirror-backend` 服务
3. 在 Render 后台填入环境变量：
   - `OPENAI_API_KEY` = 你的 StepFun API Key（render.yaml 里标了 `sync: false`）
4. 点 **Create** → 等 2-3 分钟构建完成
5. 拿到后端 URL，类似：`https://timemirror-backend.onrender.com`
6. 验证：浏览器打开 `https://timemirror-backend.onrender.com/health` → 应返回 `{"status":"healthy"}`

> ⚠️ Render 免费版 15 分钟无请求会休眠，首次冷启动约 30 秒。演示前先访问一次 /health 唤醒。

---

## 第三步：部署前端到 Vercel（免费，~3分钟）

1. 打开 <https://vercel.com> → 注册（用 GitHub 登录）
2. **Add New Project** → 选你的 GitHub repo
3. **Settings**：
   - **Root Directory** = `frontend`（很重要！前端在这个子目录）
   - **Framework Preset** = Next.js（自动识别）
   - **Environment Variables**：
     - `BACKEND_URL` = `https://timemirror-backend.onrender.com`（上一步拿到的）
4. 点 **Deploy** → 等 1-2 分钟
5. 拿到前端 URL，类似：`https://timemirror.vercel.app`
6. 验证：打开 `https://timemirror.vercel.app/feed` → 应看到页面

---

## 第四步：演示流程

1. 打开前端 URL → 完成 onboarding（随便填名字）
2. 进入 `/feed` 页面 → 点 **「演示数据」** 按钮 → 秒级导入 40 条人生记忆
3. 进入 `/chat` 页面 → 问「我要不要去上海工作？」→ 等 10-20 秒 → 看到完整 6 段分析
4. 进入 `/growth` 页面 → 看价值种子 + 心理画像

---

## 切换演示数据集

改 `frontend/src/data/demo-config.ts` 第一行：

```ts
export const DEMO_DATASET: 'life' | 'child' = 'life';   // ← 改成 'child' 即切换到儿童版
```

- `life` = 人生决策版 (0-22岁, 40条) ← 上海工作问题
- `child` = 儿童成长版 (0-7岁, 30条) ← 人格雏形

改完重新 push → Vercel 自动重新部署。

---

## 本地开发

```bash
# 后端
cd coding-lady
./venv/bin/python run.py          # :8000

# 前端
cd frontend
npm run dev                        # :5000（pnpm dev 会触发 safe-delete 拦截，用 npm run dev 绕过）

# 灌真实数据（走 LLM，慢）
./venv/bin/python prepare_data.py --clear --max 50 --layer3
```

---

## 费用

| 服务          | 免费额度          | 够不够               |
| ----------- | ------------- | ----------------- |
| Vercel      | 100GB 流量/月    | ✅ 黑客松绰绰有余         |
| Render      | 750 小时/月 + 休眠 | ✅ 演示够用            |
| StepFun LLM | 按量付费          | 需充值，demo 几十次调用很便宜 |
