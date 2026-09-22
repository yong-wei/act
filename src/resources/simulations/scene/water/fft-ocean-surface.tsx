'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

import { useMarineVisualTime } from '../frame/marine-frame-provider';
import {
  FFT_OCEAN_CONTACT_TOLERANCE_METERS,
  fftOceanCascadeSplit,
  fftOceanContactHeightAt,
  fftOceanFieldAt,
  fftOceanHeightAt,
  fftOceanSnapshot,
  fftOceanStaticSpectrum,
  significantWaveHeight,
  type FFTOceanSpectrumInput,
} from './fft-ocean';
import { createFftOceanGpuPipeline, validateFftOceanGpuAgainstDft } from './fft-ocean-gpu-pipeline';

/**
 * WebGL GPU FFT 海面（#2131）：GPU 频谱演化 + GPU 2D IFFT（高度与 chop 位移）+ GPU 渲染。
 * CPU 快照只做挂载时 QA 统计，不进渲染循环。生产帧循环不读回。
 */

export interface FFTOceanSurfaceProps {
  readonly spectrumInput: FFTOceanSpectrumInput;
  readonly domainMeters?: number;
}

export function FFTOceanSurface({ spectrumInput, domainMeters }: FFTOceanSurfaceProps) {
  const gl = useThree((state) => state.gl);
  const meshRef = useRef<THREE.Mesh>(null);
  const marineVisualTime = useMarineVisualTime();
  const domain = domainMeters ?? spectrumInput.domainMeters;

  const spectrum = useMemo(() => fftOceanStaticSpectrum(spectrumInput), [spectrumInput]);
  const cpuHs = useMemo(
    () => significantWaveHeight(fftOceanSnapshot(spectrum, domain, 0).heights),
    [spectrum, domain],
  );
  const cascade = useMemo(() => fftOceanCascadeSplit(spectrum, domain), [spectrum, domain]);

  const pipeline = useMemo(
    () => createFftOceanGpuPipeline(gl, spectrum, domain),
    [gl, spectrum, domain],
  );

  useEffect(() => () => pipeline.dispose(), [pipeline]);

  const statsRef = useRef({ frames: 0 });
  useFrame((state, delta) => {
    if (!pipeline.ready) return;
    pipeline.run(marineVisualTime(state, delta));
    statsRef.current.frames += 1;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('qa', 'fft-ocean')) return;
    window.__fftOceanRuntime = {
      resolution: spectrum.resolution,
      cpuSignificantWaveHeightMeters: cpuHs,
      gpuPipelineActive: pipeline.ready,
      gpuFrames: () => statsRef.current.frames,
      pointQuery: (x: number, z: number, t: number) => fftOceanHeightAt(spectrum, domain, t, x, z),
      contactQuery: (x: number, z: number, t: number) => (
        fftOceanContactHeightAt(spectrum, domain, t, x, z)
      ),
      fieldQuery: (x: number, z: number, t: number) => fftOceanFieldAt(spectrum, domain, t, x, z),
      measurePointQueryMs: (samples = 60) => {
        const startedAt = performance.now();
        for (let i = 0; i < samples; i += 1) {
          fftOceanHeightAt(spectrum, domain, i * 0.1, 12.3, -45.6);
        }
        return (performance.now() - startedAt) / samples;
      },
      validateGpuAgainstDft: () => validateFftOceanGpuAgainstDft(gl),
      cascadeEnergies: () => ({
        kSplit: cascade.kSplit,
        lowEnergy: cascade.lowEnergy,
        highEnergy: cascade.highEnergy,
        totalEnergy: cascade.totalEnergy,
      }),
      contactToleranceMeters: FFT_OCEAN_CONTACT_TOLERANCE_METERS,
      webgpuAvailable: typeof navigator !== 'undefined' && 'gpu' in navigator,
      rendererInfo: gl.getContext().getParameter(gl.getContext().RENDERER) ?? null,
    };
    return () => {
      delete window.__fftOceanRuntime;
    };
  }, [spectrum, cpuHs, domain, gl, cascade, pipeline]);

  const geometry = useMemo(() => {
    // N 格点 / N 区间闭合边界：顶点间距 L/N，两端重合周期缝。
    const plane = new THREE.PlaneGeometry(domain, domain, spectrum.resolution, spectrum.resolution);
    plane.rotateX(-Math.PI / 2);
    return plane;
  }, [domain, spectrum.resolution]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uHeightTexture: { value: pipeline.heightTexture },
          uDispXTexture: { value: pipeline.displacementXTexture },
          uDispZTexture: { value: pipeline.displacementZTexture },
          uDomain: { value: domain },
          uResolution: { value: spectrum.resolution },
        },
        vertexShader: /* glsl */ `
          uniform sampler2D uHeightTexture;
          uniform sampler2D uDispXTexture;
          uniform sampler2D uDispZTexture;
          uniform float uDomain;
          uniform float uResolution;
          varying float vHeight;
          varying float vJacobian;
          varying vec3 vWorldPos;
          varying vec3 vNormal;
          vec3 sampleDisplaced(vec2 uv, vec3 lattice) {
            float h = texture2D(uHeightTexture, uv).r;
            float dx = texture2D(uDispXTexture, uv).r;
            float dz = texture2D(uDispZTexture, uv).r;
            return vec3(lattice.x + dx, h, lattice.z + dz);
          }
          void main() {
            vec3 pos = position;
            vec2 uvH = fract(pos.xz / uDomain);
            float texel = 1.0 / uResolution;
            float cell = uDomain / uResolution;
            vec3 p0 = sampleDisplaced(uvH, pos);
            vec3 pR = sampleDisplaced(fract(uvH + vec2(texel, 0.0)), pos + vec3(cell, 0.0, 0.0));
            vec3 pF = sampleDisplaced(fract(uvH + vec2(0.0, texel)), pos + vec3(0.0, 0.0, cell));
            vec3 pL = sampleDisplaced(fract(uvH - vec2(texel, 0.0)), pos - vec3(cell, 0.0, 0.0));
            vec3 pB = sampleDisplaced(fract(uvH - vec2(0.0, texel)), pos - vec3(0.0, 0.0, cell));
            vNormal = normalize(cross(pF - p0, pR - p0));
            float dDxDx = (pR.x - pL.x) / (2.0 * cell) - 1.0;
            float dDzDz = (pF.z - pB.z) / (2.0 * cell) - 1.0;
            float dDxDz = (pF.x - pB.x) / (2.0 * cell);
            float dDzDx = (pR.z - pL.z) / (2.0 * cell);
            vJacobian = (1.0 + dDxDx) * (1.0 + dDzDz) - dDxDz * dDzDx;
            vHeight = p0.y;
            vec4 world = modelMatrix * vec4(p0, 1.0);
            vWorldPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vHeight;
          varying float vJacobian;
          varying vec3 vWorldPos;
          varying vec3 vNormal;
          void main() {
            vec3 n = normalize(vNormal);
            float ndl = clamp(dot(n, normalize(vec3(0.35, 1.0, 0.25))), 0.25, 1.0);
            float foam = clamp(1.0 - vJacobian, 0.0, 1.0);
            float shade = clamp(0.5 + vHeight * 0.6, 0.35, 1.0);
            vec3 color = mix(vec3(0.05, 0.16, 0.24), vec3(0.12, 0.30, 0.38), shade);
            color *= ndl;
            color = mix(color, vec3(0.78, 0.86, 0.90), foam * 0.35);
            float fog = clamp(length(vWorldPos.xz - cameraPosition.xz) / 9000.0, 0.0, 1.0);
            color = mix(color, vec3(0.58, 0.66, 0.72), fog * 0.6);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [pipeline.heightTexture, pipeline.displacementXTexture, pipeline.displacementZTexture, domain, spectrum.resolution],
  );

  return (
    <mesh
      ref={meshRef}
      name="marine-fft-ocean"
      geometry={geometry}
      material={material}
      position={[0, 0, 0]}
    />
  );
}

declare global {
  interface Window {
    /** QA 观测面（#2121/#2131 实验）：?qa=fft-ocean。 */
    __fftOceanRuntime?: {
      readonly resolution: number;
      readonly cpuSignificantWaveHeightMeters: number;
      readonly gpuPipelineActive: boolean;
      readonly gpuFrames: () => number;
      readonly pointQuery: (x: number, z: number, t: number) => number;
      readonly contactQuery: (x: number, z: number, t: number) => number;
      readonly fieldQuery: (
        x: number,
        z: number,
        t: number,
      ) => ReturnType<typeof fftOceanFieldAt>;
      readonly measurePointQueryMs: (samples?: number) => number;
      readonly validateGpuAgainstDft: () => ReturnType<typeof validateFftOceanGpuAgainstDft>;
      readonly cascadeEnergies: () => {
        readonly kSplit: number;
        readonly lowEnergy: number;
        readonly highEnergy: number;
        readonly totalEnergy: number;
      };
      readonly contactToleranceMeters: number;
      readonly webgpuAvailable: boolean;
      readonly rendererInfo: string | null;
    };
  }
}
