import { describe, expect, it } from 'vitest';
import { validateContentQuality } from './quality';
import type { BasicEventRecord, EditorialPeriod, SourceRecord } from '../../src/history/content/schema';

const periods: EditorialPeriod[] = [{ id: 'pre-qin', name: '先秦', startYear: -2070, endYear: -221, eventQuota: 170, coreQuota: 25 }];
const sources: SourceRecord[] = [{ id: 'history', title: '通史', kind: 'book' }, { id: 'annals', title: '编年史', kind: 'book' }];
const basic: BasicEventRecord = {
  id: 'zhougong', title: '周公摄政', aliases: [], startYear: -1042, endYear: -1035,
  yearPrecision: 'circa', eraId: 'pre-qin', editorialPeriodId: 'pre-qin', detailLevel: 'basic',
  polityIds: [], period: '西周', categories: ['institution'], themeIds: [], influence: 4,
  summary: '周公辅佐成王推动西周初年的政治秩序稳定并参与制度建设。'.repeat(4),
  personIds: [], placeIds: [], parentId: null, childIds: [], relationIds: [],
  sourceRefs: [{ sourceId: 'history', locator: '西周初年章节' }], color: '#123456', layout: { lane: 'institution', offset: [0, 0] }
};
const check = (events: BasicEventRecord[], enforceFinalTargets = false) => validateContentQuality({ events, periods, sources }, { enforceFinalTargets });

describe('always enforced integrity', () => {
  it.each([
    [{ sourceRefs: [{ sourceId: 'history', locator: '' }] }, /locator/],
    [{ sourceRefs: [{ sourceId: 'history' }] }, /locator/],
    [{ sourceRefs: [basic.sourceRefs[0], basic.sourceRefs[0]] }, /重复来源/],
    [{ sourceRefs: [] }, /sourceRefs/],
    [{ detailLevel: 'core' }, /两个不同来源/],
    [{ categories: [] }, /categories/],
    [{ editorialPeriodId: 'unknown' }, /不存在的编辑时期/],
    [{ sourceRefs: [{ sourceId: 'unknown', locator: '卷一' }] }, /不存在的来源/],
    [{ startYear: -2200 }, /年代超出编辑时期/]
  ])('rejects invalid record %j in intermediate mode', (patch, message) => {
    expect(() => check([{ ...basic, ...patch } as BasicEventRecord])).toThrow(message as RegExp);
  });
  it('requires two distinct registered sources for core records', () => {
    expect(check([{ ...basic, detailLevel: 'core', sourceRefs: [basic.sourceRefs[0], { sourceId: 'annals', locator: '卷一' }] }]).coreEventCount).toBe(1);
  });
  it.each(['周 公，摄政！', '周公摄政'])('rejects normalized Chinese titles: %s', title => {
    expect(() => check([basic, { ...basic, id: 'other', title }])).toThrow(/规范化标题重复/);
  });
  it('normalizes NFKC and Latin case before checking duplicate titles', () => {
    expect(() => check([{ ...basic, title: 'ＡＢＣ：改革' }, { ...basic, id: 'other', title: 'abc 改革' }])).toThrow(/规范化标题重复/);
  });
  it('lowercases accented Latin titles', () => {
    expect(() => check([{ ...basic, title: 'ÉDIT' }, { ...basic, id: 'other', title: 'édit' }])).toThrow(/规范化标题重复/);
  });
  it.each([
    [{ ...basic, aliases: ['摄 政'] }, { ...basic, id: 'other', title: '另一事件', aliases: ['摄政！'] }],
    [basic, { ...basic, id: 'other', title: '另一事件', aliases: ['周 公 摄政'] }]
  ])('rejects alias collisions across records', (a, b) => {
    expect(() => check([a, b])).toThrow(/别名冲突/);
  });
  it('rejects duplicate IDs even for different titles', () => {
    expect(() => check([basic, { ...basic, title: '另一事件' }])).toThrow(/重复事件 ID/);
  });
});

