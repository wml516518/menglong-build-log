import { useMemo } from 'react';
import * as THREE from 'three';
import { dynasties } from '../history/dynasties';
import { yearToX } from '../history/space';
import type { TimelineLayout } from '../history/timelineLayout';

export function getTimelineY(x: number) {
  return Math.sin((x + 5) * 0.095) * 0.48 - 0.35;
}

export function getTimelineZ(x: number) {
  return Math.cos(x * 0.075) * 0.6 - 0.2;
}

export function TimelineRail({ timeline }: { timeline?: TimelineLayout } = {}) {
  const dateX = timeline?.yearToX ?? yearToX;
  const minX = timeline?.minX ?? -34, maxX = timeline?.maxX ?? 34;
  const segments = Math.max(180, Math.ceil((maxX - minX) / 1.5));
  const curve = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let x = minX; x < maxX; x += 2) points.push(new THREE.Vector3(x, getTimelineY(x), getTimelineZ(x)));
    points.push(new THREE.Vector3(maxX, getTimelineY(maxX), getTimelineZ(maxX)));
    return new THREE.CatmullRomCurve3(points);
  }, [minX, maxX]);

  const markers = useMemo(() => {
    const years: number[] = [];
    for (let year = -2000; year <= 1900; year += 100) if (year !== 0) years.push(year);
    return years;
  }, []);

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, segments, 0.045, 8, false]} />
        <meshStandardMaterial color="#8d7240" emissive="#c6a35b" emissiveIntensity={2.2} metalness={0.86} roughness={0.24} />
      </mesh>
      <mesh raycast={() => {}}>
        <tubeGeometry args={[curve, segments, 0.13, 8, false]} />
        <meshBasicMaterial color="#b99650" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {markers.map((year) => {
        const x = dateX(year);
        return (
          <group key={year} position={[x, getTimelineY(x), getTimelineZ(x)]}>
            <mesh position={[0, -0.28, 0]}>
              <boxGeometry args={[0.018, 0.45, 0.018]} />
              <meshBasicMaterial color="#9f8a62" transparent opacity={0.65} />
            </mesh>
            <mesh position={[0, -0.54, 0]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.055, 0.055, 0.02]} />
              <meshBasicMaterial color="#b69b62" transparent opacity={0.72} />
            </mesh>
          </group>
        );
      })}

      {dynasties.map((dynasty) => {
        const midpoint = (dateX(dynasty.start) + dateX(dynasty.end)) / 2;
        const width = Math.max(0.35, dateX(dynasty.end) - dateX(dynasty.start));
        return (
          <group key={dynasty.id} position={[midpoint, getTimelineY(midpoint) - 1.25, getTimelineZ(midpoint)]}>
            <mesh>
              <boxGeometry args={[width * 0.86, 0.018, 0.018]} />
              <meshBasicMaterial color={dynasty.color} transparent opacity={0.38} />
            </mesh>
            <mesh position={[0, -0.24, 0]}>
              <octahedronGeometry args={[0.075, 0]} />
              <meshBasicMaterial color={dynasty.color} transparent opacity={0.74} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
