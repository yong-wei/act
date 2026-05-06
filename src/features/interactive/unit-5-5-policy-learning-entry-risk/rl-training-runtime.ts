'use client';

import initControlEngine, { compute_rl_training } from '@/resources/control-system/wasm/control_engine/index.js';

export type Unit55RlTrainingType = 'toy_rl' | 'direct_rl' | 'safe_shell_rl' | 'rl_pid_schedule';

export interface Unit55RlTrainingRequest {
  panelKind: 'rust_toy_training_panel' | 'rust_heading_rl_training_panel';
  trainingType: Unit55RlTrainingType;
  seed: number;
  trainingEpisodes: number;
  selectedParameters: Record<string, string | number>;
}

export interface Unit55RewardPoint {
  episode: number;
  reward: number;
  movingAverage: number;
}

export interface Unit55ComparisonPoint {
  t: number;
  reference: number;
  pid: number;
  rl: number;
  rudderPid: number;
  rudderRl: number;
}

export interface Unit55RlTrainingMetrics {
  rmsHeadingError: number;
  maxOvershoot: number;
  settlingTime: number;
  averageRudder: number;
  averageRudderRate: number;
  finalError: number;
  cumulativeReward: number;
}

export interface Unit55RlTrainingResult {
  panelKind: string;
  trainingType: Unit55RlTrainingType;
  seed: number;
  selectedParameters: Record<string, string>;
  trainingEpisodes: number;
  rewardCurve: Unit55RewardPoint[];
  comparisonTrace: Unit55ComparisonPoint[];
  metrics: Unit55RlTrainingMetrics;
  safetyFallbackCount: number;
}

let initPromise: Promise<void> | null = null;

async function ensureRlTrainingEngine() {
  if (!initPromise) {
    initPromise = initControlEngine().then(() => undefined);
  }
  return initPromise;
}

export async function computeUnit55RlTraining(request: Unit55RlTrainingRequest) {
  await ensureRlTrainingEngine();
  return JSON.parse(compute_rl_training(JSON.stringify(request))) as Unit55RlTrainingResult;
}
