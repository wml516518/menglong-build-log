import type { LodLevel } from '../lod';

/** Screen coordinates in CSS pixels, after the caller's camera projection. */
export interface ProjectedEvent { id: string; x: number; y: number; semanticGroup: string; visible: boolean }
export interface PreviousCluster { id: string; memberIds: readonly string[] }
export interface ClusterInput {
  events: readonly ProjectedEvent[];
  level: LodLevel;
  viewport: { width: number; height: number };
  mobile: boolean;
  protectedIds: readonly string[];
  previousClusters: readonly PreviousCluster[];
  revision: number;
}
export interface ScreenCluster {
  id: string;
  memberIds: string[];
  count: number;
  semanticGroups: string[];
  center: { x: number; y: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Padded rectangle for a camera controller to fit in the current projection. */
  focusTarget: { x: number; y: number; width: number; height: number };
}
export interface ClusterResult { clusters: ScreenCluster[]; singles: ProjectedEvent[]; revision: number }
export interface PackedProjection extends Omit<ClusterInput, 'events'> {
  ids: string[];
  positions: Float32Array;
  semanticGroups: string[];
  groupIndices: Uint32Array;
  visibility: Uint8Array;
}
export interface ClusterRequest { type: 'cluster'; requestId: number; projection: PackedProjection }
export type ClusterResponse = { type: 'result'; requestId: number; result: ClusterResult } | { type: 'error'; requestId: number; message: string };
export interface ClusterWorker {
  onmessage: ((event: MessageEvent<ClusterResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: ClusterRequest, transfer: Transferable[]): void;
  terminate(): void;
}
export interface FrameScheduler { request(callback: FrameRequestCallback): number; cancel(handle: number): void }

/** Allocate fresh arrays: transferring them never detaches caller-owned projection data. */
export function packProjection(input: ClusterInput): PackedProjection {
  const positions = new Float32Array(input.events.length * 2);
  const groupIndices = new Uint32Array(input.events.length);
  const visibility = new Uint8Array(input.events.length);
  const semanticGroups: string[] = [];
  const groupMap = new Map<string, number>();
  input.events.forEach((event, i) => {
    positions[i * 2] = event.x; positions[i * 2 + 1] = event.y;
    let index = groupMap.get(event.semanticGroup);
    if (index === undefined) { index = semanticGroups.length; semanticGroups.push(event.semanticGroup); groupMap.set(event.semanticGroup, index); }
    groupIndices[i] = index; visibility[i] = Number(event.visible);
  });
  return { revision: input.revision, level: input.level, viewport: { ...input.viewport }, mobile: input.mobile,
    protectedIds: [...input.protectedIds], previousClusters: input.previousClusters.map(cluster => ({ id: cluster.id, memberIds: [...cluster.memberIds] })),
    ids: input.events.map(event => event.id), positions, semanticGroups, groupIndices, visibility };
}
export function unpackProjection(input: PackedProjection): ClusterInput {
  return { ...input, events: input.ids.map((id, i) => ({ id, x: input.positions[i * 2], y: input.positions[i * 2 + 1], semanticGroup: input.semanticGroups[input.groupIndices[i]], visible: input.visibility[i] === 1 })) };
}
