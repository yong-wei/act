import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_2_4_COURSE_META = {
  courseId: 'unit-2-4-nyquist-margin-entry-v1',
  courseTitle: '2-4：Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别',
  courseDescription:
    '围绕同一个 G(jω) 的双图表达、纯极点系统 Nyquist 读图、频域指标入口、手工绘图入口与最小反向识别，完成模块 2 的图形对象收束。',
  keyConcepts: ['Nyquist 图', '双图表达', '相位裕度', '增益裕度', '截止频率', '穿越频率', '反向识别'],
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
    courseId: UNIT_2_4_COURSE_META.courseId,
    courseTitle: UNIT_2_4_COURSE_META.courseTitle,
    pageType,
    stepId,
    topic,
    learningObjectives,
    knowledgeType: 'X',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions,
    systemPromptExtension,
  };
}

export const UNIT_2_4_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：从 Bode 骨架走向 Nyquist 图与频域指标',
    'theory',
    ['明确 2-4 在模块 2 中承担图形对象收束角色', '理解 2-3 到 2-4 到 3-1 的衔接'],
    [
      { label: '课程位置', question: '为什么 2-4 被看作模块 2 的图形对象出口？' },
      { label: '后续去向', question: '2-4 学完后，为什么自然会进入模块 3 的结构机理？' },
    ],
    '当前步骤只做课程路径定位，不提前展开指标定义或 Nyquist 判据。',
  ),
  'step-02': context(
    'step-02',
    '为什么同一条频率特性还需要 Nyquist 图',
    'quiz',
    ['修正“Nyquist 是新对象”的起点误区', '理解 Nyquist 与 Bode 共享同一个 G(jω)'],
    [
      { label: '不是新对象', question: '为什么说 Nyquist 图不是在 Bode 图之外新造了一个对象？' },
      { label: '双图分工', question: 'Bode 图和 Nyquist 图分别更擅长回答什么问题？' },
    ],
    '当前步骤只纠正对象误区，不进入判据和裕度计算。',
  ),
  'step-03': context(
    'step-03',
    '课程边界：本课负责什么，不负责什么',
    'theory',
    ['明确本课只到入口、读取、绘图与最小反向识别', '守住不进入判据、判稳和频域校正的边界'],
    [
      { label: '负责什么', question: '2-4 真正负责建立哪四项能力？' },
      { label: '不负责什么', question: '为什么这节课不能把裕度直接升级成闭环结论？' },
    ],
    '回答必须围绕边界卡，不偷渡模块 3 或校正设计内容。',
  ),
  'step-04': context(
    'step-04',
    '前测：Nyquist 起点、对象与指标误区',
    'quiz',
    ['暴露关于起点、对象和裕度边界的初始误解'],
    [
      { label: '起点误区', question: '为什么 Nyquist 轨迹的起点与低频信息直接相关？' },
      { label: '指标边界', question: '为什么读出相位裕度后，本课还不能直接下闭环结论？' },
    ],
    '当前步骤只用于暴露误区，不替学生完成作答。',
  ),
  'step-05': context(
    'step-05',
    '同一个 G(jω) 的双图表达',
    'practice',
    ['把极坐标、直角坐标和双图观察职责对应起来'],
    [
      { label: '极坐标与直角坐标', question: '同一个 G(jω) 为什么既能写成极坐标，也能写成直角坐标？' },
      { label: '双图职责', question: 'Bode 图和 Nyquist 图分别更容易读出哪些信息？' },
    ],
    '当前步骤的重点是同一对象的两种图形表达，不进入判据语言。',
  ),
  'step-06': context(
    'step-06',
    'Nyquist 四步读法',
    'practice',
    ['掌握起点、终点、方向、总转角的固定阅读顺序'],
    [
      { label: '为什么先看起点', question: '为什么看 Nyquist 图时不能跳过起点和终点？' },
      { label: '总转角', question: '总转角为什么能反映累计相位拖后？' },
    ],
    '当前步骤只帮助学生建立读图顺序，不把读图法扩成 Nyquist 判据。',
  ),
  'step-07': context(
    'step-07',
    '一阶惯性轨迹的参数变化',
    'workspace',
    ['观察参数 T 如何影响 Nyquist 轨迹形态', '巩固“正实轴出发、向下收敛原点”的典型轨迹'],
    [
      { label: '起点和终点', question: '一阶惯性 Nyquist 轨迹为什么从正实轴附近出发并最终收向原点？' },
      { label: '参数 T', question: '改变 T 时，轨迹形态和频率刻度会怎样变化？' },
    ],
    '回答围绕一阶惯性轨迹和参数变化，不延展到高阶系统判据。',
  ),
  'step-08': context(
    'step-08',
    '纯极点系统比较',
    'workspace',
    ['比较极点数量变化与 Nyquist 轨迹旋转深浅之间的关系'],
    [
      { label: '为什么转得更深', question: '为什么纯极点系统极点越多，Nyquist 轨迹通常转得更深？' },
      { label: '和 Bode 的一致性', question: '这种“转得更深”的现象如何与 Bode 图相位拖后一致？' },
    ],
    '请把对象比较建立在“极点数变化带来拖后累积”这条链上。',
  ),
  'step-09': context(
    'step-09',
    '频域指标第一入口',
    'practice',
    ['区分截止频率、穿越频率、相位裕度、增益裕度和带宽频率'],
    [
      { label: '五个指标', question: '五个频域指标各自回答什么问题？' },
      { label: '为什么只是入口', question: '为什么本课对这些指标只要求定义、读图和基础计算？' },
    ],
    '当前步骤只做指标入口，不偷渡闭环结论或频域设计。',
  ),
  'step-10': context(
    'step-10',
    '双图对照下的指标锚点',
    'practice',
    ['把 Bode 图和 Nyquist 图上的指标锚点对应起来'],
    [
      { label: '双图锚点', question: '同一个相位裕度在 Bode 图和 Nyquist 图上分别靠什么锚点定位？' },
      { label: '单位圆与负实轴', question: '为什么单位圆和负实轴会成为 Nyquist 图中的关键参照？' },
    ],
    '回答必须坚持“同一指标，两张图不同锚点”的对照关系。',
  ),
  'step-11': context(
    'step-11',
    'Bode 手工绘图入口',
    'workspace',
    ['只做基线、折点和斜率的第一轮骨架', '避免把本课工作区误做成自由画图器'],
    [
      { label: '为什么先基线', question: '为什么 Bode 手工绘图要先定基线，再看折点和斜率？' },
      { label: '积分环节影响', question: '积分环节会怎样改变基线和斜率起点？' },
    ],
    '当前步骤只限于手工骨架入口，不要求复杂精确修正。',
  ),
  'step-12': context(
    'step-12',
    'Nyquist 手工绘图入口',
    'workspace',
    ['掌握端点、过轴点、渐近线和方向四类锚点', '知道先画正频率支的顺序'],
    [
      { label: '先画什么', question: '为什么 Nyquist 手工绘图要先从正频率支和端点开始？' },
      { label: '关键点规则', question: '过实轴、过虚轴和渐近线分别怎么帮助你定位轨迹？' },
    ],
    '当前步骤只保留手工入口，不进入完整 Nyquist 判据。',
  ),
  'step-13': context(
    'step-13',
    '例题一：含积分环节对象从 Bode 到 Nyquist',
    'practice',
    ['按题面、骨架、轨迹三步链走完例题'],
    [
      { label: '三步链', question: '这个例题为什么要先画 Bode 基线，再转到 Nyquist 轨迹？' },
      { label: '积分环节', question: '积分环节对 Bode 基线和 Nyquist 渐近线分别带来什么影响？' },
    ],
    '当前步骤强调例题链顺序，不把答案直接替学生完成。',
  ),
  'step-14': context(
    'step-14',
    '例题二：读取频域指标，不作闭环结论',
    'practice',
    ['从图上读取指标并解释来源', '守住“只到入口”的边界'],
    [
      { label: '读指标', question: '例题里每个频域指标分别是从哪里读出来的？' },
      { label: '为什么不下结论', question: '为什么这一步即便读到裕度，也不能直接给闭环稳定性结论？' },
    ],
    '始终把答案限制在定义、读图和基础解释，不扩成判稳。',
  ),
  'step-15': context(
    'step-15',
    '最小反向识别与 AI 对照',
    'reflection',
    ['先根据图形轮廓判断对象类别，再估参数量级', '用页内 AI 核对线索链而不是替代判断'],
    [
      { label: '对象轮廓', question: '看到这张图时，我应该先抓哪些对象轮廓线索来判断对象类型？' },
      { label: '参数量级', question: '如果我要估参数量级，最先该盯住哪个转折或低频量级？' },
    ],
    '这一页必须坚持“先自己判断对象，再让 AI 核对线索链”，不要让 AI 直接给完整辨识结果。',
  ),
  'step-16': context(
    'step-16',
    '后测：读图、指标与边界',
    'quiz',
    ['检查是否会读图、会读指标、会守住课程边界'],
    [
      { label: '最易越界点', question: '做完这节课的后测，最容易犯的越界错误是什么？' },
      { label: '相位裕度', question: '如果相位裕度算错，通常是锚点找错、定义记错，还是边界理解错？' },
    ],
    '当前步骤只定位卡点，不替学生作答。',
  ),
  'step-17': context(
    'step-17',
    '总结与后续预告',
    'summary',
    ['收束 2-4 的五条核心结论', '把视角推进到模块 3 的结构机理'],
    [
      { label: '五条结论', question: '这节课最值得带走的五条 Nyquist 与频域指标结论是什么？' },
      { label: '模块衔接', question: '为什么 2-4 学完后，下一步自然会转向结构机理和判稳分析？' },
    ],
    '当前步骤只负责收束与衔接，不补讲新公式。',
  ),
};

export function getUnit24StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_2_4_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit24StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_2_4_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_2_4StepAIContext = getUnit24StepAIContext;
export const getUNIT_2_4StepQuickQuestions = getUnit24StepQuickQuestions;
