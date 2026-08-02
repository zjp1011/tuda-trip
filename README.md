# 途搭 Tuda

途搭是一个基于 AI 的旅行路线生成 Web App。用户可以输入目的地、天数、同行人员、预算、旅行风格和美食偏好，生成结构化旅行计划，并进一步收藏、下载行程卡、生成小红书/朋友圈文案。

## 功能亮点

- AI 生成多日旅行路线
- 支持目的地、天数、同行人员、预算、旅行风格、美食偏好输入
- Upstash Vector 语义缓存，减少重复大模型调用
- DeepSeek / 硅基流动大模型接口
- 游客身份隔离，自动生成 `tour_ai_guest_id`
- 收藏行程，按游客 ID 获取专属收藏列表
- 多页面 App Router 结构
- 小红书风 / 朋友圈风文案生成
- 本地照片九宫格预览
- 可编辑文案并一键复制
- 下载普通用户可读的 HTML 行程卡
- 响应式侧边栏和移动端顶部导航

## 页面结构

```text
/         行程生成
/spots    景点推荐
/food     美食地图
/diary    我的行程
/budget   预算助手
```

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Upstash Vector
- DeepSeek / SiliconFlow API

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
```

启动开发环境：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
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

## 数据存储说明

当前项目使用游客 ID 做轻量身份隔离：

```text
localStorage.tour_ai_guest_id
```

本地开发环境下，收藏行程会保存到：

```text
.data/saved-routes.json
```

`.data/` 已加入 `.gitignore`，不会上传到 GitHub。正式上线时建议替换为数据库或 KV 存储，例如 Supabase、Postgres、Upstash Redis/KV。

## 上传 GitHub 前注意

不要提交以下文件：

- `.env.local`
- `.data/`
- `.next/`
- `node_modules/`
- 日志文件

这些文件已经在 `.gitignore` 中忽略。

## 部署建议

推荐部署到 Vercel。部署时需要在 Vercel 项目的 Environment Variables 中配置 `.env.local.example` 里的变量。

## 后续规划

- 正式账号登录
- 数据库存储收藏行程
- 行程二次编辑
- 地图路线展示
- 分享公开链接
- PDF / 长图导出
