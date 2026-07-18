import type {
  AdaptiveAssessmentCatalogItem,
  AdaptiveAssessmentCatalogStage,
} from './adaptive-assessment-item-catalog';
import {
  assessmentItemSemanticReviewSourceHash,
  getAssessmentItemSemanticReviewDecisionIssues,
  type AssessmentItemSemanticReviewDecision,
} from './adaptive-assessment-semantic-review';

export interface AssessmentEvidenceKnownSemanticRefs {
  knownLearningGoalIds?: string[];
  knownKaqObjectiveIds?: string[];
  knownGraphNodeIds?: string[];
  knownRemediationResourceNodeIds?: string[];
}

export interface AssessmentEvidenceAuthority {
  limitedPractice: boolean;
  mastery: boolean;
  readiness: boolean;
  checkpoint: boolean;
  remediation: boolean;
  terminalValidation: boolean;
  limitations: string[];
}

export interface AssessmentEvidenceCatalogSnapshot extends Omit<
  AdaptiveAssessmentCatalogItem,
  'lineage' | 'adaptiveAssessmentItemRef'
> {
  sourceLineage: AdaptiveAssessmentCatalogItem['lineage'];
  reviewDecision: AssessmentItemSemanticReviewDecision;
  relationship: AdaptiveAssessmentCatalogItem['adaptiveAssessmentItemRef'];
}

type AssessmentEvidenceAuthorityContext = AssessmentEvidenceKnownSemanticRefs & {
  learningGoalId?: string | null;
  requestedStage?: AdaptiveAssessmentCatalogStage | null;
  hasTypedTerminalEvidence?: boolean;
  allowHistoricalIncompleteSnapshotRecovery?: boolean;
};

export const ASSESSMENT_CATALOG_SNAPSHOT_ENFORCEMENT_EPOCH_MS = Date.UTC(2026, 6, 4);

