/**
 * Lesson-14 稳定裕度与三频段 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_14_METADATA = {
  id: 'lesson-14',
  title: '稳定裕度与三频段：宽备窄用',
  subtitle: 'Stability Margin & Three-Band Design',
  description: '以相角/幅值裕度为抓手，理解三频段各自负责的性能指标与频域权衡。',
  vessel: {
    name: '守望者号',
    type: 'training',
    length: 70.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-12', 'lesson-13'],
  learningObjectives: [
    '解释稳定裕度的物理含义，并区分相角裕度与幅值裕度',
    '能在 Bode 图上定位穿越频率并计算稳定裕度',
    '理解稳定裕度与超调/调节时间的关联与工程折衷',
    '掌握三频段理论，并能判断低/中/高频段对应的性能目标',
  ],
  keywords: ['稳定裕度', '相角裕度', '幅值裕度', '穿越频率', '三频段', '带宽', '鲁棒性'],
};

export const LESSON_14_RESOURCES = {
  'widget-margin-quick-check': {
    type: 'interactive-widget',
    component: 'MarginQuickCheck',
    path: '@/resources/interactive-learning/lesson-14/margin-quick-check',
  },
  'widget-margin-knowledge-deck': {
    type: 'interactive-widget',
    component: 'MarginKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-14/margin-knowledge-deck',
  },
  'widget-margin-tradeoff-lab': {
    type: 'interactive-widget',
    component: 'MarginTradeoffLab',
    path: '@/resources/interactive-learning/lesson-14/margin-tradeoff-lab',
  },
  'widget-three-band-studio': {
    type: 'interactive-widget',
    component: 'ThreeBandStudio',
    path: '@/resources/interactive-learning/lesson-14/three-band-studio',
  },
  'widget-margin-exit-quiz': {
    type: 'interactive-widget',
    component: 'MarginExitQuiz',
    path: '@/resources/interactive-learning/lesson-14/margin-exit-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-14/summary-card',
  },
};

export const LESSON_14_CONFIG = {
  metadata: LESSON_14_METADATA,
  resources: LESSON_14_RESOURCES,
};

export default LESSON_14_CONFIG;
