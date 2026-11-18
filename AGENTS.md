# 仓库约定

个人主页 + 构建日志 + AI Chat 前端 + 历史星河，统一部署在 `https://wml.ailoong.net.cn`。部署细节见 `docs/deployment/single-domain.md`，历史踩坑见 `docs/deployment/pitfalls.md`，改部署链路前必读。

## 硬性约束

- 不修改 Weekend Merge、`movie/movies.ailoong.net.cn`、`nas.ailoong.net.cn` 的 Nginx 配置和隧道；它们与本站共用服务器与 Cloudflare 账号。
- 服务器命令由用户执行；只输出可直接粘贴的脚本，不要假设有 root 交互。
- 发布账号 `portfolio-deploy` 只拥有 `/srv/portfolio/static`；不要把密钥、`.env`、数据库放在其可写范围内。
- 服务器默认 `python3` 是 3.6.8。`scripts/activate-release.py` 及任何上传到服务器执行的脚本必须兼容 3.6，禁止 `dirs_exist_ok`、`X | None`、`list[str]`。
- 生产发布只由 `main` push + CI 成功的 `Deploy static sites` 触发；PR 预览不会上线。未验证 CI 与线上前，不要声称部署可用。

## 常用命令

```bash
npm run test        # vitest，全局 testTimeout 15s，别改回默认 5s
npm run build       # 主页、Build Log、AI Chat → dist/
npm run build:history  # 历史星河 → dist-history/
```

改动后的最低验收：四个入口 `/`、`/playground/`、`/apps/history-galaxy/`、`/apps/lol-rag/` 全部 200，两个 health 返回 `status: ok`。

## CMS

`/admin/` 走 Decap Turbo，`public/admin/config.yml` 的 `turbo_site_id` 与 Turbo 站点 `MengLong Portfolio` 绑定。Turbo 站点的 `Admin interface URL(s)` 必须是 `https://wml.ailoong.net.cn/admin/`，否则登录报 `redirect_to origin ... is not the admin URL`。改后台地址是 Turbo 后台操作，不需要改代码。

## 历史记录

- 2026-11：从 Netlify 迁到阿里云 + Cloudflare Tunnel，静态站接 GitHub Actions 自动发布；Netlify 站点下线。
- 历史星河、AI Chat 曾各自独立部署，现统一到同域名的 `/apps/history-galaxy/` 与 `/playground/`。
