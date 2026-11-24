'use client';
import { MarineGrid as Grid } from '../scene/lines/marine-grid';
import { MarineLine as Line } from '@/resources/simulations/scene/lines/marine-line';

/**
 * LNG 船仿真组件
 * 长恒系列 LNG 运输船 - 带时滞和液货晃荡的高保真仿真
 */

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  OrbitControls,
  PerspectiveCamera,
  } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Compass, Video, Orbit, ArrowDownFromLine, Droplets, Timer } from 'lucide-react';
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
import {
  SimNotice,
  SimPanelSection,
  SimPanelStack,
  SimReadout,
  SimReadoutGrid,
  SimStatusStrip,
  simToneForMagnitude,
  type SimRunState,
} from '../components/simulation-panels';
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
import { lngChanghengSceneVisual } from '../profiles/lng-changheng-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';

import type {
  ControlMode,
  Vector2,
} from '../core/types';
import { lngCourseExperiment as lngExperiment } from '../experiments/lng-experiment';
import { LngCourseControls } from '../experiments/lng-course-controls';
import type { VesselSessionFrame, VesselFineStepMetrics } from '@/lib/control-engine/vessel-session';
import { vesselSampleMark } from './vessel-experiment';
import { VesselCourseEvidencePanel, VesselExperimentDocks } from './vessel-experiment-panels';
import { useVesselExperiment } from './use-vessel-experiment';
import { toRadians, LNG_CHANGHENG_PARAMS } from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';

// ============ 类型定义 ============

interface LNGSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  time: number;
  position: Vector2;
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  sloshHeightM: number;
  liquidWithinDomain: boolean;
  liquidDepthM: number;
  rollRad: number;
  pitchRad: number;
  heaveM: number;
  draftM: number;
  shaftRpm: number;
  referenceRpm: number;
  bowDistanceM: number | null;
  targetHeading: number;
  controlMode: ControlMode;
  smithEnabled: boolean;
  seaState: number;
  lngMetrics?: VesselFineStepMetrics['lng'];
}

// ============ LNG 船模型组件 ============

