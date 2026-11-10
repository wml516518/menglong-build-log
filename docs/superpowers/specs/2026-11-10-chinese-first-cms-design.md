# Chinese-first CMS and automatic translation design

## Status

Approved in conversation on 2026-11-10.

## Objective

Add a private `/admin` content editor to the existing portfolio so the owner can maintain the public site without editing TypeScript. The editor exposes Chinese content only. Publishing creates and validates English translations automatically, merges the content change through the protected GitHub workflow, and lets the existing Netlify integration deploy `main`.

The implementation must preserve the existing bilingual public site, Build Log routes, resume, portfolio pages, and History Galaxy experience.

## Scope

### In scope

- A Chinese Decap CMS interface at `/admin`.
- GitHub login through Decap Turbo, restricted to the repository and the owner's account.
- Editable profile, homepage copy, navigation labels, section labels and ordering, contacts, homepage project cards, resume, work experience, resume projects, skills, certifications, language ability, SEO copy, images, and Build Log posts.
- Chinese as the only manually maintained source language.
- DeepSeek-based Chinese-to-English generation during publication.
- GitHub pull requests, required checks, automatic merge, and the existing Netlify deployment from `main`.
- Draft article state, image upload, item creation/deletion, and list reordering.

### Out of scope

- Editing layout, colors, animation, React components, or routing from the CMS.
- Editing History Galaxy events, 3D scene settings, interaction behavior, or historical story data.
- Supporting additional editors, public registration, or open authoring.
- Translating at browser runtime.
- Manually editing generated English in the CMS.
- Replacing Netlify or the current GitHub-based deployment.

## Key decisions

1. **Chinese is the source of truth.** All human edits happen under `content/zh/`. Files under `content/en/` are generated artifacts.
2. **Generated English is committed.** The production build does not call an external model. Commits make previews, rollbacks, diffs, and deployments deterministic.
3. **Decap Turbo supplies authentication.** Its GitHub App is installed only for `wml516518/menglong-build-log`, and only the owner receives access to the Turbo site.
4. **Editorial workflow protects `main`.** Decap writes a `cms/*` branch and opens a pull request instead of committing directly to `main`.
5. **Saving is the publication action.** Because this is a single-editor site, collections hide Decap's direct publish control. Saving creates or updates a trusted CMS pull request, which is automatically translated and placed into GitHub auto-merge. No separate manual review step is required, and Decap cannot merge untranslated content directly.
6. **Translation is build-time automation.** DeepSeek credentials exist only in GitHub Actions secrets and are never sent to the browser or committed.

## System architecture

```text
Owner
  |
  | GitHub login
  v
/admin (Decap CMS, Chinese fields only)
  |
  | commit to cms/* and open PR
  v
GitHub pull request
  |-- CMS scope/actor guard
  |-- Chinese schema validation
  |-- DeepSeek translation of changed content
  |-- generated English committed to same PR
  |-- unit tests + TypeScript + production build
  v
GitHub auto-merge -> main
  |
  v
Netlify production deployment
```

The public application remains a static Vite/React site. It imports repository content at build time and has no CMS or translation API in its browser bundle.

## Repository structure

```text
public/
  admin/
    index.html                 # Decap CMS entry point
    config.yml                 # Chinese-only collections and Turbo backend
  uploads/                     # CMS-uploaded public media

content/
  zh/
    site.yml                   # profile, navigation, sections, contacts, cards, SEO
    resume.yml                 # resume and ordered nested lists
    posts/
      <slug>.md                # Chinese Build Log front matter and Markdown
  en/
    site.yml                   # generated English mirror
    resume.yml                 # generated English mirror
    posts/
      <slug>.md                # generated English post

config/
  translation-glossary.yml     # protected terms and preferred translations

scripts/
  translation/
    deepseek.ts                # API boundary with retry and JSON parsing
    fields.ts                  # explicit translatable/non-translatable paths
    markdown.ts                # Markdown AST text extraction and restoration
    translate-content.ts       # changed-file orchestration and output writing

src/
  content.ts                   # browser-facing content loader and language helpers
  content/
    schema.ts                  # shared content types and pure structural validation
    load.ts                    # YAML/Markdown loading helpers
  posts.ts                     # Build Log collection loader
```

`site.yml` and `resume.yml` use Decap list widgets for data that must be added, deleted, and reordered. Separate per-item YAML files are deliberately avoided: nested list widgets make ordering explicit and reduce cross-file consistency work for a single editor.

## Content model

### `content/zh/site.yml`

This file contains:

- Navigation and section labels.
- Profile name, role, eyebrow, headline, introduction, and calls to action.
- About text.
- Homepage project cards with title, status, summary, stack, GitHub URL, and live URL.
- History Galaxy promotional card copy only; its events and interactive experience remain code-managed.
- Contact labels, values, and URLs.
- Route-aware portfolio SEO titles and descriptions.
- Optional avatar, social image, and resume download path.
- `homeSectionOrder`, an ordered list containing each fixed homepage section ID exactly once: `buildLog`, `projects`, `resume`, `experience`, `resumeProjects`, `about`, and `contact`.

