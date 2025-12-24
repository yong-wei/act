'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, Sky, useGLTF } from '@react-three/drei';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

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
      new THREE.Vector3(2700, 0.5, 3600),
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
                  onClick={() => setCameraView(view.id)}
                >
                  {view.label}
                </Button>
              ))}
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
}: SimulationCanvasProps) {
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
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 30, 140], fov: 50, near: 0.1, far: 20000 }}
    >
      <color attach="background" args={['#1a3454']} />
      <fog attach="fog" args={['#1a3454', 1200, 18000]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight intensity={0.45} groundColor="#0a1426" color="#9fc5f3" />
      <directionalLight position={[120, 500, 60]} intensity={0.85} color="#dbe9ff" />
      <Sky sunPosition={[120, 500, 60]} turbidity={8} rayleigh={2.6} />
      <WaveWater simRef={simRef} />
      <GuideRoute scenarioConfig={scenarioConfig} />
      {scenarioConfig.island ? <Island {...scenarioConfig.island} /> : null}
      <ShipTrail simRef={simRef} />
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
      />
      <CameraRig cameraView={cameraView} simRef={simRef} />
    </Canvas>
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
}: SimulationLoopProps) {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
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
  });

  return null;
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
      { amplitude: 2.4, frequency: 0.013, speed: 0.7, direction: new THREE.Vector2(1, 0) },
      { amplitude: 1.6, frequency: 0.02, speed: 0.5, direction: new THREE.Vector2(0.2, 0.9) },
      { amplitude: 1.2, frequency: 0.03, speed: 0.9, direction: new THREE.Vector2(-0.6, 0.4) },
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
        color="#0b2a4a"
        specular="#6fa6d6"
        shininess={24}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GuideRoute({
  scenarioConfig,
}: {
  scenarioConfig: (typeof scenarioConfigs)[TaskScenario];
}) {
  if (scenarioConfig.guidePath) {
    return (
      <Line points={scenarioConfig.guidePath} color="#ef4444" lineWidth={2} dashed={false} />
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

function ShipTrail({ simRef }: { simRef: React.MutableRefObject<SimulationState> }) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const lastRecordRef = useRef(0);

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
    const y = size - ((point.z - bounds.minZ) / scale) * size;
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
  const shipRotation = -heading;

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

function CameraRig({
  cameraView,
  simRef,
}: {
  cameraView: CameraView;
  simRef: React.MutableRefObject<SimulationState>;
}) {
  const { camera } = useThree();

  const viewOffsets = useMemo(
    () => ({
      chase: new THREE.Vector3(-180, 50, 0),
      overhead: new THREE.Vector3(0, 220, 0),
      tactical: new THREE.Vector3(-120, 90, 120),
    }),
    [],
  );

  useFrame(() => {
    const sim = simRef.current;
    const baseOffset = viewOffsets[cameraView].clone();

    if (cameraView !== 'overhead') {
      baseOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), sim.headingRad);
    }

    const desiredPosition = sim.position.clone().add(baseOffset);
    camera.position.lerp(desiredPosition, 0.08);
    camera.lookAt(sim.position.x, sim.position.y + 6, sim.position.z);
  });

  return null;
}

useGLTF.preload('/assets/container.glb');

export default DestroyerSimulation;
