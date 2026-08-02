# 途搭 Tuda

途搭是一个面向自由行用户的 AI 旅行 Agent Web App。用户输入目的地、游玩天数、同行人员、预算、旅行风格和美食偏好后，系统会生成结构化多日行程，并支持天气感知、语义缓存、行程二次修改、收藏、下载、公开分享以及小红书 / 朋友圈文案生成。

这个项目不只是一个普通的 Prompt 调用页面，而是围绕“旅行规划 Agent”做了工具调用、长期记忆、结果校验、执行轨迹和用户数据隔离等能力，适合作为 AI Agent 方向的作品集项目继续扩展。

## 项目亮点

- AI 生成多日旅行路线，返回统一的结构化 JSON 行程数据
- DeepSeek / SiliconFlow 大模型接口，支持低成本文本生成
- Upstash Vector 语义缓存，减少相似需求的重复模型调用
- 天气工具调用，根据目的地天气调整室内外行程节奏
- 用户长期记忆，保存偏好并参与后续路线生成和修改
- AI 行程管家，支持自然语言二次修改路线
- Agent Trace 持久化，记录每次工具调用、天气结果、记忆和执行状态
- Guardrails 行程校验，检查结构化输出、枚举值、天数和局部编辑边界
- 游客身份隔离，自动生成 `tour_ai_guest_id`
- 收藏行程，按游客 ID 获取专属收藏列表
- 公开分享页，可复制 `/share/[shareId]` 链接给朋友查看行程
- 小红书风 / 朋友圈风文案生成
- 本地照片九宫格预览，可编辑文案并一键复制
- 下载普通用户可读的 HTML 行程卡
- Next.js App Router 多页面结构
- Tailwind CSS 现代暗色玻璃拟态 UI
- 响应式侧边栏和移动端顶部导航

## Agent 能力说明

当前项目已经具备一个旅行 Agent 的雏形：

| 能力 | 当前实现 |
| --- | --- |
| 意图理解 | 根据用户输入的城市、天数、预算、同行人、风格和口味生成路线 |
| 工具调用 | 天气查询、语义缓存查询、用户记忆读取、行程修改工具 |
| 长期记忆 | 保存用户偏好，后续生成和修改时自动带入 |
| 结果校验 | 使用 Guardrails 校验行程结构和局部编辑边界 |
| 执行轨迹 | 保存 Agent Trace，方便展示工具调用过程 |
| 任务闭环 | 生成、修改、收藏、下载、分享、生成社交文案 |

## 页面结构

```text
/                  行程生成首页
/spots             景点推荐
/food              美食地图
/diary             我的行程
/budget            预算助手
/share/[shareId]   公开行程分享页
```

## 目录结构

```text
app/
  api/
    generate/        生成旅行路线
    refine-route/    AI 行程管家二次修改
    save-route/      收藏行程
    share-route/     创建公开分享链接
    generate-copy/   生成小红书 / 朋友圈文案
    user-memory/     用户长期记忆
    weather/         天气工具
  share/[shareId]/   公开分享页
components/          页面组件
hooks/               客户端 Hook
lib/                 服务端存储、工具函数、Agent 工具层
types/               旅行计划 TypeScript 类型
```

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Upstash Vector
- DeepSeek / SiliconFlow API
- Open-Meteo 天气 API
- LocalStorage 游客身份
- 本地 `.data/*.json` 文件存储

## 本地运行

安装依赖：

```bash
npm install
```

复制环境变量示例：

```bash
cp .env.local.example .env.local
```

填写 `.env.local`：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3
VECTOR_DIMENSION=1536
UPSTASH_VECTOR_REST_URL=your_upstash_vector_rest_url_here
UPSTASH_VECTOR_REST_TOKEN=your_upstash_vector_rest_token_here
NEXT_PUBLIC_SHARE_BASE_URL=http://localhost:3000
```

启动开发环境：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

类型检查：

```bash
npx tsc --noEmit
```

## 环境变量说明

| 变量名 | 说明 |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_MODEL` | DeepSeek 文本生成模型 |
| `SILICONFLOW_API_KEY` | 硅基流动 API Key |
| `SILICONFLOW_MODEL` | 硅基流动模型名称 |
| `VECTOR_DIMENSION` | 语义缓存向量维度 |
| `UPSTASH_VECTOR_REST_URL` | Upstash Vector REST URL |
| `UPSTASH_VECTOR_REST_TOKEN` | Upstash Vector REST Token |
| `NEXT_PUBLIC_SHARE_BASE_URL` | 分享链接使用的公网域名 |

## 分享链接说明

本地开发时复制出的链接通常是：

```text
http://localhost:3000/share/xxx
```

