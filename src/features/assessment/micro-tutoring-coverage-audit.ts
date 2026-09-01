import { createHash, createHmac } from 'node:crypto';

import type { AdaptiveAssessmentCatalogItem } from '@/features/assessment/adaptive-assessment-item-catalog';
import { evaluateAssessmentEvidenceAuthority } from '@/features/assessment/assessment-evidence-authority';
import type { AssessmentItemSemanticReviewDecision } from '@/features/assessment/adaptive-assessment-semantic-review';
import {
  isMicroTutoringOptionAttribution,
  optionAttributionKey,
  type MicroTutoringOptionAttribution,
} from './micro-tutoring-option-attribution';
import {
  loadMicroTutoringGoalNodeCatalog,
  resolveMicroTutoringGoalNode,
  type MicroTutoringGoalNodeSourceContext,
} from './micro-tutoring-goal-node-catalog';

export type { MicroTutoringOptionAttribution } from './micro-tutoring-option-attribution';

export const MICRO_TUTORING_COVERAGE_AUDIT_VERSION = 'micro-tutoring-coverage-audit.v1';
export const MICRO_TUTORING_COVERAGE_AUDIT_V2_VERSION = 'micro-tutoring-coverage-audit.v2';
export const MICRO_TUTORING_PRACTICE_BASELINE_VERSION = 'micro-tutoring-practice-baseline.v1';
export const MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT = 54;
export const MICRO_TUTORING_ASSESSMENT_BASELINE_V2_VERSION = 'micro-tutoring-assessment-baseline.v2';
export const MICRO_TUTORING_ASSESSMENT_BASELINE_V2_ITEM_COUNT = 135;
export const MICRO_TUTORING_V2_ERROR_OPTION_COUNT = 272;
export const MICRO_TUTORING_ASSESSMENT_BASELINE_V2_STAGE_COUNTS = {
  practice: 54,
  checkpoint: 27,
  remediation: 27,
  readiness: 2,
  'readiness-gate': 25,
} as const;

export type MicroTutoringCoverageProfile = 'v1' | 'v2';
export type MicroTutoringCoverageAuditArtifactVersion =
  | typeof MICRO_TUTORING_COVERAGE_AUDIT_VERSION
  | typeof MICRO_TUTORING_COVERAGE_AUDIT_V2_VERSION;

export type MicroTutoringCoverageGapReason =
  | 'ATTRIBUTION_UNCERTAIN'
  | 'CANONICAL_NODE_UNAVAILABLE'
  | 'RESOURCE_UNAVAILABLE'
  | 'VALIDATION_QUESTION_UNAVAILABLE'
  | 'ACCESS_REVOKED'
  | 'REFERENCE_DRIFT';

export type MicroTutoringCoverageBaselineIssue =
  | 'BASELINE_ITEM_COUNT_DRIFT'
  | 'BASELINE_VERSION_UNSUPPORTED'
  | 'BASELINE_ITEM_MISSING'
  | 'BASELINE_ITEM_EXTRA'
  | 'BASELINE_ITEM_DUPLICATE'
  | 'CONTENT_HASH_DRIFT';

export type MicroTutoringOptionAttributionIssueReason =
  | 'ATTRIBUTION_RECORD_MALFORMED'
  | 'ATTRIBUTION_RECORD_UNKNOWN_CATALOG_ITEM'
  | 'ATTRIBUTION_RECORD_CONTENT_HASH_DRIFT'
  | 'ATTRIBUTION_RECORD_NOT_AUDITED_ERROR_OPTION'
  | 'ATTRIBUTION_RECORD_REVIEW_EVIDENCE_INVALID'
  | 'ATTRIBUTION_RECORD_REVIEW_EVIDENCE_REUSED'
  | 'ATTRIBUTION_RECORD_DUPLICATE'
  | 'GOAL_NODE_CATALOG_INVALID'
  | 'GOAL_NODE_UNRESOLVED'
  | 'GOAL_NODE_CONFLICT';

export interface MicroTutoringPracticeBaseline {
  version: string;
  itemCount?: number;
  stageCounts?: Partial<Record<string, number>>;
  entries: Array<{
    catalogItemId: string;
    contentHash: string;
    assessmentStage?: string;
  }>;
}

export interface GovernedMicroTutoringResource {
  id: string;
  version: string;
  estimatedMinutes: number;
  actionPath: string;
}

export interface GovernedMicroTutoringValidationItem {
  id: string;
  questionId: string;
  contentHash: string;
  version: string;
  estimatedMinutes: number;
  actionPath: string;
}

