import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  findAdaptiveAssessmentCatalogSnapshot,
} from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import { checkpointAuthoredQuestionRuntimeId } from '@/features/adaptive-assessment/learning-goal-checkpoint-question-sets';
import { ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION } from '@/features/assessment/adaptive-mastery';
import v2BaselineSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-assessment-baseline-v2.json';
import v2OptionAttributionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-option-attributions-v2.json';
import v2ProjectionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-resource-projection-v2.json';
import v2RegistrySource from '../../../../course-content/runtime/resource-governance/micro-tutoring-validation-registry-v2.json';
import {
  buildMicroTutoringCoverageAuditReport,
  type MicroTutoringPracticeBaseline,
} from '../micro-tutoring-coverage-audit';
import { listMicroTutoringGovernedResources } from '../micro-tutoring-resource-registry';
import {
  applyMicroTutoringTeachingResourceSyncPlan,
  planMicroTutoringTeachingResourceSync,
  toRemediationResourceRow,
} from '../micro-tutoring-teaching-resource-sync';
import {
  applyMicroTutoringValidationItemRefSyncPlan,
  planMicroTutoringV2DatabaseSync,
  planMicroTutoringValidationItemRefSync,
  toRemediationValidationItemRow,
  type ValidationItemRefSyncRow,
} from '../micro-tutoring-validation-item-ref-sync';
import { listMicroTutoringGovernedValidationItems } from '../micro-tutoring-validation-registry';
import type { MicroTutoringOptionAttribution } from '../micro-tutoring-option-attribution';
import {
  listGovernedRemediationResources,
  listGovernedRemediationValidationItems,
} from '../remediation-orchestration';

const CAPTURE = 'a'.repeat(40);
const PRACTICE_03 = 'feedback-loop-concept-foundations-practice-03';
const PRACTICE_03_HASH = 'e62ccedd4c70c7edce86e15c4a6aa07f5f88a793f8193e969126166b9f423a02';
const PRACTICE_03_NODE = 'kn:autocontrol:feedback-loop';
const PRACTICE_03_TAG = 'misconception:feedback-loop-concept-foundations:assumes-unity-feedback';
const PRACTICE_06 = 'frequency-response-foundations-practice-06';
const PRACTICE_06_HASH = '43959c364d41bcade9d3a44baf64196b912814b53cd4f5435177bd5c076f7eaa';
const PRACTICE_06_NODE = 'kn:autocontrol:frequency-response';
const PRACTICE_06_TAG_B = 'misconception:frequency-response-foundations:bandwidth-only-speed';
const PRACTICE_06_TAG_C = 'misconception:frequency-response-foundations:equates-bandwidth-with-steady-error-only';
const SAMPLE_SOURCE_ID = 'control-correction-checkpoint-01';
const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const OPTION_REFERENCE_SECRET = 'test-only-micro-tutoring-option-reference-secret';
const CLI_PATH = path.join(process.cwd(), 'scripts/db/sync-micro-tutoring-v2-teaching-resources.ts');

function readJsonl<T>(name: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, name), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

function canFormFiveToTenMinuteTask(
  resources: Array<{ estimatedMinutes: number }>,
  validations: Array<{ estimatedMinutes: number }>,
): boolean {
  return validations.some((validation) => {
    const minimumResourceMinutes = Math.max(1, 5 - validation.estimatedMinutes);
    const maximumResourceMinutes = 10 - validation.estimatedMinutes;
    return resources.some((resource) =>
      resource.estimatedMinutes >= minimumResourceMinutes
      && resource.estimatedMinutes <= maximumResourceMinutes);
  });
}

