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
    expect((await loader.loadPlaceIndex()).find(place => place.id === 'changan')).toMatchObject({ name: '长安', coordinates: [108.94, 34.26] });
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
    expect((await loader.loadHistoryManifest()).version).toBe(2);
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
    expect((await loader.loadHistoryManifest()).version).toBe(2);
  });
});

// New resources must retain the same validation, isolation and retry contract as eras.
describe('archive catalogs', () => {
  it('loads sources and relations once and validates their records', async () => {
    const { archiveFixture } = await import('../../../tests/fixtures/historyArchives');
    const fixture = archiveFixture();
    const sources = await fixture.loader.loadSources();
    expect(sources.find(source => source.id === 'history-institution')?.url).toBe('https://example.org/catalog');
    expect(await fixture.loader.loadSources()).toBe(sources);
    expect(await fixture.loader.loadRelations()).toEqual([{ id: 'zhenguan-kaiyuan', fromId: 'zhenguan', toId: 'kaiyuan', type: 'cause' }]);
    await fixture.loader.loadRelations();
    expect(fixture.requests.filter(path => path === fixture.manifest.sources)).toHaveLength(1);
    expect(fixture.requests.filter(path => path === fixture.manifest.relations)).toHaveLength(1);
    expect(fixture.requests.filter(path => path.startsWith('eras/'))).toEqual([]);
  });
  it('resolves a validated theme with no era download and rejects unknown themes without fetching them', async () => {
    const { archiveFixture } = await import('../../../tests/fixtures/historyArchives');
    const fixture = archiveFixture();
    const first = fixture.loader.loadThemeArchive('tang-journey');
    expect(fixture.loader.loadThemeArchive('tang-journey')).toBe(first);
    const theme = await first;
    expect(theme.chapters.map(chapter => chapter.title)).toEqual(['恢复与整顿', '繁盛与变化']);
    expect(await fixture.loader.loadThemeArchive('tang-journey')).toBe(theme);
    await expect(fixture.loader.loadThemeArchive('missing')).rejects.toMatchObject({ kind: 'not-found' });
    expect(fixture.requests).toEqual(['manifest.json', 'themes/tang-journey.json']);
  });
  it.each(['sources', 'relations', 'theme'] as const)('evicts invalid %s resources and retries after correction', async resource => {
    const { archiveFixture } = await import('../../../tests/fixtures/historyArchives');
    const fixture = archiveFixture();
    const path = resource === 'sources' ? fixture.manifest.sources : resource === 'relations' ? fixture.manifest.relations : 'themes/tang-journey.json';
    const valid = fixture.records[path];
    fixture.records[path] = resource === 'theme' ? { ...fixture.theme, id: 'wrong-theme' } : [{}];
    const load = () => resource === 'sources' ? fixture.loader.loadSources() : resource === 'relations' ? fixture.loader.loadRelations() : fixture.loader.loadThemeArchive('tang-journey');
    await expect(load()).rejects.toMatchObject({ kind: 'validation', resource: `/content/${path}` });
    fixture.records[path] = valid;
    expect(await load()).toEqual(valid);
  });
  it('does not reuse a theme validated for a different ID at an aliased URL', async () => {
    const { archiveFixture } = await import('../../../tests/fixtures/historyArchives');
    const fixture = archiveFixture();
    fixture.manifest.themeArchives['another-theme'] = 'themes/tang-journey.json';
    await fixture.loader.loadThemeArchive('tang-journey');
    await expect(fixture.loader.loadThemeArchive('another-theme')).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('manifest v2 archive contracts', () => {
  async function setup(mutate?: (files: Map<string, unknown>) => void) {
    const manifest = { ...fixture('manifest.json'), version: 2, eventCount: 2, structuredEventCount: 2, legacyEventCount: 0, basicEventCount: 1, coreEventCount: 1, editorialPeriods: fixture('manifest.json').editorialPeriods, periodCounts: Object.fromEntries(Object.keys(fixture('manifest.json').periodCounts).map(id => [id, id === 'sui-tang-five-dynasties' ? 2 : 0])), legacyEventIds: [] };
    const legacy = fixture('eras/tang.json').events.find((event: { detailLevel: string }) => event.detailLevel === 'core');
    const { sourceRefs, background, causes, course, results, impacts, historiography, ...common } = legacy;
    const basic = { ...common, summary: '这一时期的制度调整回应社会治理需要并对后续政治与社会秩序产生影响。'.repeat(3), editorialPeriodId: 'sui-tang-five-dynasties', detailLevel: 'basic', sourceRefs: [{ sourceId: sourceRefs[0].sourceId, locator: '唐代章节' }] };
    const core = { ...basic, id: 'core-example', detailLevel: 'core', background, causes, course, results, impacts, historiography };
    manifest.eventEras = { [basic.id]: 'tang', [core.id]: 'tang' };
    const publicFiles = new Map<string, unknown>([['manifest.json', manifest], [manifest.indexes.events, [basic, core].map(({ sourceRefs, ...event }) => ({ ...event, year: event.startYear, sourceIds: sourceRefs.map(ref => ref.sourceId) }))], ['eras/tang.json', { eraId: 'tang', events: [basic, core], people: [] }]]);
    // Project only compact metadata.
    const compact = publicFiles.get(manifest.indexes.events) as Record<string, unknown>[];
    for (const event of compact) for (const key of ['background', 'causes', 'course', 'results', 'impacts', 'historiography']) delete event[key];
    mutate?.(publicFiles);
    return createHistoryContentLoader({ baseUrl: '/v2/', fetchImpl: async input => new Response(JSON.stringify(publicFiles.get(String(input).replace('/v2/', '')))) });
  }
  it('round trips basic and core archives without downloading bundles for an index', async () => {
    const loader = await setup();
    expect((await loader.loadHistoryManifest()).version).toBe(2);
    expect(await loader.loadEventIndex()).toHaveLength(2);
    const bundle = await loader.loadEraBundle('tang');
    expect(bundle.events[0]).toMatchObject({ detailLevel: 'basic' });
    expect(bundle.events[0]).not.toHaveProperty('background');
    expect(bundle.events[1]).toHaveProperty('background');
  });
  it('rejects period counts shifted between declared periods with the same total', async () => {
    const loader = await setup(files => {
      const manifest = files.get('manifest.json') as { periodCounts: Record<string, number> };
      manifest.periodCounts['sui-tang-five-dynasties'] -= 1;
      manifest.periodCounts.ming += 1;
    });
    await loader.loadHistoryManifest();
    await expect(loader.loadEventIndex()).rejects.toMatchObject({ kind: 'validation', resource: '/v2/indexes/events.compact.json' });
  });
  it('rejects a structured index row assigned to an undeclared period', async () => {
    const loader = await setup(files => {
      const events = files.get('indexes/events.compact.json') as { editorialPeriodId: string }[];
      events[0].editorialPeriodId = 'unknown-period';
    });
    await expect(loader.loadEventIndex()).rejects.toMatchObject({ kind: 'validation' });
  });
  it.each([{ basic: 2, core: 0 }, { basic: 0, core: 2 }])('rejects a structured mixed index split declared as %j', async counts => {
    const loader = await setup(files => {
      const manifest = files.get('manifest.json') as { basicEventCount: number; coreEventCount: number };
      manifest.basicEventCount = counts.basic;
      manifest.coreEventCount = counts.core;
    });
    await loader.loadHistoryManifest();
    await expect(loader.loadEventIndex()).rejects.toMatchObject({ kind: 'validation', resource: '/v2/indexes/events.compact.json' });
  });
  it('rejects a structured population larger than the loaded index', async () => {
    const loader = await setup(files => {
      const manifest = files.get('manifest.json') as { eventCount: number; structuredEventCount: number; basicEventCount: number; periodCounts: Record<string, number> };
      manifest.eventCount = 3; manifest.structuredEventCount = 3; manifest.basicEventCount = 2;
      manifest.periodCounts = { ...manifest.periodCounts, 'sui-tang-five-dynasties': 3 };
    });
    await loader.loadHistoryManifest();
    await expect(loader.loadEventIndex()).rejects.toMatchObject({ kind: 'validation' });
  });
  it('rejects an event from another visual era even when the bundle label matches', async () => {
    const loader = await setup(files => {
      const bundle = files.get('eras/tang.json') as { events: { eraId: string }[] };
      bundle.events[0].eraId = 'song';
    });
    await expect(loader.loadEraBundle('tang')).rejects.toMatchObject({ kind: 'validation', eraId: 'tang' });
  });
  it('rejects a missing catalog index row and allows an absent archive to resolve as missing', async () => {
    const manifest = fixture('manifest.json');
    const missing = 'zhenguan';
    const loader = createHistoryContentLoader({ fetchImpl: async input => {
      if (String(input).endsWith('manifest.json')) return new Response(JSON.stringify(manifest));
      if (String(input).endsWith('events.compact.json')) return new Response(JSON.stringify(fixture('indexes/events.compact.json').filter((event: { id: string }) => event.id !== missing)));
      const bundle = fixture('eras/tang.json');
      bundle.events = bundle.events.filter((event: { id: string }) => event.id !== missing);
      return new Response(JSON.stringify(bundle));
    } });
    await expect(loader.loadEventIndex()).rejects.toMatchObject({ kind: 'validation' });
    expect((await loader.loadEraBundle('tang')).events.some(event => event.id === missing)).toBe(false);
  });
  it('rejects legacy-shaped records in every era bundle', async () => {
    const loader = await setup(files => {
      const bundle = files.get('eras/tang.json') as { events: unknown[] };
      bundle.events = fixture('eras/tang.json').events.map(({ detailLevel, editorialPeriodId, sourceRefs, ...old }: Record<string, unknown>) => old);
    });
    await expect(loader.loadEraBundle('tang')).rejects.toMatchObject({ kind: 'validation' });
  });
});

it('rejects an extra index row outside the declared population', async () => {
  const manifest = fixture('manifest.json');
  const events = fixture('indexes/events.compact.json');
  events.push({ ...events[0], id: 'unreviewed-legacy-event' });
  manifest.eventEras['unreviewed-legacy-event'] = events[0].eraId;
  const loader = createHistoryContentLoader({ fetchImpl: async input => new Response(JSON.stringify(String(input).endsWith('manifest.json') ? manifest : events)) });
  await expect(loader.loadEventIndex()).rejects.toMatchObject({ kind: 'validation', resource: expect.stringContaining('events.compact.json') });
});

it('rejects a new-shaped index row listed as legacy', async () => {
  const manifest = fixture('manifest.json');
  const events = fixture('indexes/events.compact.json');
  manifest.legacyEventIds = [events[0].id];
  Object.assign(events[0], { detailLevel: 'basic', editorialPeriodId: 'sui-tang-five-dynasties', summary: '这一时期的制度调整回应社会治理需要并对后续政治与社会秩序产生影响。'.repeat(3) });
  const loader = createHistoryContentLoader({ fetchImpl: async input => new Response(JSON.stringify(String(input).endsWith('manifest.json') ? manifest : events)) });
  await expect(loader.loadEventIndex()).rejects.toMatchObject({ kind: 'validation' });
});

it.each(['structuredEventCount', 'legacyEventCount', 'eventCount', 'coreEventCount'] as const)('rejects inconsistent manifest %s', field => {
  const manifest = fixture('manifest.json');
  manifest[field] += 1;
  const loader = createHistoryContentLoader({ fetchImpl: async () => new Response(JSON.stringify(manifest)) });
  return expect(loader.loadHistoryManifest()).rejects.toMatchObject({ kind: 'validation', resource: expect.stringContaining('manifest.json') });
});

it('rejects a basic count inconsistent with the structured population', async () => {
  const manifest = fixture('manifest.json');
  manifest.basicEventCount = 31; manifest.coreEventCount = 0;
  const loader = createHistoryContentLoader({ fetchImpl: async () => new Response(JSON.stringify(manifest)) });
  await expect(loader.loadHistoryManifest()).rejects.toMatchObject({ kind: 'validation', resource: expect.stringContaining('manifest.json') });
});

it.each(['unknown', 'missing'] as const)('rejects %s manifest period-count keys', async mode => {
  const manifest = fixture('manifest.json');
  if (mode === 'unknown') manifest.periodCounts['unknown-period'] = 0;
  else delete manifest.periodCounts.ming;
  const loader = createHistoryContentLoader({ fetchImpl: async () => new Response(JSON.stringify(manifest)) });
  await expect(loader.loadHistoryManifest()).rejects.toMatchObject({ kind: 'validation' });
});

it('rejects every nonempty legacy whitelist after catalog migration', async () => {
  const manifest = fixture('manifest.json');
  manifest.legacyEventIds = ['zhenguan'];
  manifest.legacyEventCount = 1; manifest.structuredEventCount -= 1;
  manifest.periodCounts['sui-tang-five-dynasties'] -= 1;
  const loader = createHistoryContentLoader({ fetchImpl: async () => new Response(JSON.stringify(manifest)) });
  await expect(loader.loadHistoryManifest()).rejects.toMatchObject({ kind: 'validation' });
});