describe('deterministic suspected duplicates', () => {
  const a = { ...basic, title: 'abcdefghijklmno', startYear: -1000, endYear: -990 };
  const b = { ...a, id: 'other', title: 'abcdefghijklmnx', startYear: -995, endYear: -985 };
  it('rejects overlapping similar records and exposes a deterministic report', () => {
    const report = (events: BasicEventRecord[]) => {
      try { check(events); throw new Error('expected duplicate failure'); }
      catch (error) { expect((error as Error).message).toMatch(/疑似重复/); return (error as Error & { report: unknown }).report; }
    };
    expect(report([a, b])).toEqual(report([b, a]));
    expect(report([a, b])).toMatchObject({ suspectedDuplicates: [{ eventIds: ['other', 'zhougong'], similarity: 14 / 15 }] });
  });
  it('includes the 0.88 threshold and excludes lower scores', () => {
    const title = 'abcdefghijklmnopqrstuvwxy';
    expect(() => check([{ ...a, title }, { ...b, title: 'abcdefghijklmnopqrstuv123' }])).toThrow(/疑似重复/);
    expect(() => check([{ ...a, title }, { ...b, title: 'abcdefghijklmnopqrstu1234' }])).not.toThrow();
  });
  it('compares aliases as well as titles', () => {
    expect(() => check([{ ...a, title: '甲事件', aliases: [a.title] }, { ...b, title: '乙事件', aliases: [b.title] }])).toThrow(/疑似重复/);
  });
  it('requires overlap and a shared editorial period', () => {
    expect(() => check([a, { ...b, startYear: -989, endYear: -980 }])).not.toThrow();
    const other = { ...periods[0], id: 'other-period' };
    expect(() => validateContentQuality({ events: [a, { ...b, editorialPeriodId: other.id }], periods: [...periods, other], sources }, { enforceFinalTargets: false })).not.toThrow();
  });
  it('exempts only reciprocal valid parents containing their children', () => {
    expect(() => check([{ ...a, endYear: -980, childIds: [b.id] }, { ...b, parentId: a.id }])).not.toThrow();
    expect(() => check([{ ...a, childIds: [b.id] }, b])).toThrow(/双向/);
    expect(() => check([{ ...a, childIds: [b.id] }, { ...b, parentId: a.id }])).toThrow(/父事件年代/);
    expect(() => check([{ ...a, childIds: [b.id], parentId: b.id }, { ...b, startYear: a.startYear, endYear: a.endYear, parentId: a.id, childIds: [a.id] }])).toThrow(/循环/);
  });
  it('does not exempt exact title or alias collisions', () => {
    expect(() => check([{ ...a, childIds: [b.id] }, { ...b, title: a.title, startYear: a.startYear, endYear: a.endYear, parentId: a.id }])).toThrow(/规范化标题重复/);
  });
});

describe('aggregate targets', () => {
  it('reports all counts and missing categories without rejecting an empty or partial catalog', () => {
    expect(check([])).toMatchObject({ eventCount: 0, basicEventCount: 0, coreEventCount: 0, periodCounts: { 'pre-qin': 0 }, corePeriodCounts: { 'pre-qin': 0 }, influenceCounts: { '1': 0, '5': 0 }, categoryCounts: { science: 0 }, suspectedDuplicates: [] });
    expect(check([basic]).warnings.length).toBeGreaterThan(0);
    expect(check([{ ...basic, categories: ['politics'], influence: 5 }]).warnings.join(' ')).toMatch(/60%.*15%/);
  });
  it('enforces exact totals, quotas and missing categories only in final mode', () => {
    expect(() => check([], true)).toThrow(/1200.*200/);
    expect(() => check([basic], true)).toThrow(/pre-qin.*170.*25/);
    expect(() => check([basic], true)).toThrow(/分类.*零/);
  });
  it('rejects politics/war over 60%, a period with only those categories, and influence 5 over 15% in final mode', () => {
    expect(() => check([{ ...basic, categories: ['politics', 'war'], influence: 5 }], true)).toThrow(/60%/);
    expect(() => check([{ ...basic, categories: ['politics'], influence: 5 }], true)).toThrow(/只有政治.*战争/);
    expect(() => check([{ ...basic, influence: 5 }], true)).toThrow(/15%/);
  });
  it('allows exact ratio boundaries and counts multi-category events once in the politics/war share', () => {
    const events = Array.from({ length: 20 }, (_, i) => ({ ...basic, id: `event-${i}`, title: `条目${String.fromCharCode(0x4e00 + i)}`, startYear: -1000 + i, endYear: -1000 + i, categories: i < 12 ? ['politics', 'war'] as BasicEventRecord['categories'] : ['culture'] as BasicEventRecord['categories'], influence: i < 3 ? 5 as const : 4 as const }));
    expect(check(events).warnings.join(' ')).not.toMatch(/60%|15%/);
  });
});

