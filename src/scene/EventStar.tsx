import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { HistoryEvent } from '../history/types';
import { influenceToScale, yearToX } from '../history/space';
import { getTimelineY, getTimelineZ } from './TimelineRail';
import { beginStarDrag, type StarPointerStart } from './starDrag';

interface EventStarProps {
  event: HistoryEvent;
  selected: boolean;
  hovered: boolean;
  dragOffset: readonly [number, number];
  reducedMotion: boolean;
  onSelect: (event: HistoryEvent) => void;
  onHover: (id: string | null) => void;
  onDragOffset: (id: string, offset: readonly [number, number]) => void;
  onDragStateChange: (dragging: boolean) => void;
  dragStart?: StarPointerStart;
  onDragStart?: (event: HistoryEvent, start: StarPointerStart) => void;
}

export function getEventPosition(event: HistoryEvent, dragOffset: readonly [number, number] = [0, 0]): [number, number, number] {
  const x = yearToX(event.year);
  return [x, getTimelineY(x) + event.offset[0] + 1.1 + dragOffset[0], getTimelineZ(x) + event.offset[1] + dragOffset[1]];
}

export function EventStar({ event, selected, hovered, dragOffset, reducedMotion, onSelect, onHover, onDragOffset, onDragStateChange, dragStart, onDragStart }: EventStarProps) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const currentOffset = useRef<[number, number]>([dragOffset[0], dragOffset[1]]);
  const session = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onSelect, onHover, onDragOffset, onDragStateChange });
  callbacks.current = { onSelect, onHover, onDragOffset, onDragStateChange };
  const basePosition = getEventPosition(event);
  const radius = influenceToScale(event.influence);

  useEffect(() => {
    currentOffset.current = [dragOffset[0], dragOffset[1]];
  }, [dragOffset[0], dragOffset[1]]);

  const begin = (start: StarPointerStart) => {
    if (session.current) return;
    callbacks.current.onDragStateChange(true);
    session.current = beginStarDrag({ start, offset: currentOffset.current,
      onMove: offset => { currentOffset.current = [offset[0], offset[1]]; },
      onFinish: offset => {
        session.current = null;
        if (offset) callbacks.current.onDragOffset(event.id, offset);
        else callbacks.current.onSelect(event);
        callbacks.current.onHover(null); callbacks.current.onDragStateChange(false);
      },
      onCancel: () => {
        session.current = null; currentOffset.current = [dragOffset[0], dragOffset[1]];
        callbacks.current.onHover(null); callbacks.current.onDragStateChange(false);
      }
    });
  };
  // An instance's pointer-down survives its removal from the batch. Native
  // pointer listeners continue that same gesture on the promoted rich star.
  useEffect(() => { if (dragStart) begin(dragStart); }, [dragStart]);
  useEffect(() => () => session.current?.(), []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const phase = clock.elapsedTime * 0.72 + event.year * 0.013;
    group.current.position.y = basePosition[1] + currentOffset.current[0] + (reducedMotion ? 0 : Math.sin(phase) * 0.06);
    group.current.position.z = basePosition[2] + currentOffset.current[1];
    if (!reducedMotion) group.current.rotation.y += 0.003;
    const targetScale = selected ? 1.34 : hovered ? 1.18 : 1;
    group.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.09);
    if (!reducedMotion && glow.current) glow.current.rotation.z -= 0.004;
  });

  return (
    <group
      ref={group}
      position={getEventPosition(event, dragOffset)}
      onPointerDown={pointer => {
        pointer.stopPropagation();
        const start = { pointerId: pointer.pointerId, clientX: pointer.nativeEvent.clientX, clientY: pointer.nativeEvent.clientY, target: pointer.nativeEvent.target as HTMLElement };
        onDragStart?.(event, start);
        begin(start);
      }}
      onPointerEnter={pointer => { pointer.stopPropagation(); if (!session.current) { onHover(event.id); document.body.style.cursor = 'grab'; } }}
      onPointerLeave={() => { if (!session.current) { onHover(null); document.body.style.cursor = ''; } }}
    >
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color="#fff8df"
          emissive={event.color}
          emissiveIntensity={selected ? 8 : hovered ? 6 : 3.8}
          roughness={0.22}
          metalness={0.08}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glow}>
        <icosahedronGeometry args={[radius * 1.8, 1]} />
        <meshBasicMaterial color={event.color} transparent opacity={selected ? 0.2 : 0.08} wireframe blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {(selected || hovered) ? <pointLight color={event.color} intensity={selected ? 4.8 : 1.4} distance={selected ? 7 : 3.2} decay={2} /> : null}
      {(hovered || selected) ? (
        <mesh position={[0, radius + 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 0.42, radius * 0.49, 32]} />
          <meshBasicMaterial color={selected ? '#f0d28c' : event.color} side={THREE.DoubleSide} transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}
