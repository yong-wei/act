import { describe, expect, it } from 'vitest';

import {
  assignAdaptiveOptimizationExperiment,
  evaluateLongTermKonlingMemoryGate,
  rerankAdaptivePathAlternativesWithBandit,
  sanitizeAdaptiveOptimizationExport,
  summarizeAdaptiveOptimizationMetrics,
  summarizePathFeedbackMetrics,
} from '../adaptive-learning-optimization-experiments';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
  projectPortraitV2ForConsumer,
} from '../data-governance/portrait-v2-model';
import type { PortraitV2DimensionId } from '../data-governance/kaq-objective-taxonomy';
import {
  planLearningPath,
  recordLearningPathFeedback,
  type AdaptiveLearningPathPlannerInput,
} from '@/features/personalization/path-planning/public-api';
import { buildControlCorrectionResourceNodeRegistry } from '../control-correction-resource-seed';
import { buildResourceNodeRegistry, type ResourceNodeRegistry } from '../resource-node-registry';

function createPlannerPortrait(
  now: Date,
  overrides: Partial<Record<PortraitV2DimensionId, { score?: number; confidence?: number; totalCount?: number }>> = {},
) {
  return projectPortraitV2ForConsumer(createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: now.toISOString(),
    now,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => {
      const override = overrides[id] ?? {};
      const totalCount = override.totalCount ?? 4;
      return {
        id,
        score: override.score ?? 50,
        confidence: override.confidence ?? 0.7,
        trend: 'stable' as const,
        freshness: {
          state: 'current' as const,
          asOf: now.toISOString(),
          evidenceAgeDays: 0,
        },
        evidenceSummary: {
          totalCount,
          sourceFamilyCounts: { LearningFact: totalCount },
        },
        lastPositiveEvidenceAt: now.toISOString(),
        lastNegativeEvidenceAt: null,
        rationale: 'Governed evidence supports the current score.',
        limitations: [],
        sourceLineage: [{
          kind: 'evidence-family' as const,
          ref: 'LearningFact',
          privacyScope: 'student-visible' as const,
        }],
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      };
    }),
  }), 'planner', { now });
}

function withLegalSimulationDestinations(registry: ResourceNodeRegistry): ResourceNodeRegistry {
  return {
    ...registry,
    nodes: registry.nodes.map((node) => node.type === 'simulation' && node.launchTarget?.startsWith('/interactive-learning/courses/')
      ? {
          ...node,
          launchTarget: `/simulations/${node.sourceRef}`,
        }
      : node),
  };
}

function plannerInput(overrides: Partial<AdaptiveLearningPathPlannerInput> = {}): AdaptiveLearningPathPlannerInput {
  const now = overrides.now instanceof Date ? overrides.now : new Date('2026-05-28T00:00:00Z');
  const defaultPortrait = createPlannerPortrait(now);
  const registry = buildResourceNodeRegistry({
    registeredResources: [
      {
        id: 'main-card',
        label: '主路径知识卡',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/main-card',
        knowledgeNodeIds: ['kn-goal'],
      },
    ],
    simulations: [
      {
        id: 'alt-sim-a',
        title: '替代仿真 A',
        launchTarget: '/simulations/alt-a',
        knowledgeNodeIds: ['kn-goal'],
      },
      {
        id: 'alt-sim-b',
        title: '替代仿真 B',
        launchTarget: '/simulations/alt-b',
        knowledgeNodeIds: ['kn-goal'],
      },
      {
        id: 'private-sim',
        title: '私有仿真',
        launchTarget: '/simulations/private',
        knowledgeNodeIds: ['kn-goal'],
      },
    ],
  });
  const privateNode = registry.nodes.find((node) => node.id === 'simulation:private-sim');
  if (privateNode) {
    privateNode.planningMetadata.privacyLevel = 'admin-scoped';
  }

  return {
    studentId: 'student-1',
    goal: {
      id: 'goal-1',
      title: '目标',
      knowledgeTargets: ['kn-goal'],
    },
    registry,
    constraints: {
      timeBudgetMinutes: 80,
      privacyScopes: ['student-visible'],
    },
    now,
    ...overrides,
    learnerState: {
      knowledgeMastery: {
        tags: {
          'kn-goal': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 6 },
        },
      },
      evidence: {
        confidence: {
          level: 'medium',
          score: 0.72,
          evidenceCount: 8,
          sourceCompleteness: 0.8,
        },
        sourceCoverage: {
          LearningFact: 'available',
        },
      },
      ...overrides.learnerState,
      primaryPortrait: overrides.learnerState && 'primaryPortrait' in overrides.learnerState
        ? overrides.learnerState.primaryPortrait
        : defaultPortrait,
      primaryPortraitState: overrides.learnerState?.primaryPortraitState ?? 'SNAPSHOT',
      primaryPortraitAvailability: overrides.learnerState?.primaryPortraitAvailability ?? 'available',
    },
  };
}

