import { createHash } from 'node:crypto';
import { resolveLearningFactProfileWeight } from './learning-fact-quality-weight';
import {
  mapLegacyCompetencyDimensionToPortraitV2,
  PORTRAIT_V2_DIMENSION_IDS,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  createPortraitV2Payload,
  type PortraitV2DimensionState,
  type PortraitV2Payload,
  type PortraitV2PayloadShape,
} from './portrait-v2-model';

const DAY_MS = 86_400_000;
const MAX_SCORE_DELTA_PER_UPDATE = 12;
const CONFIDENCE_GAIN_PER_EVIDENCE = 0.08;
const MAX_FACT_LINEAGE_REFS = 20;
const NEGATIVE_RATIONALE = 'Governed negative evidence applied a bounded score correction.';
const NEGATIVE_LIMITATION = 'bounded-negative-evidence-correction';

export interface PortraitV2IncrementalEvidence {
  id: string;
  occurredAt: string;
  sourceFamily: 'LearningFact';
  outcome: 'positive' | 'partial' | 'negative' | 'context-only';
  contributions: Partial<Record<PortraitV2DimensionId, number>>;
  rubricWeight?: number;
  normalizedPerformance?: boolean;
}

export interface PortraitV2IncrementalResult {
  payload: PortraitV2Payload;
  mappingIssues: string[];
  affectedDimensions: PortraitV2DimensionId[];
}

export interface PortraitLearningFactDelta {
  id: string;
  startedAt: Date;
  outcome: string;
  score: number | null;
  competencyContribution: unknown;
  contextJson: unknown;
  createdAt: Date;
  sourceEventId?: string | null;
  sourceLogId?: string | null;
  knowledgeRevisionRef?: string | null;
}

export function isPortraitV2ProfileEvidence(evidence: PortraitV2IncrementalEvidence): boolean {
  return evidence.outcome !== 'context-only'
    && Object.values(evidence.contributions).some((value) => value !== 0 || evidence.normalizedPerformance);
}

export function updatePortraitV2Incrementally(input: {
  userId: string;
  previous: PortraitV2PayloadShape | null;
  evidence: PortraitV2IncrementalEvidence[];
  generatedAt: Date | string;
  updateCursor?: PortraitV2PayloadShape['updateCursor'];
}): PortraitV2IncrementalResult {
  const generatedAt = iso(input.generatedAt);
  const uniqueEvidence = orderAndDedupePortraitV2Evidence(input.evidence);
  const profileEvidence = uniqueEvidence.filter(isPortraitV2ProfileEvidence);
  if (input.previous && profileEvidence.length === 0) {
    return {
      payload: createPortraitV2Payload({
        userId: input.previous.userId,
        generatedAt: input.previous.generatedAt,
        now: generatedAt,
        dimensions: input.previous.dimensions,
        derivation: input.previous.derivation,
        updateCursor: input.previous.updateCursor,
      }),
      mappingIssues: [],
      affectedDimensions: [],
    };
  }
  const previousById = new Map(input.previous?.dimensions.map((dimension) => [dimension.id, dimension]) ?? []);
  const affectedDimensions: PortraitV2DimensionId[] = [];

  const dimensions = PORTRAIT_V2_DIMENSION_IDS.map((id) => {
    const previous = previousById.get(id) ?? missingDimension(id);
    const unchanged = preserveDimension(previous, generatedAt);
    const relevant = profileEvidence.filter((item) =>
      Number.isFinite(item.contributions[id]) &&
      (item.contributions[id] !== 0 || item.normalizedPerformance === true),
    );
    if (relevant.length === 0) return unchanged;
    affectedDimensions.push(id);
    return applyEvidence(unchanged, relevant, id, generatedAt);
  });

  return {
    payload: createPortraitV2Payload({
      userId: input.userId,
      generatedAt,
      now: generatedAt,
      dimensions,
      derivation: { kind: 'native', limitations: [] },
      updateCursor: input.updateCursor ?? input.previous?.updateCursor,
    }),
    mappingIssues: [],
    affectedDimensions,
  };
}

