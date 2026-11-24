'use client';
import { MarineGrid as Grid } from '../scene/lines/marine-grid';
import { MarineLine as Line } from '@/resources/simulations/scene/lines/marine-line';

/**
 * 集装箱船仿真组件
 * MSC Tessa 超大型集装箱船 - 变质量 + 风载荷 + 增益调度
 */

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  OrbitControls,
  PerspectiveCamera,
  } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Compass, Video, Orbit, ArrowDownFromLine, Gauge, Wind } from 'lucide-react';
import {
  SimChip,
  SimNotice,
  SimPanelSection,
  SimPanelStack,
  SimReadout,
  SimReadoutGrid,
  SimStatusStrip,
  simToneForMagnitude,
} from '../components/simulation-panels';
import { MarineCanvas } from '../scene/marine-canvas';
import { MarineWater } from '../scene/water/marine-water';
import { SimulationClock } from '@/lib/simulation';
import { VersionedFleetShip } from '@/resources/simulations/components/versioned-fleet-ship';
import type { BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, SimulationAssessmentPanel, simulationUi } from '../components/simulation-ui';
import { useSimulationSceneTheme, simulationScenePalette, type SimulationSceneTheme } from '../components/simulation-theme';
import {
  EnvironmentScene,
  MARINE_SCENE_LAYOUTS,
  MarineSceneLayoutObjects,
  SceneEnvironmentProvider,
  useEnvironmentWaterColors,
} from '../scene/environment';
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

import type { ControlMode, Vector2 } from '../core/types';
import { containerCourseExperiment as containerExperiment } from '../experiments/container-experiment';
import { containerCourseAdapter, containerCourseTraceSamples } from '../experiments/container-course';
import { ContainerCourseControls } from '../experiments/container-course-controls';
import { computeContainerTradeoffMetrics } from '../experiments/container-voyage-tradeoff';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { vesselSampleMark } from './vessel-experiment';
import { VesselCourseEvidencePanel, VesselExperimentDocks } from './vessel-experiment-panels';
import { useVesselExperiment } from './use-vessel-experiment';
import { toDegrees, toRadians, CONTAINER_MSC_PARAMS } from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';

// ============ 类型定义 ============

interface ContainerSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  pitchAngle: number;
  heaveM: number;
  draftM: number;
  seaState: number;
  massKg: number;
  gmM: number | null;
  windAreas?: {frontal: number; lateral: number};
  powerW: number;
  fuelKg: number;
  voyage?: VesselSessionFrame['containerVoyage'];
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
  speedError: number;
}

// ============ 集装箱船模型组件 ============

