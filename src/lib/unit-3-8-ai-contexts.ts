import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_8_COURSE_META = {
  courseId: 'unit-3-8-frequency-domain-translation-judgment-v1',
  courseTitle: '3-8：频域判别与跨域综合语言',
  courseDescription:
    '围绕结构变化的频域指纹、Nyquist 与 Bode 统一判稳链、三频段分工与工程案例读回，把模块 3 理论主线收束为一张频域判断地图。',
  keyConcepts: ['频域指纹', 'Nyquist 判稳', 'Bode 裕度', '三频段分工', '中频超前', '工程读回'],
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
    courseId: UNIT_3_8_COURSE_META.courseId,
    courseTitle: UNIT_3_8_COURSE_META.courseTitle,
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

export const UNIT_3_8_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：3-8 不是新章孤岛，而是模块 3 的统一判断入口',
    'theory',
    ['明确 3-8 在 3-5、3-7、3-9、4-1 之间的位置', '理解频域是模块 3 的统一翻译器'],
    [
      { label: '为什么不是新章', question: '为什么 3-8 不是新章，而是把模块 3 前半段知识重新收成统一判断语言？' },
      { label: '后续去向', question: '3-8 和 3-9、4-1 的关系分别是什么？' },
    ],
    '当前页面只做路径定位，不提前展开判据推导与整定流程。',
  ),
  'step-02': context(
    'step-02',
    '统一翻译链：结构变化如何接到稳定边界与闭环后果',
    'theory',
    ['掌握结构变化到闭环后果的统一翻译链', '建立本课三步判断法'],
    [
      { label: '翻译链', question: '为什么结构变化最终都要经过“频域指纹 -> 稳定边界变化 -> 闭环后果”这条翻译链？' },
      { label: '三步法', question: '为什么判断频域问题时要先看频带，再看边界，最后再读回闭环后果？' },
    ],
    '本页只建立统一框架，不代替学生完成后续例题。',
  ),
  'step-03': context(
    'step-03',
    '前测：四类典型误判先暴露出来',
    'quiz',
    ['识别频域初学者最常见的四类误判', '为后续矫正建立错因坐标'],
    [
      { label: '先看频段', question: '为什么频域判断必须先判断被改写的是哪一段频率，而不是先喊结论？' },
      { label: '先数 P', question: '为什么 Nyquist 快判的第一步必须先数开环右半平面极点 P？' },
    ],
    '只做错因暴露和术语纠偏，不替学生完成判断。',
  ),
  'step-04': context(
    'step-04',
    '结构变化总表：先看哪一段频带，再谈收益与代价',
    'theory',
    ['把四类结构变化和首要频带对齐', '把收益和代价放回同一张总表'],
    [
      { label: '先看频带', question: '为什么四类结构变化的比较必须先建立“主要改写哪一段频率”的视角？' },
      { label: '收益与代价', question: '为什么收益和代价必须同表出现，而不能只保留“更好”的一栏？' },
    ],
    '本页以阅读和聚焦总表为主，不把总表再压缩成单句口诀。',
  ),
  'step-05': context(
    'step-05',
    '曲线互动页：四类结构变化的频域指纹',
    'practice',
    ['通过同一对象观察四种结构变化的频域改写', '识别频带变化与相位代价'],
    [
      { label: '为什么不同指纹', question: '为什么四类结构变化会在同一对象上留下完全不同的频域指纹？' },
      { label: '相位代价', question: '为什么频域曲线比较不能只看幅值，还必须同时看相位代价？' },
    ],
    '允许解释曲线差异，但不把曲线阅读退化成静态截图说明。',
  ),
  'step-06': context(
    'step-06',
    '例题 1：先从哪一段频带开始判断结构变化',
    'practice',
    ['先做频带定位，再读收益与代价', '理解题面、显影链与作答区的关系'],
    [
      { label: '先频带后结论', question: '为什么例题 1 必须先判断被改写的频带，而不是先说系统“更快”或“更稳”？' },
      { label: '显影意义', question: '为什么这类例题要把题面和解题链分开，而不能直接给结果卡？' },
    ],
    '只辅助学生核对频带和结论链，不跳过教师显影节奏。',
  ),
  'step-07': context(
    'step-07',
    '幅角原理：总转角、P 与 Z 的物理含义',
    'theory',
    ['理解总转角与零极点计数的关系', '建立逐步显影的阅读节奏'],
    [
      { label: '为什么是总转角', question: '为什么幅角原理要把问题写成“总转角如何变化”？' },
      { label: 'P 与 Z 在说什么', question: 'P 和 Z 分别对应什么对象，它们为什么必须一起出现？' },
    ],
    '仅解释概念关系，不提前替学生做 Nyquist 快判。',
  ),
  'step-08': context(
    'step-08',
    '为什么取 F(s)=1+L(s)，为什么盯住 (-1,0)',
    'practice',
    ['把辅助函数、几何图景和推导链连成一个完整故事', '避免把 Nyquist 判稳记成脱离来由的结论'],
    [
      { label: '为什么看 -1 点', question: '为什么闭环稳定问题最终会被改写成 Nyquist 曲线怎样对待 (-1,0) 这个点？' },
      { label: '为什么先有 F(s)', question: '为什么 Nyquist 判据一定要先引入 F(s)=1+L(s) 这个辅助函数？' },
    ],
    '只核对推导链条，不允许直接跳到结论。',
  ),
  'step-09': context(
    'step-09',
    '例题 2：第一组 Nyquist 快速判稳题',
    'practice',
    ['把对象、P、N、Z 和稳定结论一一对应', '区分右半平面零点与极点'],
    [
      { label: '为什么先数 P', question: '面对 Nyquist 快判题时，为什么必须先数 P 再看 N 和 Z？' },
      { label: '右半平面零点', question: '为什么含右半平面零点不等于闭环一定不稳定？' },
    ],
    'AI 只辅助核对 P/N/Z 顺序，不替学生完成对象分类。',
  ),
  'step-10': context(
    'step-10',
    '例题 3：靠近边界与越过边界的本质差别',
    'practice',
    ['理解“临界附近”和“越界之后”是两种不同风险', '建立边界比较的排序依据'],
    [
      { label: '为什么不是同一类', question: '为什么“靠近边界”与“已经越过边界”不是同一级别的问题？' },
      { label: '怎么排优先级', question: '比较边界风险时，为什么不能只看增益更大或更小？' },
    ],
    '只辅助解释风险层级，不替学生决定排序。',
  ),
  'step-11': context(
    'step-11',
    'Bode 判稳：截止频率、相角裕度和增益裕度',
    'practice',
    ['把 Bode 指标读成同一条临界边界语言', '纠正截止频率和带宽混读'],
    [
      { label: '不是另一套规则', question: '为什么 Bode 判稳不是另一套规则，而是在对数坐标上读同一条临界边界？' },
      { label: '截止频率与带宽', question: '为什么开环截止频率不能直接等同于闭环带宽？' },
    ],
    '只解释指标线和边界，不把开环读余量和闭环读速度混成同一个词。',
  ),
  'step-12': context(
    'step-12',
    '例题 4：由 Bode 图直接判断系统在边界哪一侧',
    'practice',
    ['按固定顺序由 Bode 图做边界判断', '决定修正方向而不是盲目继续推进'],
    [
      { label: '读图顺序', question: '为什么由 Bode 图做边界判断时也必须有固定顺序，而不能看到一条曲线就直接下结论？' },
      { label: '修正方向', question: '为什么边界判断之后的第一动作不是盲目把截止频率继续往高处推？' },
    ],
    '只辅助核对读图顺序与修正方向，不代替学生作答。',
  ),
  'step-13': context(
    'step-13',
    '三频段分工：精度、速度与代价不能混读',
    'theory',
    ['把低频、中频、高频与不同任务重新对齐', '明确三频段不是一句口号'],
    [
      { label: '三频段各司其职', question: '为什么三频段必须分别对应精度、速度与代价，而不能把它们混读成同一项指标？' },
      { label: '为什么要分开看', question: '为什么工程判断一旦不区分三频段，就容易把收益和代价绑错？' },
    ],
    '本页只做三频段阅读框架，不直接替学生完成目标切换判断。',
  ),
  'step-14': context(
    'step-14',
    '例题 5：目标切换时，先改哪一段频带',
    'practice',
    ['先独立完成目标到频带的判断', '再用页内 AI 对照修订自己的链条'],
    [
      { label: '目标切换', question: '当控制目标切换时，为什么第一反应应该是重判目标对应的频带，而不是沿用上一题的补偿直觉？' },
      { label: '目标到频带', question: '面对新的控制目标，应该如何把目标翻译成优先改写的频段，再读回收益与代价？' },
    ],
    '这一页允许页内 AI 对照，但必须先由学生独立完成目标到频带的判断。',
  ),
  'step-15': context(
    'step-15',
    '航向控制案例：先把基线方案的问题读清楚',
    'practice',
    ['识别航向控制案例的基线问题', '避免把案例直接压成“某方案更好”的结论卡'],
    [
      { label: '先读问题', question: '为什么航向控制案例必须先把基线方案的问题读清楚，而不是直接讨论超前校正？' },
      { label: '读证据', question: '面对同一案例，为什么要同时看时域现象与频域证据，不能只盯一个视角？' },
    ],
    '只帮助学生识别基线问题，不提前展开完整方案比较。',
  ),
  'step-16': context(
    'step-16',
    '航向控制案例：把时域指标翻译成频域目标，再看超前校正',
    'practice',
    ['把时域指标翻译为频域目标', '理解超前校正为什么主要改写中频'],
    [
      { label: '为什么先翻译', question: '为什么航向控制案例必须先把时域指标翻译成频域目标，才能讨论超前校正是否合理？' },
      { label: '为什么是中频', question: '为什么本案例里的有效动作是中频定向改写，而不是继续堆低频补偿？' },
    ],
    '只辅助核对目标翻译和方案理由，不替学生完成对比表。',
  ),
  'step-17': context(
    'step-17',
    '稳定平台案例：为什么“只改增益”会左右为难',
    'practice',
    ['看见“更稳但更慢”的真实代价', '理解仅降增益不能自动等于更好方案'],
    [
      { label: '为什么左右为难', question: '为什么稳定平台案例里，“只改增益”会陷入更稳但更慢的两难？' },
      { label: '代价在哪里', question: '为什么仅仅提高余量并不自动等于更好的工程结果？' },
    ],
    '这一页只帮助学生看见代价，不提前宣布最佳方案。',
  ),
  'step-18': context(
    'step-18',
    '稳定平台案例：超前校正怎样兼顾速度和平稳',
    'practice',
    ['比较三方案的速度、超调、余量与高频代价', '理解中频超前为何能兼顾速度和平稳'],
    [
      { label: '为什么能兼顾', question: '为什么稳定平台案例里的中频超前有机会同时兼顾速度和平稳，而不是只牺牲其中一项？' },
      { label: '为什么不是只降增益', question: '为什么本案例最终不该停在“只降增益”的方案上？' },
    ],
    '只帮助学生核对三方案比较逻辑，不替代方案判断。',
  ),
  'step-19': context(
    'step-19',
    '后测：把完整判断链独立走一遍',
    'quiz',
    ['独立完成完整判断链', '检查剩余混淆点'],
    [
      { label: '完整判断链', question: '如果不看讲稿，频域完整判断链应该按什么顺序独立走完？' },
      { label: '剩余混淆', question: '如果你还会混淆顺序、边界或频带，问题通常卡在什么位置？' },
    ],
    '当前页面只做独立回放和错因归类，不再引入新知识。',
  ),
  'step-20': context(
    'step-20',
    '总结与去向：3-9 和模块 4 从哪里接走本课',
    'theory',
    ['用统一判断地图收束 3-8', '把课程出口平滑接到 3-9 与 4-1'],
    [
      { label: '3-9 接什么', question: '3-9 会怎样继续接走 3-8 的统一频域判断地图？' },
      { label: '4-1 接什么', question: '为什么模块 4 需要在 4-1 把这张判断地图改写成任务表达与约束语言？' },
    ],
    '本页只做收束与去向连接，不重新展开本课细节。',
  ),
};

export function getUnit38StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_8_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit38StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_8_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_8StepAIContext = getUnit38StepAIContext;
export const getUNIT_3_8StepQuickQuestions = getUnit38StepQuickQuestions;
