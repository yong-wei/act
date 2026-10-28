'use client';
import { MarineGrid as Grid } from '../scene/lines/marine-grid';
import { MarineLine as Line } from '@/resources/simulations/scene/lines/marine-line';

/**
 * 雪龙2号极地科考破冰船仿真
 * 使用 Azipod 3-DOF 模型和冰阻力 Stick-Slip 模型
 */

import { Suspense, useState, useRef, useCallback, useEffect, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  PerspectiveCamera,
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
import { SimulationTopBar, simulationUi, type ExperimentHostBrief } from '../components/simulation-ui';
import { createIceDrive } from './vessel-drives';
import { iceExperiment } from './vessel-experiments';
import { takeVesselSubstep, vesselSampleMark } from './vessel-experiment';
import { VesselExperimentDocks } from './vessel-experiment-panels';
import { useVesselExperiment } from './use-vessel-experiment';
import { useSimulationSceneTheme, simulationScenePalette, type SimulationSceneTheme } from '../components/simulation-theme';
import {
  EnvironmentScene,
  MarineSceneLayoutObjects,
  SceneEnvironmentProvider,
  useEnvironmentWaterColors,
  useSceneEnvironment,
} from '../scene/environment';
import { createNearFieldSurfaceQuery, GERSTNER_WATER_BASE_Y, gerstnerAmplitudeScale, useNearFieldWaterHeight } from '../scene/water';
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
import { icebreakerXuelongSceneVisual } from '../profiles/icebreaker-xuelong-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';
import { Activity, ArrowDownFromLine, Compass, Gauge, Navigation, Orbit, Settings, Snowflake, ThermometerSnowflake, Video } from 'lucide-react';

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
  SimSegmented,
  SimStatusStrip,
  SimSwitchInput,
  SimToggleRow,
  simToneForMagnitude,
  type SimTone,
} from '../components/simulation-panels';

import {
  icebreakerXuelongProfile,
  getIcebreakerDefaultConfig,
} from '../profiles/icebreaker-xuelong';
import {
  createAzipod3DOFState,
  createIceBreakingState,
  getIceBreakingSummary,
  getIceZoneSafetyLevel,
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
  type Azipod3DOFInternalState,
  type IceBreakingState,
} from '../physics/simulation-engine-facade';
import type { ControlMode, EthicalViolation, Vector2, PIDGains } from '../core/types';
import {
  toRadians,
  toDegrees,
  clamp,
  XUELONG_ICEBREAKER_PARAMS,
  XUELONG_AZIPOD_PARAMS,
  XUELONG_ICE_PARAMS,
  XUELONG_DEFAULT_GAINS,
} from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';
import {
  absoluteHeadingErrorDeg,
  advanceAttainment,
  createAttainmentState,
  displayRpmFromThrust,
} from '../lib/heading-attainment';

// ============ 类型定义 ============

interface SimulationConfig {
  controlMode: ControlMode;
  targetHeading: number;
  speed: number;
  iceModeEnabled: boolean;
  iceThickness: number;
  pidGains: PIDGains;
}

interface SimulationMetrics {
  headingError: number;
  speed: number;
  azimuth1Deg: number;
  azimuth2Deg: number;
  thrust1KN: number;
  thrust2KN: number;
  iceResistanceKN: number;
  perturbedK: number;
  perturbedT: number;
  phase: 'stick' | 'slip' | 'none';
  time: number;
}

interface RobustResponse {
  robustnessMetrics: {
    disturbanceRejection: number;
    parameterSensitivity: number;
    stabilityMargin: number;
  };
  scenarioResults: Array<{
    name: string;
    intensity: number;
    disturbanceRejection: number;
    parameterSensitivity: number;
    stabilityMargin: number;
  }>;
  recommendation: string;
}

// ============ 着色器材质 ============

