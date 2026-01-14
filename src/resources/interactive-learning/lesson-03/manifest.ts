/**
 * Lesson-03 微分方程与控制系统基础模型 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_03_METADATA = {
  id: 'lesson-03',
  title: '微分方程与控制系统基础模型',
  subtitle: 'Differential Equations & System Modeling',
  description: '从机理建模到黑箱辨识，掌握微分方程建模的流程与典型案例。',
  vessel: {
    name: '启航者号',
    type: 'training',
    length: 62.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'introductory',
  prerequisites: ['lesson-02'],
  learningObjectives: [
    '解释控制系统微分方程模型的意义与基本形式',
    '掌握微分方程建模的一般步骤与关键变量选择',
    '区分机理建模与黑箱建模的使用场景',
    '能读懂典型 RLC/机械/电机系统的建模链路',
  ],
  keywords: ['微分方程', '机理建模', '系统辨识', '数学模型', '线性化', '运动模态'],
};

export const LESSON_03_RESOURCES = {
  'widget-diff-precheck': {
    type: 'interactive-widget',
    component: 'DiffPrecheck',
    path: '@/resources/interactive-learning/lesson-03/diff-precheck',
  },
  'widget-diff-knowledge-deck': {
    type: 'interactive-widget',
    component: 'DiffKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-03/diff-knowledge-deck',
  },
  'widget-modeling-scenario-lab': {
    type: 'interactive-widget',
    component: 'ModelingScenarioLab',
    path: '@/resources/interactive-learning/lesson-03/modeling-scenario-lab',
  },
  'widget-modeling-workflow-puzzle': {
    type: 'interactive-widget',
    component: 'ModelingWorkflowPuzzle',
    path: '@/resources/interactive-learning/lesson-03/modeling-workflow-puzzle',
  },
  'widget-diff-exit-quiz': {
    type: 'interactive-widget',
    component: 'DiffExitQuiz',
    path: '@/resources/interactive-learning/lesson-03/diff-exit-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-03/summary-card',
  },
};

export const LESSON_03_CONFIG = {
  metadata: LESSON_03_METADATA,
  resources: LESSON_03_RESOURCES,
};

export default LESSON_03_CONFIG;
