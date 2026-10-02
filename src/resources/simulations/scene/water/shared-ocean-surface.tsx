'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import {
  Color, EquirectangularReflectionMapping, Mesh, MeshBasicNodeMaterial, PlaneGeometry,
  RenderTarget, RepeatWrapping, Scene, SRGBColorSpace, OrthographicCamera, FloatType, type WebGPURenderer,
} from 'three/webgpu';
import Color4 from 'three/src/renderers/common/Color4.js';
import { Fn, float, vec4, uv, smoothstep, min, mix } from 'three/tsl';
import { createComparisonOceanPipeline, type ComparisonOceanPipeline } from '@/resources/simulations/scene/water/comparison-ocean-pipeline';
import { createComparisonWaterMaterial } from '@/resources/simulations/scene/water/comparison-water-material';
import { createMarineSurfaceGeometry } from './marine-surface-geometry';
import { fftOceanStaticSpectrum, fftOceanFieldAt, fftOceanSnapshot, significantWaveHeight, fftOceanRenderedHeightAt, type ComplexGrid } from '@/resources/simulations/scene/water/fft-ocean';
import { gerstnerAmplitudeScale } from '@/resources/simulations/scene/water/gerstner-water';
import { MarinePlanarReflection } from '@/resources/simulations/scene/environment/planar-reflection';
import { useMarineVisualTime } from '@/resources/simulations/scene/frame/marine-frame-provider';
import type { MarineShoreSegment } from '../environment/scene-layouts';
import type { HullExclusionBox } from './hull-exclusion';
import type { SurfaceHistoryPose, MarineFoamEmitter } from './comparison-surface-history';
import type { Vector3 } from 'three';
type ComparisonBackend = 'fft' | 'gerstner';
type ComparisonSceneId = 'wave-only' | 'feature-parity';
export interface SharedOceanConfig {
  spectrum: { domainMeters: number; windSpeedMps: number; windDirectionRad: number; seaState: number; seed: number };
  poseAt: (time: number) => SurfaceHistoryPose;
  timeSampler?: (time: number) => number;
  shore?: MarineShoreSegment;
  shores?: readonly MarineShoreSegment[];
  skyTexture: string;
  colors?: { waterColor: string; deepColor: string; horizonColor: string };
  sunDirection?: Vector3;
  sunIllumination?: number;
  production?: boolean;
  foamEmitters?: (pose: SurfaceHistoryPose) => readonly MarineFoamEmitter[];
  hullExclusions?: readonly HullExclusionBox[];
  sedimentPlume?: { x: number; z: number; radiusMeters: number; opacity: number } | null;
  lengthMeters?: number;
  beamMeters?: number;
  positionSampler?: () => { x: number; z: number };
}
import { createComparisonSurfaceHistory, type ComparisonSurfaceHistory } from '@/resources/simulations/scene/water/comparison-surface-history';
import { marineRendererIdentity as comparisonRendererIdentity } from '../marine-renderer';

export interface ComparisonOceanProbe {
  history(): ReturnType<ComparisonSurfaceHistory['stats']> | null;
  readHistory(): ReturnType<ComparisonSurfaceHistory['readDiagnostics']>;
  setSources(vessel: boolean, natural: boolean): void;
  injectFoam(x: number, z: number, radius?: number): void;
  identity(): { api: string; hardware: string | null; backend: string; frames: number; readbacks: number; time: number; material: string; resourceGeneration: number };
  features(): { optics: 'neutral' | 'shared'; ibl: boolean; planar: boolean; foam: boolean; shallow: boolean };
  validate(): Promise<{ ok: boolean; relativeL2: number; maxAbsError: number; displacementMaxAbsError: number }>;
  reference(): { hs: number; resolution: number };
  measurePointQueryMs(samples?: number): number;
  validateCurrentField(): Promise<{ maxAbsError: number; resolution: number; samples: number }>;
  sampleSurface(points: readonly (readonly [number, number])[]): Promise<{ x: number; z: number; height: number; slopeX: number; slopeZ: number; time?: number }[]>;
}

