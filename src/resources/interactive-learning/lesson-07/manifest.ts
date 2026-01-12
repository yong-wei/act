/**
 * Lesson-07 衰减振荡·欠阻尼二阶系统 课程清单
 *
 * 定义课程资源、组件配置与教学流程。
 */

import type {
  VideoComponentConfig,
  PollComponentConfig,
  ObjectiveCardConfig,
} from '@/components/classroom/types';
import {
  LESSON_07_BOPPPS_FLOW,
  AI_PERSONAS,
} from './types';

// ========== 课程元信息 ==========

export const LESSON_07_METADATA = {
  id: 'lesson-07',
  title: '衰减振荡·欠阻尼二阶系统',
  subtitle: 'Underdamped Second-Order Response',
  description: '通过二阶系统标准型与衰减振荡实验，理解阻尼比、自然频率与性能指标之间的关系。',
  vessel: {
    name: '启明星号',
    type: 'training',
    length: 65.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'intermediate',
  prerequisites: ['lesson-06'],
  learningObjectives: [
    '能够写出二阶系统标准型并识别欠阻尼条件',
    '能用阻尼比与自然频率描述衰减振荡的快慢与幅度',
    '能够估算超调量、峰值时间与调节时间',
    '理解极点位置变化对响应品质的影响',
  ],
  keywords: ['欠阻尼', '衰减振荡', '二阶系统', '阻尼比', '自然频率', '超调量', '调节时间'],
};

// ========== 组件配置 ==========

export const VIDEO_UNDERDAMPED_INTRO: VideoComponentConfig = {
  id: 'video-underdamped-intro',
  type: 'video',
  title: '导入：衰减振荡的直觉',
  sourceType: 'placeholder',
  primarySource: '/assets/placeholder-underdamped.svg',
  splitMode: 'none',
  narration: '当系统受到扰动，响应会像弹簧一样振荡并逐渐衰减。阻尼比决定了它“晃多久、晃多高”。',
  description: '欠阻尼系统的响应既有振荡也有衰减，是控制系统最常见的动态特征。',
  autoPlay: false,
  autoAdvance: false,
};

export const POLL_UNDERDAMPED_INTUITION: PollComponentConfig = {
  id: 'poll-underdamped-intuition',
  type: 'poll',
  question: '阻尼比增大时，欠阻尼系统的阶跃响应通常会怎样变化？',
  options: [
    { key: 'A', text: '超调变大、振荡持续更久', color: '#ef4444' },
    { key: 'B', text: '超调减小、衰减更快', color: '#22c55e' },
    { key: 'C', text: '频率变高、峰值更早出现', color: '#38bdf8' },
    { key: 'D', text: '响应变慢但超调不变', color: '#f59e0b' },
  ],
  multiSelect: false,
  anonymous: false,
  showLiveResults: true,
  timeLimit: 45,
};

export const OBJECTIVE_LESSON_07: ObjectiveCardConfig = {
  id: 'card-lesson-objectives',
  type: 'objective',
  title: '衰减振荡 学习目标',
  objectives: [
    {
      id: 'obj-1',
      type: 'knowledge',
      description: '掌握二阶系统标准型与欠阻尼判据',
      badgeName: '标准型掌舵人',
      badgeIcon: 'DraftingCompass',
      unlocked: false,
    },
    {
      id: 'obj-2',
      type: 'ability',
      description: '能够利用阻尼比与自然频率描述响应形态',
      badgeName: '振荡解读师',
      badgeIcon: 'Activity',
      unlocked: false,
    },
    {
      id: 'obj-3',
      type: 'ability',
      description: '能估算超调量、峰值时间与调节时间',
      badgeName: '指标判读官',
      badgeIcon: 'Target',
      unlocked: false,
    },
    {
      id: 'obj-4',
      type: 'value',
      description: '形成用指标描述响应品质的工程表达习惯',
      badgeName: '工程表达者',
      badgeIcon: 'ShieldCheck',
      unlocked: false,
    },
  ],
  showUnlockAnimation: true,
};

// ========== 资源映射表 ==========

export const LESSON_07_RESOURCES = {
  'video-underdamped-intro': VIDEO_UNDERDAMPED_INTRO,
  'poll-underdamped-intuition': POLL_UNDERDAMPED_INTUITION,
  'card-lesson-objectives': OBJECTIVE_LESSON_07,

  'widget-damping-quick-check': {
    type: 'interactive-widget',
    component: 'DampingQuickCheck',
    path: '@/resources/interactive-learning/lesson-07/damping-quick-check',
  },

  'card-second-order-theory': {
    type: 'interactive-widget',
    component: 'SecondOrderTheoryDeck',
    path: '@/resources/interactive-learning/lesson-07/theory-deck',
  },

  'media-second-order-classification': {
    type: 'static-media',
    content: '/assets/lesson-07/second-order-classification.svg',
  },

  'media-step-response-metrics': {
    type: 'static-media',
    content: '/assets/lesson-07/step-response-metrics.svg',
  },

  'widget-response-explorer': {
    type: 'interactive-widget',
    component: 'ResponseExplorer',
    path: '@/resources/interactive-learning/lesson-07/response-explorer',
  },

  'widget-parameter-challenge': {
    type: 'interactive-widget',
    component: 'ParameterChallenge',
    path: '@/resources/interactive-learning/lesson-07/parameter-challenge',
  },

  'card-lesson-summary': {
    type: 'interactive-widget',
    component: 'LessonSummaryCard',
    path: '@/resources/interactive-learning/lesson-07/summary-card',
  },
};

// ========== 课程流程导出 ==========

export const LESSON_07_FLOW = LESSON_07_BOPPPS_FLOW;
export const LESSON_07_AI_PERSONAS = AI_PERSONAS;

// ========== 完整课程配置 ==========

export const LESSON_07_CONFIG = {
  metadata: LESSON_07_METADATA,
  flow: LESSON_07_FLOW,
  resources: LESSON_07_RESOURCES,
  aiPersonas: LESSON_07_AI_PERSONAS,
};

export default LESSON_07_CONFIG;
