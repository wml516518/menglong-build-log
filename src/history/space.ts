import { dynasties } from './dynasties';
import type { Dynasty, DynastyId, HistoryEvent } from './types';

const START_YEAR = 618;
const END_YEAR = 1949;
const HALF_WIDTH = 32;
const influenceRadii = [0, 0.18, 0.24, 0.31, 0.39, 0.5] as const;

export function yearToX(year: number): number {
  const clampedYear = Math.min(END_YEAR, Math.max(START_YEAR, year));
  return ((clampedYear - START_YEAR) / (END_YEAR - START_YEAR)) * HALF_WIDTH * 2 - HALF_WIDTH;
}

export function xToYear(x: number): number {
  const clampedX = Math.min(HALF_WIDTH, Math.max(-HALF_WIDTH, x));
  return Math.round(((clampedX + HALF_WIDTH) / (HALF_WIDTH * 2)) * (END_YEAR - START_YEAR) + START_YEAR);
}

export function influenceToScale(influence: number): number {
  const level = Math.min(5, Math.max(1, Math.round(influence)));
  return influenceRadii[level];
}

export function getDynastyForYear(year: number): Dynasty {
  for (let index = dynasties.length - 1; index >= 0; index -= 1) {
    if (year >= dynasties[index].start) return dynasties[index];
  }
  return dynasties[0];
}

export function getDynastyLeadEvent(dynastyId: DynastyId, historyEvents: HistoryEvent[]): HistoryEvent | undefined {
  const events = historyEvents.filter((event) => event.dynasty === dynastyId);
  if (events.length === 0) {
    const dynasty = dynasties.find((candidate) => candidate.id === dynastyId);
    const transitionalEvent = dynasty
      ? historyEvents.find((event) => event.year >= dynasty.end)
      : undefined;
    if (transitionalEvent) return transitionalEvent;
    return undefined;
  }
  return [...events].sort((a, b) => b.influence - a.influence || a.year - b.year)[0];
}
