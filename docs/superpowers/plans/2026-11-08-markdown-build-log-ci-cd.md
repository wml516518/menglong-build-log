# Markdown Build Log and CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static Build Log records with bilingual Markdown articles and enable tested GitHub-to-Netlify continuous deployment.

**Architecture:** Vite imports raw Markdown files at build time. A typed content module validates front matter, sorts and selects localized articles, while three focused React components render preview, index, and detail views through a small hash router. GitHub Actions remains the CI gate; Netlify Git integration handles production and preview deployment.

**Tech Stack:** React 19, TypeScript, Vite 5, Vitest, React Testing Library, gray-matter, react-markdown, GitHub Actions, Netlify.

**Spec:** `docs/superpowers/specs/2026-11-08-markdown-build-log-ci-cd-design.md`

## Global Constraints

- Keep profile, resume, projects, navigation, and contact data in `src/content.ts`.
- Store Build Log articles in `src/posts/` as bilingual Markdown pairs.
- Use hash routes; do not add a general routing library.
- Do not enable raw HTML in Markdown.
- Keep the existing visual direction and responsive behavior.
- Do not modify or commit `assets/` or `nas-frp-setup/`.
- Keep the full public resume fields and do not add a license.

---

### Task 1: Typed Markdown Article Pipeline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/posts.ts`
- Create: `src/posts.test.ts`
- Create: `src/markdown.d.ts`

**Interfaces:**
- Produces: `BuildLogPost`, `parsePostFile(path, source)`, `createPostCollection(files)`, `getPosts(language)`, and `getPost(language, slug)`.
- `BuildLogPost` contains `slug`, `language`, `date`, `title`, `summary`, `tags`, `relatedProject`, and `body`.

- [ ] **Step 1: Install Markdown dependencies**

Run: `npm install gray-matter react-markdown`

Expected: `package.json` and `package-lock.json` include pinned compatible dependency ranges.

- [ ] **Step 2: Write failing parser and collection tests**

Create `src/posts.test.ts` with literal fixtures proving:

