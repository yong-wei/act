import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_3_8_COURSE_META = {
  courseId: 'unit-3-8-frequency-domain-translation-judgment-v1',
  courseTitle: '3-8：频域判别与跨域综合语言',
  courseDescription:
    '围绕结构变化的频域指纹、Nyquist/Bode 统一判稳链、三频段分工与工程案例读回，把模块 3 理论主线收束为一张频域判断地图。',
  keyConcepts: ['频域指纹', 'Nyquist 判稳', 'Bode 裕度', '三频段分工', '中频超前', '工程读回'],
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
    courseId: UNIT_3_8_COURSE_META.courseId,
    courseTitle: UNIT_3_8_COURSE_META.courseTitle,
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

export const UNIT_3_8_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    '课程定位：3-8 把 3-5 与 3-7 收成统一频域判断问题',
    'theory',
    ['明确 3-8 在 3-5、3-7、3-9 之间的位置', '理解频域是模块 3 的统一翻译器'],
    [
      { label: '为什么要统一', question: '为什么 3-5 的结构变化线和 3-7 的稳态改善线，最终都要在 3-8 收成同一个频域问题？' },
      { label: '后续去向', question: '3-8 和 3-9、4-1 的关系分别是什么？' },
    ],
    '当前页面只做路径定位，不提前展开判据公式或整定流程。',
  ),
  'step-02': context(
    'step-02',
    '情境引入：频域判断不能只看幅值',
    'quiz',
    ['理解不同结构变化优先改写的频带不同', '识别幅值与相位必须同时判断'],
    [
      { label: '为什么不能只看幅值', question: '为什么幅频曲线抬高并不自动等于系统更快更好？' },
      { label: '右半平面零点为何棘手', question: '为什么右半平面零点看起来像“更强变化”，却不一定更好控？' },
    ],
    '只纠正“只看幅值”的误判，不提前进入 Nyquist 判据细节。',
  ),
  'step-03': context(
    'step-03',
    '目标与边界：本课只做统一翻译与工程读回',
    'theory',
    ['明确四项目标', '守住不重练作图基础、不进入模块 4 排序的边界'],
    [
      { label: '四项目标', question: '本课四项目标为什么都围绕“统一翻译与判断”展开？' },
      { label: '本课不负责什么', question: '为什么 3-8 不重新讲作图基础，也不进入完整补偿参数计算？' },
    ],
    '只解释目标卡和边界表，不代替后续判断。',
  ),
  'step-04': context(
    'step-04',
    '前测：四类频域误判先暴露出来',
    'quiz',
    ['识别频段优先级误判', '区分 Nyquist 顺序、截止频率与带宽、非最小相边界'],
    [
      { label: '为什么先看频段', question: '为什么频域变化必须先判断改写的是哪一段频率，而不是先喊结论？' },
      { label: 'Nyquist 为什么先数 P', question: '为什么 Nyquist 快判时第一步必须先数开环右半平面极点 P？' },
    ],
    '只做错因归类和术语纠偏，不代替学生作答。',
  ),
  'step-05': context(
    'step-05',
    '频域翻译总表：结构变化如何映射到频带和代价',
    'practice',
    ['把四类结构变化和首要频带对齐', '把收益和代价放回同一张总表'],
    [
      { label: '积分先改哪段', question: '为什么积分或滞后优先改写低频，而左半平面零点更偏中频？' },
      { label: '非最小相先暴露什么', question: '为什么非最小相常常先暴露相位代价，而不是先给你免费收益？' },
    ],
    '允许解释结构变化与频带映射，不直接跳到设计方案排序。',
  ),
  'step-06': context(
    'step-06',
    'Nyquist 判稳：从辅助函数到临界点的完整链条',
    'practice',
    ['理解 F(s)=1+L(s) 与幅角原理的关系', '把 Z=P-N 固定成完整因果链'],
    [
      { label: '为什么看 -1 点', question: '为什么闭环稳定问题会被改写成 Nyquist 曲线怎样对待 (-1,0) 这个点？' },
      { label: 'Z=P-N 怎样理解', question: 'Z=P-N 不是口号，它背后分别在数什么对象？' },
    ],
    '只解释辅助函数、幅角原理和临界点，不把判据简化成只背结论。',
  ),
  'step-07': context(
    'step-07',
    '快速判稳：先数 P，再数 N，最后算 Z',
    'practice',
    ['把 P/N/Z 读图顺序固化下来', '区分右半平面零点和右半平面极点'],
    [
      { label: '为什么右半平面零点不等于不稳', question: '为什么系统含右半平面零点时，不能直接把它判成闭环不稳定？' },
      { label: 'N 在看什么', question: 'Nyquist 快判里，N 到底是在数什么样的包围关系？' },
    ],
    '允许解释包围关系和极点数，不允许跳过 P 或把右半平面零点当极点。',
  ),
  'step-08': context(
    'step-08',
    'Bode 判稳：对数坐标上读同一临界边界',
    'practice',
    ['区分截止频率、相位穿越、相角裕度和增益裕度', '纠正 Bode 是另一套规则的误判'],
    [
      { label: '为什么不是另一套规则', question: '为什么 Bode 判稳不是另一套规则，而是在另一种坐标系上读同一临界边界？' },
      { label: '截止频率和带宽差别', question: '为什么开环截止频率不能直接等同于闭环带宽？' },
    ],
    '只解释指标线和临界边界，不把截止频率和带宽混成同一个量。',
  ),
  'step-09': context(
    'step-09',
    '三频段分工：先判断频带，再看 AI',
    'practice',
    ['把低频、中频、高频的任务分开', '在目标切换时先独立判断再用 AI 对照'],
    [
      { label: '任务 A 先改哪段', question: '如果目标是尽快跟踪，为什么常常优先盯住中频而不是只盯低频？' },
      { label: '任务 B 为什么变了', question: '如果目标切到减小超调并减轻执行器波动，优先改写的频带为什么会变？' },
    ],
    '必须先让学生独立判断频带，再查看 AI 对照；AI 不给补偿器参数。',
  ),
  'step-10': context(
    'step-10',
    '航向控制案例：中频超前如何同时改善速度与稳定裕度',
    'practice',
    ['把相角裕度、截止频率、带宽、超调和调节时间联动读回', '识别这是中频定向改写而不是低频补偿'],
    [
      { label: '为什么是中频改写', question: '航向控制案例里，为什么说主要被改写的是中频，而不是低频？' },
      { label: '为什么能又快又稳', question: '为什么中频超前有机会同时把速度和稳定裕度都往更好的方向推？' },
    ],
    '只做案例读回，不进入完整整定叙事。',
  ),
  'step-11': context(
    'step-11',
    '稳定平台案例：只降增益不如中频定向补角',
    'practice',
    ['区分“更稳但更慢”和“更稳且更快”的不同来源', '比较激进基线、仅降增益、超前校正三方案'],
    [
      { label: '只降增益的问题', question: '为什么只降增益虽然可能提高余量，却常常会把速度牺牲得过头？' },
      { label: '真正有效的动作', question: '为什么本案例里真正有效的是中频定向补角，而不是一味压低整体增益？' },
    ],
    '允许解释三方案的频域与时域联动，不进入模块 4 方案排序。',
  ),
  'step-12': context(
    'step-12',
    '后测与收束：把模块 3 收成统一判断地图',
    'quiz',
    ['检查是否掌握 P/N/Z 顺序、指标边界与目标切换', '把 3-8 接到 3-9 与 4-1'],
    [
      { label: '为什么不是新章', question: '为什么频域不是新章节，而是模块 3 各条主线的统一判断地图？' },
      { label: '去向是什么', question: '3-9 和 4-1 分别会把这张频域判断地图往哪里继续推进？' },
    ],
    '当前页面只做总结与错因归类，不代替学生作答。',
  ),
};

export function getUnit38StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_8_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit38StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_8_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_8StepAIContext = getUnit38StepAIContext;
export const getUNIT_3_8StepQuickQuestions = getUnit38StepQuickQuestions;
