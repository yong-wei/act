import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { buildKaqQuizQuestionMetadata } from '@/features/adaptive-assessment/kaq-quiz-foundation';
import { PRESET_QUESTIONS, type CrossDomainQuestion } from '@/features/assessment/adaptive-question-bank';

export type AdaptiveAssessmentCatalogSourceFamily =
  | 'preset-adaptive-question'
  | 'prisma-question'
  | 'acq-static-question'
  | 'icourse-objective-bank'
  | 'kaq-foundation-reviewed'
  | 'generated-adaptive-question'
  | 'checkpoint-authored-question';

export type AdaptiveAssessmentCatalogReviewState =
  | 'registered'
  | 'imported-unreviewed'
  | 'generated-provisional'
  | 'semantically-reviewed'
  | 'path-eligible'
  | 'deprecated';

export type AdaptiveAssessmentCatalogStage =
  | 'low-stakes-practice'
  | 'readiness'
  | 'checkpoint'
  | 'remediation'
  | 'terminal-validation';

export interface AdaptiveAssessmentCatalogSourceSummary {
  family: AdaptiveAssessmentCatalogSourceFamily;
  role: 'item-source' | 'review-overlay';
  appliesToFamily?: AdaptiveAssessmentCatalogSourceFamily;
  sourceTotal: number | null;
  importedTotal: number;
  blockedTotal: number;
  reviewOverlayTotal?: number;
  limitationReasons: string[];
  versionRefs: Record<string, string>;
}

export interface AdaptiveAssessmentCatalogItem {
  catalogItemId: string;
  sourceFamily: AdaptiveAssessmentCatalogSourceFamily;
  sourceId: string;
  sourceAnchor: string;
  contentHash: string;
  contentHashAlgorithm: 'sha256';
  reviewState: AdaptiveAssessmentCatalogReviewState;
  eligibilityState: AdaptiveAssessmentCatalogReviewState;
  allowedStages: AdaptiveAssessmentCatalogStage[];
  questionRefs: {
    stem: string | null;
    answerKey: string[] | null;
    rubricRef: string | null;
    options?: Array<{
      key: string | null;
      text: string;
      isCorrect: boolean | null;
      explanation: string | null;
    }> | null;
    explanation?: string | null;
    choiceMode?: string | null;
  };
  semanticRefs: {
    learningGoalIds: string[];
    kaqObjectiveIds: string[];
    graphNodeIds: string[];
    knowledgeTags: string[];
    misconceptionTags: string[];
    remediationResourceNodeIds: string[];
    difficulty: number | null;
    cognitiveLevel: string | null;
    assessmentStage: string | null;
  };
  lineage: {
    sourceFamily: AdaptiveAssessmentCatalogSourceFamily;
    sourceId: string;
    sourcePath: string | null;
    sourceHash: string;
  };
  versionRefs: Record<string, string>;
  limitations: string[];
  adaptiveAssessmentItemRef: {
    relationship: 'answer-time-snapshot';
    immutable: true;
    mayReferenceCatalogItemId: boolean;
    mayReferenceContentHash: boolean;
    catalogUpdatesRewriteHistoricalAnswers: false;
  };
}

export interface AdaptiveAssessmentCatalogManifest {
  artifactVersion: 'adaptive-assessment-item-catalog.v1';
  itemCount: number;
  pathEligibleItemCount: number;
  sourceFamilies: AdaptiveAssessmentCatalogSourceSummary[];
  artifacts: {
    manifestPath: string;
    itemsPath: string;
    limitationsPath: string;
  };
  versionRefs: Record<string, string>;
}

