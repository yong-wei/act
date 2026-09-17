'use client';

/**
 * 055型驱逐舰航向控制仿真
 * 模块化重构版本 - 使用统一物理引擎和控制器
 */

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, useGLTF, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { SimulationClock } from '@/lib/simulation';
import {
  advanceAttainment,
  createAttainmentState,
  type AttainmentState,
} from '../lib/heading-attainment';
import { resolveRegisteredSimulationModel, resolveVersionedDefault } from '@/lib/browser-delivery/client';
import { FallbackGltfModel } from '@/resources/simulations/components/fallback-gltf-model';
import { HeroModelBasis } from '@/resources/simulations/components/hero-model-basis';
import { VersionedShipModel } from '@/resources/simulations/components/versioned-ship-model';
import { cloneSkinnedScene, skinnedBindingsIntact } from '@/resources/simulations/model-packages/clone-skinned-scene';
import {
  TYPE055_V2_BASIS_YAW_RAD,
  isType055VersionedAssetUrl,
  matchActivatedType055Package,
  matchType055DescriptorByUrl,
  propulsorSceneAnchors,
  type VersionedModelPackageDescriptor,
} from '@/resources/simulations/model-packages/type055-nanchang-101-v2';
import { SemanticBindingsRig } from '@/resources/simulations/components/semantic-bindings-rig';
import { boxProjectsInsideNdc } from '@/resources/simulations/scene/camera';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  ChevronLeft,
  ChevronRight,
  Target,
  Compass,
  Gauge,
  Timer,
  Video,
  Orbit,
  ArrowDownFromLine,
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

import { destroyer055Profile } from '../profiles/destroyer-055';
import { destroyer055SceneVisual } from '../profiles/destroyer-055-scene';
import {
  createNearFieldSurfaceQuery,
  DEFAULT_GERSTNER_SEA_STATE,
  gerstnerAmplitudeScale,
  GerstnerWater,
  MARINE_BASE_INTERACTION_MESH_SPEC,
  MARINE_BASE_INTERACTION_WAVES,
  sampleVisibleWaterHeight,
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
import { WakeTrail } from '../scene/wake';
import {
  EnvironmentScene,
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
import { SimulationTopBar, SimulationDock, SimulationAssessmentPanel, simulationUi } from '../components/simulation-ui';
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

Chart.register(...registerables);

export type { AttainmentState };
export { advanceAttainment, createAttainmentState };

// ============ 类型定义 ============

type TaskScenario = 'turn90' | 'obstacle' | 'circle';

interface TaskDef {
  id: string;
  title: string;
  scenario: TaskScenario;
  duration: number;
  description: string;
}

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

interface ChartData {
  time: number[];
  desiredHeading: number[];
  actualHeading: number[];
  speed: number[];
  rudder: number[];
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

const tasks: TaskDef[] = [
  {
    id: 'turn-90',
    title: '直角转向任务',
    scenario: 'turn90',
    duration: 180,
    description: '60秒后执行90度右转阶跃信号。',
  },
  {
    id: 'obstacle',
    title: '复杂避障任务',
    scenario: 'obstacle',
    duration: 180,
    description: '依次执行 0° → 45° → 0° → -45° → 0° 变向。',
  },
  {
    id: 'circle',
    title: '定常回转任务',
    scenario: 'circle',
    duration: 360,
    description: '切入圆形航迹并执行定常回转。',
  },
];


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

const getScenarioLogic = (scenario: TaskScenario): ScenarioLogic => {
  switch (scenario) {
    case 'turn90':
      return {
        startPos: { x: -6000, z: 0, headingDeg: 0 },
        getDesiredHeading: (t: number) => (t < 60 ? 0 : 90),
      };
    case 'obstacle':
      return {
        startPos: { x: -2000, z: 0, headingDeg: 0 },
        getDesiredHeading: (t: number) => {
          if (t < 60) return 0;
          if (t < 90) return 45;
          if (t < 120) return 0;
          if (t < 150) return -45;
          return 0;
        },
      };
    case 'circle':
      const radius = 1350;
      const circumference = 2 * Math.PI * radius;
      const turnTime = circumference / REF_SPEED;
      const degPerSec = 360 / turnTime;
      return {
        startPos: { x: 0, z: -(radius + 900), headingDeg: 0 },
        getDesiredHeading: (t: number) => (t < 60 ? 0 : -90 + degPerSec * (t - 60)),
      };
  }
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
      waterSampler: (worldX, worldZ, timeSeconds) =>
        // 基础交互波场（档位无关）：画质只裁剪渲染细节，不改变姿态采样基准（#2097）。
        sampleVisibleWaterHeight(
          MARINE_BASE_INTERACTION_WAVES,
          gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE),
          MARINE_BASE_INTERACTION_MESH_SPEC,
          simRef.current.position.x,
          simRef.current.position.z,
          worldX,
          worldZ,
          timeSeconds,
        ),
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
function PresetWater({ simRef }: { simRef: React.MutableRefObject<SimulationState> }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <GerstnerWater
      tier={params.waterTier}
      positionSampler={() => ({ x: simRef.current.position.x, z: simRef.current.position.z })}
      waterColor={water.waterColor}
      deepColor={water.deepColor}
      horizonColor={water.horizonColor}
      foamColor={simulationScenePalette.waterFoam}
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
        <Line key={i} points={points} color={sceneTheme.gridCellColor} lineWidth={1.0} transparent opacity={sceneTheme.gridOpacity} />
      ))}
    </group>
  );
}

