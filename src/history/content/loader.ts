import { z } from 'zod';
import { eraSchema, eventArchiveSchema, eventIndexSchema, personArchiveSchema, personIndexSchema } from './schema';

const path = z.string().min(1);
const eraId = eraSchema.shape.id;
const paths = z.record(eraId, path);
const count = z.number().int().nonnegative();
const manifestSchema = z.strictObject({
  version: z.literal(1), eras: z.array(eraSchema), eraBundles: paths,
  indexes: z.strictObject({ events: path, people: path, places: path, themes: path }),
  eventEras: z.record(eventIndexSchema.shape.id, eraId),
  personEras: z.record(personIndexSchema.shape.id, eraId),
  sources: path, relations: path, themeArchives: paths,
  eraCount: count, eventCount: count, personCount: count, sourceCount: count, themeCount: count, errorCount: count
});
const eraBundleSchema = z.strictObject({ eraId, events: z.array(eventArchiveSchema), people: z.array(personArchiveSchema) })
  .superRefine((bundle, ctx) => {
    if (bundle.events.some(event => event.eraId !== bundle.eraId) || bundle.people.some(person => person.primaryEraId !== bundle.eraId)) {
      ctx.addIssue({ code: 'custom', message: 'Archive belongs to a different era' });
    }
  });
export type HistoryManifest = z.infer<typeof manifestSchema>;
export type HistoryEraBundle = z.infer<typeof eraBundleSchema>;
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
  const loadHistoryManifest = () => request('manifest.json', manifestSchema, 'manifest');
  const loadEventIndex = () => loadHistoryManifest().then(manifest => request(manifest.indexes.events, z.array(eventIndexSchema), 'event-index'));
  const loadPeopleIndex = () => loadHistoryManifest().then(manifest => request(manifest.indexes.people, z.array(personIndexSchema), 'person-index'));
  function loadEraBundle(requestedEra: string): Promise<HistoryEraBundle> {
    const cached = eras.get(requestedEra);
    if (cached) return cached;
    const pending = loadHistoryManifest().then(manifest => {
      const relativePath = Object.hasOwn(manifest.eraBundles, requestedEra) ? manifest.eraBundles[requestedEra] : undefined;
      if (!relativePath) throw new HistoryContentError('not-found', `${base}manifest.json`, requestedEra);
      const schema = eraBundleSchema.refine(bundle => bundle.eraId === requestedEra, 'Requested era does not match bundle');
      return request(relativePath, schema, `era:${requestedEra}`, requestedEra);
    }).catch(error => { eras.delete(requestedEra); throw error; });
    eras.set(requestedEra, pending);
    return pending;
  }
  return { loadHistoryManifest, loadEventIndex, loadPeopleIndex, loadEraBundle };
}
export type HistoryContentLoader = ReturnType<typeof createHistoryContentLoader>;
const defaultLoader = createHistoryContentLoader();
export const { loadHistoryManifest, loadEventIndex, loadPeopleIndex, loadEraBundle } = defaultLoader;
export { defaultLoader as historyContentLoader };
