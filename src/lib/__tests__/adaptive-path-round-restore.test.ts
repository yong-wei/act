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
});
