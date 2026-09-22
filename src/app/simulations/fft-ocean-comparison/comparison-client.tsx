'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { VersionedFleetShip } from '@/resources/simulations/components/versioned-fleet-ship';
import { ModelAssetErrorBoundary } from '@/resources/simulations/components/fallback-gltf-model';
import { isDescriptorArtifactUrl } from '@/resources/simulations/model-packages/types';
import { matchActivatedFleetPackage } from '@/resources/simulations/model-packages/fleet-packages';
import { resolveVersionedDefault } from '@/lib/browser-delivery/client';
import { SceneEnvironmentProvider } from '@/resources/simulations/scene/environment';
import {
  SceneQualityDriver,
  SceneQualityProvider,
  useSceneQuality,
  type QualityTierId,
} from '@/resources/simulations/scene/quality';
import {
  MarineFrameProvider,
  useMarineFrameRunner,
  useMarineVisualTime,
} from '@/resources/simulations/scene/frame/marine-frame-provider';
import type { MarineFrameInputs, MarinePoseOwnership } from '@/resources/simulations/scene/frame/marine-frame';
import {
  FFTOceanSurface,
} from '@/resources/simulations/scene/water/fft-ocean-surface';
import {
  FFT_OCEAN_CHOP_LAMBDA,
  createFftOceanCompressionSampler,
  fftOceanContactHeightAt,
  fftOceanStaticSpectrum,
} from '@/resources/simulations/scene/water/fft-ocean';
import { createFFTQueryWorker } from '@/resources/simulations/scene/water/fft-query-worker';
import { MarineShallowBackdrop, COMPARISON_SUN_DIRECTION } from '@/resources/simulations/scene/water/shared-water-optics';
import { MarinePlanarReflection } from '@/resources/simulations/scene/environment/planar-reflection';
import { MarineFoamFieldProvider } from '@/resources/simulations/scene/water/foam-history-layer';
import {
  GerstnerWater,
  GERSTNER_WATER_BASE_Y,
  createNearFieldSurfaceQuery,
  gerstnerAmplitudeScale,
} from '@/resources/simulations/scene/water';
import type { BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import {
  COMPARISON_BOW_OFFSET_METERS,
  COMPARISON_FEATURE_MATRIX,
  COMPARISON_SHORE_SEGMENT,
  COMPARISON_MISSING_VESSEL_URL,
  COMPARISON_QUERY_SPAN_METERS,
  COMPARISON_SPECTRUM_INPUT,
  COMPARISON_VESSEL_LENGTH_METERS,
  COMPARISON_VESSEL_QUERY_HZ,
  comparisonFarFieldRing,
  composeWaterDatum,
  labIsReady,
  vesselPitchFromSamples,
  type ComparisonBackend,
  type ComparisonLabApi,
  type ComparisonLabCapture,
  type ComparisonLabIdentity,
  type ComparisonOpticsState,
  type ComparisonQueryMetrics,
  type ComparisonRunMode,
  type ComparisonSceneId,
} from './comparison-lab';

/**
 * 对照客户端（#2130）：?backend=fft|gerstner 与 ?scene=wave-only|feature-parity
 * 由服务端 searchParams 传入（无水合分歧）。
 *
 * 两分支同镜头/画布、同高精 055、同水平远场环带、同一 GERSTNER_WATER_BASE_Y。
 * 船体查询走当前后端；visualTime 来自 MarineFrame，不用 setInterval 自造时间。
 * wave-only 固定 Gerstner low 与 FFT 同域同细分（domainMeters: 2048 / resolution: 256）；
 * feature-parity 使用完整档位。查询延迟单独测量（口径分离）：measurePointQueryMs
 * 仍由 ?qa=fft-ocean 的 __fftOceanRuntime 提供。
 * 残余差异（Gerstner 材质栈含泡沫纹理/浅水/岸线输入）声明为 unresolvedDifference。
 */

const COMPARISON_POSE_OWNERSHIP: MarinePoseOwnership = {
  heave: 'visual-water',
  pitch: 'visual-water',
  roll: 'fixed',
};

const FAR_FIELD = comparisonFarFieldRing();

function LockQualityTier({ tier }: { readonly tier: QualityTierId }) {
  const { setOverride } = useSceneQuality();
  useEffect(() => {
    setOverride(tier);
  }, [setOverride, tier]);
  return null;
}

export function FarFieldRing() {
  const geometry = useMemo(() => {
    const outer = FAR_FIELD.outerHalfExtent;
    const inner = FAR_FIELD.innerHalfExtent;
    const shape = new THREE.Shape();
    shape.moveTo(-outer, -outer);
    shape.lineTo(outer, -outer);
    shape.lineTo(outer, outer);
    shape.lineTo(-outer, outer);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-inner, -inner);
    hole.lineTo(-inner, inner);
    hole.lineTo(inner, inner);
    hole.lineTo(inner, -inner);
    hole.closePath();
    shape.holes.push(hole);
    const next = new THREE.ShapeGeometry(shape);
    next.rotateX(FAR_FIELD.rotationX);
    return next;
  }, []);
  return (
    <mesh
      name="comparison-far-field"
      position={[0, FAR_FIELD.baseY, 0]}
      geometry={geometry}
      renderOrder={-5}
    >
      <meshBasicMaterial color={0x3c4a55} side={THREE.DoubleSide} />
    </mesh>
  );
}

