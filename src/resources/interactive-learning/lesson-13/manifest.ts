/**
 * Lesson-13 柔性之海 课程清单
 *
 * 定义课程的所有资源、组件配置和教学流程。
 * 供课堂编排器和播放器使用。
 */

import type {
  VideoComponentConfig,
  PollComponentConfig,
  ObjectiveCardConfig,
  AssessmentProbeConfig,
  AIDynamicReportConfig,
} from '@/components/classroom/types';
import {
  LESSON_13_BOPPPS_FLOW,
  TYPHOON_SCENARIO,
  AI_PERSONAS,
  LESSON_13_SCORING,
} from './types';

// ========== 课程元信息 ==========

export const LESSON_13_METADATA = {
  id: 'lesson-13',
  title: '柔性之海——豪华邮轮的舒适度控制',
  subtitle: 'Comfort-Oriented Control for Cruise Ships',
  description: '通过爱达·魔都号邮轮的台风避障场景，学习如何在多约束条件下设计控制参数，平衡响应速度与乘客舒适度。',
  vessel: {
    name: '爱达·魔都号',
    type: 'cruise',
    length: 323.6,
    passengers: 5246,
  },
  duration: 45, // 分钟
  difficulty: 'intermediate',
  prerequisites: ['lesson-02', 'lesson-05'], // 需要先完成PID基础和二阶系统
  learningObjectives: [
    '理解超调量、调节时间与用户体验的映射关系',
    '掌握阻尼比对系统响应的影响',
    '能够在多约束条件下设计PID参数',
    '理解伦理熔断机制在控制系统中的应用',
  ],
  keywords: ['舒适度控制', 'ISO 2631', '阻尼调节', '伦理熔断', '邮轮仿真'],
};

// ========== 组件配置 ==========

/** 导入视频配置 */
export const VIDEO_COMFORT_CONTRAST: VideoComponentConfig = {
  id: 'video-comfort-contrast',
  type: 'video',
  title: '舒适度对比',
  sourceType: 'placeholder',
  primarySource: '/assets/placeholder-comfort-good.svg',
  secondarySource: '/assets/placeholder-comfort-bad.svg',
  splitMode: 'horizontal',
  narration: '请观察两段船舶转向的视频。左边的船舶转向平稳，乘客几乎感觉不到晃动；右边的船舶转向剧烈，餐桌上的餐具都在滑动。同样是30度转向，为什么体验差距如此之大？',
  description: '分屏对比：平稳转向 vs 剧烈转向的乘客体验差异',
  autoPlay: false,
  autoAdvance: false,
};

/** 投票配置 */
export const POLL_COMFORT_DEFINITION: PollComponentConfig = {
  id: 'poll-comfort-definition',
  type: 'poll',
  question: '你认为"控制好坏"的标准应该是什么？',
  options: [
    { key: 'A', text: '响应速度越快越好', color: '#ef4444' },
    { key: 'B', text: '超调量越小越好', color: '#f59e0b' },
    { key: 'C', text: '需要在速度和舒适度之间平衡', color: '#22c55e' },
    { key: 'D', text: '只要不触发安全警报就行', color: '#6366f1' },
  ],
  multiSelect: false,
  anonymous: false,
  showLiveResults: true,
  timeLimit: 30,
};

/** 学习目标配置 */
export const OBJECTIVE_LESSON_13: ObjectiveCardConfig = {
  id: 'objective-lesson-13',
  type: 'objective',
  title: '柔性之海 学习目标',
  objectives: [
    {
      id: 'obj-1',
      type: 'knowledge',
      description: '理解ISO 2631标准中控制指标与用户体验的映射关系',
      badgeName: '标准专家',
      badgeIcon: 'FileCheck',
      unlocked: false,
    },
    {
      id: 'obj-2',
      type: 'ability',
      description: '能够通过调节阻尼比优化系统响应特性',
      badgeName: '调参大师',
      badgeIcon: 'Sliders',
      unlocked: false,
    },
    {
      id: 'obj-3',
      type: 'ability',
      description: '在香槟塔保卫战中完成任务且无违规',
      badgeName: '舒适守护者',
      badgeIcon: 'Shield',
      unlocked: false,
    },
    {
      id: 'obj-4',
      type: 'value',
      description: '理解控制工程中的伦理责任和安全边界',
      badgeName: '伦理先锋',
      badgeIcon: 'Heart',
      unlocked: false,
    },
  ],
  showUnlockAnimation: true,
};

