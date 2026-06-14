import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
  buildAdaptiveLearningPathPlan,
  buildControlCorrectionThreeStylePathBundle,
  recordLearningPathFeedback,
  serializeLearningPathPlan,
  type AdaptiveLearningPathPlannerInput,
} from '../adaptive-learning-path-planner';
import { buildControlCorrectionResourceNodeRegistry } from '../control-correction-resource-seed';
import { buildResourceNodeRegistry } from '../resource-node-registry';

function plannerInput(overrides: Partial<AdaptiveLearningPathPlannerInput> = {}): AdaptiveLearningPathPlannerInput {
  const registry = buildResourceNodeRegistry({
    registeredResources: [
      {
        id: 'bode-card',
        label: '伯德图知识卡',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
      },
      {
        id: 'bode-sim',
        label: '伯德图仿真',
        type: 'SIMULATION_APP',
        launchTarget: '/simulations/bode',
        knowledgeNodeIds: ['kn-bode'],
      },
      {
        id: 'hidden-admin',
        label: '管理员资源',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/admin/data-governance',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    simulations: [
      {
        id: 'cruise',
        title: '邮轮舒适度仿真',
        launchTarget: '/simulations/cruise',
        knowledgeNodeIds: ['kn-cruise'],
      },
    ],
    arenaTasks: [
      {
        id: 'roll-control',
        title: '横摇控制 Arena',
        launchTarget: '/arena/challenges/roll-control',
        knowledgeNodeIds: ['kn-cruise'],
        prerequisiteNodeIds: ['simulation:cruise'],
        official: true,
      },
    ],
    reflectionPrompts: [
      {
        id: 'reflection-bode',
        title: '伯德图反思',
        renderTarget: '/profile/growth?prompt=reflection-bode',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['registry:bode-card'],
      },
    ],
  });

  const adminNode = registry.nodes.find((node) => node.id === 'registry:hidden-admin');
  if (adminNode) {
    adminNode.planningMetadata.privacyLevel = 'admin-scoped';
    adminNode.eligibility = {
      pathEligible: true,
      reasons: [],
      auditIssues: [],
    };
  }

  return {
    studentId: 'student-1',
    goal: {
      id: 'goal-bode',
      title: '补齐伯德图与横摇控制',
      knowledgeTargets: ['kn-bode', 'kn-cruise'],
      competencyTargets: ['parameterDesign'],
    },
    learnerState: {
      knowledgeMastery: {
        tags: {
          'kn-bode': { posteriorMastery: 0.32, confidence: 0.7, evidenceCount: 3 },
          'kn-cruise': { posteriorMastery: 0.2, confidence: 0.5, evidenceCount: 2 },
        },
      },
      primaryCompetencies: {
        vector: {
          parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 5 },
          engineeringDecision: { score: 0.62, confidence: 0.6, evidenceCount: 4 },
        },
      },
      resourcePreference: {
        preferredModalities: ['simulation', 'video'],
      },
      evidence: {
        confidence: {
          level: 'medium',
          score: 0.72,
          evidenceCount: 8,
          sourceCompleteness: 0.7,
        },
        sourceCoverage: {
          LearningFact: 'available',
          StudentCompetencySnapshot: 'available',
          StudentProfileSummary: 'partial',
        },
      },
      risks: {
        riskLevel: 'medium',
        activeFlags: [
          { type: 'participation', severity: 'medium' },
        ],
      },
    },
    registry,
    constraints: {
      timeBudgetMinutes: 90,
      privacyScopes: ['student-visible'],
      device: 'desktop',
      timelineWindowDays: 7,
      completedNodeIds: ['registry:bode-card'],
    },
    now: new Date('2026-05-27T08:00:00.000Z'),
    ...overrides,
  };
}

function policyFixtureInput(overrides: Partial<AdaptiveLearningPathPlannerInput> = {}): AdaptiveLearningPathPlannerInput {
  const registry = buildResourceNodeRegistry({
    registeredResources: [
      {
        id: 'concept',
        label: '基础概念卡',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/concept',
        knowledgeNodeIds: ['kn-a'],
        planningOverride: {
          estimatedTimeMinutes: 10,
        },
      },
      {
        id: 'quiz',
        label: '短程练习',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/quiz',
        knowledgeNodeIds: ['kn-b'],
        planningOverride: {
          estimatedTimeMinutes: 12,
          abilityImpact: { skill: 0.35 },
        },
      },
      {
        id: 'assigned',
        label: '教师指定任务',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/assigned',
        knowledgeNodeIds: ['kn-b'],
        planningOverride: {
          teacherPolicy: 'teacher-assigned',
          estimatedTimeMinutes: 20,
          abilityImpact: { skill: 0.3 },
        },
      },
    ],
    simulations: [
      {
        id: 'sim',
        title: '策略仿真',
        launchTarget: '/simulations/policy',
        knowledgeNodeIds: ['kn-b'],
        planningOverride: {
          estimatedTimeMinutes: 25,
          abilityImpact: { skill: 0.3 },
        },
      },
    ],
    arenaTasks: [
      {
        id: 'arena',
        title: '策略 Arena',
        launchTarget: '/arena/challenges/policy',
        knowledgeNodeIds: ['kn-c'],
        prerequisiteNodeIds: ['simulation:sim'],
        official: true,
        planningOverride: {
          estimatedTimeMinutes: 30,
          abilityImpact: { skill: 0.4 },
        },
      },
    ],
    reflectionPrompts: [
      {
        id: 'reflect',
        title: '策略反思',
        renderTarget: '/profile/growth?prompt=policy',
        knowledgeNodeIds: ['kn-c'],
        prerequisiteNodeIds: ['simulation:sim'],
      },
    ],
  });

  return {
    studentId: 'student-policy',
    goal: {
      id: 'goal-policy',
      title: '策略路径目标',
      knowledgeTargets: ['kn-a', 'kn-b', 'kn-c'],
      competencyTargets: ['skill'],
    },
    learnerState: {
      knowledgeMastery: {
        tags: {
          'kn-a': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 2 },
          'kn-b': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 2 },
          'kn-c': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 2 },
        },
      },
      primaryCompetencies: {
        vector: {
          skill: { score: 0.3, confidence: 0.7, evidenceCount: 3 },
        },
      },
      evidence: {
        confidence: {
          level: 'high',
          score: 0.8,
          evidenceCount: 8,
          sourceCompleteness: 0.8,
        },
      },
    },
    registry,
    constraints: {
      timeBudgetMinutes: 90,
      privacyScopes: ['student-visible'],
      teacherAssignedNodeIds: ['registry:assigned'],
    },
    now: new Date('2026-05-27T08:00:00.000Z'),
    ...overrides,
  };
}

