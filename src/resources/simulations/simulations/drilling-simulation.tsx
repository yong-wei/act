'use client';

import { Suspense, useState, useRef, useCallback, useEffect, type MutableRefObject, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Anchor, ArrowDownFromLine, Compass, Gauge, Orbit, Target, Video, Waves } from 'lucide-react';
import { MarineGrid as Grid } from '../scene/lines/marine-grid';
import { MarineCanvas } from '../scene/marine-canvas';
import { MarineWater } from '../scene/water/marine-water';
import { SimulationClock } from '@/lib/simulation';
import { VersionedFleetShip } from '../components/versioned-fleet-ship';
import type { BindingTelemetrySource } from '../components/semantic-bindings-rig';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, simulationUi } from '../components/simulation-ui';
import { useSimulationSceneTheme, simulationScenePalette } from '../components/simulation-theme';
import { EnvironmentScene, MarineSceneLayoutObjects, SceneEnvironmentProvider, useEnvironmentWaterColors } from '../scene/environment';
import { SceneSoundscapeProvider, SoundscapeAmbienceDriver } from '../scene/audio';
import { TeachingAnnotationsProvider, useTeachingAnnotations } from '../scene/annotations';
import { SceneQualityDriver, SceneQualityProvider, useSceneQuality, MarinePerformanceEvidenceProbe } from '../scene/quality';
import { ScenePostEffects } from '../scene/post';
import { drillingHysy981SceneVisual } from '../profiles/drilling-hysy981-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';
import { computeThrusterWashActivity } from '../scene/wake/wake-physics';
import { SimChip, SimMeter, SimNotice, SimPanelSection, SimPanelStack, SimReadout, SimReadoutGrid, SimStatusStrip, SimSwitchInput, SimToggleRow, simToneText } from '../components/simulation-panels';
import { DrillingThrusterRadar } from '../experiments/drilling-thruster-radar';
import { HYSY981_PLATFORM_PARAMS, DRILLING_ETHICAL_THRESHOLDS, toRadians, toDegrees } from '../core/constants';
import type { EthicalViolation, Vector2, ThrusterState } from '../core/types';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { drillingCourseExperiment as drillingExperiment } from '../experiments/drilling-experiment';
import { drillingCourseAdapter, drillingCourseTraceSamples } from '../experiments/drilling-course';
import { DrillingCourseControls } from '../experiments/drilling-course-controls';
import { vesselSampleMark } from './vessel-experiment';
import { VesselExperimentDocks, VesselCourseEvidencePanel } from './vessel-experiment-panels';
import { useVesselExperiment } from './use-vessel-experiment';
import { SIMULATION_FIXED_STEP_SECONDS, SIMULATION_MAX_SUB_STEPS, getSimulationDeltaFromMilliseconds } from '../lib/simulation-timing';

interface SimulationMetrics {
  positionError: number;
  headingError: number;
  totalPower: number;
  time: number;
}

interface PlatformViewState {
  x: number;
  y: number;
  psi: number;
  u: number;
  v: number;
  thrusters: Array<ThrusterState & { rpm: number; positionBodyM: [number, number, number] }>;
}

function DrillingPlatformModel(props: {
  position: Vector2;
  heading: number;
  simRef: MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
  frame: VesselSessionFrame | null;
  t2FaultActive: boolean;
}) {
  return (
    <group>
      <VersionedFleetShip
        logicalId="drilling-rig"
        simRef={props.simRef}
        position={props.position}
        waterY={-(props.frame?.truth.position_ned[2] ?? 0)}
        extraEuler={{ x: toRadians(props.frame?.attitudeDeg.pitch ?? 0), z: toRadians(props.frame?.attitudeDeg.roll ?? 0) }}
        headingRad={props.heading}
        sceneLengthMeters={HYSY981_PLATFORM_PARAMS.LENGTH}
        resetToken={props.resetToken}
        legacyYawOffsetRad={Math.PI / 2}
        fallbackDraftMeters={19}
      />
      {props.t2FaultActive ? (
        <Html position={[props.position.x, 26, props.position.z]} center>
          <div className="rounded border border-[hsl(var(--platform-brand-danger)/0.6)] bg-[hsl(var(--platform-brand-danger)/0.92)] px-2.5 py-1 text-xs font-semibold text-platform-fg-inverse whitespace-nowrap shadow">
            T2 断桨故障 · 7 推力器重分配
          </div>
        </Html>
      ) : null}
    </group>
  );
}

