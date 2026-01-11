/**
 * Lesson-06 控制奥德赛·指标裁判席 课程清单
 *
 * 定义课程资源、组件配置与教学流程。
 */

import type {
  VideoComponentConfig,
  PollComponentConfig,
  ObjectiveCardConfig,
  AssessmentProbeConfig,
  AIDynamicReportConfig,
} from '@/components/classroom/types';
import {
  LESSON_06_BOPPPS_FLOW,
  AI_PERSONAS,
  LESSON_06_SCORING,
} from './types';

// ========== 课程元信息 ==========

export const LESSON_06_METADATA = {
  id: 'lesson-06',
  title: '控制奥德赛·指标裁判席',
  subtitle: 'Time-Domain Performance Judge',
  description: '在控制奥德赛的裁判席上，学习如何用时域性能指标评判控制效果。',
  vessel: {
    name: '奥德赛号',
    type: 'odyssey',
    length: 88.0,
    passengers: 0,
  },
  duration: 35,
  difficulty: 'intermediate',
  prerequisites: ['lesson-03'],
  learningObjectives: [
    '能够解释上升时间、峰值时间、调节时间与超调量的含义',
    '能根据响应曲线估计关键指标并解释判分依据',
    '理解“稳定、准确、快速”的权衡原则',
    '能够依据指标阈值调整控制策略',
  ],
  keywords: ['时域性能', '指标裁判', '超调量', '调节时间', '上升时间', '稳态误差'],
};

// ========== 组件配置 ==========

export const VIDEO_JUDGE_CONTRAST: VideoComponentConfig = {
  id: 'video-judge-contrast',
  type: 'video',
  title: '裁判席开场：快与稳的对决',
  sourceType: 'placeholder',
  primarySource: '/assets/placeholder-judge-fast.svg',
  secondarySource: '/assets/placeholder-judge-stable.svg',
  splitMode: 'horizontal',
  narration: '裁判席只看指标：速度够快、超调够小、调节够稳。你准备好接受评分了吗？',
  description: '分屏对比：快但超调 vs 稳但慢的典型响应',
  autoPlay: false,
  autoAdvance: false,
};

export const POLL_JUDGE_CRITERIA: PollComponentConfig = {
  id: 'poll-judge-criteria',
  type: 'poll',
  question: '如果你是裁判，哪一项更能代表“好控制”？',
  options: [
    { key: 'A', text: '速度第一：上升时间越短越好', color: '#ef4444' },
    { key: 'B', text: '稳为王：超调量越小越好', color: '#f59e0b' },
    { key: 'C', text: '平衡：速度与稳定兼顾', color: '#22c55e' },
    { key: 'D', text: '精度：稳态误差趋近零', color: '#3b82f6' },
  ],
  multiSelect: false,
  anonymous: false,
  showLiveResults: true,
  timeLimit: 30,
};

export const OBJECTIVE_LESSON_06: ObjectiveCardConfig = {
  id: 'card-lesson-objectives',
  type: 'objective',
  title: '指标裁判席 学习目标',
  objectives: [
    {
      id: 'obj-1',
      type: 'knowledge',
      description: '掌握时域性能指标的定义与判读方法',
      badgeName: '指标读谱师',
      badgeIcon: 'LineChart',
      unlocked: false,
    },
    {
      id: 'obj-2',
      type: 'ability',
      description: '能够根据指标阈值给出判分结论',
      badgeName: '裁判助理',
      badgeIcon: 'ClipboardCheck',
      unlocked: false,
    },
    {
      id: 'obj-3',
      type: 'ability',
      description: '理解“稳定、准确、快速”的权衡',
      badgeName: '权衡大师',
      badgeIcon: 'Scale',
      unlocked: false,
    },
    {
      id: 'obj-4',
      type: 'value',
      description: '形成可解释、可复现的评价习惯',
      badgeName: '公平裁判',
      badgeIcon: 'ShieldCheck',
      unlocked: false,
    },
  ],
  showUnlockAnimation: true,
};

export const ASSESSMENT_JUDGE_PARAMS: AssessmentProbeConfig = {
  id: 'quiz-judge-assessment',
  type: 'assessment',
  title: '后测：指标达标挑战',
  description: '提交一组控制参数，让系统同时满足超调量与调节时间的裁判标准。',
  parameters: [
    {
      id: 'kp',
      name: '比例系数',
      symbol: 'Kp',
      min: 0,
      max: 5,
      step: 0.1,
      defaultValue: 1.2,
    },
    {
      id: 'ki',
      name: '积分系数',
      symbol: 'Ki',
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: 0.1,
    },
    {
      id: 'kd',
      name: '微分系数',
      symbol: 'Kd',
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: 0.4,
    },
  ],
  scoring: LESSON_06_SCORING,
};

export const REPORT_JUDGE_SUMMARY: AIDynamicReportConfig = {
  id: 'report-judge-summary',
  type: 'ai-report',
  title: '裁判席课堂报告',
  reportTemplate: `本节课共有 {totalStudents} 名同学参与评判训练，{completedStudents} 人完成全部挑战，完成率 {completionRate}%。

班级平均得分 {averageScore} 分。典型短板集中在“调节时间过长”和“超调量偏大”。

通过本节课的学习，同学们掌握了时域性能指标的定义、判读方法以及指标权衡原则。`,
  visualizations: ['bar', 'pie'],
  enableVoice: true,
  voiceScript: '',
};

// ========== 资源映射表 ==========

export const LESSON_06_RESOURCES = {
  'video-judge-contrast': VIDEO_JUDGE_CONTRAST,
  'poll-judge-criteria': POLL_JUDGE_CRITERIA,
  'card-lesson-objectives': OBJECTIVE_LESSON_06,

  'widget-metric-quick-check': {
    type: 'interactive-widget',
    component: 'MetricQuickCheck',
    path: '@/resources/interactive-learning/lesson-06/metric-quick-check',
  },

  'card-metric-handbook': {
    type: 'knowledge-card',
    component: 'MetricHandbookCard',
    path: '@/resources/interactive-learning/lesson-06/metric-handbook',
  },

  'sim-judge-bench': {
    type: 'interactive-widget',
    component: 'JudgeBenchSim',
    path: '@/resources/interactive-learning/lesson-06/judge-bench-sim',
  },

  'quiz-judge-assessment': ASSESSMENT_JUDGE_PARAMS,
  'report-judge-summary': REPORT_JUDGE_SUMMARY,
};

// ========== 课程流程导出 ==========

export const LESSON_06_FLOW = LESSON_06_BOPPPS_FLOW;
export const LESSON_06_AI_PERSONAS = AI_PERSONAS;

// ========== 完整课程配置 ==========

export const LESSON_06_CONFIG = {
  metadata: LESSON_06_METADATA,
  flow: LESSON_06_FLOW,
  resources: LESSON_06_RESOURCES,
  aiPersonas: LESSON_06_AI_PERSONAS,
};

export default LESSON_06_CONFIG;
