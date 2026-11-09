# History Galaxy Portfolio Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the MengLong Build Log portfolio at the root URL, feature History Galaxy prominently on its homepage, and keep the complete Three.js experience available at `#/history-galaxy` without loading its runtime on the homepage.

**Architecture:** `App` becomes a small hash-router shell that renders the eager `PortfolioApp` for portfolio and Build Log routes and lazy-loads `HistoryGalaxyApp` for the 3D route. The portfolio owns bilingual content and the static featured-project preview; the history app owns all current scene state and interaction. Route-specific CSS and metadata keep the two visual systems isolated while sharing one Vite/Netlify build.

**Tech Stack:** React 19, TypeScript, Vite 5, Three.js, React Three Fiber, Drei, Postprocessing, Vitest, Testing Library, Playwright, Netlify

**Spec:** `docs/superpowers/specs/2026-11-09-history-galaxy-portfolio-integration-design.md`

## Global Constraints

- The root URL and ordinary section hashes must render the original bilingual MengLong Wang portfolio and Build Log.
- The complete 3D work must live at the exact hash route `#/history-galaxy` and return to `#home`.
- Homepage code must not import or mount Three.js, React Three Fiber, Drei, Postprocessing, or a hidden Canvas.
- Preserve all seven eras, 30 events, dragging, orbiting, year travel, story navigation, mobile drawer, reduced-motion behavior, and WebGL fallback.
- Homepage featured copy must come from `src/content.ts` in both English and Chinese.
- The package name must be `menglong-build-log`; Node.js 20, `npm run build`, `dist`, and the existing Netlify SPA fallback remain unchanged.
- Do not add runtime dependencies.
- Do not stage or commit the user-owned untracked `assets/` or `nas-frp-setup/` directories.

---

## File Structure

- `src/App.tsx`: hash-router shell, lazy history route, route-level metadata and body mode.
- `src/PortfolioApp.tsx`: restored portfolio header, homepage, Build Log views, language persistence, and anchor scrolling.
- `src/HistoryGalaxyApp.tsx`: extracted full History Galaxy state, controls, fallback, story UI, and home link.
- `src/components/HistoryGalaxyFeature.tsx`: static bilingual homepage feature using one preview image and a normal hash link.
- `src/metadata.ts`: pure route-to-title/description mapping plus DOM metadata application.
- `src/routes.ts`: pure hash parsing including `history-galaxy`.
- `src/content.ts`: bilingual featured-project content model.
- `src/styles.css`: shared reset plus portfolio-only visual system.
- `src/history-galaxy.css`: history-only full-screen styles, loaded with the lazy history module.
- `public/history-galaxy-preview.png`: optimized copy of the verified Playwright event screenshot.
- `src/App.test.tsx`: router integration, portfolio behavior, feature entry, return flow, and Build Log regression coverage.
- `src/HistoryGalaxyApp.test.tsx`: the existing seven-era, 30-event, story, keyboard, and fallback behavior suite.
- `src/routes.test.ts`, `src/content.test.ts`, `src/metadata.test.ts`: focused unit coverage.
- `index.html`, `package.json`, `package-lock.json`, `README.md`: repository identity, default metadata, and deployment documentation.

---

### Task 1: Add the History Galaxy route

**Files:**
- Modify: `src/routes.ts`
- Modify: `src/routes.test.ts`

**Interfaces:**
- Produces: `Route` gains `{ view: 'history-galaxy' }`.
- Produces: `parseHash(hash: string): Route` maps only the exact `#/history-galaxy` hash to that route.

- [ ] **Step 1: Write the failing route tests**

Add these cases to `src/routes.test.ts`:

```ts
it('recognizes the History Galaxy experience', () => {
  expect(parseHash('#/history-galaxy')).toEqual({ view: 'history-galaxy' });
});

it('does not treat near-matching History Galaxy hashes as the experience', () => {
  expect(parseHash('#/history-galaxy/')).toEqual({ view: 'home' });
  expect(parseHash('#/history-galaxy-extra')).toEqual({ view: 'home' });
});
```

- [ ] **Step 2: Run the focused test and confirm the new case fails**

