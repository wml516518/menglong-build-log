import { categoryIds, type CompactHistoryEventIndex, type HistoryEra } from '../content/schema';

/** Synthetic, deterministic load data. Import only from tests or local tooling. */
export function generateScaleFixture(eras: readonly HistoryEra[], count = 1200): CompactHistoryEventIndex[] {
  if (!eras.length || !Number.isSafeInteger(count) || count < 0) throw new Error('Valid eras and a nonnegative count are required');
  return Array.from({ length: count }, (_, i) => {
    const era = eras[i % eras.length];
    const category = categoryIds[Math.floor(i / eras.length) % categoryIds.length];
    const rawYear = era.startYear + Math.floor((era.endYear - era.startYear) * ((Math.floor(i / eras.length) * 37) % 100) / 100);
    const year = rawYear === 0 ? 1 : rawYear;
    return {
      id: `scale-fixture-${String(i).padStart(4, '0')}`, title: `规模测试事件${String(i).padStart(4, '0')}`,
      aliases: [`检索别名${i}`], year, startYear: year, endYear: year, yearPrecision: 'exact',
      eraId: era.id, polityIds: [], period: era.name, categories: [category], themeIds: [],
      influence: i % 60 === 0 ? 5 : (i % 4 + 1) as 1 | 2 | 3 | 4,
      summary: '仅用于引擎规模验收的合成记录，不代表真实历史。',
      personIds: [], placeIds: [], parentId: null, childIds: [], relationIds: [],
      sourceIds: ['synthetic-fixture'], color: era.color, layout: { lane: category, offset: [(i % 7) / 10, (i % 11) / 10] },
    };
  });
}