/** 后测评估配置 */
export const ASSESSMENT_DESIGN_VERIFY: AssessmentProbeConfig = {
  id: 'quiz-design-verify',
  type: 'assessment',
  title: '后测：控制参数设计验证',
  description: '根据你对阻尼调节的理解，设计一组PID参数，使邮轮能够在保证乘客舒适度的前提下完成30°紧急转向。',
  parameters: [
    {
      id: 'kp',
      name: '比例系数',
      symbol: 'Kp',
      min: 0,
      max: 5,
      step: 0.1,
      defaultValue: 1,
    },
    {
      id: 'ki',
      name: '积分系数',
      symbol: 'Ki',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.1,
    },
    {
      id: 'kd',
      name: '微分系数',
      symbol: 'Kd',
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: 0.5,
    },
  ],
  scoring: LESSON_13_SCORING,
};

/** AI报告配置 */
export const REPORT_CLASS_SUMMARY: AIDynamicReportConfig = {
  id: 'report-class-summary',
  type: 'ai-report',
  title: '课堂学习报告',
  reportTemplate: `本节课共有 {totalStudents} 名同学参与学习，{completedStudents} 人完成全部任务，完成率 {completionRate}%。

班级平均分为 {averageScore} 分，伦理违规率 {violationRate}%。

通过本节课的学习，同学们理解了控制系统性能指标（超调量、调节时间、加速度）与用户体验（晕船指数、避障能力、安全风险）之间的映射关系，掌握了阻尼调节在舒适度控制中的关键作用。`,
  visualizations: ['bar', 'pie'],
  enableVoice: true,
  voiceScript: '',
};

// ========== 资源映射表 ==========

export const LESSON_13_RESOURCES = {
  // 视频组件
  'video-comfort-contrast': VIDEO_COMFORT_CONTRAST,

  // 投票组件
  'poll-comfort-definition': POLL_COMFORT_DEFINITION,

  // 学习目标
  'card-lesson-objectives': OBJECTIVE_LESSON_13,

  // 互动学习模块（组件路径）
  'widget-physics-builder-simple': {
    type: 'interactive-widget',
    component: 'PhysicsBuilderSimple',
    path: '@/resources/interactive-learning/lesson-13/physics-builder-simple',
  },

  'card-iso2631-mapping': {
    type: 'knowledge-card',
    component: 'ISO2631MappingCard',
    path: '@/resources/interactive-learning/lesson-13/iso2631-mapping',
  },

  'sim-cruise-typhoon': {
    type: 'simulation',
    component: 'CruiseTyphoonSim',
    path: '@/resources/interactive-learning/lesson-13/cruise-typhoon-sim',
    config: {
      scenario: TYPHOON_SCENARIO,
      showMissionPanel: true,
      showChampagnePIP: true,
    },
  },

  'widget-response-shaping': {
    type: 'interactive-widget',
    component: 'ResponseShaping',
    path: '@/resources/interactive-learning/lesson-13/response-shaping',
    // TODO: 后续实现
  },

  // 评估组件
  'quiz-design-verify': ASSESSMENT_DESIGN_VERIFY,

  // AI报告
  'report-class-summary': REPORT_CLASS_SUMMARY,
};

// ========== 课程流程导出 ==========

export const LESSON_13_FLOW = LESSON_13_BOPPPS_FLOW;
export const LESSON_13_AI_PERSONAS = AI_PERSONAS;

// ========== 完整课程配置 ==========

export const LESSON_13_CONFIG = {
  metadata: LESSON_13_METADATA,
  flow: LESSON_13_FLOW,
  resources: LESSON_13_RESOURCES,
  aiPersonas: LESSON_13_AI_PERSONAS,
  scenario: TYPHOON_SCENARIO,
};

export default LESSON_13_CONFIG;
