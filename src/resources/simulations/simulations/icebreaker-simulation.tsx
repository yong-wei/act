'use client';

/**
 * 雪龙2号极地科考破冰船仿真
 * 使用 Azipod 3-DOF 模型和冰阻力 Stick-Slip 模型
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
import { SkyDome, ProceduralClouds } from '../environment';
import {
  UnifiedCameraController,
  CameraViewSwitcher,
  type CameraMode,
} from '../components';
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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  type Azipod3DOFInternalState,
  type Azipod3DOFParams,
} from '../physics/models/azipod-3dof';
import {
  createIceBreakingState,
  iceBreakingStep,
  getIceBreakingSummary,
  getIceZoneSafetyLevel,
  DEFAULT_ICE_BREAKING_PARAMS,
  type IceBreakingState,
} from '../physics/disturbances/ice-breaking-model';
import {
  createAzipodCourseKeeperState,
  azipodCourseKeeperControl,
  azipodCourseKeeperControlIceMode,
  getAzipodControllerDiagnostics,
  DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
  type AzipodCourseKeeperState,
} from '../physics/controllers/azipod-course-keeper';
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

// ============ 着色器材质 ============

const iceWaterVertexShader = `
  uniform float time;
  uniform float iceMode;
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // 冰区波浪更小
    float waveDamping = mix(1.0, 0.2, iceMode);
    float wave1 = sin(pos.x * 0.02 + time * 0.5) * 0.5 * waveDamping;
    float wave2 = sin(pos.y * 0.015 + time * 0.3) * 0.3 * waveDamping;
    float wave3 = sin((pos.x + pos.y) * 0.01 + time * 0.4) * 0.2 * waveDamping;

    pos.z = wave1 + wave2 + wave3;
    vHeight = pos.z;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const iceWaterFragmentShader = `
  uniform float time;
  uniform float iceMode;
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    // 开阔水域颜色
    vec3 deepColor = vec3(0.0, 0.2, 0.4);
    vec3 shallowColor = vec3(0.0, 0.5, 0.7);

    // 冰区颜色 (更亮的蓝白色)
    vec3 iceDeepColor = vec3(0.6, 0.8, 0.9);
    vec3 iceShallowColor = vec3(0.85, 0.92, 0.98);

    // 根据冰区模式混合颜色
    vec3 baseDeep = mix(deepColor, iceDeepColor, iceMode);
    vec3 baseShallow = mix(shallowColor, iceShallowColor, iceMode);

    float depth = smoothstep(-1.0, 1.0, vHeight);
    vec3 waterColor = mix(baseDeep, baseShallow, depth);

    // 冰块效果 (随机白色斑块)
    if (iceMode > 0.5) {
      float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      if (noise > 0.7) {
        waterColor = mix(waterColor, vec3(1.0), 0.5);
      }
    }

    gl_FragColor = vec4(waterColor, 0.9);
  }
`;

// ============ 3D 组件 ============

/** 冰区海面组件 */
function IceOcean({ iceMode }: { iceMode: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
      // 平滑过渡冰区效果
      const targetIce = iceMode ? 1.0 : 0.0;
      const currentIce = materialRef.current.uniforms.iceMode.value;
      materialRef.current.uniforms.iceMode.value += (targetIce - currentIce) * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[5000, 5000, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={iceWaterVertexShader}
        fragmentShader={iceWaterFragmentShader}
        uniforms={{
          time: { value: 0 },
          iceMode: { value: 0 },
        }}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** 破冰船模型 */
function IcebreakerModel({
  position,
  heading,
  azimuth1,
  azimuth2,
}: {
  position: Vector2;
  heading: number;
  azimuth1: number;
  azimuth2: number;
}) {
  const { scene } = useGLTF('/assets/icebreaker.glb');
  const groupRef = useRef<THREE.Group>(null);

  const { model, scale } = useMemo(() => {
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

    return { model: cloned, scale: calculatedScale };
  }, [scene]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = position.x;
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

useGLTF.preload('/assets/icebreaker.glb');

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
      color="#06b6d4"
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

  const linePoints = points.map((p) => [p.x, 1, p.z] as [number, number, number]);

  return (
    <Line
      points={linePoints}
      color="#06b6d4"
      lineWidth={1}
      opacity={0.5}
      transparent
    />
  );
}

/** 3D 场景 */
function Scene({
  position,
  heading,
  targetHeading,
  azimuth1,
  azimuth2,
  trail,
  iceMode,
  controlsRef,
  cameraMode,
  onCameraModeChange,
}: {
  position: Vector2;
  heading: number;
  targetHeading: number;
  azimuth1: number;
  azimuth2: number;
  trail: Vector2[];
  iceMode: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl>;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
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
        onStart={() => onCameraModeChange('free')}
      />
      <UnifiedCameraController
        position={position}
        headingRad={heading}
        cameraMode={cameraMode}
        controlsRef={controlsRef}
      />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[100, 200, 100]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* 极地天空 - 必须先渲染 */}
      <SkyDome horizonColor="#e0e8f0" zenithColor="#6b8aa8" />
      <ProceduralClouds />

      <IceOcean iceMode={iceMode} />

      <IcebreakerModel
        position={position}
        heading={heading}
        azimuth1={azimuth1}
        azimuth2={azimuth2}
      />

      <HeadingIndicator position={position} targetHeading={targetHeading} />
      <TrailLine points={trail} />

      <Grid
        position={[0, -1.9, 0]}
        args={[2000, 2000]}
        cellSize={50}
        cellThickness={0.5}
        cellColor="#1e40af"
        sectionSize={200}
        sectionThickness={1}
        sectionColor="#3b82f6"
        fadeDistance={1500}
        infiniteGrid
      />
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
    safe: 'bg-green-500',
    caution: 'bg-yellow-500',
    danger: 'bg-red-500',
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Snowflake className="w-4 h-4" />
          冰区状态
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">冰厚</span>
          <div className="flex items-center gap-2">
            <span className="font-mono">{iceThickness.toFixed(2)} m</span>
            <div className={`w-3 h-3 rounded-full ${safetyColors[safetyLevel]}`} />
          </div>
        </div>

        {iceState.inContact && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">相位</span>
              <Badge variant={iceState.stickPhase ? 'destructive' : 'default'}>
                {summary.phase}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">相位进度</span>
                <span>{(summary.phaseProgress * 100).toFixed(0)}%</span>
              </div>
              <Progress value={summary.phaseProgress * 100} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">K 摄动</span>
                <div className="font-mono text-lg">{summary.kPerturbation}</div>
              </div>
              <div>
                <span className="text-muted-foreground">T 摄动</span>
                <div className="font-mono text-lg">{summary.tPerturbation}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">冰阻力</span>
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
    <Card className="w-full">
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
        <div className="relative h-24 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <div className="absolute inset-0 flex items-center justify-center">
            {/* 船体简化表示 */}
            <div className="w-16 h-32 bg-slate-300 dark:bg-slate-600 rounded-t-full relative">
              {/* Azipod 1 */}
              <div
                className="absolute -left-4 bottom-4 w-8 h-2 bg-green-500 origin-right"
                style={{ transform: `rotate(${-azimuth1}deg)` }}
              />
              {/* Azipod 2 */}
              <div
                className="absolute -right-4 bottom-4 w-8 h-2 bg-green-500 origin-left"
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
        <Button
          variant={isRunning ? 'destructive' : 'default'}
          onClick={onToggleRun}
          className="flex-1"
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
        <Button variant="outline" onClick={onReset}>
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
          value={[config.speed]}
          onValueChange={([v]) => onConfigChange({ speed: v })}
          min={0}
          max={XUELONG_ICEBREAKER_PARAMS.MAX_SPEED}
          step={0.1}
        />
      </div>

      {/* 冰区模式 */}
      <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
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
      <Card>
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
              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
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

// ============ 主组件 ============

export default function IcebreakerSimulation() {
  // 仿真状态
  const [isRunning, setIsRunning] = useState(false);
  const [simTime, setSimTime] = useState(0);
  const [position, setPosition] = useState<Vector2>({ x: 0, z: 0 });
  const [heading, setHeading] = useState(0);
  const [trail, setTrail] = useState<Vector2[]>([]);
  const [violations, setViolations] = useState<EthicalViolation[]>([]);

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
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');

  // Azipod 参数 (使用预定义的默认参数)
  const azipodParams: Azipod3DOFParams = DEFAULT_AZIPOD_3DOF_PARAMS;

  // 仿真步进
  const simulationStep = useCallback(
    (dt: number) => {
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
            simTime
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
            simTime
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
      const newTime = simTime + dt;

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
    [config, simTime, azipodParams]
  );

  // 仿真循环
  useEffect(() => {
    if (!isRunning) return;

    const dt = 0.1; // 100ms 步长
    const interval = setInterval(() => {
      simulationStep(dt);
    }, dt * 1000);

    return () => clearInterval(interval);
  }, [isRunning, simulationStep]);

  // 重置
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setSimTime(0);
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
  }, [config.speed]);

  const handleConfigChange = useCallback((updates: Partial<SimulationConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 标题栏 */}
      <div className="h-14 border-b px-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Snowflake className="w-6 h-6 text-cyan-500" />
          <div>
            <h1 className="font-semibold">雪龙2号极地科考破冰船仿真</h1>
            <p className="text-xs text-muted-foreground">
              Azipod 推进 · 冰阻力 Stick-Slip 模型 · 参数摄动
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono">
          {icebreakerXuelongProfile.name}
        </Badge>
      </div>

      {/* 主内容 */}
      <div className="flex-1 flex">
        {/* 3D 视图 */}
        <div className="flex-1 relative">
          <Canvas shadows>
            <Scene
              position={position}
              heading={heading}
              targetHeading={config.targetHeading}
              azimuth1={physicsStateRef.current.azipod1.azimuth}
              azimuth2={physicsStateRef.current.azipod2.azimuth}
              trail={trail}
              iceMode={config.iceModeEnabled}
              controlsRef={controlsRef as React.RefObject<OrbitControlsImpl>}
              cameraMode={cameraMode}
              onCameraModeChange={setCameraMode}
            />
          </Canvas>

          <CameraViewSwitcher
            currentMode={cameraMode}
            onModeChange={setCameraMode}
            className="absolute top-4 right-4"
          />

          {/* 叠加信息 */}
          <div className="absolute top-4 left-4 bg-card/80 backdrop-blur rounded-lg p-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-muted-foreground">航向</span>
              <span className="font-mono">{toDegrees(heading).toFixed(1)}°</span>
              <span className="text-muted-foreground">位置</span>
              <span className="font-mono">
                ({position.x.toFixed(0)}, {position.z.toFixed(0)})
              </span>
            </div>
          </div>
        </div>

        {/* 右侧面板 */}
        <div className="w-80 border-l bg-card p-4 overflow-y-auto">
          <Tabs defaultValue="control">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="control" className="flex-1">
                控制
              </TabsTrigger>
              <TabsTrigger value="ice" className="flex-1">
                冰区
              </TabsTrigger>
              <TabsTrigger value="azipod" className="flex-1">
                推进
              </TabsTrigger>
              <TabsTrigger value="alerts" className="flex-1">
                警报
              </TabsTrigger>
            </TabsList>

            <TabsContent value="control">
              <ControlPanel
                config={config}
                onConfigChange={handleConfigChange}
                onReset={handleReset}
                isRunning={isRunning}
                onToggleRun={() => setIsRunning((r) => !r)}
                metrics={metrics}
              />
            </TabsContent>

            <TabsContent value="ice">
              <IceStatusPanel
                iceState={iceStateRef.current}
                iceThickness={config.iceThickness}
              />
            </TabsContent>

            <TabsContent value="azipod">
              <AzipodStatusPanel
                azimuth1={metrics.azimuth1Deg}
                azimuth2={metrics.azimuth2Deg}
                thrust1={metrics.thrust1KN}
                thrust2={metrics.thrust2KN}
              />
            </TabsContent>

            <TabsContent value="alerts">
              <ViolationsPanel violations={violations} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
