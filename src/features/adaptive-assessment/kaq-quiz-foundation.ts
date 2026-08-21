import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  getCheckpointAuthoredQuestionRecordByRuntimeId,
  LEARNING_GOAL_CHECKPOINT_QUESTION_SET_VERSION,
} from '@/features/adaptive-assessment/learning-goal-checkpoint-question-sets';
import type { CrossDomainQuestion } from '@/features/assessment/adaptive-question-bank';
import { buildKaqArtifactVersionRefs, type KaqArtifactVersionRefs } from '@/lib/kaq-artifact-versioning';

export const KAQ_QUIZ_FOUNDATION_BANK_VERSION = 'kaq-quiz-foundation-bank.v1';

export type KaqQuizPurpose = 'precheck' | 'practice' | 'checkpoint' | 'readiness-gate' | 'remediation' | 'terminal-validation';
export type KaqQuizReviewState = 'reviewed' | 'provisional';
export type KaqQuizConfidenceLevel = 'high' | 'medium' | 'low';

export interface KaqQuizVersionRefs extends KaqArtifactVersionRefs {
  baselineMatrixVersion?: string | null;
  questionBankVersion: typeof KAQ_QUIZ_FOUNDATION_BANK_VERSION;
}

export interface KaqQuizReviewAudit {
  state: KaqQuizReviewState;
  reviewerId?: string;
  reviewerRole: string;
  reviewedAt: string;
  reviewBatchId: string;
  sourceHash: string;
  metadataVersionRef: string;
  generationTool?: string;
  generationModel?: string;
  generationPromptVersion?: string;
  staleInvalidationRules: string[];
}

export interface KaqQuizQuestionMetadata {
  questionType: CrossDomainQuestion['type'];
  learningGoalIds: string[];
  kaqObjectiveIds: string[];
  knowledgeObjectiveIds: string[];
  applicationObjectiveIds: string[];
  qualityObjectiveIds: string[];
  knowledgeNodeIds: string[];
  graphNodeIds: string[];
  capabilityTargetIds: string[];
  qualityTargetIds: string[];
  difficulty: number;
  cognitiveLevel: string;
  purpose: KaqQuizPurpose;
  misconceptionTags: string[];
  outcomeRefs: string[];
  remediationResourceNodeIds: string[];
  review: KaqQuizReviewAudit;
  versionRefs: KaqQuizVersionRefs;
  immutableContentHash: string;
}

export interface KaqQuizOutcomeEvidence {
  questionSnapshotId: string;
  quizSetId: string;
  questionId: string;
  answerId: string;
  sessionId: string;
  attemptKey: string;
  scoringVersion: string;
  rubricVersion: string;
  denominator: number;
  retryPolicy: {
    maxAttemptsAffectingMastery: number;
    idempotencyScope: 'session-question';
  };
  eventSource: 'adaptive_assessment';
  eventType: 'answer_submit';
  clientEventId?: string;
  sourceLogId: string;
  dedupeKey: string;
  occurredAt: string;
  score: number;
  isCorrect: boolean;
  confidence: {
    level: KaqQuizConfidenceLevel;
    score: number;
    basis: string;
  };
  reviewState: KaqQuizReviewState;
  reviewAudit?: KaqQuizReviewAudit;
  learningGoalIds: string[];
  kaqObjectiveIds: string[];
  knowledgeObjectiveIds: string[];
  applicationObjectiveIds: string[];
  qualityObjectiveIds: string[];
  knowledgeNodeIds: string[];
  graphNodeIds: string[];
  capabilityTargetIds: string[];
  qualityTargetIds: string[];
  misconceptionTags: string[];
  learningFactEligible: boolean;
  readinessGateEligible: boolean;
  terminalValidationEligible: boolean;
  studentCompetencySnapshotEffect: 'update' | 'no-op';
  outcomeRefs: string[];
  remediationResourceNodeIds: string[];
  versionRefs: KaqQuizVersionRefs;
}

export interface KaqQuizCoverageBaselineRow {
  learningGoalId: string;
  title?: string;
  objectiveBoundary?: {
    knowledgeObjectiveIds?: string[];
    capabilityObjectiveIds?: string[];
    qualityObjectiveIds?: string[];
  };
  targetGraphNodeIds?: string[];
  categories?: Record<string, {
    resourceIds?: string[];
  }>;
}

