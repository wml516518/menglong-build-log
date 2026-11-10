# History Galaxy Phase 4 Modern History and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete 1840–1949 content, finish all ten cross-era journeys, audit the full 815–1095-event / 1500–2500-person encyclopedia, and release a verified desktop/mobile/WebGL/2D experience.

**Architecture:** Modern-history archives use the same static content pipeline and relation model as earlier phases. Final release work adds offline source-link status, whole-corpus duplication/editorial audits, full-scale browser/performance/canvas verification, documentation, preview deployment, and production smoke checks.

**Tech Stack:** Markdown Frontmatter, JSON, TypeScript compiler/audit, MiniSearch, Three.js, React, Vitest, Playwright, Netlify

**Spec:** `/Users/wangmenglong/Desktop/PrivateChat/docs/superpowers/specs/2026-11-10-history-galaxy-encyclopedia-design.md`

**Depends On:** Phases 1–3 completed and merged.

## Global Constraints

- The historical endpoint is 1949; later events are out of scope.
- Modern-history prose follows mainstream historical chronology, distinguishes event description from evaluation, and sources casualty/scale claims.
- Political organizations, wars, treaties, social movements, intellectual history, economy, science, education, culture, diplomacy, ethnicity, and daily life all receive coverage.
- Every event and person retains the Phase 2 source/quality requirements.
- Final main-event count is 815–1095 and final person count is 1500–2500; excess micro-events must become children, not silently deleted.
- Final release requires WebGL canvas pixel evidence, desktop/mobile screenshots, console/network checks, 2D fallback, reduced motion, keyboard navigation, and performance budgets.
- Preview push/PR, merge, and production deployment remain separate authorization gates.

---

### Task 1: Curate the 1840–1911 Archive

**Files:**
- Create: `history-content/content/modern/events/*.md`
- Create: `history-content/content/modern/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/modern-late-qing.test.ts`

**Interfaces:**
- Produces the first half of the 110–145-event modern archive and shared people used by Task 2.

- [ ] **Step 1: Write failing anchor and balance tests**

Require:

```ts
const required = [
  'first-opium-war', 'treaty-of-nanjing', 'taiping-heavenly-kingdom', 'second-opium-war',
  'self-strengthening-movement', 'modern-industry-late-qing', 'westernization-education',
  'sino-french-war', 'sino-japanese-war-1894', 'treaty-of-shimonoseki', 'hundred-days-reform',
  'boxer-movement', 'eight-nation-alliance', 'new-policies-late-qing', 'abolition-imperial-exams',
  'railway-protection-movement', 'wuchang-uprising', 'xinhai-revolution'
];
expectRequiredEvents(compiled, required);
expectCategoryFloor(compiled, 'modern', ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society']);
```

- [ ] **Step 2: Run RED and author late-Qing event/person catalog**

Cover treaty-system changes, internal wars, state reconstruction, industry/military modernization, frontier crises, diplomacy, fiscal/social change, education/press/translation, science/medicine, reform/revolutionary thought, literature/art, women and social organizations, overseas Chinese, popular movements and the end of imperial rule.

- [ ] **Step 3: Model wars/reforms with ordered children**

Opium Wars, Taiping conflict, Self-Strengthening, Sino-Japanese War, Hundred Days, Boxer crisis, New Policies and Xinhai use parent archives plus sourced children. Treaty consequences link to the relevant war rather than becoming detached duplicates.

- [ ] **Step 4: Verify search and commit**