function GuideRoute({ points }: { points: THREE.Vector3[] }) {
  if (!points || points.length < 2) return null;
  return <Line points={points} color={simulationScenePalette.danger} lineWidth={3} dashed={false} />;
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

/** 双桨逐帧发射锚点共享 ref：模型侧每帧写入桨节点世界位置，尾迹侧读取。 */
type PropWakeAnchorsRef = React.MutableRefObject<{
  port: THREE.Vector3 | null;
  starboard: THREE.Vector3 | null;
}>;

/** 尾迹粒子场桥接：逐帧喂入船位/航向与 Gerstner 波面高度（采样点=船位=海面跟随中心）。 */
function WakeTrailRig({
  simRef,
  playing,
  resetToken,
  propWakeRef,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  playing: boolean;
  resetToken: number;
  propWakeRef: PropWakeAnchorsRef;
}) {
  const { wakeVisible } = useSceneEnvironment();
  const transformRef = useRef({ position: [0, 0, 0] as [number, number, number], heading: 0 });
  const timeRef = useRef(0);
  const { tier, params } = useSceneQuality();

  // 版本化包声明推进器时逐桨一条航迹；无声明（旧链/回退）保持 profile 单航迹。
  const descriptor = matchActivatedType055Package(resolveVersionedDefault('destroyer'));
  const propulsorAnchors = descriptor
    ? propulsorSceneAnchors(descriptor, destroyer055SceneVisual.shipLengthMeters)
    : [];

  useFrame((state) => {
    const sim = simRef.current;
    transformRef.current.position = [sim.position.x, sim.position.y, sim.position.z];
    transformRef.current.heading = platformHeadingToSceneRad(toDegrees(sim.headingRad));
    timeRef.current = state.clock.getElapsedTime();
  });

  if (!wakeVisible) return null;
  // 与可见水面同一坐标基准、同一细分曲面：水面网格跟随舰位，世界坐标须先减原点，
  // 再按位移后三角网格重心插值采样。
  // 尾迹贴水（#2098）：近场可见曲面（带限波组 + 包络，档位无关），与 GPU 近场网格同参数。
  const waterYSampler = (x?: number, z?: number) => {
    const query = createNearFieldSurfaceQuery(
      gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE),
      simRef.current.position.x,
      simRef.current.position.z,
      timeRef.current,
    );
    return query.heightAt(x ?? simRef.current.position.x, z ?? simRef.current.position.z);
  };

  if (propulsorAnchors.length > 0) {
    return (
      <>
        {propulsorAnchors.map(({ id, anchor }) => (
          <WakeTrail
            key={`${resetToken}-${id}`}
            profile={{
              ...destroyer055SceneVisual,
              wakeAnchors: {
                stern: anchor,
                portShoulder: [anchor[0] + 6, 0, anchor[2] + 30],
                starboardShoulder: [anchor[0] - 6, 0, anchor[2] + 30],
              },
            }}
            shipTransform={transformRef.current}
            qualityTier={tier}
            playing={playing}
            waterYSampler={waterYSampler}
            worldSpeedSampler={() => (simRef.current.advancing ? simRef.current.speedMps : 0)}
            emitterWorldSampler={() => {
              const world = id === 'prop-port' ? propWakeRef.current.port : propWakeRef.current.starboard;
              return world ? [world.x, world.y, world.z] : null;
            }}
          />
        ))}
      </>
    );
  }

  return (
    <WakeTrail
      key={resetToken}
      profile={destroyer055SceneVisual}
      shipTransform={transformRef.current}
      qualityTier={tier}
      playing={playing}
      waterYSampler={waterYSampler}
      worldSpeedSampler={() => (simRef.current.advancing ? simRef.current.speedMps : 0)}
    />
  );
}

