import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HistoryEvent } from '../history/types';
import { influenceToScale } from '../history/space';
import { getEventPosition } from './EventStar';
import type { StarPointerStart } from './starDrag';
export type { StarPointerStart } from './starDrag';

export type DragOffsets = Readonly<Record<string, readonly [number, number]>>;
export interface EventInstance { event: HistoryEvent; position: [number, number, number]; scale: number; opacity: number }
export interface InstancedEventFieldProps {
  events: readonly HistoryEvent[];
  excludedIds: readonly string[];
  dragOffsets: DragOffsets;
  xPositions?: ReadonlyMap<string, number>;
  reducedMotion: boolean;
  eventOpacities?: ReadonlyMap<string, number>;
  onHover: (id: string | null) => void;
  onPromote: (event: HistoryEvent, start: StarPointerStart) => void;
}
export function buildEventBatch(events: readonly HistoryEvent[], excludedIds: readonly string[], dragOffsets: DragOffsets, eventOpacities?: ReadonlyMap<string, number>, xPositions?: ReadonlyMap<string, number>): EventInstance[] {
  const excluded = new Set(excludedIds);
  return events.filter(event => !excluded.has(event.id)).map(event => ({ event, position: getEventPosition(event, dragOffsets[event.id], xPositions?.get(event.id)), scale: influenceToScale(event.influence), opacity: eventOpacities?.get(event.id) ?? 1 }));
}
export function eventForInstance(batch: readonly EventInstance[], instanceId?: number): HistoryEvent | undefined {
  return instanceId !== undefined && Number.isInteger(instanceId) && instanceId >= 0 ? batch[instanceId]?.event : undefined;
}
export function applyEventBatch(mesh: THREE.InstancedMesh, batch: readonly EventInstance[], halo = false): void {
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion(), color = new THREE.Color();
  mesh.count = batch.length;
  batch.forEach((entry, i) => {
    matrix.compose(position.fromArray(entry.position), rotation, scale.setScalar(entry.scale * (halo ? 1.8 : 1)));
    mesh.setMatrixAt(i, matrix);
    // Multiplying linear instance colors dims both static draw fields without
    // splitting batches or changing hit-test identity and spatial context.
    mesh.setColorAt(i, color.set(entry.event.color).multiplyScalar(entry.opacity));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}
export function InstancedEventField({ events, excludedIds, dragOffsets, onHover, onPromote, eventOpacities, xPositions }: InstancedEventFieldProps) {
  const batch = useMemo(() => buildEventBatch(events, excludedIds, dragOffsets, eventOpacities, xPositions), [events, excludedIds, dragOffsets, eventOpacities, xPositions]);
  const core = useRef<THREE.InstancedMesh>(null), halo = useRef<THREE.InstancedMesh>(null);
  // Both fields stay static, including in reduced-motion mode. Visibility or a
  // released drag changes matrices; the render loop never rewrites instances.
  useLayoutEffect(() => {
    if (core.current) applyEventBatch(core.current, batch);
    if (halo.current) applyEventBatch(halo.current, batch, true);
  }, [batch]);
  const hover = (pointer: InstancePointerEvent) => {
    const event = eventForInstance(batch, pointer.instanceId);
    if (!event) return;
    pointer.stopPropagation(); onHover(event.id);
    document.body.style.cursor = 'grab';
  };
  return <>
    <instancedMesh ref={core} args={[undefined, undefined, Math.max(1, batch.length)]}
      onPointerOver={hover} onPointerMove={hover}
      onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
      onPointerDown={pointer => {
        const event = eventForInstance(batch, pointer.instanceId);
        if (!event) return;
        pointer.stopPropagation();
        onPromote(event, { pointerId: pointer.pointerId, clientX: pointer.nativeEvent.clientX, clientY: pointer.nativeEvent.clientY, target: pointer.nativeEvent.target as HTMLElement });
      }}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={halo} args={[undefined, undefined, Math.max(1, batch.length)]} raycast={() => {}}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.09} wireframe blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  </>;
}
export type InstancePointerEvent = ThreeEvent<PointerEvent>;