Search probes: `林则徐`, `南京条约`, `太平天国`, `洋务运动`, `轮船招商局`, `甲午战争`, `戊戌变法`, `义和团`, `废除科举`, `武昌起义`.

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/modern-late-qing.test.ts src/history/search
git add history-content/content/modern history-content/manifest src/history/content/modern-late-qing.test.ts
git commit -m "content: add late Qing modern history archive"
```

---

### Task 2: Curate the 1912–1949 Archive

**Files:**
- Modify: `history-content/content/modern/events/*.md`
- Modify: `history-content/content/modern/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/modern-republic.test.ts`

**Interfaces:**
- Completes 110–145 modern events total and brings whole-corpus people to 1500–2500.

- [ ] **Step 1: Write failing total and anchor tests**

Require:

```ts
const required = [
  'republic-of-china-founded', 'second-revolution-1913', 'new-culture-movement', 'may-fourth-movement',
  'communist-party-founded', 'first-united-front', 'northern-expedition', 'nanjing-government-founded',
  'rural-reconstruction-movement', 'september-18-incident', 'long-march', 'xian-incident',
  'full-scale-war-resistance', 'nanjing-massacre', 'wartime-industry-migration', 'second-united-front',
  'victory-war-resistance-1945', 'chongqing-negotiations', 'civil-war-1946-1949', 'prc-founded-1949'
];
expectEraCoverage(compiled, 'modern', { events: [110, 145], people: [180, 300], required });
```

- [ ] **Step 2: Run RED and author balanced archives through 1949**

Cover state-building and political fragmentation, parties and social organizations, intellectual/cultural movements, education/science/press/cinema, economic and urban/rural change, labor/women/youth movements, diplomacy, Japanese aggression and resistance, wartime society, ethnic/frontier affairs, postwar negotiations/conflict and 1949 state transition.

- [ ] **Step 3: Apply neutral structure and source quantitative claims**

Separate chronology, actors' stated positions, consequences, and later evaluation. Casualty, population, economic and territorial claims require a source ID and a historiography note when authoritative estimates differ.

- [ ] **Step 4: Verify aliases/search and commit**

Search probes: `新文化运动`, `五四`, `北伐`, `九一八`, `西安事变`, `全面抗战`, `南京大屠杀`, `工业内迁`, `抗战胜利`, `重庆谈判`, `1949`.

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/modern-republic.test.ts src/history/search src/components/archive
git add history-content/content/modern history-content/manifest src/history/content/modern-republic.test.ts
git commit -m "content: complete modern history through 1949"
```

---

### Task 3: Complete the Ten Cross-Era Theme Journeys

**Files:**
- Modify: `history-content/manifest/themes.json`
- Create: `history-content/themes/unification-division.json`
- Create: `history-content/themes/central-government.json`
- Create: `history-content/themes/land-tax.json`
- Create: `history-content/themes/examinations-bureaucracy.json`
- Create: `history-content/themes/silk-road-exchange.json`
- Create: `history-content/themes/northern-peoples.json`
- Create: `history-content/themes/science-technology.json`
- Create: `history-content/themes/confucian-buddhist-daoist.json`
- Create: `history-content/themes/literature-art.json`
- Create: `history-content/themes/modernization-national-crisis.json`
- Create: `src/history/content/all-themes.test.ts`

**Interfaces:**
- Produces exactly ten canonical theme IDs matching the approved specification.

- [ ] **Step 1: Write failing whole-theme tests**

Assert exactly ten canonical journeys; each contains 18–45 unique event IDs, 4–10 narrated chapters, valid camera targets, at least four historical eras where the topic permits, and no unresolved archive/person/source links.

- [ ] **Step 2: Consolidate earlier provisional journeys**

Reuse and rename Phase 2/3 journeys into the canonical ten; remove duplicate provisional files only after every incoming route/link is migrated. Preserve stable public theme IDs once published.

- [ ] **Step 3: Author the modern journey and cross-era bridges**

The modernization/national-crisis route runs from late-Qing external pressure and internal reform through 1949. Other journeys extend into modern content when historically relevant, such as examinations ending in 1905 and science/technology institutions changing in the modern period.

- [ ] **Step 4: Run and commit**

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/all-themes.test.ts src/components/archive
git add history-content/manifest/themes.json history-content/themes src/history/content/all-themes.test.ts
git commit -m "content: complete cross-era history journeys"
```

---

### Task 4: Add Whole-Corpus Source and Duplicate Auditing

**Files:**
- Create: `scripts/check-history-links.ts`
- Create: `scripts/check-history-links.test.ts`
- Create: `history-content/editorial/source-link-status.json`
- Modify: `scripts/history-audit.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `npm run history:links` and cached status records `{ sourceId, url, checkedAt, status }`.
- Produces duplicate candidates using normalized title/alias/year overlap and prose similarity.

- [ ] **Step 1: Write failing offline audit tests**

```ts
expect(findDuplicateCandidates([
  { id: 'a', title: '安史之乱', aliases: [], startYear: 755, endYear: 763 },
  { id: 'b', title: '安史之乱爆发', aliases: ['安史之乱'], startYear: 755, endYear: 755 }
])).toEqual([{ left: 'a', right: 'b', reasons: ['alias-title', 'year-overlap'] }]);

expect(validateLinkCache(sources, cache, new Date('2026-11-10'))).toEqual([]);
```

Cache entries older than 180 days, missing source IDs, insecure URLs, and non-2xx/3xx recorded statuses are audit errors. Runtime/build does not perform network access.

- [ ] **Step 2: Run RED and implement deterministic offline checks**

`history:links` optionally refreshes links only when invoked explicitly with `--refresh`; normal CI validates the committed cache. Use HEAD with GET fallback, bounded concurrency 4, 10-second timeout, and no credential forwarding.

- [ ] **Step 3: Review every duplicate candidate**

Resolve candidates by merging duplicates, converting detailed stages to child events, or recording an explicit `notDuplicateOf` relationship with a Chinese reason. The final audit must report zero unreviewed candidates.

- [ ] **Step 4: Run and commit**

```bash
npm test -- --run scripts/check-history-links.test.ts scripts/history-audit.test.ts
npm run history:links
npm run history:audit
git add scripts/check-history-links.ts scripts/check-history-links.test.ts scripts/history-audit.ts history-content/editorial/source-link-status.json package.json
git commit -m "build: audit history sources and duplicates"
```

---

### Task 5: Run the Final Content Completeness Audit

**Files:**
- Create: `src/history/content/final-coverage.test.ts`
- Create: `docs/history-content/final-content-audit.md`

- [ ] **Step 1: Write exact final coverage assertions**

```ts
expect(compiled.events.length).toBeGreaterThanOrEqual(815);
expect(compiled.events.length).toBeLessThanOrEqual(1095);
expect(compiled.people.length).toBeGreaterThanOrEqual(1500);
expect(compiled.people.length).toBeLessThanOrEqual(2500);
expect(compiled.events[0].startYear).toBeLessThan(0);
expect(compiled.events.at(-1)?.endYear).toBe(1949);
expect(audit.errors).toEqual([]);
expect(unreviewedDuplicateCandidates).toEqual([]);
```

Also assert every major era and all eleven categories have content, every event/person is sourced, all required anchors from Phases 2–4 exist, all ten themes compile, and no event extends after 1949.

- [ ] **Step 2: Run complete content gates**

```bash
npm run history:check
npm run history:audit
npm run history:links
npm test -- --run src/history/content scripts
```

- [ ] **Step 3: Perform stratified editorial sampling**

Sample at least 10 events and 5 people from every era, with at least one item from every category per era across the sample. Verify chronology, readability, source relevance, aliases, relationship links, archive rendering and historiography. Record every sampled ID and correction commit in `final-content-audit.md`.

- [ ] **Step 4: Commit the clean audit**

```bash
git add src/history/content/final-coverage.test.ts docs/history-content/final-content-audit.md
git commit -m "test: verify complete history encyclopedia corpus"
```

---

### Task 6: Run Full-Scale Visual, Canvas, and Performance Verification

**Files:**
- Create: `e2e/history-galaxy.spec.ts`
- Create: `e2e/history-galaxy-performance.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `docs/history-content/final-technical-audit.md`

**Interfaces:**
- Produces repeatable Playwright coverage and named desktop/mobile/WebGL/2D evidence.

- [ ] **Step 1: Install Playwright and add test contracts**

Run `npm install -D @playwright/test@^1`, add `e2e: "playwright test"`, and configure `playwright.config.ts` to start the Vite preview on an unused fixed test port after `npm run build`. Do not depend on a developer's already-running server.

Test initial overview, four LOD levels, cluster focus/split, impact-5 persistence, search aliases, every filter type, quick panel, event/person/theme routes, Back restoration, drag/fix offset, local-state restore, mobile drawer, keyboard flow, reduced motion, worker failure, era-bundle retry and forced WebGL failure.

- [ ] **Step 2: Add canvas pixel and motion checks**

At 1440×900 and 390×844, capture two frames 500ms apart. Assert the canvas has non-background pixel variance above the documented threshold, the selected star region is nonblank, the overview camera frames the timeline, and non-reduced mode changes pixels while reduced mode remains stable except user actions.

- [ ] **Step 3: Measure performance**

During 10-second overview/era/close interactions, collect animation-frame durations and heap before/after five era loads. Require desktop median under 20ms, mobile-emulated median under 34ms, no sustained frame above 100ms during idle orbit, and no unbounded heap growth after closing archives.

- [ ] **Step 4: Run all local verification**

```bash
npm run history:check
npm run history:audit
npm run history:links
npm test -- --run
npm run build
npm run e2e
git diff --check
```

Check browser console, unexpected 404s, horizontal overflow, text clipping and controls at desktop/mobile. Save screenshots for overview, clustered era, close relationship network, quick panel, event/person archives, filters, theme journey and 2D fallback.

- [ ] **Step 5: Write technical audit and commit**

Document exact environment, counts, bundle sizes, worker timings, FPS/frame statistics, heap results, screenshots, console/network status and any nonblocking third-party warning.

```bash
git add e2e playwright.config.ts package.json package-lock.json docs/history-content/final-technical-audit.md
git commit -m "test: verify complete History Galaxy experience"
```

---

### Task 7: Finish Documentation, Preview, and Production Release

**Files:**
- Modify: `README.md`
- Modify: `src/metadata.ts`
- Modify: `src/metadata.test.ts`
- Modify: `src/content.ts`
- Modify: `src/content.test.ts`

- [ ] **Step 1: Update public and repository descriptions**

Describe the actual final event/person counts, Pre-Qin–1949 range, semantic zoom, dynamic clustering, search/filters, archives, sources, themes and 2D fallback. Remove the old `30 historical events` claim everywhere.

- [ ] **Step 2: Document authoring and maintenance**

README covers archive template, source rules, compile/check/audit/link commands, generated files, adding relationships/themes, performance budgets, local dev, testing, Netlify deployment and rollback.

- [ ] **Step 3: Run final fresh verification**

Run the Task 6 command block from a clean install/build environment and record exact totals in the two final audit documents.

- [ ] **Step 4: Push and open preview PR after explicit authorization**

Push the feature branch, open a PR against `main`, attach it to the task, wait for GitHub CI and Netlify Deploy Preview, then rerun a representative desktop/mobile/cloud preview smoke flow. Do not merge on failing audit, broken source cache, console errors or performance regression.

- [ ] **Step 5: Merge and production smoke only after explicit authorization**

After authorized merge, verify production metadata, overview canvas, cluster zoom, one BCE event, one Tang event, one modern event, person archive, theme route, search/filter, mobile drawer and 2D fallback. Record deployed commit and production evidence in the final report.
