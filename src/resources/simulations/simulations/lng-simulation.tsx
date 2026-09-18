'use client';

/**
 * LNG 船仿真组件
 * 长恒系列 LNG 运输船 - 带时滞和液货晃荡的高保真仿真
 */

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  Html,
  PerspectiveCamera,
  Line,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Compass, Video, Orbit, ArrowDownFromLine } from 'lucide-react';
import { SimulationClock } from '@/lib/simulation';
import { VersionedFleetShip } from '@/resources/simulations/components/versioned-fleet-ship';
import type { BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, SimulationDock, SimulationAssessmentPanel, simulationUi } from '../components/simulation-ui';
import { useSimulationSceneTheme, simulationScenePalette, type SimulationSceneTheme } from '../components/simulation-theme';
import {
  EnvironmentScene,
  MARINE_SCENE_LAYOUTS,
  MarineSceneLayoutObjects,
  shorelineAmplitudeAttenuation,
  SceneEnvironmentProvider,
  useEnvironmentWaterColors,
  useSceneEnvironment,
} from '../scene/environment';
import { createNearFieldSurfaceQuery, GERSTNER_WATER_BASE_Y, GerstnerWater, gerstnerAmplitudeScale } from '../scene/water';
import { WakeTrail } from '../scene/wake';
import {
  SceneSoundscapeProvider,
  SoundscapeAmbienceDriver,
} from '../scene/audio';
import {
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
import { lngChanghengSceneVisual } from '../profiles/lng-changheng-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';

import type {
  ControlMode,
  SimulationState,
  Vector2,
  PIDGains,
} from '../core/types';
import { lngChanghengProfile, getLNGDefaultConfig } from '../profiles/lng-changheng';
import {
  LNGCarrierEngine,
  createSimulationEngine,
} from '../physics/engine-factory';
import {
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
} from '../physics/simulation-engine-facade';
import { toDegrees, toRadians, LNG_CHANGHENG_PARAMS } from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';
import {
  absoluteHeadingErrorDeg,
  advanceAttainment,
  createAttainmentState,
} from '../lib/heading-attainment';

// ============ 类型定义 ============

interface LNGSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  time: number;
  position: Vector2;
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  sloshingAngle: number;
  tankPressure: number;
  targetHeading: number;
  controlMode: ControlMode;
  smithEnabled: boolean;
}

// ============ LNG 船模型组件 ============

function LNGShipModel(props: {
  position: Vector2;
  heading: number;
  sloshingAngle: number;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
}) {
  return (
    <VersionedFleetShip
      logicalId="lng-carrier"
      simRef={props.simRef}
      position={props.position}
      headingRad={props.heading}
      extraEuler={{ z: props.sloshingAngle * 0.1 }}
      sceneLengthMeters={LNG_CHANGHENG_PARAMS.LENGTH}
      resetToken={props.resetToken}
      legacyYawOffsetRad={-Math.PI / 2}
      fallbackDraftMeters={LNG_CHANGHENG_PARAMS.DRAFT}
    />
  );
}

// ============ 航迹线组件 ============

function TrajectoryLine({ points, waterOriginSampler, }: { points: Vector2[]; waterOriginSampler?: () => { x: number; z: number } }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} waterOriginSampler={waterOriginSampler} color={simulationScenePalette.headingPrimary} lineWidth={2} />;
}

// ============ 目标航向指示器 ============

