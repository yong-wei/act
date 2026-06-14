'use client';

/**
 * CruiseTyphoonSim - 邮轮台风仿真 (香槟塔保卫战)
 *
 * 学习主题：多约束条件下的PID参数设计
 * 基于现有 cruise-simulation 扩展，新增：
 * - 香槟塔画中画 (PIP): 倒立摆简化模型
 * - 任务约束: 30°紧急转向，侧向加速度 < 0.15g
 * - 伦理熔断: 加速度 > 0.2g 时触发全屏警告
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Ship,
  AlertTriangle,
  Target,
  Clock,
  Wind,
  Gauge,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  Pause,
  Waves,
  Wine,
  Trophy,
} from 'lucide-react';
import { ChampagneTowerPIP } from './ChampagneTowerPIP';
import { useChampagneTower } from './hooks/useChampagneTower';
import { TYPHOON_SCENARIO, type TyphoonScenarioConfig } from '../types';
import { EthicalTrigger, type EthicalTriggerConfig } from '@/components/classroom';
import { SimulationClock } from '@/lib/simulation';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import {
  preloadInteractiveSimulationRuntime,
  stepCruiseTyphoonScenario,
} from '@/resources/interactive-learning/rust/interactive-simulation-runtime';

// 动态导入3D仿真组件
const CruiseSimulation3D = dynamic(
  () => import('@/resources/simulations/simulations/cruise-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-900 text-slate-300">
        <div className="flex items-center gap-3">
          <Ship className="h-8 w-8 animate-pulse" />
          <span>正在加载爱达·魔都号仿真场景...</span>
        </div>
      </div>
    ),
  }
);

export interface CruiseTyphoonSimProps extends BaseWidgetProps {
  /** 场景配置 */
  scenario?: TyphoonScenarioConfig;
  /** 是否显示任务面板 */
  showMissionPanel?: boolean;
  /** 是否显示香槟塔PIP */
  showChampagnePIP?: boolean;
}

export interface MissionResult {
  success: boolean;
  duration: number;
  maxLateralAccel: number;
  champagneTowerFallen: boolean;
  fallCount: number;
  violationCount: number;
  finalHeading: number;
}

interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  time: number;
  heading: number;
  targetHeading: number;
  rollAngle: number;
  yawRate: number;
  speed: number;
  lateralAccel: number;
}

