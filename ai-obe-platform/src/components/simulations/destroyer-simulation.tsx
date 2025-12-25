'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, extend, ReactThreeFiber } from '@react-three/fiber';
import { Line, useGLTF, shaderMaterial } from '@react-three/drei';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type ControlMode = 'manual' | 'p' | 'pd' | 'pid';
type CameraView = 'chase' | 'overhead' | 'tactical';

type TaskScenario = 'turn90' | 'obstacle' | 'circle';

type Task = {
  id: string;
  title: string;
  scenario: TaskScenario;
  targetHeading?: number;
  tolerance: number;
  holdSeconds: number;
  description: string;
};

type HudState = {
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  position: { x: number; z: number };
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
  speedMps: 15.4,
};

const speedLimits = {
  min: 4,
  max: 22,
  accel: 3.2,
};

// 波浪参数：调整为更真实的海洋参数
// 振幅(A), 频率(w = 2*PI/L), 速度(phi), 方向X, 方向Z
// 优化方向：增加方向的随机性，避免平行波纹；略微降低主波高以减少淹没
const waveParams = [
  { amplitude: 1.2, frequency: 0.018, speed: 0.9, direction: { x: 1.0, z: 0.1 } }, // 主涌浪
  { amplitude: 0.9, frequency: 0.035, speed: 1.1, direction: { x: 0.4, z: 0.9 } }, // 交叉浪
  { amplitude: 0.6, frequency: 0.06, speed: 1.3, direction: { x: -0.6, z: 0.5 } }, // 干扰浪
  { amplitude: 0.35, frequency: 0.12, speed: 1.6, direction: { x: 0.3, z: -0.7 } }, // 细节浪
  { amplitude: 0.15, frequency: 0.25, speed: 2.0, direction: { x: -0.5, z: -0.6 } }, // 微波
];

// 计算指定位置的水面高度 (CPU版，用于物理计算)
// 保持与 Shader 逻辑一致
function getWaveHeight(x: number, z: number, time: number): number {
  let y = 0;
  waveParams.forEach((wave) => {
    // direction 已经在定义时归一化或近似归一化，这里直接点乘
    // Shader: dot(position.xz, direction) * frequency + time * speed
    const phase = (x * wave.direction.x + z * wave.direction.z) * wave.frequency + time * wave.speed;
    y += wave.amplitude * Math.sin(phase);
  });
  return y;
}

// 船舶尺寸（用于计算俯仰和横摇）
const shipDimensions = {
  length: 80, // 米
  width: 20,  // 米
};

const tasks: Task[] = [
  {
    id: 'turn-90',
    title: '90° 转向任务',
    scenario: 'turn90',
    targetHeading: 90,
    tolerance: 5,
    holdSeconds: 5,
    description: '沿红色航线转向至 90°，稳定在 ±5° 持续 5 秒。',
  },
  {
    id: 'avoid-obstacle',
    title: '避障航线任务',
    scenario: 'obstacle',
    tolerance: 0,
    holdSeconds: 0,
    description: '按红色指引航线绕开海岛障碍，避免进入危险半径。',
  },
  {
    id: 'circle-route',
    title: '圆形航线任务',
    scenario: 'circle',
    tolerance: 40,
    holdSeconds: 0,
    description: '沿红色圆形航线完成一圈，保持尽量贴近轨迹。',
  },
];

type ScenarioConfig = {
  start: { x: number; z: number; headingDeg: number };
  guidePath?: THREE.Vector3[];
  island?: { x: number; z: number; radius: number; height: number };
  finishX?: number;
  circle?: { x: number; z: number; radius: number };
};

