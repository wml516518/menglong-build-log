# 部署踩坑清单

迁移到自托管 + Cloudflare 过程中实际踩过的坑，按现象 → 原因 → 处理记录。改动部署链路前先读一遍，避免重复排查。

## 1. DNS 与 Cloudflare

**本机 `dig` 解析出 `198.18.0.126`**
原因：本机 Clash/代理的 fake-IP 段，不是真实解析结果。
处理：判断线上解析要用 DoH，不要信本地 resolver：

```bash
curl -s -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=wml.ailoong.net.cn&type=A' \
  | jq -r '[.Answer[]?.data] | join(",")'
```

**本机 `curl` 报 `SSL_ERROR_SYSCALL` 或 403 `Server: Beaver`**
原因：本机 DNS/代理链路或国内加速节点拦截，不代表源站有问题。
处理：先在服务器上绕过 DNS 验证源站，再怀疑本机网络：

```bash
curl -k -I --resolve wml.ailoong.net.cn:443:127.0.0.1 https://wml.ailoong.net.cn/
```

**开了 Full (strict) 后其他域名显示不安全**
原因：Full (strict) 按 hostname 逐个校验源站证书；一个域名配好不代表其他域名也通过。
处理：每个走 strict 的域名都要有被 Cloudflare 认可的源站证书；否则单独降级该域名的 SSL 模式，不要为了一个域名关掉全站 strict。

**Zero Trust 里找不到 “Public Hostname”**
原因：新 UI 把公网入口放在隧道详情的 Routes / Public Hostnames 里；页面上单独的 “Add route” 是私网路由，只有 Published application / Private hostname / private CIDR，不是公网入口。
处理：在对应 Tunnel 的详情页加 Public Hostname 指向 `https://localhost:443`，或用 CLI：

```bash
cloudflared tunnel route dns <tunnel-name> wml.ailoong.net.cn
```

已有的 `weekend-merge`、`movie`、`nas` 隧道不要动。

## 2. Nginx

- `listen 443 ssl http2;` 在 1.25+ 已废弃，会告警。改为 `listen 443 ssl;` + `http2 on;`。
- `protocol options redefined for 0.0.0.0:443`：多个 server 块重复声明 ssl 参数，先清理重复块再看其他告警。
- `conflicting server name`：同端口同 server_name 有多份配置，后加载的会被忽略；改完用 `nginx -T | grep server_name` 确认生效的是哪份。
- 服务器装了宝塔，但 `/www/server/panel/vhost/nginx` 可能是空的，实际生效配置在 `/etc/nginx/conf.d` 与 `/etc/nginx/snippets`。手写配置不要用面板“保存”覆盖。
- 子路径静态站用 `alias` 时，`try_files` 必须回落到自己的入口，不能 `=404`，也不能回主页：

```nginx
location ^~ /apps/lol-rag/ {
    alias /srv/portfolio/static/lol-rag/current/;
    index index.html;
    try_files $uri $uri/ /apps/lol-rag/index.html;
}
```

- `location = /playground/ { try_files /index.html =404; }` 这类精确匹配要成对处理 `= /playground` 的 308 跳转，否则带斜杠和不带斜杠行为不一致。
- 改完固定执行：`nginx -t && systemctl reload nginx`，再在服务器上按 Host 头自测。

## 3. 打包与上传

**服务器上出现 `._index.html`、`._assets` 等文件**
原因：macOS `tar` 会写入 AppleDouble 元数据。
处理：本地打包时禁用：

```bash
COPYFILE_DISABLE=1 tar --no-xattr --no-mac-metadata -czf site.tar.gz -C dist .
```

服务器解包时的 `Ignoring unknown extended header keyword 'LIBARCHIVE.xattr...'` 是同一来源的告警，不致命，但不要让它进产物。

**`gzip: stdin: not in gzip format`**
原因：临时文件托管返回了 HTML 错误页（例如只有 3184 字节），不是真正的压缩包。
处理：解包前先校验，`ls -l` 看大小、`file` 看类型，必要时比对本地 `shasum`。

## 4. 服务器环境

- Alibaba Cloud Linux 3 自带 `python3` 是 3.6.8：发布脚本不能用 `shutil.copytree(..., dirs_exist_ok=True)`、`str | None`、`list[str]` 等 3.8+/3.9+ 语法。CI 只跑 Node，不会替你发现。
- 服务器没有 `nano`；写受保护文件用：

