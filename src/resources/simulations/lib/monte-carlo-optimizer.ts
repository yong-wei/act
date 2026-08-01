/**
 * Monte Carlo å‚æ•°ä¼˜åŒ–å™?
 *
 * ä½¿ç”¨éšæœºæœç´¢ç®—æ³•å¯»æ‰¾æœ€ä¼?PID å‚æ•°
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
  targetHeading: number; // ç›®æ ‡èˆªå‘
  maxError: number; // å…è®¸çš„æœ€å¤§èˆªè¿¹è¯¯å·?
  maxRudderRate: number; // å…è®¸çš„æœ€å¤§èˆµè§’é€Ÿåº¦
  maxOvershoot?: number; // å…è®¸çš„æœ€å¤§è¶…è°ƒé‡
  minSettlingTime?: number; // æœŸæœ›çš„æœ€å°è°ƒèŠ‚æ—¶é—?
}

export interface OptimizationConstraints {
  kpRange: [number, number]; // Kp æœç´¢èŒƒå›´
  kiRange: [number, number]; // Ki æœç´¢èŒƒå›´
  kdRange: [number, number]; // Kd æœç´¢èŒƒå›´
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
  seed?: number | string;
  scenario?: ScenarioLogic;
}

// ç®€åŒ–çš„ä»¿çœŸé…ç½®
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

export interface ScenarioLogic {
  scenarioId: string;
  runtimeVersion: string;
  duration: number;
  referenceCompletedAt: number;
  headingSchedule: Array<{ time: number; headingDeg: number }>;
  getDesiredHeading: (time: number) => number;
  startPos: { x: number; z: number; headingDeg: number };
}

const getScheduledHeading = (
  headingSchedule: Array<{ time: number; headingDeg: number }>,
  time: number,
) => {
  const firstPoint = headingSchedule[0];
  if (time <= firstPoint.time) {
    return firstPoint.headingDeg;
  }

  for (let index = 1; index < headingSchedule.length; index++) {
    const previousPoint = headingSchedule[index - 1];
    const nextPoint = headingSchedule[index];
    if (time <= nextPoint.time) {
      const progress = (time - previousPoint.time) / (nextPoint.time - previousPoint.time);
      return previousPoint.headingDeg + (nextPoint.headingDeg - previousPoint.headingDeg) * progress;
    }
  }

  return headingSchedule[headingSchedule.length - 1].headingDeg;
};

export const getLegacySceneLogic = (_scenario: 'turn90', targetHeading: number): ScenarioLogic => {
  const headingSchedule = [
    { time: 0, headingDeg: 0 },
    { time: 60, headingDeg: 0 },
    { time: 60, headingDeg: targetHeading },
    { time: 120, headingDeg: targetHeading },
  ];

  return {
    scenarioId: 'turn90',
    runtimeVersion: 'simulation-optimizer-runtime-v1',
    duration: 120,
    referenceCompletedAt: 60,
    headingSchedule,
    startPos: { x: 0, z: 0, headingDeg: 0 },
    getDesiredHeading: (time: number) => getScheduledHeading(headingSchedule, time),
  };
};

export const getScenarioLogic = (_scenario: 'turn90', targetHeading: number): ScenarioLogic => {
  const headingSchedule = [
    { time: 0, headingDeg: 0 },
    { time: 60, headingDeg: 0 },
    { time: 150, headingDeg: targetHeading },
    { time: 240, headingDeg: targetHeading },
  ];

  return {
    scenarioId: 'turn90-calibrated-v1',
    runtimeVersion: 'simulation-optimizer-runtime-v2',
    duration: 240,
    referenceCompletedAt: 150,
    headingSchedule,
    startPos: { x: 0, z: 0, headingDeg: 0 },
    getDesiredHeading: (time: number) => getScheduledHeading(headingSchedule, time),
  };
};

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

export function evaluatePIDParams(
  params: { kp: number; ki: number; kd: number },
  simConfig: SimpleSimConfig,
  target: OptimizationTarget,
): { score: number; metrics: OptimizationResult['metrics'] } {
  const duration = 120;
  const speed = simConfig.shipSpeed || 15;
  const legacyLogic: ScenarioLogic = {
    scenarioId: 'turn90',
    runtimeVersion: 'simulation-optimizer-runtime-v1',
    duration,
    referenceCompletedAt: 60,
    headingSchedule: [],
    startPos: { x: -6000, z: 0, headingDeg: 0 },
    getDesiredHeading: (time: number) => (time < 60 ? 0 : 90),
  };
  const guidePath = generateGuidePath(legacyLogic, duration, speed);
  const result = computeVirtualSimulationServerStep<RustQuickSimResult>({
    modelId: 'nomoto_quick_sim',
    duration,
    dt: 0.5,
    start: { x: 0, z: 0, headingDeg: 0 },
    targetHeadingDeg: target.targetHeading,
    targetSwitchTime: 60,
    pid: params,
    nomoto: {
      K: simConfig.nomotoK || 0.08,
      T: simConfig.nomotoT || 55,
      speedMps: speed,
      maxRudderDeg: 35,
    },
    guidePath,
  });

  let overshoot = 0;
  let settlingTime = duration;
  for (let index = 0; index < result.chartData.time.length; index += 1) {
    const heading = result.chartData.actualHeading[index];
    const time = result.chartData.time[index];
    if (time > 60) {
      overshoot = Math.max(overshoot, heading - target.targetHeading);
      if (Math.abs(heading - target.targetHeading) <= 2) {
        settlingTime = Math.min(settlingTime, time - 60);
      }
    }
  }

  const errorScore = Math.max(0, 100 - (result.metrics.avgError / target.maxError) * 100);
  const rudderScore = result.metrics.maxRudderRate <= target.maxRudderRate
    ? 100
    : Math.max(0, 100 - ((result.metrics.maxRudderRate - target.maxRudderRate) / target.maxRudderRate) * 100);
  const overshootScore = target.maxOvershoot === undefined || overshoot <= target.maxOvershoot
    ? 100
    : Math.max(0, 100 - ((overshoot - target.maxOvershoot) / target.maxOvershoot) * 100);
  const settlingScore = target.minSettlingTime === undefined || settlingTime <= target.minSettlingTime
    ? 100
    : Math.max(0, 100 - ((settlingTime - target.minSettlingTime) / target.minSettlingTime) * 50);

  return {
    score: errorScore * 0.4 + rudderScore * 0.3 + overshootScore * 0.2 + settlingScore * 0.1,
    metrics: {
      avgError: result.metrics.avgError,
      maxRudderRate: result.metrics.maxRudderRate,
      settlingTime,
      overshoot,
    },
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
    headingSchedule: logic.headingSchedule,
    pid: params,
    nomoto: {
      K: simConfig.nomotoK || 0.08,
      T: simConfig.nomotoT || 55,
      speedMps: speed,
      maxRudderDeg: 35,
      ...(logic.runtimeVersion === 'simulation-optimizer-runtime-v2' ? { maxRudderRateDegPerSec: 5 } : {}),
    },
    guidePath,
  });
}

/**
 * è¯„ä¼°å‚æ•°ç»„åˆçš„å¾—åˆ?
 */
