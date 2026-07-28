/**
 * Monte Carlo 参数优化器
 *
 * 使用随机搜索算法寻找最优 PID 参数
 */

import { computeVirtualSimulationServerStep } from '../rust/control-engine-server-runtime';
import {
  createSimulationRng,
  createSimulationRunContext,
  normalizeSeed,
  type RandomNumberGenerator,
  type SimulationReplayMetadata,
  type SimulationRunContext,
} from '../core/seeded-rng';
import { buildSimulationReplayMetadata } from './replay-checksum';
import type { Position } from '../types';

export interface OptimizationTarget {
  targetHeading: number; // 目标航向
  maxError: number; // 允许的最大航迹误差
  maxRudderRate: number; // 允许的最大舵角速度
  maxOvershoot?: number; // 允许的最大超调量
  minSettlingTime?: number; // 期望的最小调节时间
}

export interface OptimizationConstraints {
  kpRange: [number, number]; // Kp 搜索范围
  kiRange: [number, number]; // Ki 搜索范围
  kdRange: [number, number]; // Kd 搜索范围
}

export interface OptimizationResult {
  bestParams: {
    kp: number;
    ki: number;
    kd: number;
  };
  score: number;
  metrics: {
    avgError: number;
    maxRudderRate: number;
    settlingTime: number;
    overshoot: number;
  };
  iterations: number;
  searchTime: number;
  convergenceHistory: Array<{
    iteration: number;
    score: number;
    params: { kp: number; ki: number; kd: number };
  }>;
  replay?: SimulationReplayMetadata;
}

export interface OptimizePIDParamsOptions {
  runContext?: SimulationRunContext;
  scenario?: ScenarioLogic;
  seed?: number | string;
}

// 简化的仿真配置
export interface SimpleSimConfig {
  nomotoK?: number;
  nomotoT?: number;
  shipSpeed?: number;
  seaState?: {
    level: number;
    waveHeight: number;
    windSpeed: number;
  };
}

interface ScenarioLogic {
  scenarioId: string;
  runtimeVersion: string;
  duration: number;
  referenceCompletedAt: number;
  headingSchedule: Array<{ time: number; heading: number }>;
  getDesiredHeading: (time: number) => number;
  startPos: { x: number; z: number; headingDeg: number };
}

/**
 * v1 legacy 场景：120 秒，60 秒时硬切换到目标航向。
 * 仅在 scene-trace 三参数路径中使用。
 */
function getLegacySceneLogic(_scenario: 'turn90', targetHeading: number = 90): ScenarioLogic {
  return {
    scenarioId: 'turn90',
    runtimeVersion: 'simulation-optimizer-runtime-v1',
    duration: 120,
    referenceCompletedAt: 60,
    headingSchedule: [
      { time: 0, heading: 0 },
      { time: 60, heading: 0 },
      { time: 60.01, heading: targetHeading },
      { time: 120, heading: targetHeading },
    ],
    startPos: { x: -6000, z: 0, headingDeg: 0 },
    getDesiredHeading: (time: number) => (time < 60 ? 0 : targetHeading),
  };
}

/**
 * v2 校准场景：240 秒，60-150 秒线性渐变过渡。
 * 推荐 API 和四参数优化器默认使用此场景。
 */
function getScenarioLogic(_scenario: 'turn90', targetHeading: number = 90): ScenarioLogic {
  const transitionStart = 60;
  const transitionEnd = 150;
  return {
    scenarioId: 'turn90-calibrated-v1',
    runtimeVersion: 'simulation-optimizer-runtime-v2',
    duration: 240,
    referenceCompletedAt: 150,
    headingSchedule: [
      { time: 0, heading: 0 },
      { time: transitionStart, heading: 0 },
      { time: transitionEnd, heading: targetHeading },
      { time: 240, heading: targetHeading },
    ],
    startPos: { x: 0, z: 0, headingDeg: 0 },
    getDesiredHeading: (time: number) => {
      if (time < transitionStart) return 0;
      if (time >= transitionEnd) return targetHeading;
      const progress = (time - transitionStart) / (transitionEnd - transitionStart);
      return progress * targetHeading;
    },
  };
}

