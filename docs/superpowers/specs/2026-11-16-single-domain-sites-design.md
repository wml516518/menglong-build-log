# 同域名作品集部署设计

用户已确认按同域名、项目独立发布的方案实施。个人主页 `/`；历史星河 `/apps/history-galaxy/`；LOL RAG `/apps/lol-rag/`；AI Chat `/playground/`。Weekend Merge 保持现有服务器部署，KnowledgeOps 从主要项目列表撤下，保留仓库和日志。

主页与历史星河共享源码，但有不同 HTML/TypeScript 入口、Vite base 与发布目录，互不包含对方应用入口。历史星河保留原有 hash 档案路由，站点根路径默认进入星河；旧主页 hash 链接迁移到独立站点。此前验证的缩小性能修复一并保留。

AI Chat 复用已完成的中文 UI、参数和 SSE 协议，作为主页应用的懒加载页面，通过 `/api/ai-chat/api/*` 访问独立后端，密钥继续只放服务端。LOL RAG 保留独立仓库，前端配置 base `/apps/lol-rag/`，请求 `/apps/lol-rag/api/*`，由 Nginx 转发到其独立 FastAPI。

静态资源按项目目录隔离，Nginx 显式处理各应用的入口、资源 404 与 API；HTML/历史 JSON 重新验证缓存，带哈希资源长期缓存。不得让主页部署删除其他应用目录。GitHub Actions 先检查，再上传独立构建产物；服务器通过版本目录与符号链接切换保留回滚能力。

目前未确认正式主机名、服务器 SSH 账号、站点目录、服务端口与 Cloudflare 访问权限。代码和本地端到端验证先完成；线上启用必须使用实际服务器配置，不写入猜测的地址或凭据。已有 Weekend Merge 服务不改动。
