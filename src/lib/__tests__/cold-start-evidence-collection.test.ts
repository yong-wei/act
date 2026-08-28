import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  classifyCollectionEvent,
  classifyColdStartDimensions,
  collectionEventsFromGovernedFacts,
  collectionMayMutatePath,
  projectColdStartCollection,
  projectCollectionImpactsOnNewPath,
} from '@/lib/cold-start-evidence-collection';

const emptyPath = {
  resourceMix: { knowledge_card: 2 },
  estimatedMinutes: 40,
  checkpointCount: 1,
};

describe('cold-start evidence collection', () => {
  it('classifies all four dimensions as insufficient for a new learner', () => {
    const dimensions = classifyColdStartDimensions({
      resourcePreference: { preferredModalities: [], confidence: 'none' },
      evidence: { confidence: { level: 'none', evidenceCount: 0 }, freshness: 'missing' },
    });

    expect(dimensions.every((dimension) => dimension.status === 'insufficient')).toBe(true);
    expect(projectColdStartCollection({
      learnerState: {},
      goalId: 'control-correction',
    }).activities.map((activity) => activity.type)).toEqual([
      'short-diagnosis',
      'short-simulation',
      'resource-trial',
    ]);
  });

  it('keeps remaining gaps after a governed short diagnosis fills mastery', () => {
    const projection = projectColdStartCollection({
      learnerState: {
        knowledgeMasteryTags: {
          'kn-bode': { confidence: 0.7, evidenceCount: 3, freshness: 'current' },
        },
        resourcePreference: { preferredModalities: [], confidence: 'none' },
        evidence: { confidence: { level: 'low', evidenceCount: 3 }, freshness: 'partial' },
      },
      goalId: 'control-correction',
    });

    expect(projection.insufficientDimensions).toEqual([
      'ability',
      'resource-preference',
      'freshness',
    ]);
    expect(projection.limitationTexts.join('')).toContain('学习节奏');
    expect(projection.activities.some((activity) => activity.type === 'short-diagnosis')).toBe(false);
  });

  it('rejects clicks, page views, chat declarations and incomplete attempts', () => {
    const weak = [
      classifyCollectionEvent({ kind: 'click', at: '2026-08-28T00:00:00.000Z' }),
      classifyCollectionEvent({ kind: 'page-view', at: '2026-08-28T00:00:00.000Z' }),
      classifyCollectionEvent({ kind: 'chat-declaration', at: '2026-08-28T00:00:00.000Z' }),
      classifyCollectionEvent({
        kind: 'short-diagnosis',
        at: '2026-08-28T00:00:00.000Z',
        completed: false,
      }),
      classifyCollectionEvent({ kind: 'abandoned', at: '2026-08-28T00:00:00.000Z' }),
      classifyCollectionEvent({ kind: 'conflict', at: '2026-08-28T00:00:00.000Z' }),
    ];

    expect(weak.every((decision) => decision.accepted === false && decision.affectsMastery === false)).toBe(true);
    expect(weak.every((decision) => decision.confidence !== 'medium' && decision.confidence !== 'high')).toBe(true);
  });

  it('rejects collection activity events that omit completion, governance, or identity', () => {
    const incomplete = classifyCollectionEvent({
      kind: 'short-diagnosis',
      at: '2026-08-28T01:00:00.000Z',
    });
    expect(incomplete).toMatchObject({ accepted: false, quality: 'rejected', affectsMastery: false });
  });

  it('maps governed completed facts into collection events and ignores page views', () => {
    const events = collectionEventsFromGovernedFacts({
      goalId: 'control-correction',
      facts: [
        {
          factType: 'page_view',
          moduleId: 'bode-card',
          finishedAt: '2026-08-28T01:00:00.000Z',
          contextJson: { evidenceGovernance: { evidenceQuality: 'governed', profileWeight: 1, skipProfileContribution: false } },
        },
        {
          factType: 'simulation',
          moduleId: 'bode-sim',
          finishedAt: '2026-08-28T01:10:00.000Z',
          outcome: 'success',
          contextJson: {
            goalId: 'control-correction',
            evidenceGovernance: { evidenceQuality: 'governed', profileWeight: 1, skipProfileContribution: false },
          },
        },
        {
          factType: 'simulation',
          moduleId: 'failed-sim',
          finishedAt: '2026-08-28T01:12:00.000Z',
          outcome: 'failure',
          contextJson: {
            goalId: 'control-correction',
            evidenceGovernance: { evidenceQuality: 'governed', profileWeight: 1, skipProfileContribution: false },
          },
        },
        {
          factType: 'simulation',
          moduleId: 'other-goal-sim',
          finishedAt: '2026-08-28T01:13:00.000Z',
          outcome: 'success',
          contextJson: {
            goalId: 'frequency-response-foundations',
            evidenceGovernance: { evidenceQuality: 'governed', profileWeight: 1, skipProfileContribution: false },
          },
        },
        {
          factType: 'media',
          moduleId: 'bode-video',
          finishedAt: '2026-08-28T01:20:00.000Z',
          contextJson: { evidenceGovernance: { evidenceQuality: 'context-only', profileWeight: 0, skipProfileContribution: true } },
        },
      ],
    });
    expect(events).toEqual([expect.objectContaining({
      kind: 'short-simulation',
      resourceId: 'bode-sim',
      goalId: 'control-correction',
      completed: true,
      qualityMarker: 'governed',
      authority: 'simulation',
    })]);
  });

  it('records a governed resource trial without writing mastery or high confidence', () => {
    const decision = classifyCollectionEvent({
      kind: 'resource-trial',
      at: '2026-08-28T01:00:00.000Z',
      goalId: 'control-correction',
      resourceId: 'bode-card',
      completed: true,
      authority: 'none',
      qualityMarker: 'governed',
    });

    expect(decision).toMatchObject({
      accepted: true,
      record: {
        dimension: 'resource-preference',
        quality: 'governed',
        confidence: 'medium',
        affectsMastery: false,
        goalId: 'control-correction',
        resourceId: 'bode-card',
      },
    });
  });

  it('lets assessment-backed diagnosis affect mastery authority without calling itself high confidence', () => {
    const decision = classifyCollectionEvent({
      kind: 'short-diagnosis',
      at: '2026-08-28T01:00:00.000Z',
      goalId: 'control-correction',
      resourceId: 'bode-quiz',
      completed: true,
      authority: 'assessment',
      qualityMarker: 'governed',
    });

    expect(decision.accepted).toBe(true);
    if (decision.accepted) {
      expect(decision.record.affectsMastery).toBe(true);
      expect(decision.record.confidence).toBe('medium');
    }
  });

  it('does not mutate continue-original-path snapshots after later collection', () => {
    const record = classifyCollectionEvent({
      kind: 'resource-trial',
      at: '2026-08-28T02:00:00.000Z',
      completed: true,
      resourceId: 'bode-sim',
      goalId: 'control-correction',
      qualityMarker: 'governed',
    });
    expect(collectionMayMutatePath('continue')).toBe(false);
    expect(projectCollectionImpactsOnNewPath({
      mode: 'continue',
      previous: emptyPath,
      next: {
        resourceMix: { simulation: 3 },
        estimatedMinutes: 55,
        checkpointCount: 2,
      },
      records: record.accepted ? [record.record] : [],
    })).toEqual([]);
  });

  it('explains a later new path change after a trusted collection record', () => {
    const record = classifyCollectionEvent({
      kind: 'resource-trial',
      at: '2026-08-28T02:00:00.000Z',
      completed: true,
      resourceId: 'bode-sim',
      goalId: 'control-correction',
      qualityMarker: 'governed',
    });
    const impacts = projectCollectionImpactsOnNewPath({
      mode: 'new',
      previous: emptyPath,
      next: {
        resourceMix: { simulation: 3, knowledge_card: 1 },
        estimatedMinutes: 40,
        checkpointCount: 1,
      },
      records: record.accepted ? [record.record] : [],
    });

    expect(impacts).toEqual([expect.objectContaining({
      kind: 'resource-type',
      reasonCode: 'collection-resource-trial',
    })]);
    expect(impacts[0]?.studentText).toContain('资源组合');
  });

  it('keeps collection modules free of Node builtins and candidate-batch imports', () => {
    const repoRoot = process.cwd();
    const collection = readFileSync(join(repoRoot, 'src/lib/cold-start-evidence-collection.ts'), 'utf8');
    const copy = readFileSync(join(repoRoot, 'src/lib/cold-start-evidence-collection-copy.ts'), 'utf8');
    const page = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');
    const runtime = readFileSync(join(repoRoot, 'src/lib/konling-agent-runtime.ts'), 'utf8');
    expect(collection).not.toContain('node:');
    expect(copy).not.toContain('node:');
    expect(collection).not.toContain('adaptive-path-candidate-batches');
    expect(page).not.toContain('adaptive-path-candidate-batches');
    expect(runtime).toContain('collectionEventsFromGovernedFacts');
    expect(runtime).toContain('previousPathFactsFromPlanOptions');
  });
});
