'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, extend, ReactThreeFiber } from '@react-three/fiber';
import { Line, useGLTF, shaderMaterial } from '@react-three/drei';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type ControlMode = 'manual' | 'p' | 'pd' | 'pid';
type CameraView = 'chase' | 'overhead' | 'tactical';

type TaskScenario = 'turn90' | 'obstacle' | 'circle';

type TaskDef = {
  id: string;
  title: string;
  scenario: TaskScenario;
  duration: number; // 任务持续时间(秒)
  description: string;
};

type HudState = {
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  position: { x: number; z: number };
  avgError: number; // 平均航迹误差
  currentError: number; // 当前航迹误差
  time: number;
};

type SimulationState = {
  position: THREE.Vector3;
  headingRad: number;
  yawRateRad: number;
  rudderDeg: number;
  manualRudderDeg: number;
  speedMps: number;
  integral: number;
  prevErrorRad: number;
  // 波浪相关（平滑后的值）
  waveY: number;
  wavePitch: number;
  waveRoll: number;
};

const destroyerSpecs = {
  displacement: '约 12,000-13,000 吨',
  length: '约 180 m',
  beam: '约 20 m',
  draft: '约 6.6 m',
  propulsion: '综合电力推进（估算）',
  power: '约 150,000 shp',
  maxSpeed: '约 30+ 节',
};

const nomotoModel = {
  K: 0.08,
  T: 55,
  maxRudderDeg: 35,
  speedMps: 15.0, // 默认航速调整为 15 m/s
};

const speedLimits = {
  min: 4,
  max: 22,
  accel: 3.2,
};

// 波浪参数：调整为更真实的海洋参数
const waveParams = [
  { amplitude: 1.2, frequency: 0.018, speed: 0.9, direction: { x: 1.0, z: 0.1 } }, // 主涌浪
  { amplitude: 0.9, frequency: 0.035, speed: 1.1, direction: { x: 0.4, z: 0.9 } }, // 交叉浪
  { amplitude: 0.6, frequency: 0.06, speed: 1.3, direction: { x: -0.6, z: 0.5 } }, // 干扰浪
  { amplitude: 0.35, frequency: 0.12, speed: 1.6, direction: { x: 0.3, z: -0.7 } }, // 细节浪
  { amplitude: 0.15, frequency: 0.25, speed: 2.0, direction: { x: -0.5, z: -0.6 } }, // 微波
];

function getWaveHeight(x: number, z: number, time: number): number {
  let y = 0;
  waveParams.forEach((wave) => {
    const phase = (x * wave.direction.x + z * wave.direction.z) * wave.frequency + time * wave.speed;
    y += wave.amplitude * Math.sin(phase);
  });
  return y;
}

const shipDimensions = {
  length: 180,
  width: 20,
};

// 任务定义
const tasks: TaskDef[] = [
  {
    id: 'turn-90',
    title: '直角转向任务',
    scenario: 'turn90',
    duration: 180,
    description: '60秒（约900米）时执行90度右转阶跃信号，预留反应时间。',
  },
  {
    id: 'obstacle',
    title: '复杂避障任务',
    scenario: 'obstacle',
    duration: 180,
    description: '60秒后依次执行 0° -> 45° -> 0° -> -45° -> 0° 变向。',
  },
  {
    id: 'circle',
    title: '定常回转任务',
    scenario: 'circle',
    duration: 360, // 增加时间以完成回转
    description: '起点距圆周 900 米，60 秒切入 -90° 并开始定常回转。',
  },
];

// 场景生成器逻辑
type ScenarioLogic = {
  getDesiredHeading: (t: number) => number; // 返回角度
  startPos: { x: number; z: number; headingDeg: number };
};

type CustomScenario = {
  logic: ScenarioLogic;
  guidePath: THREE.Vector3[];
  start: { x: number; z: number; headingDeg: number };
  duration: number;
};

const REF_SPEED = 15.0; // 参考航速 15m/s

const getScenarioLogic = (scenario: TaskScenario): ScenarioLogic => {
  switch (scenario) {
    case 'turn90':
      return {
        startPos: { x: -6000, z: 0, headingDeg: 0 },
        getDesiredHeading: (t: number) => {
          if (t < 60) return 0;
          return 90; // 阶跃
        },
      };
    case 'obstacle':
      return {
        startPos: { x: -2000, z: 0, headingDeg: 0 },
        getDesiredHeading: (t: number) => {
          if (t < 60) return 0;
          if (t < 90) return 45;
          if (t < 120) return 0;
          if (t < 150) return -45;
          return 0;
        },
      };
    case 'circle':
      const radius = 1350;
      const circumference = 2 * Math.PI * radius;
      const turnTime = circumference / REF_SPEED;
      const degPerSec = 360 / turnTime;
      return {
        startPos: { x: 0, z: -(radius + 900), headingDeg: 0 },
        getDesiredHeading: (t: number) => {
          if (t < 60) return 0;
          // 60秒时，阶跃到 -90 (切入圆周)，然后斜坡增加
          // 实际上是一个持续的 YawRate
          // 初始角度 -90，每秒增加 degPerSec
          return -90 + degPerSec * (t - 60);
        },
      };
  }
};

// 预计算参考航迹点
const generateGuidePath = (logic: ScenarioLogic, duration: number) => {
  const points: THREE.Vector3[] = [];
  let x = logic.startPos.x;
  let z = logic.startPos.z;
  const dt = 0.5; // 采样间隔

  // 初始点
  points.push(new THREE.Vector3(x, 0.5, z));

  for (let t = 0; t <= duration; t += dt) {
    const headingDeg = logic.getDesiredHeading(t);
    const headingRad = toRadians(headingDeg);
    // 航向 0 度对应 X 轴正向?
    // 在 ThreeJS 中，通常 -Z 是前方。
    // 但在之前的代码中： x += speed * cos(heading), z += speed * sin(heading)
    // 这意味着 0 度是 +X 方向，90 度是 +Z 方向 (右转是增加 Z? 左手系?)
    // 让我们保持原有的运动学公式一致：
    // x += speed * cos(heading)
    // z += speed * sin(heading)
    
    // 注意：如果是 Step 信号，t 时刻瞬间改变航向，下一刻位置基于新航向
    x += REF_SPEED * Math.cos(headingRad) * dt;
    z += REF_SPEED * Math.sin(headingRad) * dt;
    
    points.push(new THREE.Vector3(x, 0.5, z));
  }
  return points;
};

const cameraViews: Array<{ id: CameraView; label: string }> = [
  { id: 'chase', label: '主视角' },
  { id: 'overhead', label: '俯瞰视角' },
  { id: 'tactical', label: '战术斜角' },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const normalizeHeading = (heading: number) =>
  ((heading % 360) + 360) % 360;

const normalizeSignedHeading = (heading: number) => {
  const normalized = normalizeHeading(heading);
  return normalized > 180 ? normalized - 360 : normalized;
};

const angleDelta = (target: number, current: number) => {
  const normalizedTarget = normalizeHeading(target);
  const normalizedCurrent = normalizeHeading(current);
  let diff = normalizedTarget - normalizedCurrent;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
};

const HEADING_RANGE = { min: -180, max: 180 };
const HEADING_TIME_GAP = 0.5;

const clampHeading = (value: number) =>
  clamp(value, HEADING_RANGE.min, HEADING_RANGE.max);

const normalizeHeadingPoints = (points: HeadingPoint[]) => {
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const result: HeadingPoint[] = [];
  sorted.forEach((point) => {
    if (result.length === 0) {
      result.push(point);
      return;
    }
    const prev = result[result.length - 1];
    if (Math.abs(point.time - prev.time) < 0.001) {
      result[result.length - 1] = point;
      return;
    }
    result.push(point);
  });
  return result;
};

const sanitizeHeadingPoints = (points: HeadingPoint[], duration: number) => {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const sanitized = normalizeHeadingPoints(points)
    .map((point) => {
      const time = Number.isFinite(point.time) ? point.time : 0;
      const heading = Number.isFinite(point.heading) ? point.heading : 0;
      return {
        time: clamp(time, 0, safeDuration),
        heading: clampHeading(heading),
      };
    })
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.heading));

  if (sanitized.length < 2 && safeDuration > 0) {
    return [
      { time: 0, heading: 0 },
      { time: safeDuration, heading: 0 },
    ];
  }
  return sanitized;
};

const interpolateHeading = (points: HeadingPoint[], t: number) => {
  if (points.length === 0) return 0;
  const sorted = normalizeHeadingPoints(points);
  if (t <= sorted[0].time) return sorted[0].heading;
  const lastPoint = sorted[sorted.length - 1];
  if (t >= lastPoint.time) return lastPoint.heading;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (t <= end.time) {
      const span = end.time - start.time;
      if (span <= 0.0001) return end.heading;
      const ratio = (t - start.time) / span;
      return start.heading + ratio * (end.heading - start.heading);
    }
  }
  return lastPoint.heading;
};

const createHeadingPointsFromLogic = (
  logic: ScenarioLogic,
  duration: number,
  count = 5,
): HeadingPoint[] => {
  if (duration <= 0) {
    return [{ time: 0, heading: logic.getDesiredHeading(0) }];
  }
  const points: HeadingPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const time = (duration * i) / (count - 1);
    points.push({ time, heading: normalizeSignedHeading(logic.getDesiredHeading(time)) });
  }
  return normalizeHeadingPoints(points);
};