function MissingVesselAsset() {
  useGLTF(COMPARISON_MISSING_VESSEL_URL, true, true);
  return null;
}

export function ComparisonVessel({
  failAsset,
  waterYSampler,
  pitchRef,
  simRef,
  resetToken,
  onMountedUrl,
  onLoadFailed,
}: {
  readonly failAsset: boolean;
  readonly waterYSampler: () => number;
  readonly pitchRef: React.MutableRefObject<number>;
  readonly simRef: React.MutableRefObject<BindingTelemetrySource>;
  readonly resetToken: number;
  readonly onMountedUrl: (url: string) => void;
  readonly onLoadFailed: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.x = pitchRef.current;
  });

  if (failAsset) {
    return (
      <ModelAssetErrorBoundary
        fallback={<FailedVesselMarker onLoadFailed={onLoadFailed} />}
      >
        <Suspense fallback={null}>
          <MissingVesselAsset />
        </Suspense>
      </ModelAssetErrorBoundary>
    );
  }

  return (
    <group ref={groupRef}>
      <ModelAssetErrorBoundary fallback={<FailedVesselMarker onLoadFailed={onLoadFailed} />}>
        <VersionedFleetShip
          logicalId="destroyer"
          simRef={simRef}
          position={{ x: 0, z: 0 }}
          headingRad={0}
          waterYSampler={waterYSampler}
          sceneLengthMeters={COMPARISON_VESSEL_LENGTH_METERS}
          resetToken={resetToken}
          legacyYawOffsetRad={0}
          fallbackDraftMeters={8}
          onMountedUrl={onMountedUrl}
        />
      </ModelAssetErrorBoundary>
    </group>
  );
}

function FailedVesselMarker({ onLoadFailed }: { readonly onLoadFailed: () => void }) {
  useEffect(() => {
    onLoadFailed();
  }, [onLoadFailed]);
  return null;
}

function ComparisonQueries({
  backend,
  samplesRef,
  metricsRef,
  resetToken,
}: {
  readonly backend: ComparisonBackend;
  readonly samplesRef: React.MutableRefObject<{ mid: number; bow: number; stern: number; time: number }>;
  readonly metricsRef: React.MutableRefObject<ComparisonQueryMetrics | null>;
  readonly resetToken: number;
}) {
  const marineVisualTime = useMarineVisualTime();
  const spectrum = useMemo(() => fftOceanStaticSpectrum(COMPARISON_SPECTRUM_INPUT), []);

  useFrame((state, delta) => {
    if (backend !== 'gerstner') return;
    const timeSeconds = marineVisualTime(state, delta);
    const query = createNearFieldSurfaceQuery(
      gerstnerAmplitudeScale(COMPARISON_SPECTRUM_INPUT.seaState),
      0,
      0,
      timeSeconds,
    );
    samplesRef.current = {
      mid: query.heightAt(0, 0),
      bow: query.heightAt(0, COMPARISON_BOW_OFFSET_METERS),
      stern: query.heightAt(0, -COMPARISON_BOW_OFFSET_METERS),
      time: timeSeconds,
    };
  });

  if (backend !== 'fft') return null;
  return (
    <FftWorkerPoster
      samplesRef={samplesRef}
      metricsRef={metricsRef}
      spectrum={spectrum}
      resetToken={resetToken}
    />
  );
}

