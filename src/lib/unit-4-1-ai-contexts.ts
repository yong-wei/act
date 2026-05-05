import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_4_1_COURSE_META = {
  courseId: 'unit-4-1-design-task-expression-v1',
  courseTitle: '4-1：设计起点：性能指标体系、工程约束与可行域表达',
  courseDescription:
    '围绕双案例联读、指标角色重组、硬约束/软目标/观察指标分类与可行域分层，把已有分析证据重写成任务表达卡。',
  keyConcepts: ['任务表达卡', '指标角色重组', '硬约束', '软目标', '观察指标', '可行域分层'],
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
    courseId: UNIT_4_1_COURSE_META.courseId,
    courseTitle: UNIT_4_1_COURSE_META.courseTitle,
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

export const UNIT_4_1_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '任务表达入口：从跨域证据写出设计任务',
    'theory',
    ['读取封面情境图与课程信息图', '提出客船航向控制与稳定平台的导入问题'],
    [
      { label: '导入问题', question: '客船航向控制与稳定平台面对同一套证据时，目标、约束和优先级会怎样分化？' },
      { label: '证据入口', question: '把稳定性、动态性能和频域储备证据写成任务表达卡时，哪些信息最先进入卡片？' },
    ],
    '围绕封面情境图、课程信息图和导入问题解释任务表达的起点。',
  ),
  'step-02': context(
    'step-02',
    '本次课程目标',
    'theory',
    [
      '解释同一套跨域证据在不同工程场景中导出不同任务排序的原因',
      '区分时域、频域与积分误差指标分别回答的问题',
    ],
    [
      { label: '解释', question: '如何解释同一套跨域证据在不同工程场景中导出不同任务排序的原因？' },
      { label: '区分', question: '如何区分时域、频域与积分误差指标分别回答的问题？' },
    ],
    '只围绕本次课程目标进行解释。',
  ),
  'step-03': context(
    'step-03',
    '前测基本知识点',
    'quiz',
    ['判断控制系统稳定性', '说明时域、频域与积分误差指标含义'],
    [
      { label: '稳定性', question: '控制系统稳定性判断依赖哪些基本读图或计算事实？' },
      { label: '指标含义', question: '时域、频域与积分误差指标分别描述什么信息？' },
    ],
    '围绕稳定性判断、时域与频域指标含义、积分误差指标含义，以及指标角色与优先级的基础认识进行解释。',
  ),
  'step-04': context(
    'step-04',
    '主场景 A：客船航向控制先保什么',
    'practice',
    ['把对象框图与四联图读成任务排序', '识别“平顺与储备优先，再谈提速”'],
    [
      { label: '为什么先保平顺', question: '客船航向控制里，为什么任务排序先强调平顺与储备，而不是先追求速度？' },
      { label: '证据从哪来', question: '在客船案例里，哪些图上证据共同支撑了“边界优先”的判断？' },
    ],
    '只帮助学生归纳任务矛盾、边界和证据，不提供控制器名称或参数建议。',
  ),
  'step-05': context(
    'step-05',
    '对照案例 B：稳定平台的任务重排',
    'practice',
    ['区分速度前移与边界失效', '理解双根轨迹与特殊布局背后的任务语言'],
    [
      { label: '为什么速度前移', question: '稳定平台案例里，为什么速度与带宽会被排得更前？' },
      { label: '为什么边界不能放松', question: '为什么平台案例即使更强调速度，也不能把储备边界一笔带过？' },
    ],
    '只核对任务排序与证据来源，不把页面升级成整定课。',
  ),
  'step-06': context(
    'step-06',
    '双案例对照：语言相同，排序不同',
    'practice',
    ['压实双案例排序差异', '理解“证据语言相同，但优先级会重排”'],
    [
      { label: '为什么会重排', question: '同样是时域、根轨迹、幅频和相频证据，为什么客船与平台会读出不同排序？' },
      { label: '什么没有变', question: '双案例排序不同，但基础语言没有变，这句话具体指什么？' },
    ],
    '只帮助学生比较排序与证据关系，不直接输出统一方案。',
  ),
  'step-07': context(
    'step-07',
    '指标角色重组：时域、频域、积分误差各自回答什么',
    'practice',
    ['区分过程接受度、储备边界、累计代价三类问题', '把典型指标配回正确角色'],
    [
      { label: '三类问题', question: '时域、频域、积分误差三类指标分别最先回答什么问题？' },
      { label: '为什么不能混用', question: '为什么不能把积分误差直接当成硬约束，或把裕度直接当成速度指标？' },
    ],
    '允许解释三类指标的功能差异，不展开优化算法或整定建议。',
  ),
  'step-08': context(
    'step-08',
    '任务分类：硬约束、软目标、观察指标',
    'practice',
    ['把指标名称改写成任务角色', '识别“角色由任务决定，不由名词决定”'],
    [
      { label: '为什么要分类', question: '为什么同一个指标在不同场景里，可能属于硬约束、软目标或观察指标中的不同角色？' },
      { label: '怎么判断硬约束', question: '看到一个指标时，判断它是不是硬约束，最先该问什么？' },
    ],
    '只帮助学生判断角色，不从分类结果直接推出控制器方案。',
  ),
  'step-09': context(
    'step-09',
    '任务表达卡工作区：把后续设计输入写全',
    'practice',
    ['完整写出任务卡六字段', '补齐优先级与证据来源'],
    [
      { label: '任务卡缺什么', question: '一张任务表达卡如果没写优先级和证据来源，会导致后续 4-2/4-3 缺什么输入？' },
      { label: '怎么从证据回填', question: '面对案例图和规则卡时，怎样把“图上证据”准确改写到任务表达卡里？' },
    ],
    '只允许做字段完整性和证据对应检查，不替学生直接生成控制器方案。',
  ),
  'step-10': context(
    'step-10',
    '区域分层：可行域、满意域、最优域不是一步',
    'practice',
    ['区分能做、可接受和当前最优', '明确 4-1 先到可行与满意，不求最优'],
    [
      { label: '为什么要分层', question: '为什么“稳定”“可接受”“最优”必须拆成三层，而不能混成一句话？' },
      { label: '4-1 到哪里为止', question: '为什么 4-1 只能先写到可行域和满意域，不能直接宣称最优？' },
    ],
    '允许解释可行域和满意域的差别，不展开参数搜索或最优整定。',
  ),
  'step-11': context(
    'step-11',
    '误判检查：稳定不等于完成，可行不等于最优',
    'quiz',
    ['清理三类高频误判', '巩固单图不能直接定结论的边界'],
    [
      { label: '为什么单图不够', question: '为什么单看一张图，往往不足以直接写出完整结论？' },
      { label: '为什么要先清误判', question: '在进入 4-2 之前，为什么必须先清理“稳定就够了”和“可行就等于最优”这类误判？' },
    ],
    '只做误判纠偏，不把内容越界到结构选择或参数整定。',
  ),
  'step-12': context(
    'step-12',
    '后测与收束：先写任务，再谈方法',
    'quiz',
    ['检查任务表达与边界意识是否站稳', '把 4-1 平滑接到 4-2/4-3'],
    [
      { label: '4-1 最该带走什么', question: '4-1 结束时，最该带走的是哪三句判断？' },
      { label: '下一步去哪', question: '为什么 4-2 会接“按任务筛结构”，而 4-3 会接“按任务卡写初始方案方向”？' },
    ],
    '当前页面只做总结和去向说明，不提前给出结构选型结论。',
  ),
};

export function getUnit41StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_4_1_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit41StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_4_1_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_4_1StepAIContext = getUnit41StepAIContext;
export const getUNIT_4_1StepQuickQuestions = getUnit41StepQuickQuestions;
