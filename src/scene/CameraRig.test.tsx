import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { CameraRig, classifyWheelIntent, clusterCameraPose, createClusterFocusRequest } from './CameraRig';
import type { ClusterFocusRequest } from './CameraRig';
import type { ScreenCluster } from '../history/clustering/protocol';
import { historyEvents } from '../history/events';
import type { HistoryEvent } from '../history/types';
import { getEventPosition } from './EventStar';

const harness = vi.hoisted(() => ({ state: undefined as any, frame: undefined as any }));
vi.mock('@react-three/fiber', async importOriginal => ({ ...await importOriginal<typeof import('@react-three/fiber')>(), useThree: (select: (state: any) => unknown) => select(harness.state), useFrame: (frame: any) => { harness.frame = frame; } }));

it.each([
  [{ deltaX: 0, deltaY: 90 }, { kind: 'zoom' }],
  [{ deltaX: 12, deltaY: 90 }, { kind: 'zoom' }],
  [{ deltaX: 0, deltaY: 90, shiftKey: true }, { kind: 'travel', delta: 90 }],
  [{ deltaX: -60, deltaY: 4 }, { kind: 'travel', delta: -60 }],
  [{ deltaX: 60, deltaY: 1, ctrlKey: true }, { kind: 'zoom' }],
  [{ deltaX: 0, deltaY: 2, deltaMode: 1, shiftKey: true }, { kind: 'travel', delta: 32 }],
])('classifies wheel intent without turning vertical scroll or pinch into travel: %j', (event, expected) => {
  expect(classifyWheelIntent({ shiftKey: false, ctrlKey: false, deltaMode: 0, ...event })).toEqual(expected);
});

const cluster: ScreenCluster = { id: 'cluster', memberIds: ['left', 'right'], count: 2, semanticGroups: ['tang'], center: { x: 400, y: 200 }, bounds: { minX: 300, minY: 150, maxX: 500, maxY: 250 }, focusTarget: { x: 400, y: 200, width: 200, height: 100 } };
const request = createClusterFocusRequest(1, cluster, new Map([['left', [-2, 0, 0] as const], ['right', [2, 0, 0] as const]]));

it('fits exact member world bounds while retaining the Task 8 screen focus rectangle', () => {
  expect(request.cluster).toBe(cluster);
  expect(request.memberPositions).toEqual([[-2, 0, 0], [2, 0, 0]]);
  const camera = new THREE.PerspectiveCamera(43, 0.5, 0.1, 150); camera.position.set(0, 0, 10);
  const pose = clusterCameraPose(request, camera, new THREE.Vector3());
  expect(pose?.target.toArray()).toEqual([0, 0, 0]);
  expect(pose!.position.length()).toBeGreaterThan(4);
  camera.position.copy(pose!.position); camera.lookAt(pose!.target); camera.updateMatrixWorld();
  for (const point of request.memberPositions) expect(Math.abs(new THREE.Vector3(...point).project(camera).x)).toBeLessThan(0.9);
});

function setup(reducedMotion = true) {
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  Object.defineProperty(canvas, 'clientHeight', { value: 600 });
  canvas.setPointerCapture = vi.fn(); canvas.releasePointerCapture = vi.fn();
  const camera = new THREE.PerspectiveCamera(43, 1.5, 0.1, 150); camera.position.set(0, 9.5, 26);
  harness.state = { camera, gl: { domElement: canvas } };
  const controls = new OrbitControls(camera, canvas);
  const onTravelYear = vi.fn(), onDistanceChange = vi.fn();
  const { result, rerender, unmount } = renderHook(({ focusRequest, selectedEvent = null, selectedPosition, resetSignal = 0 }: { focusRequest?: ClusterFocusRequest; selectedEvent?: HistoryEvent | null; selectedPosition?: readonly [number, number, number]; resetSignal?: number }) => CameraRig({ selectedEvent, selectedPosition, resetSignal, reducedMotion, controlsEnabled: true, onTravelYear, onDistanceChange, focusRequest }), { initialProps: {} });
  result.current.props.ref.current = controls;
  for (const key of ['enableZoom', 'enablePan', 'minDistance', 'maxDistance', 'touches', 'minPolarAngle', 'maxPolarAngle']) if (result.current.props[key] !== undefined) (controls as any)[key] = result.current.props[key];
  controls.addEventListener('start', () => result.current.props.onStart());
  return { camera, canvas, controls, onTravelYear, onDistanceChange, result, rerender, frame: () => act(() => harness.frame({}, 1 / 60)), close: () => { unmount(); controls.dispose(); canvas.remove(); } };
}

it('lets OrbitControls dolly on vertical wheel and intercepts only timeline gestures before dolly', () => {
  const f = setup();
  const before = f.controls.getDistance();
  f.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 90, cancelable: true }));
  expect(f.controls.getDistance()).toBeGreaterThan(before);
  expect(f.onTravelYear).not.toHaveBeenCalled();
  const zoomed = f.controls.getDistance();
  f.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 90, shiftKey: true, cancelable: true }));
  f.canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: -50, deltaY: 2, cancelable: true }));
  expect(f.onTravelYear).toHaveBeenCalledTimes(2);
  expect(f.controls.getDistance()).toBeCloseTo(zoomed);
  f.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -20, ctrlKey: true, cancelable: true }));
  expect(f.controls.getDistance()).toBeLessThan(zoomed);
  expect(f.onTravelYear).toHaveBeenCalledTimes(2);
  expect(f.result.current.props.minDistance).toBeGreaterThan(0);
  expect(f.result.current.props.maxDistance).toBeLessThan(150);
  f.close();
});

