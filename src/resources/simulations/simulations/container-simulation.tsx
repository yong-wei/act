'use client';

/**
 * 集装箱船仿真组件
 * MSC Tessa 超大型集装箱船 - 变质量 + 风载荷 + 增益调度
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  Grid,
  Html,
  PerspectiveCamera,
  Line,
  useGLTF,
} from '@react-three/drei';
import * as THREE from 'three';

import type {
  ControlMode,
  Vector2,
  PIDGains,
} from '../core/types';
import { containerMscProfile, getContainerDefaultConfig } from '../profiles/container-msc';
import {
  ContainerShipEngine,
  createSimulationEngine,
} from '../physics/engine-factory';
import { toDegrees, toRadians, CONTAINER_MSC_PARAMS } from '../core/constants';

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
        waterColor: { value: new THREE.Color('#0a5c8f') },
        foamColor: { value: new THREE.Color('#ffffff') },
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
  }, []);

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
      groupRef.current.position.x = position.x;
      groupRef.current.position.z = position.z;
      groupRef.current.rotation.y = -heading + Math.PI / 2;
      // 横摇
      groupRef.current.rotation.z = rollAngle;
    }
  });

  return (
    <group ref={groupRef} position={[0, modelHeight * 0.5, 0]}>
      <primitive object={model} scale={scale} />
      {/* 船艏标记 */}
      <mesh position={[0, modelHeight * 0.6, 0]}>
        <sphereGeometry args={[8, 16, 16]} />
        <meshBasicMaterial color="#f97316" />
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
      color="#f97316"
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
      color="#60a5fa"
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
      {/* 目标航向 - 绿色虚线 */}
      <Line
        points={[[position.x, 2, position.z], targetEnd]}
        color="#22c55e"
        lineWidth={2}
        dashed
        dashScale={30}
      />
      {/* 当前航向 - 橙色实线 */}
      <Line
        points={[[position.x, 2, position.z], currentEnd]}
        color="#f97316"
        lineWidth={3}
      />
    </>
  );
}

// ============ 相机控制器 ============

