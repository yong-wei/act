/**
 * Lesson-04 传递函数与控制系统数学模型 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_04_METADATA = {
  id: 'lesson-04',
  title: '传递函数与控制系统数学模型',
  subtitle: 'Transfer Function & System Modeling',
  description: '以传递函数为主线，掌握从微分方程到 s 域表达的建模与判读方法。',
  vessel: {
    name: '观测者号',
    type: 'training',
    length: 70.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-03'],
  learningObjectives: [
    '准确给出传递函数的定义与适用条件',
    '能从典型微分方程推导传递函数并识别系统阶次',
    '理解零极点与动态特性的对应关系',
    '熟悉典型环节的传递函数形式与快速判读方式',
  ],
  keywords: ['传递函数', '拉普拉斯变换', '零极点', '系统阶次', '典型环节'],
};

export const LESSON_04_RESOURCES = {
  'widget-transfer-precheck': {
    type: 'interactive-widget',
    component: 'TransferPrecheck',
    path: '@/resources/interactive-learning/lesson-04/transfer-precheck',
  },
  'widget-transfer-knowledge-deck': {
    type: 'interactive-widget',
    component: 'TransferKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-04/transfer-knowledge-deck',
  },
  'widget-transfer-derivation-lab': {
    type: 'interactive-widget',
    component: 'TransferDerivationLab',
    path: '@/resources/interactive-learning/lesson-04/transfer-derivation-lab',
  },
  'widget-transfer-element-workshop': {
    type: 'interactive-widget',
    component: 'TransferElementWorkshop',
    path: '@/resources/interactive-learning/lesson-04/transfer-element-workshop',
  },
  'widget-transfer-exit-quiz': {
    type: 'interactive-widget',
    component: 'TransferExitQuiz',
    path: '@/resources/interactive-learning/lesson-04/transfer-exit-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-04/summary-card',
  },
};

export const LESSON_04_CONFIG = {
  metadata: LESSON_04_METADATA,
  resources: LESSON_04_RESOURCES,
};

export default LESSON_04_CONFIG;
