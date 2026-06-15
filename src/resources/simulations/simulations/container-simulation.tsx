'use client';

/**
 * 集装箱船仿真组件
 * MSC Tessa 超大型集装箱船 - 变质量 + 风载荷 + 增益调度
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  Html,
  PerspectiveCamera,
  Line,
  useGLTF,
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

import type {
  ControlMode,
  Vector2,
  PIDGains,
  SimulationState,
} from '../core/types';
import { containerMscProfile, getContainerDefaultConfig } from '../profiles/container-msc';
import {
  ContainerShipEngine,
  createSimulationEngine,
} from '../physics/engine-factory';
import {
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
} from '../physics/simulation-engine-facade';
import { toDegrees, toRadians, CONTAINER_MSC_PARAMS } from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';

// ============ 类型定义 ============

interface ContainerSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  time: number;
  position: Vector2;
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  loadRatio: number;
  rollAngle: number;
  windSpeed: number;
  windDirection: number;
  targetHeading: number;
  controlMode: ControlMode;
  gainSchedulingEnabled: boolean;
  currentK: number;
  currentT: number;
}

// ============ 海面组件 ============

function Ocean({ sceneTheme }: { sceneTheme: SimulationSceneTheme }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current && meshRef.current.material instanceof THREE.ShaderMaterial) {
      meshRef.current.material.uniforms.time.value = clock.getElapsedTime();
    }
  });

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waterColor: { value: new THREE.Color(sceneTheme.waterColor) },
        foamColor: { value: new THREE.Color(simulationScenePalette.white) },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float wave1 = sin(pos.x * 0.015 + time * 0.4) * 2.5;
          float wave2 = sin(pos.z * 0.02 + time * 0.25) * 2.0;
          float wave3 = sin((pos.x + pos.z) * 0.012 + time * 0.35) * 1.5;
          pos.y += wave1 + wave2 + wave3;
          vElevation = pos.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 waterColor;
        uniform vec3 foamColor;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          float foam = smoothstep(3.0, 5.0, vElevation);
          vec3 color = mix(waterColor, foamColor, foam * 0.25);
          gl_FragColor = vec4(color, 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, [sceneTheme.waterColor]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={shaderMaterial}>
      <planeGeometry args={[25000, 25000, 128, 128]} />
    </mesh>
  );
}

// ============ 集装箱船模型组件 ============

function ContainerShipModel({
  position,
  heading,
  rollAngle,
  loadRatio,
}: {
  position: Vector2;
  heading: number;
  rollAngle: number;
  loadRatio: number;
}) {
  const { scene } = useGLTF('/assets/container.glb');
  const groupRef = useRef<THREE.Group>(null);
  const modelYawOffset = 0;

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
        if (child.material) {
          child.material.transparent = false;
          child.material.opacity = 1;
          child.material.side = THREE.DoubleSide;
        }
      }
    });

    // 计算缩放 - 目标长度约 400m (MSC Tessa 实际长度)
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = CONTAINER_MSC_PARAMS.LENGTH;
    const calculatedScale = targetLength / maxDim;

    return { model: cloned, scale: calculatedScale, modelHeight: size.y * calculatedScale };
  }, [scene]);

  useFrame(() => {
    if (groupRef.current) {
      const clampedLoadRatio = THREE.MathUtils.clamp(loadRatio, 0, 1);
      const currentDraft =
        CONTAINER_MSC_PARAMS.DRAFT_EMPTY +
        (CONTAINER_MSC_PARAMS.DRAFT_FULL - CONTAINER_MSC_PARAMS.DRAFT_EMPTY) * clampedLoadRatio;
      groupRef.current.position.x = position.x;
      groupRef.current.position.y = modelHeight * 0.5 - currentDraft;
      groupRef.current.position.z = position.z;
      // 集装箱船模型前向轴与仿真坐标系接近，仅保留航向本身
      groupRef.current.rotation.y = -heading + modelYawOffset;
      // 横摇
      groupRef.current.rotation.z = rollAngle;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={scale} />
      {/* 船艏标记 */}
      <mesh position={[0, modelHeight * 0.6, 0]}>
        <sphereGeometry args={[8, 16, 16]} />
        <meshBasicMaterial color={simulationScenePalette.containerPrimary} />
      </mesh>
    </group>
  );
}

