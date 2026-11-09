import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { HistoryEvent } from '../history/types';
import { influenceToScale, yearToX } from '../history/space';
import { getTimelineY, getTimelineZ } from './TimelineRail';

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
}

export function getEventPosition(event: HistoryEvent, dragOffset: readonly [number, number] = [0, 0]): [number, number, number] {
  const x = yearToX(event.year);
  return [x, getTimelineY(x) + event.offset[0] + 1.1 + dragOffset[0], getTimelineZ(x) + event.offset[1] + dragOffset[1]];
}

export function EventStar({ event, selected, hovered, dragOffset, reducedMotion, onSelect, onHover, onDragOffset, onDragStateChange }: EventStarProps) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const currentOffset = useRef<[number, number]>([dragOffset[0], dragOffset[1]]);
  const pointerStart = useRef({ x: 0, y: 0, offsetY: 0, offsetZ: 0, dragging: false });
  const basePosition = getEventPosition(event);
  const radius = influenceToScale(event.influence);

  useEffect(() => {
    currentOffset.current = [dragOffset[0], dragOffset[1]];
  }, [dragOffset]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const phase = clock.elapsedTime * 0.72 + event.year * 0.013;
    group.current.position.y = basePosition[1] + currentOffset.current[0] + (reducedMotion ? 0 : Math.sin(phase) * 0.06);
    group.current.position.z = basePosition[2] + currentOffset.current[1];
    if (!reducedMotion) group.current.rotation.y += 0.003;
    const targetScale = selected ? 1.34 : hovered ? 1.18 : 1;
    group.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.09);
    if (glow.current) glow.current.rotation.z -= 0.004;
  });

  const onPointerDown = (pointerEvent: ThreeEvent<PointerEvent>) => {
    pointerEvent.stopPropagation();
    const pointerTarget = pointerEvent.target as HTMLElement;
    pointerTarget.setPointerCapture(pointerEvent.pointerId);
    pointerStart.current = {
      x: pointerEvent.nativeEvent.clientX,
      y: pointerEvent.nativeEvent.clientY,
      offsetY: currentOffset.current[0],
      offsetZ: currentOffset.current[1],
      dragging: false
    };
    document.body.dataset.draggingStar = 'true';
    onDragStateChange(true);
  };

  const onPointerMove = (pointerEvent: ThreeEvent<PointerEvent>) => {
    const pointerTarget = pointerEvent.target as HTMLElement;
    if (!pointerTarget.hasPointerCapture(pointerEvent.pointerId)) return;
    pointerEvent.stopPropagation();
    const dx = pointerEvent.nativeEvent.clientX - pointerStart.current.x;
    const dy = pointerEvent.nativeEvent.clientY - pointerStart.current.y;
    if (Math.hypot(dx, dy) > 5) pointerStart.current.dragging = true;
    if (pointerStart.current.dragging) {
      currentOffset.current = [
        THREE.MathUtils.clamp(pointerStart.current.offsetY - dy * 0.012, -2.6, 2.6),
        THREE.MathUtils.clamp(pointerStart.current.offsetZ + dx * 0.01, -2.4, 2.4)
      ];
    }
  };

  const onPointerUp = (pointerEvent: ThreeEvent<PointerEvent>) => {
    pointerEvent.stopPropagation();
    const pointerTarget = pointerEvent.target as HTMLElement;
    pointerTarget.releasePointerCapture(pointerEvent.pointerId);
    delete document.body.dataset.draggingStar;
    document.body.style.cursor = '';
    onDragStateChange(false);
    if (pointerStart.current.dragging) onDragOffset(event.id, currentOffset.current);
    else onSelect(event);
  };

  const cancelPointer = (pointerEvent: ThreeEvent<PointerEvent>) => {
    const pointerTarget = pointerEvent.target as HTMLElement;
    if (pointerTarget.hasPointerCapture(pointerEvent.pointerId)) pointerTarget.releasePointerCapture(pointerEvent.pointerId);
    currentOffset.current = [dragOffset[0], dragOffset[1]];
    delete document.body.dataset.draggingStar;
    document.body.style.cursor = '';
    onDragStateChange(false);
  };

  return (
    <group
      ref={group}
      position={basePosition}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={() => {
        delete document.body.dataset.draggingStar;
        document.body.style.cursor = '';
        onDragStateChange(false);
      }}
      onPointerEnter={(pointerEvent) => { pointerEvent.stopPropagation(); onHover(event.id); document.body.style.cursor = 'grab'; }}
      onPointerLeave={() => { onHover(null); document.body.style.cursor = ''; }}
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
