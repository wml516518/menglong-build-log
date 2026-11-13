# History Galaxy 1200 Real Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish 1200 sourced Chinese-history events from pre-Qin through 1949, including 200 core archives and 1000 basic archives, through the existing History Galaxy search, filter, cluster, quick-panel, and archive flows.

**Architecture:** Add nine structured event catalogs as the single source of shared event metadata, then merge optional Markdown core details during the existing atomic compile. Generate a compact 1200-event first-load index plus lazy visual-era bundles; update the archive UI to render a discriminated basic/core event union without inventing missing prose.

**Tech Stack:** TypeScript, Zod 4, Node.js/tsx content compiler, JSON catalogs, YAML Markdown frontmatter, React 19, Vitest, Testing Library, Three.js, MiniSearch, d3-quadtree, Vite, Netlify.

**Spec:** `docs/superpowers/specs/2026-11-11-history-galaxy-1200-events-design.md`

## Global Constraints

- Production data must contain exactly 1200 real events and exactly 200 core events; test-generated scale fixtures are not production content.
- Period quotas are fixed at 170/130/120/160/170/70/130/130/120 events and 25/22/18/30/30/12/22/21/20 core events.
- Every event requires at least one `SourceReference` with a non-empty locator; every core event requires at least two distinct source IDs.
- Existing 30 events remain core records and retain their story, scene values, and person relationships.
- Event summaries are original Chinese summaries of 80–150 Chinese characters; do not copy source prose.
- Basic archives render only fields that exist. They must not synthesize causes, course, results, impacts, people, places, or relations.
- Current 3D LOD, clustering, camera, session, fallback, and visual styling remain unchanged except for data-contract compatibility.
- `history:check` is read-only; `history:compile` replaces generated roots atomically only after all validation succeeds.
- Intermediate content commits may contain fewer than 1200 records. The exact production quota gate is enabled only in Task 17, after all nine catalogs are complete.
- Run tests with `CI=true` before each phase review so Vitest uses the repository's stable two-worker CI limit.

## File Structure

- `src/history/content/schema.ts`: source and generated Zod contracts only.
- `scripts/history-content/catalog.ts`: JSON catalog and Markdown core-detail readers plus merge logic.
- `scripts/history-content/quality.ts`: quota, coverage, source, title, and suspected-duplicate checks.
- `scripts/history-content/generate.ts`: compact indexes, manifest v2, lazy bundles, compatibility output, and compile report.
- `scripts/history-content.ts`: CLI orchestration, reference integrity, and atomic output replacement.
- `history-content/catalog/events/*.json`: nine period-owned event metadata catalogs.
- `history-content/manifest/editorial-periods.json`: period IDs, ranges, final event/core quotas, and visual-era mapping rules.
- `history-content/manifest/sources.json`: normalized source bibliography.
- `history-content/manifest/places.json`, `polities.json`, `relations.json`: referenced entity registries.
- Existing visual-era event directories under `history-content/content/`: core-only narrative details keyed by catalog ID.
- `src/components/archive/EventArchive.tsx`: basic/core full archive rendering.
- `src/components/archive/SourcesList.tsx`: source-reference locator rendering.
- `src/components/QuickEventPanel.tsx`: basic/core quick panel rendering.
- `src/history/production-content.test.ts`: exact real-data quotas and production-integrity contract.

---

### Task 1: Define the Basic/Core Content Contracts

**Files:**
- Modify: `src/history/content/schema.ts`
- Modify: `src/history/content/schema.test.ts`

**Interfaces:**
- Produces: `sourceReferenceSchema`, `editorialPeriodSchema`, `basicEventRecordSchema`, `coreEventDetailsSchema`, `historyEventArchiveSchema`, `eventIndexSchema`.
- Produces types: `SourceReference`, `EditorialPeriod`, `BasicEventRecord`, `CoreEventDetails`, `HistoryEventArchive`, `CompactHistoryEventIndex`.
- Preserves: `eventArchiveSchema` as a named alias for the core branch until all existing imports migrate.

- [ ] **Step 1: Write failing schema tests**

Add tests that parse this minimum basic record and reject missing locators, unknown detail levels, summaries outside 80–150 Chinese characters, and raw HTML. Distinct core-source counts are a cross-record rule covered by Task 3:

```ts
const basic = {
  id: 'zhougong-regency', title: '周公摄政', aliases: ['周公辅成王'],
  startYear: -1042, endYear: -1035, yearPrecision: 'circa',
  editorialPeriodId: 'pre-qin', eraId: 'pre-qin', polityIds: ['western-zhou'],
  period: '西周初年', categories: ['politics', 'institution'], themeIds: [],
  influence: 4, summary: '周武王去世后，成王年幼，周公旦代行王政。面对管叔、蔡叔等联合武庚发动的叛乱，周公率军东征，随后营建洛邑、分封诸侯并整顿礼乐制度，帮助西周王朝稳定东方统治，也使摄政、宗法与礼制成为后世讨论早期国家治理的重要范例。',
  personIds: [], placeIds: [], parentId: null, childIds: [], relationIds: [],
  sourceRefs: [{ sourceId: 'bai-shouyi-general-history', locator: '第一卷，西周政治相关章节' }],
  color: '#bc9365', layout: { lane: 'politics', offset: [0, 0] }, detailLevel: 'basic'
};

expect(basicEventRecordSchema.parse(basic).detailLevel).toBe('basic');
expect(sourceReferenceSchema.safeParse({ sourceId: 'book', locator: '' }).success).toBe(false);
expect(coreEventDetailsSchema.safeParse({ id: basic.id, background: '背景', causes: [], course: [], results: [], impacts: [], historiography: '说明' }).success).toBe(false);
```