const scenarioConfigs: Record<TaskScenario, ScenarioConfig> = {
  turn90: {
    start: { x: -2700, z: 0, headingDeg: 0 },
    guidePath: [
      new THREE.Vector3(-2700, 0.5, 0),
      new THREE.Vector3(2700, 0.5, 0),
      new THREE.Vector3(2700, 0.5, 20000),  // 延伸至远处
    ],
  },
  obstacle: {
    start: { x: -960, z: 0, headingDeg: 0 },
    guidePath: [
      new THREE.Vector3(-960, 0.5, 0),
      new THREE.Vector3(240, 0.5, 0),
      new THREE.Vector3(600, 0.5, 420),
      new THREE.Vector3(1260, 0.5, 420),
      new THREE.Vector3(1860, 0.5, 0),
    ],
    island: { x: 660, z: 0, radius: 240, height: 120 },
    finishX: 1860,
  },
  circle: {
    start: { x: 0, z: -660, headingDeg: 90 },
    circle: { x: 0, z: 0, radius: 600 },
  },
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

const angleDelta = (target: number, current: number) => {
  const normalizedTarget = normalizeHeading(target);
  const normalizedCurrent = normalizeHeading(current);
  let diff = normalizedTarget - normalizedCurrent;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
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
    // A, Freq, Speed, DirX, DirZ
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
    varying vec2 vUv; // Recieve UVs

    // Simple pseudo-random noise function
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    // Value noise
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

      // Simple Lambert + Specular
      float light = max(dot(normal, sunDir), 0.0);
      float specular = pow(max(dot(reflect(-sunDir, normal), viewDirection), 0.0), 64.0); // Sharper specular
      
      // Fresnel Effect
      float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.0);
      
      // Foam Logic:
      // 1. Base threshold on elevation
      // 2. Add noise to break up lines
      // 3. Sharp transition (step instead of smoothstep) for bubbly look
      float noiseVal = noise(vUv * 300.0); // High frequency noise
      float foamThreshold = 0.9; // Lower threshold to make foam appear earlier
      
      // Modulate elevation with noise to create "patchy" foam
      // Peaks are high elevation. We want foam where Elevation + Noise > Threshold
      float foamFactor = smoothstep(foamThreshold, foamThreshold + 0.3, vElevation + noiseVal * 0.4);
      
      // Mix colors
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

// Add type definition for the custom shader material
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
};

function SimulationChart({ data, onBack }: { data: ChartData; onBack: () => void }) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 销毁旧图表
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // 创建新图表
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
            labels: {
              color: '#e2e8f0',
              font: { size: 12 },
            },
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
            title: {
              display: true,
              text: '时间 (秒)',
              color: '#cbd5e1',
              font: { size: 13 },
            },
            ticks: {
              color: '#94a3b8',
              maxTicksLimit: 15,
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.1)',
            },
          },
          'y-heading': {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: '航向角 (°)',
              color: '#cbd5e1',
              font: { size: 13 },
            },
            min: 0,
            max: 360,
            ticks: {
              color: '#94a3b8',
              stepSize: 45,
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
            },
          },
          'y-speed': {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: '航速 (m/s)',
              color: '#cbd5e1',
              font: { size: 13 },
            },
            ticks: {
              color: '#94a3b8',
            },
            grid: {
              drawOnChartArea: false,
            },
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
          返回仿真
        </Button>
      </div>
      <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
}

