import { z } from 'zod';
import { eraSchema, editorialPeriodSchema, historyEventArchiveSchema, eventIndexSchema, personArchiveSchema, personIndexSchema, placeIndexSchema, relationSchema, sourceSchema, themeArchiveSchema, themeIndexSchema, type ThemeArchive, type HistoryEventArchive } from './schema';

const path = z.string().min(1);
const eraId = eraSchema.shape.id;
const paths = z.record(eraId, path);
const count = z.number().int().nonnegative();
const manifestSchema = z.strictObject({
  version: z.literal(2), structuredEventCount: count, legacyEventCount: z.literal(0), basicEventCount: count, coreEventCount: count,
  editorialPeriods: z.array(editorialPeriodSchema), periodCounts: z.record(eraId, count),
  legacyEventIds: z.array(eventIndexSchema.shape.id).length(0), eras: z.array(eraSchema), eraBundles: paths,
  indexes: z.strictObject({ events: path, people: path, places: path, themes: path }),
  eventEras: z.record(eventIndexSchema.shape.id, eraId),
  personEras: z.record(personIndexSchema.shape.id, eraId),
  sources: path, relations: path, themeArchives: paths,
  eraCount: count, eventCount: count, personCount: count, sourceCount: count, themeCount: count, errorCount: count
});
export type HistoryManifest = z.infer<typeof manifestSchema>;
export interface HistoryEraBundle {
  eraId: string;
  events: HistoryEventArchive[];
  people: z.infer<typeof personArchiveSchema>[];
}
function eraBundleSchema(manifest: HistoryManifest, requestedEra: string) {
  return z.strictObject({ eraId, events: z.array(historyEventArchiveSchema), people: z.array(personArchiveSchema) })
    .superRefine((bundle, ctx) => {
      if (bundle.eraId !== requestedEra || bundle.events.some(event => event.eraId !== requestedEra || manifest.eventEras[event.id] !== requestedEra) || bundle.people.some(person => person.primaryEraId !== requestedEra)) {
        ctx.addIssue({ code: 'custom', message: 'Archive belongs to a different visual era' });
      }
      const ids = bundle.events.map(event => event.id);
      if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Bundle does not match manifest events' });
    });
}
export type HistoryContentErrorKind = 'network' | 'http' | 'json' | 'validation' | 'not-found';
export class HistoryContentError extends Error {
  readonly cause: unknown;
  constructor(readonly kind: HistoryContentErrorKind, readonly resource: string, readonly eraId?: string, cause?: unknown) {
    super(`History content ${kind}: ${resource}`);
    this.name = 'HistoryContentError';
    this.cause = cause;
  }
}
export interface HistoryContentLoaderOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}
export function createHistoryContentLoader({ baseUrl = `${import.meta.env.BASE_URL}history-content/generated/`, fetchImpl = (...args) => globalThis.fetch(...args) }: HistoryContentLoaderOptions = {}) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const requests = new Map<string, Promise<unknown>>();
  const eras = new Map<string, Promise<HistoryEraBundle>>();
  const themes = new Map<string, Promise<ThemeArchive>>();
  function request<T>(relativePath: string, schema: z.ZodType<T>, contract: string, requestedEra?: string): Promise<T> {
    const resource = `${base}${relativePath}`;
    const cacheKey = `${contract}:${resource}`;
    const cached = requests.get(cacheKey);
    if (cached) return cached as Promise<T>;
    const pending = (async () => {
      let response: Response;
      try { response = await fetchImpl(resource); }
      catch (cause) { throw new HistoryContentError('network', resource, requestedEra, cause); }
      if (!response.ok) throw new HistoryContentError('http', resource, requestedEra, new Error(`HTTP ${response.status}`));
      let data: unknown;
      try { data = await response.json(); }
      catch (cause) { throw new HistoryContentError('json', resource, requestedEra, cause); }
      try { return schema.parse(data); }
      catch (cause) { throw new HistoryContentError('validation', resource, requestedEra, cause); }
    })().catch(error => { requests.delete(cacheKey); throw error; });
    requests.set(cacheKey, pending);
    return pending;
  }
  const loadHistoryManifest = () => request('manifest.json', manifestSchema.superRefine((manifest, ctx) => {
    // Editorial period counts partition all catalog records.
    const periodIds = manifest.editorialPeriods.map(period => period.id);
    if (new Set(periodIds).size !== periodIds.length || periodIds.length !== Object.keys(manifest.periodCounts).length || periodIds.some(id => !Object.hasOwn(manifest.periodCounts, id))) ctx.addIssue({ code: 'custom', message: 'periodCounts keys must match editorialPeriods' });
    if (manifest.eventCount !== manifest.structuredEventCount || manifest.basicEventCount + manifest.coreEventCount !== manifest.eventCount || Object.values(manifest.periodCounts).reduce((sum, count) => sum + count, 0) !== manifest.structuredEventCount) ctx.addIssue({ code: 'custom', message: 'Inconsistent manifest populations' });
  }), 'manifest');
  const loadEventIndex = () => loadHistoryManifest().then(manifest => request(manifest.indexes.events, z.array(eventIndexSchema).superRefine((events, ctx) => {
    const periodHistogram = new Map<string, number>();
    for (const event of events) if (event.editorialPeriodId !== undefined) periodHistogram.set(event.editorialPeriodId, (periodHistogram.get(event.editorialPeriodId) ?? 0) + 1);
    if ([...periodHistogram.keys()].some(id => !Object.hasOwn(manifest.periodCounts, id)) || manifest.editorialPeriods.some(period => manifest.periodCounts[period.id] !== (periodHistogram.get(period.id) ?? 0))) ctx.addIssue({ code: 'custom', message: 'Index period histogram does not match manifest' });
    const basicCount = events.filter(event => event.detailLevel === 'basic').length;
    const coreCount = events.filter(event => event.detailLevel === 'core').length;
    if (basicCount !== manifest.basicEventCount || coreCount !== manifest.coreEventCount || basicCount + coreCount !== manifest.eventCount) ctx.addIssue({ code: 'custom', message: 'Index detail levels do not match manifest populations' });
    if (new Set(events.map(event => event.id)).size !== events.length || events.some(event => event.detailLevel === undefined || event.editorialPeriodId === undefined || (Object.hasOwn(manifest.eventEras, event.id) && manifest.eventEras[event.id] !== event.eraId))) ctx.addIssue({ code: 'custom', message: 'Index does not match manifest mapping' });
  }), 'event-index'));
  const loadPeopleIndex = () => loadHistoryManifest().then(manifest => request(manifest.indexes.people, z.array(personIndexSchema), 'person-index'));
  const loadPlaceIndex = () => loadHistoryManifest().then(manifest => request(manifest.indexes.places, z.array(placeIndexSchema), 'place-index'));
  const loadThemeIndex = () => loadHistoryManifest().then(manifest => request(manifest.indexes.themes, z.array(themeIndexSchema), 'theme-index'));
  const loadSources = () => loadHistoryManifest().then(manifest => request(manifest.sources, z.array(sourceSchema), 'sources'));
  const loadRelations = () => loadHistoryManifest().then(manifest => request(manifest.relations, z.array(relationSchema), 'relations'));
  function loadThemeArchive(id: string): Promise<ThemeArchive> {
    const cached = themes.get(id);
    if (cached) return cached;
    const pending = loadHistoryManifest().then(manifest => {
      const relativePath = Object.hasOwn(manifest.themeArchives, id) ? manifest.themeArchives[id] : undefined;
      if (!relativePath) throw new HistoryContentError('not-found', `${base}manifest.json`);
      return request(relativePath, themeArchiveSchema.refine(theme => theme.id === id, 'Requested theme does not match archive'), `theme:${id}`);
    }).catch(error => { themes.delete(id); throw error; });
    themes.set(id, pending);
    return pending;
  }
  function loadEraBundle(requestedEra: string): Promise<HistoryEraBundle> {
    const cached = eras.get(requestedEra);
    if (cached) return cached;
    const pending = loadHistoryManifest().then(manifest => {
      const relativePath = Object.hasOwn(manifest.eraBundles, requestedEra) ? manifest.eraBundles[requestedEra] : undefined;
      if (!relativePath) throw new HistoryContentError('not-found', `${base}manifest.json`, requestedEra);
      const schema = eraBundleSchema(manifest, requestedEra);
      return request(relativePath, schema, `era:${requestedEra}`, requestedEra);
    }).catch(error => { eras.delete(requestedEra); throw error; });
    eras.set(requestedEra, pending);
    return pending;
  }
  return { loadHistoryManifest, loadEventIndex, loadPeopleIndex, loadPlaceIndex, loadThemeIndex, loadEraBundle, loadThemeArchive, loadSources, loadRelations };
}
export type HistoryContentLoader = ReturnType<typeof createHistoryContentLoader>;
const defaultLoader = createHistoryContentLoader();
export const { loadHistoryManifest, loadEventIndex, loadPeopleIndex, loadPlaceIndex, loadThemeIndex, loadEraBundle, loadThemeArchive, loadSources, loadRelations } = defaultLoader;
export { defaultLoader as historyContentLoader };