function HeadingIndicator({
  position,
  targetHeading,
  currentHeading,
}: {
  position: Vector2;
  targetHeading: number;
  currentHeading: number;
}) {
  const length = 500;
  const buildWings = (start: [number, number, number], end: [number, number, number]) => {
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const backX = end[0] - ux * 50;
    const backZ = end[2] - uz * 50;
    return {
      left: [backX - uz * 20, end[1], backZ + ux * 20] as [number, number, number],
      right: [backX + uz * 20, end[1], backZ - ux * 20] as [number, number, number],
    };
  };

  // 目标航向线
  const targetEnd: [number, number, number] = [
    position.x + length * Math.cos(toRadians(targetHeading)),
    5,
    position.z + length * Math.sin(toRadians(targetHeading)),
  ];

  // 当前航向线
  const currentEnd: [number, number, number] = [
    position.x + length * 0.8 * Math.cos(toRadians(currentHeading)),
    5,
    position.z + length * 0.8 * Math.sin(toRadians(currentHeading)),
  ];
  const targetWings = buildWings([position.x, 5, position.z], targetEnd);
  const currentWings = buildWings([position.x, 5, position.z], currentEnd);

  return (
    <group>
      {/* 目标航向 (浅蓝虚线箭头) */}
      <Line
        points={[[position.x, 5, position.z], targetEnd]}
        color={simulationScenePalette.headingSecondary}
        lineWidth={2}
        dashed
        dashSize={20}
        gapSize={10}
      />
      <Line points={[targetWings.left, targetEnd]} color={simulationScenePalette.headingSecondary} lineWidth={2} />
      <Line points={[targetWings.right, targetEnd]} color={simulationScenePalette.headingSecondary} lineWidth={2} />
      {/* 当前航向 (深蓝实线箭头) */}
      <Line
        points={[[position.x, 5, position.z], currentEnd]}
        color={simulationScenePalette.headingPrimary}
        lineWidth={3}
      />
      <Line points={[currentWings.left, currentEnd]} color={simulationScenePalette.headingPrimary} lineWidth={3} />
      <Line points={[currentWings.right, currentEnd]} color={simulationScenePalette.headingPrimary} lineWidth={3} />
    </group>
  );
}


// ============ 管线桥接组件 ============

const CAMERA_SHOT_VIEWS = [
  { id: SCENE_CAMERA_SHOTS.chase.id, label: '跟船', shortLabel: '跟', icon: Video, description: SCENE_CAMERA_SHOTS.chase.description },
  { id: SCENE_CAMERA_SHOTS.orbit.id, label: '环绕', shortLabel: '环', icon: Orbit, description: SCENE_CAMERA_SHOTS.orbit.description },
  { id: SCENE_CAMERA_SHOTS.tactical.id, label: '战术', shortLabel: '战', icon: Compass, description: SCENE_CAMERA_SHOTS.tactical.description },
  { id: SCENE_CAMERA_SHOTS.topDown.id, label: '顶视', shortLabel: '顶', icon: ArrowDownFromLine, description: SCENE_CAMERA_SHOTS.topDown.description },
];

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

/** 海面颜色随环境预设、细分随质量档位的桥接组件。 */
function LNGWater({ state }: { state: LNGSimulationState }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <GerstnerWater
      tier={params.waterTier}
      positionSampler={() => ({ x: state.position.x, z: state.position.z })}
      shoreSegments={MARINE_SCENE_LAYOUTS['harbor-entrance-channel'].shoreSegments}
      waterColor={water.waterColor}
      deepColor={water.deepColor}
      horizonColor={water.horizonColor}
      foamColor={simulationScenePalette.waterFoam}
      seaState={3}
      sunDirection={water.sunDirection}
      sunIllumination={water.sunIllumination}
    />
  );
}

/** 尾迹粒子场桥接：逐帧喂入船位/航向与 Gerstner 波面高度。 */
function WakeTrailRig({
  state,
  playing,
  resetToken,
}: {
  state: LNGSimulationState;
  playing: boolean;
  resetToken: number;
}) {
  const { wakeVisible } = useSceneEnvironment();
  const transformRef = useRef({ position: [0, 0, 0] as [number, number, number], heading: 0 });
  const timeRef = useRef(0);
  // 近场查询帧记忆化（#2104）：本帧全部粒子共享同一角点缓存。
  const wakeQueryCacheRef = useRef<{ key: string; query: ReturnType<typeof createNearFieldSurfaceQuery> } | null>(null);
  const { tier } = useSceneQuality();

  useFrame((frameState) => {
    transformRef.current.position = [state.position.x, 0, state.position.z];
    transformRef.current.heading = platformHeadingToSceneRad(state.heading);
    timeRef.current = frameState.clock.getElapsedTime();
  });

  // 统一近场可见曲面（#2104）：帧记忆化查询——与 GPU 近场网格同参数（带限波组+包络）。
  const waterYSampler = (x?: number, z?: number) => {
    const key = `${timeRef.current}|${state.position.x}|${state.position.z}`;
    if (!wakeQueryCacheRef.current || wakeQueryCacheRef.current.key !== key) {
      wakeQueryCacheRef.current = {
        key,
        query: createNearFieldSurfaceQuery(gerstnerAmplitudeScale(3), state.position.x, state.position.z, timeRef.current),
      };
    }
    return GERSTNER_WATER_BASE_Y + (wakeQueryCacheRef.current.query.heightAt(x ?? 0, z ?? 0) - GERSTNER_WATER_BASE_Y) * shorelineAmplitudeAttenuation(MARINE_SCENE_LAYOUTS['harbor-entrance-channel'].shoreSegments, x ?? 0, z ?? 0, 400);;
  };

  if (!wakeVisible) return null;
  return (
    <WakeTrail
      key={resetToken}
      profile={lngChanghengSceneVisual}
      shipTransform={transformRef.current}
      qualityTier={tier}
      playing={playing}
      waterYSampler={waterYSampler}
      worldSpeedSampler={() => state.speed}
    />
  );
}

