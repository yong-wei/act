/**
 * Lesson-02 拉氏变换：工程直觉的数学实现 课程清单
 */

export const LESSON_02_METADATA = {
  id: 'lesson-02',
  title: '拉氏变换：工程直觉的数学实现',
  subtitle: 'Laplace Transform & Engineering Intuition',
  description: '以 RLC 电路为切口，构建 s 平面直觉、常用定理与反变换路径。',
  vessel: {
    name: '星澜号',
    type: 'training',
    length: 68.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-01'],
  learningObjectives: [
    '阐明拉氏变换的物理含义与 s=σ+jω 的工程直觉',
    '熟练使用线性、微分、积分与位移等常用定理',
    '理解初值/终值定理与卷积定理的应用边界',
    '能用部分分式与待定系数完成反变换',
  ],
  keywords: ['拉普拉斯变换', 's 域', '反变换', '初值终值', '卷积定理'],
};

export const LESSON_02_RESOURCES = {
  'laplace-bridge-intro': {
    type: 'interactive-widget',
    component: 'LaplaceBridgeIntro',
    path: '@/resources/interactive-learning/lesson-02/bridge-intro',
  },
  'laplace-objective-card': {
    type: 'interactive-widget',
    component: 'LaplaceObjectiveCard',
    path: '@/resources/interactive-learning/lesson-02/objective-card',
  },
  'laplace-precheck': {
    type: 'interactive-widget',
    component: 'LaplacePrecheck',
    path: '@/resources/interactive-learning/lesson-02/laplace-precheck',
  },
  'laplace-knowledge-deck': {
    type: 'interactive-widget',
    component: 'LaplaceKnowledgeDeck',
    path: '@/resources/interactive-learning/lesson-02/laplace-knowledge-deck',
  },
  'laplace-property-match': {
    type: 'interactive-widget',
    component: 'LaplacePropertyMatch',
    path: '@/resources/interactive-learning/lesson-02/laplace-property-match',
  },
  'laplace-inverse-lab': {
    type: 'interactive-widget',
    component: 'LaplaceInverseLab',
    path: '@/resources/interactive-learning/lesson-02/laplace-inverse-lab',
  },
  'laplace-exit-quiz': {
    type: 'interactive-widget',
    component: 'LaplaceExitQuiz',
    path: '@/resources/interactive-learning/lesson-02/laplace-exit-quiz',
  },
  'laplace-summary-card': {
    type: 'interactive-widget',
    component: 'LaplaceSummaryCard',
    path: '@/resources/interactive-learning/lesson-02/summary-card',
  },
};

export const LESSON_02_CONFIG = {
  metadata: LESSON_02_METADATA,
  resources: LESSON_02_RESOURCES,
};

export default LESSON_02_CONFIG;
