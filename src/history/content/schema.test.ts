import { describe, expect, it } from 'vitest';
import {
  basicEventRecordSchema, coreEventDetailsSchema, editorialPeriodSchema, historyEventArchiveSchema, sourceReferenceSchema,
  eraSchema, eventArchiveSchema, eventIndexSchema, formatHistoryYear, personArchiveSchema,
  personIndexSchema, politySchema, placeIndexSchema, relationSchema, sourceSchema, themeArchiveSchema
} from './schema';

const oldEvent = {
  id: 'qin-unification', title: '秦统一六国', aliases: ['秦灭六国'],
  startYear: -230, endYear: -221, yearPrecision: 'range', eraId: 'qin-han', polityIds: ['qin'],
  period: '秦统一战争', categories: ['war', 'politics'], themeIds: ['unification'], influence: 5,
  summary: '秦国先后灭韩、赵、魏、楚、燕、齐，结束战国长期割据。',
  background: '战国后期兼并战争持续，秦国经过长期制度与军事建设取得优势。',
  causes: ['秦国国力与军制优势'], course: [{ year: -230, title: '灭韩', description: '秦军攻灭韩国。' }],
  results: ['建立统一王朝'], impacts: [{ dimension: 'politics', text: '统一政治秩序形成。' }],
  personIds: ['qin-shihuang'], placeIds: ['xianyang'], parentId: null, childIds: [],
  relationIds: [], historiography: '具体战役年代以主流年表为准。', sourceIds: ['textbook-7-1'],
  color: '#d6a650', layout: { lane: 'war', offset: [0, 0] }
};

const { sourceIds: oldSourceIds, ...commonEvent } = oldEvent;
const event = { ...commonEvent, detailLevel: 'core', editorialPeriodId: 'qin-han',
  summary: oldEvent.summary + '秦统一各国之后，原有的政治边界发生变化，国家统治范围扩大。原来分立的地域与人群被纳入新的统治秩序，秦朝制度建设及其实施方式也因此成为理解这一历史转折的重要线索。',
  sourceRefs: oldSourceIds.map(sourceId => ({ sourceId, locator: '秦统一战争章节' })) };

// Removing these validators would permit broken archives into the compiler.
describe('event archives', () => {
  it('accepts complete BCE archives preserving negative chronological years', () => {
    const parsed = eventArchiveSchema.parse(event);
    expect(parsed.id).toBe('qin-unification');
    expect(parsed.startYear).toBe(-230);
    expect(parsed.endYear).toBe(-221);
  });
  it.each([
    { title: '<!-- 注释 -->' }, { summary: '<!DOCTYPE html>' }, { background: '<?xml version="1.0"?>' },
    { title: '<b>秦</b>' }, { aliases: ['</span>'] }, { summary: '<img src=x>' },
    { background: '<script>alert(1)</script>' }, { causes: ['<i>原因</i>'] },
    { course: [{ year: -230, title: '<b>灭韩</b>', description: '过程' }] },
    { course: [{ year: -230, title: '灭韩', description: '</p>' }] },
    { results: ['<b>结果</b>'] }, { impacts: [{ dimension: 'politics', text: '<a>影响</a>' }] },
    { historiography: '<div>说明</div>' }, { period: '<p>时期</p>' }
  ])('rejects raw HTML recursively: %j', change => {
    expect(eventArchiveSchema.safeParse({ ...event, ...change }).success).toBe(false);
  });
  it('allows Markdown and less-than mathematical text', () => {
    expect(eventArchiveSchema.safeParse({ ...event, background: '**背景**：1 < 2，见[资料](https://example.com)。' }).success).toBe(true);
  });
  it.each([
    { id: 'Qin_Unification' }, { sourceRefs: [{ sourceId: 'bad_id', locator: '卷一' }] }, { influence: 0 }, { influence: 6 }, { influence: 2.5 },
    { categories: ['military'] }, { yearPrecision: 'approximate' }, { startYear: -220 }, { startYear: 0 },
    { startYear: -230.5 }, { parentId: 'qin-unification' }, { childIds: ['qin-unification'] },
    { course: [{ year: -240, title: '灭韩', description: '过程' }] },
    { sourceRefs: [] }, { causes: [] }, { course: [] }, { results: [] }, { impacts: [] },
    { background: '' }, { background: '   ' }, { unexpected: true }
  ])('rejects invalid archive data: %j', change => {
    expect(eventArchiveSchema.safeParse({ ...event, ...change }).success).toBe(false);
  });
});

