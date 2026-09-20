'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import { FFTOceanSurface } from '@/resources/simulations/scene/water/fft-ocean-surface';
import { fftOceanStaticSpectrum } from '@/resources/simulations/scene/water/fft-ocean';
import { createFFTQueryWorker } from '@/resources/simulations/scene/water/fft-query-worker';
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

/** 船体水高查询节拍（Hz）：三点 256² 逆 DFT 批次在 **Worker 线程**执行
 *（主线程零占用）；调度 setInterval 只投递任务。完整查询延迟由
 * ?qa=fft-ocean 的 measurePointQueryMs 单独测量。 */
const VESSEL_QUERY_HZ = 4;

/**
 * 实验占位船体：三点 256² 逆 DFT 批次（~30ms 级）在 **Worker 线程**执行——
 * 主线程与被测 RAF 零占用（稳定帧耗只测波场后端）；Worker 不可用时回退
 * 主线程低频查询并如实标记。useFrame 只消费最近结果（按时间戳丢弃过期）。
 * 完整查询延迟由 ?qa=fft-ocean 的 measurePointQueryMs 单独测量。
 */
function StandInVessel() {
  const meshRef = useRef<THREE.Mesh>(null);
  // 频谱一次构建（与 FFTOceanSurface 同输入——同一场的独立 CPU 查询路径）。
  const spectrum = useRef(fftOceanStaticSpectrum(SPECTRUM_INPUT)).current;
  const queryRef = useRef({ mid: 0, pitch: 0, time: 0, viaWorker: false });
  useEffect(() => {
    const domain = SPECTRUM_INPUT.domainMeters;
    const worker = createFFTQueryWorker();
    if (worker) {
      queryRef.current.viaWorker = true;
      worker.onResult((result) => {
        // 按时间戳丢弃过期结果（查询异步、结果单调推进）。
        if (result.timeSeconds < queryRef.current.time) return;
        const [mid, bow, stern] = result.results;
        queryRef.current = {
          mid,
          pitch: Math.atan2(bow - stern, 170),
          time: result.timeSeconds,
          viaWorker: true,
        };
      });
      let sequence = 0;
      const interval = window.setInterval(() => {
        sequence += 1 / VESSEL_QUERY_HZ;
        worker.post({
          spectrum: spectrum.data,
          resolution: spectrum.resolution,
          domain,
          queries: [[0, 0], [0, 85], [0, -85]],
          timeSeconds: sequence,
        });
      }, 1000 / VESSEL_QUERY_HZ);
      return () => {
        window.clearInterval(interval);
        worker.dispose();
      };
    }
    // 回退：主线程低频查询（Worker 不可用——如实标记非 Worker 路径）。
    const fallback = window.setInterval(() => {
      const t = queryRef.current.time + 1 / VESSEL_QUERY_HZ;
      const heightAt = (x: number, z: number) => {
        let sum = 0;
        for (let m = 0; m < spectrum.resolution; m += 1) {
          const kz = (2 * Math.PI * (m <= spectrum.resolution / 2 ? m : m - spectrum.resolution)) / domain;
          for (let ix = 0; ix < spectrum.resolution; ix += 1) {
            const kx = (2 * Math.PI * (ix <= spectrum.resolution / 2 ? ix : ix - spectrum.resolution)) / domain;
            const omega = Math.sqrt(9.81 * Math.max(Math.hypot(kx, kz), 1e-9));
            const phase = omega * t + kx * x + kz * z;
            const index = (m * spectrum.resolution + ix) * 2;
            sum += spectrum.data[index] * Math.cos(phase) - spectrum.data[index + 1] * Math.sin(phase);
          }
        }
        return sum / (spectrum.resolution * spectrum.resolution);
      };
      const mid = heightAt(0, 0);
      queryRef.current = {
        mid,
        pitch: Math.atan2(heightAt(0, 85) - heightAt(0, -85), 170),
        time: t,
        viaWorker: false,
      };
    }, 1000 / VESSEL_QUERY_HZ);
    return () => window.clearInterval(fallback);
  }, [spectrum]);
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.set(0, 8 + queryRef.current.mid, 0);
    mesh.rotation.set(queryRef.current.pitch, 0, 0);
  });
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
            <StandInVessel />
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
