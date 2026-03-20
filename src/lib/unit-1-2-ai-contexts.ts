import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_1_2_COURSE_META = {
  courseId: 'unit-1-2-block-diagram-simplification-v1',
  courseTitle: '1-2：系统结构图与化简——从积木块到系统蓝图',
  courseDescription:
    '围绕结构图四元素、三种基本连接、等效变换、代数化简与梅森公式，建立从局部积木到系统蓝图的组装视角。',
  keyConcepts: ['结构图', '串联', '并联', '反馈', '等效变换', '信号流图', '梅森公式'],
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
    courseId: UNIT_1_2_COURSE_META.courseId,
    courseTitle: UNIT_1_2_COURSE_META.courseTitle,
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

export const UNIT_1_2_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：从 1-1 的单环节到 1-2 的系统组装',
    'theory',
    ['理解本课在层 1 中承上启下的位置', '建立从积木块到系统蓝图的学习主线'],
    [
      { label: '承接关系', question: '1-2 与 1-1、1-3 的关系是什么？' },
      { label: '本课任务', question: '这节课为什么要学结构图与化简？' },
    ],
    '当前步骤只做课程定位。请把学生的注意力放在“单个环节已经会了，现在要处理多个环节如何组装”这一主线上，不要直接跳到具体公式细节。',
  ),
  'step-02': context(
    'step-02',
    '船舶航向控制系统：为什么需要结构图',
    'quiz',
    ['从工程系统识别多环节连接关系', '理解结构图作为图形语言的必要性'],
    [
      { label: '为什么画图', question: '为什么仅知道每个环节的传递函数还不够？' },
      { label: '关键连接', question: '船舶航向控制系统里最关键的连接关系是什么？' },
    ],
    '当前步骤重点不是算传递函数，而是说明结构图如何把控制器、舵机、船体和罗经之间的信号流动表达清楚。',
  ),
  'step-03': context(
    'step-03',
    '结构图四元素：方框、信号线、比较点、引出点',
    'theory',
    ['识别四种图形语法', '理解每种元素在工程系统中的含义'],
    [
      { label: '比较点', question: '比较点和引出点的功能有什么区别？' },
      { label: '方框', question: '为什么方框里通常只写传递函数而不写微分方程？' },
    ],
    '请把讲解聚焦在“元素负责表达什么关系”，避免把四个元素讲成孤立定义。每个元素都应回到船舶航向系统的对应部件。',
  ),
  'step-04': context(
    'step-04',
    '串联连接规则：串联相乘',
    'practice',
    ['掌握串联连接的推导逻辑', '能把多环节串联写成总传递函数'],
    [
      { label: '中间信号', question: '串联推导里为什么要先引入中间信号 Z(s)？' },
      { label: '推广', question: 'n 个环节串联时为什么仍然是全部相乘？' },
    ],
    '当前步骤要强调“前一个输出就是后一个输入”，再由这个中间量消掉得到相乘结论。请帮助学生检查分子分母是否同时正确保留下来。',
  ),
  'step-05': context(
    'step-05',
    '并联连接规则：并联相加',
    'practice',
    ['掌握并联连接的推导逻辑', '能在通分过程中保持表达式正确'],
    [
      { label: '同一输入', question: '并联连接里为什么两个支路都乘同一个 X(s)？' },
      { label: '通分', question: '并联相加后为什么通常需要先通分再整理？' },
    ],
    '当前步骤重点是“共享同一输入、输出在比较点代数求和”。请优先检查学生是否把并联误写成相乘，或在通分时漏项。',
  ),
  'step-06': context(
    'step-06',
    '反馈连接：前向除以（1+开环）',
    'theory',
    ['掌握负反馈闭环公式的推导', '区分开环传递函数与闭环传递函数'],
    [
      { label: '负反馈分母加', question: '为什么负反馈时分母是 1 + G(s)H(s)？' },
      { label: '开环 vs 闭环', question: '开环传递函数和闭环传递函数分别描述什么？' },
    ],
    '请把推导重点放在 E(s)=R(s)-H(s)Y(s) 和 Y(s)=G(s)E(s) 两步联立上，并反复提醒学生：负反馈分母加，正反馈分母减。',
  ),
  'step-07': context(
    'step-07',
    '前测：基本连接是否已经站稳',
    'quiz',
    ['用前测暴露对串联、偏差信号和单位反馈的薄弱点'],
    [
      { label: '易错点', question: '这三道前测题最容易错在哪里？' },
      { label: '单位反馈', question: '单位反馈时闭环公式为什么可以直接写成 G/(1+G)？' },
    ],
    '当前步骤只能帮助学生理解题目，不要代替作答。重点分析错因：串联误加、偏差信号正负号混淆、把闭环误写成开环。',
  ),
  'step-08': context(
    'step-08',
    '等效变换六条规则：逆流补乘，顺流补除',
    'workspace',
    ['理解为什么要做等效变换', '掌握比较点和引出点移动时的补偿方向'],
    [
      { label: '口诀', question: '“逆流补乘，顺流补除”应该怎样理解？' },
      { label: '为什么补偿', question: '移动比较点或引出点后，为什么必须加补偿环节？' },
    ],
    '请把解释建立在“移动前后同一信号线上的信号值不变”这个原则上。不要只背口诀，要说明信号在越过 G(s) 前后是否已经被放大。',
  ),
  'step-09': context(
    'step-09',
    '等效变换练习：比较点和引出点不要搞反',
    'practice',
    ['能在具体结构图中判断该补乘还是补除', '能用信号等价性验证自己的判断'],
    [
      { label: '比较点前移', question: '比较点前移越过 G(s) 时，为什么是补乘 G(s)？' },
      { label: '引出点前移', question: '引出点前移为什么恰好要补除 G(s)？' },
    ],
    '当前步骤重点在纠错。请反复提醒学生：比较点和引出点看起来都在“前移”，但补偿方向相反，必须先判断元素类型，再判断移动方向。',
  ),
  'step-10': context(
    'step-10',
    '代数化简法：从最内层反馈环开始',
    'theory',
    ['掌握双环系统逐层化简的通用策略', '理解内环反馈如何改变等效环节特性'],
    [
      { label: '先内后外', question: '为什么双环系统通常先化简最内层反馈环？' },
      { label: '工程意义', question: '内环反馈把 10/s 变成 10/(s+20) 说明了什么？' },
    ],
    '请把讲解聚焦在“每一步只做一种基本连接化简”这一策略上。学生容易在一步里做太多变换，导致分母整理出错。',
  ),
  'step-11': context(
    'step-11',
    '正反馈变形题：先手算，再用 AI 验证稳定性判断',
    'reflection',
    ['独立完成正反馈变形题', '借助 AI 检查化简路径与稳定性分析', '解释 s-20 对稳定性的含义'],
    [
      { label: '正反馈', question: '把内环改成正反馈后，第一步化简公式发生了什么变化？' },
      { label: '稳定性', question: '内环出现 s-20 项意味着什么？' },
    ],
    '当前步骤必须坚持“先手算、后 AI”。AI 的职责是验证推导、比较路径、点出正实部极点意味着不稳定，而不是直接代替学生给出最终答案。',
  ),
  'step-12': context(
    'step-12',
    '信号流图：把结构图换成拓扑视角',
    'theory',
    ['理解节点与支路分别对应什么', '会把结构图中的信号变量转换成节点'],
    [
      { label: '节点', question: '信号流图里的节点为什么代表信号而不是元件？' },
      { label: '转换动机', question: '为什么复杂结构图更适合先转成信号流图？' },
    ],
    '请把讲解重点放在“结构图强调元件连接，信号流图强调信号拓扑”这一差异上。学生容易把节点误解成方框。',
  ),
  'step-13': context(
    'step-13',
    '梅森增益公式：前向通路、回路、余因子和特征式',
    'workspace',
    ['读懂梅森公式每个符号的意义', '掌握三步法：找通路、找回路、代公式'],
    [
      { label: 'Delta', question: '特征式 Delta 为什么会出现交替正负号？' },
      { label: '余因子', question: 'Delta_k 到底删掉了哪些回路？' },
    ],
    '请优先帮助学生分辨“前向通路不重复经过节点”和“回路必须闭合”这两个判定标准，再解释不接触回路为什么可以成对相乘。',
  ),
  'step-14': context(
    'step-14',
    '梅森公式应用：5 节点信号流图例题',
    'workspace',
    ['能在具体信号流图上找出所有前向通路与回路', '会判断是否存在不接触回路', '能正确代入梅森公式'],
    [
      { label: '前向通路', question: '例题 3 中一共有几条前向通路？各自增益是什么？' },
      { label: '不接触回路', question: '为什么这个例题里没有不接触回路对？' },
    ],
    '当前步骤要帮学生做拓扑清点，而不是代他们逐项列式。请严格核对每条回路是否闭合、是否重复记数，以及是否和前向通路接触。',
  ),
  'step-15': context(
    'step-15',
    '后测：把结构图化简和梅森公式放到同一张试卷里',
    'quiz',
    ['综合检查本课目标是否达成', '比较学生对代数法与梅森法的掌握程度'],
    [
      { label: '综合题', question: '后测第 3、4 题分别在考什么能力？' },
      { label: '方法选择', question: '什么情况下代数法更直观，什么情况下梅森法更高效？' },
    ],
    '当前步骤不要直接给答案，要帮助学生定位自己的薄弱环节：是基本连接、等效变换、代数化简，还是梅森公式信息提取。',
  ),
  'step-16': context(
    'step-16',
    '梅森的全局观：先见森林，再见树木',
    'reflection',
    ['理解局部操作与全局视角的互补关系', '把工程方法与课程理念连接起来'],
    [
      { label: '全局观', question: '为什么说梅森公式体现了“先看结构，再算细节”？' },
      { label: '方法互补', question: '代数化简法和梅森公式各适合什么场景？' },
    ],
    '请把这一页处理成工程方法反思，而不是人物生平背诵。重点是“局部推进”和“全局结构”两种思维方式的互补性。',
  ),
  'step-17': context(
    'step-17',
    '总结与前瞻：从系统蓝图走向时域响应',
    'summary',
    ['用五个关键词总结本课', '把学习视角推进到 1-3 的时域响应分析'],
    [
      { label: '五个关键词', question: '这节课最关键的五个关键词分别是什么？' },
      { label: '下一课', question: '为什么学完结构图化简后，下一课自然会进入时域响应分析？' },
    ],
    '当前步骤用于收束与迁移。请把学生的注意力从“会化简”提升到“化简之后为什么能进一步预测系统动态行为”。',
  ),
};

export function getUnit12StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_1_2_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit12StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_1_2_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_1_2StepAIContext = getUnit12StepAIContext;
export const getUNIT_1_2StepQuickQuestions = getUnit12StepQuickQuestions;
