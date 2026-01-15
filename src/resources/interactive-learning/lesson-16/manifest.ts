/**
 * Lesson-16 非线性系统与描述函数基础 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_16_METADATA = {
  id: 'lesson-16',
  title: '非线性系统与描述函数基础：从现象到模型',
  subtitle: 'Nonlinear Systems & Describing Function Basics',
  description: '聚焦非线性系统的特殊性质与描述函数方法，建立谐波线性化与典型非线性特性的直觉。',
  vessel: {
    name: '探测者号',
    type: 'research',
    length: 68.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'advanced',
  prerequisites: ['lesson-13', 'lesson-14'],
  learningObjectives: [
    '识别非线性系统的特殊性质与常见工程来源',
    '理解谐波线性化思想与描述函数的定义方式',
    '掌握继电器/饱和/死区/间隙等典型非线性特性',
    '能说明描述函数方法的适用前提与基本用途',
  ],
  keywords: ['非线性系统', '描述函数', '谐波线性化', '继电器', '饱和', '死区', '间隙'],
};

export const LESSON_16_RESOURCES = {
  'widget-nonlinear-precheck': {
    type: 'interactive-widget',
    component: 'NonlinearPrecheck',
    path: '@/resources/interactive-learning/lesson-16/nonlinear-precheck',
  },
  'widget-nonlinear-knowledge-deck': {
    type: 'interactive-widget',
    component: 'NonlinearKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-16/nonlinear-knowledge-deck',
  },
  'widget-nonlinear-feature-match': {
    type: 'interactive-widget',
    component: 'NonlinearFeatureMatch',
    path: '@/resources/interactive-learning/lesson-16/nonlinear-feature-match',
  },
  'widget-harmonic-linearization-guide': {
    type: 'interactive-widget',
    component: 'HarmonicLinearizationGuide',
    path: '@/resources/interactive-learning/lesson-16/harmonic-linearization-guide',
  },
  'widget-nonlinear-exit-quiz': {
    type: 'interactive-widget',
    component: 'NonlinearExitQuiz',
    path: '@/resources/interactive-learning/lesson-16/nonlinear-exit-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-16/summary-card',
  },
};

export const LESSON_16_CONFIG = {
  metadata: LESSON_16_METADATA,
  resources: LESSON_16_RESOURCES,
};

export default LESSON_16_CONFIG;
