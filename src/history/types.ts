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

export interface HistoryEvent {
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
