/**
 * 海洋环境辐射与太阳统一源（#2099）：同一天空预设生成 IBL/太阳方向/阴影配置。
 *
 * 纯模块（THREE 依赖仅类型与数学）：PMREM 按 preset 缓存（不逐帧重生成），
 * 供 scene.environment 消费（船体 PBR 自动拾取）；水面着色器与方向光共用同一
 * 世界空间太阳方向；方向光阴影相机围绕主体区域显式拟合并随主体平移保持稳定。
 * 避免太阳能量双重计入：IBL 作为环境项（降权），方向光保持主直射。
 */

import * as THREE from 'three';

import type { SceneEnvironmentPreset } from './environment-presets';

/** IBL 强度（环境项降权，直射太阳由方向光承担——不重复计入太阳盘能量）。 */
export const MARINE_ENVIRONMENT_IBL_INTENSITY = 0.85;

/** 阴影正交包裹半宽（米）：围绕主体（约 180 m 船长 + 近景余量）拟合。 */
export const MARINE_SHADOW_BOUNDS_METERS = 260;

/** 方向光相对主体的距离（米）：固定距离保证阴影相机 near/far 稳定。 */
export const MARINE_SHADOW_SUN_DISTANCE_METERS = 900;

export interface MarineSunFrame {
  /** 世界空间太阳方向（单位向量，指向太阳）。 */
  readonly direction: THREE.Vector3;
  /** 方向光世界位置 = 主体位置 + direction × 距离。 */
  readonly lightPosition: THREE.Vector3;
  /** 阴影 target = 主体位置。 */
  readonly targetPosition: THREE.Vector3;
}

/** 由预设派生世界空间太阳方向（单位向量；同一 preset 返回同一实例，视为不可变）。 */
const sunDirectionCache = new Map<string, THREE.Vector3>();

export function worldSunDirection(preset: SceneEnvironmentPreset): THREE.Vector3 {
  const cached = sunDirectionCache.get(preset.id);
  if (cached) return cached;
  const direction = new THREE.Vector3(...preset.sun.position).normalize();
  sunDirectionCache.set(preset.id, direction);
  return direction;
}

/**
 * 主体跟随的太阳帧：同一预设下仅随主体平移，光照空间一致（仅旋转相机时不变）。
 */
export function marineSunFrameForSubject(
  preset: SceneEnvironmentPreset,
  subject: { x: number; z: number },
): MarineSunFrame {
  const direction = worldSunDirection(preset);
  const targetPosition = new THREE.Vector3(subject.x, 0, subject.z);
  const lightPosition = targetPosition
    .clone()
    .addScaledVector(direction, MARINE_SHADOW_SUN_DISTANCE_METERS);
  return { direction, lightPosition, targetPosition };
}

/** PMREM 生成器端口（渲染器适配）：生产传 THREE.WebGLRenderer 封装，测试传桩。 */
export interface MarinePmremSource {
  /** 以仅含天空的环境场景生成 PMREM（每个 renderer×preset 至多一次；持完整 RenderTarget）。 */
  fromSkyScene(skyScene: THREE.Scene): { texture: THREE.Texture; dispose(): void };
}

export interface MarineRadianceCacheEntry {
  readonly presetId: string;
  readonly texture: THREE.Texture;
  /** 完整 RenderTarget dispose（二轮复审：仅 dispose texture 不释放 framebuffer/depth）。 */
  readonly dispose: () => void;
}

/**
 * 渲染器键（复审修复）：PMREM render-target 纹理属于生成它的 WebGLRenderer，
 * 跨 Canvas/页面导航共享纹理对象会绑定不到有效 PMREM——缓存按 renderer 隔离。
 */
const rendererKeys = new WeakMap<object, string>();
let rendererKeySeq = 0;

export function marineRendererKey(renderer: object): string {
  let key = rendererKeys.get(renderer);
  if (!key) {
    rendererKeySeq += 1;
    key = `renderer-${rendererKeySeq}`;
    rendererKeys.set(renderer, key);
  }
  return key;
}

/** renderer×preset 二级缓存。 */
const radianceCache = new Map<string, Map<string, MarineRadianceCacheEntry>>();

function cacheBucket(rendererKey: string): Map<string, MarineRadianceCacheEntry> {
  let bucket = radianceCache.get(rendererKey);
  if (!bucket) {
    bucket = new Map();
    radianceCache.set(rendererKey, bucket);
  }
  return bucket;
}

/**
 * 解析（或命中缓存）当前预设的环境辐射：同一 renderer 下预设不变时复用同一
 * PMREM，不逐帧重生成；不同 renderer 各自生成，不跨 Canvas 共享纹理对象。
 */
export function resolveMarineEnvironmentRadiance(
  source: MarinePmremSource,
  skySceneFactory: () => THREE.Scene,
  presetId: string,
  rendererKey: string,
): MarineRadianceCacheEntry {
  const bucket = cacheBucket(rendererKey);
  const cached = bucket.get(presetId);
  if (cached) return cached;
  const target = source.fromSkyScene(skySceneFactory());
  const entry: MarineRadianceCacheEntry = {
    presetId,
    texture: target.texture,
    dispose: () => target.dispose(),
  };
  bucket.set(presetId, entry);
  return entry;
}

/** 缓存条目计数（测试与 QA 观测用）。 */
export function marineRadianceCacheSize(): number {
  let total = 0;
  for (const bucket of radianceCache.values()) total += bucket.size;
  return total;
}

/**
 * 释放环境辐射缓存：带 rendererKey 只释放该 renderer 的条目（Canvas 卸载时），
 * 不带参数释放全部（测试隔离）。释放后重新解析会再次生成。
 */
export function disposeMarineEnvironmentRadiance(rendererKey?: string): void {
  if (rendererKey === undefined) {
    for (const bucket of radianceCache.values()) {
      for (const entry of bucket.values()) entry.dispose();
    }
    radianceCache.clear();
    return;
  }
  const bucket = radianceCache.get(rendererKey);
  if (!bucket) return;
  for (const entry of bucket.values()) entry.dispose();
  radianceCache.delete(rendererKey);
}
