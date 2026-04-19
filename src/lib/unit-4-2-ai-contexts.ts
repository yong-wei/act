import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_4_2_COURSE_META = {
  courseId: 'unit-4-2-controller-selection-first-start-v1',
  courseTitle: '4-2：控制器选型原理：不同控制结构为何适合不同任务',
  courseDescription:
    '围绕结构工具箱、双案例首轮起步与前馈补偿边界，把任务表达卡推进成单结构首轮起步卡。',
  keyConcepts: ['结构工具箱', '主矛盾', '低频补偿', '中频动态品质', '前馈补偿', '首轮起步卡'],
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
    courseId: UNIT_4_2_COURSE_META.courseId,
    courseTitle: UNIT_4_2_COURSE_META.courseTitle,
    pageType,
    stepId,
    topic,
    learningObjectives,
    knowledgeType: 'D',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions,
    systemPromptExtension,
  };
}

export const UNIT_4_2_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：4-2 只做单结构首轮起步判断',
    'theory',
    ['明确 4-2 的角色是结构首轮起步判断', '守住不越级到 4-3 的边界'],
    [
      { label: '为什么不能直接 PID', question: '为什么 4-1 的任务表达卡到了 4-2，仍不能直接把 PID 当成默认答案？' },
      { label: '4-2 负责什么', question: '4-2 的输出为什么只是单结构首轮起步卡，而不是完整方案？' },
    ],
    '当前页面只解释课程路径和边界，不给出任何完整结构组合方案。',
  ),
  'step-02': context(
    'step-02',
    '前测：结构名字不是答案',
    'quiz',
    ['识别 PID 默认化、前馈万能化和更快即更适合三类误判', '把选型问题重新拉回任务矛盾'],
    [
      { label: 'PID 误判', question: '为什么“PID 看起来最全，所以默认先用 PID”是一个错误起点？' },
      { label: '前馈误判', question: '为什么前馈不能被理解成“比反馈更高级”的主方案？' },
    ],
    '只做错因归类与术语纠偏，不替学生直接作答。',
  ),
  'step-03': context(
    'step-03',
    '六步判断链：先看主矛盾，再说结构名字',
    'theory',
    ['阅读并理解六步判断链', '理解参数方向句式为什么必须从主矛盾出发'],
    [
      { label: '主矛盾在哪', question: '面对一个任务时，怎样判断主矛盾首先落在低频、中频还是通道补偿？' },
      { label: '方向怎么写', question: '“参数先朝哪个方向起”这句话，为什么必须先依附于主矛盾而不是结构名字？' },
    ],
    '当前页面只做判断链与句式解释，不再发放学生作答。',
  ),
  'step-04': context(
    'step-04',
    '结构工具箱：先按作用机制分组',
    'practice',
    ['按语义重组 P/PI/PD/PID/超前/滞后/前馈', '基于表 3 前三列完成多选判断'],
    [
      { label: '为什么先选语义', question: '为什么控制结构应该先按“补低频 / 改中频 / 通道补偿”等语义重组，而不是按名字平铺？' },
      { label: 'PID 何时进入', question: '哪些条件同时成立时，PID 或复合结构才值得进入首轮候选？' },
    ],
    '只帮助学生重组工具箱，不提前代写起步卡。',
  ),
  'step-05': context(
    'step-05',
    '客船案例入口：低频保持能力优先',
    'practice',
    ['用客船跨域图识别低频主矛盾', '把慢扰动抑制和保持能力写成起步证据'],
    [
      { label: '为什么先补低频', question: '客船航向保持里，为什么第一步更自然地落在低频补偿，而不是先抢更快响应？' },
      { label: '代价从哪来', question: '若首轮用 PI 或滞后起步，最先要警惕的代价是什么？' },
    ],
    '只帮助学生把客船证据压回低频优先判断，不直接代写完整起步卡。',
  ),
  'step-06': context(
    'step-06',
    '客船展开：PI/滞后为何先于 PD',
    'practice',
    ['比较 PI 与 PD 对客船主矛盾的针对性', '按讲义显影链解释滞后候选的工程意义'],
    [
      { label: '为什么不是 PD', question: '客船案例里，为什么 PD 不能作为首轮主线，而 PI/滞后更合适？' },
      { label: '滞后像什么', question: '滞后在客船案例里承担的“更克制的低频补偿”含义是什么？' },
    ],
    '只帮助学生核对客船比较链，不直接生成完整参数方案。',
  ),
  'step-07': context(
    'step-07',
    '平台案例入口：中频动态品质与储备',
    'practice',
    ['识别速度已建立但阻尼仍紧的中频问题', '把平台证据压回储备与动态品质判断'],
    [
      { label: '为什么不先补 PI', question: '平台案例里，为什么速度已经建立后，第一步不应先回到 PI 的低频补偿逻辑？' },
      { label: '储备怎么看', question: '平台案例里，中频动态品质和储备边界为什么要一起看？' },
    ],
    '只帮助学生把证据整理成平台主矛盾，不直接代写完整起步卡。',
  ),
  'step-08': context(
    'step-08',
    '平台展开：PD/超前为何先于 PI',
    'practice',
    ['比较 PD 与 PI 对平台主矛盾的作用点', '按讲义显影链理解超前是 PD 的工程化写法'],
    [
      { label: '为什么先改中频', question: '稳定平台为什么要先整理中频相位与阻尼，而不是先补低频精度？' },
      { label: '超前像什么', question: '为什么可以把超前理解成更工程化的 PD 写法？' },
    ],
    '允许解释比较表和显影链，不跳到下一课的复合结构。',
  ),
  'step-09': context(
    'step-09',
    '输入前馈：参考通道补偿不等于 PD 改名',
    'practice',
    ['区分输入前馈与 PD 的作用通道', '理解根轨迹近似重合背后的原因'],
    [
      { label: '为什么不是 PD', question: '输入前馈为什么不是把 PD 改了一个名字，而是真正改动了参考通道？' },
      { label: '先验证什么', question: '在输入前馈的首轮判断里，最先该验证什么现象改变了？' },
    ],
    '只帮助学生理解结构图区别和验证目标，不代写完整补偿器。',
  ),
  'step-10': context(
    'step-10',
    '扰动前馈：补偿候选但不替代反馈保底',
    'practice',
    ['区分反馈保底与前馈补偿的职责', '识别模型与测量质量带来的风险'],
    [
      { label: '为什么仍要反馈', question: '即使已经加入扰动前馈，为什么反馈仍必须承担稳定与鲁棒性的保底职责？' },
      { label: '风险是什么', question: '扰动前馈最容易被低估的三类工程风险分别是什么？' },
    ],
    '只做边界澄清和风险核对，不把前馈讲成万能方案。',
  ),
  'step-11': context(
    'step-11',
    '单结构首轮起步卡工作区',
    'practice',
    ['把结构、参数方向、收益与代价写成六字段最小起步卡', '让起步卡能够直接交给 4-3'],
    [
      { label: '起步卡缺什么', question: '一张最小起步卡如果没有写参数方向和主要代价，会让后续 4-3 缺什么输入？' },
      { label: '起步卡怎么写', question: '写六字段最小起步卡时，怎样同时把结构理由、参数方向、收益和代价写完整？' },
    ],
    '只允许做字段完整性和证据对应检查，不替学生直接生成完整方案。',
  ),
  'step-12': context(
    'step-12',
    '后测：先看主矛盾，再选结构',
    'quiz',
    ['检查是否形成结构首轮判断链', '检查是否仍把结构名字当答案'],
    [
      { label: '链条还差什么', question: '如果一个人还能说出结构名字，却说不清主矛盾和代价，说明他缺了哪一段判断链？' },
      { label: '前馈边界', question: '为什么后测里仍要反复检查“前馈进入候选但不能替代反馈”这条边界？' },
    ],
    '只做判断链核对，不替学生直接作答。',
  ),
  'step-13': context(
    'step-13',
    '收束：4-2 的出口交给 4-3',
    'theory',
    ['把五句带走固定下来', '把 4-2 与 4-3 的边界重新钉死'],
    [
      { label: '五句带走', question: '4-2 结束时，最该带走的五句判断分别是什么？' },
      { label: '为什么交给 4-3', question: '为什么 4-2 只产出单结构首轮起步卡，复合结构骨架必须交给 4-3？' },
    ],
    '当前页面只做总结与去向说明，不提前展开复合结构方案。',
  ),
};

export function getUnit42StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_4_2_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit42StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_4_2_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_4_2StepAIContext = getUnit42StepAIContext;
export const getUNIT_4_2StepQuickQuestions = getUnit42StepQuickQuestions;
