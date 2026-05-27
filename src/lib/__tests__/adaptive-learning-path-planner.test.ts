import { describe, expect, it } from 'vitest';

import {
  buildAdaptiveLearningPathPlan,
  recordLearningPathFeedback,
  serializeLearningPathPlan,
  type AdaptiveLearningPathPlannerInput,
} from '../adaptive-learning-path-planner';
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

describe('adaptive learning path planner', () => {
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
    expect(record.payload.currentNodeId).toBe(withFeedback.currentNodeId);
    expect(record.payload.score).toEqual(withFeedback.score);
    expect(record.payload.confidence).toEqual(withFeedback.confidence);
    expect(record.payload.planNodes).toEqual(withFeedback.mainPath);
    expect(record.payload.alternatives).toEqual(withFeedback.alternatives);
    expect(record.payload.explanations).toEqual(withFeedback.explanations);
    expect(record.payload.executionStatus).toEqual(withFeedback.executionStatus);
    expect(record.payload.feedbackEvents).toEqual(withFeedback.feedbackEvents);
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
