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
  useGLTF,
  PerspectiveCamera,
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
  Vector2,
  ComfortMetrics,
} from '../core/types';
import { cruiseAdoraProfile, getCruiseDefaultConfig } from '../profiles/cruise-adora';
import {
  CruiseShipEngine,
  createSimulationEngine,
} from '../physics/engine-factory';
import { toDegrees, toRadians, CRUISE_ADORA_PARAMS, CRUISE_COMFORT_THRESHOLDS } from '../core/constants';

// ============ 类型定义 ============

interface CruiseSimulationState {
  isRunning: boolean;
  isPaused: boolean;
  time: number;
  position: Vector2;
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  rollAngle: number;
  targetHeading: number;
  controlMode: ControlMode;
  seaState: number;
  waveDirection: number;
  finStabilizerEnabled: boolean;
  notchFilterEnabled: boolean;
  comfort: ComfortMetrics;
  finPower: number;
  portFinAngle: number;
  starboardFinAngle: number;
}

// ============ 海面组件 ============

function Ocean({ seaState }: { seaState: number }) {
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
        waterColor: { value: new THREE.Color('#0a5c8f') },
        foamColor: { value: new THREE.Color('#ffffff') },
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
  }, [waveAmplitude]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={shaderMaterial}>
      <planeGeometry args={[25000, 25000, 128, 128]} />
    </mesh>
  );
}

// ============ 邮轮模型组件 ============

function CruiseShipModel({
  position,
  heading,
  rollAngle,
}: {
  position: Vector2;
  heading: number;
  rollAngle: number;
}) {
  const { scene } = useGLTF('/assets/luxury-liner.glb');
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
      groupRef.current.position.z = position.z;
      groupRef.current.rotation.y = -heading + Math.PI / 2;
      groupRef.current.rotation.z = rollAngle;
    }
  });

  return (
    <group ref={groupRef} position={[0, modelHeight * 0.5, 0]}>
      <primitive object={model} scale={scale} />
      {/* 船艏标记 */}
      <mesh position={[0, modelHeight * 0.6, 0]}>
        <sphereGeometry args={[6, 16, 16]} />
        <meshBasicMaterial color="#8b5cf6" />
      </mesh>
    </group>
  );
}

// 预加载模型
useGLTF.preload('/assets/luxury-liner.glb');

// ============ 航迹线组件 ============

function TrajectoryLine({ points }: { points: Vector2[] }) {
  const linePoints = useMemo(() => {
    return points.map((p) => [p.x, 0.5, p.z] as [number, number, number]);
  }, [points]);

  if (linePoints.length < 2) return null;

  return (
    <Line
      points={linePoints}
      color="#8b5cf6"
      lineWidth={2}
      dashed={false}
    />
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
      <Line
        points={[[position.x, 2, position.z], targetEnd]}
        color="#22c55e"
        lineWidth={2}
        dashed
        dashScale={30}
      />
      <Line
        points={[[position.x, 2, position.z], currentEnd]}
        color="#8b5cf6"
        lineWidth={3}
      />
    </>
  );
}

// ============ 相机控制器 ============


// ============ 舒适度仪表盘 ============