```ts
expect(parsePostFile('/posts/example.en.md', validSource)).toMatchObject({
  slug: 'example',
  language: 'en',
  date: '2026-06-05',
  title: 'Example'
});
expect(() => parsePostFile('/posts/broken.md', missingTitle)).toThrow(
  '/posts/broken.md: missing or invalid title'
);
expect(createPostCollection(files).map((post) => post.slug)).toEqual(['newer', 'older']);
expect(() => createPostCollection(duplicates)).toThrow('duplicate post: en/example');
```

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- src/posts.test.ts`

Expected: FAIL because `src/posts.ts` does not exist.

- [ ] **Step 4: Implement the parser and collection**

Use `gray-matter` to parse front matter. Validate every required field, validate ISO dates and `language`, reject empty tags, then sort newest-first with slug as a deterministic tie breaker. Load production files with:

```ts
const markdownFiles = import.meta.glob('./posts/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;
```

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm test -- src/posts.test.ts`

Expected: all article pipeline tests pass.

### Task 2: Migrate Existing Build Log Content

**Files:**
- Create: `src/posts/portfolio-homepage.en.md`
- Create: `src/posts/portfolio-homepage.zh.md`
- Create: `src/posts/ai-chat-playground.en.md`
- Create: `src/posts/ai-chat-playground.zh.md`
- Create: `src/posts/knowledgeops-rag.en.md`
- Create: `src/posts/knowledgeops-rag.zh.md`
- Modify: `src/content.ts`
- Modify: `src/content.test.ts`

**Interfaces:**
- Consumes: the front matter contract from Task 1.
- Produces: three complete bilingual article pairs; `content.ts` retains localized UI labels but no article records.

- [ ] **Step 1: Update content tests first**

Change `src/content.test.ts` so it verifies localized Build Log controls such as `allPosts`, `backToPosts`, and `postNotFound`, without asserting article storage in `content.ts`.

- [ ] **Step 2: Run the content test and verify RED**

Run: `npm test -- src/content.test.ts`

Expected: FAIL because the new labels do not exist.

- [ ] **Step 3: Add six Markdown files and localized controls**

Each English/Chinese pair uses the same slug and date. Content must describe only repository-backed facts: the bilingual portfolio architecture, AI Chat Playground plan, and KnowledgeOps RAG implementation plan. Remove `BuildLogEntry` and `buildLogs` from `content.ts`.

- [ ] **Step 4: Run data tests and build**

Run: `npm test -- src/posts.test.ts src/content.test.ts && npm run build`

Expected: tests pass and Vite imports all six Markdown files.

### Task 3: Build Log Components and Hash Navigation

**Files:**
- Create: `src/components/BuildLogPreview.tsx`
- Create: `src/components/BuildLogIndex.tsx`
- Create: `src/components/BuildLogArticle.tsx`
- Create: `src/routes.ts`
- Create: `src/routes.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- `parseHash(hash)` returns `{ view: 'home' }`, `{ view: 'posts' }`, or `{ view: 'post'; slug: string }`.
- Components consume `BuildLogPost[]`, `Language`, and localized labels; they do not load files directly.

- [ ] **Step 1: Write failing route tests**

Assert literal mappings:

```ts
expect(parseHash('#/build-log')).toEqual({ view: 'posts' });
expect(parseHash('#/build-log/knowledgeops-rag')).toEqual({
  view: 'post',
  slug: 'knowledgeops-rag'
});
expect(parseHash('#projects')).toEqual({ view: 'home' });
```

- [ ] **Step 2: Run route tests and verify RED**

Run: `npm test -- src/routes.test.ts`

Expected: FAIL because `src/routes.ts` does not exist.

- [ ] **Step 3: Implement the minimal hash parser**

Decode slugs safely; malformed encoding falls back to the posts index.

- [ ] **Step 4: Add failing application behavior tests**

Extend `src/App.test.tsx` to verify:

- “All posts” changes the hash and renders all localized article titles.
- Opening an article renders Markdown headings and a back link.
- An unknown slug renders the localized not-found state.
- Switching language on a known slug renders the translated article.

- [ ] **Step 5: Run application tests and verify RED**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the new views and links are missing.

- [ ] **Step 6: Implement components and App view selection**

Use a `hashchange` listener in `App.tsx`. `BuildLogArticle` renders `ReactMarkdown` with raw HTML disabled and an external link renderer using `target="_blank" rel="noreferrer"`.

- [ ] **Step 7: Run component tests and verify GREEN**

Run: `npm test -- src/routes.test.ts src/App.test.tsx`

Expected: all navigation and rendering tests pass.

### Task 4: Integrate Styling, Metadata, and Documentation

**Files:**
- Modify: `src/styles.css`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `netlify.toml`

**Interfaces:**
- Produces responsive index/detail layouts without changing the existing design language.

- [ ] **Step 1: Add focused article styles**

Style article metadata, tags, body headings, code, links, lists, and mobile layout. Reuse existing colors, spacing, borders, and typography.

- [ ] **Step 2: Add stable site metadata**

Add canonical description, theme color, Open Graph title/description/type, and language-neutral document metadata to `index.html`.

- [ ] **Step 3: Document authoring and deployment**

Document the Markdown front matter format, hash URLs, GitHub Actions CI, Netlify Git deployment, and Deploy Preview workflow in `README.md`.

- [ ] **Step 4: Make Netlify build runtime explicit**

Set `NODE_VERSION = "20"` in `netlify.toml` while retaining `npm run build`, `dist`, and the SPA redirect.

- [ ] **Step 5: Run full local verification**

Run: `npm test && npm run build && git diff --check`

Expected: all tests pass, production build succeeds, and no whitespace errors are reported.

### Task 5: Publish Feature Branch and Verify CI

**Files:**
- All files from Tasks 1-4.

- [ ] **Step 1: Review the scoped diff**

Run: `git status --short && git diff --stat main...HEAD && git diff --check`

Expected: no `assets/` or `nas-frp-setup/` files are staged.

- [ ] **Step 2: Commit implementation**

Commit the tested Markdown Build Log changes on `codex/markdown-build-log-cicd`.

- [ ] **Step 3: Push feature branch**

Push `codex/markdown-build-log-cicd` to `origin` without modifying `main`.

- [ ] **Step 4: Open a pull request and verify CI**

Create a PR targeting `main`. Confirm the `test-and-build` job succeeds.

### Task 6: Connect Netlify Git CD and Deploy Preview

**External systems:** Netlify project `menglong-build-log`; GitHub repository `wml516518/menglong-build-log`.

- [ ] **Step 1: Connect the existing Netlify project to GitHub**

Select `wml516518/menglong-build-log`, production branch `main`, root directory blank, build command `npm run build`, and publish directory `dist`.

- [ ] **Step 2: Enable Deploy Previews**

Enable previews for pull requests and keep branch deploys disabled.

- [ ] **Step 3: Verify the feature PR preview**

Confirm Netlify posts or exposes a Deploy Preview for the open PR and inspect the homepage, full index, one article, and the Chinese switch.

- [ ] **Step 4: Merge after checks pass**

Merge the PR only after GitHub CI and Netlify preview succeed. Confirm Netlify deploys the resulting `main` commit to `https://menglong-build-log.netlify.app`.

### Task 7: Protect `main`

**External system:** GitHub repository rulesets.

- [ ] **Step 1: Create an active branch ruleset**

Target the default branch, require pull requests, require the `test-and-build` status check, block force pushes, and block branch deletion.

- [ ] **Step 2: Verify enforcement**

Confirm the ruleset is active and targets `main`. Confirm future changes must use a pull request and pass CI.

- [ ] **Step 3: Final end-to-end verification**

Confirm local `npm test` and `npm run build`, the merged GitHub Actions run, Netlify production deploy, production article navigation, Deploy Preview configuration, and active GitHub ruleset.
