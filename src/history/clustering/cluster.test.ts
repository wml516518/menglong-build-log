import { describe, expect, it } from 'vitest';
import { clusterEvents } from './cluster';
import type { ClusterInput, ProjectedEvent } from './protocol';
import { getVisibilityBudget } from '../lod';

const point = (id: string, x: number, y = 100, semanticGroup = 'period-a/theme-a'): ProjectedEvent => ({ id, x, y, semanticGroup, visible: true });
const input = (events: ProjectedEvent[], overrides: Partial<ClusterInput> = {}): ClusterInput => ({ events, level: 'period', viewport: { width: 800, height: 600 }, mobile: false, protectedIds: [], previousClusters: [], revision: 1, ...overrides });

describe('semantic screen-space clustering', () => {
  it('fits 104 separated ordinary components plus 22 protected singles into the mobile overview budget', () => {
    const centers = Array.from({ length: 16 }, (_, row) => Array.from({ length: row % 2 ? 6 : 7 }, (_, col) => ({ x: col * 61 + (row % 2 ? 30.5 : 0), y: row * 53 }))).flat();
    expect(centers).toHaveLength(104);
    const events = Array.from({ length: 1178 }, (_, i) => point(`ordinary-${String(i).padStart(4, '0')}`, centers[i % 104].x, centers[i % 104].y));
    const protectedIds = Array.from({ length: 22 }, (_, i) => `protected-${i}`);
    events.push(...protectedIds.map(id => point(id, 190, 400)));
    const request = input(events, { mobile: true, level: 'overview', viewport: { width: 390, height: 844 }, protectedIds });
    const result = clusterEvents(request);
    expect(result.clusters.length + result.singles.length).toBeLessThanOrEqual(120);
    expect(result.singles.map(e => e.id).sort()).toEqual([...protectedIds].sort());
    const members = [...result.singles.map(e => e.id), ...result.clusters.flatMap(c => c.memberIds)];
    expect(members).toHaveLength(1200);
    expect(new Set(members)).toEqual(new Set(events.map(e => e.id)));
    expect(clusterEvents({ ...request, events: [...events].reverse() })).toEqual(result);
  });
  it.each([false, true])('enforces overview budget for sparse points (mobile=%s)', mobile => {
    const events = Array.from({ length: 1200 }, (_, i) => point(`e-${String(i).padStart(4, '0')}`, i % 40 * 100, Math.floor(i / 40) * 100));
    const result = clusterEvents(input(events, { level: 'overview', mobile, viewport: { width: 4000, height: 3000 }, protectedIds: ['e-0000'] }));
    expect(result.clusters.length + result.singles.length).toBeLessThanOrEqual(getVisibilityBudget('overview', mobile).stars);
    expect(result.singles.map(e => e.id)).toContain('e-0000');
    expect(result.clusters.reduce((n,c) => n+c.count, result.singles.length)).toBe(1200);
  });
  it('preserves semantic families and protections when their minimum representation exceeds the budget', () => {
    const events = Array.from({ length: 250 }, (_, i) => point(`e-${i}`, i % 20 * 100, Math.floor(i / 20) * 100, `family-${i}`));
    const result = clusterEvents(input(events, { mobile: true, level: 'era', viewport: { width: 2000, height: 1500 } }));
    expect(result.singles).toHaveLength(250);
    expect(result.clusters).toHaveLength(0);
    const protectedIds = events.map(e => e.id);
    expect(clusterEvents(input(events, { mobile: true, level: 'overview', viewport: { width: 2000, height: 1500 }, protectedIds })).singles).toHaveLength(250);
  });
  it('aggregates over-budget non-overview components only inside their semantic family', () => {
    const events = Array.from({ length: 1200 }, (_, i) => point(`e-${String(i).padStart(4, '0')}`, i % 40 * 100, Math.floor(i / 40) * 100, `family-${i % 3}`));
    const result = clusterEvents(input(events, { level: 'era', mobile: true, viewport: { width: 4000, height: 3000 } }));
    expect(result.clusters.length + result.singles.length).toBe(200);
    expect(result.clusters.every(c => c.semanticGroups.length === 1)).toBe(true);
    expect(new Set([...result.singles.map(e => e.id), ...result.clusters.flatMap(c => c.memberIds)]).size).toBe(1200);
  });
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