/** 破冰船模型 */
function IcebreakerModel(props: {
  position: Vector2;
  heading: number;
  azimuth1: number;
  azimuth2: number;
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
      logicalId="icebreaker"
      simRef={props.simRef}
      position={props.position}
      waterYSampler={() => waterHeight(props.position.x, props.position.z)}
      headingRad={props.heading}
      sceneLengthMeters={XUELONG_ICEBREAKER_PARAMS.LENGTH}
      resetToken={props.resetToken}
      legacyYawOffsetRad={Math.PI / 2}
      fallbackDraftMeters={XUELONG_ICEBREAKER_PARAMS.DRAFT}
      legacyOverlay={(scale) => (
        <>
          <group position={[-50 * scale / 122.5, 2, 5 * scale / 122.5]}>
            <arrowHelper
              args={[
                new THREE.Vector3(Math.cos(props.azimuth1), 0, Math.sin(props.azimuth1)),
                new THREE.Vector3(0, 0, 0),
                10,
                0x00ff00,
              ]}
            />
          </group>
          <group position={[-50 * scale / 122.5, 2, -5 * scale / 122.5]}>
            <arrowHelper
              args={[
                new THREE.Vector3(Math.cos(props.azimuth2), 0, Math.sin(props.azimuth2)),
                new THREE.Vector3(0, 0, 0),
                10,
                0x00ff00,
              ]}
            />
          </group>
        </>
      )}
    />
  );
}

/** 航向指示器 */
function HeadingIndicator({
  position,
  targetHeading,
}: {
  position: Vector2;
  targetHeading: number;
}) {
  const headingRad = toRadians(targetHeading);
  const length = 100;
  const endX = position.x + Math.sin(headingRad) * length;
  const endZ = position.z + Math.cos(headingRad) * length;

  return (
    <Line name="marine-annotations"
      points={[
        [position.x, 5, position.z],
        [endX, 5, endZ],
      ]}
      color={simulationScenePalette.icebreakerPrimary}
      lineWidth={2}
      dashed
      dashSize={10}
      gapSize={5}
    />
  );
}

/** 航迹线 */
function TrailLine({ points, waterOriginSampler, }: { points: Vector2[]; waterOriginSampler?: () => { x: number; z: number } }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} waterOriginSampler={waterOriginSampler} color={simulationScenePalette.icebreakerPrimary} lineWidth={1} opacity={0.5} transparent />;
}

/** 3D 场景 */
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
function IcebreakerWater({ position, heading, speed, playing, resetToken }: { position: Vector2; heading: number; speed: number; playing: boolean; resetToken: number }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <MarineWater
      worldSpeedSampler={() => playing ? speed : 0}
      vesselLengthMeters={122.5} vesselBeamMeters={22.3}
      resetToken={resetToken}
      tier={params.waterTier}
      positionSampler={() => ({ x: position.x, z: position.z })}
      shipHeadingSampler={() => platformHeadingToSceneRad(toDegrees(heading))}
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

/** 教学标注开关门控：默认关闭，开启时显示目标航向指示。 */
function TeachingAnnotationsGate({
  position,
  targetHeading,
}: {
  position: Vector2;
  targetHeading: number;
}) {
  const { showAnnotations } = useTeachingAnnotations();
  if (!showAnnotations) return null;
  return <HeadingIndicator position={position} targetHeading={targetHeading} />;
}

function Scene({
  position,
  heading,
  targetHeading,
  azimuth1,
  azimuth2,
  trail,
  speed,
  playing,
  showGrid,
  sceneTheme,
  controlsRef,
  cameraMode,
  onCameraModeChange,
  resetToken,
  resetSignal,
  simRef,
  iceCoverage,
}: {
  position: Vector2;
  heading: number;
  targetHeading: number;
  azimuth1: number;
  azimuth2: number;
  trail: Vector2[];
  speed: number;
  playing: boolean;
  showGrid: boolean;
  sceneTheme: SimulationSceneTheme;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  cameraMode: string;
  onCameraModeChange: (mode: string) => void;
  resetToken: number;
  resetSignal: number;
  simRef: MutableRefObject<BindingTelemetrySource>;
  iceCoverage: number;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[200, 150, 200]} fov={60} near={1} far={50000} />
      <OrbitControls
        ref={controlsRef}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={50}
        maxDistance={500}
        enablePan
        enableZoom
        enableRotate
      />
      <RightClickFreeModeBridge onRequestFreeMode={() => onCameraModeChange('free')} />
      <StayPutCameraController
        view={cameraMode}
        positionSampler={() => ({ x: position.x, z: position.z })}
        headingSampler={() => platformHeadingToSceneRad(toDegrees(heading))}
        shipLength={icebreakerXuelongSceneVisual.shipLengthMeters}
        controlsRef={controlsRef}
      resetSignal={resetSignal}
      />

      <Suspense fallback={null}>
        <EnvironmentScene subjectPositionSampler={() => ({ x: position.x, z: position.z })} />
        <MarineSceneLayoutObjects
          layoutId="polar-ice-field"
          iceCoverageOverride={() => iceCoverage}
        />
      </Suspense>
      <SoundscapeAmbienceDriver />
      <SceneQualityDriver />
        <MarinePerformanceEvidenceProbe contextInput={() => ({ vesselId: 'icebreaker', cameraView: String(cameraMode), seaState: 3 })} />
      <Suspense fallback={null}>
        <IcebreakerWater speed={speed} playing={playing} position={position} heading={heading} resetToken={resetToken} />
      </Suspense>

      <Suspense
        fallback={(
          <ModelLoadingPlaceholder
            label="破冰船模型加载中"
            sublabel="场景已就绪，可先查看冰区与航向目标"
          />
        )}
      >
        <IcebreakerModel
          position={position}
          heading={heading}
          azimuth1={azimuth1}
          azimuth2={azimuth2}
          simRef={simRef}
          resetToken={resetToken}
        />
      </Suspense>

      <TeachingAnnotationsGate position={position} targetHeading={targetHeading} />
      <TrailLine points={trail} waterOriginSampler={() => ({ x: position.x, z: position.z })} />


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
          infiniteGrid
        />
      ) : null}
      <ScenePostEffects />
    </>
  );
}

