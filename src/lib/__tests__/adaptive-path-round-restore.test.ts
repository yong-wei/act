import { describe, expect, it } from 'vitest';

import { restoreAdaptiveLearningPathPlanFromRound } from '@/lib/adaptive-path-round-restore';

describe('adaptive path round restore', () => {
  it('restores non-control LearningGoal rounds without falling back to control-correction', () => {
    const plan = restoreAdaptiveLearningPathPlanFromRound({
      id: 'round-simulation-validation',
      userId: 'student-1',
      title: '旧标题不应覆盖目录标题',
      goalId: 'simulation-validation-practice',
      pathStatus: 'active',
      currentNodeId: 'simulation-checkpoint',
      pathPayload: {
        planNodes: [
          {
            nodeId: 'simulation-checkpoint',
            title: '提交仿真验证记录',
            type: 'simulation',
            target: '/simulations/control-workbench',
          },
        ],
        alternatives: [
          { optionId: 'simulation-option', label: '仿真优先路径' },
        ],
      },
      alternativePayload: [
        { optionId: 'legacy-option', label: '旧备选路径' },
      ],
    });

    expect(plan).toMatchObject({
      id: 'round-simulation-validation',
      userId: 'student-1',
      status: 'ready',
      currentNodeId: 'simulation-checkpoint',
      goal: {
        id: 'simulation-validation-practice',
        title: '仿真验证实践',
      },
    });
    expect(plan?.goal.id).not.toBe('control-correction');
    expect(plan?.mainPath).toHaveLength(1);
    expect(plan?.alternatives).toEqual([
      { optionId: 'simulation-option', label: '仿真优先路径' },
    ]);
  });

  it('rejects unknown LearningGoal rounds instead of restoring them as a default path', () => {
    expect(restoreAdaptiveLearningPathPlanFromRound({
      id: 'round-unknown',
      userId: 'student-1',
      title: '未知路径',
      goalId: 'unknown-learning-goal',
    })).toBeNull();
  });

  it('restores persisted recommendation provenance snapshots with path options', () => {
    const recommendationProvenance = {
      summary: 'Persisted recommendation basis',
      confidence: 'medium' as const,
      entries: [],
      evidenceReviewHref: '/profile/evidence' as const,
      limitations: [],
      nextAction: null,
    };
    const plan = restoreAdaptiveLearningPathPlanFromRound({
      id: 'round-with-recommendation-provenance',
      userId: 'student-1',
      title: 'Persisted path',
      goalId: 'simulation-validation-practice',
      pathStatus: 'active',
      pathPayload: {
        planNodes: [],
        alternatives: [],
        pathOptions: [{
          optionId: 'path-option-1',
          nodeIds: [],
          recommendationProvenance,
        }],
      },
    });

    expect(plan?.pathOptions?.[0]?.recommendationProvenance).toEqual(recommendationProvenance);
  });

  it('unwraps persisted explanation payloads so SAR basis survives restore', () => {
    const plan = restoreAdaptiveLearningPathPlanFromRound({
      id: 'round-sar-path',
      userId: 'student-1',
      title: 'SAR 路径',
      goalId: 'simulation-validation-practice',
      pathStatus: 'active',
      currentNodeId: 'simulation-checkpoint',
      pathPayload: {
        planNodes: [
          {
            nodeId: 'simulation-checkpoint',
            title: '提交仿真验证记录',
            type: 'simulation',
            target: '/simulations/control-workbench',
          },
        ],
        alternatives: [],
      },
      explanationPayload: {
        explanations: {
          selectedReasons: ['sar-associated-candidate'],
          rejectedAlternatives: [],
          fallbackReasons: [],
          associativeRetrieval: {
            traceId: 'sar-trace:path',
            seedEntityRefs: ['LearningGoal:simulation-validation-practice'],
            candidateResourceNodeIds: ['simulation:control-workbench'],
            selectedCandidateNodeIds: ['simulation:control-workbench'],
            rejectedCandidates: [
              {
                ref: 'restricted:1',
                kind: 'retrievalChunk',
                reasonCodes: ['missing-resource-node-mapping', 'privacy-scope-blocked'],
              },
            ],
            limitations: [],
          },
        },
        selectedReasons: ['sar-associated-candidate'],
        fallbackReasons: [],
      },
    });

    expect(plan?.explanations).toMatchObject({
      selectedReasons: ['sar-associated-candidate'],
      associativeRetrieval: {
        traceId: 'sar-trace:path',
        selectedCandidateNodeIds: ['simulation:control-workbench'],
      },
    });
    expect(plan?.explanations).not.toHaveProperty('explanations');
  });

  it('normalizes diagnostic fixture rounds with incomplete path payloads', () => {
    const plan = restoreAdaptiveLearningPathPlanFromRound({
      id: 'yangfan-fixture-control-correction-path',
      userId: 'student-yangfan',
      title: 'Yang Fan diagnostic control-correction path',
      goalId: 'control-correction',
      pathStatus: 'diagnostic-fixture',
      currentNodeId: '根轨迹_1_1',
      pathPayload: {
        fixtureScope: 'yangfan-diagnostic-fixture.v1',
      },
      explanationPayload: {
        fixtureScope: 'yangfan-diagnostic-fixture.v1',
        citationRefs: ['LearningFact:yangfan-diagnostic-fixture:fact-resource'],
        privacy: 'minimized',
      },
      alternativePayload: [],
    });

    expect(plan).toMatchObject({
      id: 'yangfan-fixture-control-correction-path',
      status: 'fallback',
      confidence: {
        level: 'low',
        score: 0,
        sourceCoverage: 0,
      },
      explanations: {
        selectedReasons: [],
        rejectedAlternatives: [],
        fallbackReasons: ['missing-rules-graph-path-payload'],
      },
      executionStatus: {
        adopted: false,
        completedNodeIds: [],
        activeNodeId: '根轨迹_1_1',
      },
    });
  });

  it('repairs the uniquely verified Yang Fan legacy Arena target during restore', () => {
    const plan = restoreAdaptiveLearningPathPlanFromRound({
      id: 'yangfan-fixture-control-correction-path',
      userId: 'student-yangfan',
      title: 'Yang Fan diagnostic control-correction path',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: '根轨迹_1_1',
      pathPayload: {
        fixtureScope: 'yangfan-diagnostic-fixture.v1',
        mainPathNodeIds: ['性能指标_1_1', '根轨迹_1_1'],
        planNodes: [{
          nodeId: '根轨迹_1_1',
          title: '根轨迹终点检查',
          type: 'arena_task',
          sourceKind: 'knowledge_graph',
          sourceRef: '根轨迹_1_1',
          target: '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
          reasonCodes: [],
        }],
        executionStatus: { activeNodeId: '根轨迹_1_1' },
      },
    });

    expect(plan).toMatchObject({
      status: 'ready',
      currentNodeId: 'arena-task:task-second-order-lead-pid',
      mainPath: [{
        nodeId: 'arena-task:task-second-order-lead-pid',
        sourceKind: 'arena_task',
        sourceRef: 'task-second-order-lead-pid',
        target: '/arena/challenges/task-second-order-lead-pid',
        reasonCodes: expect.arrayContaining(['verified-yangfan-legacy-arena-mapping']),
      }],
      executionStatus: {
        activeNodeId: 'arena-task:task-second-order-lead-pid',
      },
    });
  });

  it.each([
    ['arena-challenge-workbench', 'task-second-order-lead-pid'],
    ['arena-cruise-blackbox-workbench', 'task-cruise-roll-blackbox-identification'],
  ])('restores the verified production registry Arena node %s as canonical', (registryId, taskId) => {
    const legacyNodeId = `registry:${registryId}`;
    const canonicalNodeId = `arena-task:${taskId}`;
    const plan = restoreAdaptiveLearningPathPlanFromRound({
      id: `legacy-${registryId}-path`,
      userId: 'student-1',
      title: 'Legacy production Arena path',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: legacyNodeId,
      pathPayload: {
        mainPathNodeIds: [legacyNodeId, 'reflection:post-arena-review'],
        planNodes: [
          {
            nodeId: legacyNodeId,
            title: 'Legacy production Arena node',
            type: 'arena_task',
            sourceKind: 'resource_registry',
            sourceRef: registryId,
            target: `/arena/challenges/${taskId}`,
            reasonCodes: [],
          },
          {
            nodeId: 'reflection:post-arena-review',
            title: 'Arena 后续反思',
            type: 'reflection',
            prerequisiteNodeIds: [legacyNodeId, canonicalNodeId],
            prerequisiteBasis: [{ nodeId: legacyNodeId, source: 'PlanningUnit' }],
            readiness: {
              state: 'locked',
              requiredCompletedNodeIds: [legacyNodeId, canonicalNodeId],
              fallbackNodeIds: [legacyNodeId, canonicalNodeId],
              missingCompletedNodeIds: [legacyNodeId, canonicalNodeId],
              missingCompetencies: [],
              missingEvidenceCount: 0,
              missingOutcomeRefs: [],
            },
          },
        ],
        executionStatus: {
          activeNodeId: legacyNodeId,
          completedNodeIds: [legacyNodeId, canonicalNodeId],
        },
        policyBundle: {
          status: 'ready',
          paths: [{
            nodeIds: [legacyNodeId, canonicalNodeId],
            activeNodeIds: [legacyNodeId],
            lockedNodeIds: [legacyNodeId],
            readinessSummary: [{ nodeId: legacyNodeId, state: 'locked', message: '等待 Arena 完成' }],
            unlockMessages: [{ nodeId: legacyNodeId, message: '完成 Arena' }],
            terminalValidationNodeIds: [legacyNodeId],
            terminalValidationStrategy: {
              nodeIds: [legacyNodeId, canonicalNodeId],
              summary: 'Arena 终点验证',
            },
            checkpointNodeIds: [legacyNodeId],
          }],
        },
        constraintRepair: {
          status: 'repaired',
          draftNodeIds: [legacyNodeId, canonicalNodeId],
          repairedNodeIds: [legacyNodeId],
          insertedNodeIds: [legacyNodeId],
          removedNodeIds: [legacyNodeId],
          checkpointNodeIds: [legacyNodeId],
          terminalValidationNodeIds: [legacyNodeId],
          repairedConstraints: ['legacy-arena-alias'],
          tradeoffs: [],
          limitations: [],
          infeasibleReasons: [{
            code: 'locked-node-without-fallback',
            nodeIds: [legacyNodeId, canonicalNodeId],
            message: 'legacy alias fixture',
          }],
          versionRefs: { repairVersion: 'path-constraint-repair.v1' },
        },
        visualization: {
          evidence: {
            associativeRetrieval: {
              candidateResourceNodeIds: [legacyNodeId, canonicalNodeId],
              selectedCandidateNodeIds: [legacyNodeId],
              rejectedCandidates: [{
                ref: 'legacy-arena-candidate',
                kind: 'resourceNode',
                resourceNodeId: legacyNodeId,
                reasonCodes: ['not-selected'],
              }],
            },
          },
        },
      },
    });

    expect(plan).toMatchObject({
      status: 'ready',
      currentNodeId: canonicalNodeId,
      mainPath: [{
        nodeId: canonicalNodeId,
        sourceKind: 'arena_task',
        sourceRef: taskId,
        target: `/arena/challenges/${taskId}`,
        reasonCodes: expect.arrayContaining(['verified-legacy-arena-registry-mapping']),
      }, {
        nodeId: 'reflection:post-arena-review',
        prerequisiteNodeIds: [canonicalNodeId],
        prerequisiteBasis: [{ nodeId: canonicalNodeId, source: 'PlanningUnit' }],
        readiness: expect.objectContaining({
          requiredCompletedNodeIds: [canonicalNodeId],
          fallbackNodeIds: [canonicalNodeId],
          missingCompletedNodeIds: [canonicalNodeId],
        }),
      }],
      executionStatus: {
        activeNodeId: canonicalNodeId,
        completedNodeIds: [canonicalNodeId],
      },
      policyBundle: {
        paths: [{
          nodeIds: [canonicalNodeId],
          activeNodeIds: [canonicalNodeId],
          lockedNodeIds: [canonicalNodeId],
          readinessSummary: [{ nodeId: canonicalNodeId }],
          unlockMessages: [{ nodeId: canonicalNodeId }],
          terminalValidationNodeIds: [canonicalNodeId],
          terminalValidationStrategy: { nodeIds: [canonicalNodeId] },
          checkpointNodeIds: [canonicalNodeId],
        }],
      },
      constraintRepair: {
        draftNodeIds: [canonicalNodeId],
        repairedNodeIds: [canonicalNodeId],
        insertedNodeIds: [canonicalNodeId],
        removedNodeIds: [canonicalNodeId],
        checkpointNodeIds: [canonicalNodeId],
        terminalValidationNodeIds: [canonicalNodeId],
        infeasibleReasons: [{ nodeIds: [canonicalNodeId] }],
      },
      visualization: {
        evidence: {
          associativeRetrieval: {
            candidateResourceNodeIds: [canonicalNodeId],
            selectedCandidateNodeIds: [canonicalNodeId],
            rejectedCandidates: [{ resourceNodeId: canonicalNodeId }],
          },
        },
      },
    });
  });

  it('blocks an unverified generic Arena target without leaving an executable target', () => {
    const plan = restoreAdaptiveLearningPathPlanFromRound({
      id: 'legacy-generic-arena-path',
      userId: 'student-1',
      title: 'Legacy generic Arena path',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: 'arena-task:legacy',
      pathPayload: {
        planNodes: [{
          nodeId: 'arena-task:legacy',
          title: 'Legacy Arena',
          type: 'arena_task',
          sourceKind: 'arena_task',
          sourceRef: 'legacy',
          target: '/arena',
          reasonCodes: [],
        }],
      },
    });

    expect(plan).toMatchObject({
      status: 'fallback',
      mainPath: [{
        nodeId: 'arena-task:legacy',
        target: '',
        status: 'blocked',
        reasonCodes: expect.arrayContaining(['generic-arena-target']),
        readiness: expect.objectContaining({
          state: 'locked',
          reasonCodes: ['generic-arena-target'],
        }),
      }],
    });
  });
});