export function mapLearningFactsToPortraitEvidence(facts: PortraitLearningFactDelta[]): {
  evidence: PortraitV2IncrementalEvidence[];
  mappingIssues: string[];
} {
  const mappingIssues = new Set<string>();
  const orderedFacts = [...new Map(
    [...facts]
      .sort((a, b) => compareOccurredAtAndId(
        a.startedAt.toISOString(),
        a.id,
        b.startedAt.toISOString(),
        b.id,
      ))
      .map((fact) => [fact.id, fact]),
  ).values()];
  const evidence = orderedFacts.map((fact) => {
    const profileWeight = resolveLearningFactProfileWeight(fact.contextJson);
    const context = isRecord(fact.contextJson) ? fact.contextJson : {};
    const rawRubricWeight = context.rubricWeight;
    const hasRubricWeight = typeof rawRubricWeight === 'number';
    const validRubricWeight = hasRubricWeight && Number.isFinite(rawRubricWeight) && rawRubricWeight > 0;
    if (hasRubricWeight && !validRubricWeight) mappingIssues.add(`invalid-rubric-weight:${fact.id}`);
    const contributions: Partial<Record<PortraitV2DimensionId, number>> = {};
    const source = isRecord(fact.competencyContribution) ? fact.competencyContribution : {};
    for (const [legacyDimension, rawValue] of Object.entries(source)) {
      const normalizedRubricPerformance = hasRubricWeight;
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue) || (rawValue === 0 && !normalizedRubricPerformance)) continue;
      const mapping = mapLegacyCompetencyDimensionToPortraitV2(legacyDimension);
      if (mapping.targetDimensions.length === 0) {
        mappingIssues.add(`unknown-portrait-dimension:${legacyDimension}`);
        continue;
      }
      for (const target of mapping.targetDimensions) {
        contributions[target] = clamp((contributions[target] ?? 0) + rawValue * profileWeight, -1, 1);
      }
    }
    return {
      id: fact.id,
      occurredAt: fact.startedAt.toISOString(),
      sourceFamily: 'LearningFact' as const,
      outcome: profileWeight <= 0 ? 'context-only' as const : classifyOutcome(fact.outcome),
      contributions,
      rubricWeight: hasRubricWeight ? (validRubricWeight ? rawRubricWeight : 1) : undefined,
      normalizedPerformance: hasRubricWeight,
    };
  });
  return { evidence, mappingIssues: [...mappingIssues] };
}

export function orderAndDedupePortraitV2Evidence(
  evidence: PortraitV2IncrementalEvidence[],
): PortraitV2IncrementalEvidence[] {
  return [...new Map(
    [...evidence]
      .sort((a, b) => compareOccurredAtAndId(a.occurredAt, a.id, b.occurredAt, b.id))
      .map((item) => [item.id, item]),
  ).values()];
}

function applyEvidence(
  previous: PortraitV2DimensionState,
  evidence: PortraitV2IncrementalEvidence[],
  id: PortraitV2DimensionId,
  generatedAt: string,
): PortraitV2DimensionState {
  const ordered = orderAndDedupePortraitV2Evidence(evidence);
  const signals = ordered.map((item) => signedSignal(item, item.contributions[id] ?? 0));
  const observationScores = signals.map((signal, index) => ordered[index].normalizedPerformance
    ? clamp(signal * 100, 0, 100)
    : clamp(50 + signal * 50, 0, 100));
  const weights = ordered.map((item) => safeRubricWeight(item.rubricWeight));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const averageSignal = signals.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
  const hadEvidence = previous.evidenceSummary.totalCount > 0;
  const observation = observationScores.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
  const boundedDelta = clamp(observation - previous.score, -MAX_SCORE_DELTA_PER_UPDATE, MAX_SCORE_DELTA_PER_UPDATE);
  const score = round(hadEvidence ? previous.score + boundedDelta : observation);
  const confidence = round(clamp(
    (hadEvidence ? previous.confidence : 0.15) + Math.min(0.32, evidence.length * CONFIDENCE_GAIN_PER_EVIDENCE),
    0,
    1,
  ));
  const latest = ordered[ordered.length - 1].occurredAt;
  const positive = ordered.filter((item) => item.outcome === 'positive' || item.outcome === 'partial');
  const negative = ordered.filter((item) => item.outcome === 'negative');
  const totalCount = previous.evidenceSummary.totalCount + evidence.length;
  const negativeApplied = averageSignal < 0;
  return {
    ...previous,
    score,
    confidence,
    trend: score > previous.score ? 'up' : score < previous.score ? 'down' : 'stable',
    freshness: freshness(latest, generatedAt),
    evidenceSummary: {
      totalCount,
      sourceFamilyCounts: {
        ...previous.evidenceSummary.sourceFamilyCounts,
        LearningFact: (previous.evidenceSummary.sourceFamilyCounts.LearningFact ?? 0) + evidence.length,
      },
    },
    lastPositiveEvidenceAt: latestOf(previous.lastPositiveEvidenceAt, ...positive.map((item) => item.occurredAt)),
    lastNegativeEvidenceAt: latestOf(previous.lastNegativeEvidenceAt, ...negative.map((item) => item.occurredAt)),
    rationale: negativeApplied ? NEGATIVE_RATIONALE : 'Governed evidence supports the current score.',
    limitations: negativeApplied ? [NEGATIVE_LIMITATION] : [],
    sourceLineage: mergeLearningFactLineage(previous.sourceLineage, evidence.map((item) => item.id)),
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
  };
}

