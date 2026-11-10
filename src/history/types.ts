export type DynastyId =
  | 'tang'
  | 'five-dynasties'
  | 'song'
  | 'yuan'
  | 'ming'
  | 'qing'
  | 'modern';

export interface Dynasty {
  id: DynastyId;
  name: string;
  start: number;
  end: number;
  color: string;
  inscription: string;
}

export type {
  HistoryEra, HistoryEventArchive, PersonIndex, PersonArchive, PlaceIndex,
  ThemeArchive, SourceRecord, CategoryId, RelationType, YearPrecision
} from './content/schema';

import type { CompactHistoryEventIndex } from './content/schema';

/** Transitional scene view. Task 3 supplies all compact fields from archives. */
export interface HistoryEventIndex extends Partial<Omit<CompactHistoryEventIndex, 'id' | 'year' | 'title' | 'influence' | 'summary' | 'color'>> {
  id: string;
  year: number;
  title: string;
  dynasty: DynastyId;
  influence: 1 | 2 | 3 | 4 | 5;
  people: string[];
  summary: string;
  story: string;
  color: string;
  offset: readonly [number, number];
}

/** Compatibility name retained while the content compiler migrates the scene. */
export type HistoryEvent = HistoryEventIndex;
