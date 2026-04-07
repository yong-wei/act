import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_1_COURSE_META = {
  courseId: 'unit-3-1-pure-pole-stability-and-dynamics-v1',
  courseTitle: '3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解',
  courseDescription:
    '围绕稳定底线、极点到模态、主导极点近似、Bode 证据与卷积收束，建立模块 3 的第一堂结构机理精品互动课。',
  keyConcepts: ['闭环特征方程', '闭环极点', '模态', '主导极点', '附加极点', 'Bode 对照', '卷积', '模态叠加'],
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
    courseId: UNIT_3_1_COURSE_META.courseId,
    courseTitle: UNIT_3_1_COURSE_META.courseTitle,
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

export const UNIT_3_1_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '模块 3 入口定位：从对象语言走向机理语言',
    'theory',
    ['理解 3-1 为什么是模块 3 的第一课', '明确本课只讲纯极点语言，不提前进入劳斯和根轨迹'],
    [
      { label: '为什么转层', question: '为什么模块 3 一开始不再只停留在对象语言，而要转向机理语言？' },
      { label: '本课边界', question: '3-1 会讲哪些机理，又故意不讲哪些后续方法？' },
    ],
    '当前步骤只做路径定位。请把“模块2建对象，模块3讲为什么会这样变”说清楚，不要提前展开公式细节。',
  ),
  'step-02': context(
    'step-02',
    '同主导极点为何仍会出现不同响应',
    'quiz',
    ['理解主导极点重要但不是唯一证据', '建立附加模态退场快慢会改写主要动态的直觉'],
    [
      { label: '主导极点', question: '为什么说主导极点重要，但不能单独包办对全部动态的解释？' },
      { label: '附加模态', question: '附加模态退场快慢会怎样改变我们对近似是否可靠的判断？' },
    ],
    '当前步骤只压实冲突，不提前给完整准则。请帮助学生把视线从“极点一样”推进到“附加模态也要看”。',
  ),
  'step-03': context(
    'step-03',
    '本课学习目标与边界',
    'theory',
    ['明确本课三项目标', '明确劳斯、根轨迹、频域判稳不在本课展开'],
    [
      { label: '三目标', question: '这节课真正要形成的三项能力各是什么？' },
      { label: '为什么不越界', question: '为什么 3-1 要先站稳纯极点语言，而不是把后续方法一起塞进来？' },
    ],
    '请帮助学生建立任务边界，不替代后续页面提前解释。',
  ),
  'step-04': context(
    'step-04',
    '前测：稳定、主导极点与近似直觉',
    'quiz',
    ['暴露起点混淆', '让学生意识到稳定、主导极点和可忽略不是一回事'],
    [
      { label: '稳定不等于够好', question: '为什么系统稳定，不代表它已经可以被放心近似或放心使用？' },
      { label: '更靠左不是万能句', question: '为什么“更靠左”只能算经验起点，而不是完整结论？' },
    ],
    '当前步骤只能做错因归类与术语纠偏，不直接代替学生作答。',
  ),
  'step-05': context(
    'step-05',
    '稳定底线：先判断能不能谈近似',
    'practice',
    ['理解闭环特征方程与极点位置是全部讨论的前提', '理解虚轴根和右半平面根会直接改变讨论前提'],
    [
      { label: '先问什么', question: '为什么所有近似和性能讨论之前，都要先问系统稳不稳定？' },
      { label: '临界稳定', question: '出现虚轴根时，为什么不能直接沿用稳定系统的近似语言？' },
    ],
    '请只围绕特征方程、闭环极点与半平面判据解释，不进入劳斯表和参数区间。',
  ),
  'step-06': context(
    'step-06',
    '从极点到模态：极点为什么会直接进响应',
    'practice',
    ['把极点、留数和时域现象串成模态语言', '理解极点不是复平面上的死点，而是运动模态的入口'],
    [
      { label: '为什么叫模态', question: '为什么说极点对应的是系统的运动模态，而不只是一个坐标点？' },
      { label: '展开式作用', question: '一般模态展开式为什么能直接解释时域响应的组成？' },
    ],
    '当前步骤重点是“极点 -> 模态 -> 响应现象”的因果链，不要跳去谈设计。',
  ),
  'step-07': context(
    'step-07',
    '三类极点与重根的响应形态',
    'practice',
    ['区分负实极点、共轭复根、右半平面极点与重根的不同现象', '纠正“重根只是多一个极点”的误区'],
    [
      { label: '重根多了什么', question: '重根为什么会引入额外的时间因子，而不是仅仅重复一遍原来的响应项？' },
      { label: '右半平面', question: '为什么右半平面极点对应发散，而左半平面共轭复根仍可能振荡但收敛？' },
    ],
    '请把三类极点与重根分别解释，不要用一句笼统表述混过去。',
  ),
  'step-08': context(
    'step-08',
    '三模型时域对照与主导极点近似边界',
    'workspace',
    ['比较同主导极点模型为何仍有明显差异', '把时域判断建立在附加模态退场快慢上'],
    [
      { label: '谁更接近', question: '在三模型对照里，哪些证据能支持你判断哪一组更接近参考模型？' },
      { label: '为什么会失真', question: '附加极点靠得不够左时，会怎样改写主要动态？' },
    ],
    '当前步骤强调证据化比较。请学生先用图和公式说理由，再谈结论。',
  ),
  'step-09': context(
    'step-09',
    '时域近似边界：经验不是定理',
    'practice',
    ['理解“更靠左”只是经验起点', '补上权重、重根、聚集极点等边界条件'],
    [
      { label: '经验起点', question: '为什么 3 到 5 倍更靠左只能算经验起点，而不是充分条件？' },
      { label: '还要看什么', question: '除了极点位置更靠左，还必须同时看哪些因素？' },
    ],
    '请用“经验 + 证据 + 例外”的方式解释，不要把经验句式包装成定理。',
  ),
  'step-10': context(
    'step-10',
    '从时域追问回到频域',
    'practice',
    ['理解为什么时域判断还要接受频域证据补充', '为下一步 Bode 对照建立问题清单'],
    [
      { label: '为什么回频域', question: '为什么只靠时域曲线还不足以判断近似是否可靠？' },
      { label: '要问什么', question: '回到频域后，我们最想追问附加极点对哪些频段产生了影响？' },
    ],
    '这一页只搭桥，不直接给出最后的频域判据。',
  ),
  'step-11': context(
    'step-11',
    'Bode 对照与主要带宽侵入',
    'workspace',
    ['区分固有频率、转折频率和带宽各自回答的问题', '学会用频域证据辅助判断近似是否可靠'],
    [
      { label: '三个频率', question: '固有频率、附加极点转折频率和带宽分别在回答什么问题？' },
      { label: '何时侵入', question: '为什么附加极点转折频率一旦逼近主要带宽，就要警惕低阶近似失真？' },
    ],
    '请帮助学生把三个频率锚点分工讲清楚，不要把这页讲成完整 Bode 作图课。',
  ),
  'step-12': context(
    'step-12',
    '双域近似判断 + AI 对照',
    'reflection',
    ['坚持先自判、后 AI、再回图上核验', '让 AI 只检查证据链而不替学生下结论'],
    [
      { label: '先写证据', question: '在问 AI 之前，我应该先写清楚哪些时域和频域证据？' },
      { label: 'AI 看什么', question: '和 AI 对照时，最应该核对的是最终结论，还是你的证据链与推理顺序？' },
    ],
    '这一页必须坚持“先自判，再 AI，对照证据链”。AI 的职责是检查证据是否完整，不替学生直接下判断。',
  ),
  'step-13': context(
    'step-13',
    '卷积与模态叠加：输入激发模态，不改写极点结构',
    'practice',
    ['理解卷积在说明什么', '区分“激发已有模态”和“改变系统结构”这两件事'],
    [
      { label: '卷积改什么', question: '卷积在解释输入如何激发系统输出时，到底改变了什么、没有改变什么？' },
      { label: '负模态', question: '为什么出现负模态项并不等于系统失稳？' },
    ],
    '请把“输入激发模态”和“系统极点结构不变”同时说清楚，不要把卷积误解成重新造出一组极点。',
  ),
  'step-14': context(
    'step-14',
    '后测：会不会发散、能不能近似、为什么能解释',
    'quiz',
    ['综合检验稳定底线、主导极点近似和卷积/模态语言', '看学生能否把概念、图和解释连起来'],
    [
      { label: '先看哪一层', question: '遇到一个高阶系统时，为什么第一步永远是先看稳定底线？' },
      { label: '为什么能解释', question: '为什么主导极点近似不只是一个经验结论，而是可以被模态与频域证据共同解释的？' },
    ],
    '当前步骤用于综合检验，不直接替学生完成后测。',
  ),
  'step-15': context(
    'step-15',
    '总结与后续预告',
    'summary',
    ['用四句出口判断收束本课', '明确下一课将把稳定底线推进到稳定边界可视化'],
    [
      { label: '四句出口', question: '3-1 最值得带走的四句出口判断分别是什么？' },
      { label: '为什么接 3-2', question: '为什么站稳 3-1 的纯极点语言后，下一步自然会进入稳定边界和劳斯可视化？' },
    ],
    '请帮助学生收束本课，不再扩张新内容。',
  ),
};

export function getUnit31StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_1_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit31StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_1_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_1StepAIContext = getUnit31StepAIContext;
export const getUNIT_3_1StepQuickQuestions = getUnit31StepQuickQuestions;
