/**
 * 渲染专用船壳排水排除（#2101）：声明式船体体积遮蔽水面（不逐帧布尔、
 * 不改高精模型、不引入碰撞/浮力积分器）。
 *
 * 纯模块。排除体为船体局部坐标的 2D 有向框（世界 XZ 平面）——半潜平台按
 * 真实浮筒/立柱局部定义多个框，框间开口保留海水（不整平台 bbox 一刀切）。
 * 只用于水面片元丢弃（solid hull 内不显示穿水面板）。
 */

/** 船体局部坐标 2D 有向排除框（x 前向、z 右舷，米）。 */
export interface HullExclusionBox {
  readonly centerX: number;
  readonly centerZ: number;
  readonly halfX: number;
  readonly halfZ: number;
}

/** 单场景排除框上限（GPU uniform 预算；多框按船型声明组合）。 */
export const MAX_HULL_EXCLUSION_BOXES = 6;

export interface PackedHullExclusion {
  /** 逐框 [centerX, centerZ, halfX, halfZ]×N。 */
  readonly boxes: readonly (readonly [number, number, number, number])[];
  readonly count: number;
}

export function packHullExclusion(boxes: readonly HullExclusionBox[]): PackedHullExclusion {
  const packed = boxes
    .slice(0, MAX_HULL_EXCLUSION_BOXES)
    .map((box) => [box.centerX, box.centerZ, box.halfX, box.halfZ] as const);
  return { boxes: packed, count: packed.length };
}

/**
 * 世界坐标点是否落在船壳排除体内（纯函数，供测试与 CPU 参照）。
 * shipHeadingRad 为船体朝向（世界系，前向 (cos, sin) 约定与姿态采样一致）。
 */
export function hullExcludesWater(
  exclusion: PackedHullExclusion,
  shipPosition: { x: number; z: number },
  shipHeadingRad: number,
  worldX: number,
  worldZ: number,
): boolean {
  const cos = Math.cos(shipHeadingRad);
  const sin = Math.sin(shipHeadingRad);
  const dx = worldX - shipPosition.x;
  const dz = worldZ - shipPosition.z;
  // 世界 → 船体局部（前向 x、右舷 z）。
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;
  for (const [cx, cz, hx, hz] of exclusion.boxes) {
    if (Math.abs(localX - cx) <= hx && Math.abs(localZ - cz) <= hz) {
      return true;
    }
  }
  return false;
}
