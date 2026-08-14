import { createHmac } from 'node:crypto';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import { evaluateAssessmentEvidenceAuthority } from '@/features/adaptive-assessment/assessment-evidence-authority';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';

export const MICRO_TUTORING_COVERAGE_AUDIT_VERSION = 'micro-tutoring-coverage-audit.v1';
export const MICRO_TUTORING_PRACTICE_BASELINE_VERSION = 'micro-tutoring-practice-baseline.v1';
export const MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT = 54;

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

export interface MicroTutoringPracticeBaseline {
  version: string;
  optionReferenceSalt: string;
  entries: Array<{
    catalogItemId: string;
    contentHash: string;
  }>;
}

export interface MicroTutoringOptionAttribution {
  catalogItemId: string;
  contentHash: string;
  optionKey: string;
  learningGoalId: string;
  misconceptionTag: string;
  knowledgeNodeId: string;
  version: string;
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
  optionAttributions: MicroTutoringOptionAttribution[];
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
  artifactVersion: typeof MICRO_TUTORING_COVERAGE_AUDIT_VERSION;
  baselineItemCount: number;
  qualifiedPracticeItemCount: number;
  errorOptionCount: number;
  completeOptionCount: number;
  gapOptionCount: number;
  baselineIssues: Array<{
    reason: MicroTutoringCoverageBaselineIssue;
    catalogItemId: string;
    expectedContentHash?: string;
    actualContentHash?: string;
    expectedItemCount?: number;
    actualItemCount?: number;
  }>;
  gapReasonCounts: Record<MicroTutoringCoverageGapReason, number>;
  rows: MicroTutoringCoverageRow[];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function stableOptionReference(value: string, salt: string): string {
  return `sha256:${createHmac('sha256', salt).update(value).digest('hex')}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionAttribution(value: unknown): value is MicroTutoringOptionAttribution {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function baselineIssues(
  baseline: MicroTutoringPracticeBaseline,
  qualifiedItems: AdaptiveAssessmentCatalogItem[],
  catalogItems: AdaptiveAssessmentCatalogItem[],
): MicroTutoringCoverageAuditReport['baselineIssues'] {
  const issues: MicroTutoringCoverageAuditReport['baselineIssues'] = [];
  if (baseline.version !== MICRO_TUTORING_PRACTICE_BASELINE_VERSION) {
    issues.push({
      reason: 'BASELINE_VERSION_UNSUPPORTED',
      catalogItemId: baseline.version,
    });
  } else {
    if (baseline.entries.length !== MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT) {
      issues.push({
        reason: 'BASELINE_ITEM_COUNT_DRIFT',
        catalogItemId: baseline.version,
        expectedItemCount: MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT,
        actualItemCount: baseline.entries.length,
      });
    }
    if (qualifiedItems.length !== MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT) {
      issues.push({
        reason: 'BASELINE_ITEM_COUNT_DRIFT',
        catalogItemId: 'qualified-practice-items',
        expectedItemCount: MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT,
        actualItemCount: qualifiedItems.length,
      });
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

function attributionRows(
  optionAttributions: MicroTutoringOptionAttribution[],
  catalogItemId: string,
  contentHash: string,
  optionKey: string | null,
): MicroTutoringOptionAttribution[] {
  if (!optionKey) return [];
  return optionAttributions.filter((entry) =>
    isOptionAttribution(entry) &&
    entry.catalogItemId === catalogItemId &&
    entry.contentHash === contentHash &&
    entry.optionKey === optionKey,
  );
}

function attributionHasRequiredFields(attribution: MicroTutoringOptionAttribution): boolean {
  return isNonEmptyString(attribution.learningGoalId) &&
    isNonEmptyString(attribution.misconceptionTag) &&
    isNonEmptyString(attribution.knowledgeNodeId) &&
    isNonEmptyString(attribution.version);
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
  const qualifiedItems = practiceItems(input.catalogItems, input.reviewDecisions);
  const activeLearningGoalIds = new Set(input.activeLearningGoalIds);
  const activeKnowledgeNodeIds = new Set(input.activeKnowledgeNodeIds);
  const dependencyIssues = uniqueSorted(input.dependencyIssues ?? []) as MicroTutoringCoverageGapReason[];
  const rows: MicroTutoringCoverageRow[] = [];

  for (const item of qualifiedItems) {
    const options = item.questionRefs.options ?? [];
    for (const option of options.filter((candidate) => candidate.isCorrect === false)) {
      const candidateAttributions = attributionRows(
        input.optionAttributions,
        item.catalogItemId,
        item.contentHash,
        option.key,
      );
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
          input.baseline.optionReferenceSalt,
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
  return {
    artifactVersion: MICRO_TUTORING_COVERAGE_AUDIT_VERSION,
    baselineItemCount: input.baseline.entries.length,
    qualifiedPracticeItemCount: qualifiedItems.length,
    errorOptionCount: rows.length,
    completeOptionCount,
    gapOptionCount: rows.length - completeOptionCount,
    baselineIssues: baselineIssues(input.baseline, qualifiedItems, input.catalogItems),
    gapReasonCounts,
    rows,
  };
}

export function microTutoringCoverageAuditMarkdown(report: MicroTutoringCoverageAuditReport): string {
  const lines = [
    '# 微辅导覆盖审计',
    '',
    `- 审计版本：${report.artifactVersion}`,
    `- 基线题目：${report.baselineItemCount}`,
    `- 当前合格常规练习题：${report.qualifiedPracticeItemCount}`,
    `- 错误选项：${report.errorOptionCount}`,
    `- 完整链路：${report.completeOptionCount}`,
    `- 缺口：${report.gapOptionCount}`,
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
  return report.baselineIssues.length === 0 && report.gapOptionCount === 0;
}
