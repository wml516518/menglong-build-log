import { readFileSync } from 'node:fs';
import type { CompactHistoryEventIndex } from '../../src/history/content/schema';
import { legacyEventIds } from './historyArchives';

export function productionFixture(path: string, eventIds?: ReadonlySet<string>) {
  const value = JSON.parse(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
  if (!eventIds) return value;
  const events: CompactHistoryEventIndex[] = JSON.parse(readFileSync('public/history-content/generated/indexes/events.compact.json', 'utf8'));
  const selected = events.filter(event => eventIds.has(event.id));
  if (path === 'manifest.json') {
    value.eventCount = selected.length;
    value.structuredEventCount = selected.length;
    value.basicEventCount = selected.filter(event => event.detailLevel === 'basic').length;
    value.coreEventCount = selected.filter(event => event.detailLevel === 'core').length;
    value.eventEras = Object.fromEntries(selected.map(event => [event.id, event.eraId]));
    value.periodCounts = Object.fromEntries(Object.keys(value.periodCounts).map(id => [id, selected.filter(event => event.editorialPeriodId === id).length]));
  }
  if (path === 'indexes/events.compact.json') return selected;
  if (path.startsWith('eras/')) value.events = value.events.filter((event: { id: string }) => eventIds.has(event.id));
  return value;
}

export const representativeEventIds = new Set([...legacyEventIds, 'shang-yang-reform', 'nanjing-treaty']);
