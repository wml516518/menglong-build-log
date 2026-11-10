import type { HistoryEvent } from '../history/types';

interface EventNavigatorProps {
  events: HistoryEvent[];
  selectedEvent: HistoryEvent | null;
  onSelect: (event: HistoryEvent) => void;
  isFallback?: boolean;
  eventOpacities?: ReadonlyMap<string, number>;
  integratedExplorer?: boolean;
}

export function EventNavigator({ events, selectedEvent, onSelect, isFallback = false, eventOpacities, integratedExplorer = false }: EventNavigatorProps) {
  return (
    <div className={`event-navigator ${isFallback ? 'is-fallback' : ''} ${integratedExplorer ? 'has-explorer' : ''}`} aria-label="历史事件列表">
      {events.map((event) => (
        <button
          type="button"
          key={event.id}
          data-event-id={event.id}
          data-match={(eventOpacities?.get(event.id) ?? 1) === 1}
          data-opacity={eventOpacities?.get(event.id) ?? 1}
          style={{ opacity: eventOpacities?.get(event.id) ?? 1 }}
          tabIndex={integratedExplorer ? -1 : undefined}
          aria-label={`查看历史事件：${event.year}年 ${event.title}`}
          aria-pressed={selectedEvent?.id === event.id}
          onClick={() => onSelect(event)}
        >
          {event.year}年 {event.title}
        </button>
      ))}
    </div>
  );
}
