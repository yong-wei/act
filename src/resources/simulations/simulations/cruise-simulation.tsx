'use client';

/**
 * 邮轮仿真组件
 * 爱达·魔都号 - 横摇耦合 + 减摇鳍 + 陷波滤波器
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Line,
  Grid,
  useGLTF,
  PerspectiveCamera,
} from '@react-three/drei';
import { useSearchParams } from 'next/navigation';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Compass, Video, Orbit, ArrowDownFromLine } from 'lucide-react';
import { SimulationClock } from '@/lib/simulation';
import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';
import { FallbackGltfModel } from '@/resources/simulations/components/fallback-gltf-model';
import { persistSceneTraceRun } from '../persisted-run-client';
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
import { cruiseAdoraSceneVisual } from '../profiles/cruise-adora-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';

import type {
  ControlMode,
  Vector2,
  ComfortMetrics,
} from '../core/types';
import { cruiseAdoraProfile } from '../profiles/cruise-adora';
import {
  CruiseShipEngine,
  createSimulationEngine,
} from '../physics/engine-factory';
import {
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
} from '../physics/simulation-engine-facade';
import { toDegrees, toRadians, CRUISE_ADORA_PARAMS, CRUISE_COMFORT_THRESHOLDS, CRUISE_DEFAULT_PID } from '../core/constants';
import {
  CRUISE_COURSE_MODE,
  DEFAULT_PROMPT,
  DEFAULT_TARGET_FORM,
  buildOpenLoopFromController,
  estimateControllerFromOpenLoop,
  computeConsistencyScore,
  computePerformanceFromController,
  normalizeControllerByMode,
  type CruiseControllerMode,
  type CruiseControllerParams,
  type CruiseTargetForm,
} from '@/lib/cruise-course';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';
import {
  buildCruiseTelemetryBridgeSummary,
  type CruiseTelemetryBridgeSummary,
} from './cruise/telemetry-bridge';
import {
  canEmitCruiseCompletionTelemetry,
  hasFiniteRequiredCruisePerformance,
  projectCruiseControlEffectDebrief,
} from './cruise/control-effect-debrief';
import {
  CRUISE_DEBRIEF_ACCEPTANCE_QUERY,
  buildCruiseDebriefProjectionInput,
} from './cruise/control-effect-debrief-acceptance';
import { ControlEffectDebriefCard } from './cruise/control-effect-debrief-card';

// ============ 类型定义 ============

interface CruiseSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  time: number;
  position: Vector2;
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  rollAngle: number;
  targetHeading: number;
  controlMode: ControlMode;
  manualRudder: number;
  seaState: number;
  waveDirection: number;
  finStabilizerEnabled: boolean;
  notchFilterEnabled: boolean;
  comfort: ComfortMetrics;
  finPower: number;
  portFinAngle: number;
  starboardFinAngle: number;
  pidGains: CruiseControllerParams;
  targetForm: CruiseTargetForm;
  prompt: {
    controlObject: string;
    performanceGoal: string;
    constraints: string;
    strategy: string;
  };
  runDurationSec: number;
}

interface CruiseAnalysisResponse {
  objectiveScores: {
    comfort: number;
    performance: number;
    energy: number;
  };
  blendedScore: number;
  advice: string[];
}

interface RuntimeConsistencyPerformance {
  overshoot: number;
  settlingTime: number;
  accel: number;
  settled: boolean;
}

function toCruiseControllerMode(mode: ControlMode): CruiseControllerMode {
  if (mode === 'p') return 'p';
  if (mode === 'pd') return 'pd';
  return 'pid';
}

const CRUISE_ROUTE_START: Vector2 = { x: -3000, z: 0 };
const CRUISE_ROUTE_STRAIGHT_DISTANCE = 800;
const CRUISE_ROUTE_TURN_HEADING = 30;
const CRUISE_ROUTE_EXTENSION = 5200;
const CRUISE_HEADING_PRIMARY = simulationScenePalette.cruiseHeadingPrimary;
const CRUISE_HEADING_SECONDARY = simulationScenePalette.cruiseHeadingSecondary;
const CRUISE_HULL_SINK_OFFSET = 2.5;
const CRUISE_EVALUATION_DURATION_SEC = 300;

function createCruiseTraceRunId(): string {
  return `cruise-${Date.now().toString(36)}`;
}

function getCruiseMissionTargetHeading(position: Vector2): number {
  const traveled = Math.hypot(position.x - CRUISE_ROUTE_START.x, position.z - CRUISE_ROUTE_START.z);
  return traveled < CRUISE_ROUTE_STRAIGHT_DISTANCE ? 0 : CRUISE_ROUTE_TURN_HEADING;
}

function buildCruiseDesiredRoute(): Vector2[] {
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
  arrowWidth = 28
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
        points={[start, end]}
        color={color}
        lineWidth={lineWidth}
        dashed={dashed}
        dashScale={28}
        dashSize={28}
        gapSize={14}
      />
      <Line points={[leftWing, end]} color={color} lineWidth={lineWidth} />
      <Line points={[rightWing, end]} color={color} lineWidth={lineWidth} />
    </>
  );
}

// ============ 海面组件 ============

function Ocean({ seaState, sceneTheme }: { seaState: number; sceneTheme: SimulationSceneTheme }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current && meshRef.current.material instanceof THREE.ShaderMaterial) {
      meshRef.current.material.uniforms.time.value = clock.getElapsedTime();
    }
  });

  const waveAmplitude = 1.0 + seaState * 0.8;

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waterColor: { value: new THREE.Color(sceneTheme.waterColor) },
        foamColor: { value: new THREE.Color(simulationScenePalette.white) },
        waveAmplitude: { value: waveAmplitude },
      },
      vertexShader: `
        uniform float time;
        uniform float waveAmplitude;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float wave1 = sin(pos.x * 0.015 + time * 0.4) * waveAmplitude;
          float wave2 = sin(pos.z * 0.02 + time * 0.25) * waveAmplitude * 0.8;
          float wave3 = sin((pos.x + pos.z) * 0.012 + time * 0.35) * waveAmplitude * 0.6;
          pos.y += wave1 + wave2 + wave3;
          vElevation = pos.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 waterColor;
        uniform vec3 foamColor;
        uniform float waveAmplitude;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          float foam = smoothstep(waveAmplitude * 2.0, waveAmplitude * 3.0, vElevation);
          vec3 color = mix(waterColor, foamColor, foam * 0.25);
          gl_FragColor = vec4(color, 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, [sceneTheme.waterColor, waveAmplitude]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={shaderMaterial}>
      <planeGeometry args={[25000, 25000, 128, 128]} />
    </mesh>
  );
}

// ============ 邮轮模型组件 ============

const MODEL = resolveRegisteredSimulationModel('luxury-liner');

function CruiseShipModel(props: {
  position: Vector2;
  heading: number;
  rollAngle: number;
}) {
  return (
    <FallbackGltfModel
      candidates={MODEL.candidates}
      render={(url) => <CruiseShipModelScene url={url} {...props} />}
    />
  );
}

function CruiseShipModelScene({
  url,
  position,
  heading,
  rollAngle,
}: {
  url: string;
  position: Vector2;
  heading: number;
  rollAngle: number;
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

    // 启用阴影和修复材质
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // meshopt 量化解码后几何包围球处于量化空间，按视锥剔除会在多数视角误剔除（样板同口径）。
        child.frustumCulled = false;
        if (child.material) {
          // 修复材质可见性问题
          child.material.transparent = false;
          child.material.opacity = 1;
          child.material.side = THREE.DoubleSide;
          // 确保材质可见
          child.material.visible = true;
          child.material.needsUpdate = true;
        }
      }
    });

    // 计算缩放 - 目标长度约 324m (爱达·魔都号实际长度)
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = CRUISE_ADORA_PARAMS.LENGTH;
    const calculatedScale = targetLength / maxDim;

    // 调试输出
    console.log('Cruise model loaded:', {
      originalSize: { x: size.x, y: size.y, z: size.z },
      maxDim,
      targetLength,
      calculatedScale,
      modelHeight: size.y * calculatedScale,
    });

    return { model: cloned, scale: calculatedScale, modelHeight: size.y * calculatedScale };
  }, [scene]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = position.x;
      groupRef.current.position.y = modelHeight * 0.5 - CRUISE_ADORA_PARAMS.DRAFT - CRUISE_HULL_SINK_OFFSET;
      groupRef.current.position.z = position.z;
      groupRef.current.rotation.y = -heading + Math.PI / 2;
      groupRef.current.rotation.z = rollAngle;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={scale} />
      {/* 船艏标记 */}
      <mesh position={[0, modelHeight * 0.6, 0]}>
        <sphereGeometry args={[6, 16, 16]} />
        <meshBasicMaterial color={simulationScenePalette.cruisePrimary} />
      </mesh>
    </group>
  );
}

// 预加载模型（仅压缩件，避免双份下载）
useGLTF.preload(MODEL.primary);

