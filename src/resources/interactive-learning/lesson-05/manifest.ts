/**
 * Lesson-05 方框图、信号流图与梅森公式 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_05_METADATA = {
  id: 'lesson-05',
  title: '方框图、信号流图与梅森公式',
  subtitle: 'Block Diagram, Signal Flow Graph & Mason Formula',
  description: '从结构图到信号流图，再到梅森公式，掌握控制系统拓扑的统一表达与求解。',
  vessel: {
    name: '拓扑观察者号',
    type: 'training',
    length: 72.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-04'],
  learningObjectives: [
    '掌握方框图四元素与典型等效变换法则',
    '能够将结构图/方程组转化为信号流图',
    '正确识别前向通路、回路与互不接触回路',
    '熟练运用梅森公式求取传递函数',
  ],
  keywords: ['方框图', '信号流图', '梅森公式', '拓扑', '前向通路', '回路'],
};

export const LESSON_05_RESOURCES = {
  'widget-block-diagram-precheck': {
    type: 'interactive-widget',
    component: 'BlockDiagramPrecheck',
    path: '@/resources/interactive-learning/lesson-05/block-diagram-precheck',
  },
  'widget-structure-knowledge-deck': {
    type: 'interactive-widget',
    component: 'StructureKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-05/structure-knowledge-deck',
  },
  'widget-block-diagram-workshop': {
    type: 'interactive-widget',
    component: 'BlockDiagramWorkshop',
    path: '@/resources/interactive-learning/lesson-05/block-diagram-workshop',
  },
  'widget-signal-flow-lab': {
    type: 'interactive-widget',
    component: 'SignalFlowLab',
    path: '@/resources/interactive-learning/lesson-05/signal-flow-lab',
  },
  'widget-mason-loop-challenge': {
    type: 'interactive-widget',
    component: 'MasonLoopChallenge',
    path: '@/resources/interactive-learning/lesson-05/mason-loop-challenge',
  },
  'widget-structure-exit-quiz': {
    type: 'interactive-widget',
    component: 'StructureExitQuiz',
    path: '@/resources/interactive-learning/lesson-05/structure-exit-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-05/summary-card',
  },
};

export const LESSON_05_CONFIG = {
  metadata: LESSON_05_METADATA,
  resources: LESSON_05_RESOURCES,
};

export default LESSON_05_CONFIG;
