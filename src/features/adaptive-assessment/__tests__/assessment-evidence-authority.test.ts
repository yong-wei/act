import { describe, expect, it } from 'vitest';

import {
  buildAdaptiveAssessmentItemCatalog,
  type AdaptiveAssessmentCatalogItem,
} from '../adaptive-assessment-item-catalog';
import {
  evaluateAssessmentEvidenceAuthority,
  evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority,
  type AssessmentEvidenceCatalogSnapshot,
} from '../assessment-evidence-authority';
import {
  assessmentItemSemanticReviewSourceHash,
  type AssessmentItemSemanticReviewDecision,
} from '../adaptive-assessment-semantic-review';

function reviewedCheckpoint() {
  const catalog = buildAdaptiveAssessmentItemCatalog({
    presetQuestions: [],
    checkpointQuestions: undefined,
  });
  const item = catalog.items.find((candidate) =>
    candidate.sourceId === 'control-correction-checkpoint-01'
  );
  if (!item) throw new Error('missing checkpoint fixture');
  const decisionWithoutHash: AssessmentItemSemanticReviewDecision = {
    catalogItemId: item.catalogItemId,
    decisionKind: 'human-review',
    outcome: 'approved',
    reviewerId: 'reviewer:test',
    reviewedAt: '2026-07-03T00:00:00.000Z',
    reviewBatchId: 'assessment-authority-test.v1',
    sourceContentHash: item.contentHash,
    selectedLearningGoalIds: item.semanticRefs.learningGoalIds,
    selectedKaqObjectiveIds: item.semanticRefs.kaqObjectiveIds,
    selectedGraphNodeIds: item.semanticRefs.graphNodeIds,
    selectedStagePurpose: 'checkpoint',
    difficulty: item.semanticRefs.difficulty ?? 0.5,
    cognitiveLevel: item.semanticRefs.cognitiveLevel ?? 'apply',
    misconceptionRefs: item.semanticRefs.misconceptionTags,
    remediationRefs: item.semanticRefs.remediationResourceNodeIds,
    metadataVersionRefs: {
      checkpointQuestionSetVersion: item.versionRefs.checkpointQuestionSetVersion,
    },
    notes: 'Reviewed scoring, rubric, source lineage, evidence snapshot, and semantic boundary.',
  };
  const decision: AssessmentItemSemanticReviewDecision = {
    ...decisionWithoutHash,
    reviewSourceHash: assessmentItemSemanticReviewSourceHash(decisionWithoutHash),
  };
  return { item, decision };
}

