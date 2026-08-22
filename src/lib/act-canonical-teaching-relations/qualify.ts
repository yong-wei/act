import {
  ACT_TEACHING_QUALIFICATION_CONTRACT,
  type ActTeachingCandidate,
  type ActTeachingQualificationMetrics,
  type ActTeachingQualificationReceipt,
  type ActTeachingRelationType,
} from './contracts';
import { ActTeachingRelationError, projectionDigest } from './hash';

export interface GoldRelationItem {
  readonly id: string;
  readonly family: ActTeachingCandidate['family'];
  readonly relationType: ActTeachingRelationType;
  readonly sourceCanonicalId: string;
  readonly targetCanonicalId: string | null;
  readonly expected: 'admit' | 'exclude';
}

export interface QualificationDataset {
  readonly name: 'gold' | 'holdout';
  readonly items: readonly GoldRelationItem[];
}

function metricsFor(
  expected: readonly GoldRelationItem[],
  emitted: ReadonlySet<string>,
): ActTeachingQualificationMetrics {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  for (const item of expected) {
    const hit = emitted.has(item.id);
    if (item.expected === 'admit' && hit) truePositives += 1;
    if (item.expected === 'admit' && !hit) falseNegatives += 1;
    if (item.expected === 'exclude' && hit) falsePositives += 1;
  }
  const precision = truePositives + falsePositives === 0
    ? 1
    : truePositives / (truePositives + falsePositives);
  const recall = truePositives + falseNegatives === 0
    ? 1
    : truePositives / (truePositives + falseNegatives);
  const balancedScore = precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);
  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    balancedScore,
  };
}

export function datasetDigest(dataset: QualificationDataset): string {
  return projectionDigest({
    name: dataset.name,
    items: dataset.items.map((item) => ({
      id: item.id,
      family: item.family,
      relationType: item.relationType,
      sourceCanonicalId: item.sourceCanonicalId,
      targetCanonicalId: item.targetCanonicalId,
      expected: item.expected,
    })),
  });
}

export function qualifyPipeline(input: {
  pipelineVersion: string;
  pipelineConfigDigest: string;
  gold: QualificationDataset;
  holdout: QualificationDataset;
  admittedGoldIds: readonly string[];
  admittedHoldoutIds: readonly string[];
  threshold: number;
}): ActTeachingQualificationReceipt {
  if (input.gold.name !== 'gold' || input.holdout.name !== 'holdout') {
    throw new ActTeachingRelationError(
      'qualification-dataset-role',
      'gold and holdout datasets must keep their frozen roles',
    );
  }
  const gold = metricsFor(input.gold.items, new Set(input.admittedGoldIds));
  const holdout = metricsFor(input.holdout.items, new Set(input.admittedHoldoutIds));
  const passed = gold.balancedScore >= input.threshold
    && holdout.balancedScore >= input.threshold;
  const goldDigest = datasetDigest(input.gold);
  const holdoutDigest = datasetDigest(input.holdout);
  const receiptId = `qual-${projectionDigest({
    pipelineVersion: input.pipelineVersion,
    pipelineConfigDigest: input.pipelineConfigDigest,
    goldDigest,
    holdoutDigest,
    threshold: input.threshold,
  }).slice(0, 24)}`;
  return {
    contract: ACT_TEACHING_QUALIFICATION_CONTRACT,
    receiptId,
    pipelineVersion: input.pipelineVersion,
    pipelineConfigDigest: input.pipelineConfigDigest,
    goldDigest,
    holdoutDigest,
    gold,
    holdout,
    threshold: input.threshold,
    passed,
  };
}

export function assertQualifiedReceipt(
  receipt: ActTeachingQualificationReceipt,
  pipelineVersion: string,
  pipelineConfigDigest: string,
): void {
  if (
    !receipt.passed
    || receipt.pipelineVersion !== pipelineVersion
    || receipt.pipelineConfigDigest !== pipelineConfigDigest
  ) {
    throw new ActTeachingRelationError(
      'pipeline-unqualified',
      'automatic admission requires a matching successful qualification receipt',
    );
  }
}
