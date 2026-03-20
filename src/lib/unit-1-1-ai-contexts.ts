import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_1_1_COURSE_META = {
  courseId: 'unit-1-1-laplace-transfer-function-v1',
  courseTitle: '1-1：拉氏变换与传递函数——从微分方程到代数方程',
  courseDescription:
    '围绕降维逻辑、微分定理、传递函数三步法、零极点判读和典型环节识别，建立层1的第一节数学精化课。',
  keyConcepts: ['拉氏变换', '微分定理', '零初始条件', '传递函数', '零极点', '典型环节'],
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
    courseId: UNIT_1_1_COURSE_META.courseId,
    courseTitle: UNIT_1_1_COURSE_META.courseTitle,
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

export const UNIT_1_1_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '回到地图：从直觉到精确',
    'theory',
    ['理解 1-1 在 L-sum 之后承担的任务', '从“直觉地图”切换到“公式工具”'],
    [
      { label: '课程定位', question: '1-1 在整条课程主线中承担什么作用？' },
      { label: '承接关系', question: 'L-sum 和 1-1 的关系是什么？' },
    ],
    '当前步骤只做课程定位，不直接替学生推导公式。重点是把 L-sum 的设计直觉收束到 1-1 的数学精化起点：今天开始解释传递函数是怎样从微分方程中提取出来的。',
  ),
  'step-02': context(
    'step-02',
    '船舶航向方程：为什么直接求解太麻烦',
    'quiz',
    ['从船舶二阶方程识别求解难点', '理解拉氏变换的工程动机'],
    [
      { label: '求解难点', question: '为什么这个微分方程手算起来麻烦？' },
      { label: '工程动机', question: '工程上为什么希望把微分变成代数？' },
    ],
    '当前步骤的 AI 只能帮助学生解释“为什么难”，不能直接代替投票作答。要把焦点放在齐次解、特解、初始条件这三类负担上。',
  ),
  'step-03': context(
    'step-03',
    '拉氏变换的降维逻辑',
    'theory',
    ['理解时域微分方程到 s 域代数方程的转换价值'],
    [
      { label: '降维', question: '这里说的“降维”具体是什么意思？' },
      { label: '回到时域', question: '为什么还需要拉氏反变换？' },
    ],
    '当前步骤重点是建立“先变换、后求解、再回去”的闭环认知。避免把拉氏变换解释成纯记忆型定义，要突出它对工程求解流程的重组。',
  ),
  'step-04': context(
    'step-04',
    '定义与三条性质：微分定理是核心',
    'practice',
    ['掌握单边拉氏变换定义', '理解微分定理如何把微分变成乘 s', '能验证一个简单指数函数案例'],
    [
      { label: '微分定理', question: '为什么 L[f\'.(t)] 会出现减去初始值的项？' },
      { label: '查表验证', question: '如何用查表法验证 e^{-2t} 的结果？' },
    ],
    '当前步骤需要围绕微分定理进行解释和纠错。先帮助学生读懂公式中的初始条件项，再比较“用定理”和“直接查表”为什么会得到同样的答案。',
  ),
  'step-05': context(
    'step-05',
    '零初始条件：传递函数的边界',
    'quiz',
    ['理解零初始条件是系统固有属性的前提'],
    [
      { label: '为什么要零初始', question: '为什么传递函数必须在零初始条件下定义？' },
      { label: '系统属性', question: '有初始条件时，为什么 G(s) 不再只代表系统本身？' },
    ],
    '当前步骤用于澄清概念边界。不要把回答泛化成“教材规定”，而要明确指出微分定理中的附加项会破坏“输出/输入之比仅由系统决定”的条件。',
  ),
  'step-06': context(
    'step-06',
    '三步法：从船舶方程到传递函数',
    'theory',
    ['掌握取变换、整理提取、求比值三步法'],
    [
      { label: '三步法', question: '三步法每一步分别在做什么？' },
      { label: '极点来源', question: '这个例子里的极点是从哪里读出来的？' },
    ],
    '当前步骤只讲套路，不替代学生完成下一步例题。要突出为什么提取公因子之后就能自然得到输出/输入之比。',
  ),
  'step-07': context(
    'step-07',
    'RC 电路：一阶惯性环节',
    'theory',
    ['把三步法迁移到 RC 电路', '识别惯性环节与时间常数'],
    [
      { label: 'RC 对应', question: '为什么 RC 电路的结果是典型惯性环节？' },
      { label: '时间常数', question: 'RC 中的时间常数 T 怎么读？' },
    ],
    '当前步骤是迁移练习。AI 要帮助学生把“通用三步法”迁移到具体物理系统，并指出 RCs+1 对应的一阶惯性结构。',
  ),
  'step-08': context(
    'step-08',
    '先手算，再 AI 验证零极点',
    'reflection',
    ['先独立完成零极点求取', '再对照 AI 结果并反思是否忽略零极点对消'],
    [
      { label: '零极点', question: '这个传递函数的零点和极点分别是什么？' },
      { label: '对消', question: '什么叫零极点对消？它在这个例子里出现了吗？' },
    ],
    '当前步骤要严格维护“先手算、后 AI”的顺序。AI 回答应作为对照和纠错工具，而不是第一步答案机。引导学生显式反思自己是否忽略了零极点对消。',
  ),
  'step-09': context(
    'step-09',
    '首一形式与尾一形式',
    'quiz',
    ['比较两种标准形式的阅读重点', '知道何时优先看零极点，何时优先看静态增益'],
    [
      { label: '首一形式', question: '首一形式更适合读什么？' },
      { label: '尾一形式', question: '尾一形式为什么更方便看静态增益？' },
    ],
    '当前步骤强调“同一传递函数，不同表示服务不同分析目的”。避免只背定义，要把它连接到“读零极点”和“读稳态增益”两个任务。',
  ),
  'step-10': context(
    'step-10',
    '极点与响应家族联动',
    'workspace',
    ['建立极点位置与响应形状的一一对应', '通过拖动极点观察家族切换'],
    [
      { label: '负实极点', question: '为什么负实极点对应单调衰减？' },
      { label: '共轭复极点', question: '为什么极点进入复平面后会出现振荡？' },
    ],
    '当前步骤依赖交互工作区。AI 解释时要从极点实部和虚部的作用出发，帮助学生把观察到的波形变化说清楚，而不是直接给出结论列表。',
  ),
  'step-11': context(
    'step-11',
    '零点如何改变模态权重',
    'workspace',
    ['理解零点不会创造新模态，但会改变已有模态权重'],
    [
      { label: '零点作用', question: '零点为什么会改变响应形状？' },
      { label: '靠近极点', question: '零点靠近极点时会发生什么？' },
    ],
    '当前步骤关注“零点的定性作用”。AI 应帮助学生用“压制某个模态权重”的语言解释现象，不要把重点偏移到频域。',
  ),
  'step-12': context(
    'step-12',
    '比例环节与积分环节',
    'practice',
    ['从公式形式识别比例/积分环节', '连接到杠杆、齿轮、水箱、航向角等物理原型'],
    [
      { label: '比例环节', question: '比例环节为什么说“没有动态过程”？' },
      { label: '积分环节', question: '积分环节为什么极点在原点？' },
    ],
    '当前步骤是典型环节识别的起点。解释要抓住“输出是否累积输入”与“是否存在动态状态”这两个判断维度。',
  ),
  'step-13': context(
    'step-13',
    '惯性与振荡：用参数看响应变化',
    'workspace',
    ['通过时间常数和阻尼比建立对一阶/二阶环节的直觉'],
    [
      { label: '时间常数', question: 'T 变大时，惯性环节的响应为什么更慢？' },
      { label: '阻尼比', question: 'ζ 从 0.1 增加到 0.9 时，响应会怎样变？' },
    ],
    '当前步骤依赖参数滑块。AI 解释要围绕“极点位置如何随 T 或 ζ 改变”展开，并连接到学生看到的响应快慢、超调与振荡消失过程。',
  ),
  'step-14': context(
    'step-14',
    '弹簧-质量-阻尼器综合例题',
    'practice',
    ['把物理方程、传递函数、标准形式、自然频率和阻尼比贯通'],
    [
      { label: '自然频率', question: '为什么这个系统的 ω_n 等于 sqrt(k/m)？' },
      { label: '阻尼比', question: '这个系统的 ζ 为什么是 b/(2*sqrt(mk))？' },
    ],
    '当前步骤是综合收束。AI 应帮学生把参数与标准二阶形式对齐，并核对数值计算过程，不要绕开方程到标准形式的映射。',
  ),
};

export function getUnit11StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_1_1_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit11StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_1_1_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_1_1StepAIContext = getUnit11StepAIContext;
export const getUNIT_1_1StepQuickQuestions = getUnit11StepQuickQuestions;
