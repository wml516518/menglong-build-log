export interface StarPointerStart { pointerId: number; clientX: number; clientY: number; target: HTMLElement }
export interface StarDragOptions {
  start: StarPointerStart;
  offset: readonly [number, number];
  onMove: (offset: readonly [number, number]) => void;
  onFinish: (offset: readonly [number, number] | null) => void;
  onCancel: () => void;
}
export function beginStarDrag({ start, offset, onMove, onFinish, onCancel }: StarDragOptions): () => void {
  let finished = false, dragging = false;
  let current: readonly [number, number] = offset;
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  const move = (event: PointerEvent) => {
    if (finished || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.clientX, dy = event.clientY - start.clientY;
    dragging ||= Math.hypot(dx, dy) > 5;
    if (!dragging) return;
    current = [clamp(offset[0] - dy * 0.012, 2.6), clamp(offset[1] + dx * 0.01, 2.4)];
    onMove(current);
  };
  const detach = () => {
    finished = true;
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
    start.target.removeEventListener('lostpointercapture', cancel);
    try { if (start.target.hasPointerCapture?.(start.pointerId)) start.target.releasePointerCapture(start.pointerId); } catch { /* The browser may already have released it. */ }
    delete document.body.dataset.draggingStar; document.body.style.cursor = '';
  };
  const up = (event: PointerEvent) => {
    if (finished || event.pointerId !== start.pointerId) return;
    move(event); detach(); onFinish(dragging ? current : null);
  };
  const cancel = (event?: Event) => {
    if (finished || (event && (event as PointerEvent).pointerId !== start.pointerId)) return;
    detach(); onCancel();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
  start.target.addEventListener('lostpointercapture', cancel);
  try { start.target.setPointerCapture?.(start.pointerId); } catch { /* Window listeners still complete a promoted gesture. */ }
  document.body.dataset.draggingStar = 'true'; document.body.style.cursor = 'grabbing';
  return () => cancel();
}