- [ ] **Step 2: Run the focused schema test and confirm RED**

Run: `npx vitest run src/history/content/schema.test.ts`

Expected: FAIL because the new schemas and types do not exist.

- [ ] **Step 3: Implement the discriminated contracts**

Define source ownership so source catalogs use `sourceRefs`, compact output derives `sourceIds`, and only `detailLevel: 'core'` records accept core narrative fields. Preserve the existing year, raw-HTML, self-parent, and course-range refinements.

```ts
export const sourceReferenceSchema = z.strictObject({
  sourceId: id,
  locator: prose,
  note: prose.optional()
});

const eventSummary = prose.refine(
  value => (value.match(/\p{Script=Han}/gu)?.length ?? 0) >= 80 && (value.match(/\p{Script=Han}/gu)?.length ?? 0) <= 150,
  'Event summary must contain 80–150 Chinese characters'
);

export const detailLevels = ['basic', 'core'] as const;
export const basicEventRecordSchema = z.strictObject({
  ...sharedEventFields,
  summary: eventSummary,
  editorialPeriodId: id,
  sourceRefs: z.array(sourceReferenceSchema).min(1),
  detailLevel: z.enum(detailLevels)
}).superRefine(validateEvent);

export const coreEventDetailsSchema = z.strictObject({
  id,
  background: prose,
  causes: z.array(prose).min(1),
  course: z.array(timelineEntry).min(1),
  results: z.array(prose).min(1),
  impacts: z.array(z.strictObject({ dimension: category, text: prose })).min(1),
  historiography: prose
});
```

- [ ] **Step 4: Run schema tests and TypeScript**

Run: `npx vitest run src/history/content/schema.test.ts && npx tsc -b --pretty false`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/history/content/schema.ts src/history/content/schema.test.ts
git commit -m "feat: define basic and core history records"
```

### Task 2: Read Catalogs and Merge Core Markdown

**Files:**
- Create: `scripts/history-content/catalog.ts`
- Create: `scripts/history-content/catalog.test.ts`
- Modify: `scripts/history-content.ts`
- Create: `history-content/manifest/editorial-periods.json`
- Create: `history-content/catalog/events/pre-qin.json`
- Create: `history-content/catalog/events/qin-han.json`
- Create: `history-content/catalog/events/wei-jin.json`
- Create: `history-content/catalog/events/sui-tang-five-dynasties.json`
- Create: `history-content/catalog/events/song-liao-jin-xia.json`
- Create: `history-content/catalog/events/yuan.json`
- Create: `history-content/catalog/events/ming.json`
- Create: `history-content/catalog/events/qing.json`
- Create: `history-content/catalog/events/modern.json`

**Interfaces:**
- Consumes: Task 1 schemas.
- Produces: `readEventCatalogs(sourceRoot): Promise<BasicEventRecord[]>`.
- Produces: `readCoreDetails(sourceRoot): Promise<Map<string, CoreEventDetails>>`.
- Produces: `mergeEventArchives(records, details): HistoryEventArchive[]`.

- [ ] **Step 1: Add failing catalog-reader tests**

Create temporary fixtures proving deterministic catalog ordering, JSON parse diagnostics, duplicate IDs across files, a core Markdown ID without a catalog record, a `core` catalog record without Markdown, and forbidden repeated metadata in Markdown.

```ts
await writeFile(join(root, 'catalog/events/pre-qin.json'), JSON.stringify([{ ...basic, detailLevel: 'core', sourceRefs: [...basic.sourceRefs, { sourceId: 'zhou-history', locator: '西周初年相关章节' }] }]));
await writeFile(join(root, 'content/pre-qin/events/zhougong-regency.md'), `---\nid: zhougong-regency\ncauses:\n  - 政权交接\ncourse:\n  - year: -1042\n    title: 摄政\n    description: 周公辅政。\nresults:\n  - 政局稳定\nimpacts:\n  - dimension: politics\n    text: 影响早期政治秩序。\nhistoriography: 年代采用约数。\n---\n西周初年面临权力交接。`);
expect((await mergeFixture(root))[0]).toMatchObject({ id: 'zhougong-regency', detailLevel: 'core', background: '西周初年面临权力交接。' });
```

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run scripts/history-content/catalog.test.ts`

Expected: FAIL because the reader module is absent.

- [ ] **Step 3: Implement focused readers and merge**

Move generic `readCatalog`, `markdownFiles`, alias normalization, and frontmatter parsing from `scripts/history-content.ts` into the new module. Core Markdown accepts only `id`, `causes`, `course`, `results`, `impacts`, `historiography`, with the body supplying `background`.

