/**
 * useShipSimulation - 船舶仿真核心 Hook
 *
 * 将仿真引擎封装为可复用的 React Hook，提供：
 * - 仿真状态管理
 * - 控制函数（start/pause/reset）
 * - 实时指标计算
 * - 回调机制（onStep/onComplete/onViolation）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type SimulationConfig,
  type SimulationState,
  type SimulationMetrics,
  type SimulationCallbacks,
  type TrajectoryPoint,
  type ChartData,
  type Position,
  type EthicalViolation,
  type UseShipSimulationReturn,
  type ScenarioLogic,
  DEFAULT_NOMOTO_PARAMS,
  DEFAULT_PID_GAINS,
  ETHICAL_THRESHOLDS,
} from '@/types/simulation';
import {
  nomotoStep,
  pidControl,
  getCrossTrackError,
  checkEthicalViolation,
  toDegrees,
  toRadians,
  normalizeHeading,
  normalizeSignedHeading,
  clamp,
  type NomotoState,
  type PIDState,
} from '@/lib/simulation-engine';

interface UseShipSimulationOptions {
  config: SimulationConfig;
  scenario: ScenarioLogic;
  duration: number;
  guidePath?: Position[];
  callbacks?: SimulationCallbacks;
}

// 初始状态
const createInitialState = (scenario: ScenarioLogic): SimulationState => ({
  position: { x: scenario.startPos.x, z: scenario.startPos.z },
  heading: scenario.startPos.headingDeg,
  headingRad: toRadians(scenario.startPos.headingDeg),
  yawRate: 0,
  yawRateRad: 0,
  rudder: 0,
  speed: DEFAULT_NOMOTO_PARAMS.speedMps,
  integral: 0,
  prevError: 0,
  waveY: 0,
  wavePitch: 0,
  waveRoll: 0,
  time: 0,
  isRunning: false,
  isPaused: false,
  isCompleted: false,
});

const createInitialMetrics = (): SimulationMetrics => ({
  avgError: 0,
  maxRudderRate: 0,
  currentError: 0,
  energyConsumption: 0,
  settlingTime: null,
  overshoot: 0,
  crossTrackError: 0,
});

const createInitialChartData = (): ChartData => ({
  time: [],
  desiredHeading: [],
  actualHeading: [],
  speed: [],
  rudder: [],
  error: [],
});

export function useShipSimulation(options: UseShipSimulationOptions): UseShipSimulationReturn {
  const { config, scenario, duration, guidePath = [], callbacks } = options;

  // 状态
  const [state, setState] = useState<SimulationState>(() => createInitialState(scenario));
  const [metrics, setMetrics] = useState<SimulationMetrics>(createInitialMetrics);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([]);
  const [chartData, setChartData] = useState<ChartData>(createInitialChartData);
  const [targetHeading, setTargetHeading] = useState(scenario.startPos.headingDeg);

  // Refs for animation loop
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const simulationTimeRef = useRef<number>(0);

  // 内部仿真状态（避免频繁 React 更新）
  const nomotoStateRef = useRef<NomotoState>({
    headingRad: toRadians(scenario.startPos.headingDeg),
    yawRateRad: 0,
    rudderDeg: 0,
    positionX: scenario.startPos.x,
    positionZ: scenario.startPos.z,
    speedMps: config.nomoto?.speedMps || DEFAULT_NOMOTO_PARAMS.speedMps,
  });
  const pidStateRef = useRef<PIDState>({ integral: 0, prevError: 0 });
  const manualRudderRef = useRef<number>(0);
  const manualSpeedRef = useRef<number>(DEFAULT_NOMOTO_PARAMS.speedMps);

  // 指标累积
  const totalErrorRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const maxRudderRateRef = useRef<number>(0);
  const prevRudderRef = useRef<number>(0);
  const energyRef = useRef<number>(0);

  // 配置 Refs
  const configRef = useRef(config);
  const scenarioRef = useRef(scenario);
  const durationRef = useRef(duration);
  const guidePathRef = useRef(guidePath);
  const callbacksRef = useRef(callbacks);

  // 更新 Refs
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    guidePathRef.current = guidePath;
  }, [guidePath]);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // 仿真循环
  const simulationLoop = useCallback((timestamp: number) => {
    const currentConfig = configRef.current;
    const currentScenario = scenarioRef.current;
    const currentDuration = durationRef.current;
    const currentGuidePath = guidePathRef.current;
    const currentCallbacks = callbacksRef.current;

    // 计算 dt
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }
    const realDt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    const timeScale = currentConfig.timeScale || 1;
    const dt = Math.min(realDt * timeScale, 0.1); // 限制最大步长

    simulationTimeRef.current += dt;
    const simTime = simulationTimeRef.current;

    // 检查是否完成
    if (simTime >= currentDuration) {
      setState((prev) => ({ ...prev, isRunning: false, isCompleted: true }));

      // 触发完成回调
      if (currentCallbacks?.onComplete) {
        currentCallbacks.onComplete(
          {
            avgError: errorCountRef.current > 0 ? totalErrorRef.current / errorCountRef.current : 0,
            maxRudderRate: maxRudderRateRef.current,
            currentError: 0,
            energyConsumption: energyRef.current,
            settlingTime: null,
            overshoot: 0,
            crossTrackError: 0,
          },
          trajectory
        );
      }
      return;
    }

    // 获取目标航向
    const targetHeadingDeg = currentScenario.getDesiredHeading(simTime);
    setTargetHeading(targetHeadingDeg);
    currentCallbacks?.onTargetHeadingChange?.(targetHeadingDeg);

    const nomoto = nomotoStateRef.current;
    const currentHeadingDeg = normalizeHeading(toDegrees(nomoto.headingRad));

    // 计算舵角
    let rudderDeg = 0;
    if (currentConfig.controlMode === 'manual') {
      rudderDeg = manualRudderRef.current;
      nomoto.speedMps = manualSpeedRef.current;
    } else {
      const { rudderDeg: pidRudder, newPidState } = pidControl(
        targetHeadingDeg,
        currentHeadingDeg,
        pidStateRef.current,
        currentConfig.pid,
        currentConfig.controlMode,
        dt,
        currentConfig.nomoto?.maxRudderDeg || DEFAULT_NOMOTO_PARAMS.maxRudderDeg
      );
      pidStateRef.current = newPidState;
      rudderDeg = pidRudder;
    }

    // 计算舵角速度
    const rudderRate = Math.abs(rudderDeg - prevRudderRef.current) / dt;
    if (rudderRate > maxRudderRateRef.current) {
      maxRudderRateRef.current = rudderRate;
    }

    // 伦理检测
    const ethicalCheck = checkEthicalViolation(rudderRate, 0, toDegrees(nomoto.yawRateRad));
    if (ethicalCheck.isViolation && currentCallbacks?.onViolation) {
      const violation: EthicalViolation = {
        type: ethicalCheck.violationType!,
        thresholdValue: ethicalCheck.thresholdValue!,
        actualValue: ethicalCheck.actualValue!,
        timestamp: simTime,
        description: ethicalCheck.description!,
      };
      currentCallbacks.onViolation(violation);
    }

    prevRudderRef.current = rudderDeg;

    // 更新船舶运动学
    const nomotoParams = {
      ...DEFAULT_NOMOTO_PARAMS,
      ...currentConfig.nomoto,
    };
    const newNomoto = nomotoStep(nomoto, rudderDeg, dt, nomotoParams);
    nomotoStateRef.current = newNomoto;

    // 计算航迹误差
    const currentError = getCrossTrackError(
      { x: newNomoto.positionX, z: newNomoto.positionZ },
      currentGuidePath
    );
    totalErrorRef.current += currentError;
    errorCountRef.current += 1;

    // 能耗积分
    energyRef.current += Math.abs(rudderDeg) * dt;

    // 更新 React 状态（节流）
    const newState: SimulationState = {
      position: { x: newNomoto.positionX, z: newNomoto.positionZ },
      heading: normalizeHeading(toDegrees(newNomoto.headingRad)),
      headingRad: newNomoto.headingRad,
      yawRate: toDegrees(newNomoto.yawRateRad),
      yawRateRad: newNomoto.yawRateRad,
      rudder: newNomoto.rudderDeg,
      speed: newNomoto.speedMps,
      integral: pidStateRef.current.integral,
      prevError: pidStateRef.current.prevError,
      waveY: 0,
      wavePitch: 0,
      waveRoll: 0,
      time: simTime,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    };

    const newMetrics: SimulationMetrics = {
      avgError: errorCountRef.current > 0 ? totalErrorRef.current / errorCountRef.current : 0,
      maxRudderRate: maxRudderRateRef.current,
      currentError,
      energyConsumption: energyRef.current,
      settlingTime: null,
      overshoot: 0,
      crossTrackError: currentError,
    };

    setState(newState);
    setMetrics(newMetrics);

    // 记录轨迹点（每0.5秒）
    if (Math.floor(simTime * 2) > Math.floor((simTime - dt) * 2)) {
      const trajectoryPoint: TrajectoryPoint = {
        time: simTime,
        x: newNomoto.positionX,
        z: newNomoto.positionZ,
        heading: normalizeHeading(toDegrees(newNomoto.headingRad)),
        rudder: newNomoto.rudderDeg,
        speed: newNomoto.speedMps,
        targetHeading: targetHeadingDeg,
      };
      setTrajectory((prev) => [...prev, trajectoryPoint]);

      // 更新图表数据
      setChartData((prev) => ({
        time: [...prev.time, simTime],
        desiredHeading: [...prev.desiredHeading, normalizeSignedHeading(targetHeadingDeg)],
        actualHeading: [...prev.actualHeading, normalizeSignedHeading(toDegrees(newNomoto.headingRad))],
        speed: [...prev.speed, newNomoto.speedMps],
        rudder: [...prev.rudder, newNomoto.rudderDeg],
        error: [...prev.error, currentError],
      }));
    }

    // 触发 onStep 回调
    currentCallbacks?.onStep?.(newState, newMetrics);

    // 继续循环
    animationFrameRef.current = requestAnimationFrame(simulationLoop);
  }, [trajectory]);

  // 控制函数
  const start = useCallback(() => {
    if (state.isRunning) return;

    lastTimeRef.current = 0;
    setState((prev) => ({ ...prev, isRunning: true, isPaused: false }));
    animationFrameRef.current = requestAnimationFrame(simulationLoop);
  }, [state.isRunning, simulationLoop]);

  const pause = useCallback(() => {
    if (!state.isRunning || state.isPaused) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setState((prev) => ({ ...prev, isPaused: true }));
  }, [state.isRunning, state.isPaused]);

  const resume = useCallback(() => {
    if (!state.isPaused) return;

    lastTimeRef.current = 0;
    setState((prev) => ({ ...prev, isPaused: false }));
    animationFrameRef.current = requestAnimationFrame(simulationLoop);
  }, [state.isPaused, simulationLoop]);

  const reset = useCallback(() => {
    // 停止仿真
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 重置状态
    const currentScenario = scenarioRef.current;
    nomotoStateRef.current = {
      headingRad: toRadians(currentScenario.startPos.headingDeg),
      yawRateRad: 0,
      rudderDeg: 0,
      positionX: currentScenario.startPos.x,
      positionZ: currentScenario.startPos.z,
      speedMps: configRef.current.nomoto?.speedMps || DEFAULT_NOMOTO_PARAMS.speedMps,
    };
    pidStateRef.current = { integral: 0, prevError: 0 };
    simulationTimeRef.current = 0;
    lastTimeRef.current = 0;

    // 重置指标
    totalErrorRef.current = 0;
    errorCountRef.current = 0;
    maxRudderRateRef.current = 0;
    prevRudderRef.current = 0;
    energyRef.current = 0;

    // 重置 React 状态
    setState(createInitialState(currentScenario));
    setMetrics(createInitialMetrics());
    setTrajectory([]);
    setChartData(createInitialChartData());
    setTargetHeading(currentScenario.startPos.headingDeg);
  }, []);

  const setManualRudder = useCallback((rudder: number) => {
    manualRudderRef.current = clamp(
      rudder,
      -(configRef.current.nomoto?.maxRudderDeg || DEFAULT_NOMOTO_PARAMS.maxRudderDeg),
      configRef.current.nomoto?.maxRudderDeg || DEFAULT_NOMOTO_PARAMS.maxRudderDeg
    );
  }, []);

  const setManualSpeed = useCallback((speed: number) => {
    manualSpeedRef.current = clamp(speed, 4, 22);
  }, []);

  const updateConfig = useCallback((newConfig: Partial<SimulationConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
  }, []);

  const setScenario = useCallback(
    (newScenario: ScenarioLogic, newDuration: number, newGuidePath?: Position[]) => {
      scenarioRef.current = newScenario;
      durationRef.current = newDuration;
      if (newGuidePath) {
        guidePathRef.current = newGuidePath;
      }
      reset();
    },
    [reset]
  );

  // 清理
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 场景变化时重置
  useEffect(() => {
    reset();
  }, [scenario, reset]);

  return {
    state,
    metrics,
    trajectory,
    chartData,
    targetHeading,
    start,
    pause,
    resume,
    reset,
    setManualRudder,
    setManualSpeed,
    updateConfig,
    setScenario,
  };
}

export default useShipSimulation;
