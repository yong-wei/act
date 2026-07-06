import {
  buildAdaptiveLearningPathPlan,
  type AdaptiveLearningPathRegisteredGoalDefinition,
} from './adaptive-learning-path-planner';
import { expandLearningGoalSubgraph } from './graphs/goal-subgraph-expansion-service';
import type {
  LearningGoalResourceBaselineArtifacts,
  LearningGoalResourceBaselineReviewedBinding,
} from './learning-goal-resource-baseline';
import type { ResourceNodeRegistry } from './resource-node-registry';
import type {
  ResourceEvidenceLineageReadinessSummary,
  ResourceFieldCompletionAuditRow,
  ResourceFieldCompletionAuditSummary,
} from './resource-field-completion-audit';

export const FULL_RESOURCE_PATH_READINESS_GATE_VERSION = 'full-resource-path-readiness-gate.v1';

export const REQUIRED_PATH_READINESS_RESOURCE_FAMILIES = [
  'registered-resource',
  'runtime-lesson-step',
  'runtime-lesson-module',
  'runtime-lesson-media',
  'runtime-handout',
  'knowledge-card',
  'knowledge-infograph',
  'textbook',
  'textbook-section',
  'textbook-search-document',
  'authoring-textbook-chapter',
  'authoring-textbook-section',
  'authoring-textbook-figure',
  'authoring-textbook-caption',
] as const;

export const REQUIRED_PATH_READINESS_RESOURCE_TYPES = [
  'lesson_step',
  'runtime-lesson-step',
  'runtime-lesson-module',
  'runtime-lesson-media',
  'knowledge_card',
  'knowledge-card',
  'knowledge-infograph',
  'simulation',
  'control_workbench',
  'arena_task',
  'quiz',
  'adaptive_quiz',
  'checkpoint',
  'exercise',
  'textbook',
  'textbook_section',
  'textbook-section',
  'textbook-search-document',
  'reference',
  'authoring-textbook-section',
  'authoring-textbook-figure',
  'authoring-textbook-caption',
  'transcript',
  'slides',
  'video',
  'audio',
  'image-description',
  'handout',
] as const;

export interface LearningGoalPathGenerationDiagnostic {
  learningGoalId: string;
  attempted: boolean;
  generationStatus: 'ready' | 'fallback' | 'blocked' | 'not-evaluated';
  fallbackReasons: string[];
  blockingReasons: string[];
  selectedResourceIds: string[];
  selectedResourceTypes: string[];
  resourceCount: number;
  resourceTypeCount: number;
  unreviewedSelectedResourceIds: string[];
  missingCitationMetadataResourceIds: string[];
}

export interface FullResourcePathReadinessWorkqueueItem {
  resourceId?: string;
  missingFieldCode?: string;
  followupBucket?: string;
}

export interface FullResourcePathReadinessDispositionSummary {
  totals: {
    reviewedResources: number;
    unresolvedDispositionBlockers: number;
  };
  byClassification?: Record<string, number>;
  bySourceFamily?: Record<string, number>;
  downstreamBlockers?: Record<string, number>;
}

export interface FullResourcePathReadinessFinding {
  id: string;
  severity: 'blocking' | 'warning';
  count: number;
  message: string;
  evidenceRefs: string[];
}

