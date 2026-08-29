import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  PLAN_LEARNING_PATH_STAGE_ORDER,
  evaluateHardEligibility,
  getRegisteredAdaptiveLearningPathGoal,
  isRegisteredAdaptiveLearningPathGoal,
  listLearningGoals,
  planLearningPath,
  createDefaultPlanLearningPathPorts,
} from '../public-api';
import { isRegisteredAdaptiveLearningPathGoal as isRegisteredGoalIdCatalogEntry } from '../registered-goal-ids';
import {
  CONTROL_CORRECTION_GOAL_ID,
  createControlCorrectionPersonalizationPlugin,
  createPersonalizationPluginRegistry,
  personalizationPluginRegistry,
} from '@/features/personalization/plugins/public-api';
import { buildResourceNodeRegistry } from '@/lib/resource-node-registry';

const GENERIC_PIPELINE_FILES = [
  'src/features/personalization/path-planning/application/plan-learning-path.ts',
  'src/features/personalization/path-planning/ports.ts',
  'src/features/personalization/path-planning/contracts.ts',
  'src/features/personalization/path-planning/public-api.ts',
];

const PRODUCTION_CALLERS = [
  'src/lib/konling-agent-runtime.ts',
  'src/lib/full-resource-path-readiness-gate.ts',
  'src/lib/canonical-learning-path-transition/replan.ts',
  'src/lib/adaptive-path-candidate-batches.ts',
  'src/app/api/learning-paths/plan/route.ts',
  'src/app/api/adaptive/path-advisor-tool/route.ts',
  'src/app/api/learning-paths/candidate-batches/latest/route.ts',
];

