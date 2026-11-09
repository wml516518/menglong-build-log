# 历史星河

《历史星河》是一款全屏 3D 中国历史交互网页。从唐朝到 1949 年，三十个历史事件以不同大小的星体分布在时间轴上；用户可以旋转场景、沿年代航行、拖拽事件星点，并点击展开相关人物与故事。

## 主要体验

- 唐、五代、宋、元、明、清、近代七段时代导航
- 30 个精选历史事件，知名度决定星体大小与光效强度
- 鼠标或触控旋转、滚轮沿时间轴航行、事件星点自由拖拽
- 点击事件触发粒子爆发、冲击环、相机聚焦和故事面板
- 键盘左右键切换事件，`Escape` 关闭故事
- 移动端底部故事抽屉，以及 WebGL 不可用时的二维降级浏览

## 技术栈

- React 19、TypeScript、Vite
- Three.js、React Three Fiber、Drei、Postprocessing
- Vitest、Testing Library、Playwright
- Netlify 单页应用部署

## 本地开发

要求 Node.js 20 或更高版本。

```bash
npm ci
npm run dev
```

Vite 默认在 `http://localhost:5173` 启动。打开根地址即可进入《历史星河》；页面不需要后端服务或外部图片资源。

## 测试与构建

```bash
npm test
npm run build
```

生产产物输出到 `dist/`。根目录的 `netlify.toml` 已配置 Node.js 20、`npm run build`、`dist` 发布目录和 SPA fallback，可直接连接 GitHub 仓库部署到 Netlify。

## 项目结构

| 路径 | 职责 |
| --- | --- |
| `src/history/` | 历史事件数据、类型和空间映射 |
| `src/scene/` | Three.js 场景、时间轴、事件星体、相机和选中特效 |
| `src/components/` | HUD、语义事件导航和故事面板 |
| `docs/superpowers/specs/` | 体验与视觉设计规格 |
| `docs/superpowers/plans/` | 实施计划 |

仓库中仍保留早期个人主页内容模块与独立的 `eat-card/` 小程序项目，但根地址当前交付的是《历史星河》。
