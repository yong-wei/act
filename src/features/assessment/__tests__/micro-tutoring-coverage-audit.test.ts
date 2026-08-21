import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import {
  assessmentItemSemanticReviewSourceHash,
  type AssessmentItemSemanticReviewDecision,
} from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  buildMicroTutoringCoverageAuditReport,
  microTutoringCoverageAuditIsStrictlyComplete,
  microTutoringCoverageAuditMarkdown,
  type MicroTutoringOptionAttribution,
  type MicroTutoringPracticeBaseline,
} from '../micro-tutoring-coverage-audit';
import { findMicroTutoringOptionAttribution } from '../micro-tutoring-option-attribution';
import {
  isMicroTutoringOptionAttribution,
  microTutoringOptionAttributionReviewSourceHash,
} from '../micro-tutoring-option-attribution';
import { resolveMicroTutoringGoalNode } from '../micro-tutoring-goal-node-catalog';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const OPTION_REFERENCE_SECRET = 'test-only-micro-tutoring-option-reference-secret';

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(GOVERNANCE_DIR, name), 'utf8')) as T;
}

function readJsonl<T>(name: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, name), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

const catalogItems = readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl');
const reviewDecisions = readJsonl<AssessmentItemSemanticReviewDecision>('assessment-item-semantic-review-snapshots.jsonl');
const baseline = readJson<MicroTutoringPracticeBaseline>('micro-tutoring-practice-baseline.json');
const publishedOptionAttributions = readJson<{ entries: unknown[] }>('micro-tutoring-option-attributions.json');

function buildAttributions(): MicroTutoringOptionAttribution[] {
  const decisionByItemId = new Map(reviewDecisions.map((decision) => [decision.catalogItemId, decision]));
  return catalogItems.flatMap((item) => {
    const decision = decisionByItemId.get(item.catalogItemId);
    if (decision?.selectedStagePurpose !== 'practice') return [];
    return (item.questionRefs.options ?? [])
      .filter((option) => option.isCorrect === false && option.key)
      .map((option) => {
        const goalNode = resolveMicroTutoringGoalNode(decision.selectedLearningGoalIds[0]);
        if (!goalNode.ok) throw new Error(goalNode.reason);
        return {
        catalogItemId: item.catalogItemId,
        contentHash: item.contentHash,
        optionKey: option.key!,
        learningGoalId: decision.selectedLearningGoalIds[0],
        misconceptionTag: `misconception:${decision.selectedLearningGoalIds[0]}:${option.key!.toLowerCase()}`,
        knowledgeNodeId: goalNode.knowledgeNodeId,
        version: 'micro-tutoring-option-attribution.v2',
        itemReviewSourceHash: decision.reviewSourceHash!,
        reviewerId: 'assessment-content-reviewer:test',
        reviewerRole: 'assessment-content-reviewer',
        reviewedAt: '2026-08-20T00:00:00.000Z',
        reviewBatchId: 'micro-tutoring-option-attribution-review.test',
        evidenceSummary: `Independent reviewed evidence for option ${option.key}.`,
        limitations: ['content-hash-bound'],
        };
      }).map((attribution) => ({
        ...attribution,
        reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(attribution),
      }));
  });
}

function rehashAttribution(
  attribution: MicroTutoringOptionAttribution,
): MicroTutoringOptionAttribution {
  const { reviewSourceHash: _reviewSourceHash, ...withoutHash } = attribution;
  return {
    ...withoutHash,
    reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(withoutHash),
  };
}

