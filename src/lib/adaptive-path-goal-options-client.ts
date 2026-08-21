export type AdaptivePracticeGoalId = string;

export interface AdaptivePathAdvisorQuickPrompt {
  label: string;
  question: string;
}

export interface AdaptivePathAdvisorGoalContext {
  courseTitle: string;
  topic: string;
  learningObjectives: string[];
  quickPrompts: AdaptivePathAdvisorQuickPrompt[];
  graphNodeIds: string[];
  graphGrounding: {
    goalId: string;
    targetGraphNodeIds: string[];
    knowledgeObjectiveIds: string[];
    capabilityObjectiveIds: string[];
    qualityObjectiveIds: string[];
  };
}

interface ClientGoalDefinition {
  id: AdaptivePracticeGoalId;
  title: string;
  detail: string;
  completionMeaning: string;
  intentType: string;
  recommendedPhase: string;
  terminalValidationSummary: string;
}

export interface ClientAdaptivePracticeGoalOption extends ClientGoalDefinition {
  label: string;
  description: string;
  limitations: string[];
  hrefs: {
    generation: string;
    context: string;
  };
}

const CLIENT_GOAL_DEFINITIONS: readonly ClientGoalDefinition[] = [
  {
    id: 'control-correction',
    title: '控制系统校正设计',
    detail: '把时域目标、根轨迹或频域校正、仿真验证和 Arena 迁移组织为一条可执行设计路径。',
    completionMeaning: '学生能够给出有指标依据、仿真证据和迁移边界的校正方案。',
    intentType: 'controller-design',
    recommendedPhase: 'practice',
    terminalValidationSummary: '以仿真回放、官方 Arena 评测或教师确认的检查点作为路径终点，验证校正方案是否满足目标。',
  },
  {
    id: 'frequency-response-foundations',
    title: '频率响应基础',
    detail: '建立 Bode、Nyquist、频域响应和稳定裕度的基础判读能力。',
    completionMeaning: '学生能够用频域图线和裕度指标解释系统性能风险。',
    intentType: 'analysis',
    recommendedPhase: 'foundation',
    terminalValidationSummary: '以短测、仿真观察或检查点确认频域判读，不强制 Arena 终点。',
  },
  {
    id: 'feedback-loop-concept-foundations',
    title: '反馈与闭环结构基础',
    detail: '理解反馈、误差、闭环结构和控制作用的基本关系。',
    completionMeaning: '学生能够画出闭环关系并解释反馈对误差和稳定性的作用。',
    intentType: 'concept-understanding',
    recommendedPhase: 'foundation',
    terminalValidationSummary: '以概念题和结构解释确认闭环基础。',
  },
  {
    id: 'transfer-function-modeling-foundations',
    title: '传递函数建模基础',
    detail: '从对象、输入输出和误差信号建立可分析的传递函数模型。',
    completionMeaning: '学生能够写出关键传递函数并说明模型假设。',
    intentType: 'modeling',
    recommendedPhase: 'foundation',
    terminalValidationSummary: '以模型表达题和假设说明确认建模基础。',
  },
  {
    id: 'time-domain-response-analysis',
    title: '时域响应与性能指标分析',
    detail: '把响应曲线、超调、调节时间和稳态误差转化为可验证指标。',
    completionMeaning: '学生能够从时域响应判断性能缺口并提出验证要求。',
    intentType: 'analysis',
    recommendedPhase: 'diagnosis',
    terminalValidationSummary: '以响应判读题或仿真记录确认指标理解。',
  },
  {
    id: 'root-locus-analysis-foundations',
    title: '根轨迹分析基础',
    detail: '用根轨迹解释极点迁移、零点引入和动态性能变化。',
    completionMeaning: '学生能够把根轨迹变化和校正方向联系起来。',
    intentType: 'analysis',
    recommendedPhase: 'diagnosis',
    terminalValidationSummary: '以根轨迹判读题确认分析基础。',
  },
  {
    id: 'stability-margin-frequency-analysis',
    title: '稳定裕度与频域安全边界',
    detail: '用幅值裕度、相角裕度和穿越频率表达鲁棒性风险。',
    completionMeaning: '学生能够说明频域性能提升和稳定裕度之间的工程取舍。',
    intentType: 'analysis',
    recommendedPhase: 'diagnosis',
    terminalValidationSummary: '以裕度判读和约束说明确认安全边界。',
  },
  {
    id: 'simulation-validation-practice',
    title: '仿真验证实践',
    detail: '用可复现仿真记录验证控制方案是否满足目标和约束。',
    completionMeaning: '学生能够提交仿真证据并逐项对应原始控制目标。',
    intentType: 'simulation-validation',
    recommendedPhase: 'validation',
    terminalValidationSummary: '以受治理仿真记录作为路径终点。',
  },
  {
    id: 'ship-ocean-transfer-application',
    title: '船海场景迁移应用',
    detail: '把自动控制方法迁移到船舶、MASS 或跨模型任务，并识别失配风险。',
    completionMeaning: '学生能够说明源模型和船海任务条件的共同结构、差异和补充验证需求。',
    intentType: 'transfer-application',
    recommendedPhase: 'transfer',
    terminalValidationSummary: '以跨模型任务、Arena 或仿真迁移验证作为路径终点。',
  },
];

const CLIENT_GOAL_LIMITATIONS = ['quality-rubric-evidence-not-fully-governed'];

function projectClientGoalDefinition(goal: ClientGoalDefinition): ClientAdaptivePracticeGoalOption {
  return {
    ...goal,
    label: goal.title,
    description: goal.detail,
    limitations: [...CLIENT_GOAL_LIMITATIONS],
    hrefs: {
      generation: `/assessment/adaptive-practice?goal=${encodeURIComponent(goal.id)}&intent=contextual-recommendation`,
      context: `/api/adaptive/path-advisor-context?goal=${encodeURIComponent(goal.id)}`,
    },
  };
}

export function getAdaptivePracticeGoalOptions(): ClientAdaptivePracticeGoalOption[] {
  return CLIENT_GOAL_DEFINITIONS.map(projectClientGoalDefinition);
}

export function getAdaptivePracticeGoalOption(
  goalId: string | null | undefined,
): ClientAdaptivePracticeGoalOption | null {
  if (!isAdaptivePracticeGoalId(goalId)) return null;
  const goal = CLIENT_GOAL_DEFINITIONS.find((candidate) => candidate.id === goalId);
  return goal ? projectClientGoalDefinition(goal) : null;
}

export function isAdaptivePracticeGoalId(value: string | null | undefined): value is AdaptivePracticeGoalId {
  return typeof value === 'string' && CLIENT_GOAL_DEFINITIONS.some((goal) => goal.id === value);
}

export function adaptivePracticeGoalLabel(goalId: string): string {
  return isAdaptivePracticeGoalId(goalId)
    ? CLIENT_GOAL_DEFINITIONS.find((goal) => goal.id === goalId)?.title ?? '自适应学习'
    : '自适应学习';
}
