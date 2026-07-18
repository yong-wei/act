import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  AdaptiveAssessmentCatalogItem,
  AdaptiveAssessmentCatalogSourceFamily,
  AdaptiveAssessmentCatalogSourceSummary,
  AdaptiveAssessmentCatalogStage,
  KaqReviewedItemRecord,
} from './adaptive-assessment-item-catalog';

export type AssessmentItemSemanticReviewOutcome = 'approved' | 'rejected' | 'deprecated' | 'blocked';

export type AssessmentItemSemanticReviewDecisionKind = 'human-review' | 'machine-suggestion';

export interface AssessmentItemSemanticReviewDecision {
  catalogItemId: string;
  decisionKind: AssessmentItemSemanticReviewDecisionKind;
  outcome: AssessmentItemSemanticReviewOutcome;
  reviewerId?: string;
  reviewerRole?: string;
  reviewedAt?: string;
  reviewBatchId?: string;
  sourceContentHash: string;
  selectedLearningGoalIds: string[];
  selectedKaqObjectiveIds: string[];
  selectedGraphNodeIds: string[];
  selectedStagePurpose?: AdaptiveAssessmentCatalogStage | 'precheck' | 'readiness-gate' | 'practice';
  difficulty?: number;
  cognitiveLevel?: string;
  misconceptionRefs: string[];
  remediationRefs: string[];
  metadataVersionRefs: Record<string, string>;
  reviewSourceHash?: string;
  notes?: string;
}

export interface AssessmentItemSemanticReviewPacket {
  packetId: string;
  packetVersion: 'assessment-item-semantic-review-packet.v1';
  catalogItemId: string;
  sourceFamily: AdaptiveAssessmentCatalogSourceFamily;
  sourceReference: {
    sourceId: string;
    sourceAnchor: string;
    sourcePath: string | null;
  };
  question: {
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
  candidateSemantics: {
    learningGoalIds: string[];
    kaqObjectiveIds: string[];
    graphNodeIds: string[];
    knowledgeTags: string[];
    difficulty: number | null;
    cognitiveLevel: string | null;
    misconceptionRefs: string[];
    remediationRefs: string[];
    assessmentStage: string | null;
  };
  currentEligibility: {
    reviewState: string;
    eligibilityState: string;
    allowedStages: AdaptiveAssessmentCatalogStage[];
  };
  missingBlockers: string[];
  sourceHash: string;
  packetVersionRefs: Record<string, string>;
  machineSuggestions: {
    fieldsAreSuggestionsOnly: true;
    maySetReviewedState: false;
  };
  reviewDecision: AssessmentItemSemanticReviewDecision | null;
}

export interface AssessmentItemSemanticCoverageIssue {
  catalogItemId: string;
  sourceFamily: AdaptiveAssessmentCatalogSourceFamily;
  reason: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AssessmentItemSemanticCoverageReport {
  artifactVersion: 'assessment-item-semantic-review-coverage.v1';
  itemCount: number;
  reviewedItemCount: number;
  pathEligibleItemCount: number;
  staleReviewCount: number;
  rejectedItemCount: number;
  deprecatedItemCount: number;
  blockedItemCount: number;
  sourceFamilies: Array<{
    family: AdaptiveAssessmentCatalogSourceFamily;
    role: 'item-source' | 'review-overlay';
    sourceTotal: number | null;
    itemTotal: number;
    reviewedTotal: number;
    pathEligibleTotal: number;
    unreviewedTotal: number;
    staleTotal: number;
    rejectedTotal: number;
    deprecatedTotal: number;
    blockedTotal: number;
    reviewOverlayTotal?: number;
  }>;
  learningGoalTotals: Record<string, number>;
  kaqObjectiveTotals: Record<string, number>;
  stageTotals: Record<string, number>;
  issues: AssessmentItemSemanticCoverageIssue[];
}

export interface AssessmentItemSemanticReviewArtifacts {
  packets: AssessmentItemSemanticReviewPacket[];
  reviewedSnapshots: AssessmentItemSemanticReviewDecision[];
  coverage: AssessmentItemSemanticCoverageReport;
}

export interface AssessmentItemSemanticReviewInput {
  items: AdaptiveAssessmentCatalogItem[];
  decisions?: AssessmentItemSemanticReviewDecision[];
  sourceFamilies?: AdaptiveAssessmentCatalogSourceSummary[];
  knownLearningGoalIds?: string[];
  knownKaqObjectiveIds?: string[];
  knownGraphNodeIds?: string[];
  knownRemediationResourceNodeIds?: string[];
}

export const ASSESSMENT_ITEM_SEMANTIC_REVIEW_SOURCE_PATH =
  'course-content/runtime/resource-governance/assessment-item-semantic-review-source.jsonl';

export class AssessmentItemSemanticReviewSourceValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid assessment item semantic review source:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'AssessmentItemSemanticReviewSourceValidationError';
  }
}

