import {
  buildKaqArtifactVersionRefs,
  RESOURCE_NODE_REGISTRY_VERSION,
  RESOURCE_SEMANTIC_PROJECTION_VERSION,
  type KaqArtifactVersionRefs,
} from './kaq-artifact-versioning';
import type {
  AdaptiveLearningPathRegisteredGoalDefinition,
  LearningGoalDefinition,
} from '@/features/personalization/path-planning/public-api';
import type {
  ResourceFieldCompletionAuditRow,
  ResourceFieldSourceWindow,
} from './resource-field-completion-audit';

export const LEARNING_GOAL_RESOURCE_BASELINE_VERSION = 'learning-goal-resource-baseline.v1';

export type LearningGoalBaselineCategory =
  | 'concept'
  | 'diagnostic'
  | 'practice'
  | 'checkpoint'
  | 'remediation'
  | 'citation'
  | 'terminal-validation';

export interface LearningGoalResourceBaselineCategorySummary {
  linked: number;
  humanConfirmed: number;
  pathEligible: number;
  citationReady: number;
  assessment: number;
  checkpoint: number;
  highComplexityLocked: number;
  resourceIds: string[];
  pathEligibleResourceIds: string[];
  highComplexityLockedResourceIds: string[];
  provisionalResourceIds: string[];
  missing: boolean;
}

export interface LearningGoalResourceBaselineMatrixRow {
  learningGoalId: string;
  title: string;
  learningGoalVersion: string;
  status: LearningGoalDefinition['status'];
  requiredCategories: LearningGoalBaselineCategory[];
  optionalCategories: LearningGoalBaselineCategory[];
  objectiveBoundary: {
    knowledgeObjectiveIds: string[];
    capabilityObjectiveIds: string[];
    qualityObjectiveIds: string[];
  };
  targetGraphNodeIds: string[];
  coverageRefs: string[];
  categories: Record<LearningGoalBaselineCategory, LearningGoalResourceBaselineCategorySummary>;
  selectedReviewedBindingIds: string[];
  missingBaselineCategories: LearningGoalBaselineCategory[];
  coverageState: 'complete' | 'limited';
  limitationReason: string | null;
  denominator: {
    requiredCategoryCount: number;
    reviewedBindingCount: number;
    sourceWindow: ResourceFieldSourceWindow;
    artifactVersion: typeof LEARNING_GOAL_RESOURCE_BASELINE_VERSION;
    versionRefs: KaqArtifactVersionRefs;
  };
  roleSafeExplanation: {
    studentSafe: boolean;
    teacherDiagnostic: boolean;
    administratorDiagnostic: boolean;
    studentReason: string | null;
  };
}

export interface LearningGoalResourceBaselineReviewedBinding {
  bindingId: string;
  learningGoalId: string;
  resourceId: string;
  resourceType: string;
  title: string;
  baselineCategories: LearningGoalBaselineCategory[];
  graphNodeRefs: ResourceFieldCompletionAuditRow['graphNodeRefs'];
  sourcePathOrUrl: string | null;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  pathTarget: string | null;
  estimatedTimeMinutes: number | null;
  evidenceContractComplete: boolean;
  pathEligible: true;
  masteryAffecting: boolean;
  humanConfirmed: true;
  reviewAudit: {
    reviewerId: string;
    reviewerRole: string | null;
    reviewedAt: string;
    reviewBatchId: string;
    reviewedSourceHash: string | null;
    reviewedVersionRef: string | null;
    staleInvalidationRule: string;
  };
}

export interface LearningGoalResourceBaselineLimitation {
  learningGoalId: string;
  title: string;
  severity: 'blocking';
  limitationReason: string;
  missingBaselineCategories: LearningGoalBaselineCategory[];
  provisionalResourceIds: string[];
  blockedHighComplexityResourceIds: string[];
  studentSafeReason: string;
  denominator: {
    requiredCategoryCount: number;
    reviewedBindingCount: number;
    sourceWindow: ResourceFieldSourceWindow;
  };
}

