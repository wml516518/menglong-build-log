# History Galaxy Phase 1 Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 30-event prototype data path with a validated, lazy-loaded history content platform and ship semantic zoom, screen-space clustering, search, filters, archive routes, and a complete 2D fallback.

**Architecture:** Source archives live as Markdown Frontmatter plus JSON manifests and are compiled before dev/build into compact indexes and era bundles. The React app loads only compact metadata initially; MiniSearch and `d3-quadtree` run in Web Workers, while Three.js renders visible events through instancing and promotes selected/hovered events to interactive meshes.

**Tech Stack:** React 19, TypeScript, Vite 5, Three.js, React Three Fiber, Zod, gray-matter, MiniSearch, d3-quadtree, Web Workers, Vitest, Testing Library, Playwright

**Spec:** `/Users/wangmenglong/Desktop/PrivateChat/docs/superpowers/specs/2026-11-10-history-galaxy-encyclopedia-design.md`

## Global Constraints

- Preserve the existing portfolio homepage and `#/history-galaxy` entry route.
- New shareable routes are `#/history-galaxy/event/<event-id>`, `#/history-galaxy/person/<person-id>`, and `#/history-galaxy/theme/<theme-id>`.
- Source content uses JSON manifests and Markdown with strict Frontmatter; generated JSON is build output, never hand-edited.
- The first payload contains compact indexes only; complete archive prose loads by era on demand.
- Public rendering remains fully static and deployable to Netlify without a database or server.
- MiniSearch owns full-text retrieval; `d3-quadtree` owns screen-space neighbor lookup.
- Impact-5, selected, and search-target events are never hidden inside clusters.
- Desktop performance target is near 60 FPS; mobile target is at least 30 FPS with reduced budgets.
- WebGL failure must preserve search, filters, quick details, archive routes, and keyboard navigation through the 2D timeline.
- Raw Markdown HTML is rejected; external references accept `https:` only.
- Existing user-owned untracked directories and unrelated portfolio code must remain untouched.

## File Structure

- `history-content/manifest/*.json`: eras, themes, source catalog, and aliases.
- `history-content/content/<era>/events/*.md`: full event archives.
- `history-content/content/<era>/people/*.md`: full person archives.
- `scripts/history-content.ts`: validation, relationship checks, Markdown compilation, and generated index/bundle output.
- `src/history/content/schema.ts`: Zod schemas and inferred domain types.
- `src/history/content/loader.ts`: compact-index bootstrap and cached era-bundle loading.
- `src/history/content/store.tsx`: application-facing content state and archive access.
- `src/history/search/search.worker.ts`: MiniSearch index and query execution.
- `src/history/search/client.ts`: typed worker client and title-search fallback.
- `src/history/explorer/state.ts`: URL-backed filters and local view preferences.
- `src/history/lod.ts`: semantic zoom levels, visibility budgets, and protected events.
- `src/history/clustering/cluster.worker.ts`: semantic-grouped `d3-quadtree` clustering.
- `src/history/clustering/client.ts`: typed cluster worker bridge and stale-result suppression.
- `src/scene/InstancedEventField.tsx`: batched star rendering and raycast selection.
- `src/scene/ClusterField.tsx`: cluster glyphs and focus interaction.
- `src/components/HistoryExplorer.tsx`: desktop explorer and mobile drawer.
- `src/components/QuickEventPanel.tsx`: concise event summary over the scene.
- `src/components/archive/*`: event, person, theme, sources, and not-found views.
- `src/components/HistoryTimeline2D.tsx`: feature-complete non-WebGL fallback.
- `src/history/session.ts`: persisted camera, filters, selection, and drag offsets.

---

### Task 1: Install Content, Search, and Spatial Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces runtime dependencies `zod`, `gray-matter`, `minisearch`, `d3-quadtree` and development dependency `tsx`.
- Produces scripts `history:compile`, `history:check`, `predev`, and `prebuild`.

