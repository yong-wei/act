/**
 * Lesson-07 衰减振荡·欠阻尼二阶系统 类型定义
 *
 * 课程主题：二阶系统欠阻尼响应与性能指标
 */

// ========== BOPPPS 教学阶段配置 ==========

export interface BOPPPSPhaseConfig {
  id: string;
  stage: BOPPPSStage;
  title: string;
  duration: number; // 分钟
  color: string;
  resourceId?: string;
  componentType: ComponentType;
}

export type BOPPPSStage =
  | 'BRIDGE_IN'
  | 'OBJECTIVE'
  | 'PRE_ASSESSMENT'
  | 'PARTICIPATORY'
  | 'POST_ASSESSMENT'
  | 'SUMMARY';

export type ComponentType =
  | 'video'
  | 'poll'
  | 'objective'
  | 'interactive-widget'
  | 'knowledge-card'
  | 'static-media'
  | 'simulation'
  | 'assessment'
  | 'ai-report';

// ========== AI 角色配置 ==========

export interface AIPersonaConfig {
  id: string;
  name: string;
  nameChinese: string;
  role: string;
  avatar?: string;
  systemPrompt: string;
  proactive: boolean;
}

export const AI_PERSONAS: Record<string, AIPersonaConfig> = {
  'damping-coach': {
    id: 'damping-coach',
    name: 'Damping Coach',
    nameChinese: '阻尼教练',
    role: '指导学生理解阻尼比与衰减振荡的关系',
    systemPrompt: `你是二阶系统的阻尼教练。你的职责是帮助学生建立“阻尼比-响应特性”的直觉。
在教学过程中，你应该：
1. 用形象类比解释欠阻尼系统的振荡与衰减
2. 强调阻尼比越大，超调越小、衰减越快，但响应可能变慢
3. 引导学生用性能指标（超调量、调节时间）描述响应质量
4. 鼓励学生通过实验调整参数并总结规律`,
    proactive: true,
  },
  'response-analyst': {
    id: 'response-analyst',
    name: 'Response Analyst',
    nameChinese: '响应分析员',
    role: '协助学生读懂响应曲线与极点位置',
    systemPrompt: `你是系统响应分析员。你的职责是帮助学生把曲线特征与极点位置对应起来。
在教学过程中，你应该：
1. 解释共轭复极点、阻尼比与自然频率的物理意义
2. 指导学生使用标准型参数快速估算性能指标
3. 当学生参数选择偏离目标时给出纠偏提示
4. 强调“稳定性优先、速度与超调权衡”的工程原则`,
    proactive: true,
  },
};

// ========== BOPPPS 教学流程 ==========

export const LESSON_07_BOPPPS_FLOW: BOPPPSPhaseConfig[] = [
  {
    id: 'bridge-in',
    stage: 'BRIDGE_IN',
    title: '导入：衰减振荡直觉建立',
    duration: 4,
    color: 'emerald',
    resourceId: 'video-underdamped-intro',
    componentType: 'video',
  },
  {
    id: 'bridge-poll',
    stage: 'BRIDGE_IN',
    title: '投票：阻尼比变大时的响应变化',
    duration: 3,
    color: 'emerald',
    resourceId: 'poll-underdamped-intuition',
    componentType: 'poll',
  },
  {
    id: 'objective',
    stage: 'OBJECTIVE',
    title: '学习目标',
    duration: 5,
    color: 'blue',
    resourceId: 'card-lesson-objectives',
    componentType: 'objective',
  },
  {
    id: 'pretest',
    stage: 'PRE_ASSESSMENT',
    title: '前测：欠阻尼速判',
    duration: 8,
    color: 'amber',
    resourceId: 'widget-damping-quick-check',
    componentType: 'interactive-widget',
  },
  {
    id: 'part-static-classification',
    stage: 'PARTICIPATORY',
    title: '二阶系统传递函数与分类',
    duration: 5,
    color: 'red',
    resourceId: 'media-second-order-classification',
    componentType: 'static-media',
  },
  {
    id: 'part-theory',
    stage: 'PARTICIPATORY',
    title: '参与式学习：二阶系统标准型',
    duration: 20,
    color: 'red',
    resourceId: 'card-second-order-theory',
    componentType: 'interactive-widget',
  },
  {
    id: 'part-static-step-response',
    stage: 'PARTICIPATORY',
    title: '单位阶跃响应与指标',
    duration: 5,
    color: 'red',
    resourceId: 'media-step-response-metrics',
    componentType: 'static-media',
  },
  {
    id: 'part-explorer',
    stage: 'PARTICIPATORY',
    title: '参与式学习：衰减振荡实验室',
    duration: 27,
    color: 'red',
    resourceId: 'widget-response-explorer',
    componentType: 'interactive-widget',
  },
  {
    id: 'posttest',
    stage: 'POST_ASSESSMENT',
    title: '后测：参数匹配挑战',
    duration: 8,
    color: 'violet',
    resourceId: 'widget-parameter-challenge',
    componentType: 'interactive-widget',
  },
  {
    id: 'summary',
    stage: 'SUMMARY',
    title: '总结与延伸',
    duration: 5,
    color: 'slate',
    resourceId: 'card-lesson-summary',
    componentType: 'interactive-widget',
  },
];
