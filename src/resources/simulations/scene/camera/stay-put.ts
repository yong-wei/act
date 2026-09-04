/**
 * 停留语义相机的纯数学层：
 * 用户偏移按视角持久保存（永不因模式切换清零）、预设基准+偏移求目标取景、
 * 跟船平移保持相对取景（target 不强制锁船）。
 */
import * as THREE from 'three';

export interface ViewOrbitOffset {
  readonly radius: number;
  readonly theta: number;
  readonly phi: number;
  /** 用户平移目标点相对预设目标的世界位移（pan 记忆，target 不锁船的关键）。 */
  readonly targetDelta: THREE.Vector3;
}

export interface ShotFrame {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}

const MIN_RADIUS = 20;
const MIN_PHI = 0.08;
const MAX_PHI = Math.PI - 0.08;

export const ZERO_ORBIT_OFFSET: ViewOrbitOffset = {
  radius: 0,
  theta: 0,
  phi: 0,
  targetDelta: new THREE.Vector3(0, 0, 0),
};

/** 各视角的偏移存储：只提供 get/capture 与显式 clear——停留语义的核心；不存在自动 reset。 */
export function createViewOffsetStore() {
  const offsets = new Map<string, ViewOrbitOffset>();
  return {
    get(view: string): ViewOrbitOffset {
      return offsets.get(view) ?? ZERO_ORBIT_OFFSET;
    },
    capture(
      view: string,
      presetFrame: ShotFrame,
      currentPosition: THREE.Vector3,
      currentTarget: THREE.Vector3
    ): ViewOrbitOffset {
      const offset = captureOrbitOffset(presetFrame, currentPosition, currentTarget);
      offsets.set(view, offset);
      return offset;
    },
    /** 显式复位（再次点选当前视图）：仅清空该视角的用户偏移，其他视角不受影响。 */
    clear(view: string): void {
      offsets.delete(view);
    },
  };
}

export type ViewOffsetStore = ReturnType<typeof createViewOffsetStore>;

/** 从当前取景反算相对预设基准的球坐标偏移与目标平移。 */
export function captureOrbitOffset(
  presetFrame: ShotFrame,
  currentPosition: THREE.Vector3,
  currentTarget: THREE.Vector3
): ViewOrbitOffset {
  const targetDelta = currentTarget.clone().sub(presetFrame.target);
  const presetOffset = presetFrame.position.clone().sub(presetFrame.target);
  const currentOffset = currentPosition.clone().sub(currentTarget);
  if (presetOffset.lengthSq() < 1e-6 || currentOffset.lengthSq() < 1e-6) {
    return { ...ZERO_ORBIT_OFFSET, targetDelta };
  }
  const presetSpherical = new THREE.Spherical().setFromVector3(presetOffset);
  const currentSpherical = new THREE.Spherical().setFromVector3(currentOffset);
  return {
    radius: currentSpherical.radius - presetSpherical.radius,
    theta: currentSpherical.theta - presetSpherical.theta,
    phi: currentSpherical.phi - presetSpherical.phi,
    targetDelta,
  };
}

/** 停留目标 = 预设基准 + 用户偏移（不回拉到默认预设；目标含用户 pan）。 */
export function resolveStayPutGoal(presetFrame: ShotFrame, offset: ViewOrbitOffset): ShotFrame {
  const target = presetFrame.target.clone().add(offset.targetDelta);
  const baseOffset = presetFrame.position.clone().sub(presetFrame.target);
  const spherical = new THREE.Spherical().setFromVector3(baseOffset);
  spherical.radius = Math.max(MIN_RADIUS, spherical.radius + offset.radius);
  spherical.theta += offset.theta;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi + offset.phi, MIN_PHI, MAX_PHI);
  return {
    position: new THREE.Vector3().setFromSpherical(spherical).add(target),
    target,
  };
}

/** 跟船平移：相机与目标同加船位移，保持用户的相对取景（target 不锁船）。 */
export function translateWithShip(frame: ShotFrame, shipDelta: THREE.Vector3): ShotFrame {
  return {
    position: frame.position.clone().add(shipDelta),
    target: frame.target.clone().add(shipDelta),
  };
}

/**
 * 默认相机对象被替换后需要重新锚定：已初始化的预设视角，且新旧相机不是同一对象。
 * 自由视角与尚未完成首次落位时不触发，避免覆盖用户取景或抢在 makeDefault 之前空转。
 */
export function shouldReanchorOnCameraIdentityChange(args: {
  readonly previousCamera: unknown;
  readonly currentCamera: unknown;
  readonly initialized: boolean;
  readonly isPresetView: boolean;
}): boolean {
  return (
    args.initialized
    && args.isPresetView
    && args.previousCamera != null
    && args.currentCamera != null
    && args.previousCamera !== args.currentCamera
  );
}
