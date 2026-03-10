/**
 * Lesson-13 幅相特性与稳定判据 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_13_METADATA = {
  id: 'lesson-13',
  title: '幅相特性与稳定判据',
  subtitle: 'Phase & Stability in Frequency Domain',
  description: '以开环幅相特性为线索，掌握 Nyquist 判据与对数稳定判据的频域判稳路径。',
  vessel: {
    name: '观测者号',
    type: 'training',
    length: 68.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-12'],
  learningObjectives: [
    '理解开环幅相特性（Nyquist 图）的定义与关键特征点',
    '能手工绘制幅相曲线并定位负实轴交点',
    '会使用 Nyquist 判据判断闭环稳定性',
    '能将 Nyquist 判据转化为对数稳定判据进行快速判稳',
  ],
  keywords: ['Nyquist', '幅相特性', '幅角原理', '对数稳定判据', '穿越频率', '频域判稳'],
};

export const LESSON_13_RESOURCES = {
  'widget-phase-concept-quiz': {
    type: 'interactive-widget',
    component: 'PhaseConceptQuiz',
    path: '@/resources/interactive-learning/lesson-13/phase-concept-quiz',
  },
  'widget-phase-knowledge-deck': {
    type: 'interactive-widget',
    component: 'PhaseKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-13/phase-knowledge-deck',
  },
  'widget-bode-plot-recognition': {
    type: 'interactive-widget',
    component: 'BodePlotRecognition',
    path: '@/resources/interactive-learning/lesson-12/bode-plot-recognition',
  },
  'widget-nyquist-stability-scenario': {
    type: 'interactive-widget',
    component: 'NyquistStabilityScenario',
    path: '@/resources/interactive-learning/lesson-13/nyquist-stability-scenario',
  },
  'widget-phase-stability-exit-quiz': {
    type: 'interactive-widget',
    component: 'PhaseStabilityExitQuiz',
    path: '@/resources/interactive-learning/lesson-13/phase-stability-exit-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-13/summary-card',
  },
};

export const LESSON_13_CONFIG = {
  metadata: LESSON_13_METADATA,
  resources: LESSON_13_RESOURCES,
};

export default LESSON_13_CONFIG;
