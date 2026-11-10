import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { HistoryCameraState } from '../history/session';
import { MAX_CAMERA_DISTANCE, MIN_CAMERA_DISTANCE } from '../history/sceneLimits';
export { MAX_CAMERA_DISTANCE, MIN_CAMERA_DISTANCE } from '../history/sceneLimits';
import type { HistoryEvent } from '../history/types';
import { xToYear } from '../history/space';
import type { ScreenCluster } from '../history/clustering/protocol';
import type { WorldPositions } from './ClusterField';
import { getLodLevel, type LodLevel } from '../history/lod';
import { getEventPosition } from './EventStar';

export interface ClusterFocusRequest { serial: number; cluster: ScreenCluster; memberPositions: readonly (readonly [number, number, number])[] }
export type WheelIntent = { kind: 'zoom' } | { kind: 'travel'; delta: number };
export function classifyWheelIntent(event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey' | 'ctrlKey'>): WheelIntent {
  // Trackpad pinch is a ctrl+wheel gesture, regardless of any horizontal noise.
  if (event.ctrlKey || (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY))) return { kind: 'zoom' };
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  return { kind: 'travel', delta: delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1) };
}
export function createClusterFocusRequest(serial: number, cluster: ScreenCluster, positions: WorldPositions): ClusterFocusRequest {
  return { serial, cluster, memberPositions: cluster.memberIds.flatMap(id => positions.has(id) ? [positions.get(id)!] : []) };
}
export function clusterCameraPose(request: ClusterFocusRequest, camera: THREE.PerspectiveCamera, target: THREE.Vector3): { target: THREE.Vector3; position: THREE.Vector3 } | undefined {
  if (!request.memberPositions.length) return undefined;
  // The request retains Task 8's padded screen bounds. Fitting its members in
  // world space also works when the camera rotated after that projection.
  const box = new THREE.Box3().setFromPoints(request.memberPositions.map(point => new THREE.Vector3(...point))).expandByScalar(0.65);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fov = THREE.MathUtils.degToRad(camera.getEffectiveFOV());
  const limitingFov = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * camera.aspect));
  const distance = THREE.MathUtils.clamp(sphere.radius / Math.sin(limitingFov / 2) * 1.12, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  const direction = camera.position.clone().sub(target);
  if (direction.lengthSq() < 0.001) direction.set(0, 0.35, 1);
  return { target: sphere.center, position: sphere.center.clone().add(direction.normalize().multiplyScalar(distance)) };
}

interface CameraRigProps {
  initialCamera?: Partial<HistoryCameraState>;
  onCameraChange?: (camera: HistoryCameraState) => void;
  selectedEvent: HistoryEvent | null;
  selectedPosition?: readonly [number, number, number];
  resetSignal: number;
  selectionSignal?: number;
  reducedMotion: boolean;
  onTravelYear: (year: number) => void;
  controlsEnabled: boolean;
  focusRequest?: ClusterFocusRequest | null;
  onDistanceChange?: (distance: number) => void;
}

