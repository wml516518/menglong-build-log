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
    expect(result.current.places).toEqual([]);
    expect(result.current.themes).toEqual([]);
    await act(async () => {
      const event = await result.current.getEventArchive('zhenguan');
      expect(event?.background).toBeTruthy();
      expect((await result.current.getPersonArchive('person-li-shimin'))?.name).toBe('唐太宗');
      expect(await result.current.getEventArchive('zhenguan')).toBe(event);
      expect(await result.current.getEventArchive('missing')).toBeUndefined();
      expect(await result.current.getEventArchive('missing')).toBeUndefined();
      expect(await result.current.getPersonArchive('missing')).toBeUndefined();
    });
  });
  it('tracks era loading and failure, retries that era and retains other archives', async () => {
    const { result, repair } = setup('song');
    await waitFor(() => expect(result.current.loading).toBe(false));
    let tang: unknown;
    await act(async () => { tang = await result.current.getEventArchive('zhenguan'); });
    let pending!: ReturnType<typeof result.current.getEventArchive>;
    act(() => { pending = result.current.getEventArchive('chenqiao'); });
    expect(result.current.loadingEras).toContain('song');
    await act(async () => { await expect(pending).rejects.toMatchObject({ kind: 'network', eraId: 'song' }); });
    expect(result.current.eraErrors.song?.kind).toBe('network');
    expect(result.current.loadingEras).not.toContain('song');
    repair();
    await act(async () => { await result.current.retry('song'); });
    expect(result.current.eraErrors.song).toBeUndefined();
    await act(async () => {
      expect((await result.current.getEventArchive('chenqiao'))?.title).toBe('陈桥兵变');
      expect(await result.current.getEventArchive('zhenguan')).toBe(tang);
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
