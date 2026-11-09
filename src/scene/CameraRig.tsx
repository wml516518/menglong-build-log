import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { HistoryEvent } from '../history/types';
import { xToYear, yearToX } from '../history/space';

interface CameraRigProps {
  selectedEvent: HistoryEvent | null;
  resetSignal: number;
  reducedMotion: boolean;
  onTravelYear: (year: number) => void;
  controlsEnabled: boolean;
}

export function CameraRig({ selectedEvent, resetSignal, reducedMotion, onTravelYear, controlsEnabled }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const controls = useRef<OrbitControlsImpl>(null);
  const travelX = useRef(selectedEvent ? yearToX(selectedEvent.year) : -28);
  const resetRequested = useRef(false);
  const resetPosition = useRef(new THREE.Vector3(-28, 9.5, 26));

  useEffect(() => {
    if (!selectedEvent) return;
    travelX.current = yearToX(selectedEvent.year);
  }, [selectedEvent]);

  useEffect(() => {
    if (resetSignal === 0) return;
    travelX.current = -28;
    resetRequested.current = true;
    onTravelYear(701);
  }, [onTravelYear, resetSignal]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      travelX.current = THREE.MathUtils.clamp(travelX.current + event.deltaY * 0.012, -31, 31);
      onTravelYear(xToYear(travelX.current));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [gl, onTravelYear]);

  useFrame((_, delta) => {
    const factor = reducedMotion ? 1 : 1 - Math.exp(-delta * 2.8);
    if (controls.current) {
      if (resetRequested.current) {
        camera.position.lerp(resetPosition.current, factor);
        controls.current.target.y = THREE.MathUtils.lerp(controls.current.target.y, 0.8, factor);
        controls.current.target.z = THREE.MathUtils.lerp(controls.current.target.z, 0, factor);
        if (camera.position.distanceTo(resetPosition.current) < 0.08) resetRequested.current = false;
      }
      const nextTargetX = THREE.MathUtils.lerp(controls.current.target.x, travelX.current, factor);
      const deltaX = nextTargetX - controls.current.target.x;
      controls.current.target.x = nextTargetX;
      camera.position.x += deltaX;
      controls.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={controlsEnabled}
      enableDamping
      dampingFactor={0.055}
      enablePan={false}
      enableZoom={false}
      minPolarAngle={0.65}
      maxPolarAngle={2.05}
      minAzimuthAngle={-0.9}
      maxAzimuthAngle={0.9}
    />
  );
}
