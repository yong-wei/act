/**
 * 预设电影镜头目录（移植 Remotion cameraTimeline 的跟船/环绕/退却/顶视子集）
 * 与屏幕构图反解（把锚点钉在屏幕指定位置的 lookAt 目标求解）。
 */
import * as THREE from 'three';

import type { ShotFrame } from './stay-put';

export interface ShotArgs {
  readonly shipX: number;
  readonly shipZ: number;
  readonly headingRad: number;
  readonly shipLength: number;
}

export interface SceneCameraShot {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly frame: (args: ShotArgs) => ShotFrame;
}

const forwardOf = (headingRad: number) => new THREE.Vector3(Math.sin(headingRad), 0, Math.cos(headingRad));
const shipPoint = (args: ShotArgs) => new THREE.Vector3(args.shipX, 0, args.shipZ);

export const SCENE_CAMERA_SHOTS = {
  chase: {
    id: 'chase',
    label: '跟船',
    description: '舰艉方向跟随',
    frame(args: ShotArgs): ShotFrame {
      const forward = forwardOf(args.headingRad);
      const position = shipPoint(args)
        .addScaledVector(forward, -args.shipLength * 1.8)
        .add(new THREE.Vector3(0, args.shipLength * 0.7, 0));
      return { position, target: shipPoint(args) };
    },
  },
  orbit: {
    id: 'orbit',
    label: '环绕',
    description: '舷侧环绕视角',
    frame(args: ShotArgs): ShotFrame {
      const forward = forwardOf(args.headingRad);
      const side = new THREE.Vector3(forward.z, 0, -forward.x);
      const position = shipPoint(args)
        .addScaledVector(side, args.shipLength * 2.2)
        .add(new THREE.Vector3(0, args.shipLength * 0.5, 0));
      return { position, target: shipPoint(args) };
    },
  },
  retreat: {
    id: 'retreat',
    label: '退却',
    description: '舰艏方向回望',
    frame(args: ShotArgs): ShotFrame {
      const forward = forwardOf(args.headingRad);
      const position = shipPoint(args)
        .addScaledVector(forward, args.shipLength * 2.0)
        .add(new THREE.Vector3(0, args.shipLength * 0.55, 0));
      return { position, target: shipPoint(args) };
    },
  },
  topDown: {
    id: 'topDown',
    label: '顶视',
    description: '正上方俯瞰',
    frame(args: ShotArgs): ShotFrame {
      const position = shipPoint(args).add(new THREE.Vector3(0, args.shipLength * 3.2, 0));
      return { position, target: shipPoint(args) };
    },
  },
} as const;

export type SceneCameraShotId = keyof typeof SCENE_CAMERA_SHOTS;

/**
 * 屏幕构图反解（移植 cameraTimeline.perspectiveTargetForScreenPoint）：
 * 返回一个 lookAt 目标，使 anchor（如船体）在相机画面中落在
 * (screenX, screenY)（0..1 屏幕坐标）处；几何种子 + 至多 4 次投影误差迭代。
 */
export function perspectiveTargetForScreenPoint({
  anchor,
  position,
  screenX,
  screenY,
  cameraUp = new THREE.Vector3(0, 1, 0),
  fovDeg = 60,
  aspect = 16 / 9,
}: {
  readonly anchor: THREE.Vector3;
  readonly position: THREE.Vector3;
  readonly screenX: number;
  readonly screenY: number;
  readonly cameraUp?: THREE.Vector3;
  readonly fovDeg?: number;
  readonly aspect?: number;
}): THREE.Vector3 {
  const desiredNdcX = screenX * 2 - 1;
  const desiredNdcY = 1 - screenY * 2;
  const viewForward = anchor.clone().sub(position).normalize();
  const upVector = cameraUp.clone().normalize();
  let viewRight = viewForward.clone().cross(upVector).normalize();
  if (viewRight.lengthSq() < 1e-6) viewRight = new THREE.Vector3(1, 0, 0);
  const viewUp = viewRight.clone().cross(viewForward).normalize();
  const depth = anchor.distanceTo(position);
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * depth;
  const halfWidth = halfHeight * aspect;
  const target = anchor.clone()
    .sub(viewRight.clone().multiplyScalar(desiredNdcX * halfWidth))
    .sub(viewUp.clone().multiplyScalar(desiredNdcY * halfHeight));

  const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, Math.max(100, depth * 4));
  camera.position.copy(position);
  camera.up.copy(upVector);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const projected = anchor.clone().project(camera);
    const screenErrorX = (projected.x + 1) / 2 - screenX;
    const screenErrorY = (1 - projected.y) / 2 - screenY;
    if (Math.abs(screenErrorX) + Math.abs(screenErrorY) < 1e-4) break;
    const forward = target.clone().sub(position).normalize();
    let right = forward.clone().cross(upVector).normalize();
    if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
    const up = right.clone().cross(forward).normalize();
    target
      .add(right.multiplyScalar(screenErrorX * halfWidth * 2))
      .sub(up.multiplyScalar(screenErrorY * halfHeight * 2));
  }
  return target;
}
