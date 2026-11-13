import { ArrowLeft } from 'lucide-react';
import { HistoryContentProvider, useHistoryContent } from './history/content/store';
import './history-galaxy.css';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HistoryTimeline2D } from './components/HistoryTimeline2D';
import { loadHistorySession, sanitizeHistorySession, saveHistorySession, type HistoryCameraState, type HistoryFixedOffsets, type HistorySession } from './history/session';
import { EventNavigator } from './components/EventNavigator';
import { HistoryExplorer } from './components/HistoryExplorer';
import { HistoryHud } from './components/HistoryHud';
import { QuickEventPanel } from './components/QuickEventPanel';
import { dynasties } from './history/dynasties';
import type { HistoryContentLoader } from './history/content/loader';
import { compactEventsForScene } from './history/content/scene-adapter';
import { DEFAULT_HISTORY_YEAR, getDynastyForYear } from './history/space';
import type { DynastyId, HistoryEvent } from './history/types';
import { useHistoryNavigation } from './history/useHistoryNavigation';
import { useReducedMotion } from './history/useReducedMotion';
import { useHistoryExplorer } from './history/explorer/useHistoryExplorer';
import { SceneFallback } from './scene/SceneFallback';
import { SceneErrorBoundary } from './scene/SceneErrorBoundary';

const HistoryScene = lazy(() => import('./scene/HistoryScene').then((module) => ({ default: module.HistoryScene })));

