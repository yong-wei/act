import { describe, expect, it } from 'vitest';

import { PRESET_QUESTIONS } from '@/features/assessment/adaptive-question-bank';

import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
  type AdaptiveAssessmentCatalogItem,
} from '../adaptive-assessment-item-catalog';
import {
  buildAssessmentItemSemanticCoverageReport,
  buildAssessmentItemSemanticReviewArtifacts,
  buildAssessmentItemSemanticReviewPackets,
  buildKaqFoundationSemanticReviewDecisions,
  assessmentItemSemanticReviewSourceHash,
  loadAssessmentItemSemanticReviewSource,
  mergeAssessmentItemSemanticReviewDecisions,
  validateAssessmentItemSemanticReviewSource,
  type AssessmentItemSemanticReviewDecision,
} from '../adaptive-assessment-semantic-review';

function baseDecision(item: AdaptiveAssessmentCatalogItem): AssessmentItemSemanticReviewDecision {
  return {
    catalogItemId: item.catalogItemId,
    decisionKind: 'human-review',
    outcome: 'approved',
    reviewerId: 'reviewer:assessment-content',
    reviewedAt: '2026-07-03T00:00:00.000Z',
    reviewBatchId: 'semantic-review-test.v1',
    sourceContentHash: item.contentHash,
    selectedLearningGoalIds: ['control-correction'],
    selectedKaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
    selectedGraphNodeIds: ['kn:autocontrol:controller-correction'],
    selectedStagePurpose: 'readiness',
    difficulty: 0.5,
    cognitiveLevel: 'analyze',
    misconceptionRefs: ['misconception:controller-tuning'],
    remediationRefs: ['registry:lesson09-correction-precheck'],
    metadataVersionRefs: item.versionRefs,
    notes: 'Reviewed source question, answer/rubric context, content hash, LearningGoal fit, K/A/Q objective ids, graph-node refs, stage purpose, difficulty, cognitive level, misconception refs, and remediation refs.',
  };
}

function reviewSourceFixture() {
  const catalog = buildAdaptiveAssessmentItemCatalog({
    presetQuestions: [PRESET_QUESTIONS[0]],
    checkpointQuestions: [],
    kaqReviewedItems: [],
  });
  const item = {
    ...catalog.items[0],
    versionRefs: { resourceRegistryVersion: 'resource-registry.v1' },
  };
  const decisionWithoutHash: AssessmentItemSemanticReviewDecision = {
    ...baseDecision(item),
    reviewerRole: 'assessment-content-reviewer',
  };
  return {
    item,
    decision: {
      ...decisionWithoutHash,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(decisionWithoutHash),
    },
  };
}