const PATH_GATE_STAGES = new Set<AdaptiveAssessmentCatalogStage>([
  'readiness',
  'checkpoint',
  'remediation',
  'terminal-validation',
]);

const SEMANTIC_REVIEW_VERSION_REF_EXCLUSIONS = new Set([
  'catalogVersion',
  'adaptiveAssessmentSnapshotVersion',
  'kaqFoundationVersion',
  'acqStaticQuestionBankVersion',
  'icourseObjectiveBankVersion',
]);

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function canonicalizeReviewSourceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeReviewSourceValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0)
    .map(([key, entryValue]) => [key, canonicalizeReviewSourceValue(entryValue)]));
}

/** Hashes the canonical JSON row after removing its self-referential reviewSourceHash field. */
export function assessmentItemSemanticReviewSourceHash(
  decision: AssessmentItemSemanticReviewDecision,
): string {
  const { reviewSourceHash: _reviewSourceHash, ...hashInput } = decision;
  const canonicalJson = JSON.stringify(canonicalizeReviewSourceValue(hashInput));
  return `sha256:${createHash('sha256').update(canonicalJson).digest('hex')}`;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value).every((entry) => typeof entry === 'string'),
  );
}

export function validateAssessmentItemSemanticReviewSource(
  items: AdaptiveAssessmentCatalogItem[],
  decisions: AssessmentItemSemanticReviewDecision[],
): AssessmentItemSemanticReviewDecision[] {
  const issues: string[] = [];
  const catalogByItemId = new Map<string, AdaptiveAssessmentCatalogItem>();
  for (const item of items) {
    if (catalogByItemId.has(item.catalogItemId)) {
      issues.push(`duplicate-catalog-item:${item.catalogItemId}`);
    } else {
      catalogByItemId.set(item.catalogItemId, item);
    }
  }

  const decisionsByItemId = new Map<string, AssessmentItemSemanticReviewDecision>();
  for (const decision of decisions) {
    const catalogItemId = typeof decision?.catalogItemId === 'string' ? decision.catalogItemId : '';
    if (!catalogItemId) {
      issues.push('missing-catalog-item-id');
      continue;
    }
    if (decisionsByItemId.has(catalogItemId)) {
      issues.push(`duplicate-review-source-item:${catalogItemId}`);
      continue;
    }
    decisionsByItemId.set(catalogItemId, decision);

    const item = catalogByItemId.get(catalogItemId);
    if (!item) {
      issues.push(`orphan-review-source-item:${catalogItemId}`);
      continue;
    }
    if (decision.decisionKind !== 'human-review') {
      issues.push(`machine-review-source-rejected:${catalogItemId}`);
    }
    for (const [field, value] of [
      ['reviewerId', decision.reviewerId],
      ['reviewerRole', decision.reviewerRole],
      ['reviewedAt', decision.reviewedAt],
      ['reviewBatchId', decision.reviewBatchId],
      ['notes', decision.notes],
    ] as const) {
      if (typeof value !== 'string' || !value.trim()) {
        issues.push(`missing-review-audit-field:${catalogItemId}:${field}`);
      }
    }
    if (decision.sourceContentHash !== item.contentHash) {
      issues.push(`stale-source-content-hash:${catalogItemId}`);
    }
    if (
      !isStringRecord(decision.metadataVersionRefs)
      || !versionRefsMatch(decision.metadataVersionRefs, semanticReviewVersionRefs(item))
    ) {
      issues.push(`stale-metadata-version-refs:${catalogItemId}`);
    }
    if (decision.reviewSourceHash !== assessmentItemSemanticReviewSourceHash(decision)) {
      issues.push(`invalid-review-source-hash:${catalogItemId}`);
    }
  }

  for (const catalogItemId of catalogByItemId.keys()) {
    if (!decisionsByItemId.has(catalogItemId)) {
      issues.push(`missing-review-source-item:${catalogItemId}`);
    }
  }

  if (issues.length) {
    throw new AssessmentItemSemanticReviewSourceValidationError(issues.sort());
  }
  return [...decisionsByItemId.values()]
    .sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));
}

