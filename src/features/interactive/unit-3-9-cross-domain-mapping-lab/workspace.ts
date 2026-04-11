export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: string;
}

export const PRETEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '如果现在的目标是“更快一些”，首轮判断最该先写什么？',
    options: [
      { value: 'A', label: '先直接报出控制器名称' },
      { value: 'B', label: '先贴任务标签，再判断可能的机制线' },
      { value: 'C', label: '先把所有指标都列一遍，不用分主次' },
    ],
    answer: 'B',
    explanation: '3-9 的首轮动作是先贴任务标签，再判断哪条机制线更适合承担这类任务。',
  },
  {
    key: 'q2',
    prompt: '如果目标是“更准一些”，下列哪项判断更合理？',
    options: [
      { value: 'A', label: '更准就一定只靠把带宽做大' },
      { value: 'B', label: '更准先问低频收益和误差改善路径，不先默认唯一机制线' },
      { value: 'C', label: '更准与更快完全是同一类问题' },
    ],
    answer: 'B',
    explanation: '更准先看稳态改善路径和低频收益，不应直接把问题改写成“继续加快”。',
  },
  {
    key: 'q3',
    prompt: '收益会不会总在同一个域先暴露？',
    options: [
      { value: 'A', label: '会，所有收益都先看时域' },
      { value: 'B', label: '不会，要判断最先暴露收益和代价的域' },
      { value: 'C', label: '会，所有收益都先看频域' },
    ],
    answer: 'B',
    explanation: '3-9 的关键就是把最先暴露收益和代价的域分开写清楚，而不是假设总落在同一域。',
  },
  {
    key: 'q4',
    prompt: '关于带宽与优劣判断，下列哪项更准确？',
    options: [
      { value: 'A', label: '带宽只要更大，方案就一定更优' },
      { value: 'B', label: '还要看相位代价、稳态任务与动态风险是否一起被照顾' },
      { value: 'C', label: '只要稳定，就不需要再看其他域' },
    ],
    answer: 'B',
    explanation: '模块 3 出口不是只追一个指标，而是把收益、代价和任务边界一起写回同一张表。',
  },
] as const;

export const POSTTEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '如果现在需要“更快一些”，首轮判断更接近哪类入口标签？',
    options: [
      { value: 'A', label: '更偏动态改善' },
      { value: 'B', label: '更偏稳态改善' },
      { value: 'C', label: '不需要任务标签，直接整定即可' },
    ],
    answer: 'A',
    explanation: '“更快一些”对应首轮动态改善标签，而不是直接越级到整定。',
  },
  {
    key: 'q2',
    prompt: '如果现在需要“更准一些”，首轮任务判断最该先回到哪类语言？',
    options: [
      { value: 'A', label: '稳态改善路径与误差改善方式' },
      { value: 'B', label: '直接选一个完整校正器结构' },
      { value: 'C', label: '先默认所有问题都靠零点线解决' },
    ],
    answer: 'A',
    explanation: '3-9 的出口要先把问题写成任务表达，不直接越级为具体校正器选型。',
  },
  {
    key: 'q3',
    prompt: '如果目标是“既快又准但不能太冒进”，最合理的首轮动作是什么？',
    options: [
      { value: 'A', label: '只追最快路线，不用写风险' },
      { value: 'B', label: '写成综合折中任务，并把风险边界一起带到下一课' },
      { value: 'C', label: '跳过任务表达，直接做最终参数计算' },
    ],
    answer: 'B',
    explanation: '综合折中任务必须把收益和风险同时带到 4-1，而不是直接替代成完整设计结果。',
  },
  {
    key: 'q4',
    prompt: '3-9 到 4-1 的边界，下列哪项最准确？',
    options: [
      { value: 'A', label: '3-9 已经完成完整设计，4-1 只是复习' },
      { value: 'B', label: '3-9 输出首轮任务判断，4-1 才进入指标、约束与可行域' },
      { value: 'C', label: '3-9 和 4-1 讲的是同一件事，没有边界' },
    ],
    answer: 'B',
    explanation: '3-9 的终点是“先问对问题”，4-1 才继续展开任务书和设计边界。',
  },
] as const;

export const STRUCTURED_COMPARE_FIELDS = {
  'step-03': [
    { key: 'tag', label: '任务标签' },
    { key: 'risk', label: '第一风险点' },
    { key: 'domain', label: '首先观察的域' },
  ],
  'step-04': [
    { key: 'benefit', label: '主要收益域' },
    { key: 'cost', label: '主要代价域' },
    { key: 'tag', label: '任务标签' },
    { key: 'change', label: '与基准相比最显著变化' },
  ],
} as const;

export const REASON_CHECK_OPTIONS = [
  { value: 'integral_zero', label: '积分更对应把某类误差结构性压到零' },
  { value: 'lag_reduce', label: '滞后更对应把有限误差压小' },
  { value: 'both_zero', label: '积分和滞后都主要负责把误差直接压到零' },
  { value: 'same_role', label: '积分与滞后的稳态任务完全一样，只是名字不同' },
] as const;

export const MATRIX_WORKSPACE_COLUMNS = [
  { key: 'benefitDomain', label: '低频收益先出现在哪' },
  { key: 'costDomain', label: '代价先暴露在哪' },
  { key: 'midbandRecovery', label: '是否已把中频整理拉回' },
  { key: 'tag', label: '任务标签' },
] as const;

export const MATRIX_WORKSPACE_ROWS = [
  { key: 'weakIntegral', label: '弱积分' },
  { key: 'strongIntegral', label: '强积分' },
  { key: 'correctedIntegral', label: '积分校正' },
] as const;

export const MATRIX_WORKSPACE_FIELDS = MATRIX_WORKSPACE_ROWS.flatMap((row) =>
  MATRIX_WORKSPACE_COLUMNS.map((column) => ({
    key: `${row.key}.${column.key}`,
    label: `${row.label} · ${column.label}`,
  })),
);

export const TABLE_BUILDER_COLUMNS = [
  { key: 'structure', label: '结构变化' },
  { key: 'rootSignal', label: '根轨迹第一信号' },
  { key: 'timeDomain', label: '时域结果' },
  { key: 'frequencyDomain', label: '频域解释' },
  { key: 'tag', label: '任务标签' },
  { key: 'risk', label: '主要风险' },
] as const;

export const TABLE_BUILDER_ROWS = [
  { key: 'baseline', label: '基准版本' },
  { key: 'zeroLine', label: '零点线补强' },
  { key: 'integralCorrected', label: '积分校正' },
  { key: 'lag', label: '滞后对照' },
] as const;

export const TABLE_BUILDER_FIELDS = TABLE_BUILDER_ROWS.flatMap((row) =>
  TABLE_BUILDER_COLUMNS.map((column) => ({
    key: `${row.key}.${column.key}`,
    label: `${row.label} · ${column.label}`,
  })),
);