describe('sources', () => {
  const source = { id: 'textbook-7-1', title: '中国历史', kind: 'textbook' };
  it('accepts bibliographic metadata with optional secure URL', () => {
    expect(sourceSchema.parse(source).id).toBe('textbook-7-1');
    expect(sourceSchema.parse({ ...source, authors: ['编写组'], publisher: '人民教育出版社', edition: '2024', chapter: '第九课', url: 'https://example.com/history', accessedAt: '2026-11-10' }).url).toBe('https://example.com/history');
  });
  it.each(['http://example.com', 'javascript:alert(1)', 'https://', 'ftp://example.com'])('rejects unsafe source URL %s', url => {
    expect(sourceSchema.safeParse({ ...source, url, accessedAt: '2026-11-11' }).success).toBe(false);
  });
  it.each([{ title: '<b>来源</b>' }, { authors: ['<i>作者</i>'] }, { publisher: '</p>' }, { edition: '<b>版本</b>' }, { chapter: '<p>章节</p>' }, { extra: true }, { id: 'Bad_ID' }])('rejects malformed bibliography %j', change => {
    expect(sourceSchema.safeParse({ ...source, ...change }).success).toBe(false);
  });
});

// Literal labels independently protect sign and precision handling.
describe('history year formatting', () => {
  it.each([
    [-230, 'exact', '公元前 230 年'], [618, 'exact', '618 年'],
    [-1600, 'circa', '约公元前 1600 年'], [618, 'circa', '约 618 年'],
    [780, 'decade', '780 年代'], [-230, 'decade', '公元前 230 年代'],
    [701, 'century', '8 世纪'], [-701, 'century', '公元前 8 世纪'],
    [700, 'century', '7 世纪'], [-700, 'century', '公元前 7 世纪'],
    [-230, 'range', '公元前 230 年']
  ] as const)('formats %s with %s precision', (year, precision, expected) => {
    expect(formatHistoryYear(year, precision)).toBe(expected);
  });
  it.each([0, 1.5, Infinity, NaN])('rejects a nonhistorical year %s', year => {
    expect(() => formatHistoryYear(year, 'exact')).toThrow();
  });
});


const person = {
  id: 'qin-shihuang', name: '秦始皇', aliases: ['嬴政'], primaryEraId: 'qin-han',
  birthYear: -259, deathYear: -210, roleIds: ['emperor'], eventIds: ['qin-unification'], sourceIds: ['textbook-7-1']
};
const biography = {
  ...person, yearPrecision: 'exact', birthplaceId: 'handan', placeIds: ['xianyang'],
  summary: '秦朝建立者。', timeline: [{ year: -221, title: '称皇帝', description: '建立秦朝。' }],
  identities: [{ startYear: -221, endYear: -210, roleId: 'emperor', description: '秦皇帝' }],
  contributions: ['建立统一王朝'], relations: [{ personId: 'li-si', type: '君臣', description: '李斯任丞相。' }],
  evaluation: '统一制度影响深远。', legacy: '确立皇帝制度。', works: ['泰山刻石'],
  relics: ['秦始皇陵'], historiography: '统一历程以主流年表为准。'
};

