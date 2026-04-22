import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_4_5_COURSE_META = {
  courseId: 'unit-4-5-constraint-aware-parameter-optimization-v1',
  courseTitle: '4-5：约束下的优化设计实践：参数约束翻译与带约束参数优化',
  courseDescription:
    '围绕无约束候选越界、课程目标、硬约束翻译、罚函数、求解链、权重重排、结构差异、后测与总结信息图，把 4-4 的候选族推进成固定结构下可交付的可接受解。',
  keyConcepts: ['硬约束', '参数范围', '罚函数', '可行域迁移', '权重重排', '结构边界'],
} as const;

const STEP_CONFIG = {
  'step-01': { title: '无约束候选越界：时间指标更好，为什么仍不可交付', pageType: 'theory', purpose: '固定“更优不等于可交付”的入口。', questions: ['这一页最核心的断裂是什么？', '哪条证据最直接说明无约束候选不能交付？'] },
  'step-02': { title: '本次课程目标：完成这轮实践后应能做到什么', pageType: 'theory', purpose: '独立呈现本课课程目标。', questions: ['本课要完成哪五项能力？', '为什么这一页只写本课目标？'] },
  'step-03': { title: '自由目标收益与工程复核：更优为什么还不等于可用', pageType: 'theory', purpose: '把收益与工程复核重新对齐。', questions: ['左表和右表分别在说明什么？', '为什么收益不能自动等于可用？'] },
  'step-04': { title: '三条硬约束第一次被显性提出', pageType: 'practice', purpose: '把三条硬边界升格为交付裁决语言。', questions: ['哪条边界最直接挡住控制量爆表？', '为什么相角裕度未崩塌仍不足以放行？'] },
  'step-05': { title: '参数范围与硬约束分别在回答什么', pageType: 'practice', purpose: '区分参数范围与输出侧硬约束的职责。', questions: ['参数范围在回答什么问题？', '输出侧硬约束又在回答什么问题？'] },
  'step-06': { title: '罚函数把边界写进模型', pageType: 'theory', purpose: '固定“偏好没变，规则变了”。', questions: ['罚函数改变的是偏好还是规则？', '什么时候 P(theta) 会从 0 变大？'] },
  'step-07': { title: '求解输入与六步求解链：求解器究竟在消费什么', pageType: 'theory', purpose: '说明求解器只是在消费问题定义。', questions: ['为什么本页重点不是 API？', '六步求解链具体是哪六步？'] },
  'step-08': { title: '同一权重下，为什么会分出两组最优', pageType: 'theory', purpose: '解释同权重下的可行域迁移。', questions: ['同一权重下为什么会出现两组参数？', '变化为什么发生在可行域而不是偏好？'] },
  'step-09': { title: '权重影响：可行域不变时，收益会怎样被重新分配', pageType: 'theory', purpose: '解释讲义 6.4 的权重重排。', questions: ['三组权重分别偏向什么？', '为什么控制能量降低时调节时间会上升？'] },
  'step-10': { title: '同一主案例下：优化 PID 和优化超前结构为什么会分化', pageType: 'theory', purpose: '说明结构改变会把最优区间带向不同位置。', questions: ['为什么这里不能只比较谁赢了？', '参数优化和结构选择分别回答什么问题？'] },
  'step-11': { title: '三方案闭环比较：当前结果为何可接受但不是终局', pageType: 'theory', purpose: '回收可接受标准、余量告警与去向。', questions: ['为什么当前结果只能算可接受？', '为什么它还不能被当成终局？'] },
  'step-12': { title: '后测：边界、求解与解释是否已经成链', pageType: 'quiz', purpose: '用三题后测检查判断链。', questions: ['本课最容易混淆的三类判断分别是什么？', '当前结果为什么仍需继续被审视？'] },
  'step-13': { title: '总结：把越界证据、约束翻译与结构边界连成一条链', pageType: 'summary', purpose: '用总结页与信息图收束本课。', questions: ['这一课最终带走哪五条结论？', '4-6 会从哪里接走问题？'] },
} as const;

function buildContext(stepId: string): AIContextConfig {
  const config = STEP_CONFIG[stepId as keyof typeof STEP_CONFIG];
  return {
    enabled: true,
    courseId: UNIT_4_5_COURSE_META.courseId,
    courseTitle: UNIT_4_5_COURSE_META.courseTitle,
    pageType: config.pageType,
    stepId,
    topic: config.title,
    learningObjectives: [config.purpose, '回答时只回接本页证据，不替学生直接生成整页作答。'],
    knowledgeType: 'D',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      { label: '本页目标', question: config.questions[0] },
      { label: '常见误判', question: config.questions[1] },
    ],
    systemPromptExtension: `${config.purpose} 回答时只使用本页证据，不替学生直接生成完整作答。`,
  };
}

export const UNIT_4_5_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  Object.keys(STEP_CONFIG).map((stepId) => [stepId, buildContext(stepId)]),
);

export function getUnit45StepAIContextLocal(stepId: string) {
  return UNIT_4_5_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit45StepQuickQuestionsLocal(stepId: string) {
  return UNIT_4_5_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export function getUnit45StepAIContext(stepId: string) {
  return getUnit45StepAIContextLocal(stepId);
}

export function getUnit45StepQuickQuestions(stepId: string) {
  return getUnit45StepQuickQuestionsLocal(stepId);
}
