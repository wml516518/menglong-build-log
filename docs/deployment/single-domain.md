# 同域名部署手册

> 迁移过程中踩过的具体问题（Cloudflare、Nginx、macOS 打包、Python 3.6、Turbo 后台地址等）见 [踩坑清单](pitfalls.md)。改部署链路前先读。

## 访问与构建

| 应用 | 地址 | 构建 | 产物 | 服务器目录 |
| --- | --- | --- | --- | --- |
| 个人主页、Build Log、AI Chat | `/`、`/#/build-log`、`/playground/` | `npm run build` | `dist/` | `/srv/portfolio/static/home/current/` |
| 历史星河 | `/apps/history-galaxy/` | `npm run build:history` | `dist-history/` | `/srv/portfolio/static/history/current/` |
| LOL RAG（独立仓库） | `/apps/lol-rag/` | 在 frontend 执行 `npm run build:self-host` | `frontend/dist/` | `/srv/portfolio/static/lol-rag/current/` |
| Weekend Merge | `https://weekendmerge.ailoong.net.cn` | 沿用现状 | 沿用现状 | 不变 |

历史星河内部仍使用 `#/history-galaxy/event/...` 等 Hash 路由。根地址会自动打开星河；旧主页的星河链接保留档案 ID 和筛选参数并跳转到新路径。两个构建入口相互独立；发布主页不需要把星河打进主页运行时。

AI Chat 前端复用中文预设、参数与 SSE 交互，集成在主页 `/playground/`，不会在首页加载聊天页面。后端复用原 AIChatPlayground FastAPI；模型 API key 继续只放后端环境文件。KnowledgeOps 的仓库、开发日志和简历中的实际经历不删除，仅撤下主要在线项目卡片。

## 首次服务器准备

需要确认正式域名、SSH 主机与端口、发布用户、是否使用宝塔、已有 Nginx 配置和后端运行位置。静态站统一放在 `/srv/portfolio/static`，后端与密钥目录留在其外；默认端口 `8001`、`8002` 是模板参数，正式启用时与实际环境核对。

安装 Nginx、Python 3、tar，准备由发布用户拥有的 `/srv/portfolio/static`。Nginx worker 必须能读取此目录的父目录及内容。服务器静态托管不要求 Node，Node 20 的构建在 CI 完成。

首次发布应先上传 home、history、lol-rag 三个产物，再启用新域名入口，避免主页链接指向尚未安装的应用。当前线上已按此顺序完成。启用 GitHub 自动发布前，手动上传任一构建目录后可在服务器执行：

```bash
python3 activate-release.py home first-home /absolute/path/to/home-build --root /srv/portfolio/static
python3 activate-release.py history first-history /absolute/path/to/history-build --root /srv/portfolio/static
python3 activate-release.py lol-rag first-lol /absolute/path/to/lol-build --root /srv/portfolio/static
```

只允许 app 为 home/history/lol-rag。每次发布写入 `<app>/releases/<release>`，验证入口后原子切换 `<app>/current`，不会删除其他应用。旧 assets 保留供已打开页面加载懒加载模块。旧版本和 incoming 会占用磁盘，应在完成验证后按自己的保留周期清理，切勿删除当前链接所指目录。

回滚只需将某个应用的 current 链接原子切换到它自己的旧 releases 目录。其他站点保持原状；发布脚本不会自动回滚后端数据库或模型配置。

## 后端接口

Nginx 的 `routes.conf` 默认映射：

- `/api/ai-chat/api/health` → `http://127.0.0.1:8001/api/health`
- `/api/ai-chat/api/chat` → `http://127.0.0.1:8001/api/chat`，关闭代理缓冲以保留 SSE。
- `/apps/lol-rag/api/health` → `http://127.0.0.1:8002/api/health`
- `/apps/lol-rag/api/chat` → `http://127.0.0.1:8002/api/chat`

复用两个项目原有的 FastAPI 与环境变量。在对应项目配置 Python 虚拟环境和依赖，然后以 systemd 或现有进程管理方式运行：

```bash
# AIChatPlayground/backend 目录、对应虚拟环境中
uvicorn app.main:app --host 127.0.0.1 --port 8001
# lol-rag/backend 目录、对应虚拟环境中
uvicorn app.main:app --host 127.0.0.1 --port 8002
```

本地回归使用受控的 HTTP 测试后端，不消耗模型额度。当前线上已通过真实模型请求验证：AI Chat 的 `/api/ai-chat/api/health` 返回 `deepseek-flash`，LOL RAG 的 `/apps/lol-rag/api/health` 返回数据版本 16.22.1，并已分别完成一次真实流式回答和工具调用回答。两个后端均由 systemd 常驻运行。

## Nginx 与 Cloudflare

将 `deploy/nginx/routes.conf` 安装为 `/etc/nginx/portfolio/routes.conf`，把 `site.conf.example` 中的示例域名替换为正式主机名，并放入实际的 Nginx 站点配置。若使用宝塔，将路由片段纳入目标站点的 server 块，先检查已有 location 冲突，不要覆盖已有 Weekend Merge 配置。

`nginx -t` 通过后重载。静态 assets 长期缓存，HTML 与历史 JSON 重新验证缓存；缺失脚本、历史 JSON 和未知 `/apps/`、`/api/` 地址返回 404，不返回主页 HTML。

当前 `wml.ailoong.net.cn` 使用 Cloudflare Tunnel `portfolio-wml`，云端 Public Hostname 指向源站 `https://localhost:443`，因此无需为大陆源站添加不可达的 A/AAAA 记录。Nginx 使用 Cloudflare Origin 证书，代理模式为 Full (strict)。Tunnel 解决访问路径，不替代 ICP 备案；完全合规仍应补齐备案。

Cloudflare 缓存规则必须绕过 `/api/` 和 `/apps/lol-rag/api/`，不要为整个域名配置无差别 Cache Everything。即使关闭 Cloudflare 代理，同一路径结构也能正常工作。

## GitHub Actions 发布

主页仓库和 LOL RAG 仓库分别配置以下 Secrets：

- `DEPLOY_HOST`：实际服务器主机。
- `DEPLOY_USER`：实际发布用户。
- `DEPLOY_SSH_KEY`：对应的 SSH 私钥。
- `DEPLOY_KNOWN_HOSTS`：通过可信渠道确认的 SSH 主机公钥记录；非 22 端口使用 `[host]:port` 格式。

Variables：`DEPLOY_ROOT=/srv/portfolio/static`、`DEPLOY_PORT=22`（按实际修改）、`SELF_HOST_DEPLOY_ENABLED=true`。启用前可以不配置最后一个变量，CI 仍检查和上传产物，线上不会自动变化。可为 `production` Environment 配置所需的发布保护。

CI 成功后，部署 workflow 只接受本仓库 main push 的成功运行，下载该 CI 的产物并使用其准确 SHA 发布。PR 产物不会触发生产发布。主页仓库有 home/history 两个独立发布目录；LOL RAG 的 CI 和部署完全在自己的仓库内，修改它不触发主页仓库构建。

首次迁移需要把两边代码分别合并后启用 workflow，并验证主页入口、星河档案分享链接、LOL 工具轨迹、聊天 SSE、手机布局与刷新。没有服务器信息时可以先在本地同端口预览完整路径，详见验证记录。
