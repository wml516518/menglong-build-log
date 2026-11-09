# MengLong Build Log

MengLong Wang 的双语个人主页、开发日志和全栈项目集合。

- 在线主页：[menglong-build-log.netlify.app](https://menglong-build-log.netlify.app)
- GitHub：[wml516518/menglong-build-log](https://github.com/wml516518/menglong-build-log)

## 项目内容

仓库包含两个相对独立的部分：

| 目录 | 内容 | 技术栈 | 部署方式 |
| --- | --- | --- | --- |
| `/` | 个人主页、履历、项目列表、Build Log 和历史星河 | React 19、TypeScript、Vite | Netlify |
| `eat-card/` | “今天吃什么卡”微信小程序、API、管理后台和数据库脚本 | 微信小程序、Express、Supabase、DeepSeek | Render + Netlify |

### 个人主页

- 首页重点展示《历史星河》，静态预览不加载 Three.js 运行时
- `#/history-galaxy` 提供唐朝至 1949 年的完整 3D 交互历史时间轴
- 历史星河支持七时代导航、30 个事件、星点拖拽、人物故事、移动端抽屉与 WebGL 降级
- 中英文内容切换，并使用 `localStorage` 保存语言偏好
- 展示个人履历、技术栈、项目经历和联系方式
- 展示项目链接、开发日志摘要、文章列表和完整正文
- 使用 TypeScript 维护结构化资料，使用 Markdown 维护中英文 Build Log
- 支持可刷新、可分享的 `#/build-log` 文章地址

### 历史星河

历史星河集成在 `#/history-galaxy`，从个人主页精选项目入口进入，提供全屏历史探索体验。

- 唐、五代、宋、元、明、清、近代七段时代导航
- 30 个精选历史事件，星体大小与光效体现事件知名度
- 鼠标或触控旋转、滚轮沿时间轴航行、事件星点自由拖拽
- 点击事件触发选中特效、相机聚焦和人物故事面板
- 键盘左右键切换事件，`Escape` 关闭故事
- 移动端底部故事抽屉，以及 WebGL 不可用时的二维降级浏览
- 使用 Three.js、React Three Fiber、Drei 和 Postprocessing；首页静态预览不加载 Three.js 运行时

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

- 个人主页：`http://localhost:5173/`
- 历史星河：`http://localhost:5173/#/history-galaxy`
- Build Log：`http://localhost:5173/#/build-log`

## 项目结构

| 路径 | 职责 |
| --- | --- |
| `src/App.tsx`、`src/routes.ts` | Hash 路由与页面切换 |
| `src/PortfolioApp.tsx`、`src/content.ts` | 双语个人主页与结构化资料 |
| `src/posts/`、`src/posts.ts` | Build Log 内容与解析 |
| `src/HistoryGalaxyApp.tsx`、`src/history/` | 历史星河入口、事件数据和空间映射 |
| `src/scene/` | 3D 场景、事件星体、相机和选中特效 |
| `src/components/` | 主页精选项目、日志组件、历史导航和故事面板 |
| `eat-card/` | 独立的小程序、API、管理后台与数据库脚本 |
| `netlify.toml` | 根站点构建与 SPA fallback 配置 |

## 测试与构建

```bash
# 运行主站、API、管理后台和小程序工具测试
npm test -- --run

# 执行 TypeScript 检查并构建生产版本
npm run build
```

GitHub Actions 会在向 `main` 分支推送或提交 Pull Request 时自动执行以上检查。

## 编写 Build Log

日志位于 `src/posts/`。每篇内容使用 Markdown 编写，并为中英文分别建立一个文件；同一篇文章的两个文件使用相同的 `slug`。文件头格式如下：

```markdown
---
slug: example-post
language: zh
date: 2026-06-05
title: 示例文章
summary: 一句话摘要。
tags:
  - React
  - Netlify
relatedProject: 示例项目
---

## 正文标题

正文内容。
```

所有字段都是必填项。`language` 只能是 `en` 或 `zh`，日期使用 `YYYY-MM-DD`，`slug` 使用小写英文、数字和连字符。构建时会校验字段和重复文章，并按日期从新到旧排序。

- 文章列表：`#/build-log`
- 文章详情：`#/build-log/<slug>`

## 部署

### 个人主页

根目录的 [`netlify.toml`](netlify.toml) 固定 Node.js 20、`npm run build` 构建命令、`dist` 发布目录和单页应用重定向规则。

一个 Netlify 站点部署个人主页、`#/history-galaxy`、`#/build-log` 及文章详情等全部 Hash 路由，无需为历史星河创建独立站点。`netlify.toml` 是构建设置的来源，生产产物输出到 `dist/`。

以下是推荐部署流程；本文更新不代表已经推送 GitHub 或执行 Netlify 部署。将 Netlify 项目连接到此 GitHub 仓库后，可配置：

- `main` 分支合并后自动构建并发布生产站点
- Pull Request 自动生成 Deploy Preview，合并前即可检查页面
- GitHub Actions 的 `test-and-build` 任务负责测试和生产构建校验
- 建议设置分支规则，要求 Pull Request 和 CI 通过后才能合并到 `main`

日常更新流程是：新建分支、添加或修改 Markdown、提交 Pull Request、检查 CI 与 Deploy Preview，然后合并。无需手动上传 `dist`。

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
