import { beginStarDrag } from './starDrag';

function setup() {
  const target = document.createElement('canvas');
  target.setPointerCapture = vi.fn(); target.releasePointerCapture = vi.fn(); target.hasPointerCapture = () => true;
  const onMove = vi.fn(), onFinish = vi.fn(), onCancel = vi.fn();
  const cleanup = beginStarDrag({ start: { pointerId: 8, clientX: 100, clientY: 100, target }, offset: [0.2, -0.1], onMove, onFinish, onCancel });
  const pointer = (type: string, x = 100, y = 100, pointerId = 8) => { const event = new Event(type); Object.assign(event, { clientX: x, clientY: y, pointerId }); window.dispatchEvent(event); };
  return { target, onMove, onFinish, onCancel, cleanup, pointer };
}

it('keeps promoted drag movement transient and fixes only the released offset', () => {
  const f = setup();
  f.pointer('pointermove', 120, 90, 9); expect(f.onMove).not.toHaveBeenCalled();
  f.pointer('pointermove', 120, 90);
  expect(f.onMove).toHaveBeenLastCalledWith([0.32, 0.1]);
  expect(f.onFinish).not.toHaveBeenCalled();
  f.pointer('pointerup', 120, 90);
  expect(f.onFinish).toHaveBeenCalledWith([0.32, 0.1]);
  f.pointer('pointermove', 150, 50); f.pointer('pointerup', 150, 50);
  expect(f.onFinish).toHaveBeenCalledTimes(1);
  expect(document.body.dataset.draggingStar).toBeUndefined();
  f.cleanup();
});

it('preserves click selection below the drag threshold and cancels without persisting movement', () => {
  const click = setup(); click.pointer('pointermove', 102, 103); click.pointer('pointerup', 102, 103);
  expect(click.onFinish).toHaveBeenCalledWith(null); expect(click.onMove).not.toHaveBeenCalled(); click.cleanup();
  const cancelled = setup(); cancelled.pointer('pointermove', 2000, -2000);
  expect(cancelled.onMove).toHaveBeenCalledWith([2.6, 2.4]);
  cancelled.pointer('pointercancel');
  expect(cancelled.onCancel).toHaveBeenCalledTimes(1); expect(cancelled.onFinish).not.toHaveBeenCalled(); cancelled.cleanup();
});

it('releases document drag state and listeners on unmount or capture loss', () => {
  const f = setup();
  expect(document.body.dataset.draggingStar).toBe('true');
  const lost = new Event('lostpointercapture'); Object.assign(lost, { pointerId: 8 }); f.target.dispatchEvent(lost);
  expect(f.onCancel).toHaveBeenCalledTimes(1);
  expect(document.body.style.cursor).toBe('');
  f.cleanup(); f.pointer('pointerup'); expect(f.onFinish).not.toHaveBeenCalled();
  const unmounted = setup(); unmounted.cleanup(); expect(unmounted.onCancel).toHaveBeenCalledTimes(1);
});