- [ ] **Step 4: Seed the nine files and editorial-period manifest**

Create empty arrays for the nine event catalogs and add exact period targets:

```json
[
  { "id": "pre-qin", "name": "先秦", "startYear": -2070, "endYear": -221, "eventTarget": 170, "coreTarget": 25 },
  { "id": "qin-han", "name": "秦汉", "startYear": -221, "endYear": 220, "eventTarget": 130, "coreTarget": 22 },
  { "id": "wei-jin", "name": "魏晋南北朝", "startYear": 220, "endYear": 589, "eventTarget": 120, "coreTarget": 18 },
  { "id": "sui-tang-five-dynasties", "name": "隋唐五代", "startYear": 581, "endYear": 960, "eventTarget": 160, "coreTarget": 30 },
  { "id": "song-liao-jin-xia", "name": "宋辽金夏", "startYear": 907, "endYear": 1279, "eventTarget": 170, "coreTarget": 30 },
  { "id": "yuan", "name": "元", "startYear": 1271, "endYear": 1368, "eventTarget": 70, "coreTarget": 12 },
  { "id": "ming", "name": "明", "startYear": 1368, "endYear": 1644, "eventTarget": 130, "coreTarget": 22 },
  { "id": "qing", "name": "清前中期", "startYear": 1644, "endYear": 1840, "eventTarget": 130, "coreTarget": 21 },
  { "id": "modern", "name": "近代史", "startYear": 1840, "endYear": 1949, "eventTarget": 120, "coreTarget": 20 }
]
```

- [ ] **Step 5: Run reader/compiler regression tests**

Run: `npx vitest run scripts/history-content/catalog.test.ts scripts/history-content.test.ts`

Expected: PASS while the existing Markdown path remains active until Task 6 migration.

- [ ] **Step 6: Commit**

```bash
git add scripts/history-content.ts scripts/history-content/catalog.ts scripts/history-content/catalog.test.ts history-content/catalog history-content/manifest/editorial-periods.json
git commit -m "feat: read structured history event catalogs"
```

### Task 3: Add Content Quality Gates and Reports

**Files:**
- Create: `scripts/history-content/quality.ts`
- Create: `scripts/history-content/quality.test.ts`
- Modify: `scripts/history-content.ts`
- Modify: `scripts/history-content.test.ts`

**Interfaces:**
- Produces: `validateContentQuality(input, options): ContentQualityReport`.
- Produces: `ContentQualityReport` with `eventCount`, `basicEventCount`, `coreEventCount`, `periodCounts`, `corePeriodCounts`, `categoryCounts`, `influenceCounts`, `suspectedDuplicates`.
- Accepts: `{ enforceFinalTargets: boolean }`; CLI enables it in Task 17, fixture tests may disable it.

- [ ] **Step 1: Write failing quality tests**

Cover missing locators, duplicate source IDs within one event, fewer than two core sources, normalized-title duplicates, alias collisions, suspected same-period/date duplicates, political/war share above 60%, empty categories, and influence-5 share above 15%.

```ts
expect(() => validateContentQuality({ events: [basic, { ...basic, id: 'zhougong-2', title: '周 公 摄政' }], periods, sources }, { enforceFinalTargets: false }))
  .toThrow(/规范化标题重复/);
```

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run scripts/history-content/quality.test.ts`

Expected: FAIL because the validator is absent.

- [ ] **Step 3: Implement deterministic normalization and reporting**

Normalize titles with NFKC, whitespace/punctuation removal, and lowercase Latin characters. Flag suspected duplicates only when records share an editorial period, overlap in time, and have equal normalized titles/aliases or a deterministic similarity score at or above 0.88. Parent/child pairs are exempt only when their reciprocal references validate.

- [ ] **Step 4: Add read-only CLI report output**

Make `history:check` print stable JSON with sorted object keys. Do not enable exact final targets yet.

- [ ] **Step 5: Run quality and compiler tests**

Run: `npx vitest run scripts/history-content/quality.test.ts scripts/history-content.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/history-content/quality.ts scripts/history-content/quality.test.ts scripts/history-content.ts scripts/history-content.test.ts
git commit -m "feat: validate history catalog quality"
```

### Task 4: Generate Manifest v2 and Basic/Core Era Bundles

**Files:**
- Create: `scripts/history-content/generate.ts`
- Create: `scripts/history-content/generate.test.ts`
- Modify: `scripts/history-content.ts`
- Modify: `src/history/content/loader.ts`
- Modify: `src/history/content/loader.test.ts`
- Modify: `src/history/content/store.tsx`
- Modify: `src/history/content/store.test.tsx`

**Interfaces:**
- Consumes: merged `HistoryEventArchive[]` and `ContentQualityReport`.
- Produces manifest version 2 with `basicEventCount`, `coreEventCount`, `editorialPeriods`, `periodCounts`, and existing index/bundle mappings.
- Produces compact records with derived `sourceIds`, not full `sourceRefs`.

- [ ] **Step 1: Write failing generator and loader tests**

Assert that a basic archive survives the era-bundle round trip without core fields, a core archive retains details, compact output contains `detailLevel` and `sourceIds` but no `sourceRefs`, and the loader rejects a bundle whose event maps to another visual era.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run scripts/history-content/generate.test.ts src/history/content/loader.test.ts src/history/content/store.test.tsx`

