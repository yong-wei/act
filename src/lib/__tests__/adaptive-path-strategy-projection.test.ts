import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildGatedCandidateSnapshots } from '@/features/personalization/path-planning/adaptive-path-candidate-batches';
import {
  ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES,
  type AdaptiveLearningPathPlan,
  type AdaptiveLearningPathPolicyFamily,
  type AdaptiveLearningPathStyleId,
} from '@/features/personalization/path-planning/public-api';
import { buildControlCorrectionLearningCenterView, ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG } from '@/features/personalization/experience/adaptive-learning-center-contracts';
import {
  selectVisibleAdaptivePathOptions,
} from '@/features/personalization/path-planning/adaptive-path-batch-comparison-view';
import {
  buildStudentSafeBatchComparison,
  buildStudentSafeCandidatePathOption,
  buildStudentSafePathOptions,
} from '@/lib/konling-agent-runtime';

function pathStrategy(overrides: Record<string, unknown> = {}) {
  return {
    family: 'foundation-remediation',
    strategyId: 'weakness-repair',
    name: '薄弱点补强',
    portraitBasis: ['control-correction:time-domain-targets'],
    generic: false,
    ...overrides,
  };
}

function projectionPlan(strategy: Record<string, unknown> | null): AdaptiveLearningPathPlan {
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
        candidate('foundation-remediation', 'foundation-remediation', '稳步掌握', ['node-1'], strategy),
        candidate('arena-simulation-sprint', 'simulation-driven', '快速复习', ['node-2'], null),
      ],
      diversity: {} as never,
      fallbackReasons: [],
    },
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: 'ready',
    currentNodeId: 'node-1',
    mainPath: [node('node-1'), node('node-2')],
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
  strategy: Record<string, unknown> | null,
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
    ...(strategy ? { strategy } : {}),
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

describe('student-safe strategy projection (#2033)', () => {
  it('projects strategy metadata into student-safe path options', () => {
    const options = buildStudentSafePathOptions(projectionPlan(pathStrategy()));
    expect(options[0].strategy).toEqual({
      strategyId: 'weakness-repair',
      name: '薄弱点补强',
      portraitBasis: ['control-correction:time-domain-targets'],
      generic: false,
      preferenceQuotaUnmet: false,
    });
    // 无策略的候选投影为 null，不编造个性化。
    expect(options[1].strategy).toBeNull();
  });

  it('strips portrait basis from generic strategies', () => {
    const options = buildStudentSafePathOptions(projectionPlan(pathStrategy({ generic: true })));
    expect(options[0].strategy).toMatchObject({ generic: true, portraitBasis: [] });
  });

  it('keeps candidate snapshot strategy through the student-safe option projection', () => {
    const option = buildStudentSafeCandidatePathOption({
      optionId: 'path-option-1',
      styleId: 'foundation-remediation',
      label: '稳步掌握',
      effort: { estimatedMinutes: 10, relative: 'short' },
      strategy: pathStrategy(),
      nodeSummaries: [],
    });
    expect(option.strategy).toMatchObject({ strategyId: 'weakness-repair', generic: false });
  });

  it('summarizes batch differentiation and resource readiness without raw object keys', () => {
    const comparison = buildStudentSafeBatchComparison({
      differentiation: {
        highDifferentiation: true,
        unreadableObjectKeys: [],
        pairs: [{
          leftStyleId: 'foundation-remediation',
          rightStyleId: 'arena-simulation-sprint',
          metrics: { satisfiedCount: 4, satisfiedRules: ['core-node-jaccard', 'object-key-jaccard'] },
        }],
      },
      objectKeyReadRecords: [
        {
          objectKey: 'lessons/1-3/media/intro.mp4',
          resourceId: 'r1',
          candidateStyleId: 'foundation-remediation',
          nodeNodeId: 'node-1',
          state: 'verified',
          contentSha256: 'sha-a',
          verifiedAt: '2026-09-06T00:00:00.000Z',
          runtimeReleaseId: null,
        },
        {
          objectKey: 'simulations/cruise/index.html',
          resourceId: 'r2',
          candidateStyleId: 'arena-simulation-sprint',
          nodeNodeId: 'node-2',
          state: 'missing',
          contentSha256: null,
          verifiedAt: '2026-09-06T00:00:00.000Z',
          runtimeReleaseId: null,
        },
      ],
    });

    expect(comparison.highDifferentiation).toBe(true);
    expect(comparison.pairs).toEqual([expect.objectContaining({
      leftStyleId: 'foundation-remediation',
      rightStyleId: 'arena-simulation-sprint',
      satisfiedCount: 4,
      summary: '这两条路径在资源构成与学习安排上有明显差异。',
    })]);
    expect(comparison.resourceReadiness).toEqual(expect.arrayContaining([
      expect.objectContaining({ styleId: 'foundation-remediation', verifiedResources: 1, unreadableResources: 0, notes: [] }),
      expect.objectContaining({
        styleId: 'arena-simulation-sprint',
        verifiedResources: 0,
        unreadableResources: 1,
        // 失败类型对学生可理解：缺失/权限/损坏分述，而非统一"无法读取"。
        notes: ['这条路径有 1 个资源在当前课程资源库中暂时缺失，已不计入方案对比。'],
      }),
    ]));
    // 学生安全：不下发指标原始数值、规则名与对象键原文。
    expect(JSON.stringify(comparison)).not.toContain('intro.mp4');
    expect(JSON.stringify(comparison)).not.toContain('satisfiedRules');
    expect(JSON.stringify(comparison)).not.toContain('core-node-jaccard');
  });

  it('appends the strategy field to center-contract path option summaries', () => {
    const plan = projectionPlan(pathStrategy()) as never as Record<string, unknown>;
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: null,
      pathPlan: plan as never,
    });
    const currentPath = view.panels.find((panel) => panel.region === 'current-path');
    const pathOptions = (currentPath?.payload as { pathOptions?: Array<Record<string, unknown>> })?.pathOptions ?? [];
    expect(pathOptions[0]?.strategy).toEqual({
      strategyId: 'weakness-repair',
      name: '薄弱点补强',
      portraitBasis: ['control-correction:time-domain-targets'],
      generic: false,
      preferenceQuotaUnmet: false,
    });
  });

  it('keeps the strategy field out of persisted candidate snapshots until serialization', () => {
    const plan = projectionPlan(pathStrategy());
    const snapshots = buildGatedCandidateSnapshots(plan, 'batch-projection').candidates;
    // buildSerializablePathOptions 面向持久化快照附加策略元数据。
    expect((snapshots[0].snapshot as Record<string, unknown>).strategy).toMatchObject({
      strategyId: expect.any(String),
      generic: expect.any(Boolean),
    });
  });

  it('does not fall back to current-path options when candidate diversity failed', () => {
    const fallback = [{ optionId: 'plan-a' }, { optionId: 'plan-b' }, { optionId: 'plan-c' }];
    expect(selectVisibleAdaptivePathOptions(
      { comparison: { insufficientCandidateDiversity: true } },
      [],
      fallback,
    )).toEqual([]);
    expect(selectVisibleAdaptivePathOptions(
      { metadata: { diversityLimitations: ['insufficient-candidate-diversity'] } },
      [],
      fallback,
    )).toEqual([]);
    expect(selectVisibleAdaptivePathOptions(null, [], fallback)).toEqual(fallback);
  });
});
