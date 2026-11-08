# MengLong Build Log

MengLong Wang 的双语个人主页、开发日志和全栈项目集合。

- 在线主页：[menglong-build-log.netlify.app](https://menglong-build-log.netlify.app)
- GitHub：[wml516518/menglong-build-log](https://github.com/wml516518/menglong-build-log)

## 项目内容

仓库包含两个相对独立的部分：

| 目录 | 内容 | 技术栈 | 部署方式 |
| --- | --- | --- | --- |
| `/` | 个人主页、履历、项目列表和 Build Log | React 19、TypeScript、Vite | Netlify |
| `eat-card/` | “今天吃什么卡”微信小程序、API、管理后台和数据库脚本 | 微信小程序、Express、Supabase、DeepSeek | Render + Netlify |

### 个人主页

- 中英文内容切换，并使用 `localStorage` 保存语言偏好
- 展示个人履历、技术栈、项目经历和联系方式
- 展示项目链接与开发日志摘要
- 使用本地 TypeScript 数据维护内容，不依赖后端服务

### 今天吃什么卡

- 根据预算、烹饪时间、人数和口味标签随机推荐菜品
- 通过 DeepSeek 生成结构化 AI 菜品建议
- 使用 Supabase 存储菜谱和标签
- 包含菜谱管理后台、Render API 服务和微信小程序客户端

详细说明参见 [`eat-card/README.md`](eat-card/README.md) 和
[`eat-card/docs/setup.md`](eat-card/docs/setup.md)。

## 本地开发

要求 Node.js 20 或更高版本。

```bash
git clone https://github.com/wml516518/menglong-build-log.git
cd menglong-build-log
npm ci
npm run dev
```

Vite 默认在 `http://localhost:5173` 启动开发服务器。

## 测试与构建

```bash
# 运行主站、API、管理后台和小程序工具测试
npm test

# 执行 TypeScript 检查并构建生产版本
npm run build
```

GitHub Actions 会在向 `main` 分支推送或提交 Pull Request 时自动执行以上检查。

## 部署

### 个人主页

根目录的 [`netlify.toml`](netlify.toml) 定义 Netlify 构建命令和单页应用重定向规则。

### Eat Card API

根目录的 [`render.yaml`](render.yaml) 定义 Render Web Service。运行服务需要以下环境变量：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_API_TOKEN`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`（可选）
- `DEEPSEEK_BASE_URL`（可选）

密钥只应配置在服务端部署环境中，不能提交到仓库或放入小程序、管理后台客户端代码。

完整部署步骤参见 [`eat-card/docs/setup.md`](eat-card/docs/setup.md)。
