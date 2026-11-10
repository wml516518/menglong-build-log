import { Children, isValidElement } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { HistoryScene, SceneContents } from './HistoryScene';
import { EventStar } from './EventStar';
import { historyEvents } from '../history/events';
import { InstancedEventField } from './InstancedEventField';
import { CameraRig } from './CameraRig';
import { ClusterField } from './ClusterField';
import { SceneProjection } from './SceneProjection';
import type { ClusterResult } from '../history/clustering/protocol';

vi.mock('@react-three/fiber', async importOriginal => ({ ...await importOriginal<typeof import('@react-three/fiber')>(), useThree: () => ({ size: { width: 1440, height: 900 } }) }));

const callbacks = () => ({ onSelect: vi.fn(), onHover: vi.fn(), onTravelYear: vi.fn() });
it('does not report failure when the healthy canvas DOM fallback subtree mounts', () => {
  const onUnavailable = vi.fn();
  const canvas = HistoryScene({ events: [], selectedEvent: null, hoveredId: null, resetSignal: 0, selectionSignal: 0, reducedMotion: true, ...callbacks(), onUnavailable });
  // R3F always mounts this subtree inside <canvas>, even when WebGL succeeds.
  render(<canvas>{canvas.props.fallback}</canvas>);
  expect(onUnavailable).not.toHaveBeenCalled();
});
function children(tree: any) { return Children.toArray(tree.props.children).filter(isValidElement) as any[]; }
it('batches the supplied compact view and handles an empty loading view', () => {
  const events = [{ ...historyEvents[0], id: 'compact-only', title: '异步索引' }];
  const { result, rerender } = renderHook(({ events }) => SceneContents({ events, selectedEvent: null, hoveredId: null, resetSignal: 0, selectionSignal: 0, reducedMotion: true, onSelect: () => {}, onHover: () => {}, onTravelYear: () => {} }), { initialProps: { events } });
  const field = () => children(result.current).find(child => child.type === InstancedEventField);
  expect(field()?.props.events.map((event: any) => event.title)).toEqual(['异步索引']);
  expect(children(result.current).filter(child => child.type === EventStar)).toHaveLength(0);
  rerender({ events: [] });
  expect(field()?.props.events).toEqual([]);
});

it('excludes selected/drag-promoted stars from batching and restores only released offsets to the batch', () => {
  const events = Array.from({ length: 1200 }, (_, index) => ({ ...historyEvents[0], id: `event-${index}`, influence: (index === 0 ? 5 : 1) as 1 | 5 }));
  const { result } = renderHook(() => SceneContents({ events, selectedEvent: events[17], hoveredId: null, resetSignal: 0, selectionSignal: 0, reducedMotion: true, ...callbacks() }));
  const ofType = (type: unknown) => children(result.current).filter(child => child.type === type);
  expect(ofType(EventStar).map(star => star.props.event.id)).toEqual(['event-17']);
  expect(ofType(InstancedEventField)[0]?.props.excludedIds).toContain('event-17');
  expect(ofType(SceneProjection)[0]?.props.protectedIds).toEqual(['event-0', 'event-17']);
  const start = { pointerId: 2, clientX: 20, clientY: 30, target: document.createElement('canvas') };
  act(() => ofType(InstancedEventField)[0]?.props.onPromote(events[501], start));
  const dragged = ofType(EventStar).find(star => star.props.event.id === 'event-501');
  expect(dragged?.props.dragStart).toBe(start);
  expect(ofType(CameraRig)[0].props.controlsEnabled).toBe(false);
  expect(ofType(InstancedEventField)[0].props.dragOffsets['event-501']).toBeUndefined();
  act(() => { dragged.props.onDragOffset('event-501', [1, -0.5]); dragged.props.onDragStateChange(false); });
  expect(ofType(EventStar).map(star => star.props.event.id)).toEqual(['event-17']);
  expect(ofType(InstancedEventField)[0].props.dragOffsets['event-501']).toEqual([1, -0.5]);
  expect(ofType(InstancedEventField)[0].props.excludedIds).not.toContain('event-501');
  expect(ofType(CameraRig)[0].props.controlsEnabled).toBe(true);
});

