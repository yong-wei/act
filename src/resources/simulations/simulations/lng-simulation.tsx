'use client';

/**
 * LNG 船仿真组件
 * 长恒系列 LNG 运输船 - 带时滞和液货晃荡的高保真仿真
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { MaritimeEnvironment } from '../environment';
import { SimulationClock } from '@/lib/simulation';
import {
  UnifiedCameraController,
  RightClickFreeModeBridge,
  CameraViewSwitcher,
  SimulationTopBar,
  SimulationDock,
  SimulationAssessmentPanel,
  ModelLoadingPlaceholder,
  simulationUi,
  type CameraMode,
} from '../components';

import type {
  ControlMode,
  SimulationState,
  Vector2,
  PIDGains,
} from '../core/types';
import { lngChanghengProfile, getLNGDefaultConfig } from '../profiles/lng-changheng';
import {
  LNGCarrierEngine,
  createSimulationEngine,
} from '../physics/engine-factory';
import {
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
} from '../physics/simulation-engine-facade';
import { toDegrees, toRadians, LNG_CHANGHENG_PARAMS } from '../core/constants';
import {
  SIMULATION_FIXED_STEP_SECONDS,
  SIMULATION_MAX_SUB_STEPS,
  getSimulationDeltaFromMilliseconds,
} from '../lib/simulation-timing';

// ============ 类型定义 ============

interface LNGSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  time: number;
  position: Vector2;
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  sloshingAngle: number;
  tankPressure: number;
  targetHeading: number;
  controlMode: ControlMode;
  smithEnabled: boolean;
}

// ============ 海面组件 ============

function Ocean() {
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
        waterColor: { value: new THREE.Color('#0077be') },
        foamColor: { value: new THREE.Color('#ffffff') },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float wave1 = sin(pos.x * 0.02 + time * 0.5) * 2.0;
          float wave2 = sin(pos.z * 0.03 + time * 0.3) * 1.5;
          float wave3 = sin((pos.x + pos.z) * 0.015 + time * 0.4) * 1.0;
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
          float foam = smoothstep(2.0, 4.0, vElevation);
          vec3 color = mix(waterColor, foamColor, foam * 0.3);
          gl_FragColor = vec4(color, 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={shaderMaterial}>
      <planeGeometry args={[20000, 20000, 128, 128]} />
    </mesh>
  );
}

// ============ LNG 船模型组件 ============

function LNGShipModel({
  position,
  heading,
  sloshingAngle,
}: {
  position: Vector2;
  heading: number;
  sloshingAngle: number;
}) {
  const { scene } = useGLTF('/assets/Lng-carrier.glb');
  const groupRef = useRef<THREE.Group>(null);
  const modelYawOffset = -Math.PI / 2;

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

    // 计算缩放 - 目标长度约 295m (长恒系列实际长度)
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = LNG_CHANGHENG_PARAMS.LENGTH;
    const calculatedScale = targetLength / maxDim;

    return { model: cloned, scale: calculatedScale, modelHeight: size.y * calculatedScale };
  }, [scene]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = position.x;
      groupRef.current.position.y = modelHeight * 0.5 - LNG_CHANGHENG_PARAMS.DRAFT;
      groupRef.current.position.z = position.z;
      // 模型默认朝向与仿真前进方向相反，补偿 180° 防止“倒着跑”
      groupRef.current.rotation.y = -heading + modelYawOffset;
      // 晃荡影响船体横摇
      groupRef.current.rotation.z = sloshingAngle * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={scale} />
      {/* 船艏标记 */}
      <mesh position={[0, modelHeight * 0.6, 0]}>
        <sphereGeometry args={[5, 16, 16]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
    </group>
  );
}

// 预加载 LNG 船模型
useGLTF.preload('/assets/Lng-carrier.glb');

// ============ 航迹线组件 ============

