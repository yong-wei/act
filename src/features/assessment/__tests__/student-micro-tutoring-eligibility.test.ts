import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  projectStudentMicroTutoringEligibility,
  studentMicroTutoringCatalogReviewFromSnapshot,
  studentMicroTutoringStageLabel,
  studentMicroTutoringUnavailableCopy,
} from '../student-micro-tutoring-eligibility';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');

function readJsonl<T>(name: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, name), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

const catalogItems = readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl');
const reviewDecisions = readJsonl<AssessmentItemSemanticReviewDecision>('assessment-item-semantic-review-snapshots.jsonl');

function checkpointFixture() {
  const item = catalogItems.find((candidate) =>
    candidate.sourceId === 'stability-margin-frequency-analysis-checkpoint-03');
  const decision = reviewDecisions.find((candidate) => candidate.catalogItemId === item?.catalogItemId);
  if (!item || !decision?.reviewSourceHash) {
    throw new Error('missing checkpoint catalog fixture');
  }
  return {
    item,
    decision,
    input: {
      isCorrect: false,
      selectedOptionKey: 'B',
      correctOptionKey: 'C',
      assessmentStage: 'checkpoint',
      catalogItemId: item.catalogItemId,
      contentHash: item.contentHash,
      catalogReview: studentMicroTutoringCatalogReviewFromSnapshot({
        catalogItemId: item.catalogItemId,
        sourceId: item.sourceId,
        contentHash: item.contentHash,
        reviewDecision: { reviewSourceHash: decision.reviewSourceHash },
        semanticRefs: {
          learningGoalIds: decision.selectedLearningGoalIds,
          graphNodeIds: decision.selectedGraphNodeIds,
          misconceptionTags: decision.misconceptionRefs,
          assessmentStage: decision.selectedStagePurpose ?? item.semanticRefs.assessmentStage,
        },
      }),
    },
  };
}

describe('student micro-tutoring eligibility projection', () => {
  it('qualifies a complete v2 checkpoint wrong answer', () => {
    const { input } = checkpointFixture();
    expect(projectStudentMicroTutoringEligibility(input)).toEqual({
      stage: 'checkpoint',
      qualified: true,
      unavailableReason: null,
      retryAttribution: false,
    });
  });

  it('does not qualify a correct answer', () => {
    const { input } = checkpointFixture();
    expect(projectStudentMicroTutoringEligibility({ ...input, isCorrect: true })).toEqual({
      stage: 'checkpoint',
      qualified: false,
      unavailableReason: null,
      retryAttribution: false,
    });
  });

  it('reports uncovered items without a catalog identity', () => {
    const { input } = checkpointFixture();
    expect(projectStudentMicroTutoringEligibility({
      ...input,
      catalogItemId: null,
    })).toEqual({
      stage: 'checkpoint',
      qualified: false,
      unavailableReason: 'NOT_COVERED',
      retryAttribution: true,
    });
    expect(projectStudentMicroTutoringEligibility({
      ...input,
      catalogItemId: 'adaptive-assessment-item:missing',
    })).toEqual({
      stage: 'checkpoint',
      qualified: false,
      unavailableReason: 'NOT_COVERED',
      retryAttribution: true,
    });
  });

  it('reports evidence drift when the content hash no longer matches v2', () => {
    const { input } = checkpointFixture();
    expect(projectStudentMicroTutoringEligibility({
      ...input,
      contentHash: '0'.repeat(64),
    })).toEqual({
      stage: 'checkpoint',
      qualified: false,
      unavailableReason: 'EVIDENCE_DRIFT',
      retryAttribution: true,
    });
  });

  it('reports resource unavailability when the governed projection is empty', () => {
    const { input } = checkpointFixture();
    expect(projectStudentMicroTutoringEligibility({
      ...input,
      resourceProjection: {
        version: 'micro-tutoring-resource-projection.v2',
        source: 'micro-tutoring-option-attributions.v3',
        actionVersion: 'micro-tutoring-learning-action.v1',
        entries: [],
      },
    })).toEqual({
      stage: 'checkpoint',
      qualified: false,
      unavailableReason: 'RESOURCE_UNAVAILABLE',
      retryAttribution: false,
    });
  });

  it('reports validation unavailability when the governed registry is empty', () => {
    const { input } = checkpointFixture();
    expect(projectStudentMicroTutoringEligibility({
      ...input,
      validationRegistry: {
        version: 'micro-tutoring-validation-registry.v2',
        source: 'micro-tutoring-assessment-baseline.v2+micro-tutoring-option-attributions.v3',
        sourceRevision: 'a'.repeat(40),
        entries: [],
      },
    })).toEqual({
      stage: 'checkpoint',
      qualified: false,
      unavailableReason: 'VALIDATION_UNAVAILABLE',
      retryAttribution: false,
    });
  });

  it('reports access revoked when student-visible resources are filtered out', () => {
    const { input } = checkpointFixture();
    expect(projectStudentMicroTutoringEligibility({
      ...input,
      resourceAuthorityRows: [],
    })).toEqual({
      stage: 'checkpoint',
      qualified: false,
      unavailableReason: 'ACCESS_REVOKED',
      retryAttribution: false,
    });
  });

  it('does not treat a reviewed catalog item as qualified when the stage drifts', () => {
    const { input } = checkpointFixture();
    expect(projectStudentMicroTutoringEligibility({
      ...input,
      assessmentStage: 'practice',
    })).toEqual({
      stage: 'practice',
      qualified: false,
      unavailableReason: 'EVIDENCE_DRIFT',
      retryAttribution: true,
    });
  });

  it('keeps student-facing copy free of internal field names', () => {
    expect(studentMicroTutoringStageLabel('checkpoint')).toBe('检查点练习');
    expect(studentMicroTutoringUnavailableCopy('NOT_COVERED')).not.toMatch(/catalogItemId|reviewState|v2/i);
    expect(studentMicroTutoringUnavailableCopy('EVIDENCE_DRIFT')).toContain('重新作答');
  });
});
