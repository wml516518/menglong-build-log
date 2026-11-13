import { DEFAULT_HISTORY_YEAR, xToYear, yearToX } from './space';

export const TIMELINE_LAYOUT_VERSION = 'spaced-v1' as const;
export interface TimelineLayout {
  eventXs: ReadonlyMap<string, number>;
  minX: number;
  maxX: number;
  yearToX: (year: number) => number;
  xToYear: (x: number) => number;
}
type Knot = readonly [number, number];
const ordinal = (year: number) => year > 0 ? year - 1 : year;

function interpolate(knots: readonly Knot[], value: number, axis: 0 | 1): number {
  const other = axis === 0 ? 1 : 0;
  if (value <= knots[0][axis]) return knots[0][other];
  let low = 0, high = knots.length - 1;
  if (value >= knots[high][axis]) return knots[high][other];
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (knots[mid][axis] <= value) low = mid; else high = mid;
  }
  const a = knots[low], b = knots[high];
  return a[other] + (value - a[axis]) / (b[axis] - a[axis]) * (b[other] - a[other]);
}

/** Stretch dense dates instead of stacking their spheres. Stable IDs break ties
 * within a year; the date tick stays at that year's group center. Build from the
 * full catalog so filtering, hovering and selection never move other events. */
export function createTimelineLayout(events: readonly { id: string; year: number }[]): TimelineLayout {
  if (!events.length) return { eventXs: new Map(), minX: -34, maxX: 34, yearToX, xToYear };
  const ordered = [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  const raw = new Map<string, number>();
  const dates = new Map<number, number[]>();
  let previous = -Infinity;
  for (const event of ordered) {
    // 2.4 units clear even two maximum-size selected/hovered halos. Sparse
    // intervals retain chronology-derived space rather than collapsing to rank.
    const x = Math.max(yearToX(event.year) * 4, previous + 2.4);
    raw.set(event.id, x); previous = x;
    const group = dates.get(event.year) ?? []; group.push(x); dates.set(event.year, group);
  }
  const knots: Knot[] = [...dates].map(([year, xs]) => [ordinal(year), (xs[0] + xs[xs.length - 1]) / 2]);
  if (ordered[0].year > -2070) knots.unshift([ordinal(-2070), knots[0][1] - (yearToX(ordered[0].year) - yearToX(-2070)) * 4]);
  if (ordered[ordered.length - 1].year < 1949) knots.push([ordinal(1949), previous + (yearToX(1949) - yearToX(ordered[ordered.length - 1].year)) * 4]);
  const origin = interpolate(knots, ordinal(DEFAULT_HISTORY_YEAR), 0);
  const centered = knots.map(([year, x]) => [year, x - origin] as const);
  const eventXs = new Map([...raw].map(([id, x]) => [id, x - origin]));
  return {
    eventXs,
    minX: Math.min(centered[0][1], eventXs.get(ordered[0].id)!) - 4,
    maxX: Math.max(centered[centered.length - 1][1], eventXs.get(ordered[ordered.length - 1].id)!) + 4,
    yearToX: year => interpolate(centered, ordinal(year === 0 ? 1 : year), 0),
    xToYear: x => {
      const year = Math.floor(interpolate(centered, x, 1) + 0.5 + 1e-9);
      return year >= 0 ? year + 1 : year;
    }
  };
}
