'use client';

/**
 * 集装箱船仿真组件
 * MSC Tessa 超大型集装箱船 - 变质量 + 风载荷 + 增益调度
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
import { createNearFieldSurfaceQuery, GERSTNER_WATER_BASE_Y, GerstnerWater, gerstnerAmplitudeScale, useNearFieldWaterHeight } from '../scene/water';
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
import { containerMscSceneVisual } from '../profiles/container-msc-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';

import type {
  ControlMode,
  Vector2,
  PIDGains,
  SimulationState,
} from '../core/types';
import { containerMscProfile, getContainerDefaultConfig } from '../profiles/container-msc';
import {
  ContainerShipEngine,
  createSimulationEngine,
} from '../physics/engine-factory';
import {
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
} from '../physics/simulation-engine-facade';
import { toDegrees, toRadians, CONTAINER_MSC_PARAMS } from '../core/constants';
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

interface ContainerSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  time: number;
  position: Vector2;
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  loadRatio: number;
  rollAngle: number;
  windSpeed: number;
  windDirection: number;
  targetHeading: number;
  controlMode: ControlMode;
  gainSchedulingEnabled: boolean;
  currentK: number;
  currentT: number;
}

// ============ 集装箱船模型组件 ============

function containerDraftMeters(loadRatio: number): number {
  const clamped = Math.min(1, Math.max(0, loadRatio));
  return CONTAINER_MSC_PARAMS.DRAFT_EMPTY
    + (CONTAINER_MSC_PARAMS.DRAFT_FULL - CONTAINER_MSC_PARAMS.DRAFT_EMPTY) * clamped;
}

function ContainerShipModel(props: {
  position: Vector2;
  heading: number;
  rollAngle: number;
  loadRatio: number;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
}) {
  // 水线参考（#2117）：共享波面采样（与 GPU 同表面定义），替代隐含 waterY=0。
  const waterHeight = useNearFieldWaterHeight({
    positionSampler: () => props.position,
    seaState: 3,
      shoreSegments: MARINE_SCENE_LAYOUTS['harbor-entrance-channel'].shoreSegments,
  });

  const currentDraft = containerDraftMeters(props.loadRatio);
  return (
    <VersionedFleetShip
      logicalId="container"
      simRef={props.simRef}
      position={props.position}
      waterYSampler={() => waterHeight(props.position.x, props.position.z)}
      headingRad={props.heading}
      extraEuler={{ z: props.rollAngle }}
      sceneLengthMeters={CONTAINER_MSC_PARAMS.LENGTH}
      resetToken={props.resetToken}
      legacyYawOffsetRad={0}
      fallbackDraftMeters={currentDraft}
      verticalOffsetMeters={CONTAINER_MSC_PARAMS.DRAFT_FULL - currentDraft}
    />
  );
}

// ============ 航迹线组件 ============

function TrajectoryLine({ points, waterOriginSampler, }: { points: Vector2[]; waterOriginSampler?: () => { x: number; z: number } }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} waterOriginSampler={waterOriginSampler} color={simulationScenePalette.containerPrimary} lineWidth={2} />;
}

// ============ 风向指示器 ============

function WindIndicator({
  position,
  windDirection,
  windSpeed,
}: {
  position: Vector2;
  windDirection: number;
  windSpeed: number;
}) {
  const length = 200 + windSpeed * 10;

  const end: [number, number, number] = [
    position.x + length * Math.cos(windDirection),
    100,
    position.z + length * Math.sin(windDirection),
  ];

  return (
    <Line name="marine-annotations"
      points={[[position.x, 100, position.z], end]}
      color={simulationScenePalette.headingSecondary}
      lineWidth={3}
      dashed
      dashScale={50}
    />
  );
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
  const length = 600;
  const buildWings = (start: [number, number, number], end: [number, number, number]) => {
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const backX = end[0] - ux * 55;
    const backZ = end[2] - uz * 55;
    return {
      left: [backX - uz * 22, end[1], backZ + ux * 22] as [number, number, number],
      right: [backX + uz * 22, end[1], backZ - ux * 22] as [number, number, number],
    };
  };

  const targetEnd: [number, number, number] = [
    position.x + length * Math.cos(toRadians(targetHeading)),
    2,
    position.z + length * Math.sin(toRadians(targetHeading)),
  ];

  const currentEnd: [number, number, number] = [
    position.x + length * 0.8 * Math.cos(toRadians(currentHeading)),
    2,
    position.z + length * 0.8 * Math.sin(toRadians(currentHeading)),
  ];
  const targetWings = buildWings([position.x, 2, position.z], targetEnd);
  const currentWings = buildWings([position.x, 2, position.z], currentEnd);

  return (
    <>
      {/* 目标航向 - 橙色虚线箭头 */}
      <Line name="marine-annotations"
        points={[[position.x, 2, position.z], targetEnd]}
        color={simulationScenePalette.containerTarget}
        lineWidth={2}
        dashed
        dashScale={30}
      />
      <Line name="marine-annotations" points={[targetWings.left, targetEnd]} color={simulationScenePalette.containerTarget} lineWidth={2} />
      <Line name="marine-annotations" points={[targetWings.right, targetEnd]} color={simulationScenePalette.containerTarget} lineWidth={2} />
      {/* 当前航向 - 深橙色实线箭头 */}
      <Line name="marine-annotations"
        points={[[position.x, 2, position.z], currentEnd]}
        color={simulationScenePalette.containerPrimary}
        lineWidth={3}
      />
      <Line name="marine-annotations" points={[currentWings.left, currentEnd]} color={simulationScenePalette.containerPrimary} lineWidth={3} />
      <Line name="marine-annotations" points={[currentWings.right, currentEnd]} color={simulationScenePalette.containerPrimary} lineWidth={3} />
    </>
  );
}

