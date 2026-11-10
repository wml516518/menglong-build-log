# Chinese-first CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner edit only Chinese portfolio content at `/admin`, automatically generate versioned English content with DeepSeek, and publish through protected GitHub checks to Netlify.

**Architecture:** The Vite application loads validated YAML and localized Markdown from `content/{zh,en}` while preserving its current `content[language]` and post APIs. Decap Turbo writes Chinese source changes to `cms/*` pull requests; a privileged `workflow_run` uses only trusted default-branch code to translate PR content as data, pushes generated English, and enables GitHub auto-merge after ordinary secret-free CI passes.

**Tech Stack:** React 19, Vite 5, TypeScript 5.6, Vitest, YAML, gray-matter, Zod, unified/remark, Decap CMS Turbo, DeepSeek Chat Completions JSON output, GitHub Actions, Netlify.

**Spec:** `docs/superpowers/specs/2026-11-10-chinese-first-cms-design.md`

## Global Constraints

- Chinese under `content/zh/**` is the only human-maintained source; `content/en/**` is generated and cannot be edited in `/admin`.
- Preserve `content[language]`, `getPosts(language)`, and `getPost(language, slug)` as the public application interfaces.
- English remains the first-visit default; the existing persisted language switch remains functional.
- History Galaxy events, 3D configuration, interactions, and route metadata remain code-managed; only its portfolio promotional card copy is editable.
- `homeSectionOrder` contains each of `buildLog`, `projects`, `resume`, `experience`, `resumeProjects`, `about`, and `contact` exactly once.
- No browser bundle or Netlify build may call DeepSeek or contain `DEEPSEEK_API_KEY`.
- Privileged automation must never execute code, package scripts, or configuration checked out from a CMS pull request.
- DeepSeek is mocked in tests; routine CI consumes no model quota.
- A CMS failure must leave `main` and the current Netlify production deployment unchanged.

---

## File Structure

### Content and application

- Create `content/zh/site.yml`: Chinese profile, labels, ordering, cards, contacts, media paths, and portfolio metadata.
- Create `content/zh/resume.yml`: Chinese resume and all ordered resume lists.
- Create `content/en/site.yml`: generated English site mirror with `_translation` metadata.
- Create `content/en/resume.yml`: generated English resume mirror with `_translation` metadata.
- Move `src/posts/*.zh.md` to `content/zh/posts/*.md`.
- Move `src/posts/*.en.md` to `content/en/posts/*.md` and add generated metadata.
- Create `src/content/schema.ts`: Zod schemas, exported content types, section ID validation, and translation metadata stripping.
- Create `src/content/load.ts`: raw YAML parsing and typed document assembly.
- Modify `src/content.ts`: retain language persistence and expose data loaded from YAML.
- Modify `src/posts.ts`: load localized folders, validate draft/media/generated metadata, and hide drafts.
- Create `src/components/PortfolioHome.tsx`: render the fixed home sections in validated CMS order.
- Modify `src/PortfolioApp.tsx`: consume loaded headings and delegate ordered home rendering.
- Modify `src/metadata.ts`: consume localized portfolio metadata while preserving History Galaxy metadata.
- Modify Build Log components and `src/styles.css`: render optional cover images without layout shift.

### CMS

- Create `public/admin/index.html`: Decap CMS entry point.
- Create `public/admin/config.yml`: Turbo backend and Chinese-only collections.
- Create `public/uploads/.gitkeep`: repository-backed media directory.
- Create `src/admin-config.test.ts`: ensure the CMS cannot edit English or code paths.

### Translation

- Create `config/translation-glossary.yml`: protected terms and preferred translations.
- Create `scripts/translation/types.ts`: shared translation segment and adapter interfaces.
- Create `scripts/translation/fields.ts`: explicit site/resume segment collection and restoration.
- Create `scripts/translation/markdown.ts`: Markdown AST segment collection and restoration.
- Create `scripts/translation/deepseek.ts`: JSON-output API adapter and bounded retry.
- Create `scripts/translation/hash.ts`: normalized source and policy hashing.
- Create `scripts/translation/files.ts`: localized path mapping and generated file serialization.
- Create `scripts/translation/translate-content.ts`: changed-file orchestration and CLI.
- Create `scripts/translation/check-generated.ts`: no-network parity validator used by CI.
- Add focused `*.test.ts` files beside those modules.

### Publication automation and operations

- Create `scripts/cms/validate-scope.ts`: pure actor, branch, repository, and path guard.
- Create `scripts/cms/validate-scope.test.ts`: allow/deny matrix.
- Create `.github/workflows/cms-publish.yml`: trusted `workflow_run` translation and auto-merge workflow.
- Modify `.github/workflows/ci.yml`: validate source/generated content before test/build.
- Modify `package.json` and `package-lock.json`: dependencies and content commands.
- Create `docs/cms-operations.md`: editing, secrets, failure recovery, and key rotation.
- Modify `README.md`: link the admin and operations guide.

---

### Task 1: Define and test the content contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/content/schema.ts`
- Create: `src/content/schema.test.ts`

**Interfaces:**
- Produces: `Language`, `HomeSectionId`, `SiteDocument`, `ResumeDocument`, `SiteContent`, `TranslationMetadata`.
- Produces: `parseSiteDocument(value, path)`, `parseResumeDocument(value, path)`, `stripTranslationMetadata(document)`.
- Consumes: none; this is the shared contract for the browser loader and trusted translation scripts.

- [ ] **Step 1: Install the runtime and script dependencies**

Run:

```bash
npm install zod unified remark-parse remark-stringify unist-util-visit
npm install --save-dev tsx @types/node
```

Expected: `package.json` and `package-lock.json` contain the new dependencies without changing existing React, Vite, Three.js, or test versions.

- [ ] **Step 2: Write failing schema tests**

