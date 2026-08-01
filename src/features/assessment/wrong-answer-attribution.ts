import {
  evaluateAssessmentEvidenceSnapshotAuthority,
  type AssessmentEvidenceCatalogSnapshot,
} from '@/features/adaptive-assessment/assessment-evidence-authority';
import type { AdaptiveAssessmentCatalogStage } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import { adaptiveAssessmentItemContentHash } from './adaptive-assessment-item-content-hash';

export const WRONG_ANSWER_ATTRIBUTION_VERSION = 'wrong-answer-attribution.v1';

export type WrongAnswerAttributionState = 'ATTRIBUTED' | 'UNCERTAIN';
export type WrongAnswerAttributionNextAction = 'NONE' | 'MANUAL_REVIEW' | 'REPEAT_PRACTICE';

interface WrongAnswerRow {
  id: string;
  userId: string;
  sessionId: string;
  questionRefId: string;
  questionId: string;
  selectedOptionKey: string;
  correctOptionKey: string;
  isCorrect: boolean;
  answeredAt: Date;
  session: {
    id: string;
    userId: string;
  };
  questionRef: {
    id: string;
    questionId: string;
    contentHash: string;
    source: string;
    questionType: string;
    domains: string[];
    knowledgeTags: string[];
    difficulty: number;
    optionCount: number;
    metadata: unknown;
  };
}

interface PersistedWrongAnswerAttribution {
  id: string;
  answerId: string;
  attributionVersion: string;
  sessionId: string;
  questionRefId: string;
  itemContentHash: string;
  state: string;
  knowledgeNodeIds: string[];
  misconceptionTags: string[];
  evidenceSummary: unknown;
  evidenceRefs: string[];
  confidence: number;
  limitations: string[];
  nextAction: string;
  createdAt: Date;
}

export interface WrongAnswerAttributionDb {
  adaptiveAssessmentAnswer: {
    findFirst(input: any): Promise<WrongAnswerRow | null>;
  };
  wrongAnswerAttribution: {
    upsert(input: any): Promise<PersistedWrongAnswerAttribution>;
  };
}

export interface WrongAnswerAttributionProjection {
  id: string;
  answerId: string;
  state: WrongAnswerAttributionState;
  attribution: {
    knowledgeNodeId: string;
    misconceptionTag: string;
  } | null;
  candidates: {
    knowledgeNodeIds: string[];
    misconceptionTags: string[];
  };
  evidenceSummary: {
    version: 'wrong-answer-evidence-summary.v1';
    outcome: 'incorrect';
    answeredAt: string;
    knowledgeNodeCount: number;
    misconceptionCandidateCount: number;
  };
  evidenceRefs: string[];
  confidence: number;
  attributionVersion: string;
  limitations: string[];
  nextAction: WrongAnswerAttributionNextAction;
  createdAt: string;
}

interface GovernedEvidence {
  answer: WrongAnswerRow;
  itemContentHash: string;
  knowledgeNodeIds: string[];
  misconceptionTags: string[];
}

const ATTRIBUTION_ALLOWED_STAGES = new Set<AdaptiveAssessmentCatalogStage>([
  'low-stakes-practice',
  'readiness',
  'checkpoint',
  'remediation',
  'terminal-validation',
]);

