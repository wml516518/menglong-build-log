import type { SearchDocument, SearchFilters, SearchIndexes, SearchQuery, SearchResult } from './protocol';

/** Locale-independent normalization, shared by worker and fallback. */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu, '');
}

export function buildSearchDocuments(indexes: SearchIndexes): SearchDocument[] {
  const people = new Map(indexes.people.map(person => [person.id, person]));
  const places = new Map((indexes.places ?? []).map(place => [place.id, place]));
  const themes = new Map((indexes.themes ?? []).map(theme => [theme.id, theme]));
  return indexes.events.map(event => {
    const personNames = event.personIds.flatMap(id => {
      const person = people.get(id);
      return person ? [person.name, ...person.aliases] : [];
    });
    const placeNames = event.placeIds.flatMap(id => {
      const place = places.get(id);
      return place ? [place.name, place.modernName, ...place.aliases, ...place.historicalNames.map(name => name.name)] : [];
    });
    const themeNames = event.themeIds.flatMap(id => {
      const theme = themes.get(id);
      return theme ? [theme.title] : [];
    });
    return { id: event.id, title: event.title, aliases: [...event.aliases], personNames, placeNames, themeNames,
      summary: event.summary, searchText: normalizeSearchText([event.title, ...event.aliases, ...personNames, ...placeNames, ...themeNames, event.summary].join(' ')),
      categories: [...event.categories], year: event.year, influence: event.influence };
  });
}

export function matchesSearchFilters(document: SearchDocument, filters?: SearchFilters): boolean {
  return (!filters?.categories?.length || filters.categories.some(category => document.categories.includes(category)))
    && (filters?.startYear === undefined || document.year >= filters.startYear)
    && (filters?.endYear === undefined || document.year <= filters.endYear);
}

/** Explicit match tiers prevent corpus-dependent BM25 scores from outranking names. */
export function matchPriority(document: SearchDocument, normalizedQuery: string): number {
  if (normalizeSearchText(document.title) === normalizedQuery) return 5;
  if (document.aliases.some(alias => normalizeSearchText(alias) === normalizedQuery)) return 4;
  if (document.personNames.some(name => normalizeSearchText(name) === normalizedQuery)) return 3;
  if ([document.title, ...document.aliases, ...document.personNames].some(name => normalizeSearchText(name).includes(normalizedQuery))) return 2;
  return 1;
}

export function rankSearchResults(matches: { document: SearchDocument; score: number }[], query: SearchQuery): SearchResult[] {
  const normalized = normalizeSearchText(query.text);
  const limit = query.limit === undefined ? 20 : Math.max(0, Math.floor(query.limit));
  return matches.filter(({ document }) => matchesSearchFilters(document, query.filters))
    .sort((a, b) => matchPriority(b.document, normalized) - matchPriority(a.document, normalized)
      || b.document.influence - a.document.influence || a.document.year - b.document.year
      || b.score - a.score || (a.document.id < b.document.id ? -1 : a.document.id > b.document.id ? 1 : 0))
    .slice(0, limit)
    .map(({ document, score }) => ({ id: document.id, title: document.title, year: document.year, influence: document.influence, score }));
}

/** Deliberately small, no-network prefix search for the rest of this client session. */
export function fallbackSearch(documents: readonly SearchDocument[], query: SearchQuery): SearchResult[] {
  const text = normalizeSearchText(query.text);
  if (!text) return [];
  return rankSearchResults(documents.filter(document => [document.title, ...document.aliases, ...document.personNames]
    .some(name => normalizeSearchText(name).startsWith(text))).map(document => ({ document, score: 0 })), query);
}