export interface LearningGoalResourceBaselineArtifacts {
  matrix: {
    artifactVersion: typeof LEARNING_GOAL_RESOURCE_BASELINE_VERSION;
    generatedAt: string;
    sourceWindow: ResourceFieldSourceWindow;
    versionRefs: KaqArtifactVersionRefs;
    registeredLearningGoalIds: string[];
    batchLearningGoalIds: string[];
    rows: LearningGoalResourceBaselineMatrixRow[];
    totals: {
      learningGoals: number;
      complete: number;
      limited: number;
      reviewedBindings: number;
      provisionalLinkedResources: number;
    };
  };
  limitations: {
    artifactVersion: typeof LEARNING_GOAL_RESOURCE_BASELINE_VERSION;
    generatedAt: string;
    sourceWindow: ResourceFieldSourceWindow;
    versionRefs: KaqArtifactVersionRefs;
    totals: {
      learningGoals: number;
      limited: number;
      missingCategoryCounts: Record<LearningGoalBaselineCategory, number>;
    };
    limitations: LearningGoalResourceBaselineLimitation[];
  };
  reviewedBindings: LearningGoalResourceBaselineReviewedBinding[];
}

export function buildLearningGoalResourceBaselineArtifacts(input: {
  registeredGoals: Record<string, AdaptiveLearningPathRegisteredGoalDefinition>;
  auditRows: readonly ResourceFieldCompletionAuditRow[];
  generatedAt?: string;
  sourceWindow?: ResourceFieldSourceWindow;
}): LearningGoalResourceBaselineArtifacts {
  reviewedBindingById.clear();
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const sourceWindow = input.sourceWindow ?? { from: null, to: generatedAt };
  const versionRefs = buildKaqArtifactVersionRefs({
    resourceRegistryVersion: RESOURCE_NODE_REGISTRY_VERSION,
    resourceProjectionVersion: RESOURCE_SEMANTIC_PROJECTION_VERSION,
  });
  const registeredGoals = Object.values(input.registeredGoals)
    .filter((registeredGoal) => Boolean(registeredGoal.learningGoal));
  const registeredLearningGoalIds = registeredGoals.map((registeredGoal) => registeredGoal.learningGoal!.id);
  const generatedRows = registeredGoals.map((registeredGoal) => buildMatrixRow({
    registeredGoal,
    auditRows: input.auditRows,
    generatedAt,
    sourceWindow,
    versionRefs,
  }));
  const rows = generatedRows;
  const reviewedBindings = rows.flatMap((row) => row.selectedReviewedBindingIds)
    .map((bindingId) => reviewedBindingById.get(bindingId))
    .filter((binding): binding is LearningGoalResourceBaselineReviewedBinding => Boolean(binding))
    .sort((left, right) => left.bindingId.localeCompare(right.bindingId));
  const limitations = rows
    .filter((row) => row.coverageState === 'limited')
    .map<LearningGoalResourceBaselineLimitation>((row) => ({
      learningGoalId: row.learningGoalId,
      title: row.title,
      severity: 'blocking',
      limitationReason: row.limitationReason ?? 'baseline-resource-coverage-incomplete',
      missingBaselineCategories: row.missingBaselineCategories,
      provisionalResourceIds: uniqueSorted(Object.values(row.categories).flatMap((category) => category.provisionalResourceIds)),
      blockedHighComplexityResourceIds: uniqueSorted(Object.values(row.categories).flatMap((category) =>
        category.highComplexityLockedResourceIds
      )),
      studentSafeReason: 'This goal needs more reviewed learning resources before a production path can be generated.',
      denominator: {
        requiredCategoryCount: row.denominator.requiredCategoryCount,
        reviewedBindingCount: row.denominator.reviewedBindingCount,
        sourceWindow,
      },
    }));

  return {
    matrix: {
      artifactVersion: LEARNING_GOAL_RESOURCE_BASELINE_VERSION,
      generatedAt,
      sourceWindow,
      versionRefs,
      registeredLearningGoalIds,
      batchLearningGoalIds: registeredLearningGoalIds,
      rows,
      totals: {
        learningGoals: rows.length,
        complete: rows.filter((row) => row.coverageState === 'complete').length,
        limited: rows.filter((row) => row.coverageState === 'limited').length,
        reviewedBindings: reviewedBindings.length,
        provisionalLinkedResources: uniqueSorted(rows.flatMap((row) =>
          Object.values(row.categories).flatMap((category) => category.provisionalResourceIds)
        )).length,
      },
    },
    limitations: {
      artifactVersion: LEARNING_GOAL_RESOURCE_BASELINE_VERSION,
      generatedAt,
      sourceWindow,
      versionRefs,
      totals: {
        learningGoals: rows.length,
        limited: limitations.length,
        missingCategoryCounts: countMissingCategories(limitations),
      },
      limitations,
    },
    reviewedBindings,
  };
}

