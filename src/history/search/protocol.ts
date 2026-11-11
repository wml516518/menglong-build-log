import type { CategoryId, CompactHistoryEventIndex, PersonIndex, PlaceIndex } from '../content/schema';

export interface SearchIndexes {
  events: readonly CompactHistoryEventIndex[];
  people: readonly PersonIndex[];
  places?: readonly PlaceIndex[];
  themes?: readonly { id: string; title: string; summary: string; eventIds: string[] }[];
}
export interface SearchDocument {
  id: string;
  title: string;
  aliases: string[];
  personNames: string[];
  placeNames: string[];
  themeNames: string[];
  summary: string;
  searchText: string;
  categories: CategoryId[];
  year: number;
  influence: number;
}
export interface SearchFilters {
  /** Any selected category, combined with inclusive representative-year bounds. */
  categories?: readonly CategoryId[];
  startYear?: number;
  endYear?: number;
}
export interface SearchQuery { text: string; filters?: SearchFilters; limit?: number }
export interface SearchResult { id: string; title: string; year: number; influence: number; score: number }
export type SearchRequest =
  | { type: 'init'; requestId: number; documents: SearchDocument[] }
  | { type: 'query'; requestId: number; query: SearchQuery };
export type SearchResponse =
  | { type: 'ready'; requestId: number }
  | { type: 'result'; requestId: number; results: SearchResult[] }
  | { type: 'error'; requestId: number; message: string };
export interface SearchWorker {
  onmessage: ((event: MessageEvent<SearchResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: SearchRequest): void;
  terminate(): void;
}
export type SearchWorkerFactory = () => SearchWorker;
