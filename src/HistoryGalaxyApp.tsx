import { ArrowLeft } from 'lucide-react';
import { HistoryContentProvider, useHistoryContent } from './history/content/store';
import './history-galaxy.css';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { EventNavigator } from './components/EventNavigator';
import { HistoryExplorer } from './components/HistoryExplorer';
import { HistoryHud } from './components/HistoryHud';
import { QuickEventPanel } from './components/QuickEventPanel';
import { dynasties } from './history/dynasties';
import type { HistoryContentLoader } from './history/content/loader';
import { compactEventsForScene } from './history/content/scene-adapter';
import { getDynastyForYear } from './history/space';
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
  const historyEvents = useMemo(() => compactEventsForScene(content.events, content.people), [content.events, content.people]);
  const [currentYear, setCurrentYear] = useState(618);
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
  const navigation = useHistoryNavigation(historyEvents, syncEvent, syncDynasty);
  const webglSupported = useMemo(hasWebGLSupport, []);
  const reducedMotion = useReducedMotion();
  const showFallback = !webglSupported || sceneFailed;
  const searchIndexes = useMemo(() => ({ events: content.events, people: content.people, places: content.places, themes: content.themes }), [content.events, content.people, content.places, content.themes]);
  const [viewportIds, setViewportIds] = useState<ReadonlySet<string>>(() => new Set());
  const explorer = useHistoryExplorer(searchIndexes, viewportIds, !content.loading);
  const handleTravelYear = useCallback((year: number) => {
    setCurrentYear(year);
    setActiveDynastyId(getDynastyForYear(year).id);
  }, []);
  const handleReset = useCallback(() => {
    setCurrentYear(701);
    setActiveDynastyId('tang');
    navigation.triggerReset();
  }, [navigation]);

  const selectedCompactEvent = content.events.find(event => event.id === navigation.selectedEvent?.id);

  return (
    <main className="history-experience">
      <a className="history-home-link" href="#home" aria-label="返回主页">
        <ArrowLeft aria-hidden="true" size={18} />
        <span>返回主页</span>
      </a>
      <div className="scene-shell" aria-label="三维历史时间轴">
        {!showFallback ? (
          <SceneErrorBoundary onError={() => setSceneFailed(true)}>
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
              />
            </Suspense>
          </SceneErrorBoundary>
        ) : <SceneFallback />}
      </div>

      <HistoryHud
        currentYear={currentYear}
        activeDynastyId={activeDynastyId}
        onSelectDynasty={navigation.selectDynasty}
        onReset={handleReset}
      />

      {content.loading ? <p role="status">正在加载历史索引…</p> : null}
      {content.error ? <p role="alert">历史内容加载失败 <button type="button" onClick={() => { void content.retry().catch(() => {}); }}>重试历史内容</button></p> : null}
      <HistoryExplorer explorer={explorer} indexes={searchIndexes} eras={content.manifest?.eras ?? []} selectedId={navigation.selectedEvent?.id ?? null} onSelect={navigation.selectEvent} onOpen={navigation.closeStory} viewportAvailable={!showFallback} />
      <EventNavigator events={historyEvents} selectedEvent={navigation.selectedEvent} onSelect={navigation.selectEvent} isFallback={showFallback} eventOpacities={explorer.eventOpacities} integratedExplorer />

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
        <small>DRAG TO ORBIT · SCROLL TO TRAVEL</small>
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