Expected: FAIL on manifest version and archive union.

- [ ] **Step 3: Extract pure generation helpers**

Move `stableJson`, compact record conversion, manifest construction, era-bundle construction, and compatibility construction into `generate.ts`. Keep filesystem staging and atomic swaps in `scripts/history-content.ts`.

- [ ] **Step 4: Update loader/store contracts**

Parse manifest v2 and `z.array(historyEventArchiveSchema)` in era bundles. Keep request de-duplication, retry scoping, and event-to-era lookup unchanged.

- [ ] **Step 5: Run focused tests and build**

Run: `npx vitest run scripts/history-content/generate.test.ts src/history/content/loader.test.ts src/history/content/store.test.tsx && npx tsc -b --pretty false`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/history-content.ts scripts/history-content/generate.ts scripts/history-content/generate.test.ts src/history/content/loader.ts src/history/content/loader.test.ts src/history/content/store.tsx src/history/content/store.test.tsx
git commit -m "feat: generate lazy basic and core archives"
```

### Task 5: Render Basic and Core Event Archives Truthfully

**Files:**
- Modify: `src/components/QuickEventPanel.tsx`
- Modify: `src/components/QuickEventPanel.test.tsx`
- Modify: `src/components/archive/EventArchive.tsx`
- Modify: `src/components/archive/SourcesList.tsx`
- Modify: `src/components/archive/ArchiveViews.test.tsx`
- Modify: `src/components/archive/ArchiveRoutes.test.tsx`
- Modify: `src/components/HistoryExplorer.tsx`
- Modify: `src/components/HistoryExplorer.test.tsx`
- Modify: `src/components/SearchResults.tsx`
- Modify: `src/history-galaxy.css`

**Interfaces:**
- Consumes: `HistoryEventArchive` discriminated by `detailLevel`.
- Produces: `SourcesList({ references }: { references: readonly (string | SourceReference)[] })`.
- Produces visible label `基础档案` only for `detailLevel === 'basic'`.

- [ ] **Step 1: Write failing UI tests**

Render a basic event and assert its summary, date, categories, source locator, and `基础档案` label are visible while `原因`, `过程`, `结果`, `影响`, and `史学说明` sections are absent. Render a core event and assert all current sections remain.

Also assert the unfiltered explorer exposes `全部事件 1200` once production data is present and filtered/search result lists expose their own result counts. Counts must be live text, not canvas-only labels.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/components/QuickEventPanel.test.tsx src/components/archive/ArchiveViews.test.tsx src/components/archive/ArchiveRoutes.test.tsx src/components/HistoryExplorer.test.tsx`

Expected: FAIL because components unconditionally read core fields.

- [ ] **Step 3: Implement discriminated rendering**

Use `archive.detailLevel === 'core'` before reading core fields. Keep relationships, source citations, previous/next navigation, complete-archive links, loading errors, retries, and focus restoration available to both levels.

Pass an explicit count to `SearchResults` and render it in the existing list heading. Use the loaded compact event count for the unfiltered total; do not infer totals from currently visible LOD stars or clusters.

- [ ] **Step 4: Render source locators**

For `SourceReference`, render bibliography followed by `locator` and optional `note`. For existing person/theme string source IDs, retain the current bibliography-only behavior.

- [ ] **Step 5: Run UI tests and accessibility assertions**

Run: `npx vitest run src/components/QuickEventPanel.test.tsx src/components/archive/ArchiveViews.test.tsx src/components/archive/ArchiveRoutes.test.tsx src/components/HistoryExplorer.test.tsx`

Expected: PASS with no inaccessible duplicate headings.

- [ ] **Step 6: Commit**

```bash
git add src/components/QuickEventPanel.tsx src/components/QuickEventPanel.test.tsx src/components/archive/EventArchive.tsx src/components/archive/SourcesList.tsx src/components/archive/ArchiveViews.test.tsx src/components/archive/ArchiveRoutes.test.tsx src/components/HistoryExplorer.tsx src/components/HistoryExplorer.test.tsx src/components/SearchResults.tsx src/history-galaxy.css
git commit -m "feat: render basic history archives"
```

### Task 6: Migrate the Existing 30 Core Events Without Regression

**Files:**
- Modify: `history-content/catalog/events/sui-tang-five-dynasties.json`
- Modify: `history-content/catalog/events/song-liao-jin-xia.json`
- Modify: `history-content/catalog/events/yuan.json`
- Modify: `history-content/catalog/events/ming.json`
- Modify: `history-content/catalog/events/qing.json`
- Modify: `history-content/catalog/events/modern.json`
- Modify: `history-content/content/tang/events/*.md`
- Modify: `history-content/content/song/events/*.md`
- Modify: `history-content/content/yuan/events/*.md`
- Modify: `history-content/content/ming/events/*.md`
- Modify: `history-content/content/qing/events/*.md`
- Modify: `history-content/content/modern/events/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `scripts/history-content.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 catalog/core merge.
- Produces: 30 catalog records with `detailLevel: "core"` and 30 detail-only Markdown files.