export interface MicroTutoringCoverageAuditInput {
  catalogItems: AdaptiveAssessmentCatalogItem[];
  reviewDecisions: AssessmentItemSemanticReviewDecision[];
  baseline: MicroTutoringPracticeBaseline;
  coverageProfile?: MicroTutoringCoverageProfile;
  optionAttributions: unknown[];
  goalNodeCatalogSource?: unknown;
  goalNodeSourceContext?: MicroTutoringGoalNodeSourceContext;
  optionReferenceSecret: string;
  activeLearningGoalIds: Iterable<string>;
  activeKnowledgeNodeIds: Iterable<string>;
  resolveResources: (knowledgeNodeId: string, misconceptionTag: string) => GovernedMicroTutoringResource[];
  resolveValidationItems: (
    sourceQuestionId: string,
    sourceContentHash: string,
    knowledgeNodeId: string,
    misconceptionTag: string,
  ) => GovernedMicroTutoringValidationItem[];
  resolveResourceAccessDenied?: (knowledgeNodeId: string, misconceptionTag: string) => boolean;
  resolveValidationAccessDenied?: (
    sourceQuestionId: string,
    knowledgeNodeId: string,
    misconceptionTag: string,
  ) => boolean;
  dependencyIssues?: MicroTutoringCoverageGapReason[];
  inputCapture?: {
    sourceRevision: string;
    sourceInputsClean: boolean;
    governedProjectionRevision: string | null;
  };
}

export interface MicroTutoringCoverageRow {
  catalogItemId: string;
  contentHash: string;
  errorOptionRef: string;
  learningGoalId: string | null;
  misconceptionTag: string | null;
  knowledgeNodeId: string | null;
  attributionVersion: string | null;
  resources: GovernedMicroTutoringResource[];
  validationItems: GovernedMicroTutoringValidationItem[];
  status: 'COMPLETE' | 'GAP';
  reasons: MicroTutoringCoverageGapReason[];
}