The CMS renders `homeSectionOrder` as a reorderable list of fixed options. Validation rejects unknown, duplicate, or missing section IDs. Ordering changes only the existing homepage bands; the CMS cannot create arbitrary components or move the hero/header.

### `content/zh/resume.yml`

This file contains:

- Basic information fields.
- Professional summary.
- Ordered education entries.
- Ordered work-experience entries and highlights.
- Ordered project-experience entries, highlights, and technology stacks.
- Ordered skill groups.
- Certifications and language ability.

The CMS allows add, delete, and drag reordering for each list. Required text fields reject blank values before saving.

### `content/zh/posts/<slug>.md`

Each Build Log article contains YAML front matter followed by Markdown:

```yaml
---
slug: portfolio-homepage
date: 2026-06-05
draft: false
title: 个人主页和公开构建日志
summary: 记录主页、作品、简历和构建过程。
tags:
  - React
  - Vite
relatedProject: 个人主页 + Build Log
coverImage: /uploads/portfolio-homepage.webp
---
```

`slug`, `date`, `draft`, URLs, and image paths are copied rather than translated. A draft remains in the repository but is omitted from production post lists and direct public rendering.

### Generated English metadata

Every generated English file records `sourceHash` and `policyVersion` inside a reserved `_translation` metadata object. The hash covers the normalized Chinese source and translation policy version. Unchanged files with the current hash are skipped, reducing API calls and preventing unrelated English churn. The public loader strips `_translation` before exposing content to React.

## Translation policy

Translation is schema-driven, not based on guessing whether a string looks Chinese.

### Translated

- Navigation, headings, button copy, profile copy, about text, and SEO copy.
- Company, role, school, resume summary, work highlights, project names, descriptions, and project highlights.
- Build Log title, summary, related-project display name, headings, paragraphs, list text, block quotes, and link labels.

### Copied unchanged

- Slugs, IDs, dates, email addresses, URLs, image paths, and numeric values.
- Fixed homepage section IDs and their ordering.
- Technology-stack tokens and tags as entered, such as `React`, `.NET`, `Google AAA`, `InCarVA`, `ActionID`, and `TTS`.
- Inline code, fenced code, HTML, and link destinations inside Markdown.

### Glossary

`config/translation-glossary.yml` stores fixed translations and protected tokens for automotive AI, healthcare, product names, and company names. It is code-reviewed configuration, not a CMS collection, so accidental glossary changes cannot be published from `/admin`.

### Markdown preservation

Markdown is parsed into an abstract syntax tree. Only human-readable text nodes are sent for translation. Code, URLs, formatting markers, and document structure are restored from the original tree. The translation result must preserve the number and identity of protected nodes before a file is written.

### DeepSeek request contract

- Use the non-reasoning chat model through the official HTTPS API.
- Request structured JSON output and validate it before accepting any translation.
- Use low-variance settings and include the glossary plus field context.
- Retry transient network, rate-limit, blank-output, and malformed-JSON failures up to three times with bounded backoff.
- Never log the API key or complete request headers.

## Publication workflow

### 1. CMS save

The owner signs in to `/admin` through Decap Turbo. Decap uses `publish_mode: editorial_workflow`, while every collection sets `publish: false` to hide direct merge controls. Saving creates a branch named under `cms/` and opens or updates a same-repository pull request; trusted automation owns publication from that point.

### 2. Trust and scope guard

Automation proceeds only when all of these conditions hold:

- The pull request head repository equals the base repository.
- The branch starts with `cms/`.
- The pull request originates from the configured Decap Turbo GitHub App or the repository owner.
- Human-authored changes are limited to `content/zh/**` and `public/uploads/**`.
- Generated commits may additionally change `content/en/**`.

Any workflow, application code, CMS configuration, glossary, package, or deployment change in a CMS pull request fails the guard and prevents automatic merge.

### 3. Translation

The translation job compares the pull request with its base, validates Chinese source files, and translates changed or newly created content. Deleting a Chinese post deletes its matching English post. A draft is still translated so its preview is complete, but it remains excluded from production.

The workflow commits generated files back to the same branch using a repository-scoped fine-grained token stored as `CMS_TRANSLATION_TOKEN`. A separate token is required because commits made with the default `GITHUB_TOKEN` do not reliably trigger the next workflow run. The token receives repository contents read/write access only. The workflow's short-lived `GITHUB_TOKEN`, with `pull-requests: write`, separately enables native auto-merge.

### 4. Validation and merge

The generated commit triggers checks again. When translation is already current, the workflow makes no commit. Required checks cover the CMS scope guard, source/generated parity, tests, TypeScript compilation, and the production Vite build.

A trusted workflow enables GitHub native auto-merge with squash strategy. Branch protection keeps the pull request open until every required check passes. Successful merge deletes the `cms/*` branch.

### 5. Deployment

Netlify continues to build `main` with `npm run build` and publish `dist`. No Netlify API token is needed for routine content publication. Netlify deploy previews may be used for inspection, but they are not a required manual gate.

## Secrets and permissions

The repository stores these GitHub Actions secrets:

- `DEEPSEEK_API_KEY`: calls the translation API.
- `CMS_TRANSLATION_TOKEN`: fine-grained GitHub token with repository contents read/write access, used only to push generated English commits and trigger checks.

The Decap Turbo site ID is public configuration and is not treated as a secret. The Turbo GitHub App is installed only on this repository. Turbo admin origins include only the production site, anchored Netlify deploy-preview hosts, and an explicit localhost origin when local CMS testing is needed.

Workflow permissions default to read-only. Individual jobs elevate only the exact `contents` or `pull-requests` permission they need. Translation secrets are never exposed to fork pull requests, Dependabot events, or arbitrary branch names.

## Application changes

The public content API remains `content[language]`, `getPosts(language)`, and `getPost(language, slug)` so components need minimal changes. `src/content.ts` stops containing copy and becomes a typed loader that combines YAML files into the existing `SiteContent` shape. Pure shared types and validation live under `src/content/` so browser loaders and Node translation scripts use one schema. `src/posts.ts` moves its glob to the new localized post folders and excludes drafts in production selectors.

Hard-coded bilingual section headings currently inside `PortfolioApp.tsx` move into `site.yml`. Portfolio route metadata moves from constants in `src/metadata.ts` to localized content. History Galaxy metadata and event data remain code-owned.

The language switch and persisted language preference remain unchanged. English remains the first-visit default unless separately changed in a future request.

## Failure handling

- **Invalid Chinese content:** schema validation fails with a file and field path; no translation or merge occurs.
- **Missing secret:** the translation job fails clearly before making an API request.
- **DeepSeek unavailable or malformed output:** bounded retries run, then the PR remains open and production remains unchanged.
- **Shape mismatch:** generated English is discarded unless its arrays, required fields, protected values, and Markdown structure match the Chinese source.
- **Unexpected CMS file change:** the scope guard fails and auto-merge is not enabled.
- **Stale translation:** source-hash parity fails CI and blocks merge.
- **Build or test failure:** branch protection blocks merge and therefore blocks Netlify production deployment.
- **Partial generated commit:** the next workflow run re-evaluates every changed Chinese file and repairs or rejects the generated set deterministically.

Errors appear in GitHub Actions and the pull request checks. The already deployed site is never modified when a publication fails.

## Testing strategy

### Unit tests

- Validate complete and incomplete `site.yml` and `resume.yml` fixtures.
- Verify homepage section ordering rejects unknown, duplicate, and missing IDs and renders the approved order.
- Verify explicit translated and copied paths.
- Verify glossary protection and restoration.
- Verify Markdown headings, code fences, inline code, links, images, and URLs survive translation.
- Verify source-hash cache hits skip API calls and policy changes invalidate the cache.
- Verify post create, update, draft, and delete behavior.
- Verify generated English preserves source shape and protected values.

DeepSeek is mocked in automated tests; normal CI never spends translation quota.

### Application tests

- Preserve existing English-default and Chinese-switch behavior.
- Render homepage, resume, project, contact, History Galaxy promotional card, Build Log list, and article content from fixtures.
- Confirm draft posts are not publicly listed or rendered.
- Confirm localized metadata is applied to portfolio routes while History Galaxy metadata remains unchanged.

### Workflow tests and acceptance

- Run `npm test` and `npm run build` on every pull request.
- Exercise the translator locally against fixtures with a mock response.
- Verify `/admin` loads the Chinese collections and field validation.
- Publish one harmless Chinese copy change through the real CMS.
- Confirm the PR contains generated English, all required checks pass, GitHub auto-merges it, and Netlify deploys the merged commit.
- Confirm an intentionally invalid CMS fixture and an out-of-scope file change are blocked before release.

## Migration

1. Extract the current Chinese values from `src/content.ts` into `content/zh/site.yml` and `content/zh/resume.yml` without changing rendered copy.
2. Move Chinese posts into `content/zh/posts/` and generate their English counterparts from the approved Chinese source.
3. Compare the newly generated English with the current English and update the glossary/prompt where important product or resume terminology regresses.
4. Switch the application loaders while preserving their public interfaces.
5. Add `/admin`, translation automation, scope guard, and auto-merge automation.
6. Configure Turbo, repository secrets, auto-merge, and required checks.
7. Complete the real CMS-to-Netlify acceptance publication.

The migration uses content parity tests to ensure adding the CMS does not silently remove current homepage, resume, project, or Build Log material.

## Operational notes

- The owner edits Chinese at `/admin`; no local development environment is required for routine content work.
- A save creates or updates a content PR. The site changes only after translation and all checks pass.
- Failed publications are repaired by correcting the Chinese entry and saving again; no production rollback is needed because the failed PR never merged.
- Existing Git history remains the audit log for every content change and generated translation.
- API cost scales with changed files rather than the whole site because source hashes skip current translations.

## Documentation references

- [Decap Turbo connection](https://decapcms.org/docs/turbo-connecting-a-site/)
- [Decap editorial workflow](https://decapcms.org/docs/editorial-workflows/)
- [Decap configuration options](https://decapcms.org/docs/configuration-options/)
- [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
