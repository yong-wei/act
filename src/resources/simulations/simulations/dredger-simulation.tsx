'use client';
import { MarineGrid as Grid } from '../scene/lines/marine-grid';

/**
 * 天鲸号挖泥船动力定位仿真
 * 使用 MMG 3-DOF 高保真模型和 DP 控制器
 */

import { Suspense, useState, useRef, useCallback, useEffect, type MutableRefObject, type RefObject } from 'react';
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
import { type BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, SimulationAssessmentPanel, simulationUi } from '../components/simulation-ui';
import { createDredgerDrive } from './vessel-drives';
import { dredgerExperiment } from './vessel-experiments';
import { takeVesselSubstep, vesselSampleMark, vesselValue } from './vessel-experiment';
import { VesselExperimentDocks } from './vessel-experiment-panels';
import { useVesselExperiment } from './use-vessel-experiment';
import { useSimulationSceneTheme, simulationScenePalette } from '../components/simulation-theme';
import {
  EnvironmentScene,
  MARINE_SCENE_LAYOUTS,
  marineLayoutSedimentPlume,
  MarineSceneLayoutObjects,
  shorelineAmplitudeAttenuation,
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
import { dredgerTianjingSceneVisual } from '../profiles/dredger-tianjing-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';
import { advanceStationKeepAttainment } from '../lib/heading-attainment';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  AlertTriangle,
  Anchor,
  Navigation,
  Crosshair,
  Wind,
  Waves,
  Compass,
  Video,
  Orbit,
  ArrowDownFromLine,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { getDredgerDefaultConfig } from '../profiles/dredger-tianjing';
import {
  createMMG3DOFState,
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
  type MMG3DOFState,
} from '../physics/simulation-engine-facade';
import type { ControlMode, Vector2 } from '../core/types';
import { toRadians, toDegrees, TIANJING_DREDGER_PARAMS } from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';

// ============ 类型定义 ============

interface SimulationConfig {
  controlMode: ControlMode;
  targetPosition: Vector2;
  targetHeading: number;
  dredgingEnabled: boolean;
  currentSpeed: number;
  currentDirection: number;
  windSpeed: number;
  windDirection: number;
}

interface SimulationMetrics {
  positionError: number;
  headingError: number;
  surgeError: number;
  swayError: number;
  speed: number;
  rudderAngle: number;
  time: number;
  totalPowerKW: number;
}

/**
 * 定位精度告警（issue 1944）：与伦理红线解耦的独立告警通道——误差持续超限才触发，
 * 恢复到清理阈值后自动解除（滞回），HUD 不再显示「伦理违规」。
 */
const POSITION_ALARM_THRESHOLD_M = 0.1;
const POSITION_ALARM_CLEAR_M = 0.05;
const POSITION_ALARM_HOLD_SECONDS = 10;


// ============ 着色器材质 ============



// ============ 3D 组件 ============

/** 挖泥船模型 */
function DredgerModel(props: {
  position: Vector2;
  heading: number;
  simRef: MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
}) {
  // 水线参考（#2117）：共享波面采样（与 GPU 同表面定义），替代隐含 waterY=0。
  const waterHeight = useNearFieldWaterHeight({
    positionSampler: () => props.position,
    seaState: 3,
      shoreSegments: MARINE_SCENE_LAYOUTS['shallow-construction-site'].shoreSegments,
  });

  return (
    <VersionedFleetShip
      logicalId="dredger"
      simRef={props.simRef}
      position={props.position}
      waterYSampler={() => waterHeight(props.position.x, props.position.z)}
      headingRad={props.heading}
      sceneLengthMeters={120}
      resetToken={props.resetToken}
      legacyYawOffsetRad={0}
      fallbackDraftMeters={TIANJING_DREDGER_PARAMS.DRAFT}
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
      {/* 目标圆圈 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8, 10, 32]} />
        <meshBasicMaterial color={simulationScenePalette.success} side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>
      {/* 航向箭头 */}
      <mesh rotation={[0, -toRadians(heading), 0]} position={[0, 0, 0]}>
        <coneGeometry args={[3, 10, 8]} />
        <meshBasicMaterial color={simulationScenePalette.success} transparent opacity={0.8} />
      </mesh>
      {/* 标签 */}
      <Html position={[0, 15, 0]} center>
        <div className="rounded bg-[hsl(var(--platform-brand-success)/0.78)] px-2 py-1 text-xs text-platform-fg-inverse">
          目标位置
        </div>
      </Html>
    </group>
  );
}

/** 航迹线 */
function TrajectoryLine({ points, waterOriginSampler, }: { points: Vector2[]; waterOriginSampler?: () => { x: number; z: number } }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} waterOriginSampler={waterOriginSampler} color={simulationScenePalette.dredgerPrimary} lineWidth={2} />;
}

