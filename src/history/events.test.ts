import { dynasties, historyEvents } from './events';
import { getDynastyForYear, getDynastyLeadEvent } from './space';
import { readFileSync } from 'node:fs';
const productionCount = JSON.parse(readFileSync('public/history-content/generated/manifest.json', 'utf8')).eventCount;

describe('historyEvents', () => {
  it('ships a chronological collection of unique production events', () => {
    expect(historyEvents).toHaveLength(productionCount);
    expect(new Set(historyEvents.map((event) => event.id)).size).toBe(productionCount);
    expect(historyEvents.map((event) => event.year)).toEqual(
      [...historyEvents].sort((a, b) => a.year - b.year).map((event) => event.year)
    );
    expect(historyEvents[0].year).toBe(-1750);
    expect(historyEvents.at(-1)?.year).toBe(1949);
  });

  it('keeps every event story playable and within the influence scale', () => {
    for (const event of historyEvents) {
      expect(event.title.trim().length).toBeGreaterThan(0);
      expect(event.summary.trim().length).toBeGreaterThan(0);
      expect(event.story.length).toBeGreaterThan(45);
      expect(Array.isArray(event.people)).toBe(true);
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
    expect(getDynastyLeadEvent('song', historyEvents)?.title).toBe('陈桥兵变');
    expect(getDynastyLeadEvent('modern', historyEvents)?.title).toBe('鸦片战争');
  });

  it('provides a navigable lead event for every era, including transitional eras', () => {
    for (const dynasty of dynasties) {
      const lead = getDynastyLeadEvent(dynasty.id, historyEvents);
      expect(lead).toBeDefined();
      expect(historyEvents.some(event => event.id === lead?.id)).toBe(true);
    }
  });
});