declare global {
  interface Window {
    __destroyerModelVisual?: {
      url: string;
      boxInView: boolean;
      skinnedIntact: boolean;
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
  propWakeRef,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  resetToken: number;
  propWakeRef: PropWakeAnchorsRef;
}) {
  const { tier } = useSceneQuality();
  const descriptor = matchActivatedType055Package(resolveVersionedDefault('destroyer'));

  if (!descriptor) {
    return (
      <FallbackGltfModel
        candidates={MODEL.candidates}
        render={(url) => <DestroyerModelScene url={url} simRef={simRef} propWakeRef={propWakeRef} />}
      />
    );
  }

  return (
    <VersionedShipModel
      descriptor={descriptor}
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
            propWakeRef={propWakeRef}
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
  propWakeRef,
}: {
  url: string;
  simRef: React.MutableRefObject<SimulationState>;
  /** 坐标基适配（唯一应用点）：v2 候选模型 +X 舰艏 → 场景 +Z 舰艏。 */
  basisYawRad?: number;
  /** 版本化包描述符：仅版本化路径传入，驱动水线锚定与声明式动画绑定。 */
  descriptor?: VersionedModelPackageDescriptor | null;
  /** 实验重置令牌：透传给彩蛋装配，触发状态随实验生命周期复位。 */
  resetToken?: number;
  propWakeRef?: PropWakeAnchorsRef;
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

    // 逐帧推进器世界位置 → 尾迹发射锚点（节点未解析时置 null，尾迹回退静态锚点）。
    if (propWakeRef) {
      const write = (node: THREE.Object3D | null, key: 'port' | 'starboard') => {
        if (!node) {
          propWakeRef.current[key] = null;
          return;
        }
        const target = propWakeRef.current[key] ?? new THREE.Vector3();
        node.getWorldPosition(target);
        propWakeRef.current[key] = target;
      };
      write(propNodes.port, 'port');
      write(propNodes.starboard, 'starboard');
    }

    if (typeof window !== 'undefined') {
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
    }
  });

  return (
    <group ref={groupRef}>
      <group rotation-y={basisYawRad}>
        <HeroModelBasis matrix={descriptor?.modelToSceneMatrix}>
          <primitive object={model} scale={scale} />
          {descriptor ? (
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
  onHudUpdate: (state: HudState) => void;
  onChartDataUpdate: (time: number, desired: number, actual: number, speed: number, rudder: number) => void;
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
  }, [resetToken]);

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

      const stepResult = computeDestroyerHifiStep(
        buildDestroyerHifiStepRequest({
          dtS: dt,
          targetHeadingDeg: targetHeading,
          controlMode: controlMode === 'manual' || controlMode === 'p' || controlMode === 'pd' ? controlMode : 'pid',
          pid: pidGains,
          manualRudderDeg: sim.manualRudderDeg,
          disturbanceEnabled: false,
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
        onChartDataUpdate(simTime, targetHeadingSigned, headingDeg, sim.speedMps, sim.rudderDeg);
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

/** HUD 显示 */
function HUD({
  state,
  isRunning,
  controlMode,
}: {
  state: HudState;
  isRunning: boolean;
  controlMode: ControlMode;
}) {
  return (
    <div className="space-y-2">
      <Card className={`${simulationUi.panel} w-56`}>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Compass className="w-4 h-4 text-platform-action-primary" />
            导航状态
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-platform-fg-muted">航向</span>
            <span className="text-platform-action-primary font-mono">{state.heading.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-platform-fg-muted">转艏速率</span>
            <span className="text-platform-action-primary font-mono">{state.yawRate.toFixed(2)}°/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-platform-fg-muted">舵角</span>
            <span className="text-platform-action-primary font-mono">{state.rudder.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-platform-fg-muted">航速</span>
            <span className="text-platform-action-primary font-mono">{state.speed.toFixed(1)} m/s</span>
          </div>
        </CardContent>
      </Card>

      <Card className={`${simulationUi.panel} w-56`}>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-[hsl(var(--platform-brand-success))]" />
            航迹误差
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-platform-fg-muted">当前误差</span>
            <span className="text-[hsl(var(--platform-brand-success))] font-mono">{state.currentError.toFixed(1)} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-platform-fg-muted">平均误差</span>
            <span className="text-[hsl(var(--platform-brand-success))] font-mono">{state.avgError.toFixed(1)} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-platform-fg-muted">仿真时间</span>
            <span className="text-[hsl(var(--platform-brand-success))] font-mono">{state.time.toFixed(1)} s</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[hsl(var(--platform-brand-success))] animate-pulse' : 'bg-platform-canvas-muted'}`} />
        <span className="text-platform-fg-muted">{isRunning ? '运行中' : '已暂停'}</span>
        <span className="text-platform-fg-muted">|</span>
        <span className="text-platform-action-primary uppercase">{controlMode}</span>
      </div>
    </div>
  );
}

/** 控制面板 */
function ControlPanel({
  isRunning,
  controlMode,
  pidGains,
  selectedTask,
  onStart,
  onPause,
  onReset,
  onControlModeChange,
  onPidGainsChange,
  onTaskChange,
  onShowChart,
}: {
  isRunning: boolean;
  controlMode: ControlMode;
  pidGains: PIDGains;
  selectedTask: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onControlModeChange: (mode: ControlMode) => void;
  onPidGainsChange: (gains: PIDGains) => void;
  onTaskChange: (index: number) => void;
  onShowChart: () => void;
}) {
  return (
    <div>
      <Card className={simulationUi.panel}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            控制面板
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3 px-4 space-y-4">
          {/* 任务选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-platform-fg-muted">任务选择</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className={`h-7 w-7 ${simulationUi.buttonOutline}`}
                onClick={() => onTaskChange(Math.max(0, selectedTask - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 text-center">
                <p className="text-sm font-medium">{tasks[selectedTask].title}</p>
                <p className="text-xs text-platform-fg-muted">{tasks[selectedTask].description}</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className={`h-7 w-7 ${simulationUi.buttonOutline}`}
                onClick={() => onTaskChange(Math.min(tasks.length - 1, selectedTask + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 控制模式 */}
          <div className="space-y-2">
            <Label className="text-xs text-platform-fg-muted">控制模式</Label>
            <div className="grid grid-cols-4 gap-1">
              {(['manual', 'p', 'pd', 'pid'] as ControlMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={controlMode === mode ? 'default' : 'outline'}
                  size="sm"
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
          {controlMode !== 'manual' && (
            <div className="space-y-3">
              <Label className="text-xs text-platform-fg-muted">PID 增益</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-xs text-platform-action-primary">Kp</span>
                  <Slider
                    value={[pidGains.kp]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={([v]) => onPidGainsChange({ ...pidGains, kp: v })}
                    className={`flex-1 ${simulationUi.slider}`}
                  />
                  <span className="w-10 text-right text-xs font-mono">{pidGains.kp.toFixed(1)}</span>
                </div>
                {(controlMode === 'pid' || controlMode === 'pd') && (
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-xs text-platform-action-primary">Kd</span>
                    <Slider
                      value={[pidGains.kd]}
                      min={0}
                      max={50}
                      step={1}
                      onValueChange={([v]) => onPidGainsChange({ ...pidGains, kd: v })}
                      className={`flex-1 ${simulationUi.slider}`}
                    />
                    <span className="w-10 text-right text-xs font-mono">{pidGains.kd.toFixed(0)}</span>
                  </div>
                )}
                {controlMode === 'pid' && (
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-xs text-platform-action-primary">Ki</span>
                    <Slider
                      value={[pidGains.ki]}
                      min={0}
                      max={0.1}
                      step={0.001}
                      onValueChange={([v]) => onPidGainsChange({ ...pidGains, ki: v })}
                      className={`flex-1 ${simulationUi.slider}`}
                    />
                    <span className="w-10 text-right text-xs font-mono">{pidGains.ki.toFixed(3)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex gap-2">
            {isRunning ? (
              <Button variant="outline" className={`flex-1 ${simulationUi.buttonSecondary}`} onClick={onPause}>
                <Pause className="w-4 h-4 mr-2" />
                暂停
              </Button>
            ) : (
              <Button variant="default" data-sound-start className={`flex-1 ${simulationUi.buttonPrimary}`} onClick={onStart}>
                <Play className="w-4 h-4 mr-2" />
                开始
              </Button>
            )}
            <Button variant="outline" onClick={onReset} className={simulationUi.buttonOutline}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={onShowChart} className={simulationUi.buttonOutline}>
              <Gauge className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 仿真曲线图表 */
function SimulationChart({ data, onBack }: { data: ChartData; onBack: () => void }) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: data.time.map((t) => t.toFixed(1)),
        datasets: [
          {
            label: '期望航向',
            data: data.desiredHeading,
            borderColor: simulationScenePalette.danger,
            backgroundColor: simulationScenePalette.dangerSurface,
            yAxisID: 'y-heading',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '实际航向',
            data: data.actualHeading,
            borderColor: simulationScenePalette.success,
            backgroundColor: simulationScenePalette.successSurface,
            yAxisID: 'y-heading',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '航速',
            data: data.speed,
            borderColor: simulationScenePalette.headingPrimary,
            backgroundColor: simulationScenePalette.headingSurface,
            yAxisID: 'y-speed',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '舵角',
            data: data.rudder,
            borderColor: simulationScenePalette.dredgerPrimary,
            backgroundColor: simulationScenePalette.warningSurface,
            yAxisID: 'y-rudder',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: simulationScenePalette.chartTitle },
          },
          tooltip: {
            backgroundColor: simulationScenePalette.chartSurface,
            titleColor: simulationScenePalette.chartTitle,
            bodyColor: simulationScenePalette.chartText,
            borderColor: simulationScenePalette.chartBorder,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            title: { display: true, text: '时间 (秒)', color: simulationScenePalette.chartText },
            ticks: { color: simulationScenePalette.chartTick, maxTicksLimit: 15 },
            grid: { color: simulationScenePalette.chartGridFaint },
          },
          'y-heading': {
            type: 'linear',
            position: 'left',
            title: { display: true, text: '航向角 (°)', color: simulationScenePalette.chartText },
            min: -180,
            max: 180,
            ticks: { color: simulationScenePalette.chartTick, stepSize: 45 },
            grid: { color: simulationScenePalette.chartGrid },
          },
          'y-speed': {
            type: 'linear',
            position: 'right',
            title: { display: true, text: '航速 (m/s)', color: simulationScenePalette.chartText },
            ticks: { color: simulationScenePalette.chartTick },
            grid: { drawOnChartArea: false },
          },
          'y-rudder': {
            type: 'linear',
            position: 'right',
            offset: true,
            title: { display: true, text: '舵角 (°)', color: simulationScenePalette.chartText },
            min: -nomotoParams.maxRudderDeg,
            max: nomotoParams.maxRudderDeg,
            ticks: { color: simulationScenePalette.chartTick, stepSize: 10 },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data]);

  return (
    <div className="flex h-full w-full flex-col bg-platform-canvas p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-platform-fg-primary">仿真曲线</h2>
        <Button onClick={onBack} variant="default" size="lg">
          返回场景
        </Button>
      </div>
      <div className="flex-1 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-4">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
}

// ============ 主组件 ============

export default function DestroyerSimulation() {
  // 状态
  const [isRunning, setIsRunning] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('pid');
  const [pidGains, setPidGains] = useState<PIDGains>(DEFAULT_PID_GAINS);
  const [cameraMode, setCameraMode] = useState<string>('chase');
  const [viewResetCount, setViewResetCount] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(1);
  const sceneTheme = useSimulationSceneTheme();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [selectedTask, setSelectedTask] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [showChart, setShowChart] = useState(false);
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
  const [chartData, setChartData] = useState<ChartData>({
    time: [],
    desiredHeading: [],
    actualHeading: [],
    speed: [],
    rudder: [],
  });

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
  // 双桨尾迹发射锚点：模型侧逐帧写入桨节点世界位置，尾迹侧逐帧读取。
  const propWakeRef = useRef<{ port: THREE.Vector3 | null; starboard: THREE.Vector3 | null }>({
    port: null,
    starboard: null,
  });

  // 计算场景逻辑
  const task = tasks[selectedTask];
  const scenarioLogic = useMemo(() => getScenarioLogic(task.scenario), [task.scenario]);
  const guidePath = useMemo(() => generateGuidePath(scenarioLogic, task.duration), [scenarioLogic, task.duration]);
  const headingPoints = useMemo(() => {
    const points: HeadingPoint[] = [];
    const step = task.duration / 10;
    for (let t = 0; t <= task.duration; t += step) {
      points.push({ time: t, heading: normalizeSignedHeading(scenarioLogic.getDesiredHeading(t)) });
    }
    return points;
  }, [scenarioLogic, task.duration]);

  // 重置仿真
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setResetToken((prev) => prev + 1);
    setChartData({ time: [], desiredHeading: [], actualHeading: [], speed: [], rudder: [] });

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

  // 任务切换时重置
  useEffect(() => {
    handleReset();
  }, [selectedTask, handleReset]);

  // 图表数据更新
  const handleChartDataUpdate = useCallback(
    (time: number, desired: number, actual: number, speed: number, rudder: number) => {
      setChartData((prev) => ({
        time: [...prev.time, time],
        desiredHeading: [...prev.desiredHeading, desired],
        actualHeading: [...prev.actualHeading, actual],
        speed: [...prev.speed, speed],
        rudder: [...prev.rudder, rudder],
      }));
    },
    []
  );

  if (showChart) {
    return <SimulationChart data={chartData} onBack={() => setShowChart(false)} />;
  }

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      <Canvas shadows={{ type: THREE.PCFShadowMap }}>
        <PerspectiveCamera makeDefault position={[0, 200, 500]} fov={60} near={1} far={50000} />
        <MarineFrameRuntime simRef={simRef} simTimeRef={simTimeRef} resetToken={resetToken}>
        <Suspense fallback={null}>
          <EnvironmentScene />
        </Suspense>
        <SoundscapeAmbienceDriver />
        <SceneQualityDriver />
        <Suspense fallback={null}>
          <PresetWater simRef={simRef} />
        </Suspense>
        {showGrid ? <GridHelper simRef={simRef} sceneTheme={sceneTheme} /> : null}
        <GuideRoute points={guidePath} />
        <ActualPathTrail positionSampler={() => simRef.current.position} resetToken={resetToken} />
        <TeachingAnnotationsGate
          simRef={simRef}
          targetHeadingSampler={() => platformHeadingToSceneRad(scenarioLogic.getDesiredHeading(hudState.time))}
        />
        <WakeTrailRig simRef={simRef} playing={isRunning} resetToken={resetToken} propWakeRef={propWakeRef} />
        <Suspense
          fallback={(
            <ModelLoadingPlaceholder
              label="驱逐舰模型加载中"
              sublabel="场景已就绪，可先查看海面与航迹"
            />
          )}
        >
          <DestroyerModel simRef={simRef} resetToken={resetToken} propWakeRef={propWakeRef} />
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
          duration={task.duration}
          guidePath={guidePath}
          resetToken={resetToken}
          speedScale={speedScale}
          maxErrorDeg={
            destroyer055Profile.scenarios.find((scenario) => scenario.id === task.scenario)
              ?.successCriteria?.maxError ?? 5
          }
          maxSettlingTimeSec={
            destroyer055Profile.scenarios.find((scenario) => scenario.id === task.scenario)
              ?.successCriteria?.maxSettlingTime
          }
          onHudUpdate={setHudState}
          onChartDataUpdate={handleChartDataUpdate}
        />
        <ScenePostEffects />
        </MarineFrameRuntime>
      </Canvas>

      <SimulationDock
        side="left"
        title="状态监控"
        tabs={[
          {
            id: 'status',
            label: '总览',
            content: <HUD state={hudState} isRunning={isRunning} controlMode={controlMode} />,
          },
        ]}
      />

      <SimulationDock
        side="right"
        title="控制与探究"
        tabs={[
          {
            id: 'control',
            label: '控制',
            content: (
              <ControlPanel
                isRunning={isRunning}
                controlMode={controlMode}
                pidGains={pidGains}
                selectedTask={selectedTask}
                onStart={() => setIsRunning(true)}
                onPause={() => setIsRunning(false)}
                onReset={handleReset}
                onControlModeChange={setControlMode}
                onPidGainsChange={setPidGains}
                onTaskChange={setSelectedTask}
                onShowChart={() => setShowChart(true)}
              />
            ),
          },
          {
            id: 'evaluate',
            label: '评估',
            content: (
              <SimulationAssessmentPanel
                title="机动任务评估"
                metrics={[
                  { id: 'current-error', label: '当前误差', value: hudState.currentError, max: 200, better: 'lower', unit: 'm' },
                  { id: 'avg-error', label: '平均误差', value: hudState.avgError, max: 200, better: 'lower', unit: 'm' },
                  { id: 'yaw', label: '转艏速率', value: Math.abs(hudState.yawRate), max: 8, better: 'lower', unit: '°/s' },
                  { id: 'rudder', label: '舵角幅值', value: Math.abs(hudState.rudder), max: 35, better: 'lower', unit: '°' },
                ]}
              />
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
        title="055型驱逐舰战术机动仿真"
        subtitle="高保真航向控制 · 任务场景切换"
        badge="Destroyer / OBE"
      />
    </div>
    </SceneQualityProvider>
    </TeachingAnnotationsProvider>
    </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}
