'use client';
import { MarineLine as Line } from '@/resources/simulations/scene/lines/marine-line';

/**
 * 055型驱逐舰航向控制仿真
 * 模块化重构版本 - 使用统一物理引擎和控制器
 */

import { Suspense, useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { MarineCanvas } from '../scene/marine-canvas';
import { MarineWater } from '../scene/water/marine-water';
import { SimulationClock } from '@/lib/simulation';
import {
  advanceAttainment,
  createAttainmentState,
  type AttainmentState,
} from '../lib/heading-attainment';
import { resolveRegisteredSimulationModel, resolveVersionedDefault } from '@/lib/browser-delivery/client';
import { FallbackGltfModel } from '@/resources/simulations/components/fallback-gltf-model';
import { HeroModelBasis } from '@/resources/simulations/components/hero-model-basis';
import { ShipVisualMarker, VersionedShipModel } from '@/resources/simulations/components/versioned-ship-model';
import { cloneSkinnedScene, skinnedBindingsIntact } from '@/resources/simulations/model-packages/clone-skinned-scene';
import {
  TYPE055_V2_BASIS_YAW_RAD,
  isType055VersionedAssetUrl,
  matchActivatedType055Package,
  matchType055DescriptorByUrl,
  type VersionedModelPackageDescriptor,
} from '@/resources/simulations/model-packages/type055-nanchang-101-v2';
import { MarinePropulsorsRig, SemanticBindingsRig } from '@/resources/simulations/components/semantic-bindings-rig';
import { isShipProxyUrl } from '@/resources/simulations/model-packages/types';
import { boxProjectsInsideNdc } from '@/resources/simulations/scene/camera';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Compass,
  Video,
  Orbit,
  ArrowDownFromLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { destroyer055Profile } from '../profiles/destroyer-055';
import { destroyer055SceneVisual } from '../profiles/destroyer-055-scene';
import {
  createNearFieldSurfaceQuery,
  DEFAULT_GERSTNER_SEA_STATE,
  gerstnerAmplitudeScale,
  nearFieldEnvelope,
  NEAR_FIELD_MESH_SPEC,
  NEAR_FIELD_VISIBLE_WAVES,
  sampleVisibleWaterHeight,
  useNearFieldWaterHeight,
} from '../scene/water';
import {
  computeVisualWaterPose,
  resolveMarineVisualPose,
  type MarineFrameInputs,
  type MarinePoseOwnership,
} from '../scene/frame/marine-frame';
import {
  MarineFrameProvider,
  useMarineFrameRunner,
} from '../scene/frame/marine-frame-provider';
import {
  EnvironmentScene,
  MarineSceneLayoutObjects,
  SceneEnvironmentProvider,
  useEnvironmentWaterColors,
  useSceneEnvironment,
} from '../scene/environment';
import {
  SceneSoundscapeProvider,
  SoundscapeAmbienceDriver,
} from '../scene/audio';
import {
  ActualPathTrail,
  TeachingAnnotations,
  TeachingAnnotationsProvider,
  useTeachingAnnotations,
} from '../scene/annotations';
import {
  SceneQualityDriver,
  SceneQualityProvider,
  useSceneQuality,
  MarinePerformanceEvidenceProbe,
} from '../scene/quality';
import { ScenePostEffects } from '../scene/post';
import type { ControlMode, PIDGains } from '../core/types';
import {
  clamp,
  toRadians,
  toDegrees,
  DEFAULT_NOMOTO_PARAMS,
  DEFAULT_PID_GAINS,
} from '../core/constants';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { platformHeadingToSceneRad } from '../scene/heading';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { ExperimentStepAreas, SimulationTopBar, SimulationDock, SimulationAssessmentPanel, simulationUi, type ExperimentHostBrief } from '../components/simulation-ui';
import { useOptionalGlobalAI } from '@/components/providers/global-ai-provider';
import { applyLocalSketchVerdict } from '@/features/ilab/sketch-client';
import {
  DESTROYER_CURVE_SERIES,
  DESTROYER_EXPERIMENT_STEPS,
  DESTROYER_EXPERIMENT_TITLE,
  assertDestroyerStepOrder,
  chooseBetterDestroyerAttempt,
  buildDestroyerReportHtml,
  destroyerKonlingBrief,
  destroyerSceneMotion,
  scoreDestroyerStep,
  scriptedManualRudder,
  signedHeading,
  thinDestroyerSamples,
  type DestroyerReadings,
  type DestroyerSample,
  type DestroyerSeriesId,
} from './destroyer-experiment';
import { DestroyerReportHistory, DestroyerStatusPanel, DestroyerStepForm, DestroyerStepList } from './destroyer-experiment-panels';
import { useSimulationSceneTheme, simulationScenePalette, type SimulationSceneTheme } from '../components/simulation-theme';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromSeconds,
} from '../lib/simulation-timing';
import {
  buildDestroyerHifiStepRequest,
  createDestroyerHifiStateFromSimulation,
  mapDestroyerHifiStepResult,
  type DestroyerHifiState,
} from '../rust/destroyer-hifi-adapter';
import {
  computeDestroyerHifiStep,
  preloadVirtualSimulationRuntime,
} from '../physics/simulation-engine-facade';

export type { AttainmentState };
export { advanceAttainment, createAttainmentState };

// ============ 类型定义 ============

interface HudState {
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  position: { x: number; z: number };
  avgError: number;
  currentError: number;
  time: number;
}

interface HeadingPoint {
  time: number;
  heading: number;
}

interface SimulationState {
  position: THREE.Vector3;
  headingRad: number;
  yawRateRad: number;
  rudderDeg: number;
  manualRudderDeg: number;
  speedMps: number;
  surgeMps: number;
  swayMps: number;
  integralDegS: number;
  prevErrorDeg: number;
  waveY: number;
  wavePitch: number;
  waveRoll: number;
  /** 视觉层彩蛋计数：任务达标次数（只读遥测派生，不回写驱动链）。 */
  attainedCount: number;
  /**
   * 仿真时钟是否在推进（运行中且未播完）：视觉层推进绑定（桨转速/天线倾角/
   * 尾迹发射航速）的唯一门控。物理 speedMps 为定速模型语义，暂停与播完后不归零，
   * 视觉绑定一律以 advancing × speedMps 为有效航速，禁止直接消费 speedMps。
   */
  advancing: boolean;
}

// ============ 常量 ============

const nomotoParams = destroyer055Profile.dynamics.nomoto ?? DEFAULT_NOMOTO_PARAMS;

const shipDimensions = {
  length: destroyer055Profile.dimensions.length,
  width: destroyer055Profile.dimensions.beam,
  draft: destroyer055Profile.dimensions.draft,
};

const CAMERA_SHOT_VIEWS = [
  { id: SCENE_CAMERA_SHOTS.chase.id, label: '跟船', shortLabel: '跟', icon: Video, description: SCENE_CAMERA_SHOTS.chase.description },
  { id: SCENE_CAMERA_SHOTS.orbit.id, label: '环绕', shortLabel: '环', icon: Orbit, description: SCENE_CAMERA_SHOTS.orbit.description },
  { id: SCENE_CAMERA_SHOTS.tactical.id, label: '战术', shortLabel: '战', icon: Compass, description: SCENE_CAMERA_SHOTS.tactical.description },
  { id: SCENE_CAMERA_SHOTS.topDown.id, label: '顶视', shortLabel: '顶', icon: ArrowDownFromLine, description: SCENE_CAMERA_SHOTS.topDown.description },
];

const REF_SPEED = nomotoParams.speedMps;

// ============ 工具函数 ============

const normalizeHeading = (heading: number) => ((heading % 360) + 360) % 360;