function attributionStage(value: string | null): AdaptiveAssessmentCatalogStage | null {
  const normalized = value === 'practice'
    ? 'low-stakes-practice'
    : value === 'precheck' || value === 'readiness-gate'
      ? 'readiness'
      : value;
  return normalized && ATTRIBUTION_ALLOWED_STAGES.has(normalized as AdaptiveAssessmentCatalogStage)
    ? normalized as AdaptiveAssessmentCatalogStage
    : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isoDateString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const values = value.map(nonEmptyString);
  return values.some((item) => item === null) ? null : values as string[];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sameStrings(left: string[], right: string[]): boolean {
  const normalizedLeft = uniqueSorted(left);
  const normalizedRight = uniqueSorted(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function isSubset(values: string[], reviewedValues: string[]): boolean {
  const reviewed = new Set(reviewedValues);
  return values.every((value) => reviewed.has(value));
}

function parseGovernedEvidence(
  answer: WrongAnswerRow,
  authenticatedUserId: string,
): GovernedEvidence | null {
  if (
    answer.userId !== authenticatedUserId ||
    answer.isCorrect ||
    answer.session.id !== answer.sessionId ||
    answer.session.userId !== authenticatedUserId ||
    answer.questionRef.id !== answer.questionRefId ||
    answer.questionRef.questionId !== answer.questionId
  ) {
    return null;
  }

  const metadata = record(answer.questionRef.metadata);
  const kaqMetadata = record(metadata?.kaq);
  const questionSnapshot = record(metadata?.questionSnapshot);
  const itemSnapshot = record(metadata?.adaptiveAssessmentItemRef);
  const semanticRefs = record(itemSnapshot?.semanticRefs);
  const relationship = record(itemSnapshot?.relationship);
  const catalogContentHash = nonEmptyString(itemSnapshot?.contentHash);
  const itemContentHash = nonEmptyString(answer.questionRef.contentHash);
  const source = nonEmptyString(answer.questionRef.source);
  const questionType = nonEmptyString(answer.questionRef.questionType);
  const domains = stringArray(answer.questionRef.domains);
  const knowledgeTags = stringArray(answer.questionRef.knowledgeTags);
  const kaqImmutableContentHash = nonEmptyString(kaqMetadata?.immutableContentHash);
  const snapshotCorrectOptionKey = nonEmptyString(questionSnapshot?.correctOptionKey);
  const snapshotMisconceptionTags = stringArray(questionSnapshot?.misconceptionTags);
  const graphNodeIds = stringArray(semanticRefs?.graphNodeIds);
  const misconceptionTags = stringArray(semanticRefs?.misconceptionTags);
  const reviewDecision = record(itemSnapshot?.reviewDecision);
  const reviewedGraphNodeIds = stringArray(reviewDecision?.selectedGraphNodeIds);
  const reviewedMisconceptionTags = stringArray(reviewDecision?.misconceptionRefs);
  const normalizedStage = attributionStage(nonEmptyString(reviewDecision?.selectedStagePurpose));
  const authority = evaluateAssessmentEvidenceSnapshotAuthority(
    itemSnapshot as unknown as AssessmentEvidenceCatalogSnapshot,
    { requestedStage: normalizedStage },
  );
  if (
    questionSnapshot?.version !== 'adaptive-question-snapshot.v1' ||
    itemSnapshot?.catalogBacked !== true ||
    itemSnapshot?.reviewState !== 'path-eligible' ||
    itemSnapshot?.eligibilityState !== 'path-eligible' ||
    !nonEmptyString(itemSnapshot?.catalogItemId) ||
    !nonEmptyString(itemSnapshot?.snapshotVersion) ||
    relationship?.immutable !== true ||
    relationship?.catalogUpdatesRewriteHistoricalAnswers !== false ||
    !catalogContentHash ||
    !/^[a-f0-9]{64}$/.test(catalogContentHash) ||
    !itemContentHash ||
    !/^[a-f0-9]{64}$/.test(itemContentHash) ||
    !source ||
    !questionType ||
    !domains ||
    !knowledgeTags ||
    !Number.isFinite(answer.questionRef.difficulty) ||
    !Number.isInteger(answer.questionRef.optionCount) ||
    answer.questionRef.optionCount < 0 ||
    !kaqImmutableContentHash ||
    !snapshotCorrectOptionKey ||
    snapshotCorrectOptionKey !== answer.correctOptionKey ||
    !snapshotMisconceptionTags ||
    !graphNodeIds ||
    !misconceptionTags ||
    !reviewedGraphNodeIds ||
    !reviewedMisconceptionTags ||
    !isSubset(graphNodeIds, reviewedGraphNodeIds) ||
    !isSubset(misconceptionTags, reviewedMisconceptionTags) ||
    !normalizedStage ||
    !authority.mastery ||
    !sameStrings(snapshotMisconceptionTags, misconceptionTags) ||
    !Array.isArray(questionSnapshot.options)
  ) {
    return null;
  }

  const recomputedItemContentHash = adaptiveAssessmentItemContentHash({
    source,
    questionType,
    domains,
    knowledgeTags,
    difficulty: answer.questionRef.difficulty,
    optionCount: answer.questionRef.optionCount,
    kaqImmutableContentHash,
    adaptiveAssessmentItemRef: itemSnapshot,
    questionSnapshot,
  });
  if (recomputedItemContentHash !== itemContentHash) return null;

  const optionKeys = questionSnapshot.options.map((value) => nonEmptyString(record(value)?.key));
  if (
    optionKeys.some((key) => key === null) ||
    !optionKeys.includes(answer.selectedOptionKey) ||
    !optionKeys.includes(answer.correctOptionKey)
  ) {
    return null;
  }

  return {
    answer,
    itemContentHash,
    knowledgeNodeIds: uniqueSorted(graphNodeIds),
    misconceptionTags: uniqueSorted(misconceptionTags),
  };
}

function classifyEvidence(evidence: GovernedEvidence): {
  state: WrongAnswerAttributionState;
  confidence: number;
  limitations: string[];
  nextAction: WrongAnswerAttributionNextAction;
} {
  if (evidence.knowledgeNodeIds.length === 0 || evidence.misconceptionTags.length === 0) {
    return {
      state: 'UNCERTAIN',
      confidence: 0,
      limitations: ['missing-reviewed-semantic-binding'],
      nextAction: 'REPEAT_PRACTICE',
    };
  }
  if (evidence.knowledgeNodeIds.length !== 1 || evidence.misconceptionTags.length !== 1) {
    return {
      state: 'UNCERTAIN',
      confidence: 0.5,
      limitations: ['multiple-reviewed-attribution-candidates'],
      nextAction: 'MANUAL_REVIEW',
    };
  }
  return {
    state: 'ATTRIBUTED',
    confidence: 1,
    limitations: [],
    nextAction: 'NONE',
  };
}

function projectAttribution(row: PersistedWrongAnswerAttribution): WrongAnswerAttributionProjection {
  const state = row.state === 'ATTRIBUTED' ? 'ATTRIBUTED' : 'UNCERTAIN';
  const knowledgeNodeIds = [...row.knowledgeNodeIds];
  const misconceptionTags = [...row.misconceptionTags];
  const storedSummary = record(row.evidenceSummary);
  const answeredAt = isoDateString(storedSummary?.answeredAt) ?? row.createdAt.toISOString();
  const knowledgeNodeCount = typeof storedSummary?.knowledgeNodeCount === 'number' &&
    Number.isInteger(storedSummary.knowledgeNodeCount) &&
    storedSummary.knowledgeNodeCount >= 0
    ? storedSummary.knowledgeNodeCount
    : knowledgeNodeIds.length;
  const misconceptionCandidateCount = typeof storedSummary?.misconceptionCandidateCount === 'number' &&
    Number.isInteger(storedSummary.misconceptionCandidateCount) &&
    storedSummary.misconceptionCandidateCount >= 0
    ? storedSummary.misconceptionCandidateCount
    : misconceptionTags.length;
  return {
    id: row.id,
    answerId: row.answerId,
    state,
    attribution: state === 'ATTRIBUTED' && knowledgeNodeIds.length === 1 && misconceptionTags.length === 1
      ? {
        knowledgeNodeId: knowledgeNodeIds[0],
        misconceptionTag: misconceptionTags[0],
      }
      : null,
    candidates: {
      knowledgeNodeIds,
      misconceptionTags,
    },
    evidenceSummary: {
      version: 'wrong-answer-evidence-summary.v1',
      outcome: 'incorrect',
      answeredAt,
      knowledgeNodeCount,
      misconceptionCandidateCount,
    },
    evidenceRefs: [
      `adaptive-assessment-answer:${row.answerId}`,
      `adaptive-assessment-session:${row.sessionId}`,
      `adaptive-assessment-item:${row.questionRefId}:${row.itemContentHash}`,
      ...knowledgeNodeIds.map((nodeId) => `knowledge-graph-node:${nodeId}`),
    ],
    confidence: row.confidence,
    attributionVersion: WRONG_ANSWER_ATTRIBUTION_VERSION,
    limitations: [...row.limitations],
    nextAction: row.nextAction as WrongAnswerAttributionNextAction,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function attributeWrongAnswerEvidence(input: {
  db: WrongAnswerAttributionDb;
  authenticatedUserId: string;
  answerId: string;
}): Promise<WrongAnswerAttributionProjection | null> {
  const answer = await input.db.adaptiveAssessmentAnswer.findFirst({
    where: {
      id: input.answerId,
      userId: input.authenticatedUserId,
    },
    include: {
      session: {
        select: { id: true, userId: true },
      },
      questionRef: {
        select: {
          id: true,
          questionId: true,
          contentHash: true,
          source: true,
          questionType: true,
          domains: true,
          knowledgeTags: true,
          difficulty: true,
          optionCount: true,
          metadata: true,
        },
      },
    },
  });
  if (!answer) return null;

  const evidence = parseGovernedEvidence(answer, input.authenticatedUserId);
  if (!evidence) return null;

  const classification = classifyEvidence(evidence);
  const evidenceSummary = {
    version: 'wrong-answer-evidence-summary.v1' as const,
    outcome: 'incorrect' as const,
    answeredAt: answer.answeredAt.toISOString(),
    knowledgeNodeCount: evidence.knowledgeNodeIds.length,
    misconceptionCandidateCount: evidence.misconceptionTags.length,
  };
  const evidenceRefs = [
    `adaptive-assessment-answer:${answer.id}`,
    `adaptive-assessment-session:${answer.sessionId}`,
    `adaptive-assessment-item:${answer.questionRefId}:${evidence.itemContentHash}`,
    ...evidence.knowledgeNodeIds.map((nodeId) => `knowledge-graph-node:${nodeId}`),
  ];

  const persisted = await input.db.wrongAnswerAttribution.upsert({
    where: {
      answerId_attributionVersion: {
        answerId: answer.id,
        attributionVersion: WRONG_ANSWER_ATTRIBUTION_VERSION,
      },
    },
    update: {},
    create: {
      answerId: answer.id,
      attributionVersion: WRONG_ANSWER_ATTRIBUTION_VERSION,
      userId: answer.userId,
      sessionId: answer.sessionId,
      questionRefId: answer.questionRefId,
      questionId: answer.questionId,
      itemContentHash: evidence.itemContentHash,
      state: classification.state,
      knowledgeNodeIds: evidence.knowledgeNodeIds,
      misconceptionTags: evidence.misconceptionTags,
      evidenceSummary,
      evidenceRefs,
      confidence: classification.confidence,
      limitations: classification.limitations,
      nextAction: classification.nextAction,
    },
  });

  return projectAttribution(persisted);
}