- [ ] **Step 1: Strengthen the legacy regression test**

Snapshot the existing 30 event IDs, title, start/end year, influence, color, layout, summary, story text, and 78 named people before migration. Require two source references for each migrated core event.

- [ ] **Step 2: Confirm RED against catalog-only mode**

Run: `npx vitest run scripts/history-content.test.ts -t "migrates all thirty"`

Expected: FAIL until existing metadata moves into catalogs.

- [ ] **Step 3: Move shared fields to catalogs**

For every existing event, move ID through layout plus `editorialPeriodId`, `detailLevel`, and `sourceRefs` into the correct period catalog. Assign `sui-tang-five-dynasties` to Tang records, `song-liao-jin-xia` to Song records, and preserve current visual `eraId` values.

- [ ] **Step 4: Reduce Markdown to core details**

Leave only ID, causes, course, results, impacts, historiography, and body background. Register a second authoritative source and a concrete locator for each record; do not duplicate prose from that source.

- [ ] **Step 5: Compile and compare compatibility output**

Run: `npm run history:compile && npx vitest run scripts/history-content.test.ts src/history/content/loader.test.ts src/App.test.tsx`

Expected: PASS; report remains 30 events/30 core/78 people at this milestone.

- [ ] **Step 6: Commit**

```bash
git add history-content/catalog history-content/content history-content/manifest/sources.json scripts/history-content.test.ts public/history-content/generated src/history/generated/compat-index.json
git commit -m "refactor: migrate existing history archives to catalogs"
```

### Task 7: Establish Shared Historical Registries

**Files:**
- Create: `history-content/manifest/polities.json`
- Create: `history-content/manifest/places.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `src/history/content/schema.ts`
- Modify: `src/history/content/schema.test.ts`
- Modify: `scripts/history-content.ts`
- Modify: `scripts/history-content.test.ts`

**Interfaces:**
- Produces: `politySchema`, `PolityRecord`, and validated source/place/polity maps for event references.
- Preserves: place coordinates as `[longitude, latitude]` and HTTPS-only web sources.

- [ ] **Step 1: Add failing registry tests**

Test unique polity IDs, valid start/end years, aliases, secure source URLs, event source locators, and missing polity/place/source diagnostics containing the event ID and field path.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/content/schema.test.ts scripts/history-content.test.ts`

Expected: FAIL because polity validation is absent.

- [ ] **Step 3: Add registry contracts and compiler references**

Use this source shape without changing existing bibliographic fields:

```ts
export const politySchema = z.strictObject({
  id, name: prose, aliases: z.array(prose), startYear: year, endYear: year
}).refine(value => value.startYear <= value.endYear, { path: ['endYear'], message: 'End precedes start' });
```

- [ ] **Step 4: Populate the shared baseline**

Register the principal dynasties and parallel polities needed by all nine catalogs, stable modern/historical places referenced by core events, and the baseline bibliography of authoritative general histories, standard histories, museums, archives, and university resources. Every web record includes `accessedAt: "2026-11-11"` or its actual later access date.

- [ ] **Step 5: Run registry/compiler tests**

Run: `npx vitest run src/history/content/schema.test.ts scripts/history-content.test.ts && npm run history:check`

Expected: PASS with every existing reference resolved.

- [ ] **Step 6: Commit**

```bash
git add history-content/manifest src/history/content/schema.ts src/history/content/schema.test.ts scripts/history-content.ts scripts/history-content.test.ts
git commit -m "feat: add shared history entity registries"
```

### Task 8: Populate 170 Pre-Qin Events and 25 Core Archives

**Files:**
- Modify: `history-content/catalog/events/pre-qin.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 25 files in `history-content/content/pre-qin/events/`; each filename is `${record.id}.md` for a catalog record marked `core`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 170 `editorialPeriodId: "pre-qin"` records and 25 matching core details.

- [ ] **Step 1: Add a period quota test**

Assert 170 total, 25 core, all dates within the editorial range unless a source note explains a circa boundary, and coverage of archaeology/state formation, Shang-Zhou politics, ritual/institution, Spring and Autumn warfare/diplomacy, Warring States reforms, economy/technology, and major schools of thought.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "pre-Qin"`

Expected: FAIL with the current count.

- [ ] **Step 3: Author the 170-record catalog**

Work chronologically in five reviewed batches of 34 records. After each batch run `npm run history:check`, inspect duplicate diagnostics, and commit only when every source locator resolves. Select 25 influence/turning-point records as `core`; keep influence-5 below 15%.

- [ ] **Step 4: Author 25 core Markdown archives**

Each core file supplies background, causes, chronological course, results, impacts, and historiography. Use at least two distinct registered sources and original prose.

- [ ] **Step 5: Verify the period**

Run: `npx vitest run src/history/production-content.test.ts -t "pre-Qin" && npm run history:check`

