import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HistorySearchClient } from './client';
import { createSearchWorkerHandler } from './search.worker';
import type { SearchIndexes, SearchRequest, SearchResponse, SearchWorker } from './protocol';
import type { CompactHistoryEventIndex } from '../content/schema';

function event(id: string, title: string, overrides: Partial<CompactHistoryEventIndex> = {}): CompactHistoryEventIndex {
  return { id, title, aliases: [], startYear: 755, endYear: 763, year: 755, yearPrecision: 'range',
    eraId: 'tang', polityIds: [], period: '唐', categories: ['war'], themeIds: [], influence: 3,
    summary: '历史记载', personIds: [], placeIds: [], parentId: null, childIds: [], relationIds: [],
    sourceIds: ['source'], color: '#123456', layout: { lane: 'war', offset: [0, 0] }, ...overrides };
}
const indexes: SearchIndexes = {
  events: [
    event('an-shi', '安史之乱', { aliases: ['天宝之乱'], personIds: ['an'], placeIds: ['capital'], themeIds: ['rebellions'] }),
    event('qin', '秦统一', { aliases: ['秦皇'], personIds: ['ying'], startYear: -221, endYear: -221, year: -221, categories: ['politics'] }),
    event('prose', '后世研究', { summary: '安史之乱与秦皇的相关研究', influence: 5 }),
    event('earlier', '秦政初期', { personIds: ['ying'], influence: 4, startYear: -230, endYear: -230, year: -230, categories: ['politics'] }),
    event('later', '秦政后期', { personIds: ['ying'], influence: 4, startYear: -220, endYear: -220, year: -220, categories: ['politics'] })
  ],
  people: [
    { id: 'an', name: '安禄山', aliases: ['轧荦山'], primaryEraId: 'tang', birthYear: 703, deathYear: 757, roleIds: [], eventIds: ['an-shi'], sourceIds: ['source'] },
    { id: 'ying', name: '嬴政', aliases: ['始皇帝'], primaryEraId: 'qin', birthYear: -259, deathYear: -210, roleIds: [], eventIds: ['qin', 'earlier', 'later'], sourceIds: ['source'] }
  ],
  places: [{ id: 'capital', name: '西安', modernName: '西安市', aliases: ['京城'], historicalNames: [{ name: '长安', startYear: -202, endYear: 907 }], coordinates: [108.9, 34.3], eventIds: ['an-shi'] }],
  themes: [{ id: 'rebellions', title: '帝国危机', summary: '危机', eventIds: ['an-shi'] }]
};

// Replace only the external Worker transport; the handler and MiniSearch are real.
class LocalWorker implements SearchWorker {
  onmessage: SearchWorker['onmessage'] = null;
  onerror: SearchWorker['onerror'] = null;
  terminated = false;
  requests: SearchRequest[] = [];
  private handler = createSearchWorkerHandler(response => this.deliver(response));
  queued: SearchResponse[] = [];
  hold = false;
  postMessage(request: SearchRequest) { this.requests.push(request); this.handler(request); }
  deliver(response: SearchResponse) {
    if (this.hold) this.queued.push(response);
    else this.onmessage?.(new MessageEvent('message', { data: response }));
  }
  terminate() { this.terminated = true; }
  crash() { this.onerror?.(new ErrorEvent('error', { message: 'worker crashed' })); }
}
function setup() {
  const worker = new LocalWorker();
  const client = new HistorySearchClient({ indexes, workerFactory: () => worker });
  return { client, worker };
}
const ids = (results: { id: string }[]) => results.map(result => result.id);

