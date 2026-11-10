import { act, renderHook } from '@testing-library/react';
import { historyEvents } from '../history/events';
import { EventStar } from './EventStar';

vi.mock('@react-three/fiber', () => ({ useFrame: () => {} }));

it.each([false, true])('carries the instance pointer-down into rich-star %s dragging and preserves click selection', dragging => {
  const target = document.createElement('canvas'); target.setPointerCapture = vi.fn(); target.releasePointerCapture = vi.fn(); target.hasPointerCapture = () => true;
  const start = { pointerId: 7, clientX: 100, clientY: 100, target };
  const onDragOffset = vi.fn(), onSelect = vi.fn(), onDragStateChange = vi.fn();
  const { unmount } = renderHook(() => EventStar({ event: historyEvents[0], dragOffset: [0, 0], dragStart: start, hovered: false, selected: false, reducedMotion: true, onHover: vi.fn(), onDragOffset, onSelect, onDragStateChange }));
  const pointer = (type: string, clientX: number, clientY: number) => { const event = new Event(type); Object.assign(event, { pointerId: 7, clientX, clientY }); act(() => window.dispatchEvent(event)); };
  expect(onDragStateChange).toHaveBeenCalledWith(true);
  if (dragging) pointer('pointermove', 120, 90);
  expect(onDragOffset).not.toHaveBeenCalled();
  pointer('pointerup', dragging ? 120 : 100, dragging ? 90 : 100);
  if (dragging) { expect(onDragOffset).toHaveBeenCalledWith(historyEvents[0].id, [0.12, 0.2]); expect(onSelect).not.toHaveBeenCalled(); }
  else { expect(onSelect).toHaveBeenCalledWith(historyEvents[0]); expect(onDragOffset).not.toHaveBeenCalled(); }
  expect(onDragStateChange).toHaveBeenLastCalledWith(false);
  unmount();
});

it('notifies scene promotion before beginning a pointer-down on an already rich star', () => {
  const target = document.createElement('canvas'); target.setPointerCapture = vi.fn();
  const order: string[] = [], onSelect = vi.fn();
  const onDragStart = vi.fn(() => order.push('promote'));
  const { result, unmount } = renderHook(() => EventStar({ event: historyEvents[0], selected: false, hovered: true, dragOffset: [0, 0], reducedMotion: true, onSelect, onHover: vi.fn(), onDragOffset: vi.fn(), onDragStart, onDragStateChange: dragging => { if (dragging) order.push('capture'); } }));
  act(() => result.current.props.onPointerDown({ pointerId: 7, nativeEvent: { target, clientX: 100, clientY: 100 }, stopPropagation: vi.fn() }));
  expect(order).toEqual(['promote', 'capture']);
  expect(onDragStart).toHaveBeenCalledWith(historyEvents[0], { pointerId: 7, clientX: 100, clientY: 100, target });
  const up = new Event('pointerup'); Object.assign(up, { pointerId: 7, clientX: 100, clientY: 100 }); act(() => window.dispatchEvent(up));
  expect(onSelect).toHaveBeenCalledWith(historyEvents[0]);
  unmount();
});