export interface FullResourcePathReadinessGateReport {
  artifactVersion: typeof FULL_RESOURCE_PATH_READINESS_GATE_VERSION;
  generatedAt: string;
  status: 'passed' | 'failed';
  sourceArtifacts: {
    resourceFieldCompletion: string;
    dispositionReview: string;
    evidenceLineageReadiness: string;
    learningGoalBaselineMatrix: string;
    learningGoalReviewedBindings: string;
  };
  resourceCoverage: {
    totalResources: number;
    familyTotals: Record<string, number>;
    dispositionClassifications: Record<string, number>;
    unaccountedCount: number;
    invalidPromotionCount: number;
    unreviewedSemanticCount: number;
    unresolvedGraphNodeResourceMissingCount: number;
    downstreamBlockers: Record<string, number>;
    unresolvedDownstreamPathBlockers: number;
    evidenceLineageBlockerCount: number;
    followupBuckets: Record<string, number>;
    yangFanFixtureBlockers: ResourceEvidenceLineageReadinessSummary['yangFanFixtureBlockers'];
  };
  learningGoalDiagnostics: {
    registeredLearningGoals: number;
    diagnosedLearningGoals: number;
    missingDiagnosticLearningGoalIds: string[];
    gapDiagnostics: Array<{
      learningGoalId: string;
      coverageState: 'complete' | 'limited';
      missingBaselineCategories: string[];
      reviewedBindingCount: number;
      limitationReason: string | null;
    }>;
    completeLearningGoals: number;
    limitedLearningGoals: number;
    limitedLearningGoalIds: string[];
    reviewedBindings: number;
    pathGenerationDiagnostics: LearningGoalPathGenerationDiagnostic[];
    attemptedPathGenerationCount: number;
    blockedPathGenerationCount: number;
    notEvaluatedPathGenerationCount: number;
    resourceMixNotEvaluatedLearningGoals: number;
    citationNotEvaluatedLearningGoals: number;
    resourceMixCheckedLearningGoals: number;
    singleResourceFallbackRiskCount: number;
    singleFamilyFallbackRiskCount: number;
    citationFailureCount: number;
  };
  futureResourceImportCoverage: {
    requiredFamilies: string[];
    auditedFamilies: string[];
    missingAuditedFamilies: string[];
    requiredResourceTypes: string[];
    auditedResourceTypes: string[];
    missingAuditedResourceTypes: string[];
  };
  findings: FullResourcePathReadinessFinding[];
  roleSafeSummary: {
    student: {
      exposeInternalDiagnostics: false;
      message: string;
    };
    teacherAdmin: {
      exposeInternalDiagnostics: true;
      diagnosticFields: string[];
    };
  };
}