describe('people', () => {
  it('requires one editorial era for a person crossing historical boundaries', () => {
    expect(personIndexSchema.parse(person).primaryEraId).toBe('qin-han');
    expect(personIndexSchema.safeParse({ ...person, primaryEraId: ['pre-qin', 'qin-han'] }).success).toBe(false);
    const { primaryEraId: _, ...withoutEra } = person;
    expect(personIndexSchema.safeParse(withoutEra).success).toBe(false);
  });
  it('accepts unknown birth and death dates without inventing year zero', () => {
    expect(personIndexSchema.parse({ ...person, birthYear: null, deathYear: null }).birthYear).toBeNull();
  });
  it.each([{ birthYear: -200 }, { deathYear: 0 }, { eventIds: [] }, { sourceIds: [] }, { roleIds: ['Bad_ID'] }, { aliases: ['<b>政</b>'] }, { name: '<i>皇帝</i>' }, { unknown: true }])('rejects invalid person index %j', change => {
    expect(personIndexSchema.safeParse({ ...person, ...change }).success).toBe(false);
  });
  it('accepts a biography with dated identities and referenced people', () => {
    expect(personArchiveSchema.parse(biography).timeline[0].year).toBe(-221);
  });
  it.each([
    { summary: '<b>概述</b>' }, { contributions: ['<script>x</script>'] }, { works: ['</p>'] }, { relics: ['<i>遗迹</i>'] },
    { evaluation: '<a>评价</a>' }, { legacy: '<div>影响</div>' }, { historiography: '<p>说明</p>' },
    { timeline: [{ year: -260, title: '出生前', description: '错误' }] },
    { identities: [{ startYear: -210, endYear: -221, roleId: 'emperor', description: '皇帝' }] },
    { identities: [{ startYear: -221, endYear: -210, roleId: 'emperor', description: '<b>皇帝</b>' }] },
    { relations: [{ personId: 'qin-shihuang', type: '君臣', description: '自己' }] },
    { relations: [{ personId: 'li-si', type: '<b>君臣</b>', description: '关系' }] },
    { relations: [{ personId: 'li-si', type: '君臣', description: '<p>关系</p>' }] }
  ])('rejects invalid biography %j', change => {
    expect(personArchiveSchema.safeParse({ ...biography, ...change }).success).toBe(false);
  });
});

describe('era, place, theme and relation records', () => {
  const era = { id: 'qin-han', name: '秦汉', startYear: -221, endYear: 220, color: '#d6a650', inscription: '大一统时代' };
  const place = { id: 'xianyang', name: '咸阳', modernName: '陕西咸阳', aliases: ['秦都'], historicalNames: [{ name: '咸阳', startYear: -350, endYear: -206 }], coordinates: [108.7, 34.3], eventIds: ['qin-unification'] };
  const theme = { id: 'unification', title: '统一与分裂', summary: '观察统一进程。', eventIds: ['qin-unification'], chapters: [{ title: '秦统一', description: '结束割据。', eventIds: ['qin-unification'] }], camera: { position: [0, 10, 30], target: [0, 0, 0] }, sourceIds: ['textbook-7-1'] };
  it('accepts eras, historical places and ordered thematic chapters', () => {
    expect(eraSchema.parse(era).startYear).toBe(-221);
    expect(placeIndexSchema.parse(place).coordinates).toEqual([108.7, 34.3]);
    expect(themeArchiveSchema.parse(theme).chapters[0].eventIds).toEqual(['qin-unification']);
  });
  it.each([{ endYear: -222 }, { inscription: '<b>时代</b>' }, { id: 'Bad' }])('rejects invalid eras %j', change => {
    expect(eraSchema.safeParse({ ...era, ...change }).success).toBe(false);
  });
  it.each([{ coordinates: [181, 34] }, { coordinates: [108, 91] }, { name: '<b>城</b>' }, { modernName: '</p>' }, { aliases: ['<i>都</i>'] }, { historicalNames: [{ name: '<p>古名</p>', startYear: -350, endYear: -206 }] }, { historicalNames: [{ name: '咸阳', startYear: -200, endYear: -350 }] }])('rejects invalid places %j', change => {
    expect(placeIndexSchema.safeParse({ ...place, ...change }).success).toBe(false);
  });
  it.each([{ summary: '<b>路线</b>' }, { chapters: [{ title: '秦', description: '<p>路线</p>', eventIds: ['qin-unification'] }] }, { eventIds: [] }, { camera: { position: [0, 1], target: [0, 0, 0] } }])('rejects invalid themes %j', change => {
    expect(themeArchiveSchema.safeParse({ ...theme, ...change }).success).toBe(false);
  });
  it.each(['cause', 'consequence', 'parallel', 'contrast', 'part-of'])('accepts the %s event relation', type => {
    expect(relationSchema.parse({ id: 'qin-result', fromId: 'qin-unification', toId: 'qin-empire', type }).type).toBe(type);
  });
  it('rejects unknown relation kinds and self-relations', () => {
    expect(relationSchema.safeParse({ id: 'qin-result', fromId: 'qin-unification', toId: 'qin-empire', type: 'related' }).success).toBe(false);
    expect(relationSchema.safeParse({ id: 'qin-result', fromId: 'qin-unification', toId: 'qin-unification', type: 'cause' }).success).toBe(false);
  });
});

