import * as THREE from 'three';
import { historyEvents } from '../history/events';
import { EventStar } from './EventStar';
import { Children, isValidElement } from 'react';

const harness = vi.hoisted(() => ({ refs: [] as unknown[], frame: undefined as undefined | ((state: { clock: { elapsedTime: number } }) => void) }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: (initial: unknown) => ({ current: harness.refs.length ? harness.refs.shift() : initial }),
  useEffect: () => {}
}));
vi.mock('@react-three/fiber', () => ({ useFrame: (frame: typeof harness.frame) => { harness.frame = frame; } }));

describe('EventStar frame animation', () => {
  it('lets a ray through the selected star halo reach the neighboring event core', () => {
    harness.refs = [];
    const tree = EventStar({ event: { ...historyEvents[0], influence: 5 }, selected: true, hovered: false, dragOffset: [0, 0], reducedMotion: true,
      onSelect: vi.fn(), onHover: vi.fn(), onDragOffset: vi.fn(), onDragStateChange: vi.fn() });
    const meshes = Children.toArray(tree.props.children).filter(isValidElement).filter(child => child.type === 'mesh') as any[];
    const haloElement = meshes.find(mesh => Children.toArray(mesh.props.children).some((child: any) => child.type === 'icosahedronGeometry'));
    const geometry = Children.toArray(haloElement.props.children).find((child: any) => child.type === 'icosahedronGeometry') as any;
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(...geometry.props.args), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    if (haloElement.props.raycast) halo.raycast = haloElement.props.raycast;
    halo.position.z = 1;
    const neighbor = new THREE.Mesh(new THREE.SphereGeometry(0.24), new THREE.MeshBasicMaterial());
    neighbor.position.set(0.65, 0, 0);
    halo.updateMatrixWorld(); neighbor.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(0.65, 0, 5), new THREE.Vector3(0, 0, -1));
    const hits = ray.intersectObjects([halo, neighbor]);
    expect(hits[0]?.object).toBe(neighbor);
    halo.geometry.dispose(); halo.material.dispose(); neighbor.geometry.dispose(); neighbor.material.dispose();
  });
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
