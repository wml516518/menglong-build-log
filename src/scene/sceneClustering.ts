import * as THREE from 'three';
import { HistoryClusterClient, type HistoryClusterClientOptions } from '../history/clustering/client';
import { clusterEvents } from '../history/clustering/cluster';
import type { ClusterInput, ClusterResult, ProjectedEvent } from '../history/clustering/protocol';
import type { HistoryEvent } from '../history/types';
import type { WorldPositions } from './ClusterField';
export function projectSceneEvents(events: readonly HistoryEvent[], positions: WorldPositions, camera: THREE.Camera, viewport: { width: number; height: number }): ProjectedEvent[] {
  camera.updateMatrixWorld();
  const point = new THREE.Vector3();
  return events.flatMap(event => {
    const position = positions.get(event.id);
    if (!position) return [];
    point.fromArray(position).project(camera);
    const x = (point.x + 1) * viewport.width / 2, y = (1 - point.y) * viewport.height / 2;
    return [{ id: event.id, x, y, visible: Number.isFinite(x) && Number.isFinite(y) && point.z >= -1 && point.z <= 1 && x >= 0 && y >= 0 && x <= viewport.width && y <= viewport.height,
      semanticGroup: JSON.stringify([event.eraId ?? event.dynasty, event.period ?? '', [...(event.categories ?? [event.layout?.lane ?? 'history'])].sort()]) }];
  });
}
const abort = () => new DOMException('Projection is stale or disposed', 'AbortError');
export class SceneClusterProjector {
  private client: HistoryClusterClient;
  private fallback = false;
  private disposed = false;
  private lastApplied = -Infinity;
  constructor(options?: HistoryClusterClientOptions) { this.client = new HistoryClusterClient(options); }
  async project(input: ClusterInput): Promise<ClusterResult> {
    if (this.disposed || input.revision <= this.lastApplied) throw abort();
    let result: ClusterResult;
    if (this.fallback) result = clusterEvents(input);
    else {
      try { result = await this.client.project(input); }
      catch (error) {
        if (this.disposed || (!this.fallback && (error as Error).name === 'AbortError')) throw error;
        this.fallback = true; this.client.dispose();
        result = clusterEvents(input);
      }
    }
    if (this.disposed || result.revision <= this.lastApplied) throw abort();
    this.lastApplied = result.revision;
    return result;
  }
  dispose(): void { this.disposed = true; this.client.dispose(); }
}
