import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveSessionExplorer, type HistoryExplorerEntityIds } from '../session';
import { HistorySearchClient } from '../search/client';
import type { SearchIndexes, SearchResult } from '../search/protocol';
import { filterEvents, parseExplorerState, serializeExplorerState, type HistoryExplorerState } from './state';

const DEBOUNCE_MS = 150;
const emptyResults: SearchResult[] = [];
function currentState() { return parseExplorerState(new URLSearchParams(window.location.hash.split('?')[1])); }
function writeLocation(state: HistoryExplorerState, replace: boolean) {
  const [path = '#/history-galaxy', query] = window.location.hash.split('?');
  const params = serializeExplorerState(state, new URLSearchParams(query));
  const hash = `${path || '#/history-galaxy'}${params.size ? `?${params}` : ''}`;
  if (hash === window.location.hash) return;
  window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`);
}
const aborted = (error: unknown) => error instanceof Error && error.name === 'AbortError';

/** The URL owns committed filters; text stays local until its single replace write settles. */
export function useHistoryExplorer(indexes: SearchIndexes, viewportIds: ReadonlySet<string>, ready = true, storedState?: HistoryExplorerState, storedEntityIds?: HistoryExplorerEntityIds) {
  const [state, setState] = useState(currentState);
  const restoreStored = useRef(storedState);
  const [restorationPending, setRestorationPending] = useState(Boolean(storedState));
  const latest = useRef(state);
  const urlTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [client, setClient] = useState<HistorySearchClient | null>(null);
  const [response, setResponse] = useState<{ text: string; indexes: SearchIndexes; results: SearchResult[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cancelUrlWrite = useCallback(() => { clearTimeout(urlTimer.current); urlTimer.current = undefined; }, []);
  const commit = useCallback((next: HistoryExplorerState, replace: boolean) => {
    // A user action during loading takes precedence over the pending session.
    restoreStored.current = undefined;
    setRestorationPending(false);
    latest.current = next;
    setState(next);
    if (replace) {
      cancelUrlWrite();
      urlTimer.current = setTimeout(() => { urlTimer.current = undefined; writeLocation(latest.current, true); }, DEBOUNCE_MS);
    } else { cancelUrlWrite(); writeLocation(next, false); }
  }, [cancelUrlWrite]);
  const changeText = useCallback((text: string) => commit({ ...latest.current, text }, true), [commit]);
  const changeFilters = useCallback((patch: Partial<Omit<HistoryExplorerState, 'text'>>) => {
    const next = { ...latest.current, ...patch };
    commit(parseExplorerState(serializeExplorerState(next)), false);
  }, [commit]);
  const clear = useCallback(() => commit(parseExplorerState(new URLSearchParams()), false), [commit]);
  useEffect(() => {
    if (!ready || !restoreStored.current) return;
    const next = resolveSessionExplorer(restoreStored.current, new URLSearchParams(window.location.hash.split('?')[1]), storedEntityIds);
    restoreStored.current = undefined;
    latest.current = next;
    setState(next);
    setRestorationPending(false);
    if (serializeExplorerState(next).toString() !== serializeExplorerState(currentState()).toString()) writeLocation(next, true);
  }, [ready, storedEntityIds]);
  useEffect(() => {
    const restore = () => { cancelUrlWrite(); const next = currentState(); latest.current = next; setState(next); };
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => { cancelUrlWrite(); window.removeEventListener('hashchange', restore); window.removeEventListener('popstate', restore); };
  }, [cancelUrlWrite]);
  useEffect(() => {
    if (!ready) { setClient(null); return; }
    const next = new HistorySearchClient({ indexes });
    setClient(next);
    setFallback(next.isFallback);
    return () => next.dispose();
  }, [indexes, ready]);
  useEffect(() => {
    let active = true;
    setSearchError(false);
    if (!client || !state.text.trim()) { setSearching(false); return; }
    setSearching(true);
    const text = state.text;
    const timer = setTimeout(() => {
      const query = { text, limit: indexes.events.length };
      const search = async () => {
        try {
          let results: SearchResult[];
          try { results = await client.query(query); }
          catch (error) {
            if (aborted(error) || !active) return;
            // A failed Worker is now permanently in fallback. Re-run this same
            // query once so a transport failure never leaves the UI unusable.
            setFallback(true);
            results = await client.query(query);
          }
          if (active) { setFallback(client.isFallback); setResponse({ text, indexes, results }); }
        } catch (error) {
          if (active && !aborted(error)) { setSearchError(true); setResponse({ text, indexes, results: [] }); }
        } finally { if (active) setSearching(false); }
      };
      void search();
    }, DEBOUNCE_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [client, indexes, state.text, attempt]);
  const results = response?.text === state.text && response.indexes === indexes ? response.results : emptyResults;
  const hasText = Boolean(state.text.trim());
  const filtered = useMemo(() => {
    const textIds = new Set(results.map(result => result.id));
    return filterEvents(indexes.events, { ...state, text: '' }, viewportIds).map(item => {
      const match = item.match && (!hasText || textIds.has(item.event.id));
      return { event: item.event, match, opacity: match ? 1 : 0.15 };
    });
  }, [indexes.events, state, viewportIds, hasText, results]);
  const matchingIds = useMemo(() => new Set(filtered.filter(item => item.match).map(item => item.event.id)), [filtered]);
  const searchResults = useMemo(() => results.filter(result => matchingIds.has(result.id)), [results, matchingIds]);
  const eventOpacities = useMemo(() => new Map(filtered.map(item => [item.event.id, item.opacity])), [filtered]);
  const searchTargetIds = useMemo(() => hasText ? searchResults.map(result => result.id) : [], [hasText, searchResults]);
  return { state, restorationPending, changeText, changeFilters, clear, filtered, matchingIds, eventOpacities, searchResults, searchTargetIds, searching, fallback, searchError, retrySearch: () => setAttempt(value => value + 1) };
}
export type HistoryExplorerController = ReturnType<typeof useHistoryExplorer>;
