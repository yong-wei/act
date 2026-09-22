'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

import { useMarineVisualTime } from '../frame/marine-frame-provider';
import type { MarineShoreSegment } from '../environment/scene-layouts';
import { DEFAULT_ENVIRONMENT_PRESET_ID, getEnvironmentPreset } from '../environment/environment-presets';
import { createGerstnerWaterMaterial } from './gerstner-water-material';
import { useMarineFoamField } from './foam-history-layer';
import { COMPARISON_SUN_DIRECTION, NEUTRAL_WATER_FRAGMENT, syncSharedWaterOptics } from './shared-water-optics';
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
import { MAIN_THREAD_POINT_QUERY_KIND } from '../quality/stage-performance';

/**
 * WebGL GPU FFT 海面（#2131）：GPU 频谱演化 + GPU 2D IFFT（高度与 chop 位移）+ GPU 渲染。
 * CPU 快照只做挂载时 QA 统计，不进渲染循环。生产帧循环不读回。
 */

export interface FFTOceanSurfaceProps {
  readonly spectrumInput: FFTOceanSpectrumInput;
  readonly domainMeters?: number;
  /** neutral：对照 wave-only。shared：与 Gerstner 同一片元光学。 */
  readonly optics?: 'neutral' | 'shared';
  readonly shoreSegments?: readonly MarineShoreSegment[];
  readonly shoreFadeBandMeters?: number;
  readonly shallowEnabled?: boolean;
}

const FFT_SHARED_VERTEX = /* glsl */ `
  uniform sampler2D uHeightTexture;
  uniform sampler2D uDispXTexture;
  uniform sampler2D uDispZTexture;
  uniform float uDomain;
  uniform float uResolution;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPos;
  varying float vCrest;
  varying float vElevation;
  varying vec2 vLocalXZ;
  varying vec2 vHorizontalDisp;
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
    vec3 geometricNormal = normalize(cross(pF - p0, pR - p0));
    if (geometricNormal.y < 0.0) geometricNormal = -geometricNormal;
    float dDxDx = (pR.x - pL.x) / (2.0 * cell) - 1.0;
    float dDzDz = (pF.z - pB.z) / (2.0 * cell) - 1.0;
    float dDxDz = (pF.x - pB.x) / (2.0 * cell);
    float dDzDx = (pR.z - pL.z) / (2.0 * cell);
    float jacobian = (1.0 + dDxDx) * (1.0 + dDzDz) - dDxDz * dDzDx;
    vWorldNormal = geometricNormal;
    vNormal = normalize(normalMatrix * geometricNormal);
    vCrest = clamp(1.0 - jacobian, 0.0, 1.0);
    vElevation = p0.y;
    vLocalXZ = pos.xz;
    vHorizontalDisp = vec2(p0.x - pos.x, p0.z - pos.z);
    vec4 world = modelMatrix * vec4(p0, 1.0);
    vWorldPos = world.xyz;
    vec4 viewPosition = viewMatrix * world;
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export function FFTOceanSurface({
  spectrumInput,
  domainMeters,
  optics = 'neutral',
  shoreSegments,
  shoreFadeBandMeters = 500,
  shallowEnabled = false,
}: FFTOceanSurfaceProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const foamField = useMarineFoamField();
  const foamTexture = useTexture('/assets/simulation-scene/textures/ocean-foam-noise-alpha.png');
  foamTexture.wrapS = THREE.RepeatWrapping;
  foamTexture.wrapT = THREE.RepeatWrapping;
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

  useEffect(() => {
    window.__marineStageAdvance = (timeSeconds: number) => {
      if (pipeline.ready) pipeline.run(timeSeconds);
    };
    return () => {
      delete window.__marineStageAdvance;
    };
  }, [pipeline]);

  const statsRef = useRef({ frames: 0 });
  const sharedMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  useFrame((state, delta) => {
    if (!pipeline.ready) return;
    const timeSeconds = marineVisualTime(state, delta);
    pipeline.run(timeSeconds);
    statsRef.current.frames += 1;
    const shared = sharedMaterialRef.current;
    if (!shared || optics !== 'shared') return;
    shared.uniforms.uTime.value = timeSeconds;
    const qaSpin = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('qa', 'marine-env');
    const qaShallowOff = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa-shallow') === 'off';
    syncSharedWaterOptics({
      material: shared,
      scene,
      gl,
      disableEnvironment: false,
      shallowEnabled: shallowEnabled && !qaShallowOff,
      foamOrigin: foamField ? { x: foamField.field.originX, z: foamField.field.originZ } : null,
      envSpin: qaSpin,
      elapsedSeconds: state.clock.getElapsedTime(),
    });
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
      pointQueryKind: MAIN_THREAD_POINT_QUERY_KIND,
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
    () => {
      if (optics === 'shared') {
        const colors = getEnvironmentPreset(DEFAULT_ENVIRONMENT_PRESET_ID).water;
        const shared = createGerstnerWaterMaterial({
          waves: [],
          waterColor: colors.waterColor,
          deepColor: colors.deepColor,
          horizonColor: colors.horizonColor,
          foamColor: '#d7e4ea',
          sunDirection: COMPARISON_SUN_DIRECTION,
          foamTexture,
          microNormalTier: 'high',
          vertexShaderOverride: FFT_SHARED_VERTEX,
          foamField: foamField
            ? {
              texture: foamField.texture,
              domainMeters: foamField.domainMeters,
              resolution: foamField.field.resolution,
            }
            : null,
        });
        shared.uniforms.uHeightTexture = { value: pipeline.heightTexture };
        shared.uniforms.uDispXTexture = { value: pipeline.displacementXTexture };
        shared.uniforms.uDispZTexture = { value: pipeline.displacementZTexture };
        shared.uniforms.uDomain = { value: domain };
        shared.uniforms.uResolution = { value: spectrum.resolution };
        const shoreArray = shared.uniforms.uShoreSegments.value as Float32Array;
        shoreArray.fill(0);
        (shoreSegments ?? []).slice(0, 4).forEach((segment, index) => {
          const base = index * 4;
          shoreArray[base] = segment.from[0];
          shoreArray[base + 1] = segment.from[1];
          shoreArray[base + 2] = segment.to[0];
          shoreArray[base + 3] = segment.to[1];
          (shared.uniforms.uShoreDepths.value as Float32Array)[index] = segment.shoreDepthMeters;
        });
        shared.uniforms.uShoreSegmentCount.value = Math.min(shoreSegments?.length ?? 0, 4);
        shared.uniforms.uShoreFadeBand.value = shoreFadeBandMeters;
        sharedMaterialRef.current = shared;
        return shared;
      }
      sharedMaterialRef.current = null;
      return new THREE.ShaderMaterial({
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
          varying float vElevation;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          varying vec2 vHorizontalDisp;
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
            vWorldNormal = normalize(cross(pF - p0, pR - p0));
            if (vWorldNormal.y < 0.0) vWorldNormal = -vWorldNormal;
            vElevation = p0.y;
            vHorizontalDisp = vec2(p0.x - pos.x, p0.z - pos.z);
            vec4 world = modelMatrix * vec4(p0, 1.0);
            vWorldPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: NEUTRAL_WATER_FRAGMENT,
      });
    },
    [
      optics,
      domain,
      spectrum.resolution,
      pipeline.heightTexture,
      pipeline.displacementXTexture,
      pipeline.displacementZTexture,
      foamField,
      foamTexture,
      shoreSegments,
      shoreFadeBandMeters,
    ],
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
      readonly pointQueryKind: typeof MAIN_THREAD_POINT_QUERY_KIND;
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
