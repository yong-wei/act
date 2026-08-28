'use client';

import { computeRlTrainingBrowser } from '@/lib/control-engine/client';

export type Unit55RlTrainingType = 'toy_rl' | 'direct_rl' | 'safe_shell_rl' | 'rl_pid_schedule';

export interface Unit55RlTrainingRequest {
  panelKind: 'rust_toy_training_panel' | 'rust_heading_rl_training_panel';
  trainingType: Unit55RlTrainingType;
  seed: number;
  trainingEpisodes: number;
  episodeChunk?: number;
  evaluate?: boolean;
  trainingState?: Unit55RlTrainingState | null;
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
  disturbance: number;
  edgeScenario: number;
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

export interface Unit55RlTrainingState {
  nextEpisode: number;
  qTable: number[][];
  rewardWindow: number[];
  rewardHistory: Unit55RewardPoint[];
}

export interface Unit55RlTrainingResult {
  panelKind: string;
  trainingType: Unit55RlTrainingType;
  seed: number;
  selectedParameters: Record<string, string>;
  trainingEpisodes: number;
  rewardCurve: Unit55RewardPoint[];
  rewardChunk: Unit55RewardPoint[];
  comparisonTrace: Unit55ComparisonPoint[];
  metrics: Unit55RlTrainingMetrics;
  safetyFallbackCount: number;
  trainingState: Unit55RlTrainingState | null;
}

export async function computeUnit55RlTraining(request: Unit55RlTrainingRequest) {
  const envelope = await computeRlTrainingBrowser<Unit55RlTrainingResult>(request);
  return envelope.result;
}
