import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_3_COURSE_META = {
  courseId: 'unit-3-3-root-locus-rules-v1',
  courseTitle: '3-3：根轨迹机制与完整法则——普通根轨迹的形成与关键法则',
  courseDescription:
    '围绕普通根轨迹的定义、两大判据、九项法则、广义改写与动态翻译，建立模块 3 的根轨迹判断主线。',
  keyConcepts: ['根轨迹', '相角条件', '幅值条件', '九项法则', '广义根轨迹', '动态翻译'],
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
    courseId: UNIT_3_3_COURSE_META.courseId,
    courseTitle: UNIT_3_3_COURSE_META.courseTitle,
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

export const UNIT_3_3_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '模块 3 路径定位：为什么稳定边界还不等于迁移机制',
    'theory',
    ['明确 3-3 承接 3-2、通往 3-4 的位置', '区分稳定边界与迁移机制各自回答的问题'],
    [
      { label: '课程位置', question: '为什么 3-3 不是重复 3-2 的边界结论，而是要补上极点如何迁移？' },
      { label: '后续去向', question: '为什么 3-3 学完后，自然会进入 3-4 的读图窗口与对象化判断？' },
    ],
    '当前步骤只负责课程定位，不提前展开九项法则和具体例题。',
  ),
  'step-02': context(
    'step-02',
    '问题引入：知道稳定区间为什么仍然不够',
    'quiz',
    ['修正“知道边界点就够了”的误判', '建立整条迁移路径才解释动态趋势的意识'],
    [
      { label: '为什么不够', question: '为什么只知道稳定区间或边界点，仍不足以解释系统一路如何变化？' },
      { label: '还缺什么', question: '如果要判断系统先往哪走、何时更振荡，还必须掌握哪类信息？' },
    ],
    '当前步骤只暴露误判，不直接给完整法则答案。',
  ),
  'step-03': context(
    'step-03',
    '本课目标与研究对象',
    'theory',
    ['明确本课负责研究对象、条件入口、九项法则、广义改写与动态翻译', '守住不提前进入 3-4 读图窗口的边界'],
    [
      { label: '主线链', question: '为什么本课主线必须写成“参数变化到动态翻译”的完整链，而不是零散法则清单？' },
      { label: '本课边界', question: '为什么这节课要停在迁移机制和法则，而不提前滑到控制器设计或 3-4 读图窗口？' },
    ],
    '请围绕目标链与边界表解释，不替代后续页面讲解。',
  ),
  'step-04': context(
    'step-04',
    '根轨迹定义：从单点求根转向闭环根集合',
    'practice',
    ['建立参数变化下闭环根集合的视角', '理解单点求根不足以支持工程判断'],
    [
      { label: '为什么是集合', question: '为什么根轨迹首先研究的是“参数变化下的闭环根集合”，而不是单个参数点的根？' },
      { label: '单点不够', question: '为什么把每个参数都代进去求一次根，不适合作为工程上的主判断方式？' },
    ],
    '允许解释趋势与集合视角，不替学生生成标准短答。',
  ),
  'step-05': context(
    'step-05',
    '从 1+L(s)=0 到相角条件与幅值条件',
    'practice',
    ['明确相角条件和幅值条件的共同来源', '稳住先资格后参数的使用顺序'],
    [
      { label: '入口链', question: '为什么根轨迹后续法则都会从 L(s)=-1 这一步自然分出？' },
      { label: '顺序', question: '为什么判断一个点是否在根轨迹上时，必须先看相角条件，再回到幅值条件？' },
    ],
    'AI 只辅助学生复述判断链，不替学生先给结论。',
  ),
  'step-06': context(
    'step-06',
    '骨架法则板：起点终点、实轴区段与渐近线',
    'practice',
    ['理解起点终点、实轴区段、渐近线是第一轮骨架法则', '避免一上来陷入关键节点细节'],
    [
      { label: '为什么先骨架', question: '为什么画根轨迹时必须先用起点终点、实轴区段和渐近线搭整体骨架？' },
      { label: '骨架回答什么', question: '只靠骨架法则时，你已经能确定图形的哪些大势信息？' },
    ],
    '当前步骤只聚焦骨架法则，不提前跳到分离点和虚轴交点计算。',
  ),
  'step-07': context(
    'step-07',
    '例题 1：只用骨架法则先判断整体走向',
    'workspace',
    ['把骨架法则绑到完整题面上', '先读题面，再按骨架法则给出整体走向'],
    [
      { label: '实轴区段', question: '这道例题中，哪些实轴区段属于根轨迹，为什么？' },
      { label: '渐近线', question: '为什么只靠起点终点、实轴区段和渐近线，已经能先判断整体走向？' },
    ],
    'AI 只做骨架判断核对，不一次性给整题答案。',
  ),
  'step-08': context(
    'step-08',
    '关键节点与局部方向',
    'practice',
    ['区分分离点、虚轴交点、出射角、入射角、根之和各自回答的问题', '避免把关键节点混成同一类细节'],
    [
      { label: '各自回答什么', question: '分离点、虚轴交点、出射角 / 入射角、根之和分别回答根轨迹图中的什么问题？' },
      { label: '为什么不能混', question: '为什么如果把这些关键节点混在一起，后续画图顺序就会混乱？' },
    ],
    '请只帮助学生区分角色，不把不同法则压成一个统一公式黑箱。',
  ),
  'step-09': context(
    'step-09',
    '例题 2：dK/ds 与劳斯判据的双方法分工',
    'workspace',
    ['在同一题里分清实轴关键点和稳定边界', '理解 dK/ds 与劳斯判据各自回答的问题'],
    [
      { label: '双方法分工', question: '为什么这道例题里 dK/ds 用来找实轴关键点，而劳斯判据用来找稳定边界？' },
      { label: '边界含义', question: '为什么 K=6 不是“整图都结束”的答案，而是虚轴交点对应的临界稳定边界？' },
    ],
    'AI 只做步骤核对与错因提示，不一次性给出整题答案。',
  ),
  'step-10': context(
    'step-10',
    '例题 3：局部出射角与整图自洽',
    'practice',
    ['理解局部出射角与整图自洽必须同时成立', '用根之和原则复核整张图是否闭合'],
    [
      { label: '出射角', question: '为什么复极点附近的局部方向必须用出射角来补，而不是只看实轴区段？' },
      { label: '根之和', question: '根之和原则为什么能帮助你复核整张图是否自洽？' },
    ],
    '当前步骤只围绕局部方向与整图自洽，不跳去广义根轨迹。',
  ),
  'step-11': context(
    'step-11',
    '读图顺序：先骨架，再关键点，最后补局部方向',
    'practice',
    ['把九项法则重组为真实的七步读图法', '避免把法则当成平铺清单'],
    [
      { label: '排序依据', question: '为什么读图时必须先写极点零点、判实轴区段、求渐近线，再补关键点和局部方向？' },
      { label: '典型误判', question: '为什么“先抓分离点再说”会把整张图的阅读顺序带偏？' },
    ],
    'AI 只帮助学生建立流程顺序，不把读图过程压成结论口号。',
  ),
  'step-12': context(
    'step-12',
    '三类开环极点：原点极点、实轴极点、共轭复极点',
    'practice',
    ['把对象类型与轨迹趋势线索对应起来', '从开环极点类型回到轨迹大势判断'],
    [
      { label: '对象类型', question: '原点极点、实轴极点、共轭复极点分别会留下哪些不同的轨迹趋势线索？' },
      { label: '为什么回到对象', question: '为什么只背法则名称还不够，必须重新回到开环极点对象类型？' },
    ],
    'AI 只帮助学生把对象类型与趋势对应起来，不替学生先做分类。',
  ),
  'step-13': context(
    'step-13',
    '广义根轨迹：一般参数如何改写成标准问题',
    'practice',
    ['理解广义根轨迹没有新法则，只是换了改写入口', '掌握 B(s)+aA(s)=0 到 1+aA(s)/B(s)=0 的改写链'],
    [
      { label: '等效开环', question: '为什么把一般参数问题改写成等效开环后，就可以直接复用普通根轨迹法则？' },
      { label: '不是新工具', question: '为什么说广义根轨迹不是一套独立新算法，而是普通根轨迹的标准化改写？' },
    ],
    '当前步骤只讲改写链和等效开环，不把广义根轨迹说成独立新算法。',
  ),
  'step-14': context(
    'step-14',
    '时间常数例子与 0° / 180° 根轨迹对照',
    'practice',
    ['比较时间常数例子与 0° / 180° 根轨迹的共同研究对象', '理解相角方向变化带来的图形差异'],
    [
      { label: '共同对象', question: '时间常数例子、0° 根轨迹和 180° 根轨迹，研究的为什么仍是同一类闭环根迁移问题？' },
      { label: '差异来源', question: '0° 与 180° 根轨迹的图形差异，最核心地来自哪条相角条件变化？' },
    ],
    '请坚持“同一研究对象、不同相角条件”的对照，不新增额外复杂算例。',
  ),
  'step-15': context(
    'step-15',
    '动态翻译：把极点迁移读回稳定性、快慢与振荡',
    'practice',
    ['建立左右半平面、离虚轴距离、主导极点位置三条翻译线', '为 3-4 的窗口读图做准备'],
    [
      { label: '三条翻译线', question: '从根轨迹图上判断稳定性、快慢和振荡时，最重要的三条翻译线分别是什么？' },
      { label: '主导极点', question: '为什么判断系统更振荡时，必须先盯住主导极点而不是机械看所有分支？' },
    ],
    'AI 只辅助学生把图形位置翻译回动态结论，不替学生直接给最终判断。',
  ),
  'step-16': context(
    'step-16',
    '后测：条件、法则、改写与读图顺序是否已经成链',
    'quiz',
    ['检查学生是否掌握条件入口、法则层次、广义改写与动态翻译', '把出口推进到 3-4'],
    [
      { label: '后测抓手', question: '如果三道后测只允许抓一个总错误源，最该优先抓的是哪一类？' },
      { label: '链条是否形成', question: '为什么后测要同时检查条件入口、法则层次、改写链和动态翻译，而不是只问一个公式？' },
    ],
    '当前步骤要做的是后测诊断，不新增新法则。',
  ),
  'step-17': context(
    'step-17',
    '收束与去向：把九项法则带到 3-4',
    'theory',
    ['回收本课五条带走结论', '明确 3-4 将如何接走 3-3 的法则链'],
    [
      { label: '五条带走', question: '3-3 结束时，最应该带走的五条结论分别是什么？' },
      { label: '下一课去向', question: '为什么 3-4 会从“先骨架后关键点再补局部方向”这条链继续展开？' },
    ],
    '当前步骤只做课程回收与下一课去向说明，不引入新内容。',
  ),
};

export function getUnit33StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_3_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit33StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_3_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_3StepAIContext = getUnit33StepAIContext;
export const getUNIT_3_3StepQuickQuestions = getUnit33StepQuickQuestions;
