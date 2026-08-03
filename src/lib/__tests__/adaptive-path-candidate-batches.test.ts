import { describe, expect, it, vi } from 'vitest';

import {
  AdaptivePathCandidateBatchConflictError,
  buildCandidateSnapshots,
  persistAdaptivePathCandidateBatch,
} from '@/lib/adaptive-path-candidate-batches';
import {
  ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES,
  type AdaptiveLearningPathPlan,
  type AdaptiveLearningPathPolicyFamily,
  type AdaptiveLearningPathStyleId,
} from '@/lib/adaptive-learning-path-planner';

function plan(): AdaptiveLearningPathPlan {
  return {
    id: 'path-1',
    userId: 'student-1',
    goal: { id: 'control-correction', title: '控制系统校正', knowledgeTargets: ['k1'], competencyTargets: [] },
    stage: 'stage-1-rules-graph',
    policyFamily: 'foundation-remediation',
    policyMetadata: ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES['foundation-remediation'],
    policyBundle: {
      families: ['foundation-remediation', 'simulation-driven'],
      overlapThreshold: 0.8,
      status: 'ready',
      paths: [
        candidate('foundation-remediation', 'foundation-remediation', '稳步掌握', ['node-1']),
        candidate('arena-simulation-sprint', 'simulation-driven', '快速复习', ['node-2']),
      ],
      diversity: {} as AdaptiveLearningPathPlan['policyBundle'] extends infer B
        ? B extends { diversity: infer D } ? D : never
        : never,
      fallbackReasons: [],
    },
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: 'ready',
    currentNodeId: 'node-1',
    mainPath: [node('node-1')],
    alternatives: [],
    score: {
      total: 1,
      objectives: {
        learningGain: 1,
        engagement: 1,
        constraintSatisfaction: 1,
        diversity: 1,
        fatigue: 0,
        dropoutRisk: 0,
      },
    },
    confidence: { level: 'high', score: 1, sourceCoverage: 1 },
    explanations: { selectedReasons: [], rejectedAlternatives: [], fallbackReasons: [], configurationFulfillment: [] },
    executionStatus: { adopted: false, completedNodeIds: [], activeNodeId: 'node-1', updatedAt: '2026-08-03T00:00:00.000Z' },
    deviations: [],
    corrections: [],
    feedbackEvents: [],
    visualization: { map: {} as never, timeline: {} as never, evidence: {} as never },
  };
}

function candidate(
  styleId: AdaptiveLearningPathStyleId,
  policyFamily: AdaptiveLearningPathPolicyFamily,
  label: string,
  nodeIds: string[],
) {
  return {
    styleId,
    policyFamily,
    label,
    nodeIds,
    activeNodeIds: nodeIds,
    lockedNodeIds: [],
    readinessSummary: [],
    unlockMessages: [],
    planNodes: nodeIds.map(node),
    nodeSummaries: [],
    targetDeficits: [],
    evidenceBasis: [],
    estimatedMinutes: 10,
    modalityMix: {},
    resourceMix: {},
    overlap: { maxWithOtherOptions: 0 },
    effort: { estimatedMinutes: 10, relative: 'short' as const },
    expectedTargetLift: 1,
    terminalValidationNodeIds: [],
    terminalValidationStrategy: { nodeIds: [], summary: '' },
    checkpointNodeIds: [],
    limitations: [],
  };
}

function node(nodeId: string) {
  return {
    nodeId,
    title: nodeId,
    type: 'knowledge_card' as const,
    pathNodeType: 'knowledge_card' as const,
    displayName: nodeId,
    iconKey: 'book-open',
    shapeHint: 'card' as const,
    evidenceBehavior: 'view' as const,
    evidenceStatus: 'instrumented' as const,
    externalResource: null,
    checkpoint: null,
    sourceKind: 'knowledge_graph' as const,
    sourceRef: `knowledge:${nodeId}`,
    target: `/knowledge?node=${nodeId}`,
    estimatedTimeMinutes: 10,
    prerequisiteNodeIds: [],
    knowledgeCoverage: ['k1'],
    teacherPolicy: 'allowed' as const,
    privacyLevel: 'student-visible' as const,
    status: 'current' as const,
    score: 1,
    terminalConstraints: [],
    reasonCodes: [],
  };
}

function dbFixture(existing: any = null) {
  let stored = existing;
  const create = vi.fn(async (args: any) => {
    stored = {
      ...args.data,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      candidates: args.data.candidates.create,
    };
    return stored;
  });
  const db = {
    adaptivePathCandidateBatch: {
      findUnique: vi.fn(async () => stored),
      findFirst: vi.fn(async () => stored),
      create,
    },
    $transaction: vi.fn(async (callback: any) => callback(db)),
  };
  return { db, create };
}

describe('adaptive path candidate batches', () => {
  it('persists ordered immutable candidates without mutating LearningPath', async () => {
    const { db, create } = dbFixture();
    const learningPathUpdate = vi.fn();
    Object.assign(db, { learningPath: { update: learningPathUpdate } });

    const batch = await persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'request-1',
      plan: plan(),
    });

    expect(batch.candidates.map((candidate) => candidate.styleId)).toEqual([
      'foundation-remediation',
      'arena-simulation-sprint',
    ]);
    expect(new Set(batch.candidates.map((candidate) => candidate.id)).size).toBe(2);
    expect(create).toHaveBeenCalledOnce();
    expect(learningPathUpdate).not.toHaveBeenCalled();
  });

  it('reuses the same batch and candidate identities for a repeated request', async () => {
    const { db, create } = dbFixture();
    const first = await persistAdaptivePathCandidateBatch(db, { generationRequestId: 'request-1', plan: plan() });
    const second = await persistAdaptivePathCandidateBatch(db, { generationRequestId: 'request-1', plan: plan() });

    expect(second).toEqual(first);
    expect(create).toHaveBeenCalledOnce();
  });

  it('rejects reuse of a request identity for a different path', async () => {
    const { db } = dbFixture();
    await persistAdaptivePathCandidateBatch(db, { generationRequestId: 'request-1', plan: plan() });
    const conflicting = { ...plan(), id: 'path-2' };

    await expect(persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'request-1',
      plan: conflicting,
    })).rejects.toBeInstanceOf(AdaptivePathCandidateBatchConflictError);
  });

  it('derives candidate identity from batch and planner identity rather than labels', () => {
    const original = plan();
    const renamed = plan();
    renamed.policyBundle!.paths[0].label = '新的显示名称';

    expect(buildCandidateSnapshots(original, 'batch-1')[0].id)
      .toBe(buildCandidateSnapshots(renamed, 'batch-1')[0].id);
  });
});