Run: `npm test -- --run src/routes.test.ts`

Expected: the exact history route test fails because `parseHash` currently returns `{ view: 'home' }`.

- [ ] **Step 3: Extend the route union and parser**

Update `src/routes.ts` with the exact route before Build Log parsing:

```ts
export type Route =
  | { view: 'home' }
  | { view: 'history-galaxy' }
  | { view: 'posts' }
  | { view: 'post'; slug: string };

export function parseHash(hash: string): Route {
  if (hash === '#/history-galaxy') {
    return { view: 'history-galaxy' };
  }

  if (hash === '#/build-log' || hash === postPrefix) {
    return { view: 'posts' };
  }

  if (!hash.startsWith(postPrefix)) {
    return { view: 'home' };
  }

  try {
    const slug = decodeURIComponent(hash.slice(postPrefix.length));
    return slugPattern.test(slug) ? { view: 'post', slug } : { view: 'posts' };
  } catch {
    return { view: 'posts' };
  }
}
```

- [ ] **Step 4: Run the route suite**

Run: `npm test -- --run src/routes.test.ts`

Expected: all route tests pass, including normal anchors, Build Log index/articles, malformed article hashes, and the new exact history route.

- [ ] **Step 5: Commit the route contract**

```bash
git add src/routes.ts src/routes.test.ts
git commit -m "feat: add history galaxy portfolio route"
```

---

### Task 2: Add bilingual featured-project content and the static homepage feature

**Files:**
- Modify: `src/content.ts`
- Modify: `src/content.test.ts`
- Create: `src/components/HistoryGalaxyFeature.tsx`
- Create: `public/history-galaxy-preview.png`
- Test: `src/App.test.tsx` in Task 4

**Interfaces:**
- Produces: exported `FeaturedProject` type with `title`, `status`, `summary`, `stack`, `action`, and `imageAlt` strings.
- Produces: `content[language].historyGalaxy: FeaturedProject`.
- Produces: `HistoryGalaxyFeature({ project }: { project: FeaturedProject }): JSX.Element` linking to `#/history-galaxy`.

- [ ] **Step 1: Write failing bilingual content assertions**

Add to the first test in `src/content.test.ts`:

```ts
expect(content.en.historyGalaxy).toMatchObject({
  title: 'History Galaxy',
  status: 'Interactive 3D experience',
  action: 'Enter the galaxy'
});
expect(content.zh.historyGalaxy).toMatchObject({
  title: '历史星河',
  status: '交互式 3D 作品',
  action: '进入星河'
});
```

- [ ] **Step 2: Run the content test and confirm it fails**

Run: `npm test -- --run src/content.test.ts`

Expected: TypeScript or assertion failure because `historyGalaxy` does not exist on `SiteContent`.

- [ ] **Step 3: Add the typed English and Chinese content**

Add this exported type and field to `src/content.ts`:

```ts
export type FeaturedProject = {
  title: string;
  status: string;
  summary: string;
  stack: string[];
  action: string;
  imageAlt: string;
};

```

Add this property immediately before `projects` in `SiteContent`:

```ts
historyGalaxy: FeaturedProject;
```

Use these exact records:

```ts
historyGalaxy: {
  title: 'History Galaxy',
  status: 'Interactive 3D experience',
  summary: 'Travel from the Tang dynasty to 1949, move event stars across a living timeline, and explore the people and stories behind each turning point.',
  stack: ['Three.js', 'React Three Fiber', '30 historical events'],
  action: 'Enter the galaxy',
  imageAlt: 'A luminous Chinese history timeline surrounded by event stars in a deep three-dimensional space'
}
```

```ts
historyGalaxy: {
  title: '历史星河',
  status: '交互式 3D 作品',
  summary: '从唐朝航行至 1949 年，在历史时间轴上拖拽事件星点，探索人物与时代故事。',
  stack: ['Three.js', 'React Three Fiber', '30 个历史事件'],
  action: '进入星河',
  imageAlt: '深邃三维空间中，一条发光的中国历史时间轴与众多事件星点向远方延伸'
}
```

- [ ] **Step 4: Create the semantic static feature component**

Create `src/components/HistoryGalaxyFeature.tsx`:

