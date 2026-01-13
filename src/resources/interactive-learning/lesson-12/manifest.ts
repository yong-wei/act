/**
 * Lesson-12 频率特性与伯德图 课程清单
 *
 * 定义课程资源与元信息。
 */

export const LESSON_12_METADATA = {
  id: 'lesson-12',
  title: '频率特性与伯德图',
  subtitle: 'Frequency Response & Bode Plot',
  description: '用频率响应换个角度看控制，掌握伯德图的近似叠加绘制与读图反推。',
  vessel: {
    name: '启航号',
    type: 'training',
    length: 72.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-10'],
  learningObjectives: [
    '能复述频率响应的含义与稳态正弦响应关系',
    '掌握典型环节的对数幅频特性与斜率规律',
    '能列举伯德图绘制步骤并确定转折频率',
    '能使用近似叠加绘制并进行仿真验证',
  ],
  keywords: ['频率响应', '伯德图', '对数频率', '分贝', '转折频率', '近似叠加', '谐振峰'],
};

export const LESSON_12_RESOURCES = {
  'widget-frequency-precheck': {
    type: 'interactive-widget',
    component: 'FrequencyPrecheck',
    path: '@/resources/interactive-learning/lesson-12/frequency-precheck',
  },
  'widget-bode-step-sorter': {
    type: 'interactive-widget',
    component: 'BodeStepSorter',
    path: '@/resources/interactive-learning/lesson-12/bode-step-sorter',
  },
  'widget-bode-slope-puzzle': {
    type: 'interactive-widget',
    component: 'BodeSlopePuzzle',
    path: '@/resources/interactive-learning/lesson-12/bode-slope-puzzle',
  },
  'widget-bode-plot-recognition': {
    type: 'interactive-widget',
    component: 'BodePlotRecognition',
    path: '@/resources/interactive-learning/lesson-12/bode-plot-recognition',
  },
  'widget-bode-post-quiz': {
    type: 'interactive-widget',
    component: 'BodePostQuiz',
    path: '@/resources/interactive-learning/lesson-12/bode-post-quiz',
  },
  'widget-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-12/summary-card',
  },
};

export const LESSON_12_CONFIG = {
  metadata: LESSON_12_METADATA,
  resources: LESSON_12_RESOURCES,
};

export default LESSON_12_CONFIG;
