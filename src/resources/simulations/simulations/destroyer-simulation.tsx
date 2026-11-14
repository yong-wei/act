'use client';
import { MarineLine as Line } from '@/resources/simulations/scene/lines/marine-line';

/**
 * 055型驱逐舰航向控制仿真
 * 模块化重构版本 - 使用统一物理引擎和控制器
 */

import { Suspense, useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { clearIlabOriginSessionStorage, stripIlabUrlParams } from '@/features/ilab/client-grant';
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
import { ArrowDownFromLine, Compass, Navigation, Orbit, Settings, SlidersHorizontal, Video } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  SimField,
  SimLockedChip,
  SimPanelSection,
  SimPanelStack,
  SimRunControls,
  SimSegmented,
} from '../components/simulation-panels';

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
import { ExperimentStepAreas, SimulationTopBar, SimulationDock, SimulationAssessmentPanel, SimulationMissionTracker, simulationUi } from '../components/simulation-ui';
import { useOptionalGlobalAI } from '@/components/providers/global-ai-provider';
import { applyLocalSketchVerdict } from '@/features/ilab/sketch-client';
import {
  DESTROYER_CURVE_SERIES,
  DESTROYER_EXPERIMENT_STEPS,
  destroyerStepsForVersion,
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
import { withLatestSample } from './vessel-experiment';
import { DestroyerReportHistory, DestroyerStatusPanel, DestroyerStepForm, DestroyerStepList } from './destroyer-experiment-panels';
import { useSimulationSceneTheme, simulationScenePalette, type SimulationSceneTheme } from '../components/simulation-theme';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromSeconds,
} from '../lib/simulation-timing';
import {
  advanceDestroyerCourseSession,
  buildDestroyerHifiStepRequest,
  createDestroyerHifiStateFromSimulation,
  mapDestroyerHifiStepResult,
  type DestroyerHifiState,
} from '../rust/destroyer-hifi-adapter';
import { createVesselSimulationSessionBrowser, type VesselSession, type VesselSessionFrame,
  type VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { VESSEL_COURSE_VERSION, destroyerCourseCommands, destroyerCourseVariants, type DestroyerCourseStep } from '../experiments/destroyer-course';
import { VesselRunRecorder } from '@/features/simulations/run-recorder';
import { uploadVesselCourseRun, uploadVesselCourseArtifacts, saveVesselCourseReport, type VesselReportProgress } from '@/features/simulations/course-artifact-upload';
import type { VesselReportSections } from '@/features/ilab/course-artifact-contract';
import { VESSEL_REPORT_STATUSES } from '@/features/ilab/course-report-review-contract';
import { listRunEvidence, readExperimentDraft, saveExperimentDraft, readRunEvidence,
  listExperimentDrafts, readStepExperimentDraft, type VesselExperimentDraft,
  listLocalStepAttempts, saveLocalStepAttempt, listFrozenStudentModels, listModelComparisons, saveModelComparison,
  type VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { vesselRunMetricsRequest, type VesselLocalStepAttempt } from '@/features/simulations/run-evidence';
import { buildVesselCourseReportHtml, type VesselReportEvidence } from '@/features/simulations/course-report';
import { VesselModelWorkbench } from '../experiments/model-workbench';
import type { FrozenVesselStudentModel, VesselModelComparison } from '../experiments/student-analysis';
import { forecastDestroyerClosedLoop, designStudentHeadingController, type StudentHeadingDesign } from '../experiments/student-analysis';
import { ModelComparisonCurve } from '../experiments/model-comparison-curve';
import { MeasurementWindow } from '../experiments/measurement-window';
import { VesselSignalCurve } from '../experiments/vessel-signal-curve';
import { headingControllerSignature, validateDestroyerCourseEvidence } from '../experiments/destroyer-evidence';
import {
  computeDestroyerHifiStep,
  computeVirtualSimulationStep,
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
  physicalQuaternion?: [number, number, number, number];
  cgAboveWaterlineM?: number;
}

function applyPhysicalFrame(sim: SimulationState, frame: VesselSessionFrame) {
  const truth = frame.truth;
  sim.position.set(truth.position_ned[0], -truth.position_ned[2], truth.position_ned[1]);
  sim.headingRad = toRadians(frame.attitudeDeg.heading);
  sim.yawRateRad = truth.body_velocity[5];
  sim.rudderDeg = toDegrees(truth.actuator_states.control_surface_angles_rad[0] ?? 0);
  sim.speedMps = frame.waterVelocityBody[0];
  sim.surgeMps = truth.body_velocity[0];
  sim.swayMps = truth.body_velocity[1];
  sim.waveY = -truth.position_ned[2];
  sim.waveRoll = toRadians(frame.attitudeDeg.roll);
  sim.wavePitch = toRadians(frame.attitudeDeg.pitch);
  sim.physicalQuaternion = truth.quaternion;
  sim.cgAboveWaterlineM = frame.parameters.cgAboveWaterlineM;
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

const generateGuidePath = (logic: ScenarioLogic, duration: number, speedMps?: number) => {
  const points: THREE.Vector3[] = [];
  let x = logic.startPos.x;
  let z = logic.startPos.z;
  if (speedMps !== undefined) points.push(new THREE.Vector3(x,0.5,z));
  const dt = 0.5;

  points.push(new THREE.Vector3(x, 0.5, z));

  for (let t = 0; t <= duration; t += dt) {
    const headingDeg = logic.getDesiredHeading(t);
    const headingRad = toRadians(headingDeg);
    x += (speedMps ?? REF_SPEED) * Math.cos(headingRad) * dt;
    z += (speedMps ?? REF_SPEED) * Math.sin(headingRad) * dt;
    points.push(new THREE.Vector3(x, 0.5, z));
  }
  return points;
};

const getCrossTrackError = (position: THREE.Vector3, guidePath: THREE.Vector3[], horizontalOnly = false) => {
  if (guidePath.length < 2) return 0;

  let minDist = Infinity;
  for (let i = 0; i < guidePath.length - 1; i++) {
    const a = guidePath[i];
    const b = guidePath[i + 1];
    const dx = b.x-a.x, dy = horizontalOnly ? 0 : b.y-a.y, dz = b.z-a.z;
    const px = position.x-a.x, py = horizontalOnly ? 0 : position.y-a.y, pz = position.z-a.z;
    const lengthSquared = dx*dx+dy*dy+dz*dz;
    const t = lengthSquared > 0 ? clamp((px*dx+py*dy+pz*dz)/lengthSquared,0,1) : 0;
    const dist = Math.hypot(px-t*dx,py-t*dy,pz-t*dz);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
};

// ============ 3D 组件 ============

/**
 * 旧实验沿用共享波场姿态。新版实验将六自由度遥测交给同一场景显示。
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
  physicalPose = false,
  children,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  simTimeRef: React.MutableRefObject<number>;
  resetToken: number;
  physicalPose?: boolean;
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
      ownership: physicalPose ? { heave: 'telemetry', pitch: 'telemetry', roll: 'telemetry' } : DESTROYER_055_POSE_OWNERSHIP,
      environmentPresetIdSampler: () => presetId,
      qualityTierSampler: () => qualityRef.current.waterTier,
    }),
    [simRef, simTimeRef, presetId, physicalPose]
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
  const physicalRotation = useRef(new THREE.Quaternion());
  const modelHeadingBasis = useRef(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2));
  const physicalAnchor = useRef(new THREE.Vector3());

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

    if (sim.physicalQuaternion) {
      const [w, x, y, z] = sim.physicalQuaternion;
      const cgHeight = sim.cgAboveWaterlineM ?? 0;
      physicalRotation.current.set(x, -z, y, w);
      physicalAnchor.current.set(0, waterlineOffset-cgHeight, 0).applyQuaternion(physicalRotation.current);
      groupRef.current.position.set(sim.position.x, cgHeight+sim.waveY, sim.position.z).add(physicalAnchor.current);
      groupRef.current.quaternion.copy(physicalRotation.current).multiply(modelHeadingBasis.current);
    } else {
      groupRef.current.position.set(sim.position.x, sim.waveY + waterlineOffset, sim.position.z);
      groupRef.current.rotation.set(sim.wavePitch, -sim.headingRad + Math.PI / 2, sim.waveRoll);
    }

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
  latestSampleRef,
  courseStep,
  derivativeFilterTauS,
  headingIntegralTracking,
  nativeSessionRef,
  onCourseFrame,
  onRuntimeReady,
  onRuntimeFailure,
  onFinished,
  restoreCheckpoint,
  executionRef,
  restoredTrace,
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
  /** 每个子步的最新采样：曲线按 0.5 s 抽样，交卷时用它补上暂停时刻。 */
  latestSampleRef: React.MutableRefObject<DestroyerSample | null>;
  courseStep?: DestroyerCourseStep;
  derivativeFilterTauS: number;
  headingIntegralTracking: VesselSessionInput['headingIntegralTracking'];
  nativeSessionRef: React.MutableRefObject<VesselSession | null>;
  onCourseFrame: (frame: VesselSessionFrame) => void;
  onRuntimeReady: (ready: boolean) => void;
  onRuntimeFailure: (message: string) => void;
  onFinished: () => void;
  restoreCheckpoint: string | null;
  executionRef: React.MutableRefObject<boolean>;
  restoredTrace: readonly import('@/features/simulations/run-evidence').VesselTracePoint[] | null;
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
  const nativeInputRef = useRef<VesselSessionInput | null>(null);
  const trackSamplePosition = useRef(new THREE.Vector3());

  useEffect(() => {
    let cancelled = false;
    let created: VesselSession | null = null;
    setRuntimeReady(false);
    onRuntimeReady(false);
    void (async () => {
      if (courseStep) {
        created = await createVesselSimulationSessionBrowser(courseStep.configuration);
        if (cancelled) { created.dispose(); return; }
        if (restoreCheckpoint) created.restore(restoreCheckpoint);
        nativeSessionRef.current = created;
        const initial = created.read();
        nativeInputRef.current = initial.input;
        simTimeRef.current = initial.timeS;
        applyPhysicalFrame(simRef.current, initial);
        if (restoreCheckpoint && restoredTrace) {
          totalErrorRef.current = 0;
          for (const point of restoredTrace) {
            trackSamplePosition.current.set(point.estimate.northM,0,point.estimate.eastM);
            totalErrorRef.current += getCrossTrackError(trackSamplePosition.current,guidePath,true);
          }
          errorSampleCountRef.current = restoredTrace.length;
        }
        trackSamplePosition.current.set(initial.observer.position_heading[0],0,initial.observer.position_heading[1]);
        onHudUpdate({ heading: initial.attitudeDeg.heading, yawRate: toDegrees(initial.truth.body_velocity[5]),
          rudder: simRef.current.rudderDeg, speed: initial.waterVelocityBody[0],
          position: { x: simRef.current.position.x, z: simRef.current.position.z },
          currentError: getCrossTrackError(trackSamplePosition.current, guidePath,true),
          avgError: errorSampleCountRef.current ? totalErrorRef.current/errorSampleCountRef.current : 0, time: initial.timeS });
      } else { await preloadVirtualSimulationRuntime(); }
      if (!cancelled) { setRuntimeReady(true); onRuntimeReady(true); }
    })().catch((error: unknown) => {
      if (!cancelled) onRuntimeFailure(error instanceof Error ? error.message : '仿真暂时无法加载，请重试。');
    });
    return () => {
      cancelled = true;
      if (nativeSessionRef.current === created) nativeSessionRef.current = null;
      created?.dispose();
    };
  }, [courseStep, nativeSessionRef, onRuntimeFailure, onRuntimeReady, resetToken, restoreCheckpoint,
    simRef, simTimeRef, onHudUpdate, guidePath, restoredTrace]);

  useEffect(() => {
    simTimeRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastHudUpdateRef.current = 0;
    lastChartSampleRef.current = 0;
    latestSampleRef.current = null;
    totalErrorRef.current = 0;
    errorSampleCountRef.current = 0;
    rustStateRef.current = null;
    attainmentRef.current = createAttainmentState();
    finishedRef.current = false;
    clockRef.current.reset();
  }, [resetToken, simTimeRef, latestSampleRef]);

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
    simRef.current.advancing = isRunning && executionRef.current && runtimeReady && !finishedRef.current;
    // 帧快照（#2097）：本帧首个消费者推进共享视觉时钟并冻结快照；暂停下环境仍推进。
    const frame = marineFrame?.consumeFrame(state.clock.elapsedTime, delta) ?? null;
    if (!isRunning || !executionRef.current || !runtimeReady) {
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

      if (simTime > duration + 1e-8) {
        if (!finishedRef.current) onFinished();
        finishedRef.current = true;
        simRef.current.advancing = false;
        return;
      }

      const sim = simRef.current;
      const targetHeading = courseStep ? destroyerCourseCommands(courseStep, previousTime).headingDeg : interpolateHeading(simTime);
      const scriptedRudder = manualRudderAt(previousTime);
      const rudderCommand = scriptedRudder ?? sim.manualRudderDeg;
      if (courseStep) {
        const session = nativeSessionRef.current;
        const input = nativeInputRef.current;
        if (!session || !input) return;
        const physical = advanceDestroyerCourseSession(session, input, {
          dtS: dt, targetHeadingDeg: targetHeading,
          controlMode: controlMode === 'manual' || controlMode === 'p' || controlMode === 'pd' ? controlMode : 'pid', pid: pidGains,
          manualRudderDeg: rudderCommand, derivativeFilterTauS,
          headingIntegralTracking, feedback: 'measurement',
        });
        simTimeRef.current = physical.timeS;
        applyPhysicalFrame(sim, physical);
        for (const packet of physical.controlSamples) {
          trackSamplePosition.current.set(packet.observer.position_heading[0],0,packet.observer.position_heading[1]);
          totalErrorRef.current += getCrossTrackError(trackSamplePosition.current,guidePath,true);
          errorSampleCountRef.current++;
        }
        onCourseFrame(physical);
      } else {
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
      }

      // 彩蛋达标判定（视觉层只读计数）：进入机动段后误差收敛记达标，见 advanceAttainment。
      const headingErrorDeg = Math.abs(normalizeSignedHeading(targetHeading - toDegrees(sim.headingRad)));
      if (advanceAttainment(attainmentRef.current, targetHeading, headingErrorDeg, maxErrorDeg, dt, maxSettlingTimeSec)) {
        sim.attainedCount += 1;
      }

      // 误差计算
      const currentError = getCrossTrackError(courseStep ? trackSamplePosition.current : sim.position, guidePath,Boolean(courseStep));
      if (simTime > 0 && !courseStep) {
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
      const sample: DestroyerSample = {
        time: simTime,
        desiredHeading: normalizeSignedHeading(targetHeading),
        actualHeading: normalizeSignedHeading(toDegrees(sim.headingRad)),
        yawRate: toDegrees(sim.yawRateRad),
        rudder: sim.rudderDeg,
        manualRudder: rudderCommand,
        speed: sim.speedMps,
        crossTrackError: currentError,
      };
      latestSampleRef.current = sample;
      if (!courseStep && simTime - lastChartSampleRef.current > 0.5) {
        lastChartSampleRef.current = simTime;
        onChartDataUpdate(sample);
      }
    };

    try {
      if (courseStep) {
        let pendingSeconds = 0;
        clockRef.current.advance(frameDt,(dt) => { pendingSeconds += dt; });
        while (pendingSeconds > 1e-8 && !finishedRef.current) {
          const time = simTimeRef.current;
          if (time >= duration-1e-8) {
            finishedRef.current = true;
            simRef.current.advancing = false;
            onFinished();
            break;
          }
          const nextEventTime = courseStep.events.find((event) => event.timeS > time+1e-8)?.timeS ?? duration;
          const seconds = Math.min(pendingSeconds,1,nextEventTime-time,duration-time);
          stepSimulation(seconds);
          pendingSeconds -= seconds;
        }
      } else {
        clockRef.current.advance(frameDt, stepSimulation);
      }
    } catch (error) {
      finishedRef.current = true;
      simRef.current.advancing = false;
      onRuntimeFailure(error instanceof Error ? error.message : '本次运行已中断，请查看运行记录。');
    }

    // 视觉姿态（#2097）：数值推进后按共享波场快照与声明所有权解析——纯函数，
    // 同一世界姿态/时间结果确定；telemetry 自由度（本船无）不会被覆盖。
    if (frame && !courseStep) {
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
  children,
  gainsLocked = false,
  gainBounds,
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
  children?: React.ReactNode;
  gainsLocked?: boolean;
  gainBounds?: Partial<Record<'kp' | 'ki' | 'kd',{ min:number;max:number;step:number;digits:number }>>;
}) {
  const gainSliders = [
    { id: 'kp' as const, label: 'Kp', max: 5, step: 0.1, digits: 1 },
    { id: 'kd' as const, label: 'Kd', max: 50, step: 1, digits: 0 },
    { id: 'ki' as const, label: 'Ki', max: 0.1, step: 0.001, digits: 3 },
  ].map((gain) => ({ ...gain,min:0,...gainBounds?.[gain.id] }))
    .filter((gain) => allowedGains.includes(gain.id) && (gain.id !== 'ki' || controlMode === 'pid')
      && (gain.id !== 'kd' || controlMode === 'pd' || controlMode === 'pid'));

  return (
    <SimPanelStack>
      <SimRunControls
        running={isRunning}
        primaryLabel={isRunning ? '暂停' : '开始'}
        onPrimary={isRunning ? onPause : onStart}
        primarySoundStart={!isRunning}
        onReset={onReset}
        disabled={!controlsEnabled}
      />

      <SimPanelSection title="控制模式" icon={Settings} aside={<SimLockedChip locked={!controlsEnabled} />}>
        <SimSegmented
          ariaLabel="控制模式"
          value={controlMode}
          disabled={!controlsEnabled || gainsLocked}
          onChange={onControlModeChange}
          options={(['manual', 'p', 'pd', 'pid'] as ControlMode[]).map((mode) => ({
            value: mode,
            label: mode,
            disabled: !allowedModes.includes(mode),
          }))}
        />
      </SimPanelSection>

      {controlMode === 'manual' ? (
        <SimPanelSection title="手操舵" icon={Navigation} aside={rudderLocked ? <SimLockedChip locked>舵角锁定</SimLockedChip> : null}>
          <SimField label="手操舵角" value={`${manualRudder.toFixed(0)}°`}>
            <div data-destroyer-rudder-slider>
              <Slider
                value={[manualRudder]}
                min={-nomotoParams.maxRudderDeg}
                max={nomotoParams.maxRudderDeg}
                step={1}
                disabled={!controlsEnabled || rudderLocked}
                onValueChange={([value]) => onManualRudderChange(value)}
                aria-label="手操舵角"
                className={simulationUi.slider}
              />
            </div>
          </SimField>
        </SimPanelSection>
      ) : null}

      {controlMode !== 'manual' && gainSliders.length > 0 ? (
        <SimPanelSection title="PID 增益" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {gainSliders.map((gain) => (
              <SimField key={gain.id} label={gain.label} value={pidGains[gain.id].toFixed(gain.digits)}>
                <Slider
                  value={[pidGains[gain.id]]}
                  min={gain.min}
                  max={gain.max}
                  step={gain.step}
                  disabled={!controlsEnabled || gainsLocked}
                  onValueChange={([v]) => onPidGainsChange({ ...pidGains, [gain.id]: v })}
                  aria-label={gain.label}
                  className={simulationUi.slider}
                />
              </SimField>
            ))}
          </div>
        </SimPanelSection>
      ) : null}
      {children}
    </SimPanelStack>
  );
}

// ============ 主组件 ============

export default function DestroyerSimulation({ ticket = '' }: { ticket?: string }) {
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
  const [experimentVersion, setExperimentVersion] = useState(VESSEL_COURSE_VERSION);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [derivativeFilterTauS, setDerivativeFilterTauS] = useState(0.2);
  const [integralTrackingEnabled, setIntegralTrackingEnabled] = useState(true);
  const [integralTrackingTimeS, setIntegralTrackingTimeS] = useState(1);
  const [variants, setVariants] = useState<Record<number, string>>({});
  const [runSummaries, setRunSummaries] = useState<VesselRunSummary[]>([]);
  const [studentModels, setStudentModels] = useState<FrozenVesselStudentModel[]>([]);
  const [modelComparisons, setModelComparisons] = useState<VesselModelComparison[]>([]);
  const [courseAttempts, setCourseAttempts] = useState<VesselLocalStepAttempt[]>([]);
  const [reportRunIds, setReportRunIds] = useState<string[]>([]);
  const reportClientRef = useRef('');
  const uploadScopeRef = useRef('');
  const evidenceUploadsRef = useRef<Promise<unknown>>(Promise.resolve());
  const [evidenceUploadMessage, setEvidenceUploadMessage] = useState('');
  const [courseReport, setCourseReport] = useState<VesselReportProgress | null>(null);
  const [selectedRound,setSelectedRound] = useState<{base:string;scope:string}|null>(null);
  const [roundDrafts,setRoundDrafts] = useState<VesselExperimentDraft[]>([]);
  const [courseReportHistory,setCourseReportHistory] = useState<Array<VesselReportProgress & {updatedAt:string}>>([]);
  const [plannedRunId, setPlannedRunId] = useState('');
  const [predictionModelId, setPredictionModelId] = useState('');
  const [predictionActuatorId, setPredictionActuatorId] = useState('');
  const [controllerSourceRunId, setControllerSourceRunId] = useState('');
  const [designStudentModelId, setDesignStudentModelId] = useState('');
  const [headingDesign, setHeadingDesign] = useState<{ modelId:string;values:StudentHeadingDesign } | null>(null);
  const nativeSessionRef = useRef<VesselSession | null>(null);
  const executionRef = useRef(false);
  const recorderRef = useRef<VesselRunRecorder | null>(null);
  const restoredRunRef = useRef<{ scopeKey: string; stepSequence: number; checkpoint: string | null } | null>(null);
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
  const latestSampleRef = useRef<DestroyerSample | null>(null);
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
  const [sessionCompleted, setSessionCompleted] = useState(false);
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

  const steps = useMemo(() => destroyerStepsForVersion(experimentVersion), [experimentVersion]);
  const step = steps[activeSeq - 1] ?? steps[0];
  const viewed = steps[viewSeq - 1] ?? step;
  const variantOptions = destroyerCourseVariants(step.seq);
  const variant = variants[step.seq] ?? variantOptions[0]?.value ?? '';
  const courseStep = useMemo(() => step.courseDefinition ? {
    ...step.courseDefinition, configuration: { ...step.courseDefinition.configuration,
      ...destroyerCourseVariants(step.seq).find((option) => option.value === variant)?.configuration },
  } : undefined, [step, variant]);
  const initialSpeed = courseStep?.configuration.initialWaterSpeedMps ?? REF_SPEED;
  const motion = useMemo(() => destroyerSceneMotion({ ...step, courseDefinition: courseStep }, initialSpeed), [step, courseStep, initialSpeed]);
  const scenarioLogic = useMemo<ScenarioLogic>(() => ({
    startPos: motion.start,
    getDesiredHeading: motion.desiredHeading,
  }), [motion]);
  const guidePath = useMemo(() => generateGuidePath(scenarioLogic, motion.duration,courseStep ? initialSpeed : undefined), [scenarioLogic, motion.duration,courseStep,initialSpeed]);
  const headingPoints = useMemo(() => {
    const points: HeadingPoint[] = [];
    const mark = 1;
    for (let time = 0; time <= motion.duration; time += mark) {
      points.push({ time, heading: normalizeSignedHeading(scenarioLogic.getDesiredHeading(time)) });
    }
    return points;
  }, [scenarioLogic, motion.duration]);
  const doneSeqs = useMemo(() => step.courseDefinition ? [...new Set(courseAttempts.filter((attempt) => !['invalid_run','model_mismatch'].includes(attempt.status)).map((attempt) => attempt.stepSequence))]
    : records.map((record) => record.seq), [step.courseDefinition, courseAttempts, records]);
  const viewedRecord = records.find((record) => record.seq === viewSeq);
  const currentRunId = recorderRef.current?.run.id ?? null;
  const displayBucket = Math.floor(hudState.time*2);
  const measuredSamples = useMemo<DestroyerSample[]>(() => {
    const run = recorderRef.current?.run;
    if (!run || run.id !== currentRunId) return [];
    return run.trace.filter((point,index) => index%10 === 0 && point.timeS <= displayBucket/2).map((point) => {
      const measurement = (key: string) => point.measurements[key]?.quality === 'Good' ? point.measurements[key].value ?? NaN : NaN;
      const north = measurement('North'),east = measurement('East');
      return { time:point.timeS,desiredHeading:point.command.headingDeg,actualHeading:measurement('Heading'),
        yawRate:measurement('YawRate'),rudder:measurement('SurfaceEncoder0'),manualRudder:point.command.surfaceDeg[0] ?? NaN,
        speed:measurement('SpeedLog'),crossTrackError:Number.isFinite(north) && Number.isFinite(east)
          ? getCrossTrackError(new THREE.Vector3(north,0,east),guidePath,true) : NaN };
    });
  }, [currentRunId,displayBucket,guidePath]);
  const shownSamples = courseStep ? measuredSamples : viewSeq === activeSeq ? samples : viewedRecord?.samples ?? [];
  const baseScopeKey = `${originId ? `ilab:${originId}` : session?.user?.id ? `account:${session.user.id}` : 'local'}:destroyer:${experimentVersion}`;
  const scopeKey = selectedRound?.base === baseScopeKey ? selectedRound.scope : baseScopeKey;
  uploadScopeRef.current = scopeKey;
  useEffect(() => {
    const stored = window.localStorage.getItem(`${baseScopeKey}:active-round`);
    setSelectedRound({base:baseScopeKey,scope:stored?.startsWith(`${baseScopeKey}:round:`) ? stored : baseScopeKey});
  }, [baseScopeKey]);
  useEffect(() => {
    if (!draftReady || !courseStep) return;
    void listExperimentDrafts(baseScopeKey).then(setRoundDrafts).catch(handleHistoryError);
    function handleHistoryError() { setMessage('暂时无法读取本机实验历史。'); }
  }, [baseScopeKey,scopeKey,draftReady,courseStep,courseAttempts]);
  const activeHeadingDesign = headingDesign?.modelId === designStudentModelId ? headingDesign.values : null;
  useEffect(() => {
    if (!runtimeReady || !designStudentModelId) return;
    const model = studentModels.find((item) => item.id === designStudentModelId);
    if (!model) return;
    try { setHeadingDesign({ modelId:model.id,values:designStudentHeadingController(model) }); }
    catch (error) { setHeadingDesign(null); setMessage(error instanceof Error ? error.message : '该模型暂时无法用于控制设计。'); }
  }, [runtimeReady,designStudentModelId,studentModels]);
  const handleArtifactsChange = useCallback((models: FrozenVesselStudentModel[], comparisons: VesselModelComparison[]) => {
    setStudentModels(models); setModelComparisons(comparisons);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void listRunEvidence(scopeKey).then((runs) => { if (!cancelled) setRunSummaries(runs); });
    return () => { cancelled = true; };
  }, [scopeKey]);

  const persistCurrentRun = useCallback(async (reason: 'student' | 'duration' | 'failure' | null = null, failure: string | null = null) => {
    const recorder = recorderRef.current;
    const physical = nativeSessionRef.current;
    if (!recorder || !physical || recorder.run.stoppedAtMs !== null) return;
    await recorder.save(physical, reason, failure);
    setRunSummaries(await listRunEvidence(recorder.run.scopeKey));
    if (sessionStatus === 'authenticated' && !originId && !ticket && reportClientRef.current) {
      const saved = await readRunEvidence(recorder.run.id);
      if (saved) {
        const reportRef = reportClientRef.current;
        evidenceUploadsRef.current = evidenceUploadsRef.current.catch(() => undefined).then(async () => {
          if (uploadScopeRef.current === saved.scopeKey) setEvidenceUploadMessage('正在上传原始运行记录…');
          await uploadVesselCourseRun(reportRef, saved);
          if (uploadScopeRef.current === saved.scopeKey) setEvidenceUploadMessage(saved.stoppedAtMs === null ? '已上传完整采样区间，当前恢复点保存在本机。' : '原始运行记录已上传，等待步骤提交与教师复核。');
        }).catch((error: unknown) => {
          if (uploadScopeRef.current === saved.scopeKey) setEvidenceUploadMessage(error instanceof Error ? error.message : '上传失败，本机记录已保留。');
        });
      }
    }
  }, [sessionStatus, originId, ticket]);

  const handleRuntimeFailure = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '运行记录保存失败，请重试。';
    setIsRunning(false);
    executionRef.current = false;
    nativeSessionRef.current?.setPaused(true);
    setMessage(message);
    void persistCurrentRun('failure', message).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : '运行记录保存失败，请重试。');
    });
  }, [persistCurrentRun]);

  const handleCourseFrame = useCallback((frame: VesselSessionFrame) => {
    const recorder = recorderRef.current;
    const physical = nativeSessionRef.current;
    if (!recorder || !physical) return;
    recorder.append(frame);
    void recorder.saveIfDue(physical)?.catch(handleRuntimeFailure);
  }, [handleRuntimeFailure]);

  const handleFinished = useCallback(() => {
    setIsRunning(false);
    executionRef.current = false;
    nativeSessionRef.current?.setPaused(true);
    setHudState((previous) => ({ ...previous, time: nativeSessionRef.current?.read().timeS ?? previous.time }));
    void persistCurrentRun('duration').catch(handleRuntimeFailure);
  }, [persistCurrentRun, handleRuntimeFailure]);

  async function startRun() {
    if (!runtimeReady || !sessionReady || !draftReady || busy) return;
    if (courseStep?.stepKind === 'analysis') return;
    if (!courseStep) { executionRef.current = true; setIsRunning(true); return; }
    const physical = nativeSessionRef.current;
    if (!physical) return;
    if (recorderRef.current?.run.stoppedAtMs !== null && recorderRef.current) {
      setMessage('本次运行已结束，请重置后开始新的运行。');
      return;
    }
    if (!recorderRef.current) {
      const prediction = readings.prediction?.trim();
      if (!prediction) { setMessage('请先填写运行前预测与理由。'); return; }
      if (step.seq >= 9) {
        if (!activeHeadingDesign) { setMessage('请先选择本人冻结的一阶船体模型，生成控制设计建议与可调范围。'); return; }
        if (pidGains.kp < activeHeadingDesign.kpMinimum || pidGains.kp > activeHeadingDesign.kpMaximum
          || (controlMode !== 'p' && (pidGains.kd < 0 || pidGains.kd > activeHeadingDesign.kdMaximum))
          || (controlMode === 'pid' && (pidGains.ki < 0 || pidGains.ki > pidGains.kp/30))) {
          setMessage('当前控制参数超出本步基于辨识模型的允许范围，请调整后运行。'); return;
        }
      }
      setBusy(true);
      try {
        const command = destroyerCourseCommands(courseStep, 0);
        const initial = advanceDestroyerCourseSession(physical, physical.read().input, {
          dtS: 0, targetHeadingDeg: command.headingDeg,
          controlMode: controlMode === 'manual' || controlMode === 'p' || controlMode === 'pd' ? controlMode : 'pid', pid: pidGains,
          manualRudderDeg: command.rudderDeg, derivativeFilterTauS,
          headingIntegralTracking: { enabled: integralTrackingEnabled, timeS: integralTrackingTimeS }, feedback: 'measurement',
        });
        if (step.seq === 10 && !modelComparisons.some((comparison) => comparison.runId === plannedRunId
          && comparison.purpose === 'forecast' && JSON.stringify(comparison.controllerInput) === JSON.stringify(initial.input))) {
          throw new Error('请先用当前控制参数冻结独立闭环预测，再开始物理侧运行。');
        }
        if ([18,19].includes(step.seq) && !runSummaries.some((run) => run.id === controllerSourceRunId
          && [16,17].includes(run.stepSequence) && run.lastTimeS >= 600
          && headingControllerSignature(run.finalInput ?? run.initialInput) === headingControllerSignature(initial.input))) {
          throw new Error('请先选择第16步或第17步保存的控制方案。');
        }
        const checkpoint = physical.snapshot();
        recorderRef.current = new VesselRunRecorder({ id: plannedRunId || crypto.randomUUID(), scopeKey, courseKey: 'destroyer',
          courseVersion: experimentVersion, stepSequence: step.seq, prediction, durationS: motion.duration,
          createdAtMs: Date.now(), lastTimeS: initial.timeS, stoppedAtMs: null,
          configuration: courseStep.configuration, initialInput: structuredClone(initial.input), controllerSourceRunId,designStudentModelId,
          parameterHash: initial.parameterHash, initialCheckpoint: checkpoint, checkpoint, trace: [], nativeSensorSamples: [], changes: [],
          runtimeVersion:physical.runtimeVersion,
          stopReason: null, failure: null });
        await recorderRef.current.save(physical);
      } catch (error) { handleRuntimeFailure(error); return; }
      finally { setBusy(false); }
    }
    setMessage('');
    physical.setPaused(false);
    executionRef.current = true;
    setIsRunning(true);
  }

  function pauseRun() {
    executionRef.current = false;
    nativeSessionRef.current?.setPaused(true);
    setIsRunning(false);
    void persistCurrentRun().catch(handleRuntimeFailure);
  }

  async function freezeModelPrediction() {
    if (!courseStep || !nativeSessionRef.current || isRunning || hudState.time > 0) return;
    try {
      const model = studentModels.find((item) => item.id === predictionModelId);
      const actuator = studentModels.find((item) => item.id === predictionActuatorId);
      if (!model || !actuator) throw new Error('请先在评估页签辨识并冻结本人的船体与舵机模型，再在此选择。');
      const commands = destroyerCourseCommands(courseStep, 0);
      const frame = advanceDestroyerCourseSession(nativeSessionRef.current, nativeSessionRef.current.read().input, {
        dtS: 0, targetHeadingDeg: commands.headingDeg,
        controlMode: controlMode === 'manual' || controlMode === 'p' || controlMode === 'pd' ? controlMode : 'pid',
        pid: pidGains, manualRudderDeg: commands.rudderDeg, derivativeFilterTauS,
        headingIntegralTracking: { enabled: integralTrackingEnabled, timeS: integralTrackingTimeS }, feedback: 'measurement',
      });
      const prediction = forecastDestroyerClosedLoop(scopeKey, plannedRunId, courseStep, frame.input, model, actuator);
      await saveModelComparison(prediction);
      setModelComparisons(await listModelComparisons(scopeKey));
      setMessage('独立闭环预测已冻结，可以开始物理侧运行。');
    } catch (error) { handleRuntimeFailure(error); }
  }

  const handleReset = useCallback(() => {
    executionRef.current = false;
    nativeSessionRef.current?.setPaused(true);
    void persistCurrentRun('student').catch(handleRuntimeFailure);
    recorderRef.current = null;
    restoredRunRef.current = null;
    setPlannedRunId(crypto.randomUUID());
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
      speedMps: initialSpeed,
      surgeMps: initialSpeed,
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
      speed: initialSpeed,
      position: { x: start.x, z: start.z },
      avgError: 0,
      currentError: 0,
      time: 0,
    });
  }, [scenarioLogic, initialSpeed, persistCurrentRun, handleRuntimeFailure]);

  useEffect(() => {
    if (restoredRunRef.current?.scopeKey === scopeKey && restoredRunRef.current.stepSequence === activeSeq) return;
    handleReset();
    setControlMode(step.defaultMode);
    setReadings({});
    stepStartedAt.current = Date.now();
  }, [activeSeq, handleReset, step.defaultMode, scopeKey]);

  useEffect(() => {
    if (!sessionReady || sessionStatus === 'loading') return;
    let cancelled = false;
    setDraftReady(false);
    void (async () => {
      const [draft, attempts, models, comparisons] = await Promise.all([readExperimentDraft(scopeKey),
        listLocalStepAttempts(scopeKey), listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
      if (cancelled) return;
      setCourseAttempts(attempts);
      setStudentModels(models); setModelComparisons(comparisons);
      reportClientRef.current = draft?.reportClientRef ?? crypto.randomUUID();
      if (experimentVersion !== VESSEL_COURSE_VERSION || !draft) return;
      const run = draft.activeRunId ? await readRunEvidence(draft.activeRunId) : undefined;
      if (cancelled) return;
      restoredRunRef.current = { scopeKey, stepSequence: draft.stepSequence, checkpoint: null };
      if (run && run.scopeKey === scopeKey && run.courseVersion === experimentVersion && run.stepSequence === draft.stepSequence) {
        recorderRef.current = new VesselRunRecorder(run, run.revision);
        restoredRunRef.current = { scopeKey, stepSequence: run.stepSequence, checkpoint: run.checkpoint };
      }
      setActiveSeq(draft.stepSequence); setViewSeq(draft.stepSequence);
      setReadings(draft.answers ?? { prediction: draft.prediction, interpretation: draft.explanation });
      setPlannedRunId(draft.plannedRunId ?? crypto.randomUUID());
      setReportRunIds(draft.reportRunIds ?? []);
      if (draft.controls) {
        setPidGains(draft.controls.pid); setControlMode(draft.controls.mode); setManualRudder(draft.controls.manualRudderDeg);
        setDerivativeFilterTauS(draft.controls.derivativeFilterTauS);
        setIntegralTrackingEnabled(draft.controls.integralTrackingEnabled); setIntegralTrackingTimeS(draft.controls.integralTrackingTimeS);
        setVariants(draft.controls.variants);
        setControllerSourceRunId(draft.controls.controllerSourceRunId ?? '');
        setDesignStudentModelId(draft.controls.designStudentModelId ?? '');
      }
      setResetToken((previous) => previous+1);
    })().catch(handleRuntimeFailure).finally(() => { if (!cancelled) setDraftReady(true); });
    return () => { cancelled = true; };
  }, [scopeKey, sessionReady, sessionStatus, experimentVersion, handleRuntimeFailure]);

  const activeRunId = recorderRef.current?.run.id ?? null;
  const saveDraft = useCallback(() => saveExperimentDraft({ scopeKey, stepSequence: activeSeq, activeRunId,
    prediction: readings.prediction ?? '', explanation: readings.interpretation ?? '', durationS: motion.duration,
    checkpoint: null, runConfiguration: courseStep?.configuration ?? null, completedSteps: doneSeqs, updatedAtMs: Date.now(), answers: readings,
    plannedRunId, reportRunIds, reportClientRef: reportClientRef.current,
    controls: { mode: controlMode === 'manual' || controlMode === 'p' || controlMode === 'pd' ? controlMode : 'pid', pid: pidGains,
      manualRudderDeg: manualRudder, derivativeFilterTauS, integralTrackingEnabled, integralTrackingTimeS, variants, controllerSourceRunId,designStudentModelId } }),
  [scopeKey, activeSeq, activeRunId, readings, motion.duration, courseStep, doneSeqs, controlMode, pidGains,
    manualRudder, derivativeFilterTauS, integralTrackingEnabled, integralTrackingTimeS, variants, plannedRunId, reportRunIds, controllerSourceRunId,designStudentModelId]);

  async function openCourseStep(sequence:number) {
    setMessage('');
    executionRef.current = false;
    nativeSessionRef.current?.setPaused(true);
    setIsRunning(false);
    await persistCurrentRun('student');
    if (!courseStep) { recorderRef.current = null;restoredRunRef.current = null;setViewSeq(sequence);setActiveSeq(sequence);return; }
    await saveDraft();
    const draft = await readStepExperimentDraft(scopeKey,sequence);
    const run = draft?.activeRunId ? await readRunEvidence(draft.activeRunId) : undefined;
    handleReset();
    recorderRef.current = run && run.scopeKey === scopeKey ? new VesselRunRecorder(run,run.revision) : null;
    restoredRunRef.current = {scopeKey,stepSequence:sequence,checkpoint:recorderRef.current?.run.checkpoint ?? null};
    setReadings(draft?.answers ?? courseAttempts.filter((attempt)=>attempt.stepSequence === sequence).at(-1)?.answers ?? {});
    setControlMode(draft?.controls?.mode ?? steps[sequence-1].defaultMode);
    if (draft?.controls) {
      setPidGains(draft.controls.pid);setManualRudder(draft.controls.manualRudderDeg);
      setDerivativeFilterTauS(draft.controls.derivativeFilterTauS);
      setIntegralTrackingEnabled(draft.controls.integralTrackingEnabled);setIntegralTrackingTimeS(draft.controls.integralTrackingTimeS);
      setVariants(draft.controls.variants);setControllerSourceRunId(draft.controls.controllerSourceRunId ?? '');
      setDesignStudentModelId(draft.controls.designStudentModelId ?? '');
    }
    setPlannedRunId(draft?.plannedRunId ?? crypto.randomUUID());
    setViewSeq(sequence);setActiveSeq(sequence);
  }

  async function selectCourseRound(nextScope:string) {
    setMessage('');
    executionRef.current = false;
    nativeSessionRef.current?.setPaused(true);
    setIsRunning(false);
    await persistCurrentRun('student');
    await saveDraft();
    recorderRef.current = null;restoredRunRef.current = null;
    setDraftReady(false);setCourseReport(null);setEvidenceUploadMessage('');setReadings({});
    window.localStorage.setItem(`${baseScopeKey}:active-round`,nextScope);
    uploadScopeRef.current = nextScope;
    setSelectedRound({base:baseScopeKey,scope:nextScope});
  }

  useEffect(() => {
    if (!draftReady || !courseStep) return;
    const timer = window.setTimeout(() => { void saveDraft().catch(handleRuntimeFailure); }, 250);
    const flush = () => { void persistCurrentRun().then(saveDraft).catch(handleRuntimeFailure); };
    window.addEventListener('pagehide', flush);
    return () => { window.clearTimeout(timer); window.removeEventListener('pagehide', flush); };
  }, [draftReady, courseStep, saveDraft, persistCurrentRun, handleRuntimeFailure]);

  useEffect(() => {
    if (!draftReady || !courseStep || sessionStatus !== 'authenticated' || originId || ticket) return;
    let cancelled = false;
    void fetch(`/api/ilab/experiment-reports?clientRef=${reportClientRef.current}`).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as {reports:VesselReportProgress[]};
      if (!cancelled) setCourseReport(result.reports[0] ?? null);
    }).catch(() => { if (!cancelled) setEvidenceUploadMessage('暂时无法读取教师复核状态，本机记录已保留。'); });
    return () => { cancelled = true; };
  }, [draftReady,courseStep,sessionStatus,originId,ticket]);

  useEffect(() => {
    if (!courseStep || sessionStatus !== 'authenticated' || originId || ticket) {setCourseReportHistory([]);return;}
    let cancelled = false;
    void fetch('/api/ilab/experiment-reports?courseKey=destroyer').then(async (response)=> {
      if (!response.ok) return;
      const body = await response.json() as {reports:Array<VesselReportProgress & {updatedAt:string}>};
      if (!cancelled) setCourseReportHistory(body.reports);
    }).catch(()=>{if (!cancelled) setEvidenceUploadMessage('暂时无法读取课程报告历史。');});
    return () => {cancelled = true;};
  }, [courseStep,sessionStatus,originId,ticket,reportRevision]);

  useEffect(() => {
    simRef.current.manualRudderDeg = manualRudder;
  }, [manualRudder, resetToken]);

  useEffect(() => {
    const storageKey = 'act-destroyer-origin';
    let cancelled = false;
    const openFromGrant = async () => {
      const response = await fetch('/api/ilab/destroyer/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ experimentVersion: VESSEL_COURSE_VERSION }),
      });
      if (!response.ok || cancelled) return;
      const body = await response.json() as {
        connected?: boolean;
        originId?: string;
        displayName?: string;
        status?: number;
        experimentVersion?: string;
      };
      if (cancelled || !body.connected || !body.originId) return;
      window.sessionStorage.setItem(storageKey, body.originId);
      setOriginId(body.originId);
      setExperimentVersion(body.experimentVersion ?? 'legacy-v1');
      setSessionCompleted(body.status === 1);
      setMessage(`已连接实验空间（学生 ${body.displayName ?? ''}），完成全部 20 步将自动回传。`);
    };

    void (async () => {
      if (ticket) {
        const response = await fetch('/api/ilab/destroyer/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ticket, experimentVersion: VESSEL_COURSE_VERSION }),
        });
        const body = await response.json() as {
          originId?: string;
          displayName?: string;
          status?: number;
          error?: string;
          experimentVersion?: string;
        };
        if (cancelled) return;
        window.history.replaceState(
          null,
          '',
          stripIlabUrlParams('/simulations/destroyer', window.location.search),
        );
        if (!response.ok || !body.originId) {
          setMessage(body.error || '票据校验失败，本次只在本机记录。');
          return;
        }
        clearIlabOriginSessionStorage();
        window.sessionStorage.setItem(storageKey, body.originId);
        setOriginId(body.originId);
        setExperimentVersion(body.experimentVersion ?? 'legacy-v1');
        setSessionCompleted(body.status === 1);
        setMessage(`已连接实验空间（学生 ${body.displayName ?? ''}），完成全部 20 步将自动回传。`);
        return;
      }
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) {
        await openFromGrant();
        return;
      }
      const response = await fetch(`/api/ilab/destroyer/session/${stored}`);
      if (response.status === 404 || response.status === 400) {
        window.sessionStorage.removeItem(storageKey);
        await openFromGrant();
        return;
      }
      if (!response.ok) {
        if (!cancelled) setMessage('暂时无法恢复这次实验，请稍后刷新。');
        return;
      }
      const body = await response.json() as {
        originId?: string;
        status?: number;
        currentSeq?: number;
        experimentVersion?: string;
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
      setExperimentVersion(body.experimentVersion ?? 'legacy-v1');
      setRecords(body.steps);
      setSessionCompleted(body.status === 1);
      const nextSeq = body.currentSeq && body.currentSeq > 0 ? body.currentSeq : 1;
      setActiveSeq(nextSeq);
      setViewSeq(nextSeq);
      setMessage(
        body.status === 1
          ? '本次实验已交卷，如需再次测试可点击“开启新一轮实验”。'
          : '已恢复这次实验已保存的步骤。',
      );
    })().catch(handleRuntimeFailure).finally(() => { if (!cancelled) setSessionReady(true); });
    return () => {
      cancelled = true;
    };
  }, [ticket, handleRuntimeFailure]);

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
    if (courseStep) {
      executionRef.current = false;
      nativeSessionRef.current?.setPaused(true);
      setIsRunning(false);
      setBusy(true);
      try {
        await persistCurrentRun('student');
        const [runs, models, comparisons] = await Promise.all([listRunEvidence(scopeKey), listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
        const usedRuns = step.seq === 20 ? runs.filter((run) => reportRunIds.includes(run.id)) : runs;
        const missingField = step.fields.find((field) => field.stage !== 'prediction' && !readings[field.key]?.trim());
        if (missingField) { setMessage(`请填写${missingField.label}。`); return; }
        const invalidNumber = step.fields.find((field) => field.kind === 'number' && !Number.isFinite(Number(readings[field.key])));
        if (invalidNumber) { setMessage(`请为${invalidNumber.label}填写有效数值。`); return; }
        let problem = validateDestroyerCourseEvidence(courseStep, { runs: usedRuns, models,
          comparisons:comparisons.map((comparison)=>({...comparison,actualSampleCount:comparison.actual.length})), answers: readings,
          designKp:(model) => designStudentHeadingController(model).kp });
        const referencedRunIds = new Set(step.seq === 20 ? reportRunIds : runs.filter((run) => run.stepSequence === step.seq).map((run) => run.id));
        if (courseStep.stepKind === 'analysis') for (const model of models) for (const window of model.payload.trainingRuns) referencedRunIds.add(window.runRef);
        const attempt: VesselLocalStepAttempt = { id: crypto.randomUUID(), scopeKey, stepSequence: step.seq,
          runIds: [...referencedRunIds], studentModelIds: models.map((model) => model.id), comparisonIds: comparisons.map((comparison) => comparison.id),
          answers: { ...readings }, createdAtMs: Date.now(),
          status: problem ? (courseStep.stepKind === 'run' && !runs.some((run) => run.stepSequence === step.seq && run.stopReason !== 'failure' && run.lastTimeS >= (courseStep.runDurationS ?? 0)) ? 'invalid_run' : 'model_mismatch') : 'pending-review',
          validationFeedback:problem, serverId: null };
        await saveLocalStepAttempt(attempt);
        const nextAttempts = await listLocalStepAttempts(scopeKey);
        setCourseAttempts(nextAttempts);
        if (sessionStatus === 'authenticated' && !originId && !ticket) {
          try {
            await evidenceUploadsRef.current;
            await uploadVesselCourseArtifacts(reportClientRef.current,'destroyer',scopeKey);
            const uploadedAttempts = await listLocalStepAttempts(scopeKey);
            setCourseAttempts(uploadedAttempts);
            const savedAttempt = uploadedAttempts.find((item)=>item.id === attempt.id);
            if (savedAttempt?.validationFeedback) problem = savedAttempt.validationFeedback;
            setEvidenceUploadMessage('运行、模型、对照及各次提交已上传。');
            if (step.seq === 20 && !problem) {
              const sections = Object.fromEntries(['problem','identification','validation','comparison','revision','conclusion'].map((key)=>[key,readings[key] ?? ''])) as unknown as VesselReportSections;
              const report = await saveVesselCourseReport(reportClientRef.current,'destroyer',sections,reportRunIds,'submit',courseReport?.revision);
              setCourseReport(report);
              setReportRevision((value)=>value+1);
            }
          } catch (error) { setEvidenceUploadMessage(error instanceof Error ? error.message : '上传失败，本机证据已保留。'); }
        }
        if (problem) { setMessage(`这次提交已保留。${problem}`); return; }
        setMessage('本步证据已保存在本机，各次尝试均已保留，上传后进入教师复核。');
        if (!doneSeqs.includes(step.seq) && step.seq < steps.length) {
          await persistCurrentRun('student');
          recorderRef.current = null;
          restoredRunRef.current = null;
          setActiveSeq(step.seq+1); setViewSeq(step.seq+1);
        }
      } catch (error) { handleRuntimeFailure(error); }
      finally { setBusy(false); }
      return;
    }
    const hasSketch = step.fields.some((field) => field.kind === 'sketch');
    const prepared = await applyLocalSketchVerdict(readings, hasSketch, Boolean(originId));
    if (!prepared.ok) {
      setMessage(prepared.message);
      return;
    }
    const storedSamples = thinDestroyerSamples(withLatestSample(samples, latestSampleRef.current));
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
          setSessionCompleted(true);
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
          setSessionCompleted(true);
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

  async function restartIlabSession() {
    if (busy) return;
    setBusy(true);
    try {
      if (courseStep && !originId && !ticket) {
        const clientRef = crypto.randomUUID();
        const nextScope = `${baseScopeKey}:round:${clientRef}`;
        await saveExperimentDraft({scopeKey:nextScope,stepSequence:1,activeRunId:null,prediction:'',explanation:'',
          durationS:60,checkpoint:null,runConfiguration:steps[0].courseDefinition?.configuration,
          completedSteps:[],updatedAtMs:Date.now(),reportClientRef:clientRef,answers:{},reportRunIds:[],plannedRunId:crypto.randomUUID()});
        await selectCourseRound(nextScope);
        setSessionCompleted(false);setRecords([]);setReportHtml('');setReportRunIds([]);
        setActiveSeq(1);setViewSeq(1);setVariants({});setControllerSourceRunId('');setDesignStudentModelId('');
        setMessage('新一轮实验已开启，原运行、模型和各次尝试保留在历史中。');
        return;
      }
      window.sessionStorage.removeItem('act-destroyer-origin');
      setOriginId('');
      setSessionCompleted(false);
      setRecords([]);
      setReadings({});
      setReportHtml('');
      setActiveSeq(1);
      setViewSeq(1);
      handleReset();
      const response = await fetch('/api/ilab/destroyer/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json() as {
        connected?: boolean;
        originId?: string;
        displayName?: string;
        status?: number;
        error?: string;
      };
      if (response.ok && body.connected && body.originId) {
        window.sessionStorage.setItem('act-destroyer-origin', body.originId);
        setOriginId(body.originId);
        setSessionCompleted(body.status === 1);
        setMessage(`已开启新一轮实验（学生 ${body.displayName ?? ''}），请从第 1 步开始。`);
        return;
      }
      setMessage(body.error || '已重置本机实验记录，请从第 1 步开始。');
    } finally {
      setBusy(false);
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

  async function openCourseReport(id:string) {
    const reportWindow = window.open('','destroyer-experiment-report','popup,width=960,height=720');
    try {
      const response = await fetch(`/api/ilab/experiment-reports/${id}`);
      const body = await response.json() as {reportHtml?:string;error?:string};
      if (!response.ok || !body.reportHtml) throw new Error(body.error ?? '这份报告尚未保存完整内容。');
      const url = URL.createObjectURL(new Blob([body.reportHtml],{type:'text/html;charset=utf-8'}));
      if (reportWindow) reportWindow.location.href = url;
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch (error) {reportWindow?.close();setMessage(error instanceof Error ? error.message : '暂时无法打开报告。');}
  }

  async function retryCourseUpload() {
    setBusy(true);
    try {
      await evidenceUploadsRef.current;
      await uploadVesselCourseArtifacts(reportClientRef.current,'destroyer',scopeKey);
      setCourseAttempts(await listLocalStepAttempts(scopeKey));
      if (step.seq === 20 && (!courseReport || ['draft','revision-requested'].includes(courseReport.status))) {
        const sections = Object.fromEntries(['problem','identification','validation','comparison','revision','conclusion']
          .map((key)=>[key,readings[key] ?? ''])) as unknown as VesselReportSections;
        setCourseReport(await saveVesselCourseReport(reportClientRef.current,'destroyer',sections,reportRunIds,'save',courseReport?.revision));
      }
      setReportRevision((value)=>value+1);
      setEvidenceUploadMessage('本轮原始运行、模型、对照与提交尝试已同步。');
    } catch (error) {setEvidenceUploadMessage(error instanceof Error ? error.message : '同步失败，本机记录已保留。');}
    finally {setBusy(false);}
  }

  async function openReport() {
    if (courseStep) {
      if (courseReport && ['submitted','pending-review','reviewed','finalized'].includes(courseReport.status)) {
        await openCourseReport(courseReport.id);
        return;
      }
      const reportWindow = window.open('','destroyer-experiment-report','popup,width=960,height=720');
      try {
        const selected = runSummaries.filter((run)=>reportRunIds.includes(run.id));
        const runs:VesselReportEvidence['runs'] = [];
        for (const summary of selected) {
          const run = await readRunEvidence(summary.id);
          if (!run || run.stoppedAtMs === null) continue;
          const checkpoint = JSON.parse(run.checkpoint) as {course_evidence?:{metrics:NonNullable<VesselSessionFrame['fineStepMetrics']>['values']}};
          const values = checkpoint.course_evidence?.metrics;
          const metrics = computeVirtualSimulationStep<Record<string,number|null>>(vesselRunMetricsRequest(run.trace,run.lastTimeS,run.configuration.initialHeadingDeg ?? 0));
          if (values) metrics.positiveMotorWorkJ = values.positiveMotorWorkJ;
          runs.push({id:run.id,stepSequence:run.stepSequence,timeS:run.lastTimeS,status:run.stopReason === 'failure' ? 'failed' : 'completed',
            configuration:run.configuration,input:summary.finalInput ?? run.initialInput,metrics,
            fineStepMetrics:values ? {sampleCadenceS:1/120,algorithm:'post_physics_step_v1',rollWarningDeg:run.configuration.courseEvidence?.rollWarningDeg ?? 8,
              eventWindowBeforeS:1,eventWindowAfterS:1,values} : undefined});
        }
        const html = buildVesselCourseReportHtml(DESTROYER_EXPERIMENT_TITLE,readings,{runs,
          models:studentModels.map((model)=>({label:model.label,payload:model.payload,frozenAtMs:model.createdAtMs})),
          comparisons:modelComparisons.filter((comparison)=>reportRunIds.includes(comparison.runId))});
        const url = URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
        if (reportWindow) reportWindow.location.href = url;
        window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      } catch (error) { reportWindow?.close();setMessage(error instanceof Error ? error.message : '报告暂时无法生成，本机证据已保留。'); }
      return;
    }
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
    <div className={simulationUi.root} data-sim-ui data-course-version={experimentVersion}>
      <SceneQualityAttributes />
      <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
        <PerspectiveCamera makeDefault position={[0, 200, 500]} fov={60} near={1} far={50000} />
        <MarineFrameRuntime simRef={simRef} simTimeRef={simTimeRef} resetToken={resetToken} physicalPose={Boolean(step.courseDefinition)}>
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
          latestSampleRef={latestSampleRef}
          courseStep={courseStep}
          derivativeFilterTauS={derivativeFilterTauS}
          headingIntegralTracking={{ enabled: integralTrackingEnabled, timeS: integralTrackingTimeS }}
          nativeSessionRef={nativeSessionRef}
          onCourseFrame={handleCourseFrame}
          onRuntimeReady={setRuntimeReady}
          onRuntimeFailure={handleRuntimeFailure}
          onFinished={handleFinished}
          restoreCheckpoint={restoredRunRef.current?.scopeKey === scopeKey ? restoredRunRef.current.checkpoint : null}
          executionRef={executionRef}
          restoredTrace={restoredRunRef.current?.checkpoint ? recorderRef.current?.run.trace ?? null : null}
        />
        <ScenePostEffects />
        </MarineFrameRuntime>
      </MarineCanvas>

      <SimulationMissionTracker
          seq={activeSeq}
          total={steps.length}
          title={step.title}
          doneSeqs={doneSeqs}
          earnedPoints={courseStep ? null : records.reduce((sum, record) => sum + record.earnedPoints, 0)}
          maxPoints={steps.reduce((sum, item) => sum + item.maxPoints, 0)}
      />
      <SimulationDock
        side="left"
        title="实验状态"
        fitContent
        defaultTab="status"
        tabs={[
          {
            id: 'steps',
            label: '实验步骤',
            content: (
              <DestroyerStepList
                steps={steps}
                activeSeq={activeSeq}
                viewSeq={viewSeq}
                doneSeqs={doneSeqs}
                onOpen={(seq) => {
                  void openCourseStep(seq).catch(handleRuntimeFailure);
                }}
              />
            ),
          },
          {
            id: 'status',
            label: '状态',
            content: (
              <DestroyerStatusPanel
                courseMeasurements={courseStep ? recorderRef.current?.run.trace.at(-1)?.measurements ?? {} : undefined}
                heading={signedHeading(hudState.heading)}
                yawRate={hudState.yawRate}
                rudder={hudState.rudder}
                manualRudder={courseStep ? scriptedManualRudder(step,hudState.time) ?? manualRudder : manualRudder}
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
                seq={step.seq}
                title={step.title}
                goal={step.goal}
                watch={step.watch}
                hint={step.suggestion}
                hintAttribute="data-destroyer-suggestion"
                prediction={courseStep?.stepKind === 'run' ? (
                  <label className="block space-y-1 text-xs text-platform-fg-secondary">
                    <span>运行前预测与理由</span>
                    <textarea className="sim-hud-input" rows={3} aria-label="运行前预测与理由"
                      value={readings.prediction ?? ''} disabled={isRunning || hudState.time > 0}
                      onChange={(event) => setReadings((previous) => ({ ...previous, prediction: event.target.value }))} />
                  </label>
                ) : undefined}
                controls={courseStep?.stepKind === 'analysis' ? (
                  <p className="text-xs leading-5 text-platform-fg-secondary">请在评估页签选择已保存的量测，完成模型辨识、特征分析或报告证据整理。</p>
                ) : (
                  <div className="space-y-3"><ControlPanel
                    isRunning={isRunning}
                    controlMode={controlMode}
                    pidGains={pidGains}
                    allowedModes={step.modes}
                    allowedGains={step.gains}
                    controlsEnabled={step.scene !== 'review' && runtimeReady && sessionReady && draftReady && sessionStatus !== 'loading' && !busy}
                    rudderLocked={scriptedManualRudder(step, 0) !== null}
                    manualRudder={courseStep ? scriptedManualRudder(step,hudState.time) ?? manualRudder : manualRudder}
                    onStart={() => { void startRun(); }}
                    onPause={pauseRun}
                    onReset={handleReset}
                    onControlModeChange={setControlMode}
                    onPidGainsChange={(gains) => setPidGains(courseStep ? { ...gains,ki:Math.min(gains.ki,gains.kp/30) } : gains)}
                    onManualRudderChange={setManualRudder}
                    gainsLocked={Boolean(courseStep && [18,19].includes(step.seq))}
                    gainBounds={courseStep && activeHeadingDesign ? {
                      kp:{ min:activeHeadingDesign.kpMinimum,max:activeHeadingDesign.kpMaximum,step:.001,digits:3 },
                      ki:{ min:0,max:pidGains.kp/30,step:.0001,digits:4 },
                      kd:{ min:0,max:activeHeadingDesign.kdMaximum,step:.01,digits:2 },
                    } : undefined}
                  >
                    {courseStep && step.seq >= 9 && step.seq < 18 ? <SimPanelSection title="基于本人模型的控制设计">
                      <select className="sim-hud-input" aria-label="用于控制设计的一阶船体模型" value={designStudentModelId}
                        disabled={isRunning || hudState.time > 0} onChange={(event) => setDesignStudentModelId(event.target.value)}>
                        <option value="">选择8 m/s工况的本人一阶模型</option>{studentModels.filter((model) => model.channel === 'rudder-to-yaw'
                          && model.payload.structure.kind === 'nomoto1' && Number(model.payload.operatingPoint.speedMps) === 8)
                          .map((model,index) => <option key={model.id} value={model.id}>{model.label} · 版本{index+1}</option>)}
                      </select>
                      {activeHeadingDesign ? <div className="mt-2 space-y-2 text-xs text-platform-fg-secondary">
                        <p>ζ = {activeHeadingDesign.dampingRatio}，ωₙ = {activeHeadingDesign.naturalFrequencyRadS.toFixed(4)} rad/s</p>
                        <p>建议Kp = {activeHeadingDesign.kp.toFixed(3)}，Kd = {activeHeadingDesign.kd.toFixed(2)}。Kp可调为建议值的0.2–3倍，Ki上限为Kp/30。</p>
                        <button type="button" className={simulationUi.buttonOutline} disabled={isRunning || hudState.time > 0}
                          onClick={() => setPidGains({ kp:activeHeadingDesign.kp,ki:controlMode === 'pid' ? activeHeadingDesign.ki : 0,
                            kd:controlMode === 'pd' || controlMode === 'pid' ? activeHeadingDesign.kd : 0 })}>应用建议初值</button>
                        {step.seq === 9 ? <SimSegmented ariaLabel="比例增益相对建议值" value={String(pidGains.kp/activeHeadingDesign.kp)}
                          onChange={(value) => setPidGains({ kp:activeHeadingDesign.kp*Number(value),ki:0,kd:0 })}
                          disabled={isRunning || hudState.time > 0}
                          options={[{ value:'0.5',label:'0.5倍' },{ value:'1',label:'1倍' },{ value:'2',label:'2倍' }]} /> : null}
                      </div> : null}
                    </SimPanelSection> : null}
                    {courseStep && [18,19].includes(step.seq) ? <SimField label="已冻结的本人控制方案">
                      <select className="sim-hud-input" aria-label="已冻结的本人控制方案" value={controllerSourceRunId} disabled={isRunning || hudState.time > 0}
                        onChange={(event) => {
                          const source = runSummaries.find((run) => run.id === event.target.value);
                          if (!source) return;
                          const savedInput = source.finalInput ?? source.initialInput;
                          setControllerSourceRunId(source.id); setPidGains(savedInput.pid);
                          setDesignStudentModelId(source.designStudentModelId ?? '');
                          setControlMode(savedInput.controlMode);
                          setDerivativeFilterTauS(savedInput.derivativeFilterTauS ?? .2);
                          setIntegralTrackingEnabled(savedInput.headingIntegralTracking?.enabled ?? true);
                          setIntegralTrackingTimeS(savedInput.headingIntegralTracking?.timeS ?? 1);
                        }}>
                        <option value="">选择第16或17步方案</option>
                        {runSummaries.filter((run) => [16,17].includes(run.stepSequence) && run.lastTimeS >= 600 && run.stopReason !== 'failure')
                          .map((run) => <option key={run.id} value={run.id}>第{run.stepSequence}步 · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>)}
                      </select>
                    </SimField> : null}
                    {courseStep && variantOptions.length ? <SimField label="本次运行条件">
                      <select className="sim-hud-input" aria-label="本次运行条件" value={variant} disabled={isRunning || busy}
                        onChange={(event) => {
                          const selected = event.target.value;
                          if (selected === variant) return;
                          void persistCurrentRun('student').then(() => {
                            recorderRef.current = null;
                            restoredRunRef.current = null;
                            setVariants((previous) => ({ ...previous, [step.seq]: selected }));
                          }).catch(handleRuntimeFailure);
                        }}>
                        {variantOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </SimField> : null}
                    {courseStep && step.seq >= 15 ? <SimField label="微分滤波时间常数" value="s">
                      <select className="sim-hud-input" aria-label="微分滤波时间常数" value={derivativeFilterTauS} disabled={[18,19].includes(step.seq)}
                        onChange={(event) => setDerivativeFilterTauS(Number(event.target.value))}>
                        {[0,0.2,1,3].map((value) => <option key={value} value={value}>{value === 0 ? '原始微分' : `${value} s`}</option>)}
                      </select>
                    </SimField> : null}
                    {courseStep && step.seq === 12 ? <SimPanelSection title="积分抗饱和">
                      <SimSegmented ariaLabel="积分抗饱和" value={integralTrackingEnabled ? 'on' : 'off'}
                        onChange={(value) => setIntegralTrackingEnabled(value === 'on')}
                        options={[{ value: 'off', label: '关闭' }, { value: 'on', label: '开启' }]} />
                      <SimField label="积分回算时间" value="s"><input type="number" className="sim-hud-input" aria-label="积分回算时间"
                        min={0.05} max={100} step={0.05} value={integralTrackingTimeS}
                        onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= .05 && value <= 100) setIntegralTrackingTimeS(value); }} /></SimField>
                    </SimPanelSection> : null}
                  </ControlPanel>
                  {courseStep && step.seq === 10 ? <SimPanelSection title="运行前的独立闭环预测">
                    <div className="space-y-2">
                      <select className="sim-hud-input" aria-label="预测采用的本人船体模型" value={predictionModelId} disabled={isRunning || hudState.time > 0} onChange={(event) => setPredictionModelId(event.target.value)}>
                        <option value="">选择本人船体模型</option>{studentModels.filter((model) => model.channel === 'rudder-to-yaw')
                          .map((model,index) => <option key={model.id} value={model.id}>{model.label} · 版本{index+1}</option>)}
                      </select>
                      <select className="sim-hud-input" aria-label="预测采用的本人舵机模型" value={predictionActuatorId} disabled={isRunning || hudState.time > 0} onChange={(event) => setPredictionActuatorId(event.target.value)}>
                        <option value="">选择本人舵机模型</option>{studentModels.filter((model) => model.channel === 'rudder-servo')
                          .map((model,index) => <option key={model.id} value={model.id}>{model.label} · 版本{index+1}</option>)}
                      </select>
                      <button type="button" className={simulationUi.buttonOutline} disabled={isRunning || hudState.time > 0} onClick={() => { void freezeModelPrediction(); }}>冻结独立闭环预测</button>
                      {modelComparisons.filter((comparison) => comparison.runId === plannedRunId && comparison.purpose === 'forecast').at(-1)
                        ? <ModelComparisonCurve comparison={modelComparisons.filter((comparison) => comparison.runId === plannedRunId && comparison.purpose === 'forecast').at(-1)!} /> : null}
                    </div>
                  </SimPanelSection> : null}
                  </div>
                )}
                submission={(
                  <div className="space-y-3">
                  {courseStep && step.seq === 2 && recorderRef.current?.run.trace.length ? <SimPanelSection title="量测窗口与两点依据">
                    <MeasurementWindow run={recorderRef.current.run} startS={Number(readings.measurementWindowStartS || 20)}
                      endS={Number(readings.measurementWindowEndS || 23)} onSelect={({start,end})=>setReadings((previous)=>({...previous,
                        measurementWindowStartS:start.timeS.toFixed(2),measurementWindowEndS:end.timeS.toFixed(2),
                        measurementPoint1:`${start.timeS.toFixed(2)} s，${start.value?.toFixed(4) ?? '缺测'}°`,
                        measurementPoint2:`${end.timeS.toFixed(2)} s，${end.value?.toFixed(4) ?? '缺测'}°`}))} />
                  </SimPanelSection> : null}
                  {courseStep && step.seq === 20 ? <SimPanelSection title="报告引用的本人运行">
                    {runSummaries.filter((run) => run.stoppedAtMs !== null && run.sampleCount > 0)
                      .map((run) => <label key={run.id} className="flex items-center gap-2 py-1 text-xs text-platform-fg-secondary">
                        <input type="checkbox" checked={reportRunIds.includes(run.id)} onChange={(event) => setReportRunIds((previous) => event.target.checked ? [...previous,run.id] : previous.filter((id) => id !== run.id))} />
                        第{run.stepSequence}步 · {run.durationS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
                      </label>)}
                  </SimPanelSection> : null}
                  <DestroyerStepForm
                    step={step}
                    readings={readings}
                    message={message}
                    busy={busy || Boolean(courseStep && courseReport && !['draft','revision-requested'].includes(courseReport.status))}
                    reportEnabled={courseStep ? reportRunIds.length > 0 && !isRunning : records.some((record) => record.seq === DESTROYER_EXPERIMENT_STEPS.length) || Boolean(reportHtml)}
                    showRestart={sessionCompleted || Boolean(courseStep && draftReady && courseAttempts.length)}
                    onChange={(key, value) => setReadings((prev) => ({ ...prev, [key]: value }))}
                    onSubmit={() => { void submitStep(); }}
                    onReport={() => { void openReport(); }}
                    onAsk={() => ai?.openSidebar()}
                    onRestart={() => { void restartIlabSession(); }}
                  />
                  {courseStep && evidenceUploadMessage ? <p role="status" className="text-xs text-platform-fg-secondary">{evidenceUploadMessage}</p> : null}
                  {courseStep && sessionStatus === 'authenticated' && !originId && !ticket ? <button type="button"
                    className={simulationUi.buttonOutline} disabled={busy || isRunning || !draftReady}
                    onClick={()=>{void retryCourseUpload();}}>同步本轮实验记录</button> : null}
                  {courseStep && courseReport ? <div className="space-y-1 text-xs text-platform-fg-secondary" role="status">
                    <p>{VESSEL_REPORT_STATUSES[courseReport.status as keyof typeof VESSEL_REPORT_STATUSES] ?? '正在读取复核状态'}{courseReport.score !== null ? ` · ${courseReport.score}/${courseReport.maxScore}分` : ' · 综合评价待教师确认'}</p>
                    {courseReport.reviewProgress && !courseReport.reviewProgress.complete ? <p>已评部分 {courseReport.reviewProgress.earned}分，余项待教师复核。</p> : null}
                    {courseReport.teacherFeedback ? <p className="whitespace-pre-wrap">{courseReport.teacherFeedback}</p> : null}
                    <button type="button" className={simulationUi.buttonOutline} onClick={() => {
                      void fetch(`/api/ilab/experiment-reports?clientRef=${reportClientRef.current}`).then(async (response) => {
                        if (!response.ok) throw new Error('暂时无法读取复核状态。');
                        const result = await response.json() as {reports:VesselReportProgress[]};
                        setCourseReport(result.reports[0] ?? null);
                      }).catch((error:unknown)=>setEvidenceUploadMessage(error instanceof Error ? error.message : '暂时无法读取复核状态。'));
                    }}>更新教师复核状态</button>
                  </div> : null}
                  </div>
                )}
              />
            ),
          },
          {
            id: 'evaluate',
            label: '评估',
            content: (
              <div className="w-full min-w-0 space-y-4">
                {courseStep ? <VesselModelWorkbench scopeKey={scopeKey} runs={runSummaries} onArtifactsChange={handleArtifactsChange} /> : null}
                {courseStep ? <SimPanelSection title="信号来源对照"><VesselSignalCurve trace={recorderRef.current?.run.trace ?? []}
                  postRun={recorderRef.current?.run.stoppedAtMs != null}
                  comparison={modelComparisons.filter((comparison) => comparison.runId === recorderRef.current?.run.id).at(-1)} /></SimPanelSection> : null}
                {courseStep ? <SimPanelSection title="本机实验历史">
                  <div className="space-y-2">{roundDrafts.map((draft)=><button type="button" key={draft.scopeKey}
                    disabled={draft.scopeKey === scopeKey || busy} className={simulationUi.buttonOutline}
                    onClick={()=>{void selectCourseRound(draft.scopeKey).catch(handleRuntimeFailure);}}>
                    {draft.scopeKey === scopeKey ? '当前实验' : '继续此轮实验'} · 第{draft.stepSequence}步 · {new Date(draft.updatedAtMs).toLocaleString('zh-CN')}
                  </button>)}</div>
                </SimPanelSection> : null}
                {courseStep && courseReportHistory.length ? <SimPanelSection title="已保存的课程报告">
                  <div className="space-y-2">{courseReportHistory.map((report)=><button type="button" key={report.id} className={simulationUi.buttonOutline}
                    disabled={!report.hasReportHtml}
                    onClick={()=>{void openCourseReport(report.id);}}>
                    {new Date(report.updatedAt).toLocaleString('zh-CN')} · {VESSEL_REPORT_STATUSES[report.status as keyof typeof VESSEL_REPORT_STATUSES] ?? '待复核'}
                    {report.score !== null ? ` · ${report.score}/100分` : ''}
                    {!report.hasReportHtml ? ' · 报告正文尚未整理' : ''}
                  </button>)}</div>
                </SimPanelSection> : null}
                <DestroyerReportHistory
                  signedIn={sessionStatus === 'authenticated'}
                  reports={pastReports ?? []}
                  onOpen={(id) => { void openStoredReport(id); }}
                />
                <SimulationAssessmentPanel
                  title="机动任务评估"
                  pendingReview={Boolean(courseStep)}
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