这个链接只能在当前电脑打开，不能直接发给别人访问。因为 `localhost` 对访问者来说代表“他自己的电脑”，不是你的电脑。

如果要临时给别人看，可以使用公网隧道工具把本机 3000 端口暴露出去，然后把隧道地址填到 `.env.local`：

```env
NEXT_PUBLIC_SHARE_BASE_URL=https://your-public-tunnel-url
```

如果已经部署到 Vercel，则填写你的线上域名：

```env
NEXT_PUBLIC_SHARE_BASE_URL=https://your-vercel-domain.vercel.app
```

修改 `.env.local` 后，需要重启开发服务：

```bash
npm run dev
```

## 数据存储说明

当前项目使用游客 ID 做轻量身份隔离：

```text
localStorage.tour_ai_guest_id
```

本地开发环境下，数据会保存到：

```text
.data/saved-routes.json     收藏行程
.data/shared-routes.json    公开分享行程
.data/user-memory.json      用户长期记忆
.data/agent-traces.json     Agent 执行轨迹
```

`.data/` 已加入 `.gitignore`，不会上传到 GitHub。

正式上线时建议替换为数据库或 KV 存储，例如：

- Supabase / Postgres：适合用户、收藏、分享记录
- Upstash Redis / KV：适合轻量缓存和分享记录
- Upstash Vector：继续用于语义缓存

## 核心业务流程

### 生成路线

```text
用户填写表单
-> 拼接用户偏好文本
-> 生成向量
-> 查询 Upstash Vector 语义缓存
-> 命中则直接返回历史行程
-> 未命中则调用 DeepSeek / SiliconFlow
-> 解析结构化 JSON
-> 写入语义缓存
-> 前端展示行程
```

### Agent 修改路线

```text
用户输入自然语言修改要求
-> 读取当前行程、用户记忆和天气信息
-> 判断修改意图和影响范围
-> 调用行程修改工具
-> 使用 Guardrails 校验结果
-> 保存 Agent Trace
-> 返回新版行程
```

### 分享路线

```text
用户点击分享链接
-> POST /api/share-route
-> 保存分享记录到 shared-routes
-> 返回 shareId
-> 前端复制 /share/[shareId]
-> 朋友打开公开分享页查看行程
```

## API 概览

| API | 方法 | 说明 |
| --- | --- | --- |
| `/api/generate` | POST | 生成旅行路线 |
| `/api/refine-route` | POST | 使用 AI 行程管家修改路线 |
| `/api/refine-route` | GET | 获取 Agent Trace |
| `/api/save-route` | GET / POST / DELETE | 获取、收藏、删除行程 |
| `/api/share-route` | POST | 创建公开分享链接 |
| `/api/generate-copy` | POST | 生成小红书 / 朋友圈文案 |
| `/api/user-memory` | GET / POST | 获取、保存用户偏好 |
| `/api/weather` | GET | 查询目的地天气 |

## GitHub 上传前注意

不要提交以下文件：

- `.env.local`
- `.data/`
- `.next/`
- `node_modules/`
- `dev.log`
- `next-dev.err.log`
- `next-dev.out.log`
- `tsconfig.tsbuildinfo`

这些文件已经在 `.gitignore` 中忽略。

## 部署建议

推荐部署到 Vercel。部署时需要在 Vercel 项目的 Environment Variables 中配置 `.env.local.example` 里的变量。

如果要让分享页在线可访问，需要额外注意：

- `NEXT_PUBLIC_SHARE_BASE_URL` 必须填写线上域名
- `.data/*.json` 只适合本地开发，不适合 Serverless 生产环境长期存储
- 生产环境建议把收藏、分享、记忆、Trace 改成数据库或 KV 存储

## 面试讲解角度

这个项目可以从以下角度讲：

- 不是简单聊天页，而是一个面向旅行规划任务的 Agent 应用
- 使用结构化输出把大模型结果变成可渲染、可保存、可分享的数据
- 使用语义缓存降低重复生成成本
- 使用天气工具和用户记忆提升个性化程度
- 使用 Guardrails 降低模型输出不稳定带来的前端风险
- 使用 Agent Trace 展示可观测性，方便调试和解释 Agent 行为
- 使用分享页、收藏、下载和社交文案生成形成完整产品闭环

## 后续规划

- 正式账号登录
- 数据库存储收藏行程、分享记录和长期记忆
- 地图路线展示
- PDF / 长图导出
- 分享页支持封面图和移动端海报样式
- 多 Agent 协作：规划 Agent、预算 Agent、美食 Agent、交通 Agent
- RAG 知识库：接入城市攻略、景点开放时间和门票信息
- 流式生成和实时工具调用进度展示