/** 教学标注开关门控：默认关闭，开启时显示当前/目标航向指示。 */
function TeachingAnnotationsGate({
  position,
  targetHeading,
  currentHeading,
}: {
  position: Vector2;
  targetHeading: number;
  currentHeading: number;
}) {
  const { showAnnotations } = useTeachingAnnotations();
  if (!showAnnotations) return null;
  return (
    <HeadingIndicator
      position={position}
      targetHeading={targetHeading}
      currentHeading={currentHeading}
    />
  );
}

// ============ HUD 组件 ============

function StatusPanel({
  state,
}: {
  state: LNGSimulationState;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-platform-fg-secondary">时间:</span>
        <span>{state.time.toFixed(1)}s</span>

        <span className="text-platform-fg-secondary">航向:</span>
        <span>{state.heading.toFixed(1)}°</span>

        <span className="text-platform-fg-secondary">目标航向:</span>
        <span className="text-[hsl(var(--platform-brand-success))]">{state.targetHeading.toFixed(1)}°</span>

        <span className="text-platform-fg-secondary">航向误差:</span>
        <span className={Math.abs(state.heading - state.targetHeading) > 5 ? 'text-[hsl(var(--platform-brand-evidence))]' : 'text-[hsl(var(--platform-brand-success))]'}>
          {(state.heading - state.targetHeading).toFixed(1)}°
        </span>

        <span className="text-platform-fg-secondary">转艏率:</span>
        <span>{state.yawRate.toFixed(2)}°/s</span>

        <span className="text-platform-fg-secondary">舵角:</span>
        <span>{state.rudder.toFixed(1)}°</span>

        <span className="text-platform-fg-secondary">航速:</span>
        <span>{(state.speed * 1.944).toFixed(1)} kn</span>
      </div>

      <div className="border-t border-platform-border"></div>

      <div className="text-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-platform-fg-secondary">液货晃荡:</span>
          <span className={state.sloshingAngle > 5 ? 'text-[hsl(var(--platform-brand-danger))]' : 'text-platform-action-primary'}>
            {state.sloshingAngle.toFixed(2)}°
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-platform-fg-secondary">货舱压力:</span>
          <span className={state.tankPressure > 150 ? 'text-[hsl(var(--platform-brand-danger))]' : 'text-platform-action-primary'}>
            {state.tankPressure.toFixed(0)} kPa
          </span>
        </div>
      </div>

      <div className="border-t border-platform-border"></div>

      <div className="rounded border border-[hsl(var(--platform-brand-evidence)/0.35)] bg-[hsl(var(--platform-brand-evidence)/0.14)] p-2 text-xs text-[hsl(var(--platform-brand-evidence))]">
        ⚠️ 时滞: 25秒 | 晃荡周期: ~12s
      </div>
    </div>
  );
}

