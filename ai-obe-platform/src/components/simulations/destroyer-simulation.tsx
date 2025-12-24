'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, useGLTF } from '@react-three/drei';

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

  const activeTask = tasks[taskIndex];
  const angleError = angleDelta(targetHeading, hud.heading);
  const scenarioConfig = scenarioConfigs[activeTask.scenario];

  const resetScenarioState = useCallback(() => {
    holdRef.current = 0;
    setTaskProgress(0);
    setObstacleHit(false);
    setMiniTrail([]);
    trailStampRef.current = 0;
    if (scenarioConfig.circle) {
      const startAngle = Math.atan2(
        scenarioConfig.start.z - scenarioConfig.circle.z,
        scenarioConfig.start.x - scenarioConfig.circle.x,
      );
      circleStateRef.current = { totalAngle: 0, lastAngle: startAngle };
    } else {
      circleStateRef.current = { totalAngle: 0, lastAngle: 0 };
    }
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

      if (activeTask.scenario === 'turn90') {
        const error = angleDelta(targetHeading, hud.heading);
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
            hud.position.x - island.x,
            hud.position.z - island.z,
          );
          if (distance < island.radius + 10) {
            setObstacleHit(true);
            setTimeout(() => setObstacleHit(false), 1200);
            setResetToken((prev) => prev + 1);
            holdRef.current = 0;
          }
        }
        progress = clamp(
          (hud.position.x - scenarioConfig.start.x) / (finishX - scenarioConfig.start.x),
          0,
          1,
        );
        isComplete = !obstacleHit && hud.position.x >= finishX;
      }

      if (activeTask.scenario === 'circle') {
        const circle = scenarioConfig.circle;
        if (circle) {
          const dx = hud.position.x - circle.x;
          const dz = hud.position.z - circle.z;
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
  }, [
    activeTask,
    hud.heading,
    hud.position.x,
    hud.position.z,
    obstacleHit,
    scenarioConfig,
    targetHeading,
    taskIndex,
  ]);

  if (viewMode === 'chart') {
    return <SimulationChart data={chartData} onBack={() => setViewMode('simulation')} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className={`grid gap-8 ${panelOpen ? 'lg:grid-cols-[2fr_1fr]' : 'lg:grid-cols-1'}`}>
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
        <ambientLight intensity={0.5} />
        <hemisphereLight intensity={0.6} groundColor="#2a5a7a" color="#ffffff" />
        <directionalLight position={[200, 150, 200]} intensity={1.0} color="#fff8e7" />
        <SkyDome />
        <ProceduralClouds />
        <WaveWater simRef={simRef} />
        <GridHelper simRef={simRef} />
        <GuideRoute scenarioConfig={scenarioConfig} />
        {scenarioConfig.island ? <Island {...scenarioConfig.island} /> : null}
        <ShipTrail simRef={simRef} resetToken={resetToken} />
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
}: SimulationLoopProps) {
  useFrame((state, delta) => {
    const dt = Math.min(delta * simSpeed, 0.1);
    const sim = simRef.current;
    const headingDeg = normalizeHeading(toDegrees(sim.headingRad));

    if (controlMode === 'manual') {
      sim.speedMps = clamp(
        sim.speedMps + speedDirectionRef.current * speedLimits.accel * dt,
        speedLimits.min,
        speedLimits.max,
      );
    } else {
      sim.speedMps = nomotoModel.speedMps;
    }

    if (controlMode === 'manual') {
      const manualRate = 25;
      sim.manualRudderDeg = clamp(
        sim.manualRudderDeg + rudderDirectionRef.current * manualRate * dt,
        -nomotoModel.maxRudderDeg,
        nomotoModel.maxRudderDeg,
      );
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

    if (shipRef.current) {
      shipRef.current.position.copy(sim.position);
      shipRef.current.rotation.y = -sim.headingRad + Math.PI / 2;
    }

    if (state.clock.getElapsedTime() - lastHudUpdateRef.current > 0.1) {
      lastHudUpdateRef.current = state.clock.getElapsedTime();
      onHudUpdate({
        heading: normalizeHeading(toDegrees(sim.headingRad)),
        yawRate: toDegrees(sim.yawRateRad),
        rudder: sim.rudderDeg,
        speed: sim.speedMps,
        position: { x: sim.position.x, z: sim.position.z },
      });
    }

    // 图表数据采集（每0.5秒）
    const time = state.clock.getElapsedTime();
    if (time - lastChartSampleRef.current > 0.5) {
      lastChartSampleRef.current = time;
      onChartDataUpdate(time, targetHeading, headingDeg, sim.speedMps);
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
  const geometry = useMemo(() => new THREE.PlaneGeometry(60000, 60000, 220, 220), []);
  const basePositions = useMemo(
    () => Float32Array.from(geometry.attributes.position.array),
    [geometry],
  );
  const waves = useMemo(
    () => [
      { amplitude: 2.8, frequency: 0.012, speed: 0.7, direction: new THREE.Vector2(1, 0) },
      { amplitude: 1.8, frequency: 0.019, speed: 0.5, direction: new THREE.Vector2(0.2, 0.9) },
      { amplitude: 1.4, frequency: 0.028, speed: 0.85, direction: new THREE.Vector2(-0.6, 0.4) },
      { amplitude: 0.9, frequency: 0.045, speed: 1.2, direction: new THREE.Vector2(0.7, -0.3) },
      { amplitude: 0.6, frequency: 0.072, speed: 1.5, direction: new THREE.Vector2(-0.4, 0.8) },
    ],
    [],
  );
  const normalUpdateRef = useRef(0);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
    const positions = positionAttr.array as Float32Array;

    for (let i = 0; i < positions.length; i += 3) {
      const baseX = basePositions[i];
      const baseZ = basePositions[i + 2];
      let y = 0;

      waves.forEach((wave) => {
        const dot = baseX * wave.direction.x + baseZ * wave.direction.y;
        y += wave.amplitude * Math.sin(dot * wave.frequency + time * wave.speed);
      });

      positions[i + 1] = y;
    }

    positionAttr.needsUpdate = true;

    if (time - normalUpdateRef.current > 0.5) {
      geometry.computeVertexNormals();
      normalUpdateRef.current = time;
    }

    if (meshRef.current) {
      meshRef.current.position.x = simRef.current.position.x;
      meshRef.current.position.z = simRef.current.position.z;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
      <meshPhongMaterial
        color="#2c7fb8"
        specular="#b3d9ff"
        shininess={120}
        side={THREE.DoubleSide}
      />
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

    // 横向线（Z方向）
    for (let x = -halfExtent; x <= halfExtent; x++) {
      linePoints.push([
        new THREE.Vector3(x * gridSize, 0.2, -halfExtent * gridSize),
        new THREE.Vector3(x * gridSize, 0.2, halfExtent * gridSize),
      ]);
    }

    // 纵向线（X方向）
    for (let z = -halfExtent; z <= halfExtent; z++) {
      linePoints.push([
        new THREE.Vector3(-halfExtent * gridSize, 0.2, z * gridSize),
        new THREE.Vector3(halfExtent * gridSize, 0.2, z * gridSize),
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
        <Line key={i} points={points} color="#ffffff" lineWidth={0.5} transparent opacity={0.15} />
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

  const bounds = useMemo(() => {
    const xs = [scenarioConfig.start.x, ...guidePoints.map((p) => p.x)];
    const zs = [scenarioConfig.start.z, ...guidePoints.map((p) => p.z)];

    if (scenarioConfig.finishX !== undefined) {
      xs.push(scenarioConfig.finishX);
      zs.push(scenarioConfig.start.z);
    }

    if (scenarioConfig.circle) {
      xs.push(scenarioConfig.circle.x - scenarioConfig.circle.radius);
      xs.push(scenarioConfig.circle.x + scenarioConfig.circle.radius);
      zs.push(scenarioConfig.circle.z - scenarioConfig.circle.radius);
      zs.push(scenarioConfig.circle.z + scenarioConfig.circle.radius);
    }

    if (scenarioConfig.island) {
      xs.push(scenarioConfig.island.x - scenarioConfig.island.radius);
      xs.push(scenarioConfig.island.x + scenarioConfig.island.radius);
      zs.push(scenarioConfig.island.z - scenarioConfig.island.radius);
      zs.push(scenarioConfig.island.z + scenarioConfig.island.radius);
    }

    if (xs.length === 0 || zs.length === 0) {
      return { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const span = Math.max(maxX - minX, maxZ - minZ) || 1;
    const margin = span * 0.35 + padding;

    return {
      minX: minX - margin,
      maxX: maxX + margin,
      minZ: minZ - margin,
      maxZ: maxZ + margin,
    };
  }, [guidePoints, scenarioConfig]);

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
  const shipRotation = heading - 90;  // 修正方向，向上为0°

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-2 text-[10px] text-slate-200 backdrop-blur">
      <div className="flex items-center justify-between px-1 pb-1 text-[11px] text-slate-300">
        <span>战术俯瞰</span>
        <span className="text-emerald-300">实时</span>
      </div>
      <svg width={size} height={size} className="rounded-lg bg-transparent" style={{ transform: 'scaleY(-1)' }}>
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
          <polygon points="8,0 -6,-5 -6,5" fill="#22c55e" />
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
