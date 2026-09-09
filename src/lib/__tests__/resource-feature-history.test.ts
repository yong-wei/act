import { describe, expect, it, vi } from 'vitest';

import { buildResourceSemanticProjection, buildResourceNodeRegistry, type ResourceNode } from '@/lib/resource-node-registry';
import {
  calibrateResourceFeatures,
  collaborativeResourceAffinity,
  uniqueResourceInteractions,
  type ResourceInteractionSample,
} from '@/lib/resource-interaction-features';
import { applyResourceInteractionFeatures, loadResourceInteractionSamples } from '@/lib/resource-feature-history';
import { rankResourceLearnerCandidates } from '@/features/personalization/path-planning/resource-ranker';
import type { PublishedResourceFeature, PublishedResourceFeatureIndex, PublishedResourceIdentity } from '@/lib/published-resource-reference';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const RESOURCE_ID = 'act:card:history-fixture';
const RESOURCE_VERSION = 'd'.repeat(64);

function identity(resourceId = RESOURCE_ID): PublishedResourceIdentity {
  return {
    resourceId,
    projectionId: `proj-${HASH_A}`,
    projectionHash: HASH_A,
    snapshotId: `snap-${HASH_B}`,
    snapshotHash: HASH_B,
    runtimeReleaseId: null,
  };
}

function feature(resourceId = RESOURCE_ID, version = RESOURCE_VERSION): PublishedResourceFeature {
  return {
    identity: identity(resourceId), version, type: 'card', title: resourceId, summary: resourceId,
    canonicalIds: ['kn-history'], bindingIds: ['binding-history'], bindingRoles: ['COVERS'],
    sourcePath: null, baselineDifficulty: 0.5, estimatedMinutes: 10, estimateSource: 'policy-estimate',
    executable: true, recommendable: true, limitation: null, backend: { kind: 'route', href: '/knowledge' },
  };
}

function indexFor(resource = feature()): PublishedResourceFeatureIndex {
  return {
    contract: 'published-resource-features/v1', indexId: HASH_C,
    projectionId: resource.identity.projectionId, projectionHash: resource.identity.projectionHash,
    snapshotId: resource.identity.snapshotId, snapshotHash: resource.identity.snapshotHash,
    runtimeReleaseId: null, authorityReleaseId: 'authority-history-fixture', generatedAt: '2026-09-08T00:00:00.000Z',
    resources: [resource], prerequisiteEdges: [],
  };
}

function sample(overrides: Partial<ResourceInteractionSample> = {}): ResourceInteractionSample {
  return {
    eventId: 'event-1', learnerId: 'learner-1', resourceId: RESOURCE_ID, resourceVersion: RESOURCE_VERSION,
    occurredAt: '2026-09-08T00:00:00.000Z', kind: 'outcome', authority: 'governed-fact',
    success: true, durationSeconds: 600, retryCount: 1, learnerPreparedness: 0.5, ...overrides,
  };
}

function mockDatabase(rows: { executions?: unknown[]; facts?: unknown[]; feedback?: unknown[] } = {}) {
  const make = (value: unknown[]) => ({
    aggregate: vi.fn(async () => ({ _count: { _all: value.length }, _max: { createdAt: '2026-09-08T00:00:00.000Z' } })),
    findMany: vi.fn(async (_args?: unknown) => value),
  });
  return {
    learningPathExecution: make(rows.executions ?? []),
    learningFact: make(rows.facts ?? []),
    interactionLog: make(rows.feedback ?? []),
  };
}

function factRow(id: string, ref: unknown, overrides: Record<string, unknown> = {}) {
  return {
    id, userId: 'learner-1', factType: 'question', outcome: 'success', timeSpent: 600,
    contextJson: { resourceFeatureRef: ref, evidenceGovernance: {
      profileWeight: 1, skipProfileContribution: false, policyReason: 'governed-question',
    } }, sourceEventId: `fact-${id}`, sourceLogId: `log-${id}`,
    finishedAt: new Date('2026-09-08T00:00:00.000Z'), createdAt: new Date('2026-09-08T00:00:00.000Z'),
    ...overrides,
  };
}

