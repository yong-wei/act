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
import { fftOceanStaticSpectrum, fftOceanFieldAt, fftOceanSnapshot, significantWaveHeight, fftOceanRenderedHeightAt, type ComplexGrid } from '@/resources/simulations/scene/water/fft-ocean';
import { gerstnerAmplitudeScale } from '@/resources/simulations/scene/water/gerstner-water';
import { MarinePlanarReflection } from '@/resources/simulations/scene/environment/planar-reflection';
import { getEnvironmentPreset, DEFAULT_ENVIRONMENT_PRESET_ID } from '@/resources/simulations/scene/environment/environment-presets';
import { useMarineVisualTime } from '@/resources/simulations/scene/frame/marine-frame-provider';
import { COMPARISON_SPECTRUM_INPUT, COMPARISON_SHORE_SEGMENT, type ComparisonBackend, type ComparisonSceneId } from './comparison-lab';
import { createComparisonSurfaceHistory, type ComparisonSurfaceHistory } from '@/resources/simulations/scene/water/comparison-surface-history';
import { comparisonVesselPose } from './comparison-lab';
import { comparisonRendererIdentity } from './comparison-renderer';

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
  sampleSurface(points: readonly (readonly [number, number])[]): Promise<{ x: number; z: number; height: number; slopeX: number; slopeZ: number }[]>;
}

declare global {
  interface Window { __comparisonOcean?: ComparisonOceanProbe; }
}