declare global {
  interface Window { __comparisonOcean?: ComparisonOceanProbe; }
}

export function ShallowBackdrop({ enabled, shores }: { enabled: boolean; shores?: readonly MarineShoreSegment[] }) {
  const renderer = useThree(s => s.gl) as unknown as WebGPURenderer;
  const root = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const bundle = useMemo(() => {
    if (!enabled) return null;
    const scene = new Scene();
    const bottoms = shores ? shores.map(shore => ({
      color: new Color(0.38, 0.32, 0.22), depth: shore.shoreDepthMeters,
      x: (shore.from[0] + shore.to[0]) / 2, z: (shore.from[1] + shore.to[1]) / 2,
      width: Math.hypot(shore.to[0] - shore.from[0], shore.to[1] - shore.from[1]), length: 1000,
      angle: -Math.atan2(shore.to[1] - shore.from[1], shore.to[0] - shore.from[0]),
    })) : [
      { color: new Color(0.76, 0.42, 0.18), depth: 4, x: 0, z: 0, width: 500, length: 220, angle: 0 },
      { color: new Color(0.12, 0.22, 0.34), depth: 18, x: 0, z: 260, width: 500, length: 220, angle: 0 },
    ];
    for (const { color, depth, x, z, width, length, angle } of bottoms) {
      const geometry = new PlaneGeometry(width, length);
      geometry.rotateX(-Math.PI / 2);
      geometry.rotateY(angle);
      const material = new MeshBasicNodeMaterial();
      material.toneMapped = false;
      material.fragmentNode = Fn(() => {
        const edge = min(uv(), float(1).sub(uv()));
        const interior = smoothstep(0, 0.2, min(edge.x, edge.y));
        return vec4(color.r, color.g, color.b, mix(1, depth / 30, interior));
      })();
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, shores ? -1 - depth : -8, z);
      scene.add(mesh);
    }
    return { scene, target: new RenderTarget(320, 180) };
  }, [enabled, shores]);
  useEffect(() => {
    if (!bundle) return;
    root.userData.marineShallowBackdrop = { texture: bundle.target.texture };
    return () => {
      delete root.userData.marineShallowBackdrop;
      bundle.target.dispose();
      bundle.scene.traverse(object => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          (object.material as MeshBasicNodeMaterial).dispose();
        }
      });
    };
  }, [bundle, root]);
  useFrame(() => {
    if (!bundle) return;
    const previous = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new Color4()).clone();
    const alpha = renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(bundle.target);
      renderer.setClearColor(0xffffff, 1);
      renderer.render(bundle.scene, camera);
    } finally {
      renderer.setClearColor(clear, alpha);
      renderer.setRenderTarget(previous);
    }
  });
  return null;
}

