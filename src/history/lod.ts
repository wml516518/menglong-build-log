export type LodLevel = 'overview' | 'era' | 'period' | 'close';
export interface VisibilityBudget { stars: number; labels: number; relations: number }

const levels: readonly LodLevel[] = ['close', 'period', 'era', 'overview'];
// Each boundary has a nominal classification, inward entry and outward exit distance.
export const LOD_THRESHOLDS = [
  { nominal: 10, enter: 8, exit: 12 },
  { nominal: 24, enter: 20, exit: 28 },
  { nominal: 48, enter: 42, exit: 54 },
] as const;

export function getLodLevel(cameraDistance: number, previous?: LodLevel): LodLevel {
  const distance = Number.isNaN(cameraDistance) ? Infinity : Math.max(0, cameraDistance);
  if (!previous) return levels[LOD_THRESHOLDS.filter(boundary => distance >= boundary.nominal).length];
  let index = levels.indexOf(previous);
  while (index < 3 && distance >= LOD_THRESHOLDS[index].exit) index++;
  while (index > 0 && distance < LOD_THRESHOLDS[index - 1].enter) index--;
  return levels[index];
}

const desktop: Record<LodLevel, VisibilityBudget> = {
  overview: { stars: 300, labels: 12, relations: 0 },
  era: { stars: 500, labels: 24, relations: 12 },
  period: { stars: 800, labels: 48, relations: 40 },
  close: { stars: 1200, labels: 80, relations: 100 },
};
const mobile: Record<LodLevel, VisibilityBudget> = {
  overview: { stars: 120, labels: 6, relations: 0 },
  era: { stars: 200, labels: 12, relations: 6 },
  period: { stars: 300, labels: 20, relations: 20 },
  close: { stars: 400, labels: 30, relations: 30 },
};
export function getVisibilityBudget(level: LodLevel, isMobile: boolean): VisibilityBudget {
  return { ...(isMobile ? mobile : desktop)[level] };
}

/** Protected IDs take precedence over visibility budgets at every LOD. */
export function selectProtectedEventIds(events: readonly { id: string; influence: number }[], selectedId?: string | null, searchTargetIds: readonly string[] = [], _level?: LodLevel): string[] {
  const ids = new Set(events.filter(event => event.influence === 5).map(event => event.id));
  if (selectedId) ids.add(selectedId);
  searchTargetIds.forEach(id => ids.add(id));
  return [...ids].sort();
}