function ShallowBackdrop({ enabled }: { enabled: boolean }) {
  const renderer = useThree(s => s.gl) as unknown as WebGPURenderer;
  const root = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const bundle = useMemo(() => {
    if (!enabled) return null;
    const scene = new Scene();
    for (const [color, depth, z] of [
      [new Color(0.76, 0.42, 0.18), 4, 0],
      [new Color(0.12, 0.22, 0.34), 18, 260],
    ] as const) {
      const geometry = new PlaneGeometry(500, 220);
      geometry.rotateX(-Math.PI / 2);
      const material = new MeshBasicNodeMaterial();
      material.toneMapped = false;
      material.fragmentNode = Fn(() => {
        const edge = min(uv(), float(1).sub(uv()));
        const interior = smoothstep(0, 0.2, min(edge.x, edge.y));
        return vec4(color.r, color.g, color.b, mix(1, depth / 30, interior));
      })();
      const mesh = new Mesh(geometry, material);
      mesh.position.set(0, -8, z);
      scene.add(mesh);
    }
    return { scene, target: new RenderTarget(320, 180) };
  }, [enabled]);
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

function Surface({ backend, scene: sceneId, tier, resolution, shallowEnabled, resetToken, surfaceRef }: {
  backend: ComparisonBackend; scene: ComparisonSceneId; tier: 'high' | 'medium' | 'low';
  resolution: 128 | 256 | 512; shallowEnabled: boolean; resetToken: number;
  surfaceRef: React.MutableRefObject<ComparisonOceanProbe | null>;
}) {
  const renderer = useThree(s => s.gl) as unknown as WebGPURenderer;
  const scene = useThree(s => s.scene);
  const visualTime = useMarineVisualTime();
  const [noise, skySource] = useTexture([
    '/assets/simulation-scene/textures/ocean-foam-noise-alpha.png',
    getEnvironmentPreset(DEFAULT_ENVIRONMENT_PRESET_ID).skyTexture,
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
  const spectrum = useMemo(() => fftOceanStaticSpectrum({ ...COMPARISON_SPECTRUM_INPUT, resolution }), [resolution]);
  useEffect(() => {
    const next = createComparisonOceanPipeline(renderer, spectrum, COMPARISON_SPECTRUM_INPUT.domainMeters);
    setPipeline(next);
    return () => next.dispose();
  }, [backend, renderer, spectrum]);
  useEffect(() => {
    if (sceneId === 'feature-parity') scene.environment = sky;
    return () => {
      if (scene.environment === sky) scene.environment = null;
      sky.dispose();
    };
  }, [scene, sceneId, sky]);
  const bundle = useMemo(() => {
    if (!pipeline) return null;
    return createComparisonWaterMaterial({
      wakeResolution: resolution, pipeline: backend === 'fft' ? pipeline : null, domain: COMPARISON_SPECTRUM_INPUT.domainMeters,
      neutral: sceneId === 'wave-only', tier, foamNoise: noise, environment: sky,
      amplitudeScale: gerstnerAmplitudeScale(COMPARISON_SPECTRUM_INPUT.seaState),
      shore: COMPARISON_SHORE_SEGMENT,
    });
  }, [backend, pipeline, sceneId, tier, noise, sky, resolution]);
  const [history, setHistory] = useState<ComparisonSurfaceHistory | null>(null);
  useEffect(() => {
    if (!pipeline || !bundle) return;
    const next = createComparisonSurfaceHistory(renderer, pipeline, bundle, COMPARISON_SPECTRUM_INPUT.domainMeters,
      comparisonVesselPose, seconds => { if (backend === 'fft') pipeline.run(seconds); });
    setHistory(next);
    scene.userData.marineFoamField = next;
    return () => {
      if (scene.userData.marineFoamField === next) delete scene.userData.marineFoamField;
      next.dispose();
    };
  }, [renderer, pipeline, bundle, backend, scene]);
  useEffect(() => { history?.reset(); }, [history, resetToken]);
  const geometry = useMemo(() => {
    // 周期 FFT 的 N 个样本对应 N 个间隔；闭合端点复用第 0 个样本。
    const intervals = backend === 'fft' ? resolution : 256;
    const domain = COMPARISON_SPECTRUM_INPUT.domainMeters;
    return new PlaneGeometry(domain, domain, intervals, intervals).rotateX(-Math.PI / 2);
  }, [backend, resolution]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => bundle?.dispose(), [bundle]);
  const metrics = useRef({ frames: 0, time: 0, validating: false });
  const advance = (seconds: number) => {
    if (!bundle || metrics.current.validating) return;
    history?.advance(seconds);
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
  useFrame((state, delta) => advanceRef.current(visualTime(state, delta)));
  useEffect(() => {
    const step = (seconds: number) => advanceRef.current(seconds);
    window.__marineStageAdvance = step;
    let active = true;
    const lock = async () => {
      while (metrics.current.validating && active) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (!active) throw new Error('Surface sampler disposed');
      metrics.current.validating = true;
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
    const sampleTarget = new RenderTarget(1, 1, { type: FloatType });
    const probe: ComparisonOceanProbe = {
      history: () => history?.stats() ?? null,
      readHistory: async () => {
        if (!history) throw new Error('Surface history not ready');
        await lock();
        try { return await history.readDiagnostics(); }
        finally { metrics.current.validating = false; }
      },
      setSources: (vessel, natural) => history?.setSources(vessel, natural),
      injectFoam: (x, z, radius) => history?.injectFoam(x, z, radius),
      sampleSurface: async points => {
        if (!sampleMaterial) throw new Error('Ocean is not ready for sampling');
        await lock();
        const camera = sampleCamera;
        const target = sampleTarget;
        const result = [];
        try {
          for (const [x, z] of points) {
            camera.position.set(x, 100, z);
            camera.lookAt(x, -1, z);
            const previous = renderer.getRenderTarget();
            try {
              renderer.setRenderTarget(target);
              renderer.render(sampleScene, camera);
            } finally { renderer.setRenderTarget(previous); }
            const pixel = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1);
            result.push({ x, z, height: pixel[0], slopeX: pixel[1], slopeZ: pixel[2] });
          }
          return result;
        } finally {
          metrics.current.validating = false;
        }
      },
      reference: () => ({
        hs: significantWaveHeight(fftOceanSnapshot(spectrum, COMPARISON_SPECTRUM_INPUT.domainMeters, 0).heights),
        resolution,
      }),
      measurePointQueryMs: (samples = 60) => {
        const start = performance.now();
        for (let i = 0; i < samples; i += 1) {
          fftOceanRenderedHeightAt(spectrum, COMPARISON_SPECTRUM_INPUT.domainMeters, i * 0.1, 12.3, -45.6);
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
          const domain = COMPARISON_SPECTRUM_INPUT.domainMeters;
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
        } finally { metrics.current.validating = false; }
      },
      identity: () => ({
        ...comparisonRendererIdentity(renderer), backend, frames: metrics.current.frames,
        readbacks: pipeline?.stats().readbacks ?? 0, time: metrics.current.time,
        material: 'shared-comparison-water', resourceGeneration: pipeline?.stats().generation ?? 0,
      }),
      features: () => ({
        optics: sceneId === 'feature-parity' ? 'shared' : 'neutral',
        ibl: sceneId === 'feature-parity' && scene.environment === sky,
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
        } finally { metrics.current.validating = false; }
      },
    };
    window.__comparisonOcean = probe;
    surfaceRef.current = probe;
    return () => {
      active = false;
      sampleMaterial?.dispose(); sampleTarget.dispose();
      if (surfaceRef.current === probe) surfaceRef.current = null;
      if (window.__comparisonOcean === probe) delete window.__comparisonOcean;
      if (window.__marineStageAdvance === step) delete window.__marineStageAdvance;
    };
  }, [backend, bundle, geometry, history, pipeline, renderer, resolution, scene, sceneId, shallowEnabled, sky, spectrum, surfaceRef]);
  if (!bundle) return null;
  return <mesh name="marine-comparison-water" geometry={geometry} material={bundle.material} position={[0, -1, 0]} />;
}

export function ComparisonWater(props: {
  backend: ComparisonBackend; scene: ComparisonSceneId; tier: 'high' | 'medium' | 'low';
  resolution: 128 | 256 | 512; shallowEnabled: boolean; reflectionEnabled: boolean; resetToken: number;
  surfaceRef: React.MutableRefObject<ComparisonOceanProbe | null>;
}) {
  const full = props.scene === 'feature-parity';
  return (
    <>
      <ShallowBackdrop enabled={full && props.shallowEnabled} />
      {full ? <MarinePlanarReflection planeY={-1} enabled={props.reflectionEnabled && props.tier === 'high'} /> : null}
      <Surface {...props} shallowEnabled={full && props.shallowEnabled} />
    </>
  );
}
