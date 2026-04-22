import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_4_4_COURSE_META = {
  courseId: 'unit-4-4-fixed-structure-optimization-modeling-v1',
  courseTitle: '4-4：多目标权衡与控制器优化设计',
  courseDescription:
    '围绕固定结构下的多目标拉扯、自由目标表达、无约束候选族与 Pareto 最小取舍，把 4-3 的首轮证据推进成 4-5 可复核的候选族。',
  keyConcepts: ['多目标拉扯', '自由目标', '归一化基准', '无约束候选族', 'Pareto 前沿', '任务语言改写'],
} as const;

const STEP_CONFIG = {
  'step-01': { title: '客船航向保持对象与多目标拉扯：为什么经典试凑会停住', pageType: 'theory', purpose: '先交代对象与拉扯，再固定本课只产出无约束候选族。' },
  'step-02': { title: '四组经典试凑结果：多目标拉扯先被证据看见', pageType: 'theory', purpose: '先用首轮证据固定多目标拉扯，再进入前测与自由目标设计。' },
  'step-03': { title: '前测：先判断哪些边界还没有被正式写进模型', pageType: 'quiz', purpose: '在主体内容前先固定三条容易误判的边界。' },
  'step-04': { title: '参数化入口：起点、参数向量与参数范围从哪里来', pageType: 'practice', purpose: '固定参数化入口与参数范围的职责边界。' },
  'step-05': { title: '自由目标与归一化：怎样把偏好写成同一套比较语言', pageType: 'practice', purpose: '固定自由目标与归一化来源，不在本页引入罚项。' },
  'step-06': { title: '数值优化到底在这门课里做什么', pageType: 'theory', purpose: '解释本课数值优化的真实职责，而不是罗列算法名词。' },
  'step-07': { title: '梯度下降最小例子：搜索为什么会沿代价面下滑', pageType: 'practice', purpose: '给出梯度下降的最小直观印象，不把它误写成主案例求解过程。' },
  'step-08': { title: '主案例总表：起始方案与三组无约束权重方案如何分化', pageType: 'quiz', purpose: '固定三组权重、三类控制器与时域总表，不再退回单一旧候选。' },
  'step-09': { title: '时域与频域对比：三组候选到底换来了什么', pageType: 'practice', purpose: '把三组候选放回时域与频域证据重新阅读。' },
  'step-10': { title: 'Pareto front：为什么会出现一族同样值得保留的设计', pageType: 'quiz', purpose: '固定 Pareto front 的可视化意义，而不是退回最小例题。' },
  'step-11': { title: '三个典型前沿点：它们为什么在 Pareto 意义下同样好', pageType: 'quiz', purpose: '用参数表、响应图和工程意义卡固定典型前沿点的判断价值。' },
  'step-12': { title: '横摇边界案例：目标语言一变，数值响应也必须跟着变', pageType: 'workspace', purpose: '把横摇边界案例从目标语言改写推进到数值响应验证。' },
  'step-13': { title: '后测：判断链是否已经形成', pageType: 'quiz', purpose: '用后测固定本课核心判断链。' },
  'step-14': { title: '总结与移交：把候选族交给 4-5 做工程复核', pageType: 'summary', purpose: '完成总结与移交，不在本页提前展开罚函数细节。' },
} as const;

function context(stepId: string): AIContextConfig {
  const config = STEP_CONFIG[stepId as keyof typeof STEP_CONFIG];
  return {
    enabled: true,
    courseId: UNIT_4_4_COURSE_META.courseId,
    courseTitle: UNIT_4_4_COURSE_META.courseTitle,
    pageType: config.pageType,
    stepId,
    topic: config.title,
    learningObjectives: [config.purpose, '回答时只回接本页证据，不替学生直接生成整页作答。'],
    knowledgeType: 'D',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      { label: '本页目标', question: `本页“${config.title}”在 4-4 的候选族建模链中承担什么作用？` },
      { label: '常见误判', question: '学生在本页最容易把哪一类证据误读成最终可用解？' },
    ],
    systemPromptExtension: `${config.purpose} 回答时只使用本页证据，不替学生直接生成完整作答。`,
  };
}

export const UNIT_4_4_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  Object.keys(STEP_CONFIG).map((stepId) => [stepId, context(stepId)]),
);

export function getUnit44StepAIContextLocal(stepId: string) {
  return UNIT_4_4_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit44StepQuickQuestionsLocal(stepId: string) {
  return UNIT_4_4_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export function getUnit44StepAIContext(stepId: string) {
  return getUnit44StepAIContextLocal(stepId);
}

export function getUnit44StepQuickQuestions(stepId: string) {
  return getUnit44StepQuickQuestionsLocal(stepId);
}
