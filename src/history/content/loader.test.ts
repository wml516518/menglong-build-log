import { readFileSync } from 'node:fs';
import { createHistoryContentLoader, HistoryContentError } from './loader';
const fixture = (path: string) => JSON.parse(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
function once() {
  const read = new Set<string>();
  return async (input: RequestInfo | URL) => {
    const path = String(input).replace('https://history.test/content/', '');
    if (read.has(path)) throw new Error('offline');
    read.add(path);
    return new Response(JSON.stringify(fixture(path)));
  };
}
describe('history content loader', () => {
  it('loads validated compact indexes once with a custom base URL', async () => {
    const loader = createHistoryContentLoader({ baseUrl: 'https://history.test/content/', fetchImpl: once() });
    const manifest = await loader.loadHistoryManifest();
    expect(manifest.eras.some(era => era.id === 'tang')).toBe(true);
    const events = await loader.loadEventIndex();
    const people = await loader.loadPeopleIndex();
    expect(events.find(event => event.id === 'zhenguan')?.title).toBe('贞观之治');
    expect(people.find(person => person.id === 'person-li-shimin')?.name).toBe('唐太宗');
    expect(await loader.loadEventIndex()).toBe(events);
    expect(await loader.loadPeopleIndex()).toBe(people);
    expect(await loader.loadHistoryManifest()).toBe(manifest);
  });
  it('validates and caches place and theme compact indexes without fetching archives', async () => {
    const loader = createHistoryContentLoader({ baseUrl: 'https://history.test/content/', fetchImpl: once() });
    expect(await loader.loadPlaceIndex()).toEqual([]);
    expect(await loader.loadThemeIndex()).toEqual([]);
    expect(await loader.loadPlaceIndex()).toBe(await loader.loadPlaceIndex());
    const invalid = createHistoryContentLoader({ fetchImpl: async input => new Response(JSON.stringify(String(input).endsWith('manifest.json') ? fixture('manifest.json') : [{ id: 'invalid' }])) });
    await expect(invalid.loadPlaceIndex()).rejects.toMatchObject({ kind: 'validation' });
    await expect(invalid.loadThemeIndex()).rejects.toMatchObject({ kind: 'validation' });
  });
  it('shares an in-flight era promise and keeps successful eras after another era fails', async () => {
    const fetchOnce = once();
    const loader = createHistoryContentLoader({ baseUrl: 'https://history.test/content/', fetchImpl: async input => {
      if (String(input).endsWith('eras/song.json')) return new Response('{"eraId":"song","events":[{}],"people":[]}');
      return fetchOnce(input);
    } });
    const first = loader.loadEraBundle('tang');
    expect(loader.loadEraBundle('tang')).toBe(first);
    const tang = await first;
    expect(tang.events.find(event => event.id === 'zhenguan')?.background).toBeTruthy();
    await expect(loader.loadEraBundle('song')).rejects.toMatchObject({ kind: 'validation', eraId: 'song', resource: expect.stringContaining('eras/song.json') });
    expect(await loader.loadEraBundle('tang')).toBe(tang);
  });
  it('evicts invalid bundles so they can be corrected and retried', async () => {
    let broken = true;
    const loader = createHistoryContentLoader({ baseUrl: 'https://history.test/content/', fetchImpl: async input => {
      const path = String(input).replace('https://history.test/content/', '');
      return new Response(JSON.stringify(broken && path === 'eras/tang.json' ? {} : fixture(path)));
    } });
    await expect(loader.loadEraBundle('tang')).rejects.toBeInstanceOf(HistoryContentError);
    broken = false;
    expect((await loader.loadEraBundle('tang')).eraId).toBe('tang');
  });
  it.each(['network', 'http', 'json', 'validation'] as const)('reports %s context then retries', async kind => {
    let broken = true;
    const loader = createHistoryContentLoader({ fetchImpl: async () => {
      if (!broken) return new Response(JSON.stringify(fixture('manifest.json')));
      if (kind === 'network') throw new Error('offline');
      if (kind === 'http') return new Response('', { status: 503 });
      if (kind === 'json') return new Response('{');
      return new Response('{}');
    } });
    await expect(loader.loadHistoryManifest()).rejects.toMatchObject({ kind, resource: expect.stringContaining('manifest.json'), cause: expect.anything() });
    broken = false;
    expect((await loader.loadHistoryManifest()).version).toBe(1);
  });
  it('rejects bundles for a different era and unknown eras', async () => {
    const loader = createHistoryContentLoader({ fetchImpl: async input => new Response(JSON.stringify(fixture(String(input).endsWith('manifest.json') ? 'manifest.json' : 'eras/song.json'))) });
    await expect(loader.loadEraBundle('tang')).rejects.toMatchObject({ kind: 'validation', eraId: 'tang' });
    await expect(loader.loadEraBundle('missing')).rejects.toMatchObject({ kind: 'not-found', eraId: 'missing' });
  });
});

describe('cache contract isolation', () => {
  it('validates an era even when another era has already cached the same URL', async () => {
    const manifest = fixture('manifest.json');
    manifest.eraBundles.song = manifest.eraBundles.tang;
    const loader = createHistoryContentLoader({ fetchImpl: async input => new Response(JSON.stringify(String(input).endsWith('manifest.json') ? manifest : fixture('eras/tang.json'))) });
    const tang = await loader.loadEraBundle('tang');
    await expect(loader.loadEraBundle('song')).rejects.toMatchObject({ kind: 'validation', eraId: 'song' });
    expect(await loader.loadEraBundle('tang')).toBe(tang);
  });
  it('rejects an index path aliasing the already cached manifest', async () => {
    const manifest = fixture('manifest.json');
    manifest.indexes.events = 'manifest.json';
    const loader = createHistoryContentLoader({ fetchImpl: async () => new Response(JSON.stringify(manifest)) });
    await loader.loadHistoryManifest();
    await expect(loader.loadEventIndex()).rejects.toMatchObject({ kind: 'validation', resource: expect.stringContaining('manifest.json') });
    expect((await loader.loadHistoryManifest()).version).toBe(1);
  });
});