export interface AdaptiveAssessmentCatalogLimitation {
  family: AdaptiveAssessmentCatalogSourceFamily;
  sourceId: string | null;
  reason: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AdaptiveAssessmentItemCatalogArtifacts {
  manifest: AdaptiveAssessmentCatalogManifest;
  items: AdaptiveAssessmentCatalogItem[];
  limitations: {
    artifactVersion: 'adaptive-assessment-item-catalog-limitations.v1';
    rows: AdaptiveAssessmentCatalogLimitation[];
  };
}

export interface PrismaQuestionCatalogRow {
  id: string;
  stem: string;
  type: string;
  domains: string[];
  difficulty: number;
  knowledgeTags: string[];
  correctAnswer: string;
  explanation?: string | null;
  source: string;
  validationStatus?: string | null;
  aiMetadata?: unknown;
}

export interface GeneratedQuestionCatalogRow {
  question: CrossDomainQuestion;
}

type AcqStaticQuestionRecord = {
  question_id?: string;
  source_ref?: string;
  chapter?: number;
  section?: string;
  stem_md?: string;
  solution_md?: string;
  rubric?: unknown[];
  knowledge_tags?: string[];
  usage_status?: string;
};

type IcourseObjectiveBankRecord = {
  question_id?: string;
  source_question_id?: number | string;
  question_kind?: string;
  choice_mode?: string;
  stem?: string;
  options?: Array<{
    key?: string;
    text?: string;
    is_correct?: boolean;
  }>;
  correct_answers?: unknown[];
  knowledge_tags?: string[];
  adaptive_metadata?: {
    domains?: string[];
    difficulty_seed?: number;
    review_status?: string;
  };
  source_bundle?: unknown;
};

export type KaqReviewedItemRecord = {
  questionId?: string;
  metadata?: {
    immutableContentHash?: string;
    questionType?: string;
    learningGoalIds?: string[];
    kaqObjectiveIds?: string[];
    graphNodeIds?: string[];
    knowledgeNodeIds?: string[];
    difficulty?: number;
    cognitiveLevel?: string;
    purpose?: string;
    misconceptionTags?: string[];
    remediationResourceNodeIds?: string[];
    review?: {
      state?: string;
      reviewerId?: string;
      reviewerRole?: string;
      reviewedAt?: string;
      reviewBatchId?: string;
      sourceHash?: string;
      metadataVersionRef?: string;
      staleInvalidationRules?: string[];
    };
    versionRefs?: Record<string, string>;
  };
};

type CurrentKaqQuestionMetadata = ReturnType<typeof buildKaqQuizQuestionMetadata>;

export interface AdaptiveAssessmentCatalogInput {
  presetQuestions?: CrossDomainQuestion[];
  prismaQuestions?: PrismaQuestionCatalogRow[];
  prismaQuestionSourceTotal?: number | null;
  acqStaticQuestions?: AcqStaticQuestionRecord[];
  icourseObjectiveBankItems?: IcourseObjectiveBankRecord[];
  icourseObjectiveBankIndexTotal?: number | null;
  kaqReviewedItems?: KaqReviewedItemRecord[];
  generatedQuestions?: GeneratedQuestionCatalogRow[];
  checkpointQuestions?: never[];
}

export interface LoadedAdaptiveAssessmentCatalogSources {
  acqStaticQuestions: AcqStaticQuestionRecord[];
  icourseObjectiveBankItems: IcourseObjectiveBankRecord[];
  icourseObjectiveBankIndexTotal: number;
  kaqReviewedItems: KaqReviewedItemRecord[];
}

const ARTIFACT_VERSION_REFS = {
  catalogVersion: 'adaptive-assessment-item-catalog.v1',
  adaptiveAssessmentSnapshotVersion: 'adaptive-assessment-item-ref.v1',
  kaqFoundationVersion: 'kaq-quiz-foundation-bank.v1',
  acqStaticQuestionBankVersion: 'acq-static-question-bank.v1',
  icourseObjectiveBankVersion: 'icourse-bank-bankType4.v1',
};

const ARTIFACT_PATHS = {
  manifestPath: 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-manifest.json',
  itemsPath: 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl',
  limitationsPath: 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-limitations.json',
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function catalogItemId(sourceFamily: AdaptiveAssessmentCatalogSourceFamily, sourceId: string): string {
  return `adaptive-assessment-item:${sourceFamily}:${sourceId}`;
}

function snapshotRelationship() {
  return {
    relationship: 'answer-time-snapshot' as const,
    immutable: true as const,
    mayReferenceCatalogItemId: true,
    mayReferenceContentHash: true,
    catalogUpdatesRewriteHistoricalAnswers: false as const,
  };
}

function allowedStagesFor(reviewState: AdaptiveAssessmentCatalogReviewState, purpose?: string): AdaptiveAssessmentCatalogStage[] {
  if (reviewState !== 'path-eligible') return ['low-stakes-practice'];
  const stages = new Set<AdaptiveAssessmentCatalogStage>(['low-stakes-practice', 'remediation']);
  if (purpose === 'readiness-gate' || purpose === 'precheck') stages.add('readiness');
  if (purpose === 'checkpoint') stages.add('checkpoint');
  if (purpose === 'terminal-validation') stages.add('terminal-validation');
  return [...stages].sort();
}

function kaqReviewMismatchReasons(
  kaqMetadata: KaqReviewedItemRecord['metadata'] | undefined,
  currentKaqMetadata: CurrentKaqQuestionMetadata,
): string[] {
  if (kaqMetadata?.review?.state !== 'reviewed') {
    return ['missing-kaq-reviewed-metadata'];
  }

  const reasons = [
    kaqMetadata.review.sourceHash === currentKaqMetadata.review.sourceHash
      ? ''
      : 'kaq-review-source-hash-mismatch',
    kaqMetadata.immutableContentHash === currentKaqMetadata.immutableContentHash
      ? ''
      : 'kaq-review-immutable-content-hash-mismatch',
    kaqMetadata.review.metadataVersionRef === currentKaqMetadata.review.metadataVersionRef
      ? ''
      : 'kaq-review-metadata-version-mismatch',
    stableJson(kaqMetadata.versionRefs ?? {}) === stableJson(currentKaqMetadata.versionRefs)
      ? ''
      : 'kaq-review-version-ref-mismatch',
  ].filter(Boolean);

  return uniqueSorted(reasons);
}

function icourseQuestionContentSnapshot(record: IcourseObjectiveBankRecord) {
  return {
    questionKind: record.question_kind ?? null,
    choiceMode: record.choice_mode ?? null,
    stem: record.stem ?? null,
    options: Array.isArray(record.options)
      ? record.options.map((option) => ({
        key: option.key ?? null,
        text: option.text ?? null,
        isCorrect: option.is_correct === true,
      })).sort((left, right) => String(left.key ?? '').localeCompare(String(right.key ?? '')))
      : [],
    correctAnswers: Array.isArray(record.correct_answers) ? record.correct_answers.map(String).sort() : [],
  };
}

function buildPresetItems(
  questions: CrossDomainQuestion[],
  kaqReviewedByQuestionId: Map<string, KaqReviewedItemRecord>,
): AdaptiveAssessmentCatalogItem[] {
  return questions.map((question) => {
    const kaq = kaqReviewedByQuestionId.get(question.id);
    const kaqMetadata = kaq?.metadata;
    const currentKaqMetadata = buildKaqQuizQuestionMetadata(question);
    const reviewMismatchReasons = kaqReviewMismatchReasons(kaqMetadata, currentKaqMetadata);
    const reviewState: AdaptiveAssessmentCatalogReviewState = reviewMismatchReasons.length === 0
      ? 'path-eligible'
      : 'imported-unreviewed';
    const sourceHash = sha256({
      id: question.id,
      stem: question.stem,
      domains: question.domains,
      type: question.type,
      difficulty: question.difficulty,
      knowledgeTags: question.knowledgeTags,
      options: question.options,
    });
    return {
      catalogItemId: catalogItemId('preset-adaptive-question', question.id),
      sourceFamily: 'preset-adaptive-question',
      sourceId: question.id,
      sourceAnchor: question.id,
      contentHash: sourceHash,
      contentHashAlgorithm: 'sha256',
      reviewState,
      eligibilityState: reviewState,
      allowedStages: allowedStagesFor(reviewState, kaqMetadata?.purpose),
      questionRefs: {
        stem: question.stem,
        answerKey: question.options.filter((option) => option.isCorrect).map((option) => option.label).sort(),
        rubricRef: kaqMetadata?.review?.metadataVersionRef ?? null,
        options: question.options.map((option) => ({
          key: option.label,
          text: option.text,
          isCorrect: option.isCorrect,
          explanation: option.explanation,
        })),
      },
      semanticRefs: {
        learningGoalIds: uniqueSorted(kaqMetadata?.learningGoalIds ?? []),
        kaqObjectiveIds: uniqueSorted(kaqMetadata?.kaqObjectiveIds ?? []),
        graphNodeIds: uniqueSorted(kaqMetadata?.graphNodeIds ?? []),
        knowledgeTags: uniqueSorted(question.knowledgeTags),
        misconceptionTags: uniqueSorted(kaqMetadata?.misconceptionTags ?? []),
        remediationResourceNodeIds: uniqueSorted(kaqMetadata?.remediationResourceNodeIds ?? []),
        difficulty: question.difficulty,
        cognitiveLevel: kaqMetadata?.cognitiveLevel ?? null,
        assessmentStage: kaqMetadata?.purpose ?? null,
      },
      lineage: {
        sourceFamily: 'preset-adaptive-question',
        sourceId: question.id,
        sourcePath: 'src/features/assessment/adaptive-question-bank.ts',
        sourceHash,
      },
      versionRefs: {
        ...ARTIFACT_VERSION_REFS,
        ...currentKaqMetadata.versionRefs,
      },
      limitations: reviewState === 'path-eligible'
        ? []
        : uniqueSorted([...reviewMismatchReasons, 'not-path-eligible']),
      adaptiveAssessmentItemRef: snapshotRelationship(),
    };
  });
}

function buildPrismaQuestionItems(rows: PrismaQuestionCatalogRow[]): AdaptiveAssessmentCatalogItem[] {
  return rows.map((row) => {
    const reviewState: AdaptiveAssessmentCatalogReviewState = row.validationStatus === 'validated'
      ? 'semantically-reviewed'
      : 'imported-unreviewed';
    const sourceHash = sha256({
      stem: row.stem,
      type: row.type,
      domains: row.domains,
      difficulty: row.difficulty,
      knowledgeTags: row.knowledgeTags,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation ?? '',
    });
    return {
      catalogItemId: catalogItemId('prisma-question', row.id),
      sourceFamily: 'prisma-question',
      sourceId: row.id,
      sourceAnchor: row.id,
      contentHash: sourceHash,
      contentHashAlgorithm: 'sha256',
      reviewState,
      eligibilityState: reviewState,
      allowedStages: ['low-stakes-practice'],
      questionRefs: {
        stem: row.stem,
        answerKey: [row.correctAnswer],
        rubricRef: null,
        explanation: row.explanation ?? null,
      },
      semanticRefs: {
        learningGoalIds: [],
        kaqObjectiveIds: [],
        graphNodeIds: [],
        knowledgeTags: uniqueSorted(row.knowledgeTags),
        misconceptionTags: [],
        remediationResourceNodeIds: [],
        difficulty: row.difficulty,
        cognitiveLevel: null,
        assessmentStage: null,
      },
      lineage: {
        sourceFamily: 'prisma-question',
        sourceId: row.id,
        sourcePath: 'prisma/schema.prisma#Question',
        sourceHash,
      },
      versionRefs: ARTIFACT_VERSION_REFS,
      limitations: reviewState === 'semantically-reviewed' ? ['requires-path-eligibility-review'] : ['prisma-question-unreviewed'],
      adaptiveAssessmentItemRef: snapshotRelationship(),
    };
  });
}

function buildAcqStaticItems(records: AcqStaticQuestionRecord[]): AdaptiveAssessmentCatalogItem[] {
  return records.map((record) => {
    const sourceId = record.question_id ?? 'unknown-acq-question';
    const sourceHash = sha256(record);
    const missing = [
      record.stem_md ? '' : 'missing-stem',
      record.solution_md ? '' : 'missing-solution',
      record.rubric?.length ? '' : 'missing-rubric',
      record.knowledge_tags?.length ? '' : 'missing-knowledge-tags',
    ].filter(Boolean);
    return {
      catalogItemId: catalogItemId('acq-static-question', sourceId),
      sourceFamily: 'acq-static-question',
      sourceId,
      sourceAnchor: `course-content/questions/questions/${sourceId}.json`,
      contentHash: sourceHash,
      contentHashAlgorithm: 'sha256',
      reviewState: 'imported-unreviewed',
      eligibilityState: 'imported-unreviewed',
      allowedStages: ['low-stakes-practice'],
      questionRefs: {
        stem: record.stem_md ?? null,
        answerKey: null,
        rubricRef: record.rubric?.length ? `${sourceId}#rubric` : null,
        explanation: record.solution_md ?? null,
      },
      semanticRefs: {
        learningGoalIds: [],
        kaqObjectiveIds: [],
        graphNodeIds: [],
        knowledgeTags: uniqueSorted(record.knowledge_tags ?? []),
        misconceptionTags: [],
        remediationResourceNodeIds: [],
        difficulty: null,
        cognitiveLevel: null,
        assessmentStage: null,
      },
      lineage: {
        sourceFamily: 'acq-static-question',
        sourceId,
        sourcePath: `course-content/questions/questions/${sourceId}.json`,
        sourceHash,
      },
      versionRefs: ARTIFACT_VERSION_REFS,
      limitations: uniqueSorted(['requires-semantic-review', 'not-path-eligible', ...missing]),
      adaptiveAssessmentItemRef: snapshotRelationship(),
    };
  });
}

function buildIcourseItems(records: IcourseObjectiveBankRecord[]): AdaptiveAssessmentCatalogItem[] {
  return records.map((record) => {
    const sourceId = record.question_id ?? String(record.source_question_id ?? 'unknown-icourse-question');
    const sourceHash = sha256(icourseQuestionContentSnapshot(record));
    const reviewState: AdaptiveAssessmentCatalogReviewState = record.adaptive_metadata?.review_status === 'verified'
      ? 'semantically-reviewed'
      : 'imported-unreviewed';
    return {
      catalogItemId: catalogItemId('icourse-objective-bank', sourceId),
      sourceFamily: 'icourse-objective-bank',
      sourceId,
      sourceAnchor: `course-content/questions/objective-bank/icourse-bank-bankType4.jsonl#${sourceId}`,
      contentHash: sourceHash,
      contentHashAlgorithm: 'sha256',
      reviewState,
      eligibilityState: reviewState,
      allowedStages: ['low-stakes-practice'],
      questionRefs: {
        stem: record.stem ?? null,
        answerKey: Array.isArray(record.correct_answers) ? record.correct_answers.map(String).sort() : null,
        rubricRef: null,
        choiceMode: record.choice_mode ?? null,
        options: Array.isArray(record.options)
          ? record.options.map((option) => ({
            key: option.key ?? null,
            text: option.text ?? '',
            isCorrect: typeof option.is_correct === 'boolean' ? option.is_correct : null,
            explanation: null,
          })).sort((left, right) => String(left.key ?? '').localeCompare(String(right.key ?? '')))
          : null,
      },
      semanticRefs: {
        learningGoalIds: [],
        kaqObjectiveIds: [],
        graphNodeIds: [],
        knowledgeTags: uniqueSorted(record.knowledge_tags ?? []),
        misconceptionTags: [],
        remediationResourceNodeIds: [],
        difficulty: typeof record.adaptive_metadata?.difficulty_seed === 'number' ? record.adaptive_metadata.difficulty_seed : null,
        cognitiveLevel: null,
        assessmentStage: null,
      },
      lineage: {
        sourceFamily: 'icourse-objective-bank',
        sourceId,
        sourcePath: 'course-content/questions/objective-bank/icourse-bank-bankType4.jsonl',
        sourceHash,
      },
      versionRefs: ARTIFACT_VERSION_REFS,
      limitations: reviewState === 'semantically-reviewed'
        ? ['requires-path-eligibility-review']
        : ['requires-semantic-review', 'not-path-eligible'],
      adaptiveAssessmentItemRef: snapshotRelationship(),
    };
  });
}

function buildGeneratedItems(rows: GeneratedQuestionCatalogRow[]): AdaptiveAssessmentCatalogItem[] {
  return rows.map(({ question }) => {
    const sourceHash = sha256(question);
    return {
      catalogItemId: catalogItemId('generated-adaptive-question', question.id),
      sourceFamily: 'generated-adaptive-question',
      sourceId: question.id,
      sourceAnchor: question.id,
      contentHash: sourceHash,
      contentHashAlgorithm: 'sha256',
      reviewState: 'generated-provisional',
      eligibilityState: 'generated-provisional',
      allowedStages: ['low-stakes-practice'],
      questionRefs: {
        stem: question.stem,
        answerKey: question.options.filter((option) => option.isCorrect).map((option) => option.label).sort(),
        rubricRef: null,
        options: question.options.map((option) => ({
          key: option.label,
          text: option.text,
          isCorrect: option.isCorrect,
          explanation: option.explanation,
        })),
      },
      semanticRefs: {
        learningGoalIds: uniqueSorted(question.generatedMetadata?.learningGoalIds ?? []),
        kaqObjectiveIds: [],
        graphNodeIds: [],
        knowledgeTags: uniqueSorted(question.knowledgeTags),
        misconceptionTags: [],
        remediationResourceNodeIds: [],
        difficulty: question.difficulty,
        cognitiveLevel: null,
        assessmentStage: 'low-stakes-practice',
      },
      lineage: {
        sourceFamily: 'generated-adaptive-question',
        sourceId: question.id,
        sourcePath: null,
        sourceHash,
      },
      versionRefs: ARTIFACT_VERSION_REFS,
      limitations: ['generated-provisional-not-path-eligible'],
      adaptiveAssessmentItemRef: snapshotRelationship(),
    };
  });
}

function sourceSummary(
  family: AdaptiveAssessmentCatalogSourceFamily,
  sourceTotal: number | null,
  importedTotal: number,
  limitationReasons: string[],
  extra: Partial<Pick<AdaptiveAssessmentCatalogSourceSummary, 'role' | 'appliesToFamily' | 'reviewOverlayTotal'>> = {},
): AdaptiveAssessmentCatalogSourceSummary {
  const role = extra.role ?? 'item-source';
  const blockedTotal = role === 'review-overlay' || sourceTotal === null
    ? 0
    : Math.max(sourceTotal - importedTotal, 0);
  return {
    family,
    role,
    ...(extra.appliesToFamily ? { appliesToFamily: extra.appliesToFamily } : {}),
    sourceTotal,
    importedTotal,
    blockedTotal,
    ...(typeof extra.reviewOverlayTotal === 'number' ? { reviewOverlayTotal: extra.reviewOverlayTotal } : {}),
    limitationReasons: uniqueSorted(limitationReasons),
    versionRefs: ARTIFACT_VERSION_REFS,
  };
}

export function buildAdaptiveAssessmentItemCatalog(
  input: AdaptiveAssessmentCatalogInput = {},
): AdaptiveAssessmentItemCatalogArtifacts {
  const presetQuestions = input.presetQuestions ?? PRESET_QUESTIONS;
  const prismaQuestions = input.prismaQuestions ?? [];
  const acqStaticQuestions = input.acqStaticQuestions ?? [];
  const icourseObjectiveBankItems = input.icourseObjectiveBankItems ?? [];
  const kaqReviewedItems = input.kaqReviewedItems ?? [];
  const generatedQuestions = input.generatedQuestions ?? [];
  const kaqReviewedByQuestionId = new Map(
    kaqReviewedItems
      .filter((item) => item.questionId)
      .map((item) => [item.questionId!, item]),
  );

  const items = [
    ...buildPresetItems(presetQuestions, kaqReviewedByQuestionId),
    ...buildPrismaQuestionItems(prismaQuestions),
    ...buildAcqStaticItems(acqStaticQuestions),
    ...buildIcourseItems(icourseObjectiveBankItems),
    ...buildGeneratedItems(generatedQuestions),
  ].sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));

