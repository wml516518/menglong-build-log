import { describe, expect, it } from 'vitest';
import { clusterEvents } from './cluster';
import type { ClusterInput, ProjectedEvent } from './protocol';

const point = (id: string, x: number, y = 100, semanticGroup = 'period-a/theme-a'): ProjectedEvent => ({ id, x, y, semanticGroup, visible: true });
const input = (events: ProjectedEvent[], overrides: Partial<ClusterInput> = {}): ClusterInput => ({ events, level: 'period', viewport: { width: 800, height: 600 }, mobile: false, protectedIds: [], previousClusters: [], revision: 1, ...overrides });

describe('semantic screen-space clustering', () => {
  it('merges nearby compatible points through neighbor lookup and emits padded focus geometry', () => {
    const result = clusterEvents(input([point('c', 300), point('b', 140, 120), point('a', 100)]));
    expect(result.revision).toBe(1);
    expect(result.singles.map(p => p.id)).toEqual(['c']);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]).toMatchObject({ memberIds: ['a', 'b'], count: 2, center: { x: 120, y: 110 }, bounds: { minX: 88, minY: 88, maxX: 152, maxY: 132 }, focusTarget: { x: 120, y: 110, width: 64, height: 44 } });
  });
  it.each(['era', 'period', 'close'] as const)('keeps semantic groups separate at %s', level => {
    const result = clusterEvents(input([point('a', 100), point('b', 110, 100, 'period-b/theme-a'), point('c', 120, 100, 'period-a/theme-b')], { level }));
    expect(result.clusters).toEqual([]);
    expect(result.singles.map(p => p.id)).toEqual(['a', 'b', 'c']);
  });
  it('merges groups at overview with deterministic semantic identity and order-independent IDs', () => {
    const events = [point('b', 110, 100, 'z'), point('a', 100, 100, 'a')];
    const first = clusterEvents(input(events, { level: 'overview' }));
    const second = clusterEvents(input([...events].reverse(), { level: 'overview' }));
    expect(first).toEqual(second);
    expect(first.clusters[0]).toMatchObject({ memberIds: ['a', 'b'], semanticGroups: ['a', 'z'] });
    expect(clusterEvents(input(events.map(p => ({ ...p, semanticGroup: 'other' })), { level: 'overview' })).clusters[0].id).not.toBe(first.clusters[0].id);
  });
  it('keeps protected points single and omits clipped, outside, nonfinite and omitted points', () => {
    const events = [point('a', 100), point('b', 110), { ...point('clipped', 100), visible: false }, point('left', -1), point('right', 801), point('top', 100, -1), point('bottom', 100, 601), point('nan', NaN)];
    const result = clusterEvents(input(events, { protectedIds: ['a'], previousClusters: [{ id: 'old', memberIds: ['omitted', 'a'] }] }));
    expect(result.clusters).toEqual([]);
    expect(result.singles).toEqual([events[0], events[1]]);
  });
  it('uses desktop/mobile pixel radii and LOD adjustments', () => {
    const events = [point('a', 100), point('b', 145)];
    expect(clusterEvents(input(events)).clusters).toHaveLength(1);
    expect(clusterEvents(input(events, { mobile: true })).clusters).toHaveLength(0);
    expect(clusterEvents(input(events, { level: 'close' })).clusters).toHaveLength(0);
    expect(clusterEvents(input([point('a', 100), point('b', 155)], { level: 'era' })).clusters).toHaveLength(1);
    expect(clusterEvents(input([point('a', 100), point('b', 165)], { level: 'overview' })).clusters).toHaveLength(1);
  });
  it('responds to resized reprojection and viewport clipping', () => {
    expect(clusterEvents(input([point('a', 100), point('b', 140)])).clusters).toHaveLength(1);
    const resized = clusterEvents(input([point('a', 200), point('b', 280)], { viewport: { width: 1600, height: 600 } }));
    expect(resized.singles.map(p => p.id)).toEqual(['a', 'b']);
    expect(clusterEvents(input([point('a', 100), point('b', 140)], { viewport: { width: 120, height: 600 } })).singles.map(p => p.id)).toEqual(['a']);
  });
  it('retains cluster identity over a small radius crossing but releases clearly separated members', () => {
    const previous = clusterEvents(input([point('a', 100), point('b', 145)])).clusters;
    const retained = clusterEvents(input([point('a', 100), point('b', 152)], { previousClusters: previous }));
    expect(retained.clusters[0].id).toBe(previous[0].id);
    expect(clusterEvents(input([point('a', 100), point('b', 170)], { previousClusters: previous })).clusters).toEqual([]);
    expect(clusterEvents(input([point('a', 100), point('b', 152)])).clusters).toEqual([]);
  });
  it('handles coincident points, transitive neighbors, boundaries and empty input', () => {
    expect(clusterEvents(input([]))).toEqual({ clusters: [], singles: [], revision: 1 });
    const result = clusterEvents(input([point('a', 0, 0), point('b', 0, 0), point('c', 48, 0), point('d', 96, 0), point('far', 700, 500)]));
    expect(result.clusters[0].memberIds).toEqual(['a', 'b', 'c', 'd']);
    expect(result.singles.map(p => p.id)).toEqual(['far']);
  });
});
