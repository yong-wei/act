/**
 * Lesson-11 参数根轨迹与图形化思考 课程清单
 *
 * 定义课程资源、组件配置与教学流程。
 */

import type {
  VideoComponentConfig,
  PollComponentConfig,
  ObjectiveCardConfig,
} from '@/components/classroom/types';
import {
  LESSON_11_BOPPPS_FLOW,
  AI_PERSONAS,
} from './types';

export const LESSON_11_METADATA = {
  id: 'lesson-11',
  title: '参数根轨迹与图形化思考',
  subtitle: 'Parametric Root Locus & Visual Reasoning',
  description: '以参数根轨迹的广义定义为核心，训练稳定范围判断与图形化思考流程。',
  vessel: {
    name: '启航号',
    type: 'training',
    length: 72.0,
    passengers: 0,
  },
  duration: 90,
  difficulty: 'advanced',
  prerequisites: ['lesson-10'],
  learningObjectives: [
    '理解参数根轨迹的广义定义与等效开环思想',
    '能够判断参数稳定范围与虚轴交点',
    '能用图形化思考选择主导极点并验证性能',
  ],
  keywords: ['参数根轨迹', '等效开环', '稳定范围', '图形化思考', '主导极点'],
};

export const VIDEO_LESSON_11_INTRO: VideoComponentConfig = {
  id: 'video-lesson-11-intro',
  type: 'video',
  title: '导入：当参数不是 K 时怎么办？',
  sourceType: 'placeholder',
  primarySource: '/assets/lesson-11/parameter-root-locus-roadmap.svg',
  splitMode: 'none',
  narration: '根轨迹不只研究增益 K，当其他参数变化时也可以变形为等效开环问题。',
  description: '从“参数改变”引入参数根轨迹的广义定义与分析目标。',
  autoPlay: false,
  autoAdvance: false,
};

export const POLL_LESSON_11_PAIN: PollComponentConfig = {
  id: 'poll-lesson-11-pain',
  type: 'poll',
  question: '在参数根轨迹学习中，你最担心哪一步？',
  options: [
    { key: 'A', text: '不知道如何构造等效开环传函', color: '#38bdf8' },
    { key: 'B', text: '稳定范围和虚轴交点不会算', color: '#f97316' },
    { key: 'C', text: '画出轨迹但选不出合适的参数', color: '#22c55e' },
    { key: 'D', text: '不会用仿真验证性能', color: '#a855f7' },
  ],
  multiSelect: false,
  anonymous: false,
  showLiveResults: true,
  timeLimit: 45,
};

export const OBJECTIVE_LESSON_11: ObjectiveCardConfig = {
  id: 'objective-lesson-11',
  type: 'objective',
  title: '参数根轨迹 学习目标',
  objectives: [
    {
      id: 'obj-1',
      type: 'knowledge',
      description: '掌握参数根轨迹的广义定义与等效开环变换',
      badgeName: '参数理解者',
      badgeIcon: 'GitBranch',
      unlocked: false,
    },
    {
      id: 'obj-2',
      type: 'ability',
      description: '能够判定参数稳定范围与虚轴交点',
      badgeName: '稳定边界侦测员',
      badgeIcon: 'Target',
      unlocked: false,
    },
    {
      id: 'obj-3',
      type: 'ability',
      description: '能够选择主导极点并验证动态性能',
      badgeName: '图形化思考师',
      badgeIcon: 'Eye',
      unlocked: false,
    },
    {
      id: 'obj-4',
      type: 'value',
      description: '形成“参数-轨迹-性能”闭环的工程思维',
      badgeName: '工程决策者',
      badgeIcon: 'Medal',
      unlocked: false,
    },
  ],
  showUnlockAnimation: true,
};

export const POLL_LESSON_11_PRECHECK: PollComponentConfig = {
  id: 'poll-lesson-11-precheck',
  type: 'poll',
  question: '下面哪句话最符合“参数根轨迹”的含义？',
  options: [
    { key: 'A', text: '闭环极点随 K 变化的轨迹', color: '#38bdf8' },
    { key: 'B', text: '闭环极点随任意参数变化的轨迹', color: '#22c55e' },
    { key: 'C', text: '开环极点随参数变化的轨迹', color: '#f97316' },
    { key: 'D', text: '系统频率响应随参数变化的曲线', color: '#a855f7' },
  ],
  multiSelect: false,
  anonymous: false,
  showLiveResults: true,
  timeLimit: 50,
};

export const POLL_LESSON_11_POSTCHECK: PollComponentConfig = {
  id: 'poll-lesson-11-postcheck',
  type: 'poll',
  question: '判断参数稳定范围时，最关键的边界依据是？',
  options: [
    { key: 'A', text: '根轨迹在虚轴的交点', color: '#22c55e' },
    { key: 'B', text: '实轴段的长度', color: '#38bdf8' },
    { key: 'C', text: '渐近线的中心位置', color: '#f97316' },
    { key: 'D', text: '出射角的大小', color: '#a855f7' },
  ],
  multiSelect: false,
  anonymous: false,
  showLiveResults: true,
  timeLimit: 50,
};

export const LESSON_11_RESOURCES = {
  'video-lesson-11-intro': VIDEO_LESSON_11_INTRO,
  'poll-lesson-11-pain': POLL_LESSON_11_PAIN,
  'objective-lesson-11': OBJECTIVE_LESSON_11,
  'poll-lesson-11-precheck': POLL_LESSON_11_PRECHECK,
  'poll-lesson-11-postcheck': POLL_LESSON_11_POSTCHECK,

  'deck-parameter-root-locus': {
    type: 'interactive-widget',
    component: 'ParameterRootLocusDeck',
    path: '@/resources/interactive-learning/lesson-11/parameter-root-locus-deck',
  },
  'workshop-graphical-thinking': {
    type: 'interactive-widget',
    component: 'GraphicalThinkingWorkshop',
    path: '@/resources/interactive-learning/lesson-11/graphical-thinking-workshop',
  },
  'card-lesson-11-summary': {
    type: 'interactive-widget',
    component: 'Lesson11SummaryCard',
    path: '@/resources/interactive-learning/lesson-11/summary-card',
  },
  'media-lesson11-roadmap': {
    type: 'static-media',
    content: '/assets/lesson-11/parameter-root-locus-roadmap.svg',
  },
  'media-lesson11-equivalent': {
    type: 'static-media',
    content: '/assets/lesson-11/parameter-root-locus-equivalent-open-loop.svg',
  },
  'media-lesson11-visual-workflow': {
    type: 'static-media',
    content: '/assets/lesson-11/root-locus-visual-workflow.svg',
  },
};

export const LESSON_11_FLOW = LESSON_11_BOPPPS_FLOW;
export const LESSON_11_AI_PERSONAS = AI_PERSONAS;

export const LESSON_11_CONFIG = {
  metadata: LESSON_11_METADATA,
  flow: LESSON_11_FLOW,
  resources: LESSON_11_RESOURCES,
  aiPersonas: LESSON_11_AI_PERSONAS,
};

export default LESSON_11_CONFIG;