// ============ UI 组件 ============

/** 冰区状态面板 */
const ICE_SAFETY_TONE = { safe: 'success', caution: 'warning', danger: 'danger' } as const satisfies Record<string, SimTone>;
const ICE_SAFETY_LABEL = { safe: '安全', caution: '注意', danger: '危险' } as const;

function IceStatusPanel({
  iceState,
  iceThickness,
}: {
  iceState: IceBreakingState;
  iceThickness: number;
}) {
  const summary = getIceBreakingSummary(iceState);
  const safetyLevel = getIceZoneSafetyLevel(iceThickness) as keyof typeof ICE_SAFETY_TONE;
  const safetyTone = ICE_SAFETY_TONE[safetyLevel] ?? 'neutral';

  return (
    <SimPanelSection
      title="冰区状态"
      icon={Snowflake}
      tone={safetyTone === 'danger' ? 'danger' : 'neutral'}
      aside={<SimChip tone={safetyTone}>{ICE_SAFETY_LABEL[safetyLevel] ?? '未知'}</SimChip>}
    >
      <SimReadoutGrid>
        <SimReadout label="冰厚" value={iceThickness.toFixed(2)} unit="m" tone={safetyTone} />
        <SimReadout
          label="破冰相位"
          value={iceState.inContact ? summary.phase : '未接触'}
          tone={iceState.inContact ? (iceState.stickPhase ? 'danger' : 'accent') : 'neutral'}
        />
      </SimReadoutGrid>

      {iceState.inContact ? (
        <div className="mt-2.5 space-y-2.5">
          <SimMeter label="相位进度" valueLabel={`${(summary.phaseProgress * 100).toFixed(0)}%`} value={summary.phaseProgress} />
          <SimReadoutGrid columns={3}>
            <SimReadout label="K 摄动" value={summary.kPerturbation} />
            <SimReadout label="T 摄动" value={summary.tPerturbation} />
            <SimReadout label="冰阻力" value={summary.resistanceKN.toFixed(0)} unit="kN" />
          </SimReadoutGrid>
        </div>
      ) : null}
    </SimPanelSection>
  );
}