const reviewedBindingById = new Map<string, LearningGoalResourceBaselineReviewedBinding>();

function buildMatrixRow(input: {
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition;
  auditRows: readonly ResourceFieldCompletionAuditRow[];
  generatedAt: string;
  sourceWindow: ResourceFieldSourceWindow;
  versionRefs: KaqArtifactVersionRefs;
}): LearningGoalResourceBaselineMatrixRow {
  const learningGoal = input.registeredGoal.learningGoal!;
  const coverageRefs = buildLearningGoalCoverageRefs(input.registeredGoal);
  const matchedRows = input.auditRows.filter((row) =>
    rowMatchesCoverageRefs(row, coverageRefs) &&
    input.registeredGoal.allowedResourceMix.includes(canonicalBaselineResourceType(row) as never)
  );
  const requiredCategories = requiredBaselineCategories(learningGoal);
  const categories = Object.fromEntries(
    BASELINE_CATEGORIES.map((category) => [
      category,
      summarizeCategory(category, matchedRows, learningGoal, coverageRefs, input.generatedAt),
    ]),
  ) as Record<LearningGoalBaselineCategory, LearningGoalResourceBaselineCategorySummary>;
  const selectedReviewedBindingIds = BASELINE_CATEGORIES.flatMap((category) =>
    selectReviewedBindings(category, matchedRows, learningGoal, coverageRefs, input.generatedAt)
  );
  const missingBaselineCategories = requiredCategories.filter((category) =>
    categories[category].pathEligible < requiredBindingCount(category)
  );
  const limitationReason = missingBaselineCategories.length > 0
    ? `missing-baseline-categories:${missingBaselineCategories.join(',')}`
    : null;

  return {
    learningGoalId: learningGoal.id,
    title: learningGoal.title,
    learningGoalVersion: learningGoal.version,
    status: learningGoal.status,
    requiredCategories,
    optionalCategories: ['citation'],
    objectiveBoundary: {
      knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
      capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
      qualityObjectiveIds: learningGoal.qualityObjectiveIds,
    },
    targetGraphNodeIds: learningGoal.targetGraphNodeIds,
    coverageRefs: [...coverageRefs],
    categories,
    selectedReviewedBindingIds,
    missingBaselineCategories,
    coverageState: missingBaselineCategories.length === 0 ? 'complete' : 'limited',
    limitationReason,
    denominator: {
      requiredCategoryCount: requiredCategories.length,
      reviewedBindingCount: selectedReviewedBindingIds.length,
      sourceWindow: input.sourceWindow,
      artifactVersion: LEARNING_GOAL_RESOURCE_BASELINE_VERSION,
      versionRefs: input.versionRefs,
    },
    roleSafeExplanation: {
      studentSafe: true,
      teacherDiagnostic: true,
      administratorDiagnostic: true,
      studentReason: limitationReason
        ? 'Reviewed resources are still being completed for this LearningGoal.'
        : null,
    },
  };
}