describe('compact event index', () => {
  const { background: _, causes: _c, course: _course, results: _r, impacts: _i, historiography: _h, sourceRefs: _refs, ...metadata } = event;
  const compact = { ...metadata, sourceIds: oldSourceIds };
  it('requires complete compact metadata and the representative start year', () => {
    expect(eventIndexSchema.parse({ ...compact, year: -230 }).year).toBe(-230);
    expect(eventIndexSchema.safeParse({ ...compact, year: -221 }).success).toBe(false);
    const { eraId: _era, ...withoutEra } = compact;
    expect(eventIndexSchema.safeParse({ ...withoutEra, year: -230 }).success).toBe(false);
  });
  it('rejects full archive prose in compact records', () => {
    expect(eventIndexSchema.safeParse({ ...event, year: -230 }).success).toBe(false);
  });
});

it.each([
  { startYear: -260, endYear: -210, roleId: 'emperor', description: '出生前任职' },
  { startYear: -221, endYear: -200, roleId: 'emperor', description: '死后任职' }
])('rejects identity dates outside the known lifespan: %j', identity => {
  expect(personArchiveSchema.safeParse({ ...biography, identities: [identity] }).success).toBe(false);
});

const basic = {
  id: 'zhougong-regency', title: '周公摄政', aliases: ['周公辅成王'],
  startYear: -1042, endYear: -1035, yearPrecision: 'circa',
  editorialPeriodId: 'pre-qin', eraId: 'pre-qin', polityIds: ['western-zhou'],
  period: '西周初年', categories: ['politics', 'institution'], themeIds: [], influence: 4,
  summary: '周武王去世后，成王年幼，周公旦代行王政。面对管叔、蔡叔等联合武庚发动的叛乱，周公率军东征，随后营建洛邑、分封诸侯并整顿礼乐制度，帮助西周王朝稳定东方统治，也使摄政、宗法与礼制成为后世讨论早期国家治理的重要范例。',
  personIds: [], placeIds: [], parentId: null, childIds: [], relationIds: [],
  sourceRefs: [{ sourceId: 'bai-shouyi-general-history', locator: '第一卷，西周政治相关章节' }],
  color: '#bc9365', layout: { lane: 'politics', offset: [0, 0] }, detailLevel: 'basic'
};
const coreDetails = {
  id: basic.id, background: '武王去世后成王年幼。', causes: ['王位传承与东方叛乱。'],
  course: [{ year: -1040, title: '东征', description: '平定东方叛乱。' }],
  results: ['稳定王朝。'], impacts: [{ dimension: 'institution', text: '整顿礼制。' }], historiography: '年代采用约数。'
};