Create `src/content/schema.test.ts` with representative valid documents and these exact assertions:

```ts
import {
  homeSectionIds,
  parseResumeDocument,
  parseSiteDocument,
  stripTranslationMetadata
} from './schema';

const validSite = {
  nav: { projects: '项目', buildLog: '构建日志', resume: '简历', about: '关于', contact: '联系' },
  profile: {
    name: 'MengLong Wang', role: '全栈工程师', eyebrow: '作品集', headline: '构建产品',
    intro: '记录产品与工程实践。', primaryAction: '查看项目', secondaryAction: '阅读日志',
    avatar: '', resumeDownload: ''
  },
  sections: {
    projects: '项目', buildLog: '构建日志', resume: '简历', about: '关于', contact: '联系',
    latestBuildLog: '最新日志', allPosts: '全部文章', backToPosts: '返回文章',
    postNotFound: '未找到文章', readArticle: '阅读文章', tags: '标签', education: '教育经历',
    skills: '技术栈', certifications: '资格证书', languages: '语言能力',
    experience: '工作经历', selectedProjects: '项目经验'
  },
  about: '专注全栈与 AI 产品。',
  homeSectionOrder: ['buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about', 'contact'],
  historyGalaxy: {
    title: '历史星河', status: '交互式 3D 作品', summary: '探索中国历史。',
    stack: ['Three.js'], action: '进入星河', imageAlt: '历史时间轴'
  },
  projects: [{
    title: '个人主页', status: '已上线', summary: '双语作品集。', stack: ['React'],
    githubUrl: 'https://github.com/wml516518/menglong-build-log',
    liveUrl: 'https://menglong-build-log.netlify.app'
  }],
  contact: [{ label: '邮箱', value: 'wml565868@gmail.com', href: 'mailto:wml565868@gmail.com' }],
  seo: {
    homeTitle: 'MengLong Wang | 作品集', buildLogTitle: '构建日志 | MengLong Wang',
    description: '个人主页、项目作品和构建日志。', socialImage: ''
  }
};

const validResume = {
  basics: {
    name: { label: '姓名', value: '王梦龙' }, gender: { label: '性别', value: '男' },
    birthDate: { label: '出生日期', value: '1993.12.28' },
    location: { label: '所在地', value: '中国上海' },
    email: { label: '邮箱', value: 'wml565868@gmail.com' },
    github: { label: 'GitHub', value: 'github.com/wml516518' },
    role: { label: '方向', value: '全栈开发工程师' }
  },
  summary: '专注可落地的全栈与 AI 产品。',
  education: [{ school: '河南财政金融学院', detail: '计算机软件，2013.09 - 2016.06' }],
  experience: [{ company: '上汽海外出行科技有限公司', role: '全栈工程师', period: '2025.07 - 至今', highlights: ['负责车载 AI Agent。'] }],
  projects: [{ name: '谷歌 AAA', period: '2025.07 - 至今', description: '车载 AI Agent。', highlights: ['覆盖车控能力。'], stack: ['Google AAA'] }],
  skills: [{ group: '前端', items: ['React'] }],
  certifications: ['软件设计师'],
  languages: ['英语：读写良好']
};

describe('content schema', () => {
  it('accepts the complete site and resume documents', () => {
    expect(parseSiteDocument(validSite, 'site.yml').homeSectionOrder).toEqual(homeSectionIds);
    expect(parseResumeDocument(validResume, 'resume.yml').experience[0].company).toBe('上汽海外出行科技有限公司');
  });

  it.each([
    ['duplicate', ['buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about', 'about']],
    ['missing', ['buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about']],
    ['unknown', ['buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about', 'other']]
  ])('rejects a %s homepage section order', (_, homeSectionOrder) => {
    expect(() => parseSiteDocument({ ...validSite, homeSectionOrder }, 'site.yml')).toThrow('site.yml');
  });

  it('reports a precise required-field path', () => {
    expect(() => parseResumeDocument({ ...validResume, summary: '' }, 'resume.yml')).toThrow('resume.yml: summary');
  });

  it('strips generated translation metadata', () => {
    expect(stripTranslationMetadata({ ...validSite, _translation: { sourceHash: 'abc', policyVersion: 1 } }))
      .not.toHaveProperty('_translation');
  });
});
```

- [ ] **Step 3: Run the schema test and confirm it fails**

Run: `npm test -- src/content/schema.test.ts`

Expected: FAIL because `src/content/schema.ts` does not exist.

- [ ] **Step 4: Implement the shared schemas**

Implement `src/content/schema.ts` with strict Zod objects. Export the following stable values and signatures:

```ts
export const languages = ['en', 'zh'] as const;
export type Language = (typeof languages)[number];

export const homeSectionIds = [
  'buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about', 'contact'
] as const;
export type HomeSectionId = (typeof homeSectionIds)[number];

export type TranslationMetadata = { sourceHash: string; policyVersion: number };
export type SiteDocument = z.infer<typeof siteDocumentSchema>;
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;
export type SiteContent = Omit<SiteDocument, '_translation'> & { resume: Omit<ResumeDocument, '_translation'> };

export function parseSiteDocument(value: unknown, path: string): SiteDocument;
export function parseResumeDocument(value: unknown, path: string): ResumeDocument;
export function stripTranslationMetadata<T extends { _translation?: TranslationMetadata }>(value: T): Omit<T, '_translation'>;
```

Use `.strict()` at every object boundary, `z.string().trim().min(1)` for required copy, URL validation for HTTP project links, an `href` union that accepts `https:`, `http:`, and `mailto:`, optional empty-string media fields, and a `superRefine` that checks the exact homepage section set. Format parse errors as `<path>: <dot.path> <message>`.

- [ ] **Step 5: Run focused tests and type checking**

