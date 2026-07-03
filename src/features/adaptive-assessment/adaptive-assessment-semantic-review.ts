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
}

const PATH_GATE_STAGES = new Set<AdaptiveAssessmentCatalogStage>([
  'readiness',
  'checkpoint',
  'remediation',
  'terminal-validation',
]);

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
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
  if (decision.outcome !== 'approved') return [];

  const knownLearningGoals = new Set(input.knownLearningGoalIds ?? []);
  const knownKaqObjectives = new Set(input.knownKaqObjectiveIds ?? []);
  const knownGraphNodes = new Set(input.knownGraphNodeIds ?? []);
  const missing = [
    decision.decisionKind === 'human-review' ? '' : 'script-only-review-rejected',
    decision.sourceContentHash === item.contentHash ? '' : 'stale-source-hash',
    versionRefsMatch(decision.metadataVersionRefs, item.versionRefs)
      ? ''
      : 'stale-metadata-version-refs',
    decision.reviewerId || decision.reviewerRole ? '' : 'missing-reviewer',
    decision.reviewedAt ? '' : 'missing-reviewed-at',
    decision.reviewBatchId ? '' : 'missing-review-batch-id',
    decision.selectedLearningGoalIds.length ? '' : 'missing-learning-goal-binding',
    decision.selectedKaqObjectiveIds.length ? '' : 'missing-kaq-objective-ids',
    decision.selectedGraphNodeIds.length ? '' : 'missing-graph-node-refs',
    decision.selectedStagePurpose ? '' : 'missing-assessment-stage',
    typeof decision.difficulty === 'number' ? '' : 'missing-difficulty',
    decision.cognitiveLevel ? '' : 'missing-cognitive-level',
    decision.misconceptionRefs.length ? '' : 'missing-misconception-refs',
    decision.remediationRefs.length ? '' : 'missing-remediation-refs',
    Object.keys(decision.metadataVersionRefs).length ? '' : 'missing-metadata-version-refs',
    ...decision.selectedLearningGoalIds
      .filter((id) => knownLearningGoals.size > 0 && !knownLearningGoals.has(id))
      .map((id) => `invalid-learning-goal:${id}`),
    ...decision.selectedKaqObjectiveIds
      .filter((id) => knownKaqObjectives.size > 0 && !knownKaqObjectives.has(id))
      .map((id) => `invalid-kaq-objective:${id}`),
    ...decision.selectedGraphNodeIds
      .filter((id) => knownGraphNodes.size > 0 && !knownGraphNodes.has(id))
      .map((id) => `invalid-graph-node:${id}`),
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
    packetVersionRefs: item.versionRefs,
    machineSuggestions: {
      fieldsAreSuggestionsOnly: true,
      maySetReviewedState: false,
    },
    reviewDecision: findDecision(decisionsByItemId, item),
  }));
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
    return [{
      catalogItemId: item.catalogItemId,
      decisionKind: 'human-review',
      outcome: 'approved',
      reviewerId: review.reviewerId,
      reviewerRole: review.reviewerRole,
      reviewedAt: review.reviewedAt,
      reviewBatchId: review.reviewBatchId ?? review.metadataVersionRef,
      sourceContentHash: item.reviewState === 'path-eligible'
        ? item.contentHash
        : metadata?.immutableContentHash ?? review.sourceHash ?? '',
      selectedLearningGoalIds: uniqueSorted(metadata?.learningGoalIds ?? []),
      selectedKaqObjectiveIds: uniqueSorted(metadata?.kaqObjectiveIds ?? []),
      selectedGraphNodeIds: uniqueSorted(metadata?.graphNodeIds ?? []),
      selectedStagePurpose: metadata?.purpose,
      difficulty: metadata?.difficulty,
      cognitiveLevel: metadata?.cognitiveLevel,
      misconceptionRefs: uniqueSorted(metadata?.misconceptionTags ?? []),
      remediationRefs: uniqueSorted(metadata?.remediationResourceNodeIds ?? []),
      metadataVersionRefs: item.versionRefs,
      reviewSourceHash: review.sourceHash,
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
    if (hasPathGate(item) && !isApprovedDecisionValid(item, decision, input)) {
      issues.push({
        catalogItemId: item.catalogItemId,
        sourceFamily: item.sourceFamily,
        reason: 'invalid-path-eligibility',
        severity: 'error',
      });
    }

    if (!decision) {
      sourceCounts.unreviewedTotal += 1;
    } else if (decision.outcome === 'rejected') {
      sourceCounts.rejectedTotal += 1;
    } else if (decision.outcome === 'deprecated') {
      sourceCounts.deprecatedTotal += 1;
    } else if (decision.outcome === 'blocked') {
      sourceCounts.blockedTotal += 1;
    } else if (itemDecisionIssues.includes('stale-source-hash')) {
      sourceCounts.staleTotal += 1;
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
