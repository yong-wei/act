export type AdaptivePracticeGoalId = string;
export type AdaptivePathAdvisorQuickPrompt = { label: string; question: string };

export interface AdaptivePracticeGoalOptionClient {
  id: AdaptivePracticeGoalId;
  label: string;
  detail: string;
  intentType: string;
  terminalValidationSummary: string;
  hrefs: { generation: string };
}

const GOAL_OPTIONS: ReadonlyArray<Omit<AdaptivePracticeGoalOptionClient, 'hrefs'>> = [
  {
    id: 'control-correction',
    label: '控制系统校正设计',
    detail: '把时域目标、根轨迹或频域校正、仿真验证和 Arena 迁移组织为一条可执行设计路径。',
    intentType: 'controller-design',
    terminalValidationSummary: '以仿真回放、官方 Arena 评测或教师确认的检查点作为路径终点，验证校正方案是否满足目标。',
  },
  {
    id: 'frequency-response-foundations',
    label: '频率响应基础',
    detail: '建立 Bode、Nyquist、频域响应和稳定裕度的基础判读能力。',
    intentType: 'analysis',
    terminalValidationSummary: '以短测、仿真观察或检查点确认频域判读，不强制 Arena 终点。',
  },
  {
    id: 'feedback-loop-concept-foundations',
    label: '反馈与闭环结构基础',
    detail: '理解反馈、误差、闭环结构和控制作用的基本关系。',
    intentType: 'concept-understanding',
    terminalValidationSummary: '以概念题和结构解释确认闭环基础。',
  },
  {
    id: 'transfer-function-modeling-foundations',
    label: '传递函数建模基础',
    detail: '从对象、输入输出和误差信号建立可分析的传递函数模型。',
    intentType: 'modeling',
    terminalValidationSummary: '以模型表达题和假设说明确认建模基础。',
  },
  {
    id: 'time-domain-response-analysis',
    label: '时域响应与性能指标分析',
    detail: '把响应曲线、超调、调节时间和稳态误差转化为可验证指标。',
    intentType: 'analysis',
    terminalValidationSummary: '以响应判读题或仿真记录确认指标理解。',
  },
  {
    id: 'root-locus-analysis-foundations',
    label: '根轨迹分析基础',
    detail: '用根轨迹解释极点迁移、零点引入和动态性能变化。',
    intentType: 'analysis',
    terminalValidationSummary: '以根轨迹判读题确认分析基础。',
  },
  {
    id: 'stability-margin-frequency-analysis',
    label: '稳定裕度与频域安全边界',
    detail: '用幅值裕度、相角裕度和穿越频率表达鲁棒性风险。',
    intentType: 'analysis',
    terminalValidationSummary: '以裕度判读和约束说明确认安全边界。',
  },
  {
    id: 'simulation-validation-practice',
    label: '仿真验证实践',
    detail: '用可复现仿真记录验证控制方案是否满足目标和约束。',
    intentType: 'simulation-validation',
    terminalValidationSummary: '以受治理仿真记录作为路径终点。',
  },
  {
    id: 'ship-ocean-transfer-application',
    label: '船海场景迁移应用',
    detail: '把自动控制方法迁移到船舶、MASS 或跨模型任务，并识别失配风险。',
    intentType: 'transfer-application',
    terminalValidationSummary: '以跨模型任务、Arena 或仿真迁移验证作为路径终点。',
  },
];

export function getAdaptivePracticeGoalOptions(): AdaptivePracticeGoalOptionClient[] {
  return GOAL_OPTIONS.map((goal) => ({
    ...goal,
    hrefs: {
      generation: `/assessment/adaptive-practice?goal=${encodeURIComponent(goal.id)}&intent=contextual-recommendation`,
    },
  }));
}

export function getAdaptivePracticeGoalOption(goalId: string | null | undefined): AdaptivePracticeGoalOptionClient | null {
  if (!isAdaptivePracticeGoalId(goalId)) return null;
  return getAdaptivePracticeGoalOptions().find((goal) => goal.id === goalId) ?? null;
}

export function isAdaptivePracticeGoalId(value: string | null | undefined): value is AdaptivePracticeGoalId {
  return typeof value === 'string' && GOAL_OPTIONS.some((goal) => goal.id === value);
}

export function adaptivePracticeGoalLabel(goalId: string): string {
  return GOAL_OPTIONS.find((goal) => goal.id === goalId)?.label ?? '自适应学习';
}