it('keeps the next selected event centered after a close cluster focus and restores the full reset pose', () => {
  const f = setup();
  const high = { ...request, memberPositions: [[0, 7, 2], [0.1, 7, 2]] as const };
  f.rerender({ focusRequest: high }); f.frame();
  const selected = { ...historyEvents[0], offset: [-2, -2] as const };
  f.rerender({ focusRequest: high, selectedEvent: selected }); f.frame();
  const expected = new THREE.Vector3(...getEventPosition(selected));
  expect(f.controls.target.distanceTo(expected)).toBeLessThan(0.001);
  const fixed = getEventPosition(selected, [1, -0.5]);
  f.rerender({ focusRequest: high, selectedEvent: selected, selectedPosition: fixed }); f.frame();
  expect(f.controls.target.toArray()).toEqual(fixed);
  f.rerender({ focusRequest: high, selectedEvent: selected, resetSignal: 1 }); f.frame();
  expect(f.controls.target.toArray()).toEqual([-28, 0.8, 0]);
  expect(f.camera.position.toArray()).toEqual([-28, 9.5, 26]);
  f.close();
});

it('keeps two-finger pinch as zoom and one-finger pointer movement as orbit', () => {
  const f = setup();
  const pointer = (target: EventTarget, type: string, id: number, x: number, y: number) => { const event = new Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { pointerId: id, pointerType: 'touch', pageX: x, pageY: y, clientX: x, clientY: y }); target.dispatchEvent(event); };
  const before = f.controls.getDistance();
  pointer(f.canvas, 'pointerdown', 1, 100, 100); pointer(f.canvas, 'pointerdown', 2, 200, 100);
  pointer(document, 'pointermove', 2, 280, 100);
  expect(f.controls.getDistance()).toBeLessThan(before);
  pointer(document, 'pointerup', 1, 100, 100); pointer(document, 'pointerup', 2, 280, 100);
  const position = f.camera.position.clone();
  pointer(f.canvas, 'pointerdown', 3, 100, 100); pointer(document, 'pointermove', 3, 140, 130);
  expect(f.camera.position.distanceTo(position)).toBeGreaterThan(0.1);
  pointer(document, 'pointerup', 3, 140, 130);
  expect(f.onTravelYear).not.toHaveBeenCalled();
  f.close();
});

it.each([true, false])('focuses member bounds with reduced motion=%s and reports meaningful camera distance changes', reducedMotion => {
  const f = setup(reducedMotion);
  f.frame();
  const before = f.camera.position.clone();
  f.rerender({ focusRequest: request });
  if (reducedMotion) expect(f.controls.target.toArray()).toEqual([0, 0, 0]);
  else { expect(f.camera.position.toArray()).toEqual(before.toArray()); for (let i = 0; i < 240; i++) f.frame(); }
  expect(f.controls.target.distanceTo(new THREE.Vector3())).toBeLessThan(0.02);
  f.frame();
  expect(f.onDistanceChange.mock.calls.length).toBeGreaterThan(0);
  const calls = f.onDistanceChange.mock.calls.length;
  for (let i = 0; i < 10; i++) f.frame();
  expect(f.onDistanceChange.mock.calls.length).toBe(calls);
  f.camera.position.copy(f.controls.target).add(new THREE.Vector3(0, 2, 60)); f.frame();
  expect(f.onDistanceChange.mock.calls.length).toBeGreaterThan(calls);
  f.close();
});

it.each(['wheel', 'orbit'] as const)('stops cluster travel at the current target when %s starts during focus', gesture => {
  const f = setup(false);
  for (let i = 0; i < 45; i++) f.frame();
  const beforeFocus = f.controls.target.clone();
  f.rerender({ focusRequest: request });
  for (let i = 0; i < 8; i++) f.frame();
  expect(f.controls.target.distanceTo(beforeFocus)).toBeGreaterThan(1);
  expect(f.controls.target.length()).toBeGreaterThan(1);

  // Native OrbitControls dispatches start, which invokes CameraRig's actual
  // onStart prop just as drei's wrapper does in the rendered scene.
  if (gesture === 'wheel') {
    f.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 90, cancelable: true }));
  } else {
    const down = new MouseEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, bubbles: true });
    Object.assign(down, { pointerId: 5, pointerType: 'mouse' });
    f.canvas.dispatchEvent(down);
    const up = new MouseEvent('pointerup', { button: 0, clientX: 100, clientY: 100, bubbles: true });
    Object.assign(up, { pointerId: 5, pointerType: 'mouse' });
    document.dispatchEvent(up);
  }
  const interruptedTarget = f.controls.target.clone();
  const interruptedCamera = f.camera.position.clone();
  for (let i = 0; i < 120; i++) f.frame();
  expect(f.controls.target.distanceTo(interruptedTarget)).toBeLessThan(1e-9);
  expect(f.camera.position.distanceTo(interruptedCamera)).toBeLessThan(1e-9);
  expect(f.onTravelYear).not.toHaveBeenCalled();
  f.close();
});