function TrajectoryLine({ points }: { points: Vector2[] }) {
  const linePoints = useMemo(() => {
    return points.map((p) => [p.x, 0.5, p.z] as [number, number, number]);
  }, [points]);

  if (linePoints.length < 2) return null;

  return (
    <Line
      points={linePoints}
      color="#3b82f6"
      lineWidth={2}
      dashed={false}
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
  const length = 500;
  const buildWings = (start: [number, number, number], end: [number, number, number]) => {
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const backX = end[0] - ux * 50;
    const backZ = end[2] - uz * 50;
    return {
      left: [backX - uz * 20, end[1], backZ + ux * 20] as [number, number, number],
      right: [backX + uz * 20, end[1], backZ - ux * 20] as [number, number, number],
    };
  };

  // 目标航向线
  const targetEnd: [number, number, number] = [
    position.x + length * Math.cos(toRadians(targetHeading)),
    5,
    position.z + length * Math.sin(toRadians(targetHeading)),
  ];

  // 当前航向线
  const currentEnd: [number, number, number] = [
    position.x + length * 0.8 * Math.cos(toRadians(currentHeading)),
    5,
    position.z + length * 0.8 * Math.sin(toRadians(currentHeading)),
  ];
  const targetWings = buildWings([position.x, 5, position.z], targetEnd);
  const currentWings = buildWings([position.x, 5, position.z], currentEnd);

  return (
    <group>
      {/* 目标航向 (浅蓝虚线箭头) */}
      <Line
        points={[[position.x, 5, position.z], targetEnd]}
        color="#60a5fa"
        lineWidth={2}
        dashed
        dashSize={20}
        gapSize={10}
      />
      <Line points={[targetWings.left, targetEnd]} color="#60a5fa" lineWidth={2} />
      <Line points={[targetWings.right, targetEnd]} color="#60a5fa" lineWidth={2} />
      {/* 当前航向 (深蓝实线箭头) */}
      <Line
        points={[[position.x, 5, position.z], currentEnd]}
        color="#3b82f6"
        lineWidth={3}
      />
      <Line points={[currentWings.left, currentEnd]} color="#3b82f6" lineWidth={3} />
      <Line points={[currentWings.right, currentEnd]} color="#3b82f6" lineWidth={3} />
    </group>
  );
}


// ============ HUD 组件 ============

function StatusPanel({
  state,
}: {
  state: LNGSimulationState;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-slate-700">时间:</span>
        <span>{state.time.toFixed(1)}s</span>

        <span className="text-slate-700">航向:</span>
        <span>{state.heading.toFixed(1)}°</span>

        <span className="text-slate-700">目标航向:</span>
        <span className="text-green-700">{state.targetHeading.toFixed(1)}°</span>

        <span className="text-slate-700">航向误差:</span>
        <span className={Math.abs(state.heading - state.targetHeading) > 5 ? 'text-amber-700' : 'text-green-700'}>
          {(state.heading - state.targetHeading).toFixed(1)}°
        </span>

        <span className="text-slate-700">转艏率:</span>
        <span>{state.yawRate.toFixed(2)}°/s</span>

        <span className="text-slate-700">舵角:</span>
        <span>{state.rudder.toFixed(1)}°</span>

        <span className="text-slate-700">航速:</span>
        <span>{(state.speed * 1.944).toFixed(1)} kn</span>
      </div>

      <div className="border-t border-slate-300"></div>

      <div className="text-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-slate-700">液货晃荡:</span>
          <span className={state.sloshingAngle > 5 ? 'text-red-600' : 'text-sky-700'}>
            {state.sloshingAngle.toFixed(2)}°
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-700">货舱压力:</span>
          <span className={state.tankPressure > 150 ? 'text-red-600' : 'text-sky-700'}>
            {state.tankPressure.toFixed(0)} kPa
          </span>
        </div>
      </div>

      <div className="border-t border-slate-300"></div>

      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
        ⚠️ 时滞: 25秒 | 晃荡周期: ~12s
      </div>
    </div>
  );
}

function ControlPanel({
  state,
  onControlModeChange,
  onTargetHeadingChange,
  onSmithToggle,
  onStartPause,
  onReset,
}: {
  state: LNGSimulationState;
  onControlModeChange: (mode: ControlMode) => void;
  onTargetHeadingChange: (heading: number) => void;
  onSmithToggle: () => void;
  onStartPause: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="lng-simulation-control-1" className="mb-1 block text-sm text-slate-700">控制模式</label>
        <select id="lng-simulation-control-1"
          value={state.controlMode}
          onChange={(e) => onControlModeChange(e.target.value as ControlMode)}
          className="w-full rounded border border-slate-300 bg-white p-2 text-slate-900"
        >
          <option value="manual">手动</option>
          <option value="p">P 控制</option>
          <option value="pd">PD 控制</option>
          <option value="pid">PID 控制</option>
          <option value="autopilot">自动舵</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-700">
          目标航向: {state.targetHeading}°
        </label>
        <input aria-label="LNG 船仿真参数"
          type="range"
          min="-180"
          max="180"
          value={state.targetHeading}
          onChange={(e) => onTargetHeadingChange(Number(e.target.value))}
          className={simulationUi.nativeRange}
        />
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={state.smithEnabled}
            onChange={onSmithToggle}
            className="h-4 w-4 accent-sky-700"
          />
          <span className="text-sm">启用 Smith 预估器</span>
        </label>
        <p className="mt-1 text-xs text-slate-600">消除25秒时滞影响</p>
      </div>

      <div className="flex gap-2">
        <button type="button"
          onClick={onStartPause}
          className={`flex-1 rounded border px-4 py-2 ${
            state.isRunning && !state.isPaused
              ? simulationUi.buttonSecondary
              : simulationUi.buttonPrimary
          }`}
        >
          {state.isRunning && !state.isPaused ? '暂停' : '开始'}
        </button>
        <button type="button"
          onClick={onReset}
          className={`flex-1 rounded border px-4 py-2 ${simulationUi.buttonOutline}`}
        >
          重置
        </button>
      </div>
    </div>
  );
}

// ============ 3D 场景 ============

function Scene({
  state,
  trajectory,
  showGrid,
  cameraMode,
  onCameraModeChange,
  controlsRef,
}: {
  state: LNGSimulationState;
  trajectory: Vector2[];
  showGrid: boolean;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[-400, 300, 400]} fov={60} near={1} far={50000} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[200, 300, 200]} intensity={1.5} castShadow />

      <MaritimeEnvironment shipPosition={state.position} seaState={3} />

      {showGrid ? (
        <Grid
          args={[10000, 10000]}
          cellSize={100}
          cellThickness={0.5}
          cellColor="#1e3a5f"
          sectionSize={500}
          sectionThickness={1}
          sectionColor="#2563eb"
          fadeDistance={9000}
          fadeStrength={1}
          position={[0, 0.35, 0]}
        />
      ) : null}

      <Suspense
        fallback={(
          <ModelLoadingPlaceholder
            label="LNG 船模型加载中"
            sublabel="场景已就绪，可先查看海况与航向参考"
          />
        )}
      >
        <LNGShipModel
          position={state.position}
          heading={toRadians(state.heading)}
          sloshingAngle={state.sloshingAngle}
        />
      </Suspense>

      <TrajectoryLine points={trajectory} />

      <HeadingIndicator
        position={state.position}
        targetHeading={state.targetHeading}
        currentHeading={state.heading}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        minDistance={100}
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

// ============ 主组件 ============

export function LNGSimulation() {
  const engineRef = useRef<LNGCarrierEngine | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
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
  const [state, setState] = useState<LNGSimulationState>({
    isRunning: false,
    isPaused: false,
    time: 0,
    position: { x: -3000, z: 0 },
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
    sloshingAngle: 0,
    tankPressure: 100,
    targetHeading: 0,
    controlMode: 'pid',
    smithEnabled: false,
  });

  const [trajectory, setTrajectory] = useState<Vector2[]>([]);

  // 初始化引擎
  useEffect(() => {
    preloadVirtualSimulationRuntime().catch(console.error);

    const engine = createSimulationEngine(lngChanghengProfile) as LNGCarrierEngine;
    engine.initialize(-3000, 0, 0);
    engineRef.current = engine;
  }, []);

  // 仿真循环
  const simulationStep = useCallback((timestamp: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!isVirtualSimulationRuntimeReady()) {
      lastTimeRef.current = timestamp;
      animationRef.current = requestAnimationFrame(simulationStep);
      return;
    }

    const frameDt = getSimulationDeltaFromMilliseconds(timestamp, lastTimeRef.current, speedScale);
    lastTimeRef.current = timestamp;

    let nextTime = state.time;
    let engineState = engine.getState(nextTime);
    let sloshingMetrics = engine.getSloshingMetrics();

    clockRef.current.advance(frameDt, (dt) => {
      const time = nextTime + dt;
      nextTime = time;
      engine.step(
        state.targetHeading,
        null,
        state.controlMode,
        0,
        LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
        dt,
        time
      );
      engineState = engine.getState(time);
      sloshingMetrics = engine.getSloshingMetrics();
    });

    setState((prev) => ({
      ...prev,
      time: nextTime,
      position: engineState.position,
      heading: engineState.heading,
      yawRate: engineState.yawRate,
      rudder: engineState.rudder,
      speed: engineState.speed,
      sloshingAngle: sloshingMetrics.angleDeg,
      tankPressure: sloshingMetrics.pressure,
    }));

    setTrajectory((prev) => {
      const newPoint = { ...engineState.position };
      const newTraj = [...prev, newPoint];
      return newTraj.length > 500 ? newTraj.slice(-500) : newTraj;
    });

    if (state.isRunning && !state.isPaused) {
      animationRef.current = requestAnimationFrame(simulationStep);
    }
  }, [state.isRunning, state.isPaused, state.targetHeading, state.controlMode, state.time, speedScale]);

  // 控制仿真启停
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      clockRef.current.reset();
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(simulationStep);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isRunning, state.isPaused, simulationStep]);

  // 事件处理
  const handleStartPause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRunning: !prev.isRunning || prev.isPaused,
      isPaused: prev.isRunning && !prev.isPaused,
    }));
  }, []);

  const handleReset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (engineRef.current) {
      engineRef.current.initialize(-3000, 0, 0);
    }

    setState({
      isRunning: false,
      isPaused: false,
      time: 0,
      position: { x: -3000, z: 0 },
      heading: 0,
      yawRate: 0,
      rudder: 0,
      speed: LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
      sloshingAngle: 0,
      tankPressure: 100,
      targetHeading: 0,
      controlMode: 'pid',
      smithEnabled: false,
    });
    lastTimeRef.current = 0;
    clockRef.current.reset();
    setTrajectory([]);
  }, []);

  const handleControlModeChange = useCallback((mode: ControlMode) => {
    setState((prev) => ({ ...prev, controlMode: mode }));
  }, []);

  const handleTargetHeadingChange = useCallback((heading: number) => {
    setState((prev) => ({ ...prev, targetHeading: heading }));
  }, []);

  const handleSmithToggle = useCallback(() => {
    setState((prev) => {
      const newSmithEnabled = !prev.smithEnabled;
      if (engineRef.current) {
        engineRef.current.setSmithPredictorEnabled(newSmithEnabled);
      }
      return { ...prev, smithEnabled: newSmithEnabled };
    });
  }, []);

  return (
    <div className={simulationUi.root} data-sim-ui>
      <Canvas shadows>
        <Scene
          state={state}
          trajectory={trajectory}
          showGrid={showGrid}
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
            content: <StatusPanel state={state} />,
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
                state={state}
                onControlModeChange={handleControlModeChange}
                onTargetHeadingChange={handleTargetHeadingChange}
                onSmithToggle={handleSmithToggle}
                onStartPause={handleStartPause}
                onReset={handleReset}
              />
            ),
          },
          {
            id: 'evaluate',
            label: '评估',
            content: (
              <SimulationAssessmentPanel
                title="运行质量评估"
                metrics={[
                  { id: 'heading-error', label: '航向误差', value: Math.abs(state.heading - state.targetHeading), max: 30, better: 'lower', unit: '°', precision: 1 },
                  { id: 'rudder', label: '舵角幅值', value: Math.abs(state.rudder), max: 35, better: 'lower', unit: '°', precision: 1 },
                  { id: 'sloshing', label: '液货晃荡', value: state.sloshingAngle, max: 12, better: 'lower', unit: '°', precision: 2 },
                  { id: 'pressure', label: '舱压稳定', value: state.tankPressure, max: 200, better: 'lower', unit: 'kPa', precision: 0 },
                ]}
              />
            ),
          },
        ]}
      />

      <SimulationTopBar
        title="长恒系列 LNG 运输船"
        subtitle="时滞补偿控制 · 液货晃荡耦合"
        badge="LNG / OBE"
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

export default LNGSimulation;
