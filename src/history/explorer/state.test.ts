import type { CompactHistoryEventIndex } from '../content/schema';
import { filterEvents, parseExplorerState, serializeExplorerState } from './state';
const fixture = (overrides: Partial<CompactHistoryEventIndex> = {}): CompactHistoryEventIndex => ({
  id: 'reform', title: 'Reform', aliases: ['New policy'], startYear: 1840, endYear: 1850, year: 1840, yearPrecision: 'range', eraId: 'qing', polityIds: [], period: 'Late Qing', categories: ['politics'], themeIds: ['change'], influence: 5, summary: 'A reform movement', personIds: ['lin'], placeIds: ['canton'], parentId: null, childIds: [], relationIds: [], sourceIds: ['book'], color: '#ffffff', layout: { lane: 'politics', offset: [0, 0] }, ...overrides,
});
describe('URL explorer state', () => {
  it('round trips every dimension in canonical order and omits defaults', () => {
    const state = parseExplorerState(new URLSearchParams('theme=change&view=1&major=1&to=1949&from=-221&min=4&place=canton&person=lin&cat=war&cat=politics&era=qing&q=New+policy'));
    expect(state).toEqual({ text: 'New policy', eraIds: ['qing'], categories: ['politics', 'war'], personIds: ['lin'], placeIds: ['canton'], minInfluence: 4, fromYear: -221, toYear: 1949, majorOnly: true, viewportOnly: true, themeIds: ['change'] });
    expect(serializeExplorerState(state).toString()).toBe('q=New+policy&era=qing&cat=politics&cat=war&person=lin&place=canton&min=4&from=-221&major=1&view=1&theme=change');
    expect(parseExplorerState(serializeExplorerState(state))).toEqual(state);
    expect(serializeExplorerState(parseExplorerState(new URLSearchParams())).toString()).toBe('');
  });
  it('deduplicates lists, keeps the first scalar, rejects malformed input', () => {
    expect(parseExplorerState(new URLSearchParams('q=++Test++&q=ignored&era=qing&era=bad!&era=qing&era=tang&cat=war&cat=wrong&cat=war&min=4oops&min=5&from=0&to=Infinity&major=true&view=1&person=lin&person=lin'))).toEqual({ text: 'Test', eraIds: ['qing', 'tang'], categories: ['war'], personIds: ['lin'], placeIds: [], minInfluence: 1, fromYear: -2070, toYear: 1949, majorOnly: false, viewportOnly: true, themeIds: [] });
  });
  it('clamps influence/years, rejects fractions and sorts reversed ranges', () => {
    expect(parseExplorerState(new URLSearchParams('min=99&from=3000&to=-9999'))).toMatchObject({ minInfluence: 5, fromYear: -2070, toYear: 1949 });
    expect(parseExplorerState(new URLSearchParams('min=-3&from=1911&to=-221'))).toMatchObject({ minInfluence: 1, fromYear: -221, toYear: 1911 });
    expect(parseExplorerState(new URLSearchParams('from=1.5&to=0'))).toMatchObject({ fromYear: -2070, toYear: 1949 });
  });
  it('preserves unrelated query entries without mutating the base', () => {
    const params = new URLSearchParams('archive=event&cat=war&tag=a&tag=b&q=stale');
    expect(serializeExplorerState(parseExplorerState(new URLSearchParams('era=tang')), params).toString()).toBe('archive=event&tag=a&tag=b&era=tang');
    expect(params.toString()).toBe('archive=event&cat=war&tag=a&tag=b&q=stale');
  });
});
describe('dimming filters', () => {
  it('retains every event, ANDs dimensions and ORs values within lists', () => {
    const events = [fixture(), fixture({ id: 'era', eraId: 'tang' }), fixture({ id: 'category', categories: ['culture'] }), fixture({ id: 'person', personIds: [] }), fixture({ id: 'place', placeIds: [] }), fixture({ id: 'minor', influence: 4 }), fixture({ id: 'old', startYear: 1800, endYear: 1839 }), fixture({ id: 'theme', themeIds: [] }), fixture({ id: 'text', title: 'Battle', aliases: [], summary: 'Conflict' }), fixture({ id: 'offscreen' })];
    const state = parseExplorerState(new URLSearchParams('q=REFORM&era=qing&era=song&cat=war&cat=politics&person=lin&person=li&place=canton&min=4&from=1845&to=1900&major=1&view=1&theme=change'));
    const result = filterEvents(events, state, new Set(events.filter(e => e.id !== 'offscreen').map(e => e.id)));
    expect(result.map(({ match, opacity }) => [match, opacity])).toEqual([[true, 1], [false, .15], [false, .15], [false, .15], [false, .15], [false, .15], [false, .15], [false, .15], [false, .15], [false, .15]]);
    expect(result.map(e => e.event)).toEqual(events);
    expect(result[0].event).toBe(events[0]);
  });
  it('uses inclusive interval overlap, aliases, minimum influence and explicit viewport IDs', () => {
    const events = [fixture({ endYear: 1845, influence: 4 }), fixture({ startYear: 1850 }), fixture({ startYear: 1851, endYear: 1852 }), fixture({ influence: 3 })];
    const state = parseExplorerState(new URLSearchParams('q=new+POLICY&from=1845&to=1850&min=4'));
    expect(filterEvents(events, state).map(e => e.match)).toEqual([true, true, false, false]);
    expect(filterEvents(events, { ...state, viewportOnly: true }).map(e => e.match)).toEqual([false, false, false, false]);
    expect(filterEvents(events, parseExplorerState(new URLSearchParams())).every(e => e.match)).toBe(true);
  });
});
