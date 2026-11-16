# Single Domain Sites Implementation Plan

**Goal:** 将已确认的作品集规划变成可独立构建、同域名访问的应用与部署配置。

**Architecture:** 主页与历史星河使用独立入口和构建；AI Chat 在主页中懒加载；LOL RAG 按子路径独立发布。Nginx 分发，GitHub Actions 测试后发布到各自版本目录。

**Tech Stack:** Vite、React、TypeScript、FastAPI、Nginx、GitHub Actions、SSH。

**Spec:** `docs/superpowers/specs/2026-11-16-single-domain-sites-design.md`

## Tasks

- [ ] 分离主页/星河入口与构建。修改 `src/App.tsx`，新增 `src/HistorySiteApp.tsx`、`history.html`、`vite.history.config.ts`。测试旧链接跳转、档案返回、两套产物的资源路径；保留星河性能修复。
- [ ] 集成 AI Chat。将已验证中文组件放入 `src/playground/`，使用局部样式与同源 API；新增页面返回链接，验证预设、流式回答、错误状态、刷新。
- [ ] 调整作品列表。修改中英文 `content/*/site.yml`，允许受限的站内 liveUrl，LOL RAG/主页/AI Chat 改为同源路径，移除 KnowledgeOps 展示；保留日志与 Weekend Merge 地址。验证内容校验、英文一致性与页面入口。
- [ ] 适配 LOL RAG 子路径。在独立仓库调整 Vite base、API 前缀与主页返回入口，运行前后端原有测试及子路径浏览器验证。
- [ ] 提供部署配置。新增 Nginx 配置、按应用切换版本脚本和 GitHub Actions，验证真实 Nginx 路由、缺失资源、API 分发和发布隔离。
- [ ] 全量验证并记录。执行测试与构建、桌面/手机浏览器检查；列明正式部署尚需确认的信息。

本轮不创建提交、推送或修改线上基础设施；用户确认的方案在隔离工作区实现并供审阅。