function ComfortGauge({ comfort }: { comfort: ComfortMetrics }) {
  const getColor = () => {
    switch (comfort.comfortRating) {
      case 'excellent': return '#22c55e';
      case 'good': return '#84cc16';
      case 'moderate': return '#eab308';
      case 'poor': return '#f97316';
      case 'unacceptable': return '#ef4444';
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
    <div className="rounded-lg bg-slate-800 p-3">
      <div className="mb-2 text-xs font-semibold text-slate-400">舒适度评估</div>
      <div className="relative mx-auto h-24 w-40">
        {/* 仪表背景 */}
        <svg viewBox="0 0 100 60" className="h-full w-full">
          {/* 背景弧 */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#334155"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* 分区颜色 */}
          <path d="M 10 50 A 40 40 0 0 1 26 22" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
          <path d="M 26 22 A 40 40 0 0 1 50 10" fill="none" stroke="#84cc16" strokeWidth="8" strokeLinecap="round" />
          <path d="M 50 10 A 40 40 0 0 1 74 22" fill="none" stroke="#eab308" strokeWidth="8" strokeLinecap="round" />
          <path d="M 74 22 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
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
        <div className="text-xs text-slate-400">MSI: {comfort.msi.toFixed(1)}%</div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-slate-500">横摇RMS</span>
          <span className="ml-1 text-white">{comfort.rollRms.toFixed(2)}°</span>
        </div>
        <div>
          <span className="text-slate-500">横摇峰值</span>
          <span className="ml-1 text-white">{comfort.rollPeak.toFixed(2)}°</span>
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
    <div className="rounded-lg bg-slate-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">减摇鳍</span>
        <button
          onClick={onToggle}
          className={`rounded px-2 py-0.5 text-xs ${
            enabled ? 'bg-green-600' : 'bg-slate-600'
          }`}
        >
          {enabled ? '已启用' : '已禁用'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* 左舷鳍 */}
        <div className="text-center">
          <div className="relative mx-auto h-12 w-4 rounded bg-slate-700">
            <div
              className="absolute bottom-1/2 left-0 h-0.5 w-full origin-left bg-purple-400"
              style={{ transform: `rotate(${-portAngle}deg)` }}
            />
          </div>
          <div className="mt-1 text-xs text-slate-400">左舷</div>
          <div className="text-xs text-white">{portAngle.toFixed(1)}°</div>
        </div>
        {/* 右舷鳍 */}
        <div className="text-center">
          <div className="relative mx-auto h-12 w-4 rounded bg-slate-700">
            <div
              className="absolute bottom-1/2 left-0 h-0.5 w-full origin-left bg-purple-400"
              style={{ transform: `rotate(${-starboardAngle}deg)` }}
            />
          </div>
          <div className="mt-1 text-xs text-slate-400">右舷</div>
          <div className="text-xs text-white">{starboardAngle.toFixed(1)}°</div>
        </div>
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">功率</span>
          <span className={power > 400 ? 'text-yellow-400' : 'text-white'}>
            {power.toFixed(0)} kW
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full ${power > 400 ? 'bg-yellow-400' : 'bg-purple-400'}`}
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
    <div className="rounded-lg bg-slate-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">陷波滤波器</span>
        <button
          onClick={onToggle}
          className={`rounded px-2 py-0.5 text-xs ${
            enabled ? 'bg-green-600' : 'bg-slate-600'
          }`}
        >
          {enabled ? '已启用' : '已禁用'}
        </button>
      </div>
      <div className="text-xs text-slate-400">
        <div className="mb-1">中心频率: 0.16 Hz</div>
        <div className="mb-1">带宽: 0.15 Hz</div>
        <div>陷波深度: -30 dB</div>
      </div>
      {/* 简化 Bode 图 */}
      <div className="mt-2 h-12 rounded bg-slate-700 p-1">
        <svg viewBox="0 0 100 30" className="h-full w-full">
          {/* 频率轴 */}
          <line x1="10" y1="25" x2="95" y2="25" stroke="#64748b" strokeWidth="0.5" />
          {/* 幅频响应 */}
          <path
            d={enabled
              ? "M 10 10 Q 30 10, 40 8 Q 50 25, 60 8 Q 70 10, 90 10"
              : "M 10 15 L 90 15"
            }
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="1.5"
          />
          {/* 致晕频段标记 */}
          <rect x="35" y="5" width="30" height="20" fill="#ef444420" />
          <text x="50" y="3" fontSize="3" fill="#ef4444" textAnchor="middle">0.1-0.3Hz</text>
        </svg>
      </div>
    </div>
  );
}

// ============ 控制面板 ============

function ControlPanel({
  state,
  onTargetHeadingChange,
  onControlModeChange,
  onSeaStateChange,
  onWaveDirectionChange,
  onFinStabilizerToggle,
  onNotchFilterToggle,
  onStart,
  onPause,
  onReset,
}: {
  state: CruiseSimulationState;
  onTargetHeadingChange: (heading: number) => void;
  onControlModeChange: (mode: ControlMode) => void;
  onSeaStateChange: (level: number) => void;
  onWaveDirectionChange: (direction: number) => void;
  onFinStabilizerToggle: () => void;
  onNotchFilterToggle: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute left-4 top-4 w-72 space-y-3 rounded-lg bg-slate-900/95 p-4 text-sm text-slate-100 shadow-xl">
      <h3 className="text-lg font-semibold text-purple-400">爱达·魔都号 邮轮仿真</h3>

      {/* 仿真控制 */}
      <div className="flex gap-2">
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
      <div>
        <label className="mb-1 block text-xs text-slate-400">目标航向: {state.targetHeading.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          value={state.targetHeading}
          onChange={(e) => onTargetHeadingChange(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
      </div>

      {/* 海况等级 */}
      <div>
        <label className="mb-1 block text-xs text-slate-400">
          海况等级: {state.seaState}级
          <span className="ml-2 text-purple-400">
            ({state.seaState <= 2 ? '轻浪' : state.seaState <= 4 ? '中浪' : '大浪'})
          </span>
        </label>
        <input
          type="range"
          min="1"
          max="7"
          value={state.seaState}
          onChange={(e) => onSeaStateChange(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
      </div>

      {/* 波向 */}
      <div>
        <label className="mb-1 block text-xs text-slate-400">
          相对波向: {state.waveDirection}°
          <span className="ml-2 text-purple-400">
            ({state.waveDirection === 90 || state.waveDirection === 270 ? '横浪' : state.waveDirection === 0 || state.waveDirection === 180 ? '纵浪' : '斜浪'})
          </span>
        </label>
        <input
          type="range"
          min="0"
          max="360"
          value={state.waveDirection}
          onChange={(e) => onWaveDirectionChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* 控制模式 */}
      <div>
        <label className="mb-1 block text-xs text-slate-400">控制模式</label>
        <div className="flex flex-wrap gap-1">
          {(['manual', 'p', 'pd', 'pid'] as ControlMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onControlModeChange(mode)}
              className={`rounded px-2 py-1 text-xs ${
                state.controlMode === mode
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

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

  return (
    <div className="absolute right-4 top-4 w-64 space-y-3 rounded-lg bg-slate-900/95 p-4 text-sm text-slate-100 shadow-xl">
      <h3 className="text-lg font-semibold text-purple-400">状态监控</h3>

      {/* 时间 */}
      <div className="flex justify-between border-b border-slate-700 pb-2">
        <span className="text-slate-400">仿真时间</span>
        <span className="font-mono text-purple-400">{state.time.toFixed(1)}s</span>
      </div>

      {/* 航向信息 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-slate-500">当前航向</div>
          <div className="font-mono text-lg text-white">{state.heading.toFixed(1)}°</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">航向误差</div>
          <div className={`font-mono text-lg ${Math.abs(normalizedError) > 3 ? 'text-red-400' : 'text-green-400'}`}>
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

      {/* 横摇信息 */}
      <div className="rounded bg-slate-800 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-slate-500">横摇角</span>
          <span className={`font-mono ${Math.abs(rollDeg) > 4 ? 'text-red-400' : Math.abs(rollDeg) > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
            {rollDeg.toFixed(2)}°
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full transition-all ${
              Math.abs(rollDeg) > 4 ? 'bg-red-400' : Math.abs(rollDeg) > 2 ? 'bg-yellow-400' : 'bg-green-400'
            }`}
            style={{ width: `${Math.min(Math.abs(rollDeg) / 6 * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* 舒适度仪表盘 */}
      <ComfortGauge comfort={state.comfort} />

      {/* 横摇警告 */}
      {Math.abs(rollDeg) > CRUISE_COMFORT_THRESHOLDS.MODERATE_ROLL && (
        <div className="rounded bg-red-900/50 p-2 text-center text-xs text-red-300">
          ⚠️ 横摇角过大，乘客可能不适
        </div>
      )}
    </div>
  );
}

// ============ 主仿真组件 ============

export default function CruiseSimulation() {
  const engineRef = useRef<CruiseShipEngine | null>(null);
  const trajectoryRef = useRef<Vector2[]>([]);
  const lastTrajectoryTime = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const defaultConfig = getCruiseDefaultConfig();

  const [state, setState] = useState<CruiseSimulationState>({
    isRunning: false,
    isPaused: false,
    time: 0,
    position: { x: 0, z: 0 },
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: CRUISE_ADORA_PARAMS.CRUISE_SPEED,
    rollAngle: 0,
    targetHeading: 0,
    controlMode: 'pid',
    seaState: 3,
    waveDirection: 90,
    finStabilizerEnabled: true,
    notchFilterEnabled: true,
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
  });

  // 初始化引擎
  useEffect(() => {
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
    if (!engineRef.current || state.isPaused) {
      animationRef.current = requestAnimationFrame(simulate);
      return;
    }

    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = timestamp;

    if (dt > 0) {
      const time = state.time + dt;

      // 更新引擎配置
      engineRef.current.setSeaState(state.seaState, state.waveDirection);
      engineRef.current.setFinStabilizerEnabled(state.finStabilizerEnabled);
      engineRef.current.setNotchFilterEnabled(state.notchFilterEnabled);

      // 执行仿真步进
      engineRef.current.step(
        state.targetHeading,
        null,
        state.controlMode,
        0,
        state.speed,
        dt,
        time
      );

      // 获取状态
      const simState = engineRef.current.getState(time);
      const comfort = engineRef.current.getComfortMetrics();
      const finMetrics = engineRef.current.getFinStabilizerMetrics();
      const internalState = engineRef.current.getInternalState();

      // 记录航迹
      if (time - lastTrajectoryTime.current > 0.5) {
        trajectoryRef.current.push({ ...simState.position });
        if (trajectoryRef.current.length > 2000) {
          trajectoryRef.current.shift();
        }
        lastTrajectoryTime.current = time;
      }

      setState((prev) => ({
        ...prev,
        time,
        position: simState.position,
        heading: simState.heading,
        yawRate: simState.yawRate,
        rudder: simState.rudder,
        speed: simState.speed,
        rollAngle: simState.waveRoll,
        comfort,
        finPower: finMetrics.powerKW,
        portFinAngle: internalState.fin.portFinAngleDeg,
        starboardFinAngle: internalState.fin.starboardFinAngleDeg,
      }));
    }

    animationRef.current = requestAnimationFrame(simulate);
  }, [state.isPaused, state.time, state.targetHeading, state.controlMode, state.speed, state.seaState, state.waveDirection, state.finStabilizerEnabled, state.notchFilterEnabled]);

  // 启动仿真
  const handleStart = useCallback(() => {
    if (!state.isRunning) {
      lastTimeRef.current = performance.now();
      setState((prev) => ({ ...prev, isRunning: true, isPaused: false }));
      animationRef.current = requestAnimationFrame(simulate);
    }
  }, [state.isRunning, simulate]);

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
    setState({
      isRunning: false,
      isPaused: false,
      time: 0,
      position: { x: -3000, z: 0 },
      heading: 0,
      yawRate: 0,
      rudder: 0,
      speed: CRUISE_ADORA_PARAMS.CRUISE_SPEED,
      rollAngle: 0,
      targetHeading: 0,
      controlMode: 'pid',
      seaState: 3,
      waveDirection: 90,
      finStabilizerEnabled: true,
      notchFilterEnabled: true,
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
    });
  }, []);

  // 处理器
  const handleTargetHeadingChange = useCallback((heading: number) => {
    setState((prev) => ({ ...prev, targetHeading: heading }));
  }, []);

  const handleControlModeChange = useCallback((mode: ControlMode) => {
    setState((prev) => ({ ...prev, controlMode: mode }));
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

  return (
    <div className="relative h-screen w-full bg-slate-950">
      <Canvas shadows camera={{ position: [-500, 300, 800], fov: 50, near: 1, far: 50000 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[200, 300, 200]} intensity={1.5} castShadow />
          <MaritimeEnvironment shipPosition={state.position} seaState={state.seaState} />
          <CruiseShipModel
            position={state.position}
            heading={toRadians(state.heading)}
            rollAngle={state.rollAngle}
          />
          <TrajectoryLine points={trajectoryRef.current} />
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
            maxPolarAngle={Math.PI / 2.2}
            minDistance={200}
            maxDistance={3000}
            onStart={() => setCameraMode('free')}
          />
          <UnifiedCameraController
            position={state.position}
            headingRad={toRadians(state.heading)}
            cameraMode={cameraMode}
            controlsRef={controlsRef}
          />
        </Suspense>
      </Canvas>

      <CameraViewSwitcher
        currentMode={cameraMode}
        onModeChange={setCameraMode}
        className="absolute top-4 right-4"
      />

      <ControlPanel
        state={state}
        onTargetHeadingChange={handleTargetHeadingChange}
        onControlModeChange={handleControlModeChange}
        onSeaStateChange={handleSeaStateChange}
        onWaveDirectionChange={handleWaveDirectionChange}
        onFinStabilizerToggle={handleFinStabilizerToggle}
        onNotchFilterToggle={handleNotchFilterToggle}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
      />

      <HUD state={state} />

      {/* 说明 */}
      <div className="absolute bottom-4 left-4 rounded bg-slate-900/80 p-2 text-xs text-slate-400">
        <div>拖拽旋转视角 | 滚轮缩放 | 右键平移</div>
        <div className="mt-1 text-purple-400">
          知识点: 频率响应 (Ch5), 陷波滤波器 (Ch6)
        </div>
      </div>
    </div>
  );
}