const normalizeSignedHeading = (heading: number) => {
  const normalized = normalizeHeading(heading);
  return normalized > 180 ? normalized - 360 : normalized;
};

type ScenarioLogic = {
  getDesiredHeading: (t: number) => number;
  startPos: { x: number; z: number; headingDeg: number };
};

const generateGuidePath = (logic: ScenarioLogic, duration: number) => {
  const points: THREE.Vector3[] = [];
  let x = logic.startPos.x;
  let z = logic.startPos.z;
  const dt = 0.5;

  points.push(new THREE.Vector3(x, 0.5, z));

  for (let t = 0; t <= duration; t += dt) {
    const headingDeg = logic.getDesiredHeading(t);
    const headingRad = toRadians(headingDeg);
    x += REF_SPEED * Math.cos(headingRad) * dt;
    z += REF_SPEED * Math.sin(headingRad) * dt;
    points.push(new THREE.Vector3(x, 0.5, z));
  }
  return points;
};

const getCrossTrackError = (position: THREE.Vector3, guidePath: THREE.Vector3[]) => {
  if (guidePath.length < 2) return 0;

  let minDist = Infinity;
  for (let i = 0; i < guidePath.length - 1; i++) {
    const a = guidePath[i];
    const b = guidePath[i + 1];
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(position, a);
    const t = clamp(ap.dot(ab) / ab.dot(ab), 0, 1);
    const closest = a.clone().add(ab.multiplyScalar(t));
    const dist = position.distanceTo(closest);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
};

// ============ 3D 组件 ============

/**
 * 055 姿态所有权（#2097）：垂荡/纵摇/横摇均为共享波场视觉响应——数值模型
 * （Rust/WASM 航向/航速链）不产出这三个自由度的遥测，视觉按声明采样且不可
 * 叠加第二条响应；质量与预设切换不改变本声明。
 */
const DESTROYER_055_POSE_OWNERSHIP: MarinePoseOwnership = {
  heave: 'visual-water',
  pitch: 'visual-water',
  roll: 'visual-water',
};

/** epoch 重置：resetToken 变化把共享视觉时钟归零（与尾迹 key 重挂载同一重置源）。 */
function MarineEpochReset({ resetToken }: { resetToken: number }) {
  const runner = useMarineFrameRunner();
  useEffect(() => {
    runner?.clock.reset();
  }, [resetToken, runner]);
  return null;
}

/** 统一海洋帧基座（#2097 垂直切片）：快照输入取自 simRef/simTimeRef，波场与水面网格同参数。 */
function MarineFrameRuntime({
  simRef,
  simTimeRef,
  resetToken,
  children,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  simTimeRef: React.MutableRefObject<number>;
  resetToken: number;
  children: React.ReactNode;
}) {
  const { params } = useSceneQuality();
  const { presetId } = useSceneEnvironment();
  const qualityRef = useRef(params);
  qualityRef.current = params;
  const inputs = useMemo<MarineFrameInputs>(
    () => ({
      worldPoseSampler: () => ({
        x: simRef.current.position.x,
        z: simRef.current.position.z,
        headingRad: simRef.current.headingRad,
      }),
      // 渲染原点 = 水面网格跟随的舰位（世界坐标波相位补偿在采样器内完成）。
      renderOriginSampler: () => ({ x: simRef.current.position.x, z: simRef.current.position.z }),
      simulationTimeSampler: () => simTimeRef.current,
      advancingSampler: () => simRef.current.advancing,
      // 六轮复审修复：五点姿态采样按（时间/原点）复用一次批量查询，共享角点缓存。
      waterSampler: (() => {
        let cacheKey = '';
        let cachedQuery: ReturnType<typeof createNearFieldSurfaceQuery> | null = null;
        return (worldX: number, worldZ: number, timeSeconds: number) => {
          const origin = simRef.current.position;
          const key = `${timeSeconds}|${origin.x}|${origin.z}`;
          if (!cachedQuery || cacheKey !== key) {
            cacheKey = key;
            // 三轮复审修复：姿态与可见近场同一采样场——带限波组 + 近场网格 + 角点包络
            // （与 GPU 完全同参数，档位无关）；容差即声明的近场近似容差。
            cachedQuery = createNearFieldSurfaceQuery(
              gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE),
              origin.x,
              origin.z,
              timeSeconds,
            );
          }
          return cachedQuery.heightAt(worldX, worldZ);
        };
      })(),
      ownership: DESTROYER_055_POSE_OWNERSHIP,
      environmentPresetIdSampler: () => presetId,
      qualityTierSampler: () => qualityRef.current.waterTier,
    }),
    [simRef, simTimeRef, presetId]
  );
  return (
    <MarineFrameProvider inputs={inputs}>
      <MarineEpochReset resetToken={resetToken} />
      {children}
    </MarineFrameProvider>
  );
}

/** 海面颜色随环境预设驱动、水面细分随质量档位驱动的桥接组件（Canvas 内消费 provider 状态）。 */
function PresetWater({ simRef, resetToken }: { simRef: React.MutableRefObject<SimulationState>; resetToken: number }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <MarineWater
      worldSpeedSampler={() => simRef.current.advancing ? simRef.current.speedMps : 0}
      vesselLengthMeters={180} vesselBeamMeters={20}
      resetToken={resetToken}
      tier={params.waterTier}
      positionSampler={() => ({ x: simRef.current.position.x, z: simRef.current.position.z })}
      shipHeadingSampler={() => platformHeadingToSceneRad(toDegrees(simRef.current.headingRad))}
      waterColor={water.waterColor}
      deepColor={water.deepColor}
      horizonColor={water.horizonColor}
      foamColor={simulationScenePalette.waterFoam}
      sunDirection={water.sunDirection}
      sunIllumination={water.sunIllumination}
    />
  );
}

function GridHelper({
  simRef,
  sceneTheme,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  sceneTheme: SimulationSceneTheme;
}) {
  const gridRef = useRef<THREE.Group>(null);
  const gridSize = 100;
  const gridExtent = 50;

  const lines = useMemo(() => {
    const linePoints: THREE.Vector3[][] = [];
    const halfExtent = gridExtent / 2;
    const gridHeight = 4;

    for (let x = -halfExtent; x <= halfExtent; x++) {
      linePoints.push([
        new THREE.Vector3(x * gridSize, gridHeight, -halfExtent * gridSize),
        new THREE.Vector3(x * gridSize, gridHeight, halfExtent * gridSize),
      ]);
    }

    for (let z = -halfExtent; z <= halfExtent; z++) {
      linePoints.push([
        new THREE.Vector3(-halfExtent * gridSize, gridHeight, z * gridSize),
        new THREE.Vector3(halfExtent * gridSize, gridHeight, z * gridSize),
      ]);
    }

    return linePoints;
  }, []);

  useFrame(() => {
    if (!gridRef.current) return;
    const sim = simRef.current;

    const snappedX = Math.round(sim.position.x / gridSize) * gridSize;
    const snappedZ = Math.round(sim.position.z / gridSize) * gridSize;

    gridRef.current.position.set(snappedX, 0, snappedZ);
  });

  return (
    <group ref={gridRef}>
      {lines.map((points, i) => (
        <Line name="marine-annotations" key={i} points={points} color={sceneTheme.gridCellColor} lineWidth={1.0} transparent opacity={sceneTheme.gridOpacity} />
      ))}
    </group>
  );
}

function GuideRoute({ points }: { points: THREE.Vector3[] }) {
  if (!points || points.length < 2) return null;
  return <Line name="marine-guide" points={points} color={simulationScenePalette.danger} lineWidth={3} dashed={false} />;
}

