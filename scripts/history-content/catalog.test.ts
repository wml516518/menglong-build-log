import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readEventCatalogs, readCoreDetails, mergeEventArchives } from './catalog';
import { compileHistoryContent } from '../history-content';
import { editorialPeriodSchema } from '../../src/history/content/schema';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const basic = {
  id: 'zhougong-regency', title: '周公摄政', aliases: [' 周 公 ', '周　公'],
  startYear: -1042, endYear: -1035, yearPrecision: 'circa', eraId: 'pre-qin',
  editorialPeriodId: 'pre-qin', detailLevel: 'basic', polityIds: [], period: '西周',
  categories: ['politics'], themeIds: [], influence: 4, summary: '周公辅佐成王推动西周初年的政治秩序稳定并参与制度建设。'.repeat(4),
  personIds: [], placeIds: [], parentId: null, childIds: [], relationIds: [],
  sourceRefs: [{ sourceId: 'general-history', locator: '西周初年相关章节' }],
  color: '#123456', layout: { lane: 'politics', offset: [0, 0] }
};
const details = `---\nid: zhougong-regency\ncauses:\n  - 政权交接\ncourse:\n  - year: -1042\n    title: 摄政\n    description: 周公辅政。\nresults:\n  - 政局稳定\nimpacts:\n  - dimension: politics\n    text: 影响早期政治秩序。\nhistoriography: 年代采用约数。\n---\n西周初年面临权力交接。`;
async function put(root: string, file: string, text: string) {
  const path = join(root, file); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, text);
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'history-catalog-')); roots.push(root);
  await mkdir(join(root, 'content'), { recursive: true });
  for (const id of ['pre-qin', 'qin-han', 'wei-jin', 'sui-tang-five-dynasties', 'song-liao-jin-xia', 'yuan', 'ming', 'qing', 'modern']) await put(root, `catalog/events/${id}.json`, '[]');
  return root;
}
async function merged(root: string) { return mergeEventArchives(await readEventCatalogs(root), await readCoreDetails(root)); }

it('reads files in lexical order and preserves editorial array order while normalizing aliases', async () => {
  const root = await fixture();
  await put(root, 'catalog/events/yuan.json', JSON.stringify([{ ...basic, id: 'last' }]));
  await put(root, 'catalog/events/pre-qin.json', JSON.stringify([{ ...basic, id: 'first' }, { ...basic, id: 'second' }]));
  expect((await readEventCatalogs(root)).map(record => record.id)).toEqual(['first', 'second', 'last']);
  expect((await readEventCatalogs(root))[0].aliases).toEqual(['周 公']);
});
it('merges core prose and returns basic records without invented details', async () => {
  const root = await fixture();
  await put(root, 'catalog/events/pre-qin.json', JSON.stringify([{ ...basic, detailLevel: 'core' }, { ...basic, id: 'basic-event' }]));
  await put(root, 'content/pre-qin/events/zhougong-regency.md', details);
  const events = await merged(root);
  expect(events[0]).toMatchObject({ id: basic.id, detailLevel: 'core', background: '西周初年面临权力交接。' });
  expect(events[1]).not.toHaveProperty('background');
});
it('locates invalid JSON and invalid record fields', async () => {
  const root = await fixture();
  await put(root, 'catalog/events/pre-qin.json', '{bad');
  await expect(readEventCatalogs(root)).rejects.toThrow('catalog/events/pre-qin.json');
  await put(root, 'catalog/events/pre-qin.json', JSON.stringify([{ ...basic, startYear: 0 }]));
  await expect(readEventCatalogs(root)).rejects.toThrow(/pre-qin.json.*zhougong-regency.*startYear/);
});
it('rejects duplicate IDs across catalog files with both paths', async () => {
  const root = await fixture();
  for (const id of ['pre-qin', 'yuan']) await put(root, `catalog/events/${id}.json`, JSON.stringify([basic]));
  await expect(readEventCatalogs(root)).rejects.toThrow(/zhougong-regency.*pre-qin.json.*yuan.json/);
});
it('rejects orphan core Markdown with a file diagnostic', async () => {
  const root = await fixture(); await put(root, 'content/pre-qin/events/zhougong-regency.md', details);
  await expect(merged(root)).rejects.toThrow(/zhougong-regency.md.*目录/);
});
it('rejects missing core Markdown with a catalog diagnostic', async () => {
  const root = await fixture(); await put(root, 'catalog/events/pre-qin.json', JSON.stringify([{ ...basic, detailLevel: 'core' }]));
  await expect(merged(root)).rejects.toThrow(/pre-qin.json.*zhougong-regency.*Markdown/);
});
it.each(['title: 重复标题', 'background: 重复背景', 'eraId: pre-qin'])('rejects repeated metadata: %s', async metadata => {
  const root = await fixture(); await put(root, 'catalog/events/pre-qin.json', JSON.stringify([{ ...basic, detailLevel: 'core' }]));
  await put(root, 'content/pre-qin/events/zhougong-regency.md', details.replace('id: zhougong-regency', `id: zhougong-regency\n${metadata}`));
  await expect(merged(root)).rejects.toThrow(/zhougong-regency.md/);
});
it('rejects duplicate Markdown IDs and malformed YAML with paths', async () => {
  const root = await fixture();
  await put(root, 'content/pre-qin/events/one.md', details);
  await put(root, 'content/pre-qin/events/two.md', details);
  await expect(readCoreDetails(root)).rejects.toThrow(/one.md.*two.md/);
  await put(root, 'content/pre-qin/events/one.md', '---\nid: [\n---\n背景');
  await expect(readCoreDetails(root)).rejects.toThrow(/one.md.*Frontmatter/);
});
it('rejects details for a basic record and mismatched directory eras', async () => {
  const root = await fixture(); await put(root, 'catalog/events/pre-qin.json', JSON.stringify([basic]));
  await put(root, 'content/pre-qin/events/zhougong-regency.md', details);
  await expect(merged(root)).rejects.toThrow(/basic/);
  await put(root, 'catalog/events/pre-qin.json', JSON.stringify([{ ...basic, detailLevel: 'core', eraId: 'yuan' }]));
  await expect(merged(root)).rejects.toThrow(/pre-qin.*yuan/);
});
it('compiles an additional basic record alongside existing core archives', async () => {
  const root = await fixture();
  await cp(resolve('history-content/manifest'), join(root, 'manifest'), { recursive: true });
  await cp(resolve('history-content/catalog'), join(root, 'catalog'), { recursive: true });
  await cp(resolve('history-content/content'), join(root, 'content'), { recursive: true });
  const sources = JSON.parse(await readFile(join(root, 'manifest/sources.json'), 'utf8'));
  sources.push({ id: 'general-history', title: '通史', kind: 'book' });
  await put(root, 'manifest/sources.json', JSON.stringify(sources));
  const preQin = JSON.parse(await readFile(join(root, 'catalog/events/pre-qin.json'), 'utf8'));
  await put(root, 'catalog/events/pre-qin.json', JSON.stringify([...preQin, basic]));
  const output = join(root, '..', `${root.split('/').at(-1)}-output`); roots.push(output);
  const productionCount = JSON.parse(await readFile(resolve('public/history-content/generated/manifest.json'), 'utf8')).eventCount;
  await expect(compileHistoryContent({ sourceRoot: root, publicOutputRoot: output, enforceFinalTargets: false })).resolves.toMatchObject({ eventCount: productionCount + 1 });
  expect(JSON.parse(await readFile(join(output, 'eras/pre-qin.json'), 'utf8')).events.find((event: { id: string }) => event.id === basic.id)).toMatchObject({ id: basic.id, detailLevel: 'basic', sourceRefs: basic.sourceRefs });
});