export function buildFullResourcePathReadinessGate(input: {
  generatedAt?: string;
  resourceSummary: ResourceFieldCompletionAuditSummary;
  auditRows: readonly ResourceFieldCompletionAuditRow[];
  workqueueItems: readonly FullResourcePathReadinessWorkqueueItem[];
  dispositionReviewSummary: FullResourcePathReadinessDispositionSummary;
  evidenceLineageSummary: ResourceEvidenceLineageReadinessSummary;
  learningGoalBaselineMatrix: LearningGoalResourceBaselineArtifacts['matrix'];
  reviewedBindings: readonly LearningGoalResourceBaselineReviewedBinding[];
  pathGenerationDiagnostics?: readonly LearningGoalPathGenerationDiagnostic[];
}): FullResourcePathReadinessGateReport {
  const registeredLearningGoalIds = input.learningGoalBaselineMatrix.registeredLearningGoalIds ??
    input.learningGoalBaselineMatrix.batchLearningGoalIds;
  const diagnosedLearningGoalIds = input.learningGoalBaselineMatrix.rows.map((row) => row.learningGoalId);
  const missingDiagnosticLearningGoalIds = difference(registeredLearningGoalIds, diagnosedLearningGoalIds);
  const completeRows = input.learningGoalBaselineMatrix.rows.filter((row) => row.coverageState === 'complete');
  const limitedRows = input.learningGoalBaselineMatrix.rows.filter((row) => row.coverageState === 'limited');
  const pathGenerationDiagnostics = input.pathGenerationDiagnostics ?? [];
  const resourceMixDiagnostics = summarizeResourceMixDiagnostics(pathGenerationDiagnostics);
  const citationFailureCount = pathGenerationDiagnostics.reduce(
    (count, diagnostic) => count + diagnostic.missingCitationMetadataResourceIds.length,
    0,
  );
  const selectedUnreviewedResourceCount = pathGenerationDiagnostics.reduce(
    (count, diagnostic) => count + diagnostic.unreviewedSelectedResourceIds.length,
    0,
  );
  const followupBuckets = summarizeFollowupBuckets(input.workqueueItems);
  const unaccountedCount = input.dispositionReviewSummary.totals.unresolvedDispositionBlockers;
  const downstreamBlockers = input.dispositionReviewSummary.downstreamBlockers ?? {};
  const unresolvedDownstreamPathBlockers = (downstreamBlockers['path-readiness'] ?? 0) +
    (downstreamBlockers['runtime-identity'] ?? 0) +
    (downstreamBlockers.dependency ?? 0);
  const invalidPromotionCount = countInvalidPromotions(input.auditRows);
  const unreviewedSemanticCount = countUnreviewedSemanticRows(input.resourceSummary);
  const unresolvedGraphNodeResourceMissingCount = countUnresolvedGraphNodeResourceMissing(input.auditRows);
  const missingAuditedFamilies = difference(
    [...REQUIRED_PATH_READINESS_RESOURCE_FAMILIES],
    Object.keys(input.resourceSummary.byFamily),
  );
  const resourceTypeTotals = summarizeResourceTypes(input.auditRows);
  const missingAuditedResourceTypes = difference(
    [...REQUIRED_PATH_READINESS_RESOURCE_TYPES],
    Object.keys(resourceTypeTotals),
  );
  const missingPathGenerationDiagnosticCount = Math.max(0, registeredLearningGoalIds.length - pathGenerationDiagnostics.length);
  const blockedPathGenerationCount = pathGenerationDiagnostics.filter((diagnostic) =>
    diagnostic.generationStatus === 'blocked' || diagnostic.blockingReasons.length > 0
  ).length;
  const notEvaluatedPathGenerationCount = pathGenerationDiagnostics.filter((diagnostic) =>
    diagnostic.generationStatus === 'not-evaluated'
  ).length + missingPathGenerationDiagnosticCount;
  const resourceMixNotEvaluatedLearningGoals = pathGenerationDiagnostics.filter((diagnostic) =>
    diagnostic.resourceCount === 0
  ).length + missingPathGenerationDiagnosticCount;
  const citationNotEvaluatedLearningGoals = pathGenerationDiagnostics.filter((diagnostic) =>
    diagnostic.resourceCount === 0
  ).length + missingPathGenerationDiagnosticCount;

  const findings = [
    findingIf('unaccounted-resource-disposition', unaccountedCount, 'blocking', 'Resources are missing a reviewed path-planning disposition.', ['resource-disposition-backlog-review-summary.json']),
    findingIf('unresolved-downstream-path-blockers', unresolvedDownstreamPathBlockers, 'blocking', 'Reviewed disposition output still carries downstream path-readiness, runtime-identity, or dependency blockers.', ['resource-disposition-backlog-review-summary.json']),
    findingIf('invalid-path-promotion', invalidPromotionCount, 'blocking', 'Resources are marked path-current without complete human-reviewed governance.', ['resource-field-completion-audit.jsonl']),
    findingIf('unreviewed-resource-semantics', unreviewedSemanticCount, 'blocking', 'Resources still require reviewed semantic fields or reviewed limitations.', ['resource-field-completion-summary.json']),
    findingIf('unresolved-graph-node-resource-missing', unresolvedGraphNodeResourceMissingCount, 'blocking', 'Resources still lack reviewed graph knowledge or capability bindings.', ['resource-field-completion-audit.jsonl']),
    findingIf('evidence-lineage-blockers', input.evidenceLineageSummary.evidenceLineageBlockerCount, 'blocking', 'Evidence-producing path resources still have hard evidence-lineage blockers.', ['resource-evidence-lineage-readiness-summary.json']),
    findingIf('yang-fan-fixture-blockers', input.evidenceLineageSummary.yangFanFixtureBlockers.blockerCount, 'blocking', 'Yang Fan fixture generation remains blocked by path-relevant lineage limitations.', ['resource-evidence-lineage-readiness-summary.json']),
    findingIf('learning-goal-diagnostics-missing', missingDiagnosticLearningGoalIds.length, 'blocking', 'Registered LearningGoals are missing baseline diagnostics.', ['learning-goal-resource-baseline-matrix.json']),
    findingIf('learning-goal-path-generation-not-evaluated', notEvaluatedPathGenerationCount, 'blocking', 'Registered LearningGoals are missing real planner generation attempts.', ['full-resource-path-readiness-gate-summary.json']),
    findingIf('learning-goal-path-generation-blocked', blockedPathGenerationCount, 'blocking', 'Registered LearningGoals attempted path generation but reported blocking planner reasons.', ['full-resource-path-readiness-gate-summary.json']),
    findingIf('learning-goal-baseline-limited', limitedRows.length, 'warning', 'LearningGoals have precise resource-gap diagnostics instead of production path-ready baselines.', ['learning-goal-resource-baseline-limitations.json']),
    findingIf('single-resource-fallback-risk', resourceMixDiagnostics.singleResourceFallbackRiskCount, 'blocking', 'Complete LearningGoal baselines must not collapse to one resource.', ['learning-goal-resource-baseline-reviewed-bindings.jsonl']),
    findingIf('single-family-fallback-risk', resourceMixDiagnostics.singleFamilyFallbackRiskCount, 'blocking', 'Complete LearningGoal baselines must include more than cosmetic same-family variants.', ['learning-goal-resource-baseline-reviewed-bindings.jsonl']),
    findingIf('learning-goal-unreviewed-selected-resources', selectedUnreviewedResourceCount, 'blocking', 'Planner-generated paths selected resources without reviewed governed bindings.', ['full-resource-path-readiness-gate-summary.json']),
    findingIf('learning-goal-citation-failures', citationFailureCount, 'blocking', 'Reviewed LearningGoal bindings must preserve governed source, hash, and version citation metadata.', ['learning-goal-resource-baseline-reviewed-bindings.jsonl']),
    findingIf('resource-family-audit-missing', missingAuditedFamilies.length, 'blocking', 'Required resource families are absent from the helper output and could bypass future import auditing.', ['resource-field-completion-summary.json']),
    findingIf('resource-type-audit-missing', missingAuditedResourceTypes.length, 'warning', 'Required future import resource types are not currently represented in helper output; future imports must not bypass this audit.', ['resource-field-completion-audit.jsonl']),
  ].filter((item): item is FullResourcePathReadinessFinding => Boolean(item));

  return {
    artifactVersion: FULL_RESOURCE_PATH_READINESS_GATE_VERSION,
    generatedAt: input.generatedAt ?? input.resourceSummary.generatedAt,
    status: findings.some((item) => item.severity === 'blocking') ? 'failed' : 'passed',
    sourceArtifacts: {
      resourceFieldCompletion: 'course-content/runtime/resource-governance/resource-field-completion-summary.json',
      dispositionReview: 'course-content/runtime/resource-governance/resource-disposition-backlog-review-summary.json',
      evidenceLineageReadiness: 'course-content/runtime/resource-governance/resource-evidence-lineage-readiness-summary.json',
      learningGoalBaselineMatrix: 'course-content/runtime/resource-governance/learning-goal-resource-baseline-matrix.json',
      learningGoalReviewedBindings: 'course-content/runtime/resource-governance/learning-goal-resource-baseline-reviewed-bindings.jsonl',
    },
    resourceCoverage: {
      totalResources: input.resourceSummary.totals.denominator,
      familyTotals: Object.fromEntries(Object.entries(input.resourceSummary.byFamily)
        .map(([family, summary]) => [family, summary.denominator])),
      dispositionClassifications: input.dispositionReviewSummary.byClassification ?? {},
      unaccountedCount,
      invalidPromotionCount,
      unreviewedSemanticCount,
      unresolvedGraphNodeResourceMissingCount,
      downstreamBlockers,
      unresolvedDownstreamPathBlockers,
      evidenceLineageBlockerCount: input.evidenceLineageSummary.evidenceLineageBlockerCount,
      followupBuckets,
      yangFanFixtureBlockers: input.evidenceLineageSummary.yangFanFixtureBlockers,
    },
    learningGoalDiagnostics: {
      registeredLearningGoals: registeredLearningGoalIds.length,
      diagnosedLearningGoals: diagnosedLearningGoalIds.length,
      missingDiagnosticLearningGoalIds,
      gapDiagnostics: input.learningGoalBaselineMatrix.rows.map((row) => ({
        learningGoalId: row.learningGoalId,
        coverageState: row.coverageState,
        missingBaselineCategories: row.missingBaselineCategories,
        reviewedBindingCount: row.denominator.reviewedBindingCount,
        limitationReason: row.limitationReason,
      })),
      completeLearningGoals: completeRows.length,
      limitedLearningGoals: limitedRows.length,
      limitedLearningGoalIds: limitedRows.map((row) => row.learningGoalId),
      reviewedBindings: input.reviewedBindings.length,
      pathGenerationDiagnostics: [...pathGenerationDiagnostics],
      attemptedPathGenerationCount: pathGenerationDiagnostics.filter((diagnostic) => diagnostic.attempted).length,
      blockedPathGenerationCount,
      notEvaluatedPathGenerationCount,
      resourceMixNotEvaluatedLearningGoals,
      citationNotEvaluatedLearningGoals,
      resourceMixCheckedLearningGoals: pathGenerationDiagnostics.filter((diagnostic) => diagnostic.resourceCount > 0).length,
      singleResourceFallbackRiskCount: resourceMixDiagnostics.singleResourceFallbackRiskCount,
      singleFamilyFallbackRiskCount: resourceMixDiagnostics.singleFamilyFallbackRiskCount,
      citationFailureCount,
    },
    futureResourceImportCoverage: {
      requiredFamilies: [...REQUIRED_PATH_READINESS_RESOURCE_FAMILIES],
      auditedFamilies: Object.keys(input.resourceSummary.byFamily).sort((left, right) => left.localeCompare(right)),
      missingAuditedFamilies,
      requiredResourceTypes: [...REQUIRED_PATH_READINESS_RESOURCE_TYPES],
      auditedResourceTypes: Object.keys(resourceTypeTotals).sort((left, right) => left.localeCompare(right)),
      missingAuditedResourceTypes,
    },
    findings,
    roleSafeSummary: {
      student: {
        exposeInternalDiagnostics: false,
        message: 'Some learning paths are limited while reviewed resources and evidence metadata are being completed.',
      },
      teacherAdmin: {
        exposeInternalDiagnostics: true,
        diagnosticFields: [
          'resourceCoverage',
          'learningGoalDiagnostics',
          'futureResourceImportCoverage',
          'findings',
        ],
      },
    },
  };
}

