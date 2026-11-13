import { readFileSync } from 'node:fs';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createHistoryContentLoader } from './loader';
import { HistoryContentProvider, useHistoryContent } from './store';
function setup(failingEra?: string, failIndex = false) {
  const read = new Set<string>();
  let broken = true;
  const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
    const path = String(input).replace('/content/', '');
    if (broken && (path === `eras/${failingEra}.json` || (failIndex && path.endsWith('events.compact.json')))) throw new Error('offline');
    if (read.has(path)) throw new Error('already downloaded');
    read.add(path);
    return new Response(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
  } });
  const wrapper = ({ children }: { children: ReactNode }) => <HistoryContentProvider loader={loader}>{children}</HistoryContentProvider>;
  return { ...renderHook(useHistoryContent, { wrapper }), repair: () => { broken = false; } };
}
describe('history content provider', () => {
  it('exposes compact indexes and resolves archives lazily with unknown IDs returning undefined', async () => {
    const { result } = setup();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.events.find(event => event.id === 'zhenguan')?.title).toBe('贞观之治');
    expect(result.current.people.find(person => person.id === 'person-li-shimin')?.name).toBe('唐太宗');
    expect(result.current.places.find(place => place.id === 'changan')).toMatchObject({ name: '长安', coordinates: [108.94, 34.26] });
    expect(result.current.themes).toEqual([]);
    await act(async () => {
      const event = await result.current.getEventArchiveRecord('zhenguan');
      expect(event?.background).toBeTruthy();
      expect((await result.current.getPersonArchive('person-li-shimin'))?.name).toBe('唐太宗');
      expect(await result.current.getEventArchiveRecord('zhenguan')).toBe(event);
      expect(await result.current.getEventArchiveRecord('missing')).toBeUndefined();
      expect(await result.current.getEventArchiveRecord('missing')).toBeUndefined();
      expect(await result.current.getPersonArchive('missing')).toBeUndefined();
    });
  });
  it('tracks era loading and failure, retries that era and retains other archives', async () => {
    const { result, repair } = setup('song');
    await waitFor(() => expect(result.current.loading).toBe(false));
    let tang: unknown;
    await act(async () => { tang = await result.current.getEventArchiveRecord('zhenguan'); });
    let pending!: ReturnType<typeof result.current.getEventArchiveRecord>;
    act(() => { pending = result.current.getEventArchiveRecord('chenqiao'); });
    expect(result.current.loadingEras).toContain('song');
    await act(async () => { await expect(pending).rejects.toMatchObject({ kind: 'network', eraId: 'song' }); });
    expect(result.current.eraErrors.song?.kind).toBe('network');
    expect(result.current.loadingEras).not.toContain('song');
    repair();
    await act(async () => { await result.current.retry('song'); });
    expect(result.current.eraErrors.song).toBeUndefined();
    await act(async () => {
      expect((await result.current.getEventArchiveRecord('chenqiao'))?.title).toBe('陈桥兵变');
      expect(await result.current.getEventArchiveRecord('zhenguan')).toBe(tang);
    });
  });
  it('retries initialization while retaining successful index downloads', async () => {
    const { result, repair } = setup(undefined, true);
    await waitFor(() => expect(result.current.error?.kind).toBe('network'));
    expect(result.current.loading).toBe(false);
    repair();
    await act(async () => { await result.current.retry(); });
    expect(result.current.error).toBeNull();
    expect(result.current.events.length).toBeGreaterThan(0);
    expect(result.current.people.length).toBeGreaterThan(0);
  });
});