function ControlPanel({
  state,
  onControlModeChange,
  onTargetHeadingChange,
  onSmithToggle,
  onStartPause,
  onReset,
}: {
  state: LNGSimulationState;
  onControlModeChange: (mode: ControlMode) => void;
  onTargetHeadingChange: (heading: number) => void;
  onSmithToggle: () => void;
  onStartPause: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="lng-simulation-control-1" className="mb-1 block text-sm text-platform-fg-secondary">控制模式</label>
        <select id="lng-simulation-control-1"
          value={state.controlMode}
          onChange={(e) => onControlModeChange(e.target.value as ControlMode)}
          className="w-full rounded border border-platform-border bg-platform-surface-overlay/86 p-2 text-platform-fg-primary"
        >
          <option value="manual">手动</option>
          <option value="p">P 控制</option>
          <option value="pd">PD 控制</option>
          <option value="pid">PID 控制</option>
          <option value="autopilot">自动舵</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm text-platform-fg-secondary">
          目标航向: {state.targetHeading}°
        </label>
        <input aria-label="LNG 船仿真参数"
          type="range"
          min="-180"
          max="180"
          value={state.targetHeading}
          onChange={(e) => onTargetHeadingChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={state.smithEnabled}
            onChange={onSmithToggle}
            className="h-4 w-4 accent-[hsl(var(--platform-action-primary))]"
          />
          <span className="text-sm">启用 Smith 预估器</span>
        </label>
        <p className="mt-1 text-xs text-platform-fg-secondary">消除25秒时滞影响</p>
      </div>

      <div className="flex gap-2">
        <button type="button"
          onClick={onStartPause}
          className={`flex-1 rounded border px-4 py-2 ${
            state.isRunning && !state.isPaused
              ? simulationUi.buttonSecondary
              : simulationUi.buttonPrimary
          }`}
          data-sound-start
        >
          {state.isRunning && !state.isPaused ? '暂停' : '开始'}
        </button>
        <button type="button"
          onClick={onReset}
          className={`flex-1 rounded border px-4 py-2 ${simulationUi.buttonOutline}`}
        >
          重置
        </button>
      </div>
    </div>
  );
}

// ============ 3D 场景 ============

function Scene({
  state,
  trajectory,
  showGrid,
  sceneTheme,
  cameraMode,
  onCameraModeChange,
  controlsRef,
  resetToken,
  resetSignal,
  simRef,
}: {
  state: LNGSimulationState;
  trajectory: Vector2[];
  showGrid: boolean;
  sceneTheme: SimulationSceneTheme;
  cameraMode: string;
  onCameraModeChange: (mode: string) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  resetToken: number;
  resetSignal: number;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[-400, 300, 400]} fov={60} near={1} far={50000} />

      <Suspense fallback={null}>
        <EnvironmentScene subjectPositionSampler={() => ({ x: state.position.x, z: state.position.z })} />
        <MarineSceneLayoutObjects layoutId="harbor-entrance-channel" />
      </Suspense>
      <SoundscapeAmbienceDriver />
      <SceneQualityDriver />
        <MarinePerformanceEvidenceProbe contextInput={() => ({ vesselId: 'lng', cameraView: String(cameraMode), seaState: 3 })} />
      <Suspense fallback={null}>
        <LNGWater state={state} />
      </Suspense>

      {showGrid ? (
        <Grid
          args={[10000, 10000]}
          cellSize={100}
          cellThickness={0.5}
          cellColor={sceneTheme.gridCellColor}
          sectionSize={500}
          sectionThickness={1}
          sectionColor={sceneTheme.gridSectionColor}
          fadeDistance={9000}
          fadeStrength={1}
          position={[0, 0.35, 0]}
        />
      ) : null}

      <Suspense
        fallback={(
          <ModelLoadingPlaceholder
            label="LNG 船模型加载中"
            sublabel="场景已就绪，可先查看海况与航向参考"
          />
        )}
      >
        <LNGShipModel
          position={state.position}
          heading={toRadians(state.heading)}
          sloshingAngle={state.sloshingAngle}
          simRef={simRef}
          resetToken={resetToken}
        />
      </Suspense>

      <TrajectoryLine points={trajectory} waterOriginSampler={() => ({ x: state.position.x, z: state.position.z })} />
      <WakeTrailRig state={state} playing={state.isRunning && !state.isPaused} resetToken={resetToken} />

      <TeachingAnnotationsGate
        position={state.position}
        targetHeading={state.targetHeading}
        currentHeading={state.heading}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        minDistance={100}
        maxDistance={5000}
        maxPolarAngle={Math.PI / 2.1}
      />
      <RightClickFreeModeBridge onRequestFreeMode={() => onCameraModeChange('free')} />
      <StayPutCameraController
        view={cameraMode}
        positionSampler={() => ({ x: state.position.x, z: state.position.z })}
        headingSampler={() => platformHeadingToSceneRad(state.heading)}
        shipLength={lngChanghengSceneVisual.shipLengthMeters}
        controlsRef={controlsRef}
      resetSignal={resetSignal}
      />
      <ScenePostEffects />
    </>
  );
}

// ============ 主组件 ============

