# History Galaxy Phase 2 Early History Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish fully sourced Pre-Qin, Qin-Han, Wei-Jin Northern/Southern Dynasties, Sui, and Tang archives on the Phase 1 engine, with Tang as the encyclopedia-density benchmark.

**Architecture:** Content authors work only in versioned Markdown/JSON sources and source catalogs. The Phase 1 compiler generates runtime bundles; an editorial audit enforces category balance, prose completeness, people/event links, sources, aliases, and required anchor coverage before any batch can merge.

**Tech Stack:** Markdown Frontmatter, JSON, TypeScript content compiler, Zod, Vitest, MiniSearch indexes, Git review

**Spec:** `/Users/wangmenglong/Desktop/PrivateChat/docs/superpowers/specs/2026-11-10-history-galaxy-encyclopedia-design.md`

**Depends On:** Phase 1 engine plan completed and merged.

## Global Constraints

- Content follows mainstream textbook/general-history narration; obvious disputes receive a concise `historiography` note.
- Never invent quotations. Direct quotations require a source entry identifying edition and chapter/page when available.
- Each event has 1–3 source IDs; each person has at least one authoritative biographical source.
- Every event includes summary, background, causes, course, results, multidimensional impacts, people, places, relationships, and source IDs.
- Event/person/place relationships are bidirectional and compiler-valid.
- Public prose is Chinese; standard book titles, dynastic names, and technical identifiers retain their proper form.
- Content tasks use official institutions, recognized academic publishers, textbooks, authoritative general histories, or source editions; self-media is excluded.
- Existing event IDs remain stable. A renamed event uses `aliases`, never a destructive ID change.
- Each content task ends with `npm run history:check`, focused coverage tests, search smoke tests, and a reviewable audit report.

## File Structure

- `history-content/editorial/coverage.json`: required ranges, category floors, and anchor IDs.
- `history-content/editorial/style-guide.md`: prose, dates, names, quotations, disputes, and source rules.
- `scripts/history-audit.ts`: human-readable coverage/source/search report.
- `history-content/content/pre-qin/*`: Pre-Qin events and people.
- `history-content/content/qin-han/*`: Qin-Han events and people.
- `history-content/content/wei-jin/*`: Three Kingdoms through Northern/Southern Dynasties.
- `history-content/content/sui-tang/*`: Sui and Tang content.
- `src/history/content/coverage.test.ts`: exact batch counts, category floors, and anchors.

---

### Task 1: Add Editorial Coverage and Audit Gates

**Files:**
- Create: `history-content/editorial/coverage.json`
- Create: `history-content/editorial/style-guide.md`
- Create: `scripts/history-audit.ts`
- Create: `scripts/history-audit.test.ts`
- Create: `src/history/content/test-helpers.ts`
- Create: `src/history/content/test-helpers.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `npm run history:audit` and `auditHistoryContent(compiled): AuditReport`.
- Produces per-era counts, category counts, influence distribution, prose lengths, source coverage, missing aliases, people counts, and search probes.
- Produces shared `expectEraCoverage`, `expectRequiredEvents`, `expectCategoryFloor`, and `overlapAtYear` test helpers used by Phases 2–4.

- [ ] **Step 1: Write failing audit tests**

```ts
expect(auditHistoryContent(validCompiled)).toMatchObject({
  errors: [],
  eras: { 'pre-qin': { eventCount: 2, sourcedEventCount: 2 } }
});
expect(auditHistoryContent(unbalancedCompiled).errors).toContain('pre-qin 缺少 science 类事件');
expect(auditHistoryContent(shortArchive).errors).toContain('事件 test-event 的 background 少于 80 个汉字');
```

Assert minimum Chinese character counts: summary 60, background 80, combined course descriptions 100, combined results 40, combined impacts 80, person overview 120. These are quality floors, not target lengths.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run scripts/history-audit.test.ts`

- [ ] **Step 3: Implement the audit and exact coverage configuration**

`coverage.json` defines Phase 2 ranges: Pre-Qin 100–130, Qin-Han 90–120, Wei-Jin 80–110, Sui 15–25, Tang 105–135. For every era, require nonzero events in all eleven approved categories and at least 15% influence 4–5 events but no more than 35% influence 5.

Implement the shared helpers against the compiled corpus, with exact signatures:

