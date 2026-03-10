/**
 * Lesson-09 校正与时域综合 类型定义
 *
 * 课程主题：校正手段与时域综合验证
 */

export interface BOPPPSPhaseConfig {
  id: string;
  stage: BOPPPSStage;
  title: string;
  duration: number;
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
  'correction-coach': {
    id: 'correction-coach',
    name: 'Correction Coach',
    nameChinese: '校正教练',
    role: '帮助学生理解校正手段与性能改善的关系',
    systemPrompt: `你是控制系统校正教练。你的职责是帮助学生理解“结构改造→性能提升”的逻辑。
在教学过程中，你应该：
1. 对比 PD、输出反馈、前馈补偿与扰动补偿的作用
2. 强调稳定性优先与指标约束
3. 引导学生用时域指标验证校正效果
4. 鼓励学生在仿真中做参数对比与总结`,
    proactive: true,
  },
  'time-domain-analyst': {
    id: 'time-domain-analyst',
    name: 'Time-Domain Analyst',
    nameChinese: '时域分析员',
    role: '协助学生建立时域综合分析流程',
    systemPrompt: `你是时域分析员。你的职责是帮助学生按流程完成时域综合验证。
在教学过程中，你应该：
1. 指导学生从稳定范围与稳态误差入手
2. 强调扰动响应与场景性能验证
3. 用简明语言解释分析结果对工程决策的影响`,
    proactive: true,
  },
};

export const LESSON_09_BOPPPS_FLOW: BOPPPSPhaseConfig[] = [
  {
    id: 'bridge-in',
    stage: 'BRIDGE_IN',
    title: '导入：校正让系统更稳更快',
    duration: 4,
    color: 'amber',
    resourceId: 'video-correction-intro',
    componentType: 'video',
  },
  {
    id: 'bridge-poll',
    stage: 'BRIDGE_IN',
    title: '投票：优先改善的指标',
    duration: 3,
    color: 'amber',
    resourceId: 'poll-correction-priority',
    componentType: 'poll',
  },
  {
    id: 'objective',
    stage: 'OBJECTIVE',
    title: '学习目标',
    duration: 4,
    color: 'blue',
    resourceId: 'objective-lesson-09',
    componentType: 'objective',
  },
  {
    id: 'precheck',
    stage: 'PRE_ASSESSMENT',
    title: '前测：校正与时域基础',
    duration: 8,
    color: 'amber',
    resourceId: 'widget-correction-precheck',
    componentType: 'interactive-widget',
  },
  {
    id: 'strategy',
    stage: 'PARTICIPATORY',
    title: '校正手段速览',
    duration: 10,
    color: 'red',
    resourceId: 'card-correction-strategy',
    componentType: 'interactive-widget',
  },
  {
    id: 'synthesis',
    stage: 'PARTICIPATORY',
    title: '时域综合分析流程',
    duration: 10,
    color: 'red',
    resourceId: 'card-time-domain-synthesis',
    componentType: 'interactive-widget',
  },
  {
    id: 'summary',
    stage: 'SUMMARY',
    title: '总结与复盘',
    duration: 5,
    color: 'slate',
    resourceId: 'card-lesson-summary',
    componentType: 'interactive-widget',
  },
];
