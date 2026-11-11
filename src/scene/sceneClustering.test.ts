import * as THREE from 'three';
import { historyEvents } from '../history/events';
import type { ClusterInput, ClusterWorker, FrameScheduler } from '../history/clustering/protocol';
import { projectSceneEvents, SceneClusterProjector } from './sceneClustering';

it('projects world positions into CSS pixels and rejects behind-camera points with stable era/period/category meaning', () => {
  const camera = new THREE.PerspectiveCamera(90, 2, 0.1, 100); camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
  const events = ['a', 'b', 'behind'].map(id => ({ ...historyEvents[0], id, eraId: 'tang', period: '盛唐', categories: ['culture', 'science'] as const }));
  const positions = new Map<string, readonly [number, number, number]>([['a', [0, 0, 0]], ['b', [2, 0, 0]], ['behind', [0, 0, 30]]]);
  const projected = projectSceneEvents(events, positions, camera, { width: 800, height: 400 });
  expect(projected).toHaveLength(3);
  expect(projected[0]).toMatchObject({ id: 'a', x: 400, y: 200, visible: true });
  expect(projected[1].x).toBeCloseTo(440);
  expect(projected[2].visible).toBe(false);
  expect(projected[0].semanticGroup).toBe(JSON.stringify(['tang', '盛唐', ['culture', 'science']]));
  expect(projectSceneEvents([{ ...events[0], categories: ['science', 'culture'] }], positions, camera, { width: 800, height: 400 })[0].semanticGroup).toBe(projected[0].semanticGroup);
});

const input = (revision: number): ClusterInput => ({ revision, level: 'period', mobile: false, viewport: { width: 800, height: 400 }, protectedIds: ['important'], previousClusters: [], events: [
  { id: 'a', x: 100, y: 100, semanticGroup: 'tang', visible: true }, { id: 'b', x: 130, y: 100, semanticGroup: 'tang', visible: true }, { id: 'important', x: 110, y: 100, semanticGroup: 'tang', visible: true }
] });

it('falls back to the real clustering algorithm when Worker construction fails, preserving protected singles', async () => {
  const factory = vi.fn(() => { throw new Error('Worker unavailable'); });
  const projector = new SceneClusterProjector({ workerFactory: factory });
  const result = await projector.project(input(1));
  expect(result.clusters.map(cluster => cluster.memberIds)).toEqual([['a', 'b']]);
  expect(result.singles.map(event => event.id)).toEqual(['important']);
  expect((await projector.project(input(2))).revision).toBe(2);
  expect(factory).toHaveBeenCalledTimes(1);
  projector.dispose();
  await expect(projector.project(input(3))).rejects.toMatchObject({ name: 'AbortError' });
});

it('recovers the current projection and future revisions after a Worker execution failure', async () => {
  let scheduled: FrameRequestCallback | undefined;
  const scheduler: FrameScheduler = { request: cb => { scheduled = cb; return 1; }, cancel: () => {} };
  const worker: ClusterWorker = { onmessage: null, onerror: null, postMessage: () => {}, terminate: vi.fn() };
  const projector = new SceneClusterProjector({ workerFactory: () => worker, scheduler });
  const pending = projector.project(input(1)); scheduled?.(0);
  worker.onerror?.({ message: 'crashed' } as ErrorEvent);
  expect((await pending).clusters[0]?.memberIds).toEqual(['a', 'b']);
  expect((await projector.project(input(2))).singles[0].id).toBe('important');
  await expect(projector.project(input(1))).rejects.toMatchObject({ name: 'AbortError' });
  projector.dispose();
});
