import { useCallback, useEffect, useMemo, useState } from 'react';
import { historyEvents } from './events';
import type { DynastyId, HistoryEvent } from './types';
import { getDynastyLeadEvent } from './space';

export function useHistoryNavigation(
  onEventChange?: (event: HistoryEvent) => void,
  onDynastyChange?: (dynastyId: DynastyId, event: HistoryEvent) => void
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [selectionSignal, setSelectionSignal] = useState(0);

  const selectedEvent = useMemo(
    () => historyEvents.find((event) => event.id === selectedId) ?? null,
    [selectedId]
  );

  const selectEvent = useCallback((eventOrId: HistoryEvent | string) => {
    const event = typeof eventOrId === 'string'
      ? historyEvents.find((candidate) => candidate.id === eventOrId)
      : eventOrId;
    if (!event) return;
    setSelectedId(event.id);
    setSelectionSignal((value) => value + 1);
    onEventChange?.(event);
  }, [onEventChange]);

  const closeStory = useCallback(() => setSelectedId(null), []);

  const moveSelection = useCallback((direction: -1 | 1) => {
    const currentIndex = selectedId
      ? historyEvents.findIndex((event) => event.id === selectedId)
      : direction === 1
        ? -1
        : 0;
    const nextIndex = (currentIndex + direction + historyEvents.length) % historyEvents.length;
    const event = historyEvents[nextIndex];
    setSelectedId(event.id);
    onEventChange?.(event);
  }, [onEventChange, selectedId]);

  const selectDynasty = useCallback((dynastyId: DynastyId) => {
    const event = getDynastyLeadEvent(dynastyId);
    setSelectedId(event.id);
    setSelectionSignal((value) => value + 1);
    onDynastyChange?.(dynastyId, event);
  }, [onDynastyChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelection(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.key === 'Escape') {
        closeStory();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeStory, moveSelection]);

  return {
    closeStory,
    hoveredId,
    moveSelection,
    resetSignal,
    selectDynasty,
    selectEvent,
    selectionSignal,
    selectedEvent,
    setHoveredId,
    triggerReset: () => setResetSignal((value) => value + 1)
  };
}
