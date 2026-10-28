'use client';
import { MarineGrid as Grid } from '../scene/lines/marine-grid';

/**
 * 海洋石油981深水钻井平台动力定位仿真
 * 使用 3DOF 耦合模型 + 解耦控制 + 8台推进器推力分配
 */

import { Suspense, useState, useRef, useCallback, useEffect, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  PerspectiveCamera,
  Line,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { MarineCanvas } from '../scene/marine-canvas';
import { MarineWater } from '../scene/water/marine-water';
import { SimulationClock } from '@/lib/simulation';
import { VersionedFleetShip } from '@/resources/simulations/components/versioned-fleet-ship';
import type { BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, SimulationAssessmentPanel, simulationUi, type ExperimentHostBrief } from '../components/simulation-ui';
import { useSimulationSceneTheme, simulationScenePalette } from '../components/simulation-theme';
import {
  EnvironmentScene,
  MarineSceneLayoutObjects,
  SceneEnvironmentProvider,
  useEnvironmentWaterColors,
  useSceneEnvironment,
} from '../scene/environment';
import { createNearFieldSurfaceQuery, GERSTNER_WATER_BASE_Y, gerstnerAmplitudeScale, useNearFieldWaterHeight } from '../scene/water';
import { computeThrusterWashActivity } from '../scene/wake/wake-physics';
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
import { drillingHysy981SceneVisual } from '../profiles/drilling-hysy981-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';
import { Anchor, ArrowDownFromLine, Compass, Gauge, Orbit, Settings, Target, Video, Waves } from 'lucide-react';

import { Slider } from '@/components/ui/slider';
import {
  SimChip,
  SimField,
  SimLockedChip,
  SimMeter,
  SimNotice,
  SimPanelSection,
  SimPanelStack,
  SimReadout,
  SimReadoutGrid,
  SimRunControls,
  SimStatusStrip,
  SimSwitchInput,
  SimToggleRow,
  simToneText,
} from '../components/simulation-panels';

import {
  getDrillingDefaultConfig,
} from '../profiles/drilling-hysy981';
import { HYSY981_PLATFORM_PARAMS } from '../core/constants';
import {
  createSemiSub3DOFState,
  createCurrentEnvironment,
  createWindEnvironment,
  getTypicalEnvironment,
  createDPControllerConfig,
  createDPDecouplingState,
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
  type SemiSubmersible3DOFState,
  type CurrentEnvironment,
  type WindEnvironment,
  type DPControllerConfig,
  type DPDecouplingState,
} from '../physics/simulation-engine-facade';
import { createDrillingDrive } from './vessel-drives';
import { drillingExperiment } from './vessel-experiments';
import { takeVesselSubstep, vesselSampleMark } from './vessel-experiment';
import { VesselExperimentDocks } from './vessel-experiment-panels';
import { useVesselExperiment } from './use-vessel-experiment';
import {
  HYSY981_THRUSTER_LAYOUT,
  DRILLING_ETHICAL_THRESHOLDS,
  DRILLING_DEFAULT_DP,
} from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';
import {
  advanceStationKeepAttainment,
  displayRpmFromThrust,
} from '../lib/heading-attainment';
import type { ControlMode, EthicalViolation, Vector2, ThrusterState } from '../core/types';
import { toRadians, toDegrees } from '../core/constants';

// ============ 类型定义 ============

interface SimulationConfig {
  controlMode: ControlMode;
  targetPosition: Vector2;
  targetHeading: number;
  seaStateLevel: number;
  decouplingEnabled: boolean;
}

interface SimulationMetrics {
  positionError: number;
  headingError: number;
  totalPower: number;
  time: number;
}

// ============ 着色器材质 ============

const waterVertexShader = `
  uniform float time;
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    vUv = uv;
    vec3 pos = position;

    float wave1 = sin(pos.x * 0.015 + time * 0.4) * 0.8;
    float wave2 = sin(pos.y * 0.012 + time * 0.3) * 0.5;
    float wave3 = sin((pos.x + pos.y) * 0.008 + time * 0.35) * 0.4;

    pos.z = wave1 + wave2 + wave3;
    vHeight = pos.z;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const waterFragmentShader = `
  uniform float time;
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    vec3 deepColor = vec3(0.0, 0.15, 0.35);
    vec3 shallowColor = vec3(0.0, 0.4, 0.6);
    vec3 foamColor = vec3(0.85, 0.9, 0.95);

    float depth = smoothstep(-1.5, 1.5, vHeight);
    vec3 waterColor = mix(deepColor, shallowColor, depth);

    float foam = smoothstep(0.4, 0.6, vHeight);
    waterColor = mix(waterColor, foamColor, foam * 0.25);

    gl_FragColor = vec4(waterColor, 0.92);
  }
