import { readFileSync } from 'node:fs';
import { createHistoryContentLoader } from '../../src/history/content/loader';

export const legacyEventIds = new Set('zhenguan kaiyuan anshi two-tax huang-chao chenqiao chanyuan wang-anshi jingkang yue-fei mongol-rise yuan-founded province-system zheng-he tumu zhang-juzheng imjin-war ming-fall kangqian opium-war taiping self-strengthening sino-japanese-war hundred-days boxer xinhai may-fourth northern-expedition victory-1945 prc-founded'.split(' '));

/** Full static contracts, with richer relationships than the migration seed. */
export function archiveFixture() {
  const read = (path: string) => JSON.parse(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
  const manifest = read('manifest.json');
  const events = read(manifest.indexes.events).filter((item: { id: string }) => legacyEventIds.has(item.id));
  const people = read(manifest.indexes.people);
  const tang = read('eras/tang.json');
  tang.events = tang.events.filter((item: { id: string }) => legacyEventIds.has(item.id));
  manifest.eventCount = events.length;
  manifest.structuredEventCount = events.length;
  manifest.basicEventCount = 0;
  manifest.coreEventCount = events.length;
  manifest.eventEras = Object.fromEntries(events.map((item: { id: string; eraId: string }) => [item.id, item.eraId]));
  manifest.periodCounts = Object.fromEntries(Object.keys(manifest.periodCounts).map(id => [id, events.filter((item: { editorialPeriodId: string }) => item.editorialPeriodId === id).length]));
  const event = tang.events.find((item: { id: string }) => item.id === 'zhenguan');
  Object.assign(event, {
    summary: '唐太宗在位期间，君臣以恢复生产、整顿政治和听取意见为主要施政方向。'.repeat(3),
    background: '隋末战乱之后，社会需要恢复。 [进一步阅读](https://example.org/history) [危险链接](javascript:alert%281%29)',
    causes: ['恢复社会生产。'], results: ['政局趋于稳定。'],
    impacts: [{ dimension: 'politics', text: '为后来的发展提供制度基础。' }],
    course: [{ year: 627, title: '纳谏与任贤', description: '**纳谏**成为政治实践。' }],
    placeIds: ['changan', 'missing-place'], themeIds: ['tang-journey', 'missing-theme'],
    childIds: ['kaiyuan'], relationIds: ['zhenguan-kaiyuan', 'missing-relation'],
    sourceRefs: ['bai-shouyi-general-history', 'history-institution', 'missing-source'].map(sourceId => ({ sourceId, locator: '唐代政治资料条目' }))
  });
  Object.assign(events.find((item: { id: string }) => item.id === 'zhenguan'), { summary: '唐太宗在位期间，君臣以恢复生产、整顿政治和听取意见为主要施政方向。'.repeat(3), placeIds: event.placeIds, themeIds: event.themeIds, childIds: event.childIds, relationIds: event.relationIds, sourceIds: event.sourceRefs.map((ref: { sourceId: string }) => ref.sourceId) });
  const person = tang.people.find((item: { id: string }) => item.id === 'person-li-shimin');
  Object.assign(person, {
    timeline: [{ year: 626, title: '即位', description: '开始执政。' }, { year: 627, title: '改元贞观', description: '开展政治修整。' }],
    identities: [{ startYear: 626, endYear: 649, roleId: 'emperor', description: '作为唐朝皇帝执政。' }],
    contributions: ['推动政治修整。'], works: ['《帝范》'], relics: ['昭陵'],
    relations: [{ personId: 'person-wei-zheng', type: '君臣', description: '重视直谏。' }, { personId: 'missing-person', type: '相关人物', description: '关系档案待补。' }],
    eventIds: ['zhenguan', 'missing-event'], sourceIds: ['history-institution']
  });
  const theme = {
    id: 'tang-journey', title: '唐代政治之旅', summary: '从贞观走向开元，沿时间观察制度变化。',
    eventIds: ['zhenguan', 'kaiyuan'], chapters: [
      { title: '恢复与整顿', description: '观察唐初的社会恢复。', eventIds: ['zhenguan'] },
      { title: '繁盛与变化', description: '继续探索开元时期。', eventIds: ['kaiyuan', 'missing-event'] }
    ], sourceIds: ['history-institution']
  };
  manifest.themeArchives = { 'tang-journey': 'themes/tang-journey.json' };
  const sources = [...read(manifest.sources), { id: 'history-institution', title: '历史资料目录', kind: 'institution', authors: ['资料编写组'], publisher: '历史研究机构', chapter: '唐代', url: 'https://example.org/catalog', accessedAt: '2026-11-09' }];
  const records: Record<string, unknown> = {
    'manifest.json': manifest, [manifest.indexes.events]: events, [manifest.indexes.people]: people,
    [manifest.indexes.places]: [{ id: 'changan', name: '长安', modernName: '西安', aliases: [], historicalNames: [], coordinates: [108.9, 34.3], eventIds: ['zhenguan'] }],
    [manifest.indexes.themes]: [{ id: theme.id, title: theme.title, summary: theme.summary, eventIds: theme.eventIds }],
    'eras/tang.json': tang, [manifest.sources]: sources,
    [manifest.relations]: [{ id: 'zhenguan-kaiyuan', fromId: 'zhenguan', toId: 'kaiyuan', type: 'cause' }],
    'themes/tang-journey.json': theme
  };
  const requests: string[] = [];
  const failures = new Set<string>();
  const gates = new Map<string, Promise<void>>();
  const releases = new Map<string, () => void>();
  const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
    const path = String(input).replace('/content/', '');
    requests.push(path);
    await gates.get(path);
    if (failures.has(path)) throw new Error('offline');
    return new Response(JSON.stringify(Object.hasOwn(records, path) ? records[path] : read(path)));
  } });
  return { loader, records, requests, failures, manifest, event, person, theme, sources, events, people,
    pause: (path: string) => { gates.set(path, new Promise<void>(resolve => { releases.set(path, resolve); })); },
    resume: (path: string) => { releases.get(path)?.(); gates.delete(path); }
  };
}
