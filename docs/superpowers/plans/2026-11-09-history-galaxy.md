# 历史星河 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable full-screen Three.js history timeline from the Tang dynasty through 1949 with draggable event stars, cinematic selection effects, and accessible stories.

**Architecture:** React owns semantic UI and selection state while React Three Fiber owns frame-by-frame rendering, camera motion, picking, dragging, and particle effects. Historical content and spatial mappings are pure typed modules so chronology, influence sizing, dynasty navigation, and accessibility can be tested without WebGL.

**Tech Stack:** React 19, TypeScript, Vite, Three.js, @react-three/fiber, @react-three/drei, @react-three/postprocessing, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-history-galaxy-design.md`

## Global Constraints

- The visible product name is `历史星河` and the root URL opens the 3D experience.
- The timeline spans 618 through 1949 and ships exactly 30 curated events.
- Dragging changes only visual Y/Z offsets; event years and chronological X positions never change.
- Keyboard controls support ArrowLeft, ArrowRight, Enter, and Escape.
- WebGL failure or test environments retain a semantic two-dimensional event navigator.
- Preserve unrelated untracked directories and do not delete the existing portfolio content modules.
- Netlify remains configured with `npm run build`, `dist`, Node 20, and SPA fallback.

---

### Task 1: Historical Data And Spatial Contracts

**Files:**
- Create: `src/history/types.ts`
- Create: `src/history/events.ts`
- Create: `src/history/space.ts`
- Test: `src/history/events.test.ts`
- Test: `src/history/space.test.ts`

**Interfaces:**
- Produces: `HistoryEvent`, `Dynasty`, `dynasties`, `historyEvents`, `yearToX(year)`, `influenceToScale(influence)`, `getDynastyForYear(year)`, and `getDynastyLeadEvent(dynastyId)`.

- [ ] **Step 1: Write failing data-contract tests**

Assert literal expectations: 30 unique IDs, sorted years, first year `627`, last year `1949`, every event has people and a story, influence stays within `1..5`, `yearToX(618) === -32`, `yearToX(1949) === 32`, influence 1 maps to `0.18`, influence 5 maps to `0.5`, and year 1840 belongs to `modern`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/history/events.test.ts src/history/space.test.ts`
Expected: FAIL because the history modules do not exist.

- [ ] **Step 3: Implement typed data and pure mappings**

Create seven dynasty ranges and the 30 events listed by the design spec. Clamp spatial input years to `618..1949`, use linear X mapping to `-32..32`, and map influence levels to literal radii `{1:0.18,2:0.24,3:0.31,4:0.39,5:0.5}`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/history/events.test.ts src/history/space.test.ts`
Expected: both files pass with no warnings.

### Task 2: Accessible Application Shell And Story State

**Files:**
- Create: `src/history/useHistoryNavigation.ts`
- Create: `src/components/HistoryHud.tsx`
- Create: `src/components/StoryPanel.tsx`
- Create: `src/components/EventNavigator.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `historyEvents`, `dynasties`, `getDynastyLeadEvent`.
- Produces: selected-event state, dynasty selection, previous/next navigation, close behavior, reset signal, and semantic event buttons carrying `data-event-id`.

- [ ] **Step 1: Replace the app tests with failing history-experience behaviors**

Test that the app renders `历史星河`, seven dynasty buttons, and 30 accessible event buttons; clicking `鸦片战争` opens its story and people; close removes the story panel; ArrowRight selects the next event; Escape closes the story; clicking `宋` selects `陈桥兵变`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL because the current portfolio UI has no history controls.

- [ ] **Step 3: Implement semantic UI and state**

Keep Canvas rendering isolated behind a lazy scene boundary. The DOM event navigator stays present but visually hidden on WebGL-capable screens, ensuring keyboard and screen-reader access. StoryPanel exposes `aria-labelledby`, close, previous, and next controls.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/App.test.tsx`
Expected: all history shell tests pass in jsdom without initializing WebGL.

### Task 3: Three.js Timeline, Event Dragging, And Selection Effects

**Files:**
- Create: `src/scene/HistoryScene.tsx`
- Create: `src/scene/TimelineRail.tsx`
- Create: `src/scene/EventStar.tsx`
- Create: `src/scene/StarField.tsx`
- Create: `src/scene/SelectionEffects.tsx`
- Create: `src/scene/CameraRig.tsx`
- Create: `src/scene/SceneFallback.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: selected event, hovered event, reset signal, `HistoryEvent`, `yearToX`, and `influenceToScale`.
- Produces: `onSelect(id)`, `onHover(id|null)`, `onEraChange(id)`, and session-only drag offsets keyed by event ID.

- [ ] **Step 1: Install runtime dependencies**