it('resolves themes and shared catalogs lazily, preserving successful data after a failed retry', async () => {
  const { archiveFixture } = await import('../../../tests/fixtures/historyArchives');
  const fixture = archiveFixture();
  const wrapper = ({ children }: { children: ReactNode }) => <HistoryContentProvider loader={fixture.loader}>{children}</HistoryContentProvider>;
  const { result } = renderHook(useHistoryContent, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(fixture.requests.some(path => path === fixture.manifest.sources || path.startsWith('themes/'))).toBe(false);
  await act(async () => {
    expect(await result.current.getThemeArchive('missing')).toBeUndefined();
    const theme = await result.current.getThemeArchive('tang-journey');
    expect(theme?.title).toBe('唐代政治之旅');
    expect(await result.current.getThemeArchive('tang-journey')).toBe(theme);
    fixture.failures.add(fixture.manifest.sources);
    await expect(result.current.getSources()).rejects.toMatchObject({ kind: 'network' });
    fixture.failures.clear();
    expect((await result.current.getSources()).map(source => source.title)).toContain('历史资料目录');
    expect((await result.current.getRelations())[0].toId).toBe('kaiyuan');
    expect(await result.current.getThemeArchive('tang-journey')).toBe(theme);
  });
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toEqual([]);
});

it('loads basic/core records through the union API using visual era lookup and scoped retry', async () => {
  const read = (path: string) => JSON.parse(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
  const manifest = read('manifest.json');
  const legacy = read('eras/tang.json').events.find((event: { detailLevel: string }) => event.detailLevel === 'core');
  const { sourceRefs, background, causes, course, results, impacts, historiography, ...common } = legacy;
  const basic = { ...common, id: 'basic-example', detailLevel: 'basic', editorialPeriodId: 'sui-tang-five-dynasties', summary: '这一时期的制度调整回应社会治理需要并对后续政治与社会秩序产生影响。'.repeat(3), sourceRefs: [{ sourceId: sourceRefs[0].sourceId, locator: '唐代章节' }] };
  const core = { ...basic, id: 'core-example', detailLevel: 'core', background, causes, course, results, impacts, historiography };
  manifest.eventEras = { [basic.id]: 'tang', [core.id]: 'tang' };
  manifest.legacyEventIds = [];
  manifest.structuredEventCount = 2; manifest.legacyEventCount = 0; manifest.periodCounts = Object.fromEntries(Object.keys(manifest.periodCounts).map(id => [id, id === 'sui-tang-five-dynasties' ? 2 : 0]));
  manifest.basicEventCount = 1; manifest.coreEventCount = 1; manifest.eventCount = 2;
  const compact = [basic, core].map(event => {
    const metadata: Record<string, unknown> = { ...event, year: event.startYear, sourceIds: sourceRefs.map(ref => ref.sourceId) };
    for (const key of ['sourceRefs', 'background', 'causes', 'course', 'results', 'impacts', 'historiography']) delete metadata[key];
    return metadata;
  });
  const requests: string[] = [];
  let broken = true;
  const loader = createHistoryContentLoader({ baseUrl: '/union/', fetchImpl: async input => {
    const path = String(input).replace('/union/', ''); requests.push(path);
    if (path === 'eras/tang.json' && broken) throw new Error('offline');
    const record = path === 'manifest.json' ? manifest : path === manifest.indexes.events ? compact : path === 'eras/tang.json' ? { eraId: 'tang', events: [basic, core], people: [] } : read(path);
    return new Response(JSON.stringify(record));
  } });
  const wrapper = ({ children }: { children: ReactNode }) => <HistoryContentProvider loader={loader}>{children}</HistoryContentProvider>;
  const { result } = renderHook(useHistoryContent, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(requests.some(path => path.startsWith('eras/'))).toBe(false);
  await act(async () => { await expect(result.current.getEventArchiveRecord(basic.id)).rejects.toMatchObject({ eraId: 'tang' }); });
  broken = false;
  await act(async () => {
    await result.current.retry('tang');
    const archive = await result.current.getEventArchiveRecord(basic.id);
    expect(archive).toEqual(basic); expect(archive).not.toHaveProperty('background');
    expect(await result.current.getEventArchiveRecord(core.id)).toEqual(core);
    expect(await result.current.getEventArchiveRecord('missing')).toBeUndefined();
    expect('getEventArchive' in result.current).toBe(false);
  });
  expect(requests.filter(path => path === 'eras/tang.json')).toHaveLength(2);
  expect(requests.filter(path => path === 'manifest.json')).toHaveLength(1);
});