describe('basic/core content contracts', () => {
  it('accepts basic catalog metadata with located sources and either declared depth', () => {
    expect(basicEventRecordSchema.parse(basic).detailLevel).toBe('basic');
    expect(basicEventRecordSchema.parse({ ...basic, detailLevel: 'core' }).detailLevel).toBe('core');
    expect(historyEventArchiveSchema.parse(basic).detailLevel).toBe('basic');
  });
  it.each([
    { sourceRefs: [] }, { sourceRefs: [{ sourceId: 'book' }] },
    { detailLevel: 'extended' }, { editorialPeriodId: undefined }, { sourceIds: ['book'] },
    { startYear: 0 }, { startYear: -1034 }, { endYear: -1035.5 },
    { parentId: basic.id }, { childIds: [basic.id] }, { background: '目录不拥有正文' },
    { title: '<b>周公</b>' }, { aliases: ['<!--注释-->'] },
    { summary: '<p>' + '史'.repeat(100) + '</p>' }
  ])('rejects malformed catalog metadata: %j', change => {
    expect(basicEventRecordSchema.safeParse({ ...basic, ...change }).success).toBe(false);
  });
  it.each([79, 151])('rejects summaries with %i Han characters despite punctuation and Latin padding', count => {
    expect(basicEventRecordSchema.safeParse({ ...basic, summary: '史'.repeat(count) + '。 abc'.repeat(20) }).success).toBe(false);
  });
  it.each([80, 150])('accepts the inclusive %i Han character summary boundary', count => {
    expect(basicEventRecordSchema.safeParse({ ...basic, summary: '史'.repeat(count) + '。abc' }).success).toBe(true);
  });
  it.each([
    { sourceId: 'book', locator: '' }, { sourceId: 'book', locator: '  ' },
    { sourceId: 'Bad_ID', locator: '卷一' }, { sourceId: 'book', locator: '<i>卷一</i>' },
    { sourceId: 'book', locator: '卷一', note: '<!--注释-->' },
    { sourceId: 'book', locator: '卷一', extra: true }
  ])('requires a safe concrete source locator: %j', reference => {
    expect(sourceReferenceSchema.safeParse(reference).success).toBe(false);
  });
  it('preserves located source notes', () => {
    expect(sourceReferenceSchema.parse({ sourceId: 'book', locator: '卷一', note: '年代有争议' }).note).toBe('年代有争议');
  });
  it('accepts complete core details and merges only on the core archive branch', () => {
    expect(coreEventDetailsSchema.parse(coreDetails).course[0].year).toBe(-1040);
    expect(historyEventArchiveSchema.parse({ ...basic, ...coreDetails, detailLevel: 'core' }).detailLevel).toBe('core');
    expect(historyEventArchiveSchema.safeParse({ ...basic, ...coreDetails }).success).toBe(false);
    expect(historyEventArchiveSchema.safeParse({ ...basic, detailLevel: 'core' }).success).toBe(false);
  });
  it.each([
    { causes: [] }, { course: [] }, { results: [] }, { impacts: [] }, { background: ' ' },
    { historiography: '<p>说明</p>' }, { title: '元数据不得重复' },
    { course: [{ year: 0, title: '错误', description: '无零年' }] }
  ])('rejects incomplete or unsafe core details: %j', change => {
    expect(coreEventDetailsSchema.safeParse({ ...coreDetails, ...change }).success).toBe(false);
  });
  it.each([-1043, -1034])('rejects a merged core course year %i outside the catalog range', courseYear => {
    expect(historyEventArchiveSchema.safeParse({ ...basic, ...coreDetails, detailLevel: 'core', course: [{ ...coreDetails.course[0], year: courseYear }] }).success).toBe(false);
  });
  it('validates editorial periods without requiring non-overlapping political chronology', () => {
    const period = { id: 'pre-qin', name: '先秦', startYear: -2070, endYear: -221, eventQuota: 170, coreQuota: 25 };
    expect(editorialPeriodSchema.parse(period).id).toBe('pre-qin');
    for (const change of [{ startYear: 0 }, { endYear: -2071 }, { coreQuota: 171 }, { eventQuota: 0 }, { coreQuota: -1 }, { name: '<b>先秦</b>' }]) {
      expect(editorialPeriodSchema.safeParse({ ...period, ...change }).success).toBe(false);
    }
  });
  it('keeps compact records free of locators and validates declared new metadata', () => {
    const { sourceRefs: _refs, ...metadata } = basic;
    const compact = { ...metadata, year: -1042, sourceIds: ['bai-shouyi-general-history'] };
    expect(eventIndexSchema.parse(compact).detailLevel).toBe('basic');
    for (const change of [{ detailLevel: 'unknown' }, { editorialPeriodId: undefined }, { summary: '太短' }, { sourceRefs: basic.sourceRefs }, { year: -1035 }]) {
      expect(eventIndexSchema.safeParse({ ...compact, ...change }).success).toBe(false);
    }
  });
});

