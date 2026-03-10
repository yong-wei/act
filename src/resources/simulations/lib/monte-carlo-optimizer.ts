/**
 * Monte Carlo 参数优化器
 *
 * 使用随机搜索算法寻找最优 PID 参数
 */

import {
  runQuickSimulation,
  type QuickSimConfig,
  generateGuidePath,
  getScenarioLogic,
} from './simulation-engine';

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

/**
 * 评估参数组合的得分
 */
function evaluateParams(
  params: { kp: number; ki: number; kd: number },
  simConfig: SimpleSimConfig,
  target: OptimizationTarget
): { score: number; metrics: OptimizationResult['metrics'] } {
  // 创建 QuickSimConfig
  const duration = 120;
  const speed = simConfig.shipSpeed || 15;

  // 使用 turn90 场景进行评估
  const logic = getScenarioLogic('turn90');
  const guidePath = generateGuidePath(logic, duration, speed);

  const config: QuickSimConfig = {
    pid: params,
    controlMode: 'pid',
    start: { x: 0, z: 0, headingDeg: 0 },
    duration,
    getDesiredHeading: (t: number) => {
      // 60秒时开始转向到目标航向
      if (t < 60) return 0;
      return target.targetHeading;
    },
    nomoto: {
      K: simConfig.nomotoK || 0.08,
      T: simConfig.nomotoT || 55,
      speedMps: speed,
      maxRudderDeg: 35,
    },
  };

  // 运行快速仿真
  const result = runQuickSimulation(config, guidePath);

  // 计算超调量和调节时间
  let overshoot = 0;
  let settlingTime = duration;
  const targetReached = target.targetHeading;
  const tolerance = 2; // 2度容差

  for (let i = 0; i < result.chartData.time.length; i++) {
    const heading = result.chartData.actualHeading[i];
    const time = result.chartData.time[i];

    // 计算超调
    if (time > 60) {
      const error = heading - targetReached;
      if (error > overshoot) {
        overshoot = error;
      }
    }

    // 计算调节时间
    if (Math.abs(heading - targetReached) <= tolerance && time > 60) {
      settlingTime = Math.min(settlingTime, time - 60);
    }
  }

  // 计算各项指标得分
  const errorScore = Math.max(0, 100 - (result.metrics.avgError / target.maxError) * 100);
  const rudderScore = result.metrics.maxRudderRate <= target.maxRudderRate
    ? 100
    : Math.max(0, 100 - ((result.metrics.maxRudderRate - target.maxRudderRate) / target.maxRudderRate) * 100);

  let overshootScore = 100;
  if (target.maxOvershoot !== undefined) {
    overshootScore = overshoot <= target.maxOvershoot
      ? 100
      : Math.max(0, 100 - ((overshoot - target.maxOvershoot) / target.maxOvershoot) * 100);
  }

  let settlingScore = 100;
  if (target.minSettlingTime !== undefined) {
    settlingScore = settlingTime <= target.minSettlingTime
      ? 100
      : Math.max(0, 100 - ((settlingTime - target.minSettlingTime) / target.minSettlingTime) * 50);
  }

  // 综合得分（加权平均）
  const score =
    errorScore * 0.4 +
    rudderScore * 0.3 +
    overshootScore * 0.2 +
    settlingScore * 0.1;

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

/**
 * 随机采样参数
 */
function sampleParams(constraints: OptimizationConstraints): { kp: number; ki: number; kd: number } {
  return {
    kp: constraints.kpRange[0] + Math.random() * (constraints.kpRange[1] - constraints.kpRange[0]),
    ki: constraints.kiRange[0] + Math.random() * (constraints.kiRange[1] - constraints.kiRange[0]),
    kd: constraints.kdRange[0] + Math.random() * (constraints.kdRange[1] - constraints.kdRange[0]),
  };
}

/**
 * 在最优解附近采样（局部搜索）
 */
function sampleNearby(
  bestParams: { kp: number; ki: number; kd: number },
  constraints: OptimizationConstraints,
  radius: number = 0.1
): { kp: number; ki: number; kd: number } {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  return {
    kp: clamp(
      bestParams.kp + (Math.random() * 2 - 1) * radius * (constraints.kpRange[1] - constraints.kpRange[0]),
      constraints.kpRange[0],
      constraints.kpRange[1]
    ),
    ki: clamp(
      bestParams.ki + (Math.random() * 2 - 1) * radius * (constraints.kiRange[1] - constraints.kiRange[0]),
      constraints.kiRange[0],
      constraints.kiRange[1]
    ),
    kd: clamp(
      bestParams.kd + (Math.random() * 2 - 1) * radius * (constraints.kdRange[1] - constraints.kdRange[0]),
      constraints.kdRange[0],
      constraints.kdRange[1]
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
  earlyStopThreshold: number = 20
): OptimizationResult {
  const startTime = Date.now();
  const convergenceHistory: OptimizationResult['convergenceHistory'] = [];

  let bestParams = sampleParams(constraints);
  let bestResult = evaluateParams(bestParams, config, target);
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
    const params = Math.random() < 0.8
      ? sampleNearby(bestParams, constraints, 0.15)
      : sampleParams(constraints);

    const result = evaluateParams(params, config, target);

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

  return {
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
  };
}

/**
 * 默认优化配置
 */
export const DEFAULT_CONSTRAINTS: OptimizationConstraints = {
  kpRange: [0.5, 3.0],
  kiRange: [0.001, 0.1],
  kdRange: [0.1, 2.0],
};

export const DEFAULT_TARGET: OptimizationTarget = {
  targetHeading: 90,
  maxError: 150,
  maxRudderRate: 5.0,
  maxOvershoot: 20,
  minSettlingTime: 60,
};
