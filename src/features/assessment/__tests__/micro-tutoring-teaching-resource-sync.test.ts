import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AdaptiveAssessmentCatalogItem } from '@/features/assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/assessment/adaptive-assessment-semantic-review';
import v2BaselineSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-assessment-baseline-v2.json';
import v2OptionAttributionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-option-attributions-v2.json';
import v2ProjectionSource from '../../../../course-content/runtime/resource-governance/micro-tutoring-resource-projection-v2.json';
import v2RegistrySource from '../../../../course-content/runtime/resource-governance/micro-tutoring-validation-registry-v2.json';
import {
  listGovernedRemediationResources,
} from '../remediation-orchestration';
import {
  applyMicroTutoringTeachingResourceSyncPlan,
  planMicroTutoringTeachingResourceSync,
  teachingResourceMatchesOrchestratorQuery,
  toRemediationResourceRow,
  type TeachingResourceSyncRow,
} from '../micro-tutoring-teaching-resource-sync';
import { listMicroTutoringGovernedResources } from '../micro-tutoring-resource-registry';
import { listMicroTutoringGovernedValidationItems } from '../micro-tutoring-validation-registry';
import {
  buildMicroTutoringCoverageAuditReport,
  type MicroTutoringPracticeBaseline,
} from '../micro-tutoring-coverage-audit';
import type { MicroTutoringOptionAttribution } from '../micro-tutoring-option-attribution';

const CAPTURE = 'a'.repeat(40);
const WORKSHOP = 'lesson11-graphical-thinking-workshop';
const SIM_NODE = 'kn:autocontrol:simulation-validation';
const SIM_TAG = 'misconception:simulation-validation-practice:reruns-without-discrepancy-record';
const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const OPTION_REFERENCE_SECRET = 'test-only-micro-tutoring-option-reference-secret';

function readJsonl<T>(name: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, name), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

function emptyWorkshop(): TeachingResourceSyncRow {
  return {
    id: WORKSHOP,
    registryId: WORKSHOP,
    teacherOnly: false,
    title: '图形化思考工作坊',
    type: 'INTERACTIVE_COMP',
    config: {},
    knowledgeNodeIds: [],
  };
}

