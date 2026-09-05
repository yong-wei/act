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
 * GerstnerWater 网格逐帧平移到舰位、几何体已烘焙 -90° X 旋转（局部 XZ 平面、+Y 朝上，
 * 见 createGerstnerWaterGeometry），shader 以网格局部 position.xz 计算相位、position.y 写垂向位移；
 * 因此世界坐标必须先减去网格原点（舰位）再采样，并乘同一振幅倍率；
 * 否则非原点附近船体/尾迹/贴水线与可见水面采到不同波相。
 *
 * shader 的 Gerstner 水平位移（steepness 项，含振幅倍率）会真实作用于世界 XZ：
 * 世界点 P 处可见水面的高度实际来自邻近参数点 p（P = p + offset(p)）。
 * 采样必须不动点反解 p（offset 的 Lipschitz 常数 ≪1，4 轮迭代误差 <0.01mm），
 * 否则陡峭度非零时船体/水线/尾迹与 GPU 水面存在分米级高度差。
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
  const targetX = worldX - originX;
  const targetZ = worldZ - originZ;
  let paramX = targetX;
  let paramZ = targetZ;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const displacement = computeGerstnerDisplacement(waves, paramX, paramZ, timeSeconds);
    paramX = targetX - amplitudeScale * displacement.offsetX;
    paramZ = targetZ - amplitudeScale * displacement.offsetZ;
  }
  return GERSTNER_WATER_BASE_Y
    + amplitudeScale * computeGerstnerDisplacement(waves, paramX, paramZ, timeSeconds).y;
}

/**
 * 水面几何：-90° X 旋转必须烘焙进几何体，不能挂在 mesh rotation 上。
 * PlaneGeometry 原始平面在 XY（z 恒 0）；mesh 挂 rotation 时 shader 看到的
 * position.z 恒为 0（相位沿一维退化）、写入 position.y 的垂向位移落到世界水平轴。
 * 烘焙后局部即 XZ 平面、+Y 朝上，与 shader/CPU 采样同一坐标约定。
 */
export function createGerstnerWaterGeometry(size: number, resolution: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
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
    return createGerstnerWaterGeometry(size, resolution);
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
      position={[0, GERSTNER_WATER_BASE_Y, 0]}
    />
  );
}
