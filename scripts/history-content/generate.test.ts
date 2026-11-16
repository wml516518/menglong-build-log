// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { historyEventArchiveSchema, type EditorialPeriod } from '../../src/history/content/schema';
import { generatedFiles, stableJson } from './generate';
import { validateContentQuality } from './quality';

const legacy = JSON.parse(readFileSync('public/history-content/generated/eras/tang.json', 'utf8')).events.find((event: { detailLevel: string }) => event.detailLevel === 'core');
const { sourceRefs, background, causes, course, results, impacts, historiography, ...common } = legacy;
export const basic = historyEventArchiveSchema.parse({ ...common, id: 'basic-example', title: '基础事件', summary: '这一时期的制度调整回应社会治理需要并对后续政治与社会秩序产生影响。'.repeat(3), editorialPeriodId: 'sui-tang-five-dynasties', detailLevel: 'basic', sourceRefs: [{ sourceId: sourceRefs[0].sourceId, locator: '唐代章节' }] });
export const core = historyEventArchiveSchema.parse({ ...basic, id: 'core-example', title: '核心事件', detailLevel: 'core', background, causes, course, results, impacts, historiography });
const periods: EditorialPeriod[] = [{ id: 'sui-tang-five-dynasties', name: '隋唐五代', startYear: 581, endYear: 960, eventQuota: 160, coreQuota: 30 }];
export function generatedFixture() {
  const sources = JSON.parse(readFileSync('public/history-content/generated/sources.json', 'utf8'));
  return generatedFiles({ events: [basic, core], people: [], eras: JSON.parse(readFileSync('public/history-content/generated/manifest.json', 'utf8')).eras, periods, sources, places: [], themes: [], relations: [], contentQuality: validateContentQuality({ events: [], periods, sources }, { enforceFinalTargets: false }) });
}
describe('pure generation', () => {
  it('emits manifest v2 counts and visual-era mappings', () => {
    const { publicFiles } = generatedFixture();
    expect(publicFiles.get('manifest.json')).toMatchObject({ version: 2, eventCount: 2, basicEventCount: 1, coreEventCount: 1, editorialPeriods: periods, periodCounts: { 'sui-tang-five-dynasties': 2 }, legacyEventIds: [], eventEras: { 'basic-example': 'tang', 'core-example': 'tang' } });
  });
  it('keeps full sources and core details only in the lazy archive', () => {
    const { publicFiles } = generatedFixture();
    expect(publicFiles.get('eras/tang.json')).toMatchObject({ events: [basic, core] });
    const compact = publicFiles.get('indexes/events.compact.json') as object[];
    expect(compact[0]).toMatchObject({ detailLevel: 'basic', sourceIds: [sourceRefs[0].sourceId] });
    for (const item of compact) for (const key of ['sourceRefs', 'background', 'course']) expect(item).not.toHaveProperty(key);
    expect(stableJson({ z: 1, a: { z: 2, a: 3 } })).toBe('{\n  "a": {\n    "a": 3,\n    "z": 2\n  },\n  "z": 1\n}\n');
  });
});

it('rejects a newly added legacy-shaped archive without authorizing it from input', () => {
  const sources = JSON.parse(readFileSync('public/history-content/generated/sources.json', 'utf8'));
  const { detailLevel, editorialPeriodId, sourceRefs, ...old } = legacy;
  const content = { events: [{ ...old, sourceIds: ['bai-shouyi-general-history'], id: 'unreviewed-legacy-event' }], people: [], eras: [], periods: [], sources, places: [], themes: [], relations: [], contentQuality: validateContentQuality({ events: [], periods: [], sources }, { enforceFinalTargets: false }) };
  expect(() => generatedFiles(content)).toThrow(/unreviewed-legacy-event.*legacy/);
});

it.each([{ records: [] }, { records: [basic, core] }])('declares catalog-only populations for %j', ({ records }) => {
  const sources = JSON.parse(readFileSync('public/history-content/generated/sources.json', 'utf8'));
  const { publicFiles } = generatedFiles({ events: records, people: [], eras: [], periods, sources, places: [], themes: [], relations: [], contentQuality: validateContentQuality({ events: [], periods, sources }, { enforceFinalTargets: false }) });
  const manifest = publicFiles.get('manifest.json') as { eventCount: number; structuredEventCount: number; legacyEventCount: number; basicEventCount: number; coreEventCount: number; periodCounts: Record<string, number> };
  expect(manifest.structuredEventCount).toBe(records.length);
  expect(manifest.legacyEventCount).toBe(0);
  expect(manifest.eventCount).toBe(manifest.structuredEventCount + manifest.legacyEventCount);
  expect(Object.values(manifest.periodCounts).reduce((a, b) => a + b, 0)).toBe(manifest.structuredEventCount);
  expect(manifest.basicEventCount + manifest.coreEventCount).toBe(manifest.eventCount);
});

it('rejects duplicate editorial period IDs even with no structured events', () => {
  const ming: EditorialPeriod = { id: 'ming', name: '明', startYear: 1368, endYear: 1644, eventQuota: 130, coreQuota: 22 };
  const content = { events: [], people: [], eras: [], periods: [ming, { ...ming }], sources: [], places: [], themes: [], relations: [], contentQuality: validateContentQuality({ events: [], periods: [ming], sources: [] }, { enforceFinalTargets: false }) };
  expect(() => generatedFiles(content)).toThrow('重复编辑时期 ID: ming');
});