export async function loadAssessmentItemSemanticReviewSource(
  items: AdaptiveAssessmentCatalogItem[],
  options: { rootDir?: string; sourcePath?: string } = {},
): Promise<AssessmentItemSemanticReviewDecision[]> {
  const sourcePath = path.resolve(
    options.rootDir ?? process.cwd(),
    options.sourcePath ?? ASSESSMENT_ITEM_SEMANTIC_REVIEW_SOURCE_PATH,
  );
  let input: string;
  try {
    input = await readFile(sourcePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new AssessmentItemSemanticReviewSourceValidationError([`missing-review-source:${sourcePath}`]);
    }
    throw error;
  }

  const decisions = input.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as AssessmentItemSemanticReviewDecision];
    } catch {
      throw new AssessmentItemSemanticReviewSourceValidationError([
        `invalid-review-source-json:${sourcePath}:${index + 1}`,
      ]);
    }
  });
  return validateAssessmentItemSemanticReviewSource(items, decisions);
}

function missingSemanticBlockers(item: AdaptiveAssessmentCatalogItem): string[] {
  return uniqueSorted([
    item.semanticRefs.learningGoalIds.length ? '' : 'missing-learning-goal-binding',
    item.semanticRefs.kaqObjectiveIds.length ? '' : 'missing-kaq-objective-ids',
    item.semanticRefs.graphNodeIds.length ? '' : 'missing-graph-node-refs',
    typeof item.semanticRefs.difficulty === 'number' ? '' : 'missing-difficulty',
    item.semanticRefs.cognitiveLevel ? '' : 'missing-cognitive-level',
    item.semanticRefs.misconceptionTags.length ? '' : 'missing-misconception-refs',
    item.semanticRefs.remediationResourceNodeIds.length ? '' : 'missing-remediation-refs',
    item.semanticRefs.assessmentStage ? '' : 'missing-assessment-stage',
    ...item.limitations,
  ]);
}

