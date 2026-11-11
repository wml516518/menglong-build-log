# History Galaxy Phase 3 Imperial History Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Five Dynasties through Qing pre-1840 archive, including parallel regimes, institutions, economy, society, technology, religion, diplomacy, culture, independent people archives, and middle/late-imperial theme journeys.

**Architecture:** This phase adds content only through Phase 1 schemas/compiler and Phase 2 audit gates. Parallel polities are first-class metadata; no content task may force Song/Liao/Jin/Xia or other simultaneous regimes into a false single-line succession.

**Tech Stack:** Markdown Frontmatter, JSON manifests, TypeScript compiler/audit, MiniSearch, Vitest, Git review

**Spec:** `/Users/wangmenglong/Desktop/PrivateChat/docs/superpowers/specs/2026-11-10-history-galaxy-encyclopedia-design.md`

**Depends On:** Phase 1 engine and Phase 2 early-history content completed and merged.

## Global Constraints

- All Phase 2 editorial, sourcing, prose-length, relationship, alias, and build gates remain binding.
- Every era covers all eleven approved categories; war and court politics cannot dominate the catalog.
- Parallel regimes use polity IDs, parallel relations, and overlapping date ranges.
- Each event has 1–3 sources; each person has at least one authoritative source.
- Existing Song/Yuan/Ming/Qing event IDs remain stable.
- Mainstream narration remains concise; disputed responsibility, dates, demographic estimates, and retrospective labels receive historiography notes.
- Each batch ends with compiler, audit, search, archive, and relationship verification.

---

### Task 1: Curate Five Dynasties, Song, Liao, Jin, and Western Xia

**Files:**
- Create: `history-content/content/song-liao-jin-xia/events/*.md`
- Create: `history-content/content/song-liao-jin-xia/people/*.md`
- Modify: `history-content/manifest/eras.json`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/song-liao-jin-xia.test.ts`

**Interfaces:**
- Produces 120–160 events and 240–340 people with overlapping polity metadata.

- [ ] **Step 1: Write failing batch tests**

```ts
const required = [
  'late-liang-founded', 'later-tang-founded', 'khitan-liao-founded', 'chenqiao-mutiny',
  'song-unification', 'cup-of-wine-military-power', 'chanyuan-treaty', 'qingli-reforms',
  'wang-anshi-reforms', 'new-policies-party-conflict', 'movable-type-printing', 'shen-kuo-dream-pool',
  'jingkang-incident', 'southern-song-founded', 'yue-fei-campaigns', 'shaoxing-treaty',
  'jin-seizes-northern-china', 'western-xia-state', 'mongol-jin-war', 'xiangyang-siege', 'southern-song-falls'
];
expectEraCoverage(compiled, 'song-liao-jin-xia', { events: [120, 160], people: [240, 340], required });
expect(overlapAtYear(compiled, 1120)).toEqual(expect.arrayContaining(['song', 'liao', 'jin', 'western-xia']));
```

- [ ] **Step 2: Run RED and build the parallel-polity catalog**

Cover Five Dynasties/Ten Kingdoms, Liao, Northern/Southern Song, Western Xia, Jin, Dali and Mongol expansion. Include central/local institutions, civil service, military, land/tax/finance, urban/commercial growth, maritime trade, printing/science/medicine, Neo-Confucianism/Buddhism/Daoism, literature/art, women/family, migration, ethnic diplomacy and daily life.

- [ ] **Step 3: Write sourced archives and cross-polity relationships**

Treat treaties, tribute/trade, border markets, wars and cultural exchange as relationships involving all participating polities. Do not label one polity's event as the entire period without parallel context.

- [ ] **Step 4: Verify search and commit**

Search probes: `赵匡胤`, `澶渊之盟`, `王安石`, `活字印刷`, `东京梦华录`, `辽`, `西夏`, `女真`, `靖康`, `岳飞`, `临安`.

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/song-liao-jin-xia.test.ts src/history/search
git add history-content/content/song-liao-jin-xia history-content/manifest src/history/content/song-liao-jin-xia.test.ts
git commit -m "content: add Song and parallel regimes archive"
```

---

### Task 2: Curate the Yuan Archive

**Files:**
- Create: `history-content/content/yuan/events/*.md`
- Create: `history-content/content/yuan/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/yuan.test.ts`

