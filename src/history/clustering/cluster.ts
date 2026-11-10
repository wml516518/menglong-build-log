import { quadtree } from 'd3-quadtree';
import type { LodLevel } from '../lod';
import type { ClusterInput, ClusterResult, ProjectedEvent, ScreenCluster } from './protocol';

export const CLUSTER_RADIUS_DESKTOP = 48;
export const CLUSTER_RADIUS_MOBILE = 40;
export const CLUSTER_RADIUS_SCALE: Record<LodLevel, number> = { overview: 1.5, era: 1.25, period: 1, close: 0.75 };
export const CLUSTER_RELEASE_SCALE = 1.2;
export const CLUSTER_BOUNDS_PADDING = 12;

function stableId(groups: string[], memberIds: string[]): string {
  // JSON encodes boundaries unambiguously, including punctuation inside IDs/groups.
  const key = JSON.stringify([groups, memberIds]);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return `cluster-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
function makeCluster(members: ProjectedEvent[]): ScreenCluster {
  const memberIds = members.map(event => event.id);
  const semanticGroups = [...new Set(members.map(event => event.semanticGroup))].sort();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, x = 0, y = 0;
  for (const event of members) {
    minX = Math.min(minX, event.x); minY = Math.min(minY, event.y);
    maxX = Math.max(maxX, event.x); maxY = Math.max(maxY, event.y);
    x += event.x; y += event.y;
  }
  minX -= CLUSTER_BOUNDS_PADDING; minY -= CLUSTER_BOUNDS_PADDING;
  maxX += CLUSTER_BOUNDS_PADDING; maxY += CLUSTER_BOUNDS_PADDING;
  return { id: stableId(semanticGroups, memberIds), memberIds, semanticGroups, count: members.length,
    center: { x: x / members.length, y: y / members.length }, bounds: { minX, minY, maxX, maxY },
    focusTarget: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY } };
}

/** Connected components of compatible neighbors. Overview permits any semantic group;
 * other LODs require exact group equality. Prior membership increases only an existing
 * pair's release radius; it cannot retain a pair after that finite radius is exceeded.
 */
export function clusterEvents(input: ClusterInput): ClusterResult {
  const events = input.events.filter(event => event.visible && Number.isFinite(event.x) && Number.isFinite(event.y)
    && event.x >= 0 && event.y >= 0 && event.x <= input.viewport.width && event.y <= input.viewport.height)
    .slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const protectedIds = new Set(input.protectedIds);
  const prior = new Map<string, Set<string>>();
  input.previousClusters.forEach(cluster => cluster.memberIds.forEach(id => {
    const memberships = prior.get(id) ?? new Set<string>(); memberships.add(cluster.id); prior.set(id, memberships);
  }));
  const points = events.filter(event => !protectedIds.has(event.id));
  const tree = quadtree<ProjectedEvent>().x(event => event.x).y(event => event.y).addAll(points);
  const parents = new Map(points.map(event => [event.id, event.id]));
  const root = (id: string): string => {
    let current = id;
    while (parents.get(current) !== current) current = parents.get(current)!;
    while (id !== current) { const next = parents.get(id)!; parents.set(id, current); id = next; }
    return current;
  };
  const radius = (input.mobile ? CLUSTER_RADIUS_MOBILE : CLUSTER_RADIUS_DESKTOP) * CLUSTER_RADIUS_SCALE[input.level];
  const release = radius * CLUSTER_RELEASE_SCALE;
  for (const point of points) {
    tree.visit((node, x0, y0, x1, y1) => {
      if (x0 > point.x + release || x1 < point.x - release || y0 > point.y + release || y1 < point.y - release) return true;
      if (!node.length) {
        let leaf: typeof node | undefined = node;
        do {
          const neighbor = leaf.data;
          if (neighbor.id > point.id && (input.level === 'overview' || neighbor.semanticGroup === point.semanticGroup)) {
            const memberships = prior.get(point.id);
            const retained = memberships && [...(prior.get(neighbor.id) ?? [])].some(id => memberships.has(id));
            const limit = retained ? release : radius;
            if ((neighbor.x - point.x) ** 2 + (neighbor.y - point.y) ** 2 <= limit ** 2) parents.set(root(neighbor.id), root(point.id));
          }
          leaf = leaf.next;
        } while (leaf);
      }
      return false;
    });
  }
  const components = new Map<string, ProjectedEvent[]>();
  for (const event of events) {
    const key = protectedIds.has(event.id) ? event.id : root(event.id);
    const component = components.get(key) ?? []; component.push(event); components.set(key, component);
  }
  const clusters: ScreenCluster[] = [], singles: ProjectedEvent[] = [];
  for (const component of components.values()) {
    if (component.length === 1) singles.push(component[0]); else clusters.push(makeCluster(component));
  }
  return { clusters, singles, revision: input.revision };
}