/** Azipod 状态面板 */
function AzipodStatusPanel({
  azimuth1,
  azimuth2,
  thrust1,
  thrust2,
}: {
  azimuth1: number;
  azimuth2: number;
  thrust1: number;
  thrust2: number;
}) {
  const maxThrust = XUELONG_AZIPOD_PARAMS.MAX_SINGLE_THRUST;
  const pods = [
    { key: 'P1', side: '左舷', azimuth: azimuth1, thrust: thrust1 },
    { key: 'P2', side: '右舷', azimuth: azimuth2, thrust: thrust2 },
  ];

  return (
    <SimPanelSection title="Azipod 推进器" icon={Gauge}>
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2.5">
        <div className="space-y-2.5">
          {pods.map((pod) => (
            <div key={pod.key} className="space-y-1">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-platform-fg-secondary">{pod.side}（{pod.key}）</span>
                <span className="font-mono font-semibold tabular-nums text-platform-fg-primary">{pod.azimuth.toFixed(1)}°</span>
              </div>
              <SimMeter value={pod.thrust / maxThrust} valueLabel={`${pod.thrust.toFixed(0)} kN`} label="推力" />
            </div>
          ))}
        </div>
        {/* 俯视示意 */}
        <div className="sim-panel-readout relative flex items-end justify-center overflow-hidden p-0" aria-hidden="true">
          <div className="relative mb-2 h-16 w-6 rounded-t-full border border-platform-border bg-platform-fg-primary/10">
            <div
              className="absolute -left-3 bottom-2 h-1.5 w-4 origin-right rounded-full bg-platform-action-primary"
              style={{ transform: `rotate(${-azimuth1}deg)` }}
            />
            <div
              className="absolute -right-3 bottom-2 h-1.5 w-4 origin-left rounded-full bg-platform-action-primary"
              style={{ transform: `rotate(${azimuth2}deg)` }}
            />
          </div>
        </div>
      </div>
    </SimPanelSection>
  );
}

/** 控制面板 */
function ControlPanel({
  config,
  onConfigChange,
  onReset,
  isRunning,
  onToggleRun,
  metrics,
  inputsEnabled = true,
}: {
  config: SimulationConfig;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
  onReset: () => void;
  isRunning: boolean;
  onToggleRun: () => void;
  metrics: SimulationMetrics;
  inputsEnabled?: boolean;
}) {
  return (
    <SimPanelStack>
      <SimRunControls running={isRunning} primaryLabel={isRunning ? '暂停' : '运行'} onPrimary={onToggleRun} onReset={onReset} />

      <SimPanelSection title="航向控制" icon={Settings} aside={<SimLockedChip locked={!inputsEnabled} />}>
        <div className="space-y-3">
          <SimField label="控制模式">
            <SimSegmented
              ariaLabel="控制模式"
              value={config.controlMode}
              disabled={!inputsEnabled}
              onChange={(mode) => onConfigChange({ controlMode: mode })}
              options={(['manual', 'p', 'pd', 'pid'] as ControlMode[]).map((mode) => ({ value: mode, label: mode.toUpperCase() }))}
            />
          </SimField>
          <SimField label="目标航向" value={`${config.targetHeading}°`}>
            <Slider
              aria-label="目标航向"
              disabled={!inputsEnabled}
              className={simulationUi.slider}
              value={[config.targetHeading]}
              onValueChange={([v]) => onConfigChange({ targetHeading: v })}
              min={0}
              max={360}
              step={1}
            />
          </SimField>
          <SimField label="航速" value={`${config.speed.toFixed(1)} m/s`}>
            <Slider
              aria-label="航速"
              disabled={!inputsEnabled}
              className={simulationUi.slider}
              value={[config.speed]}
              onValueChange={([v]) => onConfigChange({ speed: v })}
              min={0}
              max={XUELONG_ICEBREAKER_PARAMS.MAX_SPEED}
              step={0.1}
            />
          </SimField>
        </div>
      </SimPanelSection>

      <SimPanelSection title="冰区环境" icon={ThermometerSnowflake}>
        <div className="space-y-3">
          <SimToggleRow
            label="冰区模式"
            description="开启后按冰厚加入冰阻与冰载摄动"
            htmlFor="icebreaker-ice-mode"
            control={(
              <SimSwitchInput
                id="icebreaker-ice-mode"
                checked={config.iceModeEnabled}
                disabled={!inputsEnabled}
                onChange={(event) => onConfigChange({ iceModeEnabled: event.target.checked })}
              />
            )}
          />
          {config.iceModeEnabled ? (
            <SimField label="冰厚" value={`${config.iceThickness.toFixed(2)} m`}>
              <Slider
                aria-label="冰厚"
                disabled={!inputsEnabled}
                className={simulationUi.slider}
                value={[config.iceThickness]}
                onValueChange={([v]) => onConfigChange({ iceThickness: v })}
                min={0}
                max={XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS * 1.2}
                step={0.05}
              />
            </SimField>
          ) : null}
        </div>
      </SimPanelSection>

      <SimPanelSection title="实时状态" icon={Activity}>
        <SimReadoutGrid>
          <SimReadout label="航向误差" value={metrics.headingError.toFixed(1)} unit="°" tone={simToneForMagnitude(metrics.headingError, 5)} />
          <SimReadout label="航速" value={metrics.speed.toFixed(1)} unit="m/s" />
          <SimReadout label="仿真时间" value={metrics.time.toFixed(1)} unit="s" />
          <SimReadout label="冰阻力" value={metrics.iceResistanceKN.toFixed(0)} unit="kN" />
        </SimReadoutGrid>
      </SimPanelSection>
    </SimPanelStack>
  );
}