```ts
export function expectEraCoverage(
  compiled: CompiledHistory,
  eraId: string,
  expected: { events: [number, number]; people: [number, number]; required: string[] }
): void;
export function expectRequiredEvents(compiled: CompiledHistory, ids: string[]): void;
export function expectCategoryFloor(compiled: CompiledHistory, eraId: string, categories: CategoryId[]): void;
export function overlapAtYear(compiled: CompiledHistory, year: number): string[];
```

`expectEraCoverage` filters events by `eraId` and people by `primaryEraId`, applies inclusive min/max assertions, verifies required IDs, sources, and all configured category floors. This makes phase totals additive without double-counting a person whose lifespan crosses periods. `overlapAtYear` returns unique sorted polity IDs whose event ranges contain the year. Test inclusive boundaries, primary-era counting, and duplicate polity removal in `test-helpers.test.ts`.

- [ ] **Step 4: Write the editorial style guide**

Include exact rules for BCE display, approximate years, polity naming, person aliases, paragraph length, neutral wording, direct quotations, historiography, source IDs, parent/child granularity, and duplicate-event decisions. Include one complete event and person example using the Phase 1 schemas.

- [ ] **Step 5: Run and commit**

```bash
npm test -- --run scripts/history-audit.test.ts
npm run history:audit
git add history-content/editorial scripts/history-audit.ts scripts/history-audit.test.ts src/history/content/test-helpers.ts src/history/content/test-helpers.test.ts package.json
git commit -m "build: add history editorial audit gates"
```

---

### Task 2: Curate the Pre-Qin Archive

**Files:**
- Create: `history-content/content/pre-qin/events/*.md`
- Create: `history-content/content/pre-qin/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/pre-qin.test.ts`

**Interfaces:**
- Produces 100–130 Pre-Qin main events and 180–260 linked people.
- Produces aliases and locations for ancient polities, capitals, thinkers, and archaeological cultures.

- [ ] **Step 1: Write the failing batch acceptance test**

Assert event range, people range, all categories represented, every event sourced, and required anchor IDs:

```ts
const required = [
  'erlitou-culture', 'shang-dynasty', 'oracle-bone-script', 'western-zhou-feudal-order',
  'king-ping-moves-east', 'spring-autumn-hegemony', 'confucius-teaching', 'hundred-schools',
  'shang-yang-reforms', 'battle-of-guiling', 'battle-of-changping', 'qin-unification-wars'
];
expectEraCoverage(compiled, 'pre-qin', { events: [100, 130], people: [180, 260], required });
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/content/pre-qin.test.ts`

- [ ] **Step 3: Build the chronological event catalog before prose**

Cover early cultures/traditional dynastic narrative, Shang state and writing, Western/Eastern Zhou, Spring and Autumn interstate order, Warring States reforms/wars, philosophy, ritual, technology, agriculture, commerce, astronomy, medicine, literature, religion, diplomacy, ethnicity, and social organization. Assign parent/child relationships before writing archives so battles and reform measures do not become duplicate main events.

- [ ] **Step 4: Write and source all event/person archives**

Use mainstream narration and add concise historiography for traditional chronology, Xia/Erlitou correspondence, ancient texts written later than described events, and disputed biographies. Every direct classical quotation names the source edition.

- [ ] **Step 5: Verify search and relationships**

Search probes must return relevant records for `夏`, `甲骨文`, `孔子`, `百家争鸣`, `商鞅变法`, `长平之战`, `咸阳`, and alias `秦王政`.

- [ ] **Step 6: Run and commit**

```bash
npm run history:check
npm run history:audit
npm test -- --run src/history/content/pre-qin.test.ts src/history/search
git add history-content/content/pre-qin history-content/manifest src/history/content/pre-qin.test.ts
git commit -m "content: add sourced Pre-Qin history archive"
```

---

### Task 3: Curate the Qin-Han Archive

**Files:**
- Create: `history-content/content/qin-han/events/*.md`
- Create: `history-content/content/qin-han/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/qin-han.test.ts`

**Interfaces:**
- Produces 90–120 Qin-Han main events and 170–240 linked people.

- [ ] **Step 1: Write exact acceptance tests**

Require anchors:

