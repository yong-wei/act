import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_9_COURSE_META = {
  courseId: 'unit-3-9-cross-domain-mapping-lab-v1',
  courseTitle: '3-9：稳定—动态—稳态综合映射实验',
  courseDescription:
    '围绕同一航向控制对象，把基准、零点线补强、积分家族与滞后对照收束为一张稳定—动态—稳态综合映射表，并把模块 3 的出口判断接到 4-1。',
  keyConcepts: ['统一对象', '任务标签', '零点线补强', '积分家族', '滞后对照', '综合映射表'],
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
    courseId: UNIT_3_9_COURSE_META.courseId,
    courseTitle: UNIT_3_9_COURSE_META.courseTitle,
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

export const UNIT_3_9_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '统一对象与比较顺序',
    'theory',
    ['固定统一对象与比较链', '明确 3-9 只做首轮任务判断，不给完整设计方案'],
    [
      { label: '为什么先固定对象', question: '为什么模块 3 的出口课必须先固定同一个对象，再比较不同机制线？' },
      { label: '3-9 到 4-1 的关系', question: '为什么 3-9 只做首轮任务判断，而把完整任务表达留到 4-1？' },
    ],
    '只解释统一对象、比较顺序与课程边界，不提前给版本排名或完整设计答案。',
  ),
  'step-02': context(
    'step-02',
    '前测：任务标签先于控制器名称',
    'quiz',
    ['识别先报控制器名称的误区', '把任务标签放在机制标签之前'],
    [
      { label: '为什么先贴标签', question: '为什么在模块 3 出口课里，要先写“更快/更准/综合折中”这类任务标签，再谈机制线？' },
      { label: '常见错因', question: '如果一上来就说 PI、滞后或零点线，会遗漏哪一层判断？' },
    ],
    '当前页面只做错因纠偏和任务标签定位，不代替学生完成作答。',
  ),
  'step-03': context(
    'step-03',
    '基准版本：综合折中锚点',
    'practice',
    ['先把基准版本判成统一锚点', '按根轨迹/时域/频域顺序写首个风险点'],
    [
      { label: '为什么先看基准', question: '为什么所有补强版本都必须先回到基准版本这个统一锚点？' },
      { label: '首个风险点', question: '面对基准版本时，第一风险点应该优先从哪个域开始写，为什么？' },
    ],
    '允许解释基准图、指标表与综合折中标签，不允许跳过基准直接比较补强版本。',
  ),
  'step-04': context(
    'step-04',
    '零点线补强：更偏动态改善',
    'practice',
    ['压实零点线更偏动态改善', '同时保留收益域和代价域判断'],
    [
      { label: '为什么更偏动态', question: '零点线补强为什么更像“更快一些”的样例，而不是同时解决更准问题？' },
      { label: '为什么要写代价域', question: '如果只写零点线带来的动态收益，不写代价域，会漏掉什么判断？' },
    ],
    '只解释中频整理、时域变化和代价域，不把零点线说成最优方案。',
  ),
  'step-05': context(
    'step-05',
    '积分家族：低频收益与中频代价一起看',
    'practice',
    ['比较弱积分、强积分与积分校正', '看见低频收益越强，越要单独回看中频代价'],
    [
      { label: '为什么积分要看两面', question: '为什么积分路线既要看低频收益，也要单独回看中频和动态代价？' },
      { label: '积分校正说明什么', question: '积分校正为什么能说明“积分路线也需要中频整理”这件事？' },
    ],
    '允许解释型别改善、相位余量和长尾，不允许把积分路线说成唯一稳态改善方案。',
  ),
  'step-06': context(
    'step-06',
    '滞后对照：稳态改善不只一条路',
    'practice',
    ['区分压小误差和压到零', '比较积分与滞后的结构分工'],
    [
      { label: '为什么不是弱积分', question: '为什么滞后不能直接等同于“更弱一点的积分”？' },
      { label: '压小 vs 压到零', question: '为什么“误差压小”和“误差结构性压到零”必须分开判断？' },
    ],
    '只解释型别、低频收益、中频代价和动态影响，不展开完整联合校正设计。',
  ),
  'step-07': context(
    'step-07',
    '综合映射表：统一输出格式',
    'practice',
    ['把分散观察压成统一表格', '每个版本都写最先暴露收益和代价的域'],
    [
      { label: '为什么要统一表头', question: '为什么模块 3 出口必须把不同路线都写回同一套结构变化/三域读回/任务标签表头？' },
      { label: '风险栏的作用', question: '如果综合映射表只写收益不写风险，会让后续 4-1 的任务表达丢掉什么信息？' },
    ],
    'AI 只能帮助检查表头逻辑和字段完整性，不能代填整张综合映射表。',
  ),
  'step-08': context(
    'step-08',
    '模块 4 入口：先问对问题',
    'quiz',
    ['把模块 3 的出口定位为首轮任务判断', '明确 4-1 才进入指标、约束与可行域'],
    [
      { label: '为什么只做首轮判断', question: '为什么 3-9 的终点是“先问对问题”，而不是直接给完整选型和整定？' },
      { label: '4-1 接什么', question: '把“更快/更准/兼顾稳与快”带到 4-1 后，下一步会被改写成什么样的任务表达？' },
    ],
    '只做入口判断、边界和模块去向总结，不越级给完整设计方案。',
  ),
};

export function getUnit39StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_9_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit39StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_9_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_9StepAIContext = getUnit39StepAIContext;
export const getUNIT_3_9StepQuickQuestions = getUnit39StepQuickQuestions;