`;

// ============ 3D 组件 ============

function DrillingPlatformModel(props: {
  position: Vector2;
  heading: number;
  simRef: MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
}) {
  // 水线参考（#2117）：共享波面采样（与 GPU 同表面定义），替代隐含 waterY=0。
  const waterHeight = useNearFieldWaterHeight({
    positionSampler: () => props.position,
    seaState: 3,
  });

  return (
    <VersionedFleetShip
      logicalId="drilling-rig"
      simRef={props.simRef}
      position={props.position}
      waterYSampler={() => waterHeight(props.position.x, props.position.z)}
      headingRad={props.heading}
      sceneLengthMeters={HYSY981_PLATFORM_PARAMS.LENGTH}
      resetToken={props.resetToken}
      legacyYawOffsetRad={Math.PI / 2}
      fallbackDraftMeters={HYSY981_PLATFORM_PARAMS.DRAFT_TRANSIT}
    />
  );
}

/** 目标位置标记 */
function TargetMarker({ position, heading }: { position: Vector2; heading: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 2) * 2 + 5;
    }
  });

  return (
    <group name="marine-annotations" ref={groupRef} position={[position.x, 5, position.z]}>
      {/* 目标圆圈 - 绿色安全区 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION * 10, 32]} />
        <meshBasicMaterial color={simulationScenePalette.success} side={THREE.DoubleSide} transparent opacity={0.2} />
      </mesh>
      {/* 黄色警告区 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION * 10,
          DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION * 10,
          32
        ]} />
        <meshBasicMaterial color={simulationScenePalette.warning} side={THREE.DoubleSide} transparent opacity={0.2} />
      </mesh>
      {/* 红色危险区 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION * 10,
          DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT * 10,
          32
        ]} />
        <meshBasicMaterial color={simulationScenePalette.danger} side={THREE.DoubleSide} transparent opacity={0.2} />
      </mesh>
      {/* 中心十字 */}
      <mesh rotation={[0, -toRadians(heading), 0]} position={[0, 0, 0]}>
        <boxGeometry args={[20, 1, 2]} />
        <meshBasicMaterial color={simulationScenePalette.success} transparent opacity={0.8} />
      </mesh>
      <mesh rotation={[0, -toRadians(heading), 0]} position={[0, 0, 0]}>
        <boxGeometry args={[2, 1, 20]} />
        <meshBasicMaterial color={simulationScenePalette.success} transparent opacity={0.8} />
      </mesh>
      {/* 标签 */}
      <Html position={[0, 20, 0]} center>
        <div className="rounded bg-[hsl(var(--platform-brand-success)/0.78)] px-2 py-1 text-xs text-platform-fg-inverse whitespace-nowrap">
          钻井位置
        </div>
      </Html>
    </group>
  );
}

/** 航迹线 */
function TrajectoryLine({ points, waterOriginSampler, }: { points: Vector2[]; waterOriginSampler?: () => { x: number; z: number } }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} waterOriginSampler={waterOriginSampler} color={simulationScenePalette.danger} lineWidth={2} />;
}


// ============ UI 组件 ============

/** 推进器状态面板 */
function ThrusterPanel({ thrusters }: { thrusters: ThrusterState[] }) {
  // 按照俯视图布局排列
  const layout = [
    { id: 1, row: 0, col: 0 },
    { id: 5, row: 0, col: 2 },
    { id: 3, row: 1, col: 0 },
    { id: 7, row: 1, col: 2 },
    { id: 4, row: 2, col: 0 },
    { id: 8, row: 2, col: 2 },
    { id: 2, row: 3, col: 0 },
    { id: 6, row: 3, col: 2 },
  ];
  const failedCount = thrusters.filter((t) => t.failed).length;

  return (
    <SimPanelSection
      title="推进器状态"
      icon={Gauge}
      tone={failedCount > 0 ? 'danger' : 'neutral'}
      aside={failedCount > 0 ? <SimChip tone="danger">{failedCount} 台故障</SimChip> : <SimChip tone="success">全部在线</SimChip>}
    >
      <div className="grid grid-cols-3 gap-1.5">
        {layout.map(({ id, row, col }) => {
          const thruster = thrusters.find(t => t.id === id);
          if (!thruster) return null;

          const powerPercent = (thruster.power / 4500) * 100;
          const isFailed = thruster.failed;
          const tone = isFailed ? 'danger' : powerPercent > 80 ? 'warning' : 'neutral';

          return (
            <div
              key={id}
              data-sim-tone={tone}
              className="sim-panel-readout flex flex-col items-center justify-center gap-1 px-1.5 py-1 text-xs"
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
            >
              <div className="flex w-full items-baseline justify-between gap-1">
                <span className="font-semibold text-platform-fg-secondary">T{id}</span>
                <span className={`font-mono font-semibold tabular-nums ${simToneText[tone]}`}>
                  {isFailed ? '故障' : `${powerPercent.toFixed(0)}%`}
                </span>
              </div>
              <div className="sim-meter w-full">
                <span
                  className={isFailed ? 'bg-[hsl(var(--platform-brand-danger))]' : powerPercent > 80 ? 'bg-[hsl(var(--platform-brand-evidence))]' : 'bg-platform-action-primary'}
                  style={{ width: `${isFailed ? 100 : Math.min(100, powerPercent)}%` }}
                />
              </div>
            </div>
          );
        })}
        {/* 中心平台指示 */}
        <div
          className="sim-panel-readout flex flex-col items-center justify-center text-[11px] text-platform-fg-secondary"
          style={{ gridRow: '2 / 4', gridColumn: 2 }}
        >
          <Anchor className="h-4 w-4 text-platform-action-primary" aria-hidden="true" />
          <span className="mt-1">平台</span>
        </div>
      </div>
      <div className="mt-2 text-center text-[11px] text-platform-fg-muted">船艏方向 ↑</div>
    </SimPanelSection>
  );
}

const DRILLING_ALERT_TONE = { green: 'success', yellow: 'warning', red: 'danger', emergency: 'danger' } as const;
const DRILLING_ALERT_LABEL = { green: '定位正常', yellow: '黄色警报', red: '红色警报', emergency: '紧急解脱' } as const;

/** HUD 显示 */
function HUD({
  metrics,
  violations,
  isRunning,
  thrusters,
  decouplingEnabled,
}: {
  metrics: SimulationMetrics;
  violations: EthicalViolation[];
  isRunning: boolean;
  thrusters: ThrusterState[];
  decouplingEnabled: boolean;
}) {
  // 确定警报级别
  const alertLevel = metrics.positionError > DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT
    ? 'emergency'
    : metrics.positionError > DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION
    ? 'red'
    : metrics.positionError > DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION
    ? 'yellow'
    : 'green';
  const alertTone = DRILLING_ALERT_TONE[alertLevel];

  return (
    <SimPanelStack>
      <SimStatusStrip state={isRunning ? 'running' : metrics.time > 0 ? 'paused' : 'idle'} time={`${metrics.time.toFixed(1)}s`}>
        <SimChip tone={decouplingEnabled ? 'accent' : 'neutral'}>{decouplingEnabled ? '解耦控制' : '标准PID'}</SimChip>
      </SimStatusStrip>

      <SimPanelSection
        title="DP 定位状态"
        icon={Target}
        tone={alertLevel === 'green' ? 'neutral' : alertTone}
        aside={(
          <SimChip tone={alertTone} className={alertLevel === 'emergency' ? 'animate-pulse' : undefined}>
            {DRILLING_ALERT_LABEL[alertLevel]}
          </SimChip>
        )}
      >
        <SimReadoutGrid columns={3}>
          <SimReadout label="位置误差" value={metrics.positionError.toFixed(2)} unit="m" tone={alertTone} />
          <SimReadout label="航向误差" value={metrics.headingError.toFixed(1)} unit="°" tone={metrics.headingError > 10 ? 'warning' : 'success'} />
          <SimReadout label="总功率" value={(metrics.totalPower / 1000).toFixed(1)} unit="MW" tone={metrics.totalPower > 28000 ? 'warning' : 'neutral'} />
        </SimReadoutGrid>
        <SimMeter
          className="mt-2.5"
          label="位置误差相对紧急解脱阈值"
          value={metrics.positionError / DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT}
          tone={alertTone}
          scale={[
            '0m',
            `${DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION}m`,
            `${DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION}m`,
            `${DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT}m`,
          ]}
        />
      </SimPanelSection>

      <ThrusterPanel thrusters={thrusters} />

      {violations.length > 0 ? (
        <SimNotice tone="danger" title={`伦理违规 (${violations.length})`}>
          <div className="max-h-32 space-y-0.5 overflow-y-auto">
            {violations.slice(-5).map((v, i) => (
              <div key={i}>[{v.timestamp.toFixed(1)}s] {v.description}</div>
            ))}
          </div>
        </SimNotice>
      ) : null}
    </SimPanelStack>
  );
}

/** 控制面板 */
function ControlPanel({
  config,
  onConfigChange,
  onStart,
  onPause,
  onReset,
  isRunning,
  inputsEnabled = true,
}: {
  config: SimulationConfig;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  isRunning: boolean;
  inputsEnabled?: boolean;
}) {
  const env = getTypicalEnvironment(config.seaStateLevel);
  return (
    <SimPanelStack>
      <SimRunControls
        running={isRunning}
        primaryLabel={isRunning ? '暂停' : '开始'}
        onPrimary={isRunning ? onPause : onStart}
        onReset={onReset}
      />

      <SimPanelSection title="控制策略" icon={Settings} aside={<SimLockedChip locked={!inputsEnabled} />}>
        <SimToggleRow
          label="解耦控制"
          description="消除纵荡、横荡与艏摇之间的耦合"
          htmlFor="drilling-decoupling"
          control={(
            <SimSwitchInput
              id="drilling-decoupling"
              checked={config.decouplingEnabled}
              disabled={!inputsEnabled}
              onChange={(event) => onConfigChange({ decouplingEnabled: event.target.checked })}
            />
          )}
        />
      </SimPanelSection>

      <SimPanelSection title="定位目标" icon={Target}>
        <div className="space-y-3">
          <SimField label="目标 X" value={`${config.targetPosition.x} m`}>
            <Slider
              aria-label="目标 X"
              disabled={!inputsEnabled}
              className={simulationUi.slider}
              value={[config.targetPosition.x]}
              min={-100}
              max={100}
              step={1}
              onValueChange={([v]) =>
                onConfigChange({ targetPosition: { ...config.targetPosition, x: v } })
              }
            />
          </SimField>
          <SimField label="目标 Z" value={`${config.targetPosition.z} m`}>
            <Slider
              aria-label="目标 Z"
              disabled={!inputsEnabled}
              className={simulationUi.slider}
              value={[config.targetPosition.z]}
              min={-100}
              max={100}
              step={1}
              onValueChange={([v]) =>
                onConfigChange({ targetPosition: { ...config.targetPosition, z: v } })
              }
            />
          </SimField>
          <SimField label="目标航向" value={`${config.targetHeading}°`}>
            <Slider
              aria-label="目标航向"
              disabled={!inputsEnabled}
              className={simulationUi.slider}
              value={[config.targetHeading]}
              min={-180}
              max={180}
              step={5}
              onValueChange={([v]) => onConfigChange({ targetHeading: v })}
            />
          </SimField>
        </div>
      </SimPanelSection>

      <SimPanelSection title="海况环境" icon={Waves}>
        <SimField
          label="海况等级"
          value={`等级 ${config.seaStateLevel} · ${config.seaStateLevel <= 2 ? '平静' : config.seaStateLevel <= 4 ? '中等' : '恶劣'}`}
        >
          <Slider
            aria-label="海况等级"
            disabled={!inputsEnabled}
            className={simulationUi.slider}
            value={[config.seaStateLevel]}
            min={1}
            max={6}
            step={1}
            onValueChange={([v]) => onConfigChange({ seaStateLevel: v })}
          />
        </SimField>
        <SimReadoutGrid columns={3} className="mt-2.5">
          <SimReadout label="有效波高" value={env.waveHeight.toFixed(1)} unit="m" />
          <SimReadout label="风速" value={env.windSpeed} unit="m/s" />
          <SimReadout label="流速" value={env.currentSpeed.toFixed(1)} unit="m/s" />
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

/** 海面颜色随环境预设、细分随质量档位的桥接组件（DP 平台位置直读 ref）。 */
function DrillingWater({
  platformStateRef,
  resetToken,
  playing,
}: {
  platformStateRef: RefObject<SemiSubmersible3DOFState>;
  resetToken: number;
  playing: boolean;
}) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <MarineWater
      worldSpeedSampler={() => playing ? Math.hypot(platformStateRef.current.u, platformStateRef.current.v) : 0}
      foamEmittersSampler={() => {
        if (!playing) return [];
        const state = platformStateRef.current;
        return state.thrusters.flatMap(thruster => {
          const layout = HYSY981_THRUSTER_LAYOUT.find(item => item.id === thruster.id);
          if (!layout || !thruster.enabled || thruster.failed || Math.abs(thruster.power) < 1) return [];
          return [{
            id: `thruster-${thruster.id}`, diameterMeters: 3.5, depthMeters: 8,
            x: state.x + layout.positionX * Math.cos(state.psi) - layout.positionY * Math.sin(state.psi),
            z: state.y + layout.positionX * Math.sin(state.psi) + layout.positionY * Math.cos(state.psi),
            headingRad: platformHeadingToSceneRad(toDegrees(state.psi) + thruster.azimuth),
            activity: computeThrusterWashActivity({ totalThrustPower: Math.abs(thruster.power), ratedPowerPerThruster: 4500, thrusterCount: 1 }).washFoamActivity,
          }];
        });
      }}
      vesselLengthMeters={114} vesselBeamMeters={89}
      resetToken={resetToken}
      tier={params.waterTier}
      positionSampler={() => ({ x: platformStateRef.current.x, z: platformStateRef.current.y })}
      shipHeadingSampler={() => platformHeadingToSceneRad(toDegrees(platformStateRef.current.psi))}
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

/** 教学标注开关门控：默认关闭，开启时显示 DP 目标点标记。 */
function TeachingAnnotationsGate({
  position,
  heading,
}: {
  position: Vector2;
  heading: number;
}) {
  const { showAnnotations } = useTeachingAnnotations();
  if (!showAnnotations) return null;
  return <TargetMarker position={position} heading={heading} />;
}

// ============ 主组件 ============

export function DrillingSimulation({ ticket = '', stepNav, hostBrief, hostSubmission }: { ticket?: string; stepNav?: ReactNode; hostBrief?: ExperimentHostBrief; hostSubmission?: ReactNode }) {
  const session = useVesselExperiment(drillingExperiment, ticket);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const driveRef = useRef<ReturnType<typeof createDrillingDrive> | null>(null);
  const markRef = useRef(-1);
  const timeRef = useRef(0);
  // 配置状态
  const defaultConfig = getDrillingDefaultConfig();
  const [config, setConfig] = useState<SimulationConfig>({
    controlMode: defaultConfig.controlMode,
    targetPosition: defaultConfig.targetPosition,
    targetHeading: defaultConfig.targetHeading,
    seaStateLevel: defaultConfig.seaState.level,
    decouplingEnabled: defaultConfig.decouplingEnabled,
  });

  // 仿真状态
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    positionError: 0,
    headingError: 0,
    totalPower: 0,
    time: 0,
  });
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);
  const [violations, setViolations] = useState<EthicalViolation[]>([]);
  const [thrusters, setThrusters] = useState<ThrusterState[]>([]);

  // 引用
  const platformStateRef = useRef<SemiSubmersible3DOFState>(
    createSemiSub3DOFState(0, 0, 0)
  );
  const dpStateRef = useRef<DPDecouplingState>(createDPDecouplingState());
  const dpConfigRef = useRef<DPControllerConfig>(
    createDPControllerConfig(DRILLING_DEFAULT_DP, true)
  );
  const currentEnvRef = useRef<CurrentEnvironment>(
    createCurrentEnvironment(0.5, 45, 0.1)
  );
  const windEnvRef = useRef<WindEnvironment>(
    createWindEnvironment(10, 45, 1.2)
  );
  const meanWindSpeedRef = useRef(10);
  const waveHeightRef = useRef(1.5);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef(performance.now());
  const clockRef = useRef(
    new SimulationClock({
      dt: SIMULATION_FIXED_STEP_SECONDS,
      maxSubSteps: SIMULATION_MAX_SUB_STEPS,
    })
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [cameraMode, setCameraMode] = useState<string>('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(8);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const sceneTheme = useSimulationSceneTheme();
  const bindingRef = useRef<BindingTelemetrySource>({
    rudderDeg: 0,
    speedMps: 0,
    attainedCount: 0,
    advancing: false,
  });
  const stationKeepRef = useRef({ dwell: 0, armed: true });

  const resetPose = useCallback((clearCurve: boolean) => {
    const drive = driveRef.current;
    if (!drive) return;
    const command = drillingExperiment.command(sessionRef.current.step, 0);
    drive.reset(command);
    const view = drive.view();
    platformStateRef.current = view.state;
    markRef.current = -1;
    timeRef.current = 0;
    stationKeepRef.current = { dwell: 0, armed: true };
    bindingRef.current = { rudderDeg: 0, speedMps: 0, attainedCount: 0, advancing: false };
    if (clearCurve) sessionRef.current.clearSamples();
    lastUpdateRef.current = performance.now();
    clockRef.current.reset();
    setIsRunning(false);
    setTrajectory([]);
    setViolations([]);
    setThrusters([...view.state.thrusters]);
    setMetrics({ positionError: view.positionError, headingError: view.headingError, totalPower: view.power, time: 0 });
    setConfig((prev) => ({
      ...prev,
      decouplingEnabled: command.decoupling,
      seaStateLevel: command.seaState,
      targetHeading: command.targetHeading,
      targetPosition: { x: command.targetX, z: command.targetZ },
    }));
    setResetCount((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    preloadVirtualSimulationRuntime().catch(console.error);
    driveRef.current = createDrillingDrive();
    if (!cancelled) resetPose(false);
    return () => {
      cancelled = true;
    };
  }, [resetPose]);

  useEffect(() => {
    resetPose(false);
  }, [session.activeSeq, resetPose]);

  // 更新海况
  useEffect(() => {
    const env = getTypicalEnvironment(config.seaStateLevel);
    currentEnvRef.current = createCurrentEnvironment(env.currentSpeed, 45, 0.1);
    windEnvRef.current = createWindEnvironment(env.windSpeed, 45, 1.2);
    meanWindSpeedRef.current = env.windSpeed;
    waveHeightRef.current = env.waveHeight;
  }, [config.seaStateLevel]);

  // 仿真主循环
  const simulate = useCallback(() => {
    if (!isRunning) return;

    if (!isVirtualSimulationRuntimeReady()) {
      lastUpdateRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(simulate);
      return;
    }

    const now = performance.now();
    const frameDt = getSimulationDeltaFromMilliseconds(now, lastUpdateRef.current, speedScale);
    lastUpdateRef.current = now;

    const stepSimulation = (dt: number) => {
      const drive = driveRef.current;
      if (!drive) return;
      const moved = takeVesselSubstep(
        sessionRef.current.step,
        (time) => drillingExperiment.command(sessionRef.current.step, time),
        (command, stepDt, time) => drive.step(command, stepDt, time),
        timeRef.current,
        dt,
      );
      timeRef.current = moved.time;
      if (!moved.sample) return;
      const view = drive.view();
      platformStateRef.current = view.state;
      const mark = vesselSampleMark(moved.sample.time);
      if (mark > markRef.current) {
        markRef.current = mark;
        sessionRef.current.observe(moved.sample);
      }
      const posError = view.positionError;
      const headError = view.headingError;
      const totalPower = view.power;
      const surgeSpeed = Math.hypot(view.state.u, view.state.v);
      const insideDeadzone =
        posError <= DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION
        && headError <= 5;
      let attainedCount = bindingRef.current.attainedCount;
      if (advanceStationKeepAttainment(stationKeepRef.current, insideDeadzone, dt)) {
        attainedCount += 1;
      }
      bindingRef.current = {
        rudderDeg: 0,
        speedMps: surgeSpeed,
        attainedCount,
        advancing: true,
        thrusters: platformStateRef.current.thrusters.map((thruster) => ({
          id: thruster.id,
          azimuthRad: toRadians(thruster.azimuth),
          rpm: displayRpmFromThrust(Math.abs(thruster.thrust), 800, 90),
        })),
      };

      // 更新指标
      setMetrics({
        positionError: posError,
        headingError: headError,
        totalPower,
        time: timeRef.current,
      });

      // 更新推进器状态
      setThrusters([...platformStateRef.current.thrusters]);

      // 违规检测
      const newViolations: EthicalViolation[] = [];

      if (posError > DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT) {
        newViolations.push({
          type: 'EMERGENCY_DISCONNECT',
          thresholdValue: DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT,
          actualValue: posError,
          timestamp: timeRef.current,
          description: `紧急解脱: 位置偏差 ${posError.toFixed(1)}m`,
          severity: 'critical',
        });
      } else if (posError > DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION) {
        newViolations.push({
          type: 'RED_ALERT_POSITION',
          thresholdValue: DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION,
          actualValue: posError,
          timestamp: timeRef.current,
          description: `红色警报: 位置偏差 ${posError.toFixed(1)}m`,
          severity: 'critical',
        });
      } else if (posError > DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION) {
        newViolations.push({
          type: 'YELLOW_ALERT_POSITION',
          thresholdValue: DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION,
          actualValue: posError,
          timestamp: timeRef.current,
          description: `黄色警报: 位置偏差 ${posError.toFixed(1)}m`,
          severity: 'warning',
        });
      }

      if (newViolations.length > 0) {
        setViolations((prev) => [...prev.slice(-20), ...newViolations]);
      }

      // 记录轨迹
      setTrajectory((prev) => {
        const newPoint = {
          x: platformStateRef.current.x,
          z: platformStateRef.current.y,
        };
        if (prev.length === 0) return [newPoint];
        const last = prev[prev.length - 1];
        const dist = Math.sqrt((newPoint.x - last.x) ** 2 + (newPoint.z - last.z) ** 2);
        if (dist > 0.5) {
          return [...prev.slice(-300), newPoint];
        }
        return prev;
      });
    };

    clockRef.current.advance(frameDt, stepSimulation);

    animationFrameRef.current = requestAnimationFrame(simulate);
  }, [isRunning, speedScale]);

  useEffect(() => {
    if (isRunning) return;
    bindingRef.current = { ...bindingRef.current, advancing: false };
  }, [isRunning]);

  // 启动/停止仿真
  useEffect(() => {
    if (isRunning) {
      clockRef.current.reset();
      lastUpdateRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(simulate);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, simulate]);

  // 控制函数
  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    resetPose(true);
  };

  const handleConfigChange = (updates: Partial<SimulationConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  // 当前平台位置
  const platformPosition = {
    x: platformStateRef.current.x,
    z: platformStateRef.current.y,
  };
  const platformHeading = platformStateRef.current.psi;

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      {/* 3D 场景 */}
      <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
        <PerspectiveCamera makeDefault position={[400, 300, 400]} fov={60} near={1} far={50000} />
        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={100}
          maxDistance={2500}
          maxPolarAngle={Math.PI / 2.1}
        />
        <RightClickFreeModeBridge onRequestFreeMode={() => setCameraMode('free')} />

        <Suspense fallback={null}>
          <EnvironmentScene subjectPositionSampler={() => ({ x: platformStateRef.current.x, z: platformStateRef.current.y })} />
        <MarineSceneLayoutObjects layoutId="offshore-operations-area" />
        </Suspense>
        <SoundscapeAmbienceDriver />
        <SceneQualityDriver />
        <MarinePerformanceEvidenceProbe contextInput={() => ({ vesselId: 'drilling', cameraView: String(cameraMode), seaState: config.seaStateLevel })} />
        <Suspense fallback={null}>
          <DrillingWater playing={isRunning} platformStateRef={platformStateRef} resetToken={resetCount} />
        </Suspense>

        {/* 网格 */}
        {showGrid ? (
          <Grid name="marine-grid"
            position={[0, 0.35, 0]}
            args={[20000, 20000]}
            cellSize={100}
            cellThickness={0.5}
            cellColor={sceneTheme.gridCellColor}
            sectionSize={500}
            sectionThickness={1}
            sectionColor={sceneTheme.gridSectionColor}
            fadeDistance={9000}
            fadeStrength={1}
          />
        ) : null}

        {/* 目标标记（教学标注门控，默认关闭；坐标在控制面板数值可读） */}
        <TeachingAnnotationsGate position={config.targetPosition} heading={config.targetHeading} />

        {/* 钻井平台 */}
        <Suspense
          fallback={(
            <ModelLoadingPlaceholder
              label="钻井平台模型加载中"
              sublabel="场景已就绪，可先查看海况与目标点"
            />
          )}
        >
          <DrillingPlatformModel
            position={platformPosition}
            heading={platformHeading}
            simRef={bindingRef}
            resetToken={resetCount}
          />
        </Suspense>

        {/* 航迹 */}
        {trajectory.length > 1 && <TrajectoryLine points={trajectory} waterOriginSampler={() => ({ x: platformStateRef.current.x, z: platformStateRef.current.y })} />}


        <StayPutCameraController
          view={cameraMode}
          positionSampler={() => ({ x: platformStateRef.current.x, z: platformStateRef.current.y })}
          headingSampler={() => platformHeadingToSceneRad(toDegrees(platformStateRef.current.psi))}
          shipLength={drillingHysy981SceneVisual.shipLengthMeters}
          controlsRef={controlsRef}
        resetSignal={viewResetCount}
        />
        <ScenePostEffects />
      </MarineCanvas>

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

      <VesselExperimentDocks
        experiment={drillingExperiment}
        session={session}
        status={(
          <HUD
            metrics={metrics}
            violations={violations}
            isRunning={isRunning}
            thrusters={thrusters}
            decouplingEnabled={config.decouplingEnabled}
          />
        )}
        controls={(
          <ControlPanel
            config={config}
            onConfigChange={handleConfigChange}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
            isRunning={isRunning}
            inputsEnabled={false}
          />
        )}
        stepNav={stepNav}
        hostBrief={hostBrief}
        hostSubmission={hostSubmission}
        assessment={(
          <SimulationAssessmentPanel
            title="DP定位评估"
            metrics={[
              { id: 'position', label: '位置误差', value: metrics.positionError, max: 12, better: 'lower', unit: 'm' },
              { id: 'heading', label: '航向误差', value: metrics.headingError, max: 45, better: 'lower', unit: '°' },
              { id: 'power', label: '总功率', value: metrics.totalPower / 1000, max: 40, better: 'lower', unit: 'MW' },
            ]}
          />
        )}
      />

      <SimulationTopBar
        title="海洋石油981动力定位"
        subtitle="DP 解耦控制 · 推力分配 · 风浪流扰动"
        badge="Drilling / OBE"
      />

    </div>
    </SceneQualityProvider>
    </TeachingAnnotationsProvider>
    </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}

export default DrillingSimulation;