const generateGuidePath = (logic: ScenarioLogic, duration: number, speed: number): Position[] => {
  const points: Position[] = [];
  let x = logic.startPos.x;
  let z = logic.startPos.z;
  const dt = 0.5;

  points.push({ x, z });
  for (let time = 0; time <= duration; time += dt) {
    const headingRad = (logic.getDesiredHeading(time) * Math.PI) / 180;
    x += speed * Math.cos(headingRad) * dt;
    z += speed * Math.sin(headingRad) * dt;
    if (Math.round(time / dt) % 4 === 0) {
      points.push({ x, z });
    }
  }
  return points;
};

interface RustQuickSimResult {
  trajectory: Array<{ time: number; x: number; z: number; heading: number; rudder: number }>;
  chartData: {
    time: number[];
    desiredHeading: number[];
    actualHeading: number[];
    speed: number[];
    rudder: number[];
  };
  metrics: {
    avgError: number;
    maxRudderRate: number;
  };
}

function evaluateWithRustRuntime(
  params: { kp: number; ki: number; kd: number },
  logic: ScenarioLogic,
  guidePath: Position[],
  speed: number,
  simConfig: SimpleSimConfig,
  target: OptimizationTarget,
): RustQuickSimResult {
  return computeVirtualSimulationServerStep<RustQuickSimResult>({
    modelId: 'nomoto_quick_sim',
    duration: logic.duration,
    dt: 0.5,
    start: logic.startPos,
    targetHeadingDeg: target.targetHeading,
    targetSwitchTime: 60,
    headingSchedule: logic.headingSchedule.map(({ time, heading }) => ({ time, headingDeg: heading })),
    pid: params,
    nomoto: {
      K: simConfig.nomotoK || 0.08,
      T: simConfig.nomotoT || 55,
      speedMps: speed,
      maxRudderDeg: 35,
      ...(logic.runtimeVersion === 'simulation-optimizer-runtime-v2'
        ? { maxRudderRateDegPerSec: 5 }
        : {}),
    },
    guidePath,
  });
}

/**
 * 评估参数组合的得分
 */
