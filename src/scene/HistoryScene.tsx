import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Suspense, useCallback, useState } from 'react';
import * as THREE from 'three';
import type { HistoryEvent } from '../history/types';
import { CameraRig } from './CameraRig';
import { EventStar } from './EventStar';
import { SceneFallback } from './SceneFallback';
import { SelectionEffects } from './SelectionEffects';
import { StarField } from './StarField';
import { TimelineRail } from './TimelineRail';

interface HistorySceneProps {
  events: HistoryEvent[];
  selectedEvent: HistoryEvent | null;
  hoveredId: string | null;
  resetSignal: number;
  selectionSignal: number;
  reducedMotion: boolean;
  onSelect: (event: HistoryEvent) => void;
  onHover: (id: string | null) => void;
  onTravelYear: (year: number) => void;
}

export function SceneContents({ events, selectedEvent, hoveredId, resetSignal, selectionSignal, reducedMotion, onSelect, onHover, onTravelYear }: HistorySceneProps) {
  const [dragOffsets, setDragOffsets] = useState<Record<string, readonly [number, number]>>({});
  const [isDraggingStar, setIsDraggingStar] = useState(false);
  const updateDragOffset = useCallback((id: string, offset: readonly [number, number]) => {
    setDragOffsets((current) => ({ ...current, [id]: offset }));
  }, []);

  return (
    <>
      <color attach="background" args={['#030508']} />
      <fog attach="fog" args={['#05080b', 20, 76]} />
      <ambientLight intensity={0.25} color="#72969a" />
      <directionalLight position={[-12, 14, 18]} color="#e0bd72" intensity={1.7} />
      <directionalLight position={[22, -4, -12]} color="#4f8391" intensity={1.1} />
      <StarField />
      <TimelineRail />
      {events.map((event) => (
        <EventStar
          key={event.id}
          event={event}
          selected={selectedEvent?.id === event.id}
          hovered={hoveredId === event.id}
          dragOffset={dragOffsets[event.id] ?? [0, 0]}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          onHover={onHover}
          onDragOffset={updateDragOffset}
          onDragStateChange={setIsDraggingStar}
        />
      ))}
      {selectedEvent ? (
        <SelectionEffects
          key={`${selectedEvent.id}-${selectionSignal}`}
          event={selectedEvent}
          dragOffset={dragOffsets[selectedEvent.id] ?? [0, 0]}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <CameraRig
        selectedEvent={selectedEvent}
        resetSignal={resetSignal}
        reducedMotion={reducedMotion}
        onTravelYear={onTravelYear}
        controlsEnabled={!isDraggingStar}
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
      }}
    >
      <Suspense fallback={null}>
        <SceneContents {...props} />
      </Suspense>
    </Canvas>
  );
}
