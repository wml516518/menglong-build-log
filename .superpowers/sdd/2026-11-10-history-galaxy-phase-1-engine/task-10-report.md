# Task 10 — History Explorer

Status: complete. Commit subject: `feat: add full history explorer`.

## Delivered behavior

- Desktop collapsible, unframed work panel and mobile bottom drawer with the exact views `事件 / 搜索 / 筛选 / 专题`.
- Chinese ranked event search, with one `HistorySearchClient` for each compact-index identity, cleanup on index changes/unmount, silent supersession, and a usable prefix-search fallback after an actual Worker failure.
- Local text input, 150 ms search/URL debounce using `replaceState`, immediate explicit-filter `pushState`, preserved archive paths/unrelated duplicate parameters/history state, and hash/popstate restoration that cancels pending text writes.
- Era/category/person/place/theme menus, inclusive year ranges with native numeric/range controls, influence threshold, major-only, viewport-only, and one-action clear. Year numeric drafts survive intermediate digits while committed filters remain normalized.
- Search selection focuses the exact event and protects result IDs from clustering. Re-selecting the same event after manual travel now refocuses through the renewed selection signal.
- Filters preserve all scene events and dim unmatched instances/rich stars/clusters. Static instance colors are multiplied in linear color space, retaining two draw fields and exact picking identity; cluster dimming averages member values.
- Current camera-frustum membership is reported at the existing 120 ms projection cadence only when the membership set changes. It includes members currently represented by clusters.
- Place/theme compact indexes are loaded, validated and cached using existing manifest paths and schemas. No archive eager loading or invented content was added.
- Focus returns to the mobile tab after drawer close; search selection collapses the drawer before opening the story. Arrow-tab navigation retains tab focus until activation. Explorer input keys no longer trigger global scene traversal.

## RED / GREEN evidence

All logs below are saved beside this report in `task-10-browser/`.

1. Before production UI/content changes, ran:

   `npm test -- --run src/components/HistoryExplorer.test.tsx src/history/content/loader.test.ts src/history/content/store.test.tsx`

   RED: **3 files failed; 12 failed, 12 passed** (`history-task10-red.log`). Ten UI tests failed against the existing app for missing search/filter/mobile controls; the loader lacked `loadPlaceIndex`, and provider place/theme indexes were undefined. The first sandbox attempt could not start the compiler's tsx IPC socket (`EPERM`); rerunning the same command with authorized local execution produced the behavioral RED above.

2. Before production scene/input-key changes, ran:

   `npx vitest run src/scene/HistoryScene.test.tsx src/scene/InstancedEventField.test.tsx src/scene/SceneProjection.test.tsx src/history/useHistoryNavigation.test.tsx`

   RED: **4 files failed; 4 failed, 10 passed** (`history-task10-scene-red.log`). Search target was unprotected, instance color stayed at 0.7835 instead of dimmed 0.1175, viewport membership was never reported, and ArrowRight inside an input changed selection from `zhenguan` to `kaiyuan`.

   GREEN after implementation: **4 files passed; 14 passed** (`history-task10-scene-green.log`).

3. Initial UI GREEN refinement found accessible-name ambiguity for theme descriptions. Corrected the theme checkbox name. UI + Canvas integration GREEN: **2 files passed; 12 passed** (`history-task10-ui2-green.log`).

4. Added two usability regressions before their fixes:

   `npx vitest run src/components/HistoryExplorer.test.tsx -t 'intermediate digits|mobile arrow'`

   RED: **2 failed, 10 skipped** (`history-task10-input-red.log`). Editing the end year could not retain `900` across intermediate digits, and ArrowRight moved focus directly into the searchbox.

   GREEN after draft-year and tab-focus fixes: **12 Explorer tests passed** (`history-task10-ui3-green.log`).

5. Final camera review added a same-result reselect regression before the fix:

   `npx vitest run src/scene/CameraRig.test.tsx -t 'same search result'`

   RED: **1 failed, 14 skipped**, camera target remained **2.4** units from the selected event after renewed selection (`history-task10-refocus-red.log`).

   GREEN after threading `selectionSignal` into the camera effect: camera + scene **20 tests passed** (`history-task10-refocus-green.log`).

6. Final suite includes additional integration coverage of late/superseded Worker responses, search-client disposal/replacement, joined place names, URL Back restoration, camera boundary data, and viewport-filter changes. Worker transport and the unavailable Canvas renderer are the only mocked boundaries; state, provider, loader, search client, MiniSearch handler, controls and UI are real.

## Final verification