export interface MicroTutoringCoverageAuditReport {
  artifactVersion: MicroTutoringCoverageAuditArtifactVersion;
  coverageProfile: MicroTutoringCoverageProfile;
  baselineItemCount: number;
  qualifiedPracticeItemCount: number;
  qualifiedItemCount: number;
  stageCounts?: Record<string, number>;
  errorOptionCount: number;
  completeOptionCount: number;
  gapOptionCount: number;
  attributionIssueCount: number;
  inputCapture?: {
    sourceRevision: string;
    sourceInputsClean: boolean;
    governedProjectionRevision: string | null;
  };
  baselineIssues: Array<{
    reason: MicroTutoringCoverageBaselineIssue;
    catalogItemId: string;
    expectedContentHash?: string;
    actualContentHash?: string;
    expectedItemCount?: number;
    actualItemCount?: number;
  }>;
  attributionIssues: Array<{
    reason: MicroTutoringOptionAttributionIssueReason;
    attributionRef: string;
  }>;
  gapReasonCounts: Record<MicroTutoringCoverageGapReason, number>;
  rows: MicroTutoringCoverageRow[];
  contentDigest: string;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function stableOptionReference(value: string, secret: string): string {
  return `hmac-sha256:${createHmac('sha256', secret).update(value).digest('hex')}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function attributionRecord(value: unknown): Partial<MicroTutoringOptionAttribution> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<MicroTutoringOptionAttribution>
    : null;
}

function hasAttributionIdentity(value: Partial<MicroTutoringOptionAttribution>): value is Pick<
  MicroTutoringOptionAttribution,
  'catalogItemId' | 'contentHash' | 'optionKey'
> {
  return isNonEmptyString(value.catalogItemId) &&
    isNonEmptyString(value.contentHash) &&
    isNonEmptyString(value.optionKey);
}

function attributionReference(value: unknown, index: number, secret: string): string {
  const attribution = attributionRecord(value);
  const identity = attribution && hasAttributionIdentity(attribution)
    ? optionAttributionKey(attribution.catalogItemId, attribution.contentHash, attribution.optionKey)
    : `malformed:${index}`;
  return stableOptionReference(`attribution:${identity}`, secret);
}

function practiceItems(
  items: AdaptiveAssessmentCatalogItem[],
  decisions: AssessmentItemSemanticReviewDecision[],
): AdaptiveAssessmentCatalogItem[] {
  const decisionByItemId = new Map(decisions.map((decision) => [decision.catalogItemId, decision]));
  return items.filter((item) => {
    const decision = decisionByItemId.get(item.catalogItemId);
    if (!decision || decision.decisionKind !== 'human-review' || decision.outcome !== 'approved') return false;
    return evaluateAssessmentEvidenceAuthority(item, decision, {
      requestedStage: 'low-stakes-practice',
    }).mastery;
  }).sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));
}

function v2BaselineItems(
  items: AdaptiveAssessmentCatalogItem[],
  decisions: AssessmentItemSemanticReviewDecision[],
  baseline: MicroTutoringPracticeBaseline,
): AdaptiveAssessmentCatalogItem[] {
  const itemById = new Map(items.map((item) => [item.catalogItemId, item]));
  const decisionById = new Map(decisions.map((decision) => [decision.catalogItemId, decision]));
  return baseline.entries.flatMap((entry) => {
    const item = itemById.get(entry.catalogItemId);
    const decision = decisionById.get(entry.catalogItemId);
    if (!item || item.contentHash !== entry.contentHash) return [];
    if (!decision || decision.decisionKind !== 'human-review' || decision.outcome !== 'approved') return [];
    if (entry.assessmentStage && decision.selectedStagePurpose !== entry.assessmentStage) return [];
    return [item];
  }).sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));
}

function countBaselineStages(baseline: MicroTutoringPracticeBaseline): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of baseline.entries) {
    const stage = entry.assessmentStage?.trim();
    if (!stage) continue;
    counts[stage] = (counts[stage] ?? 0) + 1;
  }
  return counts;
}

function baselineIssues(
  baseline: MicroTutoringPracticeBaseline,
  qualifiedItems: AdaptiveAssessmentCatalogItem[],
  catalogItems: AdaptiveAssessmentCatalogItem[],
  profile: MicroTutoringCoverageProfile,
): MicroTutoringCoverageAuditReport['baselineIssues'] {
  const issues: MicroTutoringCoverageAuditReport['baselineIssues'] = [];
  const expectedVersion = profile === 'v2'
    ? MICRO_TUTORING_ASSESSMENT_BASELINE_V2_VERSION
    : MICRO_TUTORING_PRACTICE_BASELINE_VERSION;
  const expectedCount = profile === 'v2'
    ? MICRO_TUTORING_ASSESSMENT_BASELINE_V2_ITEM_COUNT
    : MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT;
  if (baseline.version !== expectedVersion) {
    issues.push({
      reason: 'BASELINE_VERSION_UNSUPPORTED',
      catalogItemId: baseline.version,
    });
  } else {
    if (baseline.entries.length !== expectedCount) {
      issues.push({
        reason: 'BASELINE_ITEM_COUNT_DRIFT',
        catalogItemId: baseline.version,
        expectedItemCount: expectedCount,
        actualItemCount: baseline.entries.length,
      });
    }
    if (qualifiedItems.length !== expectedCount) {
      issues.push({
        reason: 'BASELINE_ITEM_COUNT_DRIFT',
        catalogItemId: profile === 'v2' ? 'qualified-baseline-items' : 'qualified-practice-items',
        expectedItemCount: expectedCount,
        actualItemCount: qualifiedItems.length,
      });
    }
    if (profile === 'v2') {
      if ((baseline.itemCount ?? 0) !== expectedCount) {
        issues.push({
          reason: 'BASELINE_ITEM_COUNT_DRIFT',
          catalogItemId: 'declared-item-count',
          expectedItemCount: expectedCount,
          actualItemCount: baseline.itemCount ?? 0,
        });
      }
      const actualStages = countBaselineStages(baseline);
      for (const [stage, expected] of Object.entries(MICRO_TUTORING_ASSESSMENT_BASELINE_V2_STAGE_COUNTS)) {
        if ((actualStages[stage] ?? 0) !== expected) {
          issues.push({
            reason: 'BASELINE_ITEM_COUNT_DRIFT',
            catalogItemId: `stage:${stage}`,
            expectedItemCount: expected,
            actualItemCount: actualStages[stage] ?? 0,
          });
        }
      }
      const declaredStages = baseline.stageCounts ?? {};
      for (const [stage, expected] of Object.entries(MICRO_TUTORING_ASSESSMENT_BASELINE_V2_STAGE_COUNTS)) {
        if ((declaredStages[stage] ?? 0) !== expected) {
          issues.push({
            reason: 'BASELINE_ITEM_COUNT_DRIFT',
            catalogItemId: `declared-stage:${stage}`,
            expectedItemCount: expected,
            actualItemCount: declaredStages[stage] ?? 0,
          });
        }
      }
      for (const [stage, count] of Object.entries(declaredStages)) {
        if (!(stage in MICRO_TUTORING_ASSESSMENT_BASELINE_V2_STAGE_COUNTS)) {
          issues.push({
            reason: 'BASELINE_ITEM_COUNT_DRIFT',
            catalogItemId: `declared-stage:${stage}`,
            expectedItemCount: 0,
            actualItemCount: count ?? 0,
          });
        }
      }
    }
  }
  const baselineById = new Map<string, string>();
  const duplicateIds = new Set<string>();
  for (const entry of baseline.entries) {
    if (baselineById.has(entry.catalogItemId)) duplicateIds.add(entry.catalogItemId);
    baselineById.set(entry.catalogItemId, entry.contentHash);
  }
  for (const catalogItemId of duplicateIds) {
    issues.push({ reason: 'BASELINE_ITEM_DUPLICATE', catalogItemId });
  }
  const catalogItemIds = new Set<string>();
  const duplicateCatalogItemIds = new Set<string>();
  for (const item of catalogItems) {
    if (catalogItemIds.has(item.catalogItemId)) duplicateCatalogItemIds.add(item.catalogItemId);
    catalogItemIds.add(item.catalogItemId);
  }
  for (const catalogItemId of duplicateCatalogItemIds) {
    issues.push({ reason: 'BASELINE_ITEM_DUPLICATE', catalogItemId });
  }
  const itemById = new Map<string, AdaptiveAssessmentCatalogItem>();
  const duplicateQualifiedIds = new Set<string>();
  for (const item of qualifiedItems) {
    if (itemById.has(item.catalogItemId)) duplicateQualifiedIds.add(item.catalogItemId);
    itemById.set(item.catalogItemId, item);
  }
  for (const catalogItemId of duplicateQualifiedIds) {
    issues.push({ reason: 'BASELINE_ITEM_DUPLICATE', catalogItemId });
  }
  for (const [catalogItemId, expectedContentHash] of baselineById) {
    const item = itemById.get(catalogItemId);
    if (!item) {
      issues.push({ reason: 'BASELINE_ITEM_MISSING', catalogItemId, expectedContentHash });
    } else if (item.contentHash !== expectedContentHash) {
      issues.push({
        reason: 'CONTENT_HASH_DRIFT',
        catalogItemId,
        expectedContentHash,
        actualContentHash: item.contentHash,
      });
    }
  }
  for (const item of itemById.values()) {
    if (!baselineById.has(item.catalogItemId)) {
      issues.push({
        reason: 'BASELINE_ITEM_EXTRA',
        catalogItemId: item.catalogItemId,
        actualContentHash: item.contentHash,
      });
    }
  }
  return issues.sort((left, right) => `${left.reason}:${left.catalogItemId}`.localeCompare(`${right.reason}:${right.catalogItemId}`));
}

function attributionHasRequiredFields(
  attribution: Partial<MicroTutoringOptionAttribution>,
): attribution is MicroTutoringOptionAttribution {
  return isMicroTutoringOptionAttribution(attribution);
}

function auditOptionAttributions(input: {
  optionAttributions: unknown[];
  goalNodeCatalogSource?: unknown;
  goalNodeSourceContext?: MicroTutoringGoalNodeSourceContext;
  catalogItems: AdaptiveAssessmentCatalogItem[];
  qualifiedItems: AdaptiveAssessmentCatalogItem[];
  reviewDecisions: AssessmentItemSemanticReviewDecision[];
  optionReferenceSecret: string;
}): {
  issues: MicroTutoringCoverageAuditReport['attributionIssues'];
  rowsByOption: Map<string, MicroTutoringOptionAttribution[]>;
} {
  const catalogById = new Map<string, AdaptiveAssessmentCatalogItem[]>();
  for (const item of input.catalogItems) {
    const entries = catalogById.get(item.catalogItemId) ?? [];
    entries.push(item);
    catalogById.set(item.catalogItemId, entries);
  }
  const reviewDecisionByItemId = new Map(input.reviewDecisions.map((decision) => [
    decision.catalogItemId,
    decision,
  ]));
  const auditedOptionKeys = new Set(
    input.qualifiedItems.flatMap((item) => (item.questionRefs.options ?? [])
      .flatMap((option) => option.isCorrect === false && isNonEmptyString(option.key)
        ? [optionAttributionKey(item.catalogItemId, item.contentHash, option.key)]
        : [])),
  );
  const rowsByOption = new Map<string, MicroTutoringOptionAttribution[]>();
  const issueByRecord = new Map<number, MicroTutoringOptionAttributionIssueReason[]>();
  const recordIndexesByOption = new Map<string, number[]>();
  const goalNodeCatalog = loadMicroTutoringGoalNodeCatalog(
    input.goalNodeCatalogSource,
    input.goalNodeSourceContext,
  );

  input.optionAttributions.forEach((value, index) => {
    const attribution = attributionRecord(value);
    if (attribution && hasAttributionIdentity(attribution)) {
      const optionKey = optionAttributionKey(
        attribution.catalogItemId,
        attribution.contentHash,
        attribution.optionKey,
      );
      const indexes = recordIndexesByOption.get(optionKey) ?? [];
      indexes.push(index);
      recordIndexesByOption.set(optionKey, indexes);
    }
    if (!attribution || !hasAttributionIdentity(attribution) || !attributionHasRequiredFields(attribution)) {
      issueByRecord.set(index, ['ATTRIBUTION_RECORD_MALFORMED']);
      return;
    }
    const catalogItems = catalogById.get(attribution.catalogItemId);
    if (!catalogItems) {
      issueByRecord.set(index, ['ATTRIBUTION_RECORD_UNKNOWN_CATALOG_ITEM']);
      return;
    }
    if (!catalogItems.some((catalogItem) => catalogItem.contentHash === attribution.contentHash)) {
      issueByRecord.set(index, ['ATTRIBUTION_RECORD_CONTENT_HASH_DRIFT']);
      return;
    }
    const optionKey = optionAttributionKey(
      attribution.catalogItemId,
      attribution.contentHash,
      attribution.optionKey,
    );
    if (!auditedOptionKeys.has(optionKey)) {
      issueByRecord.set(index, ['ATTRIBUTION_RECORD_NOT_AUDITED_ERROR_OPTION']);
      return;
    }
    const reviewDecision = reviewDecisionByItemId.get(attribution.catalogItemId);
    const goalNode = resolveMicroTutoringGoalNode(attribution.learningGoalId, goalNodeCatalog);
    if (
      !reviewDecision ||
      reviewDecision.sourceContentHash !== attribution.contentHash ||
      reviewDecision.reviewSourceHash !== attribution.itemReviewSourceHash ||
      !reviewDecision.selectedLearningGoalIds.includes(attribution.learningGoalId) ||
      !attribution.misconceptionTag.startsWith(`misconception:${attribution.learningGoalId}:`)
    ) {
      issueByRecord.set(index, ['ATTRIBUTION_RECORD_REVIEW_EVIDENCE_INVALID']);
      return;
    }
    if (!goalNode.ok) {
      issueByRecord.set(index, [goalNode.reason === 'CATALOG_INVALID'
        ? 'GOAL_NODE_CATALOG_INVALID'
        : 'GOAL_NODE_UNRESOLVED']);
      return;
    }
    if (attribution.knowledgeNodeId !== goalNode.knowledgeNodeId) {
      issueByRecord.set(index, ['GOAL_NODE_CONFLICT']);
      return;
    }
    const rows = rowsByOption.get(optionKey) ?? [];
    rows.push(attribution);
    rowsByOption.set(optionKey, rows);
  });

  for (const [optionKey, indexes] of recordIndexesByOption) {
    if (indexes.length < 2) continue;
    rowsByOption.delete(optionKey);
    for (const index of indexes) {
      const reasons = issueByRecord.get(index) ?? [];
      reasons.push('ATTRIBUTION_RECORD_DUPLICATE');
      issueByRecord.set(index, reasons);
    }
  }

  const reviewedIndexesByItem = new Map<string, number[]>();
  input.optionAttributions.forEach((value, index) => {
    if (!isMicroTutoringOptionAttribution(value) || issueByRecord.has(index)) return;
    const itemKey = optionAttributionKey(value.catalogItemId, value.contentHash, '');
    const indexes = reviewedIndexesByItem.get(itemKey) ?? [];
    indexes.push(index);
    reviewedIndexesByItem.set(itemKey, indexes);
  });
  for (const indexes of reviewedIndexesByItem.values()) {
    for (let leftIndex = 0; leftIndex < indexes.length; leftIndex += 1) {
      const leftRecordIndex = indexes[leftIndex];
      const left = input.optionAttributions[leftRecordIndex] as MicroTutoringOptionAttribution;
      for (let rightIndex = leftIndex + 1; rightIndex < indexes.length; rightIndex += 1) {
        const rightRecordIndex = indexes[rightIndex];
        const right = input.optionAttributions[rightRecordIndex] as MicroTutoringOptionAttribution;
        if (
          left.misconceptionTag !== right.misconceptionTag &&
          left.reviewSourceHash !== right.reviewSourceHash &&
          left.evidenceSummary !== right.evidenceSummary
        ) continue;
        for (const [recordIndex, attribution] of [
          [leftRecordIndex, left],
          [rightRecordIndex, right],
        ] as const) {
          const reasons = issueByRecord.get(recordIndex) ?? [];
          reasons.push('ATTRIBUTION_RECORD_REVIEW_EVIDENCE_REUSED');
          issueByRecord.set(recordIndex, reasons);
          rowsByOption.delete(optionAttributionKey(
            attribution.catalogItemId,
            attribution.contentHash,
            attribution.optionKey,
          ));
        }
      }
    }
  }

  const issues = [...issueByRecord.entries()]
    .flatMap(([index, reasons]) => reasons.map((reason) => ({
      reason,
      attributionRef: attributionReference(
        input.optionAttributions[index],
        index,
        input.optionReferenceSecret,
      ),
    })))
    .sort((left, right) =>
      left.reason.localeCompare(right.reason) || left.attributionRef.localeCompare(right.attributionRef));
  return { issues, rowsByOption };
}

function validValidationItems(
  candidates: GovernedMicroTutoringValidationItem[],
  sourceQuestionId: string,
  sourceContentHash: string,
): GovernedMicroTutoringValidationItem[] {
  return candidates.filter((candidate) =>
    candidate.questionId !== sourceQuestionId && candidate.contentHash !== sourceContentHash,
  ).sort((left, right) => left.id.localeCompare(right.id));
}

export function buildMicroTutoringCoverageAuditReport(
  input: MicroTutoringCoverageAuditInput,
): MicroTutoringCoverageAuditReport {
  if (!isNonEmptyString(input.optionReferenceSecret)) {
    throw new Error('micro tutoring coverage audit requires a non-empty option reference secret');
  }
  const coverageProfile = input.coverageProfile ?? 'v1';
  const qualifiedItems = coverageProfile === 'v2'
    ? v2BaselineItems(input.catalogItems, input.reviewDecisions, input.baseline)
    : practiceItems(input.catalogItems, input.reviewDecisions);
  const attributionAudit = auditOptionAttributions({
    optionAttributions: input.optionAttributions,
    goalNodeCatalogSource: input.goalNodeCatalogSource,
    goalNodeSourceContext: input.goalNodeSourceContext,
    catalogItems: input.catalogItems,
    qualifiedItems,
    reviewDecisions: input.reviewDecisions,
    optionReferenceSecret: input.optionReferenceSecret,
  });
  const activeLearningGoalIds = new Set(input.activeLearningGoalIds);
  const activeKnowledgeNodeIds = new Set(input.activeKnowledgeNodeIds);
  const dependencyIssues = uniqueSorted(input.dependencyIssues ?? []) as MicroTutoringCoverageGapReason[];
  const rows: MicroTutoringCoverageRow[] = [];

  for (const item of qualifiedItems) {
    const options = item.questionRefs.options ?? [];
    for (const option of options.filter((candidate) => candidate.isCorrect === false)) {
      const candidateAttributions = option.key
        ? attributionAudit.rowsByOption.get(optionAttributionKey(
          item.catalogItemId,
          item.contentHash,
          option.key,
        )) ?? []
        : [];
      const candidateAttribution = candidateAttributions.length === 1 ? candidateAttributions[0] : null;
      const attribution = candidateAttribution &&
        attributionHasRequiredFields(candidateAttribution) &&
        activeLearningGoalIds.has(candidateAttribution.learningGoalId)
        ? candidateAttribution
        : null;
      const hasActiveKnowledgeNode = attribution && activeKnowledgeNodeIds.has(attribution.knowledgeNodeId);
      const reasons = [...dependencyIssues];
      if (!attribution) {
        reasons.push('ATTRIBUTION_UNCERTAIN');
      } else if (!hasActiveKnowledgeNode) {
        reasons.push('CANONICAL_NODE_UNAVAILABLE');
      }
      const resources = attribution && hasActiveKnowledgeNode
        ? input.resolveResources(attribution.knowledgeNodeId, attribution.misconceptionTag)
          .sort((left, right) => left.id.localeCompare(right.id))
        : [];
      if (attribution && hasActiveKnowledgeNode && resources.length === 0) {
        reasons.push(input.resolveResourceAccessDenied?.(
          attribution.knowledgeNodeId,
          attribution.misconceptionTag,
        ) ? 'ACCESS_REVOKED' : 'RESOURCE_UNAVAILABLE');
      }
      const validationItems = attribution && hasActiveKnowledgeNode
        ? validValidationItems(
          input.resolveValidationItems(
            item.sourceId,
            item.contentHash,
            attribution.knowledgeNodeId,
            attribution.misconceptionTag,
          ),
          item.sourceId,
          item.contentHash,
        )
        : [];
      if (attribution && hasActiveKnowledgeNode && validationItems.length === 0) {
        reasons.push(input.resolveValidationAccessDenied?.(
          item.sourceId,
          attribution.knowledgeNodeId,
          attribution.misconceptionTag,
        ) ? 'ACCESS_REVOKED' : 'VALIDATION_QUESTION_UNAVAILABLE');
      }
      const normalizedReasons = uniqueSorted(reasons) as MicroTutoringCoverageGapReason[];
      rows.push({
        catalogItemId: item.catalogItemId,
        contentHash: item.contentHash,
        errorOptionRef: stableOptionReference(
          `${item.catalogItemId}:${item.contentHash}:${option.key ?? 'missing-option-key'}`,
          input.optionReferenceSecret,
        ),
        learningGoalId: attribution?.learningGoalId ?? null,
        misconceptionTag: attribution?.misconceptionTag ?? null,
        knowledgeNodeId: attribution?.knowledgeNodeId ?? null,
        attributionVersion: attribution?.version ?? null,
        resources,
        validationItems,
        status: normalizedReasons.length === 0 ? 'COMPLETE' : 'GAP',
        reasons: normalizedReasons,
      });
    }
  }

  rows.sort((left, right) =>
    left.catalogItemId.localeCompare(right.catalogItemId) || left.errorOptionRef.localeCompare(right.errorOptionRef));
  const gapReasonCounts = {
    ATTRIBUTION_UNCERTAIN: 0,
    CANONICAL_NODE_UNAVAILABLE: 0,
    RESOURCE_UNAVAILABLE: 0,
    VALIDATION_QUESTION_UNAVAILABLE: 0,
    ACCESS_REVOKED: 0,
    REFERENCE_DRIFT: 0,
  } satisfies Record<MicroTutoringCoverageGapReason, number>;
  for (const row of rows) {
    for (const reason of row.reasons) gapReasonCounts[reason] += 1;
  }
  const completeOptionCount = rows.filter((row) => row.status === 'COMPLETE').length;
  const stageCounts = coverageProfile === 'v2' ? countBaselineStages(input.baseline) : undefined;
  const practiceIds = coverageProfile === 'v2'
    ? new Set(
      input.baseline.entries
        .filter((entry) => entry.assessmentStage === 'practice')
        .map((entry) => entry.catalogItemId),
    )
    : null;
  const qualifiedPracticeItemCount = practiceIds
    ? qualifiedItems.filter((item) => practiceIds.has(item.catalogItemId)).length
    : qualifiedItems.length;
  const report: Omit<MicroTutoringCoverageAuditReport, 'contentDigest'> = {
    artifactVersion: coverageProfile === 'v2'
      ? MICRO_TUTORING_COVERAGE_AUDIT_V2_VERSION
      : MICRO_TUTORING_COVERAGE_AUDIT_VERSION,
    coverageProfile,
    baselineItemCount: input.baseline.entries.length,
    qualifiedPracticeItemCount,
    qualifiedItemCount: qualifiedItems.length,
    ...(stageCounts ? { stageCounts } : {}),
    errorOptionCount: rows.length,
    completeOptionCount,
    gapOptionCount: rows.length - completeOptionCount,
    baselineIssues: baselineIssues(input.baseline, qualifiedItems, input.catalogItems, coverageProfile),
    attributionIssueCount: attributionAudit.issues.length,
    attributionIssues: attributionAudit.issues,
    gapReasonCounts,
    rows,
    ...(input.inputCapture ? { inputCapture: input.inputCapture } : {}),
  };
  return {
    ...report,
    contentDigest: microTutoringCoverageAuditContentDigest(report),
  };
}

export function microTutoringCoverageAuditMarkdown(report: MicroTutoringCoverageAuditReport): string {
  const lines = [
    '# 微辅导覆盖审计',
    '',
    `- 审计版本：${report.artifactVersion}`,
    `- 基线题目：${report.baselineItemCount}`,
    `- 当前合格常规练习题：${report.qualifiedPracticeItemCount}`,
    `- 当前合格题目：${report.qualifiedItemCount}`,
    ...(report.stageCounts
      ? [`- 阶段计数：${Object.entries(report.stageCounts).map(([stage, count]) => `${stage}=${count}`).join(', ')}`]
      : []),
    `- 错误选项：${report.errorOptionCount}`,
    `- 完整链路：${report.completeOptionCount}`,
    `- 缺口：${report.gapOptionCount}`,
    ...(report.inputCapture ? [
      `- 输入 Git 修订：${report.inputCapture.sourceRevision}`,
      `- 输入工作树洁净：${report.inputCapture.sourceInputsClean ? '是' : '否'}`,
      `- 数据库投影修订：${report.inputCapture.governedProjectionRevision ?? '未标记'}`,
    ] : []),
    '',
    '## 缺口原因',
    '',
    ...Object.entries(report.gapReasonCounts).map(([reason, count]) => `- ${reason}: ${count}`),
    '',
    '## 基线异常',
    '',
    ...(report.baselineIssues.length
      ? report.baselineIssues.map((issue) => {
        const itemCount = issue.expectedItemCount === undefined
          ? ''
          : `（预期 ${issue.expectedItemCount}，实际 ${issue.actualItemCount}）`;
        return `- ${issue.reason}: ${issue.catalogItemId}${itemCount}`;
      })
      : ['- 无']),
    '',
    '## 归因源异常',
    '',
    ...(report.attributionIssues.length
      ? report.attributionIssues.map((issue) => `- ${issue.reason}: ${issue.attributionRef}`)
      : ['- 无']),
    '',
    '## 覆盖记录',
    '',
    '| 题目 | 错误选项引用 | 状态 | 原因 |',
    '| --- | --- | --- | --- |',
    ...report.rows.map((row) =>
      `| ${row.catalogItemId} | ${row.errorOptionRef} | ${row.status} | ${row.reasons.join(', ') || '-'} |`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function microTutoringCoverageAuditIsStrictlyComplete(
  report: MicroTutoringCoverageAuditReport,
): boolean {
  const complete = report.baselineIssues.length === 0 &&
    report.attributionIssues.length === 0 &&
    report.gapOptionCount === 0;
  if (!complete) return false;
  if ((report.coverageProfile ?? 'v1') === 'v2') {
    return microTutoringCoverageAuditIsGitContentComplete(report);
  }
  return true;
}

export function microTutoringCoverageAuditIsGitContentComplete(
  report: MicroTutoringCoverageAuditReport,
): boolean {
  const coverageProfile = report.coverageProfile ?? 'v1';
  const expectedItems = coverageProfile === 'v2'
    ? MICRO_TUTORING_ASSESSMENT_BASELINE_V2_ITEM_COUNT
    : MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT;
  const expectedOptions = coverageProfile === 'v2'
    ? MICRO_TUTORING_V2_ERROR_OPTION_COUNT
    : 108;
  const expectedQualified = coverageProfile === 'v2'
    ? report.qualifiedItemCount
    : report.qualifiedPracticeItemCount;
  return report.baselineIssues.length === 0 &&
    report.attributionIssues.length === 0 &&
    expectedQualified === expectedItems &&
    report.errorOptionCount === expectedOptions &&
    report.gapReasonCounts.ATTRIBUTION_UNCERTAIN === 0 &&
    report.gapReasonCounts.CANONICAL_NODE_UNAVAILABLE === 0 &&
    report.gapReasonCounts.RESOURCE_UNAVAILABLE === 0 &&
    report.gapReasonCounts.VALIDATION_QUESTION_UNAVAILABLE === 0 &&
    report.gapReasonCounts.ACCESS_REVOKED === 0 &&
    report.rows.every((row) => row.resources.length >= 1 && row.validationItems.length >= 1);
}

export function microTutoringCoverageAuditContentDigest(
  report: Omit<MicroTutoringCoverageAuditReport, 'contentDigest'>,
): string {
  return `sha256:${createHash('sha256').update(JSON.stringify({
    artifactVersion: report.artifactVersion,
    baselineItemCount: report.baselineItemCount,
    qualifiedPracticeItemCount: report.qualifiedPracticeItemCount,
    errorOptionCount: report.errorOptionCount,
    completeOptionCount: report.completeOptionCount,
    gapOptionCount: report.gapOptionCount,
    gapReasonCounts: report.gapReasonCounts,
    baselineIssues: report.baselineIssues,
    attributionIssueCount: report.attributionIssueCount,
    attributionIssues: report.attributionIssues,
    inputCapture: report.inputCapture ?? null,
    rows: report.rows.map((row) => ({
      catalogItemId: row.catalogItemId,
      contentHash: row.contentHash,
      errorOptionRef: row.errorOptionRef,
      status: row.status,
      reasons: row.reasons,
      resourceIds: row.resources.map((resource) => resource.id),
      validationIds: row.validationItems.map((item) => item.id),
    })),
  })).digest('hex')}`;
}