/** 违规警告面板 */
function ViolationsPanel({ violations }: { violations: EthicalViolation[] }) {
  if (violations.length === 0) {
    return (
      <SimNotice tone="success" icon={Navigation}>暂无警报</SimNotice>
    );
  }

  return (
    <div className="max-h-60 space-y-1.5 overflow-y-auto">
      {violations.slice(-10).reverse().map((v, i) => (
        <SimNotice key={i} tone={v.severity === 'critical' ? 'danger' : 'warning'} title={v.description}>
          t = {v.timestamp.toFixed(1)}s
        </SimNotice>
      ))}
    </div>
  );
}

function RobustAssessmentPanel() {
  const [uncertainty, setUncertainty] = useState({ paramKMin: 0.7, paramKMax: 1.2, paramTMin: 0.8, paramTMax: 1.3 });
  const [disturbance, setDisturbance] = useState([
    { name: '轻度冰阻', intensity: 1.2 },
    { name: '中度冰阻', intensity: 2.4 },
    { name: '强冲击冰阻', intensity: 3.8 },
  ]);
  const [analysis, setAnalysis] = useState<RobustResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulation/icebreaker-robust-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uncertaintyRange: {
            paramK: [uncertainty.paramKMin, uncertainty.paramKMax],
            paramT: [uncertainty.paramTMin, uncertainty.paramTMax],
          },
          disturbanceScenarios: disturbance,
          sampleCount: 120,
        }),
      });
      if (!response.ok) {
        throw new Error('鲁棒分析失败');
      }
      setAnalysis((await response.json()) as RobustResponse);
    } finally {
      setLoading(false);
    }
  }, [disturbance, uncertainty.paramKMax, uncertainty.paramKMin, uncertainty.paramTMax, uncertainty.paramTMin]);

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        {[
          ['K最小', 'paramKMin'],
          ['K最大', 'paramKMax'],
          ['T最小', 'paramTMin'],
          ['T最大', 'paramTMax'],
        ].map(([label, key]) => (
          <label key={key} className="text-xs text-platform-fg-secondary">
            {label}
            <input
              type="number"
              step={0.05}
              value={uncertainty[key as keyof typeof uncertainty]}
              onChange={(event) =>
                setUncertainty((prev) => ({
                  ...prev,
                  [key]: Number(event.target.value),
                }))
              }
              className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        {disturbance.map((item, index) => (
          <div key={item.name} className="grid grid-cols-[1fr_84px] items-center gap-2 rounded border border-platform-border bg-platform-surface-overlay/86 p-2 text-xs">
            <span className="text-platform-fg-secondary">{item.name}</span>
            <input aria-label="破冰船仿真参数"
              type="number"
              step={0.1}
              value={item.intensity}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDisturbance((prev) => prev.map((target, i) => (i === index ? { ...target, intensity: value } : target)));
              }}
              className="rounded border border-platform-border bg-platform-surface-overlay/86 px-1.5 py-1 text-platform-fg-primary"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void runAnalysis()}
        disabled={loading}
        className={`w-full rounded border px-3 py-2 ${simulationUi.buttonPrimary} disabled:opacity-60`}
      >
        {loading ? '评估中...' : '执行鲁棒评估'}
      </button>

      {analysis ? (
        <div className="space-y-2 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2 text-xs">
          <div className="grid grid-cols-3 gap-1 text-platform-fg-secondary">
            <div>抑制 {analysis.robustnessMetrics.disturbanceRejection.toFixed(1)}</div>
            <div>敏感 {analysis.robustnessMetrics.parameterSensitivity.toFixed(1)}</div>
            <div>裕度 {analysis.robustnessMetrics.stabilityMargin.toFixed(1)}</div>
          </div>
          <div className="space-y-1 text-platform-fg-secondary">
            {analysis.scenarioResults.map((item) => (
              <div key={item.name} className="rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1">
                {item.name}: 抑制{item.disturbanceRejection.toFixed(1)} / 裕度{item.stabilityMargin.toFixed(1)}
              </div>
            ))}
          </div>
          <div className="rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1 text-platform-fg-secondary">
            建议：{analysis.recommendation}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============ 主组件 ============

export default function IcebreakerSimulation({ ticket = '', stepNav, hostBrief, hostSubmission }: { ticket?: string; stepNav?: ReactNode; hostBrief?: ExperimentHostBrief; hostSubmission?: ReactNode }) {
  const session = useVesselExperiment(iceExperiment, ticket);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const driveRef = useRef<ReturnType<typeof createIceDrive> | null>(null);
  const markRef = useRef(-1);
  // 仿真状态
  const [isRunning, setIsRunning] = useState(false);
  const [simTime, setSimTime] = useState(0);
  const [position, setPosition] = useState<Vector2>({ x: 0, z: 0 });
  const [heading, setHeading] = useState(0);
  const [trail, setTrail] = useState<Vector2[]>([]);
  const [violations, setViolations] = useState<EthicalViolation[]>([]);
  const simTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const clockRef = useRef(
    new SimulationClock({
      dt: SIMULATION_FIXED_STEP_SECONDS,
      maxSubSteps: SIMULATION_MAX_SUB_STEPS,
    })
  );

  // 配置
  const [config, setConfig] = useState<SimulationConfig>(
    getIcebreakerDefaultConfig()
  );

  // 内部状态 refs
  const physicsStateRef = useRef<Azipod3DOFInternalState>(
    createAzipod3DOFState(0, 0, 0)
  );
  const iceStateRef = useRef<IceBreakingState>(createIceBreakingState());

  // 指标
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    headingError: 0,
    speed: config.speed,
    azimuth1Deg: 0,
    azimuth2Deg: 0,
    thrust1KN: 0,
    thrust2KN: 0,
    iceResistanceKN: 0,
    perturbedK: 1,
    perturbedT: 1,
    phase: 'none',
    time: 0,
  });

  // 相机控制
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [cameraMode, setCameraMode] = useState<string>('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const [speedScale, setSpeedScale] = useState(8);
  const sceneTheme = useSimulationSceneTheme();
  const bindingRef = useRef<BindingTelemetrySource>({
    rudderDeg: 0,
    speedMps: 0,
    attainedCount: 0,
    advancing: false,
  });
  const attainmentRef = useRef(createAttainmentState(0));

  const resetPose = useCallback((clearCurve: boolean) => {
    const drive = driveRef.current;
    if (!drive) return;
    const command = iceExperiment.command(sessionRef.current.step, 0);
    drive.reset(command);
    const view = drive.view();
    physicsStateRef.current = drive.physics();
    iceStateRef.current = drive.iceState();
    markRef.current = -1;
    simTimeRef.current = 0;
    lastTimeRef.current = 0;
    clockRef.current.reset();
    attainmentRef.current = createAttainmentState(command.targetHeading);
    bindingRef.current = { rudderDeg: 0, speedMps: 0, attainedCount: 0, advancing: false };
    if (clearCurve) sessionRef.current.clearSamples();
    setIsRunning(false);
    setSimTime(0);
    setPosition({ x: view.x, z: view.y });
    setHeading(view.psi);
    setTrail([]);
    setViolations([]);
    setConfig((prev) => ({
      ...prev,
      controlMode: command.mode,
      targetHeading: command.targetHeading,
      iceModeEnabled: command.ice,
      iceThickness: command.iceThickness,
    }));
    setMetrics({
      headingError: 0,
      speed: view.speed,
      azimuth1Deg: view.azimuthDeg,
      azimuth2Deg: toDegrees(drive.physics().azipod2.azimuth),
      thrust1KN: drive.physics().azipod1.thrust / 1000,
      thrust2KN: drive.physics().azipod2.thrust / 1000,
      iceResistanceKN: view.iceForce,
      perturbedK: 1,
      perturbedT: 1,
      phase: 'none',
      time: 0,
    });
    setResetCount((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    preloadVirtualSimulationRuntime().catch(console.error);
    driveRef.current = createIceDrive();
    if (!cancelled) resetPose(false);
    return () => {
      cancelled = true;
    };
  }, [resetPose]);

  useEffect(() => {
    resetPose(false);
  }, [session.activeSeq, resetPose]);

  // 仿真步进
  const simulationStep = useCallback(
    (dt: number) => {
      const drive = driveRef.current;
      if (!drive) return;
      const moved = takeVesselSubstep(
        sessionRef.current.step,
        (time) => iceExperiment.command(sessionRef.current.step, time),
        (command, stepDt, time) => drive.step(command, stepDt, time),
        simTimeRef.current,
        dt,
      );
      if (!moved.sample) return;
      const view = drive.view();
      const physics = drive.physics();
      const iceNow = drive.iceState();
      physicsStateRef.current = physics;
      iceStateRef.current = iceNow;
      const mark = vesselSampleMark(moved.sample.time);
      if (mark > markRef.current) {
        markRef.current = mark;
        sessionRef.current.observe(moved.sample);
      }
      const currentHeading = toDegrees(view.psi);
      const speed = view.speed;
      const iceResistance = view.iceForce * 1000;
      const newState = physics;
      const newIceState = iceNow;
      const newTime = moved.sample.time;
      simTimeRef.current = newTime;
      const headingError = absoluteHeadingErrorDeg(currentHeading, moved.command.targetHeading);
      setConfig((prev) => (
        prev.iceModeEnabled === moved.command.ice
        && prev.iceThickness === moved.command.iceThickness
        && prev.targetHeading === moved.command.targetHeading
        && prev.controlMode === moved.command.mode
          ? prev
          : {
            ...prev,
            iceModeEnabled: moved.command.ice,
            iceThickness: moved.command.iceThickness,
            targetHeading: moved.command.targetHeading,
            controlMode: moved.command.mode,
          }
      ));
      let attainedCount = bindingRef.current.attainedCount;
      if (advanceAttainment(attainmentRef.current, moved.command.targetHeading, headingError, 5, dt)) {
        attainedCount += 1;
      }
      const maxThrustN = XUELONG_AZIPOD_PARAMS.MAX_SINGLE_THRUST * 1000;
      bindingRef.current = {
        rudderDeg: 0,
        speedMps: speed,
        attainedCount,
        advancing: true,
        azipod: {
          P: {
            azimuthRad: newState.azipod1.azimuth,
            rpm: displayRpmFromThrust(Math.abs(newState.azipod1.thrust), maxThrustN, 145),
          },
          S: {
            azimuthRad: newState.azipod2.azimuth,
            rpm: displayRpmFromThrust(Math.abs(newState.azipod2.thrust), maxThrustN, 145),
          },
        },
      };

      setSimTime(newTime);
      setPosition({ x: newState.x, z: newState.y });
      setHeading(newState.psi);

      // 更新航迹
      setTrail((prev) => {
        const newTrail = [...prev, { x: newState.x, z: newState.y }];
        return newTrail.slice(-500);
      });

      // 更新指标
      setMetrics({
        headingError: Math.abs(currentHeading - moved.command.targetHeading),
        speed,
        azimuth1Deg: toDegrees(newState.azipod1.azimuth),
        azimuth2Deg: toDegrees(newState.azipod2.azimuth),
        thrust1KN: newState.azipod1.thrust / 1000,
        thrust2KN: newState.azipod2.thrust / 1000,
        iceResistanceKN: iceResistance / 1000,
        perturbedK: newIceState.currentK,
        perturbedT: newIceState.currentT,
        phase: newIceState.stickPhase ? 'stick' : newIceState.inContact ? 'slip' : 'none',
        time: newTime,
      });

      // 违规检测
      if (moved.command.ice && moved.command.iceThickness > XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS) {
        setViolations((prev) => {
          if (prev.length === 0 || prev[prev.length - 1].timestamp < newTime - 5) {
            return [
              ...prev,
              {
                type: 'ICE_THICKNESS_EXCEEDED',
                thresholdValue: XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS,
                actualValue: moved.command.iceThickness,
                timestamp: newTime,
                description: `冰厚 ${moved.command.iceThickness.toFixed(2)}m 超过破冰能力`,
                severity: 'critical',
              },
            ];
          }
          return prev;
        });
      }
    },
    []
  );

  // 仿真循环
  useEffect(() => {
    if (!isRunning) return;

    clockRef.current.reset();
    lastTimeRef.current = performance.now();
    let frameId = 0;
    const loop = (timestamp: number) => {
      if (!isVirtualSimulationRuntimeReady()) {
        lastTimeRef.current = timestamp;
        frameId = requestAnimationFrame(loop);
        return;
      }
      const frameDt = getSimulationDeltaFromMilliseconds(timestamp, lastTimeRef.current, speedScale);
      lastTimeRef.current = timestamp;
      clockRef.current.advance(frameDt, simulationStep);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameId);
  }, [isRunning, simulationStep, speedScale]);

  useEffect(() => {
    if (isRunning) return;
    bindingRef.current = { ...bindingRef.current, advancing: false };
  }, [isRunning]);

  // 重置
  const handleReset = useCallback(() => {
    resetPose(true);
  }, [resetPose]);

  const handleConfigChange = useCallback((updates: Partial<SimulationConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
        <Scene
          position={position}
          heading={heading}
          targetHeading={config.targetHeading}
          azimuth1={physicsStateRef.current.azipod1.azimuth}
          azimuth2={physicsStateRef.current.azipod2.azimuth}
          trail={trail}
          speed={metrics.speed}
          playing={isRunning}
          showGrid={showGrid}
          sceneTheme={sceneTheme}
          controlsRef={controlsRef as React.RefObject<OrbitControlsImpl>}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          resetToken={resetCount}
          resetSignal={viewResetCount}
          simRef={bindingRef}
          iceCoverage={config.iceModeEnabled && config.iceThickness > 0 ? Math.min(1, config.iceThickness / 1.5) : 0}
        />
      </MarineCanvas>

      <VesselExperimentDocks
        experiment={iceExperiment}
        session={session}
        stepNav={stepNav}
        hostBrief={hostBrief}
        hostSubmission={hostSubmission}
        status={(
          <SimPanelStack>
            <SimStatusStrip state={isRunning ? 'running' : metrics.time > 0 ? 'paused' : 'idle'} time={`${metrics.time.toFixed(1)}s`} />
            <SimPanelSection title="航行状态" icon={Compass}>
              <SimReadoutGrid>
                <SimReadout label="航向" value={toDegrees(heading).toFixed(1)} unit="°" size="lg" />
                <SimReadout label="位置" value={`${position.x.toFixed(0)}, ${position.z.toFixed(0)}`} unit="m" size="lg" />
              </SimReadoutGrid>
            </SimPanelSection>
            <IceStatusPanel iceState={iceStateRef.current} iceThickness={config.iceThickness} />
            <AzipodStatusPanel
              azimuth1={metrics.azimuth1Deg}
              azimuth2={metrics.azimuth2Deg}
              thrust1={metrics.thrust1KN}
              thrust2={metrics.thrust2KN}
            />
          </SimPanelStack>
        )}
        controls={(
          <ControlPanel
            config={config}
            onConfigChange={handleConfigChange}
            onReset={handleReset}
            isRunning={isRunning}
            onToggleRun={() => setIsRunning((running) => !running)}
            metrics={metrics}
            inputsEnabled={false}
          />
        )}
        assessment={(
          <div className="space-y-3">
            <ViolationsPanel violations={violations} />
            <RobustAssessmentPanel />
          </div>
        )}
      />

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
        title="雪龙号吊舱与冰区控制"
        subtitle="Azipod 推进 · 冰阻力 Stick-Slip 模型 · 参数摄动"
        badge={icebreakerXuelongProfile.name}
      />
    </div>
    </SceneQualityProvider>
    </TeachingAnnotationsProvider>
    </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}
