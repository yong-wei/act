'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import { FFTOceanSurface } from '@/resources/simulations/scene/water/fft-ocean-surface';
import { GerstnerWater } from '@/resources/simulations/scene/water';
import { SceneEnvironmentProvider } from '@/resources/simulations/scene/environment';

/**
 * 对照客户端：?backend=fft|gerstner 由服务端 searchParams 传入（无水合分歧）。
 * 负载对齐（#2121 复审）：
 * - 两分支同镜头/画布/像素负载、同实验占位船体（180m 盒体，两分支同成本）
 *   与同远场平面（60km 无波基面，覆盖范围一致）；
 * - FFT 域 2048m/256² 与 Gerstner 近场（2048m/256²，档位无关）同域同细分；
 * - 残余差异（Gerstner 材质栈含泡沫纹理/浅水/岸线输入）声明为
 *   unresolvedDifference——帧耗差异主体归因波场算法。
 */

const SPECTRUM_INPUT = {
  resolution: 256,
  domainMeters: 2048,
  windSpeedMps: 12,
  windDirectionRad: 0.2,
  seaState: 4,
  seed: 17,
} as const;

/** 实验占位船体（两分支同负载；也是逐点水高查询的受测主体）。 */
function StandInVessel() {
  return (
    <mesh position={[0, 4, 0]} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[24, 16, 180]} />
      <meshStandardMaterial color={0x6a7681} roughness={0.85} metalness={0.1} />
    </mesh>
  );
}

/** 远场基面（两分支同覆盖：60km 无波，与 Gerstner 远场空集平基面同语义）。 */
function FarFieldPlane() {
  return (
    <mesh position={[0, -1.05, 0]} renderOrder={-5}>
      <planeGeometry args={[60000, 60000]} />
      <meshBasicMaterial color={0x3c4a55} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function FFTOceanComparisonClient({ backend }: { readonly backend: 'fft' | 'gerstner' }) {
  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-2 text-sm">
        <span data-fft-comparison-page="true" data-backend={backend}>
          海面后端对照实验（{backend === 'fft' ? 'WebGL FFT（GPU 演化 + GPU 2D IFFT）' : 'Gerstner 解析'}）
        </span>
        <span className="ml-3 text-slate-400">
          切换：/simulations/fft-ocean-comparison?backend=fft / ?backend=gerstner（同镜头/海况/船体/远场；实验路由，不影响生产）
        </span>
      </header>
      <div className="relative flex-1">
        <SceneEnvironmentProvider>
          <Canvas>
            <PerspectiveCamera makeDefault position={[0, 60, 600]} fov={55} near={1} far={50000} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[300, 400, 200]} intensity={1.4} />
            <FarFieldPlane />
            <StandInVessel />
            <Suspense fallback={null}>
              {backend === 'fft' ? (
                <FFTOceanSurface spectrumInput={SPECTRUM_INPUT} domainMeters={SPECTRUM_INPUT.domainMeters} />
              ) : (
                <GerstnerWater tier="low" seaState={4} />
              )}
            </Suspense>
            <OrbitControls enablePan enableZoom enableRotate minDistance={40} maxDistance={4000} />
          </Canvas>
        </SceneEnvironmentProvider>
      </div>
    </main>
  );
}
