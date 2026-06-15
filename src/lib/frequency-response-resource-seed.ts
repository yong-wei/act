import {
  buildResourceNodeRegistry,
  type ResourceNodeRegistry,
  type ResourceNodeRegistryInput,
} from './resource-node-registry';

export function buildFrequencyResponseFoundationsResourceNodeRegistry(): ResourceNodeRegistry {
  return buildResourceNodeRegistry(buildFrequencyResponseFoundationsResourceSeedInput());
}

export function buildFrequencyResponseFoundationsResourceSeedInput(): ResourceNodeRegistryInput {
  return {
    registeredResources: [
      {
        id: 'frequency-precheck',
        label: '频率响应课前诊断',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/assessment/adaptive-practice?goal=frequency-response-foundations&intent=diagnostic',
        knowledgeNodeIds: ['kn-bode'],
      },
      {
        id: 'bode-post-quiz',
        label: '伯德图后测',
        type: 'ADAPTIVE_QUIZ',
        renderTarget: '/assessment/adaptive-practice?goal=frequency-response-foundations&intent=practice',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['registry:frequency-precheck'],
      },
    ],
    knowledgeNodes: [
      { id: 'kn-bode', name: '伯德图' },
    ],
    runtimeLessons: [
      {
        lessonId: 'unit-2-3-frequency-response-bode-intro',
        title: '频率响应与伯德图入门',
        steps: [
          {
            id: 'step-01',
            title: '频域入口',
            knowledgeNodeIds: ['kn-bode'],
            renderTarget: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-01',
          },
        ],
        handoutPath: 'course-content/runtime/lessons/2-3/2-3-handout.md',
      },
    ],
    reflectionPrompts: [
      {
        id: 'bode-reflection',
        title: '伯德图理解反思',
        renderTarget: '/profile/growth?goal=frequency-response-foundations&prompt=bode-reflection',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['registry:frequency-precheck'],
      },
    ],
    checkpoints: [
      {
        id: 'bode-foundation-checkpoint',
        title: '频率响应基础检查点',
        assessmentPurpose: '确认学生能解释伯德图基本读图信息。',
        criteria: ['识别幅频曲线变化', '解释相频曲线含义'],
        requiredEvidenceRefs: ['adaptive_quiz.completed'],
        remediationBehavior: 'retry-prerequisite-node',
        reviewState: 'pending',
        launchTarget: '/assessment/adaptive-practice?goal=frequency-response-foundations&intent=practice',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['registry:bode-post-quiz'],
      },
    ],
  };
}
