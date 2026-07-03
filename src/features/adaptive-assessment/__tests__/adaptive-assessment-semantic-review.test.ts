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
    });

    expect(reviewedSnapshots).toHaveLength(50);
    expect(artifacts.coverage).toMatchObject({
      itemCount: 443,
      reviewedItemCount: 50,
      pathEligibleItemCount: 50,
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
    expect(artifacts.coverage.issues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'missing-review-decision',
      'missing-learning-goal-binding',
      'missing-kaq-objective-ids',
      'missing-graph-node-refs',
    ]));
  });
});
