import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_3_COURSE_META = {
  courseId: 'unit-3-3-root-locus-rules-v1',
  courseTitle: '3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移',
  courseDescription:
    '围绕 GH=-1、相角/幅值条件、完整法则、广义根轨迹与动态翻译，建立模块 3 的极点迁移机制主线。',
  keyConcepts: ['根轨迹', '相角条件', '幅值条件', '完整法则', '广义根轨迹', '动态翻译'],
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
    '模块 3 路径定位：从稳定边界走向极点迁移机制',
    'theory',
    ['明确 3-3 在 3-2 与 3-4 之间承担迁移机制主线', '区分边界语言和迁移机制语言'],
    [
      { label: '课程位置', question: '为什么 3-3 不是重复 3-2 的边界结论，而是要补上迁移机制？' },
      { label: '后续去向', question: '3-3 学完后，为什么自然会进入 3-4 的读图窗口与对象化验证？' },
    ],
    '当前步骤只负责课程定位，不提前展开具体法则和完整例题。',
  ),
  'step-02': context(
    'step-02',
    '边界点已知为什么仍不够',
    'quiz',
    ['修正“知道 K=6 就够了”的误判', '建立整条迁移路径才解释动态趋势的意识'],
    [
      { label: '为什么不够', question: '为什么知道边界点 K=6 仍不足以解释系统在边界之前如何变化？' },
      { label: '还缺什么', question: '如果要判断系统先变快还是先变振荡，还必须掌握哪类信息？' },
    ],
    '当前步骤只暴露误判，不直接给完整法则答案。',
  ),
  'step-03': context(
    'step-03',
    '本课目标与边界',
    'theory',
    ['明确本课负责条件入口、完整法则、广义视角与动态翻译', '守住不提前进入 3-4 读图窗口的边界'],
    [
      { label: '五项目标', question: '3-3 这节课最终要建立哪五项核心能力？' },
      { label: '本课不做什么', question: '为什么这节课要停在迁移机制和法则，而不继续滑到 3-4 的读图判断？' },
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
    '从闭环特征方程到 GH=-1',
    'theory',
    ['明确相角条件和幅值条件的共同来源', '建立条件入口链'],
    [
      { label: '入口链', question: '为什么根轨迹后续法则都会从 GH=-1 这一步自然分出？' },
      { label: '等价改写', question: '把闭环特征方程改写成 GH=-1 后，到底保留了哪些关键信息？' },
    ],
    '只围绕特征方程与等价改写解释，不提前跳到完整法则。',
  ),
  'step-06': context(
    'step-06',
    '相角条件与幅值条件的使用顺序',
    'practice',
    ['稳住先相角后幅值的资格判断顺序', '避免把参数大小判断错当前置步骤'],
    [
      { label: '先资格后参数', question: '为什么判断一个点是否在根轨迹上时，必须先查相角条件，再看幅值条件？' },
      { label: '幅值条件回答什么', question: '在已经满足相角条件后，幅值条件究竟补充的是哪一层信息？' },
    ],
    'AI 只辅助学生复述判断链，不替学生先做选择。',
  ),
  'step-07': context(
    'step-07',
    '完整法则第一层：先搭骨架',
    'practice',
    ['理解起点终点、实轴区段、渐近线是骨架层法则', '避免一上来陷入关键节点计算'],
    [
      { label: '为什么先骨架', question: '为什么画根轨迹时必须先用起点终点、实轴区段和渐近线搭整体骨架？' },
      { label: '骨架回答什么', question: '只靠骨架法则时，你已经能确定图形的哪些大势信息？' },
    ],
    '当前步骤只聚焦骨架法则，不提前跳到分离点和虚轴交点计算。',
  ),
  'step-08': context(
    'step-08',
    '关键节点的职责区分',
    'practice',
    ['区分分离点、虚轴交点、起始角终止角各自回答的问题', '避免把三类关键节点混成同一类细节'],
    [
      { label: '各自回答什么', question: '分离点、虚轴交点、起始角终止角分别回答根轨迹图中的什么问题？' },
      { label: '为什么不能混', question: '为什么如果把三类关键节点混在一起，后续画图顺序就会混乱？' },
    ],
    '请只帮助学生区分角色，不把三类节点压成一个统一公式黑箱。',
  ),
  'step-09': context(
    'step-09',
    '完整例题：骨架、关键点与稳定范围串联',
    'workspace',
    ['用一道三阶对象主例串联法则层次', '理解 K=6 同时连接根轨迹关键节点与稳定边界'],
    [
      { label: '三步顺序', question: '这道例题为什么必须按“先骨架、再关键点、最后稳定范围”来推进？' },
      { label: 'K=6 的双重角色', question: '为什么 K=6 既是根轨迹上的关键节点，又是稳定性变化点？' },
    ],
    'AI 只做步骤核对与错因提示，不一次性给出整题答案。',
  ),
  'step-10': context(
    'step-10',
    '广义根轨迹：把一般参数问题改写回普通根轨迹',
    'practice',
    ['理解广义根轨迹没有新法则，只是换了入口', '掌握 B(s)+aA(s)=0 到 1+aA(s)/B(s)=0 的改写链'],
    [
      { label: '等效开环', question: '为什么把一般参数问题改写成等效开环后，就可以直接复用普通根轨迹法则？' },
      { label: '不是新工具', question: '为什么说增益根轨迹只是广义根轨迹的特例，而不是两套平行工具？' },
    ],
    '当前步骤只讲改写链和等效开环，不把广义根轨迹说成独立新算法。',
  ),
  'step-11': context(
    'step-11',
    '时间常数例子与 0°/180° 根轨迹',
    'practice',
    ['比较一般参数例子与 0°/180° 根轨迹的共同研究对象', '理解相角条件变化带来的图形差异'],
    [
      { label: '共同对象', question: '时间常数例子、0° 根轨迹和 180° 根轨迹，研究的为什么仍是同一类闭环根迁移问题？' },
      { label: '差异来源', question: '0° 与 180° 根轨迹的图形差异，最核心地来自哪条相角条件变化？' },
    ],
    '请坚持“同一研究对象、不同相角条件”的对照，不新增额外算例。',
  ),
  'step-12': context(
    'step-12',
    '动态翻译：把极点迁移读回稳定性、快慢和振荡',
    'practice',
    ['建立左右半平面、离虚轴距离、主导分支三条翻译线', '为 3-4 的窗口读图做准备'],
    [
      { label: '三条翻译线', question: '从根轨迹图上判断稳定性、快慢和振荡时，最重要的三条翻译线分别是什么？' },
      { label: '主导分支', question: '为什么判断系统更振荡时，必须先盯住主导分支而不是机械看所有分支？' },
    ],
    'AI 只辅助学生把图形位置翻译回动态结论，不替学生直接给最终判断。',
  ),
  'step-13': context(
    'step-13',
    '后测与收束：从法则走向读图窗口',
    'quiz',
    ['检查学生是否掌握相角/幅值顺序、骨架与关键节点分工、广义改写链', '把出口推进到 3-4'],
    [
      { label: '后测抓手', question: '如果三道后测只允许抓一个总错误源，最该优先抓的是哪一类？' },
      { label: '下一课去向', question: '为什么 3-3 收束后，下一课自然会进入按图读窗口与对象化验证？' },
    ],
    '当前步骤要做的是后测诊断与课程收束，不新增新法则。',
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