function FftWorkerPoster({
  samplesRef,
  metricsRef,
  spectrum,
  resetToken,
}: {
  readonly samplesRef: React.MutableRefObject<{ mid: number; bow: number; stern: number; time: number }>;
  readonly metricsRef: React.MutableRefObject<ComparisonQueryMetrics | null>;
  readonly spectrum: ReturnType<typeof fftOceanStaticSpectrum>;
  readonly resetToken: number;
}) {
  const runner = useMarineFrameRunner();
  const marineVisualTime = useMarineVisualTime();
  const workerRef = useRef<ReturnType<typeof createFFTQueryWorker>>(null);
  const lastPostRef = useRef(-1);
  const visualTimeRef = useRef(0);

  useEffect(() => {
    lastPostRef.current = -1;
    samplesRef.current = { mid: 0, bow: 0, stern: 0, time: 0 };
    metricsRef.current = null;
    const worker = createFFTQueryWorker();
    workerRef.current = worker;
    if (!worker) return undefined;
    worker.init({
      spectrum: spectrum.data,
      resolution: spectrum.resolution,
      domain: COMPARISON_SPECTRUM_INPUT.domainMeters,
      chopLambda: FFT_OCEAN_CHOP_LAMBDA,
    });
    worker.onResult((result) => {
      if (result.timeSeconds < samplesRef.current.time) return;
      const [mid, bow, stern] = result.results;
      samplesRef.current = { mid, bow, stern, time: result.timeSeconds };
      const receivedAt = performance.timeOrigin + performance.now();
      metricsRef.current = {
        computeMs: result.computeMs,
        queueMs: result.queueMs,
        e2eMs: receivedAt - result.postedAt,
        resultAgeSeconds: Math.max(0, visualTimeRef.current - result.timeSeconds),
        viaWorker: true,
      };
    });
    return () => {
      worker.dispose();
      workerRef.current = null;
    };
  }, [resetToken, samplesRef, metricsRef, spectrum]);

  useFrame((state, delta) => {
    const timeSeconds = marineVisualTime(state, delta);
    visualTimeRef.current = timeSeconds;
    if (timeSeconds - lastPostRef.current < 1 / COMPARISON_VESSEL_QUERY_HZ) return;
    lastPostRef.current = timeSeconds;
    const worker = workerRef.current;
    if (worker) {
      worker.post({
        queries: [[0, 0], [0, COMPARISON_BOW_OFFSET_METERS], [0, -COMPARISON_BOW_OFFSET_METERS]],
        timeSeconds,
        postedAt: performance.timeOrigin + performance.now(),
      });
      return;
    }
    // 回退：Worker 不可用时主线程低频查询，viaWorker: false。
    const domain = COMPARISON_SPECTRUM_INPUT.domainMeters;
    const started = performance.now();
    samplesRef.current = {
      mid: fftOceanContactHeightAt(spectrum, domain, timeSeconds, 0, 0),
      bow: fftOceanContactHeightAt(spectrum, domain, timeSeconds, 0, COMPARISON_BOW_OFFSET_METERS),
      stern: fftOceanContactHeightAt(spectrum, domain, timeSeconds, 0, -COMPARISON_BOW_OFFSET_METERS),
      time: timeSeconds,
    };
    metricsRef.current = {
      computeMs: performance.now() - started,
      queueMs: 0,
      e2eMs: performance.now() - started,
      resultAgeSeconds: 0,
      viaWorker: false,
    };
    void runner;
  });
  return null;
}

