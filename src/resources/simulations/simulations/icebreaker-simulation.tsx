'use client';

/**
 * 雪龙2号极地科考破冰船仿真
 * 使用 Azipod 3-DOF 模型和冰阻力 Stick-Slip 模型
 */

import { Component, Suspense, useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  Grid,
  Html,
  PerspectiveCamera,
  Line,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { SimulationClock } from '@/lib/simulation';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, SimulationDock, simulationUi } from '../components/simulation-ui';
import { useSimulationSceneTheme, simulationScenePalette, type SimulationSceneTheme } from '../components/simulation-theme';
import {
  EnvironmentScene,
  SceneEnvironmentProvider,
  useEnvironmentWaterColors,
  useSceneEnvironment,
} from '../scene/environment';
import { computeGerstnerDisplacement, GERSTNER_WAVE_SETS, GerstnerWater } from '../scene/water';
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
} from '../scene/quality';
import { ScenePostEffects } from '../scene/post';
import { icebreakerXuelongSceneVisual } from '../profiles/icebreaker-xuelong-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  AlertTriangle,
  Navigation,
  Snowflake,
  Gauge,
  Activity,
  ThermometerSnowflake,
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
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';

import {
  icebreakerXuelongProfile,
  getIcebreakerDefaultConfig,
} from '../profiles/icebreaker-xuelong';
import {
  createAzipod3DOFState,
  azipod3dofStepRK4,
  azipodToSimulationState,
  DEFAULT_AZIPOD_3DOF_PARAMS,
  createIceBreakingState,
  iceBreakingStep,
  getIceBreakingSummary,
  getIceZoneSafetyLevel,
  DEFAULT_ICE_BREAKING_PARAMS,
  createAzipodCourseKeeperState,
  azipodCourseKeeperControl,
  azipodCourseKeeperControlIceMode,
  getAzipodControllerDiagnostics,
  DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
  type Azipod3DOFInternalState,
  type Azipod3DOFParams,
  type IceBreakingState,
  type AzipodCourseKeeperState,
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
const OPTIMIZED_MODEL_URL = '/assets/models-opt/icebreaker.glb';
const ORIGINAL_MODEL_URL = '/assets/icebreaker.glb';

/** meshopt 模型加载失败的回退边界：回退到原始 GLB（构建期 fallback 的运行时对偶）。 */
class ModelAssetErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function IcebreakerModel(props: {
  position: Vector2;
  heading: number;
  azimuth1: number;
  azimuth2: number;
}) {
  return (
    <ModelAssetErrorBoundary fallback={<IcebreakerModelScene url={ORIGINAL_MODEL_URL} {...props} />}>
      <IcebreakerModelScene url={OPTIMIZED_MODEL_URL} {...props} />
    </ModelAssetErrorBoundary>
  );
}

function IcebreakerModelScene({
  url,
  position,
  heading,
  azimuth1,
  azimuth2,
}: {
  url: string;
  position: Vector2;
  heading: number;
  azimuth1: number;
  azimuth2: number;
}) {
  const { scene } = useGLTF(url, true, true);
  const groupRef = useRef<THREE.Group>(null);

  const { model, scale, modelHeight } = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // 居中模型
    cloned.position.sub(center);

    // 启用阴影
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // meshopt 量化解码后几何包围球处于量化空间，按视锥剔除会在多数视角误剔除（样板同口径）。
        child.frustumCulled = false;
        if (child.material) {
          child.material.transparent = false;
          child.material.opacity = 1;
          child.material.side = THREE.DoubleSide;
          child.material.visible = true;
          child.material.needsUpdate = true;
        }
      }
    });

    // 计算缩放 - 目标长度 122.5m (雪龙2号实际长度)
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = XUELONG_ICEBREAKER_PARAMS.LENGTH;
    const calculatedScale = targetLength / maxDim;

    return { model: cloned, scale: calculatedScale, modelHeight: size.y * calculatedScale };
  }, [scene]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = position.x;
      groupRef.current.position.y = modelHeight * 0.5 - XUELONG_ICEBREAKER_PARAMS.DRAFT;
      groupRef.current.position.z = position.z;
      groupRef.current.rotation.y = -heading + Math.PI / 2;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={scale} />
      {/* Azipod 方向指示器 (简化表示) */}
      <group position={[-50 * scale / 122.5, 2, 5 * scale / 122.5]}>
        <arrowHelper
          args={[
            new THREE.Vector3(Math.cos(azimuth1), 0, Math.sin(azimuth1)),
            new THREE.Vector3(0, 0, 0),
            10,
            0x00ff00,
          ]}
        />
      </group>
      <group position={[-50 * scale / 122.5, 2, -5 * scale / 122.5]}>
        <arrowHelper
          args={[
            new THREE.Vector3(Math.cos(azimuth2), 0, Math.sin(azimuth2)),
            new THREE.Vector3(0, 0, 0),
            10,
            0x00ff00,
          ]}
        />
      </group>
    </group>
  );
}

