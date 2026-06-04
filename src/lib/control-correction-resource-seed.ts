import {
  buildResourceNodeRegistry,
  type ResourceNodeRegistry,
  type ResourceNodeRegistryInput,
} from './resource-node-registry';

export const CONTROL_CORRECTION_RESOURCE_GRAPH_VERSION = 'control-correction-resource-graph.v1';

export interface ControlCorrectionResourceSeedOptions {
  includeInvalidFixture?: boolean;
}

const CONTROL_CORRECTION_KNOWLEDGE = {
  timeTargets: 'control-correction:time-domain-targets',
  rootLocus: 'control-correction:root-locus-design',
  simulation: 'control-correction:simulation-validation',
  arena: 'control-correction:arena-transfer',
} as const;

const CONTROL_CORRECTION_ABILITY_IMPACT = {
  parameterDesign: 0.35,
  engineeringDecision: 0.25,
  crossDomainTransfer: 0.25,
};

export function buildControlCorrectionResourceNodeRegistry(
  options: ControlCorrectionResourceSeedOptions = {},
): ResourceNodeRegistry {
  return buildResourceNodeRegistry(buildControlCorrectionResourceSeedInput(options));
}

export function buildControlCorrectionResourceSeedInput(
  options: ControlCorrectionResourceSeedOptions = {},
): ResourceNodeRegistryInput {
  return {
    auditOptions: {
      strictEvidenceInstrumentation: true,
    },
    knowledgeCards: [
      {
        id: 'control-correction-time-domain-targets',
        title: '时域指标到目标极点区域知识卡',
        sourceRef: 'control-correction:time-domain-targets:card',
        renderTarget: 'course-content/runtime/knowledge/cards/nodes/时域指标到目标极点区域_3_36001.md',
        knowledgeNodeIds: [CONTROL_CORRECTION_KNOWLEDGE.timeTargets],
        planningOverride: {
          estimatedTimeMinutes: 8,
          cognitiveLoad: 'low',
          evidenceInstrumentation: ['knowledge_card_open'],
          abilityImpact: { controlModeling: 0.2 },
        },
      },
    ],
    runtimeLessons: [
      {
        lessonId: '3-6',
        title: '零点作用与动态改善实验',
        steps: [
          {
            id: 'step-07',
            title: '目标驱动 PD 校正',
            knowledgeNodeIds: [
              CONTROL_CORRECTION_KNOWLEDGE.timeTargets,
              CONTROL_CORRECTION_KNOWLEDGE.rootLocus,
            ],
          },
        ],
        handoutPath: 'course-content/runtime/lessons/3-6/3-6-handout.md',
        mediaResources: [
          {
            id: 'design-map-video',
            title: '控制校正设计地图视频',
            kind: 'video',
            url: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-07',
          },
        ],
      },
    ],
    registeredResources: [
      {
        id: 'lesson09-correction-precheck',
        label: '控制校正目标前测',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/lesson09-correction-precheck',
        knowledgeNodeIds: [
          CONTROL_CORRECTION_KNOWLEDGE.timeTargets,
          CONTROL_CORRECTION_KNOWLEDGE.rootLocus,
        ],
        planningOverride: {
          estimatedTimeMinutes: 10,
          evidenceInstrumentation: ['answer_submit', 'adaptive_assessment'],
          abilityImpact: { parameterDesign: 0.2 },
        },
      },
      ...(options.includeInvalidFixture ? [
        {
          id: 'control-correction-invalid-quiz',
          label: '控制校正无效夹具',
          type: 'INTERACTIVE_COMP',
          knowledgeNodeIds: [CONTROL_CORRECTION_KNOWLEDGE.timeTargets],
          planningOverride: {
            evidenceInstrumentation: [],
          },
        },
      ] : []),
    ],
    simulations: [
      {
        id: 'control-correction-step-response-lab',
        title: '控制校正阶跃响应验证实验',
        launchTarget: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
        knowledgeNodeIds: [
          CONTROL_CORRECTION_KNOWLEDGE.simulation,
          CONTROL_CORRECTION_KNOWLEDGE.rootLocus,
        ],
        prerequisiteNodeIds: ['registry:lesson09-correction-precheck'],
        planningOverride: {
          estimatedTimeMinutes: 20,
          cognitiveLoad: 'high',
          terminalConstraints: ['transfer-validation'],
          evidenceInstrumentation: ['simulation_run', 'simulation_trace_verified'],
          abilityImpact: CONTROL_CORRECTION_ABILITY_IMPACT,
        },
      },
    ],
    arenaTasks: [
      {
        id: 'task-second-order-lead-pid',
        title: '二阶对象超前校正 Arena',
        launchTarget: '/arena/challenges/task-second-order-lead-pid',
        knowledgeNodeIds: [
          CONTROL_CORRECTION_KNOWLEDGE.arena,
          CONTROL_CORRECTION_KNOWLEDGE.simulation,
        ],
        prerequisiteNodeIds: ['simulation:control-correction-step-response-lab'],
        official: true,
        planningOverride: {
          estimatedTimeMinutes: 18,
          cognitiveLoad: 'high',
          terminalConstraints: ['terminal-node', 'terminal-validation'],
          evidenceInstrumentation: ['arena_evaluation_complete', 'arena_submission_valid'],
          abilityImpact: CONTROL_CORRECTION_ABILITY_IMPACT,
        },
      },
    ],
    reflectionPrompts: [
      {
        id: 'control-correction-design-reflection',
        title: '控制校正设计反思',
        renderTarget: '/profile/growth?prompt=control-correction-design-reflection',
        knowledgeNodeIds: [CONTROL_CORRECTION_KNOWLEDGE.arena],
        prerequisiteNodeIds: ['arena-task:task-second-order-lead-pid'],
        planningOverride: {
          estimatedTimeMinutes: 8,
          evidenceInstrumentation: ['reflection_submit'],
          abilityImpact: { inquiryReflection: 0.25, selfDirectedLearning: 0.2 },
        },
      },
    ],
    aiInterventions: [
      {
        id: 'control-correction-path-coach',
        title: '控制校正路径伴学提示',
        renderTarget: '/ai/copilot?context=control-correction',
        knowledgeNodeIds: [
          CONTROL_CORRECTION_KNOWLEDGE.timeTargets,
          CONTROL_CORRECTION_KNOWLEDGE.rootLocus,
        ],
        planningOverride: {
          estimatedTimeMinutes: 6,
          evidenceInstrumentation: ['ai_intervention_complete', 'prompt_design'],
          abilityImpact: { selfDirectedLearning: 0.2 },
        },
      },
    ],
  };
}
