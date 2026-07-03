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
  mergeAssessmentItemSemanticReviewDecisions,
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
  };
}

describe('adaptive assessment semantic review workflow', () => {
  it('generates review packets with suggestions separated from decisions', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
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

  it('rejects decisions whose selected stage is not allowed for the item', () => {
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
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
      itemCount: 443,
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
    expect(artifacts.coverage.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'invalid-remediation-ref:knowledge-card:Bode图_1_1',
      'missing-review-decision',
      'missing-learning-goal-binding',
      'missing-kaq-objective-ids',
      'missing-graph-node-refs',
    ]));
  });
});
