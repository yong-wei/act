import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_2_COURSE_META = {
  courseId: 'unit-3-2-routh-stability-boundary-v1',
  courseTitle: '3-2：劳斯判据——从高阶系统稳定判定到参数可行域',
  courseDescription:
    '围绕普通劳斯判稳、参数区间、两类特殊情况、三域翻译与变量平移，把高阶系统的稳定底线推进到参数可行域语言。',
  keyConcepts: ['劳斯判据', '第一列符号变化', '稳定可行域', '辅助方程', '变量平移', '参数约束'],
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
    courseId: UNIT_3_2_COURSE_META.courseId,
    courseTitle: UNIT_3_2_COURSE_META.courseTitle,
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

export const UNIT_3_2_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '模块 3 路径定位：从纯极点语言推进到稳定边界',
    'theory',
    ['理解 3-2 在模块 3 中的角色', '明确本课出口是边界语言而不是根轨迹法则'],
    [
      { label: '为什么是 3-2', question: '为什么站稳 3-1 之后，下一步自然是稳定边界和参数可行域语言？' },
      { label: '本课边界', question: '3-2 哪些内容必须讲，哪些内容故意留给 3-3 和 4-1？' },
    ],
    '当前页面只做课程路径定位。请围绕稳定边界、参数可行域和前后单元关系解释，不要提前展开劳斯表递推或根轨迹法则。',
  ),
  'step-02': context(
    'step-02',
    '图像直觉为什么不能替代代数规则',
    'quiz',
    ['暴露“只看图就够了”的起点误判', '建立图像与代数双证据分工'],
    [
      { label: '为什么还不够', question: '为什么只看极点迁移图还不足以直接写出参数可行域？' },
      { label: '还缺什么', question: '由特征方程系数直接判稳，究竟补上了哪一层证据？' },
    ],
    '只允许解释“图像直觉需要系数规则支撑”，不要直接泄露劳斯表区间结果。',
  ),
  'step-03': context(
    'step-03',
    '前测：先分清劳斯判稳、特殊情况与区域约束',
    'quiz',
    ['暴露三类起点误区', '把劳斯判稳、两类特殊情况和区域约束区分开'],
    [
      { label: '不是求根法', question: '为什么说劳斯判据首先回答的是“有没有右半平面根”，而不是“把全部根算出来”？' },
      { label: '为什么先辨识', question: '为什么首位为 0 与全零行必须先分辨清楚，不能混作一种异常？' },
    ],
    '这一页只能做错因归类与术语纠偏，不代替学生完成题目。',
  ),
  'step-04': context(
    'step-04',
    '普通劳斯表：第一列如何直接回答稳定性',
    'practice',
    ['理解第一列符号变化次数对应右半平面根数', '建立“判稳不等于求根”的意识'],
    [
      { label: '第一列回答什么', question: '为什么只看第一列符号变化，就已经能回答右半平面根数问题？' },
      { label: '为什么还没求根', question: '这一页已经能判稳，但为什么仍没有显式根表达式？' },
    ],
    '请只围绕第一列、符号变化和右半平面根数解释，不要把短答自动改写成标准答案。',
  ),
  'step-05': context(
    'step-05',
    '带参数劳斯表与条件链完整性',
    'workspace',
    ['把普通判稳推进到参数区间表达', '识别区间推导中最容易漏掉的条件'],
    [
      { label: '条件链', question: '从第一列条件链推稳定区间时，最容易漏掉哪一项，为什么？' },
      { label: '区间为什么会变宽', question: '如果漏掉 s^0 行条件，为什么推出来的区间通常会假性变宽？' },
    ],
    '请帮助学生检查条件链完整性，不要把流程压成黑箱按钮或直接给出最终区间。',
  ),
  'step-06': context(
    'step-06',
    '边界参数与根结构如何回到复平面',
    'practice',
    ['把边界参数翻译成根结构', '区分原点根边界与纯虚根边界'],
    [
      { label: '两类边界', question: '为什么 k=-2、k=18 与 k=22 对应的根结构不能只记成一组边界数字？' },
      { label: '如何读图', question: '把代数边界回到极点迁移图时，应该优先看哪些对应关系？' },
    ],
    '允许解释边界参数、原点根和纯虚根，不进入完整根轨迹法则。',
  ),
  'step-07': context(
    'step-07',
    '首位为 0：epsilon 连续化只服务于符号判断',
    'practice',
    ['建立“先辨识再处理”的顺序', '理解 epsilon 只服务于符号判断'],
    [
      { label: '为什么用 epsilon', question: '为什么首位为 0 的处理需要 epsilon 连续化，而不是直接把 epsilon 当成真实参数？' },
      { label: '变号意味着什么', question: '在这一类异常里，符号变化次数为什么比“把根算出来”更先回答问题？' },
    ],
    '只解释首位为 0 的判断入口与 epsilon 的角色，不把它扩展成全零行处理。',
  ),
  'step-08': context(
    'step-08',
    '全零行：辅助方程与导数替换',
    'practice',
    ['理解全零行为什么暴露对称根结构', '把辅助方程与导数替换绑定起来'],
    [
      { label: '为什么有辅助方程', question: '全零行为什么会暴露边界根结构，从而需要引入辅助方程？' },
      { label: '导数替换', question: '为什么辅助方程求导后可以回填劳斯表而不是任意换一行？' },
    ],
    '允许解释辅助方程和导数替换，不把本页变成完整递推刷题器。',
  ),
  'step-09': context(
    'step-09',
    '劳斯现象到时域：把极点结构翻译成响应形态',
    'practice',
    ['把稳定状态、时域曲线和极点结构串起来', '理解边界不是“更慢一点”'],
    [
      { label: '临界不是更慢', question: '为什么临界状态不能简单理解成“比稳定更慢一点”？' },
      { label: '三域链条', question: '怎样把“收敛 / 等幅 / 发散”翻译到极点半平面位置上？' },
    ],
    '只做极点到时域的翻译，不进入根轨迹法则。',
  ),
  'step-10': context(
    'step-10',
    '劳斯现象到频域：为什么边界附近会先出现峰值抬高',
    'practice',
    ['补上频域辅助观察线索', '守住“本课不升级成 Nyquist 判稳”边界'],
    [
      { label: '为什么峰值先抬高', question: '当系统接近稳定边界时，为什么相关频段更容易出现峰值抬高或理想共振？' },
      { label: '为什么不是判据', question: '为什么这里的频域现象只能做辅助观察，而不能直接替代判稳规则？' },
    ],
    '允许讲峰值抬高、理想共振和低频抬升，不允许讲 Nyquist 判稳、裕度计算或完整频域指标体系。',
  ),
  'step-11': context(
    'step-11',
    '变量平移与区域约束',
    'workspace',
    ['把普通判稳推进到区域约束', '理解更强约束会收缩可行域'],
    [
      { label: '为什么要平移', question: '为什么把竖线约束写成变量平移后，问题又能回到普通劳斯判稳？' },
      { label: '为什么区间更窄', question: '为什么加入 Re(s)<-0.5 这样的更强约束后，可行区间会收缩？' },
    ],
    '请只围绕变量平移、区域约束和可行域收缩解释，不进入控制器结构选型。',
  ),
  'step-12': context(
    'step-12',
    '后测：判稳、特殊情况与区域约束能否连成一条链',
    'quiz',
    ['检查学生是否真正建立边界语言', '区分“会算”和“会解释”'],
    [
      { label: '边界语言', question: '如果学生会算表却解释不出边界含义，说明还差哪一步理解？' },
      { label: '解释题如何看', question: '这道解释题最关键的不是字数，而是哪些关键词和因果链？' },
    ],
    '允许检查关键词和错因，不要直接代写解释题完整答案。',
  ),
  'step-13': context(
    'step-13',
    '收束与去向：从稳定判定走向参数设计入口',
    'summary',
    ['用结论表和信息图收束本课', '把视角推进到 3-3 与 4-1'],
    [
      { label: '五条结论', question: '3-2 最值得带走的五条结论分别是什么？' },
      { label: '接下来去哪', question: '为什么 3-3 会继续解释极点迁移机制，而 4-1 会把这套语言推进到设计约束？' },
    ],
    '请帮助学生回顾和建立去向，不新增未讲过的设计细节。',
  ),
};

export function getUnit32StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_2_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit32StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_2_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_2StepAIContext = getUnit32StepAIContext;
export const getUNIT_3_2StepQuickQuestions = getUnit32StepQuickQuestions;
