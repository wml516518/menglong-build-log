# Task 5 report — shareable archive routes

Implemented the binding URL patterns `#/history-galaxy/event/<id>`, `#/history-galaxy/person/<id>`, and `#/history-galaxy/theme/<id>`. IDs are decoded once and validated against the existing lowercase kebab-case pattern; empty, uppercase, malformed encoding, repeated separators, slash/traversal, and double-encoded IDs return home. Archive route objects preserve the complete query string, and shell query state uses URLSearchParams. Existing post/index/home routes remain unchanged.

## Implementation

- `src/routes.ts`: ArchiveRoute/HistoryRoute types, history-family guard, parsing, session-backed return location helpers. App records the full galaxy hash on navigation; a matching browser history entry marker prefers Back, otherwise return uses the validated session hash or `#/history-galaxy`.
- `src/App.tsx`: history family routing, Chinese document language and route metadata/body class, lazy route-family boundary, injectable real loader for integration tests, accessible lazy loading fallback.
- `src/HistoryRoutes.tsx`: one HistoryContentProvider around galaxy/archive siblings, preserving provider initialization across route changes.
- `src/HistoryGalaxyApp.tsx`: exports the provider-free experience for the route-family boundary. Its existing default standalone component retains its original provider API for existing tests and consumers; the App path never nests providers.
- `src/PortfolioApp.tsx`: narrows portfolio props to exclude the entire history route family.
- `src/metadata.ts`: archives use the Chinese History Galaxy metadata.
- `src/components/archive/ArchiveShell.tsx`: loading, initialization failure/retry, era failure/retry, missing and minimal ready states, with a return link in every state. Event/person use only existing provider getters and manifest maps; no route ID is used as a resource path. Unknown IDs cause no era downloads or automatic retries.
- `src/components/archive/ArchiveNotFound.tsx`: Chinese unknown archive message.
- `src/history-galaxy.css`: minimal legible, scrollable archive shell in the history palette.
- `src/routes.test.ts`, `src/components/archive/ArchiveRoutes.test.tsx`: real parsing and rendered App/provider/loader behavior using generated content fixtures and injected fetch transport, without router, React, or provider mocks.

## TDD evidence

1. Wrote parser and rendered archive behavior tests before implementation.
2. Ran `npm test -- --run src/routes.test.ts src/components/archive/ArchiveRoutes.test.tsx`: **RED — 2 files failed; 12 failed, 14 passed**. Expected failures showed valid archive/query URLs falling back to the portfolio and missing archive loading/ready/error UI. Log: `/tmp/task5-red.log`.
3. Implemented route family and shell, then ran required focused command: **GREEN — 3 files, 40 tests passed**. Log: `/tmp/task5-green.log`.
4. Added coverage for initialization retry, safe session fallback, forged stored URL rejection, and actual browser Forward after returning with Back. Final focused run: **3 files, 43 tests passed**. Log: `/tmp/task5-final-focused.log`.

## Verification

- `npm test -- --run src/routes.test.ts src/components/archive/ArchiveRoutes.test.tsx src/App.test.tsx`: 43 passed.
- `npm test`: 24 files, 315 tests passed. Log: `/tmp/task5-full.log`.
- `npm run build`: passed TypeScript plus production Vite build after final CSS edit. Log: `/tmp/task5-final-build.log`.
- `git diff --check`: passed.
- Build keeps HistoryRoutes and HistoryScene in separate lazy chunks.

## Self-review and concerns

Checked invalid hash handling, query preservation, known/unknown manifest lookup behavior, no automatic retry loops, successful recovery after index/era failures, one provider initialization across galaxy/archive/Back/Forward, return URL validation, and preservation of homepage/article tests. No external service or new loader API was invented.

Full archive sections remain Task 11 work. The current manifest has zero themes; unknown theme URLs show not-found. If a manifest later contains a theme mapping, this shell displays a Chinese theme placeholder until the theme loader/full view is implemented. The standalone HistoryGalaxyApp wrapper remains supported while the actual App route family uses exactly one provider boundary.

Dependency warnings remain: Three CJS deprecation in tests, Rollup annotations in zod, and gray-matter eval warning in builds. They do not fail verification and were outside Task 5 scope. Browser UI screenshot review was not performed; rendered integration coverage exercises the route and state contracts.

## Fix Round 1 — navigation direction and lazy fallback

Review identified that a galaxy→archive hashchange also occurs while traversing Back into an older archive. The old implementation incorrectly created a Back marker from that URL pair, so the return action could leave the history route family and land on the homepage. It also hardcoded a query-free galaxy link in the lazy Suspense fallback.

Changes:

- Browser entries now receive an explicit per-entry identity. A new archive Back marker is created only after an observed plain same-tab archive anchor activation from the current galaxy entry. The marker carries both the destination entry identity and the explicitly observed predecessor identity. Hash URLs alone never create that proof.
- Existing markers survive Back/Forward. Direct visits, programmatic hash transitions and unproven history traversals use the validated session fallback instead of assuming Back is safe.
- App ignores stale queued hashchange events whose new URL is no longer current and clears one-use link activation evidence after navigation.
- Lazy Suspense return navigation now computes its safe href with `getHistoryReturnLocation()` and invokes `restoreHistoryReturnLocation()`, matching the archive shell.

Strict TDD evidence:

- Added a cold first-render test that sees the actual lazy Suspense fallback before the history chunk resolves and checks/clicks its stored full-query link.
- Added the real sequence home → direct archive → filtered galaxy → Back → Forward → Back → return. The assertion requires the original filtered galaxy URL and its rendered controls.
- Updated the existing normal Back/Forward test to activate a real same-tab archive anchor, preserving evidence for preferred Back when a predecessor is known.
- RED command: `npm test -- --run src/routes.test.ts src/components/archive/ArchiveRoutes.test.tsx src/App.test.tsx`. Result: **2 failed, 43 passed**. Both new regressions failed for the reviewed defects: fallback href lost the query and traversal return reached the empty home hash. Log `/tmp/task5-fix1-red.log`.
- GREEN same command: **45 passed across 3 files**. Log `/tmp/task5-fix1-green.log`.
- Full `npm test`: **317 passed across 24 files**. Log `/tmp/task5-fix1-full.log`.
- `npm run build`: TypeScript and Vite production build passed. Log `/tmp/task5-fix1-build.log`.
- `git diff --check`: passed.

Self-review: verified that entry markers are browser-state scoped, do not rely on inferred URL direction, preserve other history state, and are consumed only after explicit same-tab archive-link navigation. Modified/new-tab/download links cannot create return markers. Existing exact URL validation, Chinese shell states, loader request boundaries and provider ownership remain intact. No new concerns beyond the previously documented unavailable theme loader and existing dependency warnings.
