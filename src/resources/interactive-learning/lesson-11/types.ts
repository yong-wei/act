/**
 * Lesson-11 参数根轨迹与图形化思考 类型定义
 *
 * 课程主题：参数根轨迹广义定义与图形化思考
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
  'root-locus-navigator': {
    id: 'root-locus-navigator',
    name: 'Root Locus Navigator',
    nameChinese: '根轨迹领航员',
    role: '引导学生理解参数根轨迹与图形化思考路径',
    systemPrompt: `你是根轨迹领航员。你的职责是帮助学生建立“参数变化-闭环极点-性能边界”的图形化思维。
在教学过程中，你应该：
1. 用直观语言解释参数根轨迹的广义定义
2. 引导学生完成等效开环变换与稳定范围判断
3. 强调主导极点、阻尼比与响应品质之间的对应关系
4. 鼓励学生用图形化流程描述分析步骤`,
    proactive: true,
  },
  'parameter-analyst': {
    id: 'parameter-analyst',
    name: 'Parameter Analyst',
    nameChinese: '参数分析员',
    role: '协助学生计算参数稳定范围并验证性能',
    systemPrompt: `你是参数分析员。你的职责是帮助学生把参数根轨迹落实到稳定范围与性能验证。
在教学过程中，你应该：
1. 指导学生识别等效开环增益与传递函数
2. 强调虚轴交点与稳定边界的判定
3. 结合响应曲线判断超调、阻尼与速度
4. 提醒使用仿真或计算工具进行验证`,
    proactive: true,
  },
};

export const LESSON_11_BOPPPS_FLOW: BOPPPSPhaseConfig[] = [
  {
    id: 'bridge-in',
    stage: 'BRIDGE_IN',
    title: '导入：参数变化的根轨迹难题',
    duration: 4,
    color: 'violet',
    resourceId: 'video-lesson-11-intro',
    componentType: 'video',
  },
  {
    id: 'bridge-poll',
    stage: 'BRIDGE_IN',
    title: '投票：参数根轨迹的卡点',
    duration: 4,
    color: 'violet',
    resourceId: 'poll-lesson-11-pain',
    componentType: 'poll',
  },
  {
    id: 'objective',
    stage: 'OBJECTIVE',
    title: '学习目标',
    duration: 4,
    color: 'blue',
    resourceId: 'objective-lesson-11',
    componentType: 'objective',
  },
  {
    id: 'precheck',
    stage: 'PRE_ASSESSMENT',
    title: '前测：根轨迹图形化思维',
    duration: 8,
    color: 'amber',
    resourceId: 'poll-lesson-11-precheck',
    componentType: 'poll',
  },
  {
    id: 'deck',
    stage: 'PARTICIPATORY',
    title: '知识卡片：参数根轨迹广义定义',
    duration: 22,
    color: 'red',
    resourceId: 'deck-parameter-root-locus',
    componentType: 'interactive-widget',
  },
  {
    id: 'roadmap',
    stage: 'PARTICIPATORY',
    title: '路线图：等效开环思路',
    duration: 4,
    color: 'red',
    resourceId: 'media-lesson11-roadmap',
    componentType: 'static-media',
  },
  {
    id: 'equivalent',
    stage: 'PARTICIPATORY',
    title: '等效开环转化步骤',
    duration: 5,
    color: 'red',
    resourceId: 'media-lesson11-equivalent',
    componentType: 'static-media',
  },
  {
    id: 'workshop',
    stage: 'PARTICIPATORY',
    title: '参与式学习：图形化思考工作坊',
    duration: 18,
    color: 'red',
    resourceId: 'workshop-graphical-thinking',
    componentType: 'interactive-widget',
  },
  {
    id: 'visual-workflow',
    stage: 'PARTICIPATORY',
    title: '流程与验证：图形化判断到仿真验证',
    duration: 5,
    color: 'red',
    resourceId: 'media-lesson11-visual-workflow',
    componentType: 'static-media',
  },
  {
    id: 'postcheck',
    stage: 'POST_ASSESSMENT',
    title: '后测：参数稳定范围判断',
    duration: 8,
    color: 'violet',
    resourceId: 'poll-lesson-11-postcheck',
    componentType: 'poll',
  },
  {
    id: 'summary',
    stage: 'SUMMARY',
    title: '总结与拓展',
    duration: 5,
    color: 'slate',
    resourceId: 'card-lesson-11-summary',
    componentType: 'interactive-widget',
  },
];
