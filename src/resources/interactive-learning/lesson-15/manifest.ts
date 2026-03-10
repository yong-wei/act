/**
 * Lesson-15 串联校正与滞后超前 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_15_METADATA = {
  id: 'lesson-15',
  title: '串联校正与滞后超前：双管齐下',
  subtitle: 'Series Compensation & Lag-Lead Design',
  description: '从串联校正切入，掌握超前/滞后网络特性与滞后-超前联合设计流程。',
  vessel: {
    name: '远航者号',
    type: 'training',
    length: 72.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-12', 'lesson-14'],
  learningObjectives: [
    '解释串联校正的目的，并区分超前、滞后与滞后-超前网络',
    '能根据频域指标选择合适的校正类型并描述其作用机理',
    '掌握超前与滞后网络的典型设计步骤与参数估算方法',
    '能串联组织滞后-超前设计流程完成综合性能目标',
  ],
  keywords: ['串联校正', '超前网络', '滞后网络', '滞后-超前', '相角裕度', '频域设计'],
};

export const LESSON_15_RESOURCES = {
  'widget-series-precheck': {
    type: 'interactive-widget',
    component: 'SeriesPrecheck',
    path: '@/resources/interactive-learning/lesson-15/series-precheck',
  },
  'widget-series-knowledge-deck': {
    type: 'interactive-widget',
    component: 'SeriesKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-15/series-knowledge-deck',
  },
  'widget-series-strategy-lab': {
    type: 'interactive-widget',
    component: 'SeriesStrategyLab',
    path: '@/resources/interactive-learning/lesson-15/series-strategy-lab',
  },
  'widget-lag-lead-workshop': {
    type: 'interactive-widget',
    component: 'LagLeadWorkshop',
    path: '@/resources/interactive-learning/lesson-15/lag-lead-workshop',
  },
  'widget-series-exit-quiz': {
    type: 'interactive-widget',
    component: 'SeriesExitQuiz',
    path: '@/resources/interactive-learning/lesson-15/series-exit-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-15/summary-card',
  },
};

export const LESSON_15_CONFIG = {
  metadata: LESSON_15_METADATA,
  resources: LESSON_15_RESOURCES,
};

export default LESSON_15_CONFIG;