```tsx
import { ArrowUpRight } from 'lucide-react';
import type { FeaturedProject } from '../content';

type HistoryGalaxyFeatureProps = {
  project: FeaturedProject;
};

export function HistoryGalaxyFeature({ project }: HistoryGalaxyFeatureProps) {
  return (
    <article className="history-feature">
      <div className="history-feature-copy">
        <p className="history-feature-status">{project.status}</p>
        <h3>{project.title}</h3>
        <p className="history-feature-summary">{project.summary}</p>
        <ul aria-label={project.stack.join(', ')}>
          {project.stack.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <a className="history-feature-link" href="#/history-galaxy">
          {project.action}
          <ArrowUpRight aria-hidden="true" size={18} />
        </a>
      </div>
      <figure className="history-feature-visual">
        <img src="/history-galaxy-preview.png" alt={project.imageAlt} width="1440" height="900" />
      </figure>
    </article>
  );
}
```

This final structure has one focusable CTA and exposes descriptive alternative text for the scene screenshot.

- [ ] **Step 5: Copy and optimize the verified preview image**

Run:

```bash
cp output/playwright/history-galaxy-event.png public/history-galaxy-preview.png
sips -Z 1600 public/history-galaxy-preview.png
```

Expected: `public/history-galaxy-preview.png` is a real rendered scene, remains 16:10, and is no wider than 1600 pixels. Check with `sips -g pixelWidth -g pixelHeight public/history-galaxy-preview.png`.

- [ ] **Step 6: Run content tests**

Run: `npm test -- --run src/content.test.ts`

Expected: all language and persistence tests pass.

- [ ] **Step 7: Commit content, feature, and image**

```bash
git add src/content.ts src/content.test.ts src/components/HistoryGalaxyFeature.tsx public/history-galaxy-preview.png
git commit -m "feat: add history galaxy portfolio feature"
```

---

### Task 3: Extract the complete 3D experience behind a lazy module

**Files:**
- Create: `src/HistoryGalaxyApp.tsx`
- Create: `src/HistoryGalaxyApp.test.tsx`
- Modify: `src/App.tsx`
- Move: `src/styles.css` history-specific rules into `src/history-galaxy.css`

**Interfaces:**
- Consumes: the existing `HistoryHud`, `EventNavigator`, `StoryPanel`, navigation hooks, event data, error boundary, and lazy `HistoryScene`.
- Produces: default `HistoryGalaxyApp` export.
- Produces: visible `<a className="history-home-link" href="#home" aria-label="返回主页">`.
- Produces: `src/App.tsx` imports `HistoryGalaxyApp` only through `React.lazy(() => import('./HistoryGalaxyApp'))`.

- [ ] **Step 1: Move the current behavior suite to the extracted app test**

Rename `src/App.test.tsx` to `src/HistoryGalaxyApp.test.tsx`, change the import to:

```ts
import HistoryGalaxyApp from './HistoryGalaxyApp';
```

Change every `render(<App />)` call to `render(<HistoryGalaxyApp />)` and add:

```ts
it('provides a route back to the portfolio homepage', () => {
  render(<HistoryGalaxyApp />);

  expect(screen.getByRole('link', { name: '返回主页' })).toHaveAttribute('href', '#home');
});
```

- [ ] **Step 2: Run the extracted app test and confirm it fails**

Run: `npm test -- --run src/HistoryGalaxyApp.test.tsx`

Expected: module resolution fails because `src/HistoryGalaxyApp.tsx` does not exist.

- [ ] **Step 3: Extract the current app without changing scene behavior**

Create `src/HistoryGalaxyApp.tsx` as an exact copy of the current `src/App.tsx`, then make only these edits before Task 4:

- add the two imports below;
- rename `export default function App()` to `export default function HistoryGalaxyApp()`;
- insert the home link below as the first child of `<main className="history-experience">`;
- leave `hasWebGLSupport`, all state callbacks, `useHistoryNavigation`, lazy `HistoryScene`, scene props, HUD, event navigator, readout, and story panel unchanged.

```tsx
import { ArrowLeft } from 'lucide-react';
import './history-galaxy.css';
```

