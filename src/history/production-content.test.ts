import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateContentQuality } from '../../scripts/history-content/quality';
import { basicEventRecordSchema, categoryIds, coreEventDetailsSchema, editorialPeriodSchema, historyEventArchiveSchema, personArchiveSchema, placeIndexSchema, politySchema, relationSchema, sourceSchema, themeArchiveSchema } from './content/schema';

const root = resolve(process.cwd(), 'history-content');
const hanCount = (text: string) => text.match(/\p{Script=Han}/gu)?.length ?? 0;

async function readRegistry<T>(path: string, parse: (value: unknown) => T): Promise<T> {
  return parse(JSON.parse(await readFile(resolve(root, path), 'utf8')));
}
async function allEventRecords() {
  return (await Promise.all((await readdir(resolve(root, 'catalog/events'))).map(file => readRegistry(`catalog/events/${file}`, value => basicEventRecordSchema.array().parse(value))))).flat();
}

describe('production content', () => {
  it('enforces the final release gates against the real catalog and generated archives', async () => {
    const targets = {
      'pre-qin': [170, 25], 'qin-han': [130, 22], 'wei-jin': [120, 18],
      'sui-tang-five-dynasties': [160, 30], 'song-liao-jin-xia': [170, 30],
      yuan: [70, 12], ming: [130, 22], qing: [130, 21], modern: [120, 20]
    };
    const rows = (await Promise.all(Object.keys(targets).map(period => readRegistry(`catalog/events/${period}.json`, value => basicEventRecordSchema.array().parse(value))))).flat();
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const periods = await readRegistry('manifest/editorial-periods.json', value => editorialPeriodSchema.array().parse(value));
    const quality = validateContentQuality({ events: rows, sources, periods }, { enforceFinalTargets: true });
    expect(quality).toMatchObject({ eventCount: 1200, basicEventCount: 1000, coreEventCount: 200, warnings: [], suspectedDuplicates: [], finalTargetsEnforced: true });
    expect(quality.periodCounts).toEqual(Object.fromEntries(Object.entries(targets).map(([id, quota]) => [id, quota[0]])));
    expect(quality.corePeriodCounts).toEqual(Object.fromEntries(Object.entries(targets).map(([id, quota]) => [id, quota[1]])));
    expect(Object.keys(quality.categoryCounts).sort()).toEqual([...categoryIds].sort());
    for (const count of Object.values(quality.categoryCounts)) expect(count).toBeGreaterThan(0);
    expect(rows.filter(row => row.categories.some(category => category === 'politics' || category === 'war')).length).toBeLessThanOrEqual(720);
    expect(quality.influenceCounts['5']).toBeLessThanOrEqual(180);

    const generatedRoot = resolve(process.cwd(), 'public/history-content/generated');
    const manifest = JSON.parse(await readFile(resolve(generatedRoot, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ eventCount: 1200, basicEventCount: 1000, coreEventCount: 200, structuredEventCount: 1200, legacyEventCount: 0, errorCount: 0, periodCounts: quality.periodCounts });
    const bundles = await Promise.all(Object.values(manifest.eraBundles as Record<string, string>).map(async path => JSON.parse(await readFile(resolve(generatedRoot, path), 'utf8'))));
    const archives = historyEventArchiveSchema.array().parse(bundles.flatMap(bundle => bundle.events));
    const byId = new Map(archives.map(event => [event.id, event]));
    expect(archives).toHaveLength(1200);
    expect([...byId.keys()].sort()).toEqual(rows.map(event => event.id).sort());
    for (const row of rows) {
      expect(byId.get(row.id), row.id).toMatchObject(row);
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(new Set(row.sourceRefs.map(ref => ref.sourceId)).size, row.id).toBeGreaterThanOrEqual(row.detailLevel === 'core' ? 2 : 1);
      for (const ref of row.sourceRefs) {
        expect(sources.some(source => source.id === ref.sourceId), row.id).toBe(true);
        expect(ref.locator.trim().length, row.id).toBeGreaterThan(3);
      }
    }
    const index = JSON.parse(await readFile(resolve(generatedRoot, 'indexes/events.compact.json'), 'utf8')) as { id: string }[];
    expect(index.map(event => event.id).sort()).toEqual([...byId.keys()].sort());
    const people = personArchiveSchema.array().parse(bundles.flatMap(bundle => bundle.people));
    const byPerson = new Map(people.map(person => [person.id, person]));
    const places = await readRegistry('manifest/places.json', value => placeIndexSchema.array().parse(value));
    const byPlace = new Map(places.map(place => [place.id, place]));
    const themes = await readRegistry('manifest/themes.json', value => themeArchiveSchema.array().parse(value));
    const byTheme = new Map(themes.map(theme => [theme.id, theme]));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byRelation = new Map(relations.map(relation => [relation.id, relation]));
    for (const event of archives) {
      for (const id of event.personIds) expect(byPerson.get(id)?.eventIds, event.id).toContain(event.id);
      for (const id of event.placeIds) expect(byPlace.get(id)?.eventIds, event.id).toContain(event.id);
      for (const id of event.themeIds) expect(byTheme.get(id)?.eventIds, event.id).toContain(event.id);
      for (const id of event.relationIds) expect([byRelation.get(id)?.fromId, byRelation.get(id)?.toId], event.id).toContain(event.id);
      if (event.parentId) expect(byId.get(event.parentId)?.childIds, event.id).toContain(event.id);
      for (const id of event.childIds) expect(byId.get(id)?.parentId, event.id).toBe(event.id);
    }
    for (const record of [...people, ...places, ...themes]) for (const id of record.eventIds) {
      const event = byId.get(id);
      expect(event, id).toBeDefined();
      expect([...event!.personIds, ...event!.placeIds, ...event!.themeIds], id).toContain(record.id);
    }
    for (const theme of themes) for (const chapter of theme.chapters) for (const id of chapter.eventIds) expect(theme.eventIds, theme.id).toContain(id);
    for (const relation of relations) for (const id of [relation.fromId, relation.toId]) expect(byId.get(id)?.relationIds, relation.id).toContain(relation.id);
    const baseline = JSON.parse(await readFile(resolve(process.cwd(), 'scripts/fixtures/history-core-migration.json'), 'utf8')) as { events: { id: string; personIds: string[] }[]; people: { id: string }[] };
    expect(baseline.events).toHaveLength(30);
    for (const event of baseline.events) expect(byId.get(event.id), event.id).toMatchObject({ detailLevel: 'core', personIds: event.personIds });
    for (const person of baseline.people) expect(byPerson.has(person.id), person.id).toBe(true);

    const checked = await promisify(execFile)(process.execPath, ['--import', resolve('node_modules/tsx/dist/loader.mjs'), resolve('scripts/history-content.ts'), 'check']);
    expect(JSON.parse(checked.stdout)).toMatchObject({ eventCount: 1200, errorCount: 0, contentQuality: { finalTargetsEnforced: true, warnings: [], suspectedDuplicates: [] } });
  });

  it('keeps the Ming fiscal process consistent with dated parentage and distinguishes earlier groundwork', async () => {
    const rows = (await Promise.all((await readdir(resolve(root, 'catalog/events'))).map(file => readRegistry(`catalog/events/${file}`, value => basicEventRecordSchema.array().parse(value))))).flat();
    const byId = new Map(rows.map(row => [row.id, row]));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const relation = relations.find(relation => relation.id === 'single-whip-to-zhang-reform');
    expect(relation).toMatchObject({ fromId: 'single-whip-national-push', toId: 'zhang-juzheng', type: 'part-of' });
    const child = byId.get('single-whip-national-push')!;
    const parent = byId.get('zhang-juzheng')!;
    expect(child).toMatchObject({ startYear: 1581, endYear: 1581, parentId: 'zhang-juzheng' });
    expect(parent.childIds).toContain(child.id);
    expect(child.startYear).toBeGreaterThanOrEqual(parent.startYear);
    expect(child.endYear).toBeLessThanOrEqual(parent.endYear);
    expect(relations.find(relation => relation.id === 'kaocheng-to-zhang-reform')).toMatchObject({ fromId: 'zhang-juzheng-kaocheng', toId: 'zhang-juzheng', type: 'cause' });
    expect(byId.get('zhang-juzheng')).toMatchObject({ startYear: 1581, endYear: 1582, childIds: ['single-whip-national-push'] });
    expect(byId.get('zhang-juzheng-kaocheng')?.parentId).toBeNull();
    for (const expected of [
      { id: 'two-tax-to-single-whip', fromId: 'two-tax', toId: 'single-whip-national-push', type: 'contrast' },
      { id: 'single-whip-to-tanding', fromId: 'single-whip-national-push', toId: 'tanding-rumu', type: 'contrast' }
    ]) {
      expect(relations.find(relation => relation.id === expected.id)).toEqual(expected);
      expect(byId.get(expected.fromId)!.endYear).toBeLessThan(byId.get(expected.toId)!.startYear);
      for (const id of [expected.fromId, expected.toId]) expect(byId.get(id)!.relationIds).toContain(expected.id);
    }
  });

  it('counts the 220 transition only in Wei-Jin and replaces the Han duplicate with the 213 Wei dukedom', async () => {
    const rows = await allEventRecords();
    expect(rows.find(row => row.id === 'cao-pi-han-abdication')).toBeUndefined();
    expect(rows.find(row => row.id === 'cao-cao-duke-wei')).toMatchObject({
      title: '曹操封魏公加九锡', startYear: 213, endYear: 213, detailLevel: 'basic', editorialPeriodId: 'qin-han'
    });
    expect(rows.filter(row => row.startYear === 220 && /受禅|禅位|汉朝终结/.test(row.title)).map(row => row.id)).toEqual(['cao-pi-wei-founded']);
    expect(rows.find(row => row.id === 'cao-cao-duke-wei')!.sourceRefs[0].locator).toContain('建安十八年五月');
  });

  it('separates the 1368 court withdrawal from the later Dadu occupation with sourced stages and an explicit handoff', async () => {
    const rows = await allEventRecords();
    const withdrawal = rows.find(row => row.id === 'yuan-dadu-fall')!;
    const occupation = rows.find(row => row.id === 'ming-capture-dadu')!;
    expect(withdrawal).toMatchObject({ title: '元顺帝夜出大都北撤', startYear: 1368, endYear: 1368, detailLevel: 'core', editorialPeriodId: 'yuan' });
    expect(withdrawal.summary).toMatch(/闰七月.*健德门/);
    expect(withdrawal.summary).not.toMatch(/徐达|入城|中原.{0,4}统治.{0,4}(结束|终结)/);
    const markdown = matter(await readFile(resolve(root, 'content/yuan/events/yuan-dadu-fall.md'), 'utf8'));
    const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
    expect(detail.course).toHaveLength(1);
    expect(detail.course[0].description).toMatch(/健德门/);
    expect([detail.background, ...detail.results, ...detail.impacts.map(impact => impact.text)].join('')).not.toMatch(/徐达|明军入城/);
    expect(occupation).toMatchObject({ startYear: 1368, endYear: 1368, detailLevel: 'basic', editorialPeriodId: 'ming' });
    expect(occupation.summary).toMatch(/八月庚午.*徐达/);
    expect(occupation.summary).toContain('封存府库图籍');
    expect(occupation.summary).not.toMatch(/北走|北撤|北逃/);
    expect(withdrawal.sourceRefs.some(ref => ref.locator.includes('闰七月丙寅'))).toBe(true);
    expect(occupation.sourceRefs[0].locator).toContain('八月庚午');
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    expect(relations.find(relation => relation.id === 'yuan-withdrawal-to-ming-occupation')).toEqual({
      id: 'yuan-withdrawal-to-ming-occupation', fromId: 'yuan-dadu-fall', toId: 'ming-capture-dadu', type: 'consequence'
    });
    for (const event of [withdrawal, occupation]) expect(event.relationIds).toContain('yuan-withdrawal-to-ming-occupation');
  });

  it('counts Beijing collapse once in 1644 and gives the new Ming core its distinct Xian founding boundary', async () => {
    const rows = await allEventRecords();
    expect(rows.find(row => row.id === 'beijing-fall-1644')).toBeUndefined();
    expect(rows.filter(row => row.startYear === 1644 && /攻占北京|明朝灭亡/.test(row.title)).map(row => row.id)).toEqual(['ming-fall']);
    const founding = rows.find(row => row.id === 'dashun-founded-xian')!;
    expect(founding).toMatchObject({ title: '李自成在西安建大顺', startYear: 1644, endYear: 1644, detailLevel: 'core', editorialPeriodId: 'ming', placeIds: ['xian'], parentId: 'late-ming-rebellions' });
    expect(founding.summary).toMatch(/正月.*西安.*大顺.*永昌/);
    expect(founding.summary).not.toMatch(/攻入北京|煤山|自缢|中央政权覆亡/);
    expect(founding.sourceRefs.map(ref => ref.sourceId)).toEqual(['mingshi-zhonghua-1974', 'mingji-beilue']);
    const markdown = matter(await readFile(resolve(root, 'content/ming/events/dashun-founded-xian.md'), 'utf8'));
    const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
    expect(detail.course.every(stage => !/京师陷落|攻入北京|自缢/.test(JSON.stringify(stage)))).toBe(true);
    expect(detail.historiography).toMatch(/正月初一.*初三/);
    expect(rows.find(row => row.id === 'late-ming-rebellions')!.childIds).toContain(founding.id);
  });

  it('dates the Song paper-money allocation to the actual Jiaxi second-year Huhui entry', async () => {
    const rows = await readRegistry('catalog/events/song-liao-jin-xia.json', value => basicEventRecordSchema.array().parse(value));
    const event = rows.find(row => row.id === 'song-sichuan-paper-money')!;
    expect(event).toMatchObject({ title: '南宋拨付第七界湖会', startYear: 1238, endYear: 1238, yearPrecision: 'exact', detailLevel: 'basic' });
    expect(event.summary).toContain('九百万');
    expect(event.summary).toContain('督视参政行府');
    expect(event.summary).not.toMatch(/四川|钱引|物价上涨|流通扩大/);
    expect(event.sourceRefs).toEqual([{
      sourceId: 'songshi-zhonghua-1977',
      locator: '《宋史》卷一百八十一《食货志·会子》嘉定五年刘光祖以新会换旧楮、十四年及十七年造会至嘉熙二年“撥第七界湖會九百萬付督視參政行府”段',
      note: expect.stringContaining('不是四川钱引')
    }]);
  });

  it('Song and Ming newly authored summaries do not recycle long padding sentences', async () => {
    const baseline = JSON.parse(await readFile(resolve(process.cwd(), 'scripts/fixtures/history-core-migration.json'), 'utf8')) as { events: { id: string }[] };
    const inherited = new Set(baseline.events.map(event => event.id));
    const sentenceOwners = new Map<string, Set<string>>();
    for (const period of ['song-liao-jin-xia', 'ming']) {
      const rows = await readRegistry(`catalog/events/${period}.json`, value => basicEventRecordSchema.array().parse(value));
      for (const row of rows.filter(event => !inherited.has(event.id))) {
        for (const sentence of row.summary.split(/[。！？；]/u)) {
          const normalized = sentence.replace(/[\p{P}\s]/gu, '');
          if (hanCount(normalized) < 20) continue;
          const owners = sentenceOwners.get(normalized) ?? new Set<string>();
          owners.add(row.id);
          sentenceOwners.set(normalized, owners);
        }
      }
    }
    expect([...sentenceOwners].filter(([, owners]) => owners.size > 1).map(([sentence, owners]) => ({ sentence, events: [...owners] }))).toEqual([]);
  });

  it('Modern reviewed education, science and translation events cite retrieved locations', async () => {
    const rows = await readRegistry('catalog/events/modern.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const expected = [
      ['guimao-school-system', 'encyclopedia-china-history', '废科举、办学堂、奖游学'],
      ['science-society', 'nju-science-society-history', '中国第一个综合性自然科学民间社团'],
      ['communist-manifesto-chinese', 'fudan-chen-wangdao-shanghai', '进行正式出版前的校阅'],
      ['chinese-left-writers', 'encyclopedia-china-history', '“左联”条'],
    ];
    for (const [eventId, sourceId, section] of expected) {
      const row = rows.find(event => event.id === eventId)!;
      expect(row.sourceRefs.some(ref => ref.sourceId === sourceId && ref.locator.includes(section)), eventId).toBe(true);
      expect(sources.some(source => source.id === sourceId), sourceId).toBe(true);
    }
    expect(rows.find(event => event.id === 'science-society')?.sourceRefs).not.toContainEqual(expect.objectContaining({ sourceId: 'encyclopedia-china-history' }));
    expect(rows.find(event => event.id === 'communist-manifesto-chinese')?.sourceRefs).not.toContainEqual(expect.objectContaining({ sourceId: 'encyclopedia-china-history' }));
  });

  it('Modern has 120 sourced events and 20 core archives through 1949 with broad coverage', async () => {
    const rows = await readRegistry('catalog/events/modern.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const places = await readRegistry('manifest/places.json', value => placeIndexSchema.array().parse(value));
    const polities = await readRegistry('manifest/polities.json', value => politySchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byId = new Map(rows.map(row => [row.id, row]));
    const filenames = await readdir(resolve(root, 'content/modern/events'));
    expect(rows).toHaveLength(120);
    expect(rows.filter(row => row.detailLevel === 'core')).toHaveLength(20);
    expect(filenames.sort()).toEqual(rows.filter(row => row.detailLevel === 'core').map(row => `${row.id}.md`).sort());
    expect(new Set(rows.map(row => row.title)).size).toBe(120);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    for (const row of rows) {
      expect(row.editorialPeriodId, row.id).toBe('modern');
      expect(row.eraId, row.id).toBe('modern');
      expect(row.startYear, row.id).toBeGreaterThanOrEqual(1840);
      expect(row.endYear, row.id).toBeLessThanOrEqual(1949);
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(row.layout.lane, row.id).toBe(row.categories[0]);
      expect(row.polityIds.length, row.id).toBeGreaterThanOrEqual(1);
      expect(new Set(row.sourceRefs.map(ref => ref.sourceId)).size, row.id).toBeGreaterThanOrEqual(row.detailLevel === 'core' ? 2 : 1);
      for (const ref of row.sourceRefs) {
        expect(sources.some(source => source.id === ref.sourceId), `${row.id}: source`).toBe(true);
        expect(ref.locator, `${row.id}: locator`).toMatch(/《[^》]+》|“[^”]+”|\d{4}年条/u);
        expect(ref.locator, `${row.id}: vague locator`).not.toMatch(/相关记载|专题$|诸条$/u);
      }
      for (const id of row.placeIds) expect(places.find(place => place.id === id)?.eventIds, `${row.id}: place ${id}`).toContain(row.id);
      for (const id of row.polityIds) {
        const polity = polities.find(candidate => candidate.id === id);
        expect(polity, `${row.id}: polity ${id}`).toBeDefined();
        expect(row.startYear <= polity!.endYear && row.endYear >= polity!.startYear, row.id).toBe(true);
      }
      for (const id of row.personIds) {
        const markdown = matter(await readFile(resolve(root, 'content/modern/people', `${id}.md`), 'utf8'));
        expect(markdown.data.eventIds, `${row.id}: person backlink ${id}`).toContain(row.id);
      }
      for (const id of row.relationIds) {
        const relation = relations.find(candidate => candidate.id === id);
        expect(relation, `${row.id}: relation ${id}`).toBeDefined();
        expect([relation!.fromId, relation!.toId], row.id).toContain(row.id);
        expect(byId.get(relation!.fromId)?.relationIds).toContain(id);
        expect(byId.get(relation!.toId)?.relationIds).toContain(id);
      }
      if (row.parentId) expect(byId.get(row.parentId)?.childIds, row.id).toContain(row.id);
      for (const id of row.childIds) expect(byId.get(id)?.parentId, row.id).toBe(row.id);
    }
    for (const id of ['nanjing-treaty', 'second-opium-war', 'jiangnan-arsenal', 'late-qing-new-policies', 'imperial-exams-abolished', 'provisional-constitution', 'new-culture', 'may-thirtieth', 'pku-women-admission', 'science-society', 'lugouqiao', 'liaoshen-campaign', 'prc-founded']) expect(byId.has(id), id).toBe(true);
    const inherited = new Set(['opium-war', 'taiping', 'self-strengthening', 'sino-japanese-war', 'hundred-days', 'boxer', 'xinhai', 'may-fourth', 'northern-expedition', 'victory-1945', 'prc-founded']);
    for (const row of rows.filter(row => row.detailLevel === 'core' && !inherited.has(row.id))) {
      const markdown = matter(await readFile(resolve(root, 'content/modern/events', `${row.id}.md`), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      expect(hanCount(detail.background), row.id).toBeGreaterThanOrEqual(140);
      expect(detail.background.includes(row.summary), row.id).toBe(false);
      if (row.startYear < row.endYear) expect(detail.course.length, row.id).toBeGreaterThanOrEqual(2);
      expect(detail.results[0], row.id).not.toBe(detail.impacts[0].text);
      expect(row.personIds.length, row.id).toBeGreaterThanOrEqual(1);
      expect(row.relationIds.length + row.childIds.length + Number(Boolean(row.parentId)), row.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('Modern new summaries and core narratives do not recycle long sentences', async () => {
    const rows = await readRegistry('catalog/events/modern.json', value => basicEventRecordSchema.array().parse(value));
    const inherited = new Set(['opium-war', 'taiping', 'self-strengthening', 'sino-japanese-war', 'hundred-days', 'boxer', 'xinhai', 'may-fourth', 'northern-expedition', 'victory-1945', 'prc-founded']);
    const owners = new Map<string, Set<string>>();
    for (const row of rows.filter(row => !inherited.has(row.id))) {
      const fields: Record<string, string> = { summary: row.summary };
      if (row.detailLevel === 'core') {
        const markdown = matter(await readFile(resolve(root, 'content/modern/events', `${row.id}.md`), 'utf8'));
        const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
        Object.assign(fields, { background: detail.background, causes: detail.causes.join('。'), course: detail.course.map(stage => stage.description).join('。'), results: detail.results.join('。'), impacts: detail.impacts.map(impact => impact.text).join('。'), historiography: detail.historiography });
      }
      for (const [field, text] of Object.entries(fields)) for (const sentence of text.split(/[。！？；\n]/u)) {
        const normalized = sentence.replace(/[\s，、：“”‘’]/gu, '');
        if (hanCount(normalized) < 24) continue;
        const locations = owners.get(normalized) ?? new Set<string>();
        locations.add(`${row.id}:${field}`);
        owners.set(normalized, locations);
      }
    }
    expect([...owners].filter(([, locations]) => locations.size > 1).map(([sentence, locations]) => ({ sentence, fields: [...locations] }))).toEqual([]);
  });

  it('Qing summaries do not reuse long sentences across unrelated events', async () => {
    const rows = await readRegistry('catalog/events/qing.json', value => basicEventRecordSchema.array().parse(value));
    const sentenceOwners = new Map<string, Set<string>>();
    for (const row of rows) {
      for (const sentence of row.summary.split(/[。！？；]/u)) {
        const normalized = sentence.replace(/[\s，、：“”‘’]/gu, '');
        if (hanCount(normalized) < 24) continue;
        const owners = sentenceOwners.get(normalized) ?? new Set<string>();
        owners.add(row.id);
        sentenceOwners.set(normalized, owners);
      }
    }
    expect([...sentenceOwners].filter(([, owners]) => owners.size > 1).map(([sentence, owners]) => ({ sentence, events: [...owners] }))).toEqual([]);
  });

  it('Qing core archives explain events without recycling sentences between fields or archives', async () => {
    const filenames = (await readdir(resolve(root, 'content/qing/events'))).filter(filename => !['ming-fall.md', 'kangqian.md'].includes(filename));
    const sentenceOwners = new Map<string, Set<string>>();
    for (const filename of filenames) {
      const markdown = matter(await readFile(resolve(root, 'content/qing/events', filename), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const fields = {
        causes: detail.causes.join('。'),
        course: detail.course.map(stage => stage.description).join('。'),
        results: detail.results.join('。'),
        impacts: detail.impacts.map(impact => impact.text).join('。'),
        historiography: detail.historiography,
        background: detail.background,
      };
      for (const [field, text] of Object.entries(fields)) {
        for (const sentence of text.split(/[。！？；\n]/u)) {
          const normalized = sentence.replace(/[\s，、：“”‘’]/gu, '');
          if (hanCount(normalized) < 24) continue;
          const owners = sentenceOwners.get(normalized) ?? new Set<string>();
          owners.add(`${detail.id}:${field}`);
          sentenceOwners.set(normalized, owners);
        }
      }
    }
    expect([...sentenceOwners].filter(([, owners]) => owners.size > 1).map(([sentence, owners]) => ({ sentence, fields: [...owners] }))).toEqual([]);
  });

  it('Qing has 130 sourced events and 21 connected core archives through 1839', async () => {
    const allEventById = new Map((await allEventRecords()).map(event => [event.id, event]));
    const rows = await readRegistry('catalog/events/qing.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const places = await readRegistry('manifest/places.json', value => placeIndexSchema.array().parse(value));
    const polities = await readRegistry('manifest/polities.json', value => politySchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byId = new Map(rows.map(row => [row.id, row]));
    const sourceIds = new Set(sources.map(source => source.id));
    const byPlace = new Map(places.map(place => [place.id, place]));
    const byPolity = new Map(polities.map(polity => [polity.id, polity]));
    const byRelation = new Map(relations.map(relation => [relation.id, relation]));
    const people = (await Promise.all((await readdir(resolve(root, 'content'))).map(async period => {
      const directory = resolve(root, 'content', period, 'people');
      const filenames = await readdir(directory).catch(() => []);
      return Promise.all(filenames.map(async filename => {
        const markdown = matter(await readFile(resolve(directory, filename), 'utf8'));
        expect(filename).toBe(`${markdown.data.id}.md`);
        return personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
      }));
    }))).flat();
    const byPerson = new Map(people.map(person => [person.id, person]));

    expect(rows).toHaveLength(130);
    expect(rows.filter(row => row.detailLevel === 'core')).toHaveLength(21);
    expect(new Set(rows.map(row => row.title)).size).toBe(130);
    expect(new Set(rows.map(row => row.summary)).size).toBe(130);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    for (const row of rows) {
      expect(row.editorialPeriodId).toBe('qing');
      expect(row.eraId).toBe('qing');
      expect(row.startYear, row.id).toBeGreaterThanOrEqual(1644);
      expect(row.startYear, `${row.id}: events beginning in 1840 belong to modern`).toBeLessThan(1840);
      expect(row.endYear, row.id).toBeLessThan(1840);
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(row.layout.lane).toBe(row.categories[0]);
      expect(row.polityIds.length, `${row.id}: at least one real state actor`).toBeGreaterThanOrEqual(1);
      expect(row.sourceRefs.length, row.id).toBeGreaterThanOrEqual(row.detailLevel === 'core' ? 2 : 1);
      for (const ref of row.sourceRefs) {
        expect(sourceIds.has(ref.sourceId), `${row.id}: source`).toBe(true);
        expect(ref.locator, `${row.id}: locator`).toMatch(/卷[一二三四五六七八九十百零〇\d]+|《[^》]+》|“[^”]+”/);
        expect(ref.locator, `${row.id}: vague locator`).not.toMatch(/相关记载|专题$|年至.*诸条|至.*诸条/);
      }
      for (const id of row.placeIds) {
        expect(byPlace.has(id), `${row.id}: place ${id}`).toBe(true);
        expect(byPlace.get(id)?.eventIds, `${row.id}: reverse place ${id}`).toContain(row.id);
      }
      for (const id of row.polityIds) {
        const polity = byPolity.get(id);
        expect(polity, `${row.id}: polity ${id}`).toBeDefined();
        expect(row.startYear <= polity!.endYear && row.endYear >= polity!.startYear, `${row.id}: polity chronology ${id}`).toBe(true);
      }
      for (const id of row.personIds) expect(byPerson.get(id)?.eventIds, `${row.id}: person ${id}`).toContain(row.id);
      for (const id of row.relationIds) {
        const relation = byRelation.get(id);
        expect(relation, `${row.id}: relation ${id}`).toBeDefined();
        expect([relation!.fromId, relation!.toId]).toContain(row.id);
        expect(allEventById.get(relation!.fromId)?.relationIds).toContain(id);
        expect(allEventById.get(relation!.toId)?.relationIds).toContain(id);
        if (relation?.type === 'part-of') {
          expect(byId.get(relation.fromId)?.parentId, `${relation.id}: child parent`).toBe(relation.toId);
          expect(byId.get(relation.toId)?.childIds, `${relation.id}: parent children`).toContain(relation.fromId);
        }
      }
      if (row.detailLevel === 'core') {
        expect(new Set(row.sourceRefs.map(ref => ref.sourceId)).size, row.id).toBeGreaterThanOrEqual(2);
        expect(row.personIds.length, row.id).toBeGreaterThanOrEqual(1);
        if (!['ming-fall', 'kangqian'].includes(row.id)) expect(row.relationIds.length + row.childIds.length + Number(Boolean(row.parentId)), row.id).toBeGreaterThanOrEqual(1);
      }
    }
    for (const place of places) for (const id of place.eventIds.filter(id => byId.has(id))) expect(byId.get(id)?.placeIds).toContain(place.id);
    for (const person of people) for (const id of person.eventIds.filter(id => byId.has(id))) expect(byId.get(id)?.personIds).toContain(person.id);
    expect(rows.filter(row => row.influence === 5).length).toBeLessThanOrEqual(15);
    expect(rows.filter(row => row.categories.some(category => category === 'politics' || category === 'war')).length).toBeLessThanOrEqual(78);
    for (const category of ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society'])
      expect(rows.some(row => row.categories.includes(category as typeof row.categories[number]))).toBe(true);

    const requiredCoreIds = ['ming-fall', 'qing-entry-beijing-1644', 'queue-order-1645', 'southern-ming-resistance', 'three-feudatories-revolt', 'kangqian', 'taiwan-zheng-surrender', 'nerchinsk-treaty', 'imperial-atlas-survey', 'qing-dzungar-war', 'qing-tibet-expedition', 'yongzheng-fiscal-reforms', 'kiakhta-treaty', 'opium-ban-1729', 'jinchuan-wars', 'canton-system-1757', 'siku-quanshu', 'dream-red-chamber', 'macartney-embassy', 'white-lotus-rebellion', 'lin-zexu-canton-1839'];
    for (const id of requiredCoreIds) expect(byId.get(id)?.detailLevel, id).toBe('core');
    const eventDatesBySource: Record<string, number> = {
      'huang-juezi-memorial': 1838,
      'tibet-twenty-nine-articles': 1793,
      'jahangir-captured': 1828,
      'grain-sea-transport-trial': 1826,
      'east-india-company-coast-survey': 1832,
    };
    for (const [rowId, expectedYear] of Object.entries(eventDatesBySource)) {
      expect(byId.get(rowId)?.startYear, `${rowId}: source-dated year`).toBe(expectedYear);
      expect(byId.get(rowId)?.endYear, `${rowId}: source-dated year`).toBe(expectedYear);
    }
    expect(byId.get('ming-fall')?.polityIds).toEqual(expect.arrayContaining(['ming', 'dashun', 'qing']));
    expect(byId.get('zheng-taiwan-expedition')?.polityIds).toEqual(['tungning', 'dutch-republic']);
    expect(byId.get('qing-entry-beijing-1644')?.placeIds).toContain('beijing');
    expect(byId.get('nerchinsk-treaty')?.polityIds).toEqual(expect.arrayContaining(['qing', 'tsardom-russia']));
    expect(byId.get('kiakhta-treaty')?.polityIds).toEqual(expect.arrayContaining(['qing', 'russian-empire']));
    expect(byId.get('macartney-embassy')?.polityIds).toEqual(expect.arrayContaining(['qing', 'great-britain']));
    expect(byId.get('canton-system-1757')?.placeIds).toContain('guangzhou');
    expect(byId.get('lin-zexu-canton-1839')).toMatchObject({ startYear: 1839, endYear: 1839, yearPrecision: 'exact' });
    expect(rows.some(row => row.startYear === 1840)).toBe(false);
    expect(rows.some(row => /鸦片战争/.test(row.title))).toBe(false);

    const filenames = (await readdir(resolve(root, 'content/qing/events'))).sort();
    expect(filenames).toEqual(rows.filter(row => row.detailLevel === 'core').map(row => `${row.id}.md`).sort());
    for (const filename of filenames) {
      const markdown = matter(await readFile(resolve(root, 'content/qing/events', filename), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const row = byId.get(detail.id)!;
      expect(filename).toBe(`${detail.id}.md`);
      for (const stage of detail.course) {
        expect(stage.year, detail.id).toBeGreaterThanOrEqual(row.startYear);
        expect(stage.year, detail.id).toBeLessThanOrEqual(row.endYear);
      }
      if (!['ming-fall', 'kangqian'].includes(detail.id)) {
        expect(hanCount(detail.background), detail.id).toBeGreaterThanOrEqual(140);
        expect(detail.results[0], detail.id).not.toBe(detail.impacts[0].text);
      }
    }
    const coreRows = rows.filter(row => row.detailLevel === 'core');
    for (const row of coreRows) {
      if (['ming-fall', 'kangqian'].includes(row.id)) continue;
      const markdown = matter(await readFile(resolve(root, 'content/qing/events', `${row.id}.md`), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      expect(detail.background.includes(row.summary), `${row.id}: summary copied into background`).toBe(false);
    }
  });

  it('Ming has 130 sourced events and 22 connected core archives', async () => {
    const allEventById = new Map((await allEventRecords()).map(event => [event.id, event]));
    const rows = await readRegistry('catalog/events/ming.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const places = await readRegistry('manifest/places.json', value => placeIndexSchema.array().parse(value));
    const polities = await readRegistry('manifest/polities.json', value => politySchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byId = new Map(rows.map(row => [row.id, row]));
    const sourceIds = new Set(sources.map(source => source.id));
    const byPlace = new Map(places.map(place => [place.id, place]));
    const polityIds = new Set(polities.map(polity => polity.id));
    const byPolity = new Map(polities.map(polity => [polity.id, polity]));
    const byRelation = new Map(relations.map(relation => [relation.id, relation]));
    const people = (await Promise.all((await readdir(resolve(root, 'content'))).map(async period => {
      const directory = resolve(root, 'content', period, 'people');
      const filenames = await readdir(directory).catch(() => []);
      return Promise.all(filenames.map(async filename => {
        const markdown = matter(await readFile(resolve(directory, filename), 'utf8'));
        expect(filename).toBe(`${markdown.data.id}.md`);
        return personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
      }));
    }))).flat();
    const byPerson = new Map(people.map(person => [person.id, person]));

    expect(rows).toHaveLength(130);
    expect(rows.filter(row => row.detailLevel === 'core')).toHaveLength(22);
    expect(new Set(rows.map(row => row.title)).size).toBe(130);
    expect(new Set(rows.map(row => row.summary)).size).toBe(130);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    for (const row of rows) {
      expect(row.editorialPeriodId).toBe('ming');
      expect(row.eraId).toBe('ming');
      expect(row.startYear, row.id).toBeGreaterThanOrEqual(1368);
      expect(row.endYear, row.id).toBeLessThanOrEqual(1644);
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(row.layout.lane).toBe(row.categories[0]);
      expect(row.polityIds, `${row.id}: Ming polity`).toContain('ming');
      expect(row.sourceRefs.length, row.id).toBeGreaterThanOrEqual(row.detailLevel === 'core' ? 2 : 1);
      for (const ref of row.sourceRefs) {
        expect(sourceIds.has(ref.sourceId), `${row.id}: source`).toBe(true);
        expect(ref.locator, `${row.id}: locator`).toMatch(/卷[一二三四五六七八九十百零〇\d]+|《[^》]+》|“[^”]+”/);
        expect(ref.locator, `${row.id}: vague locator`).not.toMatch(/相关记载|专题$/);
        expect(ref.locator, `${row.id}: ranged vague locator`).not.toMatch(/年至.*诸条|至.*诸条/);
      }
      for (const id of row.placeIds) {
        expect(byPlace.has(id), `${row.id}: place ${id}`).toBe(true);
        expect(byPlace.get(id)?.eventIds, `${row.id}: reverse place ${id}`).toContain(row.id);
      }
      for (const id of row.polityIds) {
        expect(polityIds.has(id), `${row.id}: polity ${id}`).toBe(true);
        const polity = byPolity.get(id)!;
        expect(row.startYear <= polity.endYear && row.endYear >= polity.startYear, `${row.id}: polity chronology ${id}`).toBe(true);
      }
      for (const id of row.personIds) expect(byPerson.get(id)?.eventIds, `${row.id}: person ${id}`).toContain(row.id);
      for (const id of row.relationIds) {
        const relation = byRelation.get(id);
        expect(relation, `${row.id}: relation ${id}`).toBeDefined();
        expect([relation!.fromId, relation!.toId]).toContain(row.id);
        expect(allEventById.get(relation!.fromId)?.relationIds).toContain(id);
        expect(allEventById.get(relation!.toId)?.relationIds).toContain(id);
      }
      if (row.detailLevel === 'core') {
        expect(new Set(row.sourceRefs.map(ref => ref.sourceId)).size, row.id).toBeGreaterThanOrEqual(2);
        expect(row.personIds.length, row.id).toBeGreaterThanOrEqual(1);
        expect(row.relationIds.length + row.childIds.length + Number(Boolean(row.parentId)), row.id).toBeGreaterThanOrEqual(1);
      }
    }
    expect(byRelation.get('grand-rites-to-left-gate')).toMatchObject({
      type: 'part-of', fromId: 'left-gate-protest', toId: 'grand-rites-controversy'
    });
    expect(byId.get('left-gate-protest')?.parentId).toBe('grand-rites-controversy');
    expect(byId.get('grand-rites-controversy')?.childIds).toContain('left-gate-protest');
    for (const place of places) for (const id of place.eventIds.filter(id => byId.has(id))) expect(byId.get(id)?.placeIds).toContain(place.id);
    for (const person of people) for (const id of person.eventIds.filter(id => byId.has(id))) expect(byId.get(id)?.personIds).toContain(person.id);
    expect(rows.filter(row => row.influence === 5).length).toBeLessThanOrEqual(15);
    expect(rows.filter(row => row.categories.some(category => category === 'politics' || category === 'war')).length).toBeLessThanOrEqual(78);
    for (const category of ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society'])
      expect(rows.some(row => row.categories.includes(category as typeof row.categories[number]))).toBe(true);

    for (const id of ['zheng-he', 'tumu', 'zhang-juzheng', 'imjin-war', 'ming-founded-1368', 'jingnan-campaign', 'beijing-capital-1421', 'beijing-defense-1449', 'wang-yangming-longchang', 'qi-jiguang-coastal-defense', 'li-shizhen-bencao', 'ricci-beijing', 'tiangong-kaiwu', 'donglin-academy-restored', 'later-jin-seven-grievances', 'late-ming-rebellions', 'dashun-founded-xian']) expect(byId.has(id), id).toBe(true);
    expect(byId.get('zheng-he')?.placeIds).toEqual(expect.arrayContaining(['nanjing', 'taicang']));
    expect(byId.get('tumu')?.placeIds).toContain('tumu-fortress');
    expect(byId.get('tumu')?.polityIds).toEqual(expect.arrayContaining(['ming', 'oirat']));
    expect(byId.get('imjin-war')?.polityIds).toEqual(expect.arrayContaining(['ming', 'joseon', 'toyotomi-japan']));
    expect(byId.get('dashun-founded-xian')?.polityIds).toEqual(expect.arrayContaining(['ming', 'dashun']));
    expect(byId.get('hongwu-community-schools')).toMatchObject({ startYear: 1375, endYear: 1375, yearPrecision: 'exact' });
    expect(byId.get('hongwu-fish-scale-registers')).toMatchObject({ startYear: 1387, endYear: 1393, yearPrecision: 'range' });
    expect(byId.get('yongle-encyclopedia-completed')).toMatchObject({ startYear: 1408, yearPrecision: 'exact' });
    expect(byId.get('forbidden-city-inaugurated')).toMatchObject({ startYear: 1420, yearPrecision: 'exact' });
    expect(byId.get('beijing-capital-1421')).toMatchObject({ startYear: 1421, yearPrecision: 'exact' });
    expect(byId.get('late-wanli-succession-crises')).toMatchObject({ startYear: 1615, endYear: 1620, yearPrecision: 'range' });
    expect(byId.get('imjin-pyongyang-campaign')).toMatchObject({ startYear: 1593, endYear: 1593, yearPrecision: 'exact' });
    expect(byId.get('xinghua-campaign')).toMatchObject({ startYear: 1562, endYear: 1563, yearPrecision: 'range' });
    expect(byId.get('longqing-maritime-opening')?.placeIds).toContain('yuegang');
    expect(byId.get('wangjiangjing-battle')?.parentId).toBeNull();
    expect(byId.get('qi-jiguang-coastal-defense')?.childIds).not.toContain('wangjiangjing-battle');
    expect(byId.get('ming-withdrawal-vietnam')?.polityIds).toEqual(['ming']);
    for (const id of ['ricci-zhaoqing-residence', 'ricci-first-world-map', 'ricci-beijing', 'kunyu-wanguo-quantu', 'euclid-elements-translation', 'nanjing-christianity-case'])
      expect(byId.get(id)?.polityIds, id).not.toContain('papal-states');
    for (const id of ['wangjiangjing-battle', 'qi-jiguang-coastal-defense', 'qi-jiguang-taizhou-victories', 'xinghua-campaign', 'wokou-suppression-southeast'])
      expect(byId.get(id)?.polityIds, id).not.toContain('muromachi-japan');
    for (const id of ['ming-japan-tally-trade', 'ningbo-tribute-incident'])
      expect(byId.get(id)?.polityIds, id).toContain('muromachi-japan');
    expect(byId.get('han-prince-rebellion')?.placeIds).toEqual(['lean-shandong']);
    expect(byId.get('jingxiang-refugee-uprising')?.placeIds).toEqual(['yunyang']);
    expect(byId.get('shaanxi-earthquake-1556')?.placeIds).toEqual([]);
    expect(byId.get('later-jin-seven-grievances')?.placeIds).toEqual(expect.arrayContaining(['hetu-ala', 'fushun']));
    expect(byId.get('later-jin-seven-grievances')?.placeIds).not.toContain('liaoyang');

    const independentCoreSources = {
      'ming-founded-1368': 'mingshi-jishi-benmo-zhonghua',
      'hu-weiyong-chancellor-abolished': 'mingshi-jishi-benmo-zhonghua',
      'jingnan-campaign': 'mingshi-jishi-benmo-zhonghua',
      'zheng-he': 'yingya-shenglan',
      'beijing-capital-1421': 'cambridge-ming-political-history',
      'ming-withdrawal-vietnam': 'dai-viet-su-ky-toan-thu',
      'beijing-defense-1449': 'mingshi-jishi-benmo-zhonghua',
      'tumu': 'mingshi-jishi-benmo-zhonghua',
      'grand-rites-controversy': 'mingshi-jishi-benmo-zhonghua',
      'qi-jiguang-coastal-defense': 'jixiao-xinshu',
      'altan-investiture': 'wanli-wugong-lu',
      'zhang-juzheng': 'zhang-taiyue-ji',
      'imjin-war': 'joseon-seonjo-sillok'
    } as const;
    for (const [id, sourceId] of Object.entries(independentCoreSources)) {
      const ref = byId.get(id)?.sourceRefs.find(item => item.sourceId === sourceId);
      expect(ref, `${id}: independent source ${sourceId}`).toBeDefined();
      expect(ref?.locator, `${id}: independent locator`).toMatch(/卷[一二三四五六七八九十百零〇\d]+|《[^》]+》/);
    }

    const altanWugongRef = byId.get('altan-investiture')?.sourceRefs.find(ref => ref.sourceId === 'wanli-wugong-lu');
    expect.soft(altanWugongRef?.locator, 'altan-investiture: Wanli Wugong Lu volume').toContain('卷八《俺答列传下》');
    expect.soft(altanWugongRef?.locator, 'altan-investiture: investiture anchor').toContain('使太史奉金册封俺答为顺义王');
    expect.soft(altanWugongRef?.locator, 'altan-investiture: horse-market opening date').toContain('五月二十八');
    expect.soft(altanWugongRef?.locator, 'altan-investiture: horse-market closing date').toContain('六月十四');
    expect.soft(altanWugongRef?.locator, 'altan-investiture: obsolete volume and section').not.toMatch(/卷七|《俺答列传中》/);

    const imjinWarRefs = byId.get('imjin-war')?.sourceRefs ?? [];
    const seonjoRevisedRef = imjinWarRefs.find(ref => ref.sourceId === 'joseon-seonjo-revised-sillok');
    const seonjoRef = imjinWarRefs.find(ref => ref.sourceId === 'joseon-seonjo-sillok');
    expect.soft(seonjoRevisedRef?.locator, 'imjin-war: 1592 invasion endpoint').toContain('宣祖二十五年（1592）四月十四日');
    expect.soft(seonjoRevisedRef?.locator, 'imjin-war: invasion anchor').toContain('倭贼大举入寇');
    expect.soft(seonjoRevisedRef?.locator, 'imjin-war: 1592 request for aid').toContain('宣祖二十五年（1592）五月一日');
    expect.soft(seonjoRevisedRef?.locator, 'imjin-war: request-for-aid anchor').toContain('此请援天朝之始');
    expect.soft(seonjoRef?.locator, 'imjin-war: 1598 withdrawal endpoint').toContain('宣祖三十一年（1598）十二月二十一日');
    expect.soft(seonjoRef?.locator, 'imjin-war: withdrawal anchor').toContain('众倭将皆听撤去');
    expect.soft(seonjoRef?.locator, 'imjin-war: no modernized nonverbatim quotation').not.toContain('贼惧慑遁归');
    expect.soft(seonjoRef?.locator, 'imjin-war: consequence entry').toContain('宣祖三十三年（1600）十一月十六日');
    expect.soft(seonjoRef?.locator, 'imjin-war: social consequence anchor').toContain('宗社灰烬');
    const imjinIndependentLocators = [seonjoRevisedRef?.locator, seonjoRef?.locator].filter(Boolean).join('；');
    expect.soft(imjinIndependentLocators, 'imjin-war: independent sources cover both endpoints').toContain('1592');
    expect.soft(imjinIndependentLocators, 'imjin-war: independent sources cover both endpoints').toContain('1598');

    const timelineByYear = (personId: string) => new Map(byPerson.get(personId)!.timeline.map(node => [node.year, node.description]));
    expect(timelineByYear('person-zhu-yuanzhang').get(1368)).not.toContain('废除丞相');
    expect(timelineByYear('person-zhu-yuanzhang').get(1380)).toContain('废除丞相');
    expect(timelineByYear('person-jianwen-emperor').get(1398)).not.toContain('南京失守');
    expect(timelineByYear('person-jianwen-emperor').get(1402)).toContain('南京失守');
    expect(timelineByYear('person-wang-yangming').get(1508)).not.toContain('宁王之乱');
    expect(timelineByYear('person-wang-yangming').get(1519)).toContain('宁王之乱');
    expect(timelineByYear('person-nurhaci').get(1616)).toContain('建立后金');
    expect(timelineByYear('person-nurhaci').get(1618)).toContain('七大恨');
    expect(rows.filter(row => row.placeIds.length).length).toBeGreaterThanOrEqual(75);

    const filenames = (await readdir(resolve(root, 'content/ming/events'))).sort();
    expect(filenames).toEqual(rows.filter(row => row.detailLevel === 'core').map(row => `${row.id}.md`).sort());
    for (const filename of filenames) {
      const markdown = matter(await readFile(resolve(root, 'content/ming/events', filename), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const row = byId.get(detail.id)!;
      expect(filename).toBe(`${detail.id}.md`);
      for (const stage of detail.course) {
        expect(stage.year, detail.id).toBeGreaterThanOrEqual(row.startYear);
        expect(stage.year, detail.id).toBeLessThanOrEqual(row.endYear);
      }
      if (!['zheng-he', 'tumu', 'zhang-juzheng', 'imjin-war'].includes(detail.id)) {
        expect(hanCount(detail.background), detail.id).toBeGreaterThanOrEqual(140);
        expect(detail.results[0], detail.id).not.toBe(detail.impacts[0].text);
      }
    }
  });

  it('Yuan has 70 sourced events and 12 connected core archives', async () => {
    const rows = await readRegistry('catalog/events/yuan.json', value => basicEventRecordSchema.array().parse(value));
    const allById = new Map((await allEventRecords()).map(row => [row.id, row]));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const places = await readRegistry('manifest/places.json', value => placeIndexSchema.array().parse(value));
    const polities = await readRegistry('manifest/polities.json', value => politySchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byId = new Map(rows.map(row => [row.id, row]));
    const sourceIds = new Set(sources.map(source => source.id));
    const byPlace = new Map(places.map(place => [place.id, place]));
    const polityIds = new Set(polities.map(polity => polity.id));
    const byRelation = new Map(relations.map(relation => [relation.id, relation]));
    const people = await Promise.all((await readdir(resolve(root, 'content/yuan/people'))).map(async filename => {
      const markdown = matter(await readFile(resolve(root, 'content/yuan/people', filename), 'utf8'));
      expect(filename).toBe(`${markdown.data.id}.md`);
      return personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
    }));
    const byPerson = new Map(people.map(person => [person.id, person]));
    expect(rows).toHaveLength(70);
    expect(rows.filter(row => row.detailLevel === 'core')).toHaveLength(12);
    expect(new Set(rows.map(row => row.title)).size).toBe(70);
    expect(new Set(rows.map(row => row.summary)).size).toBe(70);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    for (const row of rows) {
      expect(row.editorialPeriodId).toBe('yuan');
      expect(row.eraId).toBe('yuan');
      expect(row.startYear, row.id).toBeGreaterThanOrEqual(1271);
      expect(row.endYear, row.id).toBeLessThanOrEqual(1368);
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(row.layout.lane).toBe(row.categories[0]);
      expect(row.sourceRefs.length, row.id).toBeGreaterThanOrEqual(row.detailLevel === 'core' ? 2 : 1);
      for (const ref of row.sourceRefs) {
        expect(sourceIds.has(ref.sourceId), `${row.id}: source`).toBe(true);
        expect(ref.locator, `${row.id}: locator`).toMatch(/卷[一二三四五六七八九十百零〇\d]+|《[^》]+》|“[^”]+”/);
        expect(ref.locator, `${row.id}: vague locator`).not.toMatch(/相关记载|专题$/);
      }
      for (const id of row.polityIds) expect(polityIds.has(id), `${row.id}: polity ${id}`).toBe(true);
      for (const id of row.placeIds) expect(byPlace.get(id)?.eventIds, `${row.id}: place ${id}`).toContain(row.id);
      for (const id of row.personIds) expect(byPerson.get(id)?.eventIds, `${row.id}: person ${id}`).toContain(row.id);
      for (const id of row.relationIds) {
        const relation = byRelation.get(id);
        expect(relation, `${row.id}: relation ${id}`).toBeDefined();
        expect([relation!.fromId, relation!.toId]).toContain(row.id);
        expect(allById.get(relation!.fromId)?.relationIds).toContain(id);
        expect(allById.get(relation!.toId)?.relationIds).toContain(id);
      }
      if (row.detailLevel === 'core') {
        expect(new Set(row.sourceRefs.map(ref => ref.sourceId)).size, row.id).toBeGreaterThanOrEqual(2);
        expect(row.personIds.length, row.id).toBeGreaterThanOrEqual(1);
        expect(row.relationIds.length + row.childIds.length + Number(Boolean(row.parentId)), row.id).toBeGreaterThanOrEqual(1);
      }
    }
    for (const person of people) for (const id of person.eventIds) expect(byId.get(id)?.personIds).toContain(person.id);
    for (const place of places) for (const id of place.eventIds.filter(id => byId.has(id))) expect(byId.get(id)?.placeIds).toContain(place.id);
    expect(rows.filter(row => row.placeIds.length > 0).length).toBeGreaterThanOrEqual(40);
    for (const row of rows) expect(row.polityIds, `${row.id}: polityIds`).not.toHaveLength(0);
    for (const id of ['yuan-founded', 'province-system']) expect(byId.get(id)?.polityIds, id).toContain('yuan');
    for (const [id, place] of [['yuan-dadu-capital', 'beijing'], ['yuan-quanzhou-maritime-control', 'quanzhou'], ['yuan-dadu-fall', 'beijing'], ['yuan-jiaoqing-fall', 'nanjing'], ['province-system', 'kunming'], ['yuan-wuzong-accession', 'shangdu'], ['yuan-kuizhang-pavilion', 'beijing']] as const) expect(byId.get(id)?.placeIds, id).toContain(place);
    expect(byId.get('yuan-wuzong-accession')?.placeIds).not.toContain('beijing');
    for (const id of ['yuan-taiding-succession', 'yuan-mingzong-death']) expect(byId.get(id)?.placeIds, id).not.toContain('shangdu');
    for (const [id, polities] of [['yuan-japan-first-expedition', ['yuan', 'kamakura-japan', 'goryeo']], ['yuan-annam-campaign', ['yuan', 'tran-dai-viet']], ['yuan-java-expedition', ['yuan', 'singhasari', 'majapahit']], ['yuan-red-turban-uprising', ['yuan', 'han-song']], ['yuan-dadu-fall', ['yuan', 'ming']]] as const)
      for (const polity of polities) expect(byId.get(id)?.polityIds, `${id}: ${polity}`).toContain(polity);
    expect(byId.get('yuan-founded')).toMatchObject({ startYear: 1271, endYear: 1279, yearPrecision: 'range' });
    expect(byId.get('yuan-founded')?.sourceRefs.some(ref => ref.sourceId === 'songshi-zhonghua-1977' && ref.locator.includes('祥兴二年'))).toBe(true);
    expect(byId.get('province-system')).toMatchObject({ startYear: 1274, endYear: 1274, yearPrecision: 'exact' });
    expect(byId.get('province-system')?.sourceRefs.some(ref => ref.locator.includes('卷九十一') && ref.locator.includes('至元十一年'))).toBe(true);
    expect(byId.get('yuan-famine-relief-1340s')).toMatchObject({ startYear: 1344, endYear: 1344, yearPrecision: 'exact' });
    expect(byId.get('yuan-famine-relief-1340s')?.sourceRefs[0].locator).toContain('卷四十一');
    expect(byId.get('yuan-zhizheng-sea-grain-crisis')).toMatchObject({ startYear: 1359, endYear: 1363, yearPrecision: 'range' });
    expect(byId.get('yuan-zhizheng-sea-grain-crisis')?.sourceRefs[0].locator).toContain('至正十九年至二十三年');
    for (const id of ['yuan-sea-transport-to-yuan-zhizheng-sea-grain-crisis', 'yuan-zhizheng-sea-grain-crisis-to-yuan-dadu-fall'])
      expect(byId.get('yuan-zhizheng-sea-grain-crisis')?.relationIds).toContain(id);
    expect(byPerson.get('person-wang-zhen')?.timeline.some(stage => stage.year === 1290)).toBe(false);
    expect(byPerson.get('person-wang-zhen')?.timeline.some(stage => stage.year === 1295)).toBe(true);
    expect(byPerson.get('person-wang-zhen')?.sourceIds).toContain('chnmuseum-nongshu');
    expect(rows.filter(row => row.influence === 5).length).toBeLessThanOrEqual(10);
    expect(rows.filter(row => row.categories.some(category => category === 'politics' || category === 'war')).length).toBeLessThanOrEqual(42);
    for (const category of ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society'])
      expect(rows.some(row => row.categories.includes(category as typeof row.categories[number]))).toBe(true);
    for (const id of ['yuan-founded', 'province-system', 'yuan-dadu-capital', 'yuan-shoushi-calendar', 'yuan-sea-transport', 'yuan-examination-restored', 'yuan-red-turban-uprising', 'yuan-dadu-fall']) expect(byId.has(id), id).toBe(true);
    const filenames = (await readdir(resolve(root, 'content/yuan/events'))).sort();
    expect(filenames).toEqual(rows.filter(row => row.detailLevel === 'core').map(row => `${row.id}.md`).sort());
    for (const filename of filenames) {
      const markdown = matter(await readFile(resolve(root, 'content/yuan/events', filename), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const row = byId.get(detail.id)!;
      expect(filename).toBe(`${detail.id}.md`);
      if (detail.id === 'province-system') {
        expect(detail.course[0]).toMatchObject({ year: 1274, title: '云南行省设置' });
        for (const text of [detail.course[0].description, detail.background]) {
          expect(text).toContain('赛典赤');
          expect(text).toContain('中庆路');
        }
        expect([detail.background, ...detail.results, ...detail.impacts.map(impact => impact.text)].join('')).toContain('不等于全国行省同年创制');
        expect(row.summary).toContain('云南');
      }
      for (const stage of detail.course) {
        expect(stage.year, detail.id).toBeGreaterThanOrEqual(row.startYear);
        expect(stage.year, detail.id).toBeLessThanOrEqual(row.endYear);
      }
      if (!['yuan-founded', 'province-system'].includes(detail.id)) {
        expect(hanCount(detail.background), detail.id).toBeGreaterThanOrEqual(140);
        expect(detail.results[0], detail.id).not.toBe(detail.impacts[0].text);
      }
    }
  });
  it('Song-Liao-Jin-Xia has 170 sourced events and 30 connected core archives', async () => {
    const rows = await readRegistry('catalog/events/song-liao-jin-xia.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const polities = await readRegistry('manifest/polities.json', value => politySchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const sourceIds = new Set(sources.map(source => source.id));
    const polityIds = new Set(polities.map(polity => polity.id));
    const byRelation = new Map(relations.map(relation => [relation.id, relation]));
    const byId = new Map(rows.map(row => [row.id, row]));
    const people = (await Promise.all(['song', 'song-liao-jin-xia'].map(async era => {
      const dir = resolve(root, `content/${era}/people`);
      return Promise.all((await readdir(dir)).map(async filename => {
        const markdown = matter(await readFile(resolve(dir, filename), 'utf8'));
        expect(filename).toBe(`${markdown.data.id}.md`);
        return personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
      }));
    }))).flat();
    const byPerson = new Map(people.map(person => [person.id, person]));
    expect(rows).toHaveLength(170);
    expect(rows.filter(row => row.detailLevel === 'core')).toHaveLength(30);
    expect(new Set(rows.map(row => row.id)).size).toBe(170);
    expect(new Set(rows.map(row => row.title)).size).toBe(170);
    expect(new Set(rows.map(row => row.summary)).size).toBe(170);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    for (const row of rows) {
      expect(row.editorialPeriodId).toBe('song-liao-jin-xia');
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(row.layout.lane).toBe(row.categories[0]);
      for (const ref of row.sourceRefs) {
        expect(sourceIds.has(ref.sourceId), `${row.id}: source`).toBe(true);
        expect(ref.locator, `${row.id}: locator`).toMatch(/《[^》]+》|卷[一二三四五六七八九十百零〇\d]+|“[^”]+”/);
      }
      for (const id of row.polityIds) expect(polityIds.has(id), `${row.id}: polity ${id}`).toBe(true);
      for (const id of row.personIds) expect(byPerson.get(id)?.eventIds, `${row.id}: person ${id}`).toContain(row.id);
      for (const id of row.relationIds) {
        const relation = byRelation.get(id);
        expect(relation, `${row.id}: relation ${id}`).toBeDefined();
        expect([relation!.fromId, relation!.toId]).toContain(row.id);
        expect(byId.get(relation!.fromId)?.relationIds).toContain(id);
        expect(byId.get(relation!.toId)?.relationIds).toContain(id);
      }
      if (row.detailLevel === 'core') {
        expect(row.sourceRefs.length, row.id).toBeGreaterThanOrEqual(2);
        expect(row.personIds.length, row.id).toBeGreaterThanOrEqual(1);
        expect(row.relationIds.length + row.childIds.length + Number(Boolean(row.parentId)), row.id).toBeGreaterThanOrEqual(1);
      }
    }
    expect(rows.filter(row => row.influence === 5).length).toBeLessThan(15);
    expect(rows.filter(row => row.categories.some(category => category === 'politics' || category === 'war')).length).toBeLessThanOrEqual(60);
    for (const category of ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society'])
      expect(rows.some(row => row.categories.includes(category as typeof row.categories[number]))).toBe(true);
    for (const id of ['chenqiao', 'chanyuan', 'wang-anshi', 'jingkang', 'yue-fei', 'mongol-rise']) expect(byId.has(id)).toBe(true);
    for (const id of ['song-northern-unification', 'liao-southern-northern-administration', 'western-xia-founded', 'jurchen-jin-founded', 'southern-song-founded', 'song-quanzhou-maritime-office', 'song-moving-type', 'song-zhu-xi-commentaries', 'song-yamen-battle']) expect(byId.has(id), id).toBe(true);
    expect(byId.get('song-northern-unification')?.polityIds).toContain('song-state');
    expect(byId.get('western-xia-founded')?.polityIds).toContain('western-xia');
    expect(byId.get('jurchen-jin-founded')?.polityIds).toContain('jin-jurchen');
    expect(byId.get('song-yamen-battle')?.startYear).toBe(1279);
    const filenames = (await Promise.all(['song', 'song-liao-jin-xia'].map(async era =>
      (await readdir(resolve(root, `content/${era}/events`))).map(filename => `${era}/${filename}`)
    ))).flat().sort();
    expect(filenames).toEqual(rows.filter(row => row.detailLevel === 'core').map(row => `${row.eraId}/${row.id}.md`).sort());
    for (const filename of filenames) {
      const [era, file] = filename.split('/');
      const markdown = matter(await readFile(resolve(root, `content/${era}/events/${file}`), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const row = byId.get(detail.id)!;
      if (!['chenqiao', 'chanyuan', 'wang-anshi', 'jingkang', 'yue-fei', 'mongol-rise'].includes(row.id))
        expect(detail.results[0], detail.id).not.toBe(detail.impacts[0]?.text);
      for (const stage of detail.course) {
        expect(stage.year).toBeGreaterThanOrEqual(row.startYear);
        expect(stage.year).toBeLessThanOrEqual(row.endYear);
      }
    }
    for (const person of people) for (const id of person.eventIds) if (byId.has(id)) expect(byId.get(id)?.personIds).toContain(person.id);
  });
  it('Song-Liao-Jin-Xia dates named actions, cites passages and links process stages', async () => {
    const rows = await readRegistry('catalog/events/song-liao-jin-xia.json', value => basicEventRecordSchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byId = new Map(rows.map(row => [row.id, row]));
    const links = new Set(relations.map(relation => `${relation.fromId}:${relation.toId}:${relation.type}`));
    for (const [id, startYear, endYear] of [
      ['song-quanzhou-maritime-office', 1087, 1087], ['liao-dongdan', 926, 926],
      ['song-empress-liu-regency', 1022, 1033], ['song-baojia', 1070, 1070],
      ['song-jin-sea-alliance', 1118, 1120]
    ] as const) expect(byId.get(id)).toMatchObject({ startYear, endYear });
    expect(byId.get('song-wen-tong-bamboo')!.endYear).toBeLessThan(1080);
    expect(byId.get('song-moving-type')!.yearPrecision).toBe('range');
    expect(byId.get('song-maritime-compass')!.sourceRefs.some(ref => ref.sourceId === 'pingzhou-ketan')).toBe(true);
    expect(rows.some(row => row.id === 'song-shipbuilding-compass')).toBe(false);
    for (const row of rows.filter(row => !['chenqiao', 'chanyuan', 'wang-anshi', 'jingkang', 'yue-fei', 'mongol-rise'].includes(row.id))) {
      for (const ref of row.sourceRefs) {
        expect(ref.locator, row.id).not.toMatch(/相关记载|专题$/);
        expect(ref.locator, row.id).toMatch(/卷[一二三四五六七八九十百零〇\d]+|《[^》]+》|“[^”]+”/);
      }
    }
    for (const [child, parent] of [
      ['song-green-sprouts', 'wang-anshi'], ['song-service-exemption', 'wang-anshi'],
      ['song-ever-normal-granaries', 'wang-anshi'], ['song-liao-chanzhou-campaign', 'chanyuan'],
      ['song-yancheng-battle', 'yue-fei'], ['song-local-academies', 'song-qingli-reforms']
    ]) {
      expect(byId.get(child)?.relationIds.length, child).toBeGreaterThan(0);
      expect(links.has(`${child}:${parent}:part-of`) || links.has(`${child}:${parent}:parallel`), child).toBe(true);
    }
    const qingli = matter(await readFile(resolve(root, 'content/song/events/song-qingli-reforms.md'), 'utf8'));
    const ehu = matter(await readFile(resolve(root, 'content/song/events/song-ehu-debate.md'), 'utf8'));
    const jiaozi = matter(await readFile(resolve(root, 'content/song/events/song-jiaozi-official.md'), 'utf8'));
    expect(qingli.content).toMatch(/考课|磨勘/);
    expect(ehu.content).toMatch(/陆九渊.*本心|本心.*陆九渊/);
    expect(jiaozi.content).toMatch(/十六户|交子务|三年一界/);
    for (const detail of [qingli, ehu, jiaozi]) expect(detail.data.results[0]).not.toBe(detail.data.impacts[0].text);
  });
  it('keeps Baojia initial policing and Song institution locators on their actual passages', async () => {
    const rows = await readRegistry('catalog/events/song-liao-jin-xia.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byId = new Map(rows.map(row => [row.id, row]));
    const baojia = matter(await readFile(resolve(root, 'content/song/events/song-baojia.md'), 'utf8'));
    expect(baojia.data.course).toHaveLength(1);
    expect(baojia.data.course[0]).toMatchObject({ year: 1070, description: expect.stringMatching(/十家|五十家|互保|捕盗/) });
    expect(baojia.data.course[0].description).not.toMatch(/训练|教阅|武艺|肄习|丁壮/);
    for (const [id, year, sourceId, passage] of [
      ['song-canal-granary', 977, 'songshi-zhonghua-1977', /卷九十三.*汴河.*太平兴国二年.*大宁堤/],
      ['song-medical-pharmacy', 1136, 'songhuiyao-jigao', /职官二七.*绍兴六年正月四日置药局/],
      ['song-sichuan-defense', 1235, 'songshi-zhonghua-1977', /卷四百四十九.*高稼传.*沔州.*曹友闻传.*大安/],
      ['song-jinghu-water-defense', 1241, 'songshi-zhonghua-1977', /卷四百一十二.*孟珙传.*上流藩篱三层/],
      ['song-junior-archers', 1132, 'jianyan-yilai-xinian-yaolu-zhonghua-1956', /卷五十三.*绍兴二年四月.*申世景屯福州/]
    ] as const) {
      expect(byId.get(id)?.startYear, id).toBe(year);
      expect(byId.get(id)?.sourceRefs[0], id).toMatchObject({ sourceId, locator: expect.stringMatching(passage) });
    }
    expect(byId.get('jin-land-allotment')?.sourceRefs[0].locator).toMatch(/卷四十七.*田制/);
    expect(byId.get('song-medicine-school')?.startYear).toBeGreaterThanOrEqual(1067);
    for (const [id, sourceId, locator] of [
      ['liao-southern-northern-administration', 'liaoshi-zhonghua-1974', /卷四十五.*北面朝官/],
      ['liao-border-farms', 'liaoshi-zhonghua-1974', /卷五十九.*沿边屯田/],
      ['liao-yanyun-tax', 'liaoshi-zhonghua-1974', /卷五十九.*定赋税/],
      ['song-diaoyu-fortress', 'songshi-zhonghua-1977', /卷四百一十六.*余玠传/],
      ['song-jia-si-dao-reform', 'songshi-zhonghua-1977', /卷四百七十四.*买公田/]
    ] as const) {
      expect(byId.get(id)?.sourceRefs[0], id).toMatchObject({ sourceId, locator: expect.stringMatching(locator) });
    }
    expect(byId.get('song-state-academy')?.startYear).toBe(975);
    expect(byId.get('song-exam-reform')?.startYear).toBe(973);
    expect(byId.get('song-local-judicial-supervision')?.startYear).toBe(1073);
    expect(byId.get('song-local-academies')?.startYear).toBe(1044);
    const academyRelation = relations.find(relation => relation.fromId === 'song-local-academies' && relation.toId === 'song-qingli-reforms');
    expect(academyRelation?.type).toBe('part-of');
    expect(byId.get('song-local-academies')?.parentId).toBe('song-qingli-reforms');
    expect(byId.get('song-qingli-reforms')?.childIds).toContain('song-local-academies');
    expect(byId.get('song-qingli-reforms')?.relationIds).toContain(academyRelation?.id);
    expect(byId.get('song-local-academies')?.relationIds).toContain(academyRelation?.id);
    expect(byId.get('song-sichuan-defense')).toMatchObject({
      title: '端平二年至三年川陕关隘战守', startYear: 1235, endYear: 1236, yearPrecision: 'range'
    });
    expect(byId.get('song-sichuan-defense')?.summary).toMatch(/端平二年.*沔州.*高稼.*战死.*曹友闻.*七方关.*端平三年.*曹友闻.*大安/);
    expect(byId.get('song-sichuan-defense')?.sourceRefs[0].locator).toMatch(/卷四百四十九.*高稼传.*沔州.*曹友闻传.*大安/);
    expect(byId.get('song-kaifeng-guilds')?.summary).toContain('东角楼街巷');
    expect(byId.get('song-kaifeng-guilds')?.sourceRefs[0].locator).toMatch(/卷二《东角楼街巷》/);
    expect(byId.get('song-kaifeng-guilds')?.sourceRefs[0].locator).not.toContain('潘楼东街巷');
    const dongjingSource = sources.find(source => source.id === 'dongjing-menghua-lu');
    expect(dongjingSource?.chapter).toBe('卷二，州桥夜市、东角楼街巷');
    for (const [id, section] of [
      ['song-kaifeng-guilds', '东角楼街巷'], ['song-kaifeng-night-market', '州桥夜市']
    ]) {
      expect(byId.get(id)?.sourceRefs).toContainEqual({
        sourceId: dongjingSource?.id, locator: expect.stringContaining(`卷二《${section}》`)
      });
      expect(dongjingSource?.chapter).toContain(section);
    }
    expect(byId.get('song-canal-granary')?.summary).toContain('怀孟');
    expect(byId.get('song-canal-granary')?.summary).not.toContain('淮、孟');
    expect(byId.get('song-jinghu-water-defense')?.yearPrecision).toBe('circa');
    expect(byId.get('song-zhang-shi-yuelu')).toMatchObject({ startYear: 1167, sourceRefs: [expect.objectContaining({ sourceId: 'hnu-yuelu-zhuzhang', locator: expect.stringMatching(/乾道三年.*朱熹.*张栻/) })] });
  });
  it('keeps Sui-Tang chronology, polity, locators, and distinct event boundaries', async () => {
    const rows = await readRegistry('catalog/events/sui-tang-five-dynasties.json', value => basicEventRecordSchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byId = new Map(rows.map(row => [row.id, row]));
    const relationKeys = new Set(relations.map(relation => `${relation.fromId}:${relation.toId}:${relation.type}`));
    expect(byId.has('tang-end-907')).toBe(false);
    expect(byId.get('sui-jiangdu-coup')).toMatchObject({ eraId: 'sui-tang', period: '隋末', polityIds: expect.arrayContaining(['sui']) });
    expect(byId.get('sui-jiangdu-coup')?.polityIds).not.toContain('tang');
    expect(byId.get('tang-dayan-calendar')).toMatchObject({ startYear: 729, endYear: 729, title: '大衍历颁行' });
    expect(byId.get('tang-dayan-calendar')?.sourceRefs[0].locator).toMatch(/卷一百零八.*《唐开元占经》.*开元十七年/);
    expect(byId.get('later-tang-founded')?.summary).toMatch(/称帝.*后梁灭亡/);
    expect(byId.get('later-tang-founded')?.sourceRefs[0].locator).toContain('卷二十九');
    expect(byId.get('later-tang-luoyang-capital')?.sourceRefs[0].locator).not.toContain('卷二十七');
    expect(byId.get('later-han-founded')?.summary).toMatch(/太原.*即位.*契丹.*北撤/);
    expect(byId.get('sui-qiang-toyuhun')?.sourceRefs[0].locator).not.toContain('卷四');
    expect(byId.get('sui-rebellions')?.sourceRefs.some(ref => /卷182.*大业九年.*杨玄感/.test(ref.locator))).toBe(true);
    expect(byId.get('tang-jianzhen-voyage')?.sourceRefs[0].sourceId).not.toBe('jiutangshu-zhonghua-1975');
    expect(byId.get('tang-jianzhen-voyage')?.sourceRefs).toEqual([
      expect.objectContaining({ sourceId: 'toda-wajo-toseiden-779', locator: expect.stringMatching(/入京.*授戒/) }),
      expect.objectContaining({ sourceId: 'shoku-nihongi-797', locator: expect.stringMatching(/卷十九.*正月.*鉴真.*随.*归朝/) })
    ]);
    expect(byId.get('tang-jianzhen-voyage')?.sourceRefs[1].locator).not.toMatch(/入京|四月|授戒/);
    expect(byId.get('tang-woodblock-buddhist')?.sourceRefs[0].sourceId).not.toBe('jiutangshu-zhonghua-1975');
    for (const [child, parent] of [
      ['sui-salsu-retreat', 'sui-korean-campaign'],
      ['tang-yonghui-code', 'tang-zhenguan-law'],
      ['tang-changan-recovered', 'anshi'],
      ['tang-shi-siming-rebellion', 'anshi'],
      ['tang-huaixi-campaign', 'tang-yuanhe-reconquest']
    ]) {
      expect(byId.get(child)?.parentId, child).toBe(parent);
      expect(relationKeys.has(`${child}:${parent}:part-of`), child).toBe(true);
    }
    expect(relationKeys.has('tang-changan-foreign-merchants:tang-changan-hubs:part-of')).toBe(true);
  });

  it('uses dated actions and complete person-specific archive text', async () => {
    const eventFiles = (await Promise.all(['sui-tang', 'tang', 'five-dynasties'].map(async era =>
      (await readdir(resolve(root, `content/${era}/events`))).filter(file => !['zhenguan.md', 'kaiyuan.md', 'anshi.md', 'two-tax.md', 'huang-chao.md'].includes(file)).map(file => `${era}/events/${file}`)
    ))).flat();
    for (const file of eventFiles) {
      const markdown = matter(await readFile(resolve(root, `content/${file}`), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      expect(detail.course.some(stage => /后续阶段/.test(stage.title)), file).toBe(false);
      expect(detail.historiography, file).not.toContain('与另一史源叙述角度不尽相同');
      for (const result of detail.results) expect(result, file).not.toMatch(/史料多从|史书对|不宜用|年代多有争议/);
    }
    const readEvent = async (era: string, id: string) => matter(await readFile(resolve(root, `content/${era}/events/${id}.md`), 'utf8')).data;
    expect((await readEvent('sui-tang', 'sui-kaihuang-treasury')).course.every((stage: { year: number }) => stage.year >= 589)).toBe(true);
    const rebellions = (await readEvent('sui-tang', 'sui-rebellions')).course as { year: number; title: string; description: string }[];
    expect(rebellions.find(stage => stage.year === 613)).toMatchObject({ title: expect.stringMatching(/杨玄感/), description: expect.stringMatching(/黎阳.*起兵/) });
    expect(rebellions.find(stage => stage.year === 613)?.description).not.toMatch(/瓦岗|翟让|粮仓/);
    expect((await readEvent('sui-tang', 'sui-korean-campaign')).course.find((stage: { year: number }) => stage.year === 612)?.description).not.toMatch(/随后两次|再征/);
    expect((await readEvent('tang', 'tang-buddhist-translation')).course.find((stage: { year: number }) => stage.year === 629)?.description).not.toMatch(/译场|译经|翻译/);
    expect((await readEvent('tang', 'tang-han-yu-classical')).course.some((stage: { year: number; description: string }) => stage.year === 802 && /佛骨|819/.test(stage.description))).toBe(false);
    expect((await readEvent('tang', 'tang-li-bai-poetry')).results.join('')).not.toMatch(/争议|传说/);
    const peopleFiles = (await Promise.all(['sui-tang', 'tang', 'five-dynasties'].map(async era =>
      (await readdir(resolve(root, `content/${era}/people`))).map(file => `${era}/people/${file}`)
    ))).flat();
    const newPersonIds = new Set('person-su-wei person-yang-guang person-yang-jian person-yang-su person-han-yu person-li-bai person-li-yan person-li-yuan person-tian-chengsi person-wang-shuwen person-wu-zetian person-xuanzang person-yi-xing person-zhang-jianzhi person-zhangsun-wuji person-chai-rong person-guo-wei person-li-bian person-li-cunxu person-li-siyuan person-liu-zhiyuan person-qian-liu person-shi-jingtang person-zhu-wen'.split(' '));
    expect(newPersonIds.size).toBe(24);
    for (const file of peopleFiles) {
      const markdown = matter(await readFile(resolve(root, `content/${file}`), 'utf8'));
      if (!newPersonIds.has(markdown.data.id)) continue;
      const person = personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
      expect(person.evaluation, file).not.toContain('在相关事件中留下');
      expect(person.legacy, file).not.toContain('其活动在后世史书');
      expect(person.summary, file).not.toContain('的活动与上述事件相连');
      expect(person.timeline.every(stage => stage.description.endsWith('。')), file).toBe(true);
      for (const item of [...person.timeline.map(stage => stage.description), ...person.contributions])
        expect(item, file).toMatch(/[。！？]$/);
    }
    const xuanzang = matter(await readFile(resolve(root, 'content/tang/people/person-xuanzang.md'), 'utf8')).data;
    expect(xuanzang.timeline.find((stage: { year: number }) => stage.year === 629)?.description).not.toMatch(/回国|译经|译场/);
    const bai = matter(await readFile(resolve(root, 'content/tang/people/person-li-bai.md'), 'utf8')).data;
    expect(bai.timeline.some((stage: { year: number; description: string }) => stage.year === 725 && /翰林|宫廷/.test(stage.description))).toBe(false);
    const zhangsun = matter(await readFile(resolve(root, 'content/tang/people/person-zhangsun-wuji.md'), 'utf8')).data;
    expect(zhangsun.timeline.some((stage: { year: number; description: string }) => stage.year === 637 && /永徽/.test(stage.description))).toBe(false);
  });
  it('Sui-Tang-Five Dynasties has 160 sourced events and 30 core archives', async () => {
    const allEventById = new Map((await allEventRecords()).map(event => [event.id, event]));
    const rows = await readRegistry('catalog/events/sui-tang-five-dynasties.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const sourceIds = new Set(sources.map(source => source.id));
    const byId = new Map(rows.map(row => [row.id, row]));
    const byRelation = new Map(relations.map(relation => [relation.id, relation]));
    const people = (await Promise.all(['sui-tang', 'tang', 'five-dynasties'].map(async era => {
      const dir = resolve(root, `content/${era}/people`);
      return Promise.all((await readdir(dir)).map(async filename => {
        const markdown = matter(await readFile(resolve(dir, filename), 'utf8'));
        expect(filename).toBe(`${markdown.data.id}.md`);
        return personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
      }));
    }))).flat();
    const byPerson = new Map(people.map(person => [person.id, person]));
    const core = rows.filter(row => row.detailLevel === 'core');
    expect(rows).toHaveLength(160);
    expect(core).toHaveLength(30);
    expect(new Set(rows.map(row => row.id)).size).toBe(160);
    expect(new Set(rows.map(row => row.title)).size).toBe(160);
    expect(new Set(rows.map(row => row.summary)).size).toBe(160);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    for (const row of rows) {
      expect(row.editorialPeriodId).toBe('sui-tang-five-dynasties');
      expect(row.startYear).toBeGreaterThanOrEqual(581);
      expect(row.endYear).toBeLessThanOrEqual(960);
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(row.summary, row.id).not.toContain('这一事件的历史意义');
      expect(row.layout.lane).toBe(row.categories[0]);
      for (const ref of row.sourceRefs) {
        expect(sourceIds.has(ref.sourceId), `${row.id}: source`).toBe(true);
        if (!['zhenguan', 'kaiyuan', 'anshi', 'two-tax', 'huang-chao'].includes(row.id))
          expect(ref.locator, `${row.id}: locator`).toMatch(/(?:卷[一二三四五六七八九十百零〇\d]+|《[^》]+》|[志传纪表论]第|Or\.8210\/P\.2)/);
      }
      for (const id of row.personIds) expect(byPerson.get(id)?.eventIds, `${row.id}: person reciprocity`).toContain(row.id);
      if (row.parentId) expect(byId.get(row.parentId)?.childIds).toContain(row.id);
      for (const id of row.childIds) expect(byId.get(id)?.parentId).toBe(row.id);
      for (const id of row.relationIds) {
        const relation = byRelation.get(id);
        expect(relation, `${row.id}: relation`).toBeDefined();
        expect([relation!.fromId, relation!.toId]).toContain(row.id);
        expect(allEventById.get(relation!.fromId)?.relationIds).toContain(id);
        expect(allEventById.get(relation!.toId)?.relationIds).toContain(id);
        if (relation!.type === 'part-of') expect(byId.get(relation!.fromId)?.parentId).toBe(relation!.toId);
      }
      if (row.detailLevel === 'core') {
        expect(row.sourceRefs.length).toBeGreaterThanOrEqual(2);
        expect(row.personIds.length, row.id).toBeGreaterThanOrEqual(1);
        expect(row.relationIds.length + row.childIds.length + Number(Boolean(row.parentId)), row.id).toBeGreaterThanOrEqual(1);
      }
    }
    const filenames = (await Promise.all(['sui-tang', 'tang', 'five-dynasties'].map(async era =>
      (await readdir(resolve(root, `content/${era}/events`))).map(filename => `${era}/${filename}`)
    ))).flat().sort();
    expect(filenames).toEqual(core.map(row => `${row.eraId}/${row.id}.md`).sort());
    for (const filename of filenames) {
      const [era, file] = filename.split('/');
      const markdown = matter(await readFile(resolve(root, `content/${era}/events/${file}`), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const row = byId.get(detail.id)!;
      if (!['zhenguan', 'kaiyuan', 'anshi', 'two-tax', 'huang-chao'].includes(detail.id))
        expect(hanCount(detail.background), detail.id).toBeGreaterThanOrEqual(150);
      for (const stage of detail.course) {
        expect(stage.year).toBeGreaterThanOrEqual(row.startYear);
        expect(stage.year).toBeLessThanOrEqual(row.endYear);
      }
    }
    for (const person of people) for (const id of person.eventIds) {
      if (byId.has(id)) expect(byId.get(id)?.personIds).toContain(person.id);
    }
    expect(rows.filter(row => row.influence === 5).length).toBeLessThan(24);
    expect(rows.filter(row => row.categories.some(c => c === 'politics' || c === 'war')).length).toBeLessThanOrEqual(60);
    for (const category of ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society'])
      expect(rows.some(row => row.categories.includes(category as typeof row.categories[number]))).toBe(true);
    for (const id of ['sui-jiangnan-revolt', 'sui-grand-canal', 'tang-founded', 'tang-wu-zhou-founded', 'anshi', 'two-tax', 'huang-chao', 'later-liang-founded', 'later-zhou-guo-rong'])
      expect(byId.has(id), `missing ${id}`).toBe(true);
    expect(byId.get('later-liang-founded')?.sourceRefs[0].locator).toContain('卷三');
    expect(byId.get('later-jin-founded')?.sourceRefs[0].locator).toContain('卷七十五');
    expect(byId.get('later-zhou-founded')?.sourceRefs[0].locator).toContain('卷一百一十');
    expect(byId.get('southern-tang-founded')?.polityIds).toContain('southern-tang');
    expect(byId.get('tang-goguryeo-fall')?.polityIds).toEqual(expect.arrayContaining(['tang', 'goguryeo', 'silla']));
    expect(byId.get('tang-huang-chao-changan')?.parentId).toBe('huang-chao');
  });
  it('Wei-Jin has 120 sourced events and 18 connected core archives', async () => {
    const rows = await readRegistry('catalog/events/wei-jin.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const sourceIds = new Set(sources.map(source => source.id));
    const byId = new Map(rows.map(row => [row.id, row]));
    const relationById = new Map(relations.map(relation => [relation.id, relation]));
    const people = await Promise.all((await readdir(resolve(root, 'content/wei-jin/people'))).map(async filename => {
      const markdown = matter(await readFile(resolve(root, 'content/wei-jin/people', filename), 'utf8'));
      expect(filename).toBe(`${markdown.data.id}.md`);
      return personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
    }));
    const personById = new Map(people.map(person => [person.id, person]));
    const core = rows.filter(row => row.detailLevel === 'core');
    expect(rows).toHaveLength(120);
    expect(core).toHaveLength(18);
    expect(new Set(rows.map(row => row.id)).size).toBe(120);
    expect(new Set(rows.map(row => row.title)).size).toBe(120);
    expect(new Set(rows.map(row => row.summary)).size).toBe(120);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    for (const row of rows) {
      expect(row.editorialPeriodId).toBe('wei-jin');
      expect(row.eraId).toBe('wei-jin');
      expect(row.startYear).toBeGreaterThanOrEqual(220);
      expect(row.endYear).toBeLessThanOrEqual(589);
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(row.layout.lane).toBe(row.categories[0]);
      expect(new Set(row.sourceRefs.map(ref => ref.sourceId)).size, row.id).toBe(row.sourceRefs.length);
      for (const ref of row.sourceRefs) {
        expect(sourceIds.has(ref.sourceId), `${row.id}: unknown source`).toBe(true);
        expect(ref.locator, `${row.id}: imprecise locator`).toMatch(/(?:卷[一二三四五六七八九十百零〇\d]+|《[^》]+》|[志传纪表论]第)/);
      }
      for (const id of row.personIds) expect(personById.get(id)?.eventIds, `${row.id}: person reciprocity`).toContain(row.id);
      if (row.parentId) expect(byId.get(row.parentId)?.childIds).toContain(row.id);
      for (const id of row.childIds) expect(byId.get(id)?.parentId).toBe(row.id);
      for (const id of row.relationIds) {
        const relation = relationById.get(id);
        expect(relation, `${row.id}: unknown relation`).toBeDefined();
        expect([relation!.fromId, relation!.toId]).toContain(row.id);
        expect(byId.get(relation!.fromId)?.relationIds).toContain(id);
        expect(byId.get(relation!.toId)?.relationIds).toContain(id);
        if (relation!.type === 'part-of') expect(byId.get(relation!.fromId)?.parentId).toBe(relation!.toId);
      }
      if (row.detailLevel === 'core') {
        expect(row.sourceRefs.length, `${row.id}: core sources`).toBeGreaterThanOrEqual(2);
        expect(row.personIds.length, `${row.id}: core people`).toBeGreaterThanOrEqual(1);
        expect(row.relationIds.length + row.childIds.length + Number(Boolean(row.parentId)), `${row.id}: core network`).toBeGreaterThanOrEqual(1);
      }
    }
    for (const person of people) {
      expect(person.primaryEraId).toBe('wei-jin');
      for (const id of person.eventIds) expect(byId.get(id)?.personIds).toContain(person.id);
      for (const id of person.sourceIds) expect(sourceIds.has(id)).toBe(true);
    }
    const filenames = (await readdir(resolve(root, 'content/wei-jin/events'))).sort();
    expect(filenames).toEqual(core.map(row => `${row.id}.md`).sort());
    for (const filename of filenames) {
      const markdown = matter(await readFile(resolve(root, 'content/wei-jin/events', filename), 'utf8'));
      const details = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const row = byId.get(details.id)!;
      expect(hanCount(details.background), details.id).toBeGreaterThanOrEqual(150);
      for (const stage of details.course) {
        expect(stage.year).toBeGreaterThanOrEqual(row.startYear);
        expect(stage.year).toBeLessThanOrEqual(row.endYear);
      }
    }
    for (const [id, years] of Object.entries({ 'eastern-jin-founded': [317, 318], 'wang-dun-rebellion': [322, 324], 'northern-wei-luoyang-capital': [493, 494], 'liang-wudi-buddhism': [529], 'western-wei-fubing': [542, 543] })) {
      const markdown = matter(await readFile(resolve(root, `content/wei-jin/events/${id}.md`), 'utf8'));
      expect(markdown.data.course.map((stage: { year: number }) => stage.year), id).toEqual(years);
      if (id === 'western-wei-fubing') expect(JSON.stringify(markdown.data.course)).not.toContain('初置六军');
    }
    expect(byId.get('liang-tai-city-famine')?.parentId).toBe('hou-jing-rebellion');
    expect(relations.find(relation => relation.type === 'part-of' && relation.fromId === 'liang-tai-city-famine' && relation.toId === 'hou-jing-rebellion')).toBeDefined();
    expect(byId.get('liang-zhiguan')?.startYear).toBe(505);
    expect(byId.get('liang-zhiguan')?.sourceRefs[0]?.locator).toContain('天监四年');
    expect(byId.get('northern-wei-surname-reform')).toMatchObject({ startYear: 496, endYear: 496, title: '北魏拓跋皇族改姓元' });
    expect(byId.get('northern-wei-surname-reform')?.sourceRefs[0]?.locator).toContain('太和二十年正月');
    expect(byId.get('jin-taishi-law')?.sourceRefs[0]?.locator).toContain('泰始四年正月');
    expect(byId.get('western-wei-fubing')).toMatchObject({ startYear: 542, endYear: 543 });
    expect(byId.get('western-wei-fubing')?.sourceRefs[0]?.locator).toContain('大统八年');
    expect(byId.get('wei-japanese-mission')).toMatchObject({ startYear: 238, endYear: 239, yearPrecision: 'range' });
    expect(byId.get('wei-japanese-mission')?.sourceRefs[0]?.locator).toContain('景初二年');
    expect(byId.get('wei-japanese-mission')?.sourceRefs[0]?.note).toContain('景初三年');
    expect(byId.get('gu-kaizhi-painting-tradition')?.sourceRefs[0]?.sourceId).toBe('palace-museum-gu-kaizhi');
    expect(sources.find(source => source.id === 'palace-museum-gu-kaizhi')?.url).toBe('https://www.dpm.org.cn/lemmas/240503.html');
    expect(relationById.get('cao-pi-wei-founded-to-wei-nine-rank')?.type).toBe('parallel');
    expect(personById.get('person-sima-yan')?.timeline.map(item => item.year)).toEqual([265, 280]);
    expect(personById.get('person-sima-rui')?.timeline.map(item => item.year)).toEqual([317, 318]);
    expect(personById.get('person-sima-rui')?.timeline[0]?.title).toContain('晋王');
    expect(personById.get('person-xiao-yan')?.timeline.map(item => item.year)).toEqual([529]);
    expect(personById.get('person-tuoba-hong')?.timeline.map(item => item.year)).toEqual([493, 494]);
    expect(byId.get('liang-text-anthology')?.endYear).toBe(531);
    expect(rows.filter(row => row.influence === 5).length).toBeLessThan(120 * .15);
    expect(rows.filter(row => row.categories.some(category => category === 'politics' || category === 'war')).length).toBeLessThanOrEqual(120 * .6);
    const categories = new Set(rows.flatMap(row => row.categories));
    for (const category of ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society']) expect(categories.has(category)).toBe(true);
    for (const id of ['cao-pi-wei-founded', 'shu-han-founded', 'sun-quan-wu-founded', 'jin-unifies-wu', 'yongjia-disaster', 'eastern-jin-founded', 'feishui-battle', 'northern-wei-unifies-north', 'northern-wei-luoyang-capital', 'liang-wudi-buddhism', 'western-wei-fubing', 'northern-zhou-conquers-qi']) expect(byId.has(id), `missing ${id}`).toBe(true);
  });
  it('Qin-Han has 130 sourced events and 22 connected core archives', async () => {
    const rows = await readRegistry('catalog/events/qin-han.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const people = await Promise.all((await readdir(resolve(root, 'content/qin-han/people'))).map(async filename => {
      const markdown = matter(await readFile(resolve(root, 'content/qin-han/people', filename), 'utf8'));
      expect(filename).toBe(`${markdown.data.id}.md`);
      return personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
    }));
    const byId = new Map(rows.map(row => [row.id, row]));
    const byPerson = new Map(people.map(person => [person.id, person]));
    const byRelation = new Map(relations.map(relation => [relation.id, relation]));
    const sourceIds = new Set(sources.map(source => source.id));
    const core = rows.filter(row => row.detailLevel === 'core');
    expect(rows).toHaveLength(130);
    expect(core).toHaveLength(22);
    expect(new Set(rows.map(row => row.id)).size).toBe(130);
    expect(new Set(rows.map(row => row.title)).size).toBe(130);
    expect(new Set(rows.map(row => row.summary)).size).toBe(130);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    for (const row of rows) {
      expect(row.editorialPeriodId).toBe('qin-han');
      expect(row.eraId).toBe('qin-han');
      expect(row.startYear).toBeGreaterThanOrEqual(-221);
      expect(row.endYear).toBeLessThanOrEqual(220);
      expect(hanCount(row.summary), row.id).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary), row.id).toBeLessThanOrEqual(150);
      expect(row.layout.lane).toBe(row.categories[0]);
      expect(new Set(row.sourceRefs.map(ref => ref.sourceId)).size, row.id).toBe(row.sourceRefs.length);
      for (const ref of row.sourceRefs) {
        expect(sourceIds.has(ref.sourceId), `${row.id}: unknown source`).toBe(true);
        expect(ref.locator, `${row.id}: imprecise locator`).toMatch(/(?:卷[一二三四五六七八九十百零〇\d]+|《[^》]+》|[志传纪表论]第)/);
      }
      for (const id of row.personIds) expect(byPerson.get(id)?.eventIds).toContain(row.id);
      if (row.parentId) expect(byId.get(row.parentId)?.childIds).toContain(row.id);
      for (const id of row.childIds) expect(byId.get(id)?.parentId).toBe(row.id);
      for (const id of row.relationIds) {
        const relation = byRelation.get(id);
        expect(relation, `${row.id}: unknown relation`).toBeDefined();
        expect([relation!.fromId, relation!.toId]).toContain(row.id);
        expect(byId.get(relation!.fromId)?.relationIds).toContain(id);
        expect(byId.get(relation!.toId)?.relationIds).toContain(id);
        if (relation!.type === 'part-of') expect(byId.get(relation!.fromId)?.parentId).toBe(relation!.toId);
      }
      if (row.detailLevel === 'core') {
        expect(row.sourceRefs.length, `${row.id}: core sources`).toBeGreaterThanOrEqual(2);
        expect(row.personIds.length, `${row.id}: core people`).toBeGreaterThanOrEqual(1);
        expect(row.relationIds.length + row.childIds.length + Number(Boolean(row.parentId)), `${row.id}: core network`).toBeGreaterThanOrEqual(1);
      }
    }
    for (const person of people) {
      expect(person.primaryEraId).toBe('qin-han');
      for (const id of person.eventIds) expect(byId.get(id)?.personIds).toContain(person.id);
      for (const id of person.sourceIds) expect(sourceIds.has(id)).toBe(true);
    }
    const filenames = (await readdir(resolve(root, 'content/qin-han/events'))).sort();
    expect(filenames).toEqual(core.map(row => `${row.id}.md`).sort());
    for (const filename of filenames) {
      const markdown = matter(await readFile(resolve(root, 'content/qin-han/events', filename), 'utf8'));
      const detail = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const row = byId.get(detail.id)!;
      expect(filename).toBe(`${detail.id}.md`);
      expect(hanCount(detail.background), detail.id).toBeGreaterThanOrEqual(150);
      for (const stage of detail.course) {
        expect(stage.year).toBeGreaterThanOrEqual(row.startYear);
        expect(stage.year).toBeLessThanOrEqual(row.endYear);
      }
    }
    expect(rows.filter(row => row.influence === 5).length).toBeLessThan(130 * .15);
    expect(rows.filter(row => row.categories.some(category => category === 'politics' || category === 'war')).length).toBeLessThanOrEqual(130 * .6);
    const categories = new Set(rows.flatMap(row => row.categories));
    for (const category of ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society']) expect(categories.has(category)).toBe(true);
    const coverage: Record<string, string[]> = {
      'Qin unification and administration': ['qin-unifies-six-states', 'qin-commandery-system', 'qin-measures-standard'],
      'Qin collapse and Chu-Han': ['chen-sheng-uprising', 'julu-battle', 'chu-han-war'],
      'early Han institutions': ['han-commandery-kingdoms', 'seven-kingdoms-rebellion', 'wen-penalty-reform'],
      'expansion and Silk Road': ['zhang-qian-first-mission', 'hexi-campaigns', 'western-regions-protectorate'],
      'economic policy': ['salt-iron-monopoly', 'salt-iron-debate', 'xin-five-equalizations'],
      'scholarship and technology': ['taichu-calendar', 'shuowen-composition', 'zhang-heng-seismoscope'],
      'Wang Mang': ['wang-mang-regency', 'xin-dynasty-founded', 'wang-mang-wangtian'],
      'Eastern Han politics': ['eastern-han-founded', 'liang-ji-regency', 'first-partisan-prohibition'],
      'religion and society': ['an-shigao-translations', 'taipingdao-network', 'yellow-turban-uprising'],
      'late-Han fragmentation': ['dong-zhuo-takes-luoyang', 'emperor-moves-xu', 'red-cliffs-battle', 'cao-cao-duke-wei'],
    };
    for (const [area, ids] of Object.entries(coverage)) for (const id of ids) expect(byId.has(id), `${area}: missing ${id}`).toBe(true);
    expect(relations.find(relation => relation.type === 'consequence' && relation.fromId === 'zhang-heng-seismoscope' && relation.toId === 'seismoscope-longxi-signal')).toBeDefined();
  });
  it('Qin-Han reviewed chronology, citations and handoffs match their narrated events', async () => {
    const rows = await readRegistry('catalog/events/qin-han.json', value => basicEventRecordSchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const byId = new Map(rows.map(row => [row.id, row]));
    const seal = byId.get('wang-mang-imperial-seal')!;
    expect(seal.startYear).toBe(9);
    expect(seal.title).toMatch(/传国玺/);
    expect(seal.summary).toMatch(/即位后/);
    expect(seal.sourceRefs.some(ref => ref.locator.includes('卷九十八') && ref.locator.includes('传国玺'))).toBe(true);
    expect(relations.find(relation => relation.fromId === 'xin-dynasty-founded' && relation.toId === seal.id && relation.type === 'consequence')).toBeDefined();

    const prohibition = byId.get('first-partisan-prohibition')!;
    expect([prohibition.startYear, prohibition.endYear]).toEqual([166, 167]);
    const prohibitionDetail = matter(await readFile(resolve(root, 'content/qin-han/events/first-partisan-prohibition.md'), 'utf8')).data;
    expect(prohibitionDetail.course.map((stage: { year: number }) => stage.year)).toEqual([166, 167]);
    expect(prohibitionDetail.course[0].description).toMatch(/搜捕|逮捕|系狱|被囚/);
    expect(prohibitionDetail.course[1].description).toMatch(/赦|释放/);
    expect(prohibitionDetail.course[1].description).toMatch(/禁锢/);
    const liYing = matter(await readFile(resolve(root, 'content/qin-han/people/person-li-ying.md'), 'utf8')).data;
    expect(liYing.timeline.map((stage: { year: number }) => stage.year)).toEqual([166, 167]);
    const easternHan = matter(await readFile(resolve(root, 'content/qin-han/events/eastern-han-founded.md'), 'utf8'));
    expect(easternHan.content + easternHan.data.causes.join('')).not.toMatch(/更始集团瓦解后/);
    expect(easternHan.content).toMatch(/更始.*仍|更始.*未/);
    expect(byId.get('dong-zhongshu-responses')!.yearPrecision).toBe('circa');
    expect(byId.get('dong-zhongshu-responses')!.sourceRefs[0].note).toMatch(/年代|系年/);

    for (const [id, accessionEra] of Object.entries({
      'wudi-accession': '景帝后三年', 'zhao-emperor-accession': '后元二年',
      'yuan-emperor-accession': '黄龙元年', 'cheng-emperor-accession': '竟宁元年',
      'ai-emperor-accession': '绥和二年', 'ming-emperor-accession': '中元二年',
      'zhang-emperor-accession': '永平十八年',
    })) expect(byId.get(id)!.sourceRefs[0].locator, id).toContain(accessionEra);
    const simaQian = byId.get('sima-qian-history')!;
    expect(simaQian.sourceRefs.some(ref => ref.locator.includes('卷六十二《司马迁传》报任安书'))).toBe(true);
    const longxi = byId.get('seismoscope-longxi-signal')!;
    expect([longxi.startYear, longxi.endYear, longxi.yearPrecision]).toEqual([132, 139, 'circa']);
    expect(longxi.sourceRefs[0].note).toMatch(/制造|卒|确年/);

    const xiang = byId.get('liu-xiang-collation')!;
    const xin = byId.get('liu-xin-qilue')!;
    expect(xiang.endYear).toBe(-8);
    expect(xin.startYear).toBe(-8);
    expect(xiang.summary).not.toMatch(/刘歆|七略/);
    expect(xin.summary).toMatch(/刘向.*身后/);
    const handoff = relations.find(relation => relation.fromId === xiang.id && relation.toId === xin.id && relation.type === 'consequence');
    expect(handoff).toBeDefined();
    expect(xiang.relationIds).toContain(handoff!.id);
    expect(xin.relationIds).toContain(handoff!.id);

    const banChao = matter(await readFile(resolve(root, 'content/qin-han/events/ban-chao-western-regions.md'), 'utf8'));
    expect(banChao.data.course.map((stage: { year: number }) => stage.year)).toEqual([73, 75, 76, 91, 102]);
    expect(banChao.data.course[1].description).toMatch(/明帝.*去世|明帝.*崩/);
    expect(banChao.data.course[1].description).toMatch(/陈睦.*遇害|陈睦.*陷没/);
    expect(banChao.data.course[1].description).not.toMatch(/召|撤回|东归|返回/);
    expect(banChao.data.course[2].description).toMatch(/召.*东归|召.*撤回/);
    expect(banChao.data.course[2].description).toMatch(/于阗.*疏勒/);
    expect(byId.get('ban-chao-western-regions')!.sourceRefs.some(ref => ref.locator.includes('卷四十六') && ref.locator.includes('建初元年'))).toBe(true);
    expect(banChao.content).toMatch(/鄯善.*匈奴使者/);
    expect(banChao.content).toMatch(/建初元年（76）.*召他东归.*返回疏勒/);
    expect(banChao.content).toMatch(/西域都护/);
    const taichu = matter(await readFile(resolve(root, 'content/qin-han/events/taichu-calendar.md'), 'utf8'));
    expect(taichu.content).toMatch(/十月.*正月/);
    expect(taichu.content).toMatch(/唐都.*落下闳.*邓平/);
    expect(taichu.content).not.toMatch(/需分开说明|需核对/);
  });
  it('pre-Qin has 170 distinct, sourced events and 25 matching core archives', async () => {
    const rows = await readRegistry('catalog/events/pre-qin.json', value => basicEventRecordSchema.array().parse(value));
    const sources = await readRegistry('manifest/sources.json', value => sourceSchema.array().parse(value));
    const polities = await readRegistry('manifest/polities.json', value => politySchema.array().parse(value));
    const relations = await readRegistry('manifest/relations.json', value => relationSchema.array().parse(value));
    const people = await Promise.all((await readdir(resolve(root, 'content/pre-qin/people'))).map(async filename => {
      const markdown = matter(await readFile(resolve(root, 'content/pre-qin/people', filename), 'utf8'));
      expect(filename).toBe(`${markdown.data.id}.md`);
      return personArchiveSchema.parse({ ...markdown.data, summary: markdown.content.trim() });
    }));
    const sourceIds = new Set(sources.map(source => source.id));
    const polityById = new Map(polities.map(polity => [polity.id, polity]));
    const personById = new Map(people.map(person => [person.id, person]));
    const eventById = new Map(rows.map(row => [row.id, row]));
    const catalogFiles = await readdir(resolve(root, 'catalog/events'));
    const allRows = (await Promise.all(catalogFiles.map(filename => readRegistry(`catalog/events/${filename}`, value => basicEventRecordSchema.array().parse(value))))).flat();
    const allEventById = new Map(allRows.map(row => [row.id, row]));
    const relationById = new Map(relations.map(relation => [relation.id, relation]));
    const core = rows.filter(row => row.detailLevel === 'core');
    const broadAnchors = new Set(['zhuangzi-freedom', 'chu-wuqi-reforms', 'xunzi-learning', 'mozi-inclusive-care', 'guan-zhong-governance', 'mencius-benevolent-rule', 'confucius-teaching', 'pan-geng-migration', 'three-guards-rebellion', 'chengzhou-construction']);
    const documentedStages: Record<string, number[]> = {
      'gonghe-regency': [-841, -828],
      'shang-yang-reform': [-356, -350],
      'zichan-zheng-reforms': [-543, -536, -522],
    };

    expect(rows).toHaveLength(170);
    expect(core).toHaveLength(25);
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.map(row => row.id)).toEqual([...rows].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.id.localeCompare(b.id)).map(row => row.id));
    expect(new Set(rows.map(row => row.summary)).size).toBe(rows.length);
    expect(sources.map(source => source.id)).toEqual([...sourceIds].sort());
    expect(polities.map(polity => polity.id)).toEqual([...polityById.keys()].sort());

    const names = rows.flatMap(row => [row.title, ...row.aliases]);
    expect(new Set(names).size).toBe(names.length);
    for (const row of rows) {
      expect(row.editorialPeriodId).toBe('pre-qin');
      expect(row.eraId).toBe('pre-qin');
      expect(row.startYear).toBeGreaterThanOrEqual(-2070);
      expect(row.endYear).toBeLessThanOrEqual(-221);
      expect(row.startYear).toBeLessThanOrEqual(row.endYear);
      if (row.startYear < -841) expect(row.yearPrecision).not.toBe('exact');
      expect(hanCount(row.summary)).toBeGreaterThanOrEqual(80);
      expect(hanCount(row.summary)).toBeLessThanOrEqual(150);
      expect(row.layout.lane).toBe(row.categories[0]);
      const refs = row.sourceRefs.map(ref => ref.sourceId);
      expect(new Set(refs).size, `${row.id}: duplicate source`).toBe(refs.length);
      for (const ref of row.sourceRefs) {
        expect(sourceIds.has(ref.sourceId), `${row.id}: unknown source ${ref.sourceId}`).toBe(true);
        expect(ref.locator.length, `${row.id}: vague locator`).toBeGreaterThanOrEqual(4);
      }
      for (const id of row.polityIds) {
        const polity = polityById.get(id);
        expect(polity, `${row.id}: unknown polity ${id}`).toBeDefined();
        expect(polity!.startYear, `${row.id}: polity starts after event`).toBeLessThanOrEqual(row.endYear);
        expect(polity!.endYear, `${row.id}: polity ends before event`).toBeGreaterThanOrEqual(row.startYear);
      }
      for (const id of row.personIds) expect(personById.get(id)?.eventIds).toContain(row.id);
      if (row.parentId) expect(eventById.get(row.parentId)?.childIds).toContain(row.id);
      for (const id of row.childIds) expect(eventById.get(id)?.parentId).toBe(row.id);
      for (const id of row.relationIds) {
        const relation = relationById.get(id);
        expect(relation, `${row.id}: unknown relation ${id}`).toBeDefined();
        expect([relation!.fromId, relation!.toId]).toContain(row.id);
        expect(eventById.get(relation!.fromId)?.relationIds).toContain(id);
        expect(eventById.get(relation!.toId)?.relationIds).toContain(id);
      }
      if (row.detailLevel === 'core') {
        expect(refs.length, `${row.id}: core sources`).toBeGreaterThanOrEqual(2);
        expect(row.personIds.length, `${row.id}: core people`).toBeGreaterThanOrEqual(1);
        expect(row.relationIds.length + row.childIds.length + Number(row.parentId !== null), `${row.id}: core event network`).toBeGreaterThanOrEqual(1);
      }
    }
    for (const person of people) {
      expect(person.primaryEraId).toBe('pre-qin');
      for (const id of person.eventIds) expect(eventById.get(id)?.personIds).toContain(person.id);
      for (const id of person.sourceIds) expect(sourceIds.has(id)).toBe(true);
    }
    for (const relation of relations) {
      expect(allEventById.get(relation.fromId)?.relationIds).toContain(relation.id);
      expect(allEventById.get(relation.toId)?.relationIds).toContain(relation.id);
    }
    const thematicParts: Record<string, string> = {
      'hanfeizi-persuasion': 'hanfeizi-statecraft',
      'mencius-fields': 'mencius-benevolent-rule',
      'xunzi-human-nature': 'xunzi-learning',
      'zhuangzi-skill-knowledge': 'zhuangzi-freedom',
    };
    for (const [partId, wholeId] of Object.entries(thematicParts)) {
      expect(relations.find(relation => relation.type === 'part-of' && relation.fromId === partId && relation.toId === wholeId),
        `${partId} should render its broader topic as 隶属事件`).toBeDefined();
    }

    const filenames = (await readdir(resolve(root, 'content/pre-qin/events'))).sort();
    expect(filenames).toEqual(core.map(row => `${row.id}.md`).sort());
    const coreById = new Map(core.map(row => [row.id, row]));
    for (const filename of filenames) {
      const markdown = matter(await readFile(resolve(root, 'content/pre-qin/events', filename), 'utf8'));
      const details = coreEventDetailsSchema.parse({ ...markdown.data, background: markdown.content.trim() });
      const row = coreById.get(details.id);
      expect(row, `${filename}: missing core catalog entry`).toBeDefined();
      expect(filename).toBe(`${details.id}.md`);
      expect(hanCount(details.background), `${filename}: short background`).toBeGreaterThanOrEqual(150);
      expect(details.course.length, `${filename}: missing course`).toBeGreaterThanOrEqual(1);
      for (const step of details.course) {
        expect(step.year).toBeGreaterThanOrEqual(row!.startYear);
        expect(step.year).toBeLessThanOrEqual(row!.endYear);
      }
      if (broadAnchors.has(details.id)) expect(details.course.map(step => step.year), `${details.id}: unsupported precise stage year`).toEqual([row!.startYear]);
      if (documentedStages[details.id]) expect(details.course.map(step => step.year), `${details.id}: documented stages`).toEqual(documentedStages[details.id]);
    }

    expect(rows.filter(row => row.influence === 5).length).toBeLessThan(170 * .15);
    expect(rows.filter(row => row.categories.some(category => ['politics', 'war'].includes(category))).length).toBeLessThanOrEqual(170 * .6);
    const categories = new Set(rows.flatMap(row => row.categories));
    for (const category of ['politics', 'war', 'institution', 'economy', 'science', 'culture', 'thought', 'religion', 'diplomacy', 'ethnicity', 'society']) expect(categories.has(category)).toBe(true);
    for (const id of ['erlitou-urban-center', 'pan-geng-migration', 'zhou-conquest-shang', 'chengpu-battle', 'three-jin-recognized', 'shang-yang-reform', 'zhengguo-canal', 'confucius-teaching', 'mencius-benevolent-rule', 'mozi-inclusive-care']) expect(rows.some(row => row.id === id)).toBe(true);
    expect(eventById.has('yan-ying-chen-clan-warning')).toBe(false);
    expect(eventById.get('yan-ying-jin-mission')).toMatchObject({ startYear: -539, endYear: -539 });
    expect(eventById.get('jin-final-partition')).toMatchObject({ startYear: -376, endYear: -376 });
    expect(eventById.get('mohist-optics')?.parentId).toBe('mohist-logic');
    expect(eventById.get('lvshi-agricultural-timing')?.parentId).toBe('lvshi-chunqiu-compilation');
    const expectedDirectSources: Record<string, string> = {
      'li-kui-grain-policy': 'hanshu-zhonghua-1962',
      'gongsunlong-white-horse': 'gongsunlongzi-wang-1992',
      'lvshi-agricultural-timing': 'lvshi-chunqiu-chen-1984',
      'zhanguo-agricultural-iron': 'national-museum-spring-autumn',
      'zhanguo-currency-circulation': 'national-museum-spring-autumn',
      'zhanguo-city-markets': 'national-museum-spring-autumn',
    };
    for (const [eventId, sourceId] of Object.entries(expectedDirectSources)) {
      expect(eventById.get(eventId)?.sourceRefs.map(ref => ref.sourceId)).toContain(sourceId);
    }
  });
});