**Interfaces:**
- Produces 45–65 events and 100–150 people.

- [ ] **Step 1: Write failing acceptance tests**

Required anchors are `mongol-empire-founded`, `mongol-western-expeditions`, `yuan-dynasty-founded`, `southern-song-falls`, `dadu-capital`, `province-system-yuan`, `maritime-trade-yuan`, `postal-relay-yuan`, `yuan-drama-flourishes`, `guo-shoujing-calendar`, `religions-yuan`, `red-turban-uprising`, and `yuan-withdraws-north`. Pass that list as `required` to:

```ts
expectEraCoverage(compiled, 'yuan', { events: [45, 65], people: [100, 150], required });
```

- [ ] **Step 2: Run RED and author balanced archives**

Cover empire formation, succession and Yuan state formation, conquest consequences, administrative systems, ethnic/social categories with careful historiography, agriculture/tax/currency, Eurasian traffic, maritime trade, religions, science, medicine, drama/art, disasters, popular resistance and collapse.

- [ ] **Step 3: Verify aliases and broader Eurasian context**

Search probes: `铁木真 / 成吉思汗`, `忽必烈 / 元世祖`, `行省`, `大都`, `站赤`, `郭守敬`, `元曲`, `红巾军`. Event relationships distinguish Mongol Empire events from Yuan dynasty events.

