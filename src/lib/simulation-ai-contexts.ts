/**
 * 仿真页面AI上下文配置
 *
 * 7个仿真场景的AI助手配置
 */

import type { AIContextConfig } from '@/types/ai-context';

/**
 * 仿真场景元信息
 */
export const SIMULATION_COURSE_META = {
  courseId: 'simulation',
  courseTitle: '船舶控制仿真',
  courseDescription:
    '基于Nomoto船舶模型的交互式控制仿真，支持PID参数调节、波浪扰动模拟和性能指标分析。',
  keyConcepts: ['PID控制', 'Nomoto模型', '超调量', '调节时间', '阶跃响应', '波浪扰动'],
} as const;

/**
 * 仿真场景配置映射
 * key: simulationType, value: AIContextConfig
 */
export const SIMULATION_AI_CONTEXTS: Record<string, AIContextConfig> = {
  // 军用驱逐舰
  destroyer: {
    enabled: true,
    courseId: SIMULATION_COURSE_META.courseId,
    courseTitle: '军用驱逐舰战术机动仿真',
    pageType: 'workspace',
    stepId: 'destroyer',
    topic: '055型驱逐舰航向控制',
    learningObjectives: [
      '掌握PID控制器在船舶航向控制中的应用',
      '理解Nomoto一阶模型参数K和T的物理意义',
      '学会通过超调量和调节时间评估系统性能',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
    quickQuestions: [
      { label: '仿真状态', question: '请获取当前的仿真状态' },
      { label: 'PID原理', question: '请解释PID控制器的工作原理' },
      { label: '诺莫托模型', question: '什么是诺莫托船舶模型？' },
      { label: '调参建议', question: '如何调整PID参数？' },
    ],
    systemPromptExtension:
      '当前是军用驱逐舰航向控制仿真场景。055型驱逐舰采用Nomoto一阶模型，典型参数K=0.08，T=55s。学生可以调节PID参数（Kp, Ki, Kd）和波浪扰动参数，观察阶跃响应曲线和性能指标（超调量Mp、调节时间ts）。引导学生理解：1)Kp影响响应速度和超调；2)Ki消除稳态误差但可能增加超调；3)Kd抑制振荡但可能放大噪声。',
  },

  // 集装箱船
  container: {
    enabled: true,
    courseId: SIMULATION_COURSE_META.courseId,
    courseTitle: '集装箱船航线保持仿真',
    pageType: 'workspace',
    stepId: 'container',
    topic: '集装箱船航线保持控制',
    learningObjectives: [
      '理解大型商船的慢动态特性',
      '掌握大惯性系统的PID参数整定方法',
      '分析负载变化对控制性能的影响',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
    quickQuestions: [
      { label: '船舶特性', question: '集装箱船的动态特性有什么特点？' },
      { label: '大惯性系统', question: '大惯性系统如何整定PID参数？' },
      { label: '负载影响', question: '负载变化如何影响控制性能？' },
    ],
    systemPromptExtension:
      '当前是集装箱船航线保持仿真场景。集装箱船具有大惯性、慢动态的特点，Nomoto模型参数通常为K=0.05，T=80s。与驱逐舰相比，集装箱船响应更慢，需要更长的调节时间。引导学生关注大惯性系统的特殊挑战：1)响应延迟大；2)积分饱和风险；3)参数整定需要更保守。',
  },

  // 豪华邮轮
  cruise: {
    enabled: true,
    courseId: SIMULATION_COURSE_META.courseId,
    courseTitle: '豪华邮轮舒适度控制仿真',
    pageType: 'workspace',
    stepId: 'cruise',
    topic: '邮轮舒适度约束控制',
    learningObjectives: [
      '理解舒适度约束（侧向加速度）在控制设计中的重要性',
      '掌握多目标优化思路',
      '分析响应速度与舒适度的权衡关系',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
    quickQuestions: [
      { label: '舒适度约束', question: '什么是舒适度约束？' },
      { label: '多目标权衡', question: '如何权衡响应速度和舒适度？' },
      { label: '优化思路', question: '多目标优化的基本思路是什么？' },
    ],
    systemPromptExtension:
      '当前是豪华邮轮舒适度控制仿真场景。邮轮控制的核心矛盾是"速度vs舒适"：提高响应速度会增加侧向加速度，降低乘客舒适度。关键约束：侧向加速度<0.15g（舒适线）。引导学生理解工程约束下的参数优化：1)确定约束边界；2)在可行域内寻找最优；3)理解Pareto最优概念。',
  },

  // 挖泥船
  dredger: {
    enabled: true,
    courseId: SIMULATION_COURSE_META.courseId,
    courseTitle: '挖泥船作业定位仿真',
    pageType: 'workspace',
    stepId: 'dredger',
    topic: '挖泥船动力定位控制',
    learningObjectives: [
      '理解动力定位（DP）系统的基本原理',
      '掌握扰动补偿控制方法',
      '分析外部力（潮流、风力）对定位精度的影响',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
    quickQuestions: [
      { label: '动力定位', question: '什么是动力定位系统？' },
      { label: '扰动补偿', question: '如何进行扰动补偿控制？' },
      { label: '外部力影响', question: '外部力如何影响定位精度？' },
    ],
    systemPromptExtension:
      '当前是挖泥船动力定位仿真场景。挖泥船需要在作业点精确定位，抵抗潮流和风力的扰动。引导学生理解：1)动力定位系统的组成；2)前馈补偿与反馈控制的结合；3)扰动估计与补偿策略。',
  },

  // 钻井平台
  drilling: {
    enabled: true,
    courseId: SIMULATION_COURSE_META.courseId,
    courseTitle: '海上钻井平台位置保持仿真',
    pageType: 'workspace',
    stepId: 'drilling',
    topic: '钻井平台位置保持控制',
    learningObjectives: [
      '理解高精度位置保持的工程需求',
      '掌握多推进器协调控制原理',
      '分析风标效应及其补偿方法',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
    quickQuestions: [
      { label: '位置保持', question: '钻井平台为什么需要高精度位置保持？' },
      { label: '多推进器', question: '多推进器如何协调控制？' },
      { label: '风标效应', question: '什么是风标效应？' },
    ],
    systemPromptExtension:
      '当前是海上钻井平台位置保持仿真场景。钻井平台需要在海流、风、波浪的综合扰动下保持位置精度（通常要求<5%水深）。引导学生理解：1)推力分配策略；2)风标效应的产生机理；3)高精度控制的挑战。',
  },

  // 破冰船
  icebreaker: {
    enabled: true,
    courseId: SIMULATION_COURSE_META.courseId,
    courseTitle: '破冰船冰区操纵仿真',
    pageType: 'workspace',
    stepId: 'icebreaker',
    topic: '破冰船冰区操纵控制',
    learningObjectives: [
      '理解冰区操纵的特殊动力学特性',
      '掌握非结构化环境下的控制策略',
      '分析冰阻力对操纵性的影响',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
    quickQuestions: [
      { label: '冰区操纵', question: '冰区操纵有什么特殊之处？' },
      { label: '非结构化环境', question: '非结构化环境下如何设计控制策略？' },
      { label: '冰阻力', question: '冰阻力如何影响船舶操纵性？' },
    ],
    systemPromptExtension:
      '当前是破冰船冰区操纵仿真场景。破冰船在冰区航行时面临非连续、非线性的冰阻力，动力学特性复杂。引导学生理解：1)冰阻力的随机特性；2)破冰船的特殊设计（船首形状、推进器布置）；3)适应非结构化环境的控制策略。',
  },

  // LNG运输船
  lng: {
    enabled: true,
    courseId: SIMULATION_COURSE_META.courseId,
    courseTitle: 'LNG运输船安全航线仿真',
    pageType: 'workspace',
    stepId: 'lng',
    topic: 'LNG运输船安全控制',
    learningObjectives: [
      '理解危险品运输船的特殊安全约束',
      '掌握保守控制策略设计',
      '分析货物特性对操纵的影响',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
    quickQuestions: [
      { label: '安全约束', question: 'LNG运输船有哪些特殊安全约束？' },
      { label: '保守控制', question: '如何设计保守控制策略？' },
      { label: '货物影响', question: 'LNG货物特性如何影响操纵？' },
    ],
    systemPromptExtension:
      '当前是LNG运输船安全航线仿真场景。LNG运输船运输易燃易爆的液化天然气，安全要求极高。引导学生理解：1)危险品运输的特殊约束；2)保守控制与响应性能的平衡；3)晃荡效应（sloshing）对船舶稳性的影响。',
  },
};

/**
 * 根据仿真类型获取AI上下文配置
 */
export function getSimulationAIContext(simulationType: string): AIContextConfig | null {
  return SIMULATION_AI_CONTEXTS[simulationType] ?? null;
}

/**
 * 获取仿真场景的快捷问题列表
 */
export function getSimulationQuickQuestions(simulationType: string): Array<{ label: string; question: string }> {
  const context = SIMULATION_AI_CONTEXTS[simulationType];
  return context?.quickQuestions ?? [];
}
