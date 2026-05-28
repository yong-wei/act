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
  buildAdaptiveLearningPathPlan,
  recordLearningPathFeedback,
  type AdaptiveLearningPathPlannerInput,
} from '../adaptive-learning-path-planner';
import { buildResourceNodeRegistry } from '../resource-node-registry';

function plannerInput(overrides: Partial<AdaptiveLearningPathPlannerInput> = {}): AdaptiveLearningPathPlannerInput {
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
    },
    registry,
    constraints: {
      timeBudgetMinutes: 80,
      privacyScopes: ['student-visible'],
    },
    now: new Date('2026-05-28T00:00:00Z'),
    ...overrides,
  };
}

describe('adaptive learning optimization experiments', () => {
  it('reranks only feasible local alternatives after deterministic path generation', () => {
    const basePlan = buildAdaptiveLearningPathPlan(plannerInput());
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
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
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
    const basePlan = buildAdaptiveLearningPathPlan(plannerInput());
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
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
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