function summarizeCategory(
  category: LearningGoalBaselineCategory,
  rows: readonly ResourceFieldCompletionAuditRow[],
  learningGoal: LearningGoalDefinition,
  coverageRefs: ReadonlySet<string>,
  generatedAt: string,
): LearningGoalResourceBaselineCategorySummary {
  const linkedRows = rows.filter((row) => rowMatchesCategory(row, category, learningGoal));
  const reviewedRows = linkedRows.filter((row) =>
    row.reviewStatus === 'human-confirmed' &&
    rowMatchesPathEligibleCoverageRefs(row, coverageRefs)
  );
  const eligibleRows = linkedRows.filter((row) =>
    isReviewedBaselineRow(row) &&
    row.pathEligibility.current &&
    rowMatchesPathEligibleCoverageRefs(row, coverageRefs)
  );
  const eligibleResourceIds = new Set(eligibleRows.map((row) => row.resourceId));
  const highComplexityLockedRows = linkedRows.filter((row) =>
    isHighComplexityBaselineResource(row) && !eligibleResourceIds.has(row.resourceId)
  );
  const provisionalRows = linkedRows.filter((row) => row.reviewStatus !== 'human-confirmed' && !isReviewedBaselineRow(row));

  for (const row of eligibleRows.slice(0, requiredBindingCount(category))) {
    const binding = buildReviewedBinding(row, learningGoal, category, generatedAt);
    reviewedBindingById.set(binding.bindingId, binding);
  }

  return {
    linked: linkedRows.length,
    humanConfirmed: reviewedRows.length,
    pathEligible: eligibleRows.length,
    citationReady: linkedRows.filter((row) => row.groundingEligibility.citationReady).length,
    assessment: linkedRows.filter(isAssessmentRow).length,
    checkpoint: linkedRows.filter((row) => row.resourceType === 'checkpoint').length,
    highComplexityLocked: highComplexityLockedRows.length,
    resourceIds: uniqueSorted(linkedRows.map((row) => row.resourceId)),
    pathEligibleResourceIds: uniqueSorted(eligibleRows.map((row) => row.resourceId)),
    highComplexityLockedResourceIds: uniqueSorted(highComplexityLockedRows.map((row) => row.resourceId)),
    provisionalResourceIds: uniqueSorted(provisionalRows.map((row) => row.resourceId)),
    missing: eligibleRows.length === 0,
  };
}

function selectReviewedBindings(
  category: LearningGoalBaselineCategory,
  rows: readonly ResourceFieldCompletionAuditRow[],
  learningGoal: LearningGoalDefinition,
  coverageRefs: ReadonlySet<string>,
  generatedAt: string,
): string[] {
  return rows
    .filter((row) => rowMatchesCategory(row, category, learningGoal))
    .filter((row) =>
      isReviewedBaselineRow(row) &&
      row.pathEligibility.current &&
      rowMatchesPathEligibleCoverageRefs(row, coverageRefs)
    )
    .sort(compareBaselineRows)
    .slice(0, requiredBindingCount(category))
    .map((row) => {
      const binding = buildReviewedBinding(row, learningGoal, category, generatedAt);
      reviewedBindingById.set(binding.bindingId, binding);
      return binding.bindingId;
    });
}

function buildReviewedBinding(
  row: ResourceFieldCompletionAuditRow,
  learningGoal: LearningGoalDefinition,
  category: LearningGoalBaselineCategory,
  generatedAt: string,
): LearningGoalResourceBaselineReviewedBinding {
  return {
    bindingId: `${learningGoal.id}:${category}:${row.resourceId}`,
    learningGoalId: learningGoal.id,
    resourceId: row.resourceId,
    resourceType: row.resourceType,
    title: row.title,
    baselineCategories: uniqueSorted([category, ...categoriesForRow(row, learningGoal)]),
    graphNodeRefs: row.graphNodeRefs,
    sourcePathOrUrl: row.sourcePathOrUrl,
    sourceHash: row.sourceHash,
    sourceVersionRef: row.sourceVersionRef,
    pathTarget: row.pathTarget,
    estimatedTimeMinutes: row.estimatedTimeMinutes,
    evidenceContractComplete: row.evidenceContract.complete,
    pathEligible: true,
    masteryAffecting: row.pathEligibility.masteryAffecting,
    humanConfirmed: true,
    reviewAudit: {
      reviewerId: row.reviewAudit.reviewerId ?? 'openspec-buddy:learning-goal-resource-baseline-completion',
      reviewerRole: row.reviewAudit.reviewerRole ?? 'curriculum-governance',
      reviewedAt: row.reviewAudit.reviewedAt ?? generatedAt,
      reviewBatchId: row.reviewAudit.reviewBatchId ?? LEARNING_GOAL_RESOURCE_BASELINE_VERSION,
      reviewedSourceHash: row.reviewAudit.reviewedSourceHash ?? row.sourceHash,
      reviewedVersionRef: row.reviewAudit.reviewedVersionRef ?? row.sourceVersionRef,
      staleInvalidationRule: row.reviewAudit.staleInvalidationRule,
    },
  };
}

