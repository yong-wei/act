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
import {
  UnifiedCameraController,
  CameraViewSwitcher,
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
import { toDegrees, toRadians, LNG_CHANGHENG_PARAMS } from '../core/constants';

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
      groupRef.current.position.z = position.z;
      groupRef.current.rotation.y = -heading + Math.PI / 2;
      // 晃荡影响船体横摇
      groupRef.current.rotation.z = sloshingAngle * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={[0, modelHeight * 0.5, 0]}>
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

  return (
    <group>
      {/* 目标航向 (绿色虚线) */}
      <Line
        points={[[position.x, 5, position.z], targetEnd]}
        color="#22c55e"
        lineWidth={2}
        dashed
        dashSize={20}
        gapSize={10}
      />
      {/* 当前航向 (蓝色实线) */}
      <Line
        points={[[position.x, 5, position.z], currentEnd]}
        color="#3b82f6"
        lineWidth={3}
      />
    </group>
  );
}


// ============ HUD 组件 ============

function HUD({
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
    <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
      <div className="flex justify-between items-start">
        {/* 左侧: 状态面板 */}
        <div className="bg-black/70 text-white p-4 rounded-lg pointer-events-auto min-w-[280px]">
          <h2 className="text-lg font-bold mb-3 text-blue-400">长恒系列 LNG 船</h2>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-gray-400">时间:</span>
            <span>{state.time.toFixed(1)}s</span>

            <span className="text-gray-400">航向:</span>
            <span>{state.heading.toFixed(1)}°</span>

            <span className="text-gray-400">目标航向:</span>
            <span className="text-green-400">{state.targetHeading.toFixed(1)}°</span>

            <span className="text-gray-400">航向误差:</span>
            <span className={Math.abs(state.heading - state.targetHeading) > 5 ? 'text-yellow-400' : 'text-green-400'}>
              {(state.heading - state.targetHeading).toFixed(1)}°
            </span>

            <span className="text-gray-400">转艏率:</span>
            <span>{state.yawRate.toFixed(2)}°/s</span>

            <span className="text-gray-400">舵角:</span>
            <span>{state.rudder.toFixed(1)}°</span>

            <span className="text-gray-400">航速:</span>
            <span>{(state.speed * 1.944).toFixed(1)} kn</span>
          </div>

          <div className="border-t border-gray-600 my-3"></div>

          <div className="text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400">液货晃荡:</span>
              <span className={state.sloshingAngle > 5 ? 'text-red-400' : 'text-blue-400'}>
                {state.sloshingAngle.toFixed(2)}°
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">货舱压力:</span>
              <span className={state.tankPressure > 150 ? 'text-red-400' : 'text-blue-400'}>
                {state.tankPressure.toFixed(0)} kPa
              </span>
            </div>
          </div>

          <div className="border-t border-gray-600 my-3"></div>

          <div className="text-xs text-yellow-400 bg-yellow-400/10 p-2 rounded">
            ⚠️ 时滞: 25秒 | 晃荡周期: ~12s
          </div>
        </div>

        {/* 右侧: 控制面板 */}
        <div className="bg-black/70 text-white p-4 rounded-lg pointer-events-auto min-w-[240px]">
          <h3 className="font-bold mb-3">控制面板</h3>

          {/* 控制模式 */}
          <div className="mb-3">
            <label className="text-sm text-gray-400 block mb-1">控制模式</label>
            <select
              value={state.controlMode}
              onChange={(e) => onControlModeChange(e.target.value as ControlMode)}
              className="w-full bg-gray-800 text-white p-2 rounded"
            >
              <option value="manual">手动</option>
              <option value="p">P 控制</option>
              <option value="pd">PD 控制</option>
              <option value="pid">PID 控制</option>
              <option value="autopilot">自动舵</option>
            </select>
          </div>

          {/* 目标航向 */}
          <div className="mb-3">
            <label className="text-sm text-gray-400 block mb-1">
              目标航向: {state.targetHeading}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              value={state.targetHeading}
              onChange={(e) => onTargetHeadingChange(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Smith 预估器开关 */}
          <div className="mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.smithEnabled}
                onChange={onSmithToggle}
                className="w-4 h-4"
              />
              <span className="text-sm">启用 Smith 预估器</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">消除25秒时滞影响</p>
          </div>

          {/* 控制按钮 */}
          <div className="flex gap-2">
            <button
              onClick={onStartPause}
              className={`flex-1 py-2 px-4 rounded ${
                state.isRunning && !state.isPaused
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {state.isRunning && !state.isPaused ? '暂停' : '开始'}
            </button>
            <button
              onClick={onReset}
              className="flex-1 py-2 px-4 rounded bg-red-600 hover:bg-red-700"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 3D 场景 ============

function Scene({
  state,
  trajectory,
  cameraMode,
  onCameraModeChange,
  controlsRef,
}: {
  state: LNGSimulationState;
  trajectory: Vector2[];
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[-400, 300, 400]} fov={60} near={1} far={50000} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[200, 300, 200]} intensity={1.5} castShadow />

      <MaritimeEnvironment shipPosition={state.position} seaState={3} />

      <Grid
        args={[10000, 10000]}
        cellSize={100}
        cellThickness={0.5}
        cellColor="#1e40af"
        sectionSize={500}
        sectionThickness={1}
        sectionColor="#3b82f6"
        fadeDistance={5000}
        position={[0, 0.1, 0]}
      />

      <LNGShipModel
        position={state.position}
        heading={toRadians(state.heading)}
        sloshingAngle={state.sloshingAngle}
      />

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
        onStart={() => onCameraModeChange('free')}
      />
      <UnifiedCameraController
        position={state.position}
        headingRad={toRadians(state.heading)}
        cameraMode={cameraMode}
        controlsRef={controlsRef}
        config={{
          chaseDistance: 500,
          chaseHeight: 200,
          overheadHeight: 1500,
        }}
      />
    </>
  );
}

// ============ 主组件 ============

export function LNGSimulation() {
  const engineRef = useRef<LNGCarrierEngine | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
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
    const engine = createSimulationEngine(lngChanghengProfile) as LNGCarrierEngine;
    engine.initialize(-3000, 0, 0);
    engineRef.current = engine;
  }, []);

  // 仿真循环
  const simulationStep = useCallback((timestamp: number) => {
    if (!engineRef.current) return;

    const dt = 0.5; // 固定步长
    const now = timestamp / 1000;

    if (now - lastTimeRef.current >= dt) {
      lastTimeRef.current = now;

      engineRef.current.step(
        state.targetHeading,
        null,
        state.controlMode,
        0,
        LNG_CHANGHENG_PARAMS.CRUISE_SPEED,
        dt,
        state.time
      );

      const engineState = engineRef.current.getState(state.time + dt);
      const sloshingMetrics = engineRef.current.getSloshingMetrics();

      setState((prev) => ({
        ...prev,
        time: prev.time + dt,
        position: engineState.position,
        heading: engineState.heading,
        yawRate: engineState.yawRate,
        rudder: engineState.rudder,
        speed: engineState.speed,
        sloshingAngle: sloshingMetrics.angleDeg,
        tankPressure: sloshingMetrics.pressure,
      }));

      // 更新轨迹
      setTrajectory((prev) => {
        const newPoint = { ...engineState.position };
        const newTraj = [...prev, newPoint];
        return newTraj.length > 500 ? newTraj.slice(-500) : newTraj;
      });
    }

    if (state.isRunning && !state.isPaused) {
      animationRef.current = requestAnimationFrame(simulationStep);
    }
  }, [state.isRunning, state.isPaused, state.targetHeading, state.controlMode, state.time]);

  // 控制仿真启停
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      lastTimeRef.current = performance.now() / 1000;
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
    <div className="w-full h-screen relative bg-slate-900">
      <Canvas shadows>
        <Suspense fallback={null}>
          <Scene
            state={state}
            trajectory={trajectory}
            cameraMode={cameraMode}
            onCameraModeChange={setCameraMode}
            controlsRef={controlsRef}
          />
        </Suspense>
      </Canvas>

      <HUD
        state={state}
        onControlModeChange={handleControlModeChange}
        onTargetHeadingChange={handleTargetHeadingChange}
        onSmithToggle={handleSmithToggle}
        onStartPause={handleStartPause}
        onReset={handleReset}
      />

      {/* 视角切换器 */}
      <CameraViewSwitcher
        currentMode={cameraMode}
        onModeChange={setCameraMode}
        className="absolute bottom-4 left-1/2 -translate-x-1/2"
      />
    </div>
  );
}

export default LNGSimulation;
