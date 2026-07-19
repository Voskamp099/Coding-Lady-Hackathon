# AGENTS.md

## 项目概览

**Time Mirror（时光镜像）** 是一个为孩子创建数字分身的应用。父母通过"投喂"回忆（文字），让光点汇聚成孩子的轮廓，数字分身随之成长。核心视觉是一颗用光种下的种子——每次投喂回忆，光点便多一粒，孩子的轮廓便清晰一分。

### 页面结构

| 路由 | 页面 | 导航 | 说明 |
|------|------|------|------|
| `/` | 开机/首页重定向 | 无 | 开机动画（种子萌芽+星光汇聚+品牌三阶段渐入）后检测 localStorage，有用户数据跳转 `/feed`，无则跳转 `/onboarding` |
| `/onboarding` | 注册引导 | 无 | 新用户创建数字分身：输入家长姓名 → 孩子信息 → 光种汇聚动画（6种孪生形象可选），深色星空背景 |
| `/feed` | 投喂回忆 | 有 | 五种时间标签（多选）+ 情绪标签 + 场景选择 + 自定义标签 + AI自动分类，仅文字输入；桌面端支持 Excel 批量导入；顶部显示孩子年龄和数字分身进度条 |
| `/mirror` | 回忆面板 | 有 | 光点粒子头像 + 记忆光球环绕 + 时间线列表 + 镜子碎片视觉卡片 + 那年今日 |
| `/growth` | 成长界面 | 有 | 气质九维雷达图 + 智能八维雷达图 + 埃里克森发展阶段时间线 + 五种时间分布 + 情绪模式 + 价值种子 + 孪生继承入口；维度来源可点击查看证据 |
| `/chat` | AI对话 | 有 | 与"探觅"数字孪生体流式对话，支持家长视角（第三人称）/孩子视角（第二人称）双模式切换，注入完整人格画像

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **AI**: coze-coding-dev-sdk (doubao-seed-2-0-lite-260215 模型，SSE 流式)

## 目录结构

```
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts    # AI 对话流式接口（支持家长/孩子双模式）
│   │   ├── onboarding/page.tsx  # 注册引导页
│   │   ├── feed/page.tsx        # 投喂回忆页（仅文字输入，多选时间类型，AI自动分类，进度条，Excel批量导入）
│   │   ├── mirror/page.tsx      # 回忆面板页
│   │   ├── growth/page.tsx       # 成长界面（里程碑、五种时间分布、账户继承、可点击维度来源）
│   │   ├── chat/page.tsx        # AI 对话页（家长/孩子双模式）
│   │   ├── layout.tsx           # 根布局
│   │   ├── page.tsx             # 开机动画 + 首页重定向
│   │   └── globals.css          # 全局样式（天空之城画风暖色主题）
│   ├── components/
│   │   ├── ui/                  # shadcn/ui 组件库
│   │   ├── particle-avatar.tsx  # 光点粒子头像组件
│   │   └── bottom-nav.tsx      # 底部/侧边导航
│   ├── hooks/
│   └── lib/
│       ├── utils.ts             # shadcn 工具函数
│       ├── store.ts             # localStorage 数据管理
│       └── excel-utils.ts       # Excel 模板生成与解析工具
├── DESIGN.md                    # 设计规范
├── AGENTS.md                     # 本文件
└── package.json
```

## 核心组件

### ParticleAvatar (`src/components/particle-avatar.tsx`)
Canvas 粒子系统，生成孩子轮廓的目标点，粒子从随机位置漂向目标点。`growth` 参数 (0-1) 控制活跃粒子比例，模拟数字分身成长。

### BottomNav (`src/components/bottom-nav.tsx`)
响应式导航：移动端底部 Tab 栏，桌面端左侧固定栏。包含投喂、镜像、成长、对话四个入口。

## 数据管理

使用 localStorage 存储：
- 用户信息 (`time-mirror-user`): 家长名、孩子名、生日、性别、角色(parent/child)、继承信息
- 回忆列表 (`time-mirror-memories`): 日期、内容、分类(五种时间，多选)、类型(仅text)、媒体预览

### 儿童五种时间分类（王潇《小日常、大奇迹》儿童版）
- `health` 健康时间 - 草绿色 `#16A34A` — 运动的快乐
- `play` 好玩时间 - 天空蓝 `#0284C7` — 玩的快乐
- `survival` 生存时间 - 暖灰 `#78716C` — 生存的快乐
- `achievement` 成就时间 - 深琥珀 `#B45309` — 成就的快乐
- `flow` 心流时间 - 深焦糖 `#7C2D12` — 心流的快乐

### 账户继承
`inheritAccount()`: 将用户角色从 parent 转为 child，记录原家长名和继承时间。不可逆。

## 开发命令

```bash
pnpm dev      # 开发环境
pnpm build    # 构建
pnpm start    # 生产环境
pnpm lint     # 代码检查
pnpm ts-check # 类型检查
```

## 设计规范

详见 `DESIGN.md`。核心：天空之城画风暖色多层配色（琥珀金/珊瑚橙/天空蓝/草地绿/樱花粉），圆角 12px+，动画 300ms+，背景使用 ghibli-sky / ghibli-meadow 渐变，追求水彩晕染的大气层叠感。

## Excel 批量导入

桌面端投喂页面提供 Excel 批量导入功能（移动端隐藏）。

### 模板生成 (`src/lib/excel-utils.ts`)
- `downloadTemplate()`: 生成带下拉菜单的 Excel 模板
- 列：日期(YYYY-MM-DD) / 分类(下拉：生存/赚钱/好看/好玩/心流) / 内容

### 解析流程
- `parseExcelFile(file)`: 读取 Excel，逐行验证日期格式和五种时间分类
- `parsedRowsToMemories(rows)`: 转换有效行为 Memory 对象（timeTypes 数组）
- 导入弹窗显示预览：有效/无效行数、错误详情

## 核心数据变更

### Memory 接口
- `timeType: string` → `timeTypes: string[]`（支持多选时间类型）
- 所有 50 条种子记录已更新为数组格式
- 所有消费者函数（`getTimeTypeDistribution`, `getMemoryCountByType` 等）已适配数组

### 年龄计算
- `calculateAgeString(birthDate)`: ≤1月=日龄，1月-2岁=月龄，>2岁=年龄
- 投喂页、成长页顶部使用此函数显示孩子年龄

### 数字分身进度
- `getDigitalTwinProgress(memoryCount)`: 返回 `{percent, label, nextLevel}`
- 投喂页顶部显示进度条，DOM 节点屏障可点击查看根源

### 播映等级
- `getTwinLevel(memoryCount)`: 基于回忆数量计算等级
- 成长页使用此函数显示孪生等级

### 回忆日期匹配
- `getMemoriesByDate(memories, date)`: 按日期匹配历史上的今天
- 镜像页"那年今日"功能使用此函数

## API 接口

### POST /api/chat
AI 对话接口，SSE 流式响应，支持家长/孩子双模式。注入完整人格画像（气质九维+智能八维+发展阶段+情绪模式+价值种子）。

**请求体**:
```json
{
  "messages": [{"role": "user", "content": "我真正擅长什么？"}],
  "childName": "芝麻胡",
  "memoryContext": "2026-04-07: 反复掰胡萝卜直到成功",
  "userRole": "parent"
}
```

- `userRole`: `"parent"`（家长视角，第三人称）或 `"child"`（孩子视角，第二人称）

**响应**: SSE 格式 `data: {"content": "你"}\n\n`，末尾 `data: {"done": true}\n\n`