it('consumes compact cluster results and sends the exact cluster member bounds to the camera', () => {
  const events = historyEvents.slice(0, 3), callback = callbacks();
  const { result } = renderHook(() => SceneContents({ events, selectedEvent: null, hoveredId: null, resetSignal: 0, selectionSignal: 0, reducedMotion: true, ...callback }));
  const ofType = (type: unknown) => children(result.current).find(child => child.type === type);
  const cluster = { id: 'cluster', memberIds: [events[0].id, events[1].id], count: 2, semanticGroups: ['tang'], center: { x: 100, y: 100 }, bounds: { minX: 80, minY: 80, maxX: 120, maxY: 120 }, focusTarget: { x: 100, y: 100, width: 40, height: 40 } };
  const clustered: ClusterResult = { revision: 1, clusters: [cluster], singles: [{ id: events[2].id, x: 400, y: 300, semanticGroup: 'tang', visible: true }] };
  act(() => ofType(SceneProjection)?.props.onResult(clustered));
  expect(ofType(InstancedEventField)?.props.events).toEqual([events[2]]);
  const visible = ofType(InstancedEventField).props.events;
  act(() => ofType(SceneProjection).props.onResult({ ...clustered, revision: 2, singles: [{ ...clustered.singles[0], x: 410 }] }));
  expect(ofType(InstancedEventField).props.events).toBe(visible);
  act(() => ofType(ClusterField)?.props.focusBounds(cluster));
  const request = ofType(CameraRig).props.focusRequest;
  expect(request?.cluster).toBe(cluster);
  expect(request?.memberPositions).toHaveLength(2);
  expect(request?.memberPositions[0][0]).toBeLessThan(request?.memberPositions[1][0]);
  act(() => ofType(CameraRig).props.onDistanceChange(6));
  expect(ofType(SceneProjection).props.level).toBe('close');
});

it('retains a hovered rich star through dragging when hover moves to a different event', () => {
  const events = historyEvents.slice(0, 2), callback = callbacks();
  const { result, rerender } = renderHook(({ hoveredId }) => SceneContents({ events, selectedEvent: null, hoveredId, resetSignal: 0, selectionSignal: 0, reducedMotion: true, ...callback }), { initialProps: { hoveredId: events[0].id } });
  const rich = () => children(result.current).filter(child => child.type === EventStar);
  const start = { pointerId: 3, clientX: 100, clientY: 100, target: document.createElement('canvas') };
  act(() => { rich()[0].props.onDragStart?.(events[0], start); rich()[0].props.onDragStateChange(true); });
  rerender({ hoveredId: events[1].id });
  expect(rich().map(star => star.props.event.id)).toContain(events[0].id);
  expect(children(result.current).find(child => child.type === InstancedEventField).props.excludedIds).toContain(events[0].id);
});

it('protects search targets and threads filter dimming through instances, rich stars and clusters without removing events', () => {
  const events = historyEvents.slice(0, 3), opacities = new Map([[events[0].id, 0.15], [events[1].id, 1], [events[2].id, 0.15]]);
  const { result } = renderHook(() => SceneContents({ events, selectedEvent: events[0], hoveredId: null, resetSignal: 0, selectionSignal: 0, reducedMotion: true, searchTargetIds: ['search-target'], eventOpacities: opacities, ...callbacks() }));
  const ofType = (type: unknown) => children(result.current).find(child => child.type === type);
  expect(ofType(SceneProjection).props.protectedIds).toContain('search-target');
  expect(ofType(InstancedEventField).props.events).toHaveLength(3);
  expect(ofType(InstancedEventField).props.eventOpacities.get(events[0].id)).toBe(0.15);
  expect(ofType(EventStar).props.opacity).toBe(0.15);
  expect(ofType(ClusterField).props.eventOpacities).toBe(opacities);
  expect(ofType(CameraRig).props.selectedEvent.id).toBe(events[0].id);
});

it('applies restored released offsets to all scene positions and publishes the next released offset', () => {
  const events = historyEvents.slice(0, 2), onFixedOffsetsChange = vi.fn();
  const { result } = renderHook(() => SceneContents({ events, selectedEvent: events[0], hoveredId: null, resetSignal: 0, selectionSignal: 0, reducedMotion: true, ...callbacks(), initialFixedOffsets: { [events[0].id]: [1, -0.5] }, onFixedOffsetsChange }));
  const ofType = (type: unknown) => children(result.current).find(child => child.type === type);
  expect(ofType(EventStar).props.dragOffset).toEqual([1, -0.5]);
  expect(ofType(InstancedEventField).props.dragOffsets[events[0].id]).toEqual([1, -0.5]);
  expect(ofType(CameraRig).props.selectedPosition[1]).toBeCloseTo(ofType(SceneProjection).props.positions.get(events[0].id)[1]);
  expect(onFixedOffsetsChange).not.toHaveBeenCalled();
  act(() => ofType(EventStar).props.onDragOffset(events[0].id, [2, -1]));
  expect(onFixedOffsetsChange).toHaveBeenCalledWith({ [events[0].id]: [2, -1] });
});