```tsx
<a className="history-home-link" href="#home" aria-label="返回主页">
  <ArrowLeft aria-hidden="true" size={18} />
  <span>返回主页</span>
</a>
```

- [ ] **Step 4: Make `App` a minimal lazy route proof before portfolio restoration**

Temporarily replace `src/App.tsx` with a router shell that can render the history module and a basic portfolio marker:

```tsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { parseHash } from './routes';

const HistoryGalaxyApp = lazy(() => import('./HistoryGalaxyApp'));

export default function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route.view === 'history-galaxy') {
    return (
      <Suspense fallback={<main className="history-route-loading" aria-label="正在加载历史星河" />}>
        <HistoryGalaxyApp />
      </Suspense>
    );
  }

  return <main data-testid="portfolio-route" />;
}
```

- [ ] **Step 5: Separate history CSS from the shared entry stylesheet**

Mechanically move the current history stylesheet to `src/history-galaxy.css`. Replace global dark declarations with scoped equivalents:

```css
.history-experience {
  position: fixed;
  inset: 0;
  min-width: 320px;
  min-height: 100dvh;
  overflow: hidden;
  color: #f5efe3;
  background: #05070a;
}

.history-experience *,
.history-experience *::before,
.history-experience *::after {
  box-sizing: border-box;
}

.history-home-link {
  position: fixed;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.history-home-link:focus-visible {
  outline: 2px solid #f2c875;
  outline-offset: 4px;
}
```

Keep every existing history class and media query, but scope generic selectors such as `button`, `h1`, and `a` beneath `.history-experience`. Leave a minimal `src/styles.css` reset for Task 4 to populate.

- [ ] **Step 6: Run the history behavior suite**

Run: `npm test -- --run src/HistoryGalaxyApp.test.tsx`

Expected: all existing seven-era, 30-event, story, keyboard, fallback, and new home-link tests pass.

- [ ] **Step 7: Build and inspect chunk separation**

Run: `npm run build`

Expected: build succeeds and `dist/assets/` contains a separate lazy history JavaScript chunk. `App`/portfolio source must not statically import `HistoryGalaxyApp`, `HistoryScene`, or packages from `@react-three/*`.

- [ ] **Step 8: Commit the extracted experience**

```bash
git add src/App.tsx src/HistoryGalaxyApp.tsx src/HistoryGalaxyApp.test.tsx src/styles.css src/history-galaxy.css
git commit -m "refactor: isolate history galaxy experience"
```

---

### Task 4: Restore the portfolio and integrate the featured work

**Files:**
- Create: `src/PortfolioApp.tsx`
- Create: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Route`, `content`, language persistence, posts, Build Log components, and `HistoryGalaxyFeature`.
- Produces: `PortfolioApp({ route }: { route: Exclude<Route, { view: 'history-galaxy' }> })`.
- Produces: `App` owns the hash listener and passes all non-history routes into `PortfolioApp`.

- [ ] **Step 1: Restore the portfolio regression tests and add feature/route tests**

Create `src/App.test.tsx` from commit `2bf4a4b`'s `src/App.test.tsx`, preserving its seven portfolio and Build Log cases. Add:

```ts
it('features History Galaxy without mounting the 3D experience', () => {
  render(<App />);

  expect(screen.getByRole('heading', { level: 3, name: 'History Galaxy' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Enter the galaxy/ })).toHaveAttribute('href', '#/history-galaxy');
  expect(screen.queryByLabelText('三维历史时间轴')).not.toBeInTheDocument();
});

it('localizes the featured History Galaxy project', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: '中' }));

  expect(screen.getByRole('heading', { level: 3, name: '历史星河' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /进入星河/ })).toHaveAttribute('href', '#/history-galaxy');
});

