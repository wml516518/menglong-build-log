import type { CompactHistoryEventIndex, PersonIndex } from './schema';
import type { HistoryEvent } from '../types';
import { dynasties } from '../dynasties';
import { getDynastyForYear } from '../space';

/** Transitional scene fields, derived only from compact content; prose stays lazy. */
export function compactEventsForScene(events: CompactHistoryEventIndex[], people: PersonIndex[]): HistoryEvent[] {
  const names = new Map(people.map(person => [person.id, person.name]));
  return events.map(event => ({
    ...event,
    dynasty: dynasties.find(era => era.id === event.eraId)?.id ?? getDynastyForYear(event.year).id,
    people: event.personIds.map(id => names.get(id) ?? id),
    offset: event.layout.offset,
    story: ''
  }));
}