// 预加载集装箱船模型
useGLTF.preload('/assets/container.glb');

// ============ 航迹线组件 ============

function TrajectoryLine({ points }: { points: Vector2[] }) {
  const linePoints = useMemo(() => {
    return points.map((p) => [p.x, 0.5, p.z] as [number, number, number]);
  }, [points]);

  if (linePoints.length < 2) return null;

  return (
    <Line
      points={linePoints}
      color={simulationScenePalette.containerPrimary}
      lineWidth={2}
      dashed={false}
    />
  );
}

// ============ 风向指示器 ============

function WindIndicator({
  position,
  windDirection,
  windSpeed,
}: {
  position: Vector2;
  windDirection: number;
  windSpeed: number;
}) {
  const length = 200 + windSpeed * 10;

  const end: [number, number, number] = [
    position.x + length * Math.cos(windDirection),
    100,
    position.z + length * Math.sin(windDirection),
  ];

  return (
    <Line
      points={[[position.x, 100, position.z], end]}
      color={simulationScenePalette.headingSecondary}
      lineWidth={3}
      dashed
      dashScale={50}
    />
  );
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
  const length = 600;
  const buildWings = (start: [number, number, number], end: [number, number, number]) => {
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const backX = end[0] - ux * 55;
    const backZ = end[2] - uz * 55;
    return {
      left: [backX - uz * 22, end[1], backZ + ux * 22] as [number, number, number],
      right: [backX + uz * 22, end[1], backZ - ux * 22] as [number, number, number],
    };
  };

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
  const targetWings = buildWings([position.x, 2, position.z], targetEnd);
  const currentWings = buildWings([position.x, 2, position.z], currentEnd);

  return (
    <>
      {/* 目标航向 - 橙色虚线箭头 */}
      <Line
        points={[[position.x, 2, position.z], targetEnd]}
        color={simulationScenePalette.containerTarget}
        lineWidth={2}
        dashed
        dashScale={30}
      />
      <Line points={[targetWings.left, targetEnd]} color={simulationScenePalette.containerTarget} lineWidth={2} />
      <Line points={[targetWings.right, targetEnd]} color={simulationScenePalette.containerTarget} lineWidth={2} />
      {/* 当前航向 - 深橙色实线箭头 */}
      <Line
        points={[[position.x, 2, position.z], currentEnd]}
        color={simulationScenePalette.containerPrimary}
        lineWidth={3}
      />
      <Line points={[currentWings.left, currentEnd]} color={simulationScenePalette.containerPrimary} lineWidth={3} />
      <Line points={[currentWings.right, currentEnd]} color={simulationScenePalette.containerPrimary} lineWidth={3} />
    </>
  );
}

// ============ 相机控制器 ============


// ============ 控制面板组件 ============