describe('adaptive learning optimization experiments', () => {
  it('does not skip a locked prerequisite to make a later ready node current', () => {
    const plan = planLearningPath(plannerInput({
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'locked-prep',
            label: '锁定准备资源',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/interactive-learning/resources/locked-prep',
            knowledgeNodeIds: ['kn-goal'],
            planningOverride: {
              readiness: {
                minimumCompetency: { controlModeling: 0.9 },
                minimumEvidenceCount: 0,
                requiredCompletedNodeIds: [],
                requiredOutcomeRefs: [],
                unlockMessage: '先补齐控制建模能力。',
                fallbackNodeIds: [],
              },
            },
          },
          {
            id: 'dependent-ready',
            label: '后续可执行资源',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/interactive-learning/resources/dependent-ready',
            knowledgeNodeIds: ['kn-goal'],
            prerequisiteNodeIds: ['registry:locked-prep'],
          },
        ],
      }),
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-goal': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 6 },
          },
        },
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0.2, confidence: 0.7, evidenceCount: 6 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.72,
            evidenceCount: 8,
            sourceCompleteness: 0.8,
          },
          sourceCoverage: {
            LearningFact: 'available',
          },
        },
      },
    }));

    expect(plan.currentNodeId).toBeNull();
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('locked-node-without-fallback');
    expect(plan.constraintRepair).toMatchObject({
      status: 'infeasible',
      infeasibleReasons: expect.arrayContaining([
        expect.objectContaining({
          code: 'locked-node-without-fallback',
          nodeIds: ['registry:locked-prep'],
        }),
      ]),
    });
  });

  it('keeps Arena locked for a zero-competency learner until preparation evidence is available', () => {
    const now = new Date('2026-05-28T00:00:00Z');
    const plan = planLearningPath(plannerInput({
      now,
      registry: withLegalSimulationDestinations(buildControlCorrectionResourceNodeRegistry()),
      goal: {
        id: 'control-correction',
        title: '控制校正',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['controlModeling', 'parameterDesign'],
      },
      learnerState: {
        primaryPortrait: createPlannerPortrait(now, Object.fromEntries(
          PORTRAIT_V2_DIMENSION_IDS.map((id) => [id, { score: 10, totalCount: 1 }]),
        ) as Partial<Record<PortraitV2DimensionId, { score: number; totalCount: number }>>),
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.1, confidence: 0.4, evidenceCount: 1 },
            'control-correction:root-locus-design': { posteriorMastery: 0.1, confidence: 0.4, evidenceCount: 1 },
            'control-correction:simulation-validation': { posteriorMastery: 0, confidence: 0.2, evidenceCount: 0 },
            'control-correction:arena-transfer': { posteriorMastery: 0, confidence: 0.2, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0, confidence: 0.2, evidenceCount: 0 },
            parameterDesign: { score: 0, confidence: 0.2, evidenceCount: 0 },
          },
        },
        evidence: {
          confidence: {
            level: 'low',
            score: 0.2,
            evidenceCount: 1,
            sourceCompleteness: 0.2,
          },
          sourceCoverage: {
            LearningFact: 'partial',
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        completedNodeIds: [],
        availableOutcomeRefs: [],
      },
      policyBundle: {
        families: ['simulation-driven'],
      },
    }));

    const arenaNode = plan.mainPath.find((node) => node.nodeId === 'arena-task:task-second-order-lead-pid');
    const simulationNode = plan.mainPath.find((node) => node.nodeId === 'simulation:control-correction-step-response-lab');

    expect(plan.currentNodeId).not.toBe('arena-task:task-second-order-lead-pid');
    expect(plan.currentNodeId).not.toBe('simulation:control-correction-step-response-lab');
    expect(simulationNode).toMatchObject({
      status: 'locked',
      readiness: expect.objectContaining({
        state: 'locked',
        unlockMessage: expect.stringContaining('仿真验证'),
      }),
    });
    expect(arenaNode).toMatchObject({
      status: 'locked',
      readiness: expect.objectContaining({
        state: 'locked',
        unlockMessage: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
      }),
    });
    expect(plan.policyBundle?.paths[0]).toMatchObject({
      activeNodeIds: expect.not.arrayContaining(['arena-task:task-second-order-lead-pid']),
      lockedNodeIds: expect.arrayContaining([
        'simulation:control-correction-step-response-lab',
        'arena-task:task-second-order-lead-pid',
      ]),
      readinessSummary: expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'arena-task:task-second-order-lead-pid',
          message: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
        }),
      ]),
      unlockMessages: expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'arena-task:task-second-order-lead-pid',
          message: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
        }),
      ]),
    });
  });

  it('unlocks dependent readiness nodes after their preparation node is completed', () => {
    const now = new Date('2026-05-28T00:00:00Z');
    const plan = planLearningPath(plannerInput({
      now,
      registry: withLegalSimulationDestinations(buildControlCorrectionResourceNodeRegistry()),
      goal: {
        id: 'control-correction',
        title: '控制校正',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
        ],
        competencyTargets: ['controlModeling', 'parameterDesign'],
      },
      learnerState: {
        primaryPortrait: createPlannerPortrait(now, Object.fromEntries(
          PORTRAIT_V2_DIMENSION_IDS.map((id) => [id, { score: 60, totalCount: 4 }]),
        ) as Partial<Record<PortraitV2DimensionId, { score: number; totalCount: number }>>),
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.4, confidence: 0.8, evidenceCount: 4 },
            'control-correction:root-locus-design': { posteriorMastery: 0.4, confidence: 0.8, evidenceCount: 4 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 3 },
          },
        },
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0.6, confidence: 0.8, evidenceCount: 4 },
            parameterDesign: { score: 0.6, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'high',
            score: 0.85,
            evidenceCount: 4,
            sourceCompleteness: 0.85,
          },
          sourceCoverage: {
            LearningFact: 'available',
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 70,
        privacyScopes: ['student-visible'],
        completedNodeIds: [],
      },
    }));
    const simulationNode = plan.mainPath.find((node) => node.nodeId === 'simulation:control-correction-step-response-lab');
    expect(plan.currentNodeId).toBe('registry:lesson09-correction-precheck');
    expect(simulationNode?.status).toBe('locked');

    const updated = recordLearningPathFeedback(plan, {
      id: 'complete-precheck',
      type: 'completion',
      nodeId: 'registry:lesson09-correction-precheck',
      createdAt: '2026-06-16T10:00:00Z',
    });

    expect(updated.mainPath.find((node) => node.nodeId === 'simulation:control-correction-step-response-lab'))
      .toMatchObject({
        status: expect.not.stringMatching('locked'),
        readiness: expect.objectContaining({ state: 'ready' }),
      });
  });

  it('keeps high-load nodes without readiness metadata as locked future milestones', () => {
    const plan = planLearningPath(plannerInput({
      registry: buildResourceNodeRegistry({
        simulations: [
          {
            id: 'legacy-simulation',
            title: '旧式仿真实验',
            launchTarget: '/simulations/legacy',
            knowledgeNodeIds: ['kn-goal'],
            planningOverride: {
              cognitiveLoad: 'high',
              evidenceInstrumentation: ['simulation_run'],
            },
          },
        ],
      }),
      constraints: {
        timeBudgetMinutes: 40,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.currentNodeId).toBeNull();
    expect(plan.mainPath[0]).toMatchObject({
      nodeId: 'simulation:legacy-simulation',
      status: 'locked',
      readiness: expect.objectContaining({
        state: 'locked',
        reasonCodes: ['readiness-metadata-missing'],
      }),
    });
  });

  it('reranks only feasible local alternatives after deterministic path generation', () => {
    const basePlan = planLearningPath(plannerInput());
    const plan = {
      ...basePlan,
      alternatives: [
        {
          nodeId: 'simulation:alt-sim-a',
          nodeIds: ['simulation:alt-sim-a'],
          title: '替代仿真 A',
          reasonCodes: ['matches-knowledge-deficit'],
          score: 0.4,
          blocked: false,
        },
        {
          nodeId: 'simulation:alt-sim-b',
          nodeIds: ['simulation:alt-sim-b'],
          title: '替代仿真 B',
          reasonCodes: ['matches-knowledge-deficit'],
          score: 0.3,
          blocked: false,
        },
        ...basePlan.alternatives.filter((alternative) => alternative.blocked),
      ],
    };
    const result = rerankAdaptivePathAlternativesWithBandit({
      plan,
      enabled: true,
      learnerContext: { confidenceScore: 0.9 },
      feedbackHistory: [
        { nodeId: 'simulation:alt-sim-b', impressions: 10, positiveOutcomes: 8, negativeOutcomes: 2 },
        { nodeId: 'simulation:alt-sim-a', impressions: 10, positiveOutcomes: 1, negativeOutcomes: 9 },
      ],
    });

    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(basePlan.mainPath.map((node) => node.nodeId));
    expect(result.applied).toBe(true);
    expect(result.alternatives[0]).toMatchObject({
      nodeId: 'simulation:alt-sim-b',
      blocked: false,
      reasonCodes: expect.arrayContaining(['contextual-bandit-local-rerank']),
    });
    expect(result.rejected).toContainEqual(
      expect.objectContaining({ reason: 'blocked-alternative' }),
    );
    expect(result.alternatives.find((item) => item.blocked)?.reasonCodes).toContain('privacy-scope-blocked');
  });

  it('falls back to deterministic alternatives when no feasible path exists', () => {
    const plan = planLearningPath(plannerInput({
      constraints: {
        timeBudgetMinutes: 1,
        privacyScopes: ['student-visible'],
      },
    }));
    const result = rerankAdaptivePathAlternativesWithBandit({
      plan,
      enabled: true,
    });

    expect(plan.status).toBe('fallback');
    expect(result).toMatchObject({
      applied: false,
      reason: 'feasible-path-required',
      alternatives: plan.alternatives,
    });
  });

  it('does not mutate scores or reason codes when only one local alternative is rerankable', () => {
    const basePlan = planLearningPath(plannerInput());
    const onlyAlternative = {
      nodeId: 'simulation:alt-sim-a',
      nodeIds: ['simulation:alt-sim-a'],
      title: '替代仿真 A',
      reasonCodes: ['matches-knowledge-deficit'],
      score: 0.4,
      blocked: false,
    };
    const plan = {
      ...basePlan,
      alternatives: [
        onlyAlternative,
        ...basePlan.alternatives.filter((alternative) => alternative.blocked),
      ],
    };
    const result = rerankAdaptivePathAlternativesWithBandit({
      plan,
      enabled: true,
      learnerContext: { confidenceScore: 0.9 },
      feedbackHistory: [
        { nodeId: 'simulation:alt-sim-a', impressions: 10, positiveOutcomes: 10, negativeOutcomes: 0 },
      ],
    });

    expect(result).toMatchObject({
      applied: false,
      reason: 'insufficient-local-alternatives',
    });
    expect(result.alternatives[0]).toEqual(onlyAlternative);
  });

  it('assigns stratified explainable variants and records exclusion reasons', () => {
    const assignment = assignAdaptiveOptimizationExperiment({
      experimentId: 'exp-stage-2',
      studentId: 'student-1',
      classId: 'class-1',
      cohortId: 'cohort-a',
      initialAbilityScore: 0.63,
      eligible: true,
      assignedAt: new Date('2026-05-28T01:00:00Z'),
    });
    const excluded = assignAdaptiveOptimizationExperiment({
      experimentId: 'exp-stage-2',
      studentId: 'student-2',
      classId: 'class-1',
      initialAbilityScore: null,
      eligible: false,
      exclusionReason: 'missing-consent',
      assignedAt: new Date('2026-05-28T01:00:00Z'),
    });

    expect(assignment.initialAbilityStratum).toBe('medium');
    expect(assignment.variant).toMatch(/current-recommendation-cards|rules-graph-path|rules-graph-bandit|rules-graph-bandit-konling/);
    expect(assignment.assignmentKey).toContain('class-1:cohort-a:medium:student-1');
    expect(excluded).toMatchObject({
      eligible: false,
      variant: null,
      initialAbilityStratum: 'unknown',
      exclusionReason: 'missing-consent',
    });
  });

  it('summarizes privacy-safe metrics without raw payload leakage', () => {
    const summary = summarizeAdaptiveOptimizationMetrics([
      {
        metric: 'path-adoption',
        variant: 'rules-graph-path',
        value: true,
        completeness: 1,
        confidence: 0.9,
        evidenceWindowHours: 48,
        rawAnswerBody: 'do not export',
        privateDialogueText: 'private',
      },
      {
        metric: 'path-adoption',
        variant: 'rules-graph-path',
        value: false,
        completeness: 0.7,
        confidence: 0.6,
        evidenceWindowHours: 48,
        hiddenArenaEvaluationInternals: { rubric: 'private' },
        rawTrace: [{ x: 1 }],
      },
    ]);
    const exported = sanitizeAdaptiveOptimizationExport(summary);

    expect(summary).toEqual([
      expect.objectContaining({
        metric: 'path-adoption',
        variant: 'rules-graph-path',
        classId: null,
        cohortId: null,
        sampleCount: 2,
        value: 0.5,
        confidence: 'low',
        completeness: 'complete',
        evidenceWindowHours: 48,
      }),
    ]);
    expect(JSON.stringify(exported)).not.toContain('do not export');
    expect(JSON.stringify(exported)).not.toContain('private');
    expect(JSON.stringify(exported)).not.toContain('rawTrace');
  });

  it('keeps class and cohort aggregates separated by their requested privacy scope', () => {
    const classSummary = summarizeAdaptiveOptimizationMetrics([
      {
        metric: 'path-adoption',
        variant: 'rules-graph-path',
        classId: 'class-a',
        cohortId: 'cohort-1',
        value: true,
        completeness: 1,
        confidence: 0.9,
      },
      {
        metric: 'path-adoption',
        variant: 'rules-graph-path',
        classId: 'class-b',
        cohortId: 'cohort-1',
        value: false,
        completeness: 1,
        confidence: 0.9,
      },
    ], { aggregationLevel: 'class-aggregate' });
    const cohortSummary = summarizeAdaptiveOptimizationMetrics([
      {
        metric: 'path-adoption',
        variant: 'rules-graph-path',
        classId: 'class-a',
        cohortId: 'cohort-1',
        value: true,
        completeness: 1,
        confidence: 0.9,
      },
      {
        metric: 'path-adoption',
        variant: 'rules-graph-path',
        classId: 'class-a',
        cohortId: 'cohort-2',
        value: false,
        completeness: 1,
        confidence: 0.9,
      },
    ], { aggregationLevel: 'cohort-aggregate' });

    expect(classSummary).toEqual([
      expect.objectContaining({ classId: 'class-a', cohortId: null, sampleCount: 1, value: 1 }),
      expect.objectContaining({ classId: 'class-b', cohortId: null, sampleCount: 1, value: 0 }),
    ]);
    expect(cohortSummary).toEqual([
      expect.objectContaining({ classId: null, cohortId: 'cohort-1', sampleCount: 1, value: 1 }),
      expect.objectContaining({ classId: null, cohortId: 'cohort-2', sampleCount: 1, value: 0 }),
    ]);
  });

  it('attributes path feedback to optimization metrics', () => {
    const plan = planLearningPath(plannerInput());
    const updated = recordLearningPathFeedback(recordLearningPathFeedback(plan, {
      id: 'adopt',
      type: 'adoption',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-28T02:00:00Z',
    }), {
      id: 'click',
      type: 'explanation-click',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-28T02:01:00Z',
    });

    expect(summarizePathFeedbackMetrics(updated).map((event) => event.metric)).toEqual([
      'path-adoption',
      'explanation-click',
    ]);
  });

  it('gates long-term semantic and strategy memory behind audit, outcomes, metrics, and rollback flag', () => {
    expect(evaluateLongTermKonlingMemoryGate({
      semanticMemoryRequested: true,
      strategyMemoryRequested: true,
      privacyAuditCovered: false,
      stage1OutcomesStable: true,
      persistedInterventionOutcomeCount: 3,
      evaluationMetricsAvailable: true,
      featureFlagEnabled: true,
    })).toMatchObject({
      enabled: false,
      semanticMemoryEnabled: false,
      strategyMemoryEnabled: false,
      reasons: ['privacy-audit-missing'],
    });

    expect(evaluateLongTermKonlingMemoryGate({
      semanticMemoryRequested: true,
      strategyMemoryRequested: true,
      privacyAuditCovered: true,
      stage1OutcomesStable: true,
      persistedInterventionOutcomeCount: 3,
      evaluationMetricsAvailable: true,
      featureFlagEnabled: true,
    })).toMatchObject({
      enabled: true,
      semanticMemoryEnabled: true,
      strategyMemoryEnabled: true,
      rollbackFeatureFlag: 'KONLING_LONG_TERM_MEMORY_ENABLED',
      reasons: [],
    });
  });
});