it('seeds all nine editorial periods with schema-canonical quotas', async () => {
  const periods = JSON.parse(await readFile(resolve('history-content/manifest/editorial-periods.json'), 'utf8')).map((period: unknown) => editorialPeriodSchema.parse(period));
  expect(periods.map((period: { id: string; eventQuota: number; coreQuota: number }) => [period.id, period.eventQuota, period.coreQuota])).toEqual([
    ['pre-qin', 170, 25], ['qin-han', 130, 22], ['wei-jin', 120, 18], ['sui-tang-five-dynasties', 160, 30], ['song-liao-jin-xia', 170, 30], ['yuan', 70, 12], ['ming', 130, 22], ['qing', 130, 21], ['modern', 120, 20]
  ]);
});

it('requires every catalog file once the structured catalog directory exists', async () => {
  const root = await fixture();
  await rm(join(root, 'catalog/events/yuan.json'));
  await expect(readEventCatalogs(root)).rejects.toThrow('yuan.json');
});
it('rejects metadata repeated by an old full-frontmatter file once its ID is catalog-owned', async () => {
  const root = await fixture();
  await put(root, 'catalog/events/pre-qin.json', JSON.stringify([{ ...basic, detailLevel: 'core' }]));
  await put(root, 'content/pre-qin/events/zhougong-regency.md', details.replace('id: zhougong-regency', 'id: zhougong-regency\ntitle: 旧标题\neraId: pre-qin'));
  await expect(merged(root)).rejects.toThrow(/zhougong-regency.md.*title.*eraId/);
});
it('locates a merged course year error in both the catalog and Markdown', async () => {
  const root = await fixture();
  await put(root, 'catalog/events/pre-qin.json', JSON.stringify([{ ...basic, detailLevel: 'core' }]));
  await put(root, 'content/pre-qin/events/zhougong-regency.md', details.replace('year: -1042', 'year: -1030'));
  await expect(merged(root)).rejects.toThrow(/pre-qin.json.*zhougong-regency.md.*course.0.year/);
});

it('rejects catalog-owned legacy Markdown missing its frontmatter ID before either reader can skip it', async () => {
  const root = await fixture();
  await cp(resolve('history-content/manifest'), join(root, 'manifest'), { recursive: true });
  const sources = JSON.parse(await readFile(join(root, 'manifest/sources.json'), 'utf8'));
  sources.push({ id: 'general-history', title: '通史', kind: 'book' });
  await put(root, 'manifest/sources.json', JSON.stringify(sources));
  await put(root, 'catalog/events/pre-qin.json', JSON.stringify([basic]));
  await put(root, 'content/pre-qin/events/zhougong-regency.md', details.replace('id: zhougong-regency', 'title: 旧标题\neraId: pre-qin'));
  await expect(readCoreDetails(root)).rejects.toThrow(/zhougong-regency.md.*id/);
  const output = `${root}-output`; roots.push(output);
  await expect(compileHistoryContent({ sourceRoot: root, publicOutputRoot: output, enforceFinalTargets: false })).rejects.toThrow(/zhougong-regency.md.*id/);
});