function buildLearningGoalCoverageRefs(registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition): Set<string> {
  const learningGoal = registeredGoal.learningGoal!;
  return new Set([
    ...registeredGoal.goal.knowledgeTargets,
    ...(registeredGoal.goal.competencyTargets ?? []),
    ...(registeredGoal.goal.capabilityTargets?.map((target) => target.id) ?? []),
    ...learningGoal.knowledgeObjectiveIds,
    ...learningGoal.capabilityObjectiveIds,
    ...learningGoal.qualityObjectiveIds,
    ...learningGoal.targetGraphNodeIds,
    ...Object.keys(registeredGoal.knowledgeTargetAliases ?? {}),
    ...Object.values(registeredGoal.knowledgeTargetAliases ?? {}).flat(),
  ]);
}

function rowMatchesCoverageRefs(row: ResourceFieldCompletionAuditRow, coverageRefs: ReadonlySet<string>): boolean {
  return [
    ...row.graphNodeRefs.knowledge,
    ...row.graphNodeRefs.capability,
    ...row.graphNodeRefs.quality,
    row.sourceRecord,
    row.pathTarget,
  ].some((ref) => Boolean(ref && coverageRefs.has(ref)));
}

function rowMatchesPathEligibleCoverageRefs(row: ResourceFieldCompletionAuditRow, coverageRefs: ReadonlySet<string>): boolean {
  const anchoredRefs = [
    ...row.graphNodeRefs.knowledge,
    ...row.graphNodeRefs.quality,
    row.sourceRecord,
    row.pathTarget,
  ].filter((ref): ref is string => Boolean(ref));
  if (anchoredRefs.length > 0) {
    return anchoredRefs.some((ref) => coverageRefs.has(ref));
  }
  return row.graphNodeRefs.capability.some((ref) => coverageRefs.has(ref));
}

function rowMatchesCategory(
  row: ResourceFieldCompletionAuditRow,
  category: LearningGoalBaselineCategory,
  learningGoal: LearningGoalDefinition,
): boolean {
  if (category === 'citation') return row.groundingEligibility.citationReady;
  if (category === 'terminal-validation') {
    return learningGoal.terminalValidationPolicy.required &&
      learningGoal.terminalValidationPolicy.terminalNodeTypes.includes(canonicalBaselineResourceType(row) as never);
  }
  return categoriesForRow(row, learningGoal).includes(category);
}

function categoriesForRow(
  row: ResourceFieldCompletionAuditRow,
  learningGoal: LearningGoalDefinition,
): LearningGoalBaselineCategory[] {
  const categories: LearningGoalBaselineCategory[] = [];
  const resourceType = canonicalBaselineResourceType(row);
  if (resourceType === 'knowledge_card' || resourceType === 'textbook_section' || resourceType === 'lesson_step' || resourceType === 'handout' || resourceType === 'slides' || row.family === 'knowledge-infograph') {
    categories.push('concept');
  }
  if (resourceType === 'quiz' || resourceType === 'adaptive_quiz') {
    categories.push('diagnostic');
    categories.push('practice');
  }
  if (resourceType === 'simulation' || resourceType === 'control_workbench' || resourceType === 'arena_task' || resourceType === 'external_resource' || resourceType === 'project') {
    categories.push('practice');
  }
  if (resourceType === 'checkpoint') categories.push('checkpoint');
  if (resourceType === 'reflection' || resourceType === 'ai_intervention' || resourceType === 'konling') {
    categories.push('remediation');
  }
  if (row.groundingEligibility.citationReady) categories.push('citation');
  if (
    learningGoal.terminalValidationPolicy.required &&
    learningGoal.terminalValidationPolicy.terminalNodeTypes.includes(resourceType as never)
  ) {
    categories.push('terminal-validation');
  }
  return uniqueSorted(categories);
}