Run: `npm install three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing lucide-react`
Expected: lockfile records compatible React 19 packages with no peer-dependency errors.

- [ ] **Step 2: Implement a full-bleed Canvas and deterministic environment**

Use a perspective camera, bounded DPR `[1, 1.75]`, fog, ambient/key/rim lights, 1,800 deterministic star points on desktop and reduced density on narrow screens. Add Bloom and Vignette while keeping HTML text outside postprocessing.

- [ ] **Step 3: Implement the rail and 30 event stars**

Render a bronze tube curve from X `-32..32`, decade/century ticks, seven dynasty spans, and event stars with shared geometries/material families. Famous events must be visibly larger using `influenceToScale`.

- [ ] **Step 4: Implement pointer interaction and camera travel**

Orbit controls rotate and dolly the scene. Event pointer movement beyond 5 CSS pixels enters dragging and updates only Y/Z offsets. A click selects the event, camera spring-interpolates toward its X position, and controls remain usable after the animation.

- [ ] **Step 5: Implement selection effects and fallback**

Selection creates a temporary instanced particle burst, two expanding ring meshes, a local point light pulse, and an HTML person-name cluster. Scene errors call the semantic fallback instead of leaving a blank canvas.

- [ ] **Step 6: Verify unit suite and production build**

Run: `npm test -- --run && npm run build`
Expected: 0 failed tests and Vite build exit code 0.

### Task 4: Art Direction, Responsive Layout, And Metadata

**Files:**
- Modify: `src/styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: semantic classes from HistoryHud, EventNavigator, and StoryPanel.
- Produces: desktop right-side panel, mobile bottom sheet, safe-area HUD layout, focus styles, reduced-motion behavior, and project metadata.

- [ ] **Step 1: Replace the visible style layer**

Create a full-viewport black-ink canvas, bronze rules, jade/vermillion status colors, Song-style display typography, compact segmented dynasty navigation, stable icon button sizes, legible story typography, and non-overlapping responsive constraints.

- [ ] **Step 2: Add responsive and accessibility states**

At `max-width: 640px`, move the story into a bottom sheet capped at `58dvh`, allow horizontal era navigation, hide secondary HUD labels, and honor safe-area insets. Add visible `:focus-visible` outlines and disable nonessential transitions under reduced motion.

- [ ] **Step 3: Update document metadata**

Set `lang="zh-CN"`, theme color `#05070a`, title `历史星河｜中国历史3D交互时间轴`, and matching description/Open Graph metadata without changing Netlify configuration.

- [ ] **Step 4: Run complete automated verification**

Run: `npm test -- --run && npm run build`
Expected: all tests pass and `dist/index.html` contains the new project title.

### Task 5: Real Browser Playability And Deployment Readiness

**Files:**
- Create: `output/playwright/history-galaxy-desktop.png`
- Create: `output/playwright/history-galaxy-event.png`
- Create: `output/playwright/history-galaxy-mobile.png`
- Create: `/tmp/history-galaxy-browser-check.mjs` (temporary, not committed)

**Interfaces:**
- Consumes: the production-like Vite server at `http://127.0.0.1:4173`.
- Produces: browser evidence for nonblank Canvas, selection, panel controls, responsive layout, and error-free console.

- [ ] **Step 1: Start the development server**

Run: `npm run dev -- --host 127.0.0.1 --port 4173`
Expected: Vite serves the app and reports the local URL.

- [ ] **Step 2: Inspect desktop rendering and interactions**

At 1440×900 and 1280×720, wait for `canvas`, sample a screenshot grid to confirm more than 100 non-background pixels and at least 20 distinct RGB values, click `鸦片战争`, verify its heading and `林则徐`, close it, select `宋`, and verify `陈桥兵变`.

- [ ] **Step 3: Inspect drag and camera interaction**

Drag a visible event button's mirrored screen target through its scene interaction affordance, drag the canvas background, and wheel over the canvas. Confirm the app stays responsive and no page-level accidental scroll occurs.

- [ ] **Step 4: Inspect mobile rendering**

At 390×844, select `五四运动`, verify the bottom story sheet stays within the viewport, dynasty navigation remains horizontally usable, and no visible controls overlap the project title.

- [ ] **Step 5: Check browser diagnostics and save screenshots**

Fail the check on `pageerror`, console error, resource 404, missing WebGL renderer, blank-pixel threshold, or body overflow. Save the three screenshots under `output/playwright/`.

- [ ] **Step 6: Final verification and GitHub delivery**

Run: `npm test -- --run && npm run build && git diff --check`.
Commit only history-galaxy source, tests, metadata, lockfile, plan, and screenshots. Push the current feature branch to `origin` only after the commit succeeds.
