'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { AmbientLight, DirectionalLight, RenderTarget, WebGPURenderer } from 'three/webgpu';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { SCENE_CAMERA_SHOTS } from '@/resources/simulations/scene/camera/camera-shots';
import { ComparisonWater, type ComparisonOceanProbe } from './comparison-water';
import { createComparisonRenderer } from './comparison-renderer';

import { VersionedFleetShip } from '@/resources/simulations/components/versioned-fleet-ship';
import { ModelAssetErrorBoundary } from '@/resources/simulations/components/fallback-gltf-model';
import { isDescriptorArtifactUrl } from '@/resources/simulations/model-packages/types';
import { matchActivatedFleetPackage } from '@/resources/simulations/model-packages/fleet-packages';
import { resolveVersionedDefault } from '@/lib/browser-delivery/client';
import { SceneEnvironmentProvider } from '@/resources/simulations/scene/environment';
import {
  MarineStagePerformanceProbe,
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
  fftOceanRenderedHeightAt,
  fftOceanStaticSpectrum,
} from '@/resources/simulations/scene/water/fft-ocean';
import {
  judgeFleetObservations,
  judgeMarineObservation,
  measurePositionSpans,
  type FleetConsumerObservation,
  type MarineSceneObservation,
} from '@/resources/simulations/scene/quality/visual-acceptance';
import { COMPARISON_SUN_DIRECTION } from '@/resources/simulations/scene/water/shared-water-optics';
import {
  GERSTNER_WATER_BASE_Y,
  createNearFieldSurfaceQuery,
  gerstnerAmplitudeScale,
} from '@/resources/simulations/scene/water';
import type { BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import {
  comparisonVesselPose, comparisonContactPoints,
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
  type ComparisonGraphicsApi,
  type ComparisonFftResolution,
  type ComparisonLod,
  type ComparisonLabApi,
  type ComparisonLabCapture,
  type ComparisonLabIdentity,
  type ComparisonOpticsState,
  type ComparisonQueryMetrics,
  type ComparisonRunMode,
  type ComparisonSceneId,
} from './comparison-lab';
import { ComparisonModeSwitch } from './comparison-mode-switch';

/** 对照页共享场景：规定圆轨迹、战术镜头与实际可见水面的低频三点接触查询。 */
const COMPARISON_POSE_OWNERSHIP: MarinePoseOwnership = {
  heave: 'visual-water',
  pitch: 'visual-water',
  roll: 'fixed',
};
const COMPARISON_SHORE_SEGMENTS = [COMPARISON_SHORE_SEGMENT] as const;

const FAR_FIELD = comparisonFarFieldRing();

export function LockQualityTier({ tier }: { readonly tier: QualityTierId }) {
  const { setOverride } = useSceneQuality();
  useEffect(() => {
    setOverride(tier);
  }, [setOverride, tier]);
  return null;
}

export function FarFieldRing({ surfaceRef }: { surfaceRef?: React.MutableRefObject<ComparisonOceanProbe | null> }) {
  const meshRef = useRef<THREE.Mesh>(null);
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
      ref={meshRef}
      name="comparison-far-field"
      position={[0, FAR_FIELD.baseY, 0]}
      geometry={geometry}
      renderOrder={-5}
      onBeforeRender={() => {
        const origin = surfaceRef?.current?.history()?.wakeOrigin, mesh = meshRef.current;
        if (origin && mesh) {
          mesh.position.set(origin[0], FAR_FIELD.baseY, origin[1]); mesh.updateMatrixWorld();
        }
      }}
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
  surfaceRef,
  failAsset,
  waterYSampler,
  pitchRef,
  samplesRef,
  simRef,
  resetToken,
  onMountedUrl,
  onLoadFailed,
}: {
  readonly surfaceRef: React.MutableRefObject<ComparisonOceanProbe | null>;
  readonly failAsset: boolean;
  readonly waterYSampler: () => number;
  readonly pitchRef: React.MutableRefObject<number>;
  readonly samplesRef: React.MutableRefObject<{ mid: number; bow: number; stern: number; time: number }>;
  readonly simRef: React.MutableRefObject<BindingTelemetrySource>;
  readonly resetToken: number;
  readonly onMountedUrl: (url: string) => void;
  readonly onLoadFailed: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const visualTime = useMarineVisualTime();
  const previousTime = useRef(0);
  useFrame((state, delta) => {
    const seconds = surfaceRef.current?.identity().time ?? visualTime(state, delta);
    const pose = comparisonVesselPose(seconds);
    simRef.current = { ...simRef.current, speedMps: pose.speedMps, advancing: seconds > previousTime.current };
    previousTime.current = seconds;
    if (groupRef.current) {
      const contact = samplesRef.current;
      pitchRef.current = vesselPitchFromSamples(contact.bow, contact.stern, COMPARISON_QUERY_SPAN_METERS);
      groupRef.current.position.set(pose.x, 0, pose.z);
      groupRef.current.rotation.set(-pitchRef.current, pose.headingRad, 0, 'YXZ');
      groupRef.current.userData.marineRenderedContact = { ...contact };
    }
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
    <group ref={groupRef} name="comparison-vessel-motion">
      <ModelAssetErrorBoundary fallback={<FailedVesselMarker onLoadFailed={onLoadFailed} />}>
        <VersionedFleetShip
          logicalId="destroyer"
          simRef={simRef}
          position={{ x: 0, z: 0 }}
          headingRad={Math.PI / 2}
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

function comparisonGerstnerQuery(timeSeconds: number, scene: ComparisonSceneId) {
  const query = createNearFieldSurfaceQuery(
    gerstnerAmplitudeScale(COMPARISON_SPECTRUM_INPUT.seaState), 0, 0, timeSeconds,
    scene === 'feature-parity' ? { shoreSegments: COMPARISON_SHORE_SEGMENTS } : undefined,
  );
  return { heightAt: (x: number, z: number) => query.heightAt(x, z) - GERSTNER_WATER_BASE_Y };
}

function ComparisonQueries({ surfaceRef, samplesRef, metricsRef, resetToken, runModeRef }: {
  runModeRef: React.MutableRefObject<ComparisonRunMode>;
  surfaceRef: React.MutableRefObject<ComparisonOceanProbe | null>;
  samplesRef: React.MutableRefObject<{ mid: number; bow: number; stern: number; time: number }>;
  metricsRef: React.MutableRefObject<ComparisonQueryMetrics | null>;
  resetToken: number;
}) {
  const pending = useRef(false);
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current += 1;
    samplesRef.current = { mid: 0, bow: 0, stern: 0, time: -1 };
    metricsRef.current = null;
    return () => { epoch.current += 1; };
  }, [resetToken, samplesRef, metricsRef]);
  useFrame(() => {
    const surface = surfaceRef.current;
    if (!surface || !surface.history() || pending.current) return;
    const time = surface.identity().time;
    if (Math.abs(time - samplesRef.current.time) < 1e-6) return;
    if (Math.abs(surface.history()!.requested - time) > 1 / 60 + 1e-5) return;
    if (runModeRef.current !== 'visual' && time >= samplesRef.current.time
      && time - samplesRef.current.time < 1 / COMPARISON_VESSEL_QUERY_HZ) return;
    const requestEpoch = epoch.current;
    const started = performance.now();
    pending.current = true;
    void surface.sampleSurface(comparisonContactPoints(time)).then(points => {
      if (requestEpoch !== epoch.current || surfaceRef.current !== surface) return;
      const [mid, bow, stern] = points.map(p => p.height - GERSTNER_WATER_BASE_Y);
      const sampledTime = points[0]?.time ?? time;
      samplesRef.current = { mid, bow, stern, time: sampledTime };
      const elapsed = performance.now() - started;
      // 本指标是三点采样端到端延迟，不能解释为纯 GPU 计算时间。
      metricsRef.current = { computeMs: null, queueMs: null, transferMs: null, e2eMs: elapsed,
        resultAgeSeconds: Math.max(0, surface.identity().time - sampledTime), viaWorker: false,
        initChargedPerQuery: false, queryKind: 'gpu-surface' };
    }).catch(() => { /* 诊断读回占用时下一帧重试，卸载后不发布旧结果。 */ })
      .finally(() => { pending.current = false; });
  });
  return null;
}

function ComparisonCamera({ surfaceRef, following, onFree }: {
  surfaceRef: React.MutableRefObject<ComparisonOceanProbe | null>; following: boolean; onFree: () => void;
}) {
  const camera = useThree(s => s.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  useFrame(() => {
    if (!following || !controls.current) return;
    const pose = comparisonVesselPose(surfaceRef.current?.identity().time ?? 0);
    const frame = SCENE_CAMERA_SHOTS.tactical.frame({ shipX: pose.x, shipZ: pose.z,
      headingRad: pose.headingRad, shipLength: COMPARISON_VESSEL_LENGTH_METERS });
    camera.position.copy(frame.position);
    controls.current.target.copy(frame.target);
    controls.current.update();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping={false} onStart={onFree}
    enablePan enableZoom enableRotate minDistance={40} maxDistance={4000} />;
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
  setReflectionEnabled,
  reflectionEnabledRef,
  opticsRef,
  resolution,
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
  readonly setReflectionEnabled: (enabled: boolean) => void;
  readonly reflectionEnabledRef: React.MutableRefObject<boolean>;
  readonly opticsRef: React.MutableRefObject<ComparisonOpticsState>;
  readonly resolution: ComparisonFftResolution;
}) {
  const runner = useMarineFrameRunner();
  const root = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const renderer = useThree((state) => state.gl);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  useFrame(() => {
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
      return comparisonGerstnerQuery(timeSeconds, scene).heightAt(x, z);
    }
    return fftOceanRenderedHeightAt(
      fftOceanStaticSpectrum({ ...COMPARISON_SPECTRUM_INPUT, resolution }),
      COMPARISON_SPECTRUM_INPUT.domainMeters,
      timeSeconds,
      x,
      z,
    );
  }, [backend, resolution, scene]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const api: ComparisonLabApi = {
      motion: () => {
        const vessel = root.getObjectByName('comparison-vessel-motion');
        const position = vessel?.position ?? new THREE.Vector3();
        return { x: position.x, z: position.z, headingRad: vessel?.rotation.y ?? 0,
          camera: camera.position.toArray(), projectedCenter: position.clone().project(camera).toArray() };
      },
      ready: () => labIsReady(identityRef.current)
        && (window.__comparisonOcean?.identity().frames ?? 0) > 0
        && Math.abs((window.__comparisonOcean?.identity().time ?? -1) - (runner?.clock.timeSeconds() ?? 0)) < 1 / 60 + 1e-5
        && Math.abs(samplesRef.current.time - (window.__comparisonOcean?.identity().time ?? -1)) < (runModeRef.current === 'visual' ? 1e-5 : 0.4),
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
          vesselPose: comparisonVesselPose(samplesRef.current.time),
          sampleTimeSeconds: samplesRef.current.time,
          waterHeightOrigin: composeWaterDatum(GERSTNER_WATER_BASE_Y, samplesRef.current.mid),
          bowHeight: composeWaterDatum(
            GERSTNER_WATER_BASE_Y,
            samplesRef.current.bow,
          ),
          sternHeight: composeWaterDatum(
            GERSTNER_WATER_BASE_Y,
            samplesRef.current.stern,
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
      setReflectionEnabled: (enabled: boolean) => {
        setReflectionEnabled(enabled);
        if (!enabled) {
          root.userData.marinePlanarReflectionSuspended = true;
          delete root.userData.marinePlanarReflection;
        } else {
          delete root.userData.marinePlanarReflectionSuspended;
        }
      },
      optics: (): ComparisonOpticsState => opticsRef.current,
    };
    window.__marineComparisonLab = api;
    const readObservation = async (): Promise<MarineSceneObservation> => {
      const gpu = renderer as unknown as WebGPURenderer;
      const mesh = root.getObjectByName('comparison-far-field');
      const geometry = mesh && 'geometry' in mesh ? (mesh as THREE.Mesh).geometry : null;
      const position = geometry?.getAttribute('position');
      const userData = root.userData as {
        marinePlanarReflection?: {
          strength?: number;
          texture?: unknown;
          target?: THREE.WebGLRenderTarget;
        };
        marineFoamField?: unknown;
      };
      const planar = userData.marinePlanarReflection;
      let reflectionPixelMean: number | null = null;
      const reflectionTarget = planar?.target;
      if (reflectionTarget) {
        const sampleX = Math.max(0, Math.floor(reflectionTarget.width / 2));
        const sampleY = Math.max(0, Math.floor(reflectionTarget.height / 2));
        const sample = await gpu.readRenderTargetPixelsAsync(reflectionTarget, sampleX, sampleY, 1, 1);
        reflectionPixelMean = (sample[0]! + sample[1]! + sample[2]!) / (3 * 255);
      }
      const heightAtRest = sampleDisplacement(0, 0, 0);
      const heightLater = sampleDisplacement(0, 0, 1.5);
      const heightBeside = sampleDisplacement(8, 0, 1.5);
      const size = gpu.getDrawingBufferSize(new THREE.Vector2());
      const width = size.x;
      const height = size.y;
      let pixelMean = 0;
      if (width > 0 && height > 0) {
        const target = new RenderTarget(width, height);
        const previous = gpu.getRenderTarget();
        try {
          gpu.setRenderTarget(target);
          gpu.render(root, camera);
          gpu.setRenderTarget(previous);
          const pixel = await gpu.readRenderTargetPixelsAsync(target, Math.floor(width / 2), Math.floor(height / 2), 1, 1);
          pixelMean = (pixel[0]! + pixel[1]! + pixel[2]!) / (3 * 255);
        } finally {
          gpu.setRenderTarget(previous);
          target.dispose();
        }
      }
      // 异步新样本可能在两次绘制之间到达；比较实际船姿与该次绘制消费的样本。
      const vessel = root.getObjectByName('comparison-vessel-motion');
      const contact = vessel?.userData.marineRenderedContact as { bow: number; stern: number } | undefined;
      const contactPitch = contact ? Math.atan2(contact.bow - contact.stern, COMPARISON_QUERY_SPAN_METERS) : null;
      return {
        drawingBufferWidth: width,
        drawingBufferHeight: height,
        farField: position ? measurePositionSpans(position.array as ArrayLike<number>) : null,
        planarReflectionStrength: planar && planar.texture && typeof planar.strength === 'number'
          ? planar.strength
          : null,
        foamFieldPresent: Boolean(userData.marineFoamField),
        waveHeights: [heightAtRest, heightLater],
        normalSlope: Math.abs(heightBeside - heightLater) / 8,
        pixelMean,
        reflectionPixelMean,
        reportedPitch: vessel ? -vessel.rotation.x : null,
        contactPitch,
      };
    };
    window.__marineVisualAcceptance = {
      run: async () => {
        const feature = COMPARISON_FEATURE_MATRIX[identityRef.current.scene];
        return judgeMarineObservation(await readObservation(), {
          reflectionRequired: feature.planar,
          foamRequired: feature.foam,
        });
      },
      breakFarField: () => {
        const mesh = root.getObjectByName('comparison-far-field') as THREE.Mesh | undefined;
        const position = mesh?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!position) return;
        for (let index = 0; index < position.count; index += 1) {
          position.setY(index, position.getX(index));
          position.setZ(index, 0);
        }
        position.needsUpdate = true;
      },
      clearReflection: () => {
        delete root.userData.marinePlanarReflection;
      },
      clearFoam: () => {
        delete root.userData.marineFoamField;
      },
      judgeFleet: (observations: readonly FleetConsumerObservation[]) => judgeFleetObservations(observations),
      reflectionEnabled: () => reflectionEnabledRef.current,
    };
    return () => {
      delete window.__marineComparisonLab;
      delete window.__marineVisualAcceptance;
    };
  }, [camera, identityRef, metricsRef, opticsRef, pitchRef, reflectionEnabledRef, renderer, root, runner, runModeRef, sampleDisplacement, samplesRef, setReflectionEnabled, setResetToken, setShallowEnabled]);

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
  following, onFree, paused,
  backend,
  scene,
  failAsset,
  resolution,
}: {
  readonly following: boolean; readonly onFree: () => void; readonly paused: boolean;
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly failAsset: boolean;
  readonly resolution: ComparisonFftResolution;
}) {
  const { tier } = useSceneQuality();
  const samplesRef = useRef({ mid: 0, bow: 0, stern: 0, time: 0 });
  const metricsRef = useRef<ComparisonQueryMetrics | null>(null);
  const pitchRef = useRef(0);
  const runModeRef = useRef<ComparisonRunMode>('performance');
  const surfaceRef = useRef<ComparisonOceanProbe | null>(null);
  useEffect(() => { runModeRef.current = paused ? 'visual' : 'performance'; }, [paused]);
  const [resetToken, setResetToken] = useState(0);
  const feature = COMPARISON_FEATURE_MATRIX[scene];
  const [shallowEnabled, setShallowEnabled] = useState(feature.shallow);
  const [reflectionEnabled, setReflectionEnabled] = useState(feature.planar);
  const reflectionEnabledRef = useRef(reflectionEnabled);
  reflectionEnabledRef.current = reflectionEnabled;
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
    worldPoseSampler: () => comparisonVesselPose(surfaceRef.current?.identity().time ?? 0),
    renderOriginSampler: () => ({ x: 0, z: 0 }),
    simulationTimeSampler: () => surfaceRef.current?.identity().time ?? 0,
    advancingSampler: () => true,
    playbackRateSampler: () => (runModeRef.current === 'visual' ? 0 : 1),
    waterSampler: (worldX, worldZ, timeSeconds) => {
      if (backend === 'gerstner') {
        return composeWaterDatum(
          GERSTNER_WATER_BASE_Y,
          comparisonGerstnerQuery(timeSeconds, scene).heightAt(worldX, worldZ),
        );
      }
      return composeWaterDatum(GERSTNER_WATER_BASE_Y, samplesRef.current.mid);
    },
    ownership: COMPARISON_POSE_OWNERSHIP,
    qualityTierSampler: () => tier,
  }), [backend, tier, scene]);

  const gerstnerTier = scene === 'feature-parity' ? tier : 'low';

  return (
    <MarineFrameProvider inputs={frameInputs}>
      <SceneQualityDriver />
      <ComparisonQueries runModeRef={runModeRef} surfaceRef={surfaceRef} samplesRef={samplesRef} metricsRef={metricsRef} resetToken={resetToken} />
      <ComparisonCamera surfaceRef={surfaceRef} following={following} onFree={onFree} />
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
        setReflectionEnabled={setReflectionEnabled}
        reflectionEnabledRef={reflectionEnabledRef}
        opticsRef={opticsRef}
        resolution={resolution}
      />
      <FarFieldRing surfaceRef={surfaceRef} />
      <ComparisonVessel
        surfaceRef={surfaceRef}
        failAsset={failAsset}
        waterYSampler={waterYSampler}
        pitchRef={pitchRef}
        samplesRef={samplesRef}
        simRef={simRef}
        resetToken={resetToken}
        onMountedUrl={onMountedUrl}
        onLoadFailed={onLoadFailed}
      />
      <Suspense fallback={null}>
        <ComparisonWater surfaceRef={surfaceRef} backend={backend} scene={scene} tier={gerstnerTier}
          resolution={resolution} resetToken={resetToken}
          shallowEnabled={shallowEnabled} reflectionEnabled={reflectionEnabled} />
      </Suspense>
    </MarineFrameProvider>
  );
}

