import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { historyEvents } from '../history/events';
import { SceneProjection } from './SceneProjection';
import type { ClusterResult } from '../history/clustering/protocol';

const harness = vi.hoisted(() => ({ state: undefined as any, frame: undefined as any }));
vi.mock('@react-three/fiber', async importOriginal => ({ ...await importOriginal<typeof import('@react-three/fiber')>(), useThree: (select: (state: any) => unknown) => select(harness.state), useFrame: (frame: any) => { harness.frame = frame; } }));

it('reports viewport membership only when its set changes, at the projection cadence including clustered members', async () => {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100); camera.position.set(0, 0, 10);
  harness.state = { camera, size: { width: 800, height: 800 } };
  const events = ['a', 'b', 'outside'].map(id => ({ ...historyEvents[0], id }));
  const positions = new Map<string, readonly [number, number, number]>([['a', [0, 0, 0]], ['b', [0.1, 0, 0]], ['outside', [100, 0, 0]]]);
  const memberships: string[][] = [];
  const { unmount } = renderHook(() => SceneProjection({ events, positions, level: 'period', protectedIds: [], onResult: () => {}, onViewportChange: (ids: ReadonlySet<string>) => memberships.push([...ids].sort()) }));
  const frame = (time: number) => act(async () => harness.frame?.({ clock: { elapsedTime: time } }, 1 / 60));
  await frame(0);
  expect(memberships).toEqual([['a', 'b']]);
  camera.position.x = 0.1;
  await frame(0.13);
  expect(memberships).toHaveLength(1);
  camera.position.x = 100;
  await frame(0.15);
  expect(memberships).toHaveLength(1);
  await frame(0.26);
  expect(memberships).toEqual([['a', 'b'], ['outside']]);
  unmount();
});

it('submits moving projections at a bounded cadence, skips idle frames and keeps important singles through the no-Worker path', async () => {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100); camera.position.set(0, 0, 10);
  harness.state = { camera, size: { width: 800, height: 800 } };
  const events = ['a', 'b', 'important'].map(id => ({ ...historyEvents[0], id }));
  const positions = new Map<string, readonly [number, number, number]>([['a', [0, 0, 0]], ['b', [1, 0, 0]], ['important', [0.2, 0, 0]]]);
  const results: ClusterResult[] = [];
  const onResult = (value: ClusterResult) => results.push(value);
  const { unmount } = renderHook(() => SceneProjection({ events, positions, level: 'period', protectedIds: ['important'], onResult }));
  const frame = (time: number) => act(async () => harness.frame?.({ clock: { elapsedTime: time } }, 1 / 60));
  await frame(0);
  expect(results).toHaveLength(1);
  expect(results[0].clusters[0].memberIds).toEqual(['a', 'b']);
  expect(results[0].singles.map(event => event.id)).toEqual(['important']);
  camera.position.x += 0.1;
  await frame(0.02); expect(results).toHaveLength(1);
  await frame(0.13); expect(results).toHaveLength(2);
  await frame(0.26); expect(results).toHaveLength(2);
  camera.position.z += 1;
  await frame(0.39); expect(results).toHaveLength(3);
  expect(results.map(result => result.revision)).toEqual([1, 2, 3]);
  unmount();
  camera.position.z += 1; await frame(0.52); expect(results).toHaveLength(3);
});

it('uses the mobile cluster radius and reprojects changed viewport and protection', async () => {
  const camera = new THREE.PerspectiveCamera(90, 0.85, 0.1, 100); camera.position.set(0, 0, 10);
  harness.state = { camera, size: { width: 680, height: 800 } };
  const events = ['a', 'b'].map(id => ({ ...historyEvents[0], id }));
  const positions = new Map<string, readonly [number, number, number]>([['a', [0, 0, 0]], ['b', [1.1875, 0, 0]]]);
  const results: ClusterResult[] = [];
  const { rerender, unmount } = renderHook(({ protectedIds }) => SceneProjection({ events, positions, level: 'period', protectedIds, onResult: value => results.push(value) }), { initialProps: { protectedIds: [] as string[] } });
  await act(async () => harness.frame?.({ clock: { elapsedTime: 0 } }, 1 / 60));
  expect(results[0]?.singles.map(event => event.id)).toEqual(['a', 'b']);
  harness.state.size = { width: 800, height: 800 }; camera.aspect = 1; camera.updateProjectionMatrix(); rerender({ protectedIds: [] });
  await act(async () => harness.frame?.({ clock: { elapsedTime: 0.13 } }, 1 / 60));
  expect(results[1]?.clusters[0]?.memberIds).toEqual(['a', 'b']);
  rerender({ protectedIds: ['a'] });
  await act(async () => harness.frame?.({ clock: { elapsedTime: 0.26 } }, 1 / 60));
  expect(results[2]?.singles.map(event => event.id)).toEqual(['a', 'b']);
  unmount();
});
