import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { historyContentLoader, type HistoryContentLoader, type HistoryContentError, type HistoryManifest, type HistoryEraBundle } from './loader';
import type { CompactHistoryEventIndex, PersonIndex, PlaceIndex, ThemeIndex, HistoryEventArchive, PersonArchive } from './schema';

interface ContentState {
  manifest: HistoryManifest | null;
  events: CompactHistoryEventIndex[];
  people: PersonIndex[];
  places: PlaceIndex[];
  themes: ThemeIndex[];
  loading: boolean;
  error: HistoryContentError | null;
  loadingEras: string[];
  eraErrors: Record<string, HistoryContentError | undefined>;
}
function createContentStore(loader: HistoryContentLoader) {
  let state: ContentState = { manifest: null, events: [], people: [], places: [], themes: [], loading: true, error: null, loadingEras: [], eraErrors: {} };
  const listeners = new Set<() => void>();
  const eras = new Map<string, Promise<HistoryEraBundle>>();
  let initialization: Promise<void> | undefined;
  function update(patch: Partial<ContentState>) {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  }
  function initialize(): Promise<void> {
    if (initialization) return initialization;
    update({ loading: true, error: null });
    initialization = (async () => {
      // Wait for every request, including successes, before exposing a settled state.
      const [manifest, events, people, places, themes] = await Promise.allSettled([loader.loadHistoryManifest(), loader.loadEventIndex(), loader.loadPeopleIndex(), loader.loadPlaceIndex(), loader.loadThemeIndex()]);
      const failure = [manifest, events, people, places, themes].find(result => result.status === 'rejected');
      update({
        manifest: manifest.status === 'fulfilled' ? manifest.value : null,
        events: events.status === 'fulfilled' ? events.value : state.events,
        people: people.status === 'fulfilled' ? people.value : state.people,
        places: places.status === 'fulfilled' ? places.value : state.places,
        themes: themes.status === 'fulfilled' ? themes.value : state.themes,
        loading: false,
        error: failure?.status === 'rejected' ? failure.reason as HistoryContentError : null
      });
      if (failure?.status === 'rejected') throw failure.reason;
    })().catch(error => { initialization = undefined; throw error; });
    return initialization;
  }
  function loadEra(id: string): Promise<HistoryEraBundle> {
    const cached = eras.get(id);
    if (cached) return cached;
    const eraErrors = { ...state.eraErrors };
    delete eraErrors[id];
    update({ loadingEras: [...state.loadingEras, id], eraErrors });
    const pending = loader.loadEraBundle(id).then(bundle => {
      update({ loadingEras: state.loadingEras.filter(era => era !== id) });
      return bundle;
    }, (error: HistoryContentError) => {
      eras.delete(id);
      update({ loadingEras: state.loadingEras.filter(era => era !== id), eraErrors: { ...state.eraErrors, [id]: error } });
      throw error;
    });
    eras.set(id, pending);
    return pending;
  }
  function resolveEra(id: string, kind: 'eventEras' | 'personEras'): string | undefined {
    const mapping = state.manifest?.[kind];
    return mapping && Object.hasOwn(mapping, id) ? mapping[id] : undefined;
  }
  function getEventArchive(id: string): Promise<HistoryEventArchive | undefined> {
    if (!state.manifest) return initialize().then(() => getEventArchive(id));
    const era = resolveEra(id, 'eventEras');
    return era ? loadEra(era).then(bundle => bundle.events.find(event => event.id === id)) : Promise.resolve(undefined);
  }
  function getPersonArchive(id: string): Promise<PersonArchive | undefined> {
    if (!state.manifest) return initialize().then(() => getPersonArchive(id));
    const era = resolveEra(id, 'personEras');
    return era ? loadEra(era).then(bundle => bundle.people.find(person => person.id === id)) : Promise.resolve(undefined);
  }
  const retry = (eraId?: string) => eraId ? loadEra(eraId).then(() => undefined) : initialize();
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    initialize, getEventArchive, getPersonArchive, retry
  };
}
type Store = ReturnType<typeof createContentStore>;
type HistoryContent = ContentState & Pick<Store, 'getEventArchive' | 'getPersonArchive' | 'retry'>;
const HistoryContentContext = createContext<HistoryContent | null>(null);
export function HistoryContentProvider({ children, loader = historyContentLoader }: { children: ReactNode; loader?: HistoryContentLoader }) {
  const store = useMemo(() => createContentStore(loader), [loader]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void store.initialize().catch(() => { /* The context exposes the typed error for UI consumers. */ }); }, [store]);
  const value = useMemo(() => ({ ...state, getEventArchive: store.getEventArchive, getPersonArchive: store.getPersonArchive, retry: store.retry }), [state, store]);
  return <HistoryContentContext.Provider value={value}>{children}</HistoryContentContext.Provider>;
}
export function useHistoryContent() {
  const content = useContext(HistoryContentContext);
  if (!content) throw new Error('useHistoryContent must be used inside HistoryContentProvider');
  return content;
}
