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
  { id: 'discrete-control-foundations', label: '离散控制基础', detail: '理解采样保持、脉冲传递函数与单位圆稳定性，能完成基本模型和判据计算。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'state-space-analysis-foundations', label: '状态空间分析基础', detail: '理解可控性与可观测性，能用矩阵秩区分输入作用范围和输出信息范围。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'steady-state-control-foundations', label: '稳态精度与PI基础', detail: '区分系统型别、稳态误差与积分作用，理解PI的精度收益和动态代价。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'system-modeling-process-foundations', label: '系统建模流程与适用边界', detail: '明确建模目的、状态和简化假设，比较模型保真度与跨物理系统的相似条件。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'physical-modeling-interconnection-foundations', label: '物理系统与互连建模', detail: '从受力和守恒关系建立模型，辨别串并联、负载效应及测量环节的适用条件。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'state-space-controllability-foundations', label: '状态空间实现与可控性', detail: '建立状态表达，运用秩与模态判据分析可达性、估计误差和极点配置的条件。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'local-linearization-foundations', label: '平衡点与局部线性化', detail: '区分平衡点和一般工作点，建立小信号模型并判断局部近似的适用边界。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'signal-flow-foundations', label: '信号流图基础', detail: '由节点方程识别输入输出、支路、前向路径和基本回路，区分路径增益与整图关系。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'block-diagram-modeling-foundations', label: '结构图建模与等效化简', detail: '从变量方程建立结构图，保留输入位置和负载条件，验证代数化简与反馈互联。', intentType: 'modeling', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'mason-gain-formula-foundations', label: '梅森公式与通路余子式', detail: '逐项确定通路、回路、不接触组合与余子式，并用节点方程复核增益。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'feedback-structure-foundations', label: '开闭环与反馈结构', detail: '区分辅助回路、参考与扰动通道，依据完整结构判断增益、误差和反馈作用。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'transfer-poles-zeros-foundations', label: '传递函数与零极点', detail: '区分直接传递、零极点与隐藏模态，判断闭环和多变量传输关系。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'input-response-foundations', label: '典型输入与系统响应', detail: '根据输入与初态区分脉冲、自然和卷积响应，复核时域与复频域表达。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'first-second-order-dynamics-foundations', label: '一二阶动态与阻尼参数', detail: '识别时间常数、固有频率与阻尼比，在匹配条件下解释极点和响应变化。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'response-metrics-foundations', label: '响应指标与长期过程', detail: '按统一口径计算峰值、上升和调节时间，区分瞬态、稳态与完整动态过程。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'time-domain-design-foundations', label: '时域性能与设计', detail: '结合响应速度、超调与误差积分比较方案，按模型条件核验时域设计。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'dominant-pole-analysis-foundations', label: '高阶系统与主导极点', detail: '辨析模态、极点与零点，验证高阶模型的主导极点近似。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'stability-concepts-foundations', label: '稳定性概念与边界', detail: '区分内部、渐近与输入输出稳定，核验边界模态和增益区间。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'routh-relative-stability-foundations', label: '劳斯判别与近似', detail: '核验劳斯特殊情形、参数区间和衰减裕量，并区分判别与降阶。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'optimal-control-foundations', label: '最优控制基础', detail: '明确性能指标与约束，区分必要条件和最优性证明，理解动态规划与二次型控制的基本方法。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'robust-control-foundations', label: '鲁棒控制基础', detail: '明确不确定集合，核验全族稳定与性能边界，区分标称设计、鲁棒保证与采样仿真。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
  { id: 'nonlinear-control-foundations', label: '非线性控制基础', detail: '理解逆系统、状态反馈与耗散方法，核验可逆性、内部动态和输入约束。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },
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
