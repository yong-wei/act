import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_6_COURSE_META = {
  courseId: 'unit-3-6-zero-design-workshop-v1',
  courseTitle: '3-6：零点作用与动态改善实验——从性能目标到校正设计',
  courseDescription:
    '围绕目标分类、时域 / 频域指标翻译、PD/测速反馈/超前设计与非最小相边界选择，把“会判断”推进到“会按目标进入设计链”。',
  keyConcepts: ['目标分类', '时域指标翻译', 'PD 校正', '测速反馈', '超前校正', '非最小相边界'],
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
    courseId: UNIT_3_6_COURSE_META.courseId,
    courseTitle: UNIT_3_6_COURSE_META.courseTitle,
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

export const UNIT_3_6_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '封面导入：为什么今天必须先定目标',
    'quiz',
    ['打破“先上某张图再说”的惯性。', '先按目标分类，再进入设计工具。'],
    [
      { label: '本页目标', question: '为什么这一步先要判断入口，而不是直接开始计算？' },
      { label: '允许范围', question: '这一步允许 AI 帮我厘清哪些内容？' },
    ],
    '允许范围：目标类型、入口分类、工具角色。禁止范围：提前给出后续参数结果。关键事实：本课第一步先判断目标属于哪条设计链。',
  ),
  'step-02': context(
    'step-02',
    '回到地图：从零点机理切到校正设计',
    'theory',
    ['标定 3-6 在模块 3 中的位置。', '区分 3-5 的机理课与 3-6 的设计课。'],
    [
      { label: '本页目标', question: '3-5、3-6、3-7 三课各自负责什么？' },
      { label: '允许范围', question: '这一页最该带走的边界提醒是什么？' },
    ],
    '允许范围：课程路径、前后衔接、本课边界。禁止范围：提前进入具体设计计算。关键事实：3-5 讲机理，3-6 讲目标驱动设计，3-7 讲稳态改善。',
  ),
  'step-03': context(
    'step-03',
    '本节目标与五任务设计链',
    'theory',
    ['明确三项目标、五任务链与固定交付物。', '把本课理解为完整设计链，而不是装置清单。'],
    [
      { label: '本页目标', question: '五任务链为什么不能缩成“几种校正装置介绍”？' },
      { label: '允许范围', question: '这一页允许我用哪些角度检查自己是否理解了课程目标？' },
    ],
    '允许范围：目标、任务链、交付物。禁止范围：把任务链退化成装置名称列表。关键事实：本课的产出包括指标翻译表、设计记录和边界判断。',
  ),
  'step-04': context(
    'step-04',
    '前测：你会怎样从指标进入设计',
    'quiz',
    ['暴露时域 / 频域 / 边界入口混淆。', '保持先独立判断、后 AI 对照的顺序。'],
    [
      { label: '本页目标', question: '这组三题分别在检查哪三类入口混淆？' },
      { label: '允许范围', question: 'AI 在这一页只能怎样帮助我？' },
    ],
    '允许范围：错因归类、入口对照、术语纠偏。禁止范围：直接生成完整前测答案。关键事实：前测与理由提交完成后才允许打开 AI 对照。',
  ),
  'step-05': context(
    'step-05',
    '任务书：固定对象、两类目标与交付记录',
    'practice',
    ['把时域目标、频域目标和边界问题放进正确入口栏。', '认清“目标先行”是本课唯一入口。'],
    [
      { label: '本页目标', question: '时域目标、频域目标和边界判断分别该先进入哪类工具？' },
      { label: '允许范围', question: '如果我分错了入口，最常见的误区是什么？' },
    ],
    '允许范围：对象、任务表、目标分类。禁止范围：替学生完成分类。关键事实：本课不是比较哪种结构永远更好，而是判断该从哪条设计链进入。',
  ),
  'step-06': context(
    'step-06',
    '工作区 A：把时域指标翻译成设计可行域',
    'practice',
    ['把超调量和调节时间翻译成目标极点区域。', '说明为什么纯增益不能直接通过。'],
    [
      { label: '本页目标', question: '为什么时域指标必须先翻译成区域，而不是直接猜参数？' },
      { label: '允许范围', question: '这一步允许我让 AI 帮我检查哪些翻译链？' },
    ],
    '允许范围：Mp/ts 到 zeta/实部边界的翻译、纯增益失败原因。禁止范围：代替学生完成区域填写。关键事实：设计动作前必须先得到目标极点区域。',
  ),
  'step-07': context(
    'step-07',
    '工作区 B：PD 时域设计',
    'practice',
    ['先定设计点，再反求零点和增益。', '保持“设计点 -> 参数 -> 验收”的顺序。'],
    [
      { label: '本页目标', question: '为什么 PD 时域设计必须先选设计点，而不能直接背答案参数？' },
      { label: '允许范围', question: 'AI 在这一页最适合帮我检查哪一段链路？' },
    ],
    '允许范围：设计点、相角条件、模值条件、验收链。禁止范围：直接给出 T_d 和 K 的结果。关键事实：先证纯增益不够，再引入 PD 零点。',
  ),
  'step-08': context(
    'step-08',
    '工作区 C：测速反馈时域设计',
    'practice',
    ['把测速反馈改写成广义根轨迹问题。', '先定等效极点，再求 Kt 和 K。'],
    [
      { label: '本页目标', question: '为什么测速反馈的入口是等效极点，而不是前向零点位置？' },
      { label: '允许范围', question: 'AI 在这一页能帮我核对哪些顺序性错误？' },
    ],
    '允许范围：结构图、等效特征方程、调整顺序。禁止范围：把测速反馈说成显式增加前向零点。关键事实：先定等效极点，再求 Kt。',
  ),
  'step-09': context(
    'step-09',
    '工作区 D：超前频域设计',
    'practice',
    ['把频域目标翻译成补角与交叉频率。', '压实“先补角，再布置频带”的顺序。'],
    [
      { label: '本页目标', question: '为什么超前设计要先看所需补角和目标截止频率？' },
      { label: '允许范围', question: '这一页最适合让 AI 帮我检查哪类频域判断？' },
    ],
    '允许范围：PM、wc、补角、a/T/Kc 的角色说明。禁止范围：代替学生直接完成参数设计。关键事实：只调增益达到 wc 时，通常还拿不到足够相角裕度。',
  ),
  'step-10': context(
    'step-10',
    '工作区 E：同一频域指标下的 PD 设计',
    'practice',
    ['在相同频域指标下比较 PD 与超前的时域副作用。', '压实“频域达标不等于全部代价相同”。'],
    [
      { label: '本页目标', question: '为什么任务 D 必须沿用任务 C 完全相同的频域目标？' },
      { label: '允许范围', question: 'AI 在这一页可以如何帮助我比较两种方案？' },
    ],
    '允许范围：共同目标、差异标签、时域回查。禁止范围：把超前和 PD 的比较说成“谁更强”。关键事实：同一频域目标达标，不代表时域代价相同。',
  ),
  'step-11': context(
    'step-11',
    '工作区 F：非最小相边界与结构选择',
    'practice',
    ['在非最小相对象下先重审目标，再决定结构。', '明确右半平面零点会压缩可行带宽。'],
    [
      { label: '本页目标', question: '为什么非最小相对象下必须先重审目标，而不是直接继续调参数？' },
      { label: '允许范围', question: 'AI 可以如何帮助我判断非最小相边界下的结构选择？' },
    ],
    '允许范围：非最小相边界、目标重审、结构选择理由。禁止范围：替学生直接给出最终选型。关键事实：先改目标，再选结构；非最小相对象下不能继续盲目推高带宽。',
  ),
  'step-12': context(
    'step-12',
    '后测：设计链和边界是否分清',
    'quiz',
    ['检查设计链与边界判断是否真正分清。', '保持先后测、后 AI compare 的顺序。'],
    [
      { label: '本页目标', question: '后测在检查哪些仍可能残留的混淆？' },
      { label: '允许范围', question: 'AI compare 在这一页的边界是什么？' },
    ],
    '允许范围：错因对照、设计链复盘、边界纠偏。禁止范围：代写后测答案。关键事实：后测与一句解释提交后才允许打开 AI compare。',
  ),
  'step-13': context(
    'step-13',
    '收束：从指标走到结构选择',
    'summary',
    ['把本课收束为三句结论和一句个人反思。', '让学生带着可迁移的设计语言离开本课。'],
    [
      { label: '本页目标', question: '三句结论分别对应哪三类设计入口或边界提醒？' },
      { label: '允许范围', question: '出口反思最适合围绕什么来总结？' },
    ],
    '允许范围：三句结论、信息图、下一课去向。禁止范围：引入新任务或新例题。关键事实：时域先翻译成区域，频域先翻译成补角与交叉频率，非最小相先重审目标。',
  ),
};

export function getUnit36StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_6_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit36StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_6_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_6StepAIContext = getUnit36StepAIContext;
export const getUNIT_3_6StepQuickQuestions = getUnit36StepQuickQuestions;
