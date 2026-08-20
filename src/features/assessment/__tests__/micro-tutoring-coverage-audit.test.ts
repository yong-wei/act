import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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

function buildAttributions(): MicroTutoringOptionAttribution[] {
  const decisionByItemId = new Map(reviewDecisions.map((decision) => [decision.catalogItemId, decision]));
  return catalogItems.flatMap((item) => {
    const decision = decisionByItemId.get(item.catalogItemId);
    if (decision?.selectedStagePurpose !== 'practice') return [];
    return (item.questionRefs.options ?? [])
      .filter((option) => option.isCorrect === false && option.key)
      .map((option) => ({
        catalogItemId: item.catalogItemId,
        contentHash: item.contentHash,
        optionKey: option.key!,
        learningGoalId: 'learning-goal-1',
        misconceptionTag: 'misconception-1',
        knowledgeNodeId: 'node-1',
        version: 'attribution.v1',
      }));
  });
}

function report(input: Partial<Parameters<typeof buildMicroTutoringCoverageAuditReport>[0]> = {}) {
  return buildMicroTutoringCoverageAuditReport({
    catalogItems,
    reviewDecisions,
    baseline,
    optionAttributions: [],
    optionReferenceSecret: OPTION_REFERENCE_SECRET,
    activeLearningGoalIds: ['learning-goal-1'],
    activeKnowledgeNodeIds: ['node-1'],
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
    const extraAttributions = (extraItem.questionRefs.options ?? [])
      .filter((option) => option.isCorrect === false && option.key)
      .map((option) => ({
        catalogItemId,
        contentHash,
        optionKey: option.key!,
        learningGoalId: 'learning-goal-1',
        misconceptionTag: 'misconception-1',
        knowledgeNodeId: 'node-1',
        version: 'attribution.v1',
      }));
    const result = report({
      catalogItems: [...catalogItems, extraItem],
      reviewDecisions: [
        ...reviewDecisions,
        {
          ...extraDecision,
          reviewSourceHash: assessmentItemSemanticReviewSourceHash(extraDecision),
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
        attributions[0],
        {
          ...attributions[0],
          catalogItemId: 'adaptive-assessment-item:unknown',
        },
        {
          ...attributions[0],
          contentHash: 'e'.repeat(64),
        },
        {
          ...attributions[0],
          optionKey: correctOption.key!,
        },
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
        { ...attributions[0], optionKey: correctOption.key! },
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