function report(input: Partial<Parameters<typeof buildMicroTutoringCoverageAuditReport>[0]> = {}) {
  const attributions = buildAttributions();
  return buildMicroTutoringCoverageAuditReport({
    catalogItems,
    reviewDecisions,
    baseline,
    optionAttributions: [],
    optionReferenceSecret: OPTION_REFERENCE_SECRET,
    activeLearningGoalIds: [...new Set(attributions.map((attribution) => attribution.learningGoalId))],
    activeKnowledgeNodeIds: [...new Set(attributions.map((attribution) => attribution.knowledgeNodeId))],
    resolveResources: () => [{ id: 'resource-1', version: 'resource.v1', estimatedMinutes: 3, actionPath: '/resources/1' }],
    resolveValidationItems: (sourceQuestionId) => [{
      id: 'validation-1',
      questionId: `${sourceQuestionId}-variant`,
      contentHash: 'a'.repeat(64),
      version: 'validation.v1',
      estimatedMinutes: 2,
      actionPath: '/assessment/adaptive-practice',
    }],
    ...input,
  });
}

function reportWithPublishedAttributions() {
  const attributions = publishedOptionAttributions.entries as MicroTutoringOptionAttribution[];
  return report({
    optionAttributions: attributions,
    activeLearningGoalIds: [...new Set(attributions.map((attribution) => attribution.learningGoalId))],
    activeKnowledgeNodeIds: [...new Set(attributions.map((attribution) => attribution.knowledgeNodeId))],
  });
}