describe('resource interaction calibration and history', () => {
  it('keeps the higher-authority event, drops conflicting duplicates, and ignores invalid timestamps', () => {
    const result = uniqueResourceInteractions([
      sample({ eventId: 'same', authority: 'usage', kind: 'selected' }),
      sample({ eventId: 'same', authority: 'governed-fact', kind: 'outcome' }),
      sample({ eventId: 'conflict', resourceId: 'act:card:other' }),
      sample({ eventId: 'conflict', resourceId: RESOURCE_ID, learnerId: 'other-learner' }),
      sample({ eventId: 'invalid-date', occurredAt: 'not-a-date' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ eventId: 'same', authority: 'governed-fact' }));
  });

  it('calibrates a cohort only after five independent learners, while one learner may personalize', () => {
    const resource = feature();
    const cohort = Array.from({ length: 5 }, (_, index) => sample({
      eventId: `cohort-${index}`, learnerId: `learner-${index}`,
      occurredAt: `2026-09-08T00:0${index}:00.000Z`, durationSeconds: 600 + index * 60,
      learnerPreparedness: 0.4 + index * 0.05,
    }));
    const observed = calibrateResourceFeatures(resource, cohort);
    expect(observed.scope).toBe('cohort');
    expect(observed.distinctLearnerCount).toBe(5);
    expect(observed.sampleSize).toBe(5);
    expect(observed.observedDifficulty).not.toBeNull();
    expect(observed.observedMinutes).toBe(12);

    const personal = calibrateResourceFeatures(resource, [
      sample({ learnerId: 'learner-personal', learnerPreparedness: null, perceivedDifficulty: 0.8, kind: 'feedback', authority: 'self-report' }),
    ], { learnerId: 'learner-personal' });
    expect(personal.scope).toBe('personal');
    expect(personal.distinctLearnerCount).toBe(1);
    expect(personal.observedDifficulty).not.toBeNull();
    expect(personal.limitations).not.toContain('insufficient-independent-learners');
  });

  it('leaves difficulty uncalibrated for opening and incomplete governance data', () => {
    const resource = feature();
    const opened = calibrateResourceFeatures(resource, [
      sample({ kind: 'opened', authority: 'usage', learnerPreparedness: null }),
    ]);
    expect(opened.observedDifficulty).toBeNull();
    expect(opened.observedMinutes).toBeNull();

    const ungoverned = Array.from({ length: 5 }, (_, index) => sample({
      eventId: `ungoverned-${index}`, learnerId: `learner-${index}`, learnerPreparedness: null,
    }));
    const result = calibrateResourceFeatures(resource, ungoverned);
    expect(result.distinctLearnerCount).toBe(5);
    expect(result.observedDifficulty).toBeNull();
    expect(result.limitations).toContain('difficulty-evidence-insufficient');
  });

  it('requires shared users for collaborative affinity and never recommends the learner’s own item', () => {
    const resources = [feature('act:card:anchor'), feature('act:card:recommended')];
    const events = Array.from({ length: 6 }, (_, index) => [
      sample({ eventId: `anchor-${index}`, learnerId: index === 0 ? 'me' : `learner-${index}`, resourceId: 'act:card:anchor', kind: 'selected', authority: 'usage' }),
      sample({ eventId: `recommended-${index}`, learnerId: `learner-${index}`, resourceId: 'act:card:recommended', kind: 'selected', authority: 'usage' }),
    ]).flat();
    const affinity = collaborativeResourceAffinity(resources, events, 'me');
    expect(affinity.get('act:card:recommended')).toBeGreaterThan(0);
    expect(affinity.has('act:card:anchor')).toBe(false);
  });

  it('filters by content version and trusted governance while retaining unchanged resources across index updates', async () => {
    const currentRef = { ...identity(), resourceVersion: RESOURCE_VERSION, indexId: HASH_C };
    const previousIndexRef = { ...currentRef, indexId: 'e'.repeat(64) };
    const oldRef = { ...currentRef, resourceVersion: 'f'.repeat(64) };
    const db = mockDatabase({ facts: [
      factRow('accepted', currentRef),
      factRow('missing-governance', currentRef, { contextJson: { resourceFeatureRef: currentRef } }),
      factRow('unchanged-resource', previousIndexRef),
      factRow('old-version', oldRef),
      factRow('backfill', currentRef, { sourceEventId: 'backfill:fixture' }),
    ] });

    const result = await loadResourceInteractionSamples(db, indexFor());
    expect(result.map((sample) => sample.eventId)).toEqual([
      'governed-fact:fact-accepted', 'governed-fact:fact-unchanged-resource',
    ]);
  });

  it('refreshes cached history when the database watermark changes', async () => {
    const ref = { ...identity(), resourceVersion: RESOURCE_VERSION, indexId: HASH_C };
    const db = mockDatabase({ facts: [factRow('first', ref)] });
    const first = await loadResourceInteractionSamples(db, indexFor());
    expect(first[0]?.eventId).toBe('governed-fact:fact-first');

    db.learningFact.aggregate.mockResolvedValue({ _count: { _all: 2 }, _max: { createdAt: '2026-09-08T00:01:00.000Z' } });
    db.learningFact.findMany.mockResolvedValue([factRow('second', ref)]);
    const second = await loadResourceInteractionSamples(db, indexFor());
    expect(second[0]?.eventId).toBe('governed-fact:fact-second');
  });

  it('links official result facts to server-captured execution refs without rewriting facts', async () => {
    const ref = { ...identity(), resourceVersion: RESOURCE_VERSION, indexId: HASH_C };
    const official = { kind: 'AdaptiveAssessmentAnswer', id: 'answer-1', provenance: 'official',
      reviewState: 'reviewed', pathCompletionEligible: true };
    const correct = factRow('answer-result', undefined);
    correct.contextJson = { ...correct.contextJson, adaptiveAssessment: { answerId: 'answer-1' } } as typeof correct.contextJson;
    const other = { ...correct, id: 'other-user-result', userId: 'other-user' };
    const db = mockDatabase({ executions: [{ id: 'execution', userId: 'learner-1', status: 'completed',
      createdAt: new Date(), liftMetadata: { resourceFeatureRef: ref, adaptiveAssessmentRef: official } }], facts: [correct, other] });
    const samples = await loadResourceInteractionSamples(db, indexFor());
    expect(samples.filter((sample) => sample.kind === 'outcome')).toEqual([
      expect.objectContaining({ eventId: 'governed-fact:fact-answer-result', resourceId: RESOURCE_ID, success: true }),
    ]);
    expect(db.learningFact.findMany.mock.calls[0][0]).toMatchObject({ where: { OR: expect.arrayContaining([
      { userId: 'learner-1', factType: 'question', contextJson: { path: ['adaptiveAssessment', 'answerId'], equals: 'answer-1' } },
    ]) } });
  });

  it('never treats an unverified client outcome id as resource attribution', async () => {
    const ref = { ...identity(), resourceVersion: RESOURCE_VERSION, indexId: HASH_C };
    const result = factRow('answer-result', undefined);
    result.contextJson = { ...result.contextJson, adaptiveAssessment: { answerId: 'answer-1' } } as typeof result.contextJson;
    const db = mockDatabase({ executions: [{ id: 'execution', userId: 'learner-1', status: 'completed',
      createdAt: new Date(), liftMetadata: { resourceFeatureRef: ref, adaptiveAssessmentRef: { id: 'answer-1' } } }], facts: [result] });
    expect((await loadResourceInteractionSamples(db, indexFor())).filter((sample) => sample.kind === 'outcome')).toEqual([]);
  });

  it('refreshes corrected outcomes even when row count and creation time are unchanged', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const ref = { ...identity(), resourceVersion: RESOURCE_VERSION, indexId: HASH_C };
      const db = mockDatabase({ facts: [factRow('corrected', ref)] });
      expect((await loadResourceInteractionSamples(db, indexFor()))[0]?.success).toBe(true);
      db.learningFact.findMany.mockResolvedValue([factRow('corrected', ref, { outcome: 'failure' })]);
      clock.mockReturnValue(32000);
      expect((await loadResourceInteractionSamples(db, indexFor()))[0]?.success).toBe(false);
    } finally { clock.mockRestore(); }
  });

  it('keeps personal sample fields internal to aggregate features', async () => {
    const resource = feature();
    const base = buildResourceNodeRegistry({ knowledgeCards: [{
      id: 'history', title: '历史卡', sourceRef: 'history', renderTarget: '/knowledge', knowledgeNodeIds: ['kn-history'],
    }] });
    const node = {
      ...base.nodes[0], publishedResource: { ...resource, indexId: HASH_C },
    } as ResourceNode;
    const registry = { ...base, nodes: [node], featureIndex: indexFor(resource) };
    const result = await applyResourceInteractionFeatures(registry, mockDatabase(), 'learner-1');
    expect(result.nodes[0]?.observedFeatures).not.toHaveProperty('learnerId');
    expect(result.nodes[0]?.observedFeatures).not.toHaveProperty('samples');
    expect(result.nodes[0]?.observedFeatures?.calculationVersion).toBe('resource-interactions/v1');
  });

  it('uses observed difficulty as a live ranking signal', () => {
    const makeNode = (id: string, observedDifficulty: number) => {
      const registry = buildResourceNodeRegistry({ knowledgeCards: [{
        id, title: id, sourceRef: id, renderTarget: '/knowledge', knowledgeNodeIds: ['kn-history'],
      }] });
      return {
        ...registry.nodes[0],
        publishedResource: { ...feature(`act:card:${id}`), indexId: HASH_C },
        observedFeatures: {
          resourceId: `act:card:${id}`, resourceVersion: RESOURCE_VERSION, scope: 'cohort', sampleSize: 5,
          distinctLearnerCount: 5, selectionCount: 5, completionCount: 5, observedDifficulty,
          observedMinutes: 10, retryCount: 0, confidence: 0.9, evidenceWatermark: '2026-09-08T00:00:00.000Z',
          calculationVersion: 'resource-interactions/v1', limitations: [],
        },
      } as ResourceNode;
    };
    const easyFit = makeNode('fit', 0.5);
    const poorFit = makeNode('mismatch', 0.1);
    const ranked = rankResourceLearnerCandidates({
      candidates: [easyFit, poorFit].map((node) => ({
        node, planningUnit: buildResourceSemanticProjection(node).planningUnit, limitations: [],
      })),
      scene: 'path', targetGraphNodeIds: ['kn-history'], learnerState: null, timeBudgetMinutes: 30,
    });
    expect(ranked.ranked.map((entry) => entry.node.publishedResource?.identity.resourceId)).toEqual([
      'act:card:fit', 'act:card:mismatch',
    ]);
    expect(ranked.ranked[0]?.explanation.featureContributions).toEqual(expect.arrayContaining([
      expect.objectContaining({ feature: 'observed-difficulty-fit', value: expect.any(Number) }),
    ]));
  });
});
