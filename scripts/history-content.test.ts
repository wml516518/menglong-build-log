// @vitest-environment node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { compileHistoryContent } from './history-content';

const run = promisify(execFile);
const temporaryRoots: string[] = [];
const script = resolve('scripts/history-content.ts');
const tsx = resolve('node_modules/tsx/dist/cli.mjs');
const era = { id: 'tang', name: '唐', startYear: 618, endYear: 907, color: '#d7aa54', inscription: '长安气象' };
const source = { id: 'general-history', title: '中国通史', kind: 'book' };
const eventA = {
  id: 'event-a', title: '前期事件', aliases: ['  早期　事件  ', '早期 事件', 'ｅａｒｌｙ', 'early'],
  startYear: 700, endYear: 701, yearPrecision: 'range', eraId: 'tang', polityIds: [],
  period: '唐代', categories: ['politics'], themeIds: [], influence: 5, summary: '制度调整。',
  causes: ['社会治理需要。'], course: [{ year: 700, title: '开始', description: '实行调整。' }],
  results: ['形成新安排。'], impacts: [{ dimension: 'politics', text: '政治制度变化。' }],
  personIds: ['person-a'], placeIds: [], parentId: null, childIds: [], relationIds: [],
  historiography: '参照通史研究。', sourceIds: ['general-history'], color: '#aabbcc',
  layout: { lane: 'politics', offset: [1, -1] }
};
const eventB = { ...eventA, id: 'event-b', title: '同期事件', aliases: [], endYear: 700, personIds: ['person-b'] };
const personA = {
  id: 'person-a', name: '甲', aliases: ['  甲　某 ', '甲 某'], primaryEraId: 'tang',
  birthYear: 600, deathYear: 750, roleIds: [], eventIds: ['event-a'], sourceIds: ['general-history'],
  yearPrecision: 'exact', birthplaceId: null, placeIds: [],
  timeline: [{ year: 700, title: '活动', description: '参与制度调整。' }], identities: [],
  contributions: ['参与政务。'], relations: [], evaluation: '结合时代背景评价。', legacy: '政务活动留有记载。',
  works: [], relics: [], historiography: '生平以通史记载为据。'
};
const personB = { ...personA, id: 'person-b', name: '乙', aliases: [], eventIds: ['event-b'] };
const theme = {
  id: 'institutions', title: '制度变迁', summary: '观察制度。', eventIds: ['event-a'],
  chapters: [{ title: '调整', description: '制度改革。', eventIds: ['event-a'] }], sourceIds: ['general-history']
};
const relation = { id: 'a-b', fromId: 'event-a', toId: 'event-b', type: 'parallel' };
const place = { id: 'changan', name: '长安', modernName: '西安', aliases: [], historicalNames: [], coordinates: [108.9, 34.3], eventIds: ['event-a'] };

