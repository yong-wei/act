import type { FormalPipelineKind, FormalQualificationReceipt } from './contracts';
import { FormalResourceError, projectionDigest } from './hash';

export const FROZEN_PIPELINE_THRESHOLD = 0.99;

export interface PipelineGoldItem {
  readonly id: string;
  readonly expected: 'admit' | 'exclude';
}

export interface FrozenAsrParagraph {
  readonly paragraphId: string;
  readonly body: string;
  readonly startSeconds: number;
}

export interface FrozenPipelineSpec {
  readonly kind: FormalPipelineKind;
  readonly version: string;
  readonly config: string;
  readonly gold: readonly PipelineGoldItem[];
  readonly holdout: readonly PipelineGoldItem[];
  readonly predictedGoldIds: readonly string[];
  readonly predictedHoldoutIds: readonly string[];
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
    predictedGoldIds: ['map-bound'],
    predictedHoldoutIds: ['map-holdout'],
    output: { mapping: ['ctc:a'] },
  },
  {
    kind: 'asr',
    version: 'asr/v1',
    config: 'cfg-asr',
    gold: [{ id: 'a1', expected: 'admit' }],
    holdout: [{ id: 'h1', expected: 'admit' }],
    predictedGoldIds: ['a1'],
    predictedHoldoutIds: ['h1'],
    output: {
      transcript: 'closed loop',
      paragraphs: [{ paragraphId: 'p1', body: 'closed loop', startSeconds: 0 }],
    },
  },
  {
    kind: 'segmentation',
    version: 'seg/v1',
    config: 'cfg-seg',
    gold: [{ id: 's1', expected: 'admit' }],
    holdout: [{ id: 'sh1', expected: 'admit' }],
    predictedGoldIds: ['s1'],
    predictedHoldoutIds: ['sh1'],
    output: { paragraphs: ['p1'] },
  },
  {
    kind: 'time-alignment',
    version: 'ta/v1',
    config: 'cfg-ta',
    gold: [{ id: 't1', expected: 'admit' }],
    holdout: [{ id: 'th1', expected: 'admit' }],
    predictedGoldIds: ['t1'],
    predictedHoldoutIds: ['th1'],
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

function sameDigest(left: unknown, right: unknown): boolean {
  return projectionDigest(left) === projectionDigest(right);
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
  const spec = lookupFrozenPipeline(
    input.pipelineKind,
    input.pipelineVersion,
    input.pipelineConfigDigest,
  );
  if (
    !sameDigest(input.gold, spec.gold)
    || !sameDigest(input.holdout, spec.holdout)
    || !sameDigest(input.output, spec.output)
    || !sameDigest([...input.admittedGoldIds].sort(), [...spec.predictedGoldIds].sort())
    || !sameDigest([...input.admittedHoldoutIds].sort(), [...spec.predictedHoldoutIds].sort())
  ) {
    throw new FormalResourceError(
      'pipeline-unqualified',
      `${input.pipelineKind} caller evaluation drifted from frozen pipeline output`,
    );
  }
  return receiptFromFrozenSpec(spec);
}

function receiptFromFrozenSpec(spec: FrozenPipelineSpec): FormalQualificationReceipt {
  const goldScore = balancedScore(spec.gold, new Set(spec.predictedGoldIds));
  const holdoutScore = balancedScore(spec.holdout, new Set(spec.predictedHoldoutIds));
  const goldDigest = projectionDigest(spec.gold);
  const holdoutDigest = projectionDigest(spec.holdout);
  const outputHash = projectionDigest(spec.output);
  const passed = goldScore >= FROZEN_PIPELINE_THRESHOLD && holdoutScore >= FROZEN_PIPELINE_THRESHOLD;
  const receiptId = `qual-${projectionDigest({
    pipelineKind: spec.kind,
    pipelineVersion: spec.version,
    pipelineConfigDigest: spec.config,
    goldDigest,
    holdoutDigest,
    threshold: FROZEN_PIPELINE_THRESHOLD,
    admittedGoldIds: [...spec.predictedGoldIds].sort(),
    admittedHoldoutIds: [...spec.predictedHoldoutIds].sort(),
    goldScore,
    holdoutScore,
    outputHash,
    passed,
  }).slice(0, 24)}`;
  return {
    pipelineKind: spec.kind,
    pipelineVersion: spec.version,
    pipelineConfigDigest: spec.config,
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
  return receiptFromFrozenSpec(lookupFrozenPipeline(kind, version, config));
}

export function frozenPipelineOutput(
  kind: FormalPipelineKind,
  version: string,
  config: string,
): unknown {
  return lookupFrozenPipeline(kind, version, config).output;
}

export function frozenCanonicalMappingIds(version: string, config: string): readonly string[] {
  const output = frozenPipelineOutput('canonical-mapping', version, config);
  const mapping = output && typeof output === 'object'
    ? (output as { mapping?: unknown }).mapping
    : undefined;
  if (!Array.isArray(mapping) || mapping.some((row) => typeof row !== 'string' || row.length === 0)) {
    throw new FormalResourceError('pipeline-unqualified', 'frozen mapping output is invalid');
  }
  return mapping as string[];
}

export function frozenAsrTranscript(version: string, config: string): string {
  const output = frozenPipelineOutput('asr', version, config);
  const transcript = output && typeof output === 'object'
    ? (output as { transcript?: unknown }).transcript
    : undefined;
  if (typeof transcript !== 'string' || transcript.length === 0) {
    throw new FormalResourceError('pipeline-unqualified', 'frozen ASR output is invalid');
  }
  return transcript;
}

export function frozenAsrParagraphs(version: string, config: string): readonly FrozenAsrParagraph[] {
  const output = frozenPipelineOutput('asr', version, config);
  const paragraphs = output && typeof output === 'object'
    ? (output as { paragraphs?: unknown }).paragraphs
    : undefined;
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    throw new FormalResourceError('pipeline-unqualified', 'frozen ASR paragraph tuples are missing');
  }
  return paragraphs.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new FormalResourceError('pipeline-unqualified', `frozen ASR paragraph ${index} is invalid`);
    }
    const paragraphId = (row as { paragraphId?: unknown }).paragraphId;
    const body = (row as { body?: unknown }).body;
    const startSeconds = (row as { startSeconds?: unknown }).startSeconds;
    if (typeof paragraphId !== 'string' || paragraphId.length === 0 || typeof body !== 'string' || typeof startSeconds !== 'number' || !Number.isFinite(startSeconds)) {
      throw new FormalResourceError('pipeline-unqualified', `frozen ASR paragraph ${index} is invalid`);
    }
    return { paragraphId, body, startSeconds };
  });
}

export function frozenSegmentationParagraphIds(version: string, config: string): readonly string[] {
  const output = frozenPipelineOutput('segmentation', version, config);
  const paragraphs = output && typeof output === 'object'
    ? (output as { paragraphs?: unknown }).paragraphs
    : undefined;
  if (!Array.isArray(paragraphs) || paragraphs.some((row) => typeof row !== 'string' || row.length === 0)) {
    throw new FormalResourceError('pipeline-unqualified', 'frozen segmentation output is invalid');
  }
  return paragraphs as string[];
}

export function frozenAlignmentStarts(version: string, config: string): readonly number[] {
  const output = frozenPipelineOutput('time-alignment', version, config);
  const starts = output && typeof output === 'object'
    ? (output as { starts?: unknown }).starts
    : undefined;
  if (!Array.isArray(starts) || starts.some((row) => typeof row !== 'number' || !Number.isFinite(row))) {
    throw new FormalResourceError('pipeline-unqualified', 'frozen time-alignment output is invalid');
  }
  return starts as number[];
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
