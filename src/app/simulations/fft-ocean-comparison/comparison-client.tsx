'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

import { FFTOceanSurface } from '@/resources/simulations/scene/water/fft-ocean-surface';
import { fftOceanHeightAt, fftOceanStaticSpectrum } from '@/resources/simulations/scene/water/fft-ocean';
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

/** 实验占位船体：逐帧由**逐点逆 DFT 水高查询**驱动（FFT 分支；两分支同负载）。
 * 查询结果驱动船体垂荡（真实消费查询，可测可见曲面接触）。 */
function StandInVessel({ backend }: { readonly backend: 'fft' | 'gerstner' }) {
  const meshRef = useRef<THREE.Mesh>(null);
  // 频谱一次构建（与 FFTOceanSurface 同输入——同一场的独立 CPU 查询路径）。
  const spectrum = useRef(fftOceanStaticSpectrum(SPECTRUM_INPUT)).current;
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    // 船中点 + 艏艉两点（垂荡 + 纵摇由查询差分——可见接触由查询真实驱动）。
    const mid = fftOceanHeightAt(spectrum, SPECTRUM_INPUT.domainMeters, t, 0, 0);
    const bow = fftOceanHeightAt(spectrum, SPECTRUM_INPUT.domainMeters, t, 0, 85);
    const stern = fftOceanHeightAt(spectrum, SPECTRUM_INPUT.domainMeters, t, 0, -85);
    const pitch = Math.atan2(bow - stern, 170);
    meshRef.current.position.set(0, 8 + mid, 0);
    meshRef.current.rotation.set(pitch, 0, 0);
  });
  void backend;
  return (
    <mesh ref={meshRef} position={[0, 8, 0]} castShadow={false} receiveShadow={false}>
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
            <StandInVessel backend={backend} />
            <Suspense fallback={null}>
              {backend === 'fft' ? (
                <FFTOceanSurface spectrumInput={SPECTRUM_INPUT} domainMeters={SPECTRUM_INPUT.domainMeters} />
              ) : (
                /* disableFarField：两分支远场负载统一由 FarFieldPlane 承担
                   （Gerstner 内置 60km 远场关闭——帧耗差异只来自近场波场）。 */
                <GerstnerWater tier="low" seaState={4} disableFarField />
              )}
            </Suspense>
            <OrbitControls enablePan enableZoom enableRotate minDistance={40} maxDistance={4000} />
          </Canvas>
        </SceneEnvironmentProvider>
      </div>
    </main>
  );
}
