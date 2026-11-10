import { dynasties } from './dynasties';
import type { Dynasty, DynastyId, HistoryEvent } from './types';

// Piecewise chronology reserves one quarter of the scene for 1840–1949.
// Ordinal years join 1 BCE directly to 1 CE, with no year zero.
const yearOrdinal = (year: number) => year > 0 ? year - 1 : year;
const chronology = [
  [-2070, -32], [-221, -16], [618, -4], [1271, 4], [1840, 16], [1949, 32],
].map(([year, x]) => [yearOrdinal(year), x] as const);
const influenceRadii = [0, 0.18, 0.24, 0.31, 0.39, 0.5] as const;

function interpolate(value: number, input: 0 | 1): number {
  const output = input === 0 ? 1 : 0;
  const first = chronology[0];
  const last = chronology[chronology.length - 1];
  const clamped = Math.min(last[input], Math.max(first[input], value));
  for (let i = 1; i < chronology.length; i++) {
    const left = chronology[i - 1];
    const right = chronology[i];
    if (clamped <= right[input]) {
      return left[output] + (clamped - left[input]) / (right[input] - left[input]) * (right[output] - left[output]);
    }
  }
  return last[output];
}

export function yearToX(year: number): number {
  return interpolate(yearOrdinal(year === 0 ? 1 : year), 0);
}

export function xToYear(x: number): number {
  // The tiny tolerance makes a halfway point choose the later year despite float noise.
  const ordinal = Math.floor(interpolate(x, 1) + 0.5 + 1e-9);
  return ordinal >= 0 ? ordinal + 1 : ordinal;
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