export function CameraRig({ selectedEvent, selectedPosition, resetSignal, selectionSignal, reducedMotion, onTravelYear, controlsEnabled, focusRequest, onDistanceChange, initialCamera, onCameraChange }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const controls = useRef<OrbitControlsImpl>(null);
  const travelTarget = useRef(initialCamera?.target ? new THREE.Vector3(...initialCamera.target) : selectedEvent ? new THREE.Vector3(...(selectedPosition ?? getEventPosition(selectedEvent))) : new THREE.Vector3(-28, 0.8, 0));
  const initialized = useRef(false);
  const firstSelection = useRef(true);
  const lastReported = useRef<HistoryCameraState | null>(null);
  const sinceReport = useRef(0);
  const reportCamera = () => {
    if (!controls.current || !onCameraChange) return;
    const state: HistoryCameraState = { target: controls.current.target.toArray() as [number, number, number], distance: camera.position.distanceTo(controls.current.target) };
    const previous = lastReported.current;
    if (previous && Math.abs(previous.distance - state.distance) < 0.001 && previous.target.every((value, index) => Math.abs(value - state.target[index]) < 0.001)) return;
    lastReported.current = state; sinceReport.current = 0;
    onCameraChange(state);
  };
  useEffect(() => {
    window.addEventListener('pagehide', reportCamera, true);
    return () => { window.removeEventListener('pagehide', reportCamera, true); reportCamera(); };
  }, [camera, onCameraChange]);
  const resetRequested = useRef(false);
  const resetPosition = useRef(new THREE.Vector3(-28, 9.5, 26));
  const focusAnimation = useRef<ReturnType<typeof clusterCameraPose>>(undefined);
  const lastDistance = useRef<{ distance: number; level: LodLevel } | null>(null);

  useEffect(() => {
    const restoring = firstSelection.current;
    firstSelection.current = false;
    if (!selectedEvent || (restoring && initialCamera)) return;
    focusAnimation.current = undefined;
    resetRequested.current = false;
    travelTarget.current.fromArray(selectedPosition ?? getEventPosition(selectedEvent));
  }, [selectedEvent, selectedPosition, selectionSignal]);

  useEffect(() => {
    if (resetSignal === 0) return;
    focusAnimation.current = undefined;
    travelTarget.current.set(-28, 0.8, 0);
    resetRequested.current = true;
    onTravelYear(701);
  }, [onTravelYear, resetSignal]);

  useEffect(() => {
    if (!focusRequest || !controls.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    const pose = clusterCameraPose(focusRequest, camera, controls.current.target);
    if (!pose) return;
    resetRequested.current = false;
    travelTarget.current.copy(pose.target);
    focusAnimation.current = pose;
    if (reducedMotion) {
      camera.position.copy(pose.position); controls.current.target.copy(pose.target); controls.current.update();
      focusAnimation.current = undefined;
    }
  }, [camera, focusRequest, reducedMotion]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      if (!controlsEnabled) return;
      const intent = classifyWheelIntent(event);
      if (intent.kind !== 'travel') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      focusAnimation.current = undefined;
      travelTarget.current.x = THREE.MathUtils.clamp(travelTarget.current.x + intent.delta * 0.012, -31, 31);
      onTravelYear(xToYear(travelTarget.current.x));
    };
    // Capture only timeline gestures before OrbitControls' wheel listener.
    // Ordinary vertical wheel reaches OrbitControls unchanged for dolly zoom.
    canvas.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => canvas.removeEventListener('wheel', onWheel, true);
  }, [controlsEnabled, gl, onTravelYear]);

  useFrame((_, delta) => {
    const factor = reducedMotion ? 1 : 1 - Math.exp(-delta * 2.8);
    if (controls.current && controlsEnabled) {
      if (!initialized.current) {
        initialized.current = true;
        if (initialCamera) {
          controls.current.target.copy(travelTarget.current);
          const distance = initialCamera.distance ?? Math.hypot(8.7, 26);
          camera.position.copy(travelTarget.current).add(new THREE.Vector3(0, 8.7, 26).normalize().multiplyScalar(distance));
          controls.current.update();
          onTravelYear(xToYear(travelTarget.current.x));
        }
      }
      const pose = focusAnimation.current;
      if (pose) {
        camera.position.lerp(pose.position, factor);
        controls.current.target.lerp(pose.target, factor);
        if (camera.position.distanceTo(pose.position) < 0.01 && controls.current.target.distanceTo(pose.target) < 0.01) {
          camera.position.copy(pose.position); controls.current.target.copy(pose.target); focusAnimation.current = undefined;
        }
      } else if (resetRequested.current) {
        camera.position.lerp(resetPosition.current, factor);
        controls.current.target.lerp(travelTarget.current, factor);
        if (camera.position.distanceTo(resetPosition.current) < 0.01 && controls.current.target.distanceTo(travelTarget.current) < 0.01) {
          camera.position.copy(resetPosition.current); controls.current.target.copy(travelTarget.current); resetRequested.current = false;
        }
      } else {
        const deltaTarget = travelTarget.current.clone().sub(controls.current.target).multiplyScalar(factor);
        controls.current.target.add(deltaTarget);
        camera.position.add(deltaTarget);
      }
      controls.current.update();
      sinceReport.current += delta;
      if (!lastReported.current || sinceReport.current >= 0.2) reportCamera();
      const distance = camera.position.distanceTo(controls.current.target);
      const previous = lastDistance.current;
      const level = getLodLevel(distance, previous?.level);
      if (!previous || level !== previous.level || Math.abs(distance - previous.distance) >= Math.max(0.5, previous.distance * 0.02)) {
        lastDistance.current = { distance, level }; onDistanceChange?.(distance);
      }
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={controlsEnabled}
      enableDamping={!reducedMotion}
      dampingFactor={0.055}
      enablePan={false}
      enableZoom
      minDistance={MIN_CAMERA_DISTANCE}
      maxDistance={MAX_CAMERA_DISTANCE}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      onEnd={reportCamera}
      onStart={() => {
        if (focusAnimation.current && controls.current) travelTarget.current.copy(controls.current.target);
        focusAnimation.current = undefined;
      }}
      minPolarAngle={0.65}
      maxPolarAngle={2.05}
      minAzimuthAngle={-0.9}
      maxAzimuthAngle={0.9}
    />
  );
}
