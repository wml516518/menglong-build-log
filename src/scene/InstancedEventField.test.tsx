import { Children, isValidElement } from 'react';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { historyEvents } from '../history/events';
import { applyEventBatch, buildEventBatch, eventForInstance, InstancedEventField } from './InstancedEventField';

const events = Array.from({ length: 1200 }, (_, i) => ({ ...historyEvents[0], id: `event-${i}`, influence: (i % 5 + 1) as 1 | 2 | 3 | 4 | 5 }));
const harness = vi.hoisted(() => ({ frames: [] as ((state: any, delta: number) => void)[] }));
vi.mock('@react-three/fiber', async importOriginal => ({ ...await importOriginal<typeof import('@react-three/fiber')>(), useFrame: (frame: any) => harness.frames.push(frame) }));

it('keeps two draw fields for 1200 events and maps filtered instance IDs to the exact compact event', () => {
  const batch = buildEventBatch(events, ['event-501'], {});
  expect(batch).toHaveLength(1199);
  expect(eventForInstance(batch, 501)).toBe(events[502]);
  expect(eventForInstance(batch, -1)).toBeUndefined();
  expect(eventForInstance(batch, 1.5)).toBeUndefined();
  expect(eventForInstance(batch, 1199)).toBeUndefined();
  const onHover = vi.fn(), onPromote = vi.fn();
  const { result } = renderHook(() => InstancedEventField({ events, excludedIds: ['event-501'], dragOffsets: {}, reducedMotion: true, onHover, onPromote }));
  const meshes = Children.toArray(result.current?.props.children).filter(isValidElement);
  expect(meshes).toHaveLength(2);
  expect(meshes.every(mesh => mesh.type === 'instancedMesh' && mesh.props.args[2] === 1199)).toBe(true);
  const core = meshes[0];
  core.props.onPointerMove({ instanceId: 501, stopPropagation: vi.fn() });
  expect(onHover).toHaveBeenLastCalledWith('event-502');
  const target = document.createElement('canvas');
  core.props.onPointerDown({ instanceId: 501, pointerId: 7, nativeEvent: { clientX: 80, clientY: 120, target }, stopPropagation: vi.fn() });
  expect(onPromote).toHaveBeenCalledWith(events[502], { pointerId: 7, clientX: 80, clientY: 120, target });
});

it('writes influence, event colors and fixed offsets into real instance matrices without ambient frame mutation', () => {
  const batch = buildEventBatch([events[0], events[4]], [], { 'event-4': [1.5, -0.75] });
  const core = new THREE.InstancedMesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial(), 2);
  const halo = new THREE.InstancedMesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial(), 2);
  applyEventBatch(core, batch);
  applyEventBatch(halo, batch, true);
  expect(core.count).toBe(2);
  const matrix = new THREE.Matrix4();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), scale = new THREE.Vector3();
  core.getMatrixAt(0, matrix); matrix.decompose(a, new THREE.Quaternion(), scale);
  expect(scale.x).toBeCloseTo(0.18);
  core.getMatrixAt(1, matrix); matrix.decompose(b, new THREE.Quaternion(), scale);
  expect(scale.x).toBeCloseTo(0.5);
  expect(b.y - a.y).toBeCloseTo(1.5);
  expect(b.z - a.z).toBeCloseTo(-0.75);
  halo.getMatrixAt(1, matrix); matrix.decompose(b, new THREE.Quaternion(), scale);
  expect(scale.x).toBeCloseTo(0.9);
  expect(core.instanceColor).not.toBeNull();
  const color = new THREE.Color(); core.getColorAt(1, color);
  expect(color.getHexString()).toBe(new THREE.Color(events[4].color).getHexString());
  expect(core.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
  core.geometry.dispose(); (core.material as THREE.Material).dispose();
  halo.geometry.dispose(); (halo.material as THREE.Material).dispose();
});

it('keeps the actual fields and matrices still across animation frames with reduced motion', () => {
  harness.frames = [];
  const core = new THREE.InstancedMesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial(), 2);
  const halo = new THREE.InstancedMesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial(), 2);
  const { result, rerender, unmount } = renderHook(({ dragOffsets }) => InstancedEventField({ events: events.slice(0, 2), excludedIds: [], dragOffsets, reducedMotion: true, onHover: vi.fn(), onPromote: vi.fn() }), { initialProps: { dragOffsets: {} } });
  const fields = Children.toArray(result.current.props.children).filter(isValidElement);
  fields[0].props.ref.current = core; fields[1].props.ref.current = halo;
  rerender({ dragOffsets: {} });
  const matrices = [...core.instanceMatrix.array];
  for (let elapsedTime = 0; elapsedTime < 3; elapsedTime++) harness.frames.forEach(frame => frame({ clock: { elapsedTime } }, 1 / 60));
  expect([...core.instanceMatrix.array]).toEqual(matrices);
  expect(core.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
  expect(halo.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
  unmount(); core.geometry.dispose(); (core.material as THREE.Material).dispose(); halo.geometry.dispose(); (halo.material as THREE.Material).dispose();
});
