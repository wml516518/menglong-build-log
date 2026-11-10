import { ArrowLeft } from 'lucide-react';
import { HistoryContentProvider } from './history/content/store';
import './history-galaxy.css';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { EventNavigator } from './components/EventNavigator';
import { HistoryHud } from './components/HistoryHud';
import { StoryPanel } from './components/StoryPanel';
import { dynasties, historyEvents } from './history/events';
import { getDynastyForYear } from './history/space';
import type { DynastyId, HistoryEvent } from './history/types';
import { useHistoryNavigation } from './history/useHistoryNavigation';
import { useReducedMotion } from './history/useReducedMotion';
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

export default function HistoryGalaxyApp() {
  return <HistoryContentProvider><HistoryGalaxyExperience /></HistoryContentProvider>;
}

function HistoryGalaxyExperience() {
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
  const navigation = useHistoryNavigation(syncEvent, syncDynasty);
  const webglSupported = useMemo(hasWebGLSupport, []);
  const reducedMotion = useReducedMotion();
  const showFallback = !webglSupported || sceneFailed;
  const handleTravelYear = useCallback((year: number) => {
    setCurrentYear(year);
    setActiveDynastyId(getDynastyForYear(year).id);
  }, []);
  const handleReset = useCallback(() => {
    setCurrentYear(701);
    setActiveDynastyId('tang');
    navigation.triggerReset();
  }, [navigation]);

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
                selectedEvent={navigation.selectedEvent}
                hoveredId={navigation.hoveredId}
                resetSignal={navigation.resetSignal}
                selectionSignal={navigation.selectionSignal}
                reducedMotion={reducedMotion}
                onSelect={navigation.selectEvent}
                onHover={navigation.setHoveredId}
                onTravelYear={handleTravelYear}
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

      <EventNavigator selectedEvent={navigation.selectedEvent} onSelect={navigation.selectEvent} isFallback={showFallback} />

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

      {navigation.selectedEvent ? (
        <StoryPanel
          event={navigation.selectedEvent}
          onClose={navigation.closeStory}
          onPrevious={() => navigation.moveSelection(-1)}
          onNext={() => navigation.moveSelection(1)}
        />
      ) : null}
    </main>
  );
}
