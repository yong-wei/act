'use client';
import { MarineGrid as Grid } from '../scene/lines/marine-grid';
import { MarineLine as Line } from '@/resources/simulations/scene/lines/marine-line';

/**
 * 邮轮仿真组件
 * 爱达·魔都号 - 横摇耦合 + 减摇鳍 + 陷波滤波器
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { useSearchParams } from 'next/navigation';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { ArrowDownFromLine, Compass, Navigation, Orbit, Timer, Video, Waves } from 'lucide-react';
import { MarineCanvas } from '../scene/marine-canvas';
import { MarineWater } from '../scene/water/marine-water';
import { SimulationClock } from '@/lib/simulation';
import { VersionedFleetShip } from '@/resources/simulations/components/versioned-fleet-ship';
import type { BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, simulationUi } from '../components/simulation-ui';
import {
  SimChip,
  SimMeter,
  SimNotice,
  SimPanelSection,
  SimPanelStack,
  SimReadout,
  SimReadoutGrid,
  SimStatusStrip,
  SimSwitchInput,
  SimToggleRow,
} from '../components/simulation-panels';
import {
  useSimulationSceneTheme,
  simulationScenePalette,
  type SimulationSceneTheme,
} from '../components/simulation-theme';
import {
  EnvironmentScene,
  MARINE_SCENE_LAYOUTS,
  MarineSceneLayoutObjects,
  SceneEnvironmentProvider,
  useEnvironmentWaterColors,
} from '../scene/environment';
import { SceneSoundscapeProvider, SoundscapeAmbienceDriver } from '../scene/audio';
import { TeachingAnnotationsProvider, useTeachingAnnotations } from '../scene/annotations';
import {
  SceneQualityDriver,
  SceneQualityProvider,
  useSceneQuality,
  MarinePerformanceEvidenceProbe,
} from '../scene/quality';
import { ScenePostEffects } from '../scene/post';
import { cruiseAdoraSceneVisual } from '../profiles/cruise-adora-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';

import type { Vector2 } from '../core/types';
import { readRunEvidence } from '@/features/simulations/local-evidence-store';
import { cruiseCourseExperiment as cruiseExperiment } from '../experiments/cruise-experiment';
import {
  cruiseCourseAdapter,
  cruiseCourseTraceSamples,
  CRUISE_COURSE_STEPS,
} from '../experiments/cruise-course';
import { CruiseCourseControls } from '../experiments/cruise-course-controls';
import {
  computeCruiseMultiObjectiveMetrics,
  CruiseComfortReadout,
} from '../experiments/cruise-comfort-readout';
import {
  buildCruiseRunObservation,
  getCruiseRunObservation,
  recordCruiseRunObservation,
} from '../experiments/cruise-evidence';
import { vesselSampleMark } from './vessel-experiment';
import { VesselExperimentDocks, VesselCourseEvidencePanel } from './vessel-experiment-panels';
import { useVesselExperiment } from './use-vessel-experiment';
import type { VesselCruiseComfort, VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { toDegrees, toRadians, CRUISE_ADORA_PARAMS } from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';

// ============ 类型定义 ============

interface CruiseSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  time: number;
  position: Vector2;
  heading: number;
  yawRate: number;
  portPodDeg: number;
  starboardPodDeg: number;
  speed: number;
  rollAngle: number;
  pitchAngle: number;
  heaveM: number;
  draftM: number;
  targetHeading: number;
  seaState: number;
  comfort: VesselCruiseComfort | null;
  controller?: VesselSessionFrame['cruiseController'];
  portFinAngle: number;
  starboardFinAngle: number;
  actuatorLoads: number[] | null;
  runDurationSec: number;
}

const CRUISE_ROUTE_START: Vector2 = { x: 0, z: 0 };
const CRUISE_ROUTE_STRAIGHT_DISTANCE = 160;
const CRUISE_ROUTE_TURN_HEADING = 20;
const CRUISE_ROUTE_EXTENSION = 5200;
const CRUISE_HEADING_PRIMARY = simulationScenePalette.cruiseHeadingPrimary;
const CRUISE_HEADING_SECONDARY = simulationScenePalette.cruiseHeadingSecondary;
function buildCruiseDesiredRoute(turning: boolean): Vector2[] {
  if (!turning) return [CRUISE_ROUTE_START, { x: CRUISE_ROUTE_EXTENSION, z: 0 }];
  const turnPoint: Vector2 = {
    x: CRUISE_ROUTE_START.x + CRUISE_ROUTE_STRAIGHT_DISTANCE,
    z: CRUISE_ROUTE_START.z,
  };
  const endPoint: Vector2 = {
    x: turnPoint.x + CRUISE_ROUTE_EXTENSION * Math.cos(toRadians(CRUISE_ROUTE_TURN_HEADING)),
    z: turnPoint.z + CRUISE_ROUTE_EXTENSION * Math.sin(toRadians(CRUISE_ROUTE_TURN_HEADING)),
  };
  return [CRUISE_ROUTE_START, turnPoint, endPoint];
}

function buildArrowWingPoints(
  start: [number, number, number],
  end: [number, number, number],
  arrowLength = 70,
  arrowWidth = 28,
): Array<[number, number, number]> {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const bx = end[0] - ux * arrowLength;
  const bz = end[2] - uz * arrowLength;
  const lx = bx - uz * arrowWidth;
  const lz = bz + ux * arrowWidth;
  const rx = bx + uz * arrowWidth;
  const rz = bz - ux * arrowWidth;
  return [
    [lx, end[1], lz],
    [rx, end[1], rz],
  ];
}

function DirectionArrow({
  start,
  end,
  color,
  dashed = false,
  lineWidth = 2.6,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  dashed?: boolean;
  lineWidth?: number;
}) {
  const [leftWing, rightWing] = useMemo(() => buildArrowWingPoints(start, end), [start, end]);

  return (
    <>
      <Line
        name="marine-annotations"
        points={[start, end]}
        color={color}
        lineWidth={lineWidth}
        dashed={dashed}
        dashScale={28}
        dashSize={28}
        gapSize={14}
      />
      <Line name="marine-annotations" points={[leftWing, end]} color={color} lineWidth={lineWidth} />
      <Line name="marine-annotations" points={[rightWing, end]} color={color} lineWidth={lineWidth} />
    </>
  );
}

// ============ 邮轮模型组件 ============

function CruiseShipModel(props: {
  position: Vector2;
  heading: number;
  rollAngle: number;
  pitchAngle: number;
  heaveM: number;
  draftM: number;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
}) {
  const scene = useThree((state) => state.scene);
  useFrame(() => {
    scene.userData.marineShipTelemetry = { roll: props.rollAngle };
  });
  return (
    <group position={[0, 8.26 - props.draftM, 0]}>
      <VersionedFleetShip
        logicalId="luxury-liner"
        simRef={props.simRef}
        position={props.position}
        waterY={props.heaveM}
        headingRad={props.heading}
        extraEuler={{ x: props.pitchAngle, z: props.rollAngle }}
        sceneLengthMeters={CRUISE_ADORA_PARAMS.LENGTH}
        resetToken={props.resetToken}
        legacyYawOffsetRad={0}
        fallbackDraftMeters={CRUISE_ADORA_PARAMS.DRAFT}
      />
    </group>
  );
}

// ============ 航迹线组件 ============

function TrajectoryLine({
  points,
  waterOriginSampler,
}: {
  points: Vector2[];
  waterOriginSampler?: () => { x: number; z: number };
}) {
  if (points.length < 2) return null;
  return (
    <WaterHuggingLine
      points={points}
      waterOriginSampler={waterOriginSampler}
      color={CRUISE_HEADING_PRIMARY}
      lineWidth={2.4}
    />
  );
}

function DesiredRouteLine({
  points,
  waterOriginSampler,
}: {
  points: Vector2[];
  waterOriginSampler?: () => { x: number; z: number };
}) {
  const arrowStart = points.length > 1 ? points[points.length - 2] : null;
  const arrowEnd = points.length > 1 ? points[points.length - 1] : null;
  if (points.length < 2) {
    return null;
  }

  return (
    <>
      <WaterHuggingLine
        points={points}
        waterOriginSampler={waterOriginSampler}
        color={CRUISE_HEADING_SECONDARY}
        lineWidth={2.2}
        dashed
        dashSize={36}
        gapSize={16}
      />
      {arrowStart && arrowEnd ? (
        <DirectionArrow
          start={[arrowStart.x, 1.2, arrowStart.z]}
          end={[arrowEnd.x, 1.2, arrowEnd.z]}
          color={CRUISE_HEADING_SECONDARY}
          dashed={false}
          lineWidth={2.2}
        />
      ) : null}
    </>
  );
}

// ============ 航向指示器 ============

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

  return (
    <>
      <DirectionArrow
        start={[position.x, 2, position.z]}
        end={targetEnd}
        color={CRUISE_HEADING_SECONDARY}
        dashed
        lineWidth={2.2}
      />
      <DirectionArrow
        start={[position.x, 2, position.z]}
        end={currentEnd}
        color={CRUISE_HEADING_PRIMARY}
        lineWidth={2.8}
      />
    </>
  );
}

// ============ 相机控制器 ============

// ============ 舒适度仪表盘 ============

function CruiseActuatorDiagram({ state }: { state: CruiseSimulationState }) {
  const [selection, setSelection] = useState(0);
  const devices = [
    {
      label: '左吊舱',
      position: '(-137.25，8.184，3)m',
      angle: state.portPodDeg,
      action: '水平推力改变纵荡、横荡与艏摇，安装高度同时产生横摇和纵摇力矩。',
    },
    {
      label: '右吊舱',
      position: '(-137.25，-8.184，3)m',
      angle: state.starboardPodDeg,
      action: '水平推力改变纵荡、横荡与艏摇，安装高度同时产生横摇和纵摇力矩。',
    },
    {
      label: '左减摇鳍',
      position: '(-15.25，15，2)m',
      angle: state.portFinAngle,
      action: '局部来流产生有限升力，差动鳍主要控制横摇，纵向安装点同时影响升沉和纵摇。',
    },
    {
      label: '右减摇鳍',
      position: '(-15.25，-15，2)m',
      angle: state.starboardFinAngle,
      action: '局部来流产生有限升力，差动鳍主要控制横摇，纵向安装点同时影响升沉和纵摇。',
    },
  ];
  const selected = devices[selection];
  return (
    <SimPanelSection title="执行器与六自由度" icon={Navigation}>
      <div
        className="relative mx-auto grid max-w-60 grid-cols-2 gap-x-12 gap-y-9 rounded-t-[45%] rounded-b-xl border border-platform-border px-2 pb-3 pt-9"
        role="group"
        aria-label="邮轮俯视执行器示意图"
      >
        <span className="absolute inset-x-0 top-2 text-center text-xs text-platform-fg-muted">船艏</span>
        {[2, 3, 0, 1].map((index) => (
          <button
            key={index}
            type="button"
            aria-pressed={selection === index}
            className={`rounded border px-1 py-2 text-xs ${selection === index ? 'border-platform-accent text-platform-accent' : 'border-platform-border text-platform-fg-secondary'}`}
            onClick={() => setSelection(index)}
          >
            {devices[index].label}
          </button>
        ))}
      </div>
      <p className="text-xs leading-5 text-platform-fg-secondary">
        {selected.label}，实际角度{selected.angle.toFixed(2)}°，船体安装坐标{selected.position}。
        {selected.action}
      </p>
      <p className="text-xs text-platform-fg-muted">
        全部执行器合力与合力矩，船体坐标顺序为纵向、横向、垂向、横摇、纵摇、艏摇。
      </p>
      <SimReadoutGrid>
        {['纵向力', '横向力', '垂向力', '横摇力矩', '纵摇力矩', '艏摇力矩'].map((label, index) => (
          <SimReadout
            key={label}
            label={label}
            value={state.actuatorLoads ? (state.actuatorLoads[index] / 1e6).toFixed(4) : '—'}
            unit={index < 3 ? 'MN' : 'MN·m'}
          />
        ))}
      </SimReadoutGrid>
    </SimPanelSection>
  );
}

function CruiseForceVectors({
  state,
  visible,
  finFaultLocked,
}: {
  state: CruiseSimulationState;
  visible: boolean;
  finFaultLocked: boolean;
}) {
  if (!visible) return null;
  const psi = toRadians(state.heading);
  const cosPsi = Math.cos(psi);
  const sinPsi = Math.sin(psi);
  const toWorld = (fwd: number, lat: number, y = 3.2): [number, number, number] => [
    state.position.x + fwd * cosPsi - lat * sinPsi,
    y,
    state.position.z + fwd * sinPsi + lat * cosPsi,
  ];
  const podArrowLen = Math.max(26, Math.min(72, 26 + Math.abs(state.speed) * 4.2));
  const pods = [
    { key: 'port-pod', start: toWorld(-137.25, -8.184, 3.2), angleRad: psi + toRadians(state.portPodDeg) },
    { key: 'stbd-pod', start: toWorld(-137.25, 8.184, 3.2), angleRad: psi + toRadians(state.starboardPodDeg) },
  ];
  const fins = [
    {
      key: 'port-fin',
      start: toWorld(-15.25, -15, 2.8),
      angleDeg: state.portFinAngle,
      faulted: finFaultLocked,
      sideSign: -1,
    },
    {
      key: 'stbd-fin',
      start: toWorld(-15.25, 15, 2.8),
      angleDeg: state.starboardFinAngle,
      faulted: false,
      sideSign: 1,
    },
  ];

  return (
    <group name="cruise-force-vectors">
      {pods.map((pod) => {
        const end: [number, number, number] = [
          pod.start[0] + podArrowLen * Math.cos(pod.angleRad),
          pod.start[1],
          pod.start[2] + podArrowLen * Math.sin(pod.angleRad),
        ];
        return (
          <DirectionArrow
            key={pod.key}
            start={pod.start}
            end={end}
            color={simulationScenePalette.cruiseHeadingPrimary}
            lineWidth={3}
          />
        );
      })}
      {fins.map((fin) => {
        const liftLen = Math.max(12, (Math.abs(fin.angleDeg) / 25) * 44) * (fin.angleDeg >= 0 ? 1 : -1) * fin.sideSign;
        const end: [number, number, number] = [
          fin.start[0] - liftLen * sinPsi,
          fin.start[1] + Math.max(4, (Math.abs(fin.angleDeg) / 25) * 14),
          fin.start[2] + liftLen * cosPsi,
        ];
        const stalled = Math.abs(fin.angleDeg) >= 22.5 || fin.faulted;
        return (
          <group key={fin.key}>
            <DirectionArrow
              start={fin.start}
              end={end}
              color={stalled ? simulationScenePalette.danger : simulationScenePalette.success}
              lineWidth={stalled ? 3.4 : 2.6}
            />
            {fin.faulted ? (
              <Html position={fin.start} center>
                <div className="rounded border border-[hsl(var(--platform-brand-danger)/0.6)] bg-[hsl(var(--platform-brand-danger)/0.92)] px-2 py-0.5 text-[11px] font-medium text-platform-fg-inverse whitespace-nowrap shadow">
                  左减摇鳍冻结（t≥180s）
                </div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function HUD({
  state,
  activeSeq,
  finsEnabled,
  finWearIntegralDeg,
  finFaultLocked,
  showForceVectors,
  onToggleForceVectors,
}: {
  state: CruiseSimulationState;
  activeSeq: number;
  finsEnabled: boolean;
  finWearIntegralDeg: number;
  finFaultLocked: boolean;
  showForceVectors: boolean;
  onToggleForceVectors: () => void;
}) {
  const error = ((state.targetHeading - state.heading + 540) % 360) - 180;
  const roll = toDegrees(state.rollAngle);
  const showComfortFocus = (activeSeq >= 6 && activeSeq <= 19) || finsEnabled;
  return (
    <SimPanelStack>
      <SimStatusStrip
        state={
          state.isCompleted ? 'completed' : state.isRunning ? 'running' : state.time > 0 ? 'paused' : 'idle'
        }
        time={`${state.time.toFixed(1)} s`}
      >
        <SimChip icon={Timer}>剩余{Math.max(0, state.runDurationSec - state.time).toFixed(1)}s</SimChip>
        {activeSeq === 1 ? <SimChip tone="accent">第1步聚焦：执行器与六维力矩</SimChip> : null}
      </SimStatusStrip>
      <SimPanelSection title="3D 执行器推力与鳍升力矢量" icon={Navigation}>
        <SimToggleRow
          label="显示吊舱推力与减摇鳍升力矢量"
          htmlFor="cruise-force-vectors-toggle"
          control={
            <SimSwitchInput
              id="cruise-force-vectors-toggle"
              checked={showForceVectors}
              onChange={onToggleForceVectors}
            />
          }
        />
      </SimPanelSection>
      <CruiseActuatorDiagram state={state} />
      <SimPanelSection title="航向与双吊舱" icon={Compass}>
        <SimReadoutGrid>
          <SimReadout label="航向真值" value={state.heading.toFixed(2)} unit="°" />
          <SimReadout label="目标航向" value={state.targetHeading.toFixed(2)} unit="°" />
          <SimReadout label="航向误差" value={error.toFixed(2)} unit="°" />
          <SimReadout label="转艏角速度" value={state.yawRate.toFixed(3)} unit="°/s" />
          <SimReadout label="左吊舱实际方位" value={state.portPodDeg.toFixed(2)} unit="°" />
          <SimReadout label="右吊舱实际方位" value={state.starboardPodDeg.toFixed(2)} unit="°" />
          <SimReadout label="对水航速真值" value={state.speed.toFixed(2)} unit="m/s" />
        </SimReadoutGrid>
      </SimPanelSection>
      <SimPanelSection title="横摇与减摇鳍" icon={Waves}>
        <SimMeter
          label="横摇真值"
          valueLabel={`${roll.toFixed(3)}°`}
          value={Math.abs(roll) / 6}
          tone={Math.abs(roll) > 6 ? 'danger' : 'neutral'}
        />
        <SimReadoutGrid>
          <SimReadout label="左鳍实际角度" value={state.portFinAngle.toFixed(2)} unit="°" />
          <SimReadout label="右鳍实际角度" value={state.starboardFinAngle.toFixed(2)} unit="°" />
          <SimReadout
            label="请求横摇力矩"
            value={state.controller ? (state.controller.requestedMomentNm / 1e6).toFixed(3) : '—'}
            unit="MN·m"
          />
          <SimReadout
            label="可用横摇力矩"
            value={state.controller ? (state.controller.availableMomentNm / 1e6).toFixed(3) : '—'}
            unit="MN·m"
          />
        </SimReadoutGrid>
        {state.controller?.lowSpeedAuthority ? (
          <SimNotice tone="warning">当前来流下鳍控制能力下降，请结合实际力矩评价。</SimNotice>
        ) : null}
      </SimPanelSection>
      {showComfortFocus ? (
        <SimNotice tone={finFaultLocked ? 'danger' : finsEnabled ? 'accent' : 'warning'} data-cruise-hud-focus>
          {finFaultLocked
            ? '左减摇鳍已于 t=180s 卡阻冻结，请重点对比左右鳍饱和、稳态横倾与乘客点不适度变化。'
            : finsEnabled
              ? '减摇鳍闭环已激活：重点关注限幅告警、鳍高频磨损积分与稳态统计窗舒适度代理。'
              : `第 ${activeSeq} 步舒适性与共振对照期：减摇鳍当前关闭，可重点观察稳态横摇峰值与均方根。`}
        </SimNotice>
      ) : null}
      <CruiseComfortReadout comfort={state.comfort}
        finAnglesDeg={[state.portFinAngle, state.starboardFinAngle]}
        timeS={state.time}
        finWearIntegralDeg={finWearIntegralDeg}
        finFaultLocked={finFaultLocked}
      />
    </SimPanelStack>
  );
}

function SceneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={simulationUi.root} data-sim-ui data-scene-shell="cruise">
      {children}
    </div>
  );
}

// ============ 管线桥接组件 ============

const CAMERA_SHOT_VIEWS = [
  {
    id: SCENE_CAMERA_SHOTS.chase.id,
    label: '跟船',
    shortLabel: '跟',
    icon: Video,
    description: SCENE_CAMERA_SHOTS.chase.description,
  },
  {
    id: SCENE_CAMERA_SHOTS.orbit.id,
    label: '环绕',
    shortLabel: '环',
    icon: Orbit,
    description: SCENE_CAMERA_SHOTS.orbit.description,
  },
  {
    id: SCENE_CAMERA_SHOTS.tactical.id,
    label: '战术',
    shortLabel: '战',
    icon: Compass,
    description: SCENE_CAMERA_SHOTS.tactical.description,
  },
  {
    id: SCENE_CAMERA_SHOTS.topDown.id,
    label: '顶视',
    shortLabel: '顶',
    icon: ArrowDownFromLine,
    description: SCENE_CAMERA_SHOTS.topDown.description,
  },
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
function CruiseWater({ state, resetToken }: { state: CruiseSimulationState; resetToken: number }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <MarineWater
      worldSpeedSampler={() => (state.isRunning && !state.isPaused ? state.speed : 0)}
      vesselLengthMeters={323.6}
      vesselBeamMeters={37.2}
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
    <HeadingIndicator position={position} targetHeading={targetHeading} currentHeading={currentHeading} />
  );
}

function VisualizationLayer({
  state,
  showGrid,
  showForceVectors,
  finFaultLocked,
  sceneTheme,
  desiredRoutePoints,
  trajectoryPoints,
  cameraMode,
  controlsRef,
  onRequestFreeMode,
  resetToken,
  resetSignal,
  simRef,
}: {
  state: CruiseSimulationState;
  showGrid: boolean;
  showForceVectors: boolean;
  finFaultLocked: boolean;
  sceneTheme: SimulationSceneTheme;
  desiredRoutePoints: Vector2[];
  trajectoryPoints: Vector2[];
  cameraMode: string;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onRequestFreeMode: () => void;
  resetToken: number;
  resetSignal: number;
  simRef: React.MutableRefObject<BindingTelemetrySource>;
}) {
  return (
    <MarineCanvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [-500, 300, 800], fov: 60, near: 1, far: 50000 }}
    >
      <Suspense fallback={null}>
        <EnvironmentScene subjectPositionSampler={() => ({ x: state.position.x, z: state.position.z })} />
        <MarineSceneLayoutObjects layoutId="harbor-entrance-channel" />
      </Suspense>
      <SoundscapeAmbienceDriver />
      <SceneQualityDriver />
      <MarinePerformanceEvidenceProbe
        contextInput={() => ({
          vesselId: 'cruise',
          cameraView: String(cameraMode),
          seaState: state.seaState,
        })}
      />
      <Suspense fallback={null}>
        <CruiseWater state={state} resetToken={resetToken} />
      </Suspense>
      {showGrid ? (
        <Grid
          name="marine-grid"
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
      <Suspense
        fallback={
          <ModelLoadingPlaceholder label="邮轮模型加载中" sublabel="场景已就绪，可先查看海况与参考航迹" />
        }
      >
        <CruiseShipModel
          position={state.position}
          pitchAngle={state.pitchAngle}
          heaveM={state.heaveM}
          draftM={state.draftM}
          heading={toRadians(state.heading)}
          rollAngle={state.rollAngle}
          simRef={simRef}
          resetToken={resetToken}
        />
      </Suspense>
      <DesiredRouteLine
        points={desiredRoutePoints}
        waterOriginSampler={() => ({ x: state.position.x, z: state.position.z })}
      />
      <TrajectoryLine
        points={trajectoryPoints}
        waterOriginSampler={() => ({ x: state.position.x, z: state.position.z })}
      />
      <CruiseForceVectors state={state} visible={showForceVectors} finFaultLocked={finFaultLocked} />
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
        maxPolarAngle={Math.PI / 2.2}
        minDistance={200}
        maxDistance={3000}
      />
      <RightClickFreeModeBridge onRequestFreeMode={onRequestFreeMode} />
      <StayPutCameraController
        view={cameraMode}
        positionSampler={() => ({ x: state.position.x, z: state.position.z })}
        headingSampler={() => platformHeadingToSceneRad(state.heading)}
        shipLength={cruiseAdoraSceneVisual.shipLengthMeters}
        controlsRef={controlsRef}
        resetSignal={resetSignal}
      />
      <ScenePostEffects />
    </MarineCanvas>
  );
}

function cruiseStateFromFrame(
  frame: VesselSessionFrame,
  running: boolean,
  completed: boolean,
  durationS: number,
): CruiseSimulationState {
  const actual = frame.truth.actuator_states;
  return {
    isRunning: running,
    isPaused: !running && frame.timeS > 0 && !completed,
    isCompleted: completed,
    time: frame.timeS,
    position: { x: frame.truth.position_ned[0], z: frame.truth.position_ned[1] },
    heading: frame.attitudeDeg.heading,
    yawRate: (frame.truth.body_velocity[5] * 180) / Math.PI,
    portPodDeg: ((actual.azimuth_angles_rad[0] ?? 0) * 180) / Math.PI,
    starboardPodDeg: ((actual.azimuth_angles_rad[1] ?? 0) * 180) / Math.PI,
    speed: frame.waterVelocityBody[0],
    rollAngle: toRadians(frame.attitudeDeg.roll),
    pitchAngle: toRadians(frame.attitudeDeg.pitch),
    heaveM: -frame.truth.position_ned[2],
    draftM: frame.parameters.draftM,
    targetHeading: frame.headingReferenceDeg ?? frame.input.targetHeadingDeg,
    seaState: frame.waveModel?.firstOrderEnabled ? 3 : 0,
    comfort: frame.cruiseComfort ?? null,
    controller: frame.cruiseController,
    portFinAngle: ((actual.control_surface_angles_rad[0] ?? 0) * 180) / Math.PI,
    starboardFinAngle: ((actual.control_surface_angles_rad[1] ?? 0) * 180) / Math.PI,
    actuatorLoads: frame.dynamics?.external_components?.tau_actuator ?? null,
    runDurationSec: durationS,
  };
}

export default function CruiseSimulation({ ticket = '' }: { ticket?: string }) {
  const session = useVesselExperiment(cruiseExperiment, ticket, cruiseCourseAdapter);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const lastHudUpdateRef = useRef(0);
  const lastTrajectoryTime = useRef(0);
  const markRef = useRef(-1);
  const clockRef = useRef(
    new SimulationClock({ dt: SIMULATION_FIXED_STEP_SECONDS, maxSubSteps: SIMULATION_MAX_SUB_STEPS }),
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const speedScaleRef = useRef(8);
  const bindingRef = useRef<BindingTelemetrySource>({
    speedMps: 8,
    rudderDeg: 0,
    attainedCount: 0,
    advancing: false,
  });
  const [cameraMode, setCameraMode] = useState('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [showForceVectors, setShowForceVectors] = useState(true);
  const [finWearIntegralDeg, setFinWearIntegralDeg] = useState(0);
  const finWearRef = useRef({ lastPort: 0, lastStbd: 0, total: 0 });
  const [speedScale, setSpeedScale] = useState(8);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);
  const sceneTheme = useSimulationSceneTheme();
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get('embed') === '1';
  const desiredRoutePoints = useMemo(
    () => buildCruiseDesiredRoute([11, 12, 16, 17, 18, 19].includes(session.activeSeq)),
    [session.activeSeq],
  );
  const [state, setState] = useState<CruiseSimulationState>({
    isRunning: false,
    isPaused: false,
    isCompleted: false,
    time: 0,
    position: { x: 0, z: 0 },
    heading: 0,
    yawRate: 0,
    portPodDeg: 0,
    starboardPodDeg: 0,
    speed: 8,
    rollAngle: 0,
    pitchAngle: 0,
    heaveM: 0,
    draftM: 8.26,
    targetHeading: 0,
    seaState: 0,
    comfort: null,
    portFinAngle: 0,
    starboardFinAngle: 0,
    actuatorLoads: null,
    runDurationSec: 60,
  });

  useEffect(() => {
    const current = sessionRef.current;
    const course = current.course;
    const frame = course?.ready ? course.read() : null;
    if (!frame || !course) return;
    setState(
      cruiseStateFromFrame(
        frame,
        false,
        course.completed,
        CRUISE_COURSE_STEPS[current.activeSeq - 1].runDurationS ?? 600,
      ),
    );
    clockRef.current.reset();
    lastTimeRef.current = 0;
    lastHudUpdateRef.current = frame.timeS;
    lastTrajectoryTime.current = frame.timeS;
    markRef.current = vesselSampleMark(frame.timeS);
    finWearRef.current = {
      lastPort: ((frame.truth.actuator_states.control_surface_angles_rad[0] ?? 0) * 180) / Math.PI,
      lastStbd: ((frame.truth.actuator_states.control_surface_angles_rad[1] ?? 0) * 180) / Math.PI,
      total: 0,
    };
    setFinWearIntegralDeg(0);
    setTrajectory([]);
    setResetCount((value) => value + 1);
  }, [session.course?.ready, session.activeSeq]);

  const simulate = useCallback((timestamp: number) => {
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
      const portDeg = ((frame.truth.actuator_states.control_surface_angles_rad[0] ?? 0) * 180) / Math.PI;
      const stbdDeg = ((frame.truth.actuator_states.control_surface_angles_rad[1] ?? 0) * 180) / Math.PI;
      finWearRef.current.total +=
        Math.abs(portDeg - finWearRef.current.lastPort) +
        Math.abs(stbdDeg - finWearRef.current.lastStbd);
      finWearRef.current.lastPort = portDeg;
      finWearRef.current.lastStbd = stbdDeg;
      const point = course.latestPoint();
      if (point) {
        const sample = cruiseCourseTraceSamples([point])[0];
        current.trackLatest(sample);
        const mark = vesselSampleMark(frame.timeS);
        if (mark > markRef.current) {
          markRef.current = mark;
          current.observe(sample);
        }
      }
      bindingRef.current = {
        speedMps: frame.waterVelocityBody[0],
        rudderDeg: 0,
        azipod: {
          P: {
            azimuthRad: frame.truth.actuator_states.azimuth_angles_rad[0] ?? 0,
            rpm: ((frame.truth.actuator_states.propeller_shaft_speed_rad_s[0] ?? 0) * 30) / Math.PI,
          },
          S: {
            azimuthRad: frame.truth.actuator_states.azimuth_angles_rad[1] ?? 0,
            rpm: ((frame.truth.actuator_states.propeller_shaft_speed_rad_s[1] ?? 0) * 30) / Math.PI,
          },
        },
        attainedCount: 0,
        advancing: course.running,
      };
    });
    if (frame && (frame.timeS - lastHudUpdateRef.current >= 0.1 || frame.paused)) {
      setFinWearIntegralDeg(finWearRef.current.total);
      setState(
        cruiseStateFromFrame(
          frame,
          course.running,
          course.completed,
          CRUISE_COURSE_STEPS[current.activeSeq - 1].runDurationS ?? 600,
        ),
      );
      lastHudUpdateRef.current = frame.timeS;
    }
    if (frame && frame.timeS - lastTrajectoryTime.current >= 0.5) {
      lastTrajectoryTime.current = frame.timeS;
      const position = { x: frame.truth.position_ned[0], z: frame.truth.position_ned[1] };
      setTrajectory((previous) => [...previous.slice(-1200), position]);
    }
    if (course.running) animationRef.current = requestAnimationFrame(simulate);
  }, []);

  useEffect(() => {
    speedScaleRef.current = speedScale;
  }, [speedScale]);
  useEffect(() => {
    if (session.course?.running) {
      clockRef.current.reset();
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(simulate);
    } else {
      const current = sessionRef.current,
        frame = current.course?.read();
      if (frame)
        setState(
          cruiseStateFromFrame(
            frame,
            false,
            Boolean(current.course?.completed),
            CRUISE_COURSE_STEPS[current.activeSeq - 1].runDurationS ?? 600,
          ),
        );
      bindingRef.current = { ...bindingRef.current, advancing: false };
    }
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [session.course?.running, simulate]);

  const finFaultLocked = Boolean(state.time >= 180 && session.activeSeq === 19);
  const finsEnabled = Boolean(session.course?.settings.finsEnabled);

  useEffect(() => {
    const runId = session.course?.plannedRunId;
    if (!runId || state.time <= 0) return;
    const finAnglesDeg: [number, number] = [state.portFinAngle, state.starboardFinAngle];
    const msiPercent = computeCruiseMultiObjectiveMetrics({
      comfort: state.comfort,
      finAnglesDeg,
      timeS: state.time,
      finWearIntegralDeg,
      finFaultLocked,
    }).msiPercent;
    recordCruiseRunObservation(
      runId,
      buildCruiseRunObservation({
        comfort: state.comfort,
        samples: session.shownSamples,
        finAnglesDeg,
        msiPercent,
        finWearIntegralDeg,
      }),
    );
  }, [
    session.course?.plannedRunId,
    state.time,
    state.comfort,
    state.portFinAngle,
    state.starboardFinAngle,
    session.shownSamples,
    finWearIntegralDeg,
    finFaultLocked,
  ]);

  useEffect(() => {
    const runs = session.course?.runs ?? [];
    const targetRuns = runs.filter(
      (run) =>
        run.stoppedAtMs !== null &&
        (run.stepSequence === session.activeSeq || run.stepSequence === 6) &&
        !getCruiseRunObservation(run.id),
    );
    if (targetRuns.length === 0) return;
    let cancelled = false;
    for (const summary of targetRuns) {
      void readRunEvidence(summary.id)
        .then((evidence) => {
          if (cancelled || !evidence) return;
          const samples = cruiseCourseTraceSamples(evidence.trace);
          const lastSample = samples.at(-1);
          const finAnglesDeg: [number, number] = [
            lastSample?.values.portFin ?? 0,
            lastSample?.values.starboardFin ?? 0,
          ];
          const wear = evidence.trace.reduce(
            (acc, pt, idx) => {
              const p = pt.truth.surfaceDeg[0] ?? 0;
              const s = pt.truth.surfaceDeg[1] ?? 0;
              if (idx === 0) return { lastP: p, lastS: s, total: 0 };
              return {
                lastP: p,
                lastS: s,
                total: acc.total + Math.abs(p - acc.lastP) + Math.abs(s - acc.lastS),
              };
            },
            { lastP: 0, lastS: 0, total: 0 },
          ).total;
          const msiPercent = computeCruiseMultiObjectiveMetrics({
            comfort: evidence.cruiseComfort ?? null,
            finAnglesDeg,
            timeS: evidence.lastTimeS,
            finWearIntegralDeg: wear,
            finFaultLocked: summary.stepSequence === 19 && evidence.lastTimeS >= 180,
          }).msiPercent;
          recordCruiseRunObservation(
            summary.id,
            buildCruiseRunObservation({
              comfort: evidence.cruiseComfort ?? null,
              samples,
              finAnglesDeg,
              msiPercent,
              finWearIntegralDeg: wear,
            }),
          );
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [session.course?.runs, session.activeSeq]);

  return (
    <SceneEnvironmentProvider>
      <SceneSoundscapeProvider>
        <TeachingAnnotationsProvider>
          <SceneQualityProvider>
            <SceneShell>
              <SceneQualityAttributes />
              <VisualizationLayer
                state={state}
                showGrid={showGrid}
                showForceVectors={showForceVectors}
                finFaultLocked={finFaultLocked}
                sceneTheme={sceneTheme}
                desiredRoutePoints={desiredRoutePoints}
                trajectoryPoints={trajectory}
                cameraMode={cameraMode}
                controlsRef={controlsRef}
                onRequestFreeMode={() => setCameraMode('free')}
                resetToken={resetCount}
                resetSignal={viewResetCount}
                simRef={bindingRef}
              />
              <CameraViewSwitcher
                currentMode={cameraMode}
                onModeChange={setCameraMode}
                onViewReset={() => setViewResetCount((value) => value + 1)}
                views={CAMERA_SHOT_VIEWS}
                gridEnabled={showGrid}
                onToggleGrid={() => setShowGrid((value) => !value)}
                speedScale={speedScale}
                onSpeedChange={setSpeedScale}
                maxSpeedScale={8}
                className={simulationUi.cameraSwitcherPosition}
              />
              <VesselExperimentDocks
                experiment={cruiseExperiment}
                session={session}
                status={
                  <HUD
                    state={state}
                    activeSeq={session.activeSeq}
                    finsEnabled={finsEnabled}
                    finWearIntegralDeg={finWearIntegralDeg}
                    finFaultLocked={finFaultLocked}
                    showForceVectors={showForceVectors}
                    onToggleForceVectors={() => setShowForceVectors((v) => !v)}
                  />
                }
                controls={<CruiseCourseControls session={session} timeS={state.time} />}
                assessment={
                  <VesselCourseEvidencePanel
                    session={session}
                    courseKey="cruise"
                    stepSequence={session.step.seq}
                    defaultChannel="fin-to-roll"
                  />
                }
              />
              {!isEmbedded ? (
                <SimulationTopBar
                  title="爱达·魔都号邮轮横摇控制"
                  subtitle="双吊舱操纵 · 有限减摇鳍 · 教学舒适性代理"
                  badge="Cruise / OBE"
                />
              ) : null}
              <div
                className={`${simulationUi.panel} absolute bottom-4 left-4 z-10 hidden max-w-[calc(50%-12rem)] truncate px-3 py-2 text-[11px] text-platform-fg-secondary xl:block`}
              >
                拖拽旋转 · 滚轮缩放 · 右键平移 · 浅蓝为期望航线，深蓝为实际航迹
              </div>
            </SceneShell>
          </SceneQualityProvider>
        </TeachingAnnotationsProvider>
      </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}