  const limitations: AdaptiveAssessmentCatalogLimitation[] = [];
  if (!input.prismaQuestions) {
    limitations.push({
      family: 'prisma-question',
      sourceId: null,
      reason: 'prisma-question-count-requires-database-query',
      severity: 'warning',
    });
  }
  if (generatedQuestions.length === 0) {
    limitations.push({
      family: 'generated-adaptive-question',
      sourceId: null,
      reason: 'generated-questions-are-runtime-provisional-not-static-artifact',
      severity: 'info',
    });
  }
  limitations.push({
    family: 'checkpoint-authored-question',
    sourceId: null,
    reason: 'future-checkpoint-items-not-authored-in-this-change',
    severity: 'info',
  });
  for (const item of items) {
    for (const reason of item.limitations) {
      limitations.push({
        family: item.sourceFamily,
        sourceId: item.sourceId,
        reason,
        severity: reason.includes('missing') ? 'warning' : 'info',
      });
    }
  }

  const sourceFamilies = [
    sourceSummary('preset-adaptive-question', presetQuestions.length, presetQuestions.length, []),
    sourceSummary(
      'prisma-question',
      input.prismaQuestionSourceTotal ?? (input.prismaQuestions ? prismaQuestions.length : null),
      prismaQuestions.length,
      input.prismaQuestions ? [] : ['prisma-question-count-requires-database-query'],
    ),
    sourceSummary('acq-static-question', acqStaticQuestions.length, acqStaticQuestions.length, ['requires-semantic-review']),
    sourceSummary(
      'icourse-objective-bank',
      input.icourseObjectiveBankIndexTotal ?? icourseObjectiveBankItems.length,
      icourseObjectiveBankItems.length,
      ['requires-path-eligibility-review'],
    ),
    sourceSummary('kaq-foundation-reviewed', kaqReviewedItems.length, 0, [], {
      role: 'review-overlay',
      appliesToFamily: 'preset-adaptive-question',
      reviewOverlayTotal: kaqReviewedItems.length,
    }),
    sourceSummary('generated-adaptive-question', generatedQuestions.length, generatedQuestions.length, ['generated-provisional-not-path-eligible']),
    sourceSummary('checkpoint-authored-question', 0, 0, ['future-checkpoint-items-not-authored-in-this-change']),
  ];