/** 相机控制器 */

// ============ UI 组件 ============

/** HUD 显示 */
function HUD({
  metrics,
  positionAlarm,
  isRunning,
}: {
  metrics: SimulationMetrics;
  positionAlarm: string | null;
  isRunning: boolean;
}) {
  return (
    <div className="space-y-2">
      {/* 状态指示 */}
      <div className="flex items-center gap-2">
        <Badge variant={isRunning ? 'default' : 'secondary'}>
          {isRunning ? '运行中' : '已暂停'}
        </Badge>
        <Badge variant="outline">
          时间: {metrics.time.toFixed(1)}s
        </Badge>
      </div>

      {/* 定位精度 */}
      <Card className={`w-64 ${simulationUi.panel}`}>
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Crosshair className="h-4 w-4" />
            定位状态
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 py-2 text-xs">
          <div className="flex justify-between">
            <span>位置误差:</span>
            <span className={metrics.positionError > 0.1 ? 'text-[hsl(var(--platform-brand-danger))]' : 'text-[hsl(var(--platform-brand-success))]'}>
              {metrics.positionError.toFixed(3)} m
            </span>
          </div>
          <div className="flex justify-between">
            <span>航向误差:</span>
            <span className={metrics.headingError > 1 ? 'text-[hsl(var(--platform-brand-evidence))]' : 'text-[hsl(var(--platform-brand-success))]'}>
              {metrics.headingError.toFixed(2)}°
            </span>
          </div>
          <div className="flex justify-between">
            <span>航速:</span>
            <span>{metrics.speed.toFixed(2)} m/s</span>
          </div>
          <div className="flex justify-between">
            <span>舵角:</span>
            <span>{metrics.rudderAngle.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between">
            <span>总功率:</span>
            <span className={metrics.totalPowerKW > 14000 ? 'text-[hsl(var(--platform-brand-evidence))]' : ''}>
              {(metrics.totalPowerKW / 1000).toFixed(1)} MW
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 定位精度告警（与伦理红线解耦，issue 1944） */}
      {positionAlarm && (
        <Card className={`w-64 border-[hsl(var(--platform-brand-evidence)/0.35)] bg-[hsl(var(--platform-brand-evidence)/0.12)] ${simulationUi.panel}`}>
          <CardHeader className="py-2">
            <CardTitle className="flex items-center gap-2 text-sm text-[hsl(var(--platform-brand-evidence))]">
              <AlertTriangle className="h-4 w-4" />
              定位精度告警
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-xs text-[hsl(var(--platform-brand-evidence))]">
              {positionAlarm}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
  return (
    <Card className={`${simulationUi.panel}`}>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          控制面板
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 播放控制 */}
        <div className="flex gap-2">
          <Button data-sound-start
            variant={isRunning ? 'secondary' : 'default'}
            size="sm"
            onClick={isRunning ? onPause : onStart}
            className={`flex-1 ${isRunning ? simulationUi.buttonSecondary : simulationUi.buttonPrimary}`}
          >
            {isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isRunning ? '暂停' : '开始'}
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} className={simulationUi.buttonOutline}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="target">
          <TabsList className={`grid w-full grid-cols-3 ${simulationUi.tabsList}`}>
            <TabsTrigger value="target" className={simulationUi.tabsTrigger}>目标</TabsTrigger>
            <TabsTrigger value="disturbance" className={simulationUi.tabsTrigger}>扰动</TabsTrigger>
            <TabsTrigger value="control" className={simulationUi.tabsTrigger}>控制</TabsTrigger>
          </TabsList>

          <TabsContent value="target" className="space-y-3">
            {/* 目标位置 */}
            <div className="space-y-2">
              <Label className="text-xs">目标 X (m)</Label>
              <Slider
                disabled={!inputsEnabled}
                className={simulationUi.slider}
                value={[config.targetPosition.x]}
                min={-500}
                max={500}
                step={10}
                onValueChange={([v]) =>
                  onConfigChange({ targetPosition: { ...config.targetPosition, x: v } })
                }
              />
              <div className="text-right text-xs text-platform-fg-muted">
                {config.targetPosition.x} m
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">目标 Z (m)</Label>
              <Slider
                disabled={!inputsEnabled}
                className={simulationUi.slider}
                value={[config.targetPosition.z]}
                min={-500}
                max={500}
                step={10}
                onValueChange={([v]) =>
                  onConfigChange({ targetPosition: { ...config.targetPosition, z: v } })
                }
              />
              <div className="text-right text-xs text-platform-fg-muted">
                {config.targetPosition.z} m
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">目标航向 (°)</Label>
              <Slider
                disabled={!inputsEnabled}
                className={simulationUi.slider}
                value={[config.targetHeading]}
                min={-180}
                max={180}
                step={5}
                onValueChange={([v]) => onConfigChange({ targetHeading: v })}
              />
              <div className="text-right text-xs text-platform-fg-muted">
                {config.targetHeading}°
              </div>
            </div>
          </TabsContent>

          <TabsContent value="disturbance" className="space-y-3">
            {/* 挖掘扰动 */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">挖掘扰动</Label>
              <Button
                variant={config.dredgingEnabled ? 'default' : 'outline'}
                size="sm"
                disabled={!inputsEnabled}
                className={config.dredgingEnabled ? simulationUi.buttonPrimary : simulationUi.buttonOutline}
                onClick={() => onConfigChange({ dredgingEnabled: !config.dredgingEnabled })}
              >
                {config.dredgingEnabled ? '已启用' : '已禁用'}
              </Button>
            </div>

            {/* 海流 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs">
                <Waves className="h-3 w-3" />
                海流速度 (m/s)
              </Label>
              <Slider
                disabled={!inputsEnabled}
                className={simulationUi.slider}
                value={[config.currentSpeed]}
                min={0}
                max={2}
                step={0.1}
                onValueChange={([v]) => onConfigChange({ currentSpeed: v })}
              />
              <div className="text-right text-xs text-platform-fg-muted">
                {config.currentSpeed.toFixed(1)} m/s
              </div>
            </div>

            {/* 风 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs">
                <Wind className="h-3 w-3" />
                风速 (m/s)
              </Label>
              <Slider
                disabled={!inputsEnabled}
                className={simulationUi.slider}
                value={[config.windSpeed]}
                min={0}
                max={20}
                step={1}
                onValueChange={([v]) => onConfigChange({ windSpeed: v })}
              />
              <div className="text-right text-xs text-platform-fg-muted">
                {config.windSpeed} m/s
              </div>
            </div>
          </TabsContent>

          <TabsContent value="control" className="space-y-3">
            {/* 控制模式 */}
            <div className="space-y-2">
              <Label className="text-xs">控制模式</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['dp', 'pid', 'manual'] as ControlMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={config.controlMode === mode ? 'default' : 'outline'}
                    size="sm"
                    disabled={!inputsEnabled}
                    className={config.controlMode === mode ? simulationUi.buttonPrimary : simulationUi.buttonOutline}
                    onClick={() => onConfigChange({ controlMode: mode })}
                  >
                    {mode === 'dp' && <Anchor className="mr-1 h-3 w-3" />}
                    {mode === 'pid' && <Navigation className="mr-1 h-3 w-3" />}
                    {mode.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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

/** 海面颜色随环境预设、细分随质量档位的桥接组件（船位直读 ref）。 */
function DredgerWater({
  mmgStateRef,
  resetToken,
  playing,
}: {
  mmgStateRef: RefObject<MMG3DOFState>;
  resetToken: number;
  playing: boolean;
}) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <MarineWater
      worldSpeedSampler={() => playing ? Math.hypot(mmgStateRef.current.u, mmgStateRef.current.v) : 0}
      vesselLengthMeters={127.5} vesselBeamMeters={23}
      resetToken={resetToken}
      tier={params.waterTier}
      positionSampler={() => ({ x: mmgStateRef.current.x, z: mmgStateRef.current.y })}
      shipHeadingSampler={() => platformHeadingToSceneRad(toDegrees(mmgStateRef.current.psi))}
      shoreSegments={MARINE_SCENE_LAYOUTS['shallow-construction-site'].shoreSegments}
      sedimentPlume={marineLayoutSedimentPlume('shallow-construction-site')}
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

/** 教学标注开关门控：默认关闭，开启时显示目标点标记。 */
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

export function DredgerSimulation({ ticket = '' }: { ticket?: string }) {
  const session = useVesselExperiment(dredgerExperiment, ticket);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const driveRef = useRef<ReturnType<typeof createDredgerDrive> | null>(null);
  const markRef = useRef(-1);
  const timeRef = useRef(0);
  // 配置状态
  const defaultConfig = getDredgerDefaultConfig();
  const [config, setConfig] = useState<SimulationConfig>({
    controlMode: defaultConfig.controlMode,
    targetPosition: defaultConfig.targetPosition,
    targetHeading: defaultConfig.targetHeading,
    dredgingEnabled: defaultConfig.dredgingEnabled,
    currentSpeed: defaultConfig.seaState.currentSpeed,
    currentDirection: defaultConfig.seaState.currentDirection,
    windSpeed: defaultConfig.seaState.windSpeed,
    windDirection: defaultConfig.seaState.windDirection,
  });

  // 仿真状态
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    positionError: 0,
    headingError: 0,
    surgeError: 0,
    swayError: 0,
    speed: 0,
    rudderAngle: 0,
    time: 0,
    totalPowerKW: 0,
  });
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);
  const [positionAlarm, setPositionAlarm] = useState<string | null>(null);
  const positionAlarmRef = useRef({ since: null as number | null, active: false });

  // 引用
  const mmgStateRef = useRef<MMG3DOFState>(createMMG3DOFState(0, 0, 0, 0));
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
    cutterRpm: 0,
  });
  const stationKeepRef = useRef({ dwell: 0, armed: true });

  const resetPose = useCallback((clearCurve: boolean) => {
    const drive = driveRef.current;
    if (!drive) return;
    const command = dredgerExperiment.command(sessionRef.current.step, 0);
    drive.reset(command);
    const mmg = drive.mmg();
    mmgStateRef.current = mmg;
    markRef.current = -1;
    timeRef.current = 0;
    if (clearCurve) sessionRef.current.clearSamples();
    lastUpdateRef.current = performance.now();
    clockRef.current.reset();
    setIsRunning(false);
    setTrajectory([]);
    positionAlarmRef.current = { since: null, active: false };
    setPositionAlarm(null);
    stationKeepRef.current = { dwell: 0, armed: true };
    const speed = Math.hypot(mmg.u, mmg.v);
    const drift = Math.hypot(mmg.x - command.targetX, mmg.y - command.targetZ);
    bindingRef.current = {
      rudderDeg: toDegrees(mmg.rudderAngle),
      speedMps: speed,
      attainedCount: 0,
      advancing: false,
      cutterRpm: 0,
    };
    setMetrics({
      positionError: drift,
      headingError: Math.abs(toDegrees(mmg.psi) - command.targetHeading),
      surgeError: 0,
      swayError: 0,
      speed,
      rudderAngle: toDegrees(mmg.rudderAngle),
      time: 0,
      totalPowerKW: 0,
    });
    setConfig((prev) => {
      const next: SimulationConfig = {
        ...prev,
        controlMode: command.dp ? 'dp' : 'manual',
        dredgingEnabled: command.dredging,
        targetPosition: { x: command.targetX, z: command.targetZ },
        targetHeading: command.targetHeading,
        currentSpeed: 0.5,
        currentDirection: 45,
        windSpeed: 8,
        windDirection: 45,
      };
      if (
        prev.controlMode === next.controlMode
        && prev.dredgingEnabled === next.dredgingEnabled
        && prev.targetHeading === next.targetHeading
        && prev.targetPosition.x === next.targetPosition.x
        && prev.targetPosition.z === next.targetPosition.z
        && prev.currentSpeed === next.currentSpeed
        && prev.currentDirection === next.currentDirection
        && prev.windSpeed === next.windSpeed
        && prev.windDirection === next.windDirection
      ) return prev;
      return next;
    });
    setResetCount((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    preloadVirtualSimulationRuntime().catch(console.error);
    driveRef.current = createDredgerDrive();
    if (!cancelled) resetPose(false);
    return () => {
      cancelled = true;
    };
  }, [resetPose]);

  useEffect(() => {
    resetPose(false);
  }, [session.activeSeq, resetPose]);

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
        (time) => dredgerExperiment.command(sessionRef.current.step, time),
        (command, stepDt, time) => drive.step(command, stepDt, time),
        timeRef.current,
        dt,
      );
      timeRef.current = moved.time;
      if (!moved.sample) return;
      const mmg = drive.mmg();
      mmgStateRef.current = mmg;
      const mark = vesselSampleMark(moved.sample.time);
      if (mark > markRef.current) {
        markRef.current = mark;
        sessionRef.current.observe(moved.sample);
      }
      const positionError = vesselValue(moved.sample, 'position');
      const headingError = vesselValue(moved.sample, 'headingError');
      const speed = vesselValue(moved.sample, 'speed');
      if (moved.command.dp) {
        const alarm = positionAlarmRef.current;
        if (positionError > POSITION_ALARM_THRESHOLD_M) {
          alarm.since ??= timeRef.current;
          if (!alarm.active && timeRef.current - alarm.since >= POSITION_ALARM_HOLD_SECONDS) {
            alarm.active = true;
            setPositionAlarm(
              `定位误差持续超过 ${POSITION_ALARM_THRESHOLD_M} m 阈值达 ${POSITION_ALARM_HOLD_SECONDS} 秒，请检查扰动设置与控制模式`
            );
          }
        } else if (!alarm.active || positionError < POSITION_ALARM_CLEAR_M) {
          alarm.since = null;
          if (alarm.active && positionError < POSITION_ALARM_CLEAR_M) {
            alarm.active = false;
            setPositionAlarm(null);
          }
        }
      } else {
        const alarm = positionAlarmRef.current;
        if (alarm.since !== null || alarm.active) {
          positionAlarmRef.current = { since: null, active: false };
          setPositionAlarm(null);
        }
      }
      const insideDeadzone =
        positionError <= POSITION_ALARM_THRESHOLD_M
        && headingError <= 5;
      let attainedCount = bindingRef.current.attainedCount;
      if (advanceStationKeepAttainment(stationKeepRef.current, insideDeadzone, dt)) {
        attainedCount += 1;
      }
      bindingRef.current = {
        rudderDeg: toDegrees(mmg.rudderAngle),
        speedMps: speed,
        attainedCount,
        advancing: true,
        cutterRpm: moved.command.dredging ? 36 : 0,
      };
      setMetrics({
        positionError,
        headingError,
        surgeError: 0,
        swayError: 0,
        speed,
        rudderAngle: toDegrees(mmg.rudderAngle),
        time: moved.sample.time,
        totalPowerKW: 0,
      });
      setTrajectory((prev) => {
        const newPoint = { x: mmg.x, z: mmg.y };
        if (prev.length === 0) return [newPoint];
        const last = prev[prev.length - 1];
        const dist = Math.sqrt(
          (newPoint.x - last.x) ** 2 + (newPoint.z - last.z) ** 2
        );
        if (dist > 2) {
          return [...prev.slice(-200), newPoint];
        }
        return prev;
      });
    };

    clockRef.current.advance(frameDt, stepSimulation);

    animationFrameRef.current = requestAnimationFrame(simulate);
  }, [isRunning, speedScale]);

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
  const handlePause = () => {
    bindingRef.current = { ...bindingRef.current, advancing: false, cutterRpm: 0 };
    setIsRunning(false);
  };
  const handleReset = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    bindingRef.current = { ...bindingRef.current, advancing: false, cutterRpm: 0 };
    resetPose(true);
  };

  const handleConfigChange = (updates: Partial<SimulationConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    if (updates.controlMode && updates.controlMode !== 'dp') {
      positionAlarmRef.current = { since: null, active: false };
      setPositionAlarm(null);
    }
  };

  // 当前船舶位置
  const shipPosition = {
    x: mmgStateRef.current.x,
    z: mmgStateRef.current.y,
  };
  const shipHeading = mmgStateRef.current.psi;

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      {/* 3D 场景 */}
      <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
        <PerspectiveCamera makeDefault position={[300, 200, 300]} fov={60} near={1} far={50000} />
        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={50}
          maxDistance={2000}
          maxPolarAngle={Math.PI / 2.1}
        />
        <RightClickFreeModeBridge onRequestFreeMode={() => setCameraMode('free')} />

        <Suspense fallback={null}>
          <EnvironmentScene subjectPositionSampler={() => ({ x: mmgStateRef.current.x, z: mmgStateRef.current.y })} />
        <MarineSceneLayoutObjects layoutId="shallow-construction-site" />
        </Suspense>
        <SoundscapeAmbienceDriver />
        <SceneQualityDriver />
        <MarinePerformanceEvidenceProbe contextInput={() => ({ vesselId: 'dredger', cameraView: String(cameraMode), seaState: 3 })} />
        <Suspense fallback={null}>
          <DredgerWater playing={isRunning} mmgStateRef={mmgStateRef} resetToken={resetCount} />
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

        {/* 挖泥船 */}
        <Suspense
          fallback={(
            <ModelLoadingPlaceholder
              label="挖泥船模型加载中"
              sublabel="场景已就绪，可先查看施工环境"
            />
          )}
        >
          <DredgerModel
            position={shipPosition}
            heading={shipHeading}
            simRef={bindingRef}
            resetToken={resetCount}
          />
        </Suspense>

        {/* 航迹 */}
        {trajectory.length > 1 && <TrajectoryLine points={trajectory} waterOriginSampler={() => ({ x: mmgStateRef.current.x, z: mmgStateRef.current.y })} />}


        <StayPutCameraController
          view={cameraMode}
          positionSampler={() => ({ x: mmgStateRef.current.x, z: mmgStateRef.current.y })}
          headingSampler={() => platformHeadingToSceneRad(toDegrees(mmgStateRef.current.psi))}
          shipLength={dredgerTianjingSceneVisual.shipLengthMeters}
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
        experiment={dredgerExperiment}
        session={session}
        status={<HUD metrics={metrics} positionAlarm={positionAlarm} isRunning={isRunning} />}
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
        assessment={(
          <SimulationAssessmentPanel
            title="定位精度评估"
            metrics={[
              { id: 'position', label: '位置误差', value: metrics.positionError, max: 2, better: 'lower', unit: 'm', precision: 3 },
              { id: 'heading', label: '航向误差', value: metrics.headingError, max: 20, better: 'lower', unit: '°', precision: 2 },
              { id: 'speed', label: '航速稳定', value: metrics.speed, max: 4, better: 'lower', unit: 'm/s', precision: 2 },
              { id: 'rudder', label: '舵角幅值', value: Math.abs(metrics.rudderAngle), max: 35, better: 'lower', unit: '°', precision: 1 },
            ]}
          />
        )}
      />

      <SimulationTopBar
        title="天鲸号挖泥船动力定位"
        subtitle="MMG 3-DOF 高保真模型 · 定位精度 < 0.1m"
        badge="Dredger / OBE"
      />
    </div>
    </SceneQualityProvider>
    </TeachingAnnotationsProvider>
    </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}

export default DredgerSimulation;
