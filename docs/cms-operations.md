# 中文内容后台运维指南

本文面向仓库所有者，说明如何通过 Decap CMS 修改个人主页、简历和 Build Log，以及如何处理自动翻译、CI 与部署故障。

## 后台入口与权限

- 生产后台：<https://menglong-build-log.netlify.app/admin/>
- 登录方式：使用仓库所有者的 GitHub 账号登录 Decap Turbo。
- 后台只编辑 `content/zh/**` 中文源内容和 `public/uploads/**` 上传资源。
- `content/en/**` 是自动生成内容，不要在后台、GitHub 网页或本地手工修改。
- 后台的直接 Publish 控件已禁用。点击 Save 只会创建或更新同仓库的 `cms/*` 发布 PR，不会绕过检查直接修改 `main`。

后台包含三个内容入口：主页内容、简历和构建日志。主页与简历不能删除；构建日志可以新建、修改和删除。新文章默认是草稿，草稿不会出现在公开页面。

## 正常发布流程

一次保存会经历以下过程：

1. Decap Turbo 将中文修改提交到同仓库的 `cms/*` 分支，并创建或更新 PR。
2. `CI` 校验中文结构、英文生成状态、测试和生产构建。中文刚变化时，英文陈旧导致第一次 CI 未通过是预期的中间状态。
3. 受信任的 `CMS Publish` 工作流确认 PR 来自当前仓库、分支以 `cms/` 开头、作者可信，并且改动范围仅包含中文内容、上传资源或已验证的生成内容。
4. 工作流调用 DeepSeek 翻译变化的中文字段，只把对应的 `content/en/**` 文件提交回同一个 PR。
5. 第二次 CI 验证中英文结构、来源哈希、测试和构建。
6. 全部检查通过后，工作流按已验证的精确提交 SHA 执行 squash merge；PR 头部发生变化时会拒绝合并。
7. Netlify 检测到 `main` 的新提交后自动构建并发布。

因此，日常内容修改只需编辑中文并保存一次。不要为了让第一次 CI 变绿而手工补英文。

## GitHub Secrets

仓库需要两个 Actions Secret，值不得写入仓库、Issue、PR、日志或本文档：

| Secret | 用途 |
| --- | --- |
| `DEEPSEEK_API_KEY` | `CMS Publish` 调用 DeepSeek 生成英文内容。 |
| `CMS_TRANSLATION_TOKEN` | 将经过校验的英文生成提交推回当前 `cms/*` 分支。应使用仅限 `wml516518/menglong-build-log` 的 fine-grained token，只授予 Contents 读写和 Metadata 读取。 |

只能检查 Secret 名称，不能读取值：

```bash
gh secret list --repo wml516518/menglong-build-log
```

### 轮换 DeepSeek Key

1. 在 DeepSeek 控制台创建新 Key。
2. 通过 GitHub 仓库 Settings > Secrets and variables > Actions 更新 `DEEPSEEK_API_KEY`，或运行 `gh secret set DEEPSEEK_API_KEY --repo wml516518/menglong-build-log` 并在隐藏提示中粘贴。
3. 用一次受控的 CMS 内容修改验证翻译工作流。
4. 验证成功后，在 DeepSeek 控制台撤销旧 Key。

### 轮换翻译 Token

1. 在 GitHub 创建新的 fine-grained token：所有者为 `wml516518`，仅选择本仓库，权限为 Contents 读写、Metadata 读取，并采用可实际维护的最短有效期。
2. 更新 `CMS_TRANSLATION_TOKEN`，不要把 Token 放入命令参数或 shell 历史；使用 GitHub 设置页或 `gh secret set CMS_TRANSLATION_TOKEN --repo wml516518/menglong-build-log` 的隐藏提示。
3. 用一次受控的 CMS 内容修改验证生成提交可以推回 PR。
4. 验证成功后，在 GitHub Developer settings 中撤销旧 Token，并在私人密码管理器记录新 Token 的到期与轮换日期。

如果 Token 已过期或疑似泄露，应先撤销旧 Token，再创建并写入新 Secret；在轮换完成前不要反复重跑包含敏感操作的工作流。