// ============ 相机控制器 ============


// ============ 控制面板组件 ============

function ControlPanel({
  state,
  onTargetHeadingChange,
  onControlModeChange,
  onLoadRatioChange,
  onWindSpeedChange,
  onWindDirectionChange,
  onGainSchedulingToggle,
  onStart,
  onPause,
  onReset,
}: {
  state: ContainerSimulationState;
  onTargetHeadingChange: (heading: number) => void;
  onControlModeChange: (mode: ControlMode) => void;
  onLoadRatioChange: (ratio: number) => void;
  onWindSpeedChange: (speed: number) => void;
  onWindDirectionChange: (direction: number) => void;
  onGainSchedulingToggle: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3 text-sm">

      {/* 仿真控制 */}
      <div className="mb-4 flex gap-2">
        {!state.isRunning ? (
          <button type="button"
            data-sound-start
            onClick={onStart}
            className={`flex-1 rounded border px-3 py-2 ${simulationUi.buttonPrimary}`}
          >
            开始仿真
          </button>
        ) : (
          <button type="button"
            onClick={onPause}
            className={`flex-1 rounded border px-3 py-2 ${simulationUi.buttonSecondary}`}
          >
            {state.isPaused ? '继续' : '暂停'}
          </button>
        )}
        <button type="button"
          onClick={onReset}
          className={`flex-1 rounded border px-3 py-2 ${simulationUi.buttonOutline}`}
        >
          重置
        </button>
      </div>

      {/* 目标航向 */}
      <div className="mb-3">
        <label className={`mb-1 block ${simulationUi.mutedText}`}>目标航向: {state.targetHeading.toFixed(0)}°</label>
        <input aria-label="集装箱船仿真参数一"
          type="range"
          min="-180"
          max="180"
          value={state.targetHeading}
          onChange={(e) => onTargetHeadingChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      {/* 装载率 */}
      <div className="mb-3">
        <label className={`mb-1 block ${simulationUi.mutedText}`}>
          装载率: {(state.loadRatio * 100).toFixed(0)}%
          <span className="ml-2 text-platform-fg-secondary">
            ({state.loadRatio < 0.3 ? '空载' : state.loadRatio < 0.7 ? '半载' : '满载'})
          </span>
        </label>
        <input aria-label="集装箱船仿真参数二"
          type="range"
          min="0"
          max="100"
          value={state.loadRatio * 100}
          onChange={(e) => onLoadRatioChange(Number(e.target.value) / 100)}
          className={simulationUi.nativeRange}
        />
        <div className="mt-1 flex justify-between text-xs text-platform-fg-secondary">
          <span>K={state.currentK.toFixed(3)}</span>
          <span>T={state.currentT.toFixed(0)}s</span>
        </div>
      </div>

      {/* 风速 */}
      <div className="mb-3">
        <label className={`mb-1 block ${simulationUi.mutedText}`}>风速: {state.windSpeed.toFixed(1)} m/s</label>
        <input aria-label="集装箱船仿真参数三"
          type="range"
          min="0"
          max="25"
          step="0.5"
          value={state.windSpeed}
          onChange={(e) => onWindSpeedChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      {/* 风向 */}
      <div className="mb-3">
        <label className={`mb-1 block ${simulationUi.mutedText}`}>风向: {state.windDirection.toFixed(0)}°</label>
        <input aria-label="集装箱船仿真参数四"
          type="range"
          min="0"
          max="360"
          value={state.windDirection}
          onChange={(e) => onWindDirectionChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      {/* 控制模式 */}
      <div className="mb-3">
        <p className={`mb-1 block ${simulationUi.mutedText}`}>控制模式</p>
        <div className="flex flex-wrap gap-1">
          {(['manual', 'p', 'pd', 'pid', 'pid_scheduled'] as ControlMode[]).map((mode) => (
            <button type="button"
              key={mode}
              onClick={() => onControlModeChange(mode)}
              className={`rounded border px-2 py-1 text-xs ${
                state.controlMode === mode
                  ? simulationUi.buttonPrimary
                  : simulationUi.buttonOutline
              }`}
            >
              {mode === 'pid_scheduled' ? '增益调度' : mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 增益调度开关 */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="checkbox"
          id="gainScheduling"
          checked={state.gainSchedulingEnabled}
          onChange={onGainSchedulingToggle}
          className="accent-[hsl(var(--platform-action-primary))]"
        />
        <label htmlFor="gainScheduling" className={simulationUi.mutedText}>
          启用增益调度 (自动调整 PID)
        </label>
      </div>
    </div>
  );
}

// ============ HUD 组件 ============

function HUD({ state }: { state: ContainerSimulationState }) {
  const headingError = state.targetHeading - state.heading;
  const normalizedError = headingError > 180 ? headingError - 360 : headingError < -180 ? headingError + 360 : headingError;

  return (
    <div className="space-y-3 p-1 text-sm">

      {/* 时间 */}
      <div className="mb-2 flex justify-between border-b border-platform-border pb-2">
        <span className="text-platform-fg-secondary">仿真时间</span>
        <span className="font-mono text-platform-fg-primary">{state.time.toFixed(1)}s</span>
      </div>

      {/* 航向信息 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-platform-fg-secondary">当前航向</div>
          <div className="font-mono text-lg text-platform-fg-primary">{state.heading.toFixed(1)}°</div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-secondary">航向误差</div>
          <div className={`font-mono text-lg ${Math.abs(normalizedError) > 5 ? 'text-[hsl(var(--platform-brand-danger))]' : 'text-[hsl(var(--platform-brand-success))]'}`}>
            {normalizedError.toFixed(1)}°
          </div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-secondary">转艏角速度</div>
          <div className="font-mono text-platform-fg-primary">{state.yawRate.toFixed(2)}°/s</div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-secondary">舵角</div>
          <div className="font-mono text-platform-fg-primary">{state.rudder.toFixed(1)}°</div>
        </div>
      </div>

      {/* 横摇警告 */}
      {Math.abs(toDegrees(state.rollAngle)) > 8 && (
        <div className="mb-3 rounded bg-[hsl(var(--platform-brand-danger)/0.18)] p-2 text-center text-[hsl(var(--platform-brand-danger))]">
          ⚠️ 横摇角过大: {toDegrees(state.rollAngle).toFixed(1)}° - 落箱风险!
        </div>
      )}

      {/* 系统参数 */}
      <div className="mb-3 rounded border border-platform-border bg-platform-surface-overlay/86 p-2">
        <div className="mb-1 text-xs font-semibold text-platform-fg-secondary">当前系统参数</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>K = {state.currentK.toFixed(3)}</div>
          <div>T = {state.currentT.toFixed(0)}s</div>
          <div>装载 = {(state.loadRatio * 100).toFixed(0)}%</div>
          <div>航速 = {state.speed.toFixed(1)} m/s</div>
        </div>
      </div>

      {/* 风载荷 */}
      <div className="rounded border border-platform-border bg-platform-surface-overlay/86 p-2">
        <div className="mb-1 text-xs font-semibold text-platform-fg-secondary">风载荷</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>风速 = {state.windSpeed.toFixed(1)} m/s</div>
          <div>风向 = {state.windDirection.toFixed(0)}°</div>
          <div>横摇 = {toDegrees(state.rollAngle).toFixed(1)}°</div>
          <div className={state.windSpeed > 15 ? 'text-[hsl(var(--platform-brand-evidence))]' : ''}>
            {state.windSpeed > 20 ? '⚠️ 风速超限' : state.windSpeed > 15 ? '注意大风' : '正常'}
          </div>
        </div>
      </div>
    </div>
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
function ContainerWater({ state, resetToken }: { state: ContainerSimulationState; resetToken: number }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <GerstnerWater
      resetToken={resetToken}
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
  state: ContainerSimulationState;
  playing: boolean;
  resetToken: number;
}) {
  const environmentLight = useEnvironmentWaterColors();
  const { wakeVisible } = useSceneEnvironment();
  const transformRef = useRef({ position: [0, 0, 0] as [number, number, number], heading: 0 });
  const { tier } = useSceneQuality();

  useFrame((frameState) => {
    transformRef.current.position = [state.position.x, 0, state.position.z];
    transformRef.current.heading = platformHeadingToSceneRad(state.heading);
  });

  // 统一水高采样（#2117）：共享视觉时钟 + 与 GPU 同一表面定义（含岸线衰减）。
  const waterYSampler = useNearFieldWaterHeight({
    positionSampler: () => ({ x: state.position.x, z: state.position.z }),
    seaState: 3,
    shoreSegments: MARINE_SCENE_LAYOUTS['harbor-entrance-channel'].shoreSegments,
  });

  if (!wakeVisible) return null;
  return (
    <WakeTrail
      sunDirection={environmentLight.sunDirection}
      sunIllumination={environmentLight.sunIllumination}
      key={resetToken}
      profile={containerMscSceneVisual}
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

// ============ 3D 场景组件 ============

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
  state: ContainerSimulationState;
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
      <PerspectiveCamera makeDefault position={[-500, 200, 500]} fov={60} near={1} far={50000} />

      <Suspense fallback={null}>
        <EnvironmentScene subjectPositionSampler={() => ({ x: state.position.x, z: state.position.z })} />
        <MarineSceneLayoutObjects layoutId="harbor-entrance-channel" />
      </Suspense>
      <SoundscapeAmbienceDriver />
      <SceneQualityDriver />
        <MarinePerformanceEvidenceProbe contextInput={() => ({ vesselId: 'container', cameraView: String(cameraMode), seaState: 3 })} />
      <Suspense fallback={null}>
        <ContainerWater state={state} resetToken={resetToken} />
      </Suspense>

      {/* 参考网格 */}
      {showGrid ? (
        <Grid name="marine-grid"
          args={[20000, 20000]}
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

      {/* 航迹线 */}
      <TrajectoryLine points={trajectory} waterOriginSampler={() => ({ x: state.position.x, z: state.position.z })} />

      {/* 风向指示器（风场控制联动的实验仪器，常驻） */}
      <WindIndicator
        position={state.position}
        windDirection={toRadians(state.windDirection)}
        windSpeed={state.windSpeed}
      />

      {/* 航向指示器（教学标注门控，默认关闭） */}
      <TeachingAnnotationsGate
        position={state.position}
        targetHeading={state.targetHeading}
        currentHeading={state.heading}
      />

      {/* 集装箱船模型 */}
      <Suspense
        fallback={(
          <ModelLoadingPlaceholder
            label="集装箱船模型加载中"
            sublabel="场景已就绪，可先查看风场与航向参考"
          />
        )}
      >
        <ContainerShipModel
          position={state.position}
          heading={toRadians(state.heading)}
          rollAngle={state.rollAngle}
          loadRatio={state.loadRatio}
          simRef={simRef}
          resetToken={resetToken}
        />
      </Suspense>

      <WakeTrailRig state={state} playing={state.isRunning && !state.isPaused} resetToken={resetToken} />

      {/* 相机控制 */}
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        minDistance={200}
        maxDistance={5000}
        maxPolarAngle={Math.PI / 2.1}
      />
      <RightClickFreeModeBridge onRequestFreeMode={() => onCameraModeChange('free')} />
      <StayPutCameraController
        view={cameraMode}
        positionSampler={() => ({ x: state.position.x, z: state.position.z })}
        headingSampler={() => platformHeadingToSceneRad(state.heading)}
        shipLength={containerMscSceneVisual.shipLengthMeters}
        controlsRef={controlsRef}
      resetSignal={resetSignal}
      />
      <ScenePostEffects />
    </>
  );
}

// ============ 主仿真组件 ============

export default function ContainerSimulation() {
  const timeRef = useRef(0);
  // 仿真引擎
  const engineRef = useRef<ContainerShipEngine | null>(null);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const clockRef = useRef(
    new SimulationClock({
      dt: SIMULATION_FIXED_STEP_SECONDS,
      maxSubSteps: SIMULATION_MAX_SUB_STEPS,
    })
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);
  // 循环稳定化（issue 1945）：每帧变化的量走 ref，仿真时钟真源在 timeRef，
  // 循环回调与启动 effect 引用稳定，运行期间不因状态更新 teardown 重建。
  const controlRef = useRef({
    isPaused: false,
    targetHeading: 0,
    controlMode: 'pid_scheduled' as ContainerSimulationState['controlMode'],
    speed: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
  });
  const speedScaleRef = useRef(1);
  const lastHudUpdateRef = useRef(0);
  const bindingRef = useRef<BindingTelemetrySource>({
    rudderDeg: 0,
    speedMps: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
    attainedCount: 0,
    advancing: false,
  });
  const attainmentRef = useRef(createAttainmentState(0));

  // 相机状态
  const [cameraMode, setCameraMode] = useState<string>('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(1);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const sceneTheme = useSimulationSceneTheme();

  // 轨迹记录
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);

  // 仿真状态
  const [simState, setSimState] = useState<ContainerSimulationState>({
    isRunning: false,
    isPaused: false,
    time: 0,
    position: { x: 0, z: 0 },
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
    loadRatio: 0.5,
    rollAngle: 0,
    windSpeed: 10,
    windDirection: 90,
    targetHeading: 0,
    controlMode: 'pid_scheduled',
    gainSchedulingEnabled: true,
    currentK: 0.08,
    currentT: 80,
  });

  // 初始化引擎
  useEffect(() => {
    preloadVirtualSimulationRuntime().catch(console.error);

    const engine = createSimulationEngine(containerMscProfile) as ContainerShipEngine;
    engine.initialize(0, 0, 0);
    engine.setLoadRatio(0.5);
    engine.setWindEnvironment(10, 90, false);
    engineRef.current = engine;

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  // 仿真循环
  const simulationLoop = useCallback(() => {
    const engine = engineRef.current;
    const control = controlRef.current;
    if (!engine || control.isPaused || !isVirtualSimulationRuntimeReady()) {
      frameRef.current = requestAnimationFrame(simulationLoop);
      return;
    }

    const now = performance.now();
    const frameDt = getSimulationDeltaFromMilliseconds(now, lastTimeRef.current, speedScaleRef.current);
    lastTimeRef.current = now;

    let nextTime = timeRef.current;
    let nextState: SimulationState | null = engine.getState(nextTime);
    let summary: ReturnType<typeof engine.getContainerShipSummary> =
      engine.getContainerShipSummary();

    clockRef.current.advance(frameDt, (dt) => {
      const stepTime = nextTime + dt;
      engine.step(
        control.targetHeading,
        null,
        control.controlMode,
        0,
        control.speed,
        dt,
        stepTime
      );
      nextTime = stepTime;
      nextState = engine.getState(stepTime);
      summary = engine.getContainerShipSummary();
      const headingError = absoluteHeadingErrorDeg(nextState.heading, control.targetHeading);
      let attainedCount = bindingRef.current.attainedCount;
      if (advanceAttainment(attainmentRef.current, control.targetHeading, headingError, 5, dt)) {
        attainedCount += 1;
      }
      bindingRef.current = {
        rudderDeg: nextState.rudder,
        speedMps: nextState.speed,
        attainedCount,
        advancing: !control.isPaused,
      };
    });

    if (nextState) {
      const nextPosition = nextState.position;
      const nextHeading = nextState.heading;
      const nextYawRate = nextState.yawRate;
      const nextRudder = nextState.rudder;
      const nextRollAngle = nextState.waveRoll;

      if (Math.floor(timeRef.current) !== Math.floor(nextTime)) {
        setTrajectory(prev => [...prev.slice(-300), nextPosition]);
      }
      timeRef.current = nextTime;

      // HUD/图表 setState 0.1s 节流（对齐 destroyer 口径）；被跳过的帧
      // 仅推进 timeRef，不再触发整树渲染。
      if (nextTime - lastHudUpdateRef.current > 0.1) {
        lastHudUpdateRef.current = nextTime;
        setSimState(prev => ({
          ...prev,
          time: nextTime,
          position: nextPosition,
          heading: nextHeading,
          yawRate: nextYawRate,
          rudder: nextRudder,
          rollAngle: nextRollAngle,
          currentK: summary.currentK,
          currentT: summary.currentT,
        }));
      }
    }

    frameRef.current = requestAnimationFrame(simulationLoop);
  }, []);

  // 控制量同步到 ref：低频、由 UI 事件驱动，rAF 循环每帧读取最新值。
  useEffect(() => {
    controlRef.current = {
      isPaused: simState.isPaused,
      targetHeading: simState.targetHeading,
      controlMode: simState.controlMode,
      speed: simState.speed,
    };
  }, [simState.isPaused, simState.targetHeading, simState.controlMode, simState.speed]);
  useEffect(() => {
    speedScaleRef.current = speedScale;
  }, [speedScale]);

  // 启动/停止仿真
  useEffect(() => {
    if (simState.isRunning && !simState.isPaused) {
      clockRef.current.reset();
      lastTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame(simulationLoop);
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [simState.isRunning, simState.isPaused, simulationLoop]);

  // 事件处理
  const handleStart = () => {
    setSimState(prev => ({ ...prev, isRunning: true, isPaused: false }));
  };

  const handlePause = () => {
    setSimState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleReset = () => {
    const engine = engineRef.current;
    if (engine) {
      engine.initialize(0, 0, 0);
      engine.setLoadRatio(0.5);
    }
    timeRef.current = 0;
    lastHudUpdateRef.current = 0;
    attainmentRef.current = createAttainmentState(0);
    bindingRef.current = {
      rudderDeg: 0,
      speedMps: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
      attainedCount: 0,
      advancing: false,
    };
    setTrajectory([]);
    setSimState({
      isRunning: false,
      isPaused: false,
      time: 0,
      position: { x: 0, z: 0 },
      heading: 0,
      yawRate: 0,
      rudder: 0,
      speed: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
      loadRatio: 0.5,
      rollAngle: 0,
      windSpeed: 10,
      windDirection: 90,
      targetHeading: 0,
      controlMode: 'pid_scheduled',
      gainSchedulingEnabled: true,
      currentK: 0.08,
      currentT: 80,
    });
    setResetCount((previous) => previous + 1);
  };

  const handleTargetHeadingChange = (heading: number) => {
    setSimState(prev => ({ ...prev, targetHeading: heading }));
  };

  const handleControlModeChange = (mode: ControlMode) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setGainSchedulingEnabled(mode === 'pid_scheduled');
    }
    setSimState(prev => ({
      ...prev,
      controlMode: mode,
      gainSchedulingEnabled: mode === 'pid_scheduled',
    }));
  };

  const handleLoadRatioChange = (ratio: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setLoadRatio(ratio);
    }
    setSimState(prev => ({ ...prev, loadRatio: ratio }));
  };

  const handleWindSpeedChange = (speed: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setWindEnvironment(speed, simState.windDirection, false);
    }
    setSimState(prev => ({ ...prev, windSpeed: speed }));
  };

  const handleWindDirectionChange = (direction: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setWindEnvironment(simState.windSpeed, direction, false);
    }
    setSimState(prev => ({ ...prev, windDirection: direction }));
  };

  const handleGainSchedulingToggle = () => {
    const engine = engineRef.current;
    const newEnabled = !simState.gainSchedulingEnabled;
    if (engine) {
      engine.setGainSchedulingEnabled(newEnabled);
    }
    setSimState(prev => ({ ...prev, gainSchedulingEnabled: newEnabled }));
  };

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      <Canvas shadows={{ type: THREE.PCFShadowMap }} gl={{ antialias: true }}>
        <Scene
          state={simState}
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
            content: <HUD state={simState} />,
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
                state={simState}
                onTargetHeadingChange={handleTargetHeadingChange}
                onControlModeChange={handleControlModeChange}
                onLoadRatioChange={handleLoadRatioChange}
                onWindSpeedChange={handleWindSpeedChange}
                onWindDirectionChange={handleWindDirectionChange}
                onGainSchedulingToggle={handleGainSchedulingToggle}
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleReset}
              />
            ),
          },
          {
            id: 'evaluate',
            label: '评估',
            content: (
              <SimulationAssessmentPanel
                title="航线控制评估"
                metrics={[
                  { id: 'heading-error', label: '航向误差', value: Math.abs(simState.targetHeading - simState.heading), max: 40, better: 'lower', unit: '°' },
                  { id: 'roll', label: '横摇角', value: Math.abs(toDegrees(simState.rollAngle)), max: 12, better: 'lower', unit: '°' },
                  { id: 'wind', label: '风速工况', value: simState.windSpeed, max: 25, better: 'lower', unit: 'm/s' },
                  { id: 'load-stability', label: '装载适配', value: 100 - Math.abs(simState.loadRatio - 0.6) * 100, max: 100, better: 'higher', unit: '%' },
                ]}
              />
            ),
          },
        ]}
      />

      <SimulationTopBar
        title="MSC Tessa 超大型集装箱船"
        subtitle="变质量模型 · 风载荷耦合 · 增益调度"
        badge="Container / OBE"
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
