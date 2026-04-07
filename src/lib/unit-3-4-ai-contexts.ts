import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_4_COURSE_META = {
  courseId: 'unit-3-4-root-locus-reading-validation-v1',
  courseTitle: '3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上',
  courseDescription:
    '围绕关键节点读图、参数窗口判断、根轨迹增益换算与对象化三域验证，把根轨迹法则压成可执行的工程判断动作。',
  keyConcepts: ['关键节点读图', '参数窗口判断', '根轨迹增益换算', '对象化三域验证', '稳定窗口', '可接受窗口'],
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
    courseId: UNIT_3_4_COURSE_META.courseId,
    courseTitle: UNIT_3_4_COURSE_META.courseTitle,
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

export const UNIT_3_4_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：从根轨迹法则走向读图判断',
    'theory',
    ['明确 3-4 是 3-3 的应用压实课', '理解本课不再重讲法则证明'],
    [
      { label: '为什么是 3-4', question: '为什么 3-4 的任务不是重讲根轨迹法则，而是把法则压成读图动作？' },
      { label: '边界是什么', question: '3-4 和 3-5 的边界在哪里，为什么现在还不进入结构改变？' },
    ],
    '当前页面只做课程定位，请围绕“关键节点、参数窗口、三域验证”解释，不提前给版本排序。',
  ),
  'step-02': context(
    'step-02',
    '打破稳定即够好的误判',
    'quiz',
    ['区分稳定与可接受', '建立窗口和代价语言'],
    [
      { label: '为什么不够', question: '为什么系统还稳定，不代表它已经是可接受的工程工作点？' },
      { label: '还要看什么', question: '除了稳定性之外，为什么还必须继续看窗口、换算和三域后果？' },
    ],
    '只能帮助学生理解“稳定不等于够好”，不能直接给 A/B/C 的最终排序。',
  ),
  'step-03': context(
    'step-03',
    '三项固定产出与本课边界',
    'theory',
    ['压实三项固定产出', '守住不进入零点和设计整定的边界'],
    [
      { label: '三项产出', question: '本课三项固定产出分别服务于哪一段判断链？' },
      { label: '为什么不越界', question: '为什么 3-4 只停在“判断与验证”，而不继续滑进结构改变？' },
    ],
    '只解释目标、产出和边界，不提前替代后续工作区作答。',
  ),
  'step-04': context(
    'step-04',
    '前测：暴露单域判断和 k=K 的起点误区',
    'quiz',
    ['暴露只看一域的误判', '区分图上增益与控制器增益'],
    [
      { label: '单域为什么危险', question: '为什么只看时域或只看频域，都容易把 3-4 的版本判断做偏？' },
      { label: 'k 和 K', question: '为什么把图上根轨迹增益 k 直接当成控制器增益 K，会让后续结论跑偏？' },
    ],
    '只能做错因归类和术语纠偏，不替代学生完成前测。',
  ),
  'step-05': context(
    'step-05',
    '固定读图顺序',
    'practice',
    ['建立先骨架后节点再窗口的顺序', '避免上来就直接谈后果'],
    [
      { label: '为什么先骨架', question: '为什么读图时必须先看骨架，而不是直接扑向关键节点或时域后果？' },
      { label: '顺序错会怎样', question: '如果把“窗口判断”提前到“关键节点读图”之前，最常见的误判会是什么？' },
    ],
    '当前页面只帮助学生稳住读图顺序，不直接给 A/B/C 的优劣结论。',
  ),
  'step-06': context(
    'step-06',
    'A/B/C 首轮预测',
    'practice',
    ['先写第一眼预测', '为后续修正建立记录起点'],
    [
      { label: '先猜什么', question: '面对 A/B/C 三版本，第一眼最值得先猜的三件事是什么？' },
      { label: '为什么要先记下', question: '为什么 3-4 要先把首轮预测写下来，再允许你用后续证据修正？' },
    ],
    '当前页面只能帮助学生形成首轮预测，不给最终排序。',
  ),
  'step-07': context(
    'step-07',
    '关键节点读图',
    'practice',
    ['把四类关键节点与后续判断绑定', '理解节点为何决定窗口与后果'],
    [
      { label: '节点最关键的作用', question: '为什么分离点、虚轴交点、主导极点候选和窗口边界，会直接决定后续判断？' },
      { label: '哪个最重要', question: '如果只能先盯一个节点，哪一类最可能最先改写后续判断，为什么？' },
    ],
    '允许解释节点定义与作用，但不能替学生自动代标。',
  ),
  'step-08': context(
    'step-08',
    '稳定窗口与可接受窗口',
    'practice',
    ['建立双窗口语言', '理解稳定与可接受并非同一层判断'],
    [
      { label: '两层窗口', question: '稳定窗口和可接受窗口分别在回答什么问题？' },
      { label: '为什么会错位', question: '为什么某个版本可能仍在稳定窗口内，却已经不值得继续推进？' },
    ],
    '只帮助学生理解窗口语言，不直接代替学生贴标签。',
  ),
  'step-09': context(
    'step-09',
    '根轨迹增益换算',
    'practice',
    ['把图上参数翻译回工程参数', '保留完整换算链'],
    [
      { label: '为什么先换算', question: '为什么图上读到的是根轨迹增益时，必须先完成换算，才能进入工程参数语言？' },
      { label: '不能偷什么步', question: '在 k 到 K 的换算链里，最容易被偷掉但又最关键的一步是什么？' },
    ],
    '当前页面只允许解释公式、变量含义和换算链，不把换算结果直接当最终工程判断。',
  ),
  'step-10': context(
    'step-10',
    'AI 只检查换算链',
    'reflection',
    ['让 AI 做链条校对器', '明确 AI 不能替代版本判断'],
    [
      { label: '检查什么', question: '如果把自己的换算链发给 AI，最应该让它检查哪些环节是否完整？' },
      { label: '为什么不该代做', question: '为什么这一步的 AI 不能直接替你给出 A/B/C 的工程结论，而只能检查换算链？' },
    ],
    'AI 只能检查换算链、变量含义和漏步，不能直接给版本排序或最终工程结论。',
  ),
  'step-11': context(
    'step-11',
    '时域回查',
    'practice',
    ['用时域证据回查主图判断', '区分慢、平衡和开始冒险'],
    [
      { label: '时域先回答什么', question: '在 3-4 的时域回查里，第一优先是回答“谁更快”，还是“谁开始冒险”，为什么？' },
      { label: 'B 为什么像参考点', question: '为什么 B 往往更像参考工作点，而不是越保守越好或越激进越好？' },
    ],
    '允许解释快慢、振荡和拖尾，但不能替学生直接写验证记录。',
  ),
  'step-12': context(
    'step-12',
    '频域回查与最终结论',
    'practice',
    ['用频域补上风险暴露证据', '把三域证据闭合成最终判断'],
    [
      { label: '风险为什么先暴露', question: '为什么某些风险会先在频域里暴露，而不是等到时域已经明显失真才看见？' },
      { label: '最终至少要几域', question: '为什么 3-4 的最终结论至少要同时带上主图之外的一到两域证据？' },
    ],
    'AI 不能代替学生给最终结论，只能帮助核对三域证据是否闭合。',
  ),
  'step-13': context(
    'step-13',
    '后测：完整判断链是否真正建立',
    'quiz',
    ['检查是否形成完整工程判断链', '区分“会答题”与“会判断”'],
    [
      { label: '至少要说什么', question: '如果要证明自己真的形成了完整判断链，答案里至少应该出现哪些关键词或证据块？' },
      { label: '最容易缺什么', question: '学生在 3-4 的解释题里，最容易漏掉的是窗口、换算，还是三域闭合，为什么？' },
    ],
    '当前页面只检查学生是否掌握完整判断链，不代写解释题答案。',
  ),
  'step-14': context(
    'step-14',
    '收束：只调增益很快会到边界',
    'summary',
    ['把本课收束到“只调增益”的边界意识', '为 3-5 的结构改变做铺垫'],
    [
      { label: '为什么会很快到边界', question: '为什么当你只调增益时，系统往往很快就会碰到稳定或可接受边界？' },
      { label: '下一课为什么换结构', question: '既然只调增益很快到边界，为什么下一课自然要转向零点与结构改变？' },
    ],
    '请只帮助学生收束本课与展望下一课，不增加新的设计与整定细节。',
  ),
};

export function getUnit34StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_4_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit34StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_4_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_4StepAIContext = getUnit34StepAIContext;
export const getUNIT_3_4StepQuickQuestions = getUnit34StepQuickQuestions;
