import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_6_COURSE_META = {
  courseId: 'unit-3-6-zero-design-workshop-v1',
  courseTitle: '3-6：零点作用与动态改善实验——从性能目标到校正设计',
  courseDescription:
    '围绕目标分类、时域/频域指标翻译、PD/测速反馈/超前设计与非最小相边界选择，把“会判断”推进到“会按目标进入设计链”。',
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
    knowledgeType: 'X+C',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions,
    systemPromptExtension,
  };
}

export const UNIT_3_6_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '封面导入：目标必须先于工具',
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
    '回到地图：从 3-5 的机理走向 3-6 的设计',
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
    '五任务设计链与提交物总览',
    'theory',
    ['明确五任务链与固定交付物。', '把本课理解为完整设计链，而不是装置清单。'],
    [
      { label: '本页目标', question: '为什么五任务链不能缩成“几种校正装置介绍”？' },
      { label: '允许范围', question: '这一页允许我从哪些角度检查自己是否理解了课程主线？' },
    ],
    '允许范围：目标、任务链、交付物、实践规则。禁止范围：把任务链退化成装置名称列表。关键事实：本课固定产出包括指标翻译表、设计记录、边界判断卡与一页设计报告。',
  ),
  'step-04': context(
    'step-04',
    '前测：三类目标分别从哪里进入',
    'quiz',
    ['暴露时域、频域与边界入口混淆。', '保持先独立判断、后 AI 对照的顺序。'],
    [
      { label: '本页目标', question: '这组三题分别在检查哪三类入口混淆？' },
      { label: '允许范围', question: 'AI 在这一页只能怎样帮助我？' },
    ],
    '允许范围：错因归类、入口对照、术语纠偏。禁止范围：直接生成完整前测答案。关键事实：前测与理由提交完成后，才能进入控灵助手中的错因对照。',
  ),
  'step-05': context(
    'step-05',
    '任务书：统一对象、三类装置与五任务入口',
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
    '时域指标如何变成设计可行域',
    'workspace',
    ['把超调量和调节时间翻译成目标极点区域。', '说明为什么纯增益不能直接通过。'],
    [
      { label: '本页目标', question: '为什么时域指标必须先翻译成区域，而不是直接猜参数？' },
      { label: '允许范围', question: '这一步允许我让 AI 帮我检查哪些翻译链？' },
    ],
    '允许范围：Mp/ts 到 zeta/实部边界的翻译、纯增益失败原因。禁止范围：代替学生完成区域填写。关键事实：设计动作前必须先得到目标极点区域。',
  ),
  'step-07': context(
    'step-07',
    '任务 A：PD 时域设计',
    'workspace',
    ['先定设计点，再反求零点和增益。', '保持“设计点 -> 参数 -> 验收”的顺序。'],
    [
      { label: '本页目标', question: '为什么 PD 时域设计必须先选设计点，而不能直接背答案参数？' },
      { label: '允许范围', question: 'AI 在这一页最适合帮我检查哪一段链路？' },
    ],
    '允许范围：设计点、相角条件、模值条件、验收链。禁止范围：直接给出 T_d 和 K 的结果。关键事实：设计点是 PD 设计的入口，不是零点猜测。',
  ),
  'step-08': context(
    'step-08',
    '任务 B 的证据板：测速反馈为何不是“换位置的 PD”',
    'practice',
    ['建立测速反馈与 PD 的设计抓手差异。', '先认结构差异，再进入参数设计。'],
    [
      { label: '本页目标', question: '为什么测速反馈的入口是等效极点，而不是前向零点位置？' },
      { label: '允许范围', question: 'AI 在这一页能帮我核对哪些顺序性错误？' },
    ],
    '允许范围：结构图、等效方程、设计抓手差异。禁止范围：把测速反馈误写成前向显式增零点。关键事实：测速反馈先定等效极点位置。',
  ),
  'step-09': context(
    'step-09',
    '任务 B：测速反馈时域设计',
    'workspace',
    ['把测速反馈改写成广义根轨迹问题。', '先定等效极点，再求 Kt 和 K。'],
    [
      { label: '本页目标', question: '为什么这里先定等效极点，而不是先猜零点位置？' },
      { label: '允许范围', question: 'AI 在这一页可以帮我核对哪些顺序性错误？' },
    ],
    '允许范围：等效极点位置、模值条件、顺序检查。禁止范围：只报参数结果不解释。关键事实：测速反馈先改写骨架，再验收时域。',
  ),
  'step-10': context(
    'step-10',
    '推导显影 B：频域目标如何进入超前设计',
    'practice',
    ['压实共同频域目标与超前四步链。', '先看只调增益为何失败，再进入超前设计。'],
    [
      { label: '本页目标', question: '为什么频域设计必须先看若只调增益会怎样？' },
      { label: '允许范围', question: '这一页最适合让 AI 帮我检查哪一类理由链？' },
    ],
    '允许范围：共同目标、失败证据、四步链。禁止范围：直接给出超前最终参数。关键事实：超前设计先看只调增益为何失败。',
  ),
  'step-11': context(
    'step-11',
    '任务 C：超前频域设计',
    'workspace',
    ['把频域目标翻译成补角与交叉频率。', '频域达标后仍要回查时域副作用。'],
    [
      { label: '本页目标', question: '为什么超前设计要同时检查补角、截止频率与时域回查？' },
      { label: '允许范围', question: '这一页最适合让 AI 帮我检查哪类频域判断？' },
    ],
    '允许范围：补角、交叉频率、幅值条件、时域回查。禁止范围：把超前设计压成“调到差不多”。关键事实：频域达标后仍需回查时域副作用。',
  ),
  'step-12': context(
    'step-12',
    '推导显影 C：为何同一频域指标下还要再做一次 PD',
    'practice',
    ['压实同指标比较副作用的课程意图。', '建立进入任务 D 前的比较维度。'],
    [
      { label: '本页目标', question: '为什么任务 D 必须沿用任务 C 完全相同的频域目标？' },
      { label: '允许范围', question: 'AI 在这一页可以如何帮助我理解比较意图？' },
    ],
    '允许范围：共同目标、比较维度、PD 频域入口。禁止范围：只讲频域达标，不提比较意图。关键事实：任务 D 的存在是为了比较副作用。',
  ),
  'step-13': context(
    'step-13',
    '任务 D：同指标下的 PD 频域设计与并排比较',
    'workspace',
    ['在同一频域目标下完成 PD 设计并比较副作用。', '明确“同指标比较才有资格讨论结构差异”。'],
    [
      { label: '本页目标', question: '为什么同一频域目标下的并排比较比单独做出一个 PD 更重要？' },
      { label: '允许范围', question: 'AI 可以如何帮助我组织比较表？' },
    ],
    '允许范围：共同目标、结构化比较、时域回查。禁止范围：只看频域达标就结束。关键事实：同指标比较才有资格讨论结构差异。',
  ),
  'step-14': context(
    'step-14',
    '任务 E：右半平面零点下的边界与结构选择',
    'workspace',
    ['在非最小相对象下先重审目标，再决定结构。', '明确右半平面零点会压缩可行带宽。'],
    [
      { label: '本页目标', question: '为什么非最小相对象下必须先重审目标，而不是直接继续调参数？' },
      { label: '允许范围', question: 'AI 可以如何帮助我判断非最小相边界下的结构选择？' },
    ],
    '允许范围：边界对象、目标重审、结构选择依据。禁止范围：不重审目标时直接推荐结构。关键事实：目标本身也是非最小相设计变量。',
  ),
  'step-15': context(
    'step-15',
    '后测与收束：从指标走到结构选择',
    'summary',
    ['完成课末后测、三句结论与一句反思。', '把目标先于工具的总原则带出课堂。'],
    [
      { label: '本页目标', question: '三句结论分别对应哪三类设计入口或边界提醒？' },
      { label: '允许范围', question: '出口反思最适合围绕什么来总结？' },
    ],
    '允许范围：课末总结、概念收束、后续去向。禁止范围：重做整套设计题答案。关键事实：目标先于工具是本课总原则。',
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
