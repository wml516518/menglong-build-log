import MiniSearch from 'minisearch';
import { normalizeSearchText, rankSearchResults } from './fallback';
import type { SearchDocument, SearchRequest, SearchResponse } from './protocol';

/** Unigrams support one-character queries; overlapping bigrams support Chinese phrases. */
function characterNgrams(text: string): string[] {
  const characters = Array.from(normalizeSearchText(text));
  return [...new Set([...characters, ...characters.slice(1).map((character, index) => characters[index] + character)])];
}

/** Transport-independent handler, also exercised directly by boundary tests. */
export function createSearchWorkerHandler(send: (response: SearchResponse) => void) {
  let index: MiniSearch | undefined;
  let documents = new Map<string, SearchDocument>();
  return (request: SearchRequest): void => {
    try {
      if (request.type === 'init') {
        const nextIndex = new MiniSearch({
          fields: ['title', 'aliases', 'personNames', 'placeNames', 'themeNames', 'summary', 'searchText'],
          tokenize: characterNgrams,
          searchOptions: { combineWith: 'AND', boost: { title: 8, aliases: 6, personNames: 5, placeNames: 3, themeNames: 2 } }
        });
        nextIndex.addAll(request.documents.map(document => ({ ...document,
          aliases: document.aliases.join(' '), personNames: document.personNames.join(' '),
          placeNames: document.placeNames.join(' '), themeNames: document.themeNames.join(' ') })));
        index = nextIndex;
        documents = new Map(request.documents.map(document => [document.id, document]));
        send({ type: 'ready', requestId: request.requestId });
      } else {
        if (!index) throw new Error('Search worker has not been initialized');
        const normalized = normalizeSearchText(request.query.text);
        const matches = normalized ? index.search(normalized).map(result => ({ document: documents.get(result.id)!, score: result.score })) : [];
        send({ type: 'result', requestId: request.requestId, results: rankSearchResults(matches, request.query) });
      }
    } catch (error) {
      send({ type: 'error', requestId: request.requestId, message: error instanceof Error ? error.message : String(error) });
    }
  };
}

// No Window access or side effects when the handler is imported in tests/SSR.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  const scope = self as unknown as {
    onmessage: ((event: MessageEvent<SearchRequest>) => void) | null;
    postMessage(message: SearchResponse): void;
  };
  const handle = createSearchWorkerHandler(response => scope.postMessage(response));
  scope.onmessage = event => handle(event.data);
}
