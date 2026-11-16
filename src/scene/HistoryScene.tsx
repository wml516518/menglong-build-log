import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { HistoryCameraState, HistoryFixedOffsets } from '../history/session';
import type { HistoryEvent } from '../history/types';
import { CameraRig, createClusterFocusRequest, type ClusterFocusRequest } from './CameraRig';
import { EventStar, getEventPosition } from './EventStar';
import { InstancedEventField } from './InstancedEventField';
import type { StarPointerStart } from './starDrag';
import { ClusterField } from './ClusterField';
import { SceneProjection } from './SceneProjection';
import type { ClusterResult, ScreenCluster } from '../history/clustering/protocol';
import { getLodLevel, getVisibilityBudget, selectProtectedEventIds } from '../history/lod';
import { createTimelineLayout, TIMELINE_LAYOUT_VERSION } from '../history/timelineLayout';
import { xToYear } from '../history/space';
import { SceneFallback } from './SceneFallback';
import { SelectionEffects } from './SelectionEffects';
import { StarField } from './StarField';
import { TimelineRail } from './TimelineRail';

interface HistorySceneProps {
  initialCamera?: Partial<HistoryCameraState>;
  onCameraChange?: (camera: HistoryCameraState) => void;
  initialFixedOffsets?: HistoryFixedOffsets;
  onFixedOffsetsChange?: (offsets: HistoryFixedOffsets) => void;
  onUnavailable?: () => void;
  events: HistoryEvent[];
  selectedEvent: HistoryEvent | null;
  hoveredId: string | null;
  resetSignal: number;
  selectionSignal: number;
  reducedMotion: boolean;
  onSelect: (event: HistoryEvent) => void;
  onHover: (id: string | null) => void;
  onTravelYear: (year: number) => void;
  searchTargetIds?: readonly string[];
  eventOpacities?: ReadonlyMap<string, number>;
  onViewportChange?: (ids: ReadonlySet<string>) => void;
}