Run:

```bash
npm test -- src/content/schema.test.ts
npm run build
```

Expected: PASS. The production build still uses the old inline content at this point.

- [ ] **Step 6: Commit the content contract**

```bash
git add package.json package-lock.json src/content/schema.ts src/content/schema.test.ts
git commit -m "feat: define editable content schema"
```

---

### Task 2: Migrate site and resume copy to YAML without visual changes

**Files:**
- Create: `content/zh/site.yml`
- Create: `content/zh/resume.yml`
- Create: `content/en/site.yml`
- Create: `content/en/resume.yml`
- Create: `src/content/load.ts`
- Create: `src/content/load.test.ts`
- Create: `src/content/test-fixtures.ts`
- Create: `src/components/PortfolioHome.tsx`
- Modify: `src/content.ts`
- Modify: `src/PortfolioApp.tsx`
- Modify: `src/metadata.ts`
- Modify: `src/metadata.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/content.test.ts`

**Interfaces:**
- Consumes: schemas from Task 1.
- Produces: `loadSiteContent(sitePath, siteYaml, resumePath, resumeYaml): SiteContent`.
- Preserves: `content: Record<Language, SiteContent>`, `getInitialLanguage()`, `saveLanguage()`.
- Produces: `PortfolioHome({ copy, posts })`, where section order comes only from validated `copy.homeSectionOrder`.

- [ ] **Step 1: Write failing YAML loader and ordering tests**

Create `src/content/load.test.ts`:

```ts
import { dump } from 'js-yaml';
import { loadSiteContent } from './load';

it('assembles site and resume documents and removes generated metadata', () => {
  const site = loadSiteContent(
    'content/en/site.yml',
    dump({ ...validSiteFixture, _translation: { sourceHash: 'abc', policyVersion: 1 } }),
    'content/en/resume.yml',
    dump({ ...validResumeFixture, _translation: { sourceHash: 'def', policyVersion: 1 } })
  );
  expect(site.profile.name).toBe('MengLong Wang');
  expect(site.resume.summary).toBe(validResumeFixture.summary);
  expect(site).not.toHaveProperty('_translation');
  expect(site.resume).not.toHaveProperty('_translation');
});

it('includes the source path in invalid YAML errors', () => {
  expect(() => loadSiteContent('content/zh/site.yml', 'profile: [', 'content/zh/resume.yml', '{}'))
    .toThrow('content/zh/site.yml');
});
```

Move the shared valid objects from Task 1 into `src/content/test-fixtures.ts` so schema and loader tests import the same fixtures instead of duplicating them.

Add an `App.test.tsx` assertion that a deliberately reordered fixture renders section headings in `homeSectionOrder`. Use `compareDocumentPosition` rather than pixel positions.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm test -- src/content/load.test.ts src/App.test.tsx`

Expected: FAIL because the YAML loader and ordered home renderer do not exist.

- [ ] **Step 3: Extract the current content exactly**

Split the current `content.zh` and `content.en` objects as follows:

- `site.yml`: `nav`, `profile`, `sections`, `about`, `historyGalaxy`, `projects`, `contact`, `seo`, and `homeSectionOrder`.
- `resume.yml`: the complete current `resume` value.
- Add section labels currently hard-coded in `PortfolioApp.tsx`: `education`, `skills`, `certifications`, `languages`, `experience`, and `selectedProjects`.
- Add the current portfolio titles and description from `src/metadata.ts` to `seo`.
- Set both languages' initial `homeSectionOrder` to `buildLog`, `projects`, `resume`, `experience`, `resumeProjects`, `about`, `contact` so the rendered order is unchanged.
- Preserve every current work highlight, resume project, skill, contact, URL, stack entry, and History Galaxy promotional string.
- Initially leave `avatar`, `resumeDownload`, and `socialImage` as empty strings; optional rendering must not add empty elements.
- Add `_translation.sourceHash` and `_translation.policyVersion: 1` only to English files. The initial hashes are produced in Task 6; until then use the current English copy and omit `_translation` rather than inventing a hash.

- [ ] **Step 4: Implement the YAML loader and retain the public API**

Use Vite raw imports and `js-yaml` safe parsing:

```ts
import siteEn from '../content/en/site.yml?raw';
import resumeEn from '../content/en/resume.yml?raw';
import siteZh from '../content/zh/site.yml?raw';
import resumeZh from '../content/zh/resume.yml?raw';
import { loadSiteContent } from './content/load';

export const content = {
  en: loadSiteContent('content/en/site.yml', siteEn, 'content/en/resume.yml', resumeEn),
  zh: loadSiteContent('content/zh/site.yml', siteZh, 'content/zh/resume.yml', resumeZh)
} satisfies Record<Language, SiteContent>;
```

Keep `isLanguage`, `getInitialLanguage`, and `saveLanguage` behavior unchanged. Re-export `Language`, `SiteContent`, and `FeaturedProject` from the schema module so existing imports remain valid.

- [ ] **Step 5: Render fixed sections in CMS order**

Move the home-only markup from `PortfolioApp.tsx` into `src/components/PortfolioHome.tsx`. Keep the header, hero, Build Log routes, and article routes in `PortfolioApp.tsx`. Implement an exhaustive renderer:

```tsx
const sectionRenderers: Record<HomeSectionId, () => ReactNode> = {
  buildLog: renderBuildLog,
  projects: renderProjects,
  resume: renderResume,
  experience: renderExperience,
  resumeProjects: renderResumeProjects,
  about: renderAbout,
  contact: renderContact
};

