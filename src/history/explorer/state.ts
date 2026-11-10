import { categoryIds, type CategoryId, type CompactHistoryEventIndex } from '../content/schema';

export interface HistoryExplorerState {
  text: string;
  eraIds: string[];
  categories: CategoryId[];
  personIds: string[];
  placeIds: string[];
  minInfluence: 1 | 2 | 3 | 4 | 5;
  fromYear: number;
  toYear: number;
  majorOnly: boolean;
  viewportOnly: boolean;
  themeIds: string[];
}

const keys = ['q', 'era', 'cat', 'person', 'place', 'min', 'from', 'to', 'major', 'view', 'theme'] as const;
const START_YEAR = -2070;
const END_YEAR = 1949;
const sortedUnique = (values: readonly string[]) => [...new Set(values)].sort();
const list = (params: URLSearchParams, key: string) => sortedUnique(params.getAll(key).map(value => value.trim()).filter(value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)));

function integer(value: string | null, fallback: number): number {
  if (value === null || !/^-?\d+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}
function year(value: string | null, fallback: number): number {
  const number = integer(value, fallback);
  return number === 0 ? fallback : Math.max(START_YEAR, Math.min(END_YEAR, number));
}

/** Repeated keys form OR lists; the first scalar wins, including malformed values. */
export function parseExplorerState(params: URLSearchParams): HistoryExplorerState {
  const from = year(params.get('from'), START_YEAR);
  const to = year(params.get('to'), END_YEAR);
  return {
    text: (params.get('q') ?? '').trim(),
    eraIds: list(params, 'era'),
    categories: list(params, 'cat').filter((value): value is CategoryId => categoryIds.includes(value as CategoryId)),
    personIds: list(params, 'person'),
    placeIds: list(params, 'place'),
    minInfluence: Math.max(1, Math.min(5, integer(params.get('min'), 1))) as HistoryExplorerState['minInfluence'],
    fromYear: Math.min(from, to), toYear: Math.max(from, to),
    majorOnly: params.get('major') === '1', viewportOnly: params.get('view') === '1',
    themeIds: list(params, 'theme'),
  };
}

/** Returns a copy: archive routing and unrelated duplicate parameters survive unchanged. */
export function serializeExplorerState(state: HistoryExplorerState, base = new URLSearchParams()): URLSearchParams {
  const raw = new URLSearchParams();
  raw.set('q', state.text);
  for (const [key, values] of [['era', state.eraIds], ['cat', state.categories], ['person', state.personIds], ['place', state.placeIds], ['theme', state.themeIds]] as const) {
    values.forEach(value => raw.append(key, value));
  }
  raw.set('min', String(state.minInfluence));
  raw.set('from', String(state.fromYear));
  raw.set('to', String(state.toYear));
  if (state.majorOnly) raw.set('major', '1');
  if (state.viewportOnly) raw.set('view', '1');
  const normalized = parseExplorerState(raw);
  const result = new URLSearchParams(base);
  keys.forEach(key => result.delete(key));
  if (normalized.text) result.append('q', normalized.text);
  normalized.eraIds.forEach(value => result.append('era', value));
  normalized.categories.forEach(value => result.append('cat', value));
  normalized.personIds.forEach(value => result.append('person', value));
  normalized.placeIds.forEach(value => result.append('place', value));
  if (normalized.minInfluence !== 1) result.append('min', String(normalized.minInfluence));
  if (normalized.fromYear !== START_YEAR) result.append('from', String(normalized.fromYear));
  if (normalized.toYear !== END_YEAR) result.append('to', String(normalized.toYear));
  if (normalized.majorOnly) result.append('major', '1');
  if (normalized.viewportOnly) result.append('view', '1');
  normalized.themeIds.forEach(value => result.append('theme', value));
  return result;
}

const overlaps = (selected: readonly string[], actual: readonly string[]) => selected.length === 0 || selected.some(value => actual.includes(value));

/** Dimming preserves the scene's context and event identity. A viewport filter needs explicit membership. */
export function filterEvents<T extends CompactHistoryEventIndex>(events: readonly T[], state: HistoryExplorerState, viewportIds?: ReadonlySet<string>): { event: T; match: boolean; opacity: number }[] {
  const text = state.text.trim().toLocaleLowerCase();
  return events.map(event => {
    const match = (!text || [event.title, event.summary, ...event.aliases].some(value => value.toLocaleLowerCase().includes(text)))
      && overlaps(state.eraIds, [event.eraId])
      && overlaps(state.categories, event.categories)
      && overlaps(state.personIds, event.personIds)
      && overlaps(state.placeIds, event.placeIds)
      && overlaps(state.themeIds, event.themeIds)
      && event.influence >= state.minInfluence
      && (!state.majorOnly || event.influence === 5)
      && event.endYear >= state.fromYear && event.startYear <= state.toYear
      && (!state.viewportOnly || viewportIds?.has(event.id) === true);
    return { event, match, opacity: match ? 1 : 0.15 };
  });
}