export function CruiseTyphoonSim({
  scenario = TYPHOON_SCENARIO,
  embedded = false,
  onComplete,
  onStateChange,
  showMissionPanel = true,
  showChampagnePIP = true,
}: CruiseTyphoonSimProps) {
  const interactive = useOptionalInteractiveContext();
  // 仿真状态（模拟从3D仿真获取）
  const [simState, setSimState] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    time: 0,
    heading: scenario.initialHeading,
    targetHeading: scenario.targetHeading,
    rollAngle: 0,
    yawRate: 0,
    speed: 20, // 邮轮巡航速度 (节)
    lateralAccel: 0,
  });
  const simStateRef = useRef(simState);

  // 任务状态
  const [missionState, setMissionState] = useState({
    started: false,
    completed: false,
    success: false,
    violationCount: 0,
    maxLateralAccel: 0,
  });
  const missionStateRef = useRef(missionState);

  // 伦理熔断状态
  const [ethicalTriggered, setEthicalTriggered] = useState(false);
  const [showEthicalOverlay, setShowEthicalOverlay] = useState(false);
  const ethicalTriggeredRef = useRef(ethicalTriggered);

  useEffect(() => {
    simStateRef.current = simState;
  }, [simState]);
  useEffect(() => {
    missionStateRef.current = missionState;
  }, [missionState]);
  useEffect(() => {
    ethicalTriggeredRef.current = ethicalTriggered;
  }, [ethicalTriggered]);

  // 香槟塔状态
  const champagneTower = useChampagneTower({
    params: scenario.champagneTower.params,
    autoReset: true,
    resetDelay: 5000,
  });

  // PIP 最小化状态
  const [pipMinimized, setPipMinimized] = useState(false);

  // 动画帧引用
  const animationRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const clockRef = useRef(new SimulationClock({ dt: 1 / 60, maxSubSteps: 6 }));
  const runtimeReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    preloadInteractiveSimulationRuntime().then(() => {
      if (!cancelled) {
        runtimeReadyRef.current = true;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const evaluateMissionFrame = useCallback((nextSimState: SimulationState) => {
    const currentMission = missionStateRef.current;
    if (!currentMission.started || currentMission.completed) return;

    const headingError = Math.abs(nextSimState.heading - nextSimState.targetHeading);
    const hasReachedTarget = headingError < 1;
    const isTimeout = scenario.constraints.maxTime && nextSimState.time > scenario.constraints.maxTime;
    let nextMission = currentMission;

    if (nextSimState.lateralAccel > nextMission.maxLateralAccel) {
      nextMission = {
        ...nextMission,
        maxLateralAccel: nextSimState.lateralAccel,
      };
    }

    if (nextSimState.lateralAccel > scenario.constraints.ethicalThreshold && !ethicalTriggeredRef.current) {
      ethicalTriggeredRef.current = true;
      setEthicalTriggered(true);
      setShowEthicalOverlay(true);
      nextMission = {
        ...nextMission,
        violationCount: nextMission.violationCount + 1,
      };
    }

    if (hasReachedTarget || isTimeout) {
      const success =
        hasReachedTarget &&
        !champagneTower.hasFallen &&
        nextMission.violationCount === 0 &&
        nextMission.maxLateralAccel < scenario.constraints.maxLateralAccel;
      const completedMission = {
        ...nextMission,
        completed: true,
        success,
      };
      missionStateRef.current = completedMission;
      setMissionState(completedMission);

      const missionResult: MissionResult = {
        success,
        duration: nextSimState.time,
        maxLateralAccel: nextMission.maxLateralAccel,
        champagneTowerFallen: champagneTower.hasFallen,
        fallCount: champagneTower.fallCount,
        violationCount: nextMission.violationCount,
        finalHeading: nextSimState.heading,
      };
      const score = success ? 100 : Math.max(0, 70 - nextMission.violationCount * 10);
      const completion: WidgetResult = {
        success,
        score,
        data: { mission: missionResult },
      };
      interactive?.progress.markComplete(completion);
      onComplete?.(completion);
      return;
    }

    if (nextMission !== currentMission) {
      missionStateRef.current = nextMission;
      setMissionState(nextMission);
    }
  }, [
    champagneTower.fallCount,
    champagneTower.hasFallen,
    interactive,
    onComplete,
    scenario.constraints.ethicalThreshold,
    scenario.constraints.maxLateralAccel,
    scenario.constraints.maxTime,
  ]);

  // 模拟仿真循环（实际应用中从3D仿真获取数据）
  useEffect(() => {
    if (!simState.isRunning || simState.isPaused) return;

    const simulate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const frameDelta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      let currentState = simStateRef.current;

      const stepSimulation = (dt: number) => {
        if (!runtimeReadyRef.current) return;
        currentState = stepCruiseTyphoonScenario({
          state: currentState,
          dt,
          seaState: scenario.seaState,
        }) as typeof currentState;
      };

      const steps = clockRef.current.advance(frameDelta, stepSimulation);
      if (steps > 0) {
        simStateRef.current = currentState;
        setSimState(currentState);
        evaluateMissionFrame(currentState);
      }

      animationRef.current = requestAnimationFrame(simulate);
    };

    clockRef.current.reset();
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [simState.isRunning, simState.isPaused, scenario.seaState, evaluateMissionFrame]);

  // 更新香槟塔输入
  useEffect(() => {
    if (simState.isRunning && !simState.isPaused) {
      champagneTower.updateInput(simState.lateralAccel, simState.rollAngle);
    }
  }, [simState.lateralAccel, simState.rollAngle, simState.isRunning, simState.isPaused, champagneTower]);

  useEffect(() => {
    const headingDelta = Math.abs(scenario.targetHeading - scenario.initialHeading) || 1;
    const headingProgress = Math.min(
      Math.abs(simState.heading - scenario.initialHeading) / headingDelta * 100,
      100
    );
    const progressValue = missionState.completed ? 100 : (missionState.started ? headingProgress : 0);
    const snapshot = {
      progress: progressValue,
      data: {
        started: missionState.started,
        completed: missionState.completed,
        heading: simState.heading,
        targetHeading: scenario.targetHeading,
        lateralAccel: simState.lateralAccel,
        violationCount: missionState.violationCount,
      },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
  }, [
    missionState,
    simState.heading,
    simState.lateralAccel,
    scenario.initialHeading,
    scenario.targetHeading,
    interactive,
    onStateChange,
  ]);

  // 开始任务
  const handleStartMission = useCallback(() => {
    const nextMissionState = {
      started: true,
      completed: false,
      success: false,
      violationCount: 0,
      maxLateralAccel: 0,
    };
    missionStateRef.current = nextMissionState;
    setMissionState(nextMissionState);
    setSimState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      time: 0,
      heading: scenario.initialHeading,
    }));
    champagneTower.reset();
    ethicalTriggeredRef.current = false;
    setEthicalTriggered(false);
    lastTimeRef.current = 0;
    interactive?.tracking.emit('interact', { action: 'start_mission' });
  }, [scenario.initialHeading, champagneTower, interactive]);

  // 暂停/继续
  const handleTogglePause = useCallback(() => {
    setSimState((prev) => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
    interactive?.tracking.emit('interact', { action: 'toggle_pause' });
  }, [interactive]);

  // 重置
  const handleReset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setSimState({
      isRunning: false,
      isPaused: false,
      time: 0,
      heading: scenario.initialHeading,
      targetHeading: scenario.targetHeading,
      rollAngle: 0,
      yawRate: 0,
      speed: 20,
      lateralAccel: 0,
    });
    const nextMissionState = {
      started: false,
      completed: false,
      success: false,
      violationCount: 0,
      maxLateralAccel: 0,
    };
    missionStateRef.current = nextMissionState;
    setMissionState(nextMissionState);
    champagneTower.reset();
    ethicalTriggeredRef.current = false;
    setEthicalTriggered(false);
    setShowEthicalOverlay(false);
    lastTimeRef.current = 0;
    interactive?.progress.reset();
    interactive?.tracking.emit('interact', { action: 'reset' });
  }, [scenario.initialHeading, scenario.targetHeading, champagneTower, interactive]);

  // 伦理熔断配置
  const ethicalConfig: EthicalTriggerConfig = useMemo(
    () => ({
      id: 'ethical-cruise-typhoon',
      type: 'ethical-trigger' as const,
      conditions: [
        {
          id: 'lateral-accel',
          metric: 'lateralAcceleration',
          threshold: scenario.constraints.ethicalThreshold,
          currentValue: simState.lateralAccel,
          unit: 'g',
          operator: 'gt' as const,
        },
      ],
      violationType: 'PASSENGER_SAFETY',
      warningTitle: '伦理熔断警告',
      warningMessage: `侧向加速度达到 ${(simState.lateralAccel).toFixed(3)}g，超过安全阈值 ${scenario.constraints.ethicalThreshold}g。\n这可能导致老年乘客摔倒受伤！`,
      regulation: 'SOLAS公约 & ISO 2631-1',
      remediation: {
        question: '为了降低侧向加速度，你应该如何调整控制参数？',
        correctAnswer: 'Kd',
        explanation: '增大微分系数Kd可以增加系统阻尼，使转向更加平缓，降低侧向加速度。',
      },
      alertSound: true,
      fullScreenAlert: true,
    }),
    [simState.lateralAccel, scenario.constraints.ethicalThreshold]
  );

  return (
    <div className={`relative ${embedded ? 'h-full' : 'h-screen'} w-full bg-slate-950`}>
      {/* 3D 仿真背景 - 在实际应用中替换为真实的仿真组件 */}
      <div className="absolute inset-0">
        <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
          <div className="text-center text-slate-400">
            <Ship className="mx-auto h-24 w-24 mb-4 opacity-30" />
            <p className="text-sm">3D 仿真视图区域</p>
            <p className="text-xs mt-1 text-slate-500">
              (集成 CruiseSimulation 组件)
            </p>
          </div>
        </div>
      </div>

      {/* 任务信息面板 */}
      {showMissionPanel && (
        <div className="absolute left-4 top-4 z-40 space-y-3">
          {/* 任务标题 */}
          <div className="rounded-lg bg-slate-900/90 p-4 backdrop-blur border border-slate-700 max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-amber-500" />
              <h2 className="font-bold text-white">{scenario.name}</h2>
            </div>
            <p className="text-xs text-slate-400 mb-3">{scenario.description}</p>

            {/* 约束条件 */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">目标航向</span>
                <span className="font-mono text-emerald-400">
                  {scenario.initialHeading}° → {scenario.targetHeading}°
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">最大加速度</span>
                <span className="font-mono text-amber-400">
                  &lt; {scenario.constraints.maxLateralAccel}g
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">熔断阈值</span>
                <span className="font-mono text-red-400">
                  {scenario.constraints.ethicalThreshold}g
                </span>
              </div>
              {scenario.constraints.maxTime && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">时间限制</span>
                  <span className="font-mono text-blue-400">
                    {scenario.constraints.maxTime}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 实时数据 */}
          <div className="rounded-lg bg-slate-900/90 p-3 backdrop-blur border border-slate-700">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-400">时间:</span>
                <span className="font-mono text-white">{simState.time.toFixed(1)}s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Ship className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-400">航向:</span>
                <span className="font-mono text-white">{simState.heading.toFixed(1)}°</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Waves className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-400">横摇:</span>
                <span
                  className={`font-mono ${
                    Math.abs(simState.rollAngle) > 5 ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  {simState.rollAngle.toFixed(1)}°
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-400">加速度:</span>
                <span
                  className={`font-mono ${
                    simState.lateralAccel > scenario.constraints.ethicalThreshold
                      ? 'text-red-400'
                      : simState.lateralAccel > scenario.constraints.maxLateralAccel
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {simState.lateralAccel.toFixed(3)}g
                </span>
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex gap-2">
            {!missionState.started ? (
              <button type="button"
                onClick={handleStartMission}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                <Play className="h-4 w-4" />
                开始任务
              </button>
            ) : (
              <>
                <button type="button"
                  onClick={handleTogglePause}
                  className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
                  disabled={missionState.completed}
                >
                  {simState.isPaused ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </button>
                <button type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 香槟塔画中画 */}
      {showChampagnePIP && scenario.champagneTower.enabled && (
        <ChampagneTowerPIP
          state={champagneTower.state}
          minimized={pipMinimized}
          position="top-right"
          onClick={() => setPipMinimized(!pipMinimized)}
        />
      )}

      {/* 任务完成结果 */}
      {missionState.completed && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className={`max-w-md rounded-xl p-6 shadow-2xl border-2 ${
              missionState.success
                ? 'bg-emerald-900/90 border-emerald-500'
                : 'bg-red-900/90 border-red-500'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {missionState.success ? (
                <>
                  <Trophy className="h-10 w-10 text-amber-400" />
                  <div>
                    <h3 className="text-xl font-bold text-white">任务成功!</h3>
                    <p className="text-emerald-300 text-sm">香槟塔完好无损</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-10 w-10 text-red-400" />
                  <div>
                    <h3 className="text-xl font-bold text-white">任务失败</h3>
                    <p className="text-red-300 text-sm">
                      {champagneTower.hasFallen
                        ? '香槟塔倒塌了!'
                        : missionState.violationCount > 0
                        ? '触发了伦理熔断'
                        : '未能在限定时间内完成'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 任务统计 */}
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">完成时间</span>
                <span className="font-mono text-white">{simState.time.toFixed(1)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">最终航向</span>
                <span className="font-mono text-white">{simState.heading.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">最大加速度</span>
                <span
                  className={`font-mono ${
                    missionState.maxLateralAccel > scenario.constraints.maxLateralAccel
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {missionState.maxLateralAccel.toFixed(3)}g
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">香槟塔倒塌次数</span>
                <span
                  className={`font-mono ${
                    champagneTower.fallCount > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {champagneTower.fallCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">熔断次数</span>
                <span
                  className={`font-mono ${
                    missionState.violationCount > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {missionState.violationCount}
                </span>
              </div>
            </div>

            <button type="button"
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-white hover:bg-white/20 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              重新开始
            </button>
          </div>
        </div>
      )}

      {/* 伦理熔断覆盖层 */}
      <EthicalTrigger
        mode="play"
        config={ethicalConfig}
        metrics={{ lateralAcceleration: simState.lateralAccel }}
        onTrigger={(conditions) => {
          setEthicalTriggered(true);
          setMissionState((prev) => ({
            ...prev,
            violationCount: prev.violationCount + 1,
          }));
        }}
        onRemediate={() => {
          setShowEthicalOverlay(false);
        }}
      />
    </div>
  );
}

export default CruiseTyphoonSim;
