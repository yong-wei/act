import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  buildMicroTutoringCoverageAuditReport,
  microTutoringCoverageAuditIsStrictlyComplete,
  microTutoringCoverageAuditMarkdown,
  type MicroTutoringOptionAttribution,
  type MicroTutoringPracticeBaseline,
} from '../micro-tutoring-coverage-audit';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');

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

  it('produces deterministically sorted complete records without question or answer material', () => {
    const complete = report({ optionAttributions: buildAttributions() });
    const repeated = report({ optionAttributions: [...buildAttributions()].reverse() });

    expect(complete.gapOptionCount).toBe(0);
    expect(microTutoringCoverageAuditIsStrictlyComplete(complete)).toBe(true);
    expect(complete).toEqual(repeated);
    const serialized = JSON.stringify(complete);
    expect(serialized).not.toContain('正确');
    expect(serialized).not.toContain('isCorrect');
    expect(microTutoringCoverageAuditMarkdown(complete)).not.toContain('isCorrect');
  });
});