- [ ] **Step 4: Run and commit**

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/yuan.test.ts src/history/search
git add history-content/content/yuan history-content/manifest src/history/content/yuan.test.ts
git commit -m "content: add sourced Yuan history archive"
```

---

### Task 3: Curate the Ming Archive

**Files:**
- Create: `history-content/content/ming/events/*.md`
- Create: `history-content/content/ming/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/ming.test.ts`

**Interfaces:**
- Produces 75–105 events and 160–230 people.

- [ ] **Step 1: Write failing acceptance tests**

Required anchors include `ming-founded`, `hongwu-institutions`, `jingnan-campaign`, `beijing-capital-ming`, `zheng-he-voyages`, `tumu-crisis`, `beijing-defense-1449`, `wokou-defense`, `zhang-juzheng-reforms`, `single-whip-reform`, `imjin-war`, `matteo-ricci-china`, `compendium-materia-medica`, `tiangong-kaiwu`, `late-ming-commerce`, `donglin-movement`, `peasant-uprisings-late-ming`, and `ming-central-state-falls`. Pass that list as `required` to:

```ts
expectEraCoverage(compiled, 'ming', { events: [75, 105], people: [160, 230], required });
```

- [ ] **Step 2: Run RED and author archives across all categories**

Cover founding/central institutions, succession/court politics, frontier and maritime policy, tributary/diplomatic relations, fiscal/land reforms, commercialization and silver economy, agriculture/handicraft, overseas exchange, printing/novels/theater/art, philosophy/religion, science/medicine, women/social life, disasters, military transformation, rebellions and transition.

- [ ] **Step 3: Model complex events as parent/children**

Zheng He voyages, Wokou conflicts, Imjin War, Zhang Juzheng reforms, late-Ming rebellions and 1644 transition use parent events with ordered children. `ming-central-state-falls` does not imply all Ming resistance ended in one day.

- [ ] **Step 4: Verify and commit**

Search probes: `朱元璋`, `靖难`, `郑和`, `土木堡`, `戚继光`, `张居正`, `一条鞭法`, `利玛窦`, `李时珍`, `晚明商业`, `李自成`.

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/ming.test.ts src/history/search
git add history-content/content/ming history-content/manifest src/history/content/ming.test.ts
git commit -m "content: add sourced Ming history archive"
```

---

### Task 4: Curate Qing History Through 1840

**Files:**
- Create: `history-content/content/qing/events/*.md`
- Create: `history-content/content/qing/people/*.md`
- Modify: `history-content/manifest/sources.json`
- Modify: `history-content/manifest/themes.json`
- Create: `src/history/content/qing.test.ts`

**Interfaces:**
- Produces 75–100 events and 160–230 people ending at the eve/start of the Opium War boundary.

- [ ] **Step 1: Write failing acceptance tests**

Required anchors include `qing-enters-pass`, `southern-ming-resistance`, `three-feudatories-revolt`, `taiwan-incorporation-qing`, `treaty-nerchinsk`, `banner-green-standard`, `yongzheng-reforms`, `gaitu-guiliu`, `qinghai-tibet-governance`, `xinjiang-incorporation-qing`, `high-qing-population-growth`, `single-port-canton-system`, `dream-red-chamber`, `evidential-scholarship-qing`, `white-lotus-rebellion`, `macartney-embassy`, `opium-trade-expands`, and `lin-zexu-canton`. Pass that list as `required` to:

```ts
expectEraCoverage(compiled, 'qing', { events: [75, 100], people: [160, 230], required });
```

- [ ] **Step 2: Run RED and author careful state/society archives**

Cover conquest/transition without compressing regional resistance, multiethnic frontier governance, institutions, fiscal reforms, agriculture/population/land pressure, handicraft/commerce, Canton trade, diplomacy, scholarship/literature/art, religion, science/medicine, social organizations, disasters, uprisings and the Opium War preconditions.

- [ ] **Step 3: Add historiography where labels or estimates are contested**

Use concise notes for “盛世” framing, population estimates, territorial terminology, ethnicity, casualty estimates, and retrospective labels. Keep public prose mainstream and non-polemical.

- [ ] **Step 4: Verify and commit**

Search probes: `康熙`, `雍正`, `乾隆`, `改土归流`, `尼布楚`, `广州十三行`, `人口增长`, `红楼梦`, `考据学`, `白莲教`, `林则徐`.

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/qing.test.ts src/history/search
git add history-content/content/qing history-content/manifest src/history/content/qing.test.ts
git commit -m "content: add sourced Qing history archive"
```

---

### Task 5: Publish Middle and Late Imperial Theme Journeys

**Files:**
- Modify: `history-content/manifest/themes.json`
- Create: `history-content/themes/state-institutions-imperial.json`
- Create: `history-content/themes/land-tax-imperial.json`
- Create: `history-content/themes-northern-peoples.json`
- Create: `history-content/themes-maritime-exchange.json`
- Create: `history-content/themes-literature-art-imperial.json`
- Create: `src/history/content/imperial-themes.test.ts`

**Interfaces:**
- Produces five 15–35 event journeys spanning at least three Phase 3 eras each.

- [ ] **Step 1: Write and run failing integrity tests**

Assert unique valid events, chapter narration, recommended LOD/camera targets, explicit parallel-polity chapters where applicable, chronological progression within chapters, and valid archive/person links.

- [ ] **Step 2: Author the five routes**

Routes cover institutions, land/tax, northern peoples and central regimes, maritime exchange, and literature/art. Reuse events from Phase 2 where needed to show continuity; do not duplicate event records.

- [ ] **Step 3: Verify and commit**

```bash
npm run history:check && npm run history:audit
npm test -- --run src/history/content/imperial-themes.test.ts src/components/archive
git add history-content/manifest/themes.json history-content/themes src/history/content/imperial-themes.test.ts
git commit -m "content: add imperial history theme journeys"
```

---

### Task 6: Complete Phase 3 Cross-Polity and Browser Audit

**Files:**
- Create: `docs/history-content/phase-3-audit.md`
- Modify: `README.md`

- [ ] **Step 1: Run complete validation**

```bash
npm run history:check
npm run history:audit
npm test -- --run
npm run build
git diff --check
```

Expected Phase 3 addition: 315–430 events and 660–950 people. Combined Phase 2–3 total is 705–950 events and 1430–2060 people, leaving the planned modern-history allocation inside the final 815–1095 event / 1500–2500 person envelope.

- [ ] **Step 2: Run cross-polity browser sampling**

Verify overlapping Song/Liao/Jin/Xia filtering and clustering, era transitions, BCE-to-Qing timeline travel, all Phase 3 search probes, five theme journeys, archive/person relationships, source links, mobile layout, reduced motion, 2D fallback, console/network health, and frame budgets.

- [ ] **Step 3: Record and commit the audit**

Document counts, category/source distributions, parallel-polity cases sampled, corrected IDs, screenshots, performance, and remaining nonblocking editorial notes.

```bash
git add docs/history-content/phase-3-audit.md README.md
git commit -m "docs: audit imperial history encyclopedia content"
```

- [ ] **Step 4: Push and preview only after explicit authorization**

Open a preview PR after authorization and repeat search, parallel-polity, archive, and mobile smoke flows. Do not merge until CI and content audit pass.
