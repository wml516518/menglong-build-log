import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { generateScaleFixture } from './fixtures/generateScaleFixture';
import { categoryIds, eventIndexSchema, type CompactHistoryEventIndex, type HistoryEra } from './content/schema';
import { clusterEvents } from './clustering/cluster';
import { getVisibilityBudget, selectProtectedEventIds } from './lod';
import { filterEvents, parseExplorerState } from './explorer/state';
import { buildSearchDocuments, fallbackSearch } from './search/fallback';
import { createSearchWorkerHandler } from './search/search.worker';
import type { SearchResponse } from './search/protocol';

const eras: HistoryEra[] = JSON.parse(readFileSync('public/history-content/generated/manifest.json', 'utf8')).eras;
describe('encyclopedia scale', () => {
  it('ships 1200 real records with 1000 basic and 200 core archives below 450 KiB gzip', () => {
    const compact = readFileSync('public/history-content/generated/indexes/events.compact.json');
    const events: CompactHistoryEventIndex[] = JSON.parse(compact.toString());
    expect(events).toHaveLength(1200);
    expect(new Set(events.map(event => event.id)).size).toBe(1200);
    expect(events.filter(event => event.detailLevel === 'basic')).toHaveLength(1000);
    expect(events.filter(event => event.detailLevel === 'core')).toHaveLength(200);
    expect(new Set(events.map(event => event.editorialPeriodId)).size).toBe(9);
    expect(gzipSync(compact).byteLength).toBeLessThan(450 * 1024);
  });
  it('keeps synthetic fixture imports out of production source modules', () => {
    const production = readdirSync('src', { recursive: true }).map(String).filter(path => /\.(ts|tsx)$/.test(path) && !/\.test\./.test(path) && !path.startsWith('history/fixtures/'));
    for (const path of production) {
      expect(readFileSync(`src/${path}`, 'utf8'), path).not.toMatch(/(?:from\s*|import\s*\()\s*['"][^'"]*(?:fixtures\/|generateScaleFixture)/);
    }
  });
  it('generates 1200 deterministic valid records spanning every era and category', () => {
    const events = generateScaleFixture(eras);
    expect(events).toHaveLength(1200);
    expect(generateScaleFixture(eras)).toEqual(events);
    expect(new Set(events.map(e => e.id)).size).toBe(1200);
    expect(new Set(events.map(e => e.eraId))).toEqual(new Set(eras.map(e => e.id)));
    expect(new Set(events.flatMap(e => e.categories))).toEqual(new Set(categoryIds));
    events.forEach(e => expect(eventIndexSchema.safeParse(e).success).toBe(true));
  });
  it.each([false, true])('preserves all membership and protected singles within overview budget (mobile=%s)', mobile => {
    const events = generateScaleFixture(eras);
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const protectedIds = selectProtectedEventIds(events, events[1].id, [events[2].id]);
    const result = clusterEvents({ events: events.map((e, i) => ({ id: e.id, x: 20 + (i % 40) / 40 * (viewport.width - 40), y: 20 + Math.floor(i / 40) / 30 * (viewport.height - 40), semanticGroup: e.eraId, visible: true })), viewport, mobile, level: 'overview', protectedIds, previousClusters: [], revision: 1 });
    expect(result.singles.length + result.clusters.length).toBeLessThanOrEqual(getVisibilityBudget('overview', mobile).stars);
    expect(result.singles.map(e => e.id)).toEqual(expect.arrayContaining(protectedIds));
    const members = [...result.singles.map(e => e.id), ...result.clusters.flatMap(c => c.memberIds)];
    expect(members).toHaveLength(1200);
    expect(new Set(members)).toEqual(new Set(events.map(e => e.id)));
  });
  it('combines era/category filters and searches the last record through worker and fallback', () => {
    const events = generateScaleFixture(eras);
    const target = events[1199];
    const state = parseExplorerState(new URLSearchParams({ era: target.eraId, cat: target.categories[0] }));
    const matches = filterEvents(events, state);
    expect(matches).toHaveLength(1200);
    expect(matches.filter(e => e.match).map(e => e.event.id)).toContain(target.id);
    expect(matches.some(e => !e.match && e.opacity < 1)).toBe(true);
    const documents = buildSearchDocuments({ events, people: [] });
    expect(fallbackSearch(documents, { text: target.title })[0].id).toBe(target.id);
    const responses: SearchResponse[] = [];
    const handle = createSearchWorkerHandler(r => responses.push(r));
    handle({ type: 'init', requestId: 1, documents });
    handle({ type: 'query', requestId: 2, query: { text: target.title } });
    expect(responses[1]).toMatchObject({ type: 'result', results: [expect.objectContaining({ id: target.id })] });
  });
});