const buildScenarioFromHeadingPoints = (
  points: HeadingPoint[],
  start: { x: number; z: number; headingDeg: number },
  duration: number,
  guidePath: THREE.Vector3[],
): CustomScenario | null => {
  if (points.length < 2) return null;
  const logic: ScenarioLogic = {
    startPos: { ...start },
    getDesiredHeading: (t: number) => interpolateHeading(points, t),
  };
  return {
    logic,
    guidePath,
    start,
    duration,
  };
};

const runQuickSimulation = (
  points: HeadingPoint[],
  pidGains: { kp: number; ki: number; kd: number },
  controlMode: ControlMode,
  start: { x: number; z: number; headingDeg: number },
  duration: number,
  desiredPath: THREE.Vector3[],
): QuickSimResult | null => {
  if (points.length < 2) return null;

  const chart: ChartData = {
    time: [],
    desiredHeading: [],
    actualHeading: [],
    speed: [],
    rudder: [],
  };

  const actualPath: TrajectoryPoint[] = [];
  const sim = {
    position: new THREE.Vector3(start.x, 0, start.z),
    headingRad: toRadians(start.headingDeg),
    yawRateRad: 0,
    rudderDeg: 0,
    speedMps: nomotoModel.speedMps,
    integral: 0,
    prevErrorRad: 0,
  };

  const dt = 0.5;
  const mode = controlMode === 'manual' ? 'pid' : controlMode;

  for (let t = 0; t <= duration; t += dt) {
    const targetHeading = interpolateHeading(points, t);
    const currentHeading = normalizeHeading(toDegrees(sim.headingRad));
    const errorDeg = angleDelta(targetHeading, currentHeading);
    const errorRad = toRadians(errorDeg);
    const derivative = (errorRad - sim.prevErrorRad) / dt;
    sim.integral += errorRad * dt;

    let kp = pidGains.kp;
    let ki = pidGains.ki;
    let kd = pidGains.kd;
    if (mode === 'p') { ki = 0; kd = 0; }
    else if (mode === 'pd') { ki = 0; }

    const deltaRad = kp * errorRad + ki * sim.integral + kd * derivative;
    sim.rudderDeg = clamp(
      toDegrees(deltaRad),
      -nomotoModel.maxRudderDeg,
      nomotoModel.maxRudderDeg,
    );
    sim.prevErrorRad = errorRad;

    const rudderRad = toRadians(sim.rudderDeg);
    sim.yawRateRad += ((nomotoModel.K * rudderRad - sim.yawRateRad) / nomotoModel.T) * dt;
    sim.headingRad += sim.yawRateRad * dt;

    sim.position.x += sim.speedMps * Math.cos(sim.headingRad) * dt;
    sim.position.z += sim.speedMps * Math.sin(sim.headingRad) * dt;

    chart.time.push(t);
    chart.desiredHeading.push(normalizeSignedHeading(targetHeading));
    chart.actualHeading.push(normalizeSignedHeading(currentHeading));
    chart.speed.push(sim.speedMps);
    chart.rudder.push(sim.rudderDeg);
    actualPath.push({ x: sim.position.x, z: sim.position.z });
  }

  return {
    data: chart,
    desiredPath: desiredPath.map((point) => ({ x: point.x, z: point.z })),
    actualPath,
    duration,
  };
};

// --- Custom Shader Material for Water ---

const WaterShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#124060'), // Darker, richer blue
    uFoamColor: new THREE.Color('#ffffff'),
    uSunPosition: new THREE.Vector3(200, 150, 200),
  },
  // Vertex Shader
  `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    const int WAVE_COUNT = 5;
    
    // Arrays must be constant size
    const float waves[25] = float[](
      1.2, 0.018, 0.9, 1.0, 0.1,
      0.9, 0.035, 1.1, 0.4, 0.9,
      0.6, 0.06,  1.3, -0.6, 0.5,
      0.35, 0.12, 1.6, 0.3, -0.7,
      0.15, 0.25, 2.0, -0.5, -0.6
    );

    void main() {
      vUv = uv;
      vec3 pos = position;
      float elevation = 0.0;
      float dHdx = 0.0;
      float dHdz = 0.0;
      
      for(int i = 0; i < WAVE_COUNT; i++) {
        int idx = i * 5;
        float amp = waves[idx];
        float freq = waves[idx + 1];
        float speed = waves[idx + 2];
        float dx = waves[idx + 3];
        float dz = waves[idx + 4];
        
        float phase = (pos.x * dx + pos.z * dz) * freq + uTime * speed;
        elevation += amp * sin(phase);
        
        float derivative = amp * cos(phase) * freq;
        dHdx += derivative * dx;
        dHdz += derivative * dz;
      }
      
      pos.y += elevation;
      vElevation = elevation;
      
      vec3 normal = normalize(vec3(-dHdx, 1.0, -dHdz));
      vNormal = normalMatrix * normal;

      vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vViewPosition = viewPosition.xyz;
      
      gl_Position = projectionMatrix * viewPosition;
    }
  `,
  // Fragment Shader
  `
    uniform vec3 uColor;
    uniform vec3 uFoamColor;
    uniform vec3 uSunPosition;
    
    varying float vElevation;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vec3 viewDirection = normalize(-vViewPosition);
      vec3 normal = normalize(vNormal);
      vec3 sunDir = normalize(uSunPosition);

      float light = max(dot(normal, sunDir), 0.0);
      float specular = pow(max(dot(reflect(-sunDir, normal), viewDirection), 0.0), 64.0);
      float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.0);
      
      float noiseVal = noise(vUv * 300.0);
      float foamThreshold = 0.9;
      float foamFactor = smoothstep(foamThreshold, foamThreshold + 0.3, vElevation + noiseVal * 0.4);
      
      vec3 waterColor = mix(uColor * 0.5, uColor * 1.3, light * 0.7 + 0.3);
      vec3 finalColor = mix(waterColor, vec3(0.7, 0.85, 0.95), fresnel * 0.4);
      finalColor += vec3(specular * 0.4);
      finalColor = mix(finalColor, uFoamColor, foamFactor * 0.85);

      gl_FragColor = vec4(finalColor, 0.92);
      
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
);

extend({ WaterShaderMaterial });

// Add type definition
declare global {
  namespace JSX {
    interface IntrinsicElements {
      waterShaderMaterial: ReactThreeFiber.Object3DNode<THREE.ShaderMaterial, typeof THREE.ShaderMaterial> & {
        uTime?: number;
        uColor?: THREE.Color;
        uFoamColor?: THREE.Color;
      };
    }
  }
}

type ChartData = {
  time: number[];
  desiredHeading: number[];
  actualHeading: number[];
  speed: number[];
  rudder: number[];
};

type TrajectoryPoint = { x: number; z: number };
type HeadingPoint = { time: number; heading: number };

type QuickSimResult = {
  data: ChartData;
  desiredPath: TrajectoryPoint[];
  actualPath: TrajectoryPoint[];
  duration: number;
};

function SimulationChart({ data, onBack }: { data: ChartData; onBack: () => void }) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: data.time.map(t => t.toFixed(1)),
        datasets: [
          {
            label: '期望航向',
            data: data.desiredHeading,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            yAxisID: 'y-heading',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '实际航向',
            data: data.actualHeading,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            yAxisID: 'y-heading',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '航速',
            data: data.speed,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y-speed',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '舵角',
            data: data.rudder,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            yAxisID: 'y-rudder',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#e2e8f0' },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            borderColor: '#475569',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            title: { display: true, text: '时间 (秒)', color: '#cbd5e1' },
            ticks: { color: '#94a3b8', maxTicksLimit: 15 },
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
          },
          'y-heading': {
            type: 'linear',
            position: 'left',
            title: { display: true, text: '航向角 (°)', color: '#cbd5e1' },
            min: -180,
            max: 180,
            ticks: { color: '#94a3b8', stepSize: 45 },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
          },
          'y-speed': {
            type: 'linear',
            position: 'right',
            title: { display: true, text: '航速 (m/s)', color: '#cbd5e1' },
            ticks: { color: '#94a3b8' },
            grid: { drawOnChartArea: false },
          },
          'y-rudder': {
            type: 'linear',
            position: 'right',
            offset: true,
            title: { display: true, text: '舵角 (°)', color: '#cbd5e1' },
            min: -nomotoModel.maxRudderDeg,
            max: nomotoModel.maxRudderDeg,
            ticks: { color: '#94a3b8', stepSize: 10 },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data]);

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-100">仿真曲线</h2>
        <Button onClick={onBack} variant="default" size="lg">
          返回场景
        </Button>
      </div>
      <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
}

function TrajectoryPreview({
  desiredPath,
  actualPath,
}: {
  desiredPath: TrajectoryPoint[];
  actualPath: TrajectoryPoint[];
}) {
  const size = 200;
  const padding = 14;
  const bounds = useMemo(() => {
    const points = [...desiredPath, ...actualPath];
    if (points.length === 0) {
      return { minX: -600, maxX: 600, minZ: -600, maxZ: 600 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    points.forEach((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    });
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const span = Math.max(spanX, spanZ);
    const margin = span * 0.2 + 80;
    return {
      minX: minX - margin,
      maxX: maxX + margin,
      minZ: minZ - margin,
      maxZ: maxZ + margin,
    };
  }, [actualPath, desiredPath]);

  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanZ = Math.max(1, bounds.maxZ - bounds.minZ);
  const mapWidth = size - padding * 2;
  const mapHeight = size - padding * 2;

  const toMap = (point: TrajectoryPoint) => {
    const x = padding + ((point.x - bounds.minX) / spanX) * mapWidth;
    const y = padding + ((point.z - bounds.minZ) / spanZ) * mapHeight;
    return { x, y };
  };

  const desiredPathStr = desiredPath
    .map((point) => {
      const mapped = toMap(point);
      return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
    })
    .join(' ');

  const actualPathStr = actualPath
    .map((point) => {
      const mapped = toMap(point);
      return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
    })
    .join(' ');

  const hasDesired = desiredPath.length > 1;
  const hasActual = actualPath.length > 1;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-2 text-[10px] text-slate-200">
      <svg width={size} height={size} className="rounded-lg bg-transparent">
        <rect width={size} height={size} fill="#0b1324" fillOpacity="0.65" />
        {hasDesired ? (
          <polyline
            points={desiredPathStr}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
          />
        ) : null}
        {hasActual ? (
          <polyline
            points={actualPathStr}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
          />
        ) : null}
        {!hasDesired && !hasActual ? (
          <text
            x="50%"
            y="50%"
            fill="#94a3b8"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="11"
          >
            运行仿真后生成航迹
          </text>
        ) : null}
      </svg>
      <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-400">
        <span>红色: 期望航迹</span>
        <span>绿色: 实际航迹</span>
      </div>
    </div>
  );
}

const insertHeadingPoint = (
  points: HeadingPoint[],
  point: HeadingPoint,
  duration: number,
) => {
  const next = [...points];
  let insertIndex = next.findIndex((item) => point.time < item.time);
  if (insertIndex < 0) insertIndex = next.length;
  const prev = next[insertIndex - 1];
  const nextPoint = next[insertIndex];
  const min = prev ? prev.time + HEADING_TIME_GAP : 0;
  const max = nextPoint ? nextPoint.time - HEADING_TIME_GAP : duration;
  if (min > max) return next;
  const time = clamp(point.time, min, max);
  const heading = clampHeading(point.heading);
  next.splice(insertIndex, 0, { time, heading });
  return next;
};

const updateHeadingPoint = (
  points: HeadingPoint[],
  index: number,
  nextPoint: HeadingPoint,
  duration: number,
) => {
  const next = [...points];
  const min = index === 0 ? 0 : next[index - 1].time + HEADING_TIME_GAP;
  const max =
    index === next.length - 1 ? duration : next[index + 1].time - HEADING_TIME_GAP;
  const time = clamp(nextPoint.time, min, max);
  const heading = clampHeading(nextPoint.heading);
  next[index] = { time, heading };
  return next;
};

function HeadingChartEditor({
  points,
  setPoints,
  duration,
  actualData,
}: {
  points: HeadingPoint[];
  setPoints: Dispatch<SetStateAction<HeadingPoint[]>>;
  duration: number;
  actualData: ChartData | null;
}) {
  const viewWidth = 800;
  const viewHeight = 360;
  const padding = { top: 24, right: 24, bottom: 40, left: 48 };
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const plotWidth = viewWidth - padding.left - padding.right;
  const plotHeight = viewHeight - padding.top - padding.bottom;

  const toChart = (time: number, heading: number) => {
    const x = padding.left + (time / Math.max(1, duration)) * plotWidth;
    const y =
      padding.top +
      (1 - (heading - HEADING_RANGE.min) / (HEADING_RANGE.max - HEADING_RANGE.min)) *
        plotHeight;
    return { x, y };
  };

  const toData = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * viewWidth, 0, viewWidth);
    const py = clamp(((event.clientY - rect.top) / rect.height) * viewHeight, 0, viewHeight);
    const time = (clamp(px - padding.left, 0, plotWidth) / plotWidth) * duration;
    const heading =
      HEADING_RANGE.min +
      (1 - clamp(py - padding.top, 0, plotHeight) / plotHeight) *
        (HEADING_RANGE.max - HEADING_RANGE.min);
    return { time, heading };
  };

  const desiredSamples = useMemo(() => {
    const step = Math.max(1, duration / 80);
    const samples: Array<{ time: number; heading: number }> = [];
    for (let t = 0; t <= duration; t += step) {
      samples.push({ time: t, heading: interpolateHeading(points, t) });
    }
    return samples;
  }, [duration, points]);

  const desiredPathStr = desiredSamples
    .map((sample) => {
      const mapped = toChart(sample.time, sample.heading);
      return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
    })
    .join(' ');

  const actualPathStr = actualData
    ? actualData.time
        .map((t, index) => {
          const mapped = toChart(t, actualData.actualHeading[index] ?? 0);
          return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
        })
        .join(' ')
    : '';

  const ticks = 6;
  const timeTicks = Array.from({ length: ticks }, (_, i) =>
    Math.round((duration * i) / (ticks - 1)),
  );
  const headingTicks = [-180, -120, -60, 0, 60, 120, 180];

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="none"
      className="h-full w-full touch-none"
      onPointerDown={(event) => {
        if (event.target instanceof SVGCircleElement) return;
        const point = toData(event);
        setPoints((prev) => insertHeadingPoint(prev, point, duration));
      }}
      onPointerMove={(event) => {
        if (dragIndex === null) return;
        const point = toData(event);
        setPoints((prev) => updateHeadingPoint(prev, dragIndex, point, duration));
      }}
      onPointerUp={() => setDragIndex(null)}
      onPointerLeave={() => setDragIndex(null)}
    >
      <rect width={viewWidth} height={viewHeight} fill="#0b1324" fillOpacity="0.7" />
      {headingTicks.map((heading) => {
        const line = toChart(0, heading);
        return (
          <g key={`h-${heading}`}>
            <line
              x1={padding.left}
              x2={viewWidth - padding.right}
              y1={line.y}
              y2={line.y}
              stroke="rgba(148,163,184,0.15)"
              strokeWidth="1"
            />
            <text
              x={padding.left - 6}
              y={line.y + 4}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="end"
            >
              {heading}
            </text>
          </g>
        );
      })}
      {timeTicks.map((time) => {
        const line = toChart(time, HEADING_RANGE.min);
        return (
          <g key={`t-${time}`}>
            <line
              x1={line.x}
              x2={line.x}
              y1={padding.top}
              y2={viewHeight - padding.bottom}
              stroke="rgba(148,163,184,0.1)"
              strokeWidth="1"
            />
            <text
              x={line.x}
              y={viewHeight - padding.bottom + 18}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {time}s
            </text>
          </g>
        );
      })}
      {desiredSamples.length > 1 ? (
        <polyline
          points={desiredPathStr}
          fill="none"
          stroke="#f97316"
          strokeWidth="2"
        />
      ) : null}
      {actualData && actualData.time.length > 1 ? (
        <polyline
          points={actualPathStr}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          opacity="0.85"
        />
      ) : null}
      {points.map((point, index) => {
        const mapped = toChart(point.time, point.heading);
        return (
          <g key={`pt-${index}`} transform={`translate(${mapped.x} ${mapped.y})`}>
            <circle
              r="7"
              fill="#38bdf8"
              stroke="#0f172a"
              strokeWidth="2"
              onPointerDown={(event) => {
                event.stopPropagation();
                setDragIndex(index);
              }}
            />
            <text
              x="0"
              y="0"
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize="9"
              fill="#0f172a"
              pointerEvents="none"
            >
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HeadingPointTable({
  points,
  setPoints,
  duration,
  onAdd,
}: {
  points: HeadingPoint[];
  setPoints: Dispatch<SetStateAction<HeadingPoint[]>>;
  duration: number;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2 text-sm text-slate-300">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>时间范围 0 - {duration}s</span>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          新增节点
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-slate-400">
        <span>时间 (s)</span>
        <span>航向 (°)</span>
        <span />
      </div>
      <div className="max-h-48 overflow-auto pr-1">
        <div className="grid gap-2">
          {points.map((point, index) => (
            <div
              key={`row-${index}`}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
            >
              <Input
                type="number"
                value={point.time}
                min={0}
                max={duration}
                step={0.5}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setPoints((prev) =>
                    updateHeadingPoint(
                      prev,
                      index,
                      { ...prev[index], time: Number.isNaN(value) ? 0 : value },
                      duration,
                    ),
                  );
                }}
              />
              <Input
                type="number"
                value={point.heading}
                min={HEADING_RANGE.min}
                max={HEADING_RANGE.max}
                step={1}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setPoints((prev) =>
                    updateHeadingPoint(
                      prev,
                      index,
                      { ...prev[index], heading: Number.isNaN(value) ? 0 : value },
                      duration,
                    ),
                  );
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  setPoints((prev) =>
                    prev.length > 2 ? prev.filter((_, i) => i !== index) : prev,
                  )
                }
                disabled={points.length <= 2}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DestroyerSimulation() {
  const [cameraView, setCameraView] = useState<CameraView>('chase');
  const [controlMode, setControlMode] = useState<ControlMode>('manual');
  const [targetHeading, setTargetHeading] = useState(0); // 实时更新
  const [pidGains, setPidGains] = useState({ kp: 1.4, ki: 0.02, kd: 0.7 });
  
  const [hud, setHud] = useState<HudState>({
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: nomotoModel.speedMps,
    position: { x: 0, z: 0 },
    avgError: 0,
    currentError: 0,
    time: 0,
  });

  const [miniTrail, setMiniTrail] = useState<Array<{ x: number; z: number }>>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [taskProgress, setTaskProgress] = useState(0); // 进度现在基于时间
  const [resetToken, setResetToken] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1);
  const [cameraOffset, setCameraOffset] = useState({
    azimuth: 0,
    elevation: 0,
    panX: 0,
    panZ: 0,
  });
  const [viewMode, setViewMode] = useState<'simulation' | 'chart'>('simulation');
  const [quickMode, setQuickMode] = useState(false);
  const [quickHeadingPoints, setQuickHeadingPoints] = useState<HeadingPoint[]>([]);
  const [quickResult, setQuickResult] = useState<QuickSimResult | null>(null);
  const [modelPanelOpen, setModelPanelOpen] = useState(true);
  const [controlPanelOpen, setControlPanelOpen] = useState(true);
  const [pidPanelOpen, setPidPanelOpen] = useState(true);
  const [useCustomScenario, setUseCustomScenario] = useState(false);
  const [customScenario, setCustomScenario] = useState<CustomScenario | null>(null);
  const [chartData, setChartData] = useState<ChartData>({
    time: [],
    desiredHeading: [],
    actualHeading: [],
    speed: [],
    rudder: [],
  });

  const safeTaskIndex = clamp(taskIndex, 0, tasks.length - 1);
  const activeTask = tasks[safeTaskIndex];
  const isCustomScenario = useCustomScenario && !!customScenario;
  
  const baseScenario = useMemo<CustomScenario>(() => {
    if (!activeTask) {
      const logic = getScenarioLogic('turn90');
      const path = generateGuidePath(logic, 0);
      return {
        logic,
        guidePath: path,
        start: logic.startPos,
        duration: 0,
      };
    }
    const logic = getScenarioLogic(activeTask.scenario);
    const path = generateGuidePath(logic, activeTask.duration);
    return {
      logic,
      guidePath: path,
      start: logic.startPos,
      duration: activeTask.duration,
    };
  }, [activeTask]);

  // 动态生成场景配置
  const scenarioConfig = useMemo<CustomScenario>(() => {
    if (useCustomScenario && customScenario) {
      return {
        ...customScenario,
        guidePath: baseScenario.guidePath,
        start: baseScenario.start,
        duration: baseScenario.duration,
      };
    }
    return baseScenario;
  }, [baseScenario, customScenario, useCustomScenario]);
  const scenarioDuration = baseScenario.duration;

  const speedOptions = useMemo(() => [0.5, 1, 2, 4], []);
  const baseHeadingPoints = useMemo(
    () => createHeadingPointsFromLogic(baseScenario.logic, baseScenario.duration, 5),
    [baseScenario.duration, baseScenario.logic],
  );
  const quickHeadingPointsSafe = useMemo(
    () => sanitizeHeadingPoints(quickHeadingPoints, baseScenario.duration),
    [baseScenario.duration, quickHeadingPoints],
  );
  const quickScenario = useMemo(
    () =>
      buildScenarioFromHeadingPoints(
        quickHeadingPointsSafe,
        baseScenario.start,
        baseScenario.duration,
        baseScenario.guidePath,
      ),
    [baseScenario.duration, baseScenario.guidePath, baseScenario.start, quickHeadingPointsSafe],
  );

  const adjustSpeed = useCallback((direction: number) => {
    setSimSpeed((prev) => {
      const currentIndex = speedOptions.indexOf(prev);
      const newIndex = clamp(currentIndex + direction, 0, speedOptions.length - 1);
      return speedOptions[newIndex];
    });
  }, [speedOptions]);

  const resetCameraOffset = useCallback(() => {
    setCameraOffset({ azimuth: 0, elevation: 0, panX: 0, panZ: 0 });
  }, []);

  const lastChartSampleRef = useRef(0);
  const simulationStartTimeRef = useRef(0);
  const lastRudderStepTimeRef = useRef(0);
  const lastSpeedStepTimeRef = useRef(0);
  const totalErrorRef = useRef(0);
  const errorSampleCountRef = useRef(0);

  const handleChartDataUpdate = useCallback((time: number, desiredHeading: number, actualHeading: number, speed: number, rudder: number) => {
    setChartData(prev => {
      const newData = {
        time: [...prev.time, time],
        desiredHeading: [...prev.desiredHeading, desiredHeading],
        actualHeading: [...prev.actualHeading, actualHeading],
        speed: [...prev.speed, speed],
        rudder: [...prev.rudder, rudder],
      };
      const maxPoints = 2000;
      if (newData.time.length > maxPoints) {
        return {
          time: newData.time.slice(-maxPoints),
          desiredHeading: newData.desiredHeading.slice(-maxPoints),
          actualHeading: newData.actualHeading.slice(-maxPoints),
          speed: newData.speed.slice(-maxPoints),
          rudder: newData.rudder.slice(-maxPoints),
        };
      }
      return newData;
    });
  }, []);

  const rudderDirectionRef = useRef(0);
  const speedDirectionRef = useRef(0);
  const trailStampRef = useRef(0);
  const skipFirstTrailUpdateRef = useRef(true);

  const resetScenarioState = useCallback(() => {
    setTaskProgress(0);
    setMiniTrail([]);
    trailStampRef.current = 0;
    skipFirstTrailUpdateRef.current = true;
    lastChartSampleRef.current = 0;
    simulationStartTimeRef.current = -1;
    lastRudderStepTimeRef.current = 0;
    lastSpeedStepTimeRef.current = 0;
    totalErrorRef.current = 0;
    errorSampleCountRef.current = 0;
    setChartData({ time: [], desiredHeading: [], actualHeading: [], speed: [], rudder: [] });
    setResetToken((prev) => prev + 1);
  }, []);

  const handleRunQuickSimulation = useCallback(() => {
    const result = runQuickSimulation(
      quickHeadingPointsSafe,
      pidGains,
      controlMode,
      baseScenario.start,
      baseScenario.duration,
      baseScenario.guidePath,
    );
    if (result) {
      setQuickResult(result);
    }
  }, [baseScenario.duration, baseScenario.guidePath, baseScenario.start, controlMode, pidGains, quickHeadingPointsSafe]);

  const handleApplyQuickScenario = useCallback(() => {
    if (!quickScenario) return;
    setCustomScenario(quickScenario);
    setUseCustomScenario(true);
    resetScenarioState();
    setViewMode('simulation');
    setQuickMode(false);
  }, [quickScenario, resetScenarioState]);

  const handleReturnToSimulation = useCallback(() => {
    resetScenarioState();
    setViewMode('simulation');
    setQuickMode(false);
  }, [resetScenarioState]);

  const handleAddHeadingPoint = useCallback(() => {
    setQuickHeadingPoints((prev) => {
      if (prev.length === 0) {
        return [
          { time: 0, heading: 0 },
          { time: Math.max(1, scenarioDuration), heading: 0 },
        ];
      }
      if (prev.length === 1) {
        return insertHeadingPoint(
          prev,
          { time: clamp(prev[0].time + 10, 0, scenarioDuration), heading: prev[0].heading },
          scenarioDuration,
        );
      }
      const last = prev[prev.length - 1];
      const beforeLast = prev[prev.length - 2];
      const time = (beforeLast.time + last.time) / 2;
      const heading = (beforeLast.heading + last.heading) / 2;
      return insertHeadingPoint(prev, { time, heading }, scenarioDuration);
    });
  }, [scenarioDuration]);

  useEffect(() => {
    setQuickHeadingPoints(baseHeadingPoints);
  }, [baseHeadingPoints]);

  useEffect(() => {
    if (taskIndex !== safeTaskIndex) {
      setTaskIndex(safeTaskIndex);
    }
  }, [safeTaskIndex, taskIndex]);

  useEffect(() => {
    setQuickResult(null);
  }, [quickHeadingPoints, pidGains, controlMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') rudderDirectionRef.current = -1;
      if (event.key === 'ArrowRight') rudderDirectionRef.current = 1;
      if (event.key === 'ArrowUp') speedDirectionRef.current = 1;
      if (event.key === 'ArrowDown') speedDirectionRef.current = -1;

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        rudderDirectionRef.current = 0;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        speedDirectionRef.current = 0;
      }
    };

    const handleBlur = () => {
      rudderDirectionRef.current = 0;
      speedDirectionRef.current = 0;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // 任务切换时重置
  useEffect(() => {
    resetScenarioState();
  }, [taskIndex, resetScenarioState]);

  // 小地图航迹更新
  useEffect(() => {
    if (skipFirstTrailUpdateRef.current) {
      skipFirstTrailUpdateRef.current = false;
      trailStampRef.current = Date.now();
      return;
    }
    const now = Date.now();
    if (now - trailStampRef.current < 250) return;
    trailStampRef.current = now;

    setMiniTrail((prev) => {
      const next = [...prev, { x: hud.position.x, z: hud.position.z }];
      return next.length > 3000 ? next.slice(-3000) : next;
    });
  }, [hud.position.x, hud.position.z]);

  // 任务进度与完成检测
  useEffect(() => {
    if (!activeTask) return;
    
    // 进度基于时间
    const progress = Math.min(1, hud.time / scenarioDuration);
    setTaskProgress(progress);

    // 完成判定
    if (!isCustomScenario && hud.time >= activeTask.duration) {
        if (hud.avgError < 200) {
            setCompletedTaskIds((prev) => 
                prev.includes(activeTask.id) ? prev : [...prev, activeTask.id]
            );
            // 自动进入下一任务
            if (taskIndex < tasks.length - 1) {
                setTimeout(() => setTaskIndex(prev => prev + 1), 1000);
            }
        }
    }
  }, [hud.time, hud.avgError, activeTask, isCustomScenario, scenarioDuration, taskIndex]);

  const chartDisplayData = quickMode && quickResult ? quickResult.data : chartData;
  const previewDesiredPath = useMemo(
    () => baseScenario.guidePath.map((point) => ({ x: point.x, z: point.z })),
    [baseScenario.guidePath],
  );
  const previewActualPath = useMemo(() => {
    if (quickMode && quickResult) return quickResult.actualPath;
    return miniTrail;
  }, [miniTrail, quickMode, quickResult]);
  const canRunQuick = quickHeadingPointsSafe.length >= 2;
  const canApplyQuick = !!quickScenario;

  return (
    <div className="w-full px-6 py-10">
      {viewMode === 'chart' ? (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6 min-w-0">
            <div className="h-[520px] w-full">
              {quickMode ? (
                <div className="flex h-full w-full flex-col bg-slate-950 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-slate-100">仿真曲线</h2>
                    <Button onClick={handleReturnToSimulation} variant="default" size="lg">
                      返回场景
                    </Button>
                  </div>
                  <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                    <HeadingChartEditor
                      points={quickHeadingPoints}
                      setPoints={setQuickHeadingPoints}
                      duration={scenarioDuration}
                      actualData={quickResult ? quickResult.data : null}
                    />
                  </div>
                </div>
              ) : (
                <SimulationChart data={chartDisplayData} onBack={handleReturnToSimulation} />
              )}
            </div>
          </div>
          <div className="space-y-6 min-w-0">
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-lg text-white">航迹对比</CardTitle>
              </CardHeader>
              <CardContent>
                <TrajectoryPreview desiredPath={previewDesiredPath} actualPath={previewActualPath} />
              </CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-lg text-white">快速仿真</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <p className="text-xs text-slate-400">
                  进入快速仿真后，可在曲线图拖拽关键点或输入航向角-时间对，生成期望航向曲线。
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={quickMode ? 'secondary' : 'default'}
                    onClick={() => setQuickMode((prev) => !prev)}
                  >
                    {quickMode ? '退出快速仿真' : '进入快速仿真'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRunQuickSimulation}
                    disabled={!canRunQuick}
                  >
                    运行仿真
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuickHeadingPoints(baseHeadingPoints)}
                    disabled={!quickMode}
                  >
                    重置曲线
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleApplyQuickScenario}
                  disabled={!canApplyQuick}
                >
                  使用该组参数
                </Button>
                {quickMode ? (
                  <HeadingPointTable
                    points={quickHeadingPoints}
                    setPoints={setQuickHeadingPoints}
                    duration={scenarioDuration}
                    onAdd={handleAddHeadingPoint}
                  />
                ) : null}
              </CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg text-white">055 型驱逐舰模型</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-slate-300"
                  onClick={() => setModelPanelOpen((prev) => !prev)}
                >
                  {modelPanelOpen ? '收起' : '展开'}
                </Button>
              </CardHeader>
              {modelPanelOpen ? (
                <CardContent className="space-y-2 text-sm text-slate-300">
                  <p>排水量: {destroyerSpecs.displacement}</p>
                  <p>舰长: {destroyerSpecs.length}</p>
                  <p>舰宽: {destroyerSpecs.beam}</p>
                  <p>吃水: {destroyerSpecs.draft}</p>
                  <p>动力: {destroyerSpecs.propulsion}</p>
                  <p>动力功率: {destroyerSpecs.power}</p>
                  <p>最大航速: {destroyerSpecs.maxSpeed}</p>
                  <p className="text-xs text-slate-400">
                    野本模型参数: K={nomotoModel.K}, T={nomotoModel.T}s
                  </p>
                </CardContent>
              ) : null}
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg text-white">控制模式</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-slate-300"
                  onClick={() => setControlPanelOpen((prev) => !prev)}
                >
                  {controlPanelOpen ? '收起' : '展开'}
                </Button>
              </CardHeader>
              {controlPanelOpen ? (
                <CardContent className="space-y-4 text-sm text-slate-300">
                  <div className="flex flex-wrap gap-2">
                    {(['manual', 'p', 'pd', 'pid'] as ControlMode[]).map((mode) => (
                      <Button
                        key={mode}
                        variant={controlMode === mode ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => {
                          setControlMode(mode);
                          setResetToken((prev) => prev + 1);
                        }}
                      >
                        {mode.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">目标航向 (实时)</p>
                    <p className="text-lg text-white">{targetHeading.toFixed(1)}°</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">航速</p>
                    <p className="text-lg text-white">{hud.speed.toFixed(1)} m/s</p>
                  </div>
                </CardContent>
              ) : null}
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg text-white">PID 调参</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-slate-300"
                  onClick={() => setPidPanelOpen((prev) => !prev)}
                >
                  {pidPanelOpen ? '收起' : '展开'}
                </Button>
              </CardHeader>
              {pidPanelOpen ? (
                <CardContent className="space-y-4 text-sm text-slate-300">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Kp</span>
                      <span className="text-white">{pidGains.kp.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[pidGains.kp]}
                      min={0}
                      max={4}
                      step={0.05}
                      onValueChange={([value]) =>
                        setPidGains((prev) => ({ ...prev, kp: value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Ki</span>
                      <span className="text-white">{pidGains.ki.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[pidGains.ki]}
                      min={0}
                      max={0.4}
                      step={0.01}
                      onValueChange={([value]) =>
                        setPidGains((prev) => ({ ...prev, ki: value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Kd</span>
                      <span className="text-white">{pidGains.kd.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[pidGains.kd]}
                      min={0}
                      max={2}
                      step={0.05}
                      onValueChange={([value]) =>
                        setPidGains((prev) => ({ ...prev, kd: value }))
                      }
                    />
                  </div>
                </CardContent>
              ) : null}
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-lg text-white">实时状态</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>航向</span>
                  <span className="text-white">{hud.heading.toFixed(1)}°</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>舵角</span>
                  <span className="text-white">{hud.rudder.toFixed(1)}°</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>当前误差</span>
                  <span className="text-white">{hud.currentError.toFixed(1)} m</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>平均误差</span>
                  <span className="text-white">{hud.avgError.toFixed(1)} m</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6 min-w-0">
          <div className="relative h-[600px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
            <div className="absolute left-4 top-4 z-10 flex gap-2">
              {cameraViews.map((view) => (
                <Button
                  key={view.id}
                  variant={cameraView === view.id ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setCameraView(view.id);
                    resetCameraOffset();
                  }}
                >
                  {view.label}
                </Button>
              ))}
            </div>
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white"
                  onClick={() => adjustSpeed(-1)}
                  disabled={simSpeed === speedOptions[0]}
                >
                  −
                </Button>
                <span className="min-w-[50px] text-center text-sm text-white">
                  {simSpeed}x
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white"
                  onClick={() => adjustSpeed(1)}
                  disabled={simSpeed === speedOptions[speedOptions.length - 1]}
                >
                  +
                </Button>
              </div>
            </div>
            <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setViewMode('chart');
                    setQuickMode(false);
                  }}
                >
                  查看曲线
                </Button>
                <Button size="sm" variant="outline" onClick={resetScenarioState}>
                  重置仿真
                </Button>
              </div>
              <MiniMap
                guidePath={scenarioConfig.guidePath}
                trail={miniTrail}
                position={hud.position}
                heading={hud.heading}
              />
            </div>
            <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">
              <p>航向: {hud.heading.toFixed(1)}°</p>
              <p>期望: {targetHeading.toFixed(1)}°</p>
              <p>舵角: {hud.rudder.toFixed(1)}°</p>
              <p>航速: {hud.speed.toFixed(1)} m/s</p>
            </div>
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-slate-200">
                  正在加载三维模型...
                </div>
              }
            >
              <SimulationCanvas
                cameraView={cameraView}
                controlMode={controlMode}
                pidGains={pidGains}
                targetHeading={targetHeading} // Now fed from SimulationLoop update
                rudderDirectionRef={rudderDirectionRef}
                speedDirectionRef={speedDirectionRef}
                onHudUpdate={setHud}
                resetToken={resetToken}
                scenarioConfig={scenarioConfig}
                simSpeed={simSpeed}
                cameraOffset={cameraOffset}
                onCameraOffsetChange={setCameraOffset}
                onChartDataUpdate={handleChartDataUpdate}
                lastChartSampleRef={lastChartSampleRef}
                simulationStartTimeRef={simulationStartTimeRef}
                lastRudderStepTimeRef={lastRudderStepTimeRef}
                lastSpeedStepTimeRef={lastSpeedStepTimeRef}
                setTargetHeading={setTargetHeading}
                totalErrorRef={totalErrorRef}
                errorSampleCountRef={errorSampleCountRef}
                taskDuration={scenarioDuration}
              />
            </Suspense>
          </div>
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-lg text-white">任务链指引</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              {tasks.map((task, index) => {
                const isCompleted = completedTaskIds.includes(task.id);
                const isActive = taskIndex === index;
                const statusLabel = isCompleted
                  ? '已完成'
                  : isActive
                  ? '进行中'
                  : '未解锁';
                const badgeStyle = isCompleted
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : isActive
                  ? 'bg-sky-500/20 text-sky-200'
                  : 'bg-slate-700/40 text-slate-300';
                const durationLabel =
                  isCustomScenario && isActive ? scenarioDuration : task.duration;

                return (
                  <div key={task.id} className="rounded-lg border border-slate-800 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white">
                        {index + 1}. {task.title}
                      </p>
                      <span className={`rounded-full px-2 py-1 text-xs ${badgeStyle}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-300">{task.description}</p>
                    {isActive ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>时间: {hud.time.toFixed(1)} / {durationLabel}s</span>
                            <span className={hud.avgError < 200 ? "text-emerald-400" : "text-red-400"}>
                                平均误差: {hud.avgError.toFixed(1)}m (目标 &lt; 200m)
                            </span>
                        </div>
                        <progress
                          className="h-2 w-full accent-emerald-400"
                          value={taskProgress}
                          max={1}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>操作提示:</span>
                <span className="rounded bg-slate-800 px-2 py-1">← / → 控制舵角</span>
                <span className="rounded bg-slate-800 px-2 py-1">↑ / ↓ 调整航速</span>
                <span className="rounded bg-slate-800 px-2 py-1">红色为指引航线</span>
                <span className="rounded bg-slate-800 px-2 py-1">绿色为实际航迹</span>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setTaskIndex(0);
                  setCompletedTaskIds([]);
                  setUseCustomScenario(false);
                  setCustomScenario(null);
                  setResetToken((prev) => prev + 1);
                }}
              >
                重新开始任务链
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