function ContainerShipModel(props: {
  position: Vector2;
  heading: number;
  rollAngle: number;
  draftM: number;
  heaveM: number;
  pitchAngle: number;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
}) {
  return (
    <group position={[0, 16.8 - props.draftM, 0]}><VersionedFleetShip
      logicalId="container"
      simRef={props.simRef}
      position={props.position}
      waterY={props.heaveM}
      headingRad={props.heading}
      extraEuler={{ x: props.pitchAngle, z: props.rollAngle }}
      sceneLengthMeters={CONTAINER_MSC_PARAMS.LENGTH}
      resetToken={props.resetToken}
      legacyYawOffsetRad={0}
      fallbackDraftMeters={props.draftM}
      verticalOffsetMeters={0}
    /></group>
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

// ============ HUD 组件 ============

function HUD({ state, stepSequence }: { state: ContainerSimulationState; stepSequence: number }) {
  const headingError = state.targetHeading - state.heading;
  const normalizedError = headingError > 180 ? headingError - 360 : headingError < -180 ? headingError + 360 : headingError;

  const rollDeg = toDegrees(state.rollAngle);
  const windTone = state.windSpeed > 20 ? 'danger' : state.windSpeed > 15 ? 'warning' : 'success';
  return (
    <SimPanelStack>
      <SimStatusStrip
        state={state.isCompleted ? 'completed' : !state.isRunning ? state.time > 0 ? 'paused' : 'idle' : 'running'}
        time={`${state.time.toFixed(1)} s`}
      />
      <SimPanelSection title="航向状态" icon={Compass}>
        <SimReadoutGrid>
          <SimReadout label="当前航向" value={state.heading.toFixed(1)} unit="°" size="lg" />
          <SimReadout label="航向误差" value={normalizedError.toFixed(1)} unit="°" size="lg" tone={simToneForMagnitude(normalizedError, 5, 5)} />
          <SimReadout label="转艏角速度" value={state.yawRate.toFixed(2)} unit="°/s" />
          <SimReadout label="舵角" value={state.rudder.toFixed(1)} unit="°" />
        </SimReadoutGrid>
      </SimPanelSection>
      {Math.abs(rollDeg) > 8 ? (
        <SimNotice tone="danger" title={`横摇角过大：${rollDeg.toFixed(1)}°`}>有落箱风险，请减小舵角或降低航速。</SimNotice>
      ) : null}
      <SimPanelSection title="当前装载与航速" icon={Gauge}>
        <SimReadoutGrid>
          {stepSequence >= 7 && stepSequence <= 19 ? (
            <>
              <SimReadout label="当前本人模型增益" value={Number.isFinite(state.currentK) ? state.currentK.toFixed(4) : '尚未选择'} />
              <SimReadout label="当前本人模型时间常数" value={Number.isFinite(state.currentT) ? state.currentT.toFixed(1) : '尚未选择'} unit="s" />
            </>
          ) : null}
          <SimReadout label="质量" value={(state.massKg / 1e6).toFixed(3)} unit="千吨" />
          <SimReadout label="吃水" value={state.draftM.toFixed(2)} unit="m" />
          <SimReadout label="横稳心高" value={state.gmM?.toFixed(3) ?? '—'} unit="m" />
          <SimReadout label="侧向风面积" value={state.windAreas?.lateral.toFixed(1) ?? '—'} unit="m²" />
          <SimReadout label="正向风面积" value={state.windAreas?.frontal.toFixed(1) ?? '—'} unit="m²" />
          <SimReadout label="装载" value={(state.loadRatio * 100).toFixed(0)} unit="%" />
          <SimReadout label="航速" value={state.speed.toFixed(1)} unit="m/s" />
        </SimReadoutGrid>
      </SimPanelSection>
      {stepSequence >= 11 && stepSequence <= 19 ? (
        <SimPanelSection title="航程与教学估计燃油" icon={Gauge}>
          <SimReadoutGrid>
            <SimReadout label="北向实际航程" value={state.position.x.toFixed(1)} unit="m" />
            <SimReadout label="当前轴功率" value={(state.powerW / 1e6).toFixed(2)} unit="MW" />
            <SimReadout label="累计燃油" value={state.fuelKg.toFixed(2)} unit="kg" />
            <SimReadout label="累计横偏峰值" value={state.voyage?.progress.maximumCrossTrackM.toFixed(2) ?? '—'} unit="m" />
            <SimReadout label="末段航向平均误差" value={state.voyage?.meanFinalHeadingErrorDeg.toFixed(3) ?? '—'} unit="°" />
          </SimReadoutGrid>
          {state.voyage?.progress.termination ? <p className="mt-2 text-xs text-platform-fg-secondary">
            {state.voyage.progress.termination.reason === 'arrived' ? '已实际到达' : '航次达到运行时限'}，
            {state.voyage.eligibleForFuelComparison ? '满足本教学航次的燃油比较条件。' : '需结合到达时间、末速、横偏和航向约束解释结果。'}
          </p> : null}
          <p className="mt-2 text-xs text-platform-fg-secondary">燃油采用教学发动机曲线，实际轴功率积分保留推进、制动和怠速影响。</p>
        </SimPanelSection>
      ) : null}
      <SimPanelSection
        title="相对风量测"
        icon={Wind}
        tone={windTone === 'success' ? 'neutral' : windTone}
        aside={<SimChip tone={windTone}>{state.windSpeed > 20 ? '风速超限' : state.windSpeed > 15 ? '注意大风' : '正常'}</SimChip>}
      >
        <SimReadoutGrid columns={3}>
          <SimReadout label="相对风速" value={state.windSpeed.toFixed(1)} unit="m/s" />
          <SimReadout label="相对风向" value={state.windDirection.toFixed(0)} unit="°" />
          <SimReadout label="横摇" value={rollDeg.toFixed(1)} unit="°" tone={simToneForMagnitude(rollDeg, 5, 8, 'neutral')} />
        </SimReadoutGrid>
      </SimPanelSection>
    </SimPanelStack>
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
    <MarineWater
      worldSpeedSampler={() => state.isRunning && !state.isPaused ? state.speed : 0}
      vesselLengthMeters={399.9} vesselBeamMeters={61.5}
      resetToken={resetToken}
      tier={params.waterTier}
      positionSampler={() => ({ x: state.position.x, z: state.position.z })}
      shipHeadingSampler={() => platformHeadingToSceneRad(state.heading)}
      shoreSegments={MARINE_SCENE_LAYOUTS['harbor-entrance-channel'].shoreSegments}
      waterColor={water.waterColor}
      deepColor={water.deepColor}
      horizonColor={water.horizonColor}
      foamColor={simulationScenePalette.waterFoam}
      seaState={state.seaState}
      sunDirection={water.sunDirection}
      sunIllumination={water.sunIllumination}
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
          draftM={state.draftM}
          heaveM={state.heaveM}
          pitchAngle={state.pitchAngle}
          simRef={simRef}
          resetToken={resetToken}
        />
      </Suspense>


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

function containerStateFromFrame(frame: VesselSessionFrame, running: boolean, completed: boolean): ContainerSimulationState {
  const actual = frame.truth.actuator_states;
  const controller = frame.containerController;
  const models = frame.input.containerSpeed?.models;
  const weights = controller?.modelWeights;
  const weighted = (property: 'k' | 't_s') => models && weights ? models.reduce((sum, model, index) =>
    sum + weights[index] * (model.operatingModel.structure.kind === 'fopdt' ? model.operatingModel.structure[property] : NaN), 0) : NaN;
  const wind = frame.samples.find((sample) => sample.signal === 'WindSpeed')?.measurement.value;
  const direction = frame.samples.find((sample) => sample.signal === 'WindDirection')?.measurement.value;
  return {isRunning: running, isPaused: !running && frame.timeS > 0 && !completed, isCompleted: completed,
    time: frame.timeS, position: {x: frame.truth.position_ned[0], z: frame.truth.position_ned[1]},
    heading: frame.attitudeDeg.heading, yawRate: frame.truth.body_velocity[5] * 180 / Math.PI,
    rudder: (actual.control_surface_angles_rad[0] ?? 0) * 180 / Math.PI, speed: frame.waterVelocityBody[0],
    loadRatio: 0, rollAngle: toRadians(frame.attitudeDeg.roll), pitchAngle: toRadians(frame.attitudeDeg.pitch),
    heaveM: -frame.truth.position_ned[2], draftM: frame.parameters.draftM, seaState: frame.waveModel?.firstOrderEnabled ? 3 : 0,
    massKg: frame.parameters.massKg, gmM: frame.parameters.effectiveGmTransverseM, windAreas: frame.parameters.windAreasM2,
    powerW: actual.motor_torques_nm.reduce((sum, torque, index) => sum + torque * actual.propeller_shaft_speed_rad_s[index], 0),
    fuelKg: frame.teachingFuel?.state.fuel_kg ?? 0, voyage: frame.containerVoyage,
    windSpeed: wind ?? 0, windDirection: direction ?? 0, targetHeading: frame.headingReferenceDeg ?? frame.input.targetHeadingDeg,
    controlMode: frame.input.controlMode, gainSchedulingEnabled: frame.input.containerSpeed?.schedulingEnabled ?? false,
    currentK: weighted('k'), currentT: weighted('t_s'),
    speedError: controller?.errorMps ?? 0};
}

export default function ContainerSimulation({ ticket = '' }: { ticket?: string }) {
  const session = useVesselExperiment(containerExperiment, ticket, containerCourseAdapter);
  const sessionRef = useRef(session); sessionRef.current = session;
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const lastHudUpdateRef = useRef(0);
  const lastTrajectoryRef = useRef(0);
  const markRef = useRef(-1);
  const clockRef = useRef(new SimulationClock({dt: SIMULATION_FIXED_STEP_SECONDS, maxSubSteps: SIMULATION_MAX_SUB_STEPS}));
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const speedScaleRef = useRef(8);
  const bindingRef = useRef<BindingTelemetrySource>({rudderDeg: 0, speedMps: 8, attainedCount: 0, advancing: false});
  const [cameraMode, setCameraMode] = useState('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(8);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const sceneTheme = useSimulationSceneTheme();
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);
  const [simState, setSimState] = useState<ContainerSimulationState>({isRunning: false, isPaused: false, isCompleted: false,
    time: 0, position: {x: 0, z: 0}, heading: 0, yawRate: 0, rudder: 0, speed: 8, loadRatio: .6,
    rollAngle: 0, pitchAngle: 0, heaveM: 0, draftM: 16.8, seaState: 0, massKg: 216e6, gmM: 2,
    powerW: 0, fuelKg: 0, windSpeed: 0, windDirection: 0, targetHeading: 0,
    controlMode: 'pd', gainSchedulingEnabled: false, currentK: NaN, currentT: NaN, speedError: 0});

  useEffect(() => {
    const course = sessionRef.current.course;
    const frame = course?.ready ? course.read() : null;
    if (!frame || !course) return;
    const next = containerStateFromFrame(frame, false, course.completed);
    next.loadRatio = containerCourseAdapter.configuration(sessionRef.current.activeSeq, course.settings).loadingRatio ?? .6;
    setSimState(next); setTrajectory([]); setResetCount((value) => value + 1);
    clockRef.current.reset(); lastTimeRef.current = 0;
    lastHudUpdateRef.current = frame.timeS; lastTrajectoryRef.current = frame.timeS;
    markRef.current = vesselSampleMark(frame.timeS);
  }, [session.course?.ready, session.activeSeq]);

  const simulationLoop = useCallback((timestamp: number) => {
    const current = sessionRef.current;
    const course = current.course;
    if (!course?.ready || !course.running) return;
    const elapsed = getSimulationDeltaFromMilliseconds(timestamp, lastTimeRef.current, speedScaleRef.current);
    lastTimeRef.current = timestamp;
    let frame = course.read();
    clockRef.current.advance(elapsed, (dt) => {
      if (!course.running) return;
      frame = course.advance(dt);
      if (!frame) return;
      const point = course.latestPoint();
      if (point) {
        const sample = containerCourseTraceSamples([point])[0];
        current.trackLatest(sample);
        const mark = vesselSampleMark(frame.timeS);
        if (mark > markRef.current || !course.running) {markRef.current = Math.max(markRef.current, mark); current.observe(sample);}
      }
      bindingRef.current = {rudderDeg: (frame.truth.actuator_states.control_surface_angles_rad[0] ?? 0) * 180 / Math.PI,
        speedMps: frame.waterVelocityBody[0], attainedCount: 0, advancing: course.running};
    });
    if (frame && (frame.timeS - lastHudUpdateRef.current >= .1 || frame.paused)) {
      const next = containerStateFromFrame(frame, course.running, course.completed);
      next.loadRatio = containerCourseAdapter.configuration(current.activeSeq, course.settings).loadingRatio ?? .6;
      setSimState(next); lastHudUpdateRef.current = frame.timeS;
    }
    if (frame && frame.timeS - lastTrajectoryRef.current >= .5) {
      lastTrajectoryRef.current = frame.timeS;
      const position = {x: frame.truth.position_ned[0], z: frame.truth.position_ned[1]};
      setTrajectory((previous) => [...previous.slice(-1200), position]);
    }
    if (course.running) frameRef.current = requestAnimationFrame(simulationLoop);
  }, []);

  useEffect(() => {speedScaleRef.current = speedScale;}, [speedScale]);
  useEffect(() => {
    if (session.course?.running) {
      clockRef.current.reset(); lastTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame(simulationLoop);
    } else {
      const course = sessionRef.current.course;
      const frame = course?.read();
      if (frame && course) {
        const next = containerStateFromFrame(frame, false, course.completed);
        next.loadRatio = containerCourseAdapter.configuration(sessionRef.current.activeSeq, course.settings).loadingRatio ?? .6;
        setSimState(next);
      }
      bindingRef.current = {...bindingRef.current, advancing: false};
    }
    return () => {if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);};
  }, [session.course?.running, simulationLoop]);

  const assessmentTradeoff = computeContainerTradeoffMetrics({
    timeS: simState.time,
    positionX: simState.position.x,
    speedMps: simState.speed,
    powerW: simState.powerW,
    fuelKg: simState.fuelKg,
    rudderDeg: simState.rudder,
    voyage: simState.voyage,
  });

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
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
      </MarineCanvas>

      <VesselExperimentDocks
        experiment={containerExperiment}
        session={session}
        status={<HUD state={simState} stepSequence={session.step.seq} />}
        controls={<ContainerCourseControls session={session} timeS={simState.time} />}
        assessment={(
          <div className="space-y-4">
            <VesselCourseEvidencePanel
              session={session}
              courseKey="container"
              stepSequence={session.step.seq}
              defaultChannel="shaft-reference-to-speed"
            />
            {session.step.seq >= 7 && session.step.seq <= 19 ? (
              <SimulationAssessmentPanel
                pendingReview
                title="航速与航次评估"
                metrics={[
                  { id: 'speed-error', label: '航速跟踪偏差', value: Math.abs(simState.speedError), max: 2, better: 'lower', unit: 'm/s', precision: 2 },
                  { id: 'voyage-eta', label: '6000m 进度 / ETA', value: assessmentTradeoff.projectedEtaS ?? 900, max: 1200, better: 'lower', unit: 's', precision: 1 },
                  { id: 'teaching-fuel', label: '累计教学油耗', value: simState.fuelKg, max: 6000, better: 'lower', unit: 'kg', precision: 1 },
                  { id: 'cross-track', label: '航迹横偏', value: Math.abs(simState.voyage?.progress.maximumCrossTrackM ?? simState.position.z), max: 150, better: 'lower', unit: 'm', precision: 1 },
                ]}
              />
            ) : null}
            <p className="text-xs leading-5 text-platform-fg-secondary">采用冻结教学标称参数与代表波浪工况，燃油属于教学估计。本人局部模型的残差及调度超域随证据保存。</p>
          </div>
        )}
      />

      <SimulationTopBar
        title="MSC 集装箱船航速与准点"
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