- [ ] **Step 1: Add a failing package-contract test**

Create `src/history/toolchain.test.ts`:

```ts
import packageJson from '../../package.json';

it('declares the history content toolchain and build hooks', () => {
  expect(packageJson.dependencies).toMatchObject({
    zod: expect.any(String),
    'gray-matter': expect.any(String),
    minisearch: expect.any(String),
    'd3-quadtree': expect.any(String)
  });
  expect(packageJson.devDependencies).toMatchObject({ tsx: expect.any(String) });
  expect(packageJson.scripts).toMatchObject({
    'history:compile': 'tsx scripts/history-content.ts compile',
    'history:check': 'tsx scripts/history-content.ts check',
    predev: 'npm run history:compile',
    prebuild: 'npm run history:compile'
  });
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/toolchain.test.ts`

Expected: FAIL because the dependencies and scripts are absent.

- [ ] **Step 3: Install exact dependency families and ignore generated content**

Run:

```bash
npm install zod@^4 gray-matter@^4 minisearch@^7 d3-quadtree@^3
npm install -D tsx@^4 @types/d3-quadtree@^3
```

Add `public/history-content/generated/` to `.gitignore` and the exact scripts asserted above to `package.json`.

- [ ] **Step 4: Run focused test and commit**

Run: `npm test -- --run src/history/toolchain.test.ts`

Expected: PASS.

```bash
git add package.json package-lock.json .gitignore src/history/toolchain.test.ts
git commit -m "build: add history content toolchain"
```

---

### Task 2: Define Strict Archive Schemas

**Files:**
- Create: `src/history/content/schema.ts`
- Create: `src/history/content/schema.test.ts`
- Modify: `src/history/types.ts`

**Interfaces:**
- Produces `HistoryEra`, `HistoryEventIndex`, `HistoryEventArchive`, `PersonIndex`, `PersonArchive`, `PlaceIndex`, `ThemeArchive`, and `SourceRecord`.
- Produces `eventArchiveSchema.safeParse`, `personArchiveSchema.safeParse`, and `formatHistoryYear(year, precision)`.

- [ ] **Step 1: Write failing schema tests**

Create `src/history/content/schema.test.ts` with a valid BCE event, invalid raw HTML, an invalid `http:` source, and a cyclic self-reference:

```ts
import { eventArchiveSchema, formatHistoryYear, sourceSchema } from './schema';

const event = {
  id: 'qin-unification', title: '秦统一六国', aliases: ['秦灭六国'],
  startYear: -230, endYear: -221, yearPrecision: 'range', eraId: 'qin-han', polityIds: ['qin'],
  period: '秦统一战争', categories: ['war', 'politics'], themeIds: ['unification'], influence: 5,
  summary: '秦国先后灭韩、赵、魏、楚、燕、齐，结束战国长期割据。',
  background: '战国后期兼并战争持续，秦国经过长期制度与军事建设取得优势。',
  causes: ['秦国国力与军制优势'], course: [{ year: -230, title: '灭韩', description: '秦军攻灭韩国。' }],
  results: ['建立统一王朝'], impacts: [{ dimension: 'politics', text: '统一政治秩序形成。' }],
  personIds: ['qin-shihuang'], placeIds: ['xianyang'], parentId: null, childIds: [],
  relationIds: [], historiography: '具体战役年代以主流年表为准。', sourceIds: ['textbook-7-1'],
  color: '#d6a650', layout: { lane: 'war', offset: [0, 0] }
};

it('accepts a complete BCE archive and formats its range', () => {
  expect(eventArchiveSchema.parse(event).id).toBe('qin-unification');
  expect(formatHistoryYear(-230, 'exact')).toBe('公元前 230 年');
});

it('rejects raw HTML and insecure sources', () => {
  expect(eventArchiveSchema.safeParse({ ...event, background: '<script>alert(1)</script>' }).success).toBe(false);
  expect(sourceSchema.safeParse({ id: 'bad', title: '错误来源', kind: 'institution', url: 'http://example.com' }).success).toBe(false);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/content/schema.test.ts`