Expected: PASS with 170/25.

- [ ] **Step 6: Commit**

```bash
git add history-content/catalog/events/pre-qin.json history-content/content/pre-qin history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 170 pre-Qin events"
```

### Task 9: Populate 130 Qin-Han Events and 22 Core Archives

**Files:**
- Modify: `history-content/catalog/events/qin-han.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 22 files in `history-content/content/qin-han/events/`; each filename is `${record.id}.md` for a catalog record marked `core`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 130 Qin-Han records and 22 core details.

- [ ] **Step 1: Add the 130/22 failing quota and coverage test**

Require Qin unification/administration, Qin collapse and Chu-Han, early Han institutions, expansion and diplomacy, Silk Road, economic policy, scholarship/technology, Wang Mang, Eastern Han politics, religion/society, and late-Han fragmentation.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "Qin-Han"`

Expected: FAIL.

- [ ] **Step 3: Author five chronological batches of 26 records**

Validate after every batch with `npm run history:check`; resolve title/alias collisions before proceeding.

- [ ] **Step 4: Author 22 core Markdown archives with two sources each**

Use `史记`, `汉书`, `后汉书`, registered modern histories, and institutional sources with exact volume/chapter locators.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/history/production-content.test.ts -t "Qin-Han" && npm run history:check`

```bash
git add history-content/catalog/events/qin-han.json history-content/content/qin-han history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 130 Qin-Han events"
```

### Task 10: Populate 120 Wei-Jin and Northern/Southern Dynasties Events

**Files:**
- Modify: `history-content/catalog/events/wei-jin.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 18 files in `history-content/content/wei-jin/events/`; each filename is `${record.id}.md` for a catalog record marked `core`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 120 records and 18 core details.

- [ ] **Step 1: Add the 120/18 failing test**

Require Three Kingdoms, Western/Eastern Jin, Sixteen Kingdoms, Northern/Southern Dynasties, migrations, land/military institutions, Buddhism/Daoism, literature/art, technology, ethnic integration, economy, and reunification precursors.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "Wei-Jin"`

- [ ] **Step 3: Author four batches of 30 records and 18 core archives**

Use explicit polity IDs for concurrent regimes; an event belongs to one editorial period and one visual era even when several polities participate.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/history/production-content.test.ts -t "Wei-Jin" && npm run history:check`

```bash
git add history-content/catalog/events/wei-jin.json history-content/content/wei-jin history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 120 Wei-Jin era events"
```

### Task 11: Populate 160 Sui-Tang-Five Dynasties Events

**Files:**
- Modify: `history-content/catalog/events/sui-tang-five-dynasties.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 30 `${record.id}.md` files distributed across `history-content/content/sui-tang/events/`, `history-content/content/tang/events/`, and `history-content/content/five-dynasties/events/`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 160 records and 30 core details, including the five migrated Tang events.

- [ ] **Step 1: Add the 160/30 failing test**

Require Sui reunification/canal/institutions, Tang political phases, frontier/diplomacy, taxation/land/military systems, cities/trade, examinations, religion, literature/art, science/technology, women/social life, late-Tang regionalization, and Five Dynasties/Ten Kingdoms.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "Sui-Tang"`

- [ ] **Step 3: Author five chronological batches of 32 records and complete 30 core archives**

Preserve the existing Tang event IDs and visual values. Assign Sui, Tang, Five Dynasties, and Ten Kingdoms visual eras without duplicating an editorial record.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/history/production-content.test.ts -t "Sui-Tang" && npm run history:check`

```bash
git add history-content/catalog/events/sui-tang-five-dynasties.json history-content/content/sui-tang history-content/content/tang history-content/content/five-dynasties history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 160 Sui-Tang-Five Dynasties events"
```

### Task 12: Populate 170 Song-Liao-Jin-Xia Events

**Files:**
- Modify: `history-content/catalog/events/song-liao-jin-xia.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 30 `${record.id}.md` files distributed across `history-content/content/song-liao-jin-xia/events/` and `history-content/content/song/events/`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 170 records and 30 core details, including the six migrated Song events.

- [ ] **Step 1: Add the 170/30 failing test**

Require Northern/Southern Song, Liao, Western Xia, Jin, Dali and Mongol interactions; administration, reforms, military/diplomacy, commerce/cities/maritime trade, printing/science, Neo-Confucianism/religion, literature/art, and social life.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "Song-Liao"`

- [ ] **Step 3: Author five chronological/thematic batches of 34 records and 30 core archives**

Use polity IDs rather than treating all events as Song events. Keep one editorial record for multi-polity treaties and wars.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/history/production-content.test.ts -t "Song-Liao" && npm run history:check`

```bash
git add history-content/catalog/events/song-liao-jin-xia.json history-content/content/song-liao-jin-xia history-content/content/song history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 170 Song-Liao-Jin-Xia events"
```

### Task 13: Populate 70 Yuan Events and 12 Core Archives