export function DestroyerSimulation() {
  const [cameraView, setCameraView] = useState<CameraView>('chase');
  const [controlMode, setControlMode] = useState<ControlMode>('manual');
  const [targetHeading, setTargetHeading] = useState(tasks[0].targetHeading ?? 90);
  const [pidGains, setPidGains] = useState({ kp: 1.4, ki: 0.02, kd: 0.7 });
  const [hud, setHud] = useState<HudState>({
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: nomotoModel.speedMps,
    position: { x: 0, z: 0 },
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [miniTrail, setMiniTrail] = useState<Array<{ x: number; z: number }>>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [taskProgress, setTaskProgress] = useState(0);
  const [obstacleHit, setObstacleHit] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1);
  const [cameraOffset, setCameraOffset] = useState({
    azimuth: 0,
    elevation: 0,
    panX: 0,
    panZ: 0,
  });
  const [viewMode, setViewMode] = useState<'simulation' | 'chart'>('simulation');
  const [chartData, setChartData] = useState<{
    time: number[];
    desiredHeading: number[];
    actualHeading: number[];
    speed: number[];
  }>({
    time: [],
    desiredHeading: [],
    actualHeading: [],
    speed: [],
  });

  const speedOptions = useMemo(() => [0.5, 1, 2, 4], []);

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

  const handleChartDataUpdate = useCallback((time: number, desiredHeading: number, actualHeading: number, speed: number) => {
    setChartData(prev => {
      const newData = {
        time: [...prev.time, time],
        desiredHeading: [...prev.desiredHeading, desiredHeading],
        actualHeading: [...prev.actualHeading, actualHeading],
        speed: [...prev.speed, speed],
      };
      const maxPoints = 2000;
      if (newData.time.length > maxPoints) {
        return {
          time: newData.time.slice(-maxPoints),
          desiredHeading: newData.desiredHeading.slice(-maxPoints),
          actualHeading: newData.actualHeading.slice(-maxPoints),
          speed: newData.speed.slice(-maxPoints),
        };
      }
      return newData;
    });
  }, []);

  const rudderDirectionRef = useRef(0);
  const speedDirectionRef = useRef(0);
  const holdRef = useRef(0);
  const circleStateRef = useRef({ totalAngle: 0, lastAngle: 0 });
  const trailStampRef = useRef(0);
  const skipFirstTrailUpdateRef = useRef(true); // 跳过首次航迹更新，避免hud.position初始值(0,0)的错误点

  // 用于任务判定的 refs，避免 setInterval 闭包问题
  const hudRef = useRef(hud);
  const targetHeadingRef = useRef(targetHeading);
  const obstacleHitRef = useRef(obstacleHit);

  // 同步最新值到 refs
  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);

  useEffect(() => {
    targetHeadingRef.current = targetHeading;
  }, [targetHeading]);

  useEffect(() => {
    obstacleHitRef.current = obstacleHit;
  }, [obstacleHit]);

  const activeTask = tasks[taskIndex];
  const angleError = angleDelta(targetHeading, hud.heading);
  const scenarioConfig = scenarioConfigs[activeTask.scenario];

  const resetScenarioState = useCallback(() => {
    holdRef.current = 0;
    setTaskProgress(0);
    setObstacleHit(false);
    setMiniTrail([]);
    trailStampRef.current = 0;
    skipFirstTrailUpdateRef.current = true; // 重置后跳过首次航迹更新
    lastChartSampleRef.current = 0;
    simulationStartTimeRef.current = -1; // 标记需要重置，在 SimulationLoop 中会设置为当前时间
    lastRudderStepTimeRef.current = 0;
    lastSpeedStepTimeRef.current = 0;
    if (scenarioConfig.circle) {
      const startAngle = Math.atan2(
        scenarioConfig.start.z - scenarioConfig.circle.z,
        scenarioConfig.start.x - scenarioConfig.circle.x,
      );
      circleStateRef.current = { totalAngle: 0, lastAngle: startAngle };
    } else {
      circleStateRef.current = { totalAngle: 0, lastAngle: 0 };
    }
    setChartData({ time: [], desiredHeading: [], actualHeading: [], speed: [] });
    setResetToken((prev) => prev + 1);
  }, [scenarioConfig]);

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

  useEffect(() => {
    if (!activeTask) return;
    if (activeTask.targetHeading !== undefined) {
      setTargetHeading(activeTask.targetHeading);
    }
    resetScenarioState();
  }, [activeTask, resetScenarioState]);

  useEffect(() => {
    // 跳过首次更新，避免hud.position初始值(0,0)导致的错误航迹点
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

  useEffect(() => {
    if (!activeTask) return;
    const interval = setInterval(() => {
      let isComplete = false;
      let progress = 0;

      // 使用 refs 获取最新值，避免闭包捕获旧值
      const currentHud = hudRef.current;
      const currentTargetHeading = targetHeadingRef.current;
      const currentObstacleHit = obstacleHitRef.current;

      if (activeTask.scenario === 'turn90') {
        const error = angleDelta(currentTargetHeading, currentHud.heading);
        if (Math.abs(error) <= activeTask.tolerance) {
          holdRef.current += 0.2;
        } else {
          holdRef.current = 0;
        }

        progress = activeTask.holdSeconds
          ? Math.min(1, holdRef.current / activeTask.holdSeconds)
          : 0;
        isComplete = holdRef.current >= activeTask.holdSeconds;
      }

      if (activeTask.scenario === 'obstacle') {
        const island = scenarioConfig.island;
        const finishX = scenarioConfig.finishX ?? 0;
        if (island) {
          const distance = Math.hypot(
            currentHud.position.x - island.x,
            currentHud.position.z - island.z,
          );
          if (distance < island.radius + 10) {
            setObstacleHit(true);
            setTimeout(() => setObstacleHit(false), 1200);
            setResetToken((prev) => prev + 1);
            holdRef.current = 0;
          }
        }
        progress = clamp(
          (currentHud.position.x - scenarioConfig.start.x) / (finishX - scenarioConfig.start.x),
          0,
          1,
        );
        isComplete = !currentObstacleHit && currentHud.position.x >= finishX;
      }

      if (activeTask.scenario === 'circle') {
        const circle = scenarioConfig.circle;
        if (circle) {
          const dx = currentHud.position.x - circle.x;
          const dz = currentHud.position.z - circle.z;
          const angle = Math.atan2(dz, dx);
          const radiusError = Math.abs(Math.hypot(dx, dz) - circle.radius);
          let delta = angle - circleStateRef.current.lastAngle;
          if (delta > Math.PI) delta -= Math.PI * 2;
          if (delta < -Math.PI) delta += Math.PI * 2;

          if (radiusError <= activeTask.tolerance) {
            circleStateRef.current.totalAngle += delta;
          }

          circleStateRef.current.lastAngle = angle;
          progress = Math.min(1, Math.abs(circleStateRef.current.totalAngle) / (Math.PI * 2));
          isComplete = progress >= 1;
        }
      }

      setTaskProgress(progress);

      if (isComplete) {
        setCompletedTaskIds((prev) =>
          prev.includes(activeTask.id) ? prev : [...prev, activeTask.id],
        );
        if (taskIndex < tasks.length - 1) {
          setTaskIndex((prev) => prev + 1);
        }
        holdRef.current = 0;
        setTaskProgress(0);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [activeTask, scenarioConfig, taskIndex]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      {viewMode === 'chart' ? (
        <div className="h-[600px] w-full">
          <SimulationChart data={chartData} onBack={() => setViewMode('simulation')} />
        </div>
      ) : null}
      <div
        className={`${viewMode === 'chart' ? 'hidden' : 'grid'} gap-8 ${
          panelOpen ? 'lg:grid-cols-[2fr_1fr]' : 'lg:grid-cols-1'
        }`}
      >
        <div className="space-y-6 min-w-0">
          <div className="relative h-[560px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
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
              <div className="h-5 w-px bg-slate-700" />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-3 text-xs text-slate-300 hover:text-white"
                onClick={() => setViewMode(viewMode === 'simulation' ? 'chart' : 'simulation')}
              >
                {viewMode === 'simulation' ? '查看曲线' : '返回仿真'}
              </Button>
            </div>
            <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPanelOpen((prev) => !prev)}
                >
                  {panelOpen ? '折叠参数栏' : '展开参数栏'}
                </Button>
                <Button size="sm" variant="outline" onClick={resetScenarioState}>
                  重置仿真
                </Button>
              </div>
              <MiniMap
                scenarioConfig={scenarioConfig}
                trail={miniTrail}
                position={hud.position}
                heading={hud.heading}
              />
            </div>
            <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">
              <p>航向: {hud.heading.toFixed(1)}°</p>
              <p>偏差: {angleError.toFixed(1)}°</p>
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
                targetHeading={targetHeading}
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
                        <p className="text-xs text-slate-400">
                          {task.scenario === 'turn90'
                            ? `目标航向 ${task.targetHeading}° · 允许误差 ±${task.tolerance}°`
                            : task.scenario === 'obstacle'
                            ? '红色航线为推荐避障路线'
                            : '贴近红色圆环完成一圈'}
                        </p>
                        <progress
                          className="h-2 w-full accent-emerald-400"
                          value={taskProgress}
                          max={1}
                        />
                      </div>
                    ) : null}
                    {isActive && obstacleHit && task.scenario === 'obstacle' ? (
                      <p className="mt-2 text-xs text-red-300">发生碰撞，已重置任务。</p>
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
                  holdRef.current = 0;
                  setResetToken((prev) => prev + 1);
                }}
              >
                重新开始任务链
              </Button>
            </CardContent>
          </Card>
        </div>
        {panelOpen ? (
          <div className="space-y-6 min-w-0">
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-lg text-white">055 型驱逐舰模型</CardTitle>
              </CardHeader>
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
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-lg text-white">控制模式</CardTitle>
              </CardHeader>
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
                  <p className="text-xs text-slate-400">目标航向</p>
                  <p className="text-lg text-white">{targetHeading.toFixed(0)}°</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">航速</p>
                  <p className="text-lg text-white">{hud.speed.toFixed(1)} m/s</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-lg text-white">PID 调参</CardTitle>
              </CardHeader>
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
                  <span>偏航角速度</span>
                  <span className="text-white">{hud.yawRate.toFixed(2)}°/s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>舵角</span>
                  <span className="text-white">{hud.rudder.toFixed(1)}°</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>控制模式</span>
                  <span className="text-white">{controlMode.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>偏差</span>
                  <span className="text-white">{angleError.toFixed(1)}°</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
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
  scenarioConfig: (typeof scenarioConfigs)[TaskScenario];
  simSpeed: number;
  cameraOffset: { azimuth: number; elevation: number; panX: number; panZ: number };
  onCameraOffsetChange: (offset: { azimuth: number; elevation: number; panX: number; panZ: number }) => void;
  onChartDataUpdate: (time: number, desiredHeading: number, actualHeading: number, speed: number) => void;
  lastChartSampleRef: React.MutableRefObject<number>;
  simulationStartTimeRef: React.MutableRefObject<number>;
  lastRudderStepTimeRef: React.MutableRefObject<number>;
  lastSpeedStepTimeRef: React.MutableRefObject<number>;
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
        // 右键：围绕船舶旋转视角（轨道控制）
        onCameraOffsetChange({
          ...cameraOffset,
          azimuth: cameraOffset.azimuth + deltaX * 0.005,
          elevation: clamp(cameraOffset.elevation - deltaY * 0.003, -0.3, 0.8),
        });
      } else if (dragButtonRef.current === 0) {
        // 左键：平移（在相机视平面上移动lookAt目标）
        // 根据当前视角方向计算平移向量
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
        <GuideRoute scenarioConfig={scenarioConfig} />
        {scenarioConfig.island ? <Island {...scenarioConfig.island} /> : null}
        <ShipTrail simRef={simRef} resetToken={resetToken} />
        <ShipWake simRef={simRef} />
        <ShipModel shipRef={shipRef} />
        <SimulationLoop
          shipRef={shipRef}
          simRef={simRef}
          controlMode={controlMode}
          pidGains={pidGains}
          targetHeading={targetHeading}
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
        />
        <CameraRig cameraView={cameraView} simRef={simRef} cameraOffset={cameraOffset} />
      </Canvas>
    </div>
  );
}

type SimulationLoopProps = {
  shipRef: React.RefObject<THREE.Group>;
  simRef: React.MutableRefObject<SimulationState>;
  controlMode: ControlMode;
  pidGains: { kp: number; ki: number; kd: number };
  targetHeading: number;
  rudderDirectionRef: React.MutableRefObject<number>;
  speedDirectionRef: React.MutableRefObject<number>;
  onHudUpdate: (state: HudState) => void;
  lastHudUpdateRef: React.MutableRefObject<number>;
  simSpeed: number;
  onChartDataUpdate: (time: number, desiredHeading: number, actualHeading: number, speed: number) => void;
  lastChartSampleRef: React.MutableRefObject<number>;
  simulationStartTimeRef: React.MutableRefObject<number>;
  lastRudderStepTimeRef: React.MutableRefObject<number>;
  lastSpeedStepTimeRef: React.MutableRefObject<number>;
};

function SimulationLoop({
  shipRef,
  simRef,
  controlMode,
  pidGains,
  targetHeading,
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
}: SimulationLoopProps) {
  useFrame((state, delta) => {
    const dt = Math.min(delta * simSpeed, 0.1);
    const sim = simRef.current;
    const headingDeg = normalizeHeading(toDegrees(sim.headingRad));
    const elapsedTime = state.clock.getElapsedTime();

    // 处理仿真时间重置（当 simulationStartTimeRef 为 -1 时，记录当前时钟时间作为起始点）
    if (simulationStartTimeRef.current < 0) {
      simulationStartTimeRef.current = elapsedTime;
    }
    const simTime = elapsedTime - simulationStartTimeRef.current;

    // 航速控制：手动模式下，每 100ms 步进 1 m/s
    if (controlMode === 'manual') {
      const speedStepInterval = 0.1; // 100ms
      const speedStepSize = 1; // 每步 1 m/s
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

    // 舵角控制：手动模式下，每 100ms 步进 1 度
    if (controlMode === 'manual') {
      const rudderStepInterval = 0.1; // 100ms
      const rudderStepSize = 1; // 每步 1 度
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
      const errorDeg = angleDelta(targetHeading, headingDeg);
      const errorRad = toRadians(errorDeg);
      const derivative = (errorRad - sim.prevErrorRad) / dt;
      sim.integral += errorRad * dt;

      let kp = pidGains.kp;
      let ki = pidGains.ki;
      let kd = pidGains.kd;
      if (controlMode === 'p') {
        ki = 0;
        kd = 0;
      } else if (controlMode === 'pd') {
        ki = 0;
      }

      const deltaRad = kp * errorRad + ki * sim.integral + kd * derivative;
      sim.rudderDeg = clamp(
        toDegrees(deltaRad),
        -nomotoModel.maxRudderDeg,
        nomotoModel.maxRudderDeg,
      );
      sim.prevErrorRad = errorRad;
    }

    const rudderRad = toRadians(sim.rudderDeg);
    sim.yawRateRad += ((nomotoModel.K * rudderRad - sim.yawRateRad) / nomotoModel.T) * dt;
    sim.headingRad += sim.yawRateRad * dt;

    sim.position.x += sim.speedMps * Math.cos(sim.headingRad) * dt;
    sim.position.z += sim.speedMps * Math.sin(sim.headingRad) * dt;

    // 计算船舶波浪起伏（高度、俯仰、横摇）
    const posX = sim.position.x;
    const posZ = sim.position.z;
    const heading = sim.headingRad;

    // 船首、船尾、左舷、右舷的位置偏移
    const halfLength = shipDimensions.length / 2;
    const halfWidth = shipDimensions.width / 2;
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);

    // 计算四个关键点的水面高度 (使用真实时间 elapsedTime 以匹配 shader)
    const centerY = getWaveHeight(posX, posZ, elapsedTime);
    const bowY = getWaveHeight(posX + cosH * halfLength, posZ + sinH * halfLength, elapsedTime);
    const sternY = getWaveHeight(posX - cosH * halfLength, posZ - sinH * halfLength, elapsedTime);
    const portY = getWaveHeight(posX - sinH * halfWidth, posZ + cosH * halfWidth, elapsedTime); // 左舷
    const starboardY = getWaveHeight(posX + sinH * halfWidth, posZ - cosH * halfWidth, elapsedTime); // 右舷

    // 计算目标俯仰角和横摇角
    const targetPitch = Math.atan2(bowY - sternY, shipDimensions.length);
    const targetRoll = Math.atan2(portY - starboardY, shipDimensions.width);

    // 平滑过渡（模拟大船惯性）
    // 大幅降低 lerpFactor 以增加"重感"，减少对高频波浪的响应
    const heaveLerp = 0.02; // 垂荡阻尼
    const rotLerp = 0.02;   // 摇摆阻尼
    
    // 吃水深度调整：确保船体大部分时间在水面以上，但又不会浮空
    // 船底位置 = 波浪高度 - 吃水 + 浮力修正
    
    sim.waveY = THREE.MathUtils.lerp(sim.waveY, centerY, heaveLerp);

    // 限制俯仰角和横摇角
    sim.wavePitch = THREE.MathUtils.lerp(sim.wavePitch, targetPitch, rotLerp);
    sim.waveRoll = THREE.MathUtils.lerp(sim.waveRoll, targetRoll, rotLerp);

    // 应用到船舶模型
    if (shipRef.current) {
      // 动态调整基准高度：
      // 之前是 smoothY - 1.5，导致船太低。
      // 现在改为 smoothY + 0.5，提升船体约 2 米，减少甲板上浪。
      
      const avgY = (bowY + sternY + portY + starboardY) / 4;
      // 使用更平滑的 waveY (sim.waveY) 作为基础，而不是瞬时的 avgY，以过滤高频噪声
      
      shipRef.current.position.set(sim.position.x, sim.waveY + 0.5, sim.position.z); 
      shipRef.current.rotation.set(
        sim.wavePitch,                          // X轴：俯仰
        -sim.headingRad + Math.PI / 2,          // Y轴：航向
        sim.waveRoll                            // Z轴：横摇
      );
    }

    if (elapsedTime - lastHudUpdateRef.current > 0.1) {
      lastHudUpdateRef.current = elapsedTime;
      onHudUpdate({
        heading: normalizeHeading(toDegrees(sim.headingRad)),
        yawRate: toDegrees(sim.yawRateRad),
        rudder: sim.rudderDeg,
        speed: sim.speedMps,
        position: { x: sim.position.x, z: sim.position.z },
      });
    }

    // 图表数据采集（每0.5秒，使用相对于仿真开始的时间）
    if (simTime - lastChartSampleRef.current > 0.5) {
      lastChartSampleRef.current = simTime;
      onChartDataUpdate(simTime, targetHeading, headingDeg, sim.speedMps);
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
  scenarioConfig,
}: {
  scenarioConfig: (typeof scenarioConfigs)[TaskScenario];
}) {
  if (scenarioConfig.guidePath) {
    return (
      <Line points={scenarioConfig.guidePath} color="#ef4444" lineWidth={3} dashed={false} />
    );
  }

  if (scenarioConfig.circle) {
    const points = Array.from({ length: 160 }).map((_, index) => {
      const angle = (index / 160) * Math.PI * 2;
      return new THREE.Vector3(
        scenarioConfig.circle!.x + Math.cos(angle) * scenarioConfig.circle!.radius,
        0.6,
        scenarioConfig.circle!.z + Math.sin(angle) * scenarioConfig.circle!.radius,
      );
    });
    return <Line points={points} color="#ef4444" lineWidth={2} dashed={false} />;
  }

  return null;
}

function Island({
  x,
  z,
  radius,
  height,
}: {
  x: number;
  z: number;
  radius: number;
  height: number;
}) {
  return (
    <group position={[x, -2 + height / 2, z]}>
      <mesh>
        <cylinderGeometry args={[radius * 0.9, radius * 1.1, height, 32]} />
        <meshStandardMaterial color="#5a7c4f" roughness={0.8} />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius * 0.5, radius * 0.9, height * 0.4, 24]} />
        <meshStandardMaterial color="#3c5a3a" roughness={0.9} />
      </mesh>
    </group>
  );
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
  const wakeLength = 150; // 尾迹基础长度
  const wakeWidth = 35; // 尾迹最大宽度
  const segments = 12; // 尾迹分段数

  // 创建V形扇面几何体，带顶点颜色渐变
  const { geometry, colorAttr } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // 顶点0：船尾中心点（起点）
    positions.push(0, 0.5, 0);
    colors.push(1, 1, 1, 0.85); // 白色，较高透明度

    // 生成V形扇面顶点（左右两侧交替）
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = -t * wakeLength;
      const spreadHalf = t * wakeWidth * 0.5;
      const alpha = (1 - t) * 0.7; // 渐变到透明

      // 左侧点
      positions.push(x, 0.3, spreadHalf);
      colors.push(1, 1, 1, alpha);

      // 右侧点
      positions.push(x, 0.3, -spreadHalf);
      colors.push(1, 1, 1, alpha);
    }

    // 创建三角形索引
    // 第一层：中心点连接到第一对左右点
    indices.push(0, 1, 2);

    // 后续层：每层连接到下一层
    for (let i = 1; i < segments; i++) {
      const leftCurr = i * 2 - 1;
      const rightCurr = i * 2;
      const leftNext = (i + 1) * 2 - 1;
      const rightNext = (i + 1) * 2;

      // 左侧三角形
      indices.push(leftCurr, leftNext, rightNext);
      // 右侧三角形
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

    // 尾迹跟随船舶位置（使用波浪高度）
    meshRef.current.position.set(sim.position.x, sim.waveY + 1.5, sim.position.z);
    meshRef.current.rotation.y = -sim.headingRad;

    // 根据速度调整尾迹长度
    const speedFactor = Math.max(0.4, sim.speedMps / 15);
    meshRef.current.scale.set(speedFactor, 1, speedFactor);

    // 轻微的顶点动画（波动效果）
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const baseY = 0.3;
      const waveOffset = Math.sin(time * 2 + t * 5) * 0.15 * t;

      // 左侧点
      const leftIdx = (i * 2 - 1) * 3 + 1;
      positions[leftIdx] = baseY + waveOffset;

      // 右侧点
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
  scenarioConfig,
  trail,
  position,
  heading,
}: {
  scenarioConfig: ScenarioConfig;
  trail: Array<{ x: number; z: number }>;
  position: { x: number; z: number };
  heading: number;
}) {
  const size = 180;
  const padding = 16;

  const guidePoints = useMemo(() => {
    if (scenarioConfig.guidePath) {
      return scenarioConfig.guidePath.map((point) => ({ x: point.x, z: point.z }));
    }
    if (scenarioConfig.circle) {
      return Array.from({ length: 120 }).map((_, index) => {
        const angle = (index / 120) * Math.PI * 2;
        return {
          x: scenarioConfig.circle!.x + Math.cos(angle) * scenarioConfig.circle!.radius,
          z: scenarioConfig.circle!.z + Math.sin(angle) * scenarioConfig.circle!.radius,
        };
      });
    }
    return [];
  }, [scenarioConfig]);

  // 以船舶位置为中心的动态视图
  const viewRadius = 400; // 视野半径400米
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
    const y = ((point.z - bounds.minZ) / scale) * size;  // 移除倒置，直接映射
    return { x, y };
  };

  const guidePath = guidePoints.map((point) => {
    const mapped = toMap(point);
    return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
  });

  const trailPath = trail.map((point) => {
    const mapped = toMap(point);
    return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
  });

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
            points={guidePath.join(' ')}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
          />
        ) : null}
        {trailPath.length > 1 ? (
          <polyline
            points={trailPath.join(' ')}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
          />
        ) : null}
        {scenarioConfig.island ? (
          <circle
            cx={toMap({ x: scenarioConfig.island.x, z: scenarioConfig.island.z }).x}
            cy={toMap({ x: scenarioConfig.island.x, z: scenarioConfig.island.z }).y}
            r={(scenarioConfig.island.radius / scale) * size}
            fill="#36543a"
            stroke="#1f2f24"
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
  const { scene } = useGLTF('/assets/container.glb');
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
    const targetLength = 80;
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
      chase: { distance: 180, height: 50 },
      overhead: { distance: 0, height: 220 },
      tactical: { distance: 170, height: 90 },
    }),
    [],
  );

  useFrame(() => {
    const sim = simRef.current;
    const config = baseDistances[cameraView];
    let desiredPosition: THREE.Vector3;
    let lookTarget: THREE.Vector3;

    // 计算 lookAt 目标点（船舶位置 + 平移偏移）
    const targetX = sim.position.x + cameraOffset.panX;
    const targetZ = sim.position.z + cameraOffset.panZ;

    if (cameraView === 'chase') {
      // 主视角：始终在船舶正后方，跟随航向旋转
      const totalAzimuth = sim.headingRad + Math.PI + cameraOffset.azimuth;
      const elevationAngle = cameraOffset.elevation + 0.25;

      // 固定距离的轨道相机
      const horizontalDist = config.distance * Math.cos(elevationAngle);
      const verticalDist = config.height + config.distance * Math.sin(elevationAngle);

      desiredPosition = new THREE.Vector3(
        targetX + horizontalDist * Math.cos(totalAzimuth),
        verticalDist,
        targetZ + horizontalDist * Math.sin(totalAzimuth),
      );

      // 看向目标点前方（沿船舶航向）
      const forward = new THREE.Vector3(
        Math.cos(sim.headingRad),
        0,
        Math.sin(sim.headingRad),
      );
      lookTarget = new THREE.Vector3(targetX, 8, targetZ).add(forward.multiplyScalar(50));

      camera.position.lerp(desiredPosition, 0.12);
    } else if (cameraView === 'overhead') {
      // 俯瞰视角：正上方
      desiredPosition = new THREE.Vector3(
        targetX,
        config.height,
        targetZ,
      );
      lookTarget = new THREE.Vector3(targetX, 0, targetZ);
      camera.position.lerp(desiredPosition, 0.1);
    } else {
      // 战术斜角：固定角度偏移
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

useGLTF.preload('/assets/container.glb');

export default DestroyerSimulation;