// Independent design targets: do not derive expectations from the editable manifest.
const finalPeriods: EditorialPeriod[] = [
  ['pre-qin', -2070, -221, 170, 25], ['qin-han', -221, 220, 130, 22],
  ['wei-jin', 220, 589, 120, 18], ['sui-tang-five-dynasties', 581, 960, 160, 30],
  ['song-liao-jin-xia', 907, 1279, 170, 30], ['yuan', 1271, 1368, 70, 12],
  ['ming', 1368, 1644, 130, 22], ['qing', 1644, 1840, 130, 21], ['modern', 1840, 1949, 120, 20]
].map(([id, startYear, endYear, eventQuota, coreQuota]) => ({ id, name: id, startYear, endYear, eventQuota, coreQuota } as EditorialPeriod));
function finalEvents(): BasicEventRecord[] {
  let index = 0;
  return finalPeriods.flatMap(period => Array.from({ length: period.eventQuota }, (_, i) => {
    const n = index++;
    const year = period.startYear + Math.floor(i * (period.endYear - period.startYear) / period.eventQuota);
    return {
      ...basic, id: `event-${n}`, title: `事件${String.fromCodePoint(0x4e00 + n)}`,
      startYear: year || 1, endYear: year || 1, editorialPeriodId: period.id,
      detailLevel: i < period.coreQuota ? 'core' : 'basic',
      sourceRefs: i < period.coreQuota ? [...basic.sourceRefs, { sourceId: 'annals', locator: '卷一' }] : basic.sourceRefs,
      categories: [(['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society'] as const)[n % 11]],
      influence: n < 180 ? 5 : 4
    };
  }));
}
it('accepts a complete final catalog distributed across all nine fixed periods', () => {
  const report = validateContentQuality({ events: finalEvents(), periods: finalPeriods, sources }, { enforceFinalTargets: true });
  expect(report).toMatchObject({ eventCount: 1200, basicEventCount: 1000, coreEventCount: 200, warnings: [], suspectedDuplicates: [], finalTargetsEnforced: true });
  expect(report.periodCounts).toEqual(Object.fromEntries(finalPeriods.map(period => [period.id, period.eventQuota])));
  expect(report.corePeriodCounts).toEqual(Object.fromEntries(finalPeriods.map(period => [period.id, period.coreQuota])));
});
it.each([
  ['missing', finalPeriods.slice(1), /缺少.*pre-qin/],
  ['retargeted event quota', finalPeriods.map(period => period.id === 'pre-qin' ? { ...period, eventQuota: 171 } : period), /pre-qin.*eventQuota.*170/],
  ['retargeted core quota', finalPeriods.map(period => period.id === 'qing' ? { ...period, coreQuota: 22 } : period), /qing.*coreQuota.*21/],
  ['extra', [...finalPeriods, { ...finalPeriods[0], id: 'extra' }], /额外.*extra/],
  ['duplicate', [...finalPeriods, finalPeriods[0]], /重复.*pre-qin/],
  ['changed start', finalPeriods.map(period => period.id === 'pre-qin' ? { ...period, startYear: -3000 } : period), /pre-qin.*startYear.*-2070/],
  ['changed end', finalPeriods.map(period => period.id === 'modern' ? { ...period, endYear: 2000 } : period), /modern.*endYear.*1949/]
])('rejects %s final period manifest', (_, candidate, message) => {
  expect(() => validateContentQuality({ events: finalEvents(), periods: candidate as EditorialPeriod[], sources }, { enforceFinalTargets: true })).toThrow(message as RegExp);
});
it('rejects the former one-period retargeting bypass', () => {
  const period = { ...finalPeriods[0], eventQuota: 1200, coreQuota: 200 };
  const events = finalEvents().map((event, i) => ({ ...event, startYear: -2000 + i, endYear: -2000 + i, editorialPeriodId: period.id }));
  expect(() => validateContentQuality({ events, periods: [period], sources }, { enforceFinalTargets: true })).toThrow(/缺少.*qin-han/);
});
