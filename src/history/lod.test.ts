import { getLodLevel, getVisibilityBudget, selectProtectedEventIds } from './lod';
describe('semantic LOD', () => {
  it.each([[0, 'close'], [9.99, 'close'], [10, 'period'], [23.99, 'period'], [24, 'era'], [47.99, 'era'], [48, 'overview']] as const)('classifies %s as %s', (d, level) => expect(getLodLevel(d)).toBe(level));
  it.each([[9, 'period', 'period'], [7.99, 'period', 'close'], [11.99, 'close', 'close'], [12, 'close', 'period'], [22, 'era', 'era'], [19.99, 'era', 'period'], [27.99, 'period', 'period'], [28, 'period', 'era'], [45, 'overview', 'overview'], [41.99, 'overview', 'era'], [53.99, 'era', 'era'], [54, 'era', 'overview'], [100, 'close', 'overview'], [0, 'overview', 'close']] as const)('hysteresis at %s from %s to %s', (d, previous, expected) => expect(getLodLevel(d, previous)).toBe(expected));
  it('handles nonfinite and negative distances', () => {
    expect(getLodLevel(NaN)).toBe('overview'); expect(getLodLevel(Infinity)).toBe('overview'); expect(getLodLevel(-10)).toBe('close');
  });
  it('budgets desktop/mobile detail independently and returns safe copies', () => {
    expect(getVisibilityBudget('overview', false)).toEqual({ stars: 300, labels: 12, relations: 0 });
    expect(getVisibilityBudget('era', false)).toEqual({ stars: 500, labels: 24, relations: 12 });
    expect(getVisibilityBudget('period', false)).toEqual({ stars: 800, labels: 48, relations: 40 });
    expect(getVisibilityBudget('close', false)).toEqual({ stars: 1200, labels: 80, relations: 100 });
    expect(getVisibilityBudget('overview', true)).toEqual({ stars: 120, labels: 6, relations: 0 });
    expect(getVisibilityBudget('era', true)).toEqual({ stars: 200, labels: 12, relations: 6 });
    expect(getVisibilityBudget('period', true)).toEqual({ stars: 300, labels: 20, relations: 20 });
    expect(getVisibilityBudget('close', true)).toEqual({ stars: 400, labels: 30, relations: 30 });
    const budget = getVisibilityBudget('close', false); budget.stars = 0;
    expect(getVisibilityBudget('close', false).stars).toBe(1200);
  });
  it('protects impact 5, selected and search IDs at every level', () => {
    for (const level of ['overview', 'era', 'period', 'close'] as const) expect(selectProtectedEventIds([{ id: 'z', influence: 5 }, { id: 'minor', influence: 2 }, { id: 'a', influence: 5 }], 'minor', ['search', 'a', 'search'], level)).toEqual(['a', 'minor', 'search', 'z']);
    expect(selectProtectedEventIds([], null, [])).toEqual([]);
  });
});