Expected: FAIL because `schema.ts` is absent.

- [ ] **Step 3: Implement schemas with exact category and relation unions**

Define:

```ts
export const categoryIds = ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society'] as const;
export const relationTypes = ['cause', 'consequence', 'parallel', 'contrast', 'part-of'] as const;
export const yearPrecisions = ['exact', 'circa', 'decade', 'century', 'range'] as const;
```

Every prose field rejects `<` followed by an ASCII letter or `/`. IDs match `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Influence is an integer from 1 through 5. `PersonIndex` includes `id`, `name`, `aliases`, `primaryEraId`, `birthYear`, `deathYear`, `roleIds`, `eventIds`, and `sourceIds`; each person has exactly one editorial `primaryEraId` for non-duplicating coverage counts even when their life crosses an era boundary. `SourceRecord` is exactly `{ id, title, kind, authors?, publisher?, edition?, chapter?, url?, accessedAt? }`; when present, `url` uses `z.string().url().startsWith('https://')`.

- [ ] **Step 4: Replace the old `HistoryEvent` contract with a compatibility view**

Export `HistoryEvent = HistoryEventIndex` from `src/history/types.ts` temporarily. Keep `year` as the sortable representative year in `HistoryEventIndex`; the compiler derives it from `startYear` so existing scene code remains operational through Task 3.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run src/history/content/schema.test.ts src/history/events.test.ts src/history/space.test.ts`

Expected: PASS.

```bash
git add src/history/content/schema.ts src/history/content/schema.test.ts src/history/types.ts
git commit -m "feat: define history archive schemas"
```

---

### Task 3: Build the Content Compiler and Migrate the Existing Collection

**Files:**
- Create: `scripts/history-content.ts`
- Create: `scripts/history-content.test.ts`
- Create: `history-content/manifest/eras.json`
- Create: `history-content/manifest/themes.json`
- Create: `history-content/manifest/sources.json`
- Create: `history-content/content/<era>/events/*.md`
- Create: `history-content/content/<era>/people/*.md`
- Create: `src/history/generated/compat-index.json` (compiler output, ignored)
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `src/history/toolchain.test.ts`
- Replace: `src/history/events.ts`

**Interfaces:**
- Produces `compileHistoryContent({ sourceRoot, publicOutputRoot, compatibilityOutputFile? }): Promise<CompileReport>`.
- Produces `public/history-content/generated/manifest.json`, compact indexes, one bundle per era, and `src/history/generated/compat-index.json` for the temporary synchronous compatibility view.
- Preserves all 30 current event IDs and visible story content during migration.

- [ ] **Step 1: Write compiler fixture tests**

In `scripts/history-content.test.ts`, create temporary valid and invalid fixture trees. Assert that valid content emits deterministic sorted indexes; duplicate IDs, missing people, missing sources, non-reciprocal relations, parent cycles, and era range errors throw messages naming the offending ID.

```ts
await expect(compileHistoryContent(validFixture)).resolves.toMatchObject({ eventCount: 2, personCount: 2, errorCount: 0 });
await expect(compileHistoryContent(duplicateFixture)).rejects.toThrow('重复事件 ID: shared-id');
await expect(compileHistoryContent(missingPersonFixture)).rejects.toThrow('事件 event-a 引用了不存在的人物 person-missing');
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run scripts/history-content.test.ts`

Expected: FAIL because the compiler is absent.

- [ ] **Step 3: Implement deterministic compilation**

Parse Markdown through `gray-matter`, validate Frontmatter and compiled prose through Task 2 schemas, normalize aliases, derive `year`, verify bidirectional links, and write JSON with stable key ordering and records sorted by `startYear`, `endYear`, then `id`.

CLI behavior:

```text
tsx scripts/history-content.ts check    validate only, no output
tsx scripts/history-content.ts compile  replace generated output atomically
```

Write both output roots to temporary sibling directories, then rename only after all validation succeeds so a failed compile cannot leave partial output. Add `src/history/generated/` to `.gitignore`; neither generated root is committed.

- [ ] **Step 4: Migrate all 30 existing events and their named people**

Create era manifests for the existing Tang-through-1949 range plus empty definitions for future eras. Every current event keeps its ID, title, representative year, influence, summary, story meaning, color, and offset. Convert `story` into `background`, `course`, `results`, and `impacts`. Create person records for every unique current person name and source catalog entries for the migration.

- [ ] **Step 5: Replace `events.ts` with generated-index loading for tests**

`events.ts` imports `./generated/compat-index.json`; runtime fetching moves to Task 4. Preserve exports `dynasties` and `historyEvents` so the current application and its tests remain green. Add `pretest: "npm run history:compile"` only now, after the compiler exists, so a clean checkout always creates the ignored compatibility index before tests; add an assertion for this hook to `toolchain.test.ts`. Keep the explicit `npm run history:compile` below to verify compiler output independently.

- [ ] **Step 6: Verify counts and commit**

Run:

```bash
npm run history:check
npm run history:compile
npm test -- --run scripts/history-content.test.ts src/history/events.test.ts src/HistoryGalaxyApp.test.tsx
```

Expected: compile report states 30 events, unique IDs, nonzero people/sources, and tests pass.

```bash
git add scripts history-content src/history/events.ts src/history/toolchain.test.ts package.json .gitignore
git commit -m "feat: compile versioned history archives"
```

---

### Task 4: Load Compact Indexes and Era Bundles Lazily

**Files:**
- Create: `src/history/content/loader.ts`
- Create: `src/history/content/loader.test.ts`
- Create: `src/history/content/store.tsx`
- Create: `src/history/content/store.test.tsx`
- Modify: `src/HistoryGalaxyApp.tsx`

**Interfaces:**
- Produces `loadHistoryManifest()`, `loadEventIndex()`, `loadPeopleIndex()`, and `loadEraBundle(eraId)`.
- Produces `HistoryContentProvider` and `useHistoryContent()` with `getEventArchive`, `getPersonArchive`, retry, loading, and error state.

- [ ] **Step 1: Write fetch/cache/failure tests**

Mock `fetch` and assert compact indexes load once, concurrent era requests share one promise, a rejected request is evicted for retry, and an invalid bundle becomes a typed `HistoryContentError` without discarding already loaded eras.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/content/loader.test.ts src/history/content/store.test.tsx`

Expected: FAIL because loader/store are absent.

- [ ] **Step 3: Implement loader and provider**

Use an injected `fetchImpl` for tests. Validate downloaded JSON with Task 2 schemas before caching. Expose era-specific retry rather than a global reset.

- [ ] **Step 4: Wire the provider without changing visible behavior**

Wrap `HistoryGalaxyApp` contents in `HistoryContentProvider`. Until Task 8, pass the compact `events` array into existing scene/navigation components.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run src/history/content src/HistoryGalaxyApp.test.tsx`

```bash
git add src/history/content src/HistoryGalaxyApp.tsx
git commit -m "feat: lazy load history content bundles"
```

---

### Task 5: Add Shareable Archive Routes

**Files:**
- Modify: `src/routes.ts`
- Modify: `src/routes.test.ts`
- Modify: `src/App.tsx`
- Create: `src/components/archive/ArchiveShell.tsx`
- Create: `src/components/archive/ArchiveNotFound.tsx`
- Create: `src/components/archive/ArchiveRoutes.test.tsx`

**Interfaces:**
- Produces route variants `history-event`, `history-person`, and `history-theme` with validated kebab-case IDs.
- Produces `getHistoryReturnLocation()` and `restoreHistoryReturnLocation()`.