function preserveDimension(
  previous: PortraitV2DimensionState,
  generatedAt: string,
): PortraitV2DimensionState {
  return {
    ...previous,
    freshness: previous.freshness.asOf === null
      ? { ...previous.freshness }
      : freshness(previous.freshness.asOf, generatedAt),
    evidenceSummary: {
      totalCount: previous.evidenceSummary.totalCount,
      sourceFamilyCounts: { ...previous.evidenceSummary.sourceFamilyCounts },
    },
    sourceLineage: previous.sourceLineage.map((ref) => ({ ...ref })),
  };
}

function compareOccurredAtAndId(
  leftOccurredAt: string,
  leftId: string,
  rightOccurredAt: string,
  rightId: string,
): number {
  const occurredAtDifference = Date.parse(leftOccurredAt) - Date.parse(rightOccurredAt);
  return occurredAtDifference !== 0 ? occurredAtDifference : leftId.localeCompare(rightId);
}

function missingDimension(id: PortraitV2DimensionId): PortraitV2DimensionState {
  return {
    id,
    label: '',
    score: 0,
    confidence: 0,
    trend: 'stable',
    freshness: { state: 'missing', asOf: null, evidenceAgeDays: null },
    evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
    lastPositiveEvidenceAt: null,
    lastNegativeEvidenceAt: null,
    rationale: 'No safe legacy mapping exists.',
    limitations: ['missing-native-portrait-v2-evidence'],
    sourceLineage: [],
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
  };
}

function signedSignal(evidence: PortraitV2IncrementalEvidence, contribution: number): number {
  const magnitude = Math.abs(clamp(contribution, -1, 1));
  if (evidence.normalizedPerformance) return clamp(contribution, 0, 1);
  if (evidence.outcome === 'negative') return -magnitude;
  if (evidence.outcome === 'partial') return contribution * 0.45;
  return contribution;
}

function safeRubricWeight(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
}

function classifyOutcome(outcome: string): PortraitV2IncrementalEvidence['outcome'] {
  if (outcome === 'failure' || outcome === 'abandoned' || outcome === 'unsafe' || outcome === 'misconception') return 'negative';
  if (outcome === 'partial') return 'partial';
  return 'positive';
}

function freshness(asOf: string, generatedAt: string): PortraitV2DimensionState['freshness'] {
  const evidenceAgeDays = Math.max(0, Math.floor((Date.parse(generatedAt) - Date.parse(asOf)) / DAY_MS));
  return {
    asOf,
    evidenceAgeDays,
    state: 'current',
  };
}

function latestOf(...values: Array<string | null>): string | null {
  const present = values.filter((value): value is string => value !== null);
  return present.length === 0 ? null : present.reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest);
}

function mergeLearningFactLineage(
  previous: PortraitV2DimensionState['sourceLineage'],
  evidenceIds: string[],
): PortraitV2DimensionState['sourceLineage'] {
  const previousFactRefs = previous.filter((ref) =>
    ref.kind === 'raw-source' && ref.ref.startsWith('raw-source:LearningFact:sha256:'),
  );
  const withoutOldFactRefs = previous.filter((ref) =>
    !(ref.kind === 'raw-source' && ref.ref.startsWith('raw-source:LearningFact:sha256:')),
  );
  const withFamily = withoutOldFactRefs.some((ref) => ref.kind === 'evidence-family' && ref.ref === 'LearningFact')
    ? withoutOldFactRefs.map((ref) => ({ ...ref }))
    : [...withoutOldFactRefs.map((ref) => ({ ...ref })), {
        kind: 'evidence-family' as const,
        ref: 'LearningFact',
        privacyScope: 'student-visible' as const,
      }];
  const rollingFactRefs = [...previousFactRefs, ...evidenceIds
    .map(evidenceRef)
    .map((ref) => ({ kind: 'raw-source' as const, ref, privacyScope: 'system-internal' as const }))]
    .filter((ref, index, all) => all.findIndex((candidate) => candidate.ref === ref.ref) === index)
    .slice(-MAX_FACT_LINEAGE_REFS);
  return [...withFamily, ...rollingFactRefs];
}

function evidenceRef(id: string): string {
  return `raw-source:LearningFact:sha256:${createHash('sha256').update(id).digest('hex')}`;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const PORTRAIT_V2_INCREMENTAL_NEGATIVE_RATIONALE = NEGATIVE_RATIONALE;
export const PORTRAIT_V2_INCREMENTAL_NEGATIVE_LIMITATION = NEGATIVE_LIMITATION;