export function renderFullResourcePathReadinessGateEvidence(report: FullResourcePathReadinessGateReport): string {
  const lines = [
    '# Full Resource Path Readiness Gate',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    '',
    '## Resource Coverage',
    '',
    `Total resources: ${report.resourceCoverage.totalResources}`,
    `Unaccounted resources: ${report.resourceCoverage.unaccountedCount}`,
    `Invalid path promotions: ${report.resourceCoverage.invalidPromotionCount}`,
    `Unreviewed semantic rows: ${report.resourceCoverage.unreviewedSemanticCount}`,
    `Unresolved graph-node resource gaps: ${report.resourceCoverage.unresolvedGraphNodeResourceMissingCount}`,
    `Unresolved downstream path blockers: ${report.resourceCoverage.unresolvedDownstreamPathBlockers}`,
    `Evidence-lineage blockers: ${report.resourceCoverage.evidenceLineageBlockerCount}`,
    `Yang Fan fixture blockers: ${report.resourceCoverage.yangFanFixtureBlockers.blockerCount}`,
    '',
    '## LearningGoal Diagnostics',
    '',
    `Registered LearningGoals: ${report.learningGoalDiagnostics.registeredLearningGoals}`,
    `Diagnosed LearningGoals: ${report.learningGoalDiagnostics.diagnosedLearningGoals}`,
    `Missing diagnostics: ${report.learningGoalDiagnostics.missingDiagnosticLearningGoalIds.join(', ') || 'none'}`,
    `Complete baselines: ${report.learningGoalDiagnostics.completeLearningGoals}`,
    `Limited baselines: ${report.learningGoalDiagnostics.limitedLearningGoals}`,
    `Reviewed bindings: ${report.learningGoalDiagnostics.reviewedBindings}`,
    `Attempted path generations: ${report.learningGoalDiagnostics.attemptedPathGenerationCount}`,
    `Blocked path generations: ${report.learningGoalDiagnostics.blockedPathGenerationCount}`,
    `Not evaluated path generations: ${report.learningGoalDiagnostics.notEvaluatedPathGenerationCount}`,
    `Resource mix not evaluated: ${report.learningGoalDiagnostics.resourceMixNotEvaluatedLearningGoals}`,
    `Citation metadata not evaluated: ${report.learningGoalDiagnostics.citationNotEvaluatedLearningGoals}`,
    `Single-resource fallback risks: ${report.learningGoalDiagnostics.singleResourceFallbackRiskCount}`,
    `Single-family fallback risks: ${report.learningGoalDiagnostics.singleFamilyFallbackRiskCount}`,
    `Citation failures: ${report.learningGoalDiagnostics.citationFailureCount}`,
    '',
    '### Gap Diagnostics',
    '',
    ...report.learningGoalDiagnostics.gapDiagnostics.map((diagnostic) =>
      `- ${diagnostic.learningGoalId}: ${diagnostic.coverageState}; missing ${diagnostic.missingBaselineCategories.join(', ') || 'none'}; reviewed bindings ${diagnostic.reviewedBindingCount}`
    ),
    '',
    '### Path Generation Attempts',
    '',
    ...report.learningGoalDiagnostics.pathGenerationDiagnostics.map((diagnostic) =>
      `- ${diagnostic.learningGoalId}: ${diagnostic.generationStatus}; fallback ${diagnostic.fallbackReasons.join(', ') || 'none'}; selected resources ${diagnostic.resourceCount}; selected types ${diagnostic.selectedResourceTypes.join(', ') || 'none'}`
    ),
    '',
    '## Future Import Coverage',
    '',
    `Missing audited families: ${report.futureResourceImportCoverage.missingAuditedFamilies.join(', ') || 'none'}`,
    `Missing audited resource types: ${report.futureResourceImportCoverage.missingAuditedResourceTypes.join(', ') || 'none'}`,
    '',
    '## Findings',
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('Findings: none');
  } else {
    for (const finding of report.findings) {
      lines.push(`- [${finding.severity}] ${finding.id}: ${finding.count} - ${finding.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function buildLearningGoalPathGenerationDiagnostics(input: {
  registeredGoals: Record<string, AdaptiveLearningPathRegisteredGoalDefinition>;
  registry: ResourceNodeRegistry;
  learningGoalBaselineMatrix: LearningGoalResourceBaselineArtifacts['matrix'];
  reviewedBindings: readonly LearningGoalResourceBaselineReviewedBinding[];
  now?: Date;
}): LearningGoalPathGenerationDiagnostic[] {
  const baselineByGoalId = new Map(input.learningGoalBaselineMatrix.rows.map((row) => [row.learningGoalId, row]));
  const reviewedBindingByResourceId = new Map(input.reviewedBindings.map((binding) => [binding.resourceId, binding]));
  return Object.values(input.registeredGoals)
    .filter((registeredGoal) => Boolean(registeredGoal.learningGoal))
    .map((registeredGoal) => {
      const learningGoal = registeredGoal.learningGoal!;
      const baseline = baselineByGoalId.get(learningGoal.id);
      const expandedSubgraph = expandLearningGoalSubgraph(learningGoal.id);
      const plan = buildAdaptiveLearningPathPlan({
        studentId: 'full-resource-path-readiness-gate',
        goal: registeredGoal.goal,
        learnerState: buildGateLearnerState(registeredGoal),
        registry: input.registry,
        graphContext: {
          learningGoalId: learningGoal.id,
          learningGoalVersion: learningGoal.version,
          objectiveBoundary: {
            knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
            capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
            qualityObjectiveIds: learningGoal.qualityObjectiveIds,
          },
          expandedSubgraph,
          selectedGraphNodeIds: learningGoal.targetGraphNodeIds,
          learningGoalBaseline: baseline
            ? {
                coverageState: baseline.coverageState,
                missingBaselineCategories: baseline.missingBaselineCategories,
                reviewedBindingCount: baseline.denominator.reviewedBindingCount,
                limitationReason: baseline.limitationReason,
                sourceWindow: baseline.denominator.sourceWindow,
              }
            : null,
        },
        constraints: {
          timeBudgetMinutes: 90,
          privacyScopes: ['student-visible'],
          device: 'desktop',
          timelineWindowDays: 7,
        },
        difficultyRhythm: registeredGoal.starterPathPolicy.difficultyRhythm,
        resourcePreferences: registeredGoal.starterPathPolicy.preferredResourceTypes,
        checkpointPreference: 'standard',
        allowExternalResources: registeredGoal.starterPathPolicy.allowExternalResources,
        now: input.now ?? new Date('2026-07-04T16:30:00.000Z'),
      });
      const selectedResourceIds = uniqueSorted(plan.mainPath.map((node) =>
        node.resourceNodeId ?? node.resourceId ?? node.nodeId
      ));
      const selectedResourceTypes = uniqueSorted(plan.mainPath.map((node) => node.type));
      const unreviewedSelectedResourceIds = selectedResourceIds.filter((resourceId) =>
        !reviewedBindingByResourceId.has(resourceId)
      );
      const missingCitationMetadataResourceIds = selectedResourceIds.filter((resourceId) => {
        const binding = reviewedBindingByResourceId.get(resourceId);
        return !binding?.sourcePathOrUrl || !binding.sourceHash || !binding.sourceVersionRef;
      });
      const blockingReasons = plan.explanations.fallbackReasons.filter((reason) => (
        reason === 'learning-goal-baseline-incomplete' ||
        reason === 'resource-mapping-insufficient' ||
        reason === 'feasible-goal-path-missing' ||
        reason === 'terminal-validation-resource-missing' ||
        reason === 'learning-goal-assessment-coverage-incomplete'
      ));
      return {
        learningGoalId: learningGoal.id,
        attempted: true,
        generationStatus: plan.mainPath.length === 0 || blockingReasons.length > 0
          ? 'blocked'
          : plan.status,
        fallbackReasons: plan.explanations.fallbackReasons,
        blockingReasons,
        selectedResourceIds,
        selectedResourceTypes,
        resourceCount: selectedResourceIds.length,
        resourceTypeCount: selectedResourceTypes.length,
        unreviewedSelectedResourceIds,
        missingCitationMetadataResourceIds,
      };
    });
}

function buildGateLearnerState(
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition,
) {
  return {
    knowledgeMastery: {
      tags: Object.fromEntries(registeredGoal.goal.knowledgeTargets.map((target) => [
        target,
        { posteriorMastery: 0.25, confidence: 0.7, evidenceCount: 2 },
      ])),
    },
    primaryCompetencies: {
      vector: Object.fromEntries((registeredGoal.goal.competencyTargets ?? []).map((target) => [
        target,
        { score: 0.35, confidence: 0.7, evidenceCount: 2 },
      ])),
    },
    evidence: {
      confidence: {
        level: 'medium' as const,
        score: 0.7,
        evidenceCount: 8,
        sourceCompleteness: 0.7,
      },
      sourceCoverage: {
        LearningFact: 'available',
        StudentCompetencySnapshot: 'available',
      },
    },
  };
}

function summarizeResourceMixDiagnostics(
  pathGenerationDiagnostics: readonly LearningGoalPathGenerationDiagnostic[],
) {
  let singleResourceFallbackRiskCount = 0;
  let singleFamilyFallbackRiskCount = 0;
  for (const diagnostic of pathGenerationDiagnostics) {
    if (diagnostic.resourceCount === 0) continue;
    if (diagnostic.resourceCount < 2) singleResourceFallbackRiskCount += 1;
    if (diagnostic.resourceTypeCount < 2) singleFamilyFallbackRiskCount += 1;
  }

  return { singleResourceFallbackRiskCount, singleFamilyFallbackRiskCount };
}

function summarizeResourceTypes(rows: readonly ResourceFieldCompletionAuditRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    totals[row.resourceType] = (totals[row.resourceType] ?? 0) + 1;
  }
  return totals;
}

function summarizeFollowupBuckets(items: readonly FullResourcePathReadinessWorkqueueItem[]): Record<string, number> {
  const buckets: Record<string, number> = {};
  for (const item of items) {
    if (!item.followupBucket) continue;
    buckets[item.followupBucket] = (buckets[item.followupBucket] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(buckets).sort(([left], [right]) => left.localeCompare(right)));
}

function countInvalidPromotions(rows: readonly ResourceFieldCompletionAuditRow[]): number {
  return rows.filter((row) => (
    row.pathEligibility.current &&
    (
      row.reviewStatus !== 'human-confirmed' ||
      row.pathEligibility.blockedBy.length > 0 ||
      !row.evidenceContract.complete
    )
  )).length;
}

function countUnreviewedSemanticRows(summary: ResourceFieldCompletionAuditSummary): number {
  return Object.entries(summary.byReviewStatus)
    .filter(([status]) => status !== 'human-confirmed')
    .reduce((total, [, count]) => total + count, 0);
}

function countUnresolvedGraphNodeResourceMissing(rows: readonly ResourceFieldCompletionAuditRow[]): number {
  return rows.filter((row) => (
    row.missingFieldCodes.includes('missing-knowledge-binding') ||
    row.missingFieldCodes.includes('missing-capability-target')
  )).length;
}

function findingIf(
  id: string,
  count: number,
  severity: FullResourcePathReadinessFinding['severity'],
  message: string,
  evidenceRefs: string[],
): FullResourcePathReadinessFinding | null {
  if (count === 0) return null;
  return { id, severity, count, message, evidenceRefs };
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item)).sort((a, b) => a.localeCompare(b));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