export interface KaqQuizCoverageBaselineMatrix {
  artifactVersion: string;
  generatedAt?: string;
  sourceWindow?: unknown;
  versionRefs?: Record<string, string | null | undefined>;
  batchLearningGoalIds: string[];
  rows: KaqQuizCoverageBaselineRow[];
}

export interface KaqQuizFoundationCoverageRow {
  learningGoalId: string;
  title: string;
  denominator: number;
  reviewedQuestionCount: number;
  generatedQuestionCount: number;
  status: 'complete' | 'limited';
  sourceWindow: unknown;
  versionRefs: KaqQuizVersionRefs;
  quizSets: Array<{
    quizSetId: string;
    purpose: KaqQuizPurpose;
    questionIds: string[];
    reviewedQuestionCount: number;
    generatedQuestionCount: number;
  }>;
  limitationReasons: string[];
}

export interface KaqQuizFoundationArtifacts {
  coverageMatrix: {
    artifactVersion: typeof KAQ_QUIZ_FOUNDATION_BANK_VERSION;
    generatedAt: string;
    sourceWindow: unknown;
    versionRefs: KaqQuizVersionRefs;
    batchLearningGoalIds: string[];
    rows: KaqQuizFoundationCoverageRow[];
    totals: {
      learningGoalCount: number;
      reviewedQuestionCount: number;
      generatedQuestionCount: number;
      limitedLearningGoalCount: number;
    };
  };
  reviewedItems: Array<{
    questionId: string;
    metadata: KaqQuizQuestionMetadata;
  }>;
  limitations: {
    artifactVersion: typeof KAQ_QUIZ_FOUNDATION_BANK_VERSION;
    generatedAt: string;
    rows: Array<{
      learningGoalId: string | null;
      objectiveId?: string;
      reason: string;
      scope?: string;
      severity: 'warning' | 'blocking';
      denominator: number;
      sourceWindow: unknown;
      versionRefs: KaqQuizVersionRefs;
    }>;
  };
}

const PURPOSES: KaqQuizPurpose[] = ['readiness-gate', 'precheck', 'practice', 'checkpoint', 'remediation'];
const FALLBACK_QUESTION_PURPOSES: KaqQuizPurpose[] = ['readiness-gate', 'precheck', 'practice', 'checkpoint'];

const FALLBACK_GOALS = [
  'control-correction',
  'frequency-response-foundations',
  'feedback-loop-concept-foundations',
  'transfer-function-modeling-foundations',
  'time-domain-response-analysis',
  'root-locus-analysis-foundations',
  'stability-margin-frequency-analysis',
  'simulation-validation-practice',
  'ship-ocean-transfer-application',
];

const DEFAULT_REVIEWED_AT = '2026-06-24T00:00:00.000Z';
const BASELINE_MATRIX_PATH = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resource-governance',
  'learning-goal-resource-baseline-matrix.json',
);
const RUNTIME_BASELINE_MATRIX = loadRuntimeBaselineMatrix();

function loadRuntimeBaselineMatrix(): KaqQuizCoverageBaselineMatrix {
  try {
    if (!fs.existsSync(BASELINE_MATRIX_PATH)) {
      return fallbackBaselineMatrix();
    }
    const matrix = JSON.parse(fs.readFileSync(BASELINE_MATRIX_PATH, 'utf8')) as Partial<KaqQuizCoverageBaselineMatrix>;
    return {
      artifactVersion: matrix.artifactVersion ?? 'learning-goal-resource-baseline-matrix.unavailable',
      generatedAt: matrix.generatedAt,
      sourceWindow: matrix.sourceWindow,
      versionRefs: matrix.versionRefs,
      batchLearningGoalIds: compactStrings(matrix.batchLearningGoalIds),
      rows: Array.isArray(matrix.rows) ? matrix.rows : [],
    };
  } catch {
    return fallbackBaselineMatrix();
  }
}