- Focused Explorer/app/scene/content/search/navigation run: **16 files / 212 tests passed** (`history-task10-focused-final.log`). It includes `HistoryExplorer`, `HistoryGalaxyApp`, `HistoryGalaxySceneIntegration`, `HistoryScene`, `InstancedEventField`, `SceneProjection`, `ClusterField`, `EventStar`, `EventStarInteraction`, `CameraRig`, content loader/store/schema, search client, explorer state and history navigation tests.
- Full `npm test -- --run`: **38 files / 442 tests passed** (`history-task10-full-final.log`). Content compile reports 30 events, 78 people, 12 eras, 0 themes, 0 errors.
- `npm run build`: **passed**, including content compile, TypeScript build and Vite production output (`history-task10-build-final.log`).
- `git diff --check`: passed.
- Tests still emit the existing Three.js CJS deprecation warning. Build still emits dependency warnings from Zod annotation handling and gray-matter's eval usage. No task test failures or TypeScript errors remain.

## Browser verification and design self-critique

Used the installed Playwright CLI against local Vite; temporary browser/server were closed afterward. Chrome reported **0 errors**, with the existing `THREE.Clock` deprecation warning.

- Desktop 1200 × 818 screenshot: constrained 304 px tool panel, preserved serif headings and sans utility labels, muted bronze separators/cyan search focus, no cards within cards or oversized new headings.
- 320 × 568 search screenshot: fixed four equal tab tracks; search field/results fit, with no horizontal overflow.
- 320 × 568 reduced-motion search-to-story: `scrollWidth = 320`; story spans y=194…512, tab bar y=512…568; drawer closed; focus is on the story dialog.
- 568 × 320 short screen: `scrollWidth = 568`; drawer y=139…264, tabs y=264…320; tab targets are **138 × 55**; the 44 × 44 home icon sits outside the drawer/header controls.
- Mobile story copy ends at y=410.15 before footer begins at y=428.15 after scroll; next-event control successfully opens `开元盛世`. Prevented shrinking copy and footer overlap under the drawer's height constraint.
- Reduced-motion media respected in browser checks. Existing visible keyboard instruction text is hidden. Safe areas, scroll containment, long-label wrapping, 44 px mobile targets, and clear focus outlines are included.

Screenshots: `task-10-browser/task10-desktop.png`, `task10-mobile-search.png`, `task10-mobile-story.png`, `task10-short-filter.png`.

Self-critique: the intentionally quiet panel reads as a dense historical research instrument rather than a decorative dashboard. Searching puts ranked results before filters so the flight is easy to discover. A fully expanded filter surface requires vertical scrolling on desktop and especially on short phones; this is the deliberate tradeoff for preserving the starfield and keeping the four mobile tracks stable. Mobile story content scrolls instead of overlapping its footer or the tabs.

## Files

New:

- `src/components/HistoryExplorer.tsx`
- `src/components/HistoryExplorer.test.tsx`
- `src/components/FilterPanel.tsx`
- `src/components/SearchResults.tsx`
- `src/history/explorer/useHistoryExplorer.ts`
- `src/HistoryGalaxySceneIntegration.test.tsx`

Modified:

- `src/HistoryGalaxyApp.tsx`, `src/components/EventNavigator.tsx`, `src/history-galaxy.css`
- `src/history/content/schema.ts`, `loader.ts`, `loader.test.ts`, `store.tsx`, `store.test.tsx`
- `src/history/search/client.ts`
- `src/history/useHistoryNavigation.ts`, `useHistoryNavigation.test.tsx`
- `src/scene/HistoryScene.tsx`, `HistoryScene.test.tsx`
- `src/scene/InstancedEventField.tsx`, `InstancedEventField.test.tsx`
- `src/scene/EventStar.tsx`, `ClusterField.tsx`
- `src/scene/SceneProjection.tsx`, `SceneProjection.test.tsx`
- `src/scene/CameraRig.tsx`, `CameraRig.test.tsx`
- This report.

## Remaining concerns

- The repository currently contains empty place/theme compact indexes. UI controls expose honest Chinese empty states, and non-empty fixtures validate the complete selection/search path; real options appear when content is supplied in later content tasks.
- Prefix fallback intentionally has the existing client's narrower title/alias/person-name behavior; its Chinese status explains this limitation. Normal Worker search uses the full joined index.
- Viewport-only means camera-frustum membership, including clustered members; it does not subtract pixels covered by overlay panels.
- Scene bundle remains about 1.07 MB before gzip. This task preserves existing lazy scene loading and static batching; broader bundle work is outside Task 10.
- No blockers remain.
