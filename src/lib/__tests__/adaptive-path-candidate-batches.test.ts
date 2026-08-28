import { describe, expect, it, vi } from 'vitest';

import {
  AdaptivePathCandidateBatchConflictError,
  buildAdaptivePathCandidateDifferenceSummary,
  buildCandidateSnapshots,
  fingerprintAdaptivePathCandidateSnapshot,
  persistAdaptivePathCandidateBatch,
  resolveAdaptivePathCandidateSelection,
  buildGatedCandidateSnapshots,
} from '@/lib/adaptive-path-candidate-batches';
import {
  ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES,
  buildSerializablePathOptions,
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
    expect(batch.candidates.map((candidate) => candidate.snapshot.optionId)).toEqual([
      'path-option-1',
      'path-option-2',
    ]);
    expect(create).toHaveBeenCalledOnce();
    expect(learningPathUpdate).not.toHaveBeenCalled();
  });

  it('freezes generation-time decision evidence onto batch metadata and candidate snapshots', async () => {
    const { db } = dbFixture();
    const generated = plan();
    const decisionEvidence = {
      snapshot: {
        version: 'personalized-path-decision-evidence.v1' as const,
        capturedAt: '2026-08-26T00:00:00.000Z',
        plannerVersion: 'adaptive-learning-path-planner.v1',
        learnerStateVersion: 'adaptive-learner-state.v1',
        learnerStateGeneratedAt: '2026-08-25T00:00:00.000Z',
        weakTargets: [],
        preferredModalities: ['video'],
        preferredModalityConfidence: 'medium',
        evidenceWindow: null,
        freshness: 'current' as const,
        sourceCoverage: {},
        missingEvidence: [],
        limitations: [],
        degradationReasons: [],
      },
      paths: [{
        optionId: 'path-option-1',
        styleId: 'foundation-remediation',
        impacts: [],
        explanations: [{
          code: 'weak-target',
          studentText: '你在频域分析相关学习中的掌握度仍有提升空间，因此增加了相关讲解和练习。',
        }],
      }],
    };
    generated.policyBundle!.decisionEvidence = decisionEvidence;
    generated.policyBundle!.paths[0]!.decisionEvidence = decisionEvidence.paths[0];

    const batch = await persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'request-evidence',
      plan: generated,
    });

    decisionEvidence.snapshot.preferredModalities.push('simulation');
    decisionEvidence.paths[0]!.explanations[0]!.studentText = '后续画像改写';

    expect(batch.metadata.decisionEvidence).toEqual(expect.objectContaining({
      snapshot: expect.objectContaining({
        version: 'personalized-path-decision-evidence.v1',
        preferredModalities: ['video'],
      }),
    }));
    expect(batch.candidates[0]?.snapshot.decisionEvidence).toEqual(expect.objectContaining({
      optionId: 'path-option-1',
      explanations: [{
        code: 'weak-target',
        studentText: '你在频域分析相关学习中的掌握度仍有提升空间，因此增加了相关讲解和练习。',
      }],
    }));
  });

  it('rejects title-or-score-only duplicates and keeps shared required nodes when other facts differ', () => {
    const duplicate = plan();
    duplicate.policyBundle!.paths = [
      candidate('foundation-remediation', 'foundation-remediation', '方案甲', ['node-1', 'terminal-1']),
      {
        ...candidate('arena-simulation-sprint', 'simulation-driven', '方案乙', ['node-1', 'terminal-1']),
        estimatedMinutes: 10,
        score: 99,
        expectedTargetLift: 9,
      },
    ];
    const gatedDuplicates = buildGatedCandidateSnapshots(duplicate, 'batch-dup');
    expect(gatedDuplicates.candidates).toHaveLength(1);
    expect(gatedDuplicates.candidates[0]?.snapshot.optionId).toBe('path-option-1');
    expect(gatedDuplicates.candidates[0]?.snapshot.limitations).toEqual(expect.arrayContaining([
      'title-or-score-only-duplicates-removed',
      'insufficient-distinct-resources',
    ]));
    expect(gatedDuplicates.limitations).toEqual(expect.arrayContaining([
      'title-or-score-only-duplicates-removed',
      'insufficient-distinct-resources',
    ]));

    const sharedTerminal = plan();
    sharedTerminal.policyBundle!.paths = [
      {
        ...candidate('foundation-remediation', 'foundation-remediation', '稳步掌握', ['node-1', 'terminal-1']),
        terminalValidationNodeIds: ['terminal-1'],
        resourceMix: { video: 1 },
        estimatedMinutes: 20,
      },
      {
        ...candidate('arena-simulation-sprint', 'simulation-driven', '仿真冲刺', ['node-2', 'terminal-1']),
        terminalValidationNodeIds: ['terminal-1'],
        resourceMix: { simulation: 1 },
        estimatedMinutes: 40,
      },
    ];
    const gatedShared = buildGatedCandidateSnapshots(sharedTerminal, 'batch-shared');
    expect(gatedShared.candidates).toHaveLength(2);
    expect(gatedShared.limitations).not.toContain('title-or-score-only-duplicates-removed');
  });

  it('reuses the same batch and candidate identities for a repeated request', async () => {
    const { db, create } = dbFixture();
    const first = await persistAdaptivePathCandidateBatch(db, { generationRequestId: 'request-1', plan: plan() });
    const changedPlan = plan();
    changedPlan.policyBundle!.paths[0].nodeIds = ['planner-output-b'];
    changedPlan.policyBundle!.paths[0].label = '重试后的不同方案';
    const second = await persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'request-1',
      plan: changedPlan,
    });

    expect(second).toEqual(first);
    expect(second.candidates[0].snapshot).toEqual(first.candidates[0].snapshot);
    expect(second.candidates[0].snapshot).not.toMatchObject({ nodeIds: ['planner-output-b'] });
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

  it('converges concurrent differing planner outputs on one immutable batch', async () => {
    let stored: any = null;
    let transactionReads = 0;
    let releaseTransactionReads!: () => void;
    const transactionReadsReady = new Promise<void>((resolve) => {
      releaseTransactionReads = resolve;
    });
    const create = vi.fn(async ({ data }: any) => {
      if (stored) throw Object.assign(new Error('unique generation request'), { code: 'P2002' });
      stored = {
        ...data,
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
        candidates: data.candidates.create,
      };
      return stored;
    });
    const db: any = {
      adaptivePathCandidateBatch: {
        findUnique: vi.fn(async () => {
          if (stored) return stored;
          transactionReads += 1;
          if (transactionReads >= 4) releaseTransactionReads();
          if (transactionReads >= 3) await transactionReadsReady;
          return null;
        }),
        findFirst: vi.fn(async () => stored),
        create,
      },
      $transaction: vi.fn(async (callback: any) => callback(db)),
    };
    const changedPlan = plan();
    changedPlan.policyBundle!.paths[0].nodeIds = ['planner-output-b'];

    const [first, second] = await Promise.all([
      persistAdaptivePathCandidateBatch(db, { generationRequestId: 'request-race', plan: plan() }),
      persistAdaptivePathCandidateBatch(db, { generationRequestId: 'request-race', plan: changedPlan }),
    ]);

    expect(second).toEqual(first);
    expect(first.candidates[0].snapshot).not.toMatchObject({ nodeIds: ['planner-output-b'] });
  });

  it('derives candidate identity from batch and planner identity rather than labels', () => {
    const original = plan();
    const renamed = plan();
    renamed.policyBundle!.paths[0].label = '新的显示名称';

    expect(buildCandidateSnapshots(original, 'batch-1')[0].id)
      .toBe(buildCandidateSnapshots(renamed, 'batch-1')[0].id);
    expect(buildCandidateSnapshots(original, 'batch-1')[0].snapshot.optionId).toBe('path-option-1');
  });

  it('preserves the complete planner snapshot for a single executable fallback candidate', () => {
    const fallbackPlan = plan();
    fallbackPlan.policyBundle = { ...fallbackPlan.policyBundle!, paths: [] };
    fallbackPlan.visualization = {
      ...fallbackPlan.visualization,
      evidence: {
        learnerStateDeficits: [{
          targetId: 'k1',
          kind: 'knowledge',
          value: 0.4,
          confidence: 0.8,
          evidenceCount: 2,
          reasonCode: 'knowledge-deficit',
        }],
      } as never,
    };

    const [candidate] = buildCandidateSnapshots(fallbackPlan, 'batch-fallback');
    const [serializedOption] = buildSerializablePathOptions(fallbackPlan);

    expect(candidate.snapshot).toEqual({
      ...serializedOption,
      limitations: ['insufficient-distinct-resources'],
    });
    expect(candidate.snapshot).toMatchObject({
      optionId: 'path-option-1',
      nodeSummaries: expect.any(Array),
      readinessSummary: expect.any(Array),
      effort: expect.any(Object),
      resourceMix: { knowledge_card: 1 },
      targetDeficits: expect.any(Array),
      evidenceBasis: expect.any(Array),
      terminalValidationNodeIds: expect.any(Array),
      terminalValidationStrategy: expect.any(Object),
      recommendationProvenance: expect.any(Object),
    });
  });

  it('resolves only persisted candidate identities and preserves batch order', () => {
    const candidates = buildCandidateSnapshots(plan(), 'batch-1');
    const batch = {
      id: 'batch-1', userId: 'student-1', goalId: 'control-correction', classId: 'class-1',
      generationRequestId: 'request-1', sourcePathId: 'path-1', plannerVersion: 'stage-1-rules-graph',
      status: 'succeeded' as const, createdAt: '2026-08-05T00:00:00.000Z', metadata: {}, candidates,
    };

    expect(resolveAdaptivePathCandidateSelection(batch, { candidateId: candidates[1].id })).toMatchObject({
      status: 'selected', batchId: 'batch-1', candidateId: candidates[1].id,
    });
    expect(resolveAdaptivePathCandidateSelection(batch, { naturalLanguageIntent: '我选择稳步掌握' })).toMatchObject({
      status: 'selected', candidateId: candidates[0].id,
    });
    expect(resolveAdaptivePathCandidateSelection(batch, { naturalLanguageIntent: '就这个' })).toEqual({
      status: 'clarification_required',
      batchId: 'batch-1',
      alternatives: candidates.map((candidate) => ({ candidateId: candidate.id, label: candidate.label })),
      question: '你想选择哪一条学习路径？',
    });
    for (const naturalLanguageIntent of ['选第一个', '随便哪一个', '选你推荐的那条', '我都可以']) {
      expect(resolveAdaptivePathCandidateSelection(batch, { naturalLanguageIntent })).toMatchObject({
        status: 'clarification_required',
        batchId: 'batch-1',
        alternatives: candidates.map((candidate) => ({ candidateId: candidate.id, label: candidate.label })),
      });
    }
    expect(resolveAdaptivePathCandidateSelection(batch, { candidateId: 'missing' })).toEqual({
      status: 'unresolved', batchId: 'batch-1',
    });
  });

  it('persists adjustment lineage and detects governed material differences', async () => {
    const source = buildCandidateSnapshots(plan(), 'source-batch')[0]!;
    const adjusted = plan();
    adjusted.policyBundle!.paths[0].nodeIds = ['node-adjusted'];
    adjusted.policyBundle!.paths[0].planNodes = [node('node-adjusted')];
    const differenceSummary = buildAdaptivePathCandidateDifferenceSummary(source, adjusted);
    const { db, create } = dbFixture();

    const batch = await persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'adjustment-1',
      plan: adjusted,
      derivation: {
        kind: 'adjustment',
        sourceBatchId: 'source-batch',
        sourceCandidateId: source.id,
        sourceCandidateFingerprint: source.fingerprint,
        activeProgressVersion: '2026-08-18T00:00:00.000Z',
        requestSnapshot: { difficultyRhythm: 'challenge' },
        differenceSummary,
      },
    });

    expect(differenceSummary).toMatchObject({
      material: true,
      sourceCandidateFingerprint: fingerprintAdaptivePathCandidateSnapshot(source.snapshot),
      candidates: expect.arrayContaining([
        expect.objectContaining({ changedFields: expect.arrayContaining(['nodeIds']) }),
      ]),
    });
    expect(batch.metadata).toMatchObject({
      derivation: {
        sourceBatchId: 'source-batch',
        sourceCandidateId: source.id,
        activeProgressVersion: '2026-08-18T00:00:00.000Z',
      },
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it('rejects adjustment idempotency reuse for a different governed source', async () => {
    const source = buildCandidateSnapshots(plan(), 'source-batch')[0]!;
    const adjusted = plan();
    adjusted.policyBundle!.paths[0].nodeIds = ['node-adjusted'];
    adjusted.policyBundle!.paths[0].planNodes = [node('node-adjusted')];
    const differenceSummary = buildAdaptivePathCandidateDifferenceSummary(source, adjusted);
    const { db } = dbFixture();
    const derivation = {
      kind: 'adjustment' as const,
      sourceBatchId: 'source-batch',
      sourceCandidateId: source.id,
      sourceCandidateFingerprint: source.fingerprint,
      activeProgressVersion: '2026-08-18T00:00:00.000Z',
      requestSnapshot: { difficultyRhythm: 'challenge', resourcePreference: ['simulation'] },
      differenceSummary,
    };

    await persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'adjustment-source-conflict',
      plan: adjusted,
      classId: 'class-1',
      derivation,
    });

    await expect(persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'adjustment-source-conflict',
      plan: adjusted,
      classId: 'class-1',
      derivation: {
        ...derivation,
        sourceCandidateId: 'another-candidate',
      },
    })).rejects.toBeInstanceOf(AdaptivePathCandidateBatchConflictError);
  });

  it('rejects adjustment idempotency reuse for a different normalized request or class', async () => {
    const source = buildCandidateSnapshots(plan(), 'source-batch')[0]!;
    const adjusted = plan();
    adjusted.policyBundle!.paths[0].nodeIds = ['node-adjusted'];
    adjusted.policyBundle!.paths[0].planNodes = [node('node-adjusted')];
    const differenceSummary = buildAdaptivePathCandidateDifferenceSummary(source, adjusted);
    const { db } = dbFixture();
    const derivation = {
      kind: 'adjustment' as const,
      sourceBatchId: 'source-batch',
      sourceCandidateId: source.id,
      sourceCandidateFingerprint: source.fingerprint,
      activeProgressVersion: '2026-08-18T00:00:00.000Z',
      requestSnapshot: { difficultyRhythm: 'challenge', resourcePreference: ['simulation'] },
      differenceSummary,
    };

    await persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'adjustment-request-conflict',
      plan: adjusted,
      classId: 'class-1',
      derivation,
    });

    await expect(persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'adjustment-request-conflict',
      plan: adjusted,
      classId: 'class-1',
      derivation: {
        ...derivation,
        requestSnapshot: { resourcePreference: ['simulation'], difficultyRhythm: 'steady' },
      },
    })).rejects.toBeInstanceOf(AdaptivePathCandidateBatchConflictError);
    await expect(persistAdaptivePathCandidateBatch(db, {
      generationRequestId: 'adjustment-request-conflict',
      plan: adjusted,
      classId: 'class-2',
      derivation,
    })).rejects.toBeInstanceOf(AdaptivePathCandidateBatchConflictError);
  });

  it('reports no material difference for cosmetic candidate changes', () => {
    const original = plan();
    const source = buildCandidateSnapshots(original, 'source-batch')[0]!;
    const adjusted = plan();
    adjusted.policyBundle!.paths = [{
      ...adjusted.policyBundle!.paths[0],
      label: '新的显示名称',
    }];

    expect(buildAdaptivePathCandidateDifferenceSummary(source, adjusted)).toMatchObject({
      material: false,
    });
  });
});