/** QA 钩子：把质量档位与派生预算暴露为 DOM 属性（性能 spec 与视觉 QA 消费）。 */
function SceneQualityAttributes() {
  const { tier, override, params } = useSceneQuality();
  return (
    <span
      hidden
      data-scene-quality-tier={tier}
      data-scene-quality-override={override ?? ''}
      data-wake-particle-cap={Math.round(2200 * params.particleScale)}
      data-water-tier={params.waterTier}
      data-post-enabled={params.postEnabled}
    />
  );
}

/** 教学标注开关门控：默认关闭，开启时显示航向弧线/目标航线/方向箭头/世界标签。 */
function TeachingAnnotationsGate({
  simRef,
  targetHeadingSampler,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  targetHeadingSampler: () => number | undefined;
}) {
  const { showAnnotations } = useTeachingAnnotations();
  if (!showAnnotations) return null;
  return (
    <TeachingAnnotations
      positionSampler={() => simRef.current.position}
      headingSampler={() => platformHeadingToSceneRad(toDegrees(simRef.current.headingRad))}
      targetHeadingSampler={targetHeadingSampler}
      shipLength={shipDimensions.length}
      label="055型驱逐舰"
    />
  );
}

declare global {
  interface Window {
    /** QA 重观测开关（#2120）：置 true 才逐帧 Box3/骨骼校验（普通运行零热点）。 */
    __destroyerModelVisualProbe?: boolean;
    __destroyerModelVisual?: {
      url: string;
      /** 重观测关闭时为 undefined（不做逐帧 Box3/骨骼遍历）。 */
      boxInView?: boolean;
      skinnedIntact?: boolean;
      /** 仿真推进门控（QA 观测面）：false 时桨/天线/尾迹发射全部静止。 */
      advancing?: boolean;
      /** 左右桨节点局部四元数（QA 观测面：桨转速连续性/静止判定）。 */
      propPortQuat?: [number, number, number, number] | null;
      propStarboardQuat?: [number, number, number, number] | null;
    };
  }
}

// drei 的 useGLTF 第三参 useMeshopt=true 时内部装配 three-stdlib MeshoptDecoder（运行时解码）。
const MODEL = resolveRegisteredSimulationModel('destroyer');

/** 驱逐舰3D模型：生产默认由 registry 激活指针决定；失败只回退旧 browser-delivery 单文件链。 */
function DestroyerModel({
  simRef,
  resetToken,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  resetToken: number;
}) {
  const { tier } = useSceneQuality();
  const descriptor = matchActivatedType055Package(resolveVersionedDefault('destroyer'));

  if (!descriptor) {
    return (
      <FallbackGltfModel
        candidates={MODEL.candidates}
        render={(url) => <DestroyerModelScene url={url} simRef={simRef} markReady />}
      />
    );
  }

  return (
    <VersionedShipModel
      descriptor={descriptor}
      resetToken={resetToken}
      tier={tier}
      legacyCandidates={MODEL.candidates}
      renderScene={(url) => {
        const resolved = matchType055DescriptorByUrl(url);
        const useMatrix = Boolean(resolved?.modelToSceneMatrix);
        return (
          <DestroyerModelScene
            url={url}
            simRef={simRef}
            resetToken={resetToken}
            // 旧 2.1.x 仍用一次基 yaw；2.2.0 矩阵路径不再叠 yaw。旧单文件不施加。
            basisYawRad={isType055VersionedAssetUrl(url) && !useMatrix ? TYPE055_V2_BASIS_YAW_RAD : 0}
            descriptor={resolved}
          />
        );
      }}
    />
  );
}

function DestroyerModelScene({
  url,
  simRef,
  basisYawRad = 0,
  descriptor = null,
  resetToken = 0,
  markReady = false,
}: {
  url: string;
  simRef: React.MutableRefObject<SimulationState>;
  /** 坐标基适配（唯一应用点）：v2 候选模型 +X 舰艏 → 场景 +Z 舰艏。 */
  basisYawRad?: number;
  /** 版本化包描述符：仅版本化路径传入，驱动水线锚定与声明式动画绑定。 */
  descriptor?: VersionedModelPackageDescriptor | null;
  /** 实验重置令牌：透传给彩蛋装配，触发状态随实验生命周期复位。 */
  resetToken?: number;
  markReady?: boolean;
}) {
  const { camera } = useThree();
  const { scene, animations } = useGLTF(url, true, true);
  const groupRef = useRef<THREE.Group>(null);

  const useDeclaredMount = Boolean(descriptor?.modelToSceneMatrix);

  const { model, scale, waterlineOffset, propNodes } = useMemo(() => {
    const cloned = cloneSkinnedScene(scene);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    if (!useDeclaredMount) cloned.position.sub(center);

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // meshopt 量化解码后几何包围球处于量化空间，按视锥剔除会在多数视角误剔除；
        // 主模型关闭 frustumCulled（单艘船的成本可忽略，见 change design 第 7 节）。
        child.frustumCulled = false;
      }
    });

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = shipDimensions.length;
    const calculatedScale = useDeclaredMount && descriptor?.modelLengthMeters
      ? targetLength / descriptor.modelLengthMeters
      : targetLength / maxDim;

    // 整合包矩阵已含水线平移；旧版本化包按声明水线；无声明模型沿用 bbox 推导。
    const offset = useDeclaredMount
      ? 0
      : descriptor?.verticalAnchor
        ? (center.y - descriptor.verticalAnchor.designWaterlineY) * calculatedScale
        : (size.y * calculatedScale) * 0.5 - shipDimensions.draft;

    // 推进器语义节点解析（逐帧尾迹发射锚点）；节点缺失 fail closed 到静态锚点。
    const resolvePropNode = (id: string) => {
      const declaration = descriptor?.propulsors?.find((propulsor) => propulsor.id === id);
      return declaration ? cloned.getObjectByName(declaration.node) ?? null : null;
    };

    return {
      model: cloned,
      scale: calculatedScale,
      waterlineOffset: offset,
      propNodes: { port: resolvePropNode('prop-port'), starboard: resolvePropNode('prop-starboard') },
    };
  }, [scene, descriptor, useDeclaredMount]);

  useFrame(() => {
    if (!groupRef.current) return;
    const sim = simRef.current;

    groupRef.current.position.set(
      sim.position.x,
      sim.waveY + waterlineOffset,
      sim.position.z
    );
    groupRef.current.rotation.set(sim.wavePitch, -sim.headingRad + Math.PI / 2, sim.waveRoll);

    // QA 门控（#2120 复审）：普通浏览器运行不做逐帧全模型 Box3 遍历与骨骼
    // 绑定校验（热点成本）——页面置 window.__destroyerModelVisualProbe = true
    // 才执行重观测；轻量字段（推进四元数/推进门控）始终写入。
    if (typeof window !== 'undefined') {
      const probe = window.__destroyerModelVisualProbe === true;
      if (probe) {
        const box = new THREE.Box3().setFromObject(groupRef.current);
        window.__destroyerModelVisual = {
          url,
          boxInView: boxProjectsInsideNdc(camera, box),
          skinnedIntact: skinnedBindingsIntact(model),
          advancing: sim.advancing,
        propPortQuat: propNodes.port
          ? [propNodes.port.quaternion.x, propNodes.port.quaternion.y, propNodes.port.quaternion.z, propNodes.port.quaternion.w]
          : null,
        propStarboardQuat: propNodes.starboard
          ? [propNodes.starboard.quaternion.x, propNodes.starboard.quaternion.y, propNodes.starboard.quaternion.z, propNodes.starboard.quaternion.w]
          : null,
        };
      } else {
        window.__destroyerModelVisual = {
          url,
          advancing: sim.advancing,
          propPortQuat: propNodes.port
            ? [propNodes.port.quaternion.x, propNodes.port.quaternion.y, propNodes.port.quaternion.z, propNodes.port.quaternion.w]
            : null,
          propStarboardQuat: propNodes.starboard
            ? [propNodes.starboard.quaternion.x, propNodes.starboard.quaternion.y, propNodes.starboard.quaternion.z, propNodes.starboard.quaternion.w]
            : null,
          boxInView: undefined,
          skinnedIntact: undefined,
        };
      }
    }
  });

  return (
    <group ref={groupRef} name="fleet-ship-root" userData={{ modelUrl: url, modelScale: scale, mountMatrix: descriptor?.modelToSceneMatrix ?? null }}>
      {markReady ? <ShipVisualMarker mode="full" /> : null}
      <group rotation-y={basisYawRad}>
        <HeroModelBasis matrix={descriptor?.modelToSceneMatrix}>
          <primitive object={model} scale={scale} />
          {descriptor ? <MarinePropulsorsRig model={model} animations={animations} descriptor={descriptor} simRef={simRef} /> : null}
          {descriptor && !isShipProxyUrl(descriptor, url) ? (
            <SemanticBindingsRig
              key={resetToken}
              model={model}
              animations={animations}
              descriptor={descriptor}
              simRef={simRef}
              modelScale={scale}
            />
          ) : null}
        </HeroModelBasis>
      </group>
    </group>
  );
}




