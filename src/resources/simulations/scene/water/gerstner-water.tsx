'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

import { GERSTNER_WAVE_SETS } from './gerstner-waves';
import { createGerstnerWaterMaterial } from './gerstner-water-material';

const RESOLUTION_BY_TIER = {
  high: 256,
  medium: 128,
  low: 64,
} as const;

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
  seaState = 3,
  waterColor = '#1a5f86',
  deepColor = '#0b2f47',
  horizonColor = '#9fc3d8',
  foamColor = '#f4fbff',
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

  const amplitudeScale = useMemo(() => 0.3 + (seaState - 1) * 0.34, [seaState]);

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
      position={[0, -1, 0]}
    />
  );
}