describe('micro tutoring coverage audit', () => {
  it('pins the 54-item practice denominator and exposes all 108 un-attributed error options', () => {
    const result = report();

    expect(baseline).not.toHaveProperty('optionReferenceSalt');
    expect(result.baselineIssues).toEqual([]);
    expect(result.qualifiedPracticeItemCount).toBe(54);
    expect(result.errorOptionCount).toBe(108);
    expect(result.gapReasonCounts.ATTRIBUTION_UNCERTAIN).toBe(108);
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });

  it('covers every qualified error option with a reviewed published attribution', () => {
    const result = reportWithPublishedAttributions();

    expect(publishedOptionAttributions.entries).toHaveLength(108);
    expect(result.attributionIssues).toEqual([]);
    expect(result.gapReasonCounts.ATTRIBUTION_UNCERTAIN).toBe(0);
    expect(result.rows.every((row) => row.attributionVersion === 'micro-tutoring-option-attribution.v2')).toBe(true);
  });

  it('resolves only an exact published option attribution', () => {
    const attribution = publishedOptionAttributions.entries[0] as MicroTutoringOptionAttribution;
    const item = catalogItems.find((candidate) => candidate.catalogItemId === attribution.catalogItemId)!;
    const reviewDecision = reviewDecisions.find((candidate) => candidate.catalogItemId === attribution.catalogItemId)!;
    const correctOptionKey = (item.questionRefs.options ?? []).find((option) => option.isCorrect)?.key!;
    const baseInput = {
      entries: publishedOptionAttributions.entries,
      catalogItemId: attribution.catalogItemId,
      contentHash: attribution.contentHash,
      selectedOptionKey: attribution.optionKey,
      correctOptionKey,
      itemReviewSourceHash: reviewDecision.reviewSourceHash!,
      reviewedLearningGoalIds: reviewDecision.selectedLearningGoalIds,
      reviewedKnowledgeNodeIds: reviewDecision.selectedGraphNodeIds,
      reviewedMisconceptionTags: reviewDecision.misconceptionRefs,
    };

    expect(findMicroTutoringOptionAttribution(baseInput)).toEqual(attribution);
    expect(findMicroTutoringOptionAttribution({
      ...baseInput,
      contentHash: 'f'.repeat(64),
    })).toBeNull();
    expect(findMicroTutoringOptionAttribution({
      ...baseInput,
      selectedOptionKey: correctOptionKey,
    })).toBeNull();

    expect(findMicroTutoringOptionAttribution({
      ...baseInput,
      entries: [
        attribution,
        { ...attribution, evidenceSummary: '' },
      ],
    })).toBeNull();
  });

  it('binds every published error option to independent reviewed evidence', () => {
    const attributions = publishedOptionAttributions.entries as MicroTutoringOptionAttribution[];
    const byCatalogItem = new Map<string, MicroTutoringOptionAttribution[]>();

    for (const attribution of attributions) {
      expect(isMicroTutoringOptionAttribution(attribution)).toBe(true);
      expect(attribution.reviewSourceHash).toBe(
        microTutoringOptionAttributionReviewSourceHash(attribution),
      );
      const reviewDecision = reviewDecisions.find((decision) =>
        decision.catalogItemId === attribution.catalogItemId)!;
      expect(attribution.itemReviewSourceHash).toBe(reviewDecision.reviewSourceHash);
      const item = catalogItems.find((candidate) =>
        candidate.catalogItemId === attribution.catalogItemId)!;
      const option = item.questionRefs.options?.find((candidate) =>
        candidate.key === attribution.optionKey)!;
      expect(attribution.evidenceSummary).not.toContain(option.text);
      const entries = byCatalogItem.get(attribution.catalogItemId) ?? [];
      entries.push(attribution);
      byCatalogItem.set(attribution.catalogItemId, entries);
    }

    expect(byCatalogItem.size).toBe(54);
    for (const entries of byCatalogItem.values()) {
      expect(entries).toHaveLength(2);
      expect(new Set(entries.map((entry) => entry.misconceptionTag)).size).toBe(2);
      expect(new Set(entries.map((entry) => entry.reviewSourceHash)).size).toBe(2);
      expect(new Set(entries.map((entry) => entry.evidenceSummary)).size).toBe(2);
    }
  });

  it('fails closed when sibling options reuse reviewed misconception evidence', () => {
    const attributions = buildAttributions();
    const [first, second] = attributions;
    const reusedEvidence = rehashAttribution({
      ...second,
      misconceptionTag: first.misconceptionTag,
      evidenceSummary: first.evidenceSummary,
    });
    const result = report({
      optionAttributions: [first, reusedEvidence, ...attributions.slice(2)],
    });

    expect(result.attributionIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'ATTRIBUTION_RECORD_REVIEW_EVIDENCE_REUSED' }),
    ]));
    expect(result.rows
      .filter((row) => row.catalogItemId === first.catalogItemId)
      .every((row) => row.reasons.includes('ATTRIBUTION_UNCERTAIN'))).toBe(true);
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });

  it('blocks a goal-node catalog conflict before resource and validation lookup', () => {
    const attributions = publishedOptionAttributions.entries as MicroTutoringOptionAttribution[];
    const conflicting = rehashAttribution({
      ...attributions[0],
      knowledgeNodeId: 'cap:autocontrol:synthesize-controller-correction',
    });
    const resolveResources = vi.fn(() => []);
    const resolveValidationItems = vi.fn(() => []);
    const result = report({
      optionAttributions: [conflicting, ...attributions.slice(1)],
      resolveResources,
      resolveValidationItems,
    });

    expect(result.attributionIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'GOAL_NODE_CONFLICT' }),
    ]));
    expect(resolveResources).toHaveBeenCalledTimes(107);
    expect(resolveValidationItems).toHaveBeenCalledTimes(107);
    expect(result.rows
      .filter((row) => row.catalogItemId === conflicting.catalogItemId)
      .some((row) => row.reasons.includes('ATTRIBUTION_UNCERTAIN'))).toBe(true);
  });

  it('reports content hash drift and duplicate baseline identifiers without changing the denominator', () => {
    const result = report({
      baseline: {
        ...baseline,
        entries: [
          ...baseline.entries,
          { ...baseline.entries[0], contentHash: 'b'.repeat(64) },
        ],
      },
    });

    expect(result.baselineIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'BASELINE_ITEM_DUPLICATE', catalogItemId: baseline.entries[0].catalogItemId }),
      expect.objectContaining({ reason: 'CONTENT_HASH_DRIFT', catalogItemId: baseline.entries[0].catalogItemId }),
    ]));
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });

  it('rejects duplicate catalog identifiers before practice eligibility filtering', () => {
    const sourceItem = catalogItems.find((item) => item.catalogItemId === baseline.entries[0].catalogItemId)!;
    const duplicateCatalogItem: AdaptiveAssessmentCatalogItem = {
      ...sourceItem,
      contentHash: 'd'.repeat(64),
      lineage: {
        ...sourceItem.lineage,
        sourceHash: 'd'.repeat(64),
      },
    };
    const result = report({
      catalogItems: [...catalogItems, duplicateCatalogItem],
      optionAttributions: buildAttributions(),
    });

    expect(result.qualifiedPracticeItemCount).toBe(54);
    expect(result.gapOptionCount).toBe(0);
    expect(result.baselineIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'BASELINE_ITEM_DUPLICATE',
        catalogItemId: sourceItem.catalogItemId,
      }),
    ]));
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });

  it('rejects a baseline and catalog that expand together beyond the v1 denominator', () => {
    const sourceItem = catalogItems.find((item) => item.catalogItemId === baseline.entries[0].catalogItemId)!;
    const sourceDecision = reviewDecisions.find((decision) => decision.catalogItemId === sourceItem.catalogItemId)!;
    const contentHash = 'c'.repeat(64);
    const catalogItemId = `${sourceItem.catalogItemId}-expanded`;
    const extraItem: AdaptiveAssessmentCatalogItem = {
      ...sourceItem,
      catalogItemId,
      sourceId: `${sourceItem.sourceId}-expanded`,
      sourceAnchor: `${sourceItem.sourceAnchor}-expanded`,
      contentHash,
      lineage: {
        ...sourceItem.lineage,
        sourceId: `${sourceItem.lineage.sourceId}-expanded`,
        sourceHash: contentHash,
      },
    };
    const { reviewSourceHash: _reviewSourceHash, ...extraDecisionInput } = sourceDecision;
    const extraDecision = {
      ...extraDecisionInput,
      catalogItemId,
      sourceContentHash: contentHash,
    };
    const extraReviewSourceHash = assessmentItemSemanticReviewSourceHash(extraDecision);
    const extraAttributions = (extraItem.questionRefs.options ?? [])
      .filter((option) => option.isCorrect === false && option.key)
      .map((option) => {
        const goalNode = resolveMicroTutoringGoalNode(sourceDecision.selectedLearningGoalIds[0]);
        if (!goalNode.ok) throw new Error(goalNode.reason);
        return {
        catalogItemId,
        contentHash,
        optionKey: option.key!,
        learningGoalId: sourceDecision.selectedLearningGoalIds[0],
        misconceptionTag: `misconception:${sourceDecision.selectedLearningGoalIds[0]}:${option.key!.toLowerCase()}`,
        knowledgeNodeId: goalNode.knowledgeNodeId,
        version: 'micro-tutoring-option-attribution.v2',
        itemReviewSourceHash: extraReviewSourceHash,
        reviewerId: 'assessment-content-reviewer:test',
        reviewerRole: 'assessment-content-reviewer',
        reviewedAt: '2026-08-20T00:00:00.000Z',
        reviewBatchId: 'micro-tutoring-option-attribution-review.test',
        evidenceSummary: `Independent reviewed evidence for option ${option.key}.`,
        limitations: ['content-hash-bound'],
        };
      }).map((attribution) => ({
        ...attribution,
        reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(attribution),
      }));
    const result = report({
      catalogItems: [...catalogItems, extraItem],
      reviewDecisions: [
        ...reviewDecisions,
        {
          ...extraDecision,
          reviewSourceHash: extraReviewSourceHash,
        },
      ],
      baseline: {
        ...baseline,
        entries: [...baseline.entries, { catalogItemId, contentHash }],
      },
      optionAttributions: [...buildAttributions(), ...extraAttributions],
    });

    expect(result.baselineItemCount).toBe(55);
    expect(result.qualifiedPracticeItemCount).toBe(55);
    expect(result.gapOptionCount).toBe(0);
    expect(result.baselineIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'BASELINE_ITEM_COUNT_DRIFT',
        catalogItemId: baseline.version,
        expectedItemCount: 54,
        actualItemCount: 55,
      }),
      expect.objectContaining({
        reason: 'BASELINE_ITEM_COUNT_DRIFT',
        catalogItemId: 'qualified-practice-items',
        expectedItemCount: 54,
        actualItemCount: 55,
      }),
    ]));
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });

  it('fails closed when the baseline version changes without an explicit audit migration', () => {
    const result = report({
      baseline: {
        ...baseline,
        version: 'micro-tutoring-practice-baseline.v2',
      },
      optionAttributions: buildAttributions(),
    });

    expect(result.gapOptionCount).toBe(0);
    expect(result.baselineIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'BASELINE_VERSION_UNSUPPORTED',
        catalogItemId: 'micro-tutoring-practice-baseline.v2',
      }),
    ]));
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });

  it('requires a unique option attribution and an independent validation item', () => {
    const attributions = buildAttributions();
    const duplicated = [...attributions, attributions[0]];
    const duplicateResult = report({ optionAttributions: duplicated });
    expect(duplicateResult.rows
      .filter((row) => row.catalogItemId === attributions[0].catalogItemId)
      .some((row) => row.reasons.includes('ATTRIBUTION_UNCERTAIN')))
      .toBe(true);

    const sourceItem = catalogItems.find((item) => item.catalogItemId === attributions[0].catalogItemId)!;
    const sameQuestionResult = report({
      optionAttributions: attributions,
      resolveValidationItems: () => [{
        id: 'same-question',
        questionId: sourceItem.sourceId,
        contentHash: sourceItem.contentHash,
        version: 'validation.v1',
        estimatedMinutes: 2,
        actionPath: '/assessment/adaptive-practice',
      }],
    });
    expect(sameQuestionResult.rows
      .filter((row) => row.catalogItemId === sourceItem.catalogItemId)
      .every((row) => row.reasons.includes('VALIDATION_QUESTION_UNAVAILABLE')))
      .toBe(true);

    const noResourceResult = report({
      optionAttributions: attributions,
      resolveResources: () => [],
    });
    expect(noResourceResult.rows.every((row) => row.reasons.includes('RESOURCE_UNAVAILABLE'))).toBe(true);

    const accessDeniedResult = report({
      optionAttributions: attributions,
      resolveResources: () => [],
      resolveResourceAccessDenied: () => true,
    });
    expect(accessDeniedResult.rows.every((row) => row.reasons.includes('ACCESS_REVOKED'))).toBe(true);
  });

  it('audits the complete attribution source instead of only matched error options', () => {
    const attributions = buildAttributions();
    const sourceItem = catalogItems.find((item) => item.catalogItemId === attributions[0].catalogItemId)!;
    const correctOption = (sourceItem.questionRefs.options ?? []).find((option) => option.isCorrect === true)!;
    const result = report({
      optionAttributions: [
        ...attributions,
        rehashAttribution(attributions[0]),
        rehashAttribution({
          ...attributions[0],
          catalogItemId: 'adaptive-assessment-item:unknown',
        }),
        rehashAttribution({
          ...attributions[0],
          contentHash: 'e'.repeat(64),
        }),
        rehashAttribution({
          ...attributions[0],
          optionKey: correctOption.key!,
        }),
        null,
      ],
    });

    expect(result.attributionIssues.map((issue) => issue.reason)).toEqual(expect.arrayContaining([
      'ATTRIBUTION_RECORD_DUPLICATE',
      'ATTRIBUTION_RECORD_UNKNOWN_CATALOG_ITEM',
      'ATTRIBUTION_RECORD_CONTENT_HASH_DRIFT',
      'ATTRIBUTION_RECORD_NOT_AUDITED_ERROR_OPTION',
      'ATTRIBUTION_RECORD_MALFORMED',
    ]));
    expect(result.attributionIssues.every((issue) => issue.attributionRef.startsWith('hmac-sha256:'))).toBe(true);
    expect(result.attributionIssues.every((issue) => !issue.attributionRef.includes(correctOption.key!))).toBe(true);
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });

  it('fails strict mode for an orphan attribution even when all audited error options are complete', () => {
    const attributions = buildAttributions();
    const sourceItem = catalogItems.find((item) => item.catalogItemId === attributions[0].catalogItemId)!;
    const correctOption = (sourceItem.questionRefs.options ?? []).find((option) => option.isCorrect === true)!;
    const result = report({
      optionAttributions: [
        ...attributions,
        rehashAttribution({ ...attributions[0], optionKey: correctOption.key! }),
      ],
    });

    expect(result.gapOptionCount).toBe(0);
    expect(result.attributionIssues).toEqual([
      expect.objectContaining({ reason: 'ATTRIBUTION_RECORD_NOT_AUDITED_ERROR_OPTION' }),
    ]);
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });

  it('requires nonempty and registered option-attribution fields before resolving dependencies', () => {
    const attributions = buildAttributions();
    const invalidFields = [
      { learningGoalId: '' },
      { learningGoalId: 'unknown-learning-goal' },
      { misconceptionTag: '' },
      { knowledgeNodeId: '' },
      { version: '' },
      { evidenceSummary: '' },
      { limitations: [] },
    ];

    for (const invalidField of invalidFields) {
      const result = report({
        optionAttributions: attributions.map((attribution, index) =>
          index === 0 ? { ...attribution, ...invalidField } : attribution),
      });
      const affectedRows = result.rows.filter((row) =>
        row.catalogItemId === attributions[0].catalogItemId &&
        row.reasons.includes('ATTRIBUTION_UNCERTAIN'));

      expect(affectedRows).toHaveLength(1);
      expect(affectedRows[0]).toMatchObject({
        learningGoalId: null,
        misconceptionTag: null,
        knowledgeNodeId: null,
        attributionVersion: null,
        resources: [],
        validationItems: [],
      });
      expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
    }
  });

  it('does not derive resource or validation gaps from an unavailable knowledge node', () => {
    const result = report({
      optionAttributions: buildAttributions(),
      activeKnowledgeNodeIds: [],
      resolveResources: () => {
        throw new Error('resource resolution must be skipped');
      },
      resolveValidationItems: () => {
        throw new Error('validation resolution must be skipped');
      },
    });

    expect(result.rows.every((row) =>
      row.reasons.length === 1 && row.reasons[0] === 'CANONICAL_NODE_UNAVAILABLE')).toBe(true);
    expect(result.rows.every((row) => row.resources.length === 0 && row.validationItems.length === 0)).toBe(true);
  });

  it('produces deterministically sorted complete records without question or answer material', () => {
    const complete = report({ optionAttributions: buildAttributions() });
    const repeated = report({ optionAttributions: [...buildAttributions()].reverse() });

    expect(complete.gapOptionCount).toBe(0);
    expect(complete.attributionIssueCount).toBe(0);
    expect(microTutoringCoverageAuditIsStrictlyComplete(complete)).toBe(true);
    expect(complete).toEqual(repeated);
    const serialized = JSON.stringify(complete);
    expect(serialized).not.toContain('正确');
    expect(serialized).not.toContain('isCorrect');
    expect(microTutoringCoverageAuditMarkdown(complete)).not.toContain('isCorrect');
    expect(serialized).not.toContain(OPTION_REFERENCE_SECRET);
    expect(complete.rows.every((row) => row.errorOptionRef.startsWith('hmac-sha256:'))).toBe(true);
  });

  it('requires a private option reference secret', () => {
    expect(() => report({ optionReferenceSecret: '' })).toThrow('option reference secret');
  });
});
