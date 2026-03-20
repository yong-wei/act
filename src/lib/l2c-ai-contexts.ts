/**
 * L2C课程各步骤AI上下文配置
 *
 * 每个步骤的AI上下文配置，包含主题、学习目标、核心概念等
 * 用于全局AI助手框架动态读取当前步骤的上下文
 */

import type { AIContextConfig } from '@/types/ai-context';

/**
 * L2C课程元信息
 */
export const L2C_COURSE_META = {
  courseId: 'l2c-frequency-bode-fasttrack',
  courseTitle: 'L-2c：频域直觉速通 · Bode图与相位裕度初识',
  courseDescription:
    '围绕Bode图、截止频率、相位裕度与三域联动，构建从场景直觉到频域判读再到AI对照的精品互动课堂。',
  keyConcepts: ['Bode图', '截止频率ωc', '相位裕度γ', '幅值裕度Kg', '穿越频率ωg', '稳定裕度', '三域联动'],
} as const;

/**
 * L2C各步骤AI上下文配置映射
 * key: stepId, value: AIContextConfig
 */
export const L2C_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  // Step 01: Bridge-in - 知识地图
  'step-01': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-01',
    topic: '知识地图：三张面孔，今天补上频域',
    learningObjectives: [
      '理解L-2c在层0课程体系中的位置',
      '建立L-2a/L-2b/L-2c/L-2d的递进关系',
      '预览频域作为"第三张面孔"的补全作用',
    ],
    knowledgeType: 'C',
    tools: ['get_lesson_overview', 'explain_concept'],
    quickQuestions: [
      { label: '课程定位', question: 'L-2c在层0中处于什么位置？' },
      { label: '三张面孔', question: '三张面孔分别是什么？' },
      { label: '频域作用', question: '频域视角有什么独特价值？' },
    ],
    systemPromptExtension:
      '当前是课程导入环节，用三次课地图把L-2a（时域）、L-2b（根轨迹）与L-2c（频域）连起来。强调本课是"第三张面孔"——频域直觉，将补足Bode图、截止频率、稳定裕度的认知，为L-2d的三域联动实操做准备。',
  },

  // Step 02: Bridge-in - 场景问题
  'step-02': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-02',
    topic: '场景问题：海浪会把船"压垮"吗？',
    learningObjectives: [
      '从周期性扰动切入频率响应概念',
      '建立"系统对不同频率的抵抗能力"直觉',
      '理解频域的工程意义',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '海浪问题', question: '不同频率的海浪为什么效果不同？' },
      { label: '均衡器类比', question: '音乐均衡器与控制系统有什么相似？' },
      { label: '频域回答', question: '频域如何回答这个问题？' },
    ],
    systemPromptExtension:
      '当前环节从船舶控制场景切入：海浪每隔几秒推一次船头，控制系统能抵抗哪些频率的扰动？用音乐均衡器类比建立直觉：系统对不同频率的输入有不同的"响应简历"。暂不揭晓答案，让学生先记录直觉判断，课程结束时会回看。',
  },

  // Step 03: Objective - 本节目标
  'step-03': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-03',
    topic: '本节目标：从Bode图读出速度与稳定余量',
    learningObjectives: [
      '说出Bode幅频图的通过区、过渡区、衰减区和截止频率ωc',
      '读出截止频率与相位裕度，用γ≈100ζ°预判超调量',
      '明确ωc与ωg是两个不同的频率',
      '说出相位裕度和幅值裕度各衡量什么风险',
    ],
    knowledgeType: 'C',
    tools: ['explain_objectives', 'provide_guidance'],
    quickQuestions: [
      { label: '四项目标', question: '今天的四项目标是什么？' },
      { label: 'Bode区域', question: 'Bode幅频图的三个区域是什么？' },
      { label: '频率区分', question: 'ωc和ωg有什么区别？' },
    ],
    systemPromptExtension:
      '当前环节明确四项目标：1)理解Bode幅频图的三区域（通过区、过渡区、衰减区）和截止频率ωc；2)读出相位裕度γ，用γ≈100ζ°粗估超调量；3)区分ωc和ωg；4)理解相位裕度（振荡风险）和幅值裕度（增益风险）。最后强调ωc与ωg的区别，这是常见混淆点。',
  },

  // Step 04: Pre-assessment - 前测
  'step-04': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'step-04',
    topic: '前测：唤醒阻尼比与超调量',
    learningObjectives: [
      '检验阻尼比与超调量的前置知识',
      '摸底对"频率响应"一词的理解',
      '诊断学习起点',
    ],
    knowledgeType: 'C',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '前测目的', question: '前测的目的是什么？' },
      { label: 'ζ与Mp', question: 'ζ=0.5时，超调量大约是多少？' },
      { label: '频率响应', question: '你对"频率响应"的理解是什么？' },
    ],
    systemPromptExtension:
      '当前是前测环节，两道题摸底：ζ=0.5对应的超调量（L-2a复习，答案约16%）、对"频率响应"的理解（开放题）。若题1正确率偏低，进入新内容前先口头复盘ζ与Mp；开放题重点看学生是否把"频率响应"误解为"响应的频率"。',
  },

  // Step 05: Participatory - Bode幅频图
  'step-05': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-05',
    topic: 'Bode幅频图：系统的"频率简历"',
    learningObjectives: [
      '建立"低频跟踪、高频过滤"的第一直觉',
      '理解通过区、过渡区、衰减区的含义',
      '掌握0dB、正dB、负dB的工程意义',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '三区域', question: 'Bode幅频图的三个区域是什么？' },
      { label: 'dB含义', question: '0dB、正dB、负dB分别代表什么？' },
      { label: '频率简历', question: '为什么把Bode图叫"频率简历"？' },
    ],
    systemPromptExtension:
      '当前环节建立Bode幅频图的第一直觉：把幅频图看成系统面对不同节拍时给出的简历。三区域：通过区（低频跟得上）、过渡区（开始跟不上）、衰减区（高频被过滤）。关键记忆：0dB=放大倍数为1，正dB=放大，负dB=衰减。',
  },

  // Step 06: Participatory - 截止频率ωc
  'step-06': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-06',
    topic: '截止频率ωc：响应速度的频域标志',
    learningObjectives: [
      '理解ωc作为"快慢门槛"的含义',
      '建立ωc与ts的跨域对应关系',
      '理解速度变快的权衡代价',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: 'ωc含义', question: '截止频率ωc代表什么？' },
      { label: '跨域对应', question: 'ωc与ts有什么关系？' },
      { label: '速度权衡', question: '追求更高ωc有什么代价？' },
    ],
    systemPromptExtension:
      '当前环节建立截止频率的核心概念：ωc是从"跟得上"切换到"开始跟不上"的门槛，是系统快慢在频域的说法。跨域对应：ωc↑⇔ts↓（变快），但速度变快通常会挤压稳定余量（相位裕度变小）。船舶控制既要快也要稳，不能一味追求高ωc。',
  },

  // Step 07: Participatory - AI探索①
  'step-07': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-07',
    topic: '[AI探索①] 用AI验证ωc与调节时间的关系',
    learningObjectives: [
      '先有自己的预判',
      '用AI验证ωc与ts的关系',
      '对比预判与AI结论，记录差异',
    ],
    knowledgeType: 'D',
    tools: ['get_ai_assistance', 'explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '验证问题', question: '应该向AI问什么问题？' },
      { label: '关系确认', question: 'ωc与ts的近似关系是什么？' },
      { label: '差异记录', question: '你的预判与AI结论一致吗？' },
    ],
    systemPromptExtension:
      '当前环节是第一次AI探索：学生先回看上一步写下的判断，再向页内AI询问ωc与ts的关系。推荐提示词："二阶控制系统中，截止频率ωc与调节时间ts之间有怎样的近似关系？ωc增大时ts如何变化？"对比预判与AI结论，记录差异和AI给出的条件。',
  },

  // Step 08: Participatory - 记忆唤醒
  'step-08': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-08',
    topic: '记忆唤醒：第一轮速通中的两个裕度',
    learningObjectives: [
      '唤醒相位裕度和幅值裕度的模糊印象',
      '建立"余量"的安全直觉',
      '为精确定义做铺垫',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '裕度印象', question: '你对相位裕度的第一印象是什么？' },
      { label: '余量直觉', question: '"裕度"在工程中意味着什么？' },
      { label: '危险边界', question: '相位裕度接近0°意味着什么？' },
    ],
    systemPromptExtension:
      '当前环节唤醒第一轮速通的旧知识：相位裕度是"相角离危险边界（-180°）还有多远"，幅值裕度是"增益离危险边界（0dB）还有多远"。建立"余量"的安全直觉：裕度越大，系统越稳健；裕度接近0，系统接近失稳。',
  },

  // Step 09: Participatory - 相位裕度γ
  'step-09': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-09',
    topic: '相位裕度γ：在哪里量、量什么',
    learningObjectives: [
      '掌握γ在ωc处测量的位置',
      '理解γ=180°+∠G(jωc)的定义',
      '了解30°~60°的工程经验范围',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '测量位置', question: '相位裕度在哪里测量？' },
      { label: '计算公式', question: 'γ的计算公式是什么？' },
      { label: '工程范围', question: '相位裕度的良好范围是多少？' },
    ],
    systemPromptExtension:
      '当前环节精确定义相位裕度：在截止频率ωc处测量，γ=180°+∠G(jωc)。γ>0表示仍有相位余量，γ=0是临界振荡。工程经验：30°~60°是常用良好范围，45°往往是速度与稳定性折中的典型点。',
  },

  // Step 10: Participatory - 幅值裕度Kg
  'step-10': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-10',
    topic: '幅值裕度Kg：另一维稳定余量',
    learningObjectives: [
      '理解ωg是相频曲线穿越-180°的频率',
      '掌握Kg在ωg处的定义',
      '理解Kg≥6dB的工程要求',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: 'ωg定义', question: '穿越频率ωg是什么？' },
      { label: 'Kg定义', question: '幅值裕度Kg如何定义？' },
      { label: '工程要求', question: '幅值裕度的工程要求是多少？' },
    ],
    systemPromptExtension:
      '当前环节定义幅值裕度：ωg是相频曲线穿越-180°的频率，Kg是在ωg处幅值距离0dB还有多远。工程上常要求Kg≥6dB。强调Kg与γ不可互相替代，一个衡量相位余量，一个衡量增益余量，共同构成系统的稳定裕度。',
  },

  // Step 11: Participatory - 两个频率要分清
  'step-11': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-11',
    topic: '两个频率要分清：ωc≠ωg',
    learningObjectives: [
      '彻底区分ωc和ωg',
      '掌握"哪条曲线穿哪条线"的对应关系',
      '形成记忆口诀',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'summarize_lesson'],
    quickQuestions: [
      { label: 'ωc定义', question: 'ωc对应哪条曲线穿哪条线？' },
      { label: 'ωg定义', question: 'ωg对应哪条曲线穿哪条线？' },
      { label: '记忆口诀', question: '如何记忆ωc和ωg的区别？' },
    ],
    systemPromptExtension:
      '当前环节是防混淆的关键：ωc是幅频曲线穿越0dB的频率，用来定义相位裕度γ；ωg是相频曲线穿越-180°的频率，用来定义幅值裕度Kg。记忆口诀："幅频过零看ωc，相频过-180°看ωg"。建议口头抽答1~2人复述。',
  },

  // Step 12: Participatory - AI探索②
  'step-12': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-12',
    topic: '[AI探索②] 用γ≈100ζ°预测超调量',
    learningObjectives: [
      '先独立估算γ=45°时的ζ和Mp',
      '用AI验证γ与Mp的关系',
      '对比估算与AI结论，记录适用条件',
    ],
    knowledgeType: 'D',
    tools: ['get_ai_assistance', 'explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '估算任务', question: 'γ=45°时，ζ和Mp大约是多少？' },
      { label: 'AI验证', question: 'AI给出的结论是什么？' },
      { label: '近似范围', question: 'γ≈100ζ°在什么范围可靠？' },
    ],
    systemPromptExtension:
      '当前环节是第二次AI探索：学生先独立估算γ=45°时的阻尼比（约0.45）和超调量（约20%），再向AI验证。推荐提示词："二阶系统相位裕度45度时，超调量大约是多少？γ≈100ζ°这个近似通常在什么范围内可靠？"对比估算与AI结论，记录适用条件。',
  },

  // Step 13: Participatory - γ≈100ζ°快通道
  'step-13': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-13',
    topic: 'γ≈100ζ°：频域与时域的快速通道',
    learningObjectives: [
      '理解γ↑⇒ζ↑⇒Mp↓的快通道',
      '掌握30°/45°/60°三个参考点',
      '了解近似的适用范围',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '快通道', question: '频域到时域的快通道是什么？' },
      { label: '参考点', question: '30°/45°/60°分别对应什么超调？' },
      { label: '适用条件', question: '这个近似在什么条件下成立？' },
    ],
    systemPromptExtension:
      '当前环节建立频域与时域的快通道：γ↑⇒ζ↑⇒Mp↓。参考点：γ≈30°对应ζ≈0.3、超调约35%；γ≈45°对应ζ≈0.45、超调约20%；γ≈60°对应ζ≈0.6、超调约10%。强调这是工程近似，不是放之四海皆准的精确等式，对二阶系统较可靠。',
  },

  // Step 14: Participatory - 三张面孔汇聚
  'step-14': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'theory',
    stepId: 'step-14',
    topic: '三张面孔汇聚：极点、时域、频域',
    learningObjectives: [
      '建立同一系统三域等价表示的整体认知',
      '理解极点↔时域↔频域的联动关系',
      '形成统一的设计视角',
    ],
    knowledgeType: 'C',
    tools: ['explain_concept', 'analyze_design'],
    quickQuestions: [
      { label: '三域对应', question: '同一组K在三张图上如何对应？' },
      { label: '联动关系', question: '改变一个参数，三张图如何联动？' },
      { label: '统一视角', question: '如何从三域视角判断设计？' },
    ],
    systemPromptExtension:
      '当前环节是层0收束的前奏：同一个系统，极点位置决定时域响应（ζ、ωn决定Mp、ts），也通过阻尼比联到频域稳定余量（γ≈100ζ°）。三张面孔是同一系统的三种等价表示，改变增益K，三张图会同步联动。这是进入L-2d三域联动前的最后铺垫。',
  },

  // Step 15: Participatory - 例题读图
  'step-15': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'practice',
    stepId: 'step-15',
    topic: '例题读图：从一张Bode图快速判断系统表现',
    learningObjectives: [
      '练习读出ωc、γ的完整流程',
      '用γ≈100ζ°粗估超调量',
      '形成快速工程判读能力',
    ],
    knowledgeType: 'X',
    tools: ['analyze_design', 'provide_hints', 'explain_concept'],
    quickQuestions: [
      { label: '读图步骤', question: 'Bode图读图的标准步骤是什么？' },
      { label: 'ωc读取', question: '如何在幅频图上找ωc？' },
      { label: 'γ计算', question: '如何计算相位裕度γ？' },
    ],
    systemPromptExtension:
      '当前环节是综合练习：从一张带标注的Bode图，完整走一遍"读出截止频率→读出相位→算相位裕度→预判超调量"的流程。解题步骤：1)在幅频图上找0dB穿越点得ωc；2)在相频图读出ωc处的相角；3)用γ=180°+∠G(jωc)算出相位裕度；4)用γ≈100ζ°粗估超调量。',
  },

  // Step 16: Post-assessment - 后测
  'step-16': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'quiz',
    stepId: 'step-16',
    topic: '后测：区分ωc、ωg与稳定余量',
    learningObjectives: [
      '检验ωc定义理解',
      '检验γ的工程意义理解',
      '检验ωc与ωg的区分',
    ],
    knowledgeType: 'X',
    tools: ['check_answer', 'explain_concept'],
    quickQuestions: [
      { label: '后测重点', question: '后测要检验什么？' },
      { label: 'ωc定义', question: '截止频率ωc的定义是什么？' },
      { label: 'γ意义', question: '相位裕度γ=20°意味着什么？' },
    ],
    systemPromptExtension:
      '当前是后测环节，3道题检验核心概念：ωc定义（幅频0dB穿越）、γ的工程意义（γ=20°意味着稳定但超调较大，接近振荡边界）、ωc与ωg的区分。重点关注学生是否还会把两个频率混淆，以及是否能说出"哪条曲线穿哪条线"。',
  },

  // Step 17: Summary - 总结
  'step-17': {
    enabled: true,
    courseId: L2C_COURSE_META.courseId,
    courseTitle: L2C_COURSE_META.courseTitle,
    pageType: 'summary',
    stepId: 'step-17',
    topic: '总结：三张面孔已齐，准备进入L-2d实操',
    learningObjectives: [
      '回顾三张面孔的核心收获',
      '回收step-02的直觉判断',
      '为L-2d三域联动做知识准备',
    ],
    knowledgeType: 'C',
    tools: ['summarize_lesson', 'preview_next'],
    quickQuestions: [
      { label: '本节收获', question: '本节课的核心收获是什么？' },
      { label: '海浪问题', question: '现在能用频域语言解释海浪问题吗？' },
      { label: '下节预告', question: 'L-2d会做什么？' },
    ],
    systemPromptExtension:
      '当前环节收束三张面孔：1)Bode图告诉你系统对不同频率信号的选择性；2)ωc是快慢门槛，γ和Kg是稳定余量；3)三张面孔（时域、复平面、频域）描述的是同一个系统。回到最初的海浪问题：你现在是否能用频域语言解释系统为什么能过滤某些海浪节拍？预告L-2d将三张面孔放到同一个操作界面联动观察。',
  },
};

/**
 * 获取指定步骤的AI上下文配置
 */
export function getL2CStepAIContext(stepId: string): AIContextConfig | null {
  return L2C_STEP_AI_CONTEXTS[stepId] || null;
}

/**
 * 获取当前步骤的快捷问题列表
 */
export function getL2CStepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  const context = L2C_STEP_AI_CONTEXTS[stepId];
  return context?.quickQuestions || [];
}
