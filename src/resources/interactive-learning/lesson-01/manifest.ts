/**
 * Lesson-01 反馈：控制原理的核心思想 课程清单
 */

export const LESSON_01_METADATA = {
  id: 'lesson-01',
  title: '反馈：控制原理的核心思想',
  subtitle: 'Feedback Control Fundamentals',
  description: '从生活案例进入控制语言，理解反馈与闭环系统的价值。',
  vessel: {
    name: '启明号',
    type: 'training',
    length: 58.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'introductory',
  prerequisites: [],
  learningObjectives: [
    '了解控制系统的基本组成与信号流向',
    '理解反馈思想与误差信号的作用',
    '能用典型控制结构分析实际问题',
    '能将控制思想迁移到多学科场景',
  ],
  keywords: ['反馈控制', '闭环系统', '控制结构', '误差', '鲁棒性'],
};

export const LESSON_01_RESOURCES = {
  'feedback-bridge-intro': {
    type: 'interactive-widget',
    component: 'FeedbackBridgeIntro',
    path: '@/resources/interactive-learning/lesson-01/bridge-intro',
  },
  'feedback-objective-card': {
    type: 'interactive-widget',
    component: 'FeedbackObjectiveCard',
    path: '@/resources/interactive-learning/lesson-01/objective-card',
  },
  'feedback-precheck': {
    type: 'interactive-widget',
    component: 'FeedbackPrecheck',
    path: '@/resources/interactive-learning/lesson-01/feedback-precheck',
  },
  'feedback-knowledge-deck': {
    type: 'interactive-widget',
    component: 'FeedbackKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-01/feedback-knowledge-deck',
  },
  'feedback-component-role-match': {
    type: 'interactive-widget',
    component: 'ComponentRoleMatch',
    path: '@/resources/interactive-learning/lesson-01/component-role-match',
  },
  'feedback-loop-scenario-lab': {
    type: 'interactive-widget',
    component: 'LoopScenarioLab',
    path: '@/resources/interactive-learning/lesson-01/loop-scenario-lab',
  },
  'feedback-exit-quiz': {
    type: 'interactive-widget',
    component: 'FeedbackExitQuiz',
    path: '@/resources/interactive-learning/lesson-01/feedback-exit-quiz',
  },
  'feedback-summary-card': {
    type: 'interactive-widget',
    component: 'FeedbackSummaryCard',
    path: '@/resources/interactive-learning/lesson-01/summary-card',
  },
};

export const LESSON_01_CONFIG = {
  metadata: LESSON_01_METADATA,
  resources: LESSON_01_RESOURCES,
};

export default LESSON_01_CONFIG;