function ComparisonLabBridge({
  backend,
  scene,
  samplesRef,
  metricsRef,
  pitchRef,
  identityRef,
  runModeRef,
  setResetToken,
  setShallowEnabled,
  opticsRef,
}: {
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly samplesRef: React.MutableRefObject<{ mid: number; bow: number; stern: number; time: number }>;
  readonly metricsRef: React.MutableRefObject<ComparisonQueryMetrics | null>;
  readonly pitchRef: React.MutableRefObject<number>;
  readonly identityRef: React.MutableRefObject<ComparisonLabIdentity>;
  readonly runModeRef: React.MutableRefObject<ComparisonRunMode>;
  readonly setResetToken: (updater: (value: number) => number) => void;
  readonly setShallowEnabled: (enabled: boolean) => void;
  readonly opticsRef: React.MutableRefObject<ComparisonOpticsState>;
}) {
  const runner = useMarineFrameRunner();
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  useFrame(() => {
    pitchRef.current = vesselPitchFromSamples(
      samplesRef.current.bow,
      samplesRef.current.stern,
      COMPARISON_QUERY_SPAN_METERS,
    );
    if (!firstFrameReady) setFirstFrameReady(true);
    identityRef.current = {
      ...identityRef.current,
      firstFrameReady: true,
      queryBackend: backend,
      runMode: runModeRef.current,
    };
  });

  const sampleDisplacement = useCallback((x: number, z: number, timeSeconds: number) => {
    if (backend === 'gerstner') {
      return createNearFieldSurfaceQuery(
        gerstnerAmplitudeScale(COMPARISON_SPECTRUM_INPUT.seaState),
        0,
        0,
        timeSeconds,
      ).heightAt(x, z);
    }
    if (Math.abs(timeSeconds - samplesRef.current.time) < 1e-3) {
      if (x === 0 && z === 0) return samplesRef.current.mid;
      if (x === 0 && z === COMPARISON_BOW_OFFSET_METERS) return samplesRef.current.bow;
      if (x === 0 && z === -COMPARISON_BOW_OFFSET_METERS) return samplesRef.current.stern;
    }
    return fftOceanContactHeightAt(
      fftOceanStaticSpectrum(COMPARISON_SPECTRUM_INPUT),
      COMPARISON_SPECTRUM_INPUT.domainMeters,
      timeSeconds,
      x,
      z,
    );
  }, [backend, samplesRef]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const api: ComparisonLabApi = {
      ready: () => labIsReady(identityRef.current),
      reset: () => {
        samplesRef.current = { mid: 0, bow: 0, stern: 0, time: 0 };
        pitchRef.current = 0;
        runner?.clock.reset();
        setResetToken((value) => value + 1);
      },
      seek: (timeSeconds) => {
        runner?.clock.seek(timeSeconds);
      },
      step: (dtSeconds) => {
        const current = runner?.clock.timeSeconds() ?? 0;
        runner?.clock.seek(Math.max(0, current + dtSeconds));
      },
      setRunMode: (mode) => {
        runModeRef.current = mode;
      },
      capture: (): ComparisonLabCapture => {
        const timeSeconds = runner?.clock.timeSeconds() ?? samplesRef.current.time;
        const identity = identityRef.current;
        return {
          visualTimeSeconds: timeSeconds,
          waterHeightOrigin: composeWaterDatum(GERSTNER_WATER_BASE_Y, sampleDisplacement(0, 0, timeSeconds)),
          bowHeight: composeWaterDatum(
            GERSTNER_WATER_BASE_Y,
            sampleDisplacement(0, COMPARISON_BOW_OFFSET_METERS, timeSeconds),
          ),
          sternHeight: composeWaterDatum(
            GERSTNER_WATER_BASE_Y,
            sampleDisplacement(0, -COMPARISON_BOW_OFFSET_METERS, timeSeconds),
          ),
          backend: identity.backend,
          scene: identity.scene,
          queryBackend: identity.queryBackend,
          vesselUrl: identity.vesselUrl,
          vesselLoaded: identity.vesselLoaded,
          vesselLoadFailed: identity.vesselLoadFailed,
        };
      },
      identity: () => identityRef.current,
      queryMetrics: () => metricsRef.current,
      setShallowEnabled: (enabled: boolean) => {
        setShallowEnabled(enabled);
      },
      optics: (): ComparisonOpticsState => opticsRef.current,
    };
    window.__marineComparisonLab = api;
    return () => {
      delete window.__marineComparisonLab;
    };
  }, [identityRef, metricsRef, opticsRef, pitchRef, runner, runModeRef, sampleDisplacement, samplesRef, setResetToken, setShallowEnabled]);

  useEffect(() => {
    identityRef.current = {
      ...identityRef.current,
      backend,
      scene,
      firstFrameReady,
    };
  }, [backend, firstFrameReady, identityRef, scene]);

  return null;
}

