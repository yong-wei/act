import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_5_COURSE_META = {
  courseId: 'unit-3-5-zero-dynamic-improvement-v1',
  courseTitle: '3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变',
  courseDescription:
    '围绕零点引入、PD/测速反馈、超前装置与非最小相边界，把“结构改变为什么会改写三域表现”讲成一条可执行判断链。',
  keyConcepts: ['零点重排根轨迹', 'PD 与测速反馈', '超前频域整形', '非最小相边界', '相角裕度', '带宽'],
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
    courseId: UNIT_3_5_COURSE_META.courseId,
    courseTitle: UNIT_3_5_COURSE_META.courseTitle,
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

export const UNIT_3_5_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '回到地图：为什么只调增益很快不够',
    'theory',
    ['标定本课在模块3中的位置。', '3-4 负责沿既有轨迹判断。', '3-5 负责结构改变与零点边界。'],
    [
      { label: '本页目标', question: '这一步为什么要围绕“标定本课在模块3中的位置。”展开？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：课程路径；从读图判断走向结构改变的转折。禁止范围：提前给出实例结论；提前给出数值结果。关键事实：3-4 负责沿既有轨迹判断；3-5 负责结构改变与零点边界；3-6 将进入统一对象实验。',
  ),
  'step-02': context(
    'step-02',
    '统一对象、四个版本与三项固定产出',
    'theory',
    ['压实比较边界与固定产出。', '比较必须优先在同一对象上进行。', '三项固定产出贯穿全课。'],
    [
      { label: '本页目标', question: '这一步为什么要围绕“压实比较边界与固定产出。”展开？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：对象；版本；产出；边界。禁止范围：把本课简化成图像浏览。关键事实：比较必须优先在同一对象上进行；三项固定产出贯穿全课。',
  ),
  'step-03': context(
    'step-03',
    '前测：先写下直觉，不让 AI 代替判断',
    'quiz',
    ['暴露起点误区并保住先独立判断的顺序。', 'AI 只用于对照和纠错。'],
    [
      { label: '本页目标', question: '这一步为什么要围绕“暴露起点误区并保住先独立判断的顺序。”展开？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：错因归类；术语纠偏；误判对照。禁止范围：直接生成前测答案；替学生写直觉句。关键事实：AI 只用于对照和纠错。',
  ),
  'step-04': context(
    'step-04',
    '二阶纯极点对象接入零点：第一眼先看哪条分支被拉走',
    'practice',
    ['建立“零点改变轨迹骨架”的第一印象。', '零点出现后，根轨迹骨架会改写。'],
    [
      { label: '本页目标', question: '这一步为什么要围绕“建立零点改变轨迹骨架的第一印象”展开？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：分支终点；实轴区段；轨迹重排。禁止范围：只说更快而不指出轨迹哪里变了。关键事实：零点出现后，根轨迹骨架会改写。',
  ),
  'step-05': context(
    'step-05',
    '三阶对象接入零点：主导分支怎样被重新分配',
    'practice',
    ['把零点位置差异压成可回查的主导分支判断。', '零点位置不同，主导分支被拉走的方式也不同。'],
    [
      { label: '本页目标', question: '为什么同样是加零点，还要比较零点放在哪里？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：零点位置；主导分支；重排位置。禁止范围：泛化成零点都会改善动态。关键事实：零点位置不同，主导分支被拉走的方式也不同。',
  ),
  'step-06': context(
    'step-06',
    '第一组结论：左半平面改善动态，右半平面先留下问号',
    'practice',
    ['保留认知张力，把右半平面零点的危险留到后段用证据揭示。', '右半平面零点需要单独判断。'],
    [
      { label: '本页目标', question: '为什么这一步要先留下问号，而不是直接讲完右半平面零点？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：风险预测；问题保留。禁止范围：提前给出非最小相完整答案。关键事实：右半平面零点需要单独判断。',
  ),
  'step-07': context(
    'step-07',
    '结构辨认：PD 与测速反馈为什么不能混成一个名字',
    'quiz',
    ['先把结构辨认压实，再进入公式与结果比较。', '测速反馈不显式增加前向零点。'],
    [
      { label: '本页目标', question: '为什么先分清结构，再谈动态改善效果？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：前向通道；局部反馈；显式零点。禁止范围：效果相似即结构相同。关键事实：测速反馈不显式增加前向零点。',
  ),
  'step-08': context(
    'step-08',
    '阻尼公式工作区：由目标阻尼反求 Kd 与 Kt',
    'practice',
    ['把公式变成可执行的求参动作。', '本例最终应满足 Kd=Kt=0.3。'],
    [
      { label: '本页目标', question: '如果目标阻尼给定，为什么这一步必须写出完整反求链？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：公式校验；变量含义检查。禁止范围：直接代做代入过程。关键事实：本例最终应满足 Kd=Kt=0.3。',
  ),
  'step-09': context(
    'step-09',
    'PD 与测速反馈的三域对照：共同点与不同点分别落在哪里',
    'practice',
    ['把结果相似与结构不同同时写出来。', 'PD 与测速反馈都能提高阻尼，但结构不同。'],
    [
      { label: '本页目标', question: '为什么“都能增阻尼”还不够，必须继续做三域对照？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：阻尼；零点；根轨迹；时域；频域。禁止范围：只凭名字归类结构。关键事实：PD 与测速反馈都能提高阻尼，但结构不同。',
  ),
  'step-10': context(
    'step-10',
    '这一组实例真正该留下什么：提高阻尼不等于结构相同',
    'practice',
    ['把 PD/测速反馈比较压成稳定判断语言。', '提高阻尼不等于结构相同。'],
    [
      { label: '本页目标', question: '为什么这一步要把结论压成一句完整判断，而不是散着记关键词？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：关键词补全；句子重组。禁止范围：扩展到 PD/超前或非最小相。关键事实：提高阻尼不等于结构相同。',
  ),
  'step-11': context(
    'step-11',
    'PD 单独装置的频域原理：抬中高频、推交叉、代价是高频放大',
    'practice',
    ['先从频域原理理解 PD 为什么会让系统更快。', 'PD 的频域本质是抬升中高频幅值并推动截止频率右移。'],
    [
      { label: '本页目标', question: '为什么要先从频域而不是只从零点位置来理解 PD？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：幅频斜率；交叉频率；截止频率；高频代价。禁止范围：因为有零点所以会补角的抽象说法。关键事实：PD 的频域本质是抬升中高频幅值并推动截止频率右移。',
  ),
  'step-12': context(
    'step-12',
    '超前单独装置的频域原理：相位峰、补相角、作用集中在关键频带',
    'practice',
    ['把超前理解成关键频带补相角。', '超前的频域本质是在截止频率附近主动补相角。'],
    [
      { label: '本页目标', question: '为什么超前更像关键频带补相角，而不是更强的 PD？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：标准式；相位峰；相角裕度；有限频带整形。禁止范围：把超前说成更强的 PD。关键事实：超前的频域本质是在截止频率附近主动补相角。',
  ),
  'step-13': context(
    'step-13',
    '频域设计原则：什么时候优先想 PD，什么时候优先想超前',
    'practice',
    ['把频域原则变成可迁移的设计判断。', 'PD 主打抬交叉。', '超前主打补相角。'],
    [
      { label: '本页目标', question: '如果面对新情境，这一步要我优先判断哪些约束？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：截止频率；相角裕度；噪声约束；适用边界。禁止范围：进入模块4完整整定计算。关键事实：PD 主打抬交叉；超前主打补相角。',
  ),
  'step-14': context(
    'step-14',
    '非最小相：镜像对象、逆响应与额外相位滞后',
    'practice',
    ['把名称来源、时域现象和频域后果同时压实。', '非最小相的命名来自相位不再最小。'],
    [
      { label: '本页目标', question: '为什么非最小相必须同时从名称、时域和频域三层来理解？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：镜像零点；逆响应；相位滞后。禁止范围：只背定义而不解释原因。关键事实：非最小相的命名来自相位不再最小。',
  ),
  'step-15': context(
    'step-15',
    '非最小相控制边界与课后纠错：先保守带宽，再纠正危险误判',
    'quiz',
    ['用后测和纠错把最危险的误判压下去。', 'AI 只做危险误判对照。'],
    [
      { label: '本页目标', question: '为什么非最小相这一步必须先保守带宽？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：误判句；纠正句；缺失关键词；证据域提醒。禁止范围：替学生完成后测；代写整段总结。关键事实：AI 只做危险误判对照。',
  ),
  'step-16': context(
    'step-16',
    '收束：四个观察量、信息图与 3-6 统一对象实验预告',
    'summary',
    ['让学生带着稳定判断语言离开本课。', '本课建立的是判断语言，不是完整设计流程。'],
    [
      { label: '本页目标', question: '四个观察量为什么足以带出这节课的主线？' },
      { label: '允许范围', question: '这一步允许我从哪些角度理解或检查自己的判断？' },
    ],
    '允许范围：观察量；主线回顾；下一课去向。禁止范围：引入新例题；引入新设计流程。关键事实：本课建立的是判断语言，不是完整设计流程。',
  ),
};

export function getUnit35StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_5_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit35StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_5_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_5StepAIContext = getUnit35StepAIContext;
export const getUNIT_3_5StepQuickQuestions = getUnit35StepQuickQuestions;
