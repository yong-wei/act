import * as THREE from 'three';

import {
  computeWakeFamilyCounts,
  countWakeFamilyTotal,
  hash01,
  hashSigned,
  type WakeParticleSlot,
  type WakeTrailBuffer,
} from './wake-buffer';
import {
  clamp01,
  computeWakeFamilyBudget,
  smoothstep,
  type ResolvedWakeTrailStyle,
} from './wake-physics';

/**
 * 尾迹几何：从环形缓冲增量刷新 BufferGeometry。
 *
 * 每个粒子一个沿航向拉长的水平 quad，扩散随年龄增长，
 * 包络为源语义 smoothstep(0,0.08,freshness) × tailFade²（tailFade = 1 - smoothstep(0.68,1,age01)），
 * 不透明度写入顶点色（RGB 同值，配合顶点色材质与加法混合），
 * 开尔文臂粒子锚定左/右肩锚点。几何对象与属性数组在创建时预分配，
 * 逐帧只改写 position/color 并置 needsUpdate，不重建 BufferGeometry。
 */

/** 源实现的最低不透明度 cutoff。 */
export const MIN_WAKE_PARTICLE_OPACITY = 0.0025;

export type WakeFamily = 'core' | 'foam' | 'farFoam' | 'kelvin';

/** 单个粒子当前帧的视觉推导结果。 */
export interface WakeParticleVisual {
  readonly family: WakeFamily;
  readonly center: readonly [number, number, number];
  /** quad 前向（水平单位向量，已含角度噪声）。 */
  readonly dirX: number;
  readonly dirZ: number;
  /** quad 全长（沿 dir）。 */
  readonly length: number;
  /** quad 全宽。 */
  readonly width: number;
  readonly opacity: number;
}