describe('history search worker', () => {
  it('indexes all 1200 production events and deterministically searches representatives of nine periods', async () => {
    const fixture = (path: string) => JSON.parse(readFileSync(`public/history-content/generated/indexes/${path}.compact.json`, 'utf8'));
    const production: SearchIndexes = { events: fixture('events'), people: fixture('people'), places: fixture('places'), themes: fixture('themes') };
    expect(production.events).toHaveLength(1200);
    const worker = new LocalWorker();
    const client = new HistorySearchClient({ indexes: production, workerFactory: () => worker });
    const fallback = new HistorySearchClient({ indexes: production, workerFactory: () => { throw new Error('Worker unavailable'); } });
    const representatives = [
      ['盘庚迁殷', 'pan-geng-migration', 'pre-qin'],
      ['秦推行郡县统治', 'qin-commandery-system', 'qin-han'],
      ['曹丕受禅建魏', 'cao-pi-wei-founded', 'wei-jin'],
      ['开皇财政积储', 'sui-kaihuang-treasury', 'sui-tang-five-dynasties'],
      ['陈桥兵变', 'chenqiao', 'song-liao-jin-xia'],
      ['元朝建立', 'yuan-founded', 'yuan'],
      ['明朝建立', 'ming-founded-1368', 'ming'],
      ['明朝灭亡', 'ming-fall', 'qing'],
      ['鸦片战争', 'opium-war', 'modern']
    ];
    try {
      for (const [text, id, period] of representatives) {
        expect(production.events.find(event => event.id === id)?.editorialPeriodId).toBe(period);
        const first = await client.query({ text });
        expect(first[0]?.id).toBe(id);
        expect(await client.query({ text })).toEqual(first);
        expect((await fallback.query({ text }))[0]?.id).toBe(id);
      }
      const init = worker.requests[0];
      expect(init.type === 'init' && init.documents.length).toBe(1200);
      const first = await client.query({ text: '制度', limit: 1200 });
      const reversed = new HistorySearchClient({ indexes: { ...production, events: [...production.events].reverse() }, workerFactory: () => new LocalWorker() });
      try { expect(ids(await reversed.query({ text: '制度', limit: 1200 }))).toEqual(ids(first)); }
      finally { reversed.dispose(); }
    } finally { client.dispose(); fallback.dispose(); }
  });
  it('orders exact title, event alias, and linked person above prose irrespective of influence', async () => {
    const data: SearchIndexes = { ...indexes, events: [
      event('prose', '另一事件', { summary: '嬴政', influence: 5 }),
      event('person', '相关事件', { personIds: ['ying'], influence: 5 }),
      event('alias', '皇帝即位', { aliases: ['嬴政'], influence: 2 }),
      event('title', '嬴政', { influence: 1 })
    ] };
    const client = new HistorySearchClient({ indexes: data, workerFactory: () => new LocalWorker() });
    expect(ids(await client.query({ text: '嬴政' }))).toEqual(['title', 'alias', 'person', 'prose']);
    client.dispose();
  });
  it('normalizes Unicode compatibility forms and supports single-character queries', async () => {
    const client = new HistorySearchClient({ indexes: { ...indexes, events: [event('unicode', 'ＡＢＣ史')] }, workerFactory: () => new LocalWorker() });
    expect(ids(await client.query({ text: 'a b，c' }))).toEqual(['unicode']);
    expect(ids(await client.query({ text: '史' }))).toEqual(['unicode']);
    client.dispose();
  });
  it('rejects protocol query errors and synchronous transport errors before entering fallback', async () => {
    const { client, worker } = setup();
    worker.hold = true;
    const pending = client.query({ text: '长安' });
    const rejected = expect(pending).rejects.toThrow('query failed');
    worker.hold = false;
    worker.deliver({ type: 'error', requestId: 1, message: 'query failed' });
    await rejected;
    expect(ids(await client.query({ text: '秦皇' }))).toEqual(['qin']);
    const other = setup();
    other.worker.postMessage = () => { throw new Error('post failed'); };
    await expect(other.client.query({ text: '长安' })).rejects.toThrow('post failed');
    expect(ids(await other.client.query({ text: '秦皇' }))).toEqual(['qin']);
  });
  it('applies supersession and disposal to pending fallback queries too', async () => {
    const client = new HistorySearchClient({ indexes, workerFactory: () => { throw new Error('disabled'); } });
    const old = client.query({ text: '秦皇' });
    const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' });
    const current = client.query({ text: '安史' });
    await rejected;
    expect(ids(await current)).toEqual(['an-shi']);
    const last = client.query({ text: '秦皇' });
    const disposed = expect(last).rejects.toMatchObject({ name: 'AbortError' });
    client.dispose();
    await disposed;
  });
  it('reports uninitialized query and invalid index failures through the error protocol', () => {
    const responses: SearchResponse[] = [];
    const handle = createSearchWorkerHandler(response => responses.push(response));
    handle({ type: 'query', requestId: 7, query: { text: '安史' } });
    expect(responses[0]).toMatchObject({ type: 'error', requestId: 7 });
    // Duplicate IDs are invalid to MiniSearch; the worker must surface the init failure.
    const client = new HistorySearchClient({ indexes: { ...indexes, events: [indexes.events[0], indexes.events[0]] }, workerFactory: () => new LocalWorker() });
    return expect(client.query({ text: '安史', limit: 1 }).then(ids)).resolves.toEqual(['an-shi']);
  });

  it.each([
    ['安史之乱', ['an-shi', 'prose']], ['安 史，之乱！', ['an-shi', 'prose']],
    ['秦皇', ['qin', 'prose']], ['轧荦山', ['an-shi']], ['长安', ['an-shi']],
    ['京城', ['an-shi']], ['帝国危机', ['an-shi']], ['史之', ['an-shi', 'prose']],
    ['始皇帝', ['earlier', 'later', 'qin']]
  ])('finds and ranks %s using the full joined index', async (text, expected) => {
    const { client } = setup();
    expect(ids(await client.query({ text }))).toEqual(expected);
    client.dispose();
  });
  it('combines category and inclusive representative-year bounds before limiting', async () => {
    const { client } = setup();
    expect(ids(await client.query({ text: '嬴政', filters: { categories: ['politics'], startYear: -230, endYear: -221 }, limit: 1 }))).toEqual(['earlier']);
    expect(await client.query({ text: '嬴政', filters: { categories: ['war'] } })).toEqual([]);
    expect(await client.query({ text: '   ！' })).toEqual([]);
    expect(await client.query({ text: '嬴政', limit: 0 })).toEqual([]);
  });
  it('initializes with source documents and uses increasing numeric request IDs', async () => {
    const { client, worker } = setup();
    expect(ids(await client.query({ text: '安禄山' }))).toEqual(['an-shi']);
    await client.query({ text: '秦皇' });
    expect(worker.requests.map(message => [message.type, message.requestId])).toEqual([['init', 0], ['query', 1], ['query', 2]]);
  });
  it('rejects superseded requests and ignores late stale responses', async () => {
    const { client, worker } = setup();
    worker.hold = true;
    const old = client.query({ text: '秦皇' });
    const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' });
    const latest = client.query({ text: '长安' });
    worker.hold = false;
    worker.deliver(worker.queued[0]);
    worker.deliver(worker.queued[1]);
    await rejected;
    expect(ids(await latest)).toEqual(['an-shi']);
  });
  it('rejects the current query on worker failure, then permanently uses prefix fallback', async () => {
    const { client, worker } = setup();
    worker.hold = true;
    const pending = client.query({ text: '长安' });
    const rejected = expect(pending).rejects.toThrow('worker crashed');
    worker.crash();
    await rejected;
    expect(worker.terminated).toBe(true);
    expect(ids(await client.query({ text: '始皇' }))).toEqual(['earlier', 'later', 'qin']);
    expect(ids(await client.query({ text: '秦皇' }))).toEqual(['qin']);
    expect(ids(await client.query({ text: '安史' }))).toEqual(['an-shi']);
    expect(await client.query({ text: '史之' })).toEqual([]);
    expect(await client.query({ text: '长安' })).toEqual([]);
    expect(ids(await client.query({ text: '嬴', filters: { categories: ['politics'], startYear: -221, endYear: -221 } }))).toEqual(['qin']);
    expect(worker.requests).toHaveLength(2);
  });
  it('uses fallback when worker construction fails or initialization reports an error', async () => {
    const unavailable = new HistorySearchClient({ indexes, workerFactory: () => { throw new Error('unavailable'); } });
    expect(ids(await unavailable.query({ text: '天宝' }))).toEqual(['an-shi']);
    const { client, worker } = setup();
    worker.deliver({ type: 'error', requestId: 0, message: 'init failed' });
    expect(ids(await client.query({ text: '轧荦' }))).toEqual(['an-shi']);
    expect(worker.terminated).toBe(true);
  });
  it('disposes idempotently and aborts both outstanding and subsequent queries', async () => {
    const { client, worker } = setup();
    worker.hold = true;
    const pending = client.query({ text: '秦皇' });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    client.dispose(); client.dispose();
    await rejected;
    expect(worker.terminated).toBe(true);
    await expect(client.query({ text: '秦皇' })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