type SimulationCanvasProps = {
  cameraView: CameraView;
  controlMode: ControlMode;
  pidGains: { kp: number; ki: number; kd: number };
  targetHeading: number;
  rudderDirectionRef: React.MutableRefObject<number>;
  speedDirectionRef: React.MutableRefObject<number>;
  onHudUpdate: (state: HudState) => void;
  resetToken: number;
  scenarioConfig: CustomScenario;
  simSpeed: number;
  cameraOffset: { azimuth: number; elevation: number; panX: number; panZ: number };
  onCameraOffsetChange: (offset: { azimuth: number; elevation: number; panX: number; panZ: number }) => void;
  onChartDataUpdate: (time: number, desiredHeading: number, actualHeading: number, speed: number, rudder: number) => void;
  lastChartSampleRef: React.MutableRefObject<number>;
  simulationStartTimeRef: React.MutableRefObject<number>;
  lastRudderStepTimeRef: React.MutableRefObject<number>;
  lastSpeedStepTimeRef: React.MutableRefObject<number>;
  setTargetHeading: (val: number) => void;
  totalErrorRef: React.MutableRefObject<number>;
  errorSampleCountRef: React.MutableRefObject<number>;
  taskDuration: number;
};

function SimulationCanvas({
  cameraView,
  controlMode,
  pidGains,
  targetHeading,
  rudderDirectionRef,
  speedDirectionRef,
  onHudUpdate,
  resetToken,
  scenarioConfig,
  simSpeed,
  cameraOffset,
  onCameraOffsetChange,
  onChartDataUpdate,
  lastChartSampleRef,
  simulationStartTimeRef,
  lastRudderStepTimeRef,
  lastSpeedStepTimeRef,
  setTargetHeading,
  totalErrorRef,
  errorSampleCountRef,
  taskDuration,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragButtonRef = useRef<number | null>(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // 鼠标视角控制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDraggingRef.current = true;
        dragButtonRef.current = e.button;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - lastMouseRef.current.x;
      const deltaY = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      if (dragButtonRef.current === 2) {
        onCameraOffsetChange({
          ...cameraOffset,
          azimuth: cameraOffset.azimuth + deltaX * 0.005,
          elevation: clamp(cameraOffset.elevation - deltaY * 0.003, -0.3, 0.8),
        });
      } else if (dragButtonRef.current === 0) {
        const viewAzimuth = cameraOffset.azimuth;
        const rightX = Math.cos(viewAzimuth + Math.PI / 2);
        const rightZ = Math.sin(viewAzimuth + Math.PI / 2);
        const forwardX = Math.cos(viewAzimuth);
        const forwardZ = Math.sin(viewAzimuth);

        onCameraOffsetChange({
          ...cameraOffset,
          panX: cameraOffset.panX - deltaX * rightX * 0.8 + deltaY * forwardX * 0.8,
          panZ: cameraOffset.panZ - deltaX * rightZ * 0.8 + deltaY * forwardZ * 0.8,
        });
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      dragButtonRef.current = null;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [cameraOffset, onCameraOffsetChange]);
  
  const shipRef = useRef<THREE.Group>(null);
  const simRef = useRef<SimulationState>({
    position: new THREE.Vector3(0, 0, 0),
    headingRad: 0,
    yawRateRad: 0,
    rudderDeg: 0,
    manualRudderDeg: 0,
    speedMps: nomotoModel.speedMps,
    integral: 0,
    prevErrorRad: 0,
    waveY: 0,
    wavePitch: 0,
    waveRoll: 0,
  });
  const lastHudUpdateRef = useRef(0);

  useEffect(() => {
    simRef.current.position.set(scenarioConfig.start.x, 0, scenarioConfig.start.z);
    simRef.current.headingRad = toRadians(scenarioConfig.start.headingDeg);
    simRef.current.yawRateRad = 0;
    simRef.current.rudderDeg = 0;
    simRef.current.manualRudderDeg = 0;
    simRef.current.integral = 0;
    simRef.current.prevErrorRad = 0;
    simRef.current.waveY = 0;
    simRef.current.wavePitch = 0;
    simRef.current.waveRoll = 0;
    if (controlMode !== 'manual') {
      simRef.current.manualRudderDeg = 0;
    }
  }, [resetToken, controlMode, scenarioConfig]);

  return (
    <div ref={canvasRef} className="h-full w-full">
      <Canvas
        className="h-full w-full"
        camera={{ position: [0, 30, 140], fov: 50, near: 0.1, far: 15000 }}
      >
        <color attach="background" args={['#d4e8f7']} />
        <ambientLight intensity={0.6} />
        <hemisphereLight intensity={0.6} groundColor="#1a3a5a" color="#87ceeb" />
        <directionalLight position={[200, 150, 200]} intensity={1.2} color="#fff8e7" />
        <SkyDome />
        <ProceduralClouds />
        <WaveWater simRef={simRef} />
        <GridHelper simRef={simRef} />
        <GuideRoute points={scenarioConfig.guidePath} />
        {/* Removed Island for now as Scenario logic is pure path based */}
        <ShipTrail simRef={simRef} resetToken={resetToken} />
        <ShipWake simRef={simRef} />
        <ShipModel shipRef={shipRef} />
        <SimulationLoop
          shipRef={shipRef}
          simRef={simRef}
          controlMode={controlMode}
          pidGains={pidGains}
          rudderDirectionRef={rudderDirectionRef}
          speedDirectionRef={speedDirectionRef}
          onHudUpdate={onHudUpdate}
          lastHudUpdateRef={lastHudUpdateRef}
          simSpeed={simSpeed}
          onChartDataUpdate={onChartDataUpdate}
          lastChartSampleRef={lastChartSampleRef}
          simulationStartTimeRef={simulationStartTimeRef}
          lastRudderStepTimeRef={lastRudderStepTimeRef}
          lastSpeedStepTimeRef={lastSpeedStepTimeRef}
          scenarioLogic={scenarioConfig.logic}
          guidePath={scenarioConfig.guidePath}
          setTargetHeading={setTargetHeading}
          totalErrorRef={totalErrorRef}
          errorSampleCountRef={errorSampleCountRef}
          taskDuration={taskDuration}
        />
        <CameraRig cameraView={cameraView} simRef={simRef} cameraOffset={cameraOffset} />
      </Canvas>
    </div>
  );
}

// 寻找最近点计算 Cross Track Error
function getCrossTrackError(position: THREE.Vector3, path: THREE.Vector3[]): number {
  if (path.length < 2) return 0;
  
  let minDistSq = Infinity;
  // 简单遍历寻找最近点 (可以优化，但几百个点也没问题)
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i+1];
    
    // 线段 p1-p2
    // 投影点
    const v = p2.clone().sub(p1);
    const w = position.clone().sub(p1);
    
    const c1 = w.dot(v);
    const c2 = v.dot(v);
    
    let distSq = 0;
    
    if (c1 <= 0) {
      distSq = position.distanceToSquared(p1);
    } else if (c2 <= c1) {
      distSq = position.distanceToSquared(p2);
    } else {
      const b = c1 / c2;
      const pb = p1.clone().add(v.multiplyScalar(b));
      distSq = position.distanceToSquared(pb);
    }
    
    if (distSq < minDistSq) minDistSq = distSq;
  }
  return Math.sqrt(minDistSq);
}