export function SharedOceanSurface({ config, backend, scene: sceneId, tier, resolution, shallowEnabled, resetToken, surfaceRef }: {
  config: SharedOceanConfig; backend: ComparisonBackend; scene: ComparisonSceneId; tier: 'high' | 'medium' | 'low';
  resolution: 128 | 256 | 512; shallowEnabled: boolean; resetToken: number;
  surfaceRef: React.MutableRefObject<ComparisonOceanProbe | null>;
}) {
  const renderer = useThree(s => s.gl) as unknown as WebGPURenderer;
  const scene = useThree(s => s.scene);
  const visualTime = useMarineVisualTime();
  const [noise, skySource] = useTexture([
    '/assets/simulation-scene/textures/ocean-foam-noise-alpha.png',
    config.skyTexture,
  ]);
  const sky = useMemo(() => {
    const result = skySource.clone();
    result.mapping = EquirectangularReflectionMapping;
    result.colorSpace = SRGBColorSpace;
    result.needsUpdate = true;
    return result;
  }, [skySource]);
  noise.wrapS = noise.wrapT = RepeatWrapping;
  const [pipeline, setPipeline] = useState<ComparisonOceanPipeline | null>(null);
  const spectrum = useMemo(() => fftOceanStaticSpectrum({ ...config.spectrum, resolution }), [resolution, config.spectrum]);
  useEffect(() => {
    const next = createComparisonOceanPipeline(renderer, spectrum, config.spectrum.domainMeters);
    setPipeline(next);
    return () => next.dispose();
  }, [backend, renderer, spectrum, config.spectrum.domainMeters]);
  useEffect(() => {
    if (!config.production && sceneId === 'feature-parity') scene.environment = sky;
    return () => {
      if (scene.environment === sky) scene.environment = null;
      sky.dispose();
    };
  }, [scene, sceneId, sky, config.production]);
  const materialTier = config.production ? 'high' : tier;
  const bundle = useMemo(() => {
    if (!pipeline) return null;
    return createComparisonWaterMaterial({
      wakeResolution: resolution, pipeline: backend === 'fft' ? pipeline : null, domain: config.spectrum.domainMeters,
      neutral: sceneId === 'wave-only', tier: materialTier, foamNoise: noise, environment: sky,
      amplitudeScale: gerstnerAmplitudeScale(config.spectrum.seaState),
      shore: config.shore, shores: config.shores, worldSpace: config.production,
      hullExclusions: config.hullExclusions, sedimentPlume: config.sedimentPlume,
      colors: config.colors, sunDirection: config.sunDirection, sunIllumination: config.sunIllumination,
    });
  }, [backend, pipeline, sceneId, materialTier, noise, sky, resolution, config]);
  const [history, setHistory] = useState<ComparisonSurfaceHistory | null>(null);
  useEffect(() => {
    if (!pipeline || !bundle) return;
    const next = createComparisonSurfaceHistory(renderer, pipeline, bundle, config.spectrum.domainMeters,
      config.poseAt, seconds => { if (backend === 'fft') pipeline.run(seconds); },
      { followFoam: config.production, lengthMeters: config.lengthMeters, beamMeters: config.beamMeters,
        foamEmitters: pose => {
          const anchors: readonly MarineFoamEmitter[] = scene.userData.marinePropulsors?.sample(pose) ?? [];
          if (!config.foamEmitters) return anchors;
          // DP 等已有推力/故障状态优先；位置、桨径与浸深仍从当前可见模型读取。
          return config.foamEmitters(pose).map(source => {
            const anchor = source.id ? anchors.find(anchor => anchor.id === source.id) : undefined;
            return anchor ? { ...anchor, headingRad: source.headingRad, activity: source.activity } : source;
          });
        } });
    setHistory(next);
    scene.userData.marineFoamField = next;
    return () => {
      if (scene.userData.marineFoamField === next) delete scene.userData.marineFoamField;
      next.dispose();
    };
  }, [renderer, pipeline, bundle, backend, scene, config]);
  useEffect(() => { history?.reset(); }, [history, resetToken]);
  const geometry = useMemo(() => {
    // 周期 FFT 的 N 个样本对应 N 个间隔；闭合端点复用第 0 个样本。
    const intervals = backend === 'fft' ? resolution : 256;
    const domain = config.spectrum.domainMeters;
    return createMarineSurfaceGeometry(domain, intervals);
  }, [backend, resolution, config.spectrum.domainMeters]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => bundle?.dispose(), [bundle]);
  const farGeometry = useMemo(() => config.production ? new PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2) : null, [config.production]);
  const farMaterial = useMemo(() => config.production ? bundle?.createFarMaterial() : null, [config.production, bundle]);
  useEffect(() => () => { farGeometry?.dispose(); }, [farGeometry]);
  useEffect(() => () => { farMaterial?.dispose(); }, [farMaterial]);
  const farRef = useRef<Mesh>(null);
  const meshRef = useRef<Mesh>(null);
  const metrics = useRef({ frames: 0, time: 0, validating: false });
  const advance = (seconds: number) => {
    if (!bundle || metrics.current.validating) return;
    bundle.opticalOctaves.value = tier === 'high' ? 8 : tier === 'medium' ? 3 : 0;
    const pose = config.poseAt(seconds);
    if (!history || history.stats().steps === 0) {
      bundle.wakeOrigin.value.set(Math.round(pose.x / 48) * 48, Math.round(pose.z / 48) * 48);
    }
    bundle.shipPose.value.set(pose.x, pose.z, pose.headingRad);
    history?.advance(seconds);
    // 整个局部波域必须落在细网格内；网格与波域同原点，背景相位仍锚定世界。
    bundle.origin.value.copy(bundle.wakeOrigin.value);
    meshRef.current?.position.set(bundle.origin.value.x, -1, bundle.origin.value.y);
    farRef.current?.position.set(bundle.origin.value.x, -1, bundle.origin.value.y);
    const renderedTime = history?.stats().time ?? seconds;
    if (backend === 'fft') pipeline?.run(renderedTime);
    bundle.time.value = renderedTime;
    bundle.shallowEnabled.value = shallowEnabled ? 1 : 0;
    const backdrop = scene.userData.marineShallowBackdrop;
    bundle.shallowTexture.value = backdrop?.texture ?? bundle.emptyTexture;
    const planar = scene.userData.marinePlanarReflection;
    bundle.planarStrength.value = planar?.strength ?? 0;
    bundle.planarTexture.value = planar?.texture ?? bundle.emptyTexture;
    if (planar) {
      bundle.planarMatrix.value.copy(planar.matrix);
    }
    metrics.current.frames += 1;
    metrics.current.time = renderedTime;
  };
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useFrame((state, delta) => {
    const seconds = visualTime(state, delta);
    advanceRef.current(config.timeSampler?.(seconds) ?? seconds);
  });
  useEffect(() => {
    const metricsState = metrics.current;
    const step = (seconds: number) => advanceRef.current(seconds);
    window.__marineStageAdvance = step;
    let active = true;
    const waiting: { resolve: () => void; reject: (error: Error) => void }[] = [];
    const lock = async () => {
      if (!active) throw new Error('Surface sampler disposed');
      if (metrics.current.validating) await new Promise<void>((resolve, reject) => waiting.push({ resolve, reject }));
      else metrics.current.validating = true;
    };
    const unlock = () => {
      if (!active) return;
      const next = waiting.shift();
      if (next) next.resolve();
      else metrics.current.validating = false;
    };
    const sampleMaterial = bundle?.createSurfaceProbeMaterial();
    const sampleScene = new Scene();
    if (sampleMaterial) {
      const mesh = new Mesh(geometry, sampleMaterial);
      mesh.position.y = -1;
      sampleScene.add(mesh);
    }
    const sampleCamera = new OrthographicCamera(-0.05, 0.05, 0.05, -0.05, 0.1, 200);
    sampleCamera.coordinateSystem = renderer.coordinateSystem;
    sampleCamera.updateProjectionMatrix();
    sampleCamera.up.set(0, 0, -1);
    const sampleTarget = new RenderTarget(8, 1, { type: FloatType });
    const probe: ComparisonOceanProbe = {
      history: () => history?.stats() ?? null,
      readHistory: async () => {
        if (!history) throw new Error('Surface history not ready');
        await lock();
        try { return await history.readDiagnostics(); }
        finally { unlock(); }
      },
      setSources: (vessel, natural) => history?.setSources(vessel, natural),
      injectFoam: (x, z, radius) => history?.injectFoam(x, z, radius),
      sampleSurface: async points => {
        if (!sampleMaterial) throw new Error('Ocean is not ready for sampling');
        // 普通 useFrame 消费者先完成本帧推进；小批命令提交后不占用 GPU 等待锁。
        await Promise.resolve();
        const camera = sampleCamera;
        const target = sampleTarget;
        const result: Awaited<ReturnType<ComparisonOceanProbe['sampleSurface']>> = [];
        for (let start = 0; start < points.length; start += 8) {
          await lock();
          const batch = points.slice(start, start + 8), outside: boolean[] = [];
          const time = metrics.current.time, previous = renderer.getRenderTarget(), autoClear = renderer.autoClear;
          let copy: ReturnType<WebGPURenderer['readRenderTargetPixelsAsync']>;
          try {
            if (!active) throw new Error('Surface sampler disposed');
            target.viewport.set(0, 0, 8, 1); target.scissorTest = false;
            renderer.setRenderTarget(target); renderer.clear(); renderer.autoClear = false;
            for (const object of sampleScene.children) object.position.set(bundle?.origin.value.x ?? 0, -1, bundle?.origin.value.y ?? 0);
            batch.forEach(([x, z], index) => {
              const isOutside = Boolean(config.production && bundle && Math.max(Math.abs(x - bundle.origin.value.x), Math.abs(z - bundle.origin.value.y)) > config.spectrum.domainMeters / 2);
              outside.push(isOutside);
              if (isOutside) return;
              camera.position.set(x, 100, z); camera.lookAt(x, -1, z);
              target.viewport.set(index, 0, 1, 1); target.scissor.set(index, 0, 1, 1); target.scissorTest = true;
              renderer.setRenderTarget(target); renderer.render(sampleScene, camera);
            });
            // 两种 backend 均在首个 await 前把纹理拷贝提交到独立读回缓冲。
            copy = renderer.readRenderTargetPixelsAsync(target, 0, 0, batch.length, 1);
          } finally {
            target.viewport.set(0, 0, 8, 1); target.scissorTest = false;
            renderer.autoClear = autoClear; renderer.setRenderTarget(previous); unlock();
          }
          const pixels = await copy;
          if (!active) throw new Error('Surface sampler disposed');
          batch.forEach(([x, z], index) => result.push(outside[index]
            ? { x, z, height: -1, slopeX: 0, slopeZ: 0, time }
            : { x, z, height: pixels[index * 4], slopeX: pixels[index * 4 + 1], slopeZ: pixels[index * 4 + 2], time }));
        }
        return result;
      },
      reference: () => ({
        hs: significantWaveHeight(fftOceanSnapshot(spectrum, config.spectrum.domainMeters, 0).heights),
        resolution,
      }),
      measurePointQueryMs: (samples = 60) => {
        const start = performance.now();
        for (let i = 0; i < samples; i += 1) {
          fftOceanRenderedHeightAt(spectrum, config.spectrum.domainMeters, i * 0.1, 12.3, -45.6);
        }
        return (performance.now() - start) / samples;
      },
      validateCurrentField: async () => {
        if (!pipeline) throw new Error('The current algorithm is not FFT');
        await lock();
        const seconds = metrics.current.time;
        try {
          const actual = await pipeline.readField();
          const n = spectrum.resolution;
          const domain = config.spectrum.domainMeters;
          let maxAbsError = 0;
          for (let sample = 0; sample < 12; sample += 1) {
            const x = (sample * 31) % n;
            const z = (sample * 47) % n;
            const expected = fftOceanFieldAt(spectrum, domain, seconds, x * domain / n, z * domain / n);
            const i = z * n + x;
            maxAbsError = Math.max(maxAbsError, Math.abs(actual.heights[i] - expected.height),
              Math.abs(actual.dx[i] - expected.displacementX), Math.abs(actual.dz[i] - expected.displacementZ));
          }
          return { maxAbsError, resolution: n, samples: 12 };
        } finally { unlock(); }
      },
      identity: () => ({
        ...comparisonRendererIdentity(renderer), backend, frames: metrics.current.frames,
        readbacks: pipeline?.stats().readbacks ?? 0, time: metrics.current.time,
        material: 'shared-comparison-water', resourceGeneration: pipeline?.stats().generation ?? 0,
      }),
      features: () => ({
        optics: sceneId === 'feature-parity' ? 'shared' : 'neutral',
        ibl: sceneId === 'feature-parity' && (config.production ? Boolean(scene.environment) : scene.environment === sky),
        planar: Boolean(scene.userData.marinePlanarReflection?.texture),
        foam: Boolean(history && sceneId === 'feature-parity' && scene.userData.marineFoamField === history),
        shallow: Boolean(shallowEnabled && scene.userData.marineShallowBackdrop),
      }),
      validate: async () => {
        await lock();
        let err2 = 0; let ref2 = 0; let maxAbsError = 0; let displacementMaxAbsError = 0;
        try {
          for (const n of [8, 16, 32]) {
            const data = new Float32Array(n * n * 2);
            const omegas = new Float32Array(n * n);
            data[(n + 2) * 2] = n * n;
            data[(n + 2) * 2 + 1] = n * n * 0.2;
            omegas[n + 2] = Math.sqrt(9.81 * 2 * Math.PI * Math.sqrt(5) / 512);
            const known: ComplexGrid = { data, omegas, resolution: n };
            const check = createComparisonOceanPipeline(renderer, known, 512);
            try {
              for (const seconds of [0, 1.25]) {
                check.run(seconds);
                const actual = await check.readField();
                for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) {
                  const expected = fftOceanFieldAt(known, 512, seconds, i * 512 / n, j * 512 / n);
                  const index = j * n + i;
                  const delta = actual.heights[index] - expected.height;
                  err2 += delta * delta; ref2 += expected.height ** 2;
                  maxAbsError = Math.max(maxAbsError, Math.abs(delta));
                  displacementMaxAbsError = Math.max(displacementMaxAbsError,
                    Math.abs(actual.dx[index] - expected.displacementX), Math.abs(actual.dz[index] - expected.displacementZ));
                }
              }
            } finally { check.dispose(); }
          }
          const relativeL2 = Math.sqrt(err2 / Math.max(ref2, 1e-20));
          return { ok: relativeL2 < 2e-4 && displacementMaxAbsError < 1e-3, relativeL2, maxAbsError, displacementMaxAbsError };
        } finally { unlock(); }
      },
    };
    window.__comparisonOcean = probe;
    surfaceRef.current = probe;
    if (config.production) scene.userData.marineOcean = probe;
    return () => {
      active = false;
      for (const task of waiting.splice(0)) task.reject(new Error('Surface sampler disposed'));
      metricsState.validating = false;
      if (scene.userData.marineOcean === probe) delete scene.userData.marineOcean;
      sampleMaterial?.dispose(); sampleTarget.dispose();
      if (surfaceRef.current === probe) surfaceRef.current = null;
      if (window.__comparisonOcean === probe) delete window.__comparisonOcean;
      if (window.__marineStageAdvance === step) delete window.__marineStageAdvance;
    };
  }, [backend, bundle, geometry, history, pipeline, renderer, resolution, scene, sceneId, shallowEnabled, sky, spectrum, surfaceRef, config]);
  if (!bundle) return null;
  return <>
    {farGeometry && farMaterial ? <mesh ref={farRef} name="marine-far-ocean" geometry={farGeometry} material={farMaterial} position={[0, -1, 0]} /> : null}
    <mesh ref={meshRef} name="marine-comparison-water" geometry={geometry} material={bundle.material} position={[0, -1, 0]} />
  </>;
}

export function ComparisonWater(props: {
  config: SharedOceanConfig; backend: ComparisonBackend; scene: ComparisonSceneId; tier: 'high' | 'medium' | 'low';
  resolution: 128 | 256 | 512; shallowEnabled: boolean; reflectionEnabled: boolean; resetToken: number;
  surfaceRef: React.MutableRefObject<ComparisonOceanProbe | null>;
}) {
  const full = props.scene === 'feature-parity';
  return (
    <>
      <ShallowBackdrop enabled={full && props.shallowEnabled} />
      {full ? <MarinePlanarReflection planeY={-1} enabled={props.reflectionEnabled && props.tier === 'high'} /> : null}
      <SharedOceanSurface {...props} shallowEnabled={full && props.shallowEnabled} />
    </>
  );
}