```ts
const required = [
  'qin-unifies-china', 'commandery-county-system', 'standardization-qin', 'chen-sheng-wu-guang',
  'chu-han-contention', 'han-dynasty-founded', 'wen-jing-rule', 'reduction-of-vassal-states',
  'zhang-qian-western-regions', 'han-wudi-reforms', 'silk-road-formation', 'wang-mang-reforms',
  'eastern-han-restoration', 'paper-making-development', 'yellow-turban-uprising'
];
expectEraCoverage(compiled, 'qin-han', { events: [90, 120], people: [170, 240], required });
```

- [ ] **Step 2: Run RED, then author catalog and archives**

Cover Qin institutions and collapse, Chu-Han, Western/Eastern Han politics, frontier/diplomacy, Silk Road, Confucian state ideology, land/tax/economy, technology/medicine/astronomy, historiography/literature, court factions, local society, rebellions, and state decline.

- [ ] **Step 3: Verify parallel events and aliases**

Model Xiongnu and Western Regions events as parallel/diplomatic relations rather than treating the Han court as the only timeline. Search probes include `汉武帝`, `张骞`, `丝绸之路`, `造纸术`, `匈奴`, `王莽`, `洛阳`.

- [ ] **Step 4: Run and commit**

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/qin-han.test.ts src/history/search
git add history-content/content/qin-han history-content/manifest src/history/content/qin-han.test.ts
git commit -m "content: add sourced Qin-Han history archive"
```

---

### Task 4: Curate the Wei-Jin Northern/Southern Dynasties Archive

**Files:**
- Create: `history-content/content/wei-jin/events/*.md`
- Create: `history-content/content/wei-jin/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/wei-jin.test.ts`

**Interfaces:**
- Produces 80–110 main events and 160–230 people across parallel polities.

- [ ] **Step 1: Write exact acceptance tests**

```ts
const required = [
  'yellow-turban-uprising', 'battle-of-guandu', 'battle-of-red-cliffs', 'three-kingdoms-formation',
  'western-jin-unification', 'war-of-eight-princes', 'yongjia-disaster', 'eastern-jin-founded',
  'battle-of-fei-river', 'liu-yu-replaces-jin', 'northern-wei-unification', 'xiaowen-reforms',
  'buddhism-spreads-wei-jin', 'jiangnan-development'
];
expectEraCoverage(compiled, 'wei-jin', { events: [80, 110], people: [160, 230], required });
```

- [ ] **Step 2: Run RED, then author balanced parallel-polity content**

Use polity IDs and parallel relations for Wei, Shu, Wu, Jin, Sixteen Kingdoms, Northern Dynasties, and Southern Dynasties. Cover population migration, land systems, ethnic integration, Buddhism/Daoism, metaphysics, literature/calligraphy, agriculture/technology, and state institutions alongside wars.

- [ ] **Step 3: Verify searches and chronology**

Search probes include `曹操`, `赤壁`, `八王之乱`, `淝水`, `北魏孝文帝`, `均田制`, `竹林七贤`, `龙门石窟`. Assert simultaneous polity filters do not force a false single-dynasty sequence.

- [ ] **Step 4: Run and commit**

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/wei-jin.test.ts src/history/search
git add history-content/content/wei-jin history-content/manifest src/history/content/wei-jin.test.ts
git commit -m "content: add sourced Wei-Jin history archive"
```

---

### Task 5: Curate Sui and the Full-Density Tang Archive

**Files:**
- Create: `history-content/content/sui-tang/events/*.md`
- Create: `history-content/content/sui-tang/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/sui-tang.test.ts`

**Interfaces:**
- Produces 15–25 Sui events, 105–135 Tang events, and 260–380 linked people.
- Reuses all migrated Tang IDs from the original experience.

- [ ] **Step 1: Write exact density and anchor tests**

Require all original Tang IDs plus:

```ts
const required = [
  'sui-unifies-china', 'grand-canal-sui', 'imperial-examination-sui', 'sui-goguryeo-wars',
  'tang-founded', 'xuanwu-gate-incident', 'zhenguan-rule', 'tang-tibet-relations',
  'wu-zetian-reign', 'kaiyuan-prosperity', 'equal-field-system-tang', 'three-departments-six-ministries',
  'chang-an-international-city', 'tang-poetry-flourishes', 'buddhism-tang', 'printing-development-tang',
  'anshi-rebellion', 'fanzhen-separatism', 'two-tax-law', 'yongzhen-reform', 'huichang-suppression',
  'huang-chao-uprising', 'tang-dynasty-falls'
];
expectEraCoverage(compiled, 'sui-tang', { events: [120, 160], people: [260, 380], required });
const tangEvents = compiled.events.filter((event) => event.polityIds.includes('tang'));
expect(tangEvents.length).toBeGreaterThanOrEqual(105);
expect(tangEvents.length).toBeLessThanOrEqual(135);
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- --run src/history/content/sui-tang.test.ts`

- [ ] **Step 3: Build the Sui-Tang catalog across every approved category**

Tang content must include central/local institutions, succession and court politics, frontier wars and diplomacy, Turkic/Tibetan/Western Regions relations, land/tax/military systems, agriculture/commerce/urban life, Silk Road/maritime exchange, religions, literature/art/music, historiography, medicine/astronomy/printing, women and family, social mobility, disasters and popular uprisings.

- [ ] **Step 4: Expand An-Shi and other complex events through child archives**

Keep `anshi-rebellion` as a main event; model uprising, Chang'an/Luoyang capture, Mawei incident, recovery of capitals, leadership transitions, and aftermath as ordered children. Apply the same hierarchy to Sui reunification, Goguryeo wars, Tang-Tibet relations, and Huang Chao uprising.

- [ ] **Step 5: Verify people biographies and aliases**

Search probes include emperors, empresses, ministers, generals, poets, monks, scientists, diplomats, merchants, and rebels. Required aliases include temple names and common forms such as `李世民 / 唐太宗`, `武曌 / 武则天`, `李隆基 / 唐玄宗`.

- [ ] **Step 6: Run and commit**

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/sui-tang.test.ts src/history/search src/history/clustering
git add history-content/content/sui-tang history-content/manifest src/history/content/sui-tang.test.ts
git commit -m "content: add full-density Sui-Tang archive"
```

---

### Task 6: Publish Early-History Theme Journeys

**Files:**
- Modify: `history-content/manifest/themes.json`
- Create: `history-content/themes/unification-early.json`
- Create: `history-content/themes/institutions-early.json`
- Create: `history-content/themes/silk-road-early.json`
- Create: `history-content/themes/thought-religion-early.json`
- Create: `history-content/themes/science-culture-early.json`
- Create: `src/history/content/early-themes.test.ts`

**Interfaces:**
- Produces five ordered, playable journeys across Phase 2 content.

- [ ] **Step 1: Write theme integrity tests**

Assert each journey has 12–30 unique events, chronological ordering unless an explicit section break resets chronology, Chinese chapter narration, a valid recommended camera LOD, and coverage from at least three Phase 2 eras.

- [ ] **Step 2: Run RED, author routes, and verify archive links**

Journeys are: early unification/division, institutions and state formation, Silk Road/external exchange, thought/religion, and science/culture. Every event/person link resolves through compiled manifests.

- [ ] **Step 3: Run and commit**

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/early-themes.test.ts src/components/archive
git add history-content/manifest/themes.json history-content/themes src/history/content/early-themes.test.ts
git commit -m "content: add early China theme journeys"
```

---

### Task 7: Complete Phase 2 Content and Browser Audit

**Files:**
- Modify: `README.md`
- Create: `docs/history-content/phase-2-audit.md`

- [ ] **Step 1: Run the complete content and application gates**

```bash
npm run history:check
npm run history:audit
npm test -- --run
npm run build
git diff --check
```

Expected total Phase 2 content: 390–520 events across the five early-history chronology bands, 770–1110 uniquely primary-assigned people, all eleven categories represented in every major era, and zero compiler/audit errors.

- [ ] **Step 2: Run browser sampling**

At desktop/mobile and WebGL/2D fallback, sample at least five events and three people per era, every required anchor search, all five themes, BCE sorting, cluster expansion, event/person archive links, Back restoration, and source links. Record any content correction as a source commit before final verification.

- [ ] **Step 3: Write the audit record**

Record exact counts, category distribution, source counts/types, search probes, sampled IDs, browser screenshots, performance results, and known nonblocking editorial notes. The report must contain no unresolved broken links or missing required sections.

- [ ] **Step 4: Commit and preview after authorization**

```bash
git add README.md docs/history-content/phase-2-audit.md
git commit -m "docs: audit early history encyclopedia content"
```

Push/open preview only after explicit authorization; do not merge until the audit and CI pass.