type SimulationLoopProps = {
  shipRef: React.RefObject<THREE.Group>;
  simRef: React.MutableRefObject<SimulationState>;
  controlMode: ControlMode;
  pidGains: { kp: number; ki: number; kd: number };
  rudderDirectionRef: React.MutableRefObject<number>;
  speedDirectionRef: React.MutableRefObject<number>;
  onHudUpdate: (state: HudState) => void;
  lastHudUpdateRef: React.MutableRefObject<number>;
  simSpeed: number;
  onChartDataUpdate: (time: number, desiredHeading: number, actualHeading: number, speed: number, rudder: number) => void;
  lastChartSampleRef: React.MutableRefObject<number>;
  simulationStartTimeRef: React.MutableRefObject<number>;
  lastRudderStepTimeRef: React.MutableRefObject<number>;
  lastSpeedStepTimeRef: React.MutableRefObject<number>;
  scenarioLogic: ScenarioLogic;
  guidePath: THREE.Vector3[];
  setTargetHeading: (val: number) => void;
  totalErrorRef: React.MutableRefObject<number>;
  errorSampleCountRef: React.MutableRefObject<number>;
  taskDuration: number;
};

function SimulationLoop({
  shipRef,
  simRef,
  controlMode,
  pidGains,
  rudderDirectionRef,
  speedDirectionRef,
  onHudUpdate,
  lastHudUpdateRef,
  simSpeed,
  onChartDataUpdate,
  lastChartSampleRef,
  simulationStartTimeRef,
  lastRudderStepTimeRef,
  lastSpeedStepTimeRef,
  scenarioLogic,
  guidePath,
  setTargetHeading,
  totalErrorRef,
  errorSampleCountRef,
  taskDuration,
}: SimulationLoopProps) {
  useFrame((state, delta) => {
    const dt = Math.min(delta * simSpeed, 0.1);
    const sim = simRef.current;
    const elapsedTime = state.clock.getElapsedTime();

    if (simulationStartTimeRef.current < 0) {
      simulationStartTimeRef.current = elapsedTime;
    }
    const simTime = elapsedTime - simulationStartTimeRef.current;

    // 1. 获取当前时刻的期望航向
    // 如果超过任务时间，保持最后一个时刻的航向
    const timeForHeading = Math.min(simTime, taskDuration);
    const targetHeadingRaw = scenarioLogic.getDesiredHeading(timeForHeading);
    const targetHeading = Number.isFinite(targetHeadingRaw) ? targetHeadingRaw : 0;

    if (!Number.isFinite(sim.headingRad)) {
      sim.headingRad = 0;
      sim.yawRateRad = 0;
      sim.rudderDeg = 0;
      sim.manualRudderDeg = 0;
      sim.integral = 0;
      sim.prevErrorRad = 0;
      sim.position.set(scenarioLogic.startPos.x, 0, scenarioLogic.startPos.z);
    }
    
    // 更新 React State (用于 UI 显示，不频繁更新)
    // 限制更新频率
    if (Math.floor(simTime * 5) > Math.floor((simTime - dt) * 5)) {
        setTargetHeading(targetHeading);
    }

    // 2. 航速控制
    if (controlMode === 'manual') {
      const speedStepInterval = 0.1;
      const speedStepSize = 1;
      if (speedDirectionRef.current !== 0) {
        if (simTime - lastSpeedStepTimeRef.current >= speedStepInterval) {
          lastSpeedStepTimeRef.current = simTime;
          sim.speedMps = clamp(
            sim.speedMps + speedDirectionRef.current * speedStepSize,
            speedLimits.min,
            speedLimits.max,
          );
        }
      }
    } else {
      sim.speedMps = nomotoModel.speedMps;
    }

    // 3. 舵角控制 (自动时使用 targetHeading)
    if (controlMode === 'manual') {
      const rudderStepInterval = 0.1;
      const rudderStepSize = 1;
      if (rudderDirectionRef.current !== 0) {
        if (simTime - lastRudderStepTimeRef.current >= rudderStepInterval) {
          lastRudderStepTimeRef.current = simTime;
          sim.manualRudderDeg = clamp(
            sim.manualRudderDeg + rudderDirectionRef.current * rudderStepSize,
            -nomotoModel.maxRudderDeg,
            nomotoModel.maxRudderDeg,
          );
        }
      }
      sim.rudderDeg = sim.manualRudderDeg;
    } else {
      // PID 控制
      const currentHeading = normalizeHeading(toDegrees(sim.headingRad));
      const errorDeg = angleDelta(targetHeading, currentHeading);
      const errorRad = toRadians(errorDeg);
      const derivative = (errorRad - sim.prevErrorRad) / dt;
      sim.integral += errorRad * dt;

      let kp = pidGains.kp;
      let ki = pidGains.ki;
      let kd = pidGains.kd;
      if (controlMode === 'p') { ki = 0; kd = 0; } 
      else if (controlMode === 'pd') { ki = 0; }

      const deltaRad = kp * errorRad + ki * sim.integral + kd * derivative;
      sim.rudderDeg = clamp(
        toDegrees(deltaRad),
        -nomotoModel.maxRudderDeg,
        nomotoModel.maxRudderDeg,
      );
      sim.prevErrorRad = errorRad;
    }

    // 4. 船舶运动学更新 (Nomoto)
    const rudderRad = toRadians(sim.rudderDeg);
    sim.yawRateRad += ((nomotoModel.K * rudderRad - sim.yawRateRad) / nomotoModel.T) * dt;
    sim.headingRad += sim.yawRateRad * dt;

    sim.position.x += sim.speedMps * Math.cos(sim.headingRad) * dt;
    sim.position.z += sim.speedMps * Math.sin(sim.headingRad) * dt;

    // 5. 波浪运动学
    const posX = sim.position.x;
    const posZ = sim.position.z;
    const heading = sim.headingRad;
    const halfLength = shipDimensions.length / 2;
    const halfWidth = shipDimensions.width / 2;
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);

    const centerY = getWaveHeight(posX, posZ, elapsedTime);
    const bowY = getWaveHeight(posX + cosH * halfLength, posZ + sinH * halfLength, elapsedTime);
    const sternY = getWaveHeight(posX - cosH * halfLength, posZ - sinH * halfLength, elapsedTime);
    const portY = getWaveHeight(posX - sinH * halfWidth, posZ + cosH * halfWidth, elapsedTime);
    const starboardY = getWaveHeight(posX + sinH * halfWidth, posZ - cosH * halfWidth, elapsedTime);

    const targetPitch = Math.atan2(bowY - sternY, shipDimensions.length);
    const targetRoll = Math.atan2(portY - starboardY, shipDimensions.width);

    const heaveLerp = 0.02;
    const rotLerp = 0.02;
    
    sim.waveY = THREE.MathUtils.lerp(sim.waveY, centerY, heaveLerp);
    sim.wavePitch = THREE.MathUtils.lerp(sim.wavePitch, targetPitch, rotLerp);
    sim.waveRoll = THREE.MathUtils.lerp(sim.waveRoll, targetRoll, rotLerp);

    if (shipRef.current) {
      shipRef.current.position.set(sim.position.x, sim.waveY + 15.5, sim.position.z); 
      shipRef.current.rotation.set(
        sim.wavePitch,
        -sim.headingRad + Math.PI / 2,
        sim.waveRoll
      );
    }

    // 6. 误差计算与HUD更新
    const currentError = getCrossTrackError(sim.position, guidePath);
    
    // 只在仿真开始后统计
    if (simTime > 0) {
        totalErrorRef.current += currentError;
        errorSampleCountRef.current += 1;
    }
    const avgError = errorSampleCountRef.current > 0 
        ? totalErrorRef.current / errorSampleCountRef.current 
        : 0;

    if (elapsedTime - lastHudUpdateRef.current > 0.1) {
      lastHudUpdateRef.current = elapsedTime;
      onHudUpdate({
        heading: normalizeHeading(toDegrees(sim.headingRad)),
        yawRate: toDegrees(sim.yawRateRad),
        rudder: sim.rudderDeg,
        speed: sim.speedMps,
        position: { x: sim.position.x, z: sim.position.z },
        avgError,
        currentError,
        time: simTime,
      });
    }

    // 7. 图表更新
    if (simTime - lastChartSampleRef.current > 0.5) {
      lastChartSampleRef.current = simTime;
      const headingDeg = normalizeSignedHeading(toDegrees(sim.headingRad));
      const targetHeadingSigned = normalizeSignedHeading(targetHeading);
      // targetHeading is computed at top of frame
      onChartDataUpdate(simTime, targetHeadingSigned, headingDeg, sim.speedMps, sim.rudderDeg);
    }
  });

  return null;
}