function ComparisonScene({
  backend,
  scene,
  failAsset,
}: {
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly failAsset: boolean;
}) {
  const { tier } = useSceneQuality();
  const samplesRef = useRef({ mid: 0, bow: 0, stern: 0, time: 0 });
  const metricsRef = useRef<ComparisonQueryMetrics | null>(null);
  const pitchRef = useRef(0);
  const runModeRef = useRef<ComparisonRunMode>('performance');
  const [resetToken, setResetToken] = useState(0);
  const feature = COMPARISON_FEATURE_MATRIX[scene];
  const [shallowEnabled, setShallowEnabled] = useState(feature.shallow);
  const opticsRef = useRef<ComparisonOpticsState>({
    profile: feature.optics,
    shallowEnabled: feature.shallow,
    shallowPassAllocated: feature.shallow,
    sunX: COMPARISON_SUN_DIRECTION.x,
    sunY: COMPARISON_SUN_DIRECTION.y,
    sunZ: COMPARISON_SUN_DIRECTION.z,
  });
  useEffect(() => {
    opticsRef.current = {
      profile: feature.optics,
      shallowEnabled,
      shallowPassAllocated: feature.shallow && shallowEnabled,
      sunX: COMPARISON_SUN_DIRECTION.x,
      sunY: COMPARISON_SUN_DIRECTION.y,
      sunZ: COMPARISON_SUN_DIRECTION.z,
    };
  }, [feature.optics, feature.shallow, opticsRef, shallowEnabled]);
  const simRef = useRef<BindingTelemetrySource>({
    rudderDeg: 0,
    speedMps: 0,
    attainedCount: 0,
    advancing: true,
  });
  const activated = matchActivatedFleetPackage('destroyer', resolveVersionedDefault('destroyer'));
  const identityRef = useRef<ComparisonLabIdentity>({
    backend,
    scene,
    runMode: 'performance',
    queryBackend: backend,
    waterBaseY: GERSTNER_WATER_BASE_Y,
    farFieldRotationX: FAR_FIELD.rotationX,
    farFieldInnerHalfExtent: FAR_FIELD.innerHalfExtent,
    farFieldOuterHalfExtent: FAR_FIELD.outerHalfExtent,
    vesselPackageId: activated?.packageId ?? null,
    vesselUrl: null,
    vesselFallback: false,
    vesselLoaded: false,
    vesselLoadFailed: false,
    firstFrameReady: false,
  });

  const onMountedUrl = useCallback((url: string) => {
    const versioned = activated ? isDescriptorArtifactUrl(activated, url) : false;
    identityRef.current = {
      ...identityRef.current,
      vesselUrl: url,
      vesselFallback: !versioned,
      vesselLoaded: true,
      vesselLoadFailed: false,
    };
  }, [activated]);

  const onLoadFailed = useCallback(() => {
    identityRef.current = {
      ...identityRef.current,
      vesselUrl: null,
      vesselLoaded: false,
      vesselLoadFailed: true,
    };
  }, []);

  const waterYSampler = useCallback(
    () => composeWaterDatum(GERSTNER_WATER_BASE_Y, samplesRef.current.mid),
    [],
  );

  const frameInputs = useMemo<MarineFrameInputs>(() => ({
    worldPoseSampler: () => ({ x: 0, z: 0, headingRad: 0 }),
    renderOriginSampler: () => ({ x: 0, z: 0 }),
    simulationTimeSampler: () => 0,
    advancingSampler: () => true,
    playbackRateSampler: () => (runModeRef.current === 'visual' ? 0 : 1),
    waterSampler: (worldX, worldZ, timeSeconds) => {
      if (backend === 'gerstner') {
        return composeWaterDatum(
          GERSTNER_WATER_BASE_Y,
          createNearFieldSurfaceQuery(
            gerstnerAmplitudeScale(COMPARISON_SPECTRUM_INPUT.seaState),
            0,
            0,
            timeSeconds,
          ).heightAt(worldX, worldZ),
        );
      }
      return composeWaterDatum(GERSTNER_WATER_BASE_Y, samplesRef.current.mid);
    },
    ownership: COMPARISON_POSE_OWNERSHIP,
    qualityTierSampler: () => tier,
  }), [backend, tier]);

  const gerstnerTier = scene === 'feature-parity' ? tier : 'low';
  const fftCompressionAt = useMemo(
    () => createFftOceanCompressionSampler(
      fftOceanStaticSpectrum(COMPARISON_SPECTRUM_INPUT),
      COMPARISON_SPECTRUM_INPUT.domainMeters,
    ),
    [],
  );

  return (
    <MarineFrameProvider inputs={frameInputs}>
      <SceneQualityDriver />
      <ComparisonQueries backend={backend} samplesRef={samplesRef} metricsRef={metricsRef} resetToken={resetToken} />
      <ComparisonLabBridge
        backend={backend}
        scene={scene}
        samplesRef={samplesRef}
        metricsRef={metricsRef}
        pitchRef={pitchRef}
        identityRef={identityRef}
        runModeRef={runModeRef}
        setResetToken={setResetToken}
        setShallowEnabled={setShallowEnabled}
        opticsRef={opticsRef}
      />
      <FarFieldRing />
      <ComparisonVessel
        failAsset={failAsset}
        waterYSampler={waterYSampler}
        pitchRef={pitchRef}
        simRef={simRef}
        resetToken={resetToken}
        onMountedUrl={onMountedUrl}
        onLoadFailed={onLoadFailed}
      />
      <Suspense fallback={null}>
        {feature.shallow && shallowEnabled ? <MarineShallowBackdrop enabled /> : null}
        {backend === 'fft' ? (
          <MarineFoamFieldProvider
            tier={gerstnerTier}
            seaState={COMPARISON_SPECTRUM_INPUT.seaState}
            waves={[]}
            compressionAt={feature.foam ? fftCompressionAt : undefined}
            amplitudeScale={gerstnerAmplitudeScale(COMPARISON_SPECTRUM_INPUT.seaState)}
            resetToken={resetToken}
            attributionOverride={feature.foam ? undefined : { natural: false, vessel: false }}
          >
            {feature.planar ? (
              <MarinePlanarReflection planeY={GERSTNER_WATER_BASE_Y} enabled={gerstnerTier === 'high'} />
            ) : null}
            <group position={[0, GERSTNER_WATER_BASE_Y, 0]}>
              <FFTOceanSurface
                spectrumInput={COMPARISON_SPECTRUM_INPUT}
                domainMeters={COMPARISON_SPECTRUM_INPUT.domainMeters}
                optics={feature.optics}
                shoreSegments={feature.shallow ? [COMPARISON_SHORE_SEGMENT] : undefined}
                shallowEnabled={feature.shallow && shallowEnabled}
              />
            </group>
          </MarineFoamFieldProvider>
        ) : (
          <GerstnerWater
            key={scene}
            tier={gerstnerTier}
            seaState={COMPARISON_SPECTRUM_INPUT.seaState}
            disableFarField
            disableEffects={!feature.ibl}
            resetToken={resetToken}
            sunDirection={COMPARISON_SUN_DIRECTION}
            shoreSegments={feature.shallow ? [COMPARISON_SHORE_SEGMENT] : undefined}
            shallowEnabled={shallowEnabled}
            neutralOptics={feature.optics === 'neutral'}
          />
        )}
      </Suspense>
    </MarineFrameProvider>
  );
}

