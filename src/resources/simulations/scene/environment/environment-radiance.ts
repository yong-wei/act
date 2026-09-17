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

/** 由预设派生世界空间太阳方向（单位向量）。 */
export function worldSunDirection(preset: SceneEnvironmentPreset): THREE.Vector3 {
  return new THREE.Vector3(...preset.sun.position).normalize();
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
  /** 以仅含天空的环境场景生成 PMREM 纹理（每个 preset 至多一次）。 */
  fromSkyScene(skyScene: THREE.Scene): THREE.Texture;
}

export interface MarineRadianceCacheEntry {
  readonly presetId: string;
  readonly texture: THREE.Texture;
}

const radianceCache = new Map<string, MarineRadianceCacheEntry>();

/**
 * 解析（或命中缓存）当前预设的环境辐射：预设不变时重复渲染复用同一 PMREM，
 * 不逐帧重生成；预设切换命中既有缓存或经 source 生成一次。
 */
export function resolveMarineEnvironmentRadiance(
  source: MarinePmremSource,
  skySceneFactory: () => THREE.Scene,
  presetId: string,
): MarineRadianceCacheEntry {
  const cached = radianceCache.get(presetId);
  if (cached) return cached;
  const entry: MarineRadianceCacheEntry = {
    presetId,
    texture: source.fromSkyScene(skySceneFactory()),
  };
  radianceCache.set(presetId, entry);
  return entry;
}

/** 缓存命中计数（测试与 QA 观测用）。 */
export function marineRadianceCacheSize(): number {
  return radianceCache.size;
}

/** 释放全部环境辐射缓存（卸载/测试隔离时调用；纹理 dispose 由调用方或 THREE GC 兜底）。 */
export function disposeMarineEnvironmentRadiance(): void {
  for (const entry of radianceCache.values()) {
    entry.texture.dispose();
  }
  radianceCache.clear();
}
