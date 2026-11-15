'use client';

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';

/** 场景只投影原生冰缘和浮冰位姿。 */
export function IceContactField({ scene }: { scene: VesselSessionFrame['iceScene'] }) {
  const sheet = useRef<THREE.InstancedMesh>(null);
  const floes = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!scene || !sheet.current || !floes.current) return;
    const transform = new THREE.Object3D();
    const bandWidth = 120 / scene.frontsNorthM.length;
    for (const [index, front] of scene.frontsNorthM.entries()) {
      const length = Math.max(0, 700 - front);
      transform.position.set(front + length / 2, .1 - scene.thicknessM / 2, -60 + (index + .5) * bandWidth);
      transform.quaternion.identity();
      transform.scale.set(length, scene.thicknessM, bandWidth * .99);
      transform.updateMatrix();
      sheet.current.setMatrixAt(index, transform.matrix);
    }
    sheet.current.count = scene.frontsNorthM.length;
    sheet.current.instanceMatrix.needsUpdate = true;
    const basis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const inverseBasis = basis.clone().invert();
    for (const [index, floe] of scene.floes.entries()) {
      transform.position.set(floe.positionNed[0], -floe.positionNed[2], floe.positionNed[1]);
      transform.quaternion.set(floe.quaternion[1], floe.quaternion[2], floe.quaternion[3], floe.quaternion[0]);
      transform.quaternion.premultiply(basis).multiply(inverseBasis);
      transform.scale.set(floe.lengthM, scene.thicknessM, floe.widthM);
      transform.updateMatrix();
      floes.current.setMatrixAt(index, transform.matrix);
    }
    floes.current.count = scene.floes.length;
    floes.current.instanceMatrix.needsUpdate = true;
    sheet.current.computeBoundingSphere();
    floes.current.computeBoundingSphere();
  }, [scene]);
  if (!scene) return null;
  return <group name="physical-ice-field">
    <instancedMesh ref={sheet} args={[undefined, undefined, 64]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#d7e9ed" roughness={.7} />
    </instancedMesh>
    <instancedMesh ref={floes} args={[undefined, undefined, 128]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#bcd6dd" roughness={.5} />
    </instancedMesh>
  </group>;
}
