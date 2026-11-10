import { Html } from '@react-three/drei';
import type { ScreenCluster } from '../history/clustering/protocol';
export type WorldPositions = ReadonlyMap<string, readonly [number, number, number]>;
export interface ClusterFieldProps { clusters: readonly ScreenCluster[]; positions: WorldPositions; focusBounds: (cluster: ScreenCluster) => void; eventOpacities?: ReadonlyMap<string, number>; labelBudget?: number }
export function ClusterField({ clusters, positions, focusBounds, eventOpacities, labelBudget = Infinity }: ClusterFieldProps) {
  // Rank matching population first, then total population and stable identity.
  const salience = (cluster: ScreenCluster) => cluster.memberIds.reduce((sum, id) => sum + (eventOpacities?.get(id) ?? 1), 0);
  const labeled = new Set([...clusters].sort((a, b) => salience(b) - salience(a) || b.count - a.count || a.id.localeCompare(b.id)).slice(0, Math.max(0, labelBudget)).map(cluster => cluster.id));
  return <>{clusters.map(cluster => {
    const members = cluster.memberIds.flatMap(id => positions.has(id) ? [positions.get(id)!] : []);
    if (!members.length) return null;
    const position = members.reduce<[number, number, number]>((center, point) => [center[0] + point[0] / members.length, center[1] + point[1] / members.length, center[2] + point[2] / members.length], [0, 0, 0]);
    const opacity = cluster.memberIds.reduce((total, id) => total + (eventOpacities?.get(id) ?? 1), 0) / cluster.memberIds.length;
    return <Html key={cluster.id} center position={position} zIndexRange={[20, 0]}>
      <button type="button" aria-label={`聚焦 ${cluster.count} 个历史事件`} title={cluster.semanticGroups.join(' · ')}
        onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); focusBounds(cluster); }}
        style={{ width: 48, height: 48, boxSizing: 'border-box', overflow: 'hidden', padding: 0, borderRadius: '50%', border: '1px solid #b9a16c', background: '#101b22ee', color: '#efd99f', fontSize: 12, fontVariantNumeric: 'tabular-nums', cursor: 'zoom-in', touchAction: 'manipulation', opacity }}>
        {labeled.has(cluster.id) ? <span aria-hidden="true" data-cluster-label>{cluster.count > 999 ? '999+' : cluster.count}</span> : <span aria-hidden="true">·</span>}
      </button>
    </Html>;
  })}</>;
}