**Files:**
- Modify: `history-content/catalog/events/yuan.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 12 files in `history-content/content/yuan/events/`; each filename is `${record.id}.md` for a catalog record marked `core`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 70 records and 12 core details, including the two migrated Yuan events.

- [ ] **Step 1: Add the 70/12 failing test**

Require conquest/state formation, provincial and legal systems, ethnic/social administration, taxation/agriculture, Eurasian exchange, maritime trade, astronomy/medicine, religion, drama/art, disasters/rebellions, and dynastic collapse.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "Yuan"`

- [ ] **Step 3: Author two batches of 35 records and 12 core archives**

Use precise locators in `元史`, registered general histories, and institutional references; mark disputed dates as `circa`.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/history/production-content.test.ts -t "Yuan" && npm run history:check`

```bash
git add history-content/catalog/events/yuan.json history-content/content/yuan history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 70 Yuan events"
```

### Task 14: Populate 130 Ming Events and 22 Core Archives

**Files:**
- Modify: `history-content/catalog/events/ming.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 22 files in `history-content/content/ming/events/`; each filename is `${record.id}.md` for a catalog record marked `core`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 130 records and 22 core details, including the four migrated Ming events.

- [ ] **Step 1: Add the 130/22 failing test**

Require state formation/capitals, institutions, frontier and maritime diplomacy, fiscal reforms, agriculture/craft/commerce, voyages and global exchange, printing/philosophy/literature, science/technology, religion, urban/social life, disasters/rebellions, and Ming-Qing transition precursors.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "Ming"`

- [ ] **Step 3: Author five batches of 26 records and 22 core archives**

Distinguish long processes from dated sub-events through parent/child relations instead of duplicate summaries.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/history/production-content.test.ts -t "Ming" && npm run history:check`

```bash
git add history-content/catalog/events/ming.json history-content/content/ming history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 130 Ming events"
```

### Task 15: Populate 130 Qing Events Through 1840

**Files:**
- Modify: `history-content/catalog/events/qing.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 21 files in `history-content/content/qing/events/`; each filename is `${record.id}.md` for a catalog record marked `core`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 130 records and 21 core details, including the two migrated transition/Qing events.

- [ ] **Step 1: Add the 130/21 failing test**

Require conquest/consolidation, frontier governance, institutions, taxation/population/agriculture, trade and Canton system, scholarship/literature/art, technology/cartography, religion, ethnic/social policy, disasters/rebellions, and conditions preceding 1840.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "Qing"`

- [ ] **Step 3: Author five batches of 26 records and 21 core archives**

Keep events beginning in 1840 in the modern catalog; cross-boundary processes use related records or ranges with a documented editorial assignment.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/history/production-content.test.ts -t "Qing" && npm run history:check`

```bash
git add history-content/catalog/events/qing.json history-content/content/qing history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 130 Qing events through 1840"
```

### Task 16: Populate 120 Modern Events Through 1949

**Files:**
- Modify: `history-content/catalog/events/modern.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/places.json`
- Modify: `history-content/manifest/polities.json`
- Create: exactly 20 files in `history-content/content/modern/events/`; each filename is `${record.id}.md` for a catalog record marked `core`
- Test: `src/history/production-content.test.ts`

**Interfaces:** Produces exactly 120 records and 20 core details, including the 11 migrated modern events.

- [ ] **Step 1: Add the 120/20 failing test**

Require foreign relations and wars, reform/industrialization, social movements, late-Qing institutions, revolution/republic, political realignment, New Culture, labor/women/education, economy/science/culture, resistance against Japan, civil war, and 1949 state formation.

- [ ] **Step 2: Confirm RED**

Run: `npx vitest run src/history/production-content.test.ts -t "Modern"`

- [ ] **Step 3: Author four batches of 30 records and 20 core archives**

Use archives, institutional sources, and modern-history scholarship. Separate event facts from later political evaluation; record disputed interpretations in notes/historiography.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/history/production-content.test.ts -t "Modern" && npm run history:check`

```bash
git add history-content/catalog/events/modern.json history-content/content/modern history-content/manifest src/history/production-content.test.ts
git commit -m "content: add 120 modern history events"
```

### Task 17: Enable Exact Production Gates and Cross-Era Integrity

**Files:**
- Modify: `scripts/history-content.ts`
- Modify: `scripts/history-content/quality.ts`
- Modify: `scripts/history-content/quality.test.ts`
- Modify: `src/history/production-content.test.ts`
- Modify: `history-content/manifest/relations.json`
- Modify: `history-content/manifest/themes.json`

**Interfaces:**
- Enables `enforceFinalTargets: true` for repository CLI commands.
- Produces final report with exactly 1200 events, 1000 basic, 200 core, nine period counts, category counts, influence counts, and zero suspected duplicates.

- [ ] **Step 1: Write the final failing production contract**

Read real source catalogs and generated output, not `generateScaleFixture`. Assert exact period/core counts, all source locators, all core source diversity, bidirectional references, category balance, influence balance, no duplicate normalized titles, and all existing IDs.

- [ ] **Step 2: Confirm RED before the final gate is enabled**

Run: `npx vitest run src/history/production-content.test.ts scripts/history-content/quality.test.ts`

