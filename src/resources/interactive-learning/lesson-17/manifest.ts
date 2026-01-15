/**
 * Lesson-17 描述函数分析法与自振判别 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_17_METADATA = {
  id: 'lesson-17',
  title: '描述函数分析法与自振判别：交点与稳定性',
  subtitle: 'Describing Function Analysis & Limit Cycles',
  description: '围绕负倒描述函数与交点判别，掌握非线性系统自振存在性与稳定性分析流程。',
  vessel: {
    name: '守衡者号',
    type: 'research',
    length: 72.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'advanced',
  prerequisites: ['lesson-16'],
  learningObjectives: [
    '理解描述函数法的适用假设与结构前提',
    '能解释负倒描述函数的几何意义与作图步骤',
    '掌握交点判别自振存在性与稳定性的基本准则',
    '能根据 N(A)G(jω)=-1 求解自振振幅与频率',
  ],
  keywords: ['描述函数分析', '负倒描述函数', '自振', '极限环', '稳定性', '交点判别'],
};

export const LESSON_17_RESOURCES = {
  'widget-df-precheck': {
    type: 'interactive-widget',
    component: 'DfPrecheck',
    path: '@/resources/interactive-learning/lesson-17/df-precheck',
  },
  'widget-df-knowledge-deck': {
    type: 'interactive-widget',
    component: 'DfKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-17/df-knowledge-deck',
  },
  'widget-negative-inverse-workshop': {
    type: 'interactive-widget',
    component: 'NegativeInverseWorkshop',
    path: '@/resources/interactive-learning/lesson-17/negative-inverse-workshop',
  },
  'widget-limit-cycle-lab': {
    type: 'interactive-widget',
    component: 'LimitCycleLab',
    path: '@/resources/interactive-learning/lesson-17/limit-cycle-lab',
  },
  'widget-df-exit-quiz': {
    type: 'interactive-widget',
    component: 'DfExitQuiz',
    path: '@/resources/interactive-learning/lesson-17/df-exit-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-17/summary-card',
  },
};

export const LESSON_17_CONFIG = {
  metadata: LESSON_17_METADATA,
  resources: LESSON_17_RESOURCES,
};

export default LESSON_17_CONFIG;