- [ ] **Step 1: Write exact route tests**

Assert parsing for the three specified Hash URL patterns, query preservation, invalid empty/uppercase/path-traversal IDs returning home/not-found, and browser Back returning to the stored galaxy URL.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/routes.test.ts src/components/archive/ArchiveRoutes.test.tsx`

- [ ] **Step 3: Implement route parsing and archive shell**

Use `URLSearchParams` for search/filter query state. Never inject IDs into filesystem paths; loader lookups use manifest maps only.

- [ ] **Step 4: Add loading, retry, and not-found states**

All states use Chinese copy and expose a `返回历史星河` link. An unknown ID must not trigger repeated era bundle requests.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run src/routes.test.ts src/components/archive/ArchiveRoutes.test.tsx src/App.test.tsx`

```bash
git add src/routes.ts src/routes.test.ts src/App.tsx src/components/archive
git commit -m "feat: add shareable history archive routes"
```

---

### Task 6: Implement Worker-Based Full-Text Search

**Files:**
- Create: `src/history/search/protocol.ts`
- Create: `src/history/search/search.worker.ts`
- Create: `src/history/search/client.ts`
- Create: `src/history/search/client.test.ts`
- Create: `src/history/search/fallback.ts`

**Interfaces:**
- Produces `HistorySearchClient.query({ text, filters, limit }): Promise<SearchResult[]>`.
- Produces deterministic fallback title/person/alias prefix search after worker failure.

- [ ] **Step 1: Write search protocol tests**

Use a fake Worker to assert initialization, request IDs, stale result suppression, Chinese n-gram queries for `安史之乱`, alias query `秦皇`, ancient place query `长安`, combined category/year filters, and fallback after worker error.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/search/client.test.ts`

- [ ] **Step 3: Implement MiniSearch worker**

Index title, aliases, normalized search text, person names, place names, theme names, and summary. Rank exact title, alias, and person matches above prose matches; break ties by influence descending and representative year ascending.

- [ ] **Step 4: Implement fallback and client cleanup**

Terminate the worker on provider unmount, reject unresolved queries with `AbortError`, and switch permanently to prefix fallback for the current page session after an unrecoverable worker error.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --run src/history/search/client.test.ts
git add src/history/search
git commit -m "feat: add local history search worker"
```

---

### Task 7: Define URL-Backed Explorer State and Semantic LOD

**Files:**
- Create: `src/history/explorer/state.ts`
- Create: `src/history/explorer/state.test.ts`
- Create: `src/history/lod.ts`
- Create: `src/history/lod.test.ts`
- Modify: `src/history/space.ts`
- Modify: `src/history/space.test.ts`

**Interfaces:**
- Produces `parseExplorerState`, `serializeExplorerState`, `filterEvents`, and `HistoryExplorerState`.
- Produces `getLodLevel(cameraDistance)`, `getVisibilityBudget(level, mobile)`, and `selectProtectedEventIds`.
- Extends spatial mapping from approximate BCE start through 1949.

- [ ] **Step 1: Write state and LOD boundary tests**

Test exact query round trips for text, era, categories, people, places, influence, year range, major-only, viewport-only, and theme. Test four LOD bands with hysteresis: overview, era, period, close. Assert impact-5, selected, and search-target IDs are protected at every level.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/explorer/state.test.ts src/history/lod.test.ts src/history/space.test.ts`

- [ ] **Step 3: Implement URL state and dimming filters**

Return `match: boolean` and `opacity` rather than deleting unmatched events. Query keys are stable short names: `q`, `era`, `cat`, `person`, `place`, `min`, `from`, `to`, `major`, `view`, `theme`.

- [ ] **Step 4: Implement semantic LOD and BCE mapping**

Use logarithmic/piecewise year spacing so long early periods remain navigable without compressing 1840–1949 into a single point. Preserve monotonic `yearToX`/`xToYear` round trips within one displayed year.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --run src/history/explorer/state.test.ts src/history/lod.test.ts src/history/space.test.ts
git add src/history/explorer src/history/lod.ts src/history/lod.test.ts src/history/space.ts src/history/space.test.ts
git commit -m "feat: add semantic history navigation state"
```