// 固定种子的随机数生成器
function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function ProceduralClouds() {
  const cloudsRef = useRef<THREE.InstancedMesh>(null);

  const cloudInstances = useMemo(() => {
    const random = seededRandom(42); // 固定种子保证静态
    const instances: Array<{
      position: THREE.Vector3;
      scale: THREE.Vector3;
      rotation: number;
    }> = [];

    for (let i = 0; i < 50; i++) {
      const angle = random() * Math.PI * 2;
      const distance = 3000 + random() * 4000;
      const height = 800 + random() * 600;
      const size = 80 + random() * 150;

      instances.push({
        position: new THREE.Vector3(
          Math.cos(angle) * distance,
          height,
          Math.sin(angle) * distance,
        ),
        scale: new THREE.Vector3(size, size * 0.4, size * 0.7),
        rotation: random() * Math.PI * 2,
      });
    }

    return instances;
  }, []);

  useLayoutEffect(() => {
    if (!cloudsRef.current) return;

    const tempMatrix = new THREE.Matrix4();
    cloudInstances.forEach((cloud, i) => {
      tempMatrix.makeRotationY(cloud.rotation);
      tempMatrix.setPosition(cloud.position);
      tempMatrix.scale(cloud.scale);
      cloudsRef.current!.setMatrixAt(i, tempMatrix);
    });

    cloudsRef.current.instanceMatrix.needsUpdate = true;
  }, [cloudInstances]);

  return (
    <instancedMesh ref={cloudsRef} args={[undefined, undefined, 50]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function SkyDome() {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(10000, 64, 64);
    const colors: number[] = [];
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const normalizedY = (y / 10000 + 1) / 2; // 0 at bottom, 1 at top

      // 从地平线到天顶的渐变
      const horizonColor = new THREE.Color('#d4e8f7'); // 地平线：更亮的蓝色
      const zenithColor = new THREE.Color('#4a7ba7');  // 天顶：真实天空蓝
      const blendFactor = Math.pow(Math.max(0, normalizedY - 0.5) * 2, 0.6);
      const color = horizonColor.clone().lerp(zenithColor, blendFactor);

      colors.push(color.r, color.g, color.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} />
    </mesh>
  );
}

function WaveWater({ simRef }: { simRef: React.MutableRefObject<SimulationState> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // High resolution plane for waves
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(60000, 60000, 512, 512);
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (meshRef.current) {
      // Follow the ship (infinite ocean illusion)
      meshRef.current.position.x = simRef.current.position.x;
      meshRef.current.position.z = simRef.current.position.z;
    }
    
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      {/* @ts-ignore */}
      <waterShaderMaterial ref={materialRef} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}

function GridHelper({ simRef }: { simRef: React.MutableRefObject<SimulationState> }) {
  const gridRef = useRef<THREE.Group>(null);
  const gridSize = 100; // 100米
  const gridExtent = 50; // 显示50x50格（5000米范围）

  const lines = useMemo(() => {
    const linePoints: THREE.Vector3[][] = [];
    const halfExtent = gridExtent / 2;
    const gridHeight = 4; // 固定在水面上方（高于最大波浪振幅2.8）

    // 横向线（Z方向）
    for (let x = -halfExtent; x <= halfExtent; x++) {
      linePoints.push([
        new THREE.Vector3(x * gridSize, gridHeight, -halfExtent * gridSize),
        new THREE.Vector3(x * gridSize, gridHeight, halfExtent * gridSize),
      ]);
    }

    // 纵向线（X方向）
    for (let z = -halfExtent; z <= halfExtent; z++) {
      linePoints.push([
        new THREE.Vector3(-halfExtent * gridSize, gridHeight, z * gridSize),
        new THREE.Vector3(halfExtent * gridSize, gridHeight, z * gridSize),
      ]);
    }

    return linePoints;
  }, []);

  useFrame(() => {
    if (!gridRef.current) return;
    const sim = simRef.current;

    // 网格跟随船舶，但对齐到100米网格
    const snappedX = Math.round(sim.position.x / gridSize) * gridSize;
    const snappedZ = Math.round(sim.position.z / gridSize) * gridSize;

    gridRef.current.position.set(snappedX, 0, snappedZ);
  });

  return (
    <group ref={gridRef}>
      {lines.map((points, i) => (
        <Line key={i} points={points} color="#88ccff" lineWidth={1.0} transparent opacity={0.35} />
      ))}
    </group>
  );
}

function GuideRoute({
  points,
}: {
  points: THREE.Vector3[];
}) {
  if (!points || points.length < 2) return null;
  return (
    <Line points={points} color="#ef4444" lineWidth={3} dashed={false} />
  );
}

// 简化 Island，暂时不显示，因为场景逻辑已变
function Island(props: any) {
  return null;
}

function ShipTrail({
  simRef,
  resetToken,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  resetToken: number;
}) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const lastRecordRef = useRef(0);

  useEffect(() => {
    setPoints([]);
    lastRecordRef.current = 0;
  }, [resetToken]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (time - lastRecordRef.current < 0.25) return;
    lastRecordRef.current = time;

    setPoints((prev) => {
      const next = [...prev, simRef.current.position.clone().setY(0.7)];
      return next.length > 4000 ? next.slice(-4000) : next;
    });
  });

  if (points.length < 2) {
    return null;
  }

  return <Line points={points} color="#22c55e" lineWidth={2} />;
}

function ShipWake({
  simRef,
}: {
  simRef: React.MutableRefObject<SimulationState>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wakeLength = 150;
  const wakeWidth = 35; 
  const segments = 12; 

  const { geometry, colorAttr } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    positions.push(0, 0.5, 0);
    colors.push(1, 1, 1, 0.85);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = -t * wakeLength;
      const spreadHalf = t * wakeWidth * 0.5;
      const alpha = (1 - t) * 0.7; 

      positions.push(x, 0.3, spreadHalf);
      colors.push(1, 1, 1, alpha);

      positions.push(x, 0.3, -spreadHalf);
      colors.push(1, 1, 1, alpha);
    }

    indices.push(0, 1, 2);

    for (let i = 1; i < segments; i++) {
      const leftCurr = i * 2 - 1;
      const rightCurr = i * 2;
      const leftNext = (i + 1) * 2 - 1;
      const rightNext = (i + 1) * 2;

      indices.push(leftCurr, leftNext, rightNext);
      indices.push(leftCurr, rightNext, rightCurr);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return { geometry: geo, colorAttr: geo.attributes.color as THREE.BufferAttribute };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const sim = simRef.current;
    const time = state.clock.getElapsedTime();

    meshRef.current.position.set(sim.position.x, sim.waveY + 0.8, sim.position.z);
    meshRef.current.rotation.y = -sim.headingRad;

    const speedFactor = Math.max(0.4, sim.speedMps / 15);
    meshRef.current.scale.set(speedFactor, 1, speedFactor);

    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const baseY = 0.3;
      const waveOffset = Math.sin(time * 2 + t * 5) * 0.15 * t;

      const leftIdx = (i * 2 - 1) * 3 + 1;
      positions[leftIdx] = baseY + waveOffset;

      const rightIdx = (i * 2) * 3 + 1;
      positions[rightIdx] = baseY + waveOffset;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        vertexColors
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function MiniMap({
  guidePath,
  trail,
  position,
  heading,
}: {
  guidePath: THREE.Vector3[];
  trail: Array<{ x: number; z: number }>;
  position: { x: number; z: number };
  heading: number;
}) {
  const size = 180;
  
  const viewRadius = 800; // 扩大视野以适应新比例
  const bounds = useMemo(() => {
    return {
      minX: position.x - viewRadius,
      maxX: position.x + viewRadius,
      minZ: position.z - viewRadius,
      maxZ: position.z + viewRadius,
    };
  }, [position.x, position.z]);

  const scale = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) || 1;
  const toMap = (point: { x: number; z: number }) => {
    const x = ((point.x - bounds.minX) / scale) * size;
    const y = ((point.z - bounds.minZ) / scale) * size;
    return { x, y };
  };

  const guidePathStr = guidePath.map((point) => {
    const mapped = toMap({ x: point.x, z: point.z });
    return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
  }).join(' ');

  const trailPath = trail.map((point) => {
    const mapped = toMap(point);
    return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
  }).join(' ');

  const ship = toMap(position);
  const shipRotation = heading;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-2 text-[10px] text-slate-200 backdrop-blur">
      <div className="flex items-center justify-between px-1 pb-1 text-[11px] text-slate-300">
        <span>战术俯瞰</span>
        <span className="text-emerald-300">实时</span>
      </div>
      <svg width={size} height={size} className="rounded-lg bg-transparent">
        <rect width={size} height={size} fill="#0b1324" fillOpacity="0.65" />
        {guidePath.length > 1 ? (
          <polyline
            points={guidePathStr}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
          />
        ) : null}
        {trail.length > 1 ? (
          <polyline
            points={trailPath}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
          />
        ) : null}
        <g transform={`translate(${ship.x} ${ship.y}) rotate(${shipRotation})`}>
          <polygon points="8,0 -6,-5 -6,5" fill="#3b82f6" />
        </g>
      </svg>
      <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-400">
        <span>红色: 期望航线</span>
        <span>绿色: 实际航迹</span>
      </div>
    </div>
  );
}

function ShipModel({ shipRef }: { shipRef: React.RefObject<THREE.Group> }) {
  const { scene } = useGLTF('/assets/destroyer.glb');
  const { model, scale, size } = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    cloned.position.sub(center);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = 180;
    const scale = targetLength / maxDim;

    return { model: cloned, scale, size };
  }, [scene]);

  return (
    <group ref={shipRef} scale={scale} position={[0, size.y * scale * 0.5 - 1.5, 0]}>
      <primitive object={model} />
    </group>
  );
}

