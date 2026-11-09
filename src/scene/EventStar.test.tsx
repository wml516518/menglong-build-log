import * as THREE from 'three';
import { historyEvents } from '../history/events';
import { EventStar } from './EventStar';

const harness = vi.hoisted(() => ({ refs: [] as unknown[], frame: undefined as undefined | ((state: { clock: { elapsedTime: number } }) => void) }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: (initial: unknown) => ({ current: harness.refs.length ? harness.refs.shift() : initial }),
  useEffect: () => {}
}));
vi.mock('@react-three/fiber', () => ({ useFrame: (frame: typeof harness.frame) => { harness.frame = frame; } }));

describe('EventStar frame animation', () => {
  it.each([true, false])('respects reduced motion (%s) while retaining selection feedback', (reducedMotion) => {
    const group = new THREE.Group();
    const glow = new THREE.Mesh();
    harness.refs = [group, glow];
    EventStar({ event: historyEvents[0], selected: true, hovered: false, dragOffset: [0, 0], reducedMotion,
      onSelect: vi.fn(), onHover: vi.fn(), onDragOffset: vi.fn(), onDragStateChange: vi.fn() });
    harness.frame!({ clock: { elapsedTime: 1 } });
    expect(glow.rotation.z).toBe(reducedMotion ? 0 : -0.004);
    expect(group.rotation.y).toBe(reducedMotion ? 0 : 0.003);
    expect(group.scale.x).toBeGreaterThan(1);
  });
});
