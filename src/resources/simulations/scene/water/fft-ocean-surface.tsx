'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

import {
  fftOceanHeightAt,
  fftOceanSnapshot,
  fftOceanStaticSpectrum,
  significantWaveHeight,
  type FFTOceanSpectrumInput,
} from './fft-ocean';

/**
 * FFT 海面（#2121 实验，CPU FFT + GPU 渲染）：
 * - 频谱演化与 2D IFFT 在 CPU（验证过的 radix-2 DIT 路径 + 独立逐点逆 DFT
 *   互证），按固定更新频率（12Hz）重建高度网格并上传 DataTexture；
 * - GPU 端做位移渲染与简单水面着色——"第二种可运行海面运动"真实可见；
 * - 船体水高查询 = 逐点逆 DFT（fftOceanHeightAt，无整纹理读回）；
 * - GPU 侧 2D IFFT 蝶形 pass 与 WebGPU 候选**未实现**（tasks 如实不勾选；
 *   本组件是该实验的第一可运行切片）。
 */

/** 高度网格更新频率（Hz）：CPU FFT 成本 ~O(N²logN)，64² @12Hz 可忽略。 */
const HEIGHT_UPDATE_HZ = 12;

export interface FFTOceanSurfaceProps {
  readonly spectrumInput: FFTOceanSpectrumInput;
  readonly domainMeters?: number;
}

export function FFTOceanSurface({ spectrumInput, domainMeters }: FFTOceanSurfaceProps) {
  const gl = useThree((state) => state.gl);
  const meshRef = useRef<THREE.Mesh>(null);
  const domain = spectrumInput.domainMeters;

  const spectrum = useMemo(() => fftOceanStaticSpectrum(spectrumInput), [spectrumInput]);
  // CPU 镜像统计（t=0 快照）：Hs 与首帧高度纹理。
  const initial = useMemo(() => fftOceanSnapshot(spectrum, domain, 0), [spectrum, domain]);
  const cpuHs = useMemo(() => significantWaveHeight(initial.heights), [initial]);

  const heightTexture = useMemo(() => {
    const texture = new THREE.DataTexture(
      initial.heights,
      spectrum.resolution,
      spectrum.resolution,
      THREE.RedFormat,
      THREE.FloatType,
    );
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }, [initial, spectrum.resolution]);

  useEffect(() => () => heightTexture.dispose(), [heightTexture]);

  // 固定节拍重建高度（共享视觉时钟——与实验页 Gerstner 侧同时间源）。
  const updateRef = useRef({ accumulator: 0, lastTime: 0, updates: 0 });
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const dt = Math.min(0.25, Math.max(0, t - updateRef.current.lastTime));
    updateRef.current.lastTime = t;
    updateRef.current.accumulator += dt;
    const interval = 1 / HEIGHT_UPDATE_HZ;
    if (updateRef.current.accumulator < interval) return;
    updateRef.current.accumulator %= interval;
    const snapshot = fftOceanSnapshot(spectrum, domain, t);
    (heightTexture.image as { data: Float32Array }).data.set(snapshot.heights);
    heightTexture.needsUpdate = true;
    updateRef.current.updates += 1;
  });

  // QA 探针（#2121）：分辨率/Hs/更新节拍/逐点查询与延迟/WebGPU 能力。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('qa', 'fft-ocean')) return;
    window.__fftOceanRuntime = {
      resolution: spectrum.resolution,
      cpuSignificantWaveHeightMeters: cpuHs,
      heightUpdateHz: HEIGHT_UPDATE_HZ,
      heightUpdates: () => updateRef.current.updates,
      pointQuery: (x: number, z: number, t: number) => fftOceanHeightAt(spectrum, domain, t, x, z),
      measurePointQueryMs: (samples = 60) => {
        const startedAt = performance.now();
        for (let i = 0; i < samples; i += 1) {
          fftOceanHeightAt(spectrum, domain, i * 0.1, 12.3, -45.6);
        }
        return (performance.now() - startedAt) / samples;
      },
      webgpuAvailable: typeof navigator !== 'undefined' && 'gpu' in navigator,
      rendererInfo: gl.getContext().getParameter(gl.getContext().RENDERER) ?? null,
    };
    return () => {
      delete window.__fftOceanRuntime;
    };
  }, [spectrum, cpuHs, domain, gl]);

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(
      domain,
      domain,
      spectrum.resolution - 1,
      spectrum.resolution - 1,
    );
    plane.rotateX(-Math.PI / 2);
    return plane;
  }, [domain, spectrum.resolution]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uHeightTexture: { value: heightTexture },
          uDomain: { value: domain },
        },
        vertexShader: /* glsl */ `
          uniform sampler2D uHeightTexture;
          uniform float uDomain;
          varying float vHeight;
          varying vec3 vWorldPos;
          void main() {
            vec3 pos = position;
            vec2 uvH = clamp((pos.xz + uDomain * 0.5) / uDomain, 0.0, 1.0);
            float h = texture2D(uHeightTexture, uvH).r;
            pos.y += h;
            vHeight = h;
            vec4 world = modelMatrix * vec4(pos, 1.0);
            vWorldPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vHeight;
          varying vec3 vWorldPos;
          void main() {
            // 实验着色：高度微着色 + 距离雾化（与对照页 Gerstner 侧同色系基调）。
            float shade = clamp(0.5 + vHeight * 0.6, 0.35, 1.0);
            vec3 color = mix(vec3(0.05, 0.16, 0.24), vec3(0.12, 0.30, 0.38), shade);
            float fog = clamp(length(vWorldPos.xz - cameraPosition.xz) / 9000.0, 0.0, 1.0);
            color = mix(color, vec3(0.58, 0.66, 0.72), fog * 0.6);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [heightTexture, domain],
  );

  return <mesh ref={meshRef} geometry={geometry} material={material} position={[0, 0, 0]} />;
}

declare global {
  interface Window {
    /** QA 观测面（#2121 实验）：?qa=fft-ocean。 */
    __fftOceanRuntime?: {
      readonly resolution: number;
      readonly cpuSignificantWaveHeightMeters: number;
      readonly heightUpdateHz: number;
      readonly heightUpdates: () => number;
      readonly pointQuery: (x: number, z: number, t: number) => number;
      readonly measurePointQueryMs: (samples?: number) => number;
      readonly webgpuAvailable: boolean;
      readonly rendererInfo: string | null;
    };
  }
}