type CameraOffset = {
  azimuth: number;
  elevation: number;
  panX: number;
  panZ: number;
};

function CameraRig({
  cameraView,
  simRef,
  cameraOffset,
}: {
  cameraView: CameraView;
  simRef: React.MutableRefObject<SimulationState>;
  cameraOffset: CameraOffset;
}) {
  const { camera } = useThree();

  const baseDistances = useMemo(
    () => ({
      chase: { distance: 405, height: 112 },
      overhead: { distance: 0, height: 500 },
      tactical: { distance: 380, height: 200 },
    }),
    [],
  );

  useFrame(() => {
    const sim = simRef.current;
    const config = baseDistances[cameraView];
    let desiredPosition: THREE.Vector3;
    let lookTarget: THREE.Vector3;

    const targetX = sim.position.x + cameraOffset.panX;
    const targetZ = sim.position.z + cameraOffset.panZ;

    if (cameraView === 'chase') {
      const totalAzimuth = sim.headingRad + Math.PI + cameraOffset.azimuth;
      const elevationAngle = cameraOffset.elevation + 0.25;

      const horizontalDist = config.distance * Math.cos(elevationAngle);
      const verticalDist = config.height + config.distance * Math.sin(elevationAngle);

      desiredPosition = new THREE.Vector3(
        targetX + horizontalDist * Math.cos(totalAzimuth),
        verticalDist,
        targetZ + horizontalDist * Math.sin(totalAzimuth),
      );

      const forward = new THREE.Vector3(
        Math.cos(sim.headingRad),
        0,
        Math.sin(sim.headingRad),
      );
      lookTarget = new THREE.Vector3(targetX, 8, targetZ).add(forward.multiplyScalar(50));

      camera.position.lerp(desiredPosition, 0.12);
    } else if (cameraView === 'overhead') {
      desiredPosition = new THREE.Vector3(
        targetX,
        config.height,
        targetZ,
      );
      lookTarget = new THREE.Vector3(targetX, 0, targetZ);
      camera.position.lerp(desiredPosition, 0.1);
    } else {
      const tacticalAngle = sim.headingRad + Math.PI * 0.75 + cameraOffset.azimuth;
      const elevationAngle = cameraOffset.elevation + 0.4;
      const horizontalDist = config.distance * Math.cos(elevationAngle);
      const verticalDist = config.height + config.distance * Math.sin(elevationAngle);

      desiredPosition = new THREE.Vector3(
        targetX + horizontalDist * Math.cos(tacticalAngle),
        verticalDist,
        targetZ + horizontalDist * Math.sin(tacticalAngle),
      );
      lookTarget = new THREE.Vector3(targetX, 6, targetZ);
      camera.position.lerp(desiredPosition, 0.1);
    }

    camera.lookAt(lookTarget);
  });

  return null;
}

useGLTF.preload('/assets/destroyer.glb');

export default DestroyerSimulation;