export function evaluateParams(
  params: { kp: number; ki: number; kd: number },
  logic: ScenarioLogic,
  simConfig: SimpleSimConfig,
  target: OptimizationTarget,
): { score: number; metrics: OptimizationResult['metrics'] } {
  const speed = simConfig.shipSpeed || 15;
  const guidePath = generateGuidePath(logic, logic.duration, speed);
  const result = evaluateWithRustRuntime(params, logic, guidePath, speed, simConfig, target);

  // è®¡ç®—è¶…è°ƒé‡å’Œè°ƒèŠ‚æ—¶é—´
  let overshoot = 0;
  let stableSince: number | undefined;
  const targetReached = target.targetHeading;
  const tolerance = 5;

  for (let i = 0; i < result.chartData.time.length; i++) {
    const heading = result.chartData.actualHeading[i];
    const time = result.chartData.time[i];
    if (time < logic.referenceCompletedAt) {
      continue;
    }

    // è®¡ç®—è¶…è°ƒ
    const error = heading - targetReached;
    if (error > overshoot) {
      overshoot = error;
    }

    if (Math.abs(error) <= tolerance) {
      stableSince ??= time;
    } else {
      stableSince = undefined;
    }
  }
  const hasSustainedSettling = stableSince !== undefined && stableSince < logic.duration;
  const settlingTime = stableSince === undefined
    ? logic.duration - logic.referenceCompletedAt
    : stableSince - logic.referenceCompletedAt;

  // è®¡ç®—å„é¡¹æŒ‡æ ‡å¾—åˆ†
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
    settlingScore = !hasSustainedSettling
      ? 0
      : settlingTime <= target.minSettlingTime
      ? 100
      : Math.max(0, 100 - ((settlingTime - target.minSettlingTime) / target.minSettlingTime) * 50);
  }

  // ç»¼åˆå¾—åˆ†ï¼ˆåŠ æƒå¹³å‡ï¼‰
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
 * éšæœºé‡‡æ ·å‚æ•°
 */
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

/**
 * åœ¨æœ€ä¼˜è§£é™„è¿‘é‡‡æ ·ï¼ˆå±€éƒ¨æœç´¢ï¼‰
 */
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
      constraints.kpRange[0],
      constraints.kpRange[1]
    ),
    ki: clamp(
      bestParams.ki + (rng() * 2 - 1) * radius * (constraints.kiRange[1] - constraints.kiRange[0]),
      constraints.kiRange[0],
      constraints.kiRange[1]
    ),
    kd: clamp(
      bestParams.kd + (rng() * 2 - 1) * radius * (constraints.kdRange[1] - constraints.kdRange[0]),
      constraints.kdRange[0],
      constraints.kdRange[1]
    ),
  };
}

/**
 * Monte Carlo ä¼˜åŒ–ä¸»å‡½æ•?
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
  let bestResult = evaluateParams(bestParams, scenario, config, target);
  let noImprovementCount = 0;
  let currentMaxIterations = maxIterations;

  // æ·»åŠ åˆå§‹ç‚?
  convergenceHistory.push({
    iteration: 0,
    score: bestResult.score,
    params: { ...bestParams },
  });

  for (let i = 1; i <= currentMaxIterations; i++) {
    // æ··åˆç­–ç•¥ï¼?0% å±€éƒ¨æœç´?+ 20% å…¨å±€æŽ¢ç´¢
    const params = rng() < 0.8
      ? sampleNearby(bestParams, constraints, rng, 0.15)
      : sampleParams(constraints, rng);

    const result = evaluateParams(params, scenario, config, target);

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

    // æå‰åœæ­¢æ¡ä»¶
    if (noImprovementCount >= earlyStopThreshold && bestResult.score > 80) {
      break;
    }

    // å¦‚æžœå·²ç»æ‰¾åˆ°å¾ˆå¥½çš„è§£ï¼Œç¼©å°æœç´¢èŒƒå›?
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
        ...(scenario.runtimeVersion === 'simulation-optimizer-runtime-v2' ? { maxRudderRateDegPerSec: 5 } : {}),
      },
      bestParams: result.bestParams,
      score: result.score,
      metrics: result.metrics,
      iterations: result.iterations,
      convergenceHistory: result.convergenceHistory,
    }),
  };
}

/**
 * é»˜è®¤ä¼˜åŒ–é…ç½®
 */
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
