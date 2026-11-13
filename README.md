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
- 使用 YAML 维护主页与简历，使用 Markdown 维护 Build Log；中文是唯一人工编辑源，英文由 CI 自动生成
- 支持可刷新、可分享的 `#/build-log` 文章地址

### 历史星河

历史星河集成在 `#/history-galaxy`，从个人主页精选项目入口进入，提供全屏历史探索体验。

- 唐、五代、宋、元、明、清、近代七段时代导航
- 从先秦至 1949 年的 1200 个有来源历史事件，包含 1000 篇基础档案与 200 篇核心档案；星体大小与光效体现事件影响力
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

### 历史星河内容系统

正式内容包含从先秦至 1949 年、覆盖九个编辑时期的 1200 个有来源事件：1000 篇基础档案提供概览、年代、分类、关联与参考资料，200 篇核心档案进一步提供背景、原因、过程、结果、影响与史学说明。集成测试使用正式生成索引；独立的 `generateScaleFixture` 合成夹具仅用于算法规模与预算回归，不属于历史资料，也不进入生产模块。内容源位于 `history-content/`，全部基础与核心事件的共享元数据均由 `catalog/events/` 的 JSON 注册表维护，包括稳定 ID、标题、摘要、年代、时代、类别、影响力、布局及人物/地点/来源/事件关联。核心 Markdown 仅保留用于匹配 JSON 的 ID，以及背景、原因、过程、结果、影响和史学说明等叙事增强字段；不要在 Markdown 中重复维护共享元数据。新增内容应沿用现有文件格式与 `src/history/content/schema.ts` 的字段约束；使用公元前年份负数，不使用公元 0 年，不嵌入原始 HTML。

```bash
npm run history:check    # 校验结构、引用和年代，不发布内容
npm run history:compile  # 编译 manifest、紧凑索引、时代档案与兼容数据
npm run content:validate # 校验主页、简历与日志中文内容
npm run content:check-generated # 校验英文内容与源内容哈希、字段一致性
```

`dev`、`test`、`build` 前自动编译。`public/history-content/generated/` 与 `src/history/generated/` 为忽略提交的生成目录，请修改内容源后重新编译。首屏仅加载紧凑索引，完整档案按时代懒加载并缓存；新增时代、事件及人物后重新编译即可复用搜索、筛选和档案引擎。七段快捷导航提供唐至近代的跳转入口；先秦、秦汉、魏晋等事件也可通过搜索、时代筛选和二维年表访问。

档案地址为 `#/history-galaxy/event/<id>`、`#/history-galaxy/person/<id>` 和 `#/history-galaxy/theme/<id>`。搜索、年代和分类等筛选保存在 URL 中；相机、已选事件和释放后的拖动偏移使用版本化本地会话保存。浏览器返回可恢复探索上下文。

场景按总览、时代、时期、近景四档 LOD 控制星点、标签和关系线预算，手机使用更小预算。屏幕空间四叉树在 Worker 中聚合相邻光点，近距离按语义组区分，点击聚类可放大；选中、搜索目标和影响力 5 的事件优先保留，保护集合可以超过普通预算。批量星体使用实例化绘制。

总览通过聚类展示 1200 条事件的空间分布，不同时显示 1200 个标签。搜索 Worker 使用 MiniSearch；Worker 失败时切换到本地标题、别名和人物名前缀搜索。WebGL 不可用时显示二维时间轴，继续共享筛选、搜索、故事面板和完整档案。`prefers-reduced-motion` 会关闭环境运动。

规模回归可运行 `npx vitest run src/history/performance.test.ts src/HistoryGalaxyApp.test.tsx`。浏览器人工/自动化验收产物放在忽略提交的 `output/playwright/`；移动尺寸模拟与桌面帧耗时不能替代真实低端手机测试。

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
| `src/PortfolioApp.tsx`、`src/content.ts` | 双语个人主页与内容加载 |
| `content/zh/`、`content/en/` | 中文源内容与自动生成的英文内容 |
| `src/posts.ts` | Build Log 内容解析 |
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

## 内容管理后台

仓库所有者可在 [生产内容后台](https://menglong-build-log.netlify.app/admin/) 使用 GitHub 账号登录，编辑中文主页、简历和 Build Log。保存后，Decap Turbo 会创建或更新 `cms/*` PR；GitHub Actions 自动生成英文、运行 CI、按已验证提交执行 squash merge，随后由 Netlify 发布。

- 只编辑 `content/zh/**`；`content/en/**` 是生成结果，不应手工修改。
- 后台不提供绕过 CI 的直接发布，保存一次即可等待自动流程完成。
- 新建 Build Log 默认是草稿，草稿不会显示在公开页面。
- Secret 配置、发布流程、故障恢复和凭据轮换参见 [`docs/cms-operations.md`](docs/cms-operations.md)。

## 编写 Build Log

中文日志位于 `content/zh/posts/`，英文生成结果位于 `content/en/posts/`。每篇内容使用 Markdown 编写；人工只维护中文文件，自动翻译会生成同名英文文件。文件头格式如下：

```markdown
---
slug: example-post
date: 2026-06-05
draft: false
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

`slug`、日期、草稿状态、标题、摘要、标签、关联项目和正文是必填项，封面图片可选。日期使用 `YYYY-MM-DD`，`slug` 使用小写英文、数字和连字符。构建时会校验字段、重复文章以及中英文生成状态，并按日期从新到旧排序。

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

代码更新流程是：新建分支、提交 Pull Request、检查 CI 与 Deploy Preview，然后合并。日常内容更新优先使用 CMS 自动发布流程。两种方式都无需手动上传 `dist`。

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