const noSearchTargets: readonly string[] = [];
export function SceneContents({ events, selectedEvent, hoveredId, resetSignal, selectionSignal, reducedMotion, onSelect, onHover, onTravelYear, searchTargetIds = noSearchTargets, eventOpacities, onViewportChange, initialCamera, onCameraChange, initialFixedOffsets = {}, onFixedOffsetsChange }: HistorySceneProps) {
  const { size } = useThree();
  const [dragOffsets, setDragOffsets] = useState<HistoryFixedOffsets>(initialFixedOffsets);
  const releasedOffsets = useRef(dragOffsets);
  const [isDraggingStar, setIsDraggingStar] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{ event: HistoryEvent; start: StarPointerStart } | null>(null);
  const [level, setLevel] = useState(() => getLodLevel(27.68));
  const [focusRequest, setFocusRequest] = useState<ClusterFocusRequest | null>(null);
  const timeline = useMemo(() => createTimelineLayout(events), [events]);
  const positions = useMemo(() => new Map(events.map(event => [event.id, getEventPosition(event, dragOffsets[event.id], timeline.eventXs.get(event.id))])), [events, dragOffsets, timeline]);
  const restoredCamera = useMemo(() => initialCamera?.target && initialCamera.timelineLayout !== TIMELINE_LAYOUT_VERSION
    ? { ...initialCamera, target: [timeline.yearToX(xToYear(initialCamera.target[0])), initialCamera.target[1], initialCamera.target[2]] as const, timelineLayout: TIMELINE_LAYOUT_VERSION }
    : initialCamera, [initialCamera, timeline]);
  const [projection, setProjection] = useState<{ events: readonly HistoryEvent[]; positions: typeof positions; result: ClusterResult; singles: HistoryEvent[] } | null>(null);
  const onResult = useCallback((result: ClusterResult) => setProjection(previous => {
    const byId = new Map(events.map(event => [event.id, event]));
    const next = result.singles.flatMap(single => byId.has(single.id) ? [byId.get(single.id)!] : []);
    // Projection coordinates change during camera travel. Keep instance inputs
    // stable until membership or the compact content itself actually changes.
    const singles = previous?.events === events && next.length === previous.singles.length && next.every((event, i) => event === previous.singles[i]) ? previous.singles : next;
    return { events, positions, result, singles };
  }), [events, positions]);
  const promotedIds = useMemo(() => [...new Set([selectedEvent?.id, hoveredId, activeDrag?.event.id].filter((id): id is string => Boolean(id)))], [selectedEvent?.id, hoveredId, activeDrag?.event.id]);
  const protectedIds = useMemo(() => [...new Set([...selectProtectedEventIds(events, selectedEvent?.id, searchTargetIds, level), ...promotedIds])].sort(), [events, selectedEvent?.id, searchTargetIds, level, promotedIds]);
  const promotedEvents = useMemo(() => {
    const byId = new Map(events.map(event => [event.id, event]));
    if (selectedEvent) byId.set(selectedEvent.id, selectedEvent);
    if (activeDrag) byId.set(activeDrag.event.id, activeDrag.event);
    return promotedIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  }, [events, selectedEvent, activeDrag, promotedIds]);
  const clustered = projection?.events === events && projection.positions === positions ? projection.result : null;
  const visibleSingles = clustered ? projection!.singles : events;
  const clusters = useMemo(() => clustered?.clusters.filter(cluster => !cluster.memberIds.some(id => promotedIds.includes(id))) ?? [], [clustered, promotedIds]);
  const focusBounds = useCallback((cluster: ScreenCluster) => setFocusRequest(previous => createClusterFocusRequest((previous?.serial ?? 0) + 1, cluster, positions)), [positions]);
  const reportDistance = useCallback((distance: number) => setLevel(current => getLodLevel(distance, current)), []);
  const promote = useCallback((event: HistoryEvent, start: StarPointerStart) => { setActiveDrag({ event, start }); setIsDraggingStar(true); }, []);
  const changeDragState = useCallback((dragging: boolean) => { setIsDraggingStar(dragging); if (!dragging) setActiveDrag(null); }, []);
  const updateDragOffset = useCallback((id: string, offset: readonly [number, number]) => {
    const next = { ...releasedOffsets.current, [id]: offset };
    releasedOffsets.current = next;
    setDragOffsets(next);
    onFixedOffsetsChange?.(next);
  }, [onFixedOffsetsChange]);

  return (
    <>
      <color attach="background" args={['#030508']} />
      <fog attach="fog" args={['#05080b', 20, 76]} />
      <ambientLight intensity={0.25} color="#72969a" />
      <directionalLight position={[-12, 14, 18]} color="#e0bd72" intensity={1.7} />
      <directionalLight position={[22, -4, -12]} color="#4f8391" intensity={1.1} />
      <StarField />
      <TimelineRail timeline={timeline} />
      <SceneProjection events={events} positions={positions} level={level} protectedIds={protectedIds} onResult={onResult} onViewportChange={onViewportChange} />
      <InstancedEventField events={visibleSingles} excludedIds={promotedIds} dragOffsets={dragOffsets} xPositions={timeline.eventXs} reducedMotion={reducedMotion} onHover={onHover} onPromote={promote} eventOpacities={eventOpacities} />
      <ClusterField clusters={clusters} positions={positions} focusBounds={focusBounds} eventOpacities={eventOpacities} labelBudget={Math.max(0, getVisibilityBudget(level, size.width < 768).labels - promotedEvents.length)} />
      {promotedEvents.map((event) => (
        <EventStar
          key={event.id}
          event={event}
          timelineX={timeline.eventXs.get(event.id)}
          selected={selectedEvent?.id === event.id}
          hovered={hoveredId === event.id}
          dragOffset={dragOffsets[event.id] ?? [0, 0]}
          reducedMotion={reducedMotion}
          opacity={eventOpacities?.get(event.id) ?? 1}
          onSelect={onSelect}
          onHover={onHover}
          onDragOffset={updateDragOffset}
          onDragStateChange={changeDragState}
          onDragStart={promote}
          dragStart={activeDrag?.event.id === event.id ? activeDrag.start : undefined}
        />
      ))}
      {selectedEvent ? (
        <SelectionEffects
          key={`${selectedEvent.id}-${selectionSignal}`}
          event={selectedEvent}
          timelineX={timeline.eventXs.get(selectedEvent.id)}
          dragOffset={dragOffsets[selectedEvent.id] ?? [0, 0]}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <CameraRig
        initialCamera={restoredCamera}
        timeline={timeline}
        onCameraChange={onCameraChange}
        selectedEvent={selectedEvent}
        selectedPosition={selectedEvent ? positions.get(selectedEvent.id) : undefined}
        resetSignal={resetSignal}
        selectionSignal={selectionSignal}
        reducedMotion={reducedMotion}
        onTravelYear={onTravelYear}
        controlsEnabled={!isDraggingStar}
        focusRequest={focusRequest}
        onDistanceChange={reportDistance}
      />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.35} luminanceThreshold={0.45} luminanceSmoothing={0.24} />
        <Vignette eskil={false} offset={0.14} darkness={0.72} />
      </EffectComposer>
    </>
  );
}

export function HistoryScene(props: HistorySceneProps) {
  return (
    <Canvas
      className="history-canvas"
      dpr={[1, 1.75]}
      camera={{ position: [0, 9.5, 26], fov: 43, near: 0.1, far: 150 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      fallback={<SceneFallback />}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener('webglcontextlost', () => {
          // Renderer disposal intentionally loses the old context after unmount.
          if (gl.domElement.isConnected) props.onUnavailable?.();
        }, { once: true });
      }}
    >
      <Suspense fallback={null}>
        <SceneContents {...props} />
      </Suspense>
    </Canvas>
  );
}