export function isAssessmentSnapshotBeforeEnforcementEpoch(
  createdAt: unknown,
  answeredAt: unknown,
): boolean {
  const createdAtMs = createdAt instanceof Date ? createdAt.getTime() : Number.NaN;
  const answeredAtMs = answeredAt instanceof Date ? answeredAt.getTime() : Number.NaN;
  return Number.isFinite(createdAtMs) &&
    Number.isFinite(answeredAtMs) &&
    createdAtMs < ASSESSMENT_CATALOG_SNAPSHOT_ENFORCEMENT_EPOCH_MS &&
    answeredAtMs < ASSESSMENT_CATALOG_SNAPSHOT_ENFORCEMENT_EPOCH_MS;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function deniedAssessmentEvidenceAuthority(limitations: string[]): AssessmentEvidenceAuthority {
  return {
    limitedPractice: false,
    mastery: false,
    readiness: false,
    checkpoint: false,
    remediation: false,
    terminalValidation: false,
    limitations: uniqueSorted(limitations),
  };
}

function stableStringRecord(value: Record<string, string>): string {
  return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizedDecisionStage(
  decision: AssessmentItemSemanticReviewDecision,
): AdaptiveAssessmentCatalogStage | null {
  if (decision.selectedStagePurpose === 'precheck' || decision.selectedStagePurpose === 'readiness-gate') {
    return 'readiness';
  }
  if (decision.selectedStagePurpose === 'practice') return 'low-stakes-practice';
  return decision.selectedStagePurpose ?? null;
}

function evidenceContractIssues(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision,
  context: AssessmentEvidenceAuthorityContext,
): string[] {
  const stage = normalizedDecisionStage(decision);
  return uniqueSorted([
    ...getAssessmentItemSemanticReviewDecisionIssues(item, decision, context),
    decision.decisionKind === 'human-review' ? '' : 'non-human-review-decision',
    decision.outcome === 'approved' ? '' : 'review-decision-not-approved',
    typeof decision.reviewSourceHash === 'string' && decision.reviewSourceHash.length > 0
      ? ''
      : 'missing-review-source-hash',
    typeof decision.reviewSourceHash === 'string' &&
      decision.reviewSourceHash === assessmentItemSemanticReviewSourceHash(decision)
      ? ''
      : 'invalid-review-source-hash',
    item.reviewState === 'path-eligible' ? '' : 'review-state-not-path-eligible',
    item.eligibilityState === 'path-eligible' ? '' : 'eligibility-state-not-path-eligible',
    item.sourceFamily === 'generated-adaptive-question' ? 'generated-item-limited-to-practice' : '',
    item.questionRefs.answerKey?.length ? '' : 'missing-scoring-answer-key',
    item.questionRefs.rubricRef?.trim() ? '' : 'missing-scoring-rubric',
    item.lineage.sourceFamily === item.sourceFamily ? '' : 'lineage-source-family-mismatch',
    item.lineage.sourceId === item.sourceId ? '' : 'lineage-source-id-mismatch',
    item.lineage.sourceHash === item.contentHash ? '' : 'lineage-source-hash-mismatch',
    Object.keys(item.versionRefs).length ? '' : 'missing-catalog-version-refs',
    item.adaptiveAssessmentItemRef.relationship === 'answer-time-snapshot' &&
      item.adaptiveAssessmentItemRef.immutable === true &&
      item.adaptiveAssessmentItemRef.mayReferenceCatalogItemId === true &&
      item.adaptiveAssessmentItemRef.mayReferenceContentHash === true &&
      item.adaptiveAssessmentItemRef.catalogUpdatesRewriteHistoricalAnswers === false
      ? ''
      : 'invalid-evidence-snapshot-contract',
    stage && item.allowedStages.includes(stage) ? '' : 'review-stage-boundary-mismatch',
    context.learningGoalId && !decision.selectedLearningGoalIds.includes(context.learningGoalId)
      ? 'requested-learning-goal-mismatch'
      : '',
    context.requestedStage && stage !== context.requestedStage
      ? 'requested-stage-mismatch'
      : '',
  ]);
}

export function evaluateAssessmentEvidenceAuthority(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision,
  context: AssessmentEvidenceAuthorityContext = {},
): AssessmentEvidenceAuthority {
  const stage = normalizedDecisionStage(decision);
  const limitations = evidenceContractIssues(item, decision, context);
  const authoritative = limitations.length === 0;
  const limitedPractice = item.allowedStages.includes('low-stakes-practice') && (
    authoritative ||
    item.reviewState === 'generated-provisional' ||
    item.reviewState === 'semantically-reviewed' ||
    item.reviewState === 'imported-unreviewed'
  );

  return {
    limitedPractice,
    mastery: authoritative,
    readiness: authoritative && stage === 'readiness',
    checkpoint: authoritative && stage === 'checkpoint',
    remediation: authoritative && stage === 'remediation',
    terminalValidation: authoritative &&
      stage === 'terminal-validation' &&
      context.hasTypedTerminalEvidence === true,
    limitations,
  };
}

export function evaluateAssessmentEvidenceSnapshotAuthority(
  snapshot: AssessmentEvidenceCatalogSnapshot | null,
  context: AssessmentEvidenceAuthorityContext = {},
): AssessmentEvidenceAuthority {
  if (
    !snapshot ||
    !snapshot.questionRefs ||
    !snapshot.semanticRefs ||
    !snapshot.sourceLineage ||
    !snapshot.reviewDecision ||
    !snapshot.relationship ||
    !Array.isArray(snapshot.allowedStages) ||
    !snapshot.versionRefs
  ) {
    return deniedAssessmentEvidenceAuthority([
      snapshot ? 'incomplete-catalog-snapshot' : 'missing-catalog-snapshot',
    ]);
  }
  const { sourceLineage, reviewDecision, relationship, ...item } = snapshot;
  return evaluateAssessmentEvidenceAuthority({
    ...item,
    lineage: sourceLineage,
    adaptiveAssessmentItemRef: relationship,
  }, reviewDecision, context);
}

export function evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
  persistedSnapshot: AssessmentEvidenceCatalogSnapshot | null,
  currentSnapshot: AssessmentEvidenceCatalogSnapshot | null,
  context: AssessmentEvidenceAuthorityContext = {},
): AssessmentEvidenceAuthority {
  const persistedAuthority = evaluateAssessmentEvidenceSnapshotAuthority(persistedSnapshot, context);
  const currentAuthority = evaluateAssessmentEvidenceSnapshotAuthority(currentSnapshot, context);
  if (!currentAuthority.mastery) {
    return deniedAssessmentEvidenceAuthority([
      ...currentAuthority.limitations,
      'current-catalog-authority-unavailable',
    ]);
  }
  if (!persistedSnapshot || !currentSnapshot) return persistedAuthority;

  const currentMismatchIssues = uniqueSorted([
    persistedSnapshot.catalogItemId === currentSnapshot.catalogItemId ? '' : 'current-catalog-item-mismatch',
    persistedSnapshot.sourceFamily === currentSnapshot.sourceFamily ? '' : 'current-source-family-mismatch',
    persistedSnapshot.sourceId === currentSnapshot.sourceId ? '' : 'current-source-id-mismatch',
    persistedSnapshot.contentHash === currentSnapshot.contentHash ? '' : 'current-content-hash-mismatch',
    stableStringRecord(persistedSnapshot.versionRefs ?? {}) === stableStringRecord(currentSnapshot.versionRefs)
      ? ''
      : 'current-version-refs-mismatch',
    persistedSnapshot.reviewDecision?.reviewSourceHash === currentSnapshot.reviewDecision.reviewSourceHash
      ? ''
      : 'current-review-source-hash-mismatch',
  ]);
  if (currentMismatchIssues.length > 0) {
    return deniedAssessmentEvidenceAuthority(currentMismatchIssues);
  }
  if (persistedAuthority.limitations.includes('incomplete-catalog-snapshot')) {
    if (context.allowHistoricalIncompleteSnapshotRecovery !== true) {
      return deniedAssessmentEvidenceAuthority([
        ...persistedAuthority.limitations,
        'historical-incomplete-snapshot-recovery-not-allowed',
      ]);
    }
    return currentAuthority;
  }
  return persistedAuthority.mastery
    ? persistedAuthority
    : deniedAssessmentEvidenceAuthority(persistedAuthority.limitations);
}
