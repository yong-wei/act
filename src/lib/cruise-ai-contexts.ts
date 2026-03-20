/**
 * Cruise Comfort课程各步骤AI上下文配置
 *
 * 每个步骤的AI上下文配置，包含主题、学习目标、核心概念等
 * 用于全局AI助手框架动态读取当前步骤的上下文
 */

import type { AIContextConfig } from '@/types/ai-context';

/**
 * Cruise课程元信息
 */
export const CRUISE_COURSE_META = {
  courseId: 'cruise-comfort-boppps',
  courseTitle: '柔性之海：豪华邮轮舒适度控制',
  courseDescription:
    '围绕豪华邮轮航向-舒适度耦合对象，通过工程目标设定、参数探索、AI介入分析、提示词优化、反思调整等环节，培养控制设计思维。',
  keyConcepts: ['舒适度控制', '侧向加速度', 'PID控制', '工程约束', '三域联动', 'AI伴学', '一致性校验'],
} as const;

/**
 * Cruise各步骤AI上下文配置映射
 * key: stepId, value: AIContextConfig
 */
export const CRUISE_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  // Step 01: Bridge-in - 课堂码发放
  'class-code': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'class-code',
    topic: '课堂码发放：加入精品课堂',
    learningObjectives: [
      '了解课堂参与方式',
      '理解双端同步机制',
      '准备进入学习流程',
    ],
    knowledgeType: 'C',
    tools: ['get_lesson_overview', 'explain_concept'],
    quickQuestions: [
      { label: '课堂机制', question: '这个课堂是如何组织的？' },
      { label: '双端同步', question: '教师端和学生端如何同步？' },
      { label: '学习准备', question: '我需要准备什么？' },
    ],
    systemPromptExtension:
      '当前是课堂启动环节，教师发布课堂码，学生通过课堂码加入。本课采用双端同步机制：教师控制环节节奏，学生保留自己的工作区与学习记录。强调这是精品互动课堂，需要在仿真环境中完成控制设计任务。',
  },

  // Step 02: Bridge-in - 开场导入
  'bridge': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'bridge',
    topic: '开场导入：邮轮舒适度冲突',
    learningObjectives: [
      '理解"速度vs舒适"的工程约束冲突',
      '建立豪华邮轮控制设计的工程背景',
      '激发学习动机',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '工程冲突', question: '邮轮控制中的核心冲突是什么？' },
      { label: '约束条件', question: '有哪些关键的工程约束？' },
      { label: '设计目标', question: '控制设计的目标是什么？' },
    ],
    systemPromptExtension:
      '当前环节通过播放导入视频，明确"速度vs舒适"的工程约束冲突。豪华邮轮控制需要在响应速度（调节时间）和乘客舒适度（侧向加速度）之间找到平衡。关键约束：超调≤12%、调节时间≤65s、侧向加速度<0.15g（舒适线）、<0.2g（安全红线）。',
  },

  // Step 03: Objective - 个性化目标
  'objective': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'objective',
    topic: '个性化目标：布鲁姆动词驱动',
    learningObjectives: [
      '理解布鲁姆动词分层（识别、解释、分析、设计、评估、优化）',
      '获得个性化的能力点目标',
      '明确本节课的学习路径',
    ],
    knowledgeType: 'C',
    tools: ['explain_objectives', 'provide_guidance'],
    quickQuestions: [
      { label: '布鲁姆分层', question: '布鲁姆动词的六个层次是什么？' },
      { label: '能力画像', question: '我的能力薄弱点是什么？' },
      { label: '个性化目标', question: '针对我的薄弱点，目标是什么？' },
    ],
    systemPromptExtension:
      '当前环节基于前测结果生成个性化目标。布鲁姆动词分层：识别→解释→分析→设计→评估→优化。系统根据学生的能力画像（极点-时域映射、频域稳定判读、工程约束表达、参数整定收敛四个维度），识别最薄弱的能力点，生成针对性的学习目标。',
  },

  // Step 04: Pre-assessment - 快速前测
  'precheck': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'precheck',
    topic: '快速前测：2道自适应题',
    learningObjectives: [
      '诊断四个能力点的当前水平',
      '绑定最薄弱的能力点',
      '为个性化目标提供依据',
    ],
    knowledgeType: 'C',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '前测目的', question: '前测如何影响我的学习目标？' },
      { label: '能力点', question: '四个能力点分别是什么？' },
      { label: '薄弱点', question: '如何针对薄弱能力提升？' },
    ],
    systemPromptExtension:
      '当前是前测环节，2道自适应选择题针对最可能薄弱的能力点。题目来自题库，涉及：极点-时域映射（主导极点靠近虚轴的影响）、频域稳定判读（相位裕度过低的风险）、工程约束表达（乘客安全相关约束）、参数整定收敛（超调过大时的调整）。结果用于生成个性化目标。',
  },

  // Step 05: Participatory - 工程目标设定
  'engineering-target': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'engineering-target',
    topic: '工程目标设定：约束翻译',
    learningObjectives: [
      '把工程需求翻译为可计算约束',
      '理解约束不是越严越好',
      '检查目标的可实现性',
    ],
    knowledgeType: 'X',
    tools: ['explain_task', 'provide_guidance', 'analyze_design'],
    quickQuestions: [
      { label: '约束翻译', question: '如何把工程需求转为计算约束？' },
      { label: '目标设定', question: '设定目标时应注意什么？' },
      { label: '舒适线红线', question: '0.15g舒适线和0.2g红线是什么？' },
    ],
    systemPromptExtension:
      '当前环节是设计的第一步：工程目标设定。在仿真界面的"评估"标签下，填写四类约束：超调量σ%、调节时间ts、稳态误差ess、最大侧向加速度。关键原则：约束不是越严越好，要可实现；侧向加速度必须控制在0.15g舒适线以内，关注0.2g安全红线；避免"既要极快又要极稳"的矛盾目标。',
  },

  // Step 06: Participatory - 第一轮参数探索
  'first-exploration': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'first-exploration',
    topic: '第一轮参数探索：制造一次失败',
    learningObjectives: [
      '观察复平面、时域、频域的同步变化',
      '至少触发一次约束违反并记录',
      '建立跨域映射直觉',
    ],
    knowledgeType: 'X',
    tools: ['get_simulation_status', 'analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: '三域联动', question: '三个域如何同步变化？' },
      { label: '失败价值', question: '为什么要主动制造失败？' },
      { label: '参数描述', question: '如何用阻尼比/自然频率描述变化？' },
    ],
    systemPromptExtension:
      '当前环节的核心是"先大胆试错，再解释为什么错"。在仿真控制面板调整Kp、Ki、Kd，观察下方多表征联动（复平面极点、时域响应、Bode图）。任务：至少触发一次约束违反（如超调过大或侧向加速度超标），并记录导致失败的参数方向。失败是建立映射关系的入口。',
  },

  // Step 07: Participatory - NeuralODE嵌入（教师）
  'neural-ode': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'neural-ode',
    topic: 'NeuralODE嵌入：前沿技术展示',
    learningObjectives: [
      '了解NeuralODE在控制中的应用',
      '建立传统控制与AI结合的视野',
      '激发对前沿技术的兴趣',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'preview_next'],
    quickQuestions: [
      { label: 'NeuralODE', question: 'NeuralODE是什么？' },
      { label: '应用价值', question: 'NeuralODE在控制中有什么应用？' },
      { label: '技术前景', question: 'AI与传统控制如何结合？' },
    ],
    systemPromptExtension:
      '当前环节是前沿技术展示（教师端），介绍NeuralODE（神经微分方程）在控制系统建模中的应用。NeuralODE用神经网络学习系统的动态方程，可以处理传统模型难以描述的非线性、时变特性。学生端继续在工作区操作，不受此环节影响。',
  },

  // Step 08: Participatory - AI介入分析
  'ai-analysis': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'ai-analysis',
    topic: 'AI介入分析：诊断失败原因',
    learningObjectives: [
      '用AI诊断当前参数的问题',
      '把AI建议映射到极点移动方向',
      '掌握AI辅助设计的方法',
    ],
    knowledgeType: 'X',
    tools: ['get_ai_assistance', 'analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: 'AI诊断', question: '如何让AI诊断当前参数？' },
      { label: '建议映射', question: '如何把AI建议转为极点移动？' },
      { label: '决策权', question: 'AI建议是否应该直接照做？' },
    ],
    systemPromptExtension:
      '当前环节引入AI伴学：在"AI伴学"标签下，记录失败的尝试，触发AI分析。AI会读取当前参数、失败约束、偏差幅度，给出诊断建议。核心原则：AI负责诊断与建议，人负责决策与取舍。必须把AI建议翻译为极点变化方向（如"增大Kd"对应"极点左移、阻尼增大"）后再决定是否采用。',
  },

  // Step 09: Participatory - 结构化提示词修改
  'prompt-refine': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'prompt-refine',
    topic: '结构化提示词修改：清晰表达设计意图',
    learningObjectives: [
      '按"对象→目标→约束→策略"四段式改写提示词',
      '把模糊意图转为可执行提示词',
      '理解高质量提示词的特征',
    ],
    knowledgeType: 'D',
    tools: ['get_ai_assistance', 'provide_guidance'],
    quickQuestions: [
      { label: '四段式', question: '结构化提示词的四段式是什么？' },
      { label: '量化目标', question: '目标为什么要量化？' },
      { label: '安全红线', question: '提示词中为什么要显式写出0.2g红线？' },
    ],
    systemPromptExtension:
      '当前环节训练提示词工程能力：按"对象→目标→约束→策略"四段式重写提示词。对象信息（系统类型、关键参数）、目标（必须有数值与单位，如σ%≤12%，ts≤65s）、约束（必须包含0.2g安全红线）、策略（与失败原因匹配）。高质量提示词不是"求答案"，而是清晰表达设计意图。',
  },

  // Step 10: Participatory - 暂停反思
  'pause-reflection': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'reflection',
    stepId: 'pause-reflection',
    topic: '暂停反思：口头表达设计逻辑',
    learningObjectives: [
      '暂停操作，整理思路',
      '口头表达设计逻辑与风险判断',
      '区分"结果偶然达标"与"逻辑一致达标"',
    ],
    knowledgeType: 'D',
    tools: ['provide_guidance'],
    quickQuestions: [
      { label: '策略倾向', question: '你的策略倾向是什么？' },
      { label: '极点解释', question: '如何解释极点位置与性能的关系？' },
      { label: '边界约束', question: '最接近边界的约束是什么？' },
    ],
    systemPromptExtension:
      '当前环节是反思暂停：停止操作，口头或书面表达当前的设计逻辑。核心问题：1)你的策略倾向（速度优先、舒适优先或均衡）；2)闭环极点位置与σ%、ts的对应关系；3)最接近边界的约束及风浪增大后的风险。关键区分：你的方案是"结果偶然达标"还是"逻辑一致达标"？',
  },

  // Step 11: Participatory - 反思调整
  'adjustment': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'adjustment',
    topic: '反思调整：保留-调整-验证闭环',
    learningObjectives: [
      '完成一次"保留-调整-验证"迭代',
      '只做可解释的调整',
      '避免多变量混改',
    ],
    knowledgeType: 'X',
    tools: ['analyze_design', 'provide_hints'],
    quickQuestions: [
      { label: '保留项', question: '哪项决策是有效的，为什么？' },
      { label: '调整原则', question: '为什么要只调一个参数？' },
      { label: '验证指标', question: '如何确认调整成功？' },
    ],
    systemPromptExtension:
      '当前环节是迭代调整：基于反思完成一次"保留-调整-验证"闭环。保留一项有效决策（明确它为何有效），只调整一个关键参数（避免多变量混改，否则无法归因），指定一个验证指标（确认调整是否成功）。优先做可解释调整，而不是盲目追求分数。',
  },

  // Step 12: Participatory/P3 - 一致性校验
  'consistency': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'consistency',
    topic: '一致性校验：目标-行为-结果对齐',
    learningObjectives: [
      '校验"目标表达→调参行为→结果达成"三层一致性',
      '识别并修正偏差',
      '理解高分但逻辑不自洽的问题',
    ],
    knowledgeType: 'D',
    tools: ['analyze_design', 'provide_guidance'],
    quickQuestions: [
      { label: '三层对齐', question: '哪三层需要对齐？' },
      { label: '偏差识别', question: '如何识别目标与行为的偏离？' },
      { label: '分数与逻辑', question: '高分但逻辑不自沏算好方案吗？' },
    ],
    systemPromptExtension:
      '当前环节是评价核心：一致性校验。检查三层对齐：1)目标和行为是否一致（你写了什么，做了什么）；2)行为和结果是否一致（为什么没达到预期）；3)针对黄色/红色偏差，修正提示词或参数策略。评价核心是控制思维自洽性，而不只是最终分数。',
  },

  // Step 13: Participatory - 小组对比
  'group-compare': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'group-compare',
    topic: '小组对比：激进vs舒适策略',
    learningObjectives: [
      '对比两组方案的多维差异',
      '判断鲁棒余量与安全性',
      '给出可辩护的工程取舍',
    ],
    knowledgeType: 'X',
    tools: ['analyze_design', 'provide_guidance'],
    quickQuestions: [
      { label: '对比维度', question: '从哪些维度对比两组方案？' },
      { label: '安全边界', question: '谁更接近安全边界？' },
      { label: '工程取舍', question: '你愿意承担什么代价？' },
    ],
    systemPromptExtension:
      '当前环节是工程决策训练：对比激进（快速但可能超调大）与舒适（稳健但可能较慢）两类策略。对比维度：ζ、σ%、ts、alat（侧向加速度）、相位裕度。判断谁更接近安全边界（0.2g红线），谁在扰动下更有余量。核心问题：如果真实邮轮载有5000名乘客，你会选择哪组方案？',
  },

  // Step 14: Summary - 收尾总结
  'summary': {
    enabled: true,
    courseId: CRUISE_COURSE_META.courseId,
    courseTitle: CRUISE_COURSE_META.courseTitle,
    pageType: 'summary',
    stepId: 'summary',
    topic: '收尾总结：控制是对后果负责',
    learningObjectives: [
      '回顾本节课的核心收获',
      '查看个性化目标达成情况',
      '建立"控制即责任"的工程伦理',
    ],
    knowledgeType: 'C',
    tools: ['summarize_lesson'],
    quickQuestions: [
      { label: '核心收获', question: '本节课的核心收获是什么？' },
      { label: '目标达成', question: '我的个性化目标达成了吗？' },
      { label: '控制责任', question: '为什么说"控制是对后果负责"？' },
    ],
    systemPromptExtension:
      '当前环节是课程收束：教师查看班级目标达成，学生查看个性化目标达成。核心收获：1)识别极点、时域、频域的联动关系；2)设计满足舒适度约束的控制参数；3)评估目标、行为、结果的一致性。收尾金句："今天我们选择了安全。控制，不只是计算，更是对系统后果负责。"',
  },
};

/**
 * 获取指定步骤的AI上下文配置
 */
export function getCruiseStepAIContext(stepId: string): AIContextConfig | null {
  return CRUISE_STEP_AI_CONTEXTS[stepId] || null;
}

/**
 * 获取当前步骤的快捷问题列表
 */
export function getCruiseStepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  const context = CRUISE_STEP_AI_CONTEXTS[stepId];
  return context?.quickQuestions || [];
}