## 故障识别与恢复

### 结构或必填字段错误

现象：后台拒绝保存，或 `CI` 的 `Validate source content` 失败。

处理：回到中文内容修复空的必填字段、无效日期、重复文章 slug 或错误字段结构，再保存。不要修改英文文件来规避校验。必要时在本地运行：

```bash
npm run content:validate
```

### 翻译失败

现象：`CMS Publish` 失败，PR 中没有新的英文提交；日志可能显示 DeepSeek 超时、限流、响应格式错误或凭据不可用，但不会输出 Key。

处理：检查 `DEEPSEEK_API_KEY` 是否存在且有效、DeepSeek 服务状态和账户额度。短暂故障可在原因消失后重跑失败的工作流；持续失败应修正中文中导致结构或受保护术语校验失败的内容后重新保存。不要把 Key 粘贴到 PR 或日志中排查。

### 英文生成内容陈旧

现象：`CI` 的 `Verify generated English is current` 失败，报告 `missing`、`stale` 或 `extra`。

处理：中文保存后的第一次失败通常是自动翻译的触发条件，等待 `CMS Publish` 推送英文提交即可。如果发布工作流未运行或失败，先处理该工作流，而不是手改 `content/en/**`。本地开发时可用以下命令检查：

```bash
npm run content:check-generated
```

### 其他 CI 失败

现象：测试、TypeScript 或生产构建步骤失败。

处理：根据失败步骤修复源文件，并通过正常 PR 提交代码修改。CMS 发布工作流只接受内容与上传资源，不会合并代码、工作流、配置或依赖改动。合并前至少运行：

```bash
npm run content:validate
npm run content:check-generated
npm test
npm run build
```

### PR 未自动合并

检查 PR 是否仍为打开状态、最新提交的 CI 是否全部通过，以及 `CMS Publish` 是否因 PR SHA、作者、仓库或改动范围变化而拒绝。安全检查拒绝时不要强行扩展 CMS 权限；将代码或配置改动移到普通 PR，只保留允许的中文内容与上传资源。

### Netlify 部署失败

现象：PR 已合并，但生产站点未更新，或 Netlify 显示构建失败。

处理：在 Netlify Deploys 中确认失败部署对应的 `main` 合并提交，阅读构建日志并修复根因。代码或构建配置问题通过普通 PR 修复；短暂平台故障可在原因消失后重试部署。发布成功后核对中英文页面、Build Log 和 `/admin/`，不要手工上传本地 `dist` 覆盖 Git 部署。

## 更新翻译术语表

术语表位于 `config/translation-glossary.yml`：

- `protected` 中的术语在翻译后必须原样保留。
- `preferred` 为指定中文词提供首选英文表达。
- `policyVersion` 用于标识翻译策略版本。

术语表属于代码配置，必须通过普通开发 PR 修改，不能从 CMS 修改。术语表参与英文来源哈希计算，因此变更后应使用有效的 DeepSeek Key 重新生成全部英文内容，并提交中文源、术语表和生成结果的完整校验结果。英文文件中的 `_translation` 元数据由工具维护，不要手工编辑。

在通过安全方式向当前进程提供 `DEEPSEEK_API_KEY` 后，重新生成并检查全部英文内容：

```bash
npm run content:translate -- --all
npm run content:check-generated
npm test
npm run build
```

只有翻译策略的语义发生变化时才递增 `policyVersion`；单纯补充词条不需要用版本号代替实际的术语表 diff。提交前检查生成的英文表达和受保护术语是否符合预期。

## 恢复历史内容

使用普通 Git revert PR 恢复已发布内容：

1. 找到需要撤销的 CMS squash merge 提交。
2. 在新分支执行 `git revert <merge-commit>`，保留中文与对应英文的成对回退。
3. 提交普通 PR，运行完整 CI，并检查 Netlify Deploy Preview。
4. 合并后等待 Netlify 发布，再核对中英文页面。

不要直接在 `main` 修改历史，也不要只恢复中文或只恢复英文。若目标提交之后还有其他内容更新，应先检查 revert diff，避免连带覆盖后续修改。
