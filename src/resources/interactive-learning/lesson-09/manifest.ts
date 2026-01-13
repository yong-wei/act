/**
 * Lesson-09 校正与时域综合 课程清单
 *
 * 定义课程资源、组件配置与教学流程。
 */

import type {
  VideoComponentConfig,
  PollComponentConfig,
  ObjectiveCardConfig,
} from '@/components/classroom/types';
import {
  LESSON_09_BOPPPS_FLOW,
  AI_PERSONAS,
} from './types';

export const LESSON_09_METADATA = {
  id: 'lesson-09',
  title: '校正与时域综合',
  subtitle: 'Correction Methods & Time-Domain Synthesis',
  description: '围绕校正手段与航向系统案例，完成时域综合分析与性能验证。',
  vessel: {
    name: '启示号',
    type: 'training',
    length: 70.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-08'],
  learningObjectives: [
    '理解 PD 与输出微分反馈的差异',
    '能够选择前馈补偿或扰动补偿方案',
    '能按时域综合流程验证校正效果',
  ],
  keywords: ['系统校正', '比例微分', '输出反馈', '前馈补偿', '扰动补偿', '时域综合'],
};

export const VIDEO_CORRECTION_INTRO: VideoComponentConfig = {
  id: 'video-correction-intro',
  type: 'video',
  title: '导入：校正让系统更稳更快',
  sourceType: 'placeholder',
  primarySource: '/assets/lesson-09/intro-correction.svg',
  splitMode: 'none',
  narration: '校正就是在系统中加入可调装置，让控制更稳、更快、更准。',
  description: '从性能目标切入，建立“结构改造 → 性能提升”的直觉。',
  autoPlay: false,
  autoAdvance: false,
};

export const POLL_CORRECTION_PRIORITY: PollComponentConfig = {
  id: 'poll-correction-priority',
  type: 'poll',
  question: '如果只能先改善一项，你会优先选择？',
  options: [
    { key: 'A', text: '稳：系统不发散', color: '#22c55e' },
    { key: 'B', text: '快：响应更迅速', color: '#f97316' },
    { key: 'C', text: '准：稳态误差更小', color: '#3b82f6' },
    { key: 'D', text: '抗扰：扰动影响更弱', color: '#a855f7' },
  ],
  multiSelect: false,
  anonymous: false,
  showLiveResults: true,
  timeLimit: 40,
};

export const OBJECTIVE_LESSON_09: ObjectiveCardConfig = {
  id: 'objective-lesson-09',
  type: 'objective',
  title: '校正与时域综合 学习目标',
  objectives: [
    {
      id: 'obj-1',
      type: 'knowledge',
      description: '理解比例-微分控制与输出微分反馈的机理差异',
      badgeName: '校正理解者',
      badgeIcon: 'Sliders',
      unlocked: false,
    },
    {
      id: 'obj-2',
      type: 'ability',
      description: '能够选择前馈补偿或扰动补偿以改善稳态精度',
      badgeName: '补偿策略师',
      badgeIcon: 'Target',
      unlocked: false,
    },
    {
      id: 'obj-3',
      type: 'ability',
      description: '能用时域指标验证校正效果与性能边界',
      badgeName: '时域验收官',
      badgeIcon: 'LineChart',
      unlocked: false,
    },
  ],
  showUnlockAnimation: true,
};

export const LESSON_09_RESOURCES = {
  'video-correction-intro': VIDEO_CORRECTION_INTRO,
  'poll-correction-priority': POLL_CORRECTION_PRIORITY,
  'objective-lesson-09': OBJECTIVE_LESSON_09,

  'widget-correction-precheck': {
    type: 'interactive-widget',
    component: 'CorrectionPrecheck',
    path: '@/resources/interactive-learning/lesson-09/correction-precheck',
  },
  'card-correction-strategy': {
    type: 'interactive-widget',
    component: 'CorrectionStrategy',
    path: '@/resources/interactive-learning/lesson-09/correction-strategy',
  },
  'card-time-domain-synthesis': {
    type: 'interactive-widget',
    component: 'TimeDomainSynthesis',
    path: '@/resources/interactive-learning/lesson-09/time-domain-synthesis',
  },
  'card-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-09/summary-card',
  },
};

export const LESSON_09_FLOW = LESSON_09_BOPPPS_FLOW;
export const LESSON_09_AI_PERSONAS = AI_PERSONAS;

export const LESSON_09_CONFIG = {
  metadata: LESSON_09_METADATA,
  flow: LESSON_09_FLOW,
  resources: LESSON_09_RESOURCES,
  aiPersonas: LESSON_09_AI_PERSONAS,
};

export default LESSON_09_CONFIG;
