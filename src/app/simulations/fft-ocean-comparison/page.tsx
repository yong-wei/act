'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

import { FFTOceanSurface } from '@/resources/simulations/scene/water/fft-ocean-surface';
import { GerstnerWater } from '@/resources/simulations/scene/water';
import { SceneEnvironmentProvider } from '@/resources/simulations/scene/environment';

/**
 * FFT ↔ Gerstner 对照实验页（#2121）：
 * `?backend=fft|gerstner`（缺省 fft）在同一镜头/海况/分辨率下切换第二种
 * 可运行海面运动——公平比较波场算法（受控变量声明见 spectral-evaluation）。
 * 船体水高查询演示：FFT 侧经逐点逆 DFT（无整纹理读回）。
 * 生产不变量：本页是实验路由，不改生产默认海洋后端。
 */

const SPECTRUM_INPUT = {
  resolution: 64,
  domainMeters: 256,
  windSpeedMps: 12,
  windDirectionRad: 0.2,
  seaState: 4,
  seed: 17,
} as const;

export default function FFTOceanComparisonPage() {
  const backend =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('backend') === 'gerstner'
      ? 'gerstner'
      : 'fft';

  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-2 text-sm">
        <span data-fft-comparison-page="true" data-backend={backend}>
          海面后端对照实验（{backend === 'fft' ? 'FFT 频谱（CPU 演化 + GPU 渲染）' : 'Gerstner 解析'}）
        </span>
        <span className="ml-3 text-slate-400">
          切换：?backend=fft / ?backend=gerstner（同镜头与海况；实验路由，不影响生产）
        </span>
      </header>
      <div className="relative flex-1">
        <SceneEnvironmentProvider>
          <Canvas>
            <PerspectiveCamera makeDefault position={[0, 60, 220]} fov={55} near={1} far={50000} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[300, 400, 200]} intensity={1.4} />
            <Suspense fallback={null}>
              {backend === 'fft' ? (
                <FFTOceanSurface spectrumInput={SPECTRUM_INPUT} domainMeters={SPECTRUM_INPUT.domainMeters} />
              ) : (
                <GerstnerWater tier="high" seaState={4} />
              )}
            </Suspense>
            <OrbitControls enablePan enableZoom enableRotate minDistance={40} maxDistance={2000} />
          </Canvas>
        </SceneEnvironmentProvider>
      </div>
    </main>
  );
}
