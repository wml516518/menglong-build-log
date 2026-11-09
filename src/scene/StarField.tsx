import { useMemo } from 'react';
import * as THREE from 'three';

function randomSequence(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createStarPositions(count: number, seed: number, belt = false) {
  const random = randomSequence(seed);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    positions[offset] = (random() - 0.5) * (belt ? 84 : 110);
    positions[offset + 1] = belt ? (random() - 0.5) * 7 : (random() - 0.5) * 48;
    positions[offset + 2] = belt ? (random() - 0.5) * 6 - 1 : (random() - 0.5) * 55 - 8;
  }
  return positions;
}

function PointCloud({ count, seed, belt, color, size, opacity }: {
  count: number;
  seed: number;
  belt?: boolean;
  color: string;
  size: number;
  opacity: number;
}) {
  const positions = useMemo(() => createStarPositions(count, seed, belt), [belt, count, seed]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function StarField() {
  const isCompact = typeof window !== 'undefined' && window.innerWidth < 700;
  return (
    <group>
      <PointCloud count={isCompact ? 850 : 1900} seed={1911} color="#b9d8d2" size={0.065} opacity={0.64} />
      <PointCloud count={isCompact ? 420 : 920} seed={618} belt color="#d7b870" size={0.085} opacity={0.48} />
      <mesh position={[0, -8, -15]} rotation={[-Math.PI / 2.6, 0, -0.08]}>
        <planeGeometry args={[100, 28, 1, 1]} />
        <meshBasicMaterial color="#14232a" transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-14, 7, -18]} rotation={[0.18, -0.12, -0.08]}>
        <planeGeometry args={[34, 0.025]} />
        <meshBasicMaterial color="#a89055" transparent opacity={0.26} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[19, -5, -12]} rotation={[-0.12, 0.18, 0.1]}>
        <planeGeometry args={[29, 0.018]} />
        <meshBasicMaterial color="#5f98a5" transparent opacity={0.22} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