export default function FFTOceanComparisonClient({
  api = 'webgl',
  backend,
  scene,
  failAsset = false,
  resolution = 256,
  lod = null,
}: {
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly failAsset?: boolean;
  readonly api?: ComparisonGraphicsApi;
  readonly resolution?: ComparisonFftResolution;
  readonly lod?: ComparisonLod | null;
}) {
  const qualityTier: QualityTierId = lod ?? (scene === 'feature-parity' ? 'high' : 'low');
  const [following, setFollowing] = useState(true);
  const [paused, setPaused] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);
  useEffect(() => setRendererError(null), [api]);
  const lights = useMemo(() => {
    const ambient = new AmbientLight(0xffffff, 0.6);
    const sun = new DirectionalLight(0xffffff, 1.4);
    sun.position.copy(COMPARISON_SUN_DIRECTION).multiplyScalar(800);
    return { ambient, sun };
  }, []);
  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800 px-4 py-2 text-sm">
        <span
          data-fft-comparison-page="true"
          data-api={api}
          data-webgpu-comparison-page={api === 'webgpu' ? 'true' : undefined}
          data-backend={backend}
          data-scene={scene}
          data-fft-resolution={resolution}
          data-lod={qualityTier}
          data-water-base-y={GERSTNER_WATER_BASE_Y}
          data-far-field="xz-ring"
        >
          海面后端对照实验（{api === 'webgpu' ? 'WebGPU' : 'WebGL'} / {backend === 'fft' ? 'FFT（GPU 演化 + GPU 2D IFFT）' : 'Gerstner 解析'} / {scene}）
        </span>
        <ComparisonModeSwitch
          api={api}
          backend={backend}
          scene={scene}
          resolution={resolution}
          lod={lod}
          failAsset={failAsset}
        />
        <button type="button" onClick={() => setFollowing(true)} aria-pressed={following}>战术视角</button>
        <button type="button" onClick={() => setPaused(value => !value)}>{paused ? '继续航行' : '暂停航行'}</button>
        <button type="button" onClick={() => window.__marineComparisonLab?.reset()}>重新开始</button>
        <span className="text-xs opacity-70">圆周航行 · 半径 300 米 · 航速 12 米/秒</span>
      </header>
      <div className="relative flex-1">
        {rendererError ? (
          <p role="alert" data-renderer-error="true" data-fallback="false" className="p-6">
            {rendererError} 请使用上方入口切换渲染接口。
          </p>
        ) : (
        <SceneQualityProvider initialTier={qualityTier}>
          <LockQualityTier tier={qualityTier} />
          <SceneEnvironmentProvider>
            <Canvas key={`${api}-${backend}-${scene}-${resolution}`} gl={async (props) => {
              try {
                const renderer = await createComparisonRenderer(props.canvas as HTMLCanvasElement, api);
                renderer.onDeviceLost = () => {
                  setRendererError('图形设备连接已中断，请刷新页面。');
                };
                return renderer;
              } catch (error) {
                setRendererError(error instanceof Error ? error.message : '图形接口初始化失败。');
                throw error;
              }
            }}>
              <PerspectiveCamera makeDefault position={[-180, 254.56, -180]} fov={55} near={1} far={50000} />
              <primitive object={lights.ambient} />
              <primitive object={lights.sun} />
              <MarineStagePerformanceProbe />
              <ComparisonScene following={following} onFree={() => setFollowing(false)} paused={paused} backend={backend} scene={scene} failAsset={failAsset} resolution={resolution} />
            </Canvas>
          </SceneEnvironmentProvider>
        </SceneQualityProvider>
        )}
      </div>
    </main>
  );
}

declare global {
  interface Window {
    __marineComparisonLab?: ComparisonLabApi;
    __marineVisualAcceptance?: {
      run(): Promise<ReturnType<typeof judgeMarineObservation>>;
      breakFarField(): void;
      clearReflection(): void;
      clearFoam(): void;
      judgeFleet(observations: readonly FleetConsumerObservation[]): ReturnType<typeof judgeFleetObservations>;
      reflectionEnabled(): boolean;
    };
  }
}