/** 井口 1.0m 绿 / 1.5m 黄 / 2.5m 红(EDS) 同心安全包络警戒圈 */
function WellheadSafetyEnvelopeRings({
  position,
  visible,
}: {
  position: Vector2;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <group name="wellhead-safety-envelope" position={[position.x, 0.55, position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, 1.0, 48]} />
        <meshBasicMaterial color={simulationScenePalette.success} side={THREE.DoubleSide} transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.92, 1.04, 48]} />
        <meshBasicMaterial color={simulationScenePalette.success} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.04, 1.5, 48]} />
        <meshBasicMaterial color={simulationScenePalette.warning} side={THREE.DoubleSide} transparent opacity={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.44, 1.56, 48]} />
        <meshBasicMaterial color={simulationScenePalette.warning} side={THREE.DoubleSide} transparent opacity={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.56, 2.5, 48]} />
        <meshBasicMaterial color={simulationScenePalette.danger} side={THREE.DoubleSide} transparent opacity={0.24} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[2.42, 2.58, 48]} />
        <meshBasicMaterial color={simulationScenePalette.danger} side={THREE.DoubleSide} transparent opacity={0.92} />
      </mesh>
      <Html position={[0, 8, 0]} center>
        <div className="sim-hud-tile px-2 py-0.5 text-[10px] font-medium text-platform-fg-primary whitespace-nowrap shadow">
          井口安全包络：1.0m 绿 · 1.5m 黄 · 2.5m 红(EDS 紧急解脱)
        </div>
      </Html>
    </group>
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
        <ringGeometry args={[0, DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION, 32]} />
        <meshBasicMaterial color={simulationScenePalette.success} side={THREE.DoubleSide} transparent opacity={0.2} />
      </mesh>
      {/* 黄色警告区 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION,
          DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION,
          32
        ]} />
        <meshBasicMaterial color={simulationScenePalette.warning} side={THREE.DoubleSide} transparent opacity={0.2} />
      </mesh>
      {/* 红色危险区 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION,
          DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT,
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
          目标位置
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
function ThrusterPanel({ thrusters }: { thrusters: PlatformViewState['thrusters'] }) {
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

          const powerPercent = (thruster.power / 4600) * 100;
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
              <span className="font-mono text-[10px] tabular-nums">{thruster.azimuth.toFixed(1)}° · {thruster.rpm.toFixed(1)}rpm</span>
              <span className="font-mono text-[10px] tabular-nums">{Number.isFinite(thruster.thrust) ? thruster.thrust.toFixed(1) : '—'}kN</span>
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
const DRILLING_ALERT_LABEL = { green: '定位正常', yellow: '黄色警报', red: '红色警报', emergency: '超过教学警戒' } as const;

/** HUD 显示 */
function HUD({
  metrics,
  violations,
  isRunning,
  thrusters,
  decouplingEnabled,
  frame,
  completed,
  showWellheadEnvelope,
  onToggleWellheadEnvelope,
}: {
  metrics: SimulationMetrics;
  violations: EthicalViolation[];
  isRunning: boolean;
  thrusters: PlatformViewState['thrusters'];
  decouplingEnabled: boolean;
  frame: VesselSessionFrame | null;
  completed: boolean;
  showWellheadEnvelope: boolean;
  onToggleWellheadEnvelope: () => void;
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
      <SimStatusStrip state={completed ? 'completed' : isRunning ? 'running' : metrics.time > 0 ? 'paused' : 'idle'} time={`${metrics.time.toFixed(1)}s`}>
        <SimChip tone={decouplingEnabled ? 'accent' : 'neutral'}>{frame?.dpController ? decouplingEnabled ? '模型交叉补偿' : '位置PID' : '手动推进器'}</SimChip>
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
          label="位置误差与教学警戒"
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

      <SimPanelSection title="六自由度与定位反馈" icon={Waves}>
        <SimReadoutGrid columns={2}>
          <SimReadout label="北向实际位置" value={frame?.truth.position_ned[0].toFixed(3) ?? '—'} unit="m" />
          <SimReadout label="东向实际位置" value={frame?.truth.position_ned[1].toFixed(3) ?? '—'} unit="m" />
          <SimReadout label="升沉" value={frame ? (-frame.truth.position_ned[2]).toFixed(3) : '—'} unit="m" />
          <SimReadout label="横摇" value={frame?.attitudeDeg.roll.toFixed(3) ?? '—'} unit="°" />
          <SimReadout label="纵摇" value={frame?.attitudeDeg.pitch.toFixed(3) ?? '—'} unit="°" />
          <SimReadout label="航向" value={frame?.attitudeDeg.heading.toFixed(3) ?? '—'} unit="°" />
          <SimReadout label="对水纵向速度" value={frame?.waterVelocityBody[0].toFixed(3) ?? '—'} unit="m/s" />
          <SimReadout label="对地纵向速度" value={frame?.truth.body_velocity[0].toFixed(3) ?? '—'} unit="m/s" />
        </SimReadoutGrid>
        {frame?.dpController ? <div className="mt-3 space-y-2 text-xs text-platform-fg-secondary">
          <p>{frame.dpController.navigationGood ? '定位量测可用' : `定位量测缺失${frame.dpController.missingNavigationS.toFixed(1)}s`}，{frame.dpController.safeExit ? '已退出定位，出力随实际轴系降低' : frame.dpController.integralFrozen ? '积分已冻结' : '积分与抗饱和工作中'}。</p>
          <p>归一化分配残差 {frame.dpController.allocation?.normalizedResidual.toFixed(5) ?? '等待有效编码器'}，本次迭代 {frame.dpController.allocation?.iterations ?? 0} 次。</p>
          <p>单台正车与反车的射流方向均受邻机扇区限制，转向时保留实际轴速和方位。</p>
        </div> : null}
        <p className="mt-2 text-xs text-platform-fg-secondary">本实验分析位置保持与推进控制，钻柱和隔水管的结构安全需要专门评估。</p>
      </SimPanelSection>
      <SimPanelSection title="井口 3D 安全包络警戒圈" icon={Target}>
        <SimToggleRow
          label="显示 1.0m 绿 / 1.5m 黄 / 2.5m 红(EDS) 警戒圈"
          htmlFor="drilling-wellhead-envelope-toggle"
          control={
            <SimSwitchInput
              id="drilling-wellhead-envelope-toggle"
              checked={showWellheadEnvelope}
              onChange={onToggleWellheadEnvelope}
            />
          }
        />
      </SimPanelSection>
      <ThrusterPanel thrusters={thrusters} />
      <DrillingThrusterRadar
        thrusters={thrusters}
        totalPowerW={metrics.totalPower * 1000}
        normalizedResidual={frame?.dpController?.allocation?.normalizedResidual}
        timeS={metrics.time}
      />

      {violations.length > 0 ? (
        <SimNotice tone="danger" title={`教学警戒 (${violations.length})`}>
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
  platformStateRef: RefObject<PlatformViewState>;
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
          const position = thruster.positionBodyM;
          if (!thruster.enabled || thruster.failed || Math.abs(thruster.power) < 1) return [];
          return [{
            id: `thruster-${thruster.id}`, diameterMeters: 4.5, depthMeters: 22,
            x: state.x + position[0] * Math.cos(state.psi) - position[1] * Math.sin(state.psi),
            z: state.y + position[0] * Math.sin(state.psi) + position[1] * Math.cos(state.psi),
            headingRad: platformHeadingToSceneRad(toDegrees(state.psi) + thruster.azimuth),
            activity: computeThrusterWashActivity({ totalThrustPower: Math.abs(thruster.power), ratedPowerPerThruster: 4600, thrusterCount: 1 }).washFoamActivity,
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

export function DrillingSimulation({ ticket = '' }: { ticket?: string }) {
  const session = useVesselExperiment(drillingExperiment, ticket, drillingCourseAdapter);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [frame, setFrame] = useState<VesselSessionFrame | null>(null);
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);
  const [cameraMode, setCameraMode] = useState('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [showWellheadEnvelope, setShowWellheadEnvelope] = useState(true);
  const [speedScale, setSpeedScale] = useState(8);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const sceneTheme = useSimulationSceneTheme();
  const platformStateRef = useRef<PlatformViewState>({ x: 0, y: 0, psi: 0, u: 0, v: 0, thrusters: [] });
  const bindingRef = useRef<BindingTelemetrySource>({ rudderDeg: 0, speedMps: 0, attainedCount: 0, advancing: false });
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const animationRef = useRef<number | null>(null);
  const speedScaleRef = useRef(8);
  const lastTimeRef = useRef(0);
  const lastHudUpdateRef = useRef(0);
  const lastTrajectoryRef = useRef(0);
  const markRef = useRef(-1);
  const clockRef = useRef(new SimulationClock({ dt: SIMULATION_FIXED_STEP_SECONDS, maxSubSteps: SIMULATION_MAX_SUB_STEPS }));
  const isRunning = Boolean(session.course?.running);
  const target = frame?.input.semisubDp?.targetPositionM ?? [0, 0];
  const targetHeading = frame?.input.semisubDp?.targetHeadingDeg ?? 0;
  const config = { targetPosition: { x: target[0], z: target[1] }, targetHeading,
    seaStateLevel: frame?.waveModel?.firstOrderEnabled ? 3 : 0, decouplingEnabled: Boolean(frame?.input.semisubDp?.decoupling) };
  const metrics: SimulationMetrics = { time: frame?.timeS ?? 0,
    positionError: frame ? Math.hypot(frame.truth.position_ned[0] - target[0], frame.truth.position_ned[1] - target[1]) : 0,
    headingError: frame ? Math.abs(((frame.attitudeDeg.heading - targetHeading + 180) % 360 + 360) % 360 - 180) : 0,
    totalPower: (frame?.propulsionPower?.positiveMechanicalPowerW ?? 0) / 1000 };
  const violations: EthicalViolation[] = metrics.positionError > 8 ? [{ type: 'RED_ALERT_POSITION', thresholdValue: 8,
    actualValue: metrics.positionError, timestamp: metrics.time, description: `超过本实验8m位置警戒，当前偏差${metrics.positionError.toFixed(2)}m`, severity: 'warning' }] : [];
  const thrusters = platformStateRef.current.thrusters;
  const platformPosition = { x: platformStateRef.current.x, z: platformStateRef.current.y };
  const platformHeading = platformStateRef.current.psi;

  const projectFrame = useCallback((current: VesselSessionFrame, running: boolean) => {
    const actual = current.truth.actuator_states;
    const thrusters = actual.azimuth_angles_rad.map((angle, index) => ({ id: index + 1,
      azimuth: toDegrees(angle), thrust: (current.propulsorThrustN?.[index] ?? NaN) / 1000,
      power: Math.max(0, actual.motor_torques_nm[index] * actual.propeller_shaft_speed_rad_s[index]) / 1000,
      rpm: actual.propeller_shaft_speed_rad_s[index] * 30 / Math.PI,
      positionBodyM: current.parameters.shaftConfigurations[index].positionBodyM,
      enabled: true, failed: Boolean(current.timeS >= 180 && current.input.semisubDp && index === 1
        && [15, 16, 19].includes(sessionRef.current.activeSeq)) }));
    platformStateRef.current = { x: current.truth.position_ned[0], y: current.truth.position_ned[1],
      psi: toRadians(current.attitudeDeg.heading), u: current.truth.body_velocity[0], v: current.truth.body_velocity[1], thrusters };
    bindingRef.current = { rudderDeg: 0, speedMps: Math.hypot(current.truth.body_velocity[0], current.truth.body_velocity[1]),
      attainedCount: 0, advancing: running, thrusters: thrusters.map((shaft) => ({ id: shaft.id, azimuthRad: toRadians(shaft.azimuth), rpm: shaft.rpm })) };
  }, []);

  useEffect(() => {
    const current = sessionRef.current.course;
    const actual = current?.ready ? current.read() : null;
    if (!actual || !current) return;
    projectFrame(actual, false);
    setFrame(actual);
    setTrajectory([]);
    setResetCount((value) => value + 1);
    clockRef.current.reset();
    lastTimeRef.current = 0;
    lastHudUpdateRef.current = actual.timeS;
    lastTrajectoryRef.current = actual.timeS;
    markRef.current = vesselSampleMark(actual.timeS);
  }, [session.course?.ready, session.activeSeq, projectFrame]);

  const simulate = useCallback((timestamp: number) => {
    const current = sessionRef.current;
    const course = current.course;
    if (!course?.ready || !course.running) return;
    const elapsed = getSimulationDeltaFromMilliseconds(timestamp, lastTimeRef.current, speedScaleRef.current);
    lastTimeRef.current = timestamp;
    let actual = course.read();
    clockRef.current.advance(elapsed, (dt) => {
      actual = course.advance(dt);
      if (!actual) return;
      projectFrame(actual, course.running);
      const point = course.latestPoint();
      if (!point) return;
      const sample = drillingCourseTraceSamples([point])[0];
      current.trackLatest(sample);
      const mark = vesselSampleMark(actual.timeS);
      if (mark > markRef.current) { markRef.current = mark; current.observe(sample); }
    });
    if (actual && (actual.timeS - lastHudUpdateRef.current >= 0.1 || actual.paused)) {
      setFrame(actual);
      lastHudUpdateRef.current = actual.timeS;
    }
    if (actual && actual.timeS - lastTrajectoryRef.current >= 0.5) {
      lastTrajectoryRef.current = actual.timeS;
      const point = { x: actual.truth.position_ned[0], z: actual.truth.position_ned[1] };
      setTrajectory((previous) => [...previous.slice(-1200), point]);
    }
    animationRef.current = requestAnimationFrame(simulate);
  }, [projectFrame]);

  useEffect(() => { speedScaleRef.current = speedScale; }, [speedScale]);
  useEffect(() => {
    if (session.course?.running) {
      clockRef.current.reset();
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(simulate);
    } else {
      const actual = sessionRef.current.course?.read();
      if (actual) { projectFrame(actual, false); setFrame(actual); }
      bindingRef.current = { ...bindingRef.current, advancing: false };
    }
    return () => { if (animationRef.current !== null) cancelAnimationFrame(animationRef.current); };
  }, [session.course?.running, simulate, projectFrame]);

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

        {/* 井口 1.0m / 1.5m / 2.5m(EDS) 同心安全包络圈 */}
        <WellheadSafetyEnvelopeRings position={config.targetPosition} visible={showWellheadEnvelope} />

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
            frame={frame}
            t2FaultActive={thrusters.some((item) => item.id === 2 && item.failed)}
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
            frame={frame}
            completed={Boolean(session.course?.completed)}
            showWellheadEnvelope={showWellheadEnvelope}
            onToggleWellheadEnvelope={() => setShowWellheadEnvelope((value) => !value)}
          />
        )}
        controls={(
          <DrillingCourseControls session={session} timeS={metrics.time} />
        )}
        assessment={(
          <VesselCourseEvidencePanel
            session={session}
            defaultChannel="dp-low-frequency"
            courseKey="drilling"
            stepSequence={session.step.seq}
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