it('rejects pre-catalog archives and indexes through canonical public schemas', () => {
  expect(eventArchiveSchema.safeParse(oldEvent).success).toBe(false);
  const { background, causes, course, results, impacts, historiography, ...oldCompact } = oldEvent;
  expect(eventIndexSchema.safeParse({ ...oldCompact, year: event.startYear }).success).toBe(false);
});

// Missing polity/date/alias validation admits invalid shared identities.
describe('shared polity registry contract', () => {
  const polity = { id: 'western-han', name: '西汉', aliases: ['前汉'], startYear: -202, endYear: 8 };
  it('accepts BCE to CE lifetimes and trims aliases', () => {
    expect(politySchema.parse({ ...polity, aliases: [' 前汉 '] })).toMatchObject({ aliases: ['前汉'], startYear: -202, endYear: 8 });
    expect(politySchema.parse({ ...polity, aliases: [] }).aliases).toEqual([]);
  });
  it.each([{ id: 'Han_ID' }, { name: ' ' }, { aliases: [' '] }, { aliases: ['<b>汉</b>'] }, { aliases: '前汉' }, { aliases: undefined }, { startYear: 0 }, { endYear: 0 }, { startYear: 1.5 }, { endYear: -203 }, { extra: true }])('rejects malformed polity %j', change => {
    expect(politySchema.safeParse({ ...polity, ...change }).success).toBe(false);
  });
});

it.each(['website', 'institution', 'article'])('requires an access date for web source kind %s', kind => {
  const web = { id: 'museum', title: '馆藏资料', kind, url: 'https://example.com/history', accessedAt: '2026-11-11' };
  expect(sourceSchema.safeParse(web).success).toBe(true);
  expect(sourceSchema.safeParse({ ...web, accessedAt: undefined }).success).toBe(false);
  if (kind === 'website') expect(sourceSchema.safeParse({ ...web, url: undefined }).success).toBe(false);
});
it('requires an access date even when a book provides an online URL', () => {
  expect(sourceSchema.safeParse({ id: 'book', title: '史书', kind: 'book', url: 'https://example.com' }).success).toBe(false);
});
it('rejects reversed longitude/latitude coordinates for Chinese locations', () => {
  expect(placeIndexSchema.safeParse({ id: 'changan', name: '长安', modernName: '西安', aliases: [], historicalNames: [], coordinates: [34.3, 108.9], eventIds: [] }).success).toBe(false);
});

it('preserves print article bibliography without requiring a web URL', () => {
  expect(sourceSchema.safeParse({ id: 'print-article', title: '纸本论文', kind: 'article', authors: ['作者'], publisher: '期刊', edition: '第1期', chapter: '第1—10页' }).success).toBe(true);
});
