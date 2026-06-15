'use client';

/**
 * 海洋石油981深水钻井平台动力定位仿真
 * 使用 3DOF 耦合模型 + 解耦控制 + 8台推进器推力分配
 */

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
import { MaritimeEnvironment } from '../environment/maritime-environment';
import { SimulationClock } from '@/lib/simulation';
import {
  UnifiedCameraController,
  RightClickFreeModeBridge,
  type CameraMode,
} from '../components/camera-controller';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, SimulationDock, SimulationAssessmentPanel, simulationUi } from '../components/simulation-ui';
import { useSimulationSceneTheme, simulationScenePalette, type SimulationSceneTheme } from '../components/simulation-theme';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  AlertTriangle,
  Anchor,
  Waves,
  Wind,
  ToggleLeft,
  ToggleRight,
  Gauge,
  Target,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

import {
  drillingHYSY981Profile,
  getDrillingDefaultConfig,
} from '../profiles/drilling-hysy981';
import { HYSY981_PLATFORM_PARAMS } from '../core/constants';
import {
  createSemiSub3DOFState,
  semiSub3DOFStep,
  createCurrentEnvironment,
  createWindEnvironment,
  updateCurrentEnvironment,
  updateWindEnvironment,
  computeTotalEnvironmentalForces,
  getTypicalEnvironment,
  allocateThrust,
  createThrusterConfigs,
  computeTotalPower,
  simulateThrusterFailure,
  dpDecoupledControl,
  dpStandardControl,
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

/** 海面组件 */
function Ocean({ sceneTheme }: { sceneTheme: SimulationSceneTheme }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
      <planeGeometry args={[6000, 6000, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={waterVertexShader}
        fragmentShader={waterFragmentShader}
        uniforms={{
          time: { value: 0 },
        }}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** 钻井平台模型 */
function DrillingPlatformModel({
  position,
  heading,
}: {
  position: Vector2;
  heading: number;
}) {
  const { scene } = useGLTF('/assets/drilling-rig.glb');
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
      }
    });

    // 计算缩放 - 目标长度约 114m (HYSY981 实际长度)
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = 114;
    const scale = targetLength / maxDim;

    return { model: cloned, scale, modelHeight: size.y * scale };
  }, [scene]);

  useFrame(() => {
    if (groupRef.current) {
      // 平台模型的可见“吃水”应仅占总高度的一小部分，避免整体沉入水面
      const visualDraft = Math.min(
        HYSY981_PLATFORM_PARAMS.DRAFT_OPERATING,
        modelHeight * 0.22
      );
      groupRef.current.position.x = position.x;
      groupRef.current.position.y = modelHeight * 0.5 - visualDraft;
      groupRef.current.position.z = position.z;
      groupRef.current.rotation.y = -heading + Math.PI / 2;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={scale} />
      {/* 平台中心指示器 */}
      <mesh position={[0, modelHeight * 0.8, 0]}>
        <sphereGeometry args={[4, 16, 16]} />
        <meshBasicMaterial color={simulationScenePalette.danger} />
      </mesh>
    </group>
  );
}

// 预加载模型
useGLTF.preload('/assets/drilling-rig.glb');

/** 目标位置标记 */
function TargetMarker({ position, heading }: { position: Vector2; heading: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 2) * 2 + 5;
    }
  });

  return (
    <group ref={groupRef} position={[position.x, 5, position.z]}>
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
function TrajectoryLine({ points }: { points: Vector2[] }) {
  const linePoints = useMemo(() => {
    return points.map((p) => [p.x, 1, p.z] as [number, number, number]);
  }, [points]);

  if (linePoints.length < 2) return null;

  return (
    <Line
      points={linePoints}
      color={simulationScenePalette.danger}
      lineWidth={2}
      dashed={false}
    />
  );
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

  return (
    <Card className={`${simulationUi.panel} w-48`}>
      <CardHeader className="py-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gauge className="h-4 w-4" />
          推进器状态
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="grid grid-cols-3 gap-1">
          {layout.map(({ id, row, col }) => {
            const thruster = thrusters.find(t => t.id === id);
            if (!thruster) return null;

            const powerPercent = (thruster.power / 4500) * 100;
            const isFailed = thruster.failed;

            return (
              <div
                key={id}
                className={`
                  flex flex-col items-center justify-center rounded p-1 text-xs
                  ${row === 1 || row === 2 ? 'col-start-1' : ''}
                  ${col === 2 ? 'col-start-3' : ''}
                  ${isFailed ? 'bg-[hsl(var(--platform-brand-danger)/0.12)] text-[hsl(var(--platform-brand-danger))]' : powerPercent > 80 ? 'bg-[hsl(var(--platform-brand-evidence)/0.14)] text-[hsl(var(--platform-brand-evidence))]' : 'bg-platform-canvas-muted text-platform-fg-primary'}
                `}
                style={{
                  gridRow: row + 1,
                  gridColumn: col + 1,
                }}
              >
                <span className="font-bold">T{id}</span>
                <span className={isFailed ? 'text-[hsl(var(--platform-brand-danger))]' : ''}>
                  {isFailed ? 'FAIL' : `${powerPercent.toFixed(0)}%`}
                </span>
              </div>
            );
          })}
          {/* 中心平台指示 */}
          <div
            className="flex items-center justify-center rounded bg-platform-canvas-muted text-xs text-platform-fg-secondary"
            style={{ gridRow: '2 / 4', gridColumn: 2 }}
          >
            ▣
          </div>
        </div>
        <div className="mt-2 text-center text-xs text-platform-fg-secondary">
          前 (Fore) ↑
        </div>
      </CardContent>
    </Card>
  );
}

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
        <Badge variant={decouplingEnabled ? 'default' : 'outline'}>
          {decouplingEnabled ? '解耦控制' : '标准PID'}
        </Badge>
      </div>

      {/* DP 状态 */}
      <Card className={`w-64 ${simulationUi.panel} ${
        alertLevel === 'emergency' ? 'border-[hsl(var(--platform-brand-danger)/0.45)] bg-[hsl(var(--platform-brand-danger)/0.12)]' :
        alertLevel === 'red' ? 'border-[hsl(var(--platform-brand-danger)/0.35)] bg-[hsl(var(--platform-brand-danger)/0.12)]' :
        alertLevel === 'yellow' ? 'border-[hsl(var(--platform-brand-evidence)/0.42)] bg-[hsl(var(--platform-brand-evidence)/0.14)]' :
        'border-platform-border bg-platform-surface-overlay/86'
      }`}>
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4" />
            DP 定位状态
            {alertLevel === 'emergency' && (
              <Badge variant="destructive" className="ml-auto animate-pulse">
                紧急解脱
              </Badge>
            )}
            {alertLevel === 'red' && (
              <Badge variant="destructive" className="ml-auto">
                红色警报
              </Badge>
            )}
            {alertLevel === 'yellow' && (
              <Badge className="ml-auto bg-[hsl(var(--platform-brand-evidence))]">
                黄色警报
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 py-2 text-xs">
          <div className="flex justify-between">
            <span>位置误差:</span>
            <span className={
              alertLevel === 'green' ? 'text-[hsl(var(--platform-brand-success))]' :
              alertLevel === 'yellow' ? 'text-[hsl(var(--platform-brand-evidence))]' :
              'text-[hsl(var(--platform-brand-danger))]'
            }>
              {metrics.positionError.toFixed(2)} m
            </span>
          </div>
          <div className="flex justify-between">
            <span>航向误差:</span>
            <span className={metrics.headingError > 10 ? 'text-[hsl(var(--platform-brand-evidence))]' : 'text-[hsl(var(--platform-brand-success))]'}>
              {metrics.headingError.toFixed(1)}°
            </span>
          </div>
          <div className="flex justify-between">
            <span>总功率:</span>
            <span className={metrics.totalPower > 28000 ? 'text-[hsl(var(--platform-brand-evidence))]' : ''}>
              {(metrics.totalPower / 1000).toFixed(1)} MW
            </span>
          </div>
          {/* 位置误差进度条 */}
          <div className="mt-2">
            <div className="h-2 w-full rounded bg-platform-canvas-muted">
              <div
                className={`h-full rounded transition-all ${
                  alertLevel === 'green' ? 'bg-[hsl(var(--platform-brand-success))]' :
                  alertLevel === 'yellow' ? 'bg-[hsl(var(--platform-brand-evidence))]' :
                  'bg-[hsl(var(--platform-brand-danger))]'
                }`}
                style={{
                  width: `${Math.min(100, (metrics.positionError / DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT) * 100)}%`
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-platform-fg-secondary">
              <span>0m</span>
              <span>{DRILLING_ETHICAL_THRESHOLDS.YELLOW_ALERT_POSITION}m</span>
              <span>{DRILLING_ETHICAL_THRESHOLDS.RED_ALERT_POSITION}m</span>
              <span>{DRILLING_ETHICAL_THRESHOLDS.EMERGENCY_DISCONNECT}m</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 推进器面板 */}
      <ThrusterPanel thrusters={thrusters} />

      {/* 违规警告 */}
      {violations.length > 0 && (
        <Card className={`w-64 border-[hsl(var(--platform-brand-danger)/0.35)] bg-[hsl(var(--platform-brand-danger)/0.12)] ${simulationUi.panel}`}>
          <CardHeader className="py-2">
            <CardTitle className="flex items-center gap-2 text-sm text-[hsl(var(--platform-brand-danger))]">
              <AlertTriangle className="h-4 w-4" />
              伦理违规 ({violations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 max-h-32 overflow-y-auto">
            {violations.slice(-5).map((v, i) => (
              <div key={i} className="py-0.5 text-xs text-[hsl(var(--platform-brand-danger))]">
                [{v.timestamp.toFixed(1)}s] {v.description}
              </div>
            ))}
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
}: {
  config: SimulationConfig;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  isRunning: boolean;
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
          <Button
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

        {/* 解耦控制开关 */}
        <div className="flex items-center justify-between rounded bg-platform-canvas-muted p-2">
          <Label className="flex items-center gap-2 text-sm">
            {config.decouplingEnabled ? (
              <ToggleRight className="h-4 w-4 text-[hsl(var(--platform-brand-success))]" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-platform-fg-muted" />
            )}
            解耦控制
          </Label>
          <Switch
            checked={config.decouplingEnabled}
            onCheckedChange={(checked) => onConfigChange({ decouplingEnabled: checked })}
          />
        </div>

        <Tabs defaultValue="target">
          <TabsList className={`grid w-full grid-cols-2 ${simulationUi.tabsList}`}>
            <TabsTrigger value="target" className={simulationUi.tabsTrigger}>目标</TabsTrigger>
            <TabsTrigger value="environment" className={simulationUi.tabsTrigger}>环境</TabsTrigger>
          </TabsList>

          <TabsContent value="target" className="space-y-3">
            {/* 目标位置 */}
            <div className="space-y-2">
              <Label className="text-xs">目标 X (m)</Label>
              <Slider
                className={simulationUi.slider}
                value={[config.targetPosition.x]}
                min={-100}
                max={100}
                step={1}
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
                className={simulationUi.slider}
                value={[config.targetPosition.z]}
                min={-100}
                max={100}
                step={1}
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

          <TabsContent value="environment" className="space-y-3">
            {/* 海况等级 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs">
                <Waves className="h-3 w-3" />
                海况等级
              </Label>
              <Slider
                className={simulationUi.slider}
                value={[config.seaStateLevel]}
                min={1}
                max={6}
                step={1}
                onValueChange={([v]) => onConfigChange({ seaStateLevel: v })}
              />
              <div className="flex justify-between text-xs text-platform-fg-muted">
                <span>等级 {config.seaStateLevel}</span>
                <span>
                  {config.seaStateLevel <= 2 ? '平静' :
                   config.seaStateLevel <= 4 ? '中等' : '恶劣'}
                </span>
              </div>
            </div>

            {/* 海况信息 */}
            <div className="rounded bg-platform-canvas-muted p-2 text-xs">
              {(() => {
                const env = getTypicalEnvironment(config.seaStateLevel);
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <Waves className="h-3 w-3" />
                        有效波高:
                      </span>
                      <span>{env.waveHeight.toFixed(1)} m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <Wind className="h-3 w-3" />
                        风速:
                      </span>
                      <span>{env.windSpeed} m/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>流速:</span>
                      <span>{env.currentSpeed.toFixed(1)} m/s</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ============ 主组件 ============

export function DrillingSimulation() {
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
  const waveHeightRef = useRef(1.5);
  const timeRef = useRef(0);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef(performance.now());
  const clockRef = useRef(
    new SimulationClock({
      dt: SIMULATION_FIXED_STEP_SECONDS,
      maxSubSteps: SIMULATION_MAX_SUB_STEPS,
    })
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(1);
  const sceneTheme = useSimulationSceneTheme();

  // 船舶配置
  const profile = drillingHYSY981Profile;

  useEffect(() => {
    preloadVirtualSimulationRuntime().catch(console.error);
  }, []);

  // 更新海况
  useEffect(() => {
    const env = getTypicalEnvironment(config.seaStateLevel);
    currentEnvRef.current = createCurrentEnvironment(env.currentSpeed, 45, 0.1);
    windEnvRef.current = createWindEnvironment(env.windSpeed, 45, 1.2);
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
      timeRef.current += dt;

      // 更新环境
      currentEnvRef.current = updateCurrentEnvironment(currentEnvRef.current, dt);
      windEnvRef.current = updateWindEnvironment(windEnvRef.current, dt, windEnvRef.current.speed);

      // 计算环境力
      const envForces = computeTotalEnvironmentalForces(
        currentEnvRef.current,
        windEnvRef.current,
        waveHeightRef.current,
        0,
        platformStateRef.current.psi
      );

      // 更新平台状态中的环境力
      platformStateRef.current.currentForceX = envForces.forceX;
      platformStateRef.current.currentForceY = envForces.forceY;
      platformStateRef.current.currentMomentN = envForces.momentN;

      // 设置目标
      platformStateRef.current.targetX = config.targetPosition.x;
      platformStateRef.current.targetY = config.targetPosition.z;
      platformStateRef.current.targetPsi = toRadians(config.targetHeading);
      platformStateRef.current.decouplingEnabled = config.decouplingEnabled;

      // DP 控制计算
      dpConfigRef.current.decouplingEnabled = config.decouplingEnabled;

      const controlFunc = config.decouplingEnabled ? dpDecoupledControl : dpStandardControl;
      const [controlOutput, newDPState] = controlFunc(
        platformStateRef.current,
        dpStateRef.current,
        dpConfigRef.current,
        dt
      );
      dpStateRef.current = newDPState;

      // 推力分配
      const thrusterConfigs = createThrusterConfigs();

      const tauCmd: [number, number, number] = [
        controlOutput.decoupledTauX,
        controlOutput.decoupledTauY,
        controlOutput.decoupledTauN,
      ];

      const allocationResult = allocateThrust(
        tauCmd,
        platformStateRef.current.thrusters,
        thrusterConfigs,
        dt
      );

      platformStateRef.current.thrusters = allocationResult.thrusters;

      // 计算实际推力作用于平台的力 (kN -> N)
      const thrusterForce: [number, number, number] = [
        allocationResult.totalForceX * 1000,
        allocationResult.totalForceY * 1000,
        allocationResult.totalMomentN * 1000,
      ];

      // 环境力转为元组格式
      const envForceTuple: [number, number, number] = [
        envForces.forceX,
        envForces.forceY,
        envForces.momentN,
      ];

      // 平台动力学步进
      platformStateRef.current = semiSub3DOFStep(
        platformStateRef.current,
        thrusterForce,
        envForceTuple,
        dt
      );

      // 计算误差
      const posError = Math.sqrt(
        controlOutput.errorX ** 2 + controlOutput.errorY ** 2
      );
      const headError = Math.abs(controlOutput.errorPsi);
      const totalPower = computeTotalPower(platformStateRef.current.thrusters);

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
  }, [isRunning, config, speedScale]);

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
    setIsRunning(false);
    platformStateRef.current = createSemiSub3DOFState(0, 0, 0);
    dpStateRef.current = createDPDecouplingState();
    timeRef.current = 0;
    lastUpdateRef.current = performance.now();
    clockRef.current.reset();
    setTrajectory([]);
    setViolations([]);
    setThrusters([...platformStateRef.current.thrusters]);
    setMetrics({
      positionError: 0,
      headingError: 0,
      totalPower: 0,
      time: 0,
    });
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
    <div className={simulationUi.root} data-sim-ui>
      {/* 3D 场景 */}
      <Canvas shadows={{ type: THREE.PCFShadowMap }}>
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

        {/* 环境 */}
        <ambientLight intensity={sceneTheme.ambientLightIntensity} />
        <directionalLight position={[200, 300, 200]} intensity={sceneTheme.directionalLightIntensity} castShadow />

        {/* 天空+云层+海面 */}
        <MaritimeEnvironment shipPosition={platformPosition} seaState={3} sceneTheme={sceneTheme} />

        {/* 网格 */}
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
          />
        ) : null}

        {/* 目标标记 */}
        <TargetMarker position={config.targetPosition} heading={config.targetHeading} />

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
          />
        </Suspense>

        {/* 航迹 */}
        {trajectory.length > 1 && <TrajectoryLine points={trajectory} />}

        {/* 统一相机控制器 */}
        <UnifiedCameraController
          position={platformPosition}
          headingRad={platformHeading}
          cameraMode={cameraMode}
          controlsRef={controlsRef}
        />
      </Canvas>

      <CameraViewSwitcher
        currentMode={cameraMode}
        onModeChange={setCameraMode}
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
          {
            id: 'status',
            label: '总览',
            content: (
              <HUD
                metrics={metrics}
                violations={violations}
                isRunning={isRunning}
                thrusters={thrusters}
                decouplingEnabled={config.decouplingEnabled}
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
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleReset}
                isRunning={isRunning}
              />
            ),
          },
          {
            id: 'evaluate',
            label: '评估',
            content: (
              <SimulationAssessmentPanel
                title="DP定位评估"
                metrics={[
                  { id: 'position', label: '位置误差', value: metrics.positionError, max: 12, better: 'lower', unit: 'm' },
                  { id: 'heading', label: '航向误差', value: metrics.headingError, max: 45, better: 'lower', unit: '°' },
                  { id: 'power', label: '总功率', value: metrics.totalPower / 1000, max: 40, better: 'lower', unit: 'MW' },
                ]}
              />
            ),
          },
        ]}
      />

      <SimulationTopBar
        title="海洋石油981 深水钻井平台"
        subtitle="DP 解耦控制 · 推力分配 · 风浪流扰动"
        badge="Drilling / OBE"
      />

    </div>
  );
}

export default DrillingSimulation;