export default function FFTOceanComparisonClient({
  backend,
  scene,
  failAsset = false,
}: {
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly failAsset?: boolean;
}) {
  const qualityTier: QualityTierId = scene === 'feature-parity' ? 'high' : 'low';
  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-2 text-sm">
        <span
          data-fft-comparison-page="true"
          data-backend={backend}
          data-scene={scene}
          data-water-base-y={GERSTNER_WATER_BASE_Y}
          data-far-field="xz-ring"
        >
          海面后端对照实验（{backend === 'fft' ? 'WebGL FFT（GPU 演化 + GPU 2D IFFT）' : 'Gerstner 解析'} / {scene}）
        </span>
        <span className="ml-3 text-slate-400">
          切换：/simulations/fft-ocean-comparison?backend=fft|gerstner&scene=wave-only|feature-parity（同镜头/海况/高精055/水平远场；实验路由，不影响生产）
        </span>
      </header>
      <div className="relative flex-1">
        <SceneQualityProvider initialTier={qualityTier}>
          <LockQualityTier tier={qualityTier} />
          <SceneEnvironmentProvider>
            <Canvas gl={{ preserveDrawingBuffer: true }}>
              <PerspectiveCamera makeDefault position={[0, 60, 600]} fov={55} near={1} far={50000} />
              <ambientLight intensity={0.6} />
              <directionalLight
                position={[
                  COMPARISON_SUN_DIRECTION.x * 800,
                  COMPARISON_SUN_DIRECTION.y * 800,
                  COMPARISON_SUN_DIRECTION.z * 800,
                ]}
                intensity={1.4}
              />
              <ComparisonScene backend={backend} scene={scene} failAsset={failAsset} />
              <OrbitControls enablePan enableZoom enableRotate minDistance={40} maxDistance={4000} />
            </Canvas>
          </SceneEnvironmentProvider>
        </SceneQualityProvider>
      </div>
    </main>
  );
}

declare global {
  interface Window {
    __marineComparisonLab?: ComparisonLabApi;
  }
}