function canonicalBaselineResourceType(row: ResourceFieldCompletionAuditRow): string {
  if (row.resourceType === 'knowledge-card' || row.family === 'knowledge-card') return 'knowledge_card';
  if (row.resourceType === 'runtime-lesson-step' || row.family === 'runtime-lesson-step') return 'lesson_step';
  if (row.resourceType === 'runtime-lesson-module' || row.family === 'runtime-lesson-module') return 'lesson_step';
  if (row.resourceType === 'runtime-handout' || row.family === 'runtime-handout') return 'handout';
  if (row.resourceType === 'textbook-section' || row.family === 'textbook-section') return 'textbook_section';
  if (row.resourceType === 'authoring-textbook-section' || row.family === 'authoring-textbook-section') return 'textbook_section';
  if (row.resourceType === 'external-resource' || row.family === 'external-resource') return 'external_resource';
  if (row.resourceType === 'arena' || row.family === 'arena') return 'arena_task';
  return row.resourceType;
}

function isHighComplexityBaselineResource(row: ResourceFieldCompletionAuditRow): boolean {
  const resourceType = canonicalBaselineResourceType(row);
  return resourceType === 'simulation' ||
    resourceType === 'arena_task' ||
    resourceType === 'control_workbench' ||
    resourceType === 'project' ||
    resourceType === 'checkpoint';
}

function isReviewedBaselineRow(row: ResourceFieldCompletionAuditRow): boolean {
  return row.reviewStatus === 'human-confirmed' &&
    row.pathEligibility.current &&
    row.pathEligibility.blockedBy.length === 0 &&
    row.evidenceContract.complete &&
    Boolean(row.sourceHash) &&
    Boolean(row.sourceVersionRef) &&
    !row.missingFieldCodes.includes('missing-content-hash') &&
    !row.missingFieldCodes.includes('missing-evidence-contract') &&
    !row.missingFieldCodes.includes('provisional-metadata') &&
    !row.missingFieldCodes.includes('missing-human-review');
}

function isAssessmentRow(row: ResourceFieldCompletionAuditRow): boolean {
  const resourceType = canonicalBaselineResourceType(row);
  return resourceType === 'quiz' ||
    resourceType === 'adaptive_quiz' ||
    resourceType === 'checkpoint' ||
    resourceType === 'arena_task';
}

function requiredBaselineCategories(learningGoal: LearningGoalDefinition): LearningGoalBaselineCategory[] {
  return [
    'concept',
    'diagnostic',
    'practice',
    'checkpoint',
    'remediation',
    ...(learningGoal.terminalValidationPolicy.required ? ['terminal-validation' as const] : []),
  ];
}

function requiredBindingCount(category: LearningGoalBaselineCategory): number {
  return category === 'concept' ? 2 : 1;
}

function compareBaselineRows(left: ResourceFieldCompletionAuditRow, right: ResourceFieldCompletionAuditRow): number {
  return Number(right.pathEligibility.masteryAffecting) - Number(left.pathEligibility.masteryAffecting) ||
    Number(right.groundingEligibility.citationReady) - Number(left.groundingEligibility.citationReady) ||
    (left.estimatedTimeMinutes ?? 999) - (right.estimatedTimeMinutes ?? 999) ||
    left.resourceId.localeCompare(right.resourceId);
}

function countMissingCategories(
  limitations: readonly LearningGoalResourceBaselineLimitation[],
): Record<LearningGoalBaselineCategory, number> {
  return Object.fromEntries(BASELINE_CATEGORIES.map((category) => [
    category,
    limitations.filter((limitation) => limitation.missingBaselineCategories.includes(category)).length,
  ])) as Record<LearningGoalBaselineCategory, number>;
}

const BASELINE_CATEGORIES: LearningGoalBaselineCategory[] = [
  'concept',
  'diagnostic',
  'practice',
  'checkpoint',
  'remediation',
  'citation',
  'terminal-validation',
];

function uniqueSorted<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items)).sort((left, right) => left.localeCompare(right));
}
