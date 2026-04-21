import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_3_COURSE_META = {
  courseId: 'unit-3-3-root-locus-rules-v1',
  courseTitle: '3-3：根轨迹机制与完整法则——普通根轨迹的形成与关键法则',
  courseDescription:
    '围绕根轨迹定义、两大条件、九项法则、三组例题、读图顺序与对象影响，建立模块 3 的根轨迹判断主线。',
  keyConcepts: ['根轨迹', '相角条件', '幅值条件', '九项法则', '读图顺序', '开环极点类型'],
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
    '模块定位：为什么稳定边界还不等于迁移机制',
    'theory',
    ['明确 3-3 承接 3-2 并连接 3-4', '区分边界判断与迁移机制'],
    [
      { label: '课程位置', question: '为什么 3-3 不是重复 3-2 的边界结论，而是要补上极点怎样迁移？' },
      { label: '下一课去向', question: '为什么 3-4 会从今天的法则链继续展开读图判断？' },
    ],
    '当前步骤只做模块定位，不提前展开具体法则和例题。',
  ),
  'step-02': context(
    'step-02',
    '问题引入：知道稳定区间为什么仍然不够',
    'quiz',
    ['修正“知道边界就够了”的误判', '建立整条迁移路径意识'],
    [
      { label: '为什么不够', question: '为什么只知道稳定区间或边界点，仍不足以解释系统一路如何变化？' },
      { label: '还缺什么', question: '如果要判断极点先往哪走、何时更振荡，还必须掌握哪类信息？' },
    ],
    '当前步骤只暴露误判，不直接给完整法则答案。',
  ),
  'step-03': context(
    'step-03',
    '本课目标：完成本次课程后你应能做到什么',
    'theory',
    ['明确本课的能力目标与主线链', '不把边界表暴露给学生'],
    [
      { label: '主线链', question: '为什么本课主线必须写成“参数变化到动态判断”的完整链，而不是零散法则清单？' },
      { label: '能力目标', question: '四个课程目标分别落在什么判断动作上？' },
    ],
    '请只围绕课程目标与主线链解释，不补边界表。',
  ),
  'step-04': context(
    'step-04',
    '根轨迹定义与两大条件',
    'theory',
    ['理解根轨迹研究的是闭环根集合', '把相角条件和幅值条件都接回 L(s)=-1'],
    [
      { label: '集合视角', question: '为什么根轨迹研究的是“参数变化下的闭环根集合”，而不是某一个参数点的单个根？' },
      { label: '共同入口', question: '为什么相角条件和幅值条件都从 L(s)=-1 这一步分出？' },
    ],
    '当前步骤只讲定义、方程链和两大条件，不引入额外例子。',
  ),
  'step-05': context(
    'step-05',
    '条件互动：拖动 s0 检查相角条件与幅值条件',
    'workspace',
    ['用拖点交互检查资格与参数', '稳住先资格后参数的顺序'],
    [
      { label: '资格判断', question: '拖到某个 s0 后，为什么必须先看相角条件，再回头看增益值？' },
      { label: '右侧分解', question: '右侧每个极点 / 零点的相角和模值贡献，分别服务哪一步判断？' },
    ],
    'AI 只辅助学生复述判断链，不替学生跳过拖点过程。',
  ),
  'step-06': context(
    'step-06',
    '骨架法则：起点终点、实轴区段与渐近线',
    'workspace',
    ['先用骨架法则搭整体走向', '理解骨架法则为什么优先于关键节点'],
    [
      { label: '为什么先骨架', question: '为什么画根轨迹时必须先用起点终点、实轴区段和渐近线搭整体骨架？' },
      { label: '骨架回答什么', question: '只靠骨架法则时，你已经能确定图形的哪些大势信息？' },
    ],
    '当前步骤只聚焦骨架法则，不提前跳到关键节点。',
  ),
  'step-07': context(
    'step-07',
    '例题 1：只用骨架法则先判断整体走向',
    'workspace',
    ['把骨架法则绑到完整题面上', '先读题面，再做双栏作答'],
    [
      { label: '实轴区段', question: '这道题中，哪些实轴区段属于根轨迹，为什么？' },
      { label: '渐近线', question: '为什么只靠起点终点、实轴区段和渐近线，已经能先判断整体走向？' },
    ],
    'AI 只做骨架判断核对，不一次性给整题答案。',
  ),
  'step-08': context(
    'step-08',
    '分离点与虚轴交点：关键节点怎样进入主图',
    'theory',
    ['区分 dK/ds 与劳斯判据的职责', '把关键节点写回主图而不是混成一团'],
    [
      { label: '分离点', question: '为什么 dK/ds=0 只给出候选点，仍然需要做区段与 K>0 的筛选？' },
      { label: '虚轴交点', question: '为什么虚轴交点必须回到劳斯判据，而不是只凭图形目测？' },
    ],
    '当前步骤只解释关键节点法则，不代替后面的例题求解。',
  ),
  'step-09': context(
    'step-09',
    '例题 2：用 dK/ds 与劳斯判据找关键节点',
    'workspace',
    ['在同一题里区分实轴关键点与稳定边界', '保持两条显影链的分工'],
    [
      { label: '双方法分工', question: '为什么这道例题里 dK/ds 用来找实轴关键点，而劳斯判据用来找稳定边界？' },
      { label: '边界意义', question: '为什么 K=6 对应的不是“整图结束”，而是虚轴交点处的临界稳定边界？' },
    ],
    'AI 只做步骤核对与错因提示，不一次性给出整题答案。',
  ),
  'step-10': context(
    'step-10',
    '出射角、入射角与根之和',
    'theory',
    ['理解局部方向法则与整图守恒约束', '为例题 3 做准备'],
    [
      { label: '局部方向', question: '出射角和入射角分别回答图上的什么问题？' },
      { label: '整图守恒', question: '为什么根之和原则能帮助你检查整张图是否自洽？' },
    ],
    '当前步骤只讲法则页，不替代例题 3 的推导过程。',
  ),
  'step-11': context(
    'step-11',
    '例题 3：复极点附近怎样离开，整张图怎样自洽',
    'workspace',
    ['把出射角链与根之和复核链放回同一道题', '保持题面常显和双栏作答'],
    [
      { label: '出射角', question: '为什么这道题里必须先求出射角，才能解释复极点附近的离开方向？' },
      { label: '根之和', question: '根之和原则为什么会限制另一实根的位置与整图走向？' },
    ],
    'AI 只辅助学生复述出射角与根之和的联系，不跳过例题推导链。',
  ),
  'step-12': context(
    'step-12',
    '读图顺序：先骨架，再关键点，最后补局部方向',
    'practice',
    ['把九项法则重组为七步读图法', '避免把法则当成平铺清单'],
    [
      { label: '排序依据', question: '为什么读图时必须先写极点零点、判实轴区段、求渐近线，再补关键点和局部方向？' },
      { label: '典型误判', question: '为什么“先抓分离点再说”会把整张图的阅读顺序带偏？' },
    ],
    'AI 只帮助学生建立流程顺序，不把读图过程压成口号。',
  ),
  'step-13': context(
    'step-13',
    '三类开环极点：原点极点、实轴极点、共轭复极点',
    'practice',
    ['把对象类型与轨迹趋势线索对应起来', '从开环极点回到轨迹大势判断'],
    [
      { label: '对象类型', question: '原点极点、实轴极点、共轭复极点分别会留下哪些不同的轨迹趋势线索？' },
      { label: '为什么回到对象', question: '为什么只背法则名称还不够，必须重新回到开环极点对象类型？' },
    ],
    'AI 只帮助学生把对象类型与趋势对应起来，不替学生先做分类。',
  ),
  'step-14': context(
    'step-14',
    '后测：条件、法则、例题与读图顺序是否已经成链',
    'quiz',
    ['检查条件顺序、法则职责与读图顺序是否成链', '为 3-4 做出口诊断'],
    [
      { label: '总错误源', question: '如果只允许抓一个总错误源，最该优先抓的是条件顺序、法则职责还是读图顺序？' },
      { label: '链条是否形成', question: '为什么后测要同时检查条件、法则、例题和读图顺序，而不是只问一个公式？' },
    ],
    '当前步骤要做的是诊断，不新增新法则。',
  ),
  'step-15': context(
    'step-15',
    '总结：九项法则带走什么，3-4 从哪里接走',
    'theory',
    ['回收本课五条带走结论', '明确 3-4 将如何接走 3-3 的法则链'],
    [
      { label: '五条带走', question: '3-3 结束时最应该带走的五条结论分别是什么？' },
      { label: '下一课去向', question: '为什么 3-4 会从“先骨架后关键点再补局部方向”继续展开？' },
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
