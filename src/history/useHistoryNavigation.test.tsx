import { act, renderHook } from '@testing-library/react';
import { useHistoryNavigation } from './useHistoryNavigation';
import { historyEvents } from './events';
it('leaves arrow and Escape keys to focused explorer inputs rather than changing scene selection', () => {
  const { result } = renderHook(() => useHistoryNavigation(historyEvents));
  act(() => result.current.selectEvent(historyEvents[0]));
  const input = document.createElement('input'); document.body.append(input); input.focus();
  act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
  expect(result.current.selectedEvent?.id).toBe(historyEvents[0].id);
  act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  expect(result.current.selectedEvent?.id).toBe(historyEvents[0].id);
  input.remove();
});
it('uses only supplied events for selection, keyboard traversal, era leads and empty loading state', () => {
  const supplied = historyEvents.filter(event => event.id === 'chenqiao' || event.id === 'zhenguan').map(event => ({ ...event, title: `紧凑索引 ${event.title}` }));
  const { result, rerender } = renderHook(({ events }) => useHistoryNavigation(events), { initialProps: { events: supplied } });
  act(() => result.current.selectEvent('zhenguan'));
  expect(result.current.selectedEvent?.title).toBe('紧凑索引 贞观之治');
  act(() => result.current.moveSelection(1));
  expect(result.current.selectedEvent?.id).toBe('chenqiao');
  act(() => result.current.selectDynasty('tang'));
  expect(result.current.selectedEvent?.title).toBe('紧凑索引 贞观之治');
  act(() => result.current.selectEvent('opium-war'));
  expect(result.current.selectedEvent?.id).toBe('zhenguan');
  rerender({ events: [] });
  act(() => result.current.moveSelection(1));
  act(() => result.current.selectDynasty('song'));
  expect(result.current.selectedEvent).toBeNull();
});