---

### Task 8: Implement Semantic Screen-Space Clustering

**Files:**
- Create: `src/history/clustering/protocol.ts`
- Create: `src/history/clustering/cluster.worker.ts`
- Create: `src/history/clustering/cluster.ts`
- Create: `src/history/clustering/cluster.test.ts`
- Create: `src/history/clustering/client.ts`
- Create: `src/history/clustering/client.test.ts`

**Interfaces:**
- Consumes projected screen positions, LOD level, semantic group, protected IDs, viewport size, and previous cluster IDs.
- Produces stable `ClusterResult { clusters, singles, revision }` with bounds and focus target.

- [ ] **Step 1: Write deterministic clustering tests**

Assert nearby same-period/same-theme events merge; different semantic groups remain separate until overview; protected events stay single; offscreen events are omitted; resize changes pixel-radius outcomes; hysteresis keeps cluster identity across small zoom changes; stale worker revisions are discarded.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/clustering`

- [ ] **Step 3: Implement pure clustering with `d3-quadtree`**

Use radii 48px desktop and 40px mobile, adjusted by LOD. Stable cluster ID is a hash of sorted member IDs plus semantic group. Cluster bounds include padding used by camera focus.

- [ ] **Step 4: Add worker/client bridge**

Transfer numeric projection arrays, keep string metadata in compact tables, and process at most one queued projection per animation frame. Ignore replies older than the last applied revision.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --run src/history/clustering
git add src/history/clustering
git commit -m "feat: cluster history events by meaning and space"
```

---

### Task 9: Replace Per-Event Draw Calls with Batched Fields

**Files:**
- Create: `src/scene/InstancedEventField.tsx`
- Create: `src/scene/InstancedEventField.test.tsx`
- Create: `src/scene/ClusterField.tsx`
- Create: `src/scene/ClusterField.test.tsx`
- Modify: `src/scene/HistoryScene.tsx`
- Modify: `src/scene/CameraRig.tsx`
- Retain: `src/scene/EventStar.tsx` for selected/hovered promotion only

**Interfaces:**
- Consumes compact visible singles and clusters from Task 8.
- Produces instance raycast selection, cluster focus, drag promotion, and camera distance callbacks.

- [ ] **Step 1: Write renderer contract tests**

Mock R3F and assert 1200 input events produce a constant number of instanced meshes, instance ID maps to event ID, selected event is excluded from the batch and rendered as `EventStar`, cluster click calls `focusBounds`, and reduced-motion prevents ambient rotations.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/scene/InstancedEventField.test.tsx src/scene/ClusterField.test.tsx`

- [ ] **Step 3: Implement batched stars and cluster glyphs**

Use one instanced sphere field per visual category budget, instance color for category/era, matrix scale for influence, and a separate low-opacity halo field. Update matrices only when visibility/drag state changes, not every frame.

- [ ] **Step 4: Enable true camera zoom and cluster focus**

Replace `enableZoom={false}` with bounded dolly zoom. Map vertical wheel and pinch to dolly zoom; map `Shift` + wheel and horizontal trackpad deltas to timeline travel; keep pointer drag for orbit and event dragging according to hit target. Cluster focus animates camera/target to computed bounds; reduced motion jumps immediately. Add interaction tests for each mapping so zoom never silently becomes time travel.

- [ ] **Step 5: Preserve star dragging**

Promote the pointer-down instance into `EventStar`, apply drag offset, then return it to the batch after release unless selected. Persist only user-fixed offsets.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- --run src/scene src/history/clustering src/history/lod.test.ts
git add src/scene
git commit -m "feat: render clustered history star fields"
```

