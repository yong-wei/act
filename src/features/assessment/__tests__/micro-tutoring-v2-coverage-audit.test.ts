import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AdaptiveAssessmentCatalogItem } from '@/features/assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/assessment/adaptive-assessment-semantic-review';
import v2BaselineSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-assessment-baseline-v2.json';
import v2OptionAttributionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-option-attributions-v2.json';
import v2ProjectionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-resource-projection-v2.json';
import v2RegistrySource from '../../../../course-content/runtime/resource-governance/micro-tutoring-validation-registry-v2.json';
import v2PracticeBaselineSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-assessment-baseline-v2.json';
import {
  MICRO_TUTORING_ASSESSMENT_BASELINE_V2_STAGE_COUNTS,
  MICRO_TUTORING_ASSESSMENT_BASELINE_V2_VERSION,
  buildMicroTutoringCoverageAuditReport,
  microTutoringCoverageAuditIsGitContentComplete,
  microTutoringCoverageAuditIsStrictlyComplete,
  type MicroTutoringPracticeBaseline,
} from '../micro-tutoring-coverage-audit';
import { listMicroTutoringGovernedResources } from '../micro-tutoring-resource-registry';
import { listMicroTutoringGovernedValidationItems } from '../micro-tutoring-validation-registry';
import type { MicroTutoringOptionAttribution } from '../micro-tutoring-option-attribution';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const OPTION_REFERENCE_SECRET = 'test-only-micro-tutoring-option-reference-secret';

function readJsonl<T>(name: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, name), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

const catalogItems = readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl');
const reviewDecisions = readJsonl<AssessmentItemSemanticReviewDecision>('assessment-item-semantic-review-snapshots.jsonl');
const attributions = v2OptionAttributionSource.entries as MicroTutoringOptionAttribution[];
const baseline: MicroTutoringPracticeBaseline = {
  version: v2BaselineSource.version,
  itemCount: v2BaselineSource.itemCount,
  stageCounts: v2BaselineSource.stageCounts,
  entries: v2BaselineSource.entries,
};

describe('micro tutoring v2 coverage audit', () => {
  it('covers the published 135-item v2 denominator without mutating v1 artifacts', { timeout: 180_000 }, () => {
    const result = buildMicroTutoringCoverageAuditReport({
      catalogItems,
      reviewDecisions,
      baseline,
      coverageProfile: 'v2',
      optionAttributions: attributions,
      optionReferenceSecret: OPTION_REFERENCE_SECRET,
      activeLearningGoalIds: [...new Set(attributions.map((entry) => entry.learningGoalId))],
      activeKnowledgeNodeIds: [...new Set(attributions.map((entry) => entry.knowledgeNodeId))],
      resolveResources: (knowledgeNodeId, misconceptionTag) => listMicroTutoringGovernedResources({
        knowledgeNodeId,
        misconceptionTag,
        projection: v2ProjectionSource,
        optionAttributions: v2OptionAttributionSource,
      }).map(({ registryId: _registryId, actionId: _actionId, actionVersion: _actionVersion, ...resource }) => resource),
      resolveValidationItems: (sourceQuestionId, sourceContentHash, knowledgeNodeId, misconceptionTag) =>
        listMicroTutoringGovernedValidationItems({
          knowledgeNodeId,
          misconceptionTag,
          sourceQuestionId,
          sourceContentHash,
          registry: v2RegistrySource,
          optionAttributions: v2OptionAttributionSource,
          practiceBaseline: v2PracticeBaselineSource,
        }),
    });

    expect(result.coverageProfile).toBe('v2');
    expect(result.artifactVersion).toBe('micro-tutoring-coverage-audit.v2');
    expect(result.baselineIssues).toEqual([]);
    expect(result.attributionIssues).toEqual([]);
    expect(result.qualifiedItemCount).toBe(135);
    expect(result.qualifiedPracticeItemCount).toBe(54);
    expect(result.stageCounts).toEqual(MICRO_TUTORING_ASSESSMENT_BASELINE_V2_STAGE_COUNTS);
    expect(result.errorOptionCount).toBe(272);
    expect(result.gapOptionCount).toBe(0);
    expect(result.rows.every((row) => row.resources.length >= 1)).toBe(true);
    expect(result.rows.every((row) => row.validationItems.length >= 1)).toBe(true);
    expect(microTutoringCoverageAuditIsGitContentComplete(result)).toBe(true);
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(true);
  });

  it('fail-closes a contradictory declared itemCount or unknown extra stage key', () => {
    const assessmentStages = [
      ...Array.from({ length: 54 }, () => 'practice' as const),
      ...Array.from({ length: 27 }, () => 'checkpoint' as const),
      ...Array.from({ length: 27 }, () => 'remediation' as const),
      ...Array.from({ length: 2 }, () => 'readiness' as const),
      ...Array.from({ length: 25 }, () => 'readiness-gate' as const),
    ];
    const result = buildMicroTutoringCoverageAuditReport({
      catalogItems: [],
      reviewDecisions: [],
      baseline: {
        version: MICRO_TUTORING_ASSESSMENT_BASELINE_V2_VERSION,
        itemCount: 134,
        stageCounts: {
          ...MICRO_TUTORING_ASSESSMENT_BASELINE_V2_STAGE_COUNTS,
          quiz: 1,
        },
        entries: assessmentStages.map((assessmentStage, index) => ({
          catalogItemId: `drift-item-${index}`,
          contentHash: 'a'.repeat(64),
          assessmentStage,
        })),
      },
      coverageProfile: 'v2',
      optionAttributions: [],
      optionReferenceSecret: OPTION_REFERENCE_SECRET,
      activeLearningGoalIds: [],
      activeKnowledgeNodeIds: [],
      resolveResources: () => [],
      resolveValidationItems: () => [],
    });

    expect(result.baselineIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'BASELINE_ITEM_COUNT_DRIFT',
        catalogItemId: 'declared-item-count',
        expectedItemCount: 135,
        actualItemCount: 134,
      }),
      expect.objectContaining({
        reason: 'BASELINE_ITEM_COUNT_DRIFT',
        catalogItemId: 'declared-stage:quiz',
        expectedItemCount: 0,
        actualItemCount: 1,
      }),
    ]));
    expect(microTutoringCoverageAuditIsStrictlyComplete(result)).toBe(false);
  });
});