function versionRefsMatch(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function semanticReviewVersionRefs(item: AdaptiveAssessmentCatalogItem): Record<string, string> {
  const semanticRefs = Object.fromEntries(
    Object.entries(item.versionRefs).filter(([key]) => !SEMANTIC_REVIEW_VERSION_REF_EXCLUSIONS.has(key)),
  );
  return Object.keys(semanticRefs).length ? semanticRefs : item.versionRefs;
}

function reviewDecisionStage(item: AdaptiveAssessmentCatalogItem, decision: AssessmentItemSemanticReviewDecision): string {
  if (decision.selectedStagePurpose === 'precheck' || decision.selectedStagePurpose === 'readiness-gate') {
    return 'readiness';
  }
  if (decision.selectedStagePurpose === 'practice') return 'low-stakes-practice';
  return decision.selectedStagePurpose ?? item.semanticRefs.assessmentStage ?? '';
}

function reviewStagePurpose(value: string | undefined): AssessmentItemSemanticReviewDecision['selectedStagePurpose'] {
  if (
    value === 'practice' ||
    value === 'precheck' ||
    value === 'readiness-gate' ||
    value === 'low-stakes-practice' ||
    value === 'readiness' ||
    value === 'checkpoint' ||
    value === 'remediation' ||
    value === 'terminal-validation'
  ) {
    return value;
  }
  return undefined;
}

function reviewDecisionAuditIssues(decision: AssessmentItemSemanticReviewDecision): string[] {
  return [
    decision.decisionKind === 'human-review' ? '' : 'script-only-review-rejected',
    decision.reviewerId || decision.reviewerRole ? '' : 'missing-reviewer',
    decision.reviewedAt ? '' : 'missing-reviewed-at',
    decision.reviewBatchId ? '' : 'missing-review-batch-id',
    decision.notes?.trim() ? '' : 'missing-review-rationale',
  ];
}

function findDecision(
  decisionsByItemId: Map<string, AssessmentItemSemanticReviewDecision[]>,
  item: AdaptiveAssessmentCatalogItem,
): AssessmentItemSemanticReviewDecision | null {
  return decisionsByItemId.get(item.catalogItemId)?.[0] ?? null;
}

function decisionFieldIssues(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision | null,
  input: AssessmentItemSemanticReviewInput,
): string[] {
  if (!decision) return uniqueSorted(['missing-review-decision', ...missingSemanticBlockers(item)]);

  const metadataVersionRefs = decision.metadataVersionRefs ?? {};
  const selectedLearningGoalIds = decision.selectedLearningGoalIds ?? [];
  const selectedKaqObjectiveIds = decision.selectedKaqObjectiveIds ?? [];
  const selectedGraphNodeIds = decision.selectedGraphNodeIds ?? [];
  const misconceptionRefs = decision.misconceptionRefs ?? [];
  const remediationRefs = decision.remediationRefs ?? [];
  const knownLearningGoals = new Set(input.knownLearningGoalIds ?? []);
  const knownKaqObjectives = new Set(input.knownKaqObjectiveIds ?? []);
  const knownGraphNodes = new Set(input.knownGraphNodeIds ?? []);
  const knownRemediationResourceNodes = new Set(input.knownRemediationResourceNodeIds ?? []);
  const shouldValidateRemediationRefs = Array.isArray(input.knownRemediationResourceNodeIds);
  const staleIssues = [
    decision.sourceContentHash === item.contentHash ? '' : 'stale-source-hash',
    versionRefsMatch(metadataVersionRefs, semanticReviewVersionRefs(item))
      ? ''
      : 'stale-metadata-version-refs',
  ];
  if (decision.outcome !== 'approved') return uniqueSorted([
    ...reviewDecisionAuditIssues(decision),
    ...staleIssues,
  ]);
  const missing = [
    ...reviewDecisionAuditIssues(decision),
    ...staleIssues,
    selectedLearningGoalIds.length ? '' : 'missing-learning-goal-binding',
    selectedKaqObjectiveIds.length ? '' : 'missing-kaq-objective-ids',
    selectedGraphNodeIds.length ? '' : 'missing-graph-node-refs',
    decision.selectedStagePurpose ? '' : 'missing-assessment-stage',
    !decision.selectedStagePurpose || item.allowedStages.includes(reviewDecisionStage(item, decision) as AdaptiveAssessmentCatalogStage)
      ? ''
      : `invalid-assessment-stage:${decision.selectedStagePurpose}`,
    typeof decision.difficulty === 'number' ? '' : 'missing-difficulty',
    decision.cognitiveLevel ? '' : 'missing-cognitive-level',
    misconceptionRefs.length ? '' : 'missing-misconception-refs',
    remediationRefs.length ? '' : 'missing-remediation-refs',
    Object.keys(metadataVersionRefs).length ? '' : 'missing-metadata-version-refs',
    ...selectedLearningGoalIds
      .filter((id) => knownLearningGoals.size > 0 && !knownLearningGoals.has(id))
      .map((id) => `invalid-learning-goal:${id}`),
    ...selectedKaqObjectiveIds
      .filter((id) => knownKaqObjectives.size > 0 && !knownKaqObjectives.has(id))
      .map((id) => `invalid-kaq-objective:${id}`),
    ...selectedGraphNodeIds
      .filter((id) => knownGraphNodes.size > 0 && !knownGraphNodes.has(id))
      .map((id) => `invalid-graph-node:${id}`),
    ...remediationRefs
      .filter((id) => shouldValidateRemediationRefs && !knownRemediationResourceNodes.has(id))
      .map((id) => `invalid-remediation-ref:${id}`),
  ];
  return uniqueSorted(missing);
}

function hasPathGate(item: AdaptiveAssessmentCatalogItem): boolean {
  return item.allowedStages.some((stage) => PATH_GATE_STAGES.has(stage));
}

function isApprovedDecisionValid(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision | null,
  input: AssessmentItemSemanticReviewInput,
): boolean {
  return Boolean(
    decision
    && decision.outcome === 'approved'
    && decisionFieldIssues(item, decision, input).length === 0,
  );
}

export function getAssessmentItemSemanticReviewDecisionIssues(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision | null,
  input: Pick<
    AssessmentItemSemanticReviewInput,
    'knownLearningGoalIds' | 'knownKaqObjectiveIds' | 'knownGraphNodeIds' | 'knownRemediationResourceNodeIds'
  > = {},
): string[] {
  return decisionFieldIssues(item, decision, {
    items: [item],
    decisions: decision ? [decision] : [],
    ...input,
  });
}

function issueSeverity(reason: string): AssessmentItemSemanticCoverageIssue['severity'] {
  if (reason === 'missing-review-decision') return 'warning';
  if (reason.startsWith('missing-')) return 'warning';
  return 'error';
}

export function buildAssessmentItemSemanticReviewPackets(
  items: AdaptiveAssessmentCatalogItem[],
  decisions: AssessmentItemSemanticReviewDecision[] = [],
): AssessmentItemSemanticReviewPacket[] {
  const decisionsByItemId = groupDecisionsByItem(decisions);
  return items.map((item) => ({
    packetId: `assessment-item-semantic-review:${item.catalogItemId}`,
    packetVersion: 'assessment-item-semantic-review-packet.v1',
    catalogItemId: item.catalogItemId,
    sourceFamily: item.sourceFamily,
    sourceReference: {
      sourceId: item.sourceId,
      sourceAnchor: item.sourceAnchor,
      sourcePath: item.lineage.sourcePath,
    },
    question: item.questionRefs,
    candidateSemantics: {
      learningGoalIds: item.semanticRefs.learningGoalIds,
      kaqObjectiveIds: item.semanticRefs.kaqObjectiveIds,
      graphNodeIds: item.semanticRefs.graphNodeIds,
      knowledgeTags: item.semanticRefs.knowledgeTags,
      difficulty: item.semanticRefs.difficulty,
      cognitiveLevel: item.semanticRefs.cognitiveLevel,
      misconceptionRefs: item.semanticRefs.misconceptionTags,
      remediationRefs: item.semanticRefs.remediationResourceNodeIds,
      assessmentStage: item.semanticRefs.assessmentStage,
    },
    currentEligibility: {
      reviewState: item.reviewState,
      eligibilityState: item.eligibilityState,
      allowedStages: item.allowedStages,
    },
    missingBlockers: missingSemanticBlockers(item),
    sourceHash: item.contentHash,
    packetVersionRefs: semanticReviewVersionRefs(item),
    machineSuggestions: {
      fieldsAreSuggestionsOnly: true,
      maySetReviewedState: false,
    },
    reviewDecision: findDecision(decisionsByItemId, item),
  }));
}

function canGeneratedDecisionReplaceExisting(
  existing: AssessmentItemSemanticReviewDecision,
  generated: AssessmentItemSemanticReviewDecision,
): boolean {
  return Boolean(existing.reviewerId && existing.reviewerId === generated.reviewerId);
}

export function mergeAssessmentItemSemanticReviewDecisions(
  existingDecisions: AssessmentItemSemanticReviewDecision[],
  generatedDecisions: AssessmentItemSemanticReviewDecision[],
): AssessmentItemSemanticReviewDecision[] {
  const decisionsByItemId = new Map<string, AssessmentItemSemanticReviewDecision>();
  for (const decision of existingDecisions) decisionsByItemId.set(decision.catalogItemId, decision);
  for (const decision of generatedDecisions) {
    const existing = decisionsByItemId.get(decision.catalogItemId);
    if (!existing || canGeneratedDecisionReplaceExisting(existing, decision)) {
      decisionsByItemId.set(decision.catalogItemId, decision);
    }
  }
  return [...decisionsByItemId.values()].sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));
}