export function evaluatePIDParams(
  params: { kp: number; ki: number; kd: number },
  logic: ScenarioLogic,
  simConfig: SimpleSimConfig,
  target: OptimizationTarget,
): { score: number; metrics: OptimizationResult['metrics'] };
export function evaluatePIDParams(
  params: { kp: number; ki: number; kd: number },
  simConfigOrLogic: SimpleSimConfig | ScenarioLogic,
  simConfigOrTarget: SimpleSimConfig | OptimizationTarget,
  maybeTarget?: OptimizationTarget,
): { score: number; metrics: OptimizationResult['metrics'] } {
  // Resolve overload: 3-param legacy vs 4-param calibrated
  let logic: ScenarioLogic;
  let simConfig: SimpleSimConfig;
  let target: OptimizationTarget;

  if ('referenceCompletedAt' in simConfigOrLogic) {
    // 4-param overload: (params, logic, simConfig, target)
    logic = simConfigOrLogic as ScenarioLogic;
    simConfig = simConfigOrTarget as SimpleSimConfig;
    target = maybeTarget!;
  } else {
    // 3-param legacy overload: (params, simConfig, target)
    logic = getLegacySceneLogic('turn90');
    simConfig = simConfigOrLogic as SimpleSimConfig;
    target = simConfigOrTarget as OptimizationTarget;
  }

  const speed = simConfig.shipSpeed || 15;
  const guidePath = generateGuidePath(logic, logic.duration, speed);
  const result = evaluateWithRustRuntime(params, logic, guidePath, speed, simConfig, target);

  // Calculate overshoot from referenceCompletedAt
  let overshoot = 0;
  for (let i = 0; i < result.chartData.time.length; i++) {
    const time = result.chartData.time[i];
    const heading = result.chartData.actualHeading[i];
    if (time >= logic.referenceCompletedAt) {
      const error = heading - target.targetHeading;
      if (error > overshoot) {
        overshoot = error;
      }
    }
  }

  // Calculate settling time: scan from referenceCompletedAt for sustained heading stability
  const headingTolerance = 5;
  const validationWindow = logic.duration - logic.referenceCompletedAt;
  // v1 unsettled sentinel = full duration (120s); v2 unsettled sentinel = validation window (90s)
  const unsettledSentinel = logic.runtimeVersion === 'simulation-optimizer-runtime-v2'
    ? logic.duration - logic.referenceCompletedAt
    : logic.duration;
  let settlingTime = unsettledSentinel; // default: not settled within validation window

  for (let i = 0; i < result.chartData.time.length; i++) {
    const time = result.chartData.time[i];
    if (time < logic.referenceCompletedAt) continue;
    if (Math.abs(result.chartData.actualHeading[i] - target.targetHeading) > headingTolerance) continue;

    // Check if heading stays within tolerance from this point until the end
    let sustained = true;
    for (let j = i; j < result.chartData.time.length; j++) {
      if (Math.abs(result.chartData.actualHeading[j] - target.targetHeading) > headingTolerance) {
        sustained = false;
        break;
      }
    }

    if (sustained && i < result.chartData.time.length - 1) {
      settlingTime = time - logic.referenceCompletedAt;
      break;
    }
  }

  // Scoring
  const errorScore = Math.max(0, 100 * (1 - result.metrics.avgError / target.maxError));
  const rudderScore = result.metrics.maxRudderRate <= target.maxRudderRate
    ? 100
    : Math.max(0, 100 * (1 - (result.metrics.maxRudderRate - target.maxRudderRate) / target.maxRudderRate));
  const overshootScore = overshoot <= (target.maxOvershoot ?? 20)
    ? 100
    : Math.max(0, 100 - ((overshoot - (target.maxOvershoot ?? 20)) / (target.maxOvershoot ?? 20)) * 100);
  const settled = settlingTime < unsettledSentinel;
  let settlingScore = settled ? 100 : 0;
  if (settled && target.minSettlingTime && settlingTime > target.minSettlingTime) {
    settlingScore = Math.max(0, 100 - ((settlingTime - target.minSettlingTime) / target.minSettlingTime) * 50);
  }

  // 综合得分（加权平均）
  const score = Math.round(
    (errorScore * 0.3 + rudderScore * 0.3 + overshootScore * 0.2 + settlingScore * 0.2) * 10
  ) / 10;

  return {
    score,
    metrics: {
      avgError: result.metrics.avgError,
      maxRudderRate: result.metrics.maxRudderRate,
      settlingTime,
      overshoot,
    },
  };
}

/** 随机采样参数 */
function sampleParams(
  constraints: OptimizationConstraints,
  rng: RandomNumberGenerator
): { kp: number; ki: number; kd: number } {
  return {
    kp: constraints.kpRange[0] + rng() * (constraints.kpRange[1] - constraints.kpRange[0]),
    ki: constraints.kiRange[0] + rng() * (constraints.kiRange[1] - constraints.kiRange[0]),
    kd: constraints.kdRange[0] + rng() * (constraints.kdRange[1] - constraints.kdRange[0]),
  };
}

/** 在最优解附近采样（局部搜索） */
function sampleNearby(
  bestParams: { kp: number; ki: number; kd: number },
  constraints: OptimizationConstraints,
  rng: RandomNumberGenerator,
  radius: number = 0.1
): { kp: number; ki: number; kd: number } {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  return {
    kp: clamp(
      bestParams.kp + (rng() * 2 - 1) * radius * (constraints.kpRange[1] - constraints.kpRange[0]),
      constraints.kpRange[0], constraints.kpRange[1]
    ),
    ki: clamp(
      bestParams.ki + (rng() * 2 - 1) * radius * (constraints.kiRange[1] - constraints.kiRange[0]),
      constraints.kiRange[0], constraints.kiRange[1]
    ),
    kd: clamp(
      bestParams.kd + (rng() * 2 - 1) * radius * (constraints.kdRange[1] - constraints.kdRange[0]),
      constraints.kdRange[0], constraints.kdRange[1]
    ),
  };
}

/**
 * Monte Carlo 优化主函数
 */