describe('assessment evidence authority', () => {
  it('grants mastery and checkpoint only for a current complete reviewed contract', () => {
    const { item, decision } = reviewedCheckpoint();

    expect(evaluateAssessmentEvidenceAuthority(item, decision, {
      learningGoalId: 'control-correction',
      requestedStage: 'checkpoint',
    })).toMatchObject({
      mastery: true,
      checkpoint: true,
      remediation: false,
      terminalValidation: false,
      limitations: [],
    });
  });

  it('blocks stale hashes and mismatched semantic boundaries', () => {
    const { item, decision } = reviewedCheckpoint();
    const authority = evaluateAssessmentEvidenceAuthority(item, {
      ...decision,
      sourceContentHash: 'stale-content-hash',
      selectedGraphNodeIds: ['kn:outside-reviewed-boundary'],
    }, {
      requestedStage: 'checkpoint',
      knownGraphNodeIds: item.semanticRefs.graphNodeIds,
    });

    expect(authority.mastery).toBe(false);
    expect(authority.checkpoint).toBe(false);
    expect(authority.limitations).toEqual(expect.arrayContaining([
      'stale-source-hash',
      'invalid-graph-node:kn:outside-reviewed-boundary',
    ]));
    expect(evaluateAssessmentEvidenceAuthority(item, {
      ...decision,
      outcome: 'rejected',
    }).limitations).toContain('review-decision-not-approved');
  });

  it('fails closed when the runtime review source hash is missing or invalid', () => {
    const { item, decision } = reviewedCheckpoint();

    expect(evaluateAssessmentEvidenceAuthority(item, {
      ...decision,
      reviewSourceHash: undefined,
    }).limitations).toEqual(expect.arrayContaining([
      'missing-review-source-hash',
      'invalid-review-source-hash',
    ]));
    expect(evaluateAssessmentEvidenceAuthority(item, {
      ...decision,
      reviewSourceHash: 'sha256:invalid',
    }).mastery).toBe(false);
  });

  it('keeps generated provisional items limited to low-stakes practice', () => {
    const { item, decision } = reviewedCheckpoint();
    const provisional: AdaptiveAssessmentCatalogItem = {
      ...item,
      sourceFamily: 'generated-adaptive-question' as const,
      reviewState: 'generated-provisional' as const,
      eligibilityState: 'generated-provisional' as const,
      allowedStages: ['low-stakes-practice'],
      lineage: {
        ...item.lineage,
        sourceFamily: 'generated-adaptive-question' as const,
      },
    };
    const authority = evaluateAssessmentEvidenceAuthority(provisional, {
      ...decision,
      selectedStagePurpose: 'practice',
    });

    expect(authority.limitedPractice).toBe(true);
    expect(authority.mastery).toBe(false);
    expect(authority.checkpoint).toBe(false);
  });

  it('does not let an assessment item substitute for typed terminal evidence', () => {
    const { item, decision } = reviewedCheckpoint();
    const terminalItem = {
      ...item,
      allowedStages: [...item.allowedStages, 'terminal-validation' as const],
    };
    const terminalDecisionWithoutHash = {
      ...decision,
      selectedStagePurpose: 'terminal-validation' as const,
      reviewSourceHash: undefined,
    };
    const terminalDecision = {
      ...terminalDecisionWithoutHash,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(terminalDecisionWithoutHash),
    };

    expect(evaluateAssessmentEvidenceAuthority(terminalItem, terminalDecision, {
      requestedStage: 'terminal-validation',
    }).terminalValidation).toBe(false);
    expect(evaluateAssessmentEvidenceAuthority(terminalItem, terminalDecision, {
      requestedStage: 'terminal-validation',
      hasTypedTerminalEvidence: true,
    }).terminalValidation).toBe(true);
  });

  it('restores an incomplete historical snapshot only when recovery is explicitly allowed', () => {
    const { item, decision } = reviewedCheckpoint();
    const currentSnapshot = {
      ...item,
      sourceLineage: item.lineage,
      reviewDecision: decision,
      relationship: item.adaptiveAssessmentItemRef,
    };
    const persistedSnapshot = {
      ...currentSnapshot,
      questionRefs: undefined,
    } as unknown as typeof currentSnapshot;

    expect(evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
      persistedSnapshot,
      currentSnapshot,
      { requestedStage: 'checkpoint' },
    ).checkpoint).toBe(false);
    expect(evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
      persistedSnapshot,
      currentSnapshot,
      {
        requestedStage: 'checkpoint',
        allowHistoricalIncompleteSnapshotRecovery: true,
      },
    ).checkpoint).toBe(true);
    expect(evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
      persistedSnapshot,
      { ...currentSnapshot, contentHash: 'changed-content-hash' },
      {
        requestedStage: 'checkpoint',
        allowHistoricalIncompleteSnapshotRecovery: true,
      },
    ).checkpoint).toBe(false);
  });

  it.each(['mastery', 'checkpoint', 'remediation'] as const)(
    're-evaluates current %s authority and rejects revoked, changed, or missing catalog decisions',
    (authorityKey) => {
      const { item, decision } = reviewedCheckpoint();
      const stage: 'checkpoint' | 'remediation' = authorityKey === 'remediation' ? 'remediation' : 'checkpoint';
      const stageItem: AdaptiveAssessmentCatalogItem = {
        ...item,
        allowedStages: [...new Set([...item.allowedStages, stage])],
      };
      const stageDecisionWithoutHash: AssessmentItemSemanticReviewDecision = {
        ...decision,
        selectedStagePurpose: stage,
        reviewSourceHash: undefined,
      };
      const stageDecision = {
        ...stageDecisionWithoutHash,
        reviewSourceHash: assessmentItemSemanticReviewSourceHash(stageDecisionWithoutHash),
      };
      const persistedSnapshot: AssessmentEvidenceCatalogSnapshot = {
        ...stageItem,
        sourceLineage: stageItem.lineage,
        reviewDecision: stageDecision,
        relationship: stageItem.adaptiveAssessmentItemRef,
      };
      const context = authorityKey === 'mastery' ? {} : { requestedStage: stage };

      expect(evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
        persistedSnapshot,
        persistedSnapshot,
        context,
      )[authorityKey]).toBe(true);
      for (const currentSnapshot of [
        null,
        { ...persistedSnapshot, reviewDecision: { ...stageDecision, outcome: 'blocked' as const } },
        { ...persistedSnapshot, contentHash: 'changed-content-hash' },
        { ...persistedSnapshot, versionRefs: { changed: 'version' } },
        { ...persistedSnapshot, reviewDecision: { ...stageDecision, selectedStagePurpose: 'readiness' as const } },
      ]) {
        expect(evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
          persistedSnapshot,
          currentSnapshot,
          context,
        )[authorityKey]).toBe(false);
      }
    },
  );
});
