import type { FormalPipelineKind, FormalQualificationReceipt } from './contracts';
import { FormalResourceError, projectionDigest } from './hash';

export const FROZEN_PIPELINE_THRESHOLD = 0.99;

export interface PipelineGoldItem {
  readonly id: string;
  readonly expected: 'admit' | 'exclude';
}

export interface FrozenPipelineSpec {
  readonly kind: FormalPipelineKind;
  readonly version: string;
  readonly config: string;
  readonly gold: readonly PipelineGoldItem[];
  readonly holdout: readonly PipelineGoldItem[];
  readonly admittedGoldIds: readonly string[];
  readonly admittedHoldoutIds: readonly string[];
  readonly output: unknown;
}

export const FROZEN_PIPELINE_REGISTRY: readonly FrozenPipelineSpec[] = [
  {
    kind: 'canonical-mapping',
    version: 'map/v1',
    config: 'cfg-map',
    gold: [
      { id: 'map-bound', expected: 'admit' },
      { id: 'map-label', expected: 'exclude' },
    ],
    holdout: [{ id: 'map-holdout', expected: 'admit' }],
    admittedGoldIds: ['map-bound'],
    admittedHoldoutIds: ['map-holdout'],
    output: { mapping: ['ctc:a'] },
  },
  {
    kind: 'asr',
    version: 'asr/v1',
    config: 'cfg-asr',
    gold: [{ id: 'a1', expected: 'admit' }],
    holdout: [{ id: 'h1', expected: 'admit' }],
    admittedGoldIds: ['a1'],
    admittedHoldoutIds: ['h1'],
    output: { transcript: 'closed loop' },
  },
  {
    kind: 'segmentation',
    version: 'seg/v1',
    config: 'cfg-seg',
    gold: [{ id: 's1', expected: 'admit' }],
    holdout: [{ id: 'sh1', expected: 'admit' }],
    admittedGoldIds: ['s1'],
    admittedHoldoutIds: ['sh1'],
    output: { paragraphs: ['p1'] },
  },
  {
    kind: 'time-alignment',
    version: 'ta/v1',
    config: 'cfg-ta',
    gold: [{ id: 't1', expected: 'admit' }],
    holdout: [{ id: 'th1', expected: 'admit' }],
    admittedGoldIds: ['t1'],
    admittedHoldoutIds: ['th1'],
    output: { starts: [0] },
  },
];

function lookupFrozenPipeline(
  kind: FormalPipelineKind,
  version: string,
  config: string,
): FrozenPipelineSpec {
  const spec = FROZEN_PIPELINE_REGISTRY.find((row) => (
    row.kind === kind && row.version === version && row.config === config
  ));
  if (!spec) {
    throw new FormalResourceError('pipeline-unqualified', `${kind} pipeline is not in the frozen registry`);
  }
  return spec;
}

export function qualifyPipeline(input: {
  pipelineKind: FormalPipelineKind;
  pipelineVersion: string;
  pipelineConfigDigest: string;
  gold: readonly PipelineGoldItem[];
  holdout: readonly PipelineGoldItem[];
  admittedGoldIds: readonly string[];
  admittedHoldoutIds: readonly string[];
  output: unknown;
}): FormalQualificationReceipt {
  const goldScore = balancedScore(input.gold, new Set(input.admittedGoldIds));
  const holdoutScore = balancedScore(input.holdout, new Set(input.admittedHoldoutIds));
  const goldDigest = projectionDigest(input.gold);
  const holdoutDigest = projectionDigest(input.holdout);
  const outputHash = projectionDigest(input.output);
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
    outputHash,
    passed,
  }).slice(0, 24)}`;
  return {
    pipelineKind: input.pipelineKind,
    pipelineVersion: input.pipelineVersion,
    pipelineConfigDigest: input.pipelineConfigDigest,
    goldDigest,
    holdoutDigest,
    outputHash,
    threshold: FROZEN_PIPELINE_THRESHOLD,
    passed,
    receiptId,
  };
}

export function rebuildFrozenQualificationReceipt(
  kind: FormalPipelineKind,
  version: string,
  config: string,
): FormalQualificationReceipt {
  const spec = lookupFrozenPipeline(kind, version, config);
  return qualifyPipeline({
    pipelineKind: spec.kind,
    pipelineVersion: spec.version,
    pipelineConfigDigest: spec.config,
    gold: spec.gold,
    holdout: spec.holdout,
    admittedGoldIds: spec.admittedGoldIds,
    admittedHoldoutIds: spec.admittedHoldoutIds,
    output: spec.output,
  });
}

export function assertQualified(
  receipt: FormalQualificationReceipt,
  kind: FormalPipelineKind,
  version: string,
  config: string,
): void {
  const expected = rebuildFrozenQualificationReceipt(kind, version, config);
  if (!expected.passed || projectionDigest(receipt) !== projectionDigest(expected)) {
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
