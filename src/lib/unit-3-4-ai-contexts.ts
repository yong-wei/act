import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_4_COURSE_META = {
  courseId: 'unit-3-4-root-locus-reading-validation-v1',
  courseTitle: '3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上',
  courseDescription:
    '围绕关键节点读图、参数窗口判断、根轨迹增益换算、对象化三域验证与广义根轨迹改写，把根轨迹法则压成可执行的工程判断动作。',
  keyConcepts: ['关键节点读图', '参数窗口判断', '根轨迹增益换算', '对象化三域验证', '广义根轨迹'],
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
    '课程定位：从 3-3 法则走向 3-4 判断',
    'theory',
    ['明确 3-4 只负责读图与验证', '知道 3-5 才进入结构改变'],
    [
      { label: '为什么是 3-4', question: '为什么 3-4 不再重讲法则证明，而是把法则压成读图动作？' },
      { label: '边界在哪里', question: '3-4 和 3-5 的边界在哪里，为什么现在还不进入结构改变？' },
    ],
    '当前页面只做课程定位，请围绕关键节点、窗口、三域与广义参数主线解释，不提前给版本结论。',
  ),
  'step-02': context(
    'step-02',
    '三张记录表与主判断链',
    'theory',
    ['记住三项固定产出', '明确稳定只是底线，不是结论'],
    [
      { label: '三张记录表', question: '为什么 3-4 需要关键节点、参数窗口和对象化验证三张记录表？' },
      { label: '判断链', question: '关键节点、窗口、三域和广义参数四段判断链分别负责什么？' },
    ],
    '只解释产出和主线，不代替后续互动页作答。',
  ),
  'step-03': context(
    'step-03',
    '固定对象与三个版本',
    'quiz',
    ['识别对象、记号与 A/B/C 三版本', '暴露稳定等于可用的误判'],
    [
      { label: '为什么先看对象', question: '为什么 A/B/C 的比较必须先固定对象与 k=0.01715K 的记号？' },
      { label: '误判在哪里', question: '为什么三个版本都还稳定时，仍然不能直接说它们一样可用？' },
    ],
    '只能帮助学生理解对象与误判背景，不直接给出版本排序。',
  ),
  'step-04': context(
    'step-04',
    '固定读图顺序',
    'practice',
    ['建立先骨架后节点再窗口最后后果的顺序', '避免直接跳到结论'],
    [
      { label: '为什么先骨架', question: '为什么读图时必须先看骨架，而不是直接扑向某个版本结论？' },
      { label: '顺序乱了会怎样', question: '如果把窗口判断放到关键节点之前，最常见的错误会是什么？' },
    ],
    '当前页面只帮助学生稳住顺序，不代做版本判断。',
  ),
  'step-05': context(
    'step-05',
    '关键节点证据板',
    'practice',
    ['把分离点、虚轴边界与参考工作点 B 绑定到工程问题', '知道每个节点回答什么问题'],
    [
      { label: '三个节点各管什么', question: '分离点、虚轴边界和参考工作点 B 分别在回答什么工程问题？' },
      { label: '为什么 B 重要', question: '为什么参考工作点 B 既要越过分离点，又要远离虚轴边界？' },
    ],
    '允许解释节点含义，但不能替学生自动标点。',
  ),
  'step-06': context(
    'step-06',
    '关键节点读图记录',
    'practice',
    ['把主图证据写成完整判断句', '同时保留位置与后果'],
    [
      { label: '完整判断句怎么写', question: '一句完整的关键节点工程判断，至少应包含哪些要素？' },
      { label: '为什么不能只写更靠左', question: '为什么只写“更靠左”或“更危险”还不算完整工程判断？' },
    ],
    '只帮助学生完善表达，不代写结论句。',
  ),
  'step-07': context(
    'step-07',
    '稳定窗口与可接受窗口',
    'practice',
    ['区分稳定窗口与可接受窗口', '保留代价语言'],
    [
      { label: '两层窗口', question: '稳定窗口和可接受窗口分别回答什么问题？' },
      { label: '为什么会错位', question: '为什么某个版本可能还稳定，但已经不值得继续推进？' },
    ],
    '只做窗口语言纠偏，不直接代贴标签。',
  ),
  'step-08': context(
    'step-08',
    '根轨迹增益换算',
    'practice',
    ['完成 k 到 K 的换算链', '先换算再下工程结论'],
    [
      { label: '为什么先换算', question: '为什么图上读到 k 后，必须先换算到 K 才能继续下工程判断？' },
      { label: '最容易漏哪一步', question: 'k 到 K 的换算链里，最容易被跳过但最关键的一步是什么？' },
    ],
    '只能解释公式、变量含义和换算步骤，不把换算结果直接当成最终结论。',
  ),
  'step-09': context(
    'step-09',
    '三域互证',
    'practice',
    ['明确主图、时域、频域各自回答什么', '理解为什么必须三域闭合'],
    [
      { label: '为什么必须三域互证', question: '为什么 3-4 不能只凭主图，必须让时域和频域一起闭合证据链？' },
      { label: '各域回答什么', question: '主图、时域和频域各自最擅长回答哪类问题？' },
    ],
    '只做三域角色说明和匹配检查，不代替后续验证作答。',
  ),
  'step-10': context(
    'step-10',
    '时域验证',
    'practice',
    ['说明 B 为什么像参考工作点', '同时保留近似可信与局限'],
    [
      { label: '为什么 B 像参考点', question: '为什么 B 在时域上更像参考工作点，而不是越保守越好或越激进越好？' },
      { label: '近似为什么还有限', question: '为什么主导极点近似能成立，但仍然不能把其他极点完全当不存在？' },
    ],
    '允许解释快慢、振荡和拖尾，但不直接代写验证记录。',
  ),
  'step-11': context(
    'step-11',
    '频域验证',
    'practice',
    ['写清低中频近似成立与高频差异', '把频率点表和 Bode 图读成一句判断'],
    [
      { label: '哪里成立哪里失效', question: '为什么 3-4 要把低中频近似成立和高频差异失效分开记录？' },
      { label: '频率点表怎么读', question: '代表性频率点表与 Bode 图应怎样一起支撑结论句？' },
    ],
    '只帮助学生检查频域证据闭合，不代替学生给最终排序。',
  ),
  'step-12': context(
    'step-12',
    '版本 C 的收益与代价',
    'practice',
    ['同时保留频域代价与航迹收益', '写出完整收益-代价句'],
    [
      { label: '为什么不能只看一边', question: '为什么版本 C 的判断不能只看频域或只看航迹，而必须双证据同页？' },
      { label: '收益代价句怎么写', question: '一个完整的收益-代价判断句，至少应把哪两类证据放在一起？' },
    ],
    '只帮助学生补全双证据表达，不代写比较结论。',
  ),
  'step-13': context(
    'step-13',
    '广义根轨迹入口',
    'quiz',
    ['识别 a 不是再调一次 K', '知道对象与问题一起改变'],
    [
      { label: '为什么不是再调一次 K', question: '为什么局部反馈系数 a 不能被理解成“再调一次 K”？' },
      { label: '哪里变了', question: '进入广义根轨迹时，究竟是哪个对象或特征方程发生了变化？' },
    ],
    '只能做误判纠偏，不直接替学生投票。',
  ),
  'step-14': context(
    'step-14',
    '广义根轨迹改写链',
    'practice',
    ['把局部反馈结构改写成等效根轨迹问题', '说清法则不变但对象先被改写'],
    [
      { label: '改写链怎么串', question: '从局部反馈结构走到等效根轨迹，关键的三四步改写链是什么？' },
      { label: '为什么法则不变', question: '为什么到了广义根轨迹，真正变化的是对象而不是根轨迹法则本身？' },
    ],
    '只解释改写链和变量意义，不代替学生完成推导记录。',
  ),
  'step-15': context(
    'step-15',
    '非增益参数窗口记录',
    'practice',
    ['比较 a 从 0 到 1 的主导极点迁移', '写出窗口建议与边界提醒'],
    [
      { label: '非增益参数怎么比较', question: '非增益参数 a 从 0 到 1 时，主导极点迁移最值得先比较哪三类信息？' },
      { label: '为什么不能说越大越好', question: '为什么 a 的窗口判断不能压成“a 越大越好”这种单点结论？' },
    ],
    'AI 只能帮助检查窗口表达是否完整，不能直接代写 a 的最终建议。',
  ),
  'step-16': context(
    'step-16',
    '后测：完整判断链回收',
    'quiz',
    ['检查是否形成关键节点、窗口、换算、三域与广义参数的完整链', '区分会答题与会判断'],
    [
      { label: '解释题至少要说什么', question: '如果要证明自己真的形成了完整判断链，答案里至少应该出现哪些关键词或证据块？' },
      { label: '最容易漏哪一段', question: '学生在 3-4 后测解释题里，最容易漏掉的是窗口、换算、三域还是广义参数，为什么？' },
    ],
    '当前页面只检查完整判断链，不代写后测答案。',
  ),
  'step-17': context(
    'step-17',
    '收束：沿既有结构分析的能力与边界',
    'summary',
    ['收束本课能力边界', '指向 3-5 的结构改变'],
    [
      { label: '本课到底带走什么', question: '离开 3-4 时，应该稳定带走哪几条判断能力？' },
      { label: '为什么下一课要改结构', question: '既然只沿既有结构分析很快会碰到边界，为什么下一课自然要转向结构改变？' },
    ],
    '只帮助学生总结本课与展望下一课，不引入新的设计细节。',
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