describe('micro tutoring v2 validation AdaptiveAssessmentItemRef sync', () => {
  it('creates missing projected validation snapshots with catalog-backed metadata', {
    timeout: 180_000,
  }, () => {
    const plan = planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: CAPTURE,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('expected plan');
    expect(plan.entries).toHaveLength(135);
    expect(plan.entries.every((entry) => entry.action === 'create')).toBe(true);
    expect(plan.entries.map((entry) => entry.sourceId).sort()).toEqual(
      [...v2RegistrySource.entries.map((entry) => entry.sourceId)].sort(),
    );
    expect(plan.entries.every((entry) => entry.optionCount >= 2)).toBe(true);
    expect(plan.entries.every((entry) => entry.questionId === entry.sourceId)).toBe(true);

    const sample = plan.entries.find((entry) => entry.sourceId === SAMPLE_SOURCE_ID);
    expect(sample?.contentHash).toBe(
      v2RegistrySource.entries.find((entry) => entry.sourceId === SAMPLE_SOURCE_ID)?.contentHash,
    );
    expect(sample?.metadata).toEqual(expect.objectContaining({
      adaptiveAssessmentItemRef: expect.objectContaining({
        catalogBacked: true,
        sourceId: SAMPLE_SOURCE_ID,
        contentHash: sample?.contentHash,
      }),
      remediationValidation: expect.objectContaining({
        learnerVisible: true,
        captureRevision: CAPTURE,
        itemRevision: sample?.itemRevision,
      }),
    }));
  });

  it('is idempotent on a second run and keeps historical hashes plus runtime identities', {
    timeout: 180_000,
  }, () => {
    const first = planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: CAPTURE,
    });
    if (!first.ok) throw new Error('expected first plan');
    const applied = applyMicroTutoringValidationItemRefSyncPlan([], first);
    const second = planMicroTutoringValidationItemRefSync({
      existingRows: applied,
      captureRevision: CAPTURE,
    });
    if (!second.ok) throw new Error('expected second plan');
    expect(second.entries.every((entry) => entry.action === 'unchanged')).toBe(true);
    expect(applyMicroTutoringValidationItemRefSyncPlan(applied, second)).toEqual(applied);

    const created = applied.find((row) => row.questionId === SAMPLE_SOURCE_ID)!;
    const withoutValidation = {
      ...created,
      metadata: {
        adaptiveAssessmentItemRef: (created.metadata as { adaptiveAssessmentItemRef: unknown })
          .adaptiveAssessmentItemRef,
      },
    };
    const missingValidationPlan = planMicroTutoringValidationItemRefSync({
      existingRows: applied.map((row) => row.id === created.id ? withoutValidation : row),
      captureRevision: CAPTURE,
    });
    if (!missingValidationPlan.ok) throw new Error('expected missing-validation plan');
    expect(missingValidationPlan.entries.find((entry) => entry.sourceId === SAMPLE_SOURCE_ID)?.action)
      .toBe('unchanged');

    const runtimeRow: ValidationItemRefSyncRow = {
      ...created,
      id: 'runtime-existing',
      questionId: checkpointAuthoredQuestionRuntimeId(SAMPLE_SOURCE_ID),
    };
    const runtimePlan = planMicroTutoringValidationItemRefSync({
      existingRows: [runtimeRow],
      captureRevision: CAPTURE,
    });
    if (!runtimePlan.ok) throw new Error('expected runtime plan');
    expect(runtimePlan.entries.find((entry) => entry.sourceId === SAMPLE_SOURCE_ID)).toMatchObject({
      action: 'unchanged',
      questionId: runtimeRow.questionId,
      id: runtimeRow.id,
    });
    const afterRuntime = applyMicroTutoringValidationItemRefSyncPlan([runtimeRow], runtimePlan);
    expect(afterRuntime.filter((row) =>
      row.contentHash === created.contentHash
      && (row.questionId === SAMPLE_SOURCE_ID || row.questionId === runtimeRow.questionId))).toHaveLength(1);

    const historical: ValidationItemRefSyncRow = {
      ...created,
      id: 'historical-hash',
      contentHash: 'b'.repeat(64),
    };
    const historicalPlan = planMicroTutoringValidationItemRefSync({
      existingRows: [historical],
      captureRevision: CAPTURE,
    });
    if (!historicalPlan.ok) throw new Error('expected historical plan');
    expect(historicalPlan.entries.find((entry) => entry.sourceId === SAMPLE_SOURCE_ID)?.action).toBe('create');
    const afterHistorical = applyMicroTutoringValidationItemRefSyncPlan([historical], historicalPlan);
    expect(afterHistorical.filter((row) =>
      row.questionId === SAMPLE_SOURCE_ID)).toHaveLength(2);
  });

  it('fail-closes dirty git, missing catalog, hash drift, version drift, revoked access and identity conflicts', {
    timeout: 180_000,
  }, () => {
    expect(planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: CAPTURE,
      dirty: true,
    })).toEqual({ ok: false, issues: [{ code: 'GIT_DIRTY', ref: 'git-worktree' }] });
    expect(planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: 'not-a-sha',
    })).toEqual({ ok: false, issues: [{ code: 'CAPTURE_REVISION_INVALID', ref: 'captureRevision' }] });

    const snapshot = findAdaptiveAssessmentCatalogSnapshot(SAMPLE_SOURCE_ID);
    expect(snapshot).toBeTruthy();

    expect(planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: CAPTURE,
      findCatalogSnapshot: (questionId) =>
        questionId === SAMPLE_SOURCE_ID || questionId.includes(SAMPLE_SOURCE_ID)
          ? null
          : findAdaptiveAssessmentCatalogSnapshot(questionId),
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([{ code: 'CATALOG_MISSING', ref: SAMPLE_SOURCE_ID }]),
    });

    expect(planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: CAPTURE,
      findCatalogSnapshot: (questionId) => {
        const current = findAdaptiveAssessmentCatalogSnapshot(questionId);
        if (!current || current.sourceId !== SAMPLE_SOURCE_ID) return current;
        return { ...current, contentHash: 'c'.repeat(64) };
      },
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([{ code: 'CONTENT_HASH_DRIFT', ref: SAMPLE_SOURCE_ID }]),
    });

    expect(planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: CAPTURE,
      findCatalogSnapshot: (questionId) => {
        const current = findAdaptiveAssessmentCatalogSnapshot(questionId);
        if (!current || current.sourceId !== SAMPLE_SOURCE_ID) return current;
        return {
          ...current,
          versionRefs: {
            ...current.versionRefs,
            adaptiveAssessmentSnapshotVersion: 'adaptive-assessment-item-ref.v999',
          },
        };
      },
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([{ code: 'VERSION_DRIFT', ref: SAMPLE_SOURCE_ID }]),
    });

    const first = planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: CAPTURE,
    });
    if (!first.ok) throw new Error('expected first plan');
    const applied = applyMicroTutoringValidationItemRefSyncPlan([], first);
    const created = applied.find((row) => row.questionId === SAMPLE_SOURCE_ID)!;
    const revokedMetadata = created.metadata as {
      adaptiveAssessmentItemRef: unknown;
      remediationValidation: Record<string, unknown>;
    };
    expect(planMicroTutoringValidationItemRefSync({
      existingRows: applied.map((row) => row.id === created.id
        ? {
          ...row,
          metadata: {
            ...revokedMetadata,
            remediationValidation: { ...revokedMetadata.remediationValidation, learnerVisible: false },
          },
        }
        : row),
      captureRevision: CAPTURE,
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([{ code: 'ACCESS_REVOKED', ref: SAMPLE_SOURCE_ID }]),
    });

    expect(planMicroTutoringValidationItemRefSync({
      existingRows: applied.map((row) => row.id === created.id
        ? { ...row, metadata: {} }
        : row),
      captureRevision: CAPTURE,
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([{ code: 'IDENTITY_CONFLICT', ref: SAMPLE_SOURCE_ID }]),
    });
  });

  it('lets the existing orchestrator parse reproduction wrong answers after materialization', {
    timeout: 180_000,
  }, () => {
    expect(listGovernedRemediationValidationItems({
      rows: [],
      sourceQuestionId: PRACTICE_03,
      sourceContentHash: PRACTICE_03_HASH,
      knowledgeNodeId: PRACTICE_03_NODE,
      misconceptionTag: PRACTICE_03_TAG,
    })).toEqual([]);

    const plan = planMicroTutoringValidationItemRefSync({
      existingRows: [],
      captureRevision: CAPTURE,
    });
    if (!plan.ok) throw new Error('expected plan');
    const rows = applyMicroTutoringValidationItemRefSyncPlan([], plan).map(toRemediationValidationItemRow);

    const practice03 = listGovernedRemediationValidationItems({
      rows,
      sourceQuestionId: PRACTICE_03,
      sourceContentHash: PRACTICE_03_HASH,
      knowledgeNodeId: PRACTICE_03_NODE,
      misconceptionTag: PRACTICE_03_TAG,
    });
    expect(practice03.length).toBeGreaterThan(0);
    expect(practice03.every((item) => item.questionId !== PRACTICE_03)).toBe(true);

    const practice06B = listGovernedRemediationValidationItems({
      rows,
      sourceQuestionId: PRACTICE_06,
      sourceContentHash: PRACTICE_06_HASH,
      knowledgeNodeId: PRACTICE_06_NODE,
      misconceptionTag: PRACTICE_06_TAG_B,
    });
    const practice06C = listGovernedRemediationValidationItems({
      rows,
      sourceQuestionId: PRACTICE_06,
      sourceContentHash: PRACTICE_06_HASH,
      knowledgeNodeId: PRACTICE_06_NODE,
      misconceptionTag: PRACTICE_06_TAG_C,
    });
    expect(practice06B.length).toBeGreaterThan(0);
    expect(practice06C.length).toBeGreaterThan(0);
  });

  it('covers 54 practice audited error options with materialized resources and validation snapshots', {
    timeout: 180_000,
  }, () => {
    const combined = planMicroTutoringV2DatabaseSync({
      teachingResourceRows: [],
      validationItemRows: [],
      captureRevision: CAPTURE,
    });
    expect(combined.ok).toBe(true);
    if (!combined.ok) throw new Error('expected combined plan');
    expect(combined.teaching.entries.some((entry) => entry.action === 'create')).toBe(true);
    expect(combined.validation.entries).toHaveLength(135);

    const resources = applyMicroTutoringTeachingResourceSyncPlan([], combined.teaching);
    const validations = applyMicroTutoringValidationItemRefSyncPlan([], combined.validation);
    const authorityRows = resources.map((row) => ({
      id: row.id,
      registryId: row.registryId,
      teacherOnly: row.teacherOnly,
      config: row.config,
    }));
    const attributions = v2OptionAttributionSource.entries as MicroTutoringOptionAttribution[];
    const baseline: MicroTutoringPracticeBaseline = {
      version: v2BaselineSource.version,
      itemCount: v2BaselineSource.itemCount,
      stageCounts: v2BaselineSource.stageCounts,
      entries: v2BaselineSource.entries,
    };
    const result = buildMicroTutoringCoverageAuditReport({
      catalogItems: readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl'),
      reviewDecisions: readJsonl<AssessmentItemSemanticReviewDecision>('assessment-item-semantic-review-snapshots.jsonl'),
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
        authorityRows,
        captureRevision: CAPTURE,
      }).map(({ registryId: _registryId, actionId: _actionId, actionVersion: _actionVersion, ...resource }) => resource),
      resolveValidationItems: (sourceQuestionId, sourceContentHash, knowledgeNodeId, misconceptionTag) =>
        listMicroTutoringGovernedValidationItems({
          knowledgeNodeId,
          misconceptionTag,
          sourceQuestionId,
          sourceContentHash,
          registry: v2RegistrySource,
          optionAttributions: v2OptionAttributionSource,
          practiceBaseline: v2BaselineSource,
          authorityRows: validations,
        }),
    });

    const practiceIds = new Set(
      v2BaselineSource.entries
        .filter((entry) => entry.assessmentStage === 'practice')
        .map((entry) => entry.catalogItemId),
    );
    const practiceRows = result.rows.filter((row) => practiceIds.has(row.catalogItemId));
    expect(practiceIds.size).toBe(54);
    expect(practiceRows.length).toBeGreaterThan(0);
    expect(practiceRows.every((row) => row.status === 'COMPLETE')).toBe(true);
    expect(result.gapReasonCounts.VALIDATION_QUESTION_UNAVAILABLE).toBe(0);
    expect(practiceRows.every((row) => canFormFiveToTenMinuteTask(row.resources, row.validationItems))).toBe(true);

    const practice03Resources = listGovernedRemediationResources({
      rows: resources.map(toRemediationResourceRow),
      knowledgeNodeId: PRACTICE_03_NODE,
      misconceptionTag: PRACTICE_03_TAG,
    });
    const practice03Validations = listGovernedRemediationValidationItems({
      rows: validations.map(toRemediationValidationItemRow),
      sourceQuestionId: PRACTICE_03,
      sourceContentHash: PRACTICE_03_HASH,
      knowledgeNodeId: PRACTICE_03_NODE,
      misconceptionTag: PRACTICE_03_TAG,
    });
    expect(canFormFiveToTenMinuteTask(practice03Resources, practice03Validations)).toBe(true);
  });

  it('fails the combined CLI planner if either side cannot apply, and the sync script applies both plans', () => {
    expect(planMicroTutoringV2DatabaseSync({
      teachingResourceRows: [],
      validationItemRows: [],
      captureRevision: CAPTURE,
      dirty: true,
    })).toMatchObject({
      ok: false,
      teachingIssues: [{ code: 'GIT_DIRTY', ref: 'git-worktree' }],
      validationIssues: [{ code: 'GIT_DIRTY', ref: 'git-worktree' }],
    });

    const source = readFileSync(CLI_PATH, 'utf8');
    expect(source).toContain('planMicroTutoringV2DatabaseSync');
    expect(source).toContain('$transaction');
    expect(source).toContain('teachingResource.create');
    expect(source).toContain('adaptiveAssessmentItemRef.create');
    expect(source).toContain('adaptiveAssessmentAlgorithmVersion.upsert');
  });
});