// 预加载模型（仅压缩件，避免双份下载）
useGLTF.preload(OPTIMIZED_MODEL_URL);

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
    <Line
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
function TrailLine({ points }: { points: Vector2[] }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} color={simulationScenePalette.icebreakerPrimary} lineWidth={1} opacity={0.5} transparent />;
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
function IcebreakerWater({ position }: { position: Vector2 }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <GerstnerWater
      tier={params.waterTier}
      positionSampler={() => ({ x: position.x, z: position.z })}
      waterColor={water.waterColor}
      deepColor={water.deepColor}
      horizonColor={water.horizonColor}
      foamColor={simulationScenePalette.waterFoam}
    />
  );
}

/** 尾迹粒子场桥接：逐帧喂入船位/航向与 Gerstner 波面高度。 */
function WakeTrailRig({
  position,
  heading,
  speed,
  playing,
  resetToken,
}: {
  position: Vector2;
  heading: number;
  speed: number;
  playing: boolean;
  resetToken: number;
}) {
  const { wakeVisible } = useSceneEnvironment();
  const transformRef = useRef({ position: [0, 0, 0] as [number, number, number], heading: 0 });
  const timeRef = useRef(0);
  const { tier, params } = useSceneQuality();

  useFrame((frameState) => {
    transformRef.current.position = [position.x, 0, position.z];
    transformRef.current.heading = platformHeadingToSceneRad(toDegrees(heading));
    timeRef.current = frameState.clock.getElapsedTime();
  });

  if (!wakeVisible) return null;
  return (
    <WakeTrail
      key={resetToken}
      profile={icebreakerXuelongSceneVisual}
      shipTransform={transformRef.current}
      qualityTier={tier}
      playing={playing}
      waterYSampler={(x, z) => -1 + computeGerstnerDisplacement(GERSTNER_WAVE_SETS[params.waterTier], x ?? 0, z ?? 0, timeRef.current).y}
      worldSpeedSampler={() => speed}
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
        <EnvironmentScene />
      </Suspense>
      <SoundscapeAmbienceDriver />
      <SceneQualityDriver />
      <Suspense fallback={null}>
        <IcebreakerWater position={position} />
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
        />
      </Suspense>

      <TeachingAnnotationsGate position={position} targetHeading={targetHeading} />
      <TrailLine points={trail} />
      <WakeTrailRig position={position} heading={heading} speed={speed} playing={playing} resetToken={resetToken} />

      {showGrid ? (
        <Grid
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
function IceStatusPanel({
  iceState,
  iceThickness,
}: {
  iceState: IceBreakingState;
  iceThickness: number;
}) {
  const summary = getIceBreakingSummary(iceState);
  const safetyLevel = getIceZoneSafetyLevel(iceThickness);

  const safetyColors: Record<string, string> = {
    safe: 'bg-[hsl(var(--platform-brand-success))]',
    caution: 'bg-[hsl(var(--platform-brand-evidence))]',
    danger: 'bg-[hsl(var(--platform-brand-danger))]',
  };

  return (
    <Card className="w-full border border-platform-border bg-platform-surface-overlay/86 text-platform-fg-primary">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Snowflake className="w-4 h-4" />
          冰区状态
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-platform-fg-muted">冰厚</span>
          <div className="flex items-center gap-2">
            <span className="font-mono">{iceThickness.toFixed(2)} m</span>
            <div className={`w-3 h-3 rounded-full ${safetyColors[safetyLevel]}`} />
          </div>
        </div>

        {iceState.inContact && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-platform-fg-muted">相位</span>
              <Badge variant={iceState.stickPhase ? 'destructive' : 'default'}>
                {summary.phase}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-platform-fg-muted">相位进度</span>
                <span>{(summary.phaseProgress * 100).toFixed(0)}%</span>
              </div>
              <Progress value={summary.phaseProgress * 100} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-platform-fg-muted">K 摄动</span>
                <div className="font-mono text-lg">{summary.kPerturbation}</div>
              </div>
              <div>
                <span className="text-platform-fg-muted">T 摄动</span>
                <div className="font-mono text-lg">{summary.tPerturbation}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-platform-fg-muted">冰阻力</span>
              <span className="font-mono">{summary.resistanceKN.toFixed(0)} kN</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
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

  return (
    <Card className="w-full border border-platform-border bg-platform-surface-overlay/86 text-platform-fg-primary">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge className="w-4 h-4" />
          Azipod 推进器
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Azipod 1 (左舷) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">左舷 (P1)</span>
            <span className="font-mono text-sm">{azimuth1.toFixed(1)}°</span>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={(thrust1 / maxThrust) * 100} className="flex-1" />
            <span className="text-xs font-mono w-16 text-right">
              {thrust1.toFixed(0)} kN
            </span>
          </div>
        </div>

        {/* Azipod 2 (右舷) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">右舷 (P2)</span>
            <span className="font-mono text-sm">{azimuth2.toFixed(1)}°</span>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={(thrust2 / maxThrust) * 100} className="flex-1" />
            <span className="text-xs font-mono w-16 text-right">
              {thrust2.toFixed(0)} kN
            </span>
          </div>
        </div>

        {/* 可视化 */}
        <div className="relative h-24 rounded-lg border border-platform-border bg-platform-canvas-muted">
          <div className="absolute inset-0 flex items-center justify-center">
            {/* 船体简化表示 */}
            <div className="relative h-32 w-16 rounded-t-full bg-platform-canvas-muted">
              {/* Azipod 1 */}
              <div
                className="absolute -left-4 bottom-4 w-8 h-2 bg-[hsl(var(--platform-brand-success))] origin-right"
                style={{ transform: `rotate(${-azimuth1}deg)` }}
              />
              {/* Azipod 2 */}
              <div
                className="absolute -right-4 bottom-4 w-8 h-2 bg-[hsl(var(--platform-brand-success))] origin-left"
                style={{ transform: `rotate(${azimuth2}deg)` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
}: {
  config: SimulationConfig;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
  onReset: () => void;
  isRunning: boolean;
  onToggleRun: () => void;
  metrics: SimulationMetrics;
}) {
  return (
    <div className="space-y-4">
      {/* 运行控制 */}
      <div className="flex gap-2">
        <Button data-sound-start
          variant={isRunning ? 'destructive' : 'default'}
          onClick={onToggleRun}
          className={`flex-1 ${isRunning ? simulationUi.buttonSecondary : simulationUi.buttonPrimary}`}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4 mr-2" /> 暂停
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" /> 运行
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onReset} className={simulationUi.buttonOutline}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* 控制模式 */}
      <div className="space-y-2">
        <Label>控制模式</Label>
        <div className="grid grid-cols-4 gap-1">
          {['manual', 'p', 'pd', 'pid'].map((mode) => (
            <Button
              key={mode}
              variant={config.controlMode === mode ? 'default' : 'outline'}
              size="sm"
              className={config.controlMode === mode ? simulationUi.buttonPrimary : simulationUi.buttonOutline}
              onClick={() =>
                onConfigChange({ controlMode: mode as ControlMode })
              }
            >
              {mode.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* 目标航向 */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>目标航向</Label>
          <span className="text-sm font-mono">{config.targetHeading}°</span>
        </div>
        <Slider
          className={simulationUi.slider}
          value={[config.targetHeading]}
          onValueChange={([v]) => onConfigChange({ targetHeading: v })}
          min={0}
          max={360}
          step={1}
        />
      </div>

      {/* 航速 */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>航速</Label>
          <span className="text-sm font-mono">{config.speed.toFixed(1)} m/s</span>
        </div>
        <Slider
          className={simulationUi.slider}
          value={[config.speed]}
          onValueChange={([v]) => onConfigChange({ speed: v })}
          min={0}
          max={XUELONG_ICEBREAKER_PARAMS.MAX_SPEED}
          step={0.1}
        />
      </div>

      {/* 冰区模式 */}
      <div className="space-y-3 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <ThermometerSnowflake className="w-4 h-4" />
            冰区模式
          </Label>
          <Switch
            checked={config.iceModeEnabled}
            onCheckedChange={(checked) =>
              onConfigChange({ iceModeEnabled: checked })
            }
          />
        </div>

        {config.iceModeEnabled && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>冰厚</Label>
              <span className="text-sm font-mono">
                {config.iceThickness.toFixed(2)} m
              </span>
            </div>
            <Slider
              className={simulationUi.slider}
              value={[config.iceThickness]}
              onValueChange={([v]) => onConfigChange({ iceThickness: v })}
              min={0}
              max={XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS * 1.2}
              step={0.05}
            />
          </div>
        )}
      </div>

      {/* 实时指标 */}
      <Card className="border border-platform-border bg-platform-surface-overlay/86 text-platform-fg-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            实时状态
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">航向误差</span>
            <div className="font-mono text-lg">
              {metrics.headingError.toFixed(1)}°
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">航速</span>
            <div className="font-mono text-lg">{metrics.speed.toFixed(1)} m/s</div>
          </div>
          <div>
            <span className="text-muted-foreground">仿真时间</span>
            <div className="font-mono text-lg">{metrics.time.toFixed(1)} s</div>
          </div>
          <div>
            <span className="text-muted-foreground">冰阻力</span>
            <div className="font-mono text-lg">
              {metrics.iceResistanceKN.toFixed(0)} kN
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 违规警告面板 */
function ViolationsPanel({ violations }: { violations: EthicalViolation[] }) {
  if (violations.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <Navigation className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>暂无警报</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {violations.slice(-10).reverse().map((v, i) => (
        <div
          key={i}
          className={`p-2 rounded text-sm flex items-start gap-2 ${
            v.severity === 'critical'
              ? 'bg-[hsl(var(--platform-brand-danger)/0.12)] text-[hsl(var(--platform-brand-danger))] dark:bg-[hsl(var(--platform-brand-danger)/0.18)] dark:text-[hsl(var(--platform-brand-danger))]'
              : 'bg-[hsl(var(--platform-brand-evidence)/0.14)] dark:bg-[hsl(var(--platform-brand-evidence)/0.18)] text-[hsl(var(--platform-brand-evidence))] dark:text-[hsl(var(--platform-brand-evidence))]'
          }`}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{v.description}</div>
            <div className="text-xs opacity-70">t = {v.timestamp.toFixed(1)}s</div>
          </div>
        </div>
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

export default function IcebreakerSimulation() {
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
  const controllerStateRef = useRef<AzipodCourseKeeperState>(
    createAzipodCourseKeeperState()
  );

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
  const [speedScale, setSpeedScale] = useState(1);
  const sceneTheme = useSimulationSceneTheme();

  // Azipod 参数 (使用预定义的默认参数)
  const azipodParams: Azipod3DOFParams = DEFAULT_AZIPOD_3DOF_PARAMS;

  useEffect(() => {
    preloadVirtualSimulationRuntime().catch(console.error);
  }, []);

  // 仿真步进
  const simulationStep = useCallback(
    (dt: number) => {
      const currentTime = simTimeRef.current;
      const state = physicsStateRef.current;
      const iceState = iceStateRef.current;
      const controllerState = controllerStateRef.current;

      const currentHeading = toDegrees(state.psi);
      const currentYawRate = toDegrees(state.r);
      const speed = Math.sqrt(state.u ** 2 + state.v ** 2);

      // 冰阻力计算
      let iceResistance = 0;
      let perturbedK = 1.0;

      if (config.iceModeEnabled && config.iceThickness > 0) {
        const iceParams = {
          ...DEFAULT_ICE_BREAKING_PARAMS,
          enabled: true,
          iceThickness: config.iceThickness,
        };
        iceStateRef.current = iceBreakingStep(iceState, iceParams, speed, dt);
        iceResistance = iceStateRef.current.resistanceForce;
        perturbedK = iceStateRef.current.currentK;
      }

      // 航向控制
      if (config.controlMode !== 'manual') {
        if (config.iceModeEnabled) {
          // 冰区模式控制器
          controllerStateRef.current = azipodCourseKeeperControlIceMode(
            controllerState,
            currentHeading,
            config.targetHeading,
            currentYawRate,
            speed,
            config.controlMode as 'manual' | 'p' | 'pd' | 'pid',
            perturbedK,
            dt,
            currentTime
          );
        } else {
          // 开阔水域控制器
          controllerStateRef.current = azipodCourseKeeperControl(
            controllerState,
            currentHeading,
            config.targetHeading,
            currentYawRate,
            speed,
            config.controlMode as 'manual' | 'p' | 'pd' | 'pid',
            DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
            1.0,
            dt,
            currentTime
          );
        }

        // 应用控制命令到状态
        state.azipod1.azimuthCmd = controllerStateRef.current.azimuth1Cmd;
        state.azipod2.azimuthCmd = controllerStateRef.current.azimuth2Cmd;
        state.azipod1.thrustCmd = controllerStateRef.current.thrust1Cmd;
        state.azipod2.thrustCmd = controllerStateRef.current.thrust2Cmd;
      }

      // 物理步进
      physicsStateRef.current = azipod3dofStepRK4(
        state,
        azipodParams,
        iceResistance,
        dt
      );

      // 更新显示状态
      const newState = physicsStateRef.current;
      const newIceState = iceStateRef.current;
      const newTime = currentTime + dt;
      simTimeRef.current = newTime;

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
        headingError: Math.abs(currentHeading - config.targetHeading),
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
      if (config.iceModeEnabled && config.iceThickness > XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS) {
        setViolations((prev) => {
          if (prev.length === 0 || prev[prev.length - 1].timestamp < newTime - 5) {
            return [
              ...prev,
              {
                type: 'ICE_THICKNESS_EXCEEDED',
                thresholdValue: XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS,
                actualValue: config.iceThickness,
                timestamp: newTime,
                description: `冰厚 ${config.iceThickness.toFixed(2)}m 超过破冰能力`,
                severity: 'critical',
              },
            ];
          }
          return prev;
        });
      }
    },
    [config, azipodParams]
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

  // 重置
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setSimTime(0);
    simTimeRef.current = 0;
    lastTimeRef.current = 0;
    clockRef.current.reset();
    setPosition({ x: 0, z: 0 });
    setHeading(0);
    setTrail([]);
    setViolations([]);

    physicsStateRef.current = createAzipod3DOFState(0, 0, 0);
    iceStateRef.current = createIceBreakingState();
    controllerStateRef.current = createAzipodCourseKeeperState();

    setMetrics({
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
    setResetCount((previous) => previous + 1);
  }, [config.speed]);

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
      <Canvas shadows={{ type: THREE.PCFShadowMap }}>
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
        />
      </Canvas>

      <SimulationDock
        side="left"
        title="状态监控"
        tabs={[
          {
            id: 'overview',
            label: '总览',
            content: (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-platform-fg-secondary">航向</span>
                <span className="font-mono">{toDegrees(heading).toFixed(1)}°</span>
                <span className="text-platform-fg-secondary">位置</span>
                <span className="font-mono">
                  ({position.x.toFixed(0)}, {position.z.toFixed(0)})
                </span>
                <span className="text-platform-fg-secondary">时间</span>
                <span className="font-mono">{metrics.time.toFixed(1)} s</span>
              </div>
            ),
          },
          {
            id: 'ice',
            label: '冰区',
            content: <IceStatusPanel iceState={iceStateRef.current} iceThickness={config.iceThickness} />,
          },
          {
            id: 'azipod',
            label: '推进',
            content: (
              <AzipodStatusPanel
                azimuth1={metrics.azimuth1Deg}
                azimuth2={metrics.azimuth2Deg}
                thrust1={metrics.thrust1KN}
                thrust2={metrics.thrust2KN}
              />
            ),
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
                config={config}
                onConfigChange={handleConfigChange}
                onReset={handleReset}
                isRunning={isRunning}
                onToggleRun={() => setIsRunning((r) => !r)}
                metrics={metrics}
              />
            ),
          },
          {
            id: 'alerts',
            label: '警报',
            content: <ViolationsPanel violations={violations} />,
          },
          {
            id: 'robust',
            label: '评估',
            content: <RobustAssessmentPanel />,
          },
        ]}
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
        title="雪龙2号极地科考破冰船仿真"
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
