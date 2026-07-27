/**
 * 预设电影镜头目录（跟船/环绕/战术/顶视；环绕为 45° 俯角自动圆周）
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

/** 环绕自动圆周的公转周期（秒）：60s/圈、俯视顺时针（ADR：视图语义重定义）。 */
export const ORBIT_PERIOD_SECONDS = 60;
const ORBIT_RADIUS_FACTOR = 2.2;
const VIEW_ELEVATION = Math.PI / 4;

/** 环绕镜头：45° 俯角圆周上按方位角取景（自动圆周的逐帧位姿来源）。 */
export function orbitFrameAt(ship: THREE.Vector3, azimuthRad: number, shipLength: number): ShotFrame {
  const horizontal = shipLength * ORBIT_RADIUS_FACTOR * Math.cos(VIEW_ELEVATION);
  return {
    position: new THREE.Vector3(
      ship.x + Math.cos(azimuthRad) * horizontal,
      shipLength * ORBIT_RADIUS_FACTOR * Math.sin(VIEW_ELEVATION),
      ship.z + Math.sin(azimuthRad) * horizontal
    ),
    target: ship.clone(),
  };
}

export const SCENE_CAMERA_SHOTS = {
  chase: {
    id: 'chase',
    label: '跟船',
    description: '正后方上部 45° 跟随',
    frame(args: ShotArgs): ShotFrame {
      const forward = forwardOf(args.headingRad);
      const horizontal = args.shipLength * 1.8 * Math.cos(VIEW_ELEVATION);
      const position = shipPoint(args)
        .addScaledVector(forward, -horizontal)
        .add(new THREE.Vector3(0, args.shipLength * 1.8 * Math.sin(VIEW_ELEVATION), 0));
      return { position, target: shipPoint(args) };
    },
  },
  orbit: {
    id: 'orbit',
    label: '环绕',
    description: '45° 俯角自动圆周',
    frame(args: ShotArgs): ShotFrame {
      const forward = forwardOf(args.headingRad);
      // 初始方位取舰艉方向（与跟船一致的进入点），随后自动圆周。
      const startAzimuth = Math.atan2(-forward.z, -forward.x);
      return orbitFrameAt(shipPoint(args), startAzimuth, args.shipLength);
    },
  },
  tactical: {
    id: 'tactical',
    label: '战术',
    description: '右后 45° 战术视角',
    frame(args: ShotArgs): ShotFrame {
      const forward = forwardOf(args.headingRad);
      const backward = forward.clone().negate();
      const starboard = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
      const direction = backward.add(starboard).normalize();
      const horizontal = args.shipLength * 2.0 * Math.cos(VIEW_ELEVATION);
      const position = shipPoint(args)
        .addScaledVector(direction, horizontal)
        .add(new THREE.Vector3(0, args.shipLength * 2.0 * Math.sin(VIEW_ELEVATION), 0));
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
