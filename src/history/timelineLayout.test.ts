import { createTimelineLayout } from './timelineLayout';

it('preserves chronological order and separates same-year events independently of incoming catalog order', () => {
  const events = [{ id: 'b', year: 618 }, { id: 'a', year: 618 }, { id: 'c', year: 619 }];
  const timeline = createTimelineLayout(events);
  expect([...timeline.eventXs]).toEqual([...createTimelineLayout([...events].reverse()).eventXs]);
  expect(timeline.eventXs.get('b')! - timeline.eventXs.get('a')!).toBeCloseTo(2.4);
  expect(timeline.eventXs.get('c')! - timeline.eventXs.get('b')!).toBeCloseTo(2.4);
  expect(timeline.yearToX(618)).toBeCloseTo((timeline.eventXs.get('a')! + timeline.eventXs.get('b')!) / 2);
});

it('keeps a usable inverse calendar, bounds and default-year origin across BCE and dense modern dates', () => {
  const years = [-2070, -1, 1, 618, 701, 1840, 1911, 1949];
  const timeline = createTimelineLayout(years.map(year => ({ id: String(year), year })));
  expect(timeline.yearToX(701)).toBeCloseTo(0);
  for (const year of [...years, -2000, -221, 220, 907, 1271, 1644, 1900, 1948]) expect(timeline.xToYear(timeline.yearToX(year))).toBe(year);
  expect(timeline.yearToX(0)).toBe(timeline.yearToX(1));
  expect(timeline.xToYear(-1e6)).toBe(-2070);
  expect(timeline.xToYear(1e6)).toBe(1949);
  expect(timeline.minX).toBeLessThan(timeline.eventXs.get('-2070')!);
  expect(timeline.maxX).toBeGreaterThan(timeline.eventXs.get('1949')!);
});

it.each([[[]], [[{ id: 'only', year: 701 }]]])('handles a loading or single-record catalog without invalid camera coordinates: %j', events => {
  const timeline = createTimelineLayout(events);
  expect(Number.isFinite(timeline.yearToX(701))).toBe(true);
  expect(timeline.minX).toBeLessThan(timeline.maxX);
  expect(timeline.xToYear(timeline.yearToX(701))).toBe(701);
});
