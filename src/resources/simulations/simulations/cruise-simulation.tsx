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
import { MaritimeEnvironment } from '../environment';
import { SimulationClock } from '@/lib/simulation';
import {
  UnifiedCameraController,
  CameraViewSwitcher,
  SimulationTopBar,
  SimulationDock,
  simulationUi,
  type CameraMode,
} from '../components';
import { AICompanionPanel } from '@/features/ai/companion/ai-companion-panel';

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
  pidGains: CruiseControllerParams;
  targetForm: CruiseTargetForm;
  prompt: {
    controlObject: string;
    performanceGoal: string;
    constraints: string;
    strategy: string;
  };
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

function toCruiseControllerMode(mode: ControlMode): CruiseControllerMode {
  if (mode === 'p') return 'p';
  if (mode === 'pd') return 'pd';
  return 'pid';
}

const CRUISE_ROUTE_START: Vector2 = { x: -3000, z: 0 };
const CRUISE_ROUTE_STRAIGHT_DISTANCE = 1800;
const CRUISE_ROUTE_TURN_HEADING = 30;
const CRUISE_ROUTE_EXTENSION = 5200;

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
      groupRef.current.position.y = modelHeight * 0.5 - CRUISE_ADORA_PARAMS.DRAFT;
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

function DesiredRouteLine({ points }: { points: Vector2[] }) {
  const linePoints = useMemo(() => points.map((p) => [p.x, 1.2, p.z] as [number, number, number]), [points]);
  if (linePoints.length < 2) return null;

  return (
    <Line
      points={linePoints}
      color="#22c55e"
      lineWidth={2.2}
      dashed
      dashSize={36}
      gapSize={16}
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
  isCourseMode,
  onPidGainsChange,
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
  isCourseMode: boolean;
  onPidGainsChange: (key: keyof CruiseControllerParams, value: number) => void;
  onControlModeChange: (mode: ControlMode) => void;
  onSeaStateChange: (level: number) => void;
  onWaveDirectionChange: (direction: number) => void;
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

      {/* 仿真控制 */}
      <div className="flex gap-2">
        {!state.isRunning ? (
          <button
            onClick={onStart}
            className={`flex-1 rounded border px-3 py-2 ${simulationUi.buttonPrimary}`}
          >
            开始仿真
          </button>
        ) : (
          <button
            onClick={onPause}
            className={`flex-1 rounded border px-3 py-2 ${simulationUi.buttonSecondary}`}
          >
            {state.isPaused ? '继续' : '暂停'}
          </button>
        )}
        <button
          onClick={onReset}
          className={`flex-1 rounded border px-3 py-2 ${simulationUi.buttonOutline}`}
        >
          重置
        </button>
      </div>

      {/* 任务航向 */}
      <div>
        <label className="mb-1 block text-xs text-slate-400">任务目标航向: {state.targetHeading.toFixed(0)}°</label>
        <div className="rounded border border-slate-300 bg-white/80 px-2 py-1 text-xs text-slate-700">
          航线规则：先直航 {CRUISE_ROUTE_STRAIGHT_DISTANCE}m，再右转 {CRUISE_ROUTE_TURN_HEADING}° 并保持航向。
        </div>
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
          className={simulationUi.nativeRange}
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
          className={simulationUi.nativeRange}
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

      {isCourseMode ? (
        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
          <div className="text-xs font-semibold text-slate-200">控制器参数</div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] text-slate-300">
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
                    ? 'border-slate-700 bg-slate-950 text-white'
                    : 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                }`}
              />
            </label>
            <label className="text-[11px] text-slate-300">
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
                    ? 'border-slate-700 bg-slate-950 text-white'
                    : 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                }`}
              />
            </label>
            <label className="text-[11px] text-slate-300">
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
                    ? 'border-slate-700 bg-slate-950 text-white'
                    : 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500'
                }`}
              />
            </label>
          </div>
          <div className="text-[11px] text-slate-500">{modeHint}</div>
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

  return (
    <div className="space-y-3 p-1 text-sm">

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

function CruiseTradeoffPanel({
  state,
  isCourseMode,
  performance,
  consistencyScore,
  consistencyComment,
  consistencyLoading,
  onTargetFormChange,
  onGenerateConsistencyComment,
}: {
  state: CruiseSimulationState;
  isCourseMode: boolean;
  performance: ReturnType<typeof computePerformanceFromController>;
  consistencyScore: ReturnType<typeof computeConsistencyScore>;
  consistencyComment: string;
  consistencyLoading: boolean;
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
      {isCourseMode ? (
        <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700">
          <div className="font-semibold text-slate-900">性能指标约束</div>
          <div className="grid grid-cols-2 gap-2">
            <label>
              目标超调(%)
              <input
                type="number"
                step={1}
                min={1}
                value={state.targetForm.overshoot}
                onChange={(event) => onTargetFormChange('overshoot', Number(event.target.value))}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
              />
            </label>
            <label>
              目标调节时间(s)
              <input
                type="number"
                step={1}
                min={1}
                value={state.targetForm.settlingTime}
                onChange={(event) => onTargetFormChange('settlingTime', Number(event.target.value))}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
              />
            </label>
            <label>
              稳态误差(%)
              <input
                type="number"
                step={0.1}
                min={0}
                value={state.targetForm.steadyError}
                onChange={(event) => onTargetFormChange('steadyError', Number(event.target.value))}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
              />
            </label>
            <label>
              侧向加速度上限(g)
              <input
                type="number"
                step={0.01}
                min={0}
                value={state.targetForm.maxLateralAccel}
                onChange={(event) => onTargetFormChange('maxLateralAccel', Number(event.target.value))}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
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
          <label key={key} className="text-xs text-slate-700">
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
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
            />
          </label>
        ))}
      </div>

      <div className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700">
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
        <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-2 text-xs">
          <div className="text-slate-700">
            综合评分：<span className="font-semibold text-slate-900">{analysis.blendedScore.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-slate-700">
            <div>舒适 {analysis.objectiveScores.comfort.toFixed(1)}</div>
            <div>性能 {analysis.objectiveScores.performance.toFixed(1)}</div>
            <div>能耗 {analysis.objectiveScores.energy.toFixed(1)}</div>
          </div>
          <ul className="space-y-1 text-slate-700">
            {analysis.advice.map((item) => (
              <li key={item} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isCourseMode ? (
        <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">一致性校验</span>
            <button
              type="button"
              onClick={onGenerateConsistencyComment}
              disabled={consistencyLoading}
              className={`rounded border px-2 py-1 ${simulationUi.buttonOutline} disabled:opacity-60`}
            >
              {consistencyLoading ? '生成中...' : '生成评价'}
            </button>
          </div>
          <div>一致性得分：<span className="font-semibold text-slate-900">{consistencyScore.score}%</span></div>
          <div>超调：{performance.overshoot}% / 目标≤{state.targetForm.overshoot}%</div>
          <div>调节时间：{performance.settlingTime}s / 目标≤{state.targetForm.settlingTime}s</div>
          <div>侧向加速度：{performance.accel}g / 目标≤{state.targetForm.maxLateralAccel}g</div>
          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
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
  onPromptChange,
  onApplyPrompt,
}: {
  state: CruiseSimulationState;
  isCourseMode: boolean;
  onPromptChange: (key: keyof CruiseSimulationState['prompt'], value: string) => void;
  onApplyPrompt: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-3">
      {isCourseMode ? (
        <div className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-900">结构化提示词</span>
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
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
                />
              </label>
              <label className="block">
                性能目标
                <textarea
                  value={state.prompt.performanceGoal}
                  onChange={(event) => onPromptChange('performanceGoal', event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
                />
              </label>
              <label className="block">
                约束条件
                <textarea
                  value={state.prompt.constraints}
                  onChange={(event) => onPromptChange('constraints', event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
                />
              </label>
              <label className="block">
                调整策略
                <textarea
                  value={state.prompt.strategy}
                  onChange={(event) => onPromptChange('strategy', event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1"
                />
              </label>
              <button
                type="button"
                onClick={onApplyPrompt}
                className={`w-full rounded border px-3 py-2 ${simulationUi.buttonPrimary}`}
              >
                应用结构化提示词
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <AICompanionPanel title="邮轮舒适度控制" sessionId="cruise-comfort-session" />
    </div>
  );
}

// ============ 主仿真组件 ============

export default function CruiseSimulation() {
  const searchParams = useSearchParams();
  const isCourseMode = searchParams.get('courseMode') === CRUISE_COURSE_MODE;
  const courseRole = searchParams.get('role') === 'teacher' ? 'teacher' : 'student';
  const courseStep = searchParams.get('step') || 'engineering-target';
  const isEmbedded = searchParams.get('embed') === '1';

  const engineRef = useRef<CruiseShipEngine | null>(null);
  const trajectoryRef = useRef<Vector2[]>([]);
  const lastTrajectoryTime = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const clockRef = useRef(new SimulationClock({ dt: 1 / 60, maxSubSteps: 6 }));
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [showGrid, setShowGrid] = useState(true);

  const [state, setState] = useState<CruiseSimulationState>({
    isRunning: false,
    isPaused: false,
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
    pidGains: { ...CRUISE_DEFAULT_PID },
    targetForm: { ...DEFAULT_TARGET_FORM },
    prompt: { ...DEFAULT_PROMPT },
  });
  const [consistencyComment, setConsistencyComment] = useState('等待生成一致性评语。');
  const [consistencyCommentLoading, setConsistencyCommentLoading] = useState(false);
  const desiredRoutePoints = useMemo(() => buildCruiseDesiredRoute(), []);

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

    const frameDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
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

    clockRef.current.advance(frameDt, (dt) => {
      const time = nextTime + dt;
      nextTime = time;

      engine.setSeaState(state.seaState, state.waveDirection);
      engine.setFinStabilizerEnabled(state.finStabilizerEnabled);
      engine.setNotchFilterEnabled(state.notchFilterEnabled);
      engine.setPIDGains(state.pidGains);

      const missionTargetHeading = getCruiseMissionTargetHeading(simState.position);
      engine.step(
        missionTargetHeading,
        null,
        state.controlMode,
        0,
        state.speed,
        dt,
        time
      );

      simState = engine.getState(time);
      comfort = engine.getComfortMetrics();
      finMetrics = engine.getFinStabilizerMetrics();
      internalState = engine.getInternalState();
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
      }));
    }

    animationRef.current = requestAnimationFrame(simulate);
  }, [state.isPaused, state.time, state.controlMode, state.speed, state.seaState, state.waveDirection, state.finStabilizerEnabled, state.notchFilterEnabled, state.pidGains]);

  // 启动仿真
  const handleStart = useCallback(() => {
    if (!state.isRunning) {
      clockRef.current.reset();
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
    lastTimeRef.current = 0;
    clockRef.current.reset();
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
      pidGains: { ...CRUISE_DEFAULT_PID },
      targetForm: { ...DEFAULT_TARGET_FORM },
      prompt: { ...DEFAULT_PROMPT },
    });
    setConsistencyComment('等待生成一致性评语。');
    setConsistencyCommentLoading(false);
  }, []);

  // 处理器
  const handleControlModeChange = useCallback((mode: ControlMode) => {
    const nextMode = toCruiseControllerMode(mode);
    setState((prev) => ({
      ...prev,
      controlMode: mode,
      pidGains: normalizeControllerByMode(prev.pidGains, nextMode),
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
  }, []);

  const simulationPerformance = useMemo(() => computePerformanceFromController(state.pidGains), [state.pidGains]);
  const consistencyScore = useMemo(
    () => computeConsistencyScore(state.targetForm, simulationPerformance),
    [simulationPerformance, state.targetForm]
  );

  const generateConsistencyComment = useCallback(async () => {
    if (!isCourseMode) {
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
          result: simulationPerformance,
        }),
      });
      const data = (await response.json()) as { text?: string };
      setConsistencyComment(data.text || '一致性评语生成失败，请重试。');
    } catch {
      setConsistencyComment('一致性评语生成失败，请重试。');
    } finally {
      setConsistencyCommentLoading(false);
    }
  }, [consistencyScore, isCourseMode, simulationPerformance, state.targetForm]);

  useEffect(() => {
    if (!isCourseMode) {
      return;
    }
    const timer = window.setTimeout(() => {
      void generateConsistencyComment();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [generateConsistencyComment, isCourseMode]);

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
      },
    };
    window.parent.postMessage(message, window.location.origin);
  }, [isCourseMode, state.controlMode, state.pidGains, state.targetForm]);

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
    <div className={simulationUi.root} data-sim-ui>
      <Canvas shadows camera={{ position: [-500, 300, 800], fov: 60, near: 1, far: 50000 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[200, 300, 200]} intensity={1.5} castShadow />
          <MaritimeEnvironment shipPosition={state.position} seaState={state.seaState} />
          {showGrid ? (
            <Grid
              args={[20000, 20000]}
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
          <CruiseShipModel
            position={state.position}
            heading={toRadians(state.heading)}
            rollAngle={state.rollAngle}
          />
          <DesiredRouteLine points={desiredRoutePoints} />
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
        gridEnabled={showGrid}
        onToggleGrid={() => setShowGrid((previous) => !previous)}
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
              <ControlPanel
                state={state}
                isCourseMode={isCourseMode}
                onPidGainsChange={handlePidGainsChange}
                onControlModeChange={handleControlModeChange}
                onSeaStateChange={handleSeaStateChange}
                onWaveDirectionChange={handleWaveDirectionChange}
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
                performance={simulationPerformance}
                consistencyScore={consistencyScore}
                consistencyComment={consistencyComment}
                consistencyLoading={consistencyCommentLoading}
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
          绿色虚线：期望航线 | 紫色实线：实际航迹
        </div>
        <div className="mt-1 text-slate-700">
          知识点: 频率响应 (Ch5), 陷波滤波器 (Ch6)
        </div>
      </div>
    </div>
  );
}
