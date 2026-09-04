/**
 * 按包围盒取景：把整艘模型装进透视相机画面，并断言投影是否落在视口内。
 */
import * as THREE from 'three';

import type { ShotFrame } from './stay-put';

const CORNER_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
  [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];

export function framePerspectiveCameraToBox(
  box: THREE.Box3,
  fovDeg = 45,
  aspect = 16 / 9,
  padding = 1.25,
): ShotFrame {
  const target = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 1);
  const fov = THREE.MathUtils.degToRad(fovDeg);
  const halfFov = fov / 2;
  const fitHeight = radius / Math.sin(halfFov);
  const fitWidth = radius / Math.sin(Math.atan(Math.tan(halfFov) * aspect));
  const distance = Math.max(fitHeight, fitWidth) * padding;
  const direction = new THREE.Vector3(1, 0.55, 1).normalize();
  return {
    position: target.clone().addScaledVector(direction, distance),
    target,
  };
}

export function boxProjectsInsideNdc(
  camera: THREE.Camera,
  box: THREE.Box3,
  margin = 0.02,
): boolean {
  if (box.isEmpty()) return false;
  camera.updateMatrixWorld();
  if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix();
  const min = box.min;
  const size = box.getSize(new THREE.Vector3());
  const limit = 1 + margin;
  for (const [x, y, z] of CORNER_OFFSETS) {
    const corner = new THREE.Vector3(
      min.x + size.x * x,
      min.y + size.y * y,
      min.z + size.z * z,
    ).project(camera);
    if (
      !Number.isFinite(corner.x)
      || !Number.isFinite(corner.y)
      || corner.x < -limit
      || corner.x > limit
      || corner.y < -limit
      || corner.y > limit
      || corner.z < -1
      || corner.z > 1
    ) {
      return false;
    }
  }
  return true;
}