// ============ 航迹线组件 ============

function TrajectoryLine({ points }: { points: Vector2[] }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} color={CRUISE_HEADING_PRIMARY} lineWidth={2.4} />;
}

function DesiredRouteLine({ points }: { points: Vector2[] }) {
  const arrowStart = points.length > 1 ? points[points.length - 2] : null;
  const arrowEnd = points.length > 1 ? points[points.length - 1] : null;
  if (points.length < 2) {
    return null;
  }

  return (
    <>
      <WaterHuggingLine points={points} color={CRUISE_HEADING_SECONDARY} lineWidth={2.2} dashed dashSize={36} gapSize={16} />
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

function ComfortGauge({ comfort }: { comfort: ComfortMetrics }) {
  const getColor = () => {
    switch (comfort.comfortRating) {
      case 'excellent': return simulationScenePalette.success;
      case 'good': return simulationScenePalette.successSoft;
      case 'moderate': return simulationScenePalette.warning;
      case 'poor': return simulationScenePalette.containerPrimary;
      case 'unacceptable': return simulationScenePalette.danger;
    }
  };

  const getLabel = () => {
    switch (comfort.comfortRating) {
      case 'excellent': return '优秀';
      case 'good': return '良好';
      case 'moderate': return '中等';
      case 'poor': return '较差';
      case 'unacceptable': return '不可接受';
    }
  };

  const angle = Math.min(comfort.msi / 50, 1) * 180;

  return (
    <div className="rounded-lg bg-platform-canvas-muted p-3">
      <div className="mb-2 text-xs font-semibold text-platform-fg-muted">舒适度评估</div>
      <div className="relative mx-auto h-24 w-40">
        {/* 仪表背景 */}
        <svg viewBox="0 0 100 60" className="h-full w-full">
          {/* 背景弧 */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={simulationScenePalette.neutralStroke}
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* 分区颜色 */}
          <path d="M 10 50 A 40 40 0 0 1 26 22" fill="none" stroke={simulationScenePalette.success} strokeWidth="8" strokeLinecap="round" />
          <path d="M 26 22 A 40 40 0 0 1 50 10" fill="none" stroke={simulationScenePalette.successSoft} strokeWidth="8" strokeLinecap="round" />
          <path d="M 50 10 A 40 40 0 0 1 74 22" fill="none" stroke={simulationScenePalette.warning} strokeWidth="8" strokeLinecap="round" />
          <path d="M 74 22 A 40 40 0 0 1 90 50" fill="none" stroke={simulationScenePalette.danger} strokeWidth="8" strokeLinecap="round" />
          {/* 指针 */}
          <line
            x1="50"
            y1="50"
            x2={50 + 30 * Math.cos(Math.PI - (angle * Math.PI) / 180)}
            y2={50 - 30 * Math.sin(Math.PI - (angle * Math.PI) / 180)}
            stroke={getColor()}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="50" cy="50" r="4" fill={getColor()} />
        </svg>
      </div>
      <div className="mt-1 text-center">
        <span className="text-xl font-bold" style={{ color: getColor() }}>{getLabel()}</span>
        <div className="text-xs text-platform-fg-muted">MSI: {comfort.msi.toFixed(1)}%</div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-platform-fg-muted">横摇RMS</span>
          <span className="ml-1 text-platform-fg-inverse">{comfort.rollRms.toFixed(2)}°</span>
        </div>
        <div>
          <span className="text-platform-fg-muted">横摇峰值</span>
          <span className="ml-1 text-platform-fg-inverse">{comfort.rollPeak.toFixed(2)}°</span>
        </div>
      </div>
    </div>
  );
}

// ============ 减摇鳍面板 ============

function FinStabilizerPanel({
  enabled,
  portAngle,
  starboardAngle,
  power,
  onToggle,
}: {
  enabled: boolean;
  portAngle: number;
  starboardAngle: number;
  power: number;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg bg-platform-canvas-muted p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-platform-fg-muted">减摇鳍</span>
        <button type="button"
          onClick={onToggle}
          className={`rounded px-2 py-0.5 text-xs ${
            enabled ? 'bg-[hsl(var(--platform-brand-success))]' : 'bg-platform-canvas-muted'
          }`}
        >
          {enabled ? '已启用' : '已禁用'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* 左舷鳍 */}
        <div className="text-center">
          <div className="relative mx-auto h-12 w-4 rounded bg-platform-canvas-muted">
            <div
              className="absolute bottom-1/2 left-0 h-0.5 w-full origin-left bg-[hsl(var(--platform-chart-5))]"
              style={{ transform: `rotate(${-portAngle}deg)` }}
            />
          </div>
          <div className="mt-1 text-xs text-platform-fg-muted">左舷</div>
          <div className="text-xs text-platform-fg-inverse">{portAngle.toFixed(1)}°</div>
        </div>
        {/* 右舷鳍 */}
        <div className="text-center">
          <div className="relative mx-auto h-12 w-4 rounded bg-platform-canvas-muted">
            <div
              className="absolute bottom-1/2 left-0 h-0.5 w-full origin-left bg-[hsl(var(--platform-chart-5))]"
              style={{ transform: `rotate(${-starboardAngle}deg)` }}
            />
          </div>
          <div className="mt-1 text-xs text-platform-fg-muted">右舷</div>
          <div className="text-xs text-platform-fg-inverse">{starboardAngle.toFixed(1)}°</div>
        </div>
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-xs">
          <span className="text-platform-fg-muted">功率</span>
          <span className={power > 400 ? 'text-[hsl(var(--platform-brand-evidence))]' : 'text-platform-fg-inverse'}>
            {power.toFixed(0)} kW
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-platform-canvas-muted">
          <div
            className={`h-full rounded-full ${power > 400 ? 'bg-[hsl(var(--platform-brand-evidence))]' : 'bg-[hsl(var(--platform-chart-5))]'}`}
            style={{ width: `${Math.min((power / 500) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============ 陷波滤波器面板 ============

function NotchFilterPanel({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg bg-platform-canvas-muted p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-platform-fg-muted">陷波滤波器</span>
        <button type="button"
          onClick={onToggle}
          className={`rounded px-2 py-0.5 text-xs ${
            enabled ? 'bg-[hsl(var(--platform-brand-success))]' : 'bg-platform-canvas-muted'
          }`}
        >
          {enabled ? '已启用' : '已禁用'}
        </button>
      </div>
      <div className="text-xs text-platform-fg-muted">
        <div className="mb-1">中心频率: 0.16 Hz</div>
        <div className="mb-1">带宽: 0.15 Hz</div>
        <div>陷波深度: -30 dB</div>
      </div>
      {/* 简化 Bode 图 */}
      <div className="mt-2 h-12 rounded bg-platform-canvas-muted p-1">
        <svg viewBox="0 0 100 30" className="h-full w-full">
          {/* 频率轴 */}
          <line x1="10" y1="25" x2="95" y2="25" stroke={simulationScenePalette.mutedStroke} strokeWidth="0.5" />
          {/* 幅频响应 */}
          <path
            d={enabled
              ? "M 10 10 Q 30 10, 40 8 Q 50 25, 60 8 Q 70 10, 90 10"
              : "M 10 15 L 90 15"
            }
            fill="none"
            stroke={simulationScenePalette.cruisePrimary}
            strokeWidth="1.5"
          />
          {/* 致晕频段标记 */}
          <rect x="35" y="5" width="30" height="20" fill="hsl(var(--platform-brand-danger) / 0.14)" />
          <text x="50" y="3" fontSize="3" fill={simulationScenePalette.danger} textAnchor="middle">0.1-0.3Hz</text>
        </svg>
      </div>
    </div>
  );
}

// ============ 控制面板 ============

function ControllerPanel({
  state,
  isCourseMode,
  virtualModeEnabled,
  onPidGainsChange,
  onControlModeChange,
  onManualRudderChange,
  onSeaStateChange,
  onWaveDirectionChange,
  onVirtualModeToggle,
  onFinStabilizerToggle,
  onNotchFilterToggle,
  onStart,
  onPause,
  onReset,
}: {
  state: CruiseSimulationState;
  isCourseMode: boolean;
  virtualModeEnabled: boolean;
  onPidGainsChange: (key: keyof CruiseControllerParams, value: number) => void;
  onControlModeChange: (mode: ControlMode) => void;
  onManualRudderChange: (value: number) => void;
  onSeaStateChange: (level: number) => void;
  onWaveDirectionChange: (direction: number) => void;
  onVirtualModeToggle: () => void;
  onFinStabilizerToggle: () => void;
  onNotchFilterToggle: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  const pidEditable = state.controlMode !== 'manual';
  const kpEditable = pidEditable;
  const kiEditable = state.controlMode === 'pid';
  const kdEditable = state.controlMode === 'pd' || state.controlMode === 'pid';
  const modeHint =
    state.controlMode === 'manual'
      ? '手动模式不启用控制器参数。'
      : state.controlMode === 'p'
        ? 'P 控制：仅 Kp 可调。'
        : state.controlMode === 'pd'
          ? 'PD 控制：Kp、Kd 可调，Ki 锁定为 0。'
          : 'PID 控制：Kp、Ki、Kd 全部可调。';

  return (
    <div className="space-y-3 p-1 text-sm">
      {isCourseMode ? (
        <div className="space-y-2 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-platform-fg-primary">虚拟仿真观察</span>
            <button
              type="button"
              onClick={onVirtualModeToggle}
              className={`rounded border px-2 py-1 ${virtualModeEnabled ? simulationUi.buttonPrimary : simulationUi.buttonOutline}`}
            >
              {virtualModeEnabled ? '已开启' : '已关闭'}
            </button>
          </div>
          <p className="text-platform-fg-secondary">
            开启后采用真实扰动模型；关闭时使用理想化环境。请对比两者结果差异，并可结合加速仿真节约时间。
          </p>
        </div>
      ) : null}

      {/* 仿真控制 */}
      <div className="flex gap-2">
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

      <div className="rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1 text-xs text-platform-fg-secondary">
        单次校验时长: {state.runDurationSec}s（到时自动结束并生成评估数据）
      </div>

      {/* 任务航向 */}
      <div>
        <label className="mb-1 block text-xs text-platform-fg-muted">任务目标航向: {state.targetHeading.toFixed(0)}°</label>
        <div className="rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1 text-xs text-platform-fg-secondary">
          航线规则：先直航 {CRUISE_ROUTE_STRAIGHT_DISTANCE}m，再右转 {CRUISE_ROUTE_TURN_HEADING}° 并保持航向。
        </div>
      </div>

      {/* 海况等级 */}
      <div>
        <label className="mb-1 block text-xs text-platform-fg-muted">
          海况等级: {state.seaState}级
          <span className="ml-2 text-[hsl(var(--platform-chart-5))]">
            ({state.seaState <= 2 ? '轻浪' : state.seaState <= 4 ? '中浪' : '大浪'})
          </span>
        </label>
        <input aria-label="巡航舒适性参数一"
          type="range"
          min="1"
          max="7"
          value={state.seaState}
          onChange={(e) => onSeaStateChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      {/* 波向 */}
      <div>
        <label className="mb-1 block text-xs text-platform-fg-muted">
          相对波向: {state.waveDirection}°
          <span className="ml-2 text-[hsl(var(--platform-chart-5))]">
            ({state.waveDirection === 90 || state.waveDirection === 270 ? '横浪' : state.waveDirection === 0 || state.waveDirection === 180 ? '纵浪' : '斜浪'})
          </span>
        </label>
        <input aria-label="巡航舒适性参数二"
          type="range"
          min="0"
          max="360"
          value={state.waveDirection}
          onChange={(e) => onWaveDirectionChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      {/* 控制模式 */}
      <div>
        <p className="mb-1 block text-xs text-platform-fg-muted">控制模式</p>
        <div className="flex flex-wrap gap-1">
          {(['manual', 'p', 'pd', 'pid'] as ControlMode[]).map((mode) => (
            <button type="button"
              key={mode}
              onClick={() => onControlModeChange(mode)}
              className={`rounded border px-2 py-1 text-xs ${
                state.controlMode === mode
                  ? simulationUi.buttonPrimary
                  : simulationUi.buttonOutline
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {state.controlMode === 'manual' ? (
        <div>
          <label className="mb-1 block text-xs text-platform-fg-muted">
            手动舵角: {state.manualRudder.toFixed(0)}°
          </label>
          <input aria-label="巡航舒适性参数三"
            type="range"
            min={-CRUISE_ADORA_PARAMS.MAX_RUDDER_ANGLE}
            max={CRUISE_ADORA_PARAMS.MAX_RUDDER_ANGLE}
            value={state.manualRudder}
            onChange={(event) => onManualRudderChange(Number(event.target.value))}
            className={simulationUi.nativeRange}
          />
        </div>
      ) : null}

      {isCourseMode ? (
        <div className="space-y-2 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2.5">
          <div className="text-xs font-semibold text-platform-fg-primary">控制器参数</div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] text-platform-fg-secondary">
              Kp
              <input
                type="number"
                step={0.05}
                min={0}
                value={state.pidGains.kp}
                disabled={!kpEditable}
                onChange={(event) => onPidGainsChange('kp', Number(event.target.value))}
                className={`mt-1 w-full rounded border px-2 py-1 text-xs ${
                  kpEditable
                    ? 'border-platform-border bg-platform-surface-overlay/86 text-platform-fg-primary'
                    : 'cursor-not-allowed border-platform-border bg-platform-canvas-muted text-platform-fg-muted'
                }`}
              />
            </label>
            <label className="text-[11px] text-platform-fg-secondary">
              Ki
              <input
                type="number"
                step={0.05}
                min={0}
                value={state.pidGains.ki}
                disabled={!kiEditable}
                onChange={(event) => onPidGainsChange('ki', Number(event.target.value))}
                className={`mt-1 w-full rounded border px-2 py-1 text-xs ${
                  kiEditable
                    ? 'border-platform-border bg-platform-surface-overlay/86 text-platform-fg-primary'
                    : 'cursor-not-allowed border-platform-border bg-platform-canvas-muted text-platform-fg-muted'
                }`}
              />
            </label>
            <label className="text-[11px] text-platform-fg-secondary">
              Kd
              <input
                type="number"
                step={0.05}
                min={0}
                value={state.pidGains.kd}
                disabled={!kdEditable}
                onChange={(event) => onPidGainsChange('kd', Number(event.target.value))}
                className={`mt-1 w-full rounded border px-2 py-1 text-xs ${
                  kdEditable
                    ? 'border-platform-border bg-platform-surface-overlay/86 text-platform-fg-primary'
                    : 'cursor-not-allowed border-platform-border bg-platform-canvas-muted text-platform-fg-muted'
                }`}
              />
            </label>
          </div>
          <div className="text-[11px] text-platform-fg-secondary">{modeHint}</div>
        </div>
      ) : null}

      {/* 减摇鳍面板 */}
      <FinStabilizerPanel
        enabled={state.finStabilizerEnabled}
        portAngle={state.portFinAngle}
        starboardAngle={state.starboardFinAngle}
        power={state.finPower}
        onToggle={onFinStabilizerToggle}
      />

      {/* 陷波滤波器面板 */}
      <NotchFilterPanel
        enabled={state.notchFilterEnabled}
        onToggle={onNotchFilterToggle}
      />
    </div>
  );
}

// ============ HUD 组件 ============

function HUD({ state }: { state: CruiseSimulationState }) {
  const headingError = state.targetHeading - state.heading;
  const normalizedError = headingError > 180 ? headingError - 360 : headingError < -180 ? headingError + 360 : headingError;
  const rollDeg = toDegrees(state.rollAngle);
  const remaining = Math.max(0, state.runDurationSec - state.time);

  return (
    <div className="space-y-3 p-1 text-sm">

      {/* 时间 */}
      <div className="flex justify-between border-b border-platform-border pb-2">
        <span className="text-platform-fg-muted">仿真时间</span>
        <span className="font-mono text-[hsl(var(--platform-chart-5))]">{state.time.toFixed(1)}s</span>
      </div>
      <div className="flex justify-between border-b border-platform-border pb-2">
        <span className="text-platform-fg-muted">剩余时长</span>
        <span className={`font-mono ${remaining <= 15 ? 'text-[hsl(var(--platform-brand-evidence))]' : 'text-platform-fg-primary'}`}>
          {remaining.toFixed(1)}s
        </span>
      </div>

      {/* 航向信息 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-platform-fg-muted">当前航向</div>
          <div className="font-mono text-lg text-platform-fg-inverse">{state.heading.toFixed(1)}°</div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-muted">航向误差</div>
          <div className={`font-mono text-lg ${Math.abs(normalizedError) > 3 ? 'text-[hsl(var(--platform-brand-danger))]' : 'text-[hsl(var(--platform-brand-success))]'}`}>
            {normalizedError.toFixed(1)}°
          </div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-muted">转艏角速度</div>
          <div className="font-mono text-platform-fg-inverse">{state.yawRate.toFixed(2)}°/s</div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-muted">舵角</div>
          <div className="font-mono text-platform-fg-inverse">{state.rudder.toFixed(1)}°</div>
        </div>
      </div>

      {/* 横摇信息 */}
      <div className="rounded bg-platform-canvas-muted p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-platform-fg-muted">横摇角</span>
          <span className={`font-mono ${Math.abs(rollDeg) > 4 ? 'text-[hsl(var(--platform-brand-danger))]' : Math.abs(rollDeg) > 2 ? 'text-[hsl(var(--platform-brand-evidence))]' : 'text-[hsl(var(--platform-brand-success))]'}`}>
            {rollDeg.toFixed(2)}°
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-platform-canvas-muted">
          <div
            className={`h-full rounded-full transition-all ${
              Math.abs(rollDeg) > 4 ? 'bg-[hsl(var(--platform-brand-danger))]' : Math.abs(rollDeg) > 2 ? 'bg-[hsl(var(--platform-brand-evidence))]' : 'bg-[hsl(var(--platform-brand-success))]'
            }`}
            style={{ width: `${Math.min(Math.abs(rollDeg) / 6 * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* 舒适度仪表盘 */}
      <ComfortGauge comfort={state.comfort} />

      {/* 横摇警告 */}
      {Math.abs(rollDeg) > CRUISE_COMFORT_THRESHOLDS.MODERATE_ROLL && (
        <div className="rounded bg-[hsl(var(--platform-brand-danger)/0.18)] p-2 text-center text-xs text-[hsl(var(--platform-brand-danger))]">
          ⚠️ 横摇角过大，乘客可能不适
        </div>
      )}
    </div>
  );
}

function CruiseTradeoffPanel({
  state,
  isCourseMode,
  courseRole,
  targetFormTouched,
  performance,
  consistencyScore,
  consistencyComment,
  consistencyLoading,
  hasRuntimeData,
  runtimeHint,
  debrief,
  onTargetFormTouch,
  onTargetFormChange,
  onGenerateConsistencyComment,
}: {
  state: CruiseSimulationState;
  isCourseMode: boolean;
  courseRole: 'teacher' | 'student';
  targetFormTouched: Partial<Record<keyof CruiseTargetForm, boolean>>;
  performance: RuntimeConsistencyPerformance | null;
  consistencyScore: ReturnType<typeof computeConsistencyScore> | null;
  consistencyComment: string;
  consistencyLoading: boolean;
  hasRuntimeData: boolean;
  runtimeHint: string;
  debrief: ReturnType<typeof projectCruiseControlEffectDebrief>;
  onTargetFormTouch: (key: keyof CruiseTargetForm, touched: boolean) => void;
  onTargetFormChange: (key: keyof CruiseTargetForm, value: number) => void;
  onGenerateConsistencyComment: () => void;
}) {
  const [weights, setWeights] = useState({ comfortWeight: 0.5, performanceWeight: 0.35, energyWeight: 0.15 });
  const [analysis, setAnalysis] = useState<CruiseAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const derivedMetrics = useMemo(
    () => ({
      msi: Number(state.comfort.msi.toFixed(1)),
      settlingTime: Number(Math.max(6, Math.abs(state.targetHeading - state.heading) * 0.7 + 8).toFixed(1)),
      overshoot: Number(Math.abs(state.rudder).toFixed(1)),
      finPower: Number(state.finPower.toFixed(0)),
    }),
    [state.comfort.msi, state.finPower, state.heading, state.rudder, state.targetHeading]
  );

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulation/cruise-comfort-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectives: weights,
          metrics: derivedMetrics,
        }),
      });
      if (!response.ok) {
        throw new Error('舒适度分析失败');
      }
      setAnalysis((await response.json()) as CruiseAnalysisResponse);
    } finally {
      setLoading(false);
    }
  }, [derivedMetrics, weights]);

  return (
    <div className="space-y-3 text-sm">
      <ControlEffectDebriefCard debrief={debrief} />
      {isCourseMode ? (
        <div className="space-y-2 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2 text-xs text-platform-fg-secondary">
          <div className="font-semibold text-platform-fg-primary">性能指标约束</div>
          <div className="grid grid-cols-2 gap-2">
            <label>
              目标超调(%)
              <input
                type="number"
                step={1}
                min={1}
                value={isCourseMode && courseRole === 'student' && !targetFormTouched.overshoot ? '' : state.targetForm.overshoot}
                placeholder={String(DEFAULT_TARGET_FORM.overshoot)}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!raw) {
                    onTargetFormTouch('overshoot', false);
                    return;
                  }
                  const value = Number(raw);
                  if (Number.isFinite(value)) {
                    onTargetFormTouch('overshoot', true);
                    onTargetFormChange('overshoot', value);
                  }
                }}
                className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
              />
            </label>
            <label>
              目标调节时间(s)
              <input
                type="number"
                step={1}
                min={1}
                value={isCourseMode && courseRole === 'student' && !targetFormTouched.settlingTime ? '' : state.targetForm.settlingTime}
                placeholder={String(DEFAULT_TARGET_FORM.settlingTime)}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!raw) {
                    onTargetFormTouch('settlingTime', false);
                    return;
                  }
                  const value = Number(raw);
                  if (Number.isFinite(value)) {
                    onTargetFormTouch('settlingTime', true);
                    onTargetFormChange('settlingTime', value);
                  }
                }}
                className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
              />
            </label>
            <label>
              稳态误差(%)
              <input
                type="number"
                step={0.1}
                min={0}
                value={isCourseMode && courseRole === 'student' && !targetFormTouched.steadyError ? '' : state.targetForm.steadyError}
                placeholder={String(DEFAULT_TARGET_FORM.steadyError)}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!raw) {
                    onTargetFormTouch('steadyError', false);
                    return;
                  }
                  const value = Number(raw);
                  if (Number.isFinite(value)) {
                    onTargetFormTouch('steadyError', true);
                    onTargetFormChange('steadyError', value);
                  }
                }}
                className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
              />
            </label>
            <label>
              侧向加速度上限(g)
              <input
                type="number"
                step={0.01}
                min={0}
                value={isCourseMode && courseRole === 'student' && !targetFormTouched.maxLateralAccel ? '' : state.targetForm.maxLateralAccel}
                placeholder={String(DEFAULT_TARGET_FORM.maxLateralAccel)}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!raw) {
                    onTargetFormTouch('maxLateralAccel', false);
                    return;
                  }
                  const value = Number(raw);
                  if (Number.isFinite(value)) {
                    onTargetFormTouch('maxLateralAccel', true);
                    onTargetFormChange('maxLateralAccel', value);
                  }
                }}
                className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {[
          ['舒适权重', 'comfortWeight'],
          ['性能权重', 'performanceWeight'],
          ['能耗权重', 'energyWeight'],
        ].map(([label, key]) => (
          <label key={key} className="text-xs text-platform-fg-secondary">
            {label}
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={weights[key as keyof typeof weights]}
              onChange={(event) =>
                setWeights((prev) => ({
                  ...prev,
                  [key]: Number(event.target.value),
                }))
              }
              className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
            />
          </label>
        ))}
      </div>

      <div className="rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2 text-xs text-platform-fg-secondary">
        <div>MSI: {derivedMetrics.msi}%</div>
        <div>调节时间: {derivedMetrics.settlingTime}s</div>
        <div>舵角幅值: {derivedMetrics.overshoot}°</div>
        <div>减摇鳍功率: {derivedMetrics.finPower}kW</div>
      </div>

      <button
        type="button"
        onClick={() => void runAnalysis()}
        disabled={loading}
        className={`w-full rounded border px-3 py-2 ${simulationUi.buttonPrimary} disabled:opacity-60`}
      >
        {loading ? '分析中...' : '计算权衡得分'}
      </button>

      {analysis ? (
        <div className="space-y-2 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2 text-xs">
          <div className="text-platform-fg-secondary">
            综合评分：<span className="font-semibold text-platform-fg-primary">{analysis.blendedScore.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-platform-fg-secondary">
            <div>舒适 {analysis.objectiveScores.comfort.toFixed(1)}</div>
            <div>性能 {analysis.objectiveScores.performance.toFixed(1)}</div>
            <div>能耗 {analysis.objectiveScores.energy.toFixed(1)}</div>
          </div>
          <ul className="space-y-1 text-platform-fg-secondary">
            {analysis.advice.map((item) => (
              <li key={item} className="rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isCourseMode ? (
        <div className="space-y-2 rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2 text-xs text-platform-fg-secondary">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-platform-fg-primary">一致性校验</span>
            <button
              type="button"
              onClick={onGenerateConsistencyComment}
              disabled={consistencyLoading || !hasRuntimeData}
              className={`rounded border px-2 py-1 ${simulationUi.buttonOutline} disabled:opacity-60`}
            >
              {consistencyLoading ? '生成中...' : '生成评价'}
            </button>
          </div>
          {!hasRuntimeData || !performance || !consistencyScore ? (
            <div className="rounded border border-[hsl(var(--platform-brand-evidence)/0.42)] bg-[hsl(var(--platform-brand-evidence)/0.14)] px-2 py-2 text-[hsl(var(--platform-brand-evidence))]">
              {runtimeHint}
            </div>
          ) : (
            <>
              <div>一致性得分：<span className="font-semibold text-platform-fg-primary">{consistencyScore.score}%</span></div>
              <div>超调：{performance.overshoot}% / 目标≤{state.targetForm.overshoot}%</div>
              <div>调节时间：{performance.settlingTime}s / 目标≤{state.targetForm.settlingTime}s</div>
              <div>侧向加速度：{performance.accel}g / 目标≤{state.targetForm.maxLateralAccel}g</div>
              {!performance.settled ? (
                <div className="text-[hsl(var(--platform-brand-evidence))]">当前仍在收敛中，调节时间按未收敛处理。</div>
              ) : null}
            </>
          )}
          <div className="rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1">
            {consistencyComment}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CruiseAIPanel({
  state,
  isCourseMode,
  feedback,
  onPromptChange,
  onApplyPrompt,
}: {
  state: CruiseSimulationState;
  isCourseMode: boolean;
  feedback: string;
  onPromptChange: (key: keyof CruiseSimulationState['prompt'], value: string) => void;
  onApplyPrompt: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-3">
      {isCourseMode ? (
        <div className="rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2 text-xs text-platform-fg-secondary">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-platform-fg-primary">结构化提示词</span>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className={`rounded border px-2 py-1 ${simulationUi.buttonOutline}`}
            >
              {expanded ? '收起' : '展开'}
            </button>
          </div>
          {expanded ? (
            <div className="space-y-2">
              <label className="block">
                控制对象
                <textarea
                  value={state.prompt.controlObject}
                  onChange={(event) => onPromptChange('controlObject', event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
                />
              </label>
              <label className="block">
                性能目标
                <textarea
                  value={state.prompt.performanceGoal}
                  onChange={(event) => onPromptChange('performanceGoal', event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
                />
              </label>
              <label className="block">
                约束条件
                <textarea
                  value={state.prompt.constraints}
                  onChange={(event) => onPromptChange('constraints', event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
                />
              </label>
              <label className="block">
                调整策略
                <textarea
                  value={state.prompt.strategy}
                  onChange={(event) => onPromptChange('strategy', event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1"
                />
              </label>
              <button
                type="button"
                onClick={onApplyPrompt}
                className={`w-full rounded border px-3 py-2 ${simulationUi.buttonPrimary}`}
              >
                发送结构化提示词
              </button>
              <div className="rounded border border-platform-border bg-platform-surface-overlay/86 px-2 py-1 text-[11px] text-platform-fg-secondary">
                {feedback}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

    </div>
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
function CruiseWater({ state }: { state: CruiseSimulationState }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <GerstnerWater
      tier={params.waterTier}
      positionSampler={() => ({ x: state.position.x, z: state.position.z })}
      waterColor={water.waterColor}
      deepColor={water.deepColor}
      horizonColor={water.horizonColor}
      foamColor={simulationScenePalette.waterFoam}
    />
  );
}

/** 尾迹粒子场桥接：逐帧喂入船位/航向与 Gerstner 波面高度。 */
function WakeTrailRig({
  state,
  playing,
  resetToken,
}: {
  state: CruiseSimulationState;
  playing: boolean;
  resetToken: number;
}) {
  const { wakeVisible } = useSceneEnvironment();
  const transformRef = useRef({ position: [0, 0, 0] as [number, number, number], heading: 0 });
  const timeRef = useRef(0);
  const { tier, params } = useSceneQuality();

  useFrame((frameState) => {
    transformRef.current.position = [state.position.x, 0, state.position.z];
    transformRef.current.heading = platformHeadingToSceneRad(state.heading);
    timeRef.current = frameState.clock.getElapsedTime();
  });

  if (!wakeVisible) return null;
  return (
    <WakeTrail
      key={resetToken}
      profile={cruiseAdoraSceneVisual}
      shipTransform={transformRef.current}
      qualityTier={tier}
      playing={playing}
      waterYSampler={(x, z) => -1 + computeGerstnerDisplacement(GERSTNER_WAVE_SETS[params.waterTier], x ?? 0, z ?? 0, timeRef.current).y}
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

function VisualizationLayer({
  state,
  showGrid,
  sceneTheme,
  desiredRoutePoints,
  trajectoryPoints,
  cameraMode,
  controlsRef,
  onRequestFreeMode,
  resetToken,
  resetSignal,
}: {
  state: CruiseSimulationState;
  virtualModeEnabled: boolean;
  showGrid: boolean;
  sceneTheme: SimulationSceneTheme;
  desiredRoutePoints: Vector2[];
  trajectoryPoints: Vector2[];
  cameraMode: string;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onRequestFreeMode: () => void;
  resetToken: number;
  resetSignal: number;
}) {
  return (
    <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [-500, 300, 800], fov: 60, near: 1, far: 50000 }}>
      <Suspense fallback={null}>
        <EnvironmentScene />
      </Suspense>
      <SoundscapeAmbienceDriver />
      <SceneQualityDriver />
      <Suspense fallback={null}>
        <CruiseWater state={state} />
      </Suspense>
      {showGrid ? (
        <Grid
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
        fallback={(
          <ModelLoadingPlaceholder
            label="邮轮模型加载中"
            sublabel="场景已就绪，可先查看海况与参考航迹"
          />
        )}
      >
        <CruiseShipModel
          position={state.position}
          heading={toRadians(state.heading)}
          rollAngle={state.rollAngle}
        />
      </Suspense>
      <DesiredRouteLine points={desiredRoutePoints} />
      <TrajectoryLine points={trajectoryPoints} />
      <TeachingAnnotationsGate
        position={state.position}
        targetHeading={state.targetHeading}
        currentHeading={state.heading}
      />
      <WakeTrailRig state={state} playing={state.isRunning && !state.isPaused} resetToken={resetToken} />
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
    </Canvas>
  );
}

function TelemetryBridge({
  state,
  performance,
  consistencyScore,
  hasRuntimeData,
  isCompleted,
  runId,
  startedAt,
  sampleFrameCount,
  virtualModeEnabled,
}: {
  state: CruiseSimulationState;
  performance: RuntimeConsistencyPerformance | null;
  consistencyScore: ReturnType<typeof computeConsistencyScore> | null;
  hasRuntimeData: boolean;
  isCompleted: boolean;
  runId: string;
  startedAt: string;
  sampleFrameCount: number;
  virtualModeEnabled: boolean;
}) {
  const emittedRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (emittedRunIdRef.current && emittedRunIdRef.current !== runId) {
      emittedRunIdRef.current = null;
    }
  }, [runId]);

  useEffect(() => {
    if (!isCompleted || !hasRuntimeData || !hasFiniteRequiredCruisePerformance(performance)) {
      return;
    }

    const summary = buildCruiseTelemetryBridgeSummary({
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      seed: `${runId}:${startedAt}`,
      state: {
        time: state.time,
        heading: state.heading,
        targetHeading: state.targetHeading,
        yawRate: state.yawRate,
        rudder: state.rudder,
        speed: state.speed,
        rollAngle: state.rollAngle,
        seaState: state.seaState,
        waveDirection: state.waveDirection,
        finStabilizerEnabled: state.finStabilizerEnabled,
        notchFilterEnabled: state.notchFilterEnabled,
        comfort: state.comfort,
        finPower: state.finPower,
        controlMode: state.controlMode,
        pidGains: state.pidGains,
        targetForm: state.targetForm,
      },
      performance,
      consistencyScore: consistencyScore ? { score: consistencyScore.score } : null,
      sampleFrameCount,
      virtualModeEnabled,
    });
    if (!canEmitCruiseCompletionTelemetry({
      isCompleted,
      runId,
      emittedRunId: emittedRunIdRef.current,
      summary,
    })) {
      return;
    }

    emittedRunIdRef.current = runId;
    window.dispatchEvent(new CustomEvent<CruiseTelemetryBridgeSummary>('simulation:trace-summary', { detail: summary }));
    const query = new URLSearchParams(window.location.search);
    void persistSceneTraceRun({
      traceSummary: summary,
      launchContext: {
        classId: query.get('classId') ?? undefined,
        courseId: query.get('courseId') ?? undefined,
        lessonId: query.get('lessonPlanId') ?? undefined,
        publicationId: query.get('publicationId') ?? undefined,
        registryId: query.get('registryId') ?? undefined,
        resourceId: query.get('resourceId') ?? undefined,
        sessionId: query.get('sessionId') ?? undefined,
      },
    }).then(({ simulationRunId }) => {
      const completionChannelId = query.get('completionChannelId');
      if (!completionChannelId || typeof BroadcastChannel === 'undefined') return;
      const channel = new BroadcastChannel(`simulation-run:${completionChannelId}`);
      channel.postMessage({
        type: 'simulation-run-persisted',
        sceneId: 'cruise',
        simulationRunId,
      });
      channel.close();
    }).catch((error) => {
      emittedRunIdRef.current = null;
      console.error('[Cruise Simulation] Failed to persist completed run:', error);
    });
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'simulation-trace-summary',
          source: 'simulation',
          payload: summary,
        },
        window.location.origin,
      );
    }
  }, [
    consistencyScore,
    hasRuntimeData,
    isCompleted,
    performance,
    runId,
    sampleFrameCount,
    startedAt,
    state,
    virtualModeEnabled,
  ]);

  return null;
}

// ============ 主仿真组件 ============

export default function CruiseSimulation() {
  const searchParams = useSearchParams();
  const isCourseMode = true;
  const isBoundCourseTask = searchParams.get('courseMode') === CRUISE_COURSE_MODE;
  const debriefAcceptanceId = searchParams.get(CRUISE_DEBRIEF_ACCEPTANCE_QUERY);
  const courseRole = searchParams.get('role') === 'student' ? 'student' : 'teacher';
  const courseStep = searchParams.get('step') || 'engineering-target';
  const isEmbedded = searchParams.get('embed') === '1';

  const engineRef = useRef<CruiseShipEngine | null>(null);
  const trajectoryRef = useRef<Vector2[]>([]);
  const lastTrajectoryTime = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const clockRef = useRef(
    new SimulationClock({
      dt: SIMULATION_FIXED_STEP_SECONDS,
      maxSubSteps: SIMULATION_MAX_SUB_STEPS,
    })
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const telemetryRunIdRef = useRef(createCruiseTraceRunId());
  const telemetryStartedAtRef = useRef(new Date().toISOString());

  const [cameraMode, setCameraMode] = useState<string>('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const [speedScale, setSpeedScale] = useState(1);
  const [virtualModeEnabled, setVirtualModeEnabled] = useState(true);
  const sceneTheme = useSimulationSceneTheme();

  const [state, setState] = useState<CruiseSimulationState>({
    isRunning: false,
    isPaused: false,
    isCompleted: false,
    time: 0,
    // 与引擎 initialize(-3000, 0, 0) 保持一致，避免点击“开始仿真”后视角瞬间拉远
    position: { x: -3000, z: 0 },
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: CRUISE_ADORA_PARAMS.CRUISE_SPEED,
    rollAngle: 0,
    targetHeading: 0,
    controlMode: 'pid',
    manualRudder: 0,
    seaState: 3,
    waveDirection: 90,
    finStabilizerEnabled: false,
    notchFilterEnabled: false,
    comfort: {
      msi: 0,
      rollRms: 0,
      rollPeak: 0,
      comfortRating: 'excellent',
      vdv: 0,
      frequencyWeightedAccel: 0,
    },
    finPower: 0,
    portFinAngle: 0,
    starboardFinAngle: 0,
    pidGains: { ...CRUISE_DEFAULT_PID },
    targetForm: { ...DEFAULT_TARGET_FORM },
    prompt: { ...DEFAULT_PROMPT },
    runDurationSec: CRUISE_EVALUATION_DURATION_SEC,
  });
  const [consistencyComment, setConsistencyComment] = useState('等待生成一致性评语。');
  const [consistencyCommentLoading, setConsistencyCommentLoading] = useState(false);
  const [structuredPromptFeedback, setStructuredPromptFeedback] = useState('在「AI伴学」标签下填写结构化提示词后，点击发送获取即时反馈。');
  const [targetFormTouched, setTargetFormTouched] = useState<Partial<Record<keyof CruiseTargetForm, boolean>>>(
    () => ({
      overshoot: !isCourseMode || courseRole === 'teacher',
      settlingTime: !isCourseMode || courseRole === 'teacher',
      steadyError: !isCourseMode || courseRole === 'teacher',
      maxLateralAccel: !isCourseMode || courseRole === 'teacher',
    })
  );
  const desiredRoutePoints = useMemo(() => buildCruiseDesiredRoute(), []);
  const turnStartTimeRef = useRef<number | null>(null);
  const maxHeadingAfterTurnRef = useRef(CRUISE_ROUTE_TURN_HEADING);
  const settleWindowStartRef = useRef<number | null>(null);
  const settlingTimeRef = useRef<number | null>(null);
  const maxLateralAccelRef = useRef(0);

  // 初始化引擎
  useEffect(() => {
    preloadVirtualSimulationRuntime().catch(console.error);

    const engine = createSimulationEngine(cruiseAdoraProfile) as CruiseShipEngine;
    engine.initialize(-3000, 0, 0);
    engineRef.current = engine;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 仿真循环
  const simulate = useCallback((timestamp: number) => {
    if (!engineRef.current || state.isPaused || !isVirtualSimulationRuntimeReady()) {
      lastTimeRef.current = timestamp;
      animationRef.current = requestAnimationFrame(simulate);
      return;
    }

    const frameDt = getSimulationDeltaFromMilliseconds(timestamp, lastTimeRef.current, speedScale);
    lastTimeRef.current = timestamp;

    const engine = engineRef.current;
    if (!engine) {
      animationRef.current = requestAnimationFrame(simulate);
      return;
    }

    let nextTime = state.time;
    let simState = engine.getState(nextTime);
    let comfort = engine.getComfortMetrics();
    let finMetrics = engine.getFinStabilizerMetrics();
    let internalState = engine.getInternalState();
    const runLimit = state.runDurationSec;

    clockRef.current.advance(frameDt, (dt) => {
      if (nextTime >= runLimit) {
        return;
      }
      const time = Math.min(nextTime + dt, runLimit);
      const stepDt = time - nextTime;
      if (stepDt <= 0) {
        return;
      }
      nextTime = time;

      engine.setSeaState(virtualModeEnabled ? state.seaState : 1, state.waveDirection);
      engine.setFinStabilizerEnabled(state.finStabilizerEnabled);
      engine.setNotchFilterEnabled(state.notchFilterEnabled);
      engine.setPIDGains(state.pidGains);

      const missionTargetHeading = getCruiseMissionTargetHeading(simState.position);
      engine.step(
        missionTargetHeading,
        null,
        state.controlMode,
        state.controlMode === 'manual' ? state.manualRudder : 0,
        state.speed,
        stepDt,
        time
      );

      simState = engine.getState(time);
      comfort = engine.getComfortMetrics();
      finMetrics = engine.getFinStabilizerMetrics();
      internalState = engine.getInternalState();

      const centripetalAccelG = Math.abs((simState.speed * toRadians(simState.yawRate)) / 9.81);
      const rollInducedAccelG = Math.abs(Math.sin(simState.waveRoll)) * 1.2;
      const lateralAccelG = centripetalAccelG + rollInducedAccelG;
      maxLateralAccelRef.current = Math.max(maxLateralAccelRef.current, lateralAccelG);
      if (missionTargetHeading >= CRUISE_ROUTE_TURN_HEADING - 0.1) {
        if (turnStartTimeRef.current === null) {
          turnStartTimeRef.current = time;
          maxHeadingAfterTurnRef.current = simState.heading;
          settleWindowStartRef.current = null;
          settlingTimeRef.current = null;
        }
        maxHeadingAfterTurnRef.current = Math.max(maxHeadingAfterTurnRef.current, simState.heading);
        const turnError = Math.abs(simState.heading - CRUISE_ROUTE_TURN_HEADING);
        if (turnError <= 2) {
          if (settleWindowStartRef.current === null) {
            settleWindowStartRef.current = time;
          } else if (time - settleWindowStartRef.current >= 8 && settlingTimeRef.current === null && turnStartTimeRef.current !== null) {
            settlingTimeRef.current = settleWindowStartRef.current - turnStartTimeRef.current;
          }
        } else {
          settleWindowStartRef.current = null;
        }
      }
    });

    if (simState && comfort && finMetrics && internalState) {
      if (nextTime - lastTrajectoryTime.current > 0.5) {
        trajectoryRef.current.push({ ...simState.position });
        if (trajectoryRef.current.length > 2000) {
          trajectoryRef.current.shift();
        }
        lastTrajectoryTime.current = nextTime;
      }

      setState((prev) => ({
        ...prev,
        time: nextTime,
        position: simState.position,
        heading: simState.heading,
        yawRate: simState.yawRate,
        rudder: simState.rudder,
        speed: simState.speed,
        rollAngle: simState.waveRoll,
        targetHeading: getCruiseMissionTargetHeading(simState.position),
        comfort,
        finPower: finMetrics.powerKW,
        portFinAngle: internalState.fin.portFinAngleDeg,
        starboardFinAngle: internalState.fin.starboardFinAngleDeg,
        isCompleted: nextTime >= prev.runDurationSec - 1e-6 ? true : prev.isCompleted,
        isRunning: nextTime >= prev.runDurationSec - 1e-6 ? false : prev.isRunning,
        isPaused: nextTime >= prev.runDurationSec - 1e-6 ? true : prev.isPaused,
      }));
    }

    if (nextTime >= runLimit - 1e-6) {
      return;
    }
    animationRef.current = requestAnimationFrame(simulate);
  }, [speedScale, state.isPaused, state.time, state.controlMode, state.manualRudder, state.speed, state.seaState, state.waveDirection, state.finStabilizerEnabled, state.notchFilterEnabled, state.pidGains, state.runDurationSec, virtualModeEnabled]);

  // 统一启动/暂停循环行为，保持与其他仿真一致
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(simulate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isRunning, state.isPaused, simulate]);

  // 启动仿真
  const handleStart = useCallback(() => {
    if (state.isRunning) return;
    if (state.time <= 0) {
      telemetryRunIdRef.current = createCruiseTraceRunId();
      telemetryStartedAtRef.current = new Date().toISOString();
    }
    clockRef.current.reset();
    setState((prev) => ({ ...prev, isRunning: true, isPaused: false, isCompleted: false }));
  }, [state.isRunning, state.time]);

  // 暂停/继续
  const handlePause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  // 重置
  const handleReset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    engineRef.current?.initialize(-3000, 0, 0);
    trajectoryRef.current = [];
    lastTrajectoryTime.current = 0;
    lastTimeRef.current = 0;
    turnStartTimeRef.current = null;
    maxHeadingAfterTurnRef.current = CRUISE_ROUTE_TURN_HEADING;
    settleWindowStartRef.current = null;
    settlingTimeRef.current = null;
    maxLateralAccelRef.current = 0;
    telemetryRunIdRef.current = createCruiseTraceRunId();
    telemetryStartedAtRef.current = new Date().toISOString();
    clockRef.current.reset();
    setState({
      isRunning: false,
      isPaused: false,
      isCompleted: false,
      time: 0,
      position: { x: -3000, z: 0 },
      heading: 0,
      yawRate: 0,
      rudder: 0,
      speed: CRUISE_ADORA_PARAMS.CRUISE_SPEED,
      rollAngle: 0,
      targetHeading: 0,
      controlMode: 'pid',
      manualRudder: 0,
      seaState: 3,
      waveDirection: 90,
      finStabilizerEnabled: false,
      notchFilterEnabled: false,
      comfort: {
        msi: 0,
        rollRms: 0,
        rollPeak: 0,
        comfortRating: 'excellent',
        vdv: 0,
        frequencyWeightedAccel: 0,
      },
      finPower: 0,
      portFinAngle: 0,
      starboardFinAngle: 0,
      pidGains: { ...CRUISE_DEFAULT_PID },
      targetForm: { ...DEFAULT_TARGET_FORM },
      prompt: { ...DEFAULT_PROMPT },
      runDurationSec: CRUISE_EVALUATION_DURATION_SEC,
    });
    setConsistencyComment('等待生成一致性评语。');
    setConsistencyCommentLoading(false);
    setStructuredPromptFeedback('在「AI伴学」标签下填写结构化提示词后，点击发送获取即时反馈。');
    setTargetFormTouched({
      overshoot: !isCourseMode || courseRole === 'teacher',
      settlingTime: !isCourseMode || courseRole === 'teacher',
      steadyError: !isCourseMode || courseRole === 'teacher',
      maxLateralAccel: !isCourseMode || courseRole === 'teacher',
    });
    setResetCount((previous) => previous + 1);
  }, [courseRole, isCourseMode]);

  // 处理器
  const handleControlModeChange = useCallback((mode: ControlMode) => {
    const nextMode = toCruiseControllerMode(mode);
    setState((prev) => ({
      ...prev,
      controlMode: mode,
      pidGains: normalizeControllerByMode(prev.pidGains, nextMode),
    }));
  }, []);

  const handleManualRudderChange = useCallback((value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    setState((prev) => ({
      ...prev,
      manualRudder: Math.max(
        -CRUISE_ADORA_PARAMS.MAX_RUDDER_ANGLE,
        Math.min(CRUISE_ADORA_PARAMS.MAX_RUDDER_ANGLE, Number(value.toFixed(1)))
      ),
    }));
  }, []);

  const handleSeaStateChange = useCallback((level: number) => {
    setState((prev) => ({ ...prev, seaState: level }));
  }, []);

  const handleWaveDirectionChange = useCallback((direction: number) => {
    setState((prev) => ({ ...prev, waveDirection: direction }));
  }, []);

  const handleFinStabilizerToggle = useCallback(() => {
    setState((prev) => ({ ...prev, finStabilizerEnabled: !prev.finStabilizerEnabled }));
  }, []);

  const handleNotchFilterToggle = useCallback(() => {
    setState((prev) => ({ ...prev, notchFilterEnabled: !prev.notchFilterEnabled }));
  }, []);

  const handlePidGainsChange = useCallback((key: keyof CruiseControllerParams, value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    setState((prev) => ({
      ...prev,
      pidGains: normalizeControllerByMode(
        {
          ...prev.pidGains,
          [key]: Math.max(0, Number(value.toFixed(3))),
        },
        toCruiseControllerMode(prev.controlMode)
      ),
    }));
  }, []);

  const handleTargetFormChange = useCallback((key: keyof CruiseTargetForm, value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    setState((prev) => ({
      ...prev,
      targetForm: {
        ...prev.targetForm,
        [key]: Number(value.toFixed(3)),
      },
    }));
  }, []);

  const handleTargetFormTouch = useCallback((key: keyof CruiseTargetForm, touched: boolean) => {
    setTargetFormTouched((prev) => ({
      ...prev,
      [key]: touched,
    }));
  }, []);

  const handlePromptChange = useCallback((key: keyof CruiseSimulationState['prompt'], value: string) => {
    setState((prev) => ({
      ...prev,
      prompt: {
        ...prev.prompt,
        [key]: value,
      },
    }));
  }, []);

  const applyPromptToController = useCallback(() => {
    setState((prev) => {
      const nextKp = Math.max(0.2, Number((prev.targetForm.overshoot / 4.5).toFixed(2)));
      const nextKi = Math.max(0.1, Number((prev.targetForm.settlingTime / 18).toFixed(2)));
      const nextKd = Math.max(0.1, Number((1 / Math.max(prev.targetForm.maxLateralAccel, 0.08) / 15).toFixed(2)));
      return {
        ...prev,
        pidGains: normalizeControllerByMode(
          {
            kp: nextKp,
            ki: nextKi,
            kd: nextKd,
          },
          toCruiseControllerMode(prev.controlMode)
        ),
      };
    });
    const systemPrompt = [
      '你是船舶控制系统辅导助手，请按“对象-目标-约束-策略”评估输入。',
      `对象: ${state.prompt.controlObject}`,
      `目标: ${state.prompt.performanceGoal}`,
      `约束: ${state.prompt.constraints}`,
      `策略: ${state.prompt.strategy}`,
    ].join('\n');
    const missingBlocks = Object.values(state.prompt).filter((item) => item.trim().length === 0).length;
    const quality = missingBlocks === 0 ? '结构完整，已发送并可用于下一轮 AI 介入分析。' : `仍有 ${missingBlocks} 个分段为空，建议补全后再次发送。`;
    setStructuredPromptFeedback(`AI即时反馈：${quality}\n系统级提示词已组装：\n${systemPrompt}`);
  }, [state.prompt]);

  const runtimePerformance = useMemo<RuntimeConsistencyPerformance | null>(() => {
    if (turnStartTimeRef.current === null) {
      return null;
    }
    const overshoot = Math.max(
      0,
      ((maxHeadingAfterTurnRef.current - CRUISE_ROUTE_TURN_HEADING) / Math.max(CRUISE_ROUTE_TURN_HEADING, 1)) * 100
    );
    const settled = settlingTimeRef.current !== null;
    const settlingTime = settled ? settlingTimeRef.current! : Math.max(180, state.time - turnStartTimeRef.current);
    return {
      overshoot: Number(overshoot.toFixed(1)),
      settlingTime: Number(settlingTime.toFixed(1)),
      accel: Number(maxLateralAccelRef.current.toFixed(3)),
      settled,
    };
  }, [state.time]);

  const hasRuntimeData = runtimePerformance !== null && state.isCompleted;
  const runtimeHint = hasRuntimeData
    ? '单次仿真已结束，评估参数已锁定，可执行一致性校验。'
    : state.isCompleted
      ? '仿真已结束，但尚未进入转向工况，请重置后重新进行一次完整试验。'
      : `尚未达到单次校验结束条件，请运行至 ${state.runDurationSec}s 后再校验。`;

  const consistencyScore = useMemo(() => {
    if (!runtimePerformance) {
      return null;
    }
    return computeConsistencyScore(state.targetForm, runtimePerformance);
  }, [runtimePerformance, state.targetForm]);

  const debrief = useMemo(() => {
    const liveSummary = hasRuntimeData && hasFiniteRequiredCruisePerformance(runtimePerformance)
      ? buildCruiseTelemetryBridgeSummary({
        runId: telemetryRunIdRef.current,
        startedAt: telemetryStartedAtRef.current,
        completedAt: new Date().toISOString(),
        seed: `${telemetryRunIdRef.current}:${telemetryStartedAtRef.current}`,
        state: {
          time: state.time,
          heading: state.heading,
          targetHeading: state.targetHeading,
          yawRate: state.yawRate,
          rudder: state.rudder,
          speed: state.speed,
          rollAngle: state.rollAngle,
          seaState: state.seaState,
          waveDirection: state.waveDirection,
          finStabilizerEnabled: state.finStabilizerEnabled,
          notchFilterEnabled: state.notchFilterEnabled,
          comfort: state.comfort,
          finPower: state.finPower,
          controlMode: state.controlMode,
          pidGains: state.pidGains,
          targetForm: state.targetForm,
        },
        performance: runtimePerformance,
        consistencyScore: consistencyScore ? { score: consistencyScore.score } : null,
        sampleFrameCount: trajectoryRef.current.length,
        virtualModeEnabled,
      })
      : null;
    return projectCruiseControlEffectDebrief(buildCruiseDebriefProjectionInput({
      currentRunId: telemetryRunIdRef.current,
      isCompleted: state.isCompleted,
      isPaused: state.isPaused,
      liveSummary,
      isBoundCourseTask,
      acceptanceFixtureId: debriefAcceptanceId,
    }));
  }, [
    consistencyScore,
    debriefAcceptanceId,
    hasRuntimeData,
    isBoundCourseTask,
    runtimePerformance,
    state.comfort,
    state.controlMode,
    state.finPower,
    state.finStabilizerEnabled,
    state.heading,
    state.isCompleted,
    state.isPaused,
    state.notchFilterEnabled,
    state.pidGains,
    state.rollAngle,
    state.rudder,
    state.seaState,
    state.speed,
    state.targetForm,
    state.targetHeading,
    state.time,
    state.waveDirection,
    state.yawRate,
    virtualModeEnabled,
  ]);

  const syntheticPerformance = useMemo(() => computePerformanceFromController(state.pidGains), [state.pidGains]);

  const generateConsistencyComment = useCallback(async () => {
    if (!isCourseMode) {
      return;
    }
    if (!runtimePerformance || !consistencyScore) {
      setConsistencyComment('请先运行仿真并完成转向，再生成一致性评价。');
      return;
    }
    setConsistencyCommentLoading(true);
    try {
      const response = await fetch('/api/simulation/cruise-consistency-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...consistencyScore,
          target: state.targetForm,
          result: runtimePerformance,
        }),
      });
      const data = (await response.json()) as { text?: string };
      setConsistencyComment(data.text || '一致性评语生成失败，请重试。');
    } catch {
      setConsistencyComment('一致性评语生成失败，请重试。');
    } finally {
      setConsistencyCommentLoading(false);
    }
  }, [consistencyScore, isCourseMode, runtimePerformance, state.targetForm]);

  useEffect(() => {
    if (!isCourseMode || !hasRuntimeData || state.isRunning || !state.isCompleted) {
      return;
    }
    const timer = window.setTimeout(() => {
      void generateConsistencyComment();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [generateConsistencyComment, hasRuntimeData, isCourseMode, state.isRunning, state.isCompleted]);

  useEffect(() => {
    if (!isCourseMode) {
      return;
    }
    const controllerMode = toCruiseControllerMode(state.controlMode);
    const message = {
      type: 'cruise-course-sync' as const,
      source: 'simulation' as const,
      payload: {
        controlMode: controllerMode,
        controller: state.pidGains,
        targetForm: state.targetForm,
        openLoop: buildOpenLoopFromController(state.pidGains, controllerMode),
        metrics: {
          timeDomain: runtimePerformance ?? syntheticPerformance,
          lateralAccelG: runtimePerformance?.accel ?? syntheticPerformance.accel,
          comfortMsi: Number(state.comfort.msi.toFixed(1)),
          settlingReady: runtimePerformance?.settled ?? false,
        },
      },
    };
    window.parent.postMessage(message, window.location.origin);
  }, [isCourseMode, runtimePerformance, state.comfort.msi, state.controlMode, state.pidGains, state.targetForm, syntheticPerformance]);

  useEffect(() => {
    if (!isCourseMode) {
      return;
    }
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as {
        type?: string;
        source?: 'simulation' | 'linkage';
        payload?: {
          controller?: CruiseControllerParams;
          controlMode?: CruiseControllerMode;
        };
      };
      if (data?.type !== 'cruise-course-sync' || data.source !== 'linkage' || !data.payload?.controller) {
        return;
      }
      const controller = data.payload.controller;
      const controlMode = data.payload.controlMode ?? toCruiseControllerMode(state.controlMode);
      const modeToState: ControlMode = controlMode === 'p' ? 'p' : controlMode === 'pd' ? 'pd' : 'pid';
      setState((prev) => {
        const normalized = normalizeControllerByMode(controller, controlMode);
        if (
          Math.abs(prev.pidGains.kp - normalized.kp) < 1e-3
          && Math.abs(prev.pidGains.ki - normalized.ki) < 1e-3
          && Math.abs(prev.pidGains.kd - normalized.kd) < 1e-3
          && prev.controlMode === modeToState
        ) {
          return prev;
        }
        return {
          ...prev,
          controlMode: modeToState,
          pidGains: {
            kp: Math.max(0, Number(normalized.kp.toFixed(3))),
            ki: Math.max(0, Number(normalized.ki.toFixed(3))),
            kd: Math.max(0, Number(normalized.kd.toFixed(3))),
          },
        };
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isCourseMode, state.controlMode]);

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <SceneShell>
      <SceneQualityAttributes />
      <TelemetryBridge
        state={state}
        performance={runtimePerformance}
        consistencyScore={consistencyScore}
        hasRuntimeData={hasRuntimeData}
        isCompleted={state.isCompleted}
        runId={telemetryRunIdRef.current}
        startedAt={telemetryStartedAtRef.current}
        sampleFrameCount={trajectoryRef.current.length}
        virtualModeEnabled={virtualModeEnabled}
      />
      <VisualizationLayer
        state={state}
        virtualModeEnabled={virtualModeEnabled}
        showGrid={showGrid}
        sceneTheme={sceneTheme}
        desiredRoutePoints={desiredRoutePoints}
        trajectoryPoints={trajectoryRef.current}
        cameraMode={cameraMode}
        controlsRef={controlsRef}
        onRequestFreeMode={() => setCameraMode('free')}
        resetToken={resetCount}
          resetSignal={viewResetCount}
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

      <SimulationDock
        side="left"
        title="状态监控"
        tabs={[
          { id: 'status', label: '总览', content: <HUD state={state} /> },
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
              <ControllerPanel
                state={state}
                isCourseMode={isCourseMode}
                virtualModeEnabled={virtualModeEnabled}
                onPidGainsChange={handlePidGainsChange}
                onControlModeChange={handleControlModeChange}
                onManualRudderChange={handleManualRudderChange}
                onSeaStateChange={handleSeaStateChange}
                onWaveDirectionChange={handleWaveDirectionChange}
                onVirtualModeToggle={() => setVirtualModeEnabled((prev) => !prev)}
                onFinStabilizerToggle={handleFinStabilizerToggle}
                onNotchFilterToggle={handleNotchFilterToggle}
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
              <CruiseTradeoffPanel
                state={state}
                isCourseMode={isCourseMode}
                courseRole={courseRole}
                targetFormTouched={targetFormTouched}
                performance={runtimePerformance}
                consistencyScore={consistencyScore}
                consistencyComment={consistencyComment}
                consistencyLoading={consistencyCommentLoading}
                hasRuntimeData={hasRuntimeData}
                runtimeHint={runtimeHint}
                debrief={debrief}
                onTargetFormTouch={handleTargetFormTouch}
                onTargetFormChange={handleTargetFormChange}
                onGenerateConsistencyComment={() => void generateConsistencyComment()}
              />
            ),
          },
          {
            id: 'ai',
            label: 'AI伴学',
            content: (
              <CruiseAIPanel
                state={state}
                isCourseMode={isCourseMode}
                feedback={structuredPromptFeedback}
                onPromptChange={handlePromptChange}
                onApplyPrompt={applyPromptToController}
              />
            ),
          },
        ]}
      />

      {!isEmbedded ? (
        <SimulationTopBar
          title={isCourseMode ? '柔性之海：豪华邮轮舒适度控制' : '爱达·魔都号豪华邮轮'}
          subtitle={isCourseMode ? `课程模式 · 当前环节 ${courseStep}` : '舒适度控制 · 减摇鳍 · 陷波滤波'}
          badge={isCourseMode ? `Cruise / ${courseRole}` : 'Cruise / OBE'}
        />
      ) : null}

      {/* 说明 */}
      <div className={`${simulationUi.panel} absolute bottom-4 left-4 p-2 text-xs`}>
        <div>拖拽旋转视角 | 滚轮缩放 | 右键平移</div>
        <div className="mt-1">
          浅蓝箭头：期望航线 | 深蓝箭头与轨迹：实际航向与航迹
        </div>
        <div className="mt-1 text-platform-fg-secondary">
          知识点: 频率响应 (Ch5), 陷波滤波器 (Ch6)
        </div>
      </div>
    </SceneShell>
    </SceneQualityProvider>
    </TeachingAnnotationsProvider>
    </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}