export function buildKaqFoundationSemanticReviewDecisions(
  items: AdaptiveAssessmentCatalogItem[],
  kaqReviewedItems: KaqReviewedItemRecord[],
): AssessmentItemSemanticReviewDecision[] {
  const itemsBySourceId = new Map(items.map((item) => [`${item.sourceFamily}:${item.sourceId}`, item]));
  return kaqReviewedItems.flatMap((reviewedItem) => {
    if (!reviewedItem.questionId) return [];
    const item = itemsBySourceId.get(`preset-adaptive-question:${reviewedItem.questionId}`);
    const metadata = reviewedItem.metadata;
    const review = metadata?.review;
    if (!item || review?.state !== 'reviewed') return [];
    const contentReviewIsCurrent = !item.limitations.some((reason) =>
      reason === 'kaq-review-source-hash-mismatch'
      || reason === 'kaq-review-immutable-content-hash-mismatch'
    );
    const selectedLearningGoalIds = uniqueSorted(metadata?.learningGoalIds ?? []);
    const selectedKaqObjectiveIds = uniqueSorted(metadata?.kaqObjectiveIds ?? []);
    const selectedGraphNodeIds = uniqueSorted(metadata?.graphNodeIds ?? []);
    const selectedStagePurpose = reviewStagePurpose(metadata?.purpose);
    const misconceptionRefs = uniqueSorted(metadata?.misconceptionTags ?? []);
    const remediationRefs = uniqueSorted(metadata?.remediationResourceNodeIds ?? []);
    return [{
      catalogItemId: item.catalogItemId,
      decisionKind: 'human-review',
      outcome: 'approved',
      reviewerId: review.reviewerId,
      reviewerRole: review.reviewerRole,
      reviewedAt: review.reviewedAt,
      reviewBatchId: review.reviewBatchId ?? review.metadataVersionRef,
      sourceContentHash: contentReviewIsCurrent
        ? item.contentHash
        : metadata?.immutableContentHash ?? review.sourceHash ?? '',
      selectedLearningGoalIds,
      selectedKaqObjectiveIds,
      selectedGraphNodeIds,
      selectedStagePurpose,
      difficulty: metadata?.difficulty,
      cognitiveLevel: metadata?.cognitiveLevel,
      misconceptionRefs,
      remediationRefs,
      metadataVersionRefs: metadata?.versionRefs ?? {},
      reviewSourceHash: review.sourceHash,
      notes: [
        'Reviewed source question, answer context, content hash, LearningGoal fit, K/A/Q objective ids, graph-node refs,',
        `stage purpose ${selectedStagePurpose ?? 'unspecified'}, difficulty ${metadata?.difficulty ?? 'unspecified'}, cognitive level ${metadata?.cognitiveLevel ?? 'unspecified'},`,
        `misconception refs ${misconceptionRefs.join(', ') || 'none'}, and remediation refs ${remediationRefs.join(', ') || 'none'} from the K/A/Q review overlay.`,
        `Approved for baseline coverage of ${selectedLearningGoalIds.join(', ') || 'no LearningGoal'} with review source ${review.sourceHash}.`,
      ].join(' '),
    }];
  });
}

