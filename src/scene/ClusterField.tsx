import { Html } from '@react-three/drei';
import type { ScreenCluster } from '../history/clustering/protocol';
export type WorldPositions = ReadonlyMap<string, readonly [number, number, number]>;
export interface ClusterFieldProps { clusters: readonly ScreenCluster[]; positions: WorldPositions; focusBounds: (cluster: ScreenCluster) => void }
export function ClusterField({ clusters, positions, focusBounds }: ClusterFieldProps) {
  return <>{clusters.map(cluster => {
    const members = cluster.memberIds.flatMap(id => positions.has(id) ? [positions.get(id)!] : []);
    if (!members.length) return null;
    const position = members.reduce<[number, number, number]>((center, point) => [center[0] + point[0] / members.length, center[1] + point[1] / members.length, center[2] + point[2] / members.length], [0, 0, 0]);
    return <Html key={cluster.id} center position={position} zIndexRange={[20, 0]}>
      <button type="button" aria-label={`聚焦 ${cluster.count} 个历史事件`} title={cluster.semanticGroups.join(' · ')}
        onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); focusBounds(cluster); }}
        style={{ width: 48, height: 48, boxSizing: 'border-box', overflow: 'hidden', padding: 0, borderRadius: '50%', border: '1px solid #b9a16c', background: '#101b22ee', color: '#efd99f', fontSize: 12, fontVariantNumeric: 'tabular-nums', cursor: 'zoom-in', touchAction: 'manipulation' }}>
        <span aria-hidden="true">{cluster.count > 999 ? '999+' : cluster.count}</span>
      </button>
    </Html>;
  })}</>;
}