it('opens History Galaxy and returns to the portfolio', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('link', { name: /Enter the galaxy/ }));
  expect(await screen.findByRole('heading', { level: 1, name: '历史星河' })).toBeInTheDocument();
  expect(window.location.hash).toBe('#/history-galaxy');

  await user.click(screen.getByRole('link', { name: '返回主页' }));
  expect(await screen.findByText('Building practical AI tools and full-stack products.')).toBeInTheDocument();
  expect(window.location.hash).toBe('#home');
});
```

- [ ] **Step 2: Run the app suite and confirm the portfolio cases fail**

Run: `npm test -- --run src/App.test.tsx`

Expected: homepage and Build Log assertions fail because `PortfolioApp` has not been restored.

- [ ] **Step 3: Restore the portfolio into its own component**

Create `src/PortfolioApp.tsx` from `git show 2bf4a4b:src/App.tsx`, then:

- remove its hash listener and accept `route` as a prop;
- retain language state, `saveLanguage`, post language fallback, and section scrolling;
- set the root to `<main className="portfolio-site site-shell">`;
- render `<HistoryGalaxyFeature project={copy.historyGalaxy} />` before the existing `copy.projects.map(...)` list;
- keep Build Log index and article rendering unchanged.

Replace the restored `function App()` declaration with:

```tsx
import type { Route } from './routes';

type PortfolioRoute = Exclude<Route, { view: 'history-galaxy' }>;