---

### Task 10: Build the History Explorer UI

**Files:**
- Create: `src/components/HistoryExplorer.tsx`
- Create: `src/components/HistoryExplorer.test.tsx`
- Create: `src/components/FilterPanel.tsx`
- Create: `src/components/SearchResults.tsx`
- Modify: `src/HistoryGalaxyApp.tsx`
- Modify: `src/history-galaxy.css`

**Interfaces:**
- Consumes Task 6 search and Task 7 explorer state.
- Produces desktop collapsible explorer, mobile four-view drawer, search-to-camera focus, and filter dimming.

- [ ] **Step 1: Write full interaction tests**

Assert Chinese search, result ranking, URL query updates, combined category/year/impact filters, major-only and viewport-only toggles, clear filters, result focus, mobile tabs `事件 / 搜索 / 筛选 / 专题`, and keyboard focus restoration after drawer close.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/components/HistoryExplorer.test.tsx`

- [ ] **Step 3: Build operational controls**

Use search icon/input, checkboxes/toggles for binary modes, segmented buttons for mobile views, native range inputs for years, and menus for option sets. Do not nest cards; the explorer is an unframed work panel.

- [ ] **Step 4: Integrate with scene and URL**

Debounce URL writes by 150ms while search typing, update immediately for explicit filter clicks, and use `replaceState` for transient search state so Back navigation remains meaningful.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --run src/components/HistoryExplorer.test.tsx src/HistoryGalaxyApp.test.tsx
git add src/components/HistoryExplorer.tsx src/components/HistoryExplorer.test.tsx src/components/FilterPanel.tsx src/components/SearchResults.tsx src/HistoryGalaxyApp.tsx src/history-galaxy.css
git commit -m "feat: add full history explorer"
```

---

### Task 11: Build Quick Details and Full Archives

**Files:**
- Replace: `src/components/StoryPanel.tsx`
- Create: `src/components/QuickEventPanel.tsx`
- Create: `src/components/QuickEventPanel.test.tsx`
- Create: `src/components/archive/EventArchive.tsx`
- Create: `src/components/archive/PersonArchive.tsx`
- Create: `src/components/archive/ThemeArchive.tsx`
- Create: `src/components/archive/SourcesList.tsx`
- Create: `src/components/archive/ArchiveViews.test.tsx`
- Modify: `src/history-galaxy.css`

**Interfaces:**
- Consumes lazy archives from Task 4 and routes from Task 5.
- Produces quick summary, complete event/person/theme views, bidirectional links, and source lists.

- [ ] **Step 1: Write archive behavior tests**

Assert quick panel summary, cause/result/impact, 3–6 people, related events, previous/next, full archive link; event archive section headings; person timeline/relations/events; theme ordered journey; secure external source attributes; loading/retry/not-found; and returning restores the previous galaxy URL.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/components/QuickEventPanel.test.tsx src/components/archive/ArchiveViews.test.tsx`

- [ ] **Step 3: Implement quick panel and archive views**

Render Markdown through `react-markdown` with raw HTML disabled. External links receive `target="_blank" rel="noopener noreferrer"`. Archive headings match the approved Chinese structure exactly.

- [ ] **Step 4: Add relationship navigation**

Every person/event/place/theme ID resolves through manifest maps. Missing optional related records render `资料整理中` without breaking the primary archive; missing primary record uses `ArchiveNotFound`.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --run src/components/QuickEventPanel.test.tsx src/components/archive src/HistoryGalaxyApp.test.tsx
git add src/components/QuickEventPanel.tsx src/components/QuickEventPanel.test.tsx src/components/archive src/components/StoryPanel.tsx src/history-galaxy.css
git commit -m "feat: add history and person archives"
```

---

### Task 12: Complete Persistence and the 2D Fallback

