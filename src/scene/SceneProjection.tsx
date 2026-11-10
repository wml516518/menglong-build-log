import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ClusterResult } from '../history/clustering/protocol';
import type { LodLevel } from '../history/lod';
import type { HistoryEvent } from '../history/types';
import type { WorldPositions } from './ClusterField';
import { projectSceneEvents, SceneClusterProjector } from './sceneClustering';
export interface SceneProjectionProps { events: readonly HistoryEvent[]; positions: WorldPositions; level: LodLevel; protectedIds: readonly string[]; onResult: (result: ClusterResult) => void; onViewportChange?: (ids: ReadonlySet<string>) => void }
const PROJECTION_INTERVAL = 0.12;
export function SceneProjection(props: SceneProjectionProps) {
  const camera = useThree(state => state.camera), size = useThree(state => state.size);
  const current = { ...props, width: size.width, height: size.height };
  const latest = useRef(current); latest.current = current;
  const projector = useRef<SceneClusterProjector | null>(null);
  const revision = useRef(0);
  const previous = useRef<ClusterResult | null>(null);
  const visible = useRef<ReadonlySet<string> | null>(null);
  const submitted = useRef<{ time: number; input: typeof current; camera: number[] } | null>(null);
  useEffect(() => {
    const client = new SceneClusterProjector(); projector.current = client;
    return () => { client.dispose(); projector.current = null; submitted.current = null; visible.current = null; };
  }, []);
  useFrame(({ clock }) => {
    const client = projector.current;
    if (!client) return;
    const last = submitted.current, input = latest.current;
    if (last && clock.elapsedTime - last.time < PROJECTION_INTERVAL) return;
    camera.updateMatrixWorld();
    const cameraState = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
    const sameView = (other: typeof input) => other.events === input.events && other.positions === input.positions && other.protectedIds === input.protectedIds && other.level === input.level && other.width === input.width && other.height === input.height;
    if (last && sameView(last.input) && cameraState.every((value, i) => Math.abs(value - last.camera[i]) < 0.00001)) return;
    submitted.current = { time: clock.elapsedTime, input, camera: cameraState };
    const viewport = { width: input.width, height: input.height };
    const projected = projectSceneEvents(input.events, input.positions, camera, viewport);
    const ids = new Set(projected.filter(event => event.visible).map(event => event.id));
    if (!visible.current || ids.size !== visible.current.size || [...ids].some(id => !visible.current?.has(id))) {
      visible.current = ids;
      input.onViewportChange?.(ids);
    }
    void client.project({ events: projected, viewport, level: input.level, mobile: input.width < 700, protectedIds: input.protectedIds, previousClusters: previous.current?.clusters ?? [], revision: ++revision.current }).then(result => {
      if (projector.current !== client || !sameView(latest.current)) return;
      previous.current = result; latest.current.onResult(result);
    }).catch(() => { /* Superseded/disposed projections are intentionally ignored. */ });
  });
  return null;
}