export function PortfolioApp({ route }: { route: PortfolioRoute }) {
```

Then remove `export default App;` because the declaration is already a named export. The function body remains the restored commit's complete implementation with the route state/listener removed and the feature insertion described above.

- [ ] **Step 4: Complete the router shell**

Update `src/App.tsx` so non-history routes render the restored app:

```tsx
import { PortfolioApp } from './PortfolioApp';

// hash listener and lazy HistoryGalaxyApp stay unchanged

if (route.view === 'history-galaxy') {
  return (
    <Suspense fallback={<main className="history-route-loading" aria-label="正在加载历史星河" />}>
      <HistoryGalaxyApp />
    </Suspense>
  );
}

return <PortfolioApp route={route} />;
```

- [ ] **Step 5: Restore and scope the portfolio stylesheet**

Use `git show 2bf4a4b:src/styles.css` as the visual baseline. Keep the global box model, body margin, minimum width, and smooth scrolling, then scope typography and controls that can collide:

```css
:root {
  color: #171717;
  background: #f6f4ef;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: #f6f4ef; }
.portfolio-site a { color: inherit; text-decoration: none; }
.portfolio-site button { font: inherit; }
```

Add a full-width `.history-feature` grid with dark neutral background, maximum 8px radius, 16:10 image aspect ratio, visible focus, and a single-column breakpoint below 760px. Use stable grid tracks and `min-width: 0` so long bilingual text cannot overflow.

- [ ] **Step 6: Run portfolio and Build Log tests**

Run: `npm test -- --run src/App.test.tsx src/content.test.ts src/posts.test.ts`

Expected: default portfolio, language persistence, feature copy/entry, route return, Build Log index, direct articles, missing articles, and localized articles all pass.

- [ ] **Step 7: Run all unit tests**

Run: `npm test -- --run`

Expected: the complete portfolio, history, routes, content, posts, event data, and spatial mapping suite passes.

- [ ] **Step 8: Commit the integrated interface**

```bash
git add src/App.tsx src/App.test.tsx src/PortfolioApp.tsx src/styles.css
git commit -m "feat: integrate history galaxy into portfolio"
```

---

### Task 5: Apply route-aware metadata and viewport mode

**Files:**
- Create: `src/metadata.ts`
- Create: `src/metadata.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Route` from `src/routes.ts`.
- Produces: `getRouteMetadata(route: Route): { title: string; description: string; themeColor: string }`.
- Produces: `applyRouteMetadata(route: Route): void` updates title, description, and theme-color.
- Produces: `body.history-route` exists only while the 3D route is active.

- [ ] **Step 1: Write failing metadata tests**

Create `src/metadata.test.ts`:

```ts
import { applyRouteMetadata, getRouteMetadata } from './metadata';

describe('route metadata', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="description" content="">
      <meta name="theme-color" content="">
    `;
  });

  it('uses portfolio metadata for the homepage and Build Log', () => {
    expect(getRouteMetadata({ view: 'home' }).title).toBe('MengLong Wang | Portfolio + Build Log');
    expect(getRouteMetadata({ view: 'posts' }).title).toBe('Build Log | MengLong Wang');
  });

  it('uses the Chinese interactive timeline metadata for History Galaxy', () => {
    expect(getRouteMetadata({ view: 'history-galaxy' })).toMatchObject({
      title: '历史星河｜中国历史3D交互时间轴',
      themeColor: '#05070a'
    });
  });

  it('applies title, description, and theme color to the document', () => {
    applyRouteMetadata({ view: 'history-galaxy' });

    expect(document.title).toBe('历史星河｜中国历史3D交互时间轴');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      '历史星河是一条从唐朝延伸至1949年的3D交互式中国历史时间轴，可自由航行、拖拽事件星点并探索人物故事。'
    );
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#05070a');
  });
});
```

- [ ] **Step 2: Run the metadata suite and confirm it fails**

Run: `npm test -- --run src/metadata.test.ts`

Expected: module resolution fails because `src/metadata.ts` does not exist.

- [ ] **Step 3: Implement the route mapping and DOM updater**

Create `src/metadata.ts` with explicit constants and exhaustive route handling:

```ts
import type { Route } from './routes';

const portfolioDescription = "MengLong Wang's personal homepage, project portfolio, and public build log.";
const historyDescription = '历史星河是一条从唐朝延伸至1949年的3D交互式中国历史时间轴，可自由航行、拖拽事件星点并探索人物故事。';

export function getRouteMetadata(route: Route) {
  if (route.view === 'history-galaxy') {
    return { title: '历史星河｜中国历史3D交互时间轴', description: historyDescription, themeColor: '#05070a' };
  }
  if (route.view === 'posts') {
    return { title: 'Build Log | MengLong Wang', description: portfolioDescription, themeColor: '#f6f4ef' };
  }
  if (route.view === 'post') {
    return { title: 'Build Log | MengLong Wang', description: portfolioDescription, themeColor: '#f6f4ef' };
  }
  return { title: 'MengLong Wang | Portfolio + Build Log', description: portfolioDescription, themeColor: '#f6f4ef' };
}

export function applyRouteMetadata(route: Route): void {
  const metadata = getRouteMetadata(route);
  document.title = metadata.title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', metadata.description);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', metadata.themeColor);
}
```

- [ ] **Step 4: Add route effects to the shell**

In `src/App.tsx`, add:

```ts
useEffect(() => {
  applyRouteMetadata(route);
  document.body.classList.toggle('history-route', route.view === 'history-galaxy');

  return () => document.body.classList.remove('history-route');
}, [route]);
```

Add to `src/styles.css`:

```css
body.history-route {
  overflow: hidden;
  background: #05070a;
}
```

- [ ] **Step 5: Add an integration assertion for viewport cleanup**

Extend the open-and-return test in `src/App.test.tsx`:

```ts
expect(document.body).toHaveClass('history-route');
await user.click(screen.getByRole('link', { name: '返回主页' }));
await screen.findByText('Building practical AI tools and full-stack products.');
expect(document.body).not.toHaveClass('history-route');
```

- [ ] **Step 6: Run focused and integration tests**

Run: `npm test -- --run src/metadata.test.ts src/App.test.tsx`

Expected: metadata changes by route and the body scroll lock is removed after returning home.

- [ ] **Step 7: Commit route presentation behavior**

```bash
git add src/metadata.ts src/metadata.test.ts src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add route-aware metadata and viewport mode"
```

---

### Task 6: Restore repository identity and deployment documentation

**Files:**
- Modify: `index.html`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Verify: `netlify.toml`

**Interfaces:**
- Produces: default HTML metadata for `MengLong Wang | Portfolio + Build Log`.
- Produces: npm package name `menglong-build-log` in both manifest and lockfile.
- Produces: README documents root portfolio, `#/history-galaxy`, Build Log, tests, GitHub, and Netlify.

- [ ] **Step 1: Restore default portfolio metadata in `index.html`**

Set the document language and static fallback metadata:

```html
<html lang="en">
<meta name="theme-color" content="#f6f4ef" />
<meta name="description" content="MengLong Wang's personal homepage, project portfolio, and public build log." />
<meta property="og:title" content="MengLong Wang | Portfolio + Build Log" />
<meta property="og:description" content="MengLong Wang's personal homepage, project portfolio, and public build log." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://menglong-build-log.netlify.app/" />
<link rel="canonical" href="https://menglong-build-log.netlify.app/" />
<title>MengLong Wang | Portfolio + Build Log</title>
```

Retain the existing favicon and viewport declarations.

- [ ] **Step 2: Restore the npm package name**

Change `package.json` and both lockfile package records from `history-galaxy` to:

```json
"name": "menglong-build-log"
```

Run `npm install --package-lock-only --ignore-scripts` only if the lockfile cannot be updated consistently by the focused edit.

- [ ] **Step 3: Restore the repository README and document the integrated route**

Start from `git show 2bf4a4b:README.md`, then update the root site feature list to include:

```markdown
- 首页重点展示《历史星河》，静态预览不加载 Three.js 运行时
- `#/history-galaxy` 提供唐朝至 1949 年的完整 3D 交互历史时间轴
- 历史星河支持七时代导航、30 个事件、星点拖拽、人物故事、移动端抽屉与 WebGL 降级
```

Document these local URLs:

```markdown
- 个人主页：`http://localhost:5173/`
- 历史星河：`http://localhost:5173/#/history-galaxy`
- Build Log：`http://localhost:5173/#/build-log`
```

State that one Netlify site deploys all hash routes and that `netlify.toml` remains the source of build settings.

- [ ] **Step 4: Verify Netlify configuration remains unchanged**

Run: `git diff -- netlify.toml`

Expected: no diff. Then inspect `netlify.toml` and confirm build command `npm run build`, publish directory `dist`, Node 20, and SPA fallback `/* /index.html 200`.

- [ ] **Step 5: Run tests and production build**

Run:

```bash
npm test -- --run
npm run build
```

Expected: every test passes and Vite emits a production build without TypeScript errors.

- [ ] **Step 6: Commit repository identity and docs**

```bash
git add index.html package.json package-lock.json README.md
git commit -m "docs: restore portfolio project identity"
```

---

### Task 7: Verify real-browser behavior, rendering, and responsive layout

**Files:**
- Modify only when a verified defect requires a focused fix: `src/styles.css`, `src/history-galaxy.css`, or the owning React component
- Create/update screenshots: `output/playwright/portfolio-homepage.png`, `output/playwright/portfolio-history-feature.png`, `output/playwright/history-galaxy-integrated.png`, `output/playwright/portfolio-mobile.png`, `output/playwright/history-galaxy-integrated-mobile.png`

**Interfaces:**
- Consumes: the completed production behavior from Tasks 1-6.
- Produces: browser evidence for desktop/mobile, route navigation, history interaction, and nonblank Canvas rendering.

- [ ] **Step 1: Read and use the Playwright skill**

Read `/Users/wangmenglong/.codex/skills/playwright/SKILL.md` completely and use its bundled browser workflow. Do not replace this with jsdom-only verification.

- [ ] **Step 2: Start the local development server**

Run: `npm run dev -- --host 127.0.0.1`

Use the printed available port and keep the session alive until all browser checks complete.

- [ ] **Step 3: Verify the desktop portfolio at 1440x900**

Open the root URL and assert:

- `MengLong Wang` and the original portfolio headline are visible;
- the History Galaxy feature is visible in the Projects section;
- the feature screenshot has `naturalWidth > 0` and a 16:10 rendered region;
- the page has no horizontal overflow: `document.documentElement.scrollWidth === window.innerWidth`;
- no Three.js Canvas exists on the homepage;
- the Build Log index and one article open and browser back returns correctly.

Capture `output/playwright/portfolio-homepage.png` and `output/playwright/portfolio-history-feature.png`.

- [ ] **Step 4: Verify the full desktop interaction flow**

Click “Enter the galaxy”, wait for `#/history-galaxy`, and verify:

- all seven era controls and 30 accessible event controls exist;
- the Canvas bounding box fills the viewport and does not overlap the home link incoherently;
- selecting “鸦片战争” opens its story with “林则徐” and “南京条约”;
- clicking “返回主页” restores the portfolio at `#home` and removes the body scroll lock;
- browser back reopens History Galaxy and browser forward returns to the portfolio;
- console contains no errors and network contains no 404 responses.

Capture `output/playwright/history-galaxy-integrated.png` with an event story open.

- [ ] **Step 5: Run a Canvas pixel sanity check**

Sample the rendered Canvas or its screenshot and calculate:

- at least 100 distinct RGB colors;
- at least 1% non-near-black pixels;
- nonzero width and height.

Expected: the scene is visibly rendered, not a blank WebGL surface or only the HTML overlay.

- [ ] **Step 6: Verify mobile behavior at 390x844**

At the root URL verify the portfolio headline, feature copy, screenshot, CTA, and language controls fit without horizontal overflow. Enter History Galaxy and verify the Canvas fills the screen, era strip remains usable, an event opens the bottom story drawer, and the home link remains reachable.

Capture `output/playwright/portfolio-mobile.png` and `output/playwright/history-galaxy-integrated-mobile.png`.

- [ ] **Step 7: Fix only observed browser defects and rerun affected checks**

For each defect, first add the narrowest regression test where DOM behavior is testable, then patch the owning component or stylesheet. Rerun the focused test, the affected Playwright flow, `npm test -- --run`, and `npm run build` before continuing.

- [ ] **Step 8: Commit verified integration adjustments and screenshots**

```bash
git add src output/playwright/portfolio-homepage.png output/playwright/portfolio-history-feature.png output/playwright/history-galaxy-integrated.png output/playwright/portfolio-mobile.png output/playwright/history-galaxy-integrated-mobile.png
git commit -m "test: verify integrated portfolio experience"
```

---

### Task 8: Final verification and delivery audit

**Files:**
- Verify: all tracked files changed by Tasks 1-7
- Verify: `assets/` and `nas-frp-setup/` remain untracked and unstaged

**Interfaces:**
- Produces: a clean, reviewable implementation branch with passing tests, build evidence, and no user-owned directory changes.

- [ ] **Step 1: Use the verification-before-completion skill**

Read `/Users/wangmenglong/.codex/plugins/cache/openai-api-curated/superpowers/d420d130/skills/verification-before-completion/SKILL.md` completely before making any completion claim.

- [ ] **Step 2: Run fresh automated verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: both commands exit 0 in this final run.

- [ ] **Step 3: Audit lazy loading and output size**

Run:

```bash
rg "HistoryGalaxyApp|@react-three|from 'three'" src/App.tsx src/PortfolioApp.tsx src/components/HistoryGalaxyFeature.tsx
find dist/assets -maxdepth 1 -type f -print
```

Expected: the source search shows only the dynamic `import('./HistoryGalaxyApp')` in `App.tsx` and no Three.js imports in portfolio files; the build lists a separate history/Three chunk.

- [ ] **Step 4: Audit tracked and untracked changes**

Run:

```bash
git status --short
git diff --check
git log --oneline -10
```

Expected: no whitespace errors; `assets/` and `nas-frp-setup/` are still untracked and were never included in a commit; all integration work appears in focused commits.

- [ ] **Step 5: Review the final branch diff**

Run: `git diff 2bf4a4b...HEAD --stat` and `git diff 2bf4a4b...HEAD -- src package.json index.html README.md netlify.toml`.

Confirm the root portfolio is restored, History Galaxy is reachable only through its route, Build Log behavior remains, metadata defaults are portfolio-oriented, and `netlify.toml` has no unintended change.

- [ ] **Step 6: Use the requesting-code-review skill**

Read `/Users/wangmenglong/.codex/plugins/cache/openai-api-curated/superpowers/d420d130/skills/requesting-code-review/SKILL.md` completely and perform its required review workflow. Resolve any high- or medium-severity integration regression, then rerun the final automated verification.

- [ ] **Step 7: Commit any review fixes and report delivery**

If review fixes were needed, stage each verified file by its explicit path and commit with:

```bash
git commit -m "fix: address portfolio integration review"
```

Report the local URL, history route, latest test count, production build result, browser viewport coverage, and the branch/commit state. Do not claim GitHub push, PR creation, or Netlify deployment unless those actions were separately authorized and completed.
