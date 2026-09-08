import * as THREE from 'three';
import type { ActiveAuthorityLayoutNode } from './active-authority-geometry';
import { activeNodeRadius } from './active-authority-visual';

/** Fit the actual perspective frustum, including depth, without changing view direction. */
export function fitActiveAuthorityPerspectiveCamera(
  camera: THREE.PerspectiveCamera,
  nodes: readonly ActiveAuthorityLayoutNode[],
  width: number,
  height: number,
): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  if (!nodes.length || width <= 0 || height <= 0
    || !nodes.every((node) => [node.x, node.y, node.z].every(Number.isFinite))) return null;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const node of nodes) {
    const radius = activeNodeRadius(node);
    min.min(new THREE.Vector3(node.x - radius, node.y - radius, node.z - radius));
    max.max(new THREE.Vector3(node.x + radius, node.y + radius, node.z + radius));
  }
  const target = min.clone().add(max).multiplyScalar(0.5);
  camera.updateMatrixWorld();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
  const padding = Math.min(80, Math.max(32, Math.min(width, height) * 0.12));
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const vertical = tangent * Math.max(0.15, (height - 2 * padding) / height);
  const horizontal = tangent * (width / height) * Math.max(0.15, (width - 2 * padding) / width);
  let distance = camera.near + 1;
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(target);
    const depth = point.dot(backward);
    distance = Math.max(distance, depth + Math.abs(point.dot(right)) / horizontal,
      depth + Math.abs(point.dot(up)) / vertical, depth + camera.near + 1);
  }
  return { position: target.clone().addScaledVector(backward, distance), target };
}