```bash
sudo install -m 600 -o lolrag -g lolrag /dev/null /srv/portfolio/lol-rag/backend/.env
sudo tee /srv/portfolio/lol-rag/backend/.env >/dev/null <<'EOF'
...
EOF
```

- systemd 报 `Failed to load environment files: No such file or directory` 且 `Result: resources`：`EnvironmentFile=` 指向的文件还没建。先建文件，再 `systemctl reset-failed <svc> && systemctl start <svc>`。
- `Failed loading plugin "spacewalk": module 'lib' has no attribute 'X509_V_FLAG_CB_ISSUER_CHECK'` 是 pip 自带插件的兼容告警，不影响安装，不用处理。
- 发布账号 `portfolio-deploy` 只拥有 `/srv/portfolio/static`，不要给它后端目录、`.env`、数据库或 systemd 的权限；验证用 `ssh -o BatchMode=yes`。

## 5. 部署脚本与 CI

- `scripts/deploy-static.sh` 依赖 `ssh-agent`，不接受 `-i`。本地演练先 `eval "$(ssh-agent -s)" && ssh-add <key>`，否则报 `Permission denied (publickey)`。
- workflow 实际读的是 `secrets.DEPLOY_HOST` / `secrets.DEPLOY_USER`，只有端口和根目录走 `vars`。配置时以 workflow 为准，别照抄文档里的 `vars`。
- `activate-release.py` 的两个硬约束：`current` 必须是符号链接（不能是实体目录）；构建产物必须有该应用的入口文件（`home`/`lol-rag` 是 `index.html`，`history` 是 `history.html`）。
- 生产发布只接受 `main` push 且 CI 成功的 `workflow_run`。`workflow_dispatch` 不算 push，不会触发部署；`gh run rerun` 仍是 push 事件，可以用来触发一次真实发布。
- vitest 默认 5s 超时在 2 worker 的 CI 上会误杀重型集成测试（`HistoryExplorer`、`HistoryGalaxySceneIntegration` 都中过）。已在 `vite.config.ts` 设 `testTimeout: 15_000`，不要改回去；新增重测试也不要依赖默认值。

## 6. Netlify 下线与 CMS

**`/admin/` 报 `Could not redirect: redirect_to origin "https://wml.ailoong.net.cn" is not the admin URL of site ...`**
原因：Decap Turbo 站点的 `Admin interface URL(s)` 还登记着旧 Netlify 域名。
处理：Turbo → Sites → MengLong Portfolio → Site，把该项改为 `https://wml.ailoong.net.cn/admin/` 并保存。`turbo_site_id` 不变，代码无需改动。

删 Netlify 前还要确认：

- 引用旧域名的定时 workflow 已删除或改指向新域名（`netlify-recover.yml`、`smoke.yml` 默认值），否则每天定时任务报红。
- 仓库里不再有 `NETLIFY_AUTH_TOKEN` / `NETLIFY_SITE_ID` 之类的残留配置。
- 分支保护只要求 `test-and-build`；Netlify 的 3 个 check 消失不影响合并。
- `eat-card` 仍依赖 Netlify Functions，不要一起删。

## 7. 后端与模型

- DeepSeek 模型名大小写和版本都敏感：传 `deepseek-V4-flash` 会直接 400，支持的是 `deepseek-flash`、`deepseek-v4-pro`。
- SSE 必须关代理缓冲，否则前端收不到流：

```nginx
proxy_buffering off;
proxy_cache off;
```

- 健康检查按应用前缀走，不要混用：`/api/ai-chat/api/health`、`/apps/lol-rag/api/health`。`/api/lol-rag/health` 是 404。

## 8. 改完必做的验收

```bash
for u in / /playground/ /apps/history-galaxy/ /apps/lol-rag/; do
  printf '%-26s ' "$u"; curl -s -o /dev/null -w '%{http_code}\n' "https://wml.ailoong.net.cn$u"
done
curl -s https://wml.ailoong.net.cn/api/ai-chat/api/health
curl -s https://wml.ailoong.net.cn/apps/lol-rag/api/health
```

四个入口都应为 `200`，两个 health 都应为 `{"status":"ok",...}`；再确认 `current` 指向新 release：

```bash
ssh portfolio-deploy@8.148.30.195 'for a in home history lol-rag; do readlink /srv/portfolio/static/$a/current; done'
```