return <>{copy.homeSectionOrder.map((id) => <Fragment key={id}>{sectionRenderers[id]()}</Fragment>)}</>;
```

Replace all language ternaries for subsection headings with `copy.sections.*`. Render `profile.avatar` with fixed dimensions and meaningful alt text only when non-empty. Render `profile.resumeDownload` as a download link beside existing hero actions only when non-empty.

- [ ] **Step 6: Localize portfolio metadata from content**

Change the metadata API to:

```ts
export function getRouteMetadata(route: Route, language: Language): RouteMetadata;
export function applyRouteMetadata(route: Route, language: Language): void;
```

Portfolio routes use `content[language].seo`; History Galaxy continues to return its current code-owned Chinese title, description, and theme color. Apply portfolio metadata from a `PortfolioApp` effect keyed by `route` and `language`. Apply History Galaxy metadata from `App` when that route is active. Set or remove `meta[property="og:image"]` only when `socialImage` is non-empty.

- [ ] **Step 7: Run content, application, and production checks**

Run:

```bash
npm test -- src/content/schema.test.ts src/content/load.test.ts src/content.test.ts src/metadata.test.ts src/App.test.tsx
npm test
npm run build
```

Expected: all existing visible-copy assertions still pass; the default English page, Chinese switch, History Galaxy route, and home section order remain correct.

- [ ] **Step 8: Commit the content migration**

```bash
git add content src/content.ts src/content src/components/PortfolioHome.tsx src/PortfolioApp.tsx src/metadata.ts src/metadata.test.ts src/App.test.tsx src/content.test.ts
git commit -m "feat: load portfolio content from yaml"
```

---

### Task 3: Move Build Log content and add draft/media support

**Files:**
- Move: `src/posts/*.zh.md` -> `content/zh/posts/*.md`
- Move: `src/posts/*.en.md` -> `content/en/posts/*.md`
- Modify: `src/posts.ts`
- Modify: `src/posts.test.ts`
- Modify: `src/components/BuildLogPreview.tsx`
- Modify: `src/components/BuildLogIndex.tsx`
- Modify: `src/components/BuildLogArticle.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces: `parsePostFile(path, source): BuildLogPost`, deriving language from `content/<language>/posts/`.
- Extends: `BuildLogPost` with `draft: boolean` and `coverImage?: string`.
- Preserves: `getPosts(language)` and `getPost(language, slug)` while excluding drafts.

- [ ] **Step 1: Update post tests first**

Change `validSource` so front matter contains `draft: false` and `coverImage: /uploads/example.webp`, but no `language`. Add:

```ts
it('derives language from the localized folder and hides drafts', () => {
  const files = {
    '/content/en/posts/public.md': validSource.replace('slug: example', 'slug: public'),
    '/content/en/posts/draft.md': validSource
      .replace('slug: example', 'slug: draft')
      .replace('draft: false', 'draft: true')
  };
  const collection = createPostCollection(files);
  expect(collection.map((post) => [post.language, post.slug, post.draft])).toEqual([
    ['en', 'draft', true],
    ['en', 'public', false]
  ]);
  expect(filterPublishedPosts(collection, 'en').map((post) => post.slug)).toEqual(['public']);
});

it('rejects a language outside content/en or content/zh', () => {
  expect(() => parsePostFile('/content/fr/posts/example.md', validSource)).toThrow('invalid localized post path');
});
```

Add an application test proving a draft title is absent from both the list and direct `#/build-log/<slug>` rendering.

- [ ] **Step 2: Run the post and application tests and confirm failure**

Run: `npm test -- src/posts.test.ts src/App.test.tsx`

Expected: FAIL because paths, draft state, and cover images are not supported.

- [ ] **Step 3: Move and normalize the Markdown files**

Use `git mv` for all six current files. Remove `language` from front matter, add `draft: false`, and add `coverImage: ''` when no image exists. Do not alter article title, summary, tags, related project, body, date, or slug.

- [ ] **Step 4: Implement localized loading and draft filtering**

Load with:

```ts
const markdownFiles = import.meta.glob('../content/{en,zh}/posts/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;
```

Derive language using the anchored pattern `/\/content\/(en|zh)\/posts\/[^/]+\.md$/`. Parse `_translation` as optional generated metadata and strip it from the public post. Export:

```ts
export function filterPublishedPosts(posts: BuildLogPost[], language: Language): BuildLogPost[];
```

Have both public selectors use `!post.draft`. A direct draft slug must return `undefined`.

- [ ] **Step 5: Render optional cover media with stable dimensions**

Add an image only for non-empty `coverImage`. Use an aspect-ratio container, `loading="lazy"` on index/preview images, descriptive alt text based on the article title, and no nested cards. Add responsive CSS that cannot shift title or navigation layout.

- [ ] **Step 6: Verify and commit the post migration**

Run:

```bash
npm test -- src/posts.test.ts src/App.test.tsx
npm test
npm run build
```

Then commit:

```bash
git add content src/posts src/posts.ts src/posts.test.ts src/components src/styles.css src/App.test.tsx
git commit -m "feat: manage localized build log content"
```

---

### Task 4: Add the Chinese-only Decap CMS

**Files:**
- Create: `public/admin/index.html`
- Create: `public/admin/config.yml`
- Create: `public/uploads/.gitkeep`
- Create: `src/admin-config.test.ts`

**Interfaces:**
- Consumes: content paths and fields from Tasks 1-3.
- Produces: `/admin` with `site`, `resume`, and `posts` collections.
- External dependency: the exact Decap Turbo site UUID created for `wml516518/menglong-build-log`.

- [ ] **Step 1: Write a failing configuration safety test**

Create a Node-environment test that loads `public/admin/config.yml` with `js-yaml` and asserts:

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

it('edits only Chinese source content', () => {
  const config = load(readFileSync('public/admin/config.yml', 'utf8')) as CmsConfig;
  expect(config.backend.name).toBe('turbo-github');
  expect(config.backend.branch).toBe('main');
  expect(config.publish_mode).toBe('editorial_workflow');
  expect(config.locale).toBe('zh_Hans');
  expect(config.media_folder).toBe('public/uploads');
  expect(config.public_folder).toBe('/uploads');
  expect(JSON.stringify(config.collections)).not.toContain('content/en');
  expect(config.collections.map((item) => item.name)).toEqual(['site', 'resume', 'posts']);
  expect(config.collections.every((item) => item.publish === false)).toBe(true);
});
```

Also recursively collect all `file` and `folder` properties and assert they are exactly `content/zh/site.yml`, `content/zh/resume.yml`, and `content/zh/posts`.

- [ ] **Step 2: Run the safety test and confirm failure**

Run: `npm test -- src/admin-config.test.ts`

Expected: FAIL because the config is absent.

- [ ] **Step 3: Create the Decap Turbo site and record its real UUID**

In Decap Turbo:

1. Sign in with the owner's GitHub account.
2. Install the Turbo GitHub App for only `wml516518/menglong-build-log`.
3. Create one site for branch `main` and config path `public/admin/config.yml`.
4. Add the production admin origin and the Netlify preview origin anchored to this site's exact Netlify subdomain.
5. Copy the returned site UUID directly into `backend.turbo_site_id`.

Do not commit a sample or placeholder UUID. The step is complete only when `turbo_site_id` matches `^[0-9a-f]{8}-[0-9a-f-]{27,}$` and Turbo recognizes the repository.

- [ ] **Step 4: Create the CMS entry point and complete collection configuration**

`public/admin/index.html` loads the stable Decap CMS 3 script and contains no application keys:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>梦龙主页内容管理</title>
  </head>
  <body>
    <script src="https://cdn.jsdelivr.net/npm/decap-cms@^3.0.0/dist/decap-cms.js"></script>
  </body>
</html>
```

Configure `public/admin/config.yml` with:

- `backend.name: turbo-github`, the real site UUID, and `branch: main`.
- `publish_mode: editorial_workflow`, `locale: zh_Hans`, and ASCII slug rules.
- `media_folder: public/uploads`, `public_folder: /uploads`.
- A `site` file collection matching every `site.yml` field. `homeSectionOrder` is a required list of select widgets whose options are the seven fixed IDs.
- A `resume` file collection matching every nested resume field; lists are reorderable and required.
- A `posts` folder collection at `content/zh/posts`, `create: true`, front matter format, `slug: '{{fields.slug}}'`, and fields for `slug`, `date`, `draft`, `title`, `summary`, `tags`, `relatedProject`, `coverImage`, and Markdown `body`.
- `delete: false` for singleton site/resume files. Post deletion remains enabled.
- `publish: false` on all three collections so Decap can create/update content PRs but cannot merge untranslated content directly; saving is the single owner action and the trusted workflow publishes it.
- Chinese labels and concise field hints; do not expose `_translation` anywhere.

- [ ] **Step 5: Verify the static admin surface**

Run:

```bash
npm test -- src/admin-config.test.ts
npm run build
test -f dist/admin/index.html
test -f dist/admin/config.yml
```

Start the app with `npm run dev -- --host 127.0.0.1`, open `/admin/`, and confirm the CMS shell loads without a blank page. Login can be deferred until the production/preview origin exists.

- [ ] **Step 6: Commit the CMS surface**

```bash
git add public/admin public/uploads/.gitkeep src/admin-config.test.ts
git commit -m "feat: add chinese portfolio cms"
```

---

### Task 5: Build deterministic structured and Markdown translation primitives

**Files:**
- Create: `config/translation-glossary.yml`
- Create: `scripts/translation/types.ts`
- Create: `scripts/translation/fields.ts`
- Create: `scripts/translation/fields.test.ts`
- Create: `scripts/translation/markdown.ts`
- Create: `scripts/translation/markdown.test.ts`
- Create: `scripts/translation/hash.ts`
- Create: `scripts/translation/hash.test.ts`

**Interfaces:**
- Produces: `TranslationSegment { id: string; text: string; context: string }`.
- Produces: `collectSiteSegments`, `applySiteTranslations`, `collectResumeSegments`, `applyResumeTranslations`.
- Produces: `collectMarkdownSegments(markdown)` and `applyMarkdownTranslations(document, translations)`.
- Produces: `computeSourceHash(source, policyVersion)`.

- [ ] **Step 1: Write failing structured-field policy tests**

Cover translated copy and protected values explicitly:

```ts
it('collects prose but not URLs, IDs, stacks, or ordering', () => {
  const segments = collectSiteSegments(validSiteFixture);
  expect(segments.map((item) => item.id)).toContain('profile.headline');
  expect(segments.map((item) => item.id)).toContain('projects.0.summary');
  expect(segments.map((item) => item.id)).not.toContain('projects.0.githubUrl');
  expect(segments.map((item) => item.id)).not.toContain('projects.0.stack.0');
  expect(segments.map((item) => item.id)).not.toContain('homeSectionOrder.0');
});

it('restores translations without mutating protected values or array shape', () => {
  const translated = applyResumeTranslations(validResumeFixture, new Map([
    ['summary', 'A full-stack engineer focused on practical AI products.'],
    ['experience.0.company', 'SAIC Mobility Technology Co., Ltd.']
  ]));
  expect(translated.experience[0].company).toBe('SAIC Mobility Technology Co., Ltd.');
  expect(translated.experience[0].period).toBe(validResumeFixture.experience[0].period);
  expect(translated.projects[0].stack).toEqual(['Google AAA']);
});
```

- [ ] **Step 2: Write failing Markdown preservation tests**

Use this fixture and assert round-trip structure:

```ts
const markdown = `# 标题

查看 [项目主页](https://example.com?q=中文) 中的 \`ActionID\`。

> 保留引用结构。

\`\`\`ts
const actionId = 'climate.open';
\`\`\`

![架构图](/uploads/architecture.webp)
`;
```

Assert headings, paragraph text, quote text, and image/link labels become segments; URLs, inline code, fenced code, and image destinations do not. After applying English strings, parse again and assert the same node-type sequence and identical protected values.

- [ ] **Step 3: Write failing hash tests**

Assert stable YAML key ordering and newline normalization produce the same SHA-256 hash, while changing Chinese copy or `policyVersion` changes it.

- [ ] **Step 4: Run the translation primitive tests and confirm failure**

Run:

```bash
npm test -- scripts/translation/fields.test.ts scripts/translation/markdown.test.ts scripts/translation/hash.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 5: Implement explicit structured-field adapters**

Never translate by scanning all strings. Enumerate the approved paths from the spec. Use stable positional IDs for ordered arrays and require one returned translation for every collected segment. Throw on missing IDs, extra IDs, changed list lengths, or a protected value mismatch.

Technology stacks and tags are copied exactly. Period strings and dates are copied exactly in version 1 even when Chinese contains `至今`; this avoids date semantics changing automatically. If English period localization is later desired, it requires a policy version change.

- [ ] **Step 6: Implement Markdown AST extraction/restoration**

Use `unified`, `remark-parse`, `remark-stringify`, and `unist-util-visit`. Assign stable IDs by node traversal order and node kind. Translate text under headings, paragraphs, block quotes, list items, link labels, and image alt text. Skip `code`, `inlineCode`, `html`, YAML, URLs, and definitions. Reject a restoration if the protected-node fingerprint changes.

- [ ] **Step 7: Add the versioned glossary and hashing**

Create a policy version and entries including:

```yaml
policyVersion: 1
protected:
  - Google AAA
  - InCarVA
  - ActionID
  - TTS
  - NLU
  - M365
  - FastAPI
  - React
  - Vite
  - TypeScript
preferred:
  上汽海外出行科技有限公司: SAIC Mobility Technology Co., Ltd.
  全栈工程师: Full-stack Engineer
  车载 AI Agent: In-vehicle AI Agent
  构建日志: Build Log
```

Hash normalized parsed content together with the complete glossary and policy version. Do not hash YAML presentation details such as indentation.

- [ ] **Step 8: Verify and commit translation primitives**

Run:

```bash
npm test -- scripts/translation/fields.test.ts scripts/translation/markdown.test.ts scripts/translation/hash.test.ts
npm test
npm run build
```

Then commit:

```bash
git add config/translation-glossary.yml scripts/translation
git commit -m "feat: define deterministic translation policy"
```

---

### Task 6: Implement the DeepSeek adapter and generated-content lifecycle

**Files:**
- Create: `scripts/translation/deepseek.ts`
- Create: `scripts/translation/deepseek.test.ts`
- Create: `scripts/translation/files.ts`
- Create: `scripts/translation/files.test.ts`
- Create: `scripts/translation/translate-content.ts`
- Create: `scripts/translation/translate-content.test.ts`
- Create: `scripts/translation/check-generated.ts`
- Create: `scripts/translation/check-generated.test.ts`
- Modify: `package.json`
- Modify: `content/en/site.yml`
- Modify: `content/en/resume.yml`
- Modify: `content/en/posts/*.md`

**Interfaces:**
- Produces: `createDeepSeekTranslator(options): Translator`.
- Produces: `translateChangedContent({ root, changedPaths, translator, policy }): Promise<TranslationResult>`.
- Produces: CLI commands `content:translate`, `content:validate`, and `content:check-generated`.
- Consumes: schemas and translation primitives from Tasks 1 and 5.

- [ ] **Step 1: Write failing DeepSeek adapter tests with mocked fetch**

Test a valid response, HTTP 429 followed by success, blank JSON content, malformed JSON, missing translation ID, and exhausted retries. The valid request assertion must include:

```ts
expect(JSON.parse(request.init.body as string)).toMatchObject({
  model: 'deepseek-flash',
  thinking: { type: 'disabled' },
  response_format: { type: 'json_object' },
  stream: false
});
expect(request.init.headers).toMatchObject({
  Authorization: 'Bearer test-key',
  'Content-Type': 'application/json'
});
```

The mocked response shape is:

```json
{
  "choices": [{
    "finish_reason": "stop",
    "message": { "content": "{\"translations\":[{\"id\":\"profile.headline\",\"text\":\"Build practical products.\"}]}" }
  }]
}
```

- [ ] **Step 2: Write failing generated-file lifecycle tests**

Use a temporary repository-shaped directory and a fake translator. Cover:

- A changed `content/zh/site.yml` writes only `content/en/site.yml` with `_translation`.
- A current source hash performs zero translator calls and writes nothing.
- A policy-version change regenerates English.
- Creating a Chinese post creates the matching English post.
- Deleting a Chinese post deletes the English counterpart.
- A translator shape mismatch leaves the existing English file untouched.
- `checkGeneratedContent` reports missing, stale, extra, and valid English files without network access.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
npm test -- scripts/translation/deepseek.test.ts scripts/translation/files.test.ts scripts/translation/translate-content.test.ts scripts/translation/check-generated.test.ts
```

Expected: FAIL because the adapter and orchestrator do not exist.

- [ ] **Step 4: Implement the DeepSeek JSON-output boundary**

Use `https://api.deepseek.com/chat/completions`, `deepseek-flash`, disabled thinking, JSON output, and a request timeout. The system prompt must say that output is JSON, require the exact segment IDs, preserve protected glossary terms, and prohibit commentary. Accept only `finish_reason: stop` and a complete `{ translations: { id, text }[] }` payload.

Retry at most three total attempts for 429, 5xx, timeout, blank content, and malformed JSON with bounded delays of 500 ms then 1500 ms. Do not retry 401/403 or a semantic ID mismatch. Error messages may include status and attempt but never the API key or Authorization header.

- [ ] **Step 5: Implement file mapping, atomic writes, and deletion**

Map only these paths:

```text
content/zh/site.yml       -> content/en/site.yml
content/zh/resume.yml     -> content/en/resume.yml
content/zh/posts/<x>.md   -> content/en/posts/<x>.md
```

Reject traversal, symlinks, other extensions, and any path outside the repository root. Serialize YAML with stable key ordering and LF newlines. Write a sibling temporary file, validate it, and rename it over the destination only after all translations pass. Process deletions without calling DeepSeek.

- [ ] **Step 6: Add CLIs and package commands**

Add:

```json
{
  "scripts": {
    "content:validate": "tsx scripts/translation/check-generated.ts --source-only",
    "content:translate": "tsx scripts/translation/translate-content.ts",
    "content:check-generated": "tsx scripts/translation/check-generated.ts"
  }
}
```

The translator requires `DEEPSEEK_API_KEY` only when a stale/new file needs API work. `--all` translates all source documents. `--changed-file <path>` may be repeated and is the only mode used by automation. `--root <absolute-path>` allows trusted base code to process a separate PR checkout as data. A migration-only `--adopt-existing --all` mode validates the current English shape and protected values, adds current hashes without an API call, and refuses to run when any English counterpart is missing.

- [ ] **Step 7: Adopt and review the existing English baseline**

The repository already contains reviewed English copy. Preserve it as the migration baseline without exposing an API key locally:

```bash
npm run content:translate -- --adopt-existing --all
npm run content:check-generated
```

The command may add only `_translation` metadata and stable serialization changes. Compare every English diff with the pre-migration copy. If document shape or protected values differ, correct the Chinese/English migration before adopting it. After this one-time baseline, never use adoption for content publication and never hand-edit `content/en/**`; all subsequent source changes must use DeepSeek.

- [ ] **Step 8: Verify no-key CI behavior and commit**

Unset `DEEPSEEK_API_KEY`, then run:

```bash
npm run content:validate
npm run content:check-generated
npm test
npm run build
```

Expected: all commands PASS without a network request because generated files are current.

Commit:

```bash
git add package.json package-lock.json scripts/translation content/en config/translation-glossary.yml
git commit -m "feat: generate english content with deepseek"
```

---

### Task 7: Add guarded CMS publication and auto-merge automation

**Files:**
- Create: `scripts/cms/validate-scope.ts`
- Create: `scripts/cms/validate-scope.test.ts`
- Create: `.github/workflows/cms-publish.yml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `validateCmsPullRequest(input): { sourcePaths: string[]; generatedPaths: string[]; mediaPaths: string[] }`.
- Consumes: trusted translation CLI from Task 6.
- External contract: workflow `CI` completes, then `CMS Publish` handles same-repository `cms/*` PRs.

- [ ] **Step 1: Write the scope-guard allow/deny matrix**

Create table-driven tests for:

```ts
const valid = {
  baseRepo: 'wml516518/menglong-build-log',
  headRepo: 'wml516518/menglong-build-log',
  headRef: 'cms/posts/portfolio-update',
  author: 'decap-turbo[bot]',
  changedPaths: ['content/zh/posts/portfolio-update.md']
};
```

Allow `wml516518` and `decap-turbo[bot]`. Allow human changes only under `content/zh/**` and `public/uploads/**`; allow `content/en/**` only when an existing generated commit is being rechecked. Reject forks, non-`cms/` branches, other actors, symlinks, absolute paths, `..`, workflows, packages, CMS config, glossary, source code, and Netlify configuration.

- [ ] **Step 2: Run guard tests and confirm failure**

Run: `npm test -- scripts/cms/validate-scope.test.ts`

Expected: FAIL because the guard does not exist.

- [ ] **Step 3: Implement the pure scope guard**

Normalize paths using POSIX rules, reject non-normal inputs before prefix checks, and return sorted groups. Generated English paths must have matching Chinese sources after the PR checkout is available. Export a CLI that accepts a JSON event file and a JSON changed-path file, returning its result as JSON to stdout and errors to stderr.

- [ ] **Step 4: Extend ordinary CI without secrets**

Insert these steps after `npm ci` and before tests:

```yaml
      - name: Validate source content
        run: npm run content:validate

      - name: Verify generated English is current
        run: npm run content:check-generated
```

Keep `permissions: contents: read`, the current test/build steps, and PR/push triggers. Initial Chinese-only CMS commits are expected to fail the generated-content check until `CMS Publish` pushes English; the next CI run must pass.

- [ ] **Step 5: Create the privileged `workflow_run` publisher**

Trigger only after `CI` completes:

```yaml
name: CMS Publish

on:
  workflow_run:
    workflows: [CI]
    types: [completed]

permissions:
  actions: read
  contents: write
  pull-requests: write
```

The job must:

1. Exit unless `head_branch` starts with `cms/` and exactly one open PR matches the workflow run.
2. Check out the default branch into `trusted/` and run `npm ci` only there.
3. Query PR metadata and changed files through `gh api`; run `trusted/scripts/cms/validate-scope.ts` before using either secret.
4. Check out the same-repository PR head into `cms-data/` with `CMS_TRANSLATION_TOKEN`, but never run `npm`, shell scripts, build configuration, or JavaScript from that directory.
5. Run only `trusted/scripts/translation/translate-content.ts --root "$GITHUB_WORKSPACE/cms-data"` with the validated Chinese paths and `DEEPSEEK_API_KEY`.
6. Run the trusted no-network generated check against `cms-data/`.
7. If English changed, commit only `content/en/**`, push to the exact validated head branch, and exit so ordinary CI reruns.
8. If nothing changed and the triggering CI conclusion is `success`, run `gh pr merge --auto --squash` for the validated PR.
9. If nothing changed and CI failed, leave the PR open and fail with a concise diagnostic.

Pass PR number and paths through files or environment variables, never interpolate PR titles, branch names, or filenames directly into shell source. Add workflow concurrency keyed by PR number and cancel older runs.

- [ ] **Step 6: Verify workflows statically and locally**

Run:

```bash
npm test -- scripts/cms/validate-scope.test.ts
npm run content:check-generated
npm test
npm run build
```

Inspect both YAML workflows with `js-yaml`; assert `CMS Publish` uses `workflow_run`, checks out default-branch trusted tools separately, and never runs a command with `working-directory: cms-data` except `git status`, `git add content/en`, `git commit`, and `git push`.

- [ ] **Step 7: Commit publication automation**

```bash
git add scripts/cms .github/workflows/ci.yml .github/workflows/cms-publish.yml
git commit -m "ci: translate and merge trusted cms updates"
```

---

### Task 8: Configure GitHub, document operations, and perform end-to-end acceptance

**Files:**
- Create: `docs/cms-operations.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: working owner-only CMS publication through GitHub and Netlify.
- External configuration: Decap Turbo GitHub App, two GitHub Secrets, auto-merge, branch protection, and Netlify deploy status.

- [ ] **Step 1: Write the operations guide before changing platform settings**

Document:

- Production `/admin` URL and login account.
- Chinese-only editing and the fact that Save creates/updates the publication PR while direct CMS Publish controls are intentionally hidden.
- Expected PR lifecycle: Chinese commit, generated English commit, CI, squash merge, Netlify deploy.
- `DEEPSEEK_API_KEY` and `CMS_TRANSLATION_TOKEN` purposes without recording their values.
- How to recognize and recover from schema, translation, stale-output, CI, and Netlify failures.
- How to rotate both secrets and revoke the fine-grained token.
- How to update the glossary and why English must not be hand-edited.
- How to restore a prior content version with a normal revert PR.

- [ ] **Step 2: Create the fine-grained GitHub token**

Create a token owned by `wml516518`, limited to only `wml516518/menglong-build-log`, with repository Contents read/write and Metadata read. Give it the shortest practical expiration and record the rotation date in a private password manager, not the repository.

Add it without exposing it in terminal history:

```bash
gh secret set CMS_TRANSLATION_TOKEN --repo wml516518/menglong-build-log
```

Paste the token only into the interactive hidden prompt.

- [ ] **Step 3: Add the DeepSeek key securely**

Run:

```bash
gh secret set DEEPSEEK_API_KEY --repo wml516518/menglong-build-log
```

Paste the key only into the hidden prompt. Verify names, not values:

```bash
gh secret list --repo wml516518/menglong-build-log
```

Expected: both secret names are listed and no secret value is printed.

- [ ] **Step 4: Configure repository merge protection**

In repository settings:

1. Enable squash merge and auto-merge; keep automatic branch deletion enabled.
2. Protect `main` with pull requests and require the `test-and-build` check from `CI`.
3. Do not require a human approval for `cms/*` publication, because the user selected one-click automatic publishing.
4. Keep force pushes and deletions disabled.
5. Allow GitHub Actions to create/approve pull requests only if the auto-merge API call requires it for this personal repository.

Confirm a normal non-CMS pull request is not auto-merged by `CMS Publish`.

- [ ] **Step 5: Commit the operations documentation**

```bash
git add docs/cms-operations.md README.md
git commit -m "docs: explain cms publishing operations"
```

- [ ] **Step 6: Run final local verification before review**

Run:

```bash
npm run content:validate
npm run content:check-generated
npm test
npm run build
git status --short
```

Expected: all commands pass and the worktree is clean.

- [ ] **Step 7: Open and merge the implementation pull request**

Push the implementation branch, open a PR to `main`, wait for CI and Netlify preview, review the generated English diff and `/admin` preview, then merge the implementation PR manually. Attach the PR to the Codex task after creation.

- [ ] **Step 8: Perform the real CMS happy-path publication**

On the production `/admin` page:

1. Sign in with the owner account.
2. Change one harmless Chinese sentence, such as the About text, and save it once.
3. Confirm Decap creates a same-repository `cms/*` PR.
4. Confirm `CMS Publish` adds only the matching English generated file.
5. Confirm the second CI run passes and GitHub squash-merges automatically.
6. Confirm Netlify production deploys the merge commit.
7. Open both Chinese and English views and verify the change, navigation, resume, Build Log, and History Galaxy entry.

- [ ] **Step 9: Perform guarded failure acceptance**

Use a temporary CMS draft branch to verify:

- Blank required Chinese copy is rejected by Decap or schema validation.
- A deliberately stale generated hash blocks ordinary CI.
- An attempted out-of-scope file change causes the scope guard to fail and does not enable auto-merge.
- Removing `DEEPSEEK_API_KEY` from a disposable local environment causes a clear translation failure without changing generated files.

Close the test PR without merging and delete its branch after evidence is collected.

- [ ] **Step 10: Verify the production UI and deployment**

Verify production at desktop and mobile widths with Playwright:

- `/admin/` loads the CMS login/editor rather than the portfolio SPA.
- Homepage English and Chinese views render all seven sections in configured order.
- Resume and project content match the YAML source/generated pair.
- Build Log lists exclude drafts and render cover images without overlap.
- History Galaxy still loads, moves, and has nonblank canvas pixels.
- No browser console includes a DeepSeek key or translation request.

Confirm the Netlify production deploy references the automatic CMS merge commit and that GitHub deleted the published `cms/*` branch.

The final handoff reports the production admin URL, implementation PR, test/build results, first automatic content PR, and Netlify deployment commit. It does not report or reproduce either secret value.
