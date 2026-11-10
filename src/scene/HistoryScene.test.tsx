import { Children, isValidElement } from 'react';
import { renderHook } from '@testing-library/react';
import { SceneContents } from './HistoryScene';
import { EventStar } from './EventStar';
import { historyEvents } from '../history/events';
it('builds scene stars from the supplied compact view and handles an empty loading view', () => {
  const events = [{ ...historyEvents[0], id: 'compact-only', title: '异步索引' }];
  const { result, rerender } = renderHook(({ events }) => SceneContents({ events, selectedEvent: null, hoveredId: null, resetSignal: 0, selectionSignal: 0, reducedMotion: true, onSelect: () => {}, onHover: () => {}, onTravelYear: () => {} }), { initialProps: { events } });
  const stars = () => Children.toArray(result.current.props.children).filter(child => isValidElement(child) && child.type === EventStar);
  expect(stars()).toHaveLength(1);
  expect(isValidElement<{ event: { title: string } }>(stars()[0]) && stars()[0].props.event.title).toBe('异步索引');
  rerender({ events: [] });
  expect(stars()).toHaveLength(0);
});
