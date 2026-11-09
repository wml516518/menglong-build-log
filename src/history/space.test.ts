import { getDynastyForYear, influenceToScale, xToYear, yearToX } from './space';

describe('history spatial mappings', () => {
  it('maps the historical range to the full scene width and clamps overflow', () => {
    expect(yearToX(618)).toBe(-32);
    expect(yearToX(1949)).toBe(32);
    expect(yearToX(0)).toBe(-32);
    expect(yearToX(3000)).toBe(32);
    expect(yearToX(1283)).toBeCloseTo(-0.024, 2);
  });

  it('maps influence levels to deliberately separated star radii', () => {
    expect([1, 2, 3, 4, 5].map(influenceToScale)).toEqual([0.18, 0.24, 0.31, 0.39, 0.5]);
  });

  it('uses the later era at shared historical boundaries', () => {
    expect(getDynastyForYear(907).id).toBe('five-dynasties');
    expect(getDynastyForYear(960).id).toBe('song');
    expect(getDynastyForYear(1271).id).toBe('yuan');
  });

  it('maps camera travel back to a clamped calendar year', () => {
    expect(xToYear(-32)).toBe(618);
    expect(xToYear(32)).toBe(1949);
    expect(xToYear(0)).toBe(1284);
    expect(xToYear(80)).toBe(1949);
  });
});
