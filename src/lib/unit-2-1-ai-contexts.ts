import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_2_1_COURSE_META = {
  courseId: 'unit-2-1-modeling-language-v1',
  courseTitle: '2-1：建模与变换语言——从真实对象到统一分析对象',
  courseDescription:
    '围绕拉氏变换工程动机、零初值传递函数、典型环节、结构图、信号流图和梅森公式，建立模块 2 的统一对象语言。',
  keyConcepts: ['拉氏变换', '零初值传递函数', '典型环节', '结构图', '信号流图', '梅森公式'],
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
    courseId: UNIT_2_1_COURSE_META.courseId,
    courseTitle: UNIT_2_1_COURSE_META.courseTitle,
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

export const UNIT_2_1_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：为什么模块 2 从对象语言开始',
    'theory',
    ['理解 2-1 在模块 2 的入口作用', '把模块 1 的现象直觉推进到对象语言'],
    [
      { label: '承接关系', question: '为什么 2-1 不是继续看现象，而是开始建立对象语言？' },
      { label: '本课任务', question: '这一课真正要建立的统一分析对象是什么？' },
    ],
    '当前步骤只做地图定位。请帮助学生把“直觉层”与“对象层”区分开，不要提前展开复杂计算。',
  ),
  'step-02': context(
    'step-02',
    '为什么微分方程还不够',
    'quiz',
    ['理解微分方程是起点而不是终点', '意识到控制器连接与反馈收束需要统一对象语言'],
    [
      { label: '局限', question: '为什么只拿着微分方程，不足以直接进行后续连接和反馈分析？' },
      { label: '新对象', question: '课程为什么要把真实对象翻译成统一分析对象？' },
    ],
    '当前步骤只帮助学生理解题意与错因，不直接替代作答。重点放在“表达物理来源”和“支持系统连接”之间的差别。',
  ),
  'step-03': context(
    'step-03',
    '对象建立链总览',
    'theory',
    ['理解本课的六段对象链', '知道每个环节回答什么问题'],
    [
      { label: '对象链', question: '从微分方程到总体对象，中间为什么要经过传递函数和结构表达？' },
      { label: '先后顺序', question: '为什么要先认对象，再做连接和收束？' },
    ],
    '请帮助学生看到整条对象建立链，不要把它讲成零散术语列表。',
  ),
  'step-04': context(
    'step-04',
    '对象、初值与结构的三个误区',
    'quiz',
    ['暴露对象定义、初值条件、结构表达的常见混淆'],
    [
      { label: '零初值', question: '为什么零初值不能在传递函数定义里被默认忽略？' },
      { label: '结构表达', question: '遇到一个复杂分式时，第一步为什么不应直接盲算总式？' },
    ],
    '请帮助学生解释错因，强调对象定义、初始状态和连接结构不是一回事。',
  ),
  'step-05': context(
    'step-05',
    '拉氏变换的工程动机',
    'practice',
    ['把“微分变代数”理解为课程中的工程语言切换', '知道拉氏变换在控制课里的用途不是积分技巧'],
    [
      { label: '工程价值', question: '为什么控制课程里强调拉氏变换能把微分问题改写成代数问题？' },
      { label: '统一对象', question: '它怎样帮助我们得到后续反复使用的统一对象？' },
    ],
    '请坚持“讲动机，不讲积分技巧”的边界。目标是让学生理解为什么课程要切换语言，而不是训练纯数学计算。',
  ),
  'step-06': context(
    'step-06',
    '零初值传递函数的形成',
    'practice',
    ['理解系统对象与具体输入被分离', '理解传递函数为什么不是“原方程换个写法”'],
    [
      { label: '对象分离', question: '为什么得到 G(s)=Y(s)/U(s)|零初值 后，系统对象与具体输入就被分开了？' },
      { label: '统一复用', question: '为什么后续时域、频域和结构分析都围绕这个对象展开？' },
    ],
    '请把重点放在“对象分离”和“可复用性”上，不要把这一步讲成机械推导。',
  ),
  'step-07': context(
    'step-07',
    '初值项与对象项的区别',
    'reflection',
    ['区分初值项和对象项', '学会先做个人判断，再用 AI 对照推理链'],
    [
      { label: '初值项', question: '非零初值时，为什么会额外出现与初始状态有关的项？' },
      { label: '对象定义', question: '为什么这些初值项不能混进传递函数的对象定义中？' },
    ],
    '这一页必须坚持“先自己判断，再 AI 对照”。AI 只核对对象项与初值项的分界，不直接替学生完成整个解释。',
  ),
  'step-08': context(
    'step-08',
    '典型环节对象库',
    'practice',
    ['把公式、名称和第一眼工程判断配起来', '先认对象，再做运算'],
    [
      { label: '识别优先', question: '为什么看到一个传递函数时，第一步通常先识别典型环节，而不是立刻整体化简？' },
      { label: '工程判断', question: '比例、积分、微分、惯性、振荡环节各自先提醒你什么工程特征？' },
    ],
    '请帮助学生做“对象识别”而不是“技巧化简”。重点是把标准部件库认清。',
  ),
  'step-09': context(
    'step-09',
    '结构图三类基本连接',
    'practice',
    ['掌握串联、并联、反馈三类规则的最小集合', '知道为什么复杂系统也要先落回这三类连接'],
    [
      { label: '三类连接', question: '为什么结构图再复杂，最后都要回到串联、并联、反馈这些基本连接？' },
      { label: '反馈核心', question: '为什么反馈连接是把对象真正变成控制系统的关键步骤？' },
    ],
    '请只讲基本连接，不要滑回复杂结构图技巧训练。',
  ),
  'step-10': context(
    'step-10',
    '船舶航向系统结构表达',
    'practice',
    ['在工程场景中识别控制器、舵机、船体和传感器的位置', '理解被反馈的信号是什么'],
    [
      { label: '系统组成', question: '船舶航向闭环结构图里，控制器、舵机、船体、传感器分别负责什么？' },
      { label: '反馈信号', question: '哪一个信号被反馈回来，用来修正输入？' },
    ],
    '请坚持工程结构图视角，帮助学生把抽象对象放回真实系统组成。',
  ),
  'step-11': context(
    'step-11',
    '方框图与信号流图的分工',
    'theory',
    ['区分模块组成视角与路径回路视角', '理解为什么复杂系统要引入信号流图'],
    [
      { label: '差别', question: '方框图和信号流图分别更适合回答什么问题？' },
      { label: '补位', question: '为什么复杂结构下，单靠方框图化简会越来越吃力？' },
    ],
    '请把两种图形语言的任务分工说清，不要把信号流图讲成“方框图换个名字”。',
  ),
  'step-12': context(
    'step-12',
    '梅森公式的最小使用集',
    'practice',
    ['读懂前向通路、回路、互不接触回路和余子式', '知道梅森公式回答的是“复杂结构怎样直接写总体对象”'],
    [
      { label: '术语作用', question: '前向通路、回路、余子式各自到底在描述什么？' },
      { label: '全局视角', question: '为什么梅森公式比局部化简更像一种全局拓扑视角？' },
    ],
    '当前步骤只保留最小使用集，不做技巧堆叠。请帮助学生用“路径和回路”理解公式，而不是死记符号。',
  ),
  'step-13': context(
    'step-13',
    '例题一：单回路闭环对象收束',
    'practice',
    ['按对象识别 -> 前向通路 -> 闭环对象 -> 信号流图验证的顺序组织解题', '知道真正要分析的是闭环对象'],
    [
      { label: '前向通路', question: '在这个单回路例题里，哪一项是前向通路，哪一项是反馈通道？' },
      { label: '闭环对象', question: '为什么最终真正要分析的是闭环对象，而不是某一个局部模块？' },
    ],
    '请把重点放在解题组织顺序和“闭环对象”这件事上，不要把例题讲成局部技巧。',
  ),
  'step-14': context(
    'step-14',
    '余子式不一定等于 1',
    'reflection',
    ['分清互不接触回路与“不接触某条前向通路”', '理解何时会保留 Delta_k'],
    [
      { label: '接触判定', question: '为什么“回路之间互不接触”和“回路不接触某条前向通路”是两个不同判断层次？' },
      { label: 'Delta_k', question: '什么情况下某条前向通路对应的 Delta_k 会保留下来，而不是直接等于 1？' },
    ],
    '请帮助学生围绕“接触关系”解释 Delta_k，不要只给结论。',
  ),
  'step-15': context(
    'step-15',
    '对象建立链后测',
    'quiz',
    ['检查学生是否能用对象语言复述本课', '定位对象定义、结构表达和余子式判断上的残余混淆'],
    [
      { label: '对象复述', question: '如果只能用一句话复述本课，你会怎样概括对象建立链？' },
      { label: '易错点', question: '如果后测还错，最可能卡在对象定义、结构表达还是余子式判断？' },
    ],
    '请帮助学生做错因定位，不要直接替代后测作答。',
  ),
  'step-16': context(
    'step-16',
    '本课收束与 2-2 过渡',
    'summary',
    ['用对象建立、对象识别、结构表达、总体对象四个关键词收束本课', '把视角推进到下一课的时域响应'],
    [
      { label: '四个关键词', question: '为什么“对象建立、对象识别、结构表达、总体对象”能概括本课？' },
      { label: '下一课', question: '为什么对象语言建立后，自然就会进入响应分析？' },
    ],
    '请把收束重点放在“对象已经立住，下一课开始看对象怎样在时间里运动”。',
  ),
};

export function getUnit21StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_2_1_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit21StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_2_1_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_2_1StepAIContext = getUnit21StepAIContext;
export const getUNIT_2_1StepQuickQuestions = getUnit21StepQuickQuestions;
