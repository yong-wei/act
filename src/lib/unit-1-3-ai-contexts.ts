import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_1_3_COURSE_META = {
  courseId: 'unit-1-3-time-domain-response-v1',
  courseTitle: '1-3：时域响应分析——从响应曲线到动态性能指标',
  courseDescription:
    '围绕单位阶跃响应、一阶与二阶系统标准型及四个关键时域指标，建立从响应曲线到动态品质判断的第一套语言。',
  keyConcepts: ['单位阶跃响应', '时间常数', '二阶系统标准型', '阻尼比', '上升时间', '超调量', '调节时间'],
} as const;

function context(
  stepId: string,
  topic: string,
  pageType: AIContextConfig['pageType'],
  learningObjectives: string[],
  quickQuestions: Array<{ label: string; question: string }>,
  systemPromptExtension: string,
): AIContextConfig {
  return {
    enabled: true,
    courseId: UNIT_1_3_COURSE_META.courseId,
    courseTitle: UNIT_1_3_COURSE_META.courseTitle,
    pageType,
    stepId,
    topic,
    learningObjectives,
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions,
    systemPromptExtension,
  };
}

export const UNIT_1_3_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：从闭环传递函数走向响应曲线',
    'theory',
    ['理解 1-3 承接 1-2 的位置', '把注意力从结构化简推进到动态品质判断'],
    [
      { label: '承接关系', question: '为什么学完 1-2 之后自然会进入 1-3？' },
      { label: '本课任务', question: '这节课要新增的分析语言是什么？' },
    ],
    '当前步骤只做主线定位。请把学生拉回“先有闭环传递函数，才能进一步讨论响应曲线、快慢与超调”这条线索，不要直接跳到公式推导。',
  ),
  'step-02': context(
    'step-02',
    '稳定并不等于表现一样',
    'quiz',
    ['比较两条稳定曲线的动态品质差异', '理解动态过程必须纳入评价'],
    [
      { label: '稳定之外', question: '为什么两个稳定系统仍然可能一个好用一个难用？' },
      { label: '评价维度', question: '除了稳定，还应该评价哪些动态品质？' },
    ],
    '当前步骤只帮助学生解释“为什么动态过程重要”，不要代替投票作答。把焦点放在速度、超调、平稳性与操作者感受上。',
  ),
  'step-03': context(
    'step-03',
    '会看、会算、会连：本课学习目标',
    'theory',
    ['明确响应曲线判读、指标计算、极点桥接三类任务'],
    [
      { label: '会看', question: '“会看响应曲线”具体指什么？' },
      { label: '会连', question: '为什么时域指标还要和极点联系起来？' },
    ],
    '当前步骤用于明确目标，不要展开长篇计算。请帮助学生把“看曲线、算指标、连极点”三件事区分清楚。',
  ),
  'step-04': context(
    'step-04',
    '前测：快、稳、冲分别看什么',
    'quiz',
    ['暴露稳定性、速度、超调等概念混淆'],
    [
      { label: '易错点', question: '稳定和无超调为什么不是一回事？' },
      { label: '时间常数', question: '时间常数变大时通常意味着什么？' },
    ],
    '当前步骤只能帮助学生理解题意和错因，不直接给答案。重点指出：稳定不等于无超调，快不等于稳，指标之间需要分别命名。',
  ),
  'step-05': context(
    'step-05',
    '时域分析对象与典型输入',
    'practice',
    ['区分脉冲、阶跃、斜坡输入', '理解本课默认研究单位阶跃响应'],
    [
      { label: '默认场景', question: '为什么本课把单位阶跃作为默认分析对象？' },
      { label: '输入区别', question: '单位脉冲、阶跃、斜坡各适合回答什么问题？' },
    ],
    '请帮助学生建立“输入不同，回答的问题也不同”的认知，并明确本课几乎所有性能指标默认都建立在单位阶跃响应上。',
  ),
  'step-06': context(
    'step-06',
    '一阶系统阶跃响应与时间常数',
    'workspace',
    ['理解 c(t)=K(1-e^{-t/T}) 的时间尺度含义', '抓住 t=T 时达到 63.2% 终值的锚点'],
    [
      { label: '63.2%', question: '为什么 t=T 时恰好达到终值的 63.2%？' },
      { label: 'T 变大', question: '时间常数 T 变大后，响应曲线会怎样变化？' },
    ],
    '当前步骤依赖观察与判断。请围绕“同样终值下，T 改变的是时间尺度而不是最终高度”来解释，避免把时间常数讲成纯记忆公式。',
  ),
  'step-07': context(
    'step-07',
    '二阶系统标准型：wn、zeta、wd',
    'practice',
    ['理解三个参数分别控制什么现象', '能把参数、数学式和曲线现象对应起来'],
    [
      { label: 'wn', question: '自然频率 wn 首先决定系统的什么尺度？' },
      { label: 'zeta', question: '阻尼比 zeta 为什么决定振荡品质？' },
    ],
    '请把三个参数分别对应到“时间尺度、衰减品质、实际振荡节奏”，避免把它们混成一个概念。',
  ),
  'step-08': context(
    'step-08',
    '四种响应家族对比',
    'workspace',
    ['把四类响应看成阻尼比连续变化的一条谱', '能用工程语言描述不同家族的优缺点'],
    [
      { label: '连续谱', question: '为什么四种响应家族不是四张孤立图片？' },
      { label: '工程语言', question: '欠阻尼、临界阻尼、过阻尼分别怎样用工程语言描述？' },
    ],
    '当前步骤重点是比较，不是背结论。请帮助学生把阻尼比变化与“振荡、最快无振荡、过慢”这些语言连起来。',
  ),
  'step-09': context(
    'step-09',
    '动态性能指标总览',
    'theory',
    ['用自然语言说清四个指标分别在评价什么'],
    [
      { label: '四指标', question: '上升时间、峰值时间、超调量、调节时间分别在评价什么？' },
      { label: '全景先行', question: '为什么要先看全景再分别推导？' },
    ],
    '请把四个指标解释成四类问题：起步快不快、第一次冲顶多快、冲过头多少、多久真正稳定。先帮学生建立语言，再进入推导。',
  ),
  'step-10': context(
    'step-10',
    '上升时间的定义与推导',
    'practice',
    ['理解欠阻尼情形下“第一次到达终值”的定义', '判断 wn 对 tr 的影响'],
    [
      { label: '定义', question: '为什么欠阻尼系统常把上升时间定义为第一次到达终值？' },
      { label: '参数影响', question: '当 wn 增大而 zeta 不变时，tr 会怎样变化？' },
    ],
    '请先帮助学生理解定义，再谈公式变化。不要只报答案，要把“时间尺度变小，所以更快到达终值”说清楚。',
  ),
  'step-11': context(
    'step-11',
    '峰值时间与超调量',
    'practice',
    ['区分 tp 与 Mp 的物理意义', '抓住 Mp 主要由 zeta 决定这一结论'],
    [
      { label: 'tp', question: '峰值时间在曲线上具体指哪个时刻？' },
      { label: 'Mp', question: '为什么说超调量主要由 zeta 决定？' },
    ],
    '当前步骤请帮助学生把“峰值出现得多快”和“峰值冲过头多少”严格区分开，并反复提醒 Mp 对 wn 不敏感、对 zeta 更敏感。',
  ),
  'step-12': context(
    'step-12',
    '调节时间与误差带',
    'workspace',
    ['理解误差带定义和工程近似', '把注意力放到极点实部决定的衰减速度上'],
    [
      { label: '误差带', question: '2% 和 5% 误差带下，调节时间为什么会不同？' },
      { label: '极点实部', question: '为什么调节时间本质上看极点实部？' },
    ],
    '请把“进入误差带且此后保持在带内”讲清楚，并说明工程近似式的价值是快速估算，而不是替代定义本身。',
  ),
  'step-13': context(
    'step-13',
    '例题一：已知参数求指标',
    'practice',
    ['掌握从标准型参数顺推四指标的解题顺序'],
    [
      { label: '先后顺序', question: '为什么通常先读 wn、zeta，再求 wd？' },
      { label: '敏感量', question: '四个指标里哪些量最依赖 zeta，哪些更依赖 wn？' },
    ],
    '当前步骤重点是解题组织。请鼓励学生先列结构化步骤，再代数代值，避免一开始就把多个公式混用。',
  ),
  'step-14': context(
    'step-14',
    '例题二：由指标反推参数区域 + AI 对照',
    'reflection',
    ['先独立把指标约束翻译成参数约束', '再用 AI 核对推理链而不是直接抄答案'],
    [
      { label: '先手算', question: '把“超调量不超过 10%”翻译成 zeta 约束时应怎样想？' },
      { label: 'AI 对照', question: '和 AI 比较时，最应该核对的是结果还是推理链？' },
    ],
    '当前步骤必须坚持“先个人判断、后 AI 对照”。AI 的职责是核对指标到参数区域的推理路径，并指出哪里漏掉了约束，不是直接替学生给结论。',
  ),
  'step-15': context(
    'step-15',
    '从时域指标走向极点区域',
    'reflection',
    ['把快慢、超调、阻尼品质翻译成复平面极点区域'],
    [
      { label: '更快', question: '为什么“更快”通常对应极点整体向左？' },
      { label: '更小超调', question: '为什么“更小超调”通常要求更大的阻尼比？' },
    ],
    '请把时域语言和极点语言建立一一对应：更快看实部，更小超调看阻尼比，更稳健看区域而不是单个点。',
  ),
  'step-16': context(
    'step-16',
    '后测：公式会算，更要会解释',
    'quiz',
    ['检查是否能把公式结果翻译回系统动态品质'],
    [
      { label: '解释能力', question: '为什么后测不仅看会不会代公式，还看会不会解释结果？' },
      { label: '错因定位', question: '如果算对了公式却解释错了，通常卡在哪里？' },
    ],
    '当前步骤请帮助学生定位错因：是公式记忆、参数读取、还是工程语言翻译出现了偏差。不要直接替他们完成整份后测。',
  ),
  'step-17': context(
    'step-17',
    '总结与前瞻：从时域指标走向极点与设计',
    'summary',
    ['压缩本课关键词', '把视角推进到极点区域与后续设计问题'],
    [
      { label: '关键词', question: '这一课最关键的几个关键词是什么？' },
      { label: '后续课程', question: '为什么学完 1-3 后，自然会继续讨论极点与设计约束？' },
    ],
    '当前步骤用于收束与迁移。请帮助学生把本课从“会看曲线”提升到“会把时域指标连到极点与后续设计”的层面。',
  ),
};

export function getUnit13StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_1_3_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit13StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_1_3_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_1_3StepAIContext = getUnit13StepAIContext;
export const getUNIT_1_3StepQuickQuestions = getUnit13StepQuickQuestions;
