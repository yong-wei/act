'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

import { computeGerstnerDisplacement, GERSTNER_WAVE_SETS, type GerstnerWave } from './gerstner-waves';
import { createGerstnerWaterMaterial } from './gerstner-water-material';
import { DEFAULT_ENVIRONMENT_PRESET_ID, getEnvironmentPreset } from '../environment/environment-presets';
import { simulationScenePalette } from '../../components/simulation-theme';

const RESOLUTION_BY_TIER = {
  high: 256,
  medium: 128,
  low: 64,
} as const;

/** 水面网格的世界基准高度（mesh position.y）：贴水覆盖层（折线/尾迹）必须叠加同一基准。 */
export const GERSTNER_WATER_BASE_Y = -1;

/** 场景默认海况（GerstnerWater 未显式传入时使用）；CPU 采样必须复用同一海况与振幅倍率。 */
export const DEFAULT_GERSTNER_SEA_STATE = 3;

/** 海况等级 → 振幅倍率（与 createGerstnerWaterMaterial 的 uAmplitudeScale 同一公式）。 */
export function gerstnerAmplitudeScale(seaState: number): number {
  return 0.3 + (seaState - 1) * 0.34;
}

/**
 * 与可见水面同一坐标基准的 CPU 采样。
 *
 * GerstnerWater 网格逐帧平移到舰位、shader 以网格局部 position.xz 计算相位，
 * 因此世界坐标必须先减去网格原点（舰位）再采样，并乘同一振幅倍率；
 * 否则非原点附近船体/尾迹/贴水线与可见水面采到不同波相。
 */
export function sampleVisibleWaterHeight(
  waves: readonly GerstnerWave[],
  amplitudeScale: number,
  originX: number,
  originZ: number,
  worldX: number,
  worldZ: number,
  timeSeconds: number,
): number {
  return GERSTNER_WATER_BASE_Y
    + amplitudeScale * computeGerstnerDisplacement(waves, worldX - originX, worldZ - originZ, timeSeconds).y;
}

/** 未显式传色时的默认水色组：与默认环境预设（开阔海）同一真源，不再各自硬编码。 */
const DEFAULT_WATER_COLORS = getEnvironmentPreset(DEFAULT_ENVIRONMENT_PRESET_ID).water;

export interface GerstnerWaterProps {
  /** 质量档位：波分量数与网格细分随之缩放。 */
  readonly tier?: keyof typeof GERSTNER_WAVE_SETS;
  /** 船舶位置（海面跟随，与旧 WaveWater 同语义）。 */
  readonly shipPosition?: { readonly x: number; readonly z: number };
  /** 逐帧采样船舶位置的回调（替代 shipPosition，避免依赖 React 重渲染传播帧数据）。 */
  readonly positionSampler?: () => { readonly x: number; readonly z: number };
  /** 海面尺寸（米）。 */
  readonly size?: number;
  /** 海况等级 1-6，映射为振幅倍率。 */
  readonly seaState?: number;
  readonly waterColor?: string;
  readonly deepColor?: string;
  readonly horizonColor?: string;
  readonly foamColor?: string;
  readonly sunDirection?: THREE.Vector3;
}

/** GPU Gerstner 几何涌浪海面：波峰泡沫 + 菲涅尔地平线过渡。 */
export function GerstnerWater({
  tier = 'high',
  shipPosition,
  positionSampler,
  size = 60000,
  seaState = DEFAULT_GERSTNER_SEA_STATE,
  waterColor = DEFAULT_WATER_COLORS.waterColor,
  deepColor = DEFAULT_WATER_COLORS.deepColor,
  horizonColor = DEFAULT_WATER_COLORS.horizonColor,
  foamColor = simulationScenePalette.waterFoam,
  sunDirection = new THREE.Vector3(0.45, 0.75, 0.35),
}: GerstnerWaterProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const foamTexture = useTexture('/assets/simulation-scene/textures/ocean-foam-noise-alpha.png');

  foamTexture.wrapS = THREE.RepeatWrapping;
  foamTexture.wrapT = THREE.RepeatWrapping;

  const geometry = useMemo(() => {
    const resolution = RESOLUTION_BY_TIER[tier];
    return new THREE.PlaneGeometry(size, size, resolution, resolution);
  }, [size, tier]);

  const amplitudeScale = useMemo(() => gerstnerAmplitudeScale(seaState), [seaState]);

  const material = useMemo(
    () => createGerstnerWaterMaterial({
      waves: GERSTNER_WAVE_SETS[tier],
      waterColor,
      deepColor,
      horizonColor,
      foamColor,
      sunDirection,
      foamTexture,
      amplitudeScale,
    }),
    [tier, waterColor, deepColor, horizonColor, foamColor, sunDirection, foamTexture, amplitudeScale]
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.getElapsedTime();
    const sampled = positionSampler?.() ?? shipPosition;
    if (meshRef.current && sampled) {
      meshRef.current.position.x = sampled.x;
      meshRef.current.position.z = sampled.z;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GERSTNER_WATER_BASE_Y, 0]}
    />
  );
}