/** 包络：freshness smoothstep(0,0.08) × tailFade²，与源实现一致。 */
export const computeWakeEnvelope = (age01: number) => {
  const freshness = 1 - age01;
  const tailFade = 1 - smoothstep(0.68, 1, age01);
  return smoothstep(0, 0.08, freshness) * tailFade * tailFade;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 与源实现一致的水平旋转：(x,z) 绕 Y 轴旋转 angle。 */
const rotateHorizontal = (x: number, z: number, angle: number): readonly [number, number] => {
  const rx = x * Math.cos(angle) - z * Math.sin(angle);
  const rz = x * Math.sin(angle) + z * Math.cos(angle);
  const length = Math.hypot(rx, rz) || 1;
  return [rx / length, rz / length];
};

const familyAtPlanIndex = (
  counts: { core: number; foam: number; farFoam: number; kelvin: number },
  planIndex: number
): WakeFamily | null => {
  if (planIndex < counts.core) return 'core';
  if (planIndex < counts.core + counts.foam) return 'foam';
  if (planIndex < counts.core + counts.foam + counts.farFoam) return 'farFoam';
  if (planIndex < countWakeFamilyTotal(counts)) return 'kelvin';
  return null;
};

/**
 * 推导单个槽位在当前时刻的视觉：族归属按当前年龄的四族计数重算（源语义），
 * 噪声输入为 (seed, emitOrdinal, planIndex)，流编号与源实现一致。
 * 粒子已淘汰、当前龄不在计划内或不透明度低于 cutoff 时返回 null。
 */
export const resolveWakeParticleVisual = (
  slot: WakeParticleSlot,
  style: ResolvedWakeTrailStyle,
  now: number,
  waterYSampler?: (x: number, z: number) => number
): WakeParticleVisual | null => {
  if (!slot.active || slot.lifetime <= 0) {
    return null;
  }
  const age = now - slot.birthTime;
  if (age < 0 || age > slot.lifetime) {
    return null;
  }
  const age01 = clamp01(age / slot.lifetime);
  const freshness = 1 - age01;

  const budget = computeWakeFamilyBudget({
    age01,
    activity: slot,
    style,
    emissionRate: slot.emissionRate,
    includeKelvin: slot.includeKelvin,
  });
  const counts = computeWakeFamilyCounts(budget, style.seed, slot.emitOrdinal);
  const family = familyAtPlanIndex(counts, slot.planIndex);
  if (family === null) {
    return null;
  }

  const isCore = family === 'core';
  const isKelvin = family === 'kelvin';
  const isFarFoam = family === 'farFoam';
  const wakeHalfAngle = THREE.MathUtils.degToRad(style.wakeHalfAngleDeg);
  const kelvinAngle = THREE.MathUtils.degToRad(style.wakeHalfAngleDeg + style.kelvinAngleDeg);
  const turbulence = THREE.MathUtils.clamp(style.turbulence, 0, 1.4);
  const kelvinSpread = Math.max(0.02, style.kelvinSpread);

  const sideSign = hash01(style.seed, slot.emitOrdinal, slot.planIndex, 0, 313) < 0.5 ? -1 : 1;
  const spreadNoise = hashSigned(style.seed, slot.emitOrdinal, slot.planIndex, 0, 317) * turbulence;
  const axialNoise = hashSigned(style.seed, slot.emitOrdinal, slot.planIndex, 0, 319) * turbulence;
  const angleNoise = hashSigned(style.seed, slot.emitOrdinal, slot.planIndex, 0, 331);
  const liftNoise = hash01(style.seed, slot.emitOrdinal, slot.planIndex, 0, 337);

  const anchor = isKelvin
    ? sideSign < 0
      ? slot.anchorPortShoulder
      : slot.anchorStarboardShoulder
    : slot.anchorStern;
  const backwardX = -slot.forwardX;
  const backwardZ = -slot.forwardZ;
  const rightX = -slot.forwardZ;
  const rightZ = slot.forwardX;

  const baseWidth = slot.particleLength * lerp(0.14, 0.58 + style.spreadRate * 4.2, age01);
  const baseLength = slot.particleLength * lerp(0.12, 0.44 + style.lengthMultiplier * 0.024, age01);
  const envelope = computeWakeEnvelope(age01);

  const laneWidth = isCore
    ? baseWidth * (0.085 + Math.abs(spreadNoise) * 0.07)
    : isKelvin
      ? baseWidth * (0.16 + kelvinSpread * 0.9 + Math.abs(spreadNoise) * 0.08)
      : baseWidth *
        (isFarFoam ? 0.46 + Math.abs(spreadNoise) * 0.2 : 0.22 + Math.abs(spreadNoise) * 0.12);
  const longitudinalStretch = baseLength * (isCore ? 0.24 : isKelvin ? 0.34 : isFarFoam ? 0.58 : 0.42);
  const longitudinalOffset = isCore
    ? baseLength * (0.03 + freshness * 0.16) + axialNoise * longitudinalStretch * 0.12
    : isKelvin
      ? baseLength * (0.05 + age01 * 0.28) + axialNoise * longitudinalStretch * 0.12
      : baseLength * (0.14 + age01 * (isFarFoam ? 0.72 : 0.42)) +
        axialNoise * longitudinalStretch * 0.22;

  const centerX = anchor[0] + rightX * sideSign * laneWidth + backwardX * longitudinalOffset;
  const centerZ = anchor[2] + rightZ * sideSign * laneWidth + backwardZ * longitudinalOffset;
  // 逐粒子按自身 (x,z) 采样波面高度：尾迹随涌浪连续贴水，不再被移动波峰周期性淹没。
  const centerY = (waterYSampler ? waterYSampler(centerX, centerZ) : slot.waterY) + style.surfaceBias + liftNoise * (isCore ? 0.008 : 0.004);

  const wakeDirection = isCore
    ? rotateHorizontal(backwardX, backwardZ, angleNoise * wakeHalfAngle * 0.12)
    : rotateHorizontal(
        backwardX,
        backwardZ,
        sideSign *
          wakeHalfAngle *
          (isFarFoam ? 0.92 + Math.abs(spreadNoise) * 0.12 : 0.58 + Math.abs(spreadNoise) * 0.08) +
          angleNoise * wakeHalfAngle * 0.08
      );
  const direction = isKelvin
    ? rotateHorizontal(
        backwardX,
        backwardZ,
        (sideSign < 0 ? kelvinAngle : -kelvinAngle) + angleNoise * kelvinSpread * 0.16
      )
    : wakeDirection;

  const particleSize =
    slot.birthScale *
    (isCore
      ? style.coreSize * (0.78 + freshness * 0.38)
      : isKelvin
        ? lerp(style.coreSize * 0.34, style.farSize * 0.36, Math.pow(age01, 0.82))
        : lerp(style.coreSize * 0.62, style.farSize * (isFarFoam ? 0.66 : 0.52), Math.pow(age01, 0.9)));
  const elongation = style.elongation * (isCore ? 0.68 : isKelvin ? 1.08 : isFarFoam ? 0.98 : 0.82);
  const opacityBase = isCore
    ? style.coreOpacity * 0.34
    : isKelvin
      ? style.kelvinOpacity * 0.2
      : isFarFoam
        ? style.farOpacity * 1.1
        : style.midOpacity * 0.5;
  const familyActivity = isCore ? slot.wakeActivity : isKelvin ? slot.kelvinActivity : slot.foamActivity;
  const opacity =
    opacityBase *
    envelope *
    slot.emissionOpacity *
    familyActivity *
    (isCore ? 0.94 - age01 * 0.46 : isKelvin ? 0.42 + age01 * 0.08 : 0.44 + age01 * (isFarFoam ? 0.14 : 0.08));

  if (opacity <= MIN_WAKE_PARTICLE_OPACITY) {
    return null;
  }

  const [dirX, dirZ] = rotateHorizontal(direction[0], direction[1], angleNoise * 0.05);
  return {
    family,
    center: [centerX, centerY, centerZ],
    dirX,
    dirZ,
    length: particleSize * elongation,
    width: particleSize,
    opacity,
  };
};

/** 预分配几何句柄：容量固定的 quad 池。 */
export interface WakeTrailGeometryHandle {
  readonly geometry: THREE.BufferGeometry;
  readonly capacity: number;
}

/** 创建预分配几何：uv 与索引静态写入一次，position/color 逐帧增量刷新。 */
export const createWakeTrailGeometry = (capacity: number): WakeTrailGeometryHandle => {
  const resolvedCapacity = Math.max(1, Math.round(capacity));
  const vertexCount = resolvedCapacity * 4;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(resolvedCapacity * 6);

  for (let quad = 0; quad < resolvedCapacity; quad += 1) {
    const vertexBase = quad * 4;
    uvs.set([1, 1, 0, 1, 1, 0, 0, 0], vertexBase * 2);
    indices.set(
      [vertexBase, vertexBase + 1, vertexBase + 2, vertexBase + 1, vertexBase + 3, vertexBase + 2],
      quad * 6
    );
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const colorAttribute = new THREE.BufferAttribute(colors, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  colorAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', colorAttribute);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return { geometry, capacity: resolvedCapacity };
};

const writeQuad = (
  positions: Float32Array,
  colors: Float32Array,
  quadIndex: number,
  visual: WakeParticleVisual
) => {
  const { center, dirX, dirZ, length, width, opacity } = visual;
  // 与源 appendWakeQuad 一致：a=+f+r，b=+f-r，c=-f+r，d=-f-r
  const forwardX = dirX * length * 0.5;
  const forwardZ = dirZ * length * 0.5;
  const rightX = -dirZ * width * 0.5;
  const rightZ = dirX * width * 0.5;
  const base = quadIndex * 12;
  positions[base] = center[0] + forwardX + rightX;
  positions[base + 1] = center[1];
  positions[base + 2] = center[2] + forwardZ + rightZ;
  positions[base + 3] = center[0] + forwardX - rightX;
  positions[base + 4] = center[1];
  positions[base + 5] = center[2] + forwardZ - rightZ;
  positions[base + 6] = center[0] - forwardX + rightX;
  positions[base + 7] = center[1];
  positions[base + 8] = center[2] - forwardZ + rightZ;
  positions[base + 9] = center[0] - forwardX - rightX;
  positions[base + 10] = center[1];
  positions[base + 11] = center[2] - forwardZ - rightZ;
  colors.fill(opacity, quadIndex * 12, quadIndex * 12 + 12);
};

const writeDegenerateQuad = (positions: Float32Array, colors: Float32Array, quadIndex: number) => {
  positions.fill(0, quadIndex * 12, quadIndex * 12 + 12);
  colors.fill(0, quadIndex * 12, quadIndex * 12 + 12);
};

/**
 * 按当前时刻刷新几何：可见粒子写入拉伸 quad，不可见槽位写入零面积退化 quad。
 * 只更新 position/color 属性并置 needsUpdate；返回可见粒子数。
 */
export const updateWakeTrailGeometry = (
  handle: WakeTrailGeometryHandle,
  buffer: WakeTrailBuffer,
  now: number,
  waterYSampler?: (x: number, z: number) => number
): number => {
  const positionAttribute = handle.geometry.getAttribute('position') as THREE.BufferAttribute;
  const colorAttribute = handle.geometry.getAttribute('color') as THREE.BufferAttribute;
  const positions = positionAttribute.array as Float32Array;
  const colors = colorAttribute.array as Float32Array;
  let visible = 0;

  for (let index = 0; index < handle.capacity; index += 1) {
    const slot = buffer.slots[index];
    const visual = slot ? resolveWakeParticleVisual(slot, buffer.style, now, waterYSampler) : null;
    if (visual) {
      writeQuad(positions, colors, index, visual);
      visible += 1;
    } else {
      writeDegenerateQuad(positions, colors, index);
    }
  }

  positionAttribute.needsUpdate = true;
  colorAttribute.needsUpdate = true;
  return visible;
};