export function optimizePIDParams(
  config: SimpleSimConfig,
  target: OptimizationTarget,
  constraints: OptimizationConstraints = DEFAULT_CONSTRAINTS,
  maxIterations: number = 100,
  earlyStopThreshold: number = 20,
  options: OptimizePIDParamsOptions = {}
): OptimizationResult {
  const startTime = Date.now();
  const convergenceHistory: OptimizationResult['convergenceHistory'] = [];
  const scenario = options.scenario ?? getScenarioLogic('turn90', target.targetHeading);
  const replaySeed = normalizeSeed(
    options.seed,
    JSON.stringify({ config, target, constraints, maxIterations, earlyStopThreshold, scenarioId: scenario.scenarioId })
  );
  const baseRunContext = options.runContext ?? createSimulationRunContext({
    runId: `optimizer-${replaySeed.toString(16)}`,
    sceneId: 'simulation/optimizer/nomoto-quick-sim',
    scenarioId: scenario.scenarioId,
    seed: replaySeed,
    runtimeVersion: scenario.runtimeVersion,
    modelVersion: 'nomoto-quick-sim-v1',
  });
  const runContext: SimulationRunContext = {
    ...baseRunContext,
    scenarioId: scenario.scenarioId,
    runtimeVersion: scenario.runtimeVersion,
  };
  const rng = createSimulationRng(runContext, 'monte-carlo-search').next;

  let bestParams = sampleParams(constraints, rng);
  let bestResult = evaluatePIDParams(bestParams, scenario, config, target);
  let noImprovementCount = 0;
  let currentMaxIterations = maxIterations;

  // 添加初始点
  convergenceHistory.push({
    iteration: 0,
    score: bestResult.score,
    params: { ...bestParams },
  });

  for (let i = 1; i <= currentMaxIterations; i++) {
    // 混合策略：80% 局部搜索 + 20% 全局探索
    const params = rng() < 0.8
      ? sampleNearby(bestParams, constraints, rng, 0.15)
      : sampleParams(constraints, rng);

    const result = evaluatePIDParams(params, scenario, config, target);

    if (result.score > bestResult.score) {
      bestParams = params;
      bestResult = result;
      noImprovementCount = 0;

      convergenceHistory.push({
        iteration: i,
        score: result.score,
        params: { ...params },
      });
    } else {
      noImprovementCount++;
    }

    // 提前停止条件
    if (noImprovementCount >= earlyStopThreshold && bestResult.score > 80) {
      break;
    }

    // 如果已经找到很好的解，缩小搜索范围
    if (bestResult.score > 90) {
      currentMaxIterations = Math.min(currentMaxIterations, i + 10);
    }
  }

  const result = {
    bestParams: {
      kp: Math.round(bestParams.kp * 1000) / 1000,
      ki: Math.round(bestParams.ki * 10000) / 10000,
      kd: Math.round(bestParams.kd * 1000) / 1000,
    },
    score: Math.round(bestResult.score * 10) / 10,
    metrics: bestResult.metrics,
    iterations: convergenceHistory.length,
    searchTime: Date.now() - startTime,
    convergenceHistory,
  } satisfies Omit<OptimizationResult, 'replay'>;

  return {
    ...result,
    replay: buildSimulationReplayMetadata(runContext, {
      scenario: {
        id: scenario.scenarioId,
        duration: scenario.duration,
        referenceCompletedAt: scenario.referenceCompletedAt,
        headingSchedule: scenario.headingSchedule,
        start: scenario.startPos,
        maxRudderRateDegPerSec: 5,
      },
      bestParams: result.bestParams,
      score: result.score,
      metrics: result.metrics,
      iterations: result.iterations,
      convergenceHistory: result.convergenceHistory,
    }),
  };
}

/** 默认优化配置 */
export const DEFAULT_CONSTRAINTS: OptimizationConstraints = {
  kpRange: [0.5, 3.0],
  kiRange: [0.001, 0.1],
  kdRange: [0.1, 5.0],
};

export const DEFAULT_TARGET: OptimizationTarget = {
  targetHeading: 90,
  maxError: 150,
  maxRudderRate: 5.0,
  maxOvershoot: 20,
  minSettlingTime: 90,
};
