import type { FormalPipelineKind, FormalQualificationReceipt } from './contracts';
import { FormalResourceError, projectionDigest } from './hash';

export const FROZEN_PIPELINE_THRESHOLD = 0.99;

export interface PipelineGoldItem {
  readonly id: string;
  readonly expected: 'admit' | 'exclude';
}

export function qualifyPipeline(input: {
  pipelineKind: FormalPipelineKind;
  pipelineVersion: string;
  pipelineConfigDigest: string;
  gold: readonly PipelineGoldItem[];
  holdout: readonly PipelineGoldItem[];
  admittedGoldIds: readonly string[];
  admittedHoldoutIds: readonly string[];
}): FormalQualificationReceipt {
  const goldScore = balancedScore(input.gold, new Set(input.admittedGoldIds));
  const holdoutScore = balancedScore(input.holdout, new Set(input.admittedHoldoutIds));
  const goldDigest = projectionDigest(input.gold);
  const holdoutDigest = projectionDigest(input.holdout);
  const passed = goldScore >= FROZEN_PIPELINE_THRESHOLD && holdoutScore >= FROZEN_PIPELINE_THRESHOLD;
  const receiptId = `qual-${projectionDigest({
    pipelineKind: input.pipelineKind,
    pipelineVersion: input.pipelineVersion,
    pipelineConfigDigest: input.pipelineConfigDigest,
    goldDigest,
    holdoutDigest,
    threshold: FROZEN_PIPELINE_THRESHOLD,
    admittedGoldIds: [...input.admittedGoldIds].sort(),
    admittedHoldoutIds: [...input.admittedHoldoutIds].sort(),
    goldScore,
    holdoutScore,
    passed,
  }).slice(0, 24)}`;
  return {
    pipelineKind: input.pipelineKind,
    pipelineVersion: input.pipelineVersion,
    pipelineConfigDigest: input.pipelineConfigDigest,
    goldDigest,
    holdoutDigest,
    threshold: FROZEN_PIPELINE_THRESHOLD,
    passed,
    receiptId,
  };
}

export function assertQualified(receipt: FormalQualificationReceipt, kind: FormalPipelineKind, version: string, config: string): void {
  if (
    !receipt.passed
    || receipt.pipelineKind !== kind
    || receipt.pipelineVersion !== version
    || receipt.pipelineConfigDigest !== config
  ) {
    throw new FormalResourceError('pipeline-unqualified', `${kind} pipeline is not qualified`);
  }
}

function balancedScore(items: readonly PipelineGoldItem[], admitted: ReadonlySet<string>): number {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const item of items) {
    const hit = admitted.has(item.id);
    if (item.expected === 'admit' && hit) tp += 1;
    if (item.expected === 'admit' && !hit) fn += 1;
    if (item.expected === 'exclude' && hit) fp += 1;
  }
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}