function ControlPanel({
  state,
  onTargetHeadingChange,
  onControlModeChange,
  onLoadRatioChange,
  onWindSpeedChange,
  onWindDirectionChange,
  onGainSchedulingToggle,
  onStart,
  onPause,
  onReset,
}: {
  state: ContainerSimulationState;
  onTargetHeadingChange: (heading: number) => void;
  onControlModeChange: (mode: ControlMode) => void;
  onLoadRatioChange: (ratio: number) => void;
  onWindSpeedChange: (speed: number) => void;
  onWindDirectionChange: (direction: number) => void;
  onGainSchedulingToggle: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3 text-sm">

      {/* 仿真控制 */}
      <div className="mb-4 flex gap-2">
        {!state.isRunning ? (
          <button type="button"
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

      {/* 目标航向 */}
      <div className="mb-3">
        <label className={`mb-1 block ${simulationUi.mutedText}`}>目标航向: {state.targetHeading.toFixed(0)}°</label>
        <input aria-label="集装箱船仿真参数一"
          type="range"
          min="-180"
          max="180"
          value={state.targetHeading}
          onChange={(e) => onTargetHeadingChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      {/* 装载率 */}
      <div className="mb-3">
        <label className={`mb-1 block ${simulationUi.mutedText}`}>
          装载率: {(state.loadRatio * 100).toFixed(0)}%
          <span className="ml-2 text-platform-fg-secondary">
            ({state.loadRatio < 0.3 ? '空载' : state.loadRatio < 0.7 ? '半载' : '满载'})
          </span>
        </label>
        <input aria-label="集装箱船仿真参数二"
          type="range"
          min="0"
          max="100"
          value={state.loadRatio * 100}
          onChange={(e) => onLoadRatioChange(Number(e.target.value) / 100)}
          className={simulationUi.nativeRange}
        />
        <div className="mt-1 flex justify-between text-xs text-platform-fg-secondary">
          <span>K={state.currentK.toFixed(3)}</span>
          <span>T={state.currentT.toFixed(0)}s</span>
        </div>
      </div>

      {/* 风速 */}
      <div className="mb-3">
        <label className={`mb-1 block ${simulationUi.mutedText}`}>风速: {state.windSpeed.toFixed(1)} m/s</label>
        <input aria-label="集装箱船仿真参数三"
          type="range"
          min="0"
          max="25"
          step="0.5"
          value={state.windSpeed}
          onChange={(e) => onWindSpeedChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      {/* 风向 */}
      <div className="mb-3">
        <label className={`mb-1 block ${simulationUi.mutedText}`}>风向: {state.windDirection.toFixed(0)}°</label>
        <input aria-label="集装箱船仿真参数四"
          type="range"
          min="0"
          max="360"
          value={state.windDirection}
          onChange={(e) => onWindDirectionChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      {/* 控制模式 */}
      <div className="mb-3">
        <p className={`mb-1 block ${simulationUi.mutedText}`}>控制模式</p>
        <div className="flex flex-wrap gap-1">
          {(['manual', 'p', 'pd', 'pid', 'pid_scheduled'] as ControlMode[]).map((mode) => (
            <button type="button"
              key={mode}
              onClick={() => onControlModeChange(mode)}
              className={`rounded border px-2 py-1 text-xs ${
                state.controlMode === mode
                  ? simulationUi.buttonPrimary
                  : simulationUi.buttonOutline
              }`}
            >
              {mode === 'pid_scheduled' ? '增益调度' : mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 增益调度开关 */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="checkbox"
          id="gainScheduling"
          checked={state.gainSchedulingEnabled}
          onChange={onGainSchedulingToggle}
          className="accent-[hsl(var(--platform-action-primary))]"
        />
        <label htmlFor="gainScheduling" className={simulationUi.mutedText}>
          启用增益调度 (自动调整 PID)
        </label>
      </div>
    </div>
  );
}

// ============ HUD 组件 ============

function HUD({ state }: { state: ContainerSimulationState }) {
  const headingError = state.targetHeading - state.heading;
  const normalizedError = headingError > 180 ? headingError - 360 : headingError < -180 ? headingError + 360 : headingError;

  return (
    <div className="space-y-3 p-1 text-sm">

      {/* 时间 */}
      <div className="mb-2 flex justify-between border-b border-platform-border pb-2">
        <span className="text-platform-fg-secondary">仿真时间</span>
        <span className="font-mono text-platform-fg-primary">{state.time.toFixed(1)}s</span>
      </div>

      {/* 航向信息 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-platform-fg-secondary">当前航向</div>
          <div className="font-mono text-lg text-platform-fg-primary">{state.heading.toFixed(1)}°</div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-secondary">航向误差</div>
          <div className={`font-mono text-lg ${Math.abs(normalizedError) > 5 ? 'text-[hsl(var(--platform-brand-danger))]' : 'text-[hsl(var(--platform-brand-success))]'}`}>
            {normalizedError.toFixed(1)}°
          </div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-secondary">转艏角速度</div>
          <div className="font-mono text-platform-fg-primary">{state.yawRate.toFixed(2)}°/s</div>
        </div>
        <div>
          <div className="text-xs text-platform-fg-secondary">舵角</div>
          <div className="font-mono text-platform-fg-primary">{state.rudder.toFixed(1)}°</div>
        </div>
      </div>

      {/* 横摇警告 */}
      {Math.abs(toDegrees(state.rollAngle)) > 8 && (
        <div className="mb-3 rounded bg-[hsl(var(--platform-brand-danger)/0.18)] p-2 text-center text-[hsl(var(--platform-brand-danger))]">
          ⚠️ 横摇角过大: {toDegrees(state.rollAngle).toFixed(1)}° - 落箱风险!
        </div>
      )}

      {/* 系统参数 */}
      <div className="mb-3 rounded border border-platform-border bg-platform-surface-overlay/86 p-2">
        <div className="mb-1 text-xs font-semibold text-platform-fg-secondary">当前系统参数</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>K = {state.currentK.toFixed(3)}</div>
          <div>T = {state.currentT.toFixed(0)}s</div>
          <div>装载 = {(state.loadRatio * 100).toFixed(0)}%</div>
          <div>航速 = {state.speed.toFixed(1)} m/s</div>
        </div>
      </div>

      {/* 风载荷 */}
      <div className="rounded border border-platform-border bg-platform-surface-overlay/86 p-2">
        <div className="mb-1 text-xs font-semibold text-platform-fg-secondary">风载荷</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>风速 = {state.windSpeed.toFixed(1)} m/s</div>
          <div>风向 = {state.windDirection.toFixed(0)}°</div>
          <div>横摇 = {toDegrees(state.rollAngle).toFixed(1)}°</div>
          <div className={state.windSpeed > 15 ? 'text-[hsl(var(--platform-brand-evidence))]' : ''}>
            {state.windSpeed > 20 ? '⚠️ 风速超限' : state.windSpeed > 15 ? '注意大风' : '正常'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 3D 场景组件 ============

function Scene({
  state,
  trajectory,
  showGrid,
  sceneTheme,
  cameraMode,
  onCameraModeChange,
  controlsRef,
}: {
  state: ContainerSimulationState;
  trajectory: Vector2[];
  showGrid: boolean;
  sceneTheme: SimulationSceneTheme;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[-500, 200, 500]} fov={60} near={1} far={50000} />

      {/* 环境 */}
      <ambientLight intensity={sceneTheme.ambientLightIntensity} />
      <directionalLight position={[200, 300, 200]} intensity={sceneTheme.directionalLightIntensity} castShadow />

      {/* 天空+云层+海面 */}
      <MaritimeEnvironment shipPosition={state.position} seaState={3} sceneTheme={sceneTheme} />

      {/* 参考网格 */}
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

      {/* 航迹线 */}
      <TrajectoryLine points={trajectory} />

      {/* 风向指示器 */}
      <WindIndicator
        position={state.position}
        windDirection={toRadians(state.windDirection)}
        windSpeed={state.windSpeed}
      />

      {/* 航向指示器 */}
      <HeadingIndicator
        position={state.position}
        targetHeading={state.targetHeading}
        currentHeading={state.heading}
      />

      {/* 集装箱船模型 */}
      <Suspense
        fallback={(
          <ModelLoadingPlaceholder
            label="集装箱船模型加载中"
            sublabel="场景已就绪，可先查看风场与航向参考"
          />
        )}
      >
        <ContainerShipModel
          position={state.position}
          heading={toRadians(state.heading)}
          rollAngle={state.rollAngle}
          loadRatio={state.loadRatio}
        />
      </Suspense>

      {/* 相机控制 */}
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        minDistance={200}
        maxDistance={5000}
        maxPolarAngle={Math.PI / 2.1}
      />
      <RightClickFreeModeBridge onRequestFreeMode={() => onCameraModeChange('free')} />
      <UnifiedCameraController
        position={state.position}
        headingRad={toRadians(state.heading)}
        cameraMode={cameraMode}
        controlsRef={controlsRef}
      />
    </>
  );
}

// ============ 主仿真组件 ============

export default function ContainerSimulation() {
  // 仿真引擎
  const engineRef = useRef<ContainerShipEngine | null>(null);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const clockRef = useRef(
    new SimulationClock({
      dt: SIMULATION_FIXED_STEP_SECONDS,
      maxSubSteps: SIMULATION_MAX_SUB_STEPS,
    })
  );
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // 相机状态
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(1);
  const sceneTheme = useSimulationSceneTheme();

  // 轨迹记录
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);

  // 仿真状态
  const [simState, setSimState] = useState<ContainerSimulationState>({
    isRunning: false,
    isPaused: false,
    time: 0,
    position: { x: 0, z: 0 },
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
    loadRatio: 0.5,
    rollAngle: 0,
    windSpeed: 10,
    windDirection: 90,
    targetHeading: 0,
    controlMode: 'pid_scheduled',
    gainSchedulingEnabled: true,
    currentK: 0.08,
    currentT: 80,
  });

  // 初始化引擎
  useEffect(() => {
    preloadVirtualSimulationRuntime().catch(console.error);

    const engine = createSimulationEngine(containerMscProfile) as ContainerShipEngine;
    engine.initialize(0, 0, 0);
    engine.setLoadRatio(0.5);
    engine.setWindEnvironment(10, 90, false);
    engineRef.current = engine;

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  // 仿真循环
  const simulationLoop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || simState.isPaused || !isVirtualSimulationRuntimeReady()) {
      frameRef.current = requestAnimationFrame(simulationLoop);
      return;
    }

    const now = performance.now();
    const frameDt = getSimulationDeltaFromMilliseconds(now, lastTimeRef.current, speedScale);
    lastTimeRef.current = now;

    let nextTime = simState.time;
    let nextState: SimulationState | null = engine.getState(nextTime);
    let summary: ReturnType<typeof engine.getContainerShipSummary> =
      engine.getContainerShipSummary();

    clockRef.current.advance(frameDt, (dt) => {
      const stepTime = nextTime + dt;
      engine.step(
        simState.targetHeading,
        null,
        simState.controlMode,
        0,
        simState.speed,
        dt,
        stepTime
      );
      nextTime = stepTime;
      nextState = engine.getState(stepTime);
      summary = engine.getContainerShipSummary();
    });

    if (nextState) {
      const nextPosition = nextState.position;
      const nextHeading = nextState.heading;
      const nextYawRate = nextState.yawRate;
      const nextRudder = nextState.rudder;
      const nextRollAngle = nextState.waveRoll;

      if (Math.floor(simState.time) !== Math.floor(nextTime)) {
        setTrajectory(prev => [...prev.slice(-300), nextPosition]);
      }

      setSimState(prev => ({
        ...prev,
        time: nextTime,
        position: nextPosition,
        heading: nextHeading,
        yawRate: nextYawRate,
        rudder: nextRudder,
        rollAngle: nextRollAngle,
        currentK: summary.currentK,
        currentT: summary.currentT,
      }));
    }

    frameRef.current = requestAnimationFrame(simulationLoop);
  }, [simState.isPaused, simState.targetHeading, simState.controlMode, simState.speed, simState.time, speedScale]);

  // 启动/停止仿真
  useEffect(() => {
    if (simState.isRunning && !simState.isPaused) {
      clockRef.current.reset();
      lastTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame(simulationLoop);
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [simState.isRunning, simState.isPaused, simulationLoop]);

  // 事件处理
  const handleStart = () => {
    setSimState(prev => ({ ...prev, isRunning: true, isPaused: false }));
  };

  const handlePause = () => {
    setSimState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleReset = () => {
    const engine = engineRef.current;
    if (engine) {
      engine.initialize(0, 0, 0);
      engine.setLoadRatio(0.5);
    }
    setTrajectory([]);
    setSimState({
      isRunning: false,
      isPaused: false,
      time: 0,
      position: { x: 0, z: 0 },
      heading: 0,
      yawRate: 0,
      rudder: 0,
      speed: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
      loadRatio: 0.5,
      rollAngle: 0,
      windSpeed: 10,
      windDirection: 90,
      targetHeading: 0,
      controlMode: 'pid_scheduled',
      gainSchedulingEnabled: true,
      currentK: 0.08,
      currentT: 80,
    });
  };

  const handleTargetHeadingChange = (heading: number) => {
    setSimState(prev => ({ ...prev, targetHeading: heading }));
  };

  const handleControlModeChange = (mode: ControlMode) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setGainSchedulingEnabled(mode === 'pid_scheduled');
    }
    setSimState(prev => ({
      ...prev,
      controlMode: mode,
      gainSchedulingEnabled: mode === 'pid_scheduled',
    }));
  };

  const handleLoadRatioChange = (ratio: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setLoadRatio(ratio);
    }
    setSimState(prev => ({ ...prev, loadRatio: ratio }));
  };

  const handleWindSpeedChange = (speed: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setWindEnvironment(speed, simState.windDirection, false);
    }
    setSimState(prev => ({ ...prev, windSpeed: speed }));
  };

  const handleWindDirectionChange = (direction: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setWindEnvironment(simState.windSpeed, direction, false);
    }
    setSimState(prev => ({ ...prev, windDirection: direction }));
  };

  const handleGainSchedulingToggle = () => {
    const engine = engineRef.current;
    const newEnabled = !simState.gainSchedulingEnabled;
    if (engine) {
      engine.setGainSchedulingEnabled(newEnabled);
    }
    setSimState(prev => ({ ...prev, gainSchedulingEnabled: newEnabled }));
  };

  return (
    <div className={simulationUi.root} data-sim-ui>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} gl={{ antialias: true }}>
        <Scene
          state={simState}
          trajectory={trajectory}
          showGrid={showGrid}
          sceneTheme={sceneTheme}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          controlsRef={controlsRef}
        />
      </Canvas>

      <SimulationDock
        side="left"
        title="状态监控"
        tabs={[
          {
            id: 'status',
            label: '总览',
            content: <HUD state={simState} />,
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
                state={simState}
                onTargetHeadingChange={handleTargetHeadingChange}
                onControlModeChange={handleControlModeChange}
                onLoadRatioChange={handleLoadRatioChange}
                onWindSpeedChange={handleWindSpeedChange}
                onWindDirectionChange={handleWindDirectionChange}
                onGainSchedulingToggle={handleGainSchedulingToggle}
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
              <SimulationAssessmentPanel
                title="航线控制评估"
                metrics={[
                  { id: 'heading-error', label: '航向误差', value: Math.abs(simState.targetHeading - simState.heading), max: 40, better: 'lower', unit: '°' },
                  { id: 'roll', label: '横摇角', value: Math.abs(toDegrees(simState.rollAngle)), max: 12, better: 'lower', unit: '°' },
                  { id: 'wind', label: '风速工况', value: simState.windSpeed, max: 25, better: 'lower', unit: 'm/s' },
                  { id: 'load-stability', label: '装载适配', value: 100 - Math.abs(simState.loadRatio - 0.6) * 100, max: 100, better: 'higher', unit: '%' },
                ]}
              />
            ),
          },
        ]}
      />

      <SimulationTopBar
        title="MSC Tessa 超大型集装箱船"
        subtitle="变质量模型 · 风载荷耦合 · 增益调度"
        badge="Container / OBE"
      />

      {/* 视角切换器 */}
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
    </div>
  );
}