function LNGShipModel(props: {
  position: Vector2;
  heading: number;
  rollRad: number;
  pitchRad: number;
  heaveM: number;
  draftM: number;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
}) {
  return (
    <group position={[0, 11.5 - props.draftM, 0]}>
    <VersionedFleetShip
      logicalId="lng-carrier"
      simRef={props.simRef}
      position={props.position}
      waterY={props.heaveM}
      headingRad={props.heading}
      extraEuler={{ x: props.pitchRad, z: props.rollRad }}
      sceneLengthMeters={299}
      resetToken={props.resetToken}
      legacyYawOffsetRad={-Math.PI / 2}
      fallbackDraftMeters={LNG_CHANGHENG_PARAMS.DRAFT}
    />
    </group>
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
      <Line name="marine-annotations"
        points={[[position.x, 5, position.z], targetEnd]}
        color={simulationScenePalette.headingSecondary}
        lineWidth={2}
        dashed
        dashSize={20}
        gapSize={10}
      />
      <Line name="marine-annotations" points={[targetWings.left, targetEnd]} color={simulationScenePalette.headingSecondary} lineWidth={2} />
      <Line name="marine-annotations" points={[targetWings.right, targetEnd]} color={simulationScenePalette.headingSecondary} lineWidth={2} />
      {/* 当前航向 (深蓝实线箭头) */}
      <Line name="marine-annotations"
        points={[[position.x, 5, position.z], currentEnd]}
        color={simulationScenePalette.headingPrimary}
        lineWidth={3}
      />
      <Line name="marine-annotations" points={[currentWings.left, currentEnd]} color={simulationScenePalette.headingPrimary} lineWidth={3} />
      <Line name="marine-annotations" points={[currentWings.right, currentEnd]} color={simulationScenePalette.headingPrimary} lineWidth={3} />
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
function LNGWater({ state, resetToken }: { state: LNGSimulationState; resetToken: number }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <MarineWater
      worldSpeedSampler={() => state.isRunning && !state.isPaused ? state.speed : 0}
      vesselLengthMeters={299} vesselBeamMeters={46.4}
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

// ============ HUD 组件 ============

function StatusPanel({
  state,
}: {
  state: LNGSimulationState;
}) {
  const headingError = state.heading - state.targetHeading;
  const cargoAlarm = !state.liquidWithinDomain;
  return (
    <SimPanelStack>
      <SimStatusStrip state={runStateOf(state)} time={`${state.time.toFixed(1)} s`} />
      <SimPanelSection title="航向状态" icon={Compass}>
        <SimReadoutGrid>
          <SimReadout label="航向真值" value={state.heading.toFixed(1)} unit="°" size="lg" />
          <SimReadout label="目标航向" value={state.targetHeading.toFixed(1)} unit="°" size="lg" tone="accent" />
          <SimReadout label="航向误差" value={headingError.toFixed(1)} unit="°" tone={simToneForMagnitude(headingError, 5)} />
          <SimReadout label="转艏率" value={state.yawRate.toFixed(2)} unit="°/s" />
          <SimReadout label="舵角" value={state.rudder.toFixed(1)} unit="°" />
          <SimReadout label="航速" value={state.speed.toFixed(2)} unit="m/s" />
        </SimReadoutGrid>
      </SimPanelSection>
      {state.lngMetrics ? <SimPanelSection title="本次运行与液面统计" icon={Droplets}>
        <SimReadoutGrid>
          <SimReadout label="全程液面峰值" value={state.lngMetrics.maximumCornerHeightM.toFixed(3)} unit="m" />
          <SimReadout label="全程液面均方根" value={state.time > 0
            ? Math.sqrt(state.lngMetrics.cornerHeightSquaredIntegralM2S / state.time).toFixed(3) : '—'} unit="m" />
          <SimReadout label="超出小幅适用域" value={state.lngMetrics.outsideLiquidDomainDurationS.toFixed(3)} unit="s" />
          <SimReadout label="末60秒横偏峰值" value={state.lngMetrics.final60sLateralMaximumM.toFixed(2)} unit="m" />
          {state.bowDistanceM !== null ? <SimReadout label="北向对地航速" value={state.lngMetrics.physicsSamples > 0
            ? state.lngMetrics.finalNorthGroundSpeedMps.toFixed(3) : '—'} unit="m/s" /> : null}
        </SimReadoutGrid>
        <p className="text-xs leading-5 text-platform-fg-secondary">以120Hz物理细步统计各舱角点最大幅值。当前横偏窗口覆盖{state.lngMetrics.lateralWindowDurationS.toFixed(1)}秒。</p>
      </SimPanelSection> : null}
      <SimPanelSection title="液货舱" icon={Droplets} tone={cargoAlarm ? 'danger' : 'neutral'}>
        <SimReadoutGrid>
          <SimReadout label="液面幅值真值" value={state.sloshHeightM.toFixed(3)} unit="m" tone={cargoAlarm ? 'danger' : 'accent'} />
          <SimReadout label="小幅适用上限" value={(.1 * state.liquidDepthM).toFixed(3)} unit="m" />
          <SimReadout label="轴速指令" value={state.referenceRpm.toFixed(2)} unit="r/min" />
          <SimReadout label="实际轴速真值" value={state.shaftRpm.toFixed(2)} unit="r/min" />
          {state.bowDistanceM !== null ? <SimReadout label="船艏剩余距离真值" value={state.bowDistanceM.toFixed(2)} unit="m" /> : null}
        </SimReadoutGrid>
      </SimPanelSection>
      <SimNotice icon={Timer}>轴系与船速保持连续响应。液面幅值超过当前液深的10%时，线性小幅模型超出适用域，冲击未建模。</SimNotice>
    </SimPanelStack>
  );
}

function runStateOf(state: { isRunning: boolean; isPaused: boolean; isCompleted: boolean }): SimRunState {
  if (state.isCompleted) return 'completed';
  if (state.isPaused) return 'paused';
  if (!state.isRunning) return 'idle';
  return state.isPaused ? 'paused' : 'running';
}

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
        <LNGWater state={state} resetToken={resetToken} />
      </Suspense>

      {showGrid ? (
        <Grid name="marine-grid"
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
          rollRad={state.rollRad}
          pitchRad={state.pitchRad}
          heaveM={state.heaveM}
          draftM={state.draftM}
          simRef={simRef}
          resetToken={resetToken}
        />
      </Suspense>

      <TrajectoryLine points={trajectory} waterOriginSampler={() => ({ x: state.position.x, z: state.position.z })} />


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

function lngStateFromFrame(frame: VesselSessionFrame, running: boolean, completed = false): LNGSimulationState {
  const actual = frame.truth.actuator_states;
  return {isRunning: running, isPaused: !running && frame.timeS > 0 && !completed, isCompleted: completed, time: frame.timeS,
    position: {x: frame.truth.position_ned[0], z: frame.truth.position_ned[1]}, heading: frame.attitudeDeg.heading,
    yawRate: frame.truth.body_velocity[5] * 180 / Math.PI, rudder: (actual.control_surface_angles_rad[0] ?? 0) * 180 / Math.PI,
    speed: frame.waterVelocityBody[0], sloshHeightM: frame.liquidObservation
      ? Math.max(0, ...frame.liquidObservation.cornerHeightsM)
      : Math.max(0, ...Array.from({length: (frame.liquidCargo?.wall_heights_m.length ?? 0) / 2}, (_, tank) =>
        Math.abs(frame.liquidCargo!.wall_heights_m[2 * tank]) + Math.abs(frame.liquidCargo!.wall_heights_m[2 * tank + 1]))),
    liquidWithinDomain: frame.liquidCargo?.within_small_amplitude ?? true,
    liquidDepthM: frame.liquidObservation?.liquidDepthM ?? frame.parameters.liquidDepthM
      ?? 26 * (frame.liquidCargo?.mass_partition ? frame.liquidCargo.mass_partition.liquid_mass_kg / (4 * 44 * 38 * 26 * 450) : .85),
    rollRad: frame.attitudeDeg.roll * Math.PI / 180, pitchRad: frame.attitudeDeg.pitch * Math.PI / 180,
    heaveM: -frame.truth.position_ned[2], draftM: frame.parameters.draftM,
    referenceRpm: (actual.shaft_reference_speed_rad_s[0] ?? 0) * 30 / Math.PI,
    shaftRpm: (actual.propeller_shaft_speed_rad_s[0] ?? 0) * 30 / Math.PI,
    bowDistanceM: frame.berth?.bowClearanceM ?? null, targetHeading: frame.headingReferenceDeg ?? frame.input.targetHeadingDeg,
    controlMode: frame.input.controlMode, smithEnabled: frame.input.longitudinal?.smithEnabled ?? false,
    seaState: frame.waveModel?.firstOrderEnabled ? 3 : 0,
    lngMetrics: frame.fineStepMetrics?.values.lng};
}

export function LNGSimulation({ ticket = '' }: { ticket?: string }) {
  const session = useVesselExperiment(lngExperiment, ticket);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const markRef = useRef(-1);
  const clockRef = useRef(new SimulationClock({dt: SIMULATION_FIXED_STEP_SECONDS, maxSubSteps: SIMULATION_MAX_SUB_STEPS}));
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const speedScaleRef = useRef(8);
  const lastHudUpdateRef = useRef(0);
  const lastTrajectoryTimeRef = useRef(0);
  const bindingRef = useRef<BindingTelemetrySource>({rudderDeg: 0, speedMps: 4, attainedCount: 0, advancing: false});
  const [cameraMode, setCameraMode] = useState('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(8);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const sceneTheme = useSimulationSceneTheme();
  const [state, setState] = useState<LNGSimulationState>({isRunning: false, isPaused: false, isCompleted: false, time: 0,
    position: {x: 0, z: 0}, heading: 0, yawRate: 0, rudder: 0, speed: 4, sloshHeightM: 0,
    liquidWithinDomain: true, liquidDepthM: 22.1, rollRad: 0, pitchRad: 0, heaveM: 0, draftM: 11.5,
    shaftRpm: 0, referenceRpm: 0, bowDistanceM: null, targetHeading: 0, controlMode: 'pd', smithEnabled: false, seaState: 0});
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);

  useEffect(() => {
    if (!sessionRef.current.course?.ready) return;
    const frame = sessionRef.current.course.read();
    if (!frame) return;
    setState(lngStateFromFrame(frame, false, sessionRef.current.course?.completed));
    lastHudUpdateRef.current = frame.timeS;
    lastTrajectoryTimeRef.current = frame.timeS;
    markRef.current = vesselSampleMark(frame.timeS);
    clockRef.current.reset(); lastTimeRef.current = 0;
    setTrajectory([]); setResetCount((value) => value + 1);
  }, [session.course?.ready, session.activeSeq]);

  const simulationStep = useCallback((timestamp: number) => {
    const current = sessionRef.current;
    const course = current.course;
    if (!course?.ready || !course.running) return;
    const frameDt = getSimulationDeltaFromMilliseconds(timestamp, lastTimeRef.current, speedScaleRef.current);
    lastTimeRef.current = timestamp;
    let frame = course.read();
    clockRef.current.advance(frameDt, (dt) => {
      if (!course.running) return;
      frame = course.advance(dt);
      if (!frame) return;
      const point = course.latestPoint();
      const measured = (key: string) => point?.measurements[key]?.quality === 'Good' ? point.measurements[key].value ?? NaN : NaN;
      const sample = {time: frame.timeS, values: {heading: measured('Heading'), speed: measured('SpeedLog'),
        speedReference: point?.longitudinal?.referenceMps ?? NaN, filteredSpeed: point?.longitudinal?.filteredMeasurementMps ?? NaN,
        lowFrequencySpeed: point?.estimate.groundBodySpeedMps ?? NaN,
        shaftRpm: measured('ShaftSpeed0'), referenceRpm: point?.command.shaftRpm[0] ?? NaN,
        east: measured('East'), distance: frame.berth?.bowClearanceM ?? NaN,
        north: frame.truth.position_ned[0], actuatorForce: (frame.dynamics?.external_components?.tau_actuator[0] ?? NaN) / 1000,
        slosh: frame.liquidObservation ? Math.max(0, ...frame.liquidObservation.cornerHeightsM) : NaN}};
      current.trackLatest(sample);
      const mark = vesselSampleMark(frame.timeS);
      if (mark > markRef.current) {markRef.current = mark;current.observe(sample);}
      bindingRef.current = {rudderDeg: (frame.truth.actuator_states.control_surface_angles_rad[0] ?? 0) * 180 / Math.PI,
        speedMps: frame.waterVelocityBody[0], attainedCount: 0, advancing: course.running};
    });
    if (frame && frame.timeS - lastHudUpdateRef.current >= .1) {
      lastHudUpdateRef.current = frame.timeS;
      setState(lngStateFromFrame(frame, course.running, course.completed));
    }
    if (frame && frame.timeS - lastTrajectoryTimeRef.current >= .5) {
      lastTrajectoryTimeRef.current = frame.timeS;
      const position = {x: frame.truth.position_ned[0], z: frame.truth.position_ned[1]};
      setTrajectory((previous) => [...previous.slice(-499), position]);
    }
    if (course.running) animationRef.current = requestAnimationFrame(simulationStep);
  }, []);

  useEffect(() => {speedScaleRef.current = speedScale;}, [speedScale]);
  useEffect(() => {
    if (session.course?.running) {
      clockRef.current.reset(); lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(simulationStep);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      const frame = sessionRef.current.course?.read();
      if (frame) setState(lngStateFromFrame(frame, false, sessionRef.current.course?.completed));
      bindingRef.current = {...bindingRef.current, advancing: false};
    }
    return () => {if (animationRef.current) cancelAnimationFrame(animationRef.current);};
  }, [session.course?.running, simulationStep]);

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
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
      </MarineCanvas>

      <VesselExperimentDocks
        experiment={lngExperiment}
        session={session}
        status={<StatusPanel state={state} />}
        controls={<LngCourseControls session={session} timeS={state.time} />}
        assessment={(
          <div className="space-y-4">
            <VesselCourseEvidencePanel
              session={session}
              courseKey="lng"
              stepSequence={session.step.seq}
              defaultChannel="shaft-reference-to-speed"
            />
            {session.step.seq >= 13 && session.step.seq <= 19 ? (
              <SimulationAssessmentPanel
                title="运行质量评估"
                pendingReview
                metrics={[
                  { id: 'heading-error', label: '航向误差', value: Math.abs(state.heading - state.targetHeading), max: 30, better: 'lower', unit: '°', precision: 1 },
                  { id: 'rudder', label: '舵角幅值', value: Math.abs(state.rudder), max: 35, better: 'lower', unit: '°', precision: 1 },
                  { id: 'sloshing', label: '液面幅值真值', value: state.sloshHeightM, max: .1 * state.liquidDepthM, better: 'lower', unit: 'm', precision: 3 },
                  { id: 'roll', label: '横摇真值', value: Math.abs(state.rollRad * 180 / Math.PI), max: 8, better: 'lower', unit: '°', precision: 2 },
                ]}
              />
            ) : null}
            <p className="text-xs leading-5 text-platform-fg-secondary">采用教学标称参数及既有零航速代表波浪数据。局部模型的速度、加载与低速外推误差随本人对照保留。</p>
          </div>
        )}
      />

      <SimulationTopBar
        title="长恒系列 LNG 大惯性操纵"
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