function hasWebGLSupport() {
  if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function HistoryGalaxyApp({ loader }: { loader?: HistoryContentLoader } = {}) {
  return <HistoryContentProvider loader={loader}><HistoryGalaxyExperience /></HistoryContentProvider>;
}

export function HistoryGalaxyExperience() {
  const content = useHistoryContent();
  const [restored] = useState(loadHistorySession);
  const [camera, setCamera] = useState(restored?.camera);
  const [fixedOffsets, setFixedOffsets] = useState(restored?.fixedOffsets ?? {});
  const historyEvents = useMemo(() => compactEventsForScene(content.events, content.people), [content.events, content.people]);
  const [currentYear, setCurrentYear] = useState(DEFAULT_HISTORY_YEAR);
  const [activeDynastyId, setActiveDynastyId] = useState<DynastyId>('tang');
  const [sceneFailed, setSceneFailed] = useState(false);
  const syncEvent = useCallback((event: HistoryEvent) => {
    setCurrentYear(event.year);
    setActiveDynastyId(event.dynasty);
  }, []);
  const syncDynasty = useCallback((dynastyId: DynastyId, event: HistoryEvent) => {
    const dynasty = dynasties.find((candidate) => candidate.id === dynastyId);
    setCurrentYear(dynasty?.start ?? event.year);
    setActiveDynastyId(dynastyId);
  }, []);
  const navigation = useHistoryNavigation(historyEvents, syncEvent, syncDynasty, restored?.selectedId);
  const webglSupported = useMemo(hasWebGLSupport, []);
  const reducedMotion = useReducedMotion();
  const showFallback = !webglSupported || sceneFailed;
  const searchIndexes = useMemo(() => ({ events: content.events, people: content.people, places: content.places, themes: content.themes }), [content.events, content.people, content.places, content.themes]);
  const indexesReady = !content.loading && !content.error && Boolean(content.manifest);
  const explorerEntityIds = useMemo(() => ({
    eraIds: new Set(content.manifest?.eras.map(era => era.id)),
    personIds: new Set(content.people.map(person => person.id)),
    placeIds: new Set(content.places.map(place => place.id)),
    themeIds: new Set(content.themes.map(theme => theme.id))
  }), [content.manifest, content.people, content.places, content.themes]);
  const [viewportIds, setViewportIds] = useState<ReadonlySet<string>>(() => new Set());
  const explorer = useHistoryExplorer(searchIndexes, viewportIds, indexesReady, restored?.explorer, explorerEntityIds);
  const handleTravelYear = useCallback((year: number) => {
    setCurrentYear(year);
    setActiveDynastyId(getDynastyForYear(year).id);
  }, []);
  const handleReset = useCallback(() => {
    setCurrentYear(DEFAULT_HISTORY_YEAR);
    setActiveDynastyId('tang');
    navigation.triggerReset();
  }, [navigation]);

  const validIds = useMemo(() => new Set(content.events.filter(event => content.manifest && Object.hasOwn(content.manifest.eventEras, event.id)).map(event => event.id)), [content.events, content.manifest]);
  const validFixedOffsets = useMemo(() => sanitizeHistorySession({ version: 2, fixedOffsets }, validIds)?.fixedOffsets ?? {}, [fixedOffsets, validIds]);
  const sessionReady = indexesReady && !explorer.restorationPending;
  useEffect(() => {
    if (sessionReady && navigation.selectedEvent && !validIds.has(navigation.selectedEvent.id)) navigation.closeStory();
  }, [sessionReady, validIds, navigation.selectedEvent, navigation.closeStory]);
  const sessionActive = useRef(true);
  const latestSession = useRef<HistorySession | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushSession = useCallback(() => {
    clearTimeout(saveTimer.current); saveTimer.current = undefined;
    if (latestSession.current) saveHistorySession(latestSession.current);
  }, []);
  useEffect(() => {
    if (!sessionReady) return;
    latestSession.current = sanitizeHistorySession({ version: 2, camera, fixedOffsets: validFixedOffsets, explorer: explorer.state, selectedId: navigation.selectedEvent?.id ?? null }, validIds);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSession, 300);
  }, [sessionReady, camera, validFixedOffsets, explorer.state, navigation.selectedEvent?.id, validIds, flushSession]);
  useEffect(() => {
    sessionActive.current = true;
    window.addEventListener('pagehide', flushSession);
    return () => { sessionActive.current = false; window.removeEventListener('pagehide', flushSession); flushSession(); };
  }, [flushSession]);
  const restoredSelection = useRef(false);
  useEffect(() => {
    if (content.loading || restoredSelection.current) return;
    restoredSelection.current = true;
    if (navigation.selectedEvent && navigation.selectedEvent.id === restored?.selectedId) syncEvent(navigation.selectedEvent);
  }, [content.loading, navigation.selectedEvent, restored, syncEvent]);
  // Native pagehide and scene-release callbacks update the flush snapshot
  // synchronously, before React batches the corresponding UI state update.
  const handleCameraChange = useCallback((next: HistoryCameraState) => {
    if (latestSession.current) latestSession.current = { ...latestSession.current, camera: next };
    if (sessionActive.current) setCamera(next); else flushSession();
  }, [flushSession]);
  const handleFixedOffsetsChange = useCallback((next: HistoryFixedOffsets) => {
    if (latestSession.current) latestSession.current = { ...latestSession.current, fixedOffsets: next };
    if (sessionActive.current) setFixedOffsets(next); else flushSession();
  }, [flushSession]);
  const timeline = <HistoryTimeline2D events={explorer.filtered} eras={content.manifest?.eras ?? []} state={explorer.state} selectedId={navigation.selectedEvent?.id ?? null} onSelect={navigation.selectEvent} searchTargetIds={explorer.searchTargetIds} />;
  const handleSceneUnavailable = useCallback(() => setSceneFailed(true), []);
  const selectedCompactEvent = content.events.find(event => event.id === navigation.selectedEvent?.id);

  return (
    <main className={`history-experience ${showFallback ? 'is-timeline' : ''}`}>
      <a className="history-home-link" href="#home" aria-label="返回主页">
        <ArrowLeft aria-hidden="true" size={18} />
        <span>返回主页</span>
      </a>
      <div className="scene-shell" aria-label={showFallback ? '历史年表场景' : '三维历史时间轴'}>
        {content.loading ? <SceneFallback /> : !showFallback ? (
          <SceneErrorBoundary onError={handleSceneUnavailable}>
            <Suspense fallback={<SceneFallback />}>
              <HistoryScene
                events={historyEvents}
                selectedEvent={navigation.selectedEvent}
                hoveredId={navigation.hoveredId}
                resetSignal={navigation.resetSignal}
                selectionSignal={navigation.selectionSignal}
                reducedMotion={reducedMotion}
                onSelect={navigation.selectEvent}
                onHover={navigation.setHoveredId}
                onTravelYear={handleTravelYear}
                searchTargetIds={explorer.searchTargetIds}
                eventOpacities={explorer.eventOpacities}
                onViewportChange={setViewportIds}
                initialCamera={restored?.camera}
                onCameraChange={handleCameraChange}
                initialFixedOffsets={validFixedOffsets}
                onFixedOffsetsChange={handleFixedOffsetsChange}
                onUnavailable={handleSceneUnavailable}
              />
            </Suspense>
          </SceneErrorBoundary>
        ) : timeline}
      </div>

      <HistoryHud
        currentYear={currentYear}
        activeDynastyId={activeDynastyId}
        onSelectDynasty={navigation.selectDynasty}
        onReset={handleReset}
      />

      {content.loading || content.error ? <section className="history-content-status" aria-label="历史内容状态">
        {content.loading ? <p role="status">正在加载历史索引…</p> : <p role="alert">历史内容加载失败 <button type="button" onClick={() => { void content.retry().catch(() => {}); }}>重试历史内容</button></p>}
      </section> : null}
      <HistoryExplorer explorer={explorer} indexes={searchIndexes} eras={content.manifest?.eras ?? []} selectedId={navigation.selectedEvent?.id ?? null} onSelect={navigation.selectEvent} onOpen={navigation.closeStory} viewportAvailable={!showFallback} />
      {!showFallback ? <EventNavigator events={historyEvents} selectedEvent={navigation.selectedEvent} onSelect={navigation.selectEvent} isFallback={showFallback} eventOpacities={explorer.eventOpacities} integratedExplorer /> : null}

      <div className="timeline-readout" aria-live="polite">
        <span>{navigation.selectedEvent
          ? `${navigation.selectedEvent.year} · ${navigation.selectedEvent.title}`
          : navigation.hoveredId
            ? (() => {
                const hovered = historyEvents.find((event) => event.id === navigation.hoveredId);
                return hovered ? `${hovered.year} · ${hovered.title}` : '拖动星河 · 选择历史光点';
              })()
            : '拖动星河 · 选择历史光点'}</span>
        <div><i /><i /><i /></div>
        <small>滚轮缩放 · Shift + 滚轮沿时间轴移动</small>
      </div>

      {selectedCompactEvent ? (
        <QuickEventPanel
          key={selectedCompactEvent.id}
          event={selectedCompactEvent}
          onClose={navigation.closeStory}
          onPrevious={() => navigation.moveSelection(-1)}
          onNext={() => navigation.moveSelection(1)}
        />
      ) : null}
    </main>
  );
}