describe('adaptive assessment semantic review workflow', () => {
  it('rejects a missing tracked review source', async () => {
    const { item } = reviewSourceFixture();

    await expect(loadAssessmentItemSemanticReviewSource([item], {
      sourcePath: 'course-content/runtime/resource-governance/does-not-exist-review-source.jsonl',
    })).rejects.toThrow('missing-review-source:');
  });

  it('requires the review source to cover the exact catalog denominator', () => {
    const { item, decision } = reviewSourceFixture();

    expect(() => validateAssessmentItemSemanticReviewSource([item], []))
      .toThrow(`missing-review-source-item:${item.catalogItemId}`);
    expect(() => validateAssessmentItemSemanticReviewSource([item], [decision, decision]))
      .toThrow(`duplicate-review-source-item:${item.catalogItemId}`);
    const orphanWithoutHash = { ...decision, catalogItemId: 'orphan:item', reviewSourceHash: undefined };
    const orphan = {
      ...orphanWithoutHash,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(orphanWithoutHash),
    };
    expect(() => validateAssessmentItemSemanticReviewSource([item], [decision, orphan]))
      .toThrow('orphan-review-source-item:orphan:item');

    const earlierItem = { ...item, catalogItemId: 'a:catalog-item' };
    const earlierWithoutHash = { ...decision, catalogItemId: earlierItem.catalogItemId, reviewSourceHash: undefined };
    const earlierDecision = {
      ...earlierWithoutHash,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(earlierWithoutHash),
    };
    expect(validateAssessmentItemSemanticReviewSource(
      [item, earlierItem],
      [decision, earlierDecision],
    ).map((sourceDecision) => sourceDecision.catalogItemId)).toEqual([
      earlierItem.catalogItemId,
      item.catalogItemId,
    ]);
  });

  it('rejects canonical hash tampering and machine suggestions', () => {
    const { item, decision } = reviewSourceFixture();
    expect(() => validateAssessmentItemSemanticReviewSource([item], [{
      ...decision,
      notes: `${decision.notes} tampered`,
    }])).toThrow(`invalid-review-source-hash:${item.catalogItemId}`);

    const machineWithoutHash = {
      ...decision,
      decisionKind: 'machine-suggestion' as const,
      reviewSourceHash: undefined,
    };
    const machine = {
      ...machineWithoutHash,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(machineWithoutHash),
    };
    expect(() => validateAssessmentItemSemanticReviewSource([item], [machine]))
      .toThrow(`machine-review-source-rejected:${item.catalogItemId}`);
  });

  it('rejects stale source hashes, metadata versions, and incomplete audit fields', () => {
    const { item, decision } = reviewSourceFixture();
    const staleWithoutHash = {
      ...decision,
      reviewerRole: undefined,
      sourceContentHash: 'sha256:stale',
      metadataVersionRefs: { resourceRegistryVersion: 'resource-registry.v0' },
      reviewSourceHash: undefined,
    };
    const stale = {
      ...staleWithoutHash,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(staleWithoutHash),
    };

    expect(() => validateAssessmentItemSemanticReviewSource([item], [stale])).toThrow(
      `missing-review-audit-field:${item.catalogItemId}:reviewerRole`,
    );
    expect(() => validateAssessmentItemSemanticReviewSource([item], [stale])).toThrow(
      `stale-source-content-hash:${item.catalogItemId}`,
    );
    expect(() => validateAssessmentItemSemanticReviewSource([item], [stale])).toThrow(
      `stale-metadata-version-refs:${item.catalogItemId}`,
    );
  });

  it('generates review packets with suggestions separated from decisions', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const [packet] = buildAssessmentItemSemanticReviewPackets(catalog.items);

    expect(packet).toMatchObject({
      packetVersion: 'assessment-item-semantic-review-packet.v1',
      catalogItemId: catalog.items[0].catalogItemId,
      question: {
        options: expect.arrayContaining([
          expect.objectContaining({
            text: expect.any(String),
            isCorrect: expect.any(Boolean),
          }),
        ]),
      },
      machineSuggestions: {
        fieldsAreSuggestionsOnly: true,
        maySetReviewedState: false,
      },
      reviewDecision: null,
    });
    expect(packet.missingBlockers).toEqual(expect.arrayContaining([
      'missing-kaq-reviewed-metadata',
      'not-path-eligible',
    ]));
  });

  it('uses semantic review version refs in review packets', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = {
      ...catalog.items[0],
      versionRefs: {
        catalogVersion: 'adaptive-assessment-item-catalog.v1',
        resourceRegistryVersion: 'resource-registry.v1',
      },
    };
    const [packet] = buildAssessmentItemSemanticReviewPackets([item]);

    expect(packet.packetVersionRefs).toEqual({
      resourceRegistryVersion: 'resource-registry.v1',
    });
  });

  it('preserves existing human-edited snapshots over generated K/A/Q decisions', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const generated = {
      ...baseDecision(item),
      reviewerId: 'openspec-buddy:kaq-quiz-foundation-bank',
      reviewBatchId: 'kaq-quiz-foundation-bank.v1',
    };
    const manual = {
      ...generated,
      outcome: 'blocked' as const,
      reviewerId: 'reviewer:manual-assessment-content',
      reviewBatchId: 'manual-review.v1',
    };

    expect(mergeAssessmentItemSemanticReviewDecisions([manual], [generated])).toEqual([manual]);
  });

  it('refreshes existing generated K/A/Q snapshots from the source overlay across batch versions', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const generated = {
      ...baseDecision(item),
      reviewerId: 'openspec-buddy:kaq-quiz-foundation-bank',
      reviewBatchId: 'kaq-quiz-foundation-bank.v2',
      selectedKaqObjectiveIds: ['knowledge:autocontrol:updated-objective'],
    };
    const existingGenerated = {
      ...generated,
      reviewBatchId: 'kaq-quiz-foundation-bank.v1',
      sourceContentHash: 'old-source-hash',
      selectedKaqObjectiveIds: ['knowledge:autocontrol:old-objective'],
    };

    expect(mergeAssessmentItemSemanticReviewDecisions([existingGenerated], [generated])).toEqual([generated]);
  });

  it('rejects script-only review decisions and missing required semantic fields', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [{
        ...baseDecision(item),
        decisionKind: 'machine-suggestion',
        selectedKaqObjectiveIds: [],
      }],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'script-only-review-rejected',
      'missing-kaq-objective-ids',
    ]));
  });

  it('reports stale source hashes and invalid objective ids', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      knownLearningGoalIds: ['control-correction'],
      knownKaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
      knownGraphNodeIds: ['kn:autocontrol:controller-correction'],
      decisions: [{
        ...baseDecision(item),
        sourceContentHash: 'stale-source-content-hash',
        selectedKaqObjectiveIds: ['knowledge:autocontrol:missing-objective'],
      }],
    });

    expect(report.staleReviewCount).toBe(1);
    expect(report.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'stale-source-hash',
      'invalid-kaq-objective:knowledge:autocontrol:missing-objective',
    ]));
  });

  it('requires reviewer-visible rationale for approved human decisions', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = {
      ...catalog.items[0],
      reviewState: 'path-eligible' as const,
      eligibilityState: 'path-eligible' as const,
      allowedStages: ['readiness' as const],
    };
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      knownLearningGoalIds: ['control-correction'],
      knownKaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
      knownGraphNodeIds: ['kn:autocontrol:controller-correction'],
      knownRemediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
      decisions: [{
        ...baseDecision(item),
        notes: '',
      }],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.pathEligibleItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toContain('missing-review-rationale');
  });

  it('rejects decisions whose selected stage is not allowed for the item', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = {
      ...catalog.items[0],
      reviewState: 'path-eligible' as const,
      eligibilityState: 'path-eligible' as const,
      allowedStages: ['readiness' as const],
    };
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [{
        ...baseDecision(item),
        selectedStagePurpose: 'checkpoint',
      }],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.pathEligibleItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toContain('invalid-assessment-stage:checkpoint');
  });

  it('reports stale hashes for non-approved human decisions', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [{
        ...baseDecision(item),
        outcome: 'blocked',
        sourceContentHash: 'stale-source-content-hash',
      }],
    });

    expect(report.blockedItemCount).toBe(0);
    expect(report.staleReviewCount).toBe(1);
    expect(report.issues.map((issue) => issue.reason)).toContain('stale-source-hash');
  });

  it('rejects non-approved machine suggestions as reviewed decisions', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [{
        ...baseDecision(item),
        decisionKind: 'machine-suggestion',
        outcome: 'rejected',
        reviewerId: undefined,
        reviewedAt: undefined,
        reviewBatchId: undefined,
      }],
    });

    expect(report.rejectedItemCount).toBe(0);
    expect(report.reviewedItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'script-only-review-rejected',
      'missing-reviewer',
      'missing-reviewed-at',
      'missing-review-batch-id',
    ]));
  });

  it('reports stale metadata version refs even when source content is unchanged', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [{
        ...baseDecision(item),
        metadataVersionRefs: {
          catalogVersion: 'stale-catalog-version.v0',
        },
      }],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toContain('stale-metadata-version-refs');
  });

  it('reports stale metadata version refs when a decision omits current version keys', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [{
        ...baseDecision(item),
        metadataVersionRefs: {
          catalogVersion: item.versionRefs.catalogVersion,
        },
      }],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toContain('stale-metadata-version-refs');
  });

  it('reports missing fields for incomplete persisted human decisions without crashing', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const incompleteDecision = {
      ...baseDecision(item),
      metadataVersionRefs: undefined,
      selectedLearningGoalIds: undefined,
      selectedKaqObjectiveIds: undefined,
      selectedGraphNodeIds: undefined,
      misconceptionRefs: undefined,
      remediationRefs: undefined,
    } as unknown as AssessmentItemSemanticReviewDecision;
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [incompleteDecision],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'missing-learning-goal-binding',
      'missing-kaq-objective-ids',
      'missing-graph-node-refs',
      'missing-misconception-refs',
      'missing-remediation-refs',
      'missing-metadata-version-refs',
      'stale-metadata-version-refs',
    ]));
  });

  it('rejects remediation refs that are not in the governed resource baseline', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      knownRemediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
      decisions: [{
        ...baseDecision(item),
        remediationRefs: ['registry:not-a-real-remediation'],
      }],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toContain(
      'invalid-remediation-ref:registry:not-a-real-remediation',
    );
  });

  it('accepts remediation refs when the governed baseline marks them path eligible', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = catalog.items[0];
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      knownRemediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
      decisions: [baseDecision(item)],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.pathEligibleItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).not.toContain(
      'invalid-remediation-ref:registry:lesson09-correction-precheck',
    );
  });

  it('allows non K/A/Q sources to satisfy version refs with their catalog snapshot', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      icourseObjectiveBankItems: [{
        question_id: 'icourse-version-check',
        stem: '哪一项用于判断闭环稳定裕度？',
        choice_mode: 'single',
        options: [
          { key: 'A', text: '相位裕度', is_correct: true },
          { key: 'B', text: '字体大小', is_correct: false },
        ],
        correct_answers: ['A'],
        knowledge_tags: ['frequency-response'],
        adaptive_metadata: {
          review_status: 'verified',
          difficulty_seed: 0.4,
        },
      }],
      kaqReviewedItems: [],
      checkpointQuestions: [],
    });
    const item = {
      ...catalog.items[0],
      reviewState: 'path-eligible' as const,
      eligibilityState: 'path-eligible' as const,
      allowedStages: ['readiness' as const],
    };
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      knownLearningGoalIds: ['control-correction'],
      knownKaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
      knownGraphNodeIds: ['kn:autocontrol:controller-correction'],
      knownRemediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
      decisions: [baseDecision(item)],
    });

    expect(report.reviewedItemCount).toBe(1);
    expect(report.pathEligibleItemCount).toBe(1);
    expect(report.issues.map((issue) => issue.reason)).not.toContain('stale-metadata-version-refs');
    expect(report.issues.map((issue) => issue.reason)).not.toContain('missing-metadata-version-refs');
  });

  it('keeps stale K/A/Q human review overlays visible as stale decisions', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const staleReview = sources.kaqReviewedItems.find((item) => item.questionId === 'preset-q-01');
    expect(staleReview).toBeTruthy();
    const staleReviewedItem = {
      ...staleReview!,
      metadata: {
        ...staleReview!.metadata,
        review: {
          ...staleReview!.metadata?.review,
          sourceHash: 'stale-source-hash',
        },
      },
    };
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [staleReviewedItem],
    });
    const reviewedSnapshots = buildKaqFoundationSemanticReviewDecisions(catalog.items, [staleReviewedItem]);
    const report = buildAssessmentItemSemanticCoverageReport({
      items: catalog.items,
      decisions: reviewedSnapshots,
    });

    expect(catalog.items[0].reviewState).toBe('imported-unreviewed');
    expect(reviewedSnapshots).toHaveLength(1);
    expect(report.staleReviewCount).toBe(1);
    expect(report.issues.map((issue) => issue.reason)).toContain('stale-source-hash');
  });

  it('keeps K/A/Q review-time version refs so stale review metadata is counted', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const reviewed = sources.kaqReviewedItems.find((item) => item.questionId === 'preset-q-01');
    expect(reviewed).toBeTruthy();
    const staleReviewedItem = {
      ...reviewed!,
      metadata: {
        ...reviewed!.metadata,
        versionRefs: {
          ...(reviewed!.metadata?.versionRefs ?? {}),
          objectiveCatalogVersion: 'autocontrol-kaq-objectives.v0',
        },
      },
    };
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [staleReviewedItem],
    });
    const reviewedSnapshots = buildKaqFoundationSemanticReviewDecisions(catalog.items, [staleReviewedItem]);
    const report = buildAssessmentItemSemanticCoverageReport({
      items: catalog.items,
      decisions: reviewedSnapshots,
    });

    expect(reviewedSnapshots[0].metadataVersionRefs.objectiveCatalogVersion).toBe('autocontrol-kaq-objectives.v0');
    expect(report.reviewedItemCount).toBe(0);
    expect(report.staleReviewCount).toBe(1);
    expect(report.issues.map((issue) => issue.reason)).toContain('stale-metadata-version-refs');
  });

  it('does not backfill missing K/A/Q review-time version refs from the current catalog item', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const reviewed = sources.kaqReviewedItems.find((item) => item.questionId === 'preset-q-01');
    expect(reviewed).toBeTruthy();
    const versionRefs = { ...(reviewed!.metadata?.versionRefs ?? {}) };
    delete versionRefs.resourceRegistryVersion;
    const staleReviewedItem = {
      ...reviewed!,
      metadata: {
        ...reviewed!.metadata,
        versionRefs,
      },
    };
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [staleReviewedItem],
    });
    const reviewedSnapshots = buildKaqFoundationSemanticReviewDecisions(catalog.items, [staleReviewedItem]);
    const report = buildAssessmentItemSemanticCoverageReport({
      items: catalog.items,
      decisions: reviewedSnapshots,
    });

    expect(reviewedSnapshots[0].metadataVersionRefs.resourceRegistryVersion).toBeUndefined();
    expect(report.reviewedItemCount).toBe(0);
    expect(report.staleReviewCount).toBe(1);
    expect(report.issues.map((issue) => issue.reason)).toContain('stale-metadata-version-refs');
  });

  it('keeps invalid path eligibility out of gate counts without dropping the item', () => {
    const sources = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = {
      ...sources.items[0],
      reviewState: 'path-eligible' as const,
      eligibilityState: 'path-eligible' as const,
      allowedStages: ['readiness' as const],
    };
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [],
    });

    expect(report.itemCount).toBe(1);
    expect(report.reviewedItemCount).toBe(0);
    expect(report.pathEligibleItemCount).toBe(0);
    expect(report.sourceFamilies[0]).toMatchObject({
      itemTotal: 1,
      unreviewedTotal: 1,
    });
    expect(report.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'missing-review-decision',
      'invalid-path-eligibility',
    ]));
  });

  it.each(['blocked', 'rejected', 'deprecated'] as const)(
    'lets a valid %s disposition override a catalog path-gate candidate',
    (outcome) => {
      const { item: fixtureItem, decision } = reviewSourceFixture();
      const item = {
        ...fixtureItem,
        reviewState: 'path-eligible' as const,
        eligibilityState: 'path-eligible' as const,
        allowedStages: ['readiness' as const],
      };
      const report = buildAssessmentItemSemanticCoverageReport({
        items: [item],
        decisions: [{ ...decision, outcome }],
      });

      expect(report.issues.map((issue) => issue.reason)).not.toContain('invalid-path-eligibility');
      expect(report.pathEligibleItemCount).toBe(0);
      expect(report.sourceFamilies[0]).toMatchObject({
        [`${outcome}Total`]: 1,
      });
    },
  );

  it('keeps a malformed approved decision fail closed at the path gate', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      kaqReviewedItems: [],
    });
    const item = {
      ...catalog.items[0],
      reviewState: 'path-eligible' as const,
      eligibilityState: 'path-eligible' as const,
      allowedStages: ['readiness' as const],
    };
    const report = buildAssessmentItemSemanticCoverageReport({
      items: [item],
      decisions: [{
        ...baseDecision(item),
        selectedLearningGoalIds: [],
      }],
    });

    expect(report.reviewedItemCount).toBe(0);
    expect(report.pathEligibleItemCount).toBe(0);
    expect(report.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'missing-learning-goal-binding',
      'invalid-path-eligibility',
    ]));
  });

  it('inherits source-family blocked totals from catalog summaries', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      icourseObjectiveBankItems: [],
      icourseObjectiveBankIndexTotal: 2,
    });
    const report = buildAssessmentItemSemanticCoverageReport({
      items: catalog.items,
      sourceFamilies: catalog.manifest.sourceFamilies,
    });

    expect(report.sourceFamilies.find((family) => family.family === 'icourse-objective-bank')).toMatchObject({
      sourceTotal: 2,
      itemTotal: 0,
      blockedTotal: 2,
    });
  });

  it('builds current repository reviewed snapshots from K/A/Q human review overlays', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: PRESET_QUESTIONS,
      acqStaticQuestions: sources.acqStaticQuestions,
      icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
      icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
      kaqReviewedItems: sources.kaqReviewedItems,
    });
    const reviewedSnapshots = buildKaqFoundationSemanticReviewDecisions(catalog.items, sources.kaqReviewedItems);
    const artifacts = buildAssessmentItemSemanticReviewArtifacts({
      items: catalog.items,
      decisions: reviewedSnapshots,
      sourceFamilies: catalog.manifest.sourceFamilies,
      knownRemediationResourceNodeIds: [],
    });

    expect(reviewedSnapshots).toHaveLength(50);
    expect(artifacts.coverage).toMatchObject({
      itemCount: 576,
      reviewedItemCount: 0,
      pathEligibleItemCount: 0,
      staleReviewCount: 0,
    });
    expect(artifacts.coverage.sourceFamilies.find((family) => family.family === 'kaq-foundation-reviewed')).toMatchObject({
      role: 'review-overlay',
      sourceTotal: 50,
      itemTotal: 0,
      reviewOverlayTotal: 50,
    });
    expect(artifacts.coverage.sourceFamilies.find((family) => family.family === 'acq-static-question')).toMatchObject({
      itemTotal: 167,
      unreviewedTotal: 167,
    });
    expect(artifacts.coverage.sourceFamilies.find((family) => family.family === 'icourse-objective-bank')).toMatchObject({
      itemTotal: 226,
      unreviewedTotal: 226,
    });
    expect(artifacts.coverage.sourceFamilies.find((family) => family.family === 'preset-adaptive-question')).toMatchObject({
      itemTotal: 50,
      reviewedTotal: 0,
      pathEligibleTotal: 0,
      unreviewedTotal: 50,
    });
    expect(artifacts.coverage.sourceFamilies.find((family) => family.family === 'checkpoint-authored-question')).toMatchObject({
      itemTotal: 133,
      unreviewedTotal: 133,
    });
    expect(artifacts.coverage.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'invalid-remediation-ref:knowledge-card:Bode图_1_1',
      'missing-review-decision',
      'missing-learning-goal-binding',
      'missing-kaq-objective-ids',
      'missing-graph-node-refs',
    ]));
  });

  it('counts only tracked authored review decisions when ResourceNode remediation refs are known', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: PRESET_QUESTIONS,
      acqStaticQuestions: sources.acqStaticQuestions,
      icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
      icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
      kaqReviewedItems: sources.kaqReviewedItems,
    });
    const reviewedSnapshots = await loadAssessmentItemSemanticReviewSource(catalog.items);
    const remediationRefs = reviewedSnapshots.flatMap((decision) => decision.remediationRefs);
    const artifacts = buildAssessmentItemSemanticReviewArtifacts({
      items: catalog.items,
      decisions: reviewedSnapshots,
      sourceFamilies: catalog.manifest.sourceFamilies,
      knownRemediationResourceNodeIds: remediationRefs,
    });

    expect(reviewedSnapshots).toHaveLength(576);
    expect(reviewedSnapshots.every((decision) => decision.notes?.trim())).toBe(true);
    expect(artifacts.packets
      .filter((packet) => packet.reviewDecision?.outcome === 'approved')
      .every((packet) => packet.reviewDecision?.notes?.trim())).toBe(true);
    expect(artifacts.coverage.reviewedItemCount).toBe(135);
    expect(artifacts.coverage.pathEligibleItemCount).toBe(135);
    expect(artifacts.coverage.sourceFamilies.find((family) => family.family === 'checkpoint-authored-question')).toMatchObject({
      itemTotal: 133,
      reviewedTotal: 133,
      pathEligibleTotal: 133,
    });
  });
});