/** 仿真物理引擎 */
function SimulationEngine({
  simRef,
  shipRef,
  simTimeRef,
  isRunning,
  controlMode,
  pidGains,
  headingPoints,
  duration,
  guidePath,
  resetToken,
  speedScale,
  maxErrorDeg,
  maxSettlingTimeSec,
  disturbanceEnabled,
  manualRudderAt,
  onHudUpdate,
  onChartDataUpdate,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  shipRef: React.MutableRefObject<THREE.Group | null>;
  simTimeRef: React.MutableRefObject<number>;
  isRunning: boolean;
  controlMode: ControlMode;
  pidGains: PIDGains;
  headingPoints: HeadingPoint[];
  duration: number;
  guidePath: THREE.Vector3[];
  resetToken: number;
  speedScale: number;
  /** 当前任务 successCriteria.maxError（航向误差 °）：彩蛋达标判定阈值。 */
  maxErrorDeg: number;
  /** 当前任务 successCriteria.maxSettlingTime（s）：机动收敛时限，超时达标不计数。 */
  maxSettlingTimeSec?: number;
  disturbanceEnabled: boolean;
  manualRudderAt: (time: number) => number | null;
  onHudUpdate: (state: HudState) => void;
  onChartDataUpdate: (sample: DestroyerSample) => void;
}) {
  const marineFrame = useMarineFrameRunner();
  const lastFrameTimeRef = useRef(0);
  const clockRef = useRef(
    new SimulationClock({
      dt: SIMULATION_FIXED_STEP_SECONDS,
      maxSubSteps: SIMULATION_MAX_SUB_STEPS,
    })
  );
  const lastHudUpdateRef = useRef(0);
  const lastChartSampleRef = useRef(0);
  const totalErrorRef = useRef(0);
  const errorSampleCountRef = useRef(0);
  const rustStateRef = useRef<DestroyerHifiState | null>(null);
  const attainmentRef = useRef<AttainmentState>(createAttainmentState());
  /** 仿真时钟播完（simTime 超过 duration）：视觉推进门控随之为假。 */
  const finishedRef = useRef(false);
  const [runtimeReady, setRuntimeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preloadVirtualSimulationRuntime()
      .then(() => {
        if (!cancelled) setRuntimeReady(true);
      })
      .catch((error) => {
        console.error('Failed to load virtual simulation runtime', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    simTimeRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastHudUpdateRef.current = 0;
    lastChartSampleRef.current = 0;
    totalErrorRef.current = 0;
    errorSampleCountRef.current = 0;
    rustStateRef.current = null;
    attainmentRef.current = createAttainmentState();
    finishedRef.current = false;
    clockRef.current.reset();
  }, [resetToken, simTimeRef]);

  const interpolateHeading = useCallback(
    (t: number) => {
      if (headingPoints.length === 0) return 0;
      const sorted = [...headingPoints].sort((a, b) => a.time - b.time);
      if (t <= sorted[0].time) return sorted[0].heading;
      const lastPoint = sorted[sorted.length - 1];
      if (t >= lastPoint.time) return lastPoint.heading;
      for (let i = 0; i < sorted.length - 1; i++) {
        const start = sorted[i];
        const end = sorted[i + 1];
        if (t <= end.time) {
          const span = end.time - start.time;
          if (span <= 0.0001) return end.heading;
          const ratio = (t - start.time) / span;
          return start.heading + ratio * (end.heading - start.heading);
        }
      }
      return lastPoint.heading;
    },
    [headingPoints]
  );

  useFrame((state, delta) => {
    // 视觉推进门控每帧重算：暂停、未就绪、播完均为不推进（桨停转、尾迹停发）。
    simRef.current.advancing = isRunning && runtimeReady && !finishedRef.current;
    // 帧快照（#2097）：本帧首个消费者推进共享视觉时钟并冻结快照；暂停下环境仍推进。
    const frame = marineFrame?.consumeFrame(state.clock.elapsedTime, delta) ?? null;
    if (!isRunning || !runtimeReady) {
      lastFrameTimeRef.current = state.clock.getElapsedTime();
      return;
    }

    const elapsedTime = state.clock.getElapsedTime();
    const frameDt = getSimulationDeltaFromSeconds(elapsedTime, lastFrameTimeRef.current, speedScale);
    lastFrameTimeRef.current = elapsedTime;

    if (frameDt <= 0) return;

    const stepSimulation = (dt: number) => {
      const previousTime = simTimeRef.current;
      const simTime = previousTime + dt;

      if (simTime > duration) {
        finishedRef.current = true;
        simRef.current.advancing = false;
        return;
      }

      const sim = simRef.current;
      const targetHeading = interpolateHeading(simTime);
      const requestState =
        rustStateRef.current ??
        createDestroyerHifiStateFromSimulation({
          timeS: previousTime,
          headingDeg: toDegrees(sim.headingRad),
          yawRateDegS: toDegrees(sim.yawRateRad),
          positionX: sim.position.x,
          positionZ: sim.position.z,
          rudderDeg: sim.rudderDeg,
          speedMps: sim.speedMps,
          surgeMps: sim.surgeMps,
          swayMps: sim.swayMps,
          integralDegS: sim.integralDegS,
          prevErrorDeg: sim.prevErrorDeg,
        });

      const scriptedRudder = manualRudderAt(simTime);
      const rudderCommand = scriptedRudder ?? sim.manualRudderDeg;
      const stepResult = computeDestroyerHifiStep(
        buildDestroyerHifiStepRequest({
          dtS: dt,
          targetHeadingDeg: targetHeading,
          controlMode: controlMode === 'manual' || controlMode === 'p' || controlMode === 'pd' ? controlMode : 'pid',
          pid: pidGains,
          manualRudderDeg: rudderCommand,
          disturbanceEnabled,
          state: requestState,
        })
      );
      const mapped = mapDestroyerHifiStepResult(stepResult);
      rustStateRef.current = mapped.state;
      simTimeRef.current = mapped.timeS;
      sim.position.x = mapped.position.x;
      sim.position.z = mapped.position.z;
      sim.headingRad = mapped.headingRad;
      sim.yawRateRad = mapped.yawRateRad;
      sim.rudderDeg = mapped.rudderDeg;
      sim.speedMps = mapped.speedMps;
      sim.surgeMps = stepResult.surgeMps ?? mapped.speedMps;
      sim.swayMps = stepResult.swayMps ?? 0;
      sim.integralDegS = stepResult.integralDegS ?? 0;
      sim.prevErrorDeg = stepResult.prevErrorDeg ?? 0;

      // 彩蛋达标判定（视觉层只读计数）：进入机动段后误差收敛记达标，见 advanceAttainment。
      const headingErrorDeg = Math.abs(normalizeSignedHeading(targetHeading - toDegrees(sim.headingRad)));
      if (advanceAttainment(attainmentRef.current, targetHeading, headingErrorDeg, maxErrorDeg, dt, maxSettlingTimeSec)) {
        sim.attainedCount += 1;
      }

      // 误差计算
      const currentError = getCrossTrackError(sim.position, guidePath);
      if (simTime > 0) {
        totalErrorRef.current += currentError;
        errorSampleCountRef.current += 1;
      }
      const avgError =
        errorSampleCountRef.current > 0 ? totalErrorRef.current / errorSampleCountRef.current : 0;

      // HUD 更新
      if (simTime - lastHudUpdateRef.current > 0.1) {
        lastHudUpdateRef.current = simTime;
        onHudUpdate({
          heading: normalizeHeading(toDegrees(sim.headingRad)),
          yawRate: toDegrees(sim.yawRateRad),
          rudder: sim.rudderDeg,
          speed: sim.speedMps,
          position: { x: sim.position.x, z: sim.position.z },
          avgError,
          currentError,
          time: simTime,
        });
      }

      // 图表数据
      if (simTime - lastChartSampleRef.current > 0.5) {
        lastChartSampleRef.current = simTime;
        const headingDeg = normalizeSignedHeading(toDegrees(sim.headingRad));
        const targetHeadingSigned = normalizeSignedHeading(targetHeading);
        onChartDataUpdate({
          time: simTime,
          desiredHeading: targetHeadingSigned,
          actualHeading: headingDeg,
          yawRate: toDegrees(sim.yawRateRad),
          rudder: sim.rudderDeg,
          manualRudder: rudderCommand,
          speed: sim.speedMps,
          crossTrackError: currentError,
        });
      }
    };

    clockRef.current.advance(frameDt, stepSimulation);

    // 视觉姿态（#2097）：数值推进后按共享波场快照与声明所有权解析——纯函数，
    // 同一世界姿态/时间结果确定；telemetry 自由度（本船无）不会被覆盖。
    if (frame) {
      const visualWater = computeVisualWaterPose(
        frame.sampleWaterHeight,
        {
          x: simRef.current.position.x,
          z: simRef.current.position.z,
          headingRad: simRef.current.headingRad,
        },
        shipDimensions,
      );
      const pose = resolveMarineVisualPose({
        ownership: frame.ownership,
        visualWater,
      });
      simRef.current.waveY = pose.heave;
      simRef.current.wavePitch = pose.pitch;
      simRef.current.waveRoll = pose.roll;
    }
  });

  return null;
}

// ============ UI 组件 ============

function ControlPanel({
  isRunning,
  controlMode,
  pidGains,
  allowedModes,
  allowedGains,
  controlsEnabled,
  rudderLocked,
  manualRudder,
  onStart,
  onPause,
  onReset,
  onControlModeChange,
  onPidGainsChange,
  onManualRudderChange,
}: {
  isRunning: boolean;
  controlMode: ControlMode;
  pidGains: PIDGains;
  allowedModes: ControlMode[];
  allowedGains: Array<'kp' | 'ki' | 'kd'>;
  controlsEnabled: boolean;
  rudderLocked: boolean;
  manualRudder: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onControlModeChange: (mode: ControlMode) => void;
  onPidGainsChange: (gains: PIDGains) => void;
  onManualRudderChange: (value: number) => void;
}) {
  return (
    <div className="min-w-0">
      <Card className={simulationUi.panel}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            控制面板
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3 px-4 space-y-4">
          {/* 控制模式 */}
          <div className="space-y-2">
            <Label className="text-xs text-platform-fg-muted">控制模式</Label>
            <div className="grid grid-cols-4 gap-1">
              {(['manual', 'p', 'pd', 'pid'] as ControlMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={controlMode === mode ? 'default' : 'outline'}
                  size="sm"
                  disabled={!controlsEnabled || !allowedModes.includes(mode)}
                  className={`h-7 text-xs uppercase ${
                    controlMode === mode ? simulationUi.buttonPrimary : simulationUi.buttonOutline
                  }`}
                  onClick={() => onControlModeChange(mode)}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          {/* PID 增益 */}
          {controlMode === 'manual' && (
            <div className="space-y-2">
              <Label className="text-xs text-platform-fg-muted">手操舵角</Label>
              <div className="flex items-center gap-2" data-destroyer-rudder-slider>
                <Slider
                  value={[manualRudder]}
                  min={-nomotoParams.maxRudderDeg}
                  max={nomotoParams.maxRudderDeg}
                  step={1}
                  disabled={!controlsEnabled || rudderLocked}
                  onValueChange={([value]) => onManualRudderChange(value)}
                  aria-label="手操舵角"
                  className={`flex-1 ${simulationUi.slider}`}
                />
                <span className="w-max text-right text-xs font-mono">{manualRudder.toFixed(0)}°</span>
              </div>
            </div>
          )}

          {controlMode !== 'manual' && allowedGains.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs text-platform-fg-muted">PID 增益</Label>
              <div className="space-y-2">
                {allowedGains.includes('kp') && (
                  <div className="flex items-center gap-2">
                    <span className="w-max text-xs text-platform-action-primary">Kp</span>
                    <Slider
                      value={[pidGains.kp]}
                      min={0}
                      max={5}
                      step={0.1}
                      disabled={!controlsEnabled}
                      onValueChange={([v]) => onPidGainsChange({ ...pidGains, kp: v })}
                      aria-label="Kp"
                      className={`flex-1 ${simulationUi.slider}`}
                    />
                    <span className="w-max text-right text-xs font-mono">{pidGains.kp.toFixed(1)}</span>
                  </div>
                )}
                {allowedGains.includes('kd') && (
                  <div className="flex items-center gap-2">
                    <span className="w-max text-xs text-platform-action-primary">Kd</span>
                    <Slider
                      value={[pidGains.kd]}
                      min={0}
                      max={50}
                      step={1}
                      disabled={!controlsEnabled}
                      onValueChange={([v]) => onPidGainsChange({ ...pidGains, kd: v })}
                      aria-label="Kd"
                      className={`flex-1 ${simulationUi.slider}`}
                    />
                    <span className="w-max text-right text-xs font-mono">{pidGains.kd.toFixed(0)}</span>
                  </div>
                )}
                {allowedGains.includes('ki') && (
                  <div className="flex items-center gap-2">
                    <span className="w-max text-xs text-platform-action-primary">Ki</span>
                    <Slider
                      value={[pidGains.ki]}
                      min={0}
                      max={0.1}
                      step={0.001}
                      disabled={!controlsEnabled}
                      onValueChange={([v]) => onPidGainsChange({ ...pidGains, ki: v })}
                      aria-label="Ki"
                      className={`flex-1 ${simulationUi.slider}`}
                    />
                    <span className="w-max text-right text-xs font-mono">{pidGains.ki.toFixed(3)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex gap-2">
            {isRunning ? (
              <Button variant="outline" disabled={!controlsEnabled} className={`flex-1 ${simulationUi.buttonSecondary}`} onClick={onPause}>
                <Pause className="w-4 h-4 mr-2" />
                暂停
              </Button>
            ) : (
              <Button variant="default" data-sound-start disabled={!controlsEnabled} className={`flex-1 ${simulationUi.buttonPrimary}`} onClick={onStart}>
                <Play className="w-4 h-4 mr-2" />
                开始
              </Button>
            )}
            <Button variant="outline" disabled={!controlsEnabled} onClick={onReset} className={simulationUi.buttonOutline}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ 主组件 ============

export default function DestroyerSimulation({ ticket = '', stepNav, hostBrief, hostSubmission }: { ticket?: string; stepNav?: ReactNode; hostBrief?: ExperimentHostBrief; hostSubmission?: ReactNode }) {
  const ai = useOptionalGlobalAI();
  const { data: session, status: sessionStatus } = useSession();
  const [isRunning, setIsRunning] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('pid');
  const [pidGains, setPidGains] = useState<PIDGains>(DEFAULT_PID_GAINS);
  const [cameraMode, setCameraMode] = useState<string>('chase');
  const [viewResetCount, setViewResetCount] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(8);
  const sceneTheme = useSimulationSceneTheme();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [activeSeq, setActiveSeq] = useState(1);
  const [viewSeq, setViewSeq] = useState(1);
  const [manualRudder, setManualRudder] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [hudState, setHudState] = useState<HudState>({
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: REF_SPEED,
    position: { x: 0, z: 0 },
    avgError: 0,
    currentError: 0,
    time: 0,
  });
  const [samples, setSamples] = useState<DestroyerSample[]>([]);
  const [records, setRecords] = useState<Array<{
    seq: number;
    title: string;
    earnedPoints: number;
    maxPoints: number;
    evaluation: string;
    remarks: string;
    samples: DestroyerSample[];
    readings: DestroyerReadings;
  }>>([]);
  const [readings, setReadings] = useState<DestroyerReadings>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [originId, setOriginId] = useState('');
  const [reportHtml, setReportHtml] = useState('');
  const [pastReports, setPastReports] = useState<Array<{ id: string; score: number; maxScore: number; createdAt: string }> | null>(null);
  const [reportRevision, setReportRevision] = useState(0);
  const [seriesVisible, setSeriesVisible] = useState<Record<DestroyerSeriesId, boolean>>(
    () => Object.fromEntries(DESTROYER_CURVE_SERIES.map((series) => [series.id, series.id !== 'crossTrackError'])) as Record<DestroyerSeriesId, boolean>,
  );
  const stepStartedAt = useRef(Date.now());
  const hudRef = useRef(hudState);
  hudRef.current = hudState;

  // Refs
  const simRef = useRef<SimulationState>({
    position: new THREE.Vector3(),
    headingRad: 0,
    yawRateRad: 0,
    rudderDeg: 0,
    manualRudderDeg: 0,
    speedMps: REF_SPEED,
    surgeMps: REF_SPEED,
    swayMps: 0,
    integralDegS: 0,
    prevErrorDeg: 0,
    waveY: 0,
    wavePitch: 0,
    waveRoll: 0,
    attainedCount: 0,
    advancing: false,
  });
  const shipRef = useRef<THREE.Group | null>(null);
  // 数值仿真时间（#2097 提升）：引擎逐 fixed-step 写入，帧快照 simulationTime 只读消费。
  const simTimeRef = useRef(0);

  const step = DESTROYER_EXPERIMENT_STEPS[activeSeq - 1] ?? DESTROYER_EXPERIMENT_STEPS[0];
  const viewed = DESTROYER_EXPERIMENT_STEPS[viewSeq - 1] ?? step;
  const motion = useMemo(() => destroyerSceneMotion(step, REF_SPEED), [step]);
  const scenarioLogic = useMemo<ScenarioLogic>(() => ({
    startPos: motion.start,
    getDesiredHeading: motion.desiredHeading,
  }), [motion]);
  const guidePath = useMemo(() => generateGuidePath(scenarioLogic, motion.duration), [scenarioLogic, motion.duration]);
  const headingPoints = useMemo(() => {
    const points: HeadingPoint[] = [];
    const mark = 1;
    for (let time = 0; time <= motion.duration; time += mark) {
      points.push({ time, heading: normalizeSignedHeading(scenarioLogic.getDesiredHeading(time)) });
    }
    return points;
  }, [scenarioLogic, motion.duration]);
  const doneSeqs = records.map((record) => record.seq);
  const viewedRecord = records.find((record) => record.seq === viewSeq);
  const shownSamples = viewSeq === activeSeq ? samples : viewedRecord?.samples ?? [];

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setResetToken((prev) => prev + 1);
    setSamples([]);
    setManualRudder(0);

    const start = scenarioLogic.startPos;
    simRef.current = {
      position: new THREE.Vector3(start.x, 0, start.z),
      headingRad: toRadians(start.headingDeg),
      yawRateRad: 0,
      rudderDeg: 0,
      manualRudderDeg: 0,
      speedMps: REF_SPEED,
      surgeMps: REF_SPEED,
      swayMps: 0,
      integralDegS: 0,
      prevErrorDeg: 0,
      waveY: 0,
      wavePitch: 0,
      waveRoll: 0,
      attainedCount: 0,
      advancing: false,
    };

    setHudState({
      heading: start.headingDeg,
      yawRate: 0,
      rudder: 0,
      speed: REF_SPEED,
      position: { x: start.x, z: start.z },
      avgError: 0,
      currentError: 0,
      time: 0,
    });
  }, [scenarioLogic]);

  useEffect(() => {
    handleReset();
    setControlMode(step.defaultMode);
    setReadings({});
    stepStartedAt.current = Date.now();
  }, [activeSeq, handleReset, step.defaultMode]);

  useEffect(() => {
    simRef.current.manualRudderDeg = manualRudder;
  }, [manualRudder, resetToken]);

  useEffect(() => {
    const storageKey = 'act-destroyer-origin';
    let cancelled = false;
    void (async () => {
      if (ticket) {
        const response = await fetch('/api/ilab/destroyer/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ticket }),
        });
        const body = await response.json() as { originId?: string; displayName?: string; error?: string };
        if (cancelled) return;
        if (!response.ok || !body.originId) {
          setMessage(body.error || '票据校验失败，本次只在本机记录。');
          return;
        }
        window.sessionStorage.setItem(storageKey, body.originId);
        setOriginId(body.originId);
        window.history.replaceState(null, '', '/simulations/destroyer');
        setMessage(`已进入实验，学生 ${body.displayName ?? ''}。`);
        return;
      }
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) return;
      const response = await fetch(`/api/ilab/destroyer/session/${stored}`);
      if (response.status === 404 || response.status === 400) {
        window.sessionStorage.removeItem(storageKey);
        return;
      }
      if (!response.ok) {
        if (!cancelled) setMessage('暂时无法恢复这次实验，请稍后刷新。');
        return;
      }
      const body = await response.json() as {
        originId?: string;
        currentSeq?: number;
        steps?: Array<{
          seq: number;
          title: string;
          earnedPoints: number;
          maxPoints: number;
          evaluation: string;
          remarks: string;
          readings: DestroyerReadings;
          samples: DestroyerSample[];
        }>;
      };
      if (cancelled || !body.originId || !body.steps) return;
      setOriginId(body.originId);
      setRecords(body.steps);
      const nextSeq = body.currentSeq && body.currentSeq > 0 ? body.currentSeq : 1;
      setActiveSeq(nextSeq);
      setViewSeq(nextSeq);
      setMessage('已恢复这次实验已保存的步骤。');
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      setPastReports(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const response = await fetch('/api/simulations/destroyer/reports');
      if (!response.ok) return;
      const body = await response.json() as { reports?: Array<{ id: string; score: number; maxScore: number; createdAt: string }> };
      if (!cancelled) setPastReports(body.reports ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, reportRevision]);

  const updatePageContext = ai?.updatePageContext;
  const clearDynamicPageContext = ai?.clearDynamicPageContext;
  const hudBucket = Math.floor(hudState.time / 5);
  useEffect(() => {
    if (!updatePageContext) return;
    const hud = hudRef.current;
    updatePageContext({
      courseId: 'destroyer-heading-experiment',
      courseTitle: DESTROYER_EXPERIMENT_TITLE,
      pageType: 'practice',
      stepId: `destroyer-step-${step.seq}`,
      topic: step.title,
      learningObjectives: [step.goal],
      knowledgeType: 'X',
      simulationId: 'destroyer',
      routeProvenance: 'simulation-route',
      systemPromptExtension: destroyerKonlingBrief(step, {
        heading: hud.heading,
        yawRate: hud.yawRate,
        rudder: hud.rudder,
        manualRudder,
        speed: hud.speed,
        time: hud.time,
        mode: controlMode,
      }),
      quickQuestions: [{
        label: '这一步怎么做',
        question: `我在做${DESTROYER_EXPERIMENT_TITLE}第 ${step.seq} 步「${step.title}」。请给出操作建议，不要替我填写读数，也不要打分。`,
      }],
    });
  }, [updatePageContext, step, hudBucket, controlMode, manualRudder]);

  useEffect(() => () => {
    clearDynamicPageContext?.();
  }, [clearDynamicPageContext]);

  const handleChartDataUpdate = useCallback((sample: DestroyerSample) => {
    setSamples((prev) => {
      const next = [...prev, sample];
      return next.length > 2000 ? next.slice(next.length - 2000) : next;
    });
  }, []);

  async function submitStep() {
    const order = assertDestroyerStepOrder(doneSeqs, step.seq);
    if (order) {
      setMessage(order);
      return;
    }
    const hasSketch = step.fields.some((field) => field.kind === 'sketch');
    const prepared = await applyLocalSketchVerdict(readings, hasSketch, Boolean(originId));
    if (!prepared.ok) {
      setMessage(prepared.message);
      return;
    }
    const storedSamples = thinDestroyerSamples(samples);
    const scored = prepared.skipLocalScore ? null : scoreDestroyerStep(step.seq, storedSamples, prepared.readings);
    if (scored && !scored.ok) {
      setMessage(scored.message);
      return;
    }
    const record = scored ? {
      seq: step.seq,
      title: step.title,
      earnedPoints: scored.earnedPoints,
      maxPoints: scored.maxPoints,
      evaluation: scored.evaluation,
      remarks: scored.remarks,
      samples: storedSamples,
      readings: prepared.readings,
    } : null;
    const previous = records.find((item) => item.seq === step.seq);
    const chosen = record ? chooseBetterDestroyerAttempt(previous, record) : null;
    if (chosen?.keptPrevious) {
      setMessage('这次没有超过已保存的成绩，仍保留较好的一次。');
      return;
    }
    const nextRecords = chosen
      ? [...records.filter((item) => item.seq !== step.seq), chosen.record]
      : records;
    const redoing = doneSeqs.includes(step.seq);
    if (originId) {
      setBusy(true);
      try {
        const response = await fetch(`/api/ilab/destroyer/session/${originId}/steps`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            seq: step.seq,
            readings: prepared.readings,
            sketchImage: prepared.sketchImage,
            samples: storedSamples,
            startedAtMs: stepStartedAt.current,
          }),
        });
        const body = await response.json() as {
          error?: string;
          retryReport?: boolean;
          steps?: Array<{
            seq: number;
            title: string;
            earnedPoints: number;
            maxPoints: number;
            evaluation: string;
            remarks: string;
            readings: DestroyerReadings;
            samples: DestroyerSample[];
          }>;
        };
        if (!response.ok && response.status !== 409) {
          setMessage(body.error || '本步回传失败。');
          return;
        }
        if (response.ok && body.steps) {
          nextRecords.splice(0, nextRecords.length, ...body.steps);
        }
        if (response.status === 409 && body.retryReport) {
          const done = await fetch(`/api/ilab/destroyer/session/${originId}/complete`, { method: 'POST' });
          const doneBody = await done.json() as {
            error?: string;
            remote?: { message?: string };
            session?: { steps?: typeof records };
          };
          if (!done.ok) {
            setMessage(doneBody.error || '实验报告回传失败。');
            return;
          }
          const frozenSteps = doneBody.session?.steps ?? records;
          const html = buildDestroyerReportHtml({
            displayName: session?.user?.name || '本次实验',
            steps: frozenSteps,
          });
          setReportHtml(html);
          const saved = await saveAccountReport(html, frozenSteps);
          const remoteMessage = doneBody.remote?.message || '实验报告已生成。';
          setMessage(saved ? `${remoteMessage}报告已保存到账号。` : remoteMessage);
          setRecords(frozenSteps);
          setReadings({});
          return;
        } else if (response.status === 409) {
          if (step.scene === 'review') {
            const html = buildDestroyerReportHtml({
              displayName: session?.user?.name || '本次实验',
              steps: nextRecords,
            });
            setReportHtml(html);
            const saved = await saveAccountReport(html, nextRecords);
            setMessage(saved ? '实验空间已经交卷。新的报告已保存到账号。' : '实验空间已经交卷，这次成绩只留在本机。');
          } else {
            setMessage('实验空间已经交卷，这次成绩只留在本机。');
          }
        } else if (step.scene === 'review') {
          const done = await fetch(`/api/ilab/destroyer/session/${originId}/complete`, { method: 'POST' });
          const doneBody = await done.json() as { error?: string; remote?: { message?: string } };
          if (!done.ok) {
            setMessage(doneBody.error || '实验报告回传失败。');
            return;
          }
          const reportResponse = await fetch(`/api/ilab/session/${originId}?report=1`);
          const html = reportResponse.ok
            ? await reportResponse.text()
            : buildDestroyerReportHtml({ displayName: session?.user?.name || '本次实验', steps: nextRecords });
          setReportHtml(html);
          const saved = await saveAccountReport(html, nextRecords);
          const remoteMessage = doneBody.remote?.message || '实验报告已生成。';
          setMessage(saved ? `${remoteMessage}报告已保存到账号。` : remoteMessage);
        } else {
          setMessage('本步已回传。');
        }
      } finally {
        setBusy(false);
      }
    } else if (step.scene === 'review') {
      const html = buildDestroyerReportHtml({
        displayName: session?.user?.name || '本次实验',
        steps: nextRecords,
      });
      setReportHtml(html);
      const saved = await saveAccountReport(html, nextRecords);
      setMessage(saved
        ? '报告已保存到账号。没有实验空间票据，尚未回传。'
        : '报告已在本机生成。没有实验空间票据，尚未回传。登录后可以保存到账号。');
    } else {
      setMessage('本步已记录。没有实验空间票据，尚未回传。');
    }
    setRecords(nextRecords);
    setReadings({});
    if (!redoing && step.scene !== 'review') {
      setActiveSeq(step.seq + 1);
      setViewSeq(step.seq + 1);
    }
  }

  async function saveAccountReport(html: string, stored: typeof records): Promise<boolean> {
    if (sessionStatus !== 'authenticated') return false;
    const response = await fetch('/api/simulations/destroyer/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reportHtml: html,
        steps: stored.map((item) => ({
          seq: item.seq,
          title: item.title,
          earnedPoints: item.earnedPoints,
          maxPoints: item.maxPoints,
          evaluation: item.evaluation,
          remarks: item.remarks,
        })),
      }),
    });
    if (!response.ok) return false;
    setReportRevision((value) => value + 1);
    return true;
  }

  async function openStoredReport(id: string) {
    const response = await fetch(`/api/simulations/destroyer/reports/${id}`);
    const body = await response.json() as { reportHtml?: string; error?: string };
    if (!response.ok || !body.reportHtml) {
      setMessage(body.error || '打不开这份报告。');
      return;
    }
    const blob = new Blob([body.reportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, 'destroyer-experiment-report', 'popup,width=960,height=720');
  }

  function openReport() {
    const html = reportHtml || buildDestroyerReportHtml({
      displayName: '本次实验',
      steps: records,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, 'destroyer-experiment-report', 'popup,width=960,height=720');
  }

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
        <PerspectiveCamera makeDefault position={[0, 200, 500]} fov={60} near={1} far={50000} />
        <MarineFrameRuntime simRef={simRef} simTimeRef={simTimeRef} resetToken={resetToken}>
        <Suspense fallback={null}>
          <EnvironmentScene subjectPositionSampler={() => ({ x: simRef.current.position.x, z: simRef.current.position.z })} />
        <MarineSceneLayoutObjects layoutId="open-sea-distant-islands" />
        </Suspense>
        <SoundscapeAmbienceDriver />
        <SceneQualityDriver />
        <MarinePerformanceEvidenceProbe contextInput={() => ({ vesselId: 'destroyer', cameraView: String(cameraMode), seaState: 3 })} />
        <Suspense fallback={null}>
          <PresetWater simRef={simRef} resetToken={resetToken} />
        </Suspense>
        {showGrid ? <GridHelper simRef={simRef} sceneTheme={sceneTheme} /> : null}
        <GuideRoute points={guidePath} />
        <ActualPathTrail positionSampler={() => simRef.current.position} resetToken={resetToken} />
        <TeachingAnnotationsGate
          simRef={simRef}
          targetHeadingSampler={() => platformHeadingToSceneRad(scenarioLogic.getDesiredHeading(hudState.time))}
        />

        <Suspense
          fallback={(
            <ModelLoadingPlaceholder
              label="驱逐舰模型加载中"
              sublabel="场景已就绪，可先查看海面与航迹"
            />
          )}
        >
          <DestroyerModel simRef={simRef} resetToken={resetToken} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={100}
          maxDistance={5000}
          maxPolarAngle={Math.PI / 2.1}
        />
        <RightClickFreeModeBridge onRequestFreeMode={() => setCameraMode('free')} />
        <StayPutCameraController
          view={cameraMode}
          positionSampler={() => ({ x: simRef.current.position.x, z: simRef.current.position.z })}
          headingSampler={() => platformHeadingToSceneRad(toDegrees(simRef.current.headingRad))}
          shipLength={shipDimensions.length}
          controlsRef={controlsRef}
          resetSignal={viewResetCount}
        />
        <SimulationEngine
          simRef={simRef}
          shipRef={shipRef}
          simTimeRef={simTimeRef}
          isRunning={isRunning}
          controlMode={controlMode}
          pidGains={pidGains}
          headingPoints={headingPoints}
          duration={motion.duration}
          guidePath={guidePath}
          resetToken={resetToken}
          speedScale={speedScale}
          maxErrorDeg={5}
          maxSettlingTimeSec={60}
          disturbanceEnabled={motion.disturbance}
          manualRudderAt={motion.manualRudder}
          onHudUpdate={setHudState}
          onChartDataUpdate={handleChartDataUpdate}
        />
        <ScenePostEffects />
        </MarineFrameRuntime>
      </MarineCanvas>

      <SimulationDock
        side="left"
        title="实验状态"
        fitContent
        defaultTab="status"
        tabs={[
          {
            id: 'steps',
            label: '实验步骤',
            content: stepNav ?? (
              <DestroyerStepList
                activeSeq={activeSeq}
                viewSeq={viewSeq}
                doneSeqs={doneSeqs}
                onOpen={(seq) => {
                  setViewSeq(seq);
                  setActiveSeq(seq);
                }}
              />
            ),
          },
          {
            id: 'status',
            label: '状态',
            content: (
              <DestroyerStatusPanel
                heading={signedHeading(hudState.heading)}
                yawRate={hudState.yawRate}
                rudder={hudState.rudder}
                manualRudder={manualRudder}
                speed={hudState.speed}
                currentError={hudState.currentError}
                avgError={hudState.avgError}
                time={hudState.time}
                running={isRunning}
                mode={controlMode}
                samples={shownSamples}
                visible={seriesVisible}
                onToggle={(id) => setSeriesVisible((prev) => ({ ...prev, [id]: !prev[id] }))}
              />
            ),
          },
        ]}
      />

      <SimulationDock
        side="right"
        title="控制与探究"
        fitContent
        tabs={[
          {
            id: 'control',
            label: '控制',
            content: (
              <ExperimentStepAreas
                seq={hostBrief?.seq ?? step.seq}
                title={hostBrief?.title ?? step.title}
                goal={hostBrief?.goal ?? step.goal}
                watch={hostBrief ? hostBrief.watch : step.watch}
                hint={hostBrief ? hostBrief.hint : step.suggestion}
                hintAttribute="data-destroyer-suggestion"
                controls={(
                  <ControlPanel
                    isRunning={isRunning}
                    controlMode={controlMode}
                    pidGains={pidGains}
                    allowedModes={step.modes}
                    allowedGains={step.gains}
                    controlsEnabled={step.scene !== 'review'}
                    rudderLocked={scriptedManualRudder(step, 0) !== null}
                    manualRudder={manualRudder}
                    onStart={() => setIsRunning(true)}
                    onPause={() => setIsRunning(false)}
                    onReset={handleReset}
                    onControlModeChange={setControlMode}
                    onPidGainsChange={setPidGains}
                    onManualRudderChange={setManualRudder}
                  />
                )}
                submission={hostSubmission ?? (stepNav ? undefined : (
                  <DestroyerStepForm
                    step={step}
                    readings={readings}
                    message={message}
                    busy={busy}
                    reportEnabled={records.some((record) => record.seq === DESTROYER_EXPERIMENT_STEPS.length) || Boolean(reportHtml)}
                    onChange={(key, value) => setReadings((prev) => ({ ...prev, [key]: value }))}
                    onSubmit={() => { void submitStep(); }}
                    onReport={openReport}
                    onAsk={() => ai?.openSidebar()}
                  />
                ))}
              />
            ),
          },
          {
            id: 'evaluate',
            label: '评估',
            content: (
              <div className="w-max max-w-[calc(100vw-2rem)] space-y-3">
                <DestroyerReportHistory
                  signedIn={sessionStatus === 'authenticated'}
                  reports={pastReports ?? []}
                  onOpen={(id) => { void openStoredReport(id); }}
                />
                <SimulationAssessmentPanel
                  title="机动任务评估"
                  metrics={[
                    { id: 'current-error', label: '当前误差', value: hudState.currentError, max: 200, better: 'lower', unit: 'm' },
                    { id: 'avg-error', label: '平均误差', value: hudState.avgError, max: 200, better: 'lower', unit: 'm' },
                    { id: 'yaw', label: '转艏速率', value: Math.abs(hudState.yawRate), max: 8, better: 'lower', unit: '°/s' },
                    { id: 'rudder', label: '舵角幅值', value: Math.abs(hudState.rudder), max: 35, better: 'lower', unit: '°' },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />

      {/* 视角切换器 */}
      <CameraViewSwitcher
        currentMode={cameraMode}
        onModeChange={setCameraMode}
        onViewReset={() => setViewResetCount((previous) => previous + 1)}
        views={CAMERA_SHOT_VIEWS}
        gridEnabled={showGrid}
        onToggleGrid={() => setShowGrid((previous) => !previous)}
        speedScale={speedScale}
        onSpeedChange={setSpeedScale}
        maxSpeedScale={8}
        className={simulationUi.cameraSwitcherPosition}
      />

      <SimulationTopBar
        title="055 型驱逐舰航向控制"
        subtitle="高保真航向控制"
        badge="Destroyer / OBE"
      />
    </div>
    </SceneQualityProvider>
    </TeachingAnnotationsProvider>
    </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}