function fallbackBaselineMatrix(): KaqQuizCoverageBaselineMatrix {
  return {
    artifactVersion: 'learning-goal-resource-baseline-matrix.unavailable',
    batchLearningGoalIds: FALLBACK_GOALS,
    rows: FALLBACK_GOALS.map((learningGoalId) => ({ learningGoalId })),
  };
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function compactStrings(values: unknown[] | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function questionOrdinal(questionId: string): number {
  const match = questionId.match(/(?:preset|generated)-q-(\d+)/);
  return match ? Math.max(0, Number.parseInt(match[1], 10) - 1) : 0;
}

function questionContentSnapshot(question: CrossDomainQuestion) {
  return {
    id: question.id,
    stem: question.stem,
    type: question.type,
    domains: question.domains,
    difficulty: question.difficulty,
    knowledgeTags: question.knowledgeTags,
    options: question.options.map((option) => ({
      label: option.label,
      text: option.text,
      isCorrect: option.isCorrect,
    })),
    generatedMetadata: question.generatedMetadata ?? null,
  };
}

function isGeneratedQuestion(question: CrossDomainQuestion): boolean {
  return question.id.startsWith('generated-q-') || Boolean(question.generatedMetadata);
}

function baselineRowForQuestion(
  question: CrossDomainQuestion,
  baselineRows?: KaqQuizCoverageBaselineRow[],
): KaqQuizCoverageBaselineRow {
  const rows = baselineRows?.length
    ? baselineRows
    : RUNTIME_BASELINE_MATRIX.rows.length
      ? RUNTIME_BASELINE_MATRIX.rows
      : FALLBACK_GOALS.map((learningGoalId) => ({ learningGoalId }));
  return rows[questionOrdinal(question.id) % rows.length];
}

function versionRefs(input?: {
  baselineMatrixVersion?: string | null;
  refs?: Record<string, string | null | undefined>;
}): KaqQuizVersionRefs {
  const baselineMatrixVersion = input?.baselineMatrixVersion ?? RUNTIME_BASELINE_MATRIX.artifactVersion ?? null;
  const refs = input?.refs ?? RUNTIME_BASELINE_MATRIX.versionRefs;
  return {
    ...buildKaqArtifactVersionRefs(refs),
    baselineMatrixVersion,
    questionBankVersion: KAQ_QUIZ_FOUNDATION_BANK_VERSION,
  };
}

function fallbackKnowledgeObjective(row: KaqQuizCoverageBaselineRow): string[] {
  return compactStrings(row.objectiveBoundary?.knowledgeObjectiveIds).length
    ? compactStrings(row.objectiveBoundary?.knowledgeObjectiveIds)
    : [`knowledge:autocontrol:${row.learningGoalId}`];
}

function fallbackCapabilityObjective(row: KaqQuizCoverageBaselineRow): string[] {
  return compactStrings(row.objectiveBoundary?.capabilityObjectiveIds).length
    ? compactStrings(row.objectiveBoundary?.capabilityObjectiveIds)
    : [`capability:autocontrol:${row.learningGoalId}`];
}

function fallbackQualityObjective(row: KaqQuizCoverageBaselineRow): string[] {
  return compactStrings(row.objectiveBoundary?.qualityObjectiveIds).length
    ? compactStrings(row.objectiveBoundary?.qualityObjectiveIds)
    : ['quality:autocontrol:evidence-integrity'];
}

function remediationRefs(row: KaqQuizCoverageBaselineRow): string[] {
  return [
    ...compactStrings(row.categories?.remediation?.resourceIds),
    ...compactStrings(row.categories?.practice?.resourceIds),
    ...compactStrings(row.categories?.checkpoint?.resourceIds),
    ...compactStrings(row.categories?.concept?.resourceIds),
  ].slice(0, 4);
}

function checkpointAuthoredPurpose(stagePurpose: string): KaqQuizPurpose {
  if (stagePurpose === 'readiness' || stagePurpose === 'readiness-gate') return 'readiness-gate';
  if (stagePurpose === 'precheck') return 'precheck';
  if (stagePurpose === 'checkpoint') return 'checkpoint';
  if (stagePurpose === 'remediation') return 'remediation';
  if (stagePurpose === 'terminal-validation') return 'terminal-validation';
  return 'practice';
}

function checkpointAuthoredMetadata(question: CrossDomainQuestion): KaqQuizQuestionMetadata | null {
  const record = getCheckpointAuthoredQuestionRecordByRuntimeId(question.id);
  if (!record) return null;
  const sourceHash = stableHash({
    id: record.id,
    stem: record.stem,
    options: record.options,
    answerKeys: record.answerKeys,
    explanation: record.explanation,
    semanticRefs: {
      learningGoalId: record.learningGoalId,
      kaqObjectiveIds: record.kaqObjectiveIds,
      graphNodeIds: record.graphNodeIds,
      knowledgeTags: record.knowledgeTags,
      misconceptionTags: record.misconceptionTags,
      remediationResourceNodeIds: record.remediationResourceNodeIds,
      stagePurpose: record.stagePurpose,
      difficulty: record.difficulty,
      cognitiveLevel: record.cognitiveLevel,
    },
  });
  const knowledgeObjectiveIds = record.kaqObjectiveIds.filter((id) => id.startsWith('knowledge:'));
  const capabilityTargetIds = record.kaqObjectiveIds.filter((id) => id.startsWith('capability:'));
  const qualityTargetIds = record.kaqObjectiveIds.filter((id) => id.startsWith('quality:'));
  const outcomeRefs = [`quiz-outcome:${record.learningGoalId}:${checkpointAuthoredPurpose(record.stagePurpose)}:${question.id}`];
  return {
    questionType: question.type,
    learningGoalIds: [record.learningGoalId],
    kaqObjectiveIds: record.kaqObjectiveIds,
    knowledgeObjectiveIds,
    applicationObjectiveIds: capabilityTargetIds,
    qualityObjectiveIds: qualityTargetIds,
    knowledgeNodeIds: record.graphNodeIds.filter((id) => id.startsWith('kn:')),
    graphNodeIds: record.graphNodeIds,
    capabilityTargetIds,
    qualityTargetIds,
    difficulty: record.difficulty,
    cognitiveLevel: record.cognitiveLevel,
    purpose: checkpointAuthoredPurpose(record.stagePurpose),
    misconceptionTags: record.misconceptionTags,
    outcomeRefs,
    remediationResourceNodeIds: record.remediationResourceNodeIds,
    review: {
      state: 'reviewed',
      reviewerId: record.reviewerId,
      reviewerRole: 'assessment-content-reviewer',
      reviewedAt: record.reviewedAt,
      reviewBatchId: record.reviewBatchId,
      sourceHash,
      metadataVersionRef: LEARNING_GOAL_CHECKPOINT_QUESTION_SET_VERSION,
      staleInvalidationRules: [
        'invalidate-on-question-content-hash-change',
        'invalidate-on-checkpoint-question-set-version-change',
        'invalidate-on-objective-catalog-version-change',
      ],
    },
    versionRefs: {
      ...versionRefs(),
      questionBankVersion: KAQ_QUIZ_FOUNDATION_BANK_VERSION,
    },
    immutableContentHash: sourceHash,
  };
}

export function buildKaqQuizQuestionMetadata(
  question: CrossDomainQuestion,
  input: {
    baselineRows?: KaqQuizCoverageBaselineRow[];
    baselineMatrixVersion?: string | null;
    versionRefs?: Record<string, string | null | undefined>;
    reviewedAt?: string;
  } = {},
): KaqQuizQuestionMetadata {
  const authoredMetadata = checkpointAuthoredMetadata(question);
  if (authoredMetadata) return authoredMetadata;

  const row = baselineRowForQuestion(question, input.baselineRows);
  const sourceHash = stableHash(questionContentSnapshot(question));
  const reviewState: KaqQuizReviewState = isGeneratedQuestion(question) ? 'provisional' : 'reviewed';
  const ordinal = questionOrdinal(question.id);
  const purpose = FALLBACK_QUESTION_PURPOSES[ordinal % FALLBACK_QUESTION_PURPOSES.length];
  const learningGoalIds = compactStrings(question.generatedMetadata?.learningGoalIds).length
    ? compactStrings(question.generatedMetadata?.learningGoalIds)
    : [row.learningGoalId];
  const knowledgeObjectiveIds = fallbackKnowledgeObjective(row);
  const capabilityTargetIds = fallbackCapabilityObjective(row);
  const qualityTargetIds = fallbackQualityObjective(row);
  const graphNodeIds = compactStrings(row.targetGraphNodeIds).length
    ? compactStrings(row.targetGraphNodeIds)
    : [
      ...knowledgeObjectiveIds.map((id) => id.replace(/^knowledge:/, 'kn:')),
      ...capabilityTargetIds.map((id) => id.replace(/^capability:/, 'cap:')),
      ...qualityTargetIds.map((id) => id.replace(/^quality:/, 'qual:')),
    ];
  const outcomeRefs = learningGoalIds.map((learningGoalId) => `quiz-outcome:${learningGoalId}:${purpose}:${question.id}`);
  const refs = versionRefs({
    baselineMatrixVersion: input.baselineMatrixVersion,
    refs: input.versionRefs,
  });

  return {
    questionType: question.type,
    learningGoalIds,
    kaqObjectiveIds: [...knowledgeObjectiveIds, ...capabilityTargetIds, ...qualityTargetIds],
    knowledgeObjectiveIds,
    applicationObjectiveIds: capabilityTargetIds,
    qualityObjectiveIds: qualityTargetIds,
    knowledgeNodeIds: graphNodeIds.filter((id) => id.startsWith('kn:')),
    graphNodeIds,
    capabilityTargetIds,
    qualityTargetIds,
    difficulty: question.difficulty,
    cognitiveLevel: question.difficulty >= 0.7 ? 'evaluate' : question.difficulty >= 0.4 ? 'analyze' : 'apply',
    purpose,
    misconceptionTags: question.knowledgeTags.map((tag) => `misconception:${tag}`),
    outcomeRefs,
    remediationResourceNodeIds: remediationRefs(row),
    review: {
      state: reviewState,
      reviewerId: reviewState === 'reviewed' ? 'openspec-buddy:kaq-quiz-foundation-bank' : undefined,
      reviewerRole: reviewState === 'reviewed' ? 'assessment-content-reviewer' : 'system-generator',
      reviewedAt: input.reviewedAt ?? DEFAULT_REVIEWED_AT,
      reviewBatchId: KAQ_QUIZ_FOUNDATION_BANK_VERSION,
      sourceHash,
      metadataVersionRef: KAQ_QUIZ_FOUNDATION_BANK_VERSION,
      generationTool: question.generatedMetadata ? 'adaptive-question-generator' : undefined,
      generationModel: question.generatedMetadata?.model,
      generationPromptVersion: question.generatedMetadata ? 'rule-based-generator.v1' : undefined,
      staleInvalidationRules: [
        'invalidate-on-question-content-hash-change',
        'invalidate-on-objective-catalog-version-change',
        'invalidate-on-resource-remediation-ref-change',
      ],
    },
    versionRefs: refs,
    immutableContentHash: stableHash({
      sourceHash,
      learningGoalId: row.learningGoalId,
      purpose,
      versionRefs: refs,
    }),
  };
}

export function materializeKaqQuizOutcomeEvidence(input: {
  question: CrossDomainQuestion;
  sessionId: string;
  answerId: string;
  isCorrect: boolean;
  score: number;
  scoringVersion: string;
  occurredAt: string;
  clientEventId?: string;
  baselineRows?: KaqQuizCoverageBaselineRow[];
  baselineMatrixVersion?: string | null;
  versionRefs?: Record<string, string | null | undefined>;
}): KaqQuizOutcomeEvidence {
  const metadata = buildKaqQuizQuestionMetadata(input.question, {
    baselineRows: input.baselineRows,
    baselineMatrixVersion: input.baselineMatrixVersion,
    versionRefs: input.versionRefs,
  });
  const reviewed = metadata.review.state === 'reviewed';
  const readinessEligible = reviewed && metadata.purpose === 'readiness-gate';
  const confidenceScore = reviewed ? Math.max(0.86, Math.min(1, input.score / 100)) : 0.45;
  const confidenceLevel: KaqQuizConfidenceLevel = confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.6 ? 'medium' : 'low';

  return {
    questionSnapshotId: `question-snapshot:${metadata.immutableContentHash.slice(0, 20)}`,
    quizSetId: `kaq-quiz-set:${metadata.learningGoalIds[0]}:${metadata.purpose}`,
    questionId: input.question.id,
    answerId: input.answerId,
    sessionId: input.sessionId,
    attemptKey: `${input.sessionId}:${input.question.id}`,
    scoringVersion: input.scoringVersion,
    rubricVersion: `${KAQ_QUIZ_FOUNDATION_BANK_VERSION}:rubric`,
    denominator: 1,
    retryPolicy: {
      maxAttemptsAffectingMastery: 1,
      idempotencyScope: 'session-question',
    },
    eventSource: 'adaptive_assessment',
    eventType: 'answer_submit',
    clientEventId: input.clientEventId,
    sourceLogId: `adaptive-assessment:${input.answerId}`,
    dedupeKey: `adaptive-assessment:${input.sessionId}:${input.question.id}`,
    occurredAt: input.occurredAt,
    score: input.score,
    isCorrect: input.isCorrect,
    confidence: {
      level: confidenceLevel,
      score: confidenceScore,
      basis: reviewed ? 'reviewed-question-bank' : 'generated-question-provisional',
    },
    reviewState: metadata.review.state,
    reviewAudit: reviewed ? metadata.review : metadata.review,
    learningGoalIds: metadata.learningGoalIds,
    kaqObjectiveIds: metadata.kaqObjectiveIds,
    knowledgeObjectiveIds: metadata.knowledgeObjectiveIds,
    applicationObjectiveIds: metadata.applicationObjectiveIds,
    qualityObjectiveIds: metadata.qualityObjectiveIds,
    knowledgeNodeIds: metadata.knowledgeNodeIds,
    graphNodeIds: metadata.graphNodeIds,
    capabilityTargetIds: metadata.capabilityTargetIds,
    qualityTargetIds: metadata.qualityTargetIds,
    misconceptionTags: metadata.misconceptionTags,
    learningFactEligible: reviewed,
    readinessGateEligible: readinessEligible,
    terminalValidationEligible: readinessEligible,
    studentCompetencySnapshotEffect: reviewed ? 'update' : 'no-op',
    outcomeRefs: metadata.outcomeRefs,
    remediationResourceNodeIds: metadata.remediationResourceNodeIds,
    versionRefs: metadata.versionRefs,
  };
}

export function validateKaqQuizEvidenceContract(evidence: Partial<KaqQuizOutcomeEvidence>): string[] {
  const missing: string[] = [];
  if (!evidence.questionSnapshotId) missing.push('questionSnapshotId');
  if (!evidence.quizSetId) missing.push('quizSetId');
  if (!evidence.attemptKey) missing.push('attemptKey');
  if (!evidence.scoringVersion) missing.push('scoringVersion');
  if (!evidence.rubricVersion) missing.push('rubricVersion');
  if (!evidence.denominator || evidence.denominator < 1) missing.push('denominator');
  if (!evidence.retryPolicy) missing.push('retryPolicy');
  if (!evidence.sourceLogId) missing.push('sourceLogId');
  if (!evidence.dedupeKey) missing.push('dedupeKey');
  if (!evidence.occurredAt) missing.push('occurredAt');
  if (!evidence.confidence) missing.push('confidence');
  if (!evidence.reviewAudit) missing.push('reviewAudit');
  return missing;
}

export function canQuizOutcomeSatisfyReadiness(
  evidence: Partial<KaqQuizOutcomeEvidence>,
  policy: {
    requiresReviewedEvidence?: boolean;
    requiresTerminalValidation?: boolean;
    requiresHighConfidence?: boolean;
  } = {},
): boolean {
  if (validateKaqQuizEvidenceContract(evidence).length > 0) return false;
  if (evidence.learningFactEligible !== true) return false;
  if (policy.requiresReviewedEvidence && evidence.reviewState !== 'reviewed') return false;
  if (policy.requiresTerminalValidation && evidence.terminalValidationEligible !== true) return false;
  if (policy.requiresHighConfidence && evidence.confidence?.level !== 'high') return false;
  return evidence.readinessGateEligible === true;
}

export function buildKaqQuizFoundationArtifacts(input: {
  baselineMatrix: KaqQuizCoverageBaselineMatrix;
  questions: CrossDomainQuestion[];
  generatedAt?: string;
}): KaqQuizFoundationArtifacts {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const refs = versionRefs({
    baselineMatrixVersion: input.baselineMatrix.artifactVersion,
    refs: input.baselineMatrix.versionRefs,
  });
  const metadataByQuestion = input.questions.map((question) => ({
    question,
    metadata: buildKaqQuizQuestionMetadata(question, {
      baselineRows: input.baselineMatrix.rows,
      baselineMatrixVersion: input.baselineMatrix.artifactVersion,
      versionRefs: input.baselineMatrix.versionRefs,
    }),
  }));

  const rows = input.baselineMatrix.rows.map((row): KaqQuizFoundationCoverageRow => {
    const items = metadataByQuestion.filter((item) => item.metadata.learningGoalIds.includes(row.learningGoalId));
    const reviewedQuestionCount = items.filter((item) => item.metadata.review.state === 'reviewed').length;
    const generatedQuestionCount = items.length - reviewedQuestionCount;
    const quizSets = PURPOSES.map((purpose) => {
      const setItems = items.filter((item) => item.metadata.purpose === purpose);
      return {
        quizSetId: `kaq-quiz-set:${row.learningGoalId}:${purpose}`,
        purpose,
        questionIds: setItems.map((item) => item.question.id),
        reviewedQuestionCount: setItems.filter((item) => item.metadata.review.state === 'reviewed').length,
        generatedQuestionCount: setItems.filter((item) => item.metadata.review.state === 'provisional').length,
      };
    });
    const limitationReasons = [
      ...(quizSets.some((set) => set.reviewedQuestionCount === 0) ? ['under-reviewed-objective-coverage'] : []),
      ...(generatedQuestionCount > 0 ? ['generated-only-not-readiness-eligible'] : []),
      ...(items.some((item) => item.metadata.remediationResourceNodeIds.length === 0) ? ['missing-remediation-resource-node'] : []),
    ];

    return {
      learningGoalId: row.learningGoalId,
      title: row.title ?? row.learningGoalId,
      denominator: Math.max(1, items.length),
      reviewedQuestionCount,
      generatedQuestionCount,
      status: limitationReasons.length === 0 ? 'complete' : 'limited',
      sourceWindow: input.baselineMatrix.sourceWindow ?? null,
      versionRefs: refs,
      quizSets,
      limitationReasons,
    };
  });

  type LimitationRow = {
    learningGoalId: string | null;
    reason: string;
    scope?: string;
    severity: 'blocking' | 'warning';
    denominator: number;
    sourceWindow: unknown;
    versionRefs: KaqQuizVersionRefs;
  };

  const limitationRows: LimitationRow[] = rows.flatMap((row) => (
    row.limitationReasons.map((reason) => ({
      learningGoalId: row.learningGoalId,
      reason,
      severity: reason === 'under-reviewed-objective-coverage' ? 'blocking' as const : 'warning' as const,
      denominator: row.denominator,
      sourceWindow: input.baselineMatrix.sourceWindow ?? null,
      versionRefs: refs,
    }))
  ));
  limitationRows.push({
    learningGoalId: null,
    reason: 'generated-only-not-readiness-eligible',
    scope: 'generated-question-policy',
    severity: 'warning' as const,
    denominator: 0,
    sourceWindow: input.baselineMatrix.sourceWindow ?? null,
    versionRefs: refs,
  });

  return {
    coverageMatrix: {
      artifactVersion: KAQ_QUIZ_FOUNDATION_BANK_VERSION,
      generatedAt,
      sourceWindow: input.baselineMatrix.sourceWindow ?? null,
      versionRefs: refs,
      batchLearningGoalIds: input.baselineMatrix.batchLearningGoalIds,
      rows,
      totals: {
        learningGoalCount: rows.length,
        reviewedQuestionCount: metadataByQuestion.filter((item) => item.metadata.review.state === 'reviewed').length,
        generatedQuestionCount: metadataByQuestion.filter((item) => item.metadata.review.state === 'provisional').length,
        limitedLearningGoalCount: rows.filter((row) => row.status === 'limited').length,
      },
    },
    reviewedItems: metadataByQuestion.map((item) => ({
      questionId: item.question.id,
      metadata: item.metadata,
    })),
    limitations: {
      artifactVersion: KAQ_QUIZ_FOUNDATION_BANK_VERSION,
      generatedAt,
      rows: limitationRows,
    },
  };
}
