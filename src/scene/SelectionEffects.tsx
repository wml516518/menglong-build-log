import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HistoryEvent } from '../history/types';
import { getEventPosition } from './EventStar';

function seededDirections(event: HistoryEvent) {
  let seed = event.year * 2654435761;
  const positions = new Float32Array(72 * 3);
  for (let index = 0; index < 72; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const u = seed / 4294967296;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = seed / 4294967296;
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const radius = 0.5 + (index % 9) * 0.075;
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  return positions;
}

export function SelectionEffects({ event, dragOffset, reducedMotion }: {
  event: HistoryEvent;
  dragOffset: readonly [number, number];
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const burst = useRef<THREE.Points>(null);
  const startedAt = useRef<number | null>(null);
  const positions = useMemo(() => seededDirections(event), [event]);
  const position = getEventPosition(event, dragOffset);

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current;
    if (reducedMotion) return;
    if (group.current) group.current.rotation.y = elapsed * 0.22;
    if (burst.current) {
      const scale = 1 + Math.min(elapsed, 1.8) * 2.5;
      burst.current.scale.setScalar(scale);
      const material = burst.current.material as THREE.PointsMaterial;
      material.opacity = Math.max(0.08, 0.86 - elapsed * 0.22);
    }
    for (const [ring, delay] of [[ringA, 0], [ringB, 0.32]] as const) {
      if (!ring.current) continue;
      const progress = Math.max(0, elapsed - delay);
      ring.current.scale.setScalar(1 + progress * 3.2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.54 - progress * 0.22);
    }
  });

  return (
    <group ref={group} position={position} key={event.id}>
      <points ref={burst}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial color={event.color} size={0.07} transparent opacity={0.86} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.73, 64]} />
        <meshBasicMaterial color="#e7c77d" side={THREE.DoubleSide} transparent opacity={0.54} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.5, 64]} />
        <meshBasicMaterial color={event.color} side={THREE.DoubleSide} transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {event.people.map((person, index) => {
        const angle = (index / event.people.length) * Math.PI * 2;
        return (
          <mesh key={person} position={[Math.cos(angle) * 1.05, -1.05 + index * 0.08, Math.sin(angle) * 0.45]} rotation={[0, 0, angle * 0.2]}>
            <boxGeometry args={[0.46 + person.length * 0.05, 0.018, 0.018]} />
            <meshBasicMaterial color={index === 0 ? '#d64b36' : '#c7a35b'} transparent opacity={0.75} />
          </mesh>
        );
      })}
    </group>
  );
}