type RecordData = Record<string, unknown>;
type Fixture = {
  eras: RecordData[]; sources: RecordData[]; themes: RecordData[];
  events: Array<{ file: string; metadata: RecordData; body: string }>;
  people: Array<{ file: string; metadata: RecordData; body: string }>;
  relations?: RecordData[]; places?: RecordData[];
};
function validFixture(): Fixture {
  return structuredClone({
    eras: [
      { id: 'song', name: '宋', startYear: 960, endYear: 1271, color: '#79b7a7', inscription: '文治昌明' },
      era,
      { id: 'pre-qin', name: '先秦', startYear: -2070, endYear: -221, color: '#aabbcc', inscription: '文明起源' }
    ],
    sources: [source], themes: [],
    events: [
      { file: 'tang/events/z.md', metadata: eventA, body: '背景甲。' },
      { file: 'tang/events/a.md', metadata: eventB, body: '背景乙。' }
    ],
    people: [
      { file: 'tang/people/z.md', metadata: personA, body: '甲的人物概述。' },
      { file: 'tang/people/a.md', metadata: personB, body: '乙的人物概述。' }
    ]
  });
}
async function fixtureTree(fixture = validFixture()) {
  const root = await mkdtemp(join(tmpdir(), 'history-compiler-'));
  temporaryRoots.push(root);
  const sourceRoot = join(root, 'history-content');
  await mkdir(join(sourceRoot, 'manifest'), { recursive: true });
  for (const name of ['eras', 'sources', 'themes', 'places', 'relations'] as const) {
    if (fixture[name]) await writeFile(join(sourceRoot, 'manifest', `${name}.json`), JSON.stringify(fixture[name]));
  }
  for (const record of [...fixture.events, ...fixture.people]) {
    const file = join(sourceRoot, 'content', record.file);
    await mkdir(resolve(file, '..'), { recursive: true });
    await writeFile(file, `---\n${JSON.stringify(record.metadata, null, 2)}\n---\n\n${record.body}\n`);
  }
  return {
    root, sourceRoot, publicOutputRoot: join(root, 'public/history-content/generated'),
    compatibilityOutputFile: join(root, 'src/history/generated/compat-index.json')
  };
}
async function json(path: string) { return JSON.parse(await readFile(path, 'utf8')); }
async function files(root: string, prefix = ''): Promise<Record<string, string>> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const result: Record<string, string> = {};
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : 1)) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, await files(root, path));
    else result[path] = await readFile(join(root, path), 'utf8');
  }
  return result;
}
afterEach(async () => { await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

// Removing projection, alias normalization, chronology or URL maps breaks bootstrap consumers.
it('compiles real Markdown into sorted compact indexes, era archives and the compatibility view', async () => {
  const paths = await fixtureTree();
  await expect(compileHistoryContent(paths)).resolves.toMatchObject({ eventCount: 2, personCount: 2, sourceCount: 1, errorCount: 0 });
  const events = await json(join(paths.publicOutputRoot, 'indexes/events.compact.json'));
  expect(events.map((event: RecordData) => event.id)).toEqual(['event-b', 'event-a']);
  expect(events[1]).toMatchObject({ year: 700, aliases: ['early', '早期 事件'], startYear: 700, endYear: 701 });
  expect(events[1]).not.toHaveProperty('background');
  expect(events[1]).not.toHaveProperty('story');
  const people = await json(join(paths.publicOutputRoot, 'indexes/people.compact.json'));
  expect(people.map((person: RecordData) => person.id)).toEqual(['person-a', 'person-b']);
  expect(people[0].aliases).toEqual(['甲 某']);
  expect(people[0]).not.toHaveProperty('summary');
  const bundle = await json(join(paths.publicOutputRoot, 'eras/tang.json'));
  expect(bundle.events.map((event: RecordData) => event.id)).toEqual(['event-b', 'event-a']);
  expect(bundle.events[1].background).toBe('背景甲。');
  expect(bundle.people[0].summary).toBe('甲的人物概述。');
  expect(await json(join(paths.publicOutputRoot, 'eras/song.json'))).toEqual({ eraId: 'song', events: [], people: [] });
  expect(await json(join(paths.publicOutputRoot, 'manifest.json'))).toMatchObject({
    version: 1, eventCount: 2, personCount: 2,
    indexes: { events: 'indexes/events.compact.json', people: 'indexes/people.compact.json', places: 'indexes/places.compact.json', themes: 'indexes/themes.compact.json' },
    eraBundles: { tang: 'eras/tang.json', song: 'eras/song.json', 'pre-qin': 'eras/pre-qin.json' },
    eventEras: { 'event-a': 'tang', 'event-b': 'tang' }, personEras: { 'person-a': 'tang', 'person-b': 'tang' }
  });
  const compatibility = await json(paths.compatibilityOutputFile);
  expect(compatibility.dynasties.map((item: RecordData) => item.id)).toEqual(['tang', 'song']);
  expect(compatibility.historyEvents[1]).toMatchObject({ id: 'event-a', year: 700, dynasty: 'tang', people: ['甲'], offset: [1, -1] });
  expect(compatibility.historyEvents[1].story).toContain('背景甲。');
});

it('sorts same-year ranges by end year and stable IDs and emits byte-identical output independent of input ordering', async () => {
  const fixture = validFixture();
  fixture.events.push({ file: 'tang/events/aa.md', metadata: { ...eventB, id: 'event-aa', personIds: [] }, body: '相同起止年。' });
  const first = await fixtureTree(fixture);
  await compileHistoryContent(first);
  const reversed = structuredClone(fixture);
  reversed.eras.reverse();
  reversed.events.reverse();
  for (const record of [...reversed.events, ...reversed.people]) record.metadata = Object.fromEntries(Object.entries(record.metadata).reverse());
  const second = await fixtureTree(reversed);
  await compileHistoryContent(second);
  expect((await json(join(first.publicOutputRoot, 'indexes/events.compact.json'))).map((event: RecordData) => event.id)).toEqual(['event-aa', 'event-b', 'event-a']);
  expect(await files(first.publicOutputRoot)).toEqual(await files(second.publicOutputRoot));
  expect(await readFile(first.compatibilityOutputFile, 'utf8')).toBe(await readFile(second.compatibilityOutputFile, 'utf8'));
});

describe('invalid source trees', () => {
  const cases: Array<[string, (fixture: Fixture) => void, string]> = [
    ['duplicate event IDs', f => { f.events.push({ ...f.events[0], file: 'tang/events/copy.md', metadata: { ...eventA, id: 'shared-id', personIds: [] } }); f.events[0].metadata.id = 'shared-id'; }, '重复事件 ID: shared-id'],
    ['duplicate person IDs', f => { f.people[1].metadata.id = 'person-a'; }, '重复人物 ID: person-a'],
    ['duplicate source IDs', f => { f.sources.push(source); }, '重复来源 ID: general-history'],
    ['duplicate era IDs', f => { f.eras.push(era); }, '重复时代 ID: tang'],
    ['missing person', f => { f.events[0].metadata.personIds = ['person-missing']; }, '事件 event-a 引用了不存在的人物 person-missing'],
    ['event-side reciprocity', f => { f.people[0].metadata.eventIds = ['event-b']; }, '事件 event-a 与人物 person-a 的关联未双向声明'],
    ['person-side reciprocity', f => { f.events[0].metadata.personIds = []; }, '人物 person-a 与事件 event-a 的关联未双向声明'],
    ['person missing event', f => { f.people[0].metadata.eventIds = ['event-missing']; }, '人物 person-a 引用了不存在的事件 event-missing'],
    ['event missing source', f => { f.events[0].metadata.sourceIds = ['source-missing']; }, '事件 event-a 引用了不存在的来源 source-missing'],
    ['person missing source', f => { f.people[0].metadata.sourceIds = ['source-missing']; }, '人物 person-a 引用了不存在的来源 source-missing'],
    ['unknown era', f => { f.events[0].metadata.eraId = 'era-missing'; }, '事件 event-a 引用了不存在的时代 era-missing'],
    ['unknown primary era', f => { f.people[0].metadata.primaryEraId = 'era-missing'; }, '人物 person-a 引用了不存在的时代 era-missing'],
    ['event era range', f => { f.events[0].metadata.endYear = 908; }, '事件 event-a 的年代超出时代 tang'],
    ['archive directory era', f => { f.events[0].file = 'song/events/a.md'; }, '事件 event-a 的目录时代 song 与 eraId tang 不一致'],
    ['person directory era', f => { f.people[0].file = 'song/people/a.md'; }, '人物 person-a 的目录时代 song 与 primaryEraId tang 不一致'],
    ['missing parent', f => { f.events[0].metadata.parentId = 'event-missing'; }, '事件 event-a 引用了不存在的父事件 event-missing'],
    ['missing child', f => { f.events[0].metadata.childIds = ['event-missing']; }, '事件 event-a 引用了不存在的子事件 event-missing'],
    ['parent reciprocity', f => { f.events[0].metadata.parentId = 'event-b'; }, '事件 event-a 与父事件 event-b 的关联未双向声明'],
    ['child reciprocity', f => { f.events[0].metadata.childIds = ['event-b']; }, '事件 event-a 与子事件 event-b 的关联未双向声明'],
    ['parent cycles', f => { for (const [index, other] of [[0, 'event-b'], [1, 'event-a']] as const) { f.events[index].metadata.parentId = other; f.events[index].metadata.childIds = [other]; } }, '父事件循环: event-a'],
    ['missing theme', f => { f.events[0].metadata.themeIds = ['theme-missing']; }, '事件 event-a 引用了不存在的专题 theme-missing'],
    ['missing place', f => { f.events[0].metadata.placeIds = ['place-missing']; }, '事件 event-a 引用了不存在的地点 place-missing'],
    ['missing relation', f => { f.events[0].metadata.relationIds = ['relation-missing']; }, '事件 event-a 引用了不存在的关系 relation-missing'],
    ['unknown biography relation', f => { f.people[0].metadata.relations = [{ personId: 'person-missing', type: '同僚', description: '同朝活动。' }]; }, '人物 person-a 引用了不存在的关联人物 person-missing'],
    ['unknown birthplace', f => { f.people[0].metadata.birthplaceId = 'place-missing'; }, '人物 person-a 引用了不存在的出生地点 place-missing'],
    ['invalid strict metadata', f => { f.events[0].metadata.year = 700; }, 'event-a'],
    ['unsafe compiled Markdown', f => { f.events[0].body = '<script>bad()</script>'; }, 'event-a'],
    ['missing Markdown prose', f => { f.people[0].body = '   '; }, 'person-a'],
    ['unsafe sources', f => { f.sources[0].url = 'http://example.com'; }, 'general-history'],
    ['invalid archive course', f => { f.events[0].metadata.course = [{ year: 800, title: '越界', description: '年代错误。' }]; }, 'event-a']
  ];
  it.each(cases)('rejects %s with the offending ID', async (_, mutate, message) => {
    const fixture = validFixture();
    mutate(fixture);
    const paths = await fixtureTree(fixture);
    await expect(compileHistoryContent(paths)).rejects.toThrow(message);
    await expect(readdir(paths.publicOutputRoot)).rejects.toThrow();
    await expect(readFile(paths.compatibilityOutputFile)).rejects.toThrow();
  });
});

it('validates schema-backed theme, place and relation catalogs and their reciprocal references', async () => {
  const fixture = validFixture();
  fixture.themes = [theme]; fixture.places = [place]; fixture.relations = [relation];
  Object.assign(fixture.events[0].metadata, { themeIds: ['institutions'], placeIds: ['changan'], relationIds: ['a-b'] });
  fixture.events[1].metadata.relationIds = ['a-b'];
  const paths = await fixtureTree(fixture);
  await compileHistoryContent(paths);
  expect((await json(join(paths.publicOutputRoot, 'indexes/themes.compact.json')))[0]).toEqual({ id: 'institutions', title: '制度变迁', summary: '观察制度。', eventIds: ['event-a'] });
  expect(await json(join(paths.publicOutputRoot, 'themes/institutions.json'))).toEqual(theme);
  expect(await json(join(paths.publicOutputRoot, 'relations.json'))).toEqual([relation]);
  expect((await json(join(paths.publicOutputRoot, 'indexes/places.compact.json')))[0].id).toBe('changan');
});

it.each([
  ['relation endpoints', (f: Fixture) => { f.relations = [{ ...relation, toId: 'event-missing' }]; }, '关系 a-b 引用了不存在的事件 event-missing'],
  ['relation reciprocity', (f: Fixture) => { f.relations = [relation]; }, '关系 a-b 未在事件 event-a 中声明'],
  ['unrelated relation', (f: Fixture) => { f.relations = [relation]; f.events[0].metadata.relationIds = ['a-b']; f.events[1].metadata.relationIds = ['a-b']; f.events.push({ file: 'tang/events/third.md', metadata: { ...eventB, id: 'event-c', personIds: [], relationIds: ['a-b'] }, body: '另一事件。' }); }, '事件 event-c 不是关系 a-b 的端点'],
  ['theme references', (f: Fixture) => { f.themes = [{ ...theme, eventIds: ['event-missing'] }]; }, '专题 institutions 引用了不存在的事件 event-missing'],
  ['chapter references', (f: Fixture) => { f.themes = [{ ...theme, chapters: [{ title: '章节', description: '章节说明。', eventIds: ['event-missing'] }] }]; }, '专题 institutions 的章节引用了不存在的事件 event-missing'],
  ['theme reciprocity', (f: Fixture) => { f.themes = [theme]; }, '专题 institutions 与事件 event-a 的关联未双向声明'],
  ['place references', (f: Fixture) => { f.places = [{ ...place, eventIds: ['event-missing'] }]; }, '地点 changan 引用了不存在的事件 event-missing']
] as const)('rejects invalid %s', async (_, mutate, message) => {
  const fixture = validFixture(); mutate(fixture);
  await expect(compileHistoryContent(await fixtureTree(fixture))).rejects.toThrow(message);
});

it('replaces prior outputs together and leaves them byte-identical after a failed validation', async () => {
  const paths = await fixtureTree();
  await compileHistoryContent(paths);
  await writeFile(join(paths.publicOutputRoot, 'obsolete.json'), '{}');
  await compileHistoryContent(paths);
  await expect(readFile(join(paths.publicOutputRoot, 'obsolete.json'))).rejects.toThrow();
  const before = await files(paths.publicOutputRoot);
  const compatibility = await readFile(paths.compatibilityOutputFile, 'utf8');
  await writeFile(join(paths.sourceRoot, 'content/tang/events/bad.md'), '---\nid: broken-event\n---\n背景。');
  await expect(compileHistoryContent(paths)).rejects.toThrow('broken-event');
  expect(await files(paths.publicOutputRoot)).toEqual(before);
  expect(await readFile(paths.compatibilityOutputFile, 'utf8')).toBe(compatibility);
  expect((await readdir(join(paths.root, 'public/history-content'))).sort()).toEqual(['generated']);
  expect((await readdir(join(paths.root, 'src/history'))).sort()).toEqual(['generated']);
});

it('leaves prior output intact when the compatibility directory cannot be prepared', async () => {
  const paths = await fixtureTree();
  await compileHistoryContent(paths);
  const before = await files(paths.publicOutputRoot);
  const blocker = join(paths.root, 'blocked');
  await writeFile(blocker, 'a file blocks the parent directory');
  await expect(compileHistoryContent({ ...paths, compatibilityOutputFile: join(blocker, 'nested/compat-index.json') })).rejects.toThrow();
  expect(await files(paths.publicOutputRoot)).toEqual(before);
  expect((await readdir(join(paths.root, 'public/history-content'))).sort()).toEqual(['generated']);
});

it('does not run the CLI when imported and checks fixtures without writing generated files', async () => {
  const paths = await fixtureTree();
  const imported = await run(process.execPath, [tsx, '--eval', `import(${JSON.stringify(script)})`], { cwd: paths.root });
  expect(imported.stdout).toBe('');
  await expect(readdir(paths.publicOutputRoot)).rejects.toThrow();
  const checked = await run(process.execPath, [tsx, script, 'check'], { cwd: paths.root });
  expect(JSON.parse(checked.stdout)).toMatchObject({ eventCount: 2, personCount: 2, errorCount: 0 });
  await expect(readdir(paths.publicOutputRoot)).rejects.toThrow();
  await expect(readFile(paths.compatibilityOutputFile)).rejects.toThrow();
  const compiled = await run(process.execPath, [tsx, script, 'compile'], { cwd: paths.root });
  expect(JSON.parse(compiled.stdout)).toMatchObject({ eventCount: 2, personCount: 2, errorCount: 0 });
  expect(await json(paths.compatibilityOutputFile)).toHaveProperty('historyEvents');
});

it('avoids repeating identical archive sentences in the legacy story', async () => {
  const fixture = validFixture();
  fixture.events[0].metadata.results = ['制度调整留下影响。'];
  fixture.events[0].metadata.impacts = [{ dimension: 'politics', text: '制度调整留下影响。' }];
  const paths = await fixtureTree(fixture);
  await compileHistoryContent(paths);
  const events = (await json(paths.compatibilityOutputFile)).historyEvents;
  expect(events.find((event: RecordData) => event.id === 'event-a').story).toBe('背景甲。实行调整。制度调整留下影响。');
});

it('migrates all thirty stories and every named person without changing the existing scene values', async () => {
  const paths = await fixtureTree();
  const original = await json(resolve('scripts/fixtures/history-legacy.json'));
  await expect(compileHistoryContent({ ...paths, sourceRoot: resolve('history-content') })).resolves.toMatchObject({ eventCount: 30, personCount: 78, errorCount: 0 });
  const compatibility = await json(paths.compatibilityOutputFile);
  expect(compatibility.dynasties).toEqual(original.dynasties);
  for (const event of original.historyEvents) {
    expect(compatibility.historyEvents.find((item: RecordData) => item.id === event.id)).toMatchObject(event);
  }
  const people = await json(join(paths.publicOutputRoot, 'indexes/people.compact.json'));
  expect(people.map((person: RecordData) => person.name).sort()).toEqual([...new Set(original.historyEvents.flatMap((event: { people: string[] }) => event.people))].sort());
});

it('rejects executable Frontmatter before it can run', async () => {
  const paths = await fixtureTree();
  const marker = 'HISTORY_COMPILER_TEST_EXECUTED';
  delete process.env[marker];
  const frontmatter = `---javascript\n(() => { process.env.${marker} = 'yes'; return ${JSON.stringify(eventA)}; })()\n---\n背景甲。`;
  await writeFile(join(paths.sourceRoot, 'content/tang/events/z.md'), frontmatter);
  try {
    await expect(compileHistoryContent(paths)).rejects.toThrow('z 的 Frontmatter 仅支持 YAML');
    expect(process.env[marker]).toBeUndefined();
  } finally { delete process.env[marker]; }
});

it('normalizes place aliases for compact search consumers', async () => {
  const fixture = validFixture();
  fixture.places = [{ ...place, aliases: [' 長　安 ', '長 安'], eventIds: [] }];
  const paths = await fixtureTree(fixture);
  await compileHistoryContent(paths);
  expect((await json(join(paths.publicOutputRoot, 'indexes/places.compact.json')))[0].aliases).toEqual(['長 安']);
});

it.each([
  { birthYear: 500, deathYear: 600, timeline: [{ year: 550, title: '活动', description: '早期活动。' }] },
  { birthYear: 960, deathYear: 1000, timeline: [{ year: 970, title: '活动', description: '晚期活动。' }] },
  { birthYear: null, deathYear: 600, timeline: [{ year: 550, title: '活动', description: '早期活动。' }] },
  { birthYear: 960, deathYear: null, timeline: [{ year: 970, title: '活动', description: '晚期活动。' }] }
])('rejects a primary era disjoint from the known lifespan: %j', async lifespan => {
  const fixture = validFixture();
  Object.assign(fixture.people[0].metadata, lifespan);
  await expect(compileHistoryContent(await fixtureTree(fixture))).rejects.toThrow('人物 person-a 的生平与时代 tang 不相交');
});