export function buildAssessmentItemSemanticCoverageReport(
  input: AssessmentItemSemanticReviewInput,
): AssessmentItemSemanticCoverageReport {
  const decisionsByItemId = groupDecisionsByItem(input.decisions ?? []);
  const issues: AssessmentItemSemanticCoverageIssue[] = [];
  const sourceFamilyCounts = new Map<AdaptiveAssessmentCatalogSourceFamily, {
    family: AdaptiveAssessmentCatalogSourceFamily;
    role: 'item-source' | 'review-overlay';
    sourceTotal: number | null;
    itemTotal: number;
    reviewedTotal: number;
    pathEligibleTotal: number;
    unreviewedTotal: number;
    staleTotal: number;
    rejectedTotal: number;
    deprecatedTotal: number;
    blockedTotal: number;
    reviewOverlayTotal?: number;
  }>();
  const learningGoalTotals: Record<string, number> = {};
  const kaqObjectiveTotals: Record<string, number> = {};
  const stageTotals: Record<string, number> = {};

  for (const sourceFamily of input.sourceFamilies ?? []) {
    sourceFamilyCounts.set(sourceFamily.family, {
      family: sourceFamily.family,
      role: sourceFamily.role,
      sourceTotal: sourceFamily.sourceTotal,
      itemTotal: 0,
      reviewedTotal: 0,
      pathEligibleTotal: 0,
      unreviewedTotal: 0,
      staleTotal: 0,
      rejectedTotal: 0,
      deprecatedTotal: 0,
      blockedTotal: sourceFamily.blockedTotal,
      ...(sourceFamily.reviewOverlayTotal ? { reviewOverlayTotal: sourceFamily.reviewOverlayTotal } : {}),
    });
  }

  for (const item of input.items) {
    const sourceCounts = sourceFamilyCounts.get(item.sourceFamily) ?? {
      family: item.sourceFamily,
      role: 'item-source' as const,
      sourceTotal: 0,
      itemTotal: 0,
      reviewedTotal: 0,
      pathEligibleTotal: 0,
      unreviewedTotal: 0,
      staleTotal: 0,
      rejectedTotal: 0,
      deprecatedTotal: 0,
      blockedTotal: 0,
    };
    sourceFamilyCounts.set(item.sourceFamily, sourceCounts);
    sourceCounts.itemTotal += 1;
    if (typeof sourceCounts.sourceTotal === 'number' && sourceCounts.sourceTotal < sourceCounts.itemTotal) {
      sourceCounts.sourceTotal = sourceCounts.itemTotal;
    }

    const decision = findDecision(decisionsByItemId, item);
    const itemDecisionIssues = decisionFieldIssues(item, decision, input);
    for (const reason of itemDecisionIssues) {
      issues.push({
        catalogItemId: item.catalogItemId,
        sourceFamily: item.sourceFamily,
        reason,
        severity: issueSeverity(reason),
      });
    }
    if (
      hasPathGate(item)
      && (!decision || (decision.outcome === 'approved' && !isApprovedDecisionValid(item, decision, input)))
    ) {
      issues.push({
        catalogItemId: item.catalogItemId,
        sourceFamily: item.sourceFamily,
        reason: 'invalid-path-eligibility',
        severity: 'error',
      });
    }

    if (!decision) {
      sourceCounts.unreviewedTotal += 1;
    } else if (itemDecisionIssues.some((issue) => issue.startsWith('stale-'))) {
      sourceCounts.staleTotal += 1;
    } else if (decision.outcome !== 'approved' && itemDecisionIssues.length) {
      sourceCounts.unreviewedTotal += 1;
    } else if (decision.outcome === 'rejected') {
      sourceCounts.rejectedTotal += 1;
    } else if (decision.outcome === 'deprecated') {
      sourceCounts.deprecatedTotal += 1;
    } else if (decision.outcome === 'blocked') {
      sourceCounts.blockedTotal += 1;
    } else if (isApprovedDecisionValid(item, decision, input)) {
      sourceCounts.reviewedTotal += 1;
      if (item.eligibilityState === 'path-eligible') sourceCounts.pathEligibleTotal += 1;
      for (const learningGoalId of decision.selectedLearningGoalIds) {
        learningGoalTotals[learningGoalId] = (learningGoalTotals[learningGoalId] ?? 0) + 1;
      }
      for (const kaqObjectiveId of decision.selectedKaqObjectiveIds) {
        kaqObjectiveTotals[kaqObjectiveId] = (kaqObjectiveTotals[kaqObjectiveId] ?? 0) + 1;
      }
      if (decision.selectedStagePurpose) {
        stageTotals[decision.selectedStagePurpose] = (stageTotals[decision.selectedStagePurpose] ?? 0) + 1;
      }
    } else {
      sourceCounts.unreviewedTotal += 1;
    }
  }

  return {
    artifactVersion: 'assessment-item-semantic-review-coverage.v1',
    itemCount: input.items.length,
    reviewedItemCount: [...sourceFamilyCounts.values()].reduce((sum, item) => sum + item.reviewedTotal, 0),
    pathEligibleItemCount: [...sourceFamilyCounts.values()].reduce((sum, item) => sum + item.pathEligibleTotal, 0),
    staleReviewCount: [...sourceFamilyCounts.values()].reduce((sum, item) => sum + item.staleTotal, 0),
    rejectedItemCount: [...sourceFamilyCounts.values()].reduce((sum, item) => sum + item.rejectedTotal, 0),
    deprecatedItemCount: [...sourceFamilyCounts.values()].reduce((sum, item) => sum + item.deprecatedTotal, 0),
    blockedItemCount: [...sourceFamilyCounts.values()].reduce((sum, item) => sum + item.blockedTotal, 0),
    sourceFamilies: [...sourceFamilyCounts.values()].sort((left, right) => left.family.localeCompare(right.family)),
    learningGoalTotals,
    kaqObjectiveTotals,
    stageTotals,
    issues: issues.sort((left, right) =>
      `${left.sourceFamily}:${left.catalogItemId}:${left.reason}`.localeCompare(`${right.sourceFamily}:${right.catalogItemId}:${right.reason}`),
    ),
  };
}