  return {
    manifest: {
      artifactVersion: 'adaptive-assessment-item-catalog.v1',
      itemCount: items.length,
      pathEligibleItemCount: items.filter((item) => item.eligibilityState === 'path-eligible').length,
      sourceFamilies,
      artifacts: ARTIFACT_PATHS,
      versionRefs: ARTIFACT_VERSION_REFS,
    },
    items,
    limitations: {
      artifactVersion: 'adaptive-assessment-item-catalog-limitations.v1',
      rows: limitations.sort((left, right) =>
        `${left.family}:${left.sourceId ?? ''}:${left.reason}`.localeCompare(`${right.family}:${right.sourceId ?? ''}:${right.reason}`),
      ),
    },
  };
}

export async function loadAdaptiveAssessmentCatalogSources(rootDir = process.cwd()): Promise<LoadedAdaptiveAssessmentCatalogSources> {
  const acqDir = path.join(rootDir, 'course-content/questions/questions');
  const acqFiles = (await fs.readdir(acqDir))
    .filter((file) => /^AC-Q-\d+\.json$/.test(file))
    .sort();
  const acqStaticQuestions = await Promise.all(
    acqFiles.map(async (file) => JSON.parse(await fs.readFile(path.join(acqDir, file), 'utf8')) as AcqStaticQuestionRecord),
  );

  const objectiveBankDir = path.join(rootDir, 'course-content/questions/objective-bank');
  const index = JSON.parse(
    await fs.readFile(path.join(objectiveBankDir, 'icourse-bank-bankType4.index.json'), 'utf8'),
  ) as { question_count?: number };
  const jsonl = await fs.readFile(path.join(objectiveBankDir, 'icourse-bank-bankType4.jsonl'), 'utf8');
  const icourseObjectiveBankItems = jsonl
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as IcourseObjectiveBankRecord);

  const kaqJsonl = await fs.readFile(
    path.join(rootDir, 'course-content/runtime/resource-governance/kaq-quiz-foundation-reviewed-items.jsonl'),
    'utf8',
  );
  const kaqReviewedItems = kaqJsonl
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as KaqReviewedItemRecord);

  return {
    acqStaticQuestions,
    icourseObjectiveBankItems,
    icourseObjectiveBankIndexTotal: index.question_count ?? icourseObjectiveBankItems.length,
    kaqReviewedItems,
  };
}

export function adaptiveAssessmentCatalogArtifactsToFiles(artifacts: AdaptiveAssessmentItemCatalogArtifacts) {
  return {
    manifest: `${JSON.stringify(artifacts.manifest, null, 2)}\n`,
    items: `${artifacts.items.map((item) => JSON.stringify(item)).join('\n')}\n`,
    limitations: `${JSON.stringify(artifacts.limitations, null, 2)}\n`,
  };
}
