import { dynasties, historyEvents } from './events';
import { getDynastyForYear, getDynastyLeadEvent } from './space';

describe('historyEvents', () => {
  it('ships a complete chronological collection of thirty unique events', () => {
    expect(historyEvents).toHaveLength(30);
    expect(new Set(historyEvents.map((event) => event.id)).size).toBe(30);
    expect(historyEvents.map((event) => event.year)).toEqual(
      [...historyEvents].sort((a, b) => a.year - b.year).map((event) => event.year)
    );
    expect(historyEvents[0].year).toBe(627);
    expect(historyEvents.at(-1)?.year).toBe(1949);
  });

  it('keeps every event story playable and within the influence scale', () => {
    for (const event of historyEvents) {
      expect(event.title.trim().length).toBeGreaterThan(0);
      expect(event.summary.trim().length).toBeGreaterThan(0);
      expect(event.story.length).toBeGreaterThan(45);
      expect(event.people.length).toBeGreaterThan(0);
      expect(event.influence).toBeGreaterThanOrEqual(1);
      expect(event.influence).toBeLessThanOrEqual(5);
      expect(event.offset).toHaveLength(2);
    }
  });

  it('defines seven contiguous navigation eras covering 618 through 1949', () => {
    expect(dynasties).toHaveLength(7);
    expect(dynasties[0]).toMatchObject({ id: 'tang', start: 618, end: 907 });
    expect(dynasties.at(-1)).toMatchObject({ id: 'modern', start: 1840, end: 1949 });
    expect(getDynastyForYear(1840).id).toBe('modern');
  });

  it('returns the most influential chronological lead event for an era', () => {
    expect(getDynastyLeadEvent('song').title).toBe('陈桥兵变');
    expect(getDynastyLeadEvent('modern').title).toBe('鸦片战争');
  });

  it('provides a navigable lead event for every era, including transitional eras', () => {
    expect(dynasties.map((dynasty) => getDynastyLeadEvent(dynasty.id).title)).toEqual([
      '贞观之治',
      '陈桥兵变',
      '陈桥兵变',
      '元朝建立',
      '郑和下西洋',
      '明朝灭亡',
      '鸦片战争'
    ]);
  });
});
