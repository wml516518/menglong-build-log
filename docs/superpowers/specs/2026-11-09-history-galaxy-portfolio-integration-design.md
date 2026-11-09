# 历史星河与 MengLong Build Log 集成设计

## 目标

将《历史星河》作为 `menglong-build-log` 个人主页中的重点作品交付，而不是继续占据网站根地址。访问根地址时恢复原有双语个人主页、履历、项目列表与 Build Log；用户从首页的重点项目展示进入 `#/history-galaxy`，获得现有完整全屏 3D 体验，并能清晰返回主页。

集成继续使用同一个 React、Vite、Netlify 项目，不新建站点、不使用 iframe，也不复制一套构建流程。

## 用户体验

### 个人主页

- `/` 与普通锚点地址继续展示原有 `MengLong Wang` 个人主页。
- 原有中英文切换、履历、项目列表、联系方式、Build Log 索引与文章详情继续工作。
- 首页项目区域最前方新增一个宽幅的《历史星河》重点项目展示。
- 重点展示使用真实 Playwright 场景截图作为首屏预览，不在主页后台加载 Three.js Canvas。
- 展示内容包含项目名称、一句话说明、核心技术栈和明确的“进入星河 / Enter the galaxy”链接。
- 点击入口将地址更新为 `#/history-galaxy`，在同一页面进入完整作品。

### 历史星河

- `#/history-galaxy` 渲染当前完整的全屏 Three.js 体验。
- 左上品牌区域增加一个克制的返回主页入口，使用箭头图标和“返回主页”可访问名称。
- 返回后地址为 `#home`，个人主页滚动到顶部。
- 浏览器前进、后退可以在主页、Build Log 与历史星河之间正确切换。
- 历史星河内部的时代、事件、故事、键盘、拖拽、滚轮、移动抽屉和 WebGL 降级行为保持不变。

## 路由设计

现有 `Route` 联合类型增加 `{ view: 'history-galaxy' }`：

- `#/history-galaxy`：历史星河。
- `#/build-log`：Build Log 索引。
- `#/build-log/<slug>`：文章详情。
- 其他哈希：个人主页，并沿用 `#projects`、`#resume`、`#about`、`#contact` 等页面内锚点。

路由解析保持纯函数，并增加历史星河、普通锚点和非法近似地址的测试。`App` 仅根据解析结果选择 `PortfolioApp` 或懒加载的 `HistoryGalaxyApp`，避免把两套界面逻辑重新堆进一个大组件。

## 组件边界

### `PortfolioApp`

从历史提交中恢复原有主页应用逻辑，继续拥有：

- 当前语言与本地存储。
- Build Log 路由内容。
- 首页锚点滚动。
- 履历、项目与联系信息。
- 历史星河重点项目展示。

### `HistoryGalaxyApp`

由当前根 `App.tsx` 的历史星河状态与 UI 提取而成，继续拥有：

- WebGL 探测与错误降级。
- 当前年份、当前时代、选中事件与相机状态。
- HUD、Canvas、语义事件列表与故事面板。
- 返回主页入口。

### `HistoryGalaxyFeature`

主页中的宽幅项目展示组件，只负责静态预览和路由入口。它使用已经生成并提交的桌面事件截图，不实例化 Three.js，不共享 3D 场景运行状态。

## 视觉整合

个人主页恢复原有浅色、克制、偏编辑排版的视觉系统。《历史星河》重点项目作为项目区内唯一的深色全宽作品带，用真实星河截图形成强烈但受控的反差。

重点项目不是普通三列卡片，也不嵌套卡片：左侧为项目名称、摘要和技术标签，右侧为带固定宽高比的截图窗口；移动端改为文字在上、截图在下。预览边角保持不超过 8px，并提供清晰焦点状态。

历史星河继续使用现有全屏暗色主题。两套 CSS 通过顶层作用域隔离：

- `.portfolio-site` 管理个人主页。
- `.history-experience` 管理历史星河。

全局只保留盒模型、基础字体平滑和必要的 body 重置。个人主页不能继承历史星河的 `overflow: hidden`；只有历史星河路由锁定视口滚动。

## 内容与双语

主页重点项目文案进入现有 `content.ts` 中英文内容模型，而不是在组件中判断语言。

中文基线：

- 名称：历史星河
- 状态：交互式 3D 作品
- 摘要：从唐朝航行至 1949 年，在历史时间轴上拖拽事件星点，探索人物与时代故事。
- 操作：进入星河

英文基线：

- Name: History Galaxy
- Status: Interactive 3D experience
- Summary: Travel from the Tang dynasty to 1949, move event stars across a living timeline, and explore the people and stories behind each turning point.
- Action: Enter the galaxy

## 性能与资源

- Three.js、React Three Fiber、Drei 与后期处理继续由历史星河路由懒加载。
- 主页只加载一张压缩后的场景预览图；优先复用 `output/playwright/history-galaxy-event.png` 的视觉内容，并复制为明确的站点资源名。
- 切回主页时历史星河组件卸载，R3F 释放场景资源和监听器。
- 不在主页创建隐藏 Canvas，不使用视频背景，不引入新的运行时依赖。

## SEO 与部署

- 默认 `index.html` 恢复 `MengLong Wang | Portfolio + Build Log` 主页标题、描述、主题色、Open Graph 与 canonical URL。
- React 根据路由更新 `document.title` 和 description：历史星河使用 `历史星河｜中国历史3D交互时间轴`，Build Log 维持主页品牌语义。
- npm 包名恢复为 `menglong-build-log`，README 恢复仓库整体说明，并新增历史星河路由和 Netlify 部署说明。
- `netlify.toml` 不变：Node 20、`npm run build`、`dist` 与 SPA fallback 继续适用于所有哈希路由。

## 无障碍与降级

- 主页重点项目入口是普通链接，可键盘聚焦并支持浏览器地址行为。
- 历史星河返回主页使用可访问名称和可见焦点样式。
- 现有 30 个语义事件按钮、故事焦点管理和 WebGL 二维降级列表保留。
- `prefers-reduced-motion` 同时影响个人主页过渡和历史星河 3D 动画。
- 图片提供描述实际画面的替代文本，而不是重复项目名称。

## 测试与验收

### 自动化

- 路由测试覆盖 `#/history-galaxy`。
- 主页测试覆盖默认个人主页、语言切换、重点项目双语内容和历史星河入口。
- 历史星河测试通过根路由入口打开，覆盖七时代、30 事件、故事开合与键盘行为。
- 返回主页测试覆盖路由变更和主页重新出现。
- 原有 Build Log 索引、文章详情、非法文章与语言切换测试恢复并继续通过。
- `npm test -- --run` 与 `npm run build` 必须通过。

### 真实浏览器

- 1440×900：主页首屏、重点项目展示、Build Log 与历史星河路由均无重叠。
- 390×844：主页重点展示可读，进入历史星河后 Canvas 和移动故事抽屉仍可用。
- 验证从主页进入历史星河、选择事件、返回主页、浏览器后退和前进。
- Canvas 像素检查继续确认非空、多色且有足够亮像素。
- 控制台无错误，网络请求无 404，页面不产生非预期横向溢出。

## 交付标准

- 根地址再次呈现完整 `menglong-build-log` 个人主页。
- 《历史星河》作为首页最醒目的重点项目之一出现，但不拖慢主页初始加载。
- `#/history-galaxy` 保留现有完整可玩体验并可返回主页。
- Build Log、文章、语言偏好、页面内锚点与 Netlify 部署不回归。
- Git 提交不包含用户原有的 `assets/` 与 `nas-frp-setup/` 未跟踪目录。
