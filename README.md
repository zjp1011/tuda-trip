# 途搭 Tuda

途搭是一个面向自由行用户的 AI 旅行 Agent Web App。用户输入目的地、游玩天数、同行人员、预算、旅行风格和美食偏好后，系统会生成结构化多日行程，并支持天气感知、语义缓存、行程二次修改、收藏、下载、公开分享以及小红书 / 朋友圈文案生成。

这个项目不只是一个普通的 Prompt 调用页面，而是围绕“旅行规划 Agent”做了工具调用、长期记忆、结果校验、执行轨迹和用户数据隔离等能力，适合作为 AI Agent 方向的作品集项目继续扩展。

## 项目演示

- 演示视频：[点击观看 / 下载](https://github.com/zjp1011/tuda-trip/releases/download/demo-video-2026-08-20/2026-08-20.170639.mp4)
- Release 页面：[demo-video-2026-08-20](https://github.com/zjp1011/tuda-trip/releases/tag/demo-video-2026-08-20)

## 项目亮点

- AI 生成多日旅行路线，返回统一的结构化 JSON 行程数据
- 使用自己的 DeepSeek Key 生成行程、修改行程和生成分享文案
- Upstash Vector 语义缓存，减少相似需求的重复模型调用
- 天气工具调用，根据目的地天气调整室内外行程节奏
- 用户长期记忆，保存偏好并参与后续路线生成和修改
- AI 行程管家，支持自然语言二次修改路线
- Agent Trace 持久化，记录每次工具调用、天气结果、记忆和执行状态
- Guardrails 行程校验，检查结构化输出、枚举值、天数和局部编辑边界
- 生产内测使用访问口令，服务端会话隔离每位访客的收藏、偏好和执行记录
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
- DeepSeek API
- Open-Meteo 天气 API
- 服务端签名会话
- 本地 `.data/*.json` 文件存储

## 本地运行

安装依赖：

```bash
npm ci
```

复制环境变量示例：

```bash
cp .env.local.example .env.local
```

启动开发环境：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

使用 AI 功能时，在页面填写自己的 DeepSeek Key。途搭把 Key 放在对应请求的鉴权头中，由服务端转发给 DeepSeek。Key 保留在当前页面会话内，刷新页面或清除后需要重新填写。

类型检查：

```bash
npx tsc --noEmit
```

## 环境变量说明

| 变量名 | 说明 |
| --- | --- |
| `DEEPSEEK_MODEL` | DeepSeek 文本生成模型 |
| `VECTOR_DIMENSION` | 语义缓存向量维度 |
| `UPSTASH_VECTOR_REST_URL` | Upstash Vector REST URL |
| `UPSTASH_VECTOR_REST_TOKEN` | Upstash Vector REST Token |
| `NEXT_PUBLIC_SHARE_BASE_URL` | 分享链接使用的公网域名 |
| `TUDA_PUBLIC_ORIGIN` | 生产站点的 HTTPS 地址，例如 `https://trip.yayapeng.xyz` |
| `TUDA_INVITE_PASSWORD` | 内测口令，供获邀访客登录 |
| `TUDA_SESSION_SECRET` | 由服务端独立生成的会话签名密钥 |
| `TUDA_DAILY_CALL_LIMIT` | 全站每天可调用付费接口的次数 |
| `TUDA_DATA_DIR` | 显式指定持久数据目录。systemd 部署也可使用 `STATE_DIRECTORY` |

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

生产服务从签名会话读取访客身份。已生成的公开分享链接可供持有链接的访客查看行程。

本地开发环境下，数据会保存到：

```text
.data/saved-routes.json     收藏行程
.data/shared-routes.json    公开分享行程
.data/user-memory.json      用户长期记忆
.data/agent-traces.json     Agent 执行轨迹
```

`.data/` 已加入 `.gitignore`，不会上传到 GitHub。

生产单实例将记录保存在发布目录之外的持久状态目录。备份时包含这个目录，更新应用版本时使用同一目录。

## 核心业务流程

### 生成路线

```text
用户填写表单
-> 拼接用户偏好文本
-> 生成向量
-> 查询 Upstash Vector 语义缓存
-> 命中则直接返回历史行程
-> 使用访客填写的 Key 调用 DeepSeek
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

## 部署到 Yayapeng Lab

生产部署的入口为 `trip.yayapeng.xyz`。GitHub Actions 在 Linux 构建 Next.js standalone 包。Caddy 通过本机端口访问独立的 `tuda-trip.service`，用户数据存放在 `/var/lib/tuda-trip`。

首次接入由服务器管理员运行 `ops/bootstrap-trip-deploy.sh`，传入专用部署公钥和仅管理员可读的运行环境文件。该文件保存于 `/etc/tuda-trip/runtime.env`，用于内测口令、会话签名密钥和服务配置。访问者在页面填写的 DeepSeek Key 随本次 AI 请求使用。向量缓存可按需配置。

在仓库 Actions Secrets 配置 `DEPLOY_SSH_KEY` 和 `DEPLOY_KNOWN_HOSTS`。首次从 `main` 手动运行发布并验证 `/api/health`、首页及内测登录，随后可将仓库变量 `DEPLOY_ENABLED` 设为 `true`，让以后的 `main` 推送自动部署。手动运行时填写 `rollback_release` 可恢复服务器已保留的提交版本。

## 后续规划

- 正式账号登录
- 数据库存储收藏行程、分享记录和长期记忆
- 地图路线展示
- PDF / 长图导出
- 分享页支持封面图和移动端海报样式
- 多 Agent 协作：规划 Agent、预算 Agent、美食 Agent、交通 Agent
- RAG 知识库：接入城市攻略、景点开放时间和门票信息
- 流式生成和实时工具调用进度展示