Expected: FAIL if any quota, source, relationship, or coverage constraint remains.

- [ ] **Step 3: Resolve cross-era relationships and themes**

Add only meaningful cause, consequence, parallel, contrast, and part-of links. Update thematic routes only when every referenced event exists and each chapter remains editorially coherent.

- [ ] **Step 4: Enable final CLI targets**

Call `validateContentQuality(content, { enforceFinalTargets: true })` in both `check` and `compile`. Fixture unit tests pass `false` explicitly.

- [ ] **Step 5: Compile and inspect the exact report**

Run: `npm run history:check && npm run history:compile`

Expected report fields: `eventCount: 1200`, `basicEventCount: 1000`, `coreEventCount: 200`, every period count matching the spec, `errorCount: 0`, and `suspectedDuplicates: []`.

- [ ] **Step 6: Run production contract tests**

Run: `npx vitest run src/history/production-content.test.ts scripts/history-content/quality.test.ts scripts/history-content.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/history-content.ts scripts/history-content/quality.ts scripts/history-content/quality.test.ts src/history/production-content.test.ts history-content/manifest/relations.json history-content/manifest/themes.json public/history-content/generated src/history/generated/compat-index.json
git commit -m "feat: enforce the 1200-event production catalog"
```

### Task 18: Verify Real-Data Search, Archives, and Performance

**Files:**
- Modify: `src/HistoryGalaxyApp.test.tsx`
- Modify: `src/history/performance.test.ts`
- Modify: `src/history/search/client.test.ts`
- Modify: `src/components/HistoryExplorer.test.tsx`
- Modify: `src/components/archive/ArchiveRoutes.test.tsx`
- Modify: `README.md`

**Interfaces:** Uses the production 1200-event generated index for integration tests while retaining `generateScaleFixture` for isolated algorithm budgets.

- [ ] **Step 1: Add failing real-data integration tests**

Assert the production compact file has 1200 events, searches representative records from all nine periods, opens one basic and one core archive, filters by period/category/year/influence, and returns from a full archive with camera/query state intact.

- [ ] **Step 2: Add compressed-size and search budgets**

Use Node `gzipSync` to require `indexes/events.compact.json` below 450 KiB gzip. Index all 1200 real records and require deterministic result ordering; keep timing assertions in the existing broad performance envelope rather than using machine-fragile millisecond thresholds.

- [ ] **Step 3: Run the focused integration suite**

Run: `CI=true npx vitest run src/HistoryGalaxyApp.test.tsx src/history/performance.test.ts src/history/search/client.test.ts src/components/HistoryExplorer.test.tsx src/components/archive/ArchiveRoutes.test.tsx`

Expected: PASS.

- [ ] **Step 4: Run complete verification**

Run: `npm run content:validate && npm run content:check-generated && npm run history:check && CI=true npm test -- --run && npm run build && git diff --check`

Expected: all commands exit 0; 1200/200/0 content report; no diff whitespace errors.

- [ ] **Step 5: Test desktop and mobile in a real browser**

Start Vite, then use Playwright at 1440×900 and 390×844. Verify nonblank WebGL pixels, event/cluster click, wheel zoom, era navigation, search, filters, basic/core archive reading, back navigation, 2D fallback, no overlapping controls, and event count visibility. Capture screenshots for both viewports.

- [ ] **Step 6: Update README accurately**

Document 1200 sourced events, 200 core archives, basic/core distinction, content commands, and the fact that overview clustering does not display 1200 labels simultaneously.

- [ ] **Step 7: Commit**

```bash
git add src/HistoryGalaxyApp.test.tsx src/history/performance.test.ts src/history/search/client.test.ts src/components/HistoryExplorer.test.tsx src/components/archive/ArchiveRoutes.test.tsx README.md
git commit -m "test: verify the real 1200-event experience"
```

### Task 19: Review, Preview, and Pull Request

**Files:**
- Review: all branch changes against `docs/superpowers/specs/2026-11-11-history-galaxy-1200-events-design.md`

**Interfaces:** Produces a reviewable branch and Netlify Deploy Preview; does not merge without explicit user approval.

- [ ] **Step 1: Run final fresh verification**

Run: `npm run history:check && CI=true npm test -- --run && npm run build && git diff --check && git status --short`

Expected: 1200 total, 1000 basic, 200 core, zero errors; all tests/build pass; clean worktree.

- [ ] **Step 2: Perform a requirements audit**

Check every spec completion criterion against files and fresh command output. Explicitly record source coverage, period/core quotas, production index count, real browser results, and any residual visual limitations.

- [ ] **Step 3: Request code review**

Use `superpowers:requesting-code-review`. Fix validated correctness, historical-integrity, performance, or accessibility findings and rerun the relevant verification.

- [ ] **Step 4: Push and create a PR**

Push `codex/history-galaxy-1200-events`, create a PR to `main`, attach it to the task, and include exact verification output plus the Netlify preview URL.

- [ ] **Step 5: Wait for remote checks**

Require GitHub CI and Netlify Deploy Preview success. Do not merge or deploy production until the user reviews the preview and explicitly authorizes merge.