function CameraController({ position }: { position: Vector2 }) {
  const { camera } = useThree();

  useFrame(() => {
    const targetX = position.x - 300;
    const targetZ = position.z + 500;
    camera.position.x += (targetX - camera.position.x) * 0.02;
    camera.position.z += (targetZ - camera.position.z) * 0.02;
    camera.lookAt(position.x, 0, position.z);
  });

  return null;
}

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
    <div className="absolute left-4 top-4 w-80 rounded-lg bg-slate-900/95 p-4 text-sm text-slate-100 shadow-xl">
      <h3 className="mb-3 text-lg font-semibold text-orange-400">MSC Tessa 集装箱船仿真</h3>

      {/* 仿真控制 */}
      <div className="mb-4 flex gap-2">
        {!state.isRunning ? (
          <button
            onClick={onStart}
            className="flex-1 rounded bg-green-600 px-3 py-2 hover:bg-green-500"
          >
            开始仿真
          </button>
        ) : (
          <button
            onClick={onPause}
            className="flex-1 rounded bg-yellow-600 px-3 py-2 hover:bg-yellow-500"
          >
            {state.isPaused ? '继续' : '暂停'}
          </button>
        )}
        <button
          onClick={onReset}
          className="flex-1 rounded bg-slate-600 px-3 py-2 hover:bg-slate-500"
        >
          重置
        </button>
      </div>

      {/* 目标航向 */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-400">目标航向: {state.targetHeading.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          value={state.targetHeading}
          onChange={(e) => onTargetHeadingChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>

      {/* 装载率 */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-400">
          装载率: {(state.loadRatio * 100).toFixed(0)}%
          <span className="ml-2 text-orange-400">
            ({state.loadRatio < 0.3 ? '空载' : state.loadRatio < 0.7 ? '半载' : '满载'})
          </span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={state.loadRatio * 100}
          onChange={(e) => onLoadRatioChange(Number(e.target.value) / 100)}
          className="w-full accent-orange-500"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>K={state.currentK.toFixed(3)}</span>
          <span>T={state.currentT.toFixed(0)}s</span>
        </div>
      </div>

      {/* 风速 */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-400">风速: {state.windSpeed.toFixed(1)} m/s</label>
        <input
          type="range"
          min="0"
          max="25"
          step="0.5"
          value={state.windSpeed}
          onChange={(e) => onWindSpeedChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* 风向 */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-400">风向: {state.windDirection.toFixed(0)}°</label>
        <input
          type="range"
          min="0"
          max="360"
          value={state.windDirection}
          onChange={(e) => onWindDirectionChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* 控制模式 */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-400">控制模式</label>
        <div className="flex flex-wrap gap-1">
          {(['manual', 'p', 'pd', 'pid', 'pid_scheduled'] as ControlMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onControlModeChange(mode)}
              className={`rounded px-2 py-1 text-xs ${
                state.controlMode === mode
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600'
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
          className="accent-orange-500"
        />
        <label htmlFor="gainScheduling" className="text-xs text-slate-400">
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
    <div className="absolute right-4 top-4 w-72 rounded-lg bg-slate-900/95 p-4 text-sm text-slate-100 shadow-xl">
      <h3 className="mb-3 text-lg font-semibold text-orange-400">状态监控</h3>

      {/* 时间 */}
      <div className="mb-2 flex justify-between border-b border-slate-700 pb-2">
        <span className="text-slate-400">仿真时间</span>
        <span className="font-mono text-orange-400">{state.time.toFixed(1)}s</span>
      </div>

      {/* 航向信息 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-slate-500">当前航向</div>
          <div className="font-mono text-lg text-white">{state.heading.toFixed(1)}°</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">航向误差</div>
          <div className={`font-mono text-lg ${Math.abs(normalizedError) > 5 ? 'text-red-400' : 'text-green-400'}`}>
            {normalizedError.toFixed(1)}°
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">转艏角速度</div>
          <div className="font-mono text-white">{state.yawRate.toFixed(2)}°/s</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">舵角</div>
          <div className="font-mono text-white">{state.rudder.toFixed(1)}°</div>
        </div>
      </div>

      {/* 横摇警告 */}
      {Math.abs(toDegrees(state.rollAngle)) > 8 && (
        <div className="mb-3 rounded bg-red-900/50 p-2 text-center text-red-300">
          ⚠️ 横摇角过大: {toDegrees(state.rollAngle).toFixed(1)}° - 落箱风险!
        </div>
      )}

      {/* 系统参数 */}
      <div className="mb-3 rounded bg-slate-800 p-2">
        <div className="mb-1 text-xs font-semibold text-slate-400">当前系统参数</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>K = {state.currentK.toFixed(3)}</div>
          <div>T = {state.currentT.toFixed(0)}s</div>
          <div>装载 = {(state.loadRatio * 100).toFixed(0)}%</div>
          <div>航速 = {state.speed.toFixed(1)} m/s</div>
        </div>
      </div>

      {/* 风载荷 */}
      <div className="rounded bg-slate-800 p-2">
        <div className="mb-1 text-xs font-semibold text-slate-400">风载荷</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>风速 = {state.windSpeed.toFixed(1)} m/s</div>
          <div>风向 = {state.windDirection.toFixed(0)}°</div>
          <div>横摇 = {toDegrees(state.rollAngle).toFixed(1)}°</div>
          <div className={state.windSpeed > 15 ? 'text-yellow-400' : ''}>
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
}: {
  state: ContainerSimulationState;
  trajectory: Vector2[];
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[-500, 200, 500]} fov={60} />
      <CameraController position={state.position} />

      {/* 环境 */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[500, 500, 200]} intensity={1} castShadow />
      <Environment preset="sunset" />
      <fog attach="fog" args={['#0f172a', 1000, 15000]} />

      {/* 海面 */}
      <Ocean />

      {/* 参考网格 */}
      <Grid
        args={[20000, 20000]}
        cellSize={100}
        cellThickness={0.5}
        cellColor="#1e3a5f"
        sectionSize={500}
        sectionThickness={1}
        sectionColor="#2563eb"
        fadeDistance={8000}
        fadeStrength={1}
        position={[0, 0.1, 0]}
      />

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
      <ContainerShipModel
        position={state.position}
        heading={toRadians(state.heading)}
        rollAngle={state.rollAngle}
        loadRatio={state.loadRatio}
      />

      {/* 控制器 */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={200}
        maxDistance={3000}
        maxPolarAngle={Math.PI / 2.1}
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
    if (!engine || simState.isPaused) {
      frameRef.current = requestAnimationFrame(simulationLoop);
      return;
    }

    const now = performance.now();
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = now;

    // 执行仿真步进
    engine.step(
      simState.targetHeading,
      null,
      simState.controlMode,
      0,
      simState.speed,
      dt,
      simState.time + dt
    );

    // 获取状态
    const state = engine.getState(simState.time + dt);
    const summary = engine.getContainerShipSummary();

    // 更新轨迹 (每秒采样)
    if (Math.floor(simState.time) !== Math.floor(simState.time + dt)) {
      setTrajectory(prev => [...prev.slice(-300), state.position]);
    }

    setSimState(prev => ({
      ...prev,
      time: prev.time + dt,
      position: state.position,
      heading: state.heading,
      yawRate: state.yawRate,
      rudder: state.rudder,
      rollAngle: state.waveRoll,
      currentK: summary.currentK,
      currentT: summary.currentT,
    }));

    frameRef.current = requestAnimationFrame(simulationLoop);
  }, [simState.isPaused, simState.targetHeading, simState.controlMode, simState.speed, simState.time]);

  // 启动/停止仿真
  useEffect(() => {
    if (simState.isRunning && !simState.isPaused) {
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
    <div className="relative h-[560px] w-full">
      <Canvas shadows gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <Scene state={simState} trajectory={trajectory} />
        </Suspense>
      </Canvas>

      {/* 控制面板 */}
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

      {/* HUD */}
      <HUD state={simState} />
    </div>
  );
}