describe('PlanLearningPath pipeline', () => {
  it('exposes one application function and the seven-stage order', () => {
    expect(typeof planLearningPath).toBe('function');
    expect([...PLAN_LEARNING_PATH_STAGE_ORDER]).toEqual([
      'GoalContextLoader',
      'CandidateProvider',
      'EligibilityPolicy',
      'RankingStrategy',
      'ConstraintRepair',
      'PathAssembler',
      'ExplanationBuilder',
    ]);
  });

  it('keeps hard eligibility independent of teacher-only preference', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'visible-card',
          label: '可见知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/visible-card',
          knowledgeNodeIds: ['kn-bode'],
        },
      ],
      aiInterventions: [
        {
          id: 'teacher-only-hint',
          title: '教师专用提示',
          renderTarget: '/assessment/adaptive-practice',
          knowledgeNodeIds: ['kn-bode'],
          teacherOnly: true,
        },
      ],
    });
    const { eligible, blocked } = evaluateHardEligibility(registry.nodes, {
      timeBudgetMinutes: 45,
      privacyScopes: ['student-visible', 'teacher-scoped', 'class-shared', 'public'],
      device: 'desktop',
    });
    expect(eligible.some((node) => node.id.includes('visible-card'))).toBe(true);
    expect(eligible.some((node) => node.id.includes('teacher-only-hint'))).toBe(false);
    expect(blocked.some((item) => item.reasonCodes.includes('teacher-policy-teacher-only'))).toBe(true);
  });

  it('fails closed when the control-correction plugin is retired', () => {
    const registry = createPersonalizationPluginRegistry();
    registry.register(createControlCorrectionPersonalizationPlugin('retired'));
    expect(getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID, registry)).toBeNull();
    expect(getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID)).not.toBeNull();
    expect(getRegisteredAdaptiveLearningPathGoal(
      CONTROL_CORRECTION_GOAL_ID,
      createPersonalizationPluginRegistry(),
    )).toBeNull();

    const plugin = personalizationPluginRegistry.get(CONTROL_CORRECTION_GOAL_ID);
    expect(plugin).toBeTruthy();
    const previousStatus = plugin!.status;
    plugin!.status = 'retired';
    try {
      expect(isRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID)).toBe(false);
      expect(isRegisteredGoalIdCatalogEntry(CONTROL_CORRECTION_GOAL_ID)).toBe(false);
      expect(getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID)).toBeNull();
      const plan = planLearningPath({
        studentId: 'student-1',
        goal: {
          id: CONTROL_CORRECTION_GOAL_ID,
          title: '控制系统校正',
          knowledgeTargets: ['control-correction:time-domain-targets'],
        },
        learnerState: null,
        registry: buildResourceNodeRegistry({
          registeredResources: [
            {
              id: 'visible-card',
              label: '可见知识卡',
              type: 'INTERACTIVE_COMP',
              renderTarget: '/interactive-learning/resources/visible-card',
              knowledgeNodeIds: ['control-correction:time-domain-targets'],
            },
          ],
          aiInterventions: [],
        }),
        constraints: {
          timeBudgetMinutes: 45,
          privacyScopes: ['student-visible', 'teacher-scoped', 'class-shared', 'public'],
          device: 'desktop',
        },
      });
      expect(plan.mainPath).toEqual([]);
      expect(plan.status).toBe('fallback');
      expect(plan.explanations.fallbackReasons).toContain('course-plugin-unavailable');
    } finally {
      plugin!.status = previousStatus;
    }
  });

  it('keeps the assembled path within repaired node ids', () => {
    const input = {
      studentId: 'student-1',
      goal: {
        id: 'goal-bode',
        title: '补齐伯德图',
        knowledgeTargets: ['kn-bode'],
      },
      learnerState: null,
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'visible-card',
            label: '可见知识卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/interactive-learning/resources/visible-card',
            knowledgeNodeIds: ['kn-bode'],
          },
          {
            id: 'extra-card',
            label: '额外知识卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/interactive-learning/resources/extra-card',
            knowledgeNodeIds: ['kn-bode'],
          },
        ],
        aiInterventions: [],
      }),
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible', 'teacher-scoped', 'class-shared', 'public'],
        device: 'desktop',
      },
      policyFamily: 'foundation-remediation',
      policyBundle: {
        families: ['simulation-driven', 'preference-matched'],
        overlapThreshold: 0.6,
      },
    };
    const ports = createDefaultPlanLearningPathPorts();
    const originalRepair = ports.repair.repair.bind(ports.repair);
    ports.repair = {
      repair(context, ranked) {
        const repaired = originalRepair(context, ranked);
        return {
          ordered: repaired.ordered.filter((node) => node.id.includes('visible-card')),
        };
      },
    };
    const plan = planLearningPath(input, ports);
    const resourceNodeIds = plan.mainPath
      .map((node) => node.nodeId)
      .filter((nodeId) => input.registry.nodes.some((node) => node.id === nodeId));
    expect(resourceNodeIds.every((nodeId) => nodeId.includes('visible-card'))).toBe(true);
    expect(resourceNodeIds.some((nodeId) => nodeId.includes('extra-card'))).toBe(false);
    const bundleNodeIds = plan.policyBundle?.paths.flatMap((path) => path.nodeIds ?? []) ?? [];
    expect(bundleNodeIds.some((nodeId) => nodeId.includes('extra-card'))).toBe(false);
  });

  it('preserves ConstraintRepair order among assembled path nodes', () => {
    const input = {
      studentId: 'student-1',
      goal: {
        id: 'goal-bode',
        title: '补齐伯德图',
        knowledgeTargets: ['kn-bode'],
      },
      learnerState: null,
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'visible-card',
            label: '可见知识卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/interactive-learning/resources/visible-card',
            knowledgeNodeIds: ['kn-bode'],
          },
          {
            id: 'extra-card',
            label: '额外知识卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/interactive-learning/resources/extra-card',
            knowledgeNodeIds: ['kn-bode'],
          },
        ],
        aiInterventions: [],
      }),
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible', 'teacher-scoped', 'class-shared', 'public'],
        device: 'desktop',
      },
    };
    const ports = createDefaultPlanLearningPathPorts();
    const originalRepair = ports.repair.repair.bind(ports.repair);
    let repairedNodeIds: string[] = [];
    ports.repair = {
      repair(context, ranked) {
        const repaired = originalRepair(context, ranked);
        const ordered = [...repaired.ordered].reverse();
        repairedNodeIds = ordered.map((node) => node.id);
        return { ordered };
      },
    };
    const plan = planLearningPath(input, ports);
    const registryNodeIds = new Set(input.registry.nodes.map((node) => node.id));
    const resourceNodeIds = plan.mainPath
      .map((node) => node.nodeId)
      .filter((nodeId) => registryNodeIds.has(nodeId));
    expect(resourceNodeIds.length).toBeGreaterThan(1);
    expect(resourceNodeIds).toEqual(
      repairedNodeIds.filter((nodeId) => resourceNodeIds.includes(nodeId)),
    );
  });

  it('uses the active plugin path-planning policy instead of the static catalog', () => {
    const registry = createPersonalizationPluginRegistry();
    const plugin = createControlCorrectionPersonalizationPlugin();
    plugin.pathPlanningPolicy = {
      ...plugin.pathPlanningPolicy!,
      checkpointPolicy: {
        ...plugin.pathPlanningPolicy!.checkpointPolicy,
        minCheckpoints: 3,
        requiresTerminalValidation: false,
      },
    };
    registry.register(plugin);
    const registered = getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID, registry);
    expect(registered?.checkpointPolicy.minCheckpoints).toBe(3);
    expect(registered?.checkpointPolicy.requiresTerminalValidation).toBe(false);
    expect(getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID)?.checkpointPolicy.minCheckpoints).toBe(1);
  });

  it('applies plugin evidence requirements to the registered learning goal', () => {
    const registry = createPersonalizationPluginRegistry();
    const plugin = createControlCorrectionPersonalizationPlugin();
    plugin.pathPlanningPolicy = {
      ...plugin.pathPlanningPolicy!,
      evidenceRequirements: ['reflection'],
    };
    registry.register(plugin);
    expect(
      getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID, registry)
        ?.learningGoal?.evidencePolicy.requiredEvidenceTypes,
    ).toEqual(['reflection']);
    expect(
      getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID)
        ?.learningGoal?.evidencePolicy.requiredEvidenceTypes,
    ).toEqual([
      'question',
      'path-execution',
      'simulation-run',
      'arena-official-evaluation',
      'reflection',
    ]);
  });

  it('fails closed when an active plugin has no path-planning policy', () => {
    const registry = createPersonalizationPluginRegistry();
    const plugin = createControlCorrectionPersonalizationPlugin();
    delete plugin.pathPlanningPolicy;
    registry.register(plugin);
    expect(getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID, registry)).toBeNull();
    expect(getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID)).not.toBeNull();
  });

  it('omits unavailable plugin goals from the public goal list', () => {
    const plugin = personalizationPluginRegistry.get(CONTROL_CORRECTION_GOAL_ID);
    expect(plugin).toBeTruthy();
    const previousStatus = plugin!.status;
    const previousPolicy = plugin!.pathPlanningPolicy;
    try {
      plugin!.status = 'retired';
      expect(listLearningGoals().some((goal) => goal.id === CONTROL_CORRECTION_GOAL_ID)).toBe(false);
      plugin!.status = 'active';
      delete plugin!.pathPlanningPolicy;
      expect(listLearningGoals().some((goal) => goal.id === CONTROL_CORRECTION_GOAL_ID)).toBe(false);
    } finally {
      plugin!.status = previousStatus;
      plugin!.pathPlanningPolicy = previousPolicy;
    }
    expect(listLearningGoals().some((goal) => goal.id === CONTROL_CORRECTION_GOAL_ID)).toBe(true);
  });

  it('does not introduce RL or keep a src/lib planner import in the generic pipeline', () => {
    for (const file of GENERIC_PIPELINE_FILES) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/reinforc(?:e|ment)|q-learning|reward-model/i);
      expect(source, file).not.toContain('@/lib/adaptive-learning-path-planner');
    }
    const application = readFileSync('src/features/personalization/path-planning/application/plan-learning-path.ts', 'utf8');
    expect(application).toContain('evaluateHardEligibility');
    expect(application).toContain('ports.ranking.rank');
    expect(application).toContain('ports.repair.repair');
    expect(application).toContain('ports.assembler.assemble');
    expect(application).toContain('rankResourceLearnerCandidates');
    expect(application).toContain('checkpointRole');
    expect(application).toContain('allowedResourceMix');
    expect(readFileSync('src/features/personalization/path-planning/public-api.ts', 'utf8'))
      .not.toContain('assembleAdaptiveLearningPathPlan');
    expect(readFileSync('src/features/personalization/path-planning/public-api.ts', 'utf8'))
      .not.toContain('buildControlCorrectionThreeStylePathBundle');
    const assembler = readFileSync(
      'src/features/personalization/path-planning/internal/assemble-plan.ts',
      'utf8',
    );
    expect(assembler).not.toMatch(/rawAnswer|officialAnswer|assessmentRawPayload/);
    expect(assembler).toContain('function buildStudentFacingPathExplanation');
  });

  it('migrates production callers onto the Personalization public API', () => {
    for (const file of PRODUCTION_CALLERS) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('@/lib/adaptive-learning-path-planner');
      expect(source, file).not.toContain('@/lib/act-prerequisite-path-planner');
      expect(source, file).toContain('@/features/personalization/path-planning/public-api');
      expect(source, file).not.toContain('assembleAdaptiveLearningPathPlan');
    }
  });
});