describe('adaptive learning path planner', () => {
  it('uses explicit policy families to produce different path emphasis', () => {
    const base = plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
    });

    const foundation = buildAdaptiveLearningPathPlan(plannerInput({
      ...base,
      policyFamily: 'foundation-remediation',
    }));
    const simulation = buildAdaptiveLearningPathPlan(plannerInput({
      ...base,
      policyFamily: 'simulation-driven',
    }));
    const sprint = buildAdaptiveLearningPathPlan(plannerInput({
      ...base,
      policyFamily: 'sprint-correction',
      constraints: {
        ...base.constraints,
        timeBudgetMinutes: 50,
      },
    }));

    expect(foundation.policyFamily).toBe('foundation-remediation');
    expect(foundation.policyMetadata.scoringIntent).toContain('prerequisite');
    expect(foundation.explanations.selectedReasons).toContain('policy-foundation-remediation');
    expect(foundation.mainPath.map((node) => node.nodeId)).toContain('registry:bode-card');

    expect(simulation.policyFamily).toBe('simulation-driven');
    expect(simulation.explanations.selectedReasons).toContain('policy-simulation-driven');
    expect(simulation.mainPath.map((node) => node.type)).toEqual(
      expect.arrayContaining(['simulation', 'arena_task']),
    );

    expect(sprint.policyFamily).toBe('sprint-correction');
    expect(sprint.explanations.selectedReasons).toContain('policy-sprint-correction');
    expect(sprint.policyMetadata.constraints).toContain('time-budget-first');
  });

  it('prioritizes teacher-assigned resources only when teacher policy allows them', () => {
    const input = plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        teacherAssignedNodeIds: [
          'registry:bode-card',
          'registry:bode-sim',
          'simulation:cruise',
          'arena-task:roll-control',
        ],
      },
      policyFamily: 'teacher-assigned',
    });
    for (const node of input.registry.nodes) {
      if (input.constraints.teacherAssignedNodeIds?.includes(node.id)) {
        node.planningMetadata.teacherPolicy = 'teacher-assigned';
      }
    }

    const plan = buildAdaptiveLearningPathPlan(input);

    expect(plan.status).toBe('ready');
    expect(plan.policyFamily).toBe('teacher-assigned');
    expect(plan.explanations.selectedReasons).toContain('policy-teacher-assigned');
    expect(plan.mainPath.find((node) => node.nodeId === 'registry:bode-card')?.teacherPolicy)
      .toBe('teacher-assigned');
  });

  it('blocks teacher-assigned resources that are not explicitly assigned', () => {
    const input = plannerInput({
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'assigned-card',
            label: '教师指定基础卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/teacher/resources/assigned-card',
            knowledgeNodeIds: ['kn-bode', 'kn-cruise'],
            planningOverride: {
              teacherPolicy: 'teacher-assigned',
            },
          },
        ],
      }),
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      policyFamily: 'teacher-assigned',
    });

    const plan = buildAdaptiveLearningPathPlan(input);

    expect(plan.status).toBe('fallback');
    expect(plan.explanations.fallbackReasons).toContain('teacher-assignment-resource-missing');
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('registry:assigned-card');
    expect(plan.explanations.rejectedAlternatives).toContainEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['teacher-assignment-required'],
      }),
    );
  });

  it('does not pull unassigned prerequisites into teacher-assigned paths', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'base-card',
            label: '未指定先修卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/teacher/resources/base-card',
            knowledgeNodeIds: ['kn-bode'],
          },
          {
            id: 'assigned-sim',
            label: '教师指定仿真',
            type: 'SIMULATION_APP',
            launchTarget: '/simulations/assigned',
            knowledgeNodeIds: ['kn-bode', 'kn-cruise'],
            prerequisiteNodeIds: ['registry:base-card'],
            planningOverride: {
              teacherPolicy: 'teacher-assigned',
            },
          },
        ],
      }),
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        teacherAssignedNodeIds: ['registry:assigned-sim'],
      },
      policyFamily: 'teacher-assigned',
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('registry:base-card');
    expect(plan.explanations.fallbackReasons).toContain('teacher-assignment-resource-missing');
  });

  it('reports policy bundle diversity metrics for displayed path families', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      policyBundle: {
        families: ['foundation-remediation', 'simulation-driven', 'sprint-correction'],
        overlapThreshold: 0.9,
      },
    }));

    expect(plan.policyBundle?.families).toEqual([
      'rules-plus-graph-search',
      'foundation-remediation',
      'simulation-driven',
      'sprint-correction',
    ]);
    expect(plan.policyBundle?.paths).toHaveLength(4);
    expect(plan.policyBundle?.paths.map((path) => [path.policyFamily, path.styleId])).toEqual([
      ['rules-plus-graph-search', 'rules-graph-search-route'],
      ['foundation-remediation', 'foundation-remediation'],
      ['simulation-driven', 'arena-simulation-sprint'],
      ['sprint-correction', 'sprint-correction-route'],
    ]);
    expect(plan.policyBundle?.diversity.maxResourceOverlap).toBeGreaterThanOrEqual(0);
    expect(plan.policyBundle?.diversity.modalityMixByPolicy['simulation-driven'].simulation).toBeGreaterThan(0);
    expect(plan.policyBundle?.diversity.estimatedEffortByPolicy['foundation-remediation']).toBeGreaterThan(0);
    expect(plan.policyBundle?.diversity.terminalValidationDifference).toBeGreaterThanOrEqual(0);
    expect(plan.policyBundle?.diversity.minModalityDistance).toBeGreaterThanOrEqual(0);
    expect(plan.policyBundle?.diversity.minEstimatedEffortDifference).toBeGreaterThanOrEqual(0);
    expect(plan.policyBundle?.diversity.pairwiseResourceOverlap).toHaveLength(6);
    expect(plan.policyBundle?.diversity.pairwiseResourceOverlap[0]).toEqual(
      expect.objectContaining({
        left: 'rules-plus-graph-search',
        right: 'foundation-remediation',
      }),
    );
    expect(plan.policyBundle?.diversity.pairwiseModalityDistance).toHaveLength(6);
    expect(plan.policyBundle?.diversity.pairwiseEstimatedEffortDifference).toHaveLength(6);
    expect(plan.policyBundle?.diversity.pairwiseTerminalValidationDifference).toHaveLength(6);
  });

  it('compares bundle policies against an explicit primary policy family', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      policyFamily: 'foundation-remediation',
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      policyBundle: {
        families: ['sprint-correction'],
        overlapThreshold: 0.9,
      },
    }));

    expect(plan.policyBundle?.families).toEqual(['foundation-remediation', 'sprint-correction']);
    expect(plan.policyBundle?.paths.map((path) => path.policyFamily)).toEqual([
      'foundation-remediation',
      'sprint-correction',
    ]);
    expect(plan.policyBundle?.diversity.pairwiseResourceOverlap).toEqual([
      expect.objectContaining({
        left: 'foundation-remediation',
        right: 'sprint-correction',
      }),
    ]);
  });

  it('returns an explicit low-resource fallback when policy paths cannot be distinct', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'single-card',
            label: '单一知识卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/teacher/resources/single-card',
            knowledgeNodeIds: ['kn-bode', 'kn-cruise'],
          },
        ],
      }),
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      policyBundle: {
        families: ['foundation-remediation', 'simulation-driven', 'sprint-correction'],
        overlapThreshold: 0.25,
      },
    }));

    expect(plan.policyBundle?.status).toBe('low-resource-fallback');
    expect(plan.policyBundle?.fallbackReasons).toContain('path-diversity-insufficient');
    expect(plan.policyBundle?.diversity.terminalValidationDifference).toBe(0);
    expect(plan.policyBundle?.fallbackReasons).not.toContain('terminal-validation-diversity-insufficient');
    expect(plan.policyBundle?.fallbackReasons).toContain('path-modality-diversity-insufficient');
    expect(plan.policyBundle?.fallbackReasons).toContain('path-effort-diversity-insufficient');
  });

  it('builds a control-correction three-style bundle with explainable option contracts', () => {
    const controlRegistry = buildControlCorrectionResourceNodeRegistry();
    const externalRegistry = buildResourceNodeRegistry({
      externalResources: [{
        id: 'control-ocw',
        title: '外部校正资料',
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/correction',
        estimatedTimeMinutes: 12,
        knowledgeNodeIds: ['control-correction:root-locus-design'],
        applicableGoalId: 'control-correction',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      }],
    });
    const input = plannerInput({
      registry: {
        ...controlRegistry,
        nodes: [...controlRegistry.nodes, ...externalRegistry.nodes],
      },
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        resourcePreference: {
          preferredModalities: ['external_resource', 'video', 'ai_intervention', 'simulation'],
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 100,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
    });

    const bundle = buildControlCorrectionThreeStylePathBundle(input);

    expect(bundle.status).toBe('ready');
    expect(bundle.paths.map((path) => path.styleId)).toEqual([
      'foundation-remediation',
      'arena-simulation-sprint',
      'preference-matched-route',
    ]);
    expect(bundle.paths).toEqual(expect.arrayContaining([
      expect.objectContaining({
        styleId: 'foundation-remediation',
        policyFamily: 'foundation-remediation',
        targetDeficits: expect.arrayContaining([
          expect.objectContaining({ targetId: 'control-correction:time-domain-targets' }),
        ]),
        evidenceBasis: expect.arrayContaining(['adaptive-learner-state', 'LearningFact']),
        resourceMix: expect.any(Object),
        terminalValidationStrategy: expect.objectContaining({
          nodeIds: expect.arrayContaining(['arena-task:task-second-order-lead-pid']),
        }),
      }),
      expect.objectContaining({
        styleId: 'preference-matched-route',
        policyFamily: 'preference-matched',
        effort: expect.objectContaining({ estimatedMinutes: expect.any(Number) }),
        limitations: expect.any(Array),
      }),
    ]));
    expect(bundle.diversity.pairwiseResourceOverlap.length).toBe(3);
    expect(JSON.stringify(bundle.paths)).not.toContain('external-resource:control-ocw');
  });

  it('does not expose ineligible support nodes in control-correction path options', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const restrictedRegistry = {
      ...registry,
      nodes: registry.nodes.map((node) => node.id === 'knowledge-card:control-correction-time-domain-targets'
        ? {
            ...node,
            planningMetadata: {
              ...node.planningMetadata,
              privacyLevel: 'teacher-scoped' as const,
            },
          }
        : node),
    };
    const bundle = buildControlCorrectionThreeStylePathBundle(plannerInput({
      registry: restrictedRegistry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        resourcePreference: {
          preferredModalities: ['video', 'ai_intervention', 'simulation'],
        },
        evidence: {
          confidence: { level: 'medium', score: 0.68, evidenceCount: 8, sourceCompleteness: 0.7 },
          sourceCoverage: { LearningFact: 'available' },
        },
      },
      constraints: {
        timeBudgetMinutes: 100,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
    }));

    expect(bundle.paths.flatMap((path) => path.nodeIds)).not.toContain(
      'knowledge-card:control-correction-time-domain-targets',
    );
  });

  it('generates a feasible 90-minute control-correction path from audited seed nodes', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry: buildControlCorrectionResourceNodeRegistry({ includeInvalidFixture: true }),
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    const mainIds = plan.mainPath.map((node) => node.nodeId);
    const estimatedTime = plan.mainPath.reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
    expect(plan.status).toBe('ready');
    expect(estimatedTime).toBeLessThanOrEqual(90);
    expect(mainIds).toContain('simulation:control-correction-step-response-lab');
    expect(mainIds.at(-1)).toBe('arena-task:task-second-order-lead-pid');
    expect(plan.mainPath.at(-1)?.terminalConstraints).toContain('terminal-validation');
    expect(mainIds).not.toContain('registry:control-correction-invalid-quiz');
  });

  it('falls back when a control-correction path lacks terminal validation evidence', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'control-correction-all-targets-no-terminal-validation',
          label: '控制校正全目标练习',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/control-correction-all-targets-no-terminal-validation',
          knowledgeNodeIds: [
            'control-correction:time-domain-targets',
            'control-correction:root-locus-design',
            'control-correction:simulation-validation',
            'control-correction:arena-transfer',
          ],
          planningOverride: {
            estimatedTimeMinutes: 35,
            evidenceInstrumentation: ['answer_submit'],
            abilityImpact: {
              parameterDesign: 0.4,
              engineeringDecision: 0.35,
              crossDomainTransfer: 0.25,
            },
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('terminal-validation-resource-missing');
  });

  it('does not accept non-validation resource types as control-correction terminal validation', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'control-correction-quiz-with-terminal-label',
          label: '误标终端验证的控制校正测验',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/lesson09-correction-precheck',
          knowledgeNodeIds: [
            'control-correction:time-domain-targets',
            'control-correction:root-locus-design',
            'control-correction:simulation-validation',
            'control-correction:arena-transfer',
          ],
          planningOverride: {
            estimatedTimeMinutes: 35,
            terminalConstraints: ['terminal-validation'],
            evidenceInstrumentation: ['answer_submit'],
            abilityImpact: {
              parameterDesign: 0.4,
              engineeringDecision: 0.35,
              crossDomainTransfer: 0.25,
            },
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('terminal-validation-resource-missing');
  });

  it('requires control-correction terminal validation to be the path endpoint', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'control-correction-mid-path-validation',
          title: '控制校正中途验证仿真',
          launchTarget: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
          knowledgeNodeIds: [
            'control-correction:time-domain-targets',
            'control-correction:root-locus-design',
            'control-correction:simulation-validation',
          ],
          planningOverride: {
            estimatedTimeMinutes: 20,
            terminalConstraints: ['terminal-validation'],
            evidenceInstrumentation: ['simulation_run'],
            abilityImpact: {
              parameterDesign: 0.4,
              engineeringDecision: 0.3,
            },
          },
        },
      ],
      registeredResources: [
        {
          id: 'control-correction-transfer-quiz-after-validation',
          label: '验证后补齐迁移目标的测验',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/lesson09-correction-precheck',
          knowledgeNodeIds: ['control-correction:arena-transfer'],
          prerequisiteNodeIds: ['simulation:control-correction-mid-path-validation'],
          planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['answer_submit'],
            abilityImpact: {
              crossDomainTransfer: 0.25,
            },
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('terminal-validation-resource-missing');
  });

  it('generates a constrained explainable Stage 1 path without bandit or RL', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());

    expect(plan.stage).toBe('stage-1-rules-graph');
    expect(plan.policyFamily).toBe('rules-plus-graph-search');
    expect(plan.excludedPolicyFamilies).toEqual(['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid']);
    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toContain('simulation:cruise');
    expect(plan.mainPath.map((node) => node.nodeId)).toContain('arena-task:roll-control');
    expect(plan.mainPath.find((node) => node.nodeId === 'arena-task:roll-control')?.prerequisiteNodeIds)
      .toEqual(['simulation:cruise']);
    expect(plan.score.objectives.learningGain).toBeGreaterThan(0);
    expect(plan.explanations.selectedReasons.length).toBeGreaterThan(0);
    expect(plan.explanations.rejectedAlternatives.some((item) => item.reasonCodes.includes('privacy-scope-blocked'))).toBe(true);
    expect(plan.mainPath.find((node) => node.nodeId === 'registry:bode-card')?.status).toBe('completed');
    expect(plan.mainPath.find((node) => node.nodeId === plan.currentNodeId)?.status).toBe('current');
  });

  it.each([
    'foundation-remediation',
    'simulation-driven',
    'sprint-correction',
    'teacher-assigned',
  ] as const)('preserves privacy and teacher constraints for policy family %s', (policyFamily) => {
    const registry = buildResourceNodeRegistry({
      aiInterventions: [
        {
          id: 'teacher-only-policy',
          title: '教师专用策略资源',
          renderTarget: '/ai/teacher-only-policy',
          knowledgeNodeIds: ['kn-policy-private'],
          teacherOnly: true,
        },
      ],
      registeredResources: [
        {
          id: 'assigned-private',
          label: '受限教师指定资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/admin/data-governance',
          knowledgeNodeIds: ['kn-policy-private'],
          planningOverride: {
            teacherPolicy: 'teacher-assigned',
            privacyLevel: 'admin-scoped',
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(policyFixtureInput({
      registry,
      goal: {
        id: 'goal-policy-privacy',
        title: '策略隐私约束',
        knowledgeTargets: ['kn-policy-private'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
        teacherAssignedNodeIds: ['registry:assigned-private'],
      },
      policyFamily,
    }));

    expect(plan.status).toBe('fallback');
    expect(JSON.stringify(plan)).not.toContain('teacher-only-policy');
    expect(JSON.stringify(plan)).not.toContain('受限教师指定资源');
    expect(plan.visualization.map.blockedNodes.length).toBeGreaterThan(0);
  });

  it('keeps blocked resources out of graph edges while exposing map, timeline, and evidence payloads', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
    const mainIds = plan.mainPath.map((node) => node.nodeId);

    expect(plan.visualization.map.mainPathNodeIds).toEqual(mainIds);
    expect(plan.visualization.map.completedNodeIds).toEqual(['registry:bode-card']);
    expect(plan.visualization.map.riskNodeIds).toContain(plan.currentNodeId);
    expect(plan.visualization.map.blockedNodes).toContainEqual(
      expect.objectContaining({
        nodeId: 'restricted:1',
        title: '受限资源',
        reasonCodes: ['privacy-scope-blocked'],
      }),
    );
    expect(JSON.stringify(plan.visualization)).not.toContain('registry:hidden-admin');
    expect(JSON.stringify(plan.visualization)).not.toContain('管理员资源');
    expect(plan.visualization.timeline.windows.map((window) => window.days)).toEqual([3, 7, 14]);
    expect(plan.visualization.timeline.windows[1].nodeIds).toEqual(mainIds.slice(0, 7));
    expect(plan.visualization.evidence.learnerStateDeficits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetId: 'kn-bode' }),
        expect.objectContaining({ targetId: 'kn-cruise' }),
      ]),
    );
    expect(plan.visualization.evidence.sourceCoverage.StudentCompetencySnapshot).toBe('available');
  });

  it('does not persist completed node ids for blocked or unknown resources', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        completedNodeIds: ['registry:hidden-admin'],
      },
    }));

    expect(plan.executionStatus.completedNodeIds).not.toContain('registry:hidden-admin');
    expect(plan.visualization.map.completedNodeIds).not.toContain('registry:hidden-admin');
    expect(JSON.stringify(serializeLearningPathPlan(plan))).not.toContain('registry:hidden-admin');

    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-hidden-completion',
      type: 'completion',
      nodeId: 'registry:hidden-admin',
      createdAt: '2026-05-27T10:00:00.000Z',
    });

    expect(updated.executionStatus.completedNodeIds).not.toContain('registry:hidden-admin');
    expect(updated.feedbackEvents.at(-1)?.nodeId).toBeNull();
    expect(JSON.stringify(serializeLearningPathPlan(updated))).not.toContain('registry:hidden-admin');
  });

  it('returns a fallback plan when learner evidence or resource mappings are insufficient', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeNodes: [
        { id: 'kn-bode', name: '伯德图' },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 20,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.confidence.level).toBe('low');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toEqual(
      expect.arrayContaining(['learner-state-missing', 'resource-mapping-insufficient']),
    );
  });

  it('returns executable starter options with checkpoints for cold-start registered goals', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
      now: new Date('2026-06-14T08:00:00.000Z'),
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.confidence.level).toBe('low');
    expect(plan.mainPath.length).toBeGreaterThan(0);
    expect(plan.currentNodeId).toBe(plan.mainPath[0]?.nodeId);
    expect(plan.explanations.fallbackReasons).toContain('learner-state-missing');
    const executableOptions = plan.policyBundle?.paths.filter((path) => path.nodeIds.length > 0) ?? [];
    expect(executableOptions.length).toBeGreaterThanOrEqual(2);
    expect(executableOptions.every((path) => path.checkpointNodeIds.length > 0)).toBe(true);
    expect(executableOptions.every((path) => path.estimatedMinutes <= 45)).toBe(true);
    expect(executableOptions.every((path) =>
      path.nodeSummaries.length === path.nodeIds.length &&
      path.nodeSummaries.every((node) => node.pathNodeType && node.iconKey && node.shapeHint && node.evidenceBehavior)
    )).toBe(true);
    expect(JSON.stringify(plan.mainPath)).not.toContain('learner-state-missing');
    expect(JSON.stringify(plan.mainPath)).not.toContain('learner-evidence-low-confidence');
  });

  it('keeps external resources out of paths unless external resources are explicitly allowed', () => {
    const registry = buildResourceNodeRegistry({
      externalResources: [{
        id: 'ocw-bode',
        title: '外部伯德图资料',
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/bode',
        estimatedTimeMinutes: 15,
        knowledgeNodeIds: ['kn-bode'],
        applicableGoalId: 'frequency-response-foundations',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      }],
      checkpoints: [{
        id: 'bode-after-external',
        title: '外部资料后检查点',
        assessmentPurpose: '确认学生能解释外部资料中的伯德图概念',
        criteria: ['解释幅频曲线斜率'],
        requiredEvidenceRefs: ['external_resource.accessed'],
        remediationBehavior: 'retry-prerequisite-node',
        reviewState: 'pending',
        launchTarget: '/assessment/checkpoints/bode-after-external',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['external-resource:ocw-bode'],
      }],
    });
    const baseInput = plannerInput({
      registry,
      goal: {
        id: 'frequency-response-foundations',
        title: '频率响应基础',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.1, confidence: 0.8, evidenceCount: 3 },
          },
        },
        evidence: {
          confidence: {
            level: 'high',
            score: 0.8,
            evidenceCount: 6,
            sourceCompleteness: 0.8,
          },
        },
      },
    });

    const blocked = buildAdaptiveLearningPathPlan(baseInput);
    const allowed = buildAdaptiveLearningPathPlan({
      ...baseInput,
      allowExternalResources: true,
    });

    expect(blocked.mainPath.map((node) => node.nodeId)).not.toContain('external-resource:ocw-bode');
    expect(blocked.mainPath.map((node) => node.nodeId)).not.toContain('checkpoint:bode-after-external');
    expect(allowed.mainPath.map((node) => node.nodeId)).toEqual(
      expect.arrayContaining(['external-resource:ocw-bode', 'checkpoint:bode-after-external']),
    );
  });

  it('keeps low-confidence usable path nodes while recording confidence internally', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      learnerState: {
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
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath.length).toBeGreaterThan(0);
    expect(plan.currentNodeId).not.toBeNull();
    expect(plan.visualization.evidence.evidenceBasis).toBe('adaptive-learner-state');
    expect(plan.explanations.fallbackReasons).toContain('learner-evidence-low-confidence');
  });

  it('captures deviations and generates correction path records without losing evidence chain', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-1',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T09:00:00.000Z',
      context: {
        action: 'skip',
        reason: 'too-hard',
      },
    });

    expect(updated.feedbackEvents).toHaveLength(1);
    expect(updated.deviations).toEqual([
      expect.objectContaining({
        nodeId: plan.currentNodeId,
        correctionPathId: `${plan.id}:correction:1`,
      }),
    ]);
    expect(updated.corrections[0]).toMatchObject({
      priorEvidencePlanId: plan.id,
      reasonCodes: ['student-deviation', 'preserve-evidence-chain'],
    });
  });

  it('advances active node, statuses, and map payload after completion feedback', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
    const completedNodeId = plan.currentNodeId;
    expect(completedNodeId).not.toBeNull();

    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-completion-1',
      type: 'completion',
      nodeId: completedNodeId,
      createdAt: '2026-05-27T09:15:00.000Z',
    });

    expect(updated.executionStatus.completedNodeIds).toContain(completedNodeId);
    expect(updated.executionStatus.activeNodeId).toBe(updated.currentNodeId);
    expect(updated.currentNodeId).not.toBe(completedNodeId);
    expect(updated.mainPath.find((node) => node.nodeId === completedNodeId)?.status).toBe('completed');
    if (updated.currentNodeId) {
      expect(updated.mainPath.find((node) => node.nodeId === updated.currentNodeId)?.status).toBe('current');
    }
    expect(updated.visualization.map.currentNodeId).toBe(updated.currentNodeId);
    expect(updated.visualization.map.completedNodeIds).toContain(completedNodeId);
    const record = serializeLearningPathPlan(updated);
    expect(record.payload.visualization.timeline.windows[2].estimatedMinutes).toBe(record.estimatedTime);
  });

  it('serializes a persistence payload for plan nodes, alternatives, explanations, status, and feedback', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
    const withFeedback = recordLearningPathFeedback(plan, {
      id: 'feedback-2',
      type: 'helpfulness',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T09:30:00.000Z',
      helpful: true,
    });

    const record = serializeLearningPathPlan(withFeedback);

    expect(record.userId).toBe('student-1');
    expect(record.nodeIds).toEqual(withFeedback.mainPath.map((node) => node.nodeId));
    expect(record.payload.status).toBe(withFeedback.status);
    expect(record.payload.policyFamily).toBe(withFeedback.policyFamily);
    expect(record.payload.policyMetadata).toEqual(withFeedback.policyMetadata);
    expect(record.payload.policyBundle).toEqual(withFeedback.policyBundle);
    expect(record.payload.currentNodeId).toBe(withFeedback.currentNodeId);
    expect(record.payload.score).toEqual(withFeedback.score);
    expect(record.payload.confidence).toEqual(withFeedback.confidence);
    expect(record.payload.planNodes).toEqual(withFeedback.mainPath);
    expect(record.payload.alternatives).toEqual(withFeedback.alternatives);
    expect(record.payload.explanations).toEqual(withFeedback.explanations);
    expect(record.payload.executionStatus).toEqual(withFeedback.executionStatus);
    expect(record.payload.feedbackEvents).toEqual(withFeedback.feedbackEvents);
  });

  it('keeps internal fallback and policy strings out of student-facing serialized text', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
    }));

    const record = serializeLearningPathPlan(plan);
    const studentFacing = JSON.stringify({
      description: record.description,
      studentFacing: record.payload.studentFacing,
    });

    expect(studentFacing).toContain('先从入门路径开始');
    expect(studentFacing).not.toContain('learner-state-missing');
    expect(studentFacing).not.toContain('learner-evidence-low-confidence');
    expect(studentFacing).not.toContain('resource-mapping-insufficient');
    expect(studentFacing).not.toContain('stage-1-rules-graph');
    expect(studentFacing).not.toContain('rules-plus-graph-search');
  });

  it('does not add blocked prerequisite nodes to the main path', () => {
    const registry = buildResourceNodeRegistry({
      aiInterventions: [
        {
          id: 'private-hint',
          title: '教师私有提示',
          renderTarget: '/ai/private-hint',
          knowledgeNodeIds: ['kn-pre'],
          teacherOnly: true,
        },
      ],
      projects: [
        {
          id: 'public-project',
          title: '公开项目',
          launchTarget: '/missions?project=public',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['ai_intervention:private-hint'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-private-prereq',
        title: '测试私有前置',
        knowledgeTargets: ['kn-goal'],
      },
      constraints: {
        timeBudgetMinutes: 85,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('feasible-goal-path-missing');
    expect(plan.alternatives.find((item) => item.nodeId === 'project:public-project')).toEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['infeasible-prerequisite-chain'],
      }),
    );
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-private-prereq-deviation',
      type: 'deviation',
      nodeId: null,
      createdAt: '2026-05-27T10:30:00.000Z',
    });
    expect(updated.corrections[0].nodeIds).not.toContain('project:public-project');
    expect(JSON.stringify(plan)).not.toContain('private-hint');
    expect(JSON.stringify(plan)).not.toContain('教师私有提示');
  });

  it('blocks teacher-only resources even when teacher-scoped resources are allowed', () => {
    const registry = buildResourceNodeRegistry({
      aiInterventions: [
        {
          id: 'teacher-only-hint',
          title: '教师专用提示',
          renderTarget: '/ai/teacher-only-hint',
          knowledgeNodeIds: ['kn-teacher-only'],
          teacherOnly: true,
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-teacher-only',
        title: '测试教师专用资源',
        knowledgeTargets: ['kn-teacher-only'],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible', 'teacher-scoped'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.visualization.map.blockedNodes).toContainEqual(
      expect.objectContaining({
        nodeId: 'restricted:1',
        title: '受限资源',
        reasonCodes: expect.arrayContaining(['teacher-policy-teacher-only']),
      }),
    );
    expect(JSON.stringify(plan)).not.toContain('teacher-only-hint');
    expect(JSON.stringify(plan)).not.toContain('教师专用提示');
  });

  it('falls back when the budget cannot include the prerequisite chain and target node', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'pre',
          title: '前置仿真',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'goal',
          title: '目标项目',
          launchTarget: '/missions?project=goal',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-budget',
        title: '预算不足目标',
        knowledgeTargets: ['kn-goal'],
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('time-budget-insufficient');
    expect(plan.alternatives.find((item) => item.nodeId === 'project:goal')).toEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['time-budget-insufficient'],
      }),
    );
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-budget-deviation',
      type: 'deviation',
      nodeId: null,
      createdAt: '2026-05-27T10:45:00.000Z',
    });
    expect(updated.corrections[0].nodeIds).not.toContain('project:goal');
  });

  it('uses completed prerequisites outside the main path when evaluating alternatives', () => {
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
          id: 'pre',
          title: '替代路径前置',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'alt',
          title: '替代项目',
          launchTarget: '/missions?project=alt',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-alternative-completed-prereq',
        title: '替代路径已完成前置',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
        completedNodeIds: ['simulation:pre'],
      },
    }));

    const alternative = plan.alternatives.find((item) => item.nodeId === 'project:alt');
    expect(alternative).toEqual(
      expect.objectContaining({
        blocked: false,
        nodeIds: ['project:alt'],
      }),
    );
  });

  it('includes the feasible alternative prerequisite chain in correction paths', () => {
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
          id: 'pre',
          title: '替代路径前置',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'alt',
          title: '替代项目',
          launchTarget: '/missions?project=alt',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-alternative-chain',
        title: '替代路径链',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 85,
        privacyScopes: ['student-visible'],
      },
    }));
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-alternative-chain',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T11:00:00.000Z',
    });

    expect(plan.alternatives.find((item) => item.nodeId === 'project:alt')).toEqual(
      expect.objectContaining({
        blocked: false,
        nodeIds: ['simulation:pre', 'project:alt'],
      }),
    );
    expect(updated.corrections[0].nodeIds).toEqual(
      expect.arrayContaining(['simulation:pre', 'project:alt']),
    );
  });

  it('preserves feedback node ids for visible alternative prerequisite chains', () => {
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
          id: 'pre',
          title: '替代路径前置',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'alt',
          title: '替代项目',
          launchTarget: '/missions?project=alt',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-alternative-feedback',
        title: '替代路径反馈',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 85,
        privacyScopes: ['student-visible'],
      },
    }));
    expect(plan.alternatives.find((item) => item.nodeId === 'project:alt')?.nodeIds)
      .toEqual(['simulation:pre', 'project:alt']);

    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-alternative-prereq',
      type: 'helpfulness',
      nodeId: 'simulation:pre',
      createdAt: '2026-05-27T11:05:00.000Z',
      helpful: true,
    });

    expect(updated.feedbackEvents.at(-1)?.nodeId).toBe('simulation:pre');
  });

  it('keeps correction as one executable alternative path instead of merging alternatives', () => {
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
          id: 'pre-a',
          title: '替代路径前置 A',
          launchTarget: '/simulations/pre-a',
          knowledgeNodeIds: ['kn-pre-a'],
        },
        {
          id: 'pre-b',
          title: '替代路径前置 B',
          launchTarget: '/simulations/pre-b',
          knowledgeNodeIds: ['kn-pre-b'],
        },
      ],
      projects: [
        {
          id: 'alt-a',
          title: '替代项目 A',
          launchTarget: '/missions?project=alt-a',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre-a'],
        },
        {
          id: 'alt-b',
          title: '替代项目 B',
          launchTarget: '/missions?project=alt-b',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre-b'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-two-alternatives',
        title: '两个替代路径',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 85,
        privacyScopes: ['student-visible'],
      },
    }));
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-two-alternatives',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T11:10:00.000Z',
    });

    const executableAlternatives = plan.alternatives.filter((item) => !item.blocked);
    expect(executableAlternatives.length).toBeGreaterThanOrEqual(2);
    expect(updated.corrections[0].nodeIds).toEqual(executableAlternatives[0].nodeIds);
    expect(updated.corrections[0].nodeIds).not.toEqual(
      expect.arrayContaining(executableAlternatives[1].nodeIds),
    );
  });

  it('falls back instead of chaining multiple terminal project nodes in the main path', () => {
    const registry = buildResourceNodeRegistry({
      projects: [
        {
          id: 'terminal-a',
          title: '终端项目 A',
          launchTarget: '/missions?project=a',
          knowledgeNodeIds: ['kn-a'],
        },
        {
          id: 'terminal-b',
          title: '终端项目 B',
          launchTarget: '/missions?project=b',
          knowledgeNodeIds: ['kn-b'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-two-terminals',
        title: '两个终端目标',
        knowledgeTargets: ['kn-a', 'kn-b'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 180,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath.filter((node) => node.terminalConstraints.includes('terminal-node'))).toHaveLength(0);
    expect(plan.explanations.fallbackReasons).toContain('resource-mapping-insufficient');
  });

  it('blocks alternatives whose prerequisite chain contains terminal nodes before the target', () => {
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
      projects: [
        {
          id: 'pre-project',
          title: '前置终端项目',
          launchTarget: '/missions?project=pre',
          knowledgeNodeIds: ['kn-pre'],
        },
        {
          id: 'alt-project',
          title: '替代终端项目',
          launchTarget: '/missions?project=alt',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['project:pre-project'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-terminal-prereq',
        title: '终端前置替代路径',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 180,
        privacyScopes: ['student-visible'],
      },
    }));
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-terminal-prereq',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T11:20:00.000Z',
    });

    expect(plan.alternatives.find((item) => item.nodeId === 'project:alt-project')).toEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['terminal-constraint-blocked'],
      }),
    );
    expect(updated.corrections[0].nodeIds).not.toContain('project:pre-project');
    expect(updated.corrections[0].nodeIds).not.toContain('project:alt-project');
  });

  it('falls back when prerequisite chains contain cycles', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'a',
          title: '循环仿真 A',
          launchTarget: '/simulations/a',
          knowledgeNodeIds: ['kn-a'],
          prerequisiteNodeIds: ['simulation:b'],
        },
        {
          id: 'b',
          title: '循环仿真 B',
          launchTarget: '/simulations/b',
          knowledgeNodeIds: ['kn-b'],
          prerequisiteNodeIds: ['simulation:a'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-cycle',
        title: '循环前置目标',
        knowledgeTargets: ['kn-a'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 120,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('feasible-goal-path-missing');
  });

  it('blocks cyclic alternatives and keeps them out of correction paths', () => {
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
          id: 'a',
          title: '循环仿真 A',
          launchTarget: '/simulations/a',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:b'],
        },
        {
          id: 'b',
          title: '循环仿真 B',
          launchTarget: '/simulations/b',
          knowledgeNodeIds: ['kn-b'],
          prerequisiteNodeIds: ['simulation:a'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-cyclic-alternative',
        title: '循环替代路径',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 120,
        privacyScopes: ['student-visible'],
      },
    }));
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-cyclic-alternative',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T11:30:00.000Z',
    });

    expect(plan.alternatives.find((item) => item.nodeId === 'simulation:a')).toEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['infeasible-prerequisite-chain'],
      }),
    );
    expect(updated.corrections[0].nodeIds).not.toContain('simulation:a');
    expect(updated.corrections[0].nodeIds).not.toContain('simulation:b');
  });

  it('does not count completed prerequisites against the remaining time budget', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'pre',
          title: '前置仿真',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'goal',
          title: '目标项目',
          launchTarget: '/missions?project=goal',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-budget-after-completion',
        title: '已完成前置后的预算',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
        completedNodeIds: ['simulation:pre'],
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.find((node) => node.nodeId === 'simulation:pre')?.status).toBe('completed');
    expect(plan.mainPath.find((node) => node.nodeId === 'project:goal')?.status).toBe('current');
    expect(plan.score.objectives.constraintSatisfaction).toBe(1);
    expect(serializeLearningPathPlan(plan).estimatedTime).toBe(60);
    expect(plan.visualization.timeline.windows[2].estimatedMinutes).toBe(60);
  });

  it('falls back when only part of a multi-target goal has resource coverage', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'public-card',
          label: '公开知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/public-card',
          knowledgeNodeIds: ['kn-public'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-partial-coverage',
        title: '部分覆盖目标',
        knowledgeTargets: ['kn-public', 'kn-missing'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
        completedNodeIds: ['registry:public-card'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.executionStatus.completedNodeIds).toEqual([]);
    expect(plan.visualization.map.completedNodeIds).toEqual([]);
    expect(plan.alternatives.find((item) => item.nodeId === 'registry:public-card')).toBeUndefined();
    expect(plan.visualization.map.branchPaths).not.toContainEqual(
      expect.objectContaining({ nodeIds: [] }),
    );
    expect(plan.explanations.fallbackReasons).toContain('resource-mapping-insufficient');
    const record = serializeLearningPathPlan(plan);
    expect(record.payload.status).toBe('fallback');
    expect(record.payload.currentNodeId).toBeNull();
    expect(record.payload.visualization.evidence.evidenceBasis).toBe('fallback');
  });

  it('skips repeated target coverage so a feasible multi-target path can fit the budget', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'alpha-card-a',
          label: '目标 A 知识卡 A',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/alpha-a',
          knowledgeNodeIds: ['kn-alpha'],
        },
        {
          id: 'alpha-card-b',
          label: '目标 A 知识卡 B',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/alpha-b',
          knowledgeNodeIds: ['kn-alpha'],
        },
        {
          id: 'beta-card',
          label: '目标 B 知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/beta',
          knowledgeNodeIds: ['kn-beta'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-budgeted-multi-target',
        title: '预算刚好覆盖两个目标',
        knowledgeTargets: ['kn-alpha', 'kn-beta'],
        competencyTargets: [],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-alpha': { posteriorMastery: 0.1, confidence: 0.8, evidenceCount: 4 },
            'kn-beta': { posteriorMastery: 0.4, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'registry:alpha-card-a',
      'registry:beta-card',
    ]);
    expect(plan.mainPath.map((node) => node.knowledgeCoverage)).toEqual([
      ['kn-alpha'],
      ['kn-beta'],
    ]);
  });

  it('skips a high-scoring chain that would block another required target', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'alpha-sim',
          label: '目标 A 高成本仿真',
          type: 'SIMULATION_APP',
          launchTarget: '/simulations/alpha',
          knowledgeNodeIds: ['kn-alpha', 'kn-extra'],
        },
        {
          id: 'alpha-card',
          label: '目标 A 知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/alpha',
          knowledgeNodeIds: ['kn-alpha'],
        },
        {
          id: 'beta-card',
          label: '目标 B 知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/beta',
          knowledgeNodeIds: ['kn-beta'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-lookahead-budget',
        title: '前瞻预算覆盖两个目标',
        knowledgeTargets: ['kn-alpha', 'kn-beta'],
        competencyTargets: [],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-alpha': { posteriorMastery: 0.1, confidence: 0.8, evidenceCount: 4 },
            'kn-beta': { posteriorMastery: 0.4, confidence: 0.8, evidenceCount: 4 },
          },
        },
        resourcePreference: {
          preferredModalities: ['simulation'],
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'registry:alpha-card',
      'registry:beta-card',
    ]);
    expect(plan.mainPath).not.toContainEqual(
      expect.objectContaining({ nodeId: 'registry:alpha-sim' }),
    );
  });

  it('includes required risk intervention in the feasibility lookahead', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'all-targets-sim',
          label: '全目标高分仿真',
          type: 'SIMULATION_APP',
          launchTarget: '/simulations/all-targets',
          knowledgeNodeIds: ['kn-alpha', 'kn-beta'],
        },
        {
          id: 'beta-card',
          label: '目标 B 知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/beta',
          knowledgeNodeIds: ['kn-beta'],
        },
      ],
      reflectionPrompts: [
        {
          id: 'alpha-risk-reflection',
          title: '目标 A 风险反思',
          renderTarget: '/profile/growth?prompt=alpha-risk-reflection',
          knowledgeNodeIds: ['kn-alpha'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-risk-lookahead',
        title: '风险干预前瞻路径',
        knowledgeTargets: ['kn-alpha', 'kn-beta'],
        competencyTargets: [],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-alpha': { posteriorMastery: 0.1, confidence: 0.8, evidenceCount: 4 },
            'kn-beta': { posteriorMastery: 0.4, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 27,
        privacyScopes: ['student-visible'],
        requireRiskIntervention: true,
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'reflection_prompt:alpha-risk-reflection',
      'registry:beta-card',
    ]);
    expect(plan.mainPath).not.toContainEqual(
      expect.objectContaining({ nodeId: 'registry:all-targets-sim' }),
    );
    expect(plan.explanations.fallbackReasons).not.toContain('risk-intervention-resource-missing');
  });

  it('admits standalone risk interventions when risk support is required', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'goal-card',
          label: '目标知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/goal-card',
          knowledgeNodeIds: ['kn-goal'],
        },
      ],
      reflectionPrompts: [
        {
          id: 'participation-risk',
          title: '参与风险反思',
          renderTarget: '/profile/growth?prompt=participation-risk',
          knowledgeNodeIds: ['kn-risk-support'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-standalone-risk',
        title: '通用风险干预路径',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-goal': { posteriorMastery: 0.2, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 27,
        privacyScopes: ['student-visible'],
        requireRiskIntervention: true,
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(
      expect.arrayContaining(['registry:goal-card', 'reflection_prompt:participation-risk']),
    );
    expect(plan.explanations.fallbackReasons).not.toContain('risk-intervention-resource-missing');
  });

  it('only emits competency deficit reasons for requested competency targets', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: 'goal-knowledge-only',
        title: '只补知识点',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
    }));

    expect(plan.explanations.selectedReasons).not.toContain('matches-competency-deficit');
  });

  it('carries governed path semantics through generation, serialization, and feedback history', () => {
    const registry = buildResourceNodeRegistry({
      externalResources: [{
        id: 'ocw-bode',
        title: '外部伯德图资料',
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/bode',
        estimatedTimeMinutes: 15,
        knowledgeNodeIds: ['kn-bode'],
        applicableGoalId: 'goal-bode-external',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      }],
      checkpoints: [{
        id: 'bode-checkpoint',
        title: '伯德图阶段检查',
        assessmentPurpose: '确认学生能根据外部资料解释幅频特性',
        criteria: ['解释幅频曲线斜率', '说明穿越频率含义'],
        requiredEvidenceRefs: ['external_resource.accessed'],
        remediationBehavior: 'retry-prerequisite-node',
        reviewState: 'pending',
        launchTarget: '/assessment/adaptive-practice?checkpoint=bode',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['external-resource:ocw-bode'],
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-bode-external',
        title: '伯德图外部资料路径',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
      },
      allowExternalResources: true,
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.15, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'high',
            score: 0.8,
            evidenceCount: 6,
            sourceCompleteness: 0.8,
          },
        },
      },
    }));
    const afterCompletion = recordLearningPathFeedback(plan, {
      id: 'feedback-1',
      type: 'completion',
      nodeId: 'external-resource:ocw-bode',
      createdAt: '2026-06-14T09:00:00.000Z',
      context: {
        evidenceRefs: [{ kind: 'external_resource_access', id: 'access-1' }],
      },
    });
    const serialized = serializeLearningPathPlan(afterCompletion);

    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'external-resource:ocw-bode',
      'checkpoint:bode-checkpoint',
    ]);
    expect(plan.mainPath.map((node) => ({
      nodeId: node.nodeId,
      pathNodeType: node.pathNodeType,
      iconKey: node.iconKey,
      shapeHint: node.shapeHint,
      evidenceBehavior: node.evidenceBehavior,
    }))).toEqual([
      {
        nodeId: 'external-resource:ocw-bode',
        pathNodeType: 'external_resource',
        iconKey: 'external-link',
        shapeHint: 'link',
        evidenceBehavior: 'explicit_access',
      },
      {
        nodeId: 'checkpoint:bode-checkpoint',
        pathNodeType: 'checkpoint',
        iconKey: 'checkpoint',
        shapeHint: 'gate',
        evidenceBehavior: 'assessment_gate',
      },
    ]);
    expect(serialized.payload.planNodes.map((node) => [node.nodeId, node.pathNodeType, node.iconKey]))
      .toEqual([
        ['external-resource:ocw-bode', 'external_resource', 'external-link'],
        ['checkpoint:bode-checkpoint', 'checkpoint', 'checkpoint'],
      ]);
    expect(serialized.payload.feedbackEvents[0]).toMatchObject({
      type: 'completion',
      nodeId: 'external-resource:ocw-bode',
    });
  });

  it('keeps currentNodeId and node status aligned after completed prerequisites', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());

    expect(plan.currentNodeId).not.toBeNull();
    expect(plan.mainPath.find((node) => node.nodeId === 'registry:bode-card')?.status).toBe('completed');
    expect(plan.mainPath.find((node) => node.nodeId === plan.currentNodeId)?.status).toBe('current');
    expect(plan.mainPath.filter((node) => node.status === 'current')).toHaveLength(1);
  });

  it('clears the active node when all main path nodes are completed', () => {
    const initial = buildAdaptiveLearningPathPlan(plannerInput());
    const completedNodeIds = initial.mainPath.map((node) => node.nodeId);
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        completedNodeIds,
      },
    }));

    expect(plan.currentNodeId).toBeNull();
    expect(plan.executionStatus.activeNodeId).toBeNull();
    expect(plan.mainPath.every((node) => node.status === 'completed')).toBe(true);
  });
});
