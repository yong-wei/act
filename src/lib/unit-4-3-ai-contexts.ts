import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_4_3_COURSE_META = {
  courseId: 'unit-4-3-initial-scheme-practice-first-validation-v1',
  courseTitle: '4-3：初始方案落地实践：从对象分析到结构组合与首轮验证',
  courseDescription:
    '围绕对象分析、结构分流、复合结构职责、参数方向、首轮验证和问题清单，把起步卡推进成可验证的第一版方案。',
  keyConcepts: ['对象分析', '结构分流', '复合结构职责', '参数方向', '首轮验证', '问题清单移交'],
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
    courseId: UNIT_4_3_COURSE_META.courseId,
    courseTitle: UNIT_4_3_COURSE_META.courseTitle,
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

export const UNIT_4_3_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = {
  'step-01': context(
    'step-01',
    "回到地图：4-2 的起步卡如何长成 4-3 的第一版方案",
    'quiz',
    [
  "固定 4-3 是把起步卡推进成第一版方案的课程。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“回到地图：4-2 的起步卡如何长成 4-3 的第一版方案”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "固定 4-3 是把起步卡推进成第一版方案的课程。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-02': context(
    'step-02',
    "对象分析四问：对象入口不是重抄模型",
    'practice',
    [
  "固定对象分析是设计入口，而不是背景重复。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“对象分析四问：对象入口不是重抄模型”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "固定对象分析是设计入口，而不是背景重复。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-03': context(
    'step-03',
    "结构分流：什么时候继续单结构，什么时候进入复合结构",
    'practice',
    [
  "让学生把分流判断与表 1 建立一一对应。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“结构分流：什么时候继续单结构，什么时候进入复合结构”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "让学生把分流判断与表 1 建立一一对应。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-04': context(
    'step-04',
    "复合结构总览：三类常见写法不是公式堆长",
    'theory',
    [
  "固定三类复合结构的适用问题与分工。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“复合结构总览：三类常见写法不是公式堆长”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "固定三类复合结构的适用问题与分工。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-05': context(
    'step-05',
    "结构 A：`PI + 超前`——低频托举与中频整理分工",
    'practice',
    [
  "把 PI+超前 的职责分工落成完整方法页。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“结构 A：`PI + 超前`——低频托举与中频整理分工”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "把 PI+超前 的职责分工落成完整方法页。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-06': context(
    'step-06',
    "结构 B：`滞后 + 超前`——低频补偿与裕量回收并行",
    'practice',
    [
  "把滞后+超前 的稳健收益与速度代价写清。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“结构 B：`滞后 + 超前`——低频补偿与裕量回收并行”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "把滞后+超前 的稳健收益与速度代价写清。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-07': context(
    'step-07',
    "结构 C：带微分滤波的 `PID`——紧凑表达与高频克制",
    'practice',
    [
  "把带微分滤波 PID 的紧凑表达与高频克制写完整。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“结构 C：带微分滤波的 `PID`——紧凑表达与高频克制”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "把带微分滤波 PID 的紧凑表达与高频克制写完整。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-08': context(
    'step-08',
    "客船案例入口：为什么这里先上超前，而不是立刻复合",
    'practice',
    [
  "固定客船案例当前主矛盾在中频动态品质。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“客船案例入口：为什么这里先上超前，而不是立刻复合”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "固定客船案例当前主矛盾在中频动态品质。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-09': context(
    'step-09',
    "客船参数方向显影：五步把超前初始方案写成可运行表达",
    'practice',
    [
  "把参数方向写成五步可解释链，而非参数表。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“客船参数方向显影：五步把超前初始方案写成可运行表达”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "把参数方向写成五步可解释链，而非参数表。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-10': context(
    'step-10',
    "客船首轮验证：表 6 与问题清单怎样接成下一轮输入",
    'practice',
    [
  "把首轮验证结果转成下一轮问题清单。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“客船首轮验证：表 6 与问题清单怎样接成下一轮输入”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "把首轮验证结果转成下一轮问题清单。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-11': context(
    'step-11',
    "最小例题：什么时候从单结构走向复合结构",
    'practice',
    [
  "用最小例题固定转入复合结构的触发条件。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“最小例题：什么时候从单结构走向复合结构”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "用最小例题固定转入复合结构的触发条件。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-12': context(
    'step-12',
    "实践工作区：对象分析记录单 + 初始方案表达卡 + 问题清单移交表",
    'practice',
    [
  "输出三份最小提交物，而不是单一大表单。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "三卡怎么分",
    question: "对象分析记录单、初始方案表达卡和问题清单移交表分别解决什么问题？"
  },
  {
    label: "如何检查完整性",
    question: "为什么三张工作卡必须分别提交，而不能合成一张大表？"
  }
],
    "输出三份最小提交物，而不是单一大表单。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-13': context(
    'step-13',
    "边界案例：横摇减摇鳍说明复合不只来自频段叠加",
    'practice',
    [
  "说明复合结构还可能来自通道重写。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“边界案例：横摇减摇鳍说明复合不只来自频段叠加”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "说明复合结构还可能来自通道重写。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
  'step-14': context(
    'step-14',
    "后测与收束：从第一版方案走向 4-4 的多目标权衡",
    'quiz',
    [
  "检查判断链是否形成，并把学生送往 4-4。",
  "把本页证据接回第一版方案落地链条"
],
    [
  {
    label: "本页目标",
    question: "本页“后测与收束：从第一版方案走向 4-4 的多目标权衡”在第一版方案落地链条中承担什么作用？"
  },
  {
    label: "常见误判",
    question: "学生在这一页最容易把哪一类证据误读成结构名称答案？"
  }
],
    "检查判断链是否形成，并把学生送往 4-4。 回答时只使用本页证据，不替学生直接生成完整作答。",
  ),
};

export function getUnit43StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_4_3_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit43StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_4_3_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_4_3StepAIContext = getUnit43StepAIContext;
export const getUNIT_4_3StepQuickQuestions = getUnit43StepQuickQuestions;