export function buildAssessmentItemSemanticReviewArtifacts(
  input: AssessmentItemSemanticReviewInput,
): AssessmentItemSemanticReviewArtifacts {
  const reviewedSnapshots = input.decisions ?? [];
  return {
    packets: buildAssessmentItemSemanticReviewPackets(input.items, reviewedSnapshots),
    reviewedSnapshots,
    coverage: buildAssessmentItemSemanticCoverageReport({ ...input, decisions: reviewedSnapshots }),
  };
}

export function assessmentItemSemanticReviewArtifactsToFiles(artifacts: AssessmentItemSemanticReviewArtifacts) {
  return {
    packets: `${artifacts.packets.map((packet) => JSON.stringify(packet)).join('\n')}\n`,
    reviewedSnapshots: `${artifacts.reviewedSnapshots.map((decision) => JSON.stringify(decision)).join('\n')}\n`,
    coverage: `${JSON.stringify(artifacts.coverage, null, 2)}\n`,
  };
}

function groupDecisionsByItem(
  decisions: AssessmentItemSemanticReviewDecision[],
): Map<string, AssessmentItemSemanticReviewDecision[]> {
  const grouped = new Map<string, AssessmentItemSemanticReviewDecision[]>();
  for (const decision of decisions) {
    const existing = grouped.get(decision.catalogItemId) ?? [];
    existing.push(decision);
    grouped.set(decision.catalogItemId, existing);
  }
  return grouped;
}