**Files:**
- Create: `src/history/session.ts`
- Create: `src/history/session.test.ts`
- Create: `src/components/HistoryTimeline2D.tsx`
- Create: `src/components/HistoryTimeline2D.test.tsx`
- Modify: `src/HistoryGalaxyApp.tsx`
- Modify: `src/scene/SceneFallback.tsx`
- Modify: `src/history-galaxy.css`

**Interfaces:**
- Produces versioned `history-galaxy-session-v2` local state.
- Produces a complete 2D timeline consuming the same explorer/archive interfaces as WebGL.

- [ ] **Step 1: Write persistence and fallback tests**

Test schema-version rejection, safe localStorage parse, camera/filter/selection/fixed-offset round trip, URL filters overriding stored filters, WebGL failure showing search/filter/event selection, BCE labels, cluster-like grouped periods, archive entry, and keyboard previous/next.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/session.test.ts src/components/HistoryTimeline2D.test.tsx`

- [ ] **Step 3: Implement versioned persistence**

Persist only serializable camera target/distance, explorer state, selected event ID, and fixed offsets. Clamp restored numeric values and drop IDs absent from the current manifest.

- [ ] **Step 4: Implement the full 2D timeline**

Use virtualized era sections only if measured content exceeds 200 rendered rows; otherwise render grouped semantic periods with accessible buttons. The fallback must not show a dead-canvas error as its primary experience.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- --run src/history/session.test.ts src/components/HistoryTimeline2D.test.tsx src/HistoryGalaxyApp.test.tsx
git add src/history/session.ts src/history/session.test.ts src/components/HistoryTimeline2D.tsx src/components/HistoryTimeline2D.test.tsx src/HistoryGalaxyApp.tsx src/scene/SceneFallback.tsx src/history-galaxy.css
git commit -m "feat: add persistent 2D history exploration"
```

---

### Task 13: Verify the Engine at 1200-Event Scale

**Files:**
- Create: `src/history/fixtures/generateScaleFixture.ts`
- Create: `src/history/performance.test.ts`
- Modify: `src/HistoryGalaxyApp.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Produces deterministic 1200-event test data without shipping it to production.
- Produces automated correctness and browser evidence for desktop/mobile/WebGL fallback.

- [ ] **Step 1: Add scale and integration tests**

Generate 1200 deterministic records across all eras/categories. Assert overview visible singles + clusters remain within the configured budget, selected impact-5 events survive clustering, filtering/search/archive navigation work, and generated fixture is excluded from production imports.

- [ ] **Step 2: Run the fresh full suite and build**

Run:

```bash
npm run history:check
npm test -- --run
npm run build
git diff --check
```

Expected: all commands exit 0; production build contains era chunks and workers but not the scale fixture.

- [ ] **Step 3: Run Playwright browser verification**

At 1440×900 and 390×844 verify overview, cluster zoom, search focus, combined filters, quick panel, event/person archives, Back restoration, fixed drag offset, reduced motion, and forced WebGL failure. Record console errors, unexpected 404s, horizontal overflow, frame-duration sample, and heap snapshot before/after visiting five eras.

Acceptance:

- Desktop median animation frame under 20ms during a 10-second overview orbit.
- Mobile-emulated median animation frame under 34ms with reduced visual budget.
- No more than the configured LOD label budget appears.
- No selected/impact-5 event disappears into a cluster.
- No console error or unexpected network failure.

- [ ] **Step 4: Document the content system and commit**

README must explain source authoring, compile/check commands, generated output, archive routes, clustering/LOD design, search fallback, 2D fallback, and how later content phases add eras without engine changes.

```bash
git add src/history/fixtures src/history/performance.test.ts src/HistoryGalaxyApp.test.tsx README.md
git commit -m "test: verify history engine at encyclopedia scale"
```

- [ ] **Step 5: Push and preview only after explicit authorization**

Push the feature branch, open a PR, attach it to the task, wait for CI/Netlify preview, and repeat the browser smoke flow against preview. Do not merge or publish without explicit user authorization.