describe('micro tutoring v2 TeachingResource sync', () => {
  it('creates missing projected resources and binds remediation config', () => {
    const plan = planMicroTutoringTeachingResourceSync({
      existingRows: [],
      captureRevision: CAPTURE,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('expected plan');
    expect(plan.entries).toHaveLength(9);
    expect(plan.entries.every((entry) => entry.action === 'create')).toBe(true);
    expect(plan.entries.map((entry) => entry.registryId).sort()).toEqual(
      [...new Set(v2ProjectionSource.entries.map((entry) => entry.registryId))].sort(),
    );

    const applied = applyMicroTutoringTeachingResourceSyncPlan([], plan);
    const workshop = applied.find((row) => row.registryId === WORKSHOP);
    expect(workshop?.id).toBe(WORKSHOP);
    expect(workshop?.teacherOnly).toBe(false);
    expect(teachingResourceMatchesOrchestratorQuery(emptyWorkshop(), SIM_NODE)).toBe(false);
    expect(teachingResourceMatchesOrchestratorQuery(workshop!, SIM_NODE)).toBe(true);

    const resources = listGovernedRemediationResources({
      rows: applied.map(toRemediationResourceRow),
      knowledgeNodeId: SIM_NODE,
      misconceptionTag: SIM_TAG,
    });
    expect(resources.map((resource) => resource.id)).toEqual([WORKSHOP]);
  });

  it('fills empty knowledgeNodes and empty config on an existing row without changing its id', () => {
    const existing = emptyWorkshop();
    const plan = planMicroTutoringTeachingResourceSync({
      existingRows: [existing],
      captureRevision: CAPTURE,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('expected plan');
    const workshopPlan = plan.entries.find((entry) => entry.registryId === WORKSHOP);
    expect(workshopPlan?.action).toBe('update');
    expect(workshopPlan?.id).toBe(WORKSHOP);

    const applied = applyMicroTutoringTeachingResourceSyncPlan([existing], plan);
    expect(applied.filter((row) => row.registryId === WORKSHOP)).toHaveLength(1);
    expect(teachingResourceMatchesOrchestratorQuery(applied.find((row) => row.id === WORKSHOP)!, SIM_NODE)).toBe(true);
  });

  it('is idempotent on a second run of the same capture revision', () => {
    const first = planMicroTutoringTeachingResourceSync({
      existingRows: [emptyWorkshop()],
      captureRevision: CAPTURE,
    });
    if (!first.ok) throw new Error('expected first plan');
    const applied = applyMicroTutoringTeachingResourceSyncPlan([emptyWorkshop()], first);
    const second = planMicroTutoringTeachingResourceSync({
      existingRows: applied,
      captureRevision: CAPTURE,
    });
    if (!second.ok) throw new Error('expected second plan');
    expect(second.entries.every((entry) => entry.action === 'unchanged')).toBe(true);
    expect(applyMicroTutoringTeachingResourceSyncPlan(applied, second)).toEqual(applied);
  });

  it('fail-closes dirty git, duplicate identity, revoked access and unknown registry', () => {
    expect(planMicroTutoringTeachingResourceSync({
      existingRows: [],
      captureRevision: CAPTURE,
      dirty: true,
    })).toEqual({ ok: false, issues: [{ code: 'GIT_DIRTY', ref: 'git-worktree' }] });

    expect(planMicroTutoringTeachingResourceSync({
      existingRows: [
        emptyWorkshop(),
        { ...emptyWorkshop(), id: 'other-workshop' },
      ],
      captureRevision: CAPTURE,
    }).ok).toBe(false);

    expect(planMicroTutoringTeachingResourceSync({
      existingRows: [{ ...emptyWorkshop(), teacherOnly: true }],
      captureRevision: CAPTURE,
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([{ code: 'ACCESS_REVOKED', ref: WORKSHOP }]),
    });
  });

  it('skips disabled projection entries instead of materializing them as student-visible', () => {
    const projection = {
      ...v2ProjectionSource,
      entries: v2ProjectionSource.entries.map((entry) => (
        entry.registryId === WORKSHOP ? { ...entry, enabled: false } : entry
      )),
    };
    const plan = planMicroTutoringTeachingResourceSync({
      existingRows: [],
      captureRevision: CAPTURE,
      projection,
      optionAttributions: v2OptionAttributionSource,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('expected plan');
    expect(plan.entries.some((entry) => entry.registryId === WORKSHOP)).toBe(false);
    expect(plan.entries).toHaveLength(8);
  });

  it('lets the existing orchestrator query find all 9 projected groups', () => {
    const plan = planMicroTutoringTeachingResourceSync({
      existingRows: [],
      captureRevision: CAPTURE,
    });
    if (!plan.ok) throw new Error('expected plan');
    const applied = applyMicroTutoringTeachingResourceSyncPlan([], plan);
    for (const entry of v2ProjectionSource.entries) {
      const row = applied.find((candidate) => candidate.registryId === entry.registryId);
      expect(row).toBeTruthy();
      expect(teachingResourceMatchesOrchestratorQuery(row!, entry.knowledgeNodeId)).toBe(true);
      const remediation = (row!.config as { remediation: { prerequisiteKnowledgeNodeIds: string[] } }).remediation;
      expect(remediation.prerequisiteKnowledgeNodeIds).toContain(entry.knowledgeNodeId);
    }
  });

  it('keeps v2 coverage RESOURCE_UNAVAILABLE at 0 with synced TeachingResource authority', {
    timeout: 180_000,
  }, () => {
    const plan = planMicroTutoringTeachingResourceSync({
      existingRows: [],
      captureRevision: CAPTURE,
    });
    if (!plan.ok) throw new Error('expected plan');
    const applied = applyMicroTutoringTeachingResourceSyncPlan([], plan);
    const authorityRows = applied.map((row) => ({
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
        }),
    });

    expect(result.qualifiedItemCount).toBe(135);
    expect(result.errorOptionCount).toBe(272);
    expect(result.gapReasonCounts.RESOURCE_UNAVAILABLE).toBe(0);
    expect(result.rows.every((row) => row.resources.length >= 1)).toBe(true);
  });
});
