import { getDynastyForYear, influenceToScale, xToYear, yearToX } from './space';

describe('history spatial mappings', () => {
  it('maps the historical range to the full scene width and clamps overflow', () => {
    expect(yearToX(-2070)).toBe(-32);
    expect(yearToX(1949)).toBe(32);
    expect(yearToX(-3000)).toBe(-32);
    expect(yearToX(3000)).toBe(32);
    expect(yearToX(1840)).toBe(16);
    expect(yearToX(618)).toBe(-4);
  });

  it('round trips BCE/CE boundaries without a year zero', () => {
    const years = [-2070, -1600, -221, -2, -1, 1, 2, 220, 618, 907, 1271, 1644, 1839, 1840, 1911, 1949];
    for (const year of years) expect(Math.abs(xToYear(yearToX(year)) - year)).toBeLessThanOrEqual(1);
    for (let i = 1; i < years.length; i++) expect(yearToX(years[i])).toBeGreaterThan(yearToX(years[i - 1]));
    expect(yearToX(0)).toBe(yearToX(1));
    expect(xToYear((yearToX(-1) + yearToX(1)) / 2)).toBe(1);
    expect(yearToX(1949) - yearToX(1840)).toBe(16);
    expect(getDynastyForYear(-2070).id).toBe('tang');
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
    expect(xToYear(-32)).toBe(-2070);
    expect(xToYear(32)).toBe(1949);
    expect(xToYear(-4)).toBe(618);
    expect(xToYear(80)).toBe(1949);
  });
});