export function LNGSimulation() {
  const engineRef = useRef<LNGCarrierEngine | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const clockRef = useRef(
    new SimulationClock({
      dt: SIMULATION_FIXED_STEP_SECONDS,
      maxSubSteps: SIMULATION_MAX_SUB_STEPS,
    })
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);
  // 循环稳定化（issue 1945）：每帧变化的量走 ref，时钟真源在 timeRef，
  // 循环回调与启动 effect 引用稳定，运行期间不 teardown 重建。
  const controlRef = useRef({
    isRunning: false,
    isPaused: false,
    targetHeading: 0,
    controlMode: 'pid' as LNGSimulationState['controlMode'],
  });
  const speedScaleRef = useRef(1);
  const timeRef = useRef(0);
  const lastHudUpdateRef = useRef(0);
  const lastTrajectoryTimeRef = useRef(0);
  const bindingRef = useRef<BindingTelemetrySource>({
    rudderDeg: 0,
    speedMps: LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
    attainedCount: 0,
    advancing: false,
  });
  const attainmentRef = useRef(createAttainmentState(0));

  const [cameraMode, setCameraMode] = useState<string>('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(1);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const sceneTheme = useSimulationSceneTheme();
  const [state, setState] = useState<LNGSimulationState>({
    isRunning: false,
    isPaused: false,
    time: 0,
    position: { x: -3000, z: 0 },
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
    sloshingAngle: 0,
    tankPressure: 100,
    targetHeading: 0,
    controlMode: 'pid',
    smithEnabled: false,
  });

  const [trajectory, setTrajectory] = useState<Vector2[]>([]);

  // 初始化引擎
  useEffect(() => {
    preloadVirtualSimulationRuntime().catch(console.error);

    const engine = createSimulationEngine(lngChanghengProfile) as LNGCarrierEngine;
    engine.initialize(-3000, 0, 0);
    engineRef.current = engine;
  }, []);

  // 仿真循环
  const simulationStep = useCallback((timestamp: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const control = controlRef.current;
    if (!isVirtualSimulationRuntimeReady()) {
      lastTimeRef.current = timestamp;
      animationRef.current = requestAnimationFrame(simulationStep);
      return;
    }

    const frameDt = getSimulationDeltaFromMilliseconds(timestamp, lastTimeRef.current, speedScaleRef.current);
    lastTimeRef.current = timestamp;

    let nextTime = timeRef.current;
    let engineState = engine.getState(nextTime);
    let sloshingMetrics = engine.getSloshingMetrics();

    clockRef.current.advance(frameDt, (dt) => {
      const time = nextTime + dt;
      nextTime = time;
      engine.step(
        control.targetHeading,
        null,
        control.controlMode,
        0,
        LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
        dt,
        time
      );
      engineState = engine.getState(time);
      sloshingMetrics = engine.getSloshingMetrics();
      const headingError = absoluteHeadingErrorDeg(engineState.heading, control.targetHeading);
      let attainedCount = bindingRef.current.attainedCount;
      if (advanceAttainment(attainmentRef.current, control.targetHeading, headingError, 5, dt)) {
        attainedCount += 1;
      }
      bindingRef.current = {
        rudderDeg: engineState.rudder,
        speedMps: engineState.speed,
        attainedCount,
        advancing: control.isRunning && !control.isPaused,
      };
    });

    timeRef.current = nextTime;
    // HUD setState 0.1s 节流、轨迹 0.5s 节流（对齐 destroyer 口径）；
    // 被跳过的帧仅推进 timeRef，不再触发整树渲染。
    if (nextTime - lastHudUpdateRef.current > 0.1) {
      lastHudUpdateRef.current = nextTime;
      setState((prev) => ({
        ...prev,
        time: nextTime,
        position: engineState.position,
        heading: engineState.heading,
        yawRate: engineState.yawRate,
        rudder: engineState.rudder,
        speed: engineState.speed,
        sloshingAngle: sloshingMetrics.angleDeg,
        tankPressure: sloshingMetrics.pressure,
      }));
    }

    if (nextTime - lastTrajectoryTimeRef.current > 0.5) {
      lastTrajectoryTimeRef.current = nextTime;
      const newPoint = { ...engineState.position };
      setTrajectory((prev) => {
        const newTraj = [...prev, newPoint];
        return newTraj.length > 500 ? newTraj.slice(-500) : newTraj;
      });
    }

    if (control.isRunning && !control.isPaused) {
      animationRef.current = requestAnimationFrame(simulationStep);
    }
  }, []);

  // 控制量同步到 ref：低频、由 UI 事件驱动，rAF 循环每帧读取最新值。
  useEffect(() => {
    controlRef.current = {
      isRunning: state.isRunning,
      isPaused: state.isPaused,
      targetHeading: state.targetHeading,
      controlMode: state.controlMode,
    };
  }, [state.isRunning, state.isPaused, state.targetHeading, state.controlMode]);
  useEffect(() => {
    speedScaleRef.current = speedScale;
  }, [speedScale]);

  // 控制仿真启停
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      clockRef.current.reset();
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(simulationStep);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isRunning, state.isPaused, simulationStep]);

  // 事件处理
  const handleStartPause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRunning: !prev.isRunning || prev.isPaused,
      isPaused: prev.isRunning && !prev.isPaused,
    }));
  }, []);

  const handleReset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (engineRef.current) {
      engineRef.current.initialize(-3000, 0, 0);
    }

    timeRef.current = 0;
    lastHudUpdateRef.current = 0;
    lastTrajectoryTimeRef.current = 0;
    attainmentRef.current = createAttainmentState(0);
    bindingRef.current = {
      rudderDeg: 0,
      speedMps: LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
      attainedCount: 0,
      advancing: false,
    };

    setState({
      isRunning: false,
      isPaused: false,
      time: 0,
      position: { x: -3000, z: 0 },
      heading: 0,
      yawRate: 0,
      rudder: 0,
      speed: LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
      sloshingAngle: 0,
      tankPressure: 100,
      targetHeading: 0,
      controlMode: 'pid',
      smithEnabled: false,
    });
    lastTimeRef.current = 0;
    clockRef.current.reset();
    setTrajectory([]);
    setResetCount((previous) => previous + 1);
  }, []);

  const handleControlModeChange = useCallback((mode: ControlMode) => {
    setState((prev) => ({ ...prev, controlMode: mode }));
  }, []);

  const handleTargetHeadingChange = useCallback((heading: number) => {
    setState((prev) => ({ ...prev, targetHeading: heading }));
  }, []);

  const handleSmithToggle = useCallback(() => {
    setState((prev) => {
      const newSmithEnabled = !prev.smithEnabled;
      if (engineRef.current) {
        engineRef.current.setSmithPredictorEnabled(newSmithEnabled);
      }
      return { ...prev, smithEnabled: newSmithEnabled };
    });
  }, []);

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      <Canvas shadows={{ type: THREE.PCFShadowMap }}>
        <Scene
          state={state}
          trajectory={trajectory}
          showGrid={showGrid}
          sceneTheme={sceneTheme}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          controlsRef={controlsRef}
          resetToken={resetCount}
          resetSignal={viewResetCount}
          simRef={bindingRef}
        />
      </Canvas>

      <SimulationDock
        side="left"
        title="状态监控"
        tabs={[
          {
            id: 'status',
            label: '总览',
            content: <StatusPanel state={state} />,
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
                state={state}
                onControlModeChange={handleControlModeChange}
                onTargetHeadingChange={handleTargetHeadingChange}
                onSmithToggle={handleSmithToggle}
                onStartPause={handleStartPause}
                onReset={handleReset}
              />
            ),
          },
          {
            id: 'evaluate',
            label: '评估',
            content: (
              <SimulationAssessmentPanel
                title="运行质量评估"
                metrics={[
                  { id: 'heading-error', label: '航向误差', value: Math.abs(state.heading - state.targetHeading), max: 30, better: 'lower', unit: '°', precision: 1 },
                  { id: 'rudder', label: '舵角幅值', value: Math.abs(state.rudder), max: 35, better: 'lower', unit: '°', precision: 1 },
                  { id: 'sloshing', label: '液货晃荡', value: state.sloshingAngle, max: 12, better: 'lower', unit: '°', precision: 2 },
                  { id: 'pressure', label: '舱压稳定', value: state.tankPressure, max: 200, better: 'lower', unit: 'kPa', precision: 0 },
                ]}
              />
            ),
          },
        ]}
      />

      <SimulationTopBar
        title="长恒系列 LNG 运输船"
        subtitle="时滞补偿控制 · 液货晃荡耦合"
        badge="LNG / OBE"
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
    </div>
    </SceneQualityProvider>
    </TeachingAnnotationsProvider>
    </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}

export default LNGSimulation;
