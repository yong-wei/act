export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: string;
}

export const PRETEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '系统已经稳定，下列哪项判断最准确？',
    options: [
      { value: 'A', label: '已经稳定就说明任务已经完成，可以直接跳过任务表达' },
      { value: 'B', label: '稳定只是起点，还要把目标、约束和优先级写清楚' },
      { value: 'C', label: '稳定后只需要继续提高带宽，不用再看别的指标' },
    ],
    answer: 'B',
    explanation: '稳定只说明系统没有失稳，不能替代任务表达、约束判断和优先级排序。',
  },
  {
    key: 'q2',
    prompt: '关于带宽，下列说法哪项更准确？',
    options: [
      { value: 'A', label: '带宽越大越好，不需要再看储备和代价' },
      { value: 'B', label: '带宽变大是否有利，要结合场景目标和储备边界一起判断' },
      { value: 'C', label: '只要根轨迹稳定，带宽就不再重要' },
    ],
    answer: 'B',
    explanation: '带宽只是任务语言的一部分，要和储备、约束、场景目标一起判断。',
  },
  {
    key: 'q3',
    prompt: '关于“所有指标都重要”，下列说法最准确的是：',
    options: [
      { value: 'A', label: '只要把指标全部列出来，不分主次也算合格任务书' },
      { value: 'B', label: '合格任务书必须说明哪些是硬约束、哪些是软目标、哪些只是观察指标' },
      { value: 'C', label: '只有频域指标才需要排序，时域指标不用排序' },
    ],
    answer: 'B',
    explanation: '任务书的核心不是“全都写上”，而是把角色和优先级写清。',
  },
] as const;

export const POSTTEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '4-1 最先要做的动作是什么？',
    options: [
      { value: 'A', label: '直接给出控制器结构' },
      { value: 'B', label: '先把目标、约束、优先级和证据来源写成任务表达卡' },
      { value: 'C', label: '先默认所有场景都追求更大带宽' },
    ],
    answer: 'B',
    explanation: '4-1 的出口是任务表达卡，而不是控制器选型或参数整定。',
  },
  {
    key: 'q2',
    prompt: '关于可行域、满意域和最优域，下列哪项最准确？',
    options: [
      { value: 'A', label: '只要进入稳定域，就等于进入最优域' },
      { value: 'B', label: '可行、满意、最优必须分层，4-1 只先写到可行和满意' },
      { value: 'C', label: '最优域只和时域指标有关，与频域储备无关' },
    ],
    answer: 'B',
    explanation: '4-1 先筛边界和可接受区，不在本课里宣称“最优”。',
  },
  {
    key: 'q3',
    prompt: '同一套分析图会在两个案例里读出不同排序，最主要原因是什么？',
    options: [
      { value: 'A', label: '因为两个案例的基础语言完全不同' },
      { value: 'B', label: '因为场景目标不同，任务优先级会重排，但证据语言不变' },
      { value: 'C', label: '因为只有客船案例才需要看储备' },
    ],
    answer: 'B',
    explanation: '双案例共享同一套证据语言，但场景主矛盾不同，所以任务排序会重排。',
  },
  {
    key: 'q4',
    prompt: '4-1 结束后，4-2 与 4-3 分别接什么？',
    options: [
      { value: 'A', label: '4-2 接按任务筛结构，4-3 接按任务卡写初始方案方向' },
      { value: 'B', label: '4-2 和 4-3 都直接开始最终参数优化' },
      { value: 'C', label: '4-2 和 4-3 只是重复 4-1，不需要新的输入' },
    ],
    answer: 'A',
    explanation: '4-1 先把输入卡写清，后续两课分别承接结构筛选和初始方案方向。',
  },
] as const;

export const BINARY_CHOICE_PROMPTS = {
  'step-06': {
    prompt: '“当前指标都满足，所以这已经是最优解。”这句话最准确的判断是：',
    options: [
      { value: 'feasible', label: '只说明进入可行域，还不能直接说满意或最优' },
      { value: 'satisficing', label: '已经进入满意域，但仍不能直接宣称最优' },
      { value: 'optimal', label: '只要指标满足就一定是最优域' },
    ],
    answer: 'satisficing',
    explanation: '满足当前任务边界更接近“可接受/满意”，但不能自动推出“最优”。',
  },
  'step-11': {
    prompt: '“单看一张图就足够写结论。”这类说法最准确的归类是：',
    options: [
      { value: 'stable_equals_done', label: '把稳定误当成任务完成' },
      { value: 'all_metrics_equal', label: '把所有指标看成同等重要' },
      { value: 'single_plot_decision', label: '把单图线索误当成完整任务结论' },
    ],
    answer: 'single_plot_decision',
    explanation: '4-1 要求把多图证据、约束和排序一起写回任务卡，不能单图直接定结论。',
  },
} as const;

export const TRIPLE_MATCH_FIELDS = [
  {
    key: 'overshoot',
    label: '超调量 Mp',
    options: [
      { value: 'process', label: '更偏过程是否可接受' },
      { value: 'margin', label: '更偏离风险边界还有多远' },
      { value: 'cost', label: '更偏全过程累计代价' },
    ],
    answer: 'process',
  },
  {
    key: 'phase_margin',
    label: '相角裕度 γ',
    options: [
      { value: 'process', label: '更偏过程是否可接受' },
      { value: 'margin', label: '更偏离风险边界还有多远' },
      { value: 'cost', label: '更偏全过程累计代价' },
    ],
    answer: 'margin',
  },
  {
    key: 'itae',
    label: 'ITAE / IAE / ISE',
    options: [
      { value: 'process', label: '更偏过程是否可接受' },
      { value: 'margin', label: '更偏离风险边界还有多远' },
      { value: 'cost', label: '更偏全过程累计代价' },
    ],
    answer: 'cost',
  },
] as const;

export const CARD_SORT_FIELDS = {
  'step-05': {
    options: [
      { value: 'hard_constraint', label: '硬约束' },
      { value: 'soft_target', label: '软目标' },
      { value: 'observation', label: '观察指标' },
    ],
    items: [
      { key: 'overshoot', label: '客船：超调量不超过 15%' },
      { key: 'settling_time', label: '客船：调节时间尽量缩短，但不牺牲平顺' },
      { key: 'resonance_peak', label: '平台：谐振峰值用于解释储备代价' },
      { key: 'bandwidth', label: '平台：带宽更靠前，但仍要守住储备边界' },
    ],
  },
  'step-09': {
    options: [
      { value: 'ship', label: '归到客船排序' },
      { value: 'platform', label: '归到平台排序' },
    ],
    items: [
      { key: 'ship_priority', label: '先保过程平顺与储备，再谈提速' },
      { key: 'platform_priority', label: '速度与带宽前移，但不能放松储备底线' },
      { key: 'ship_boundary', label: '乘坐舒适和边界冗余优先压实' },
      { key: 'platform_response', label: '更快跟踪和更高工作带宽优先抬上来' },
    ],
  },
} as const;

export const STRUCTURED_COMPARE_FIELDS = {
  'step-07': [
    { key: 'conflict', label: '当前主要矛盾' },
    { key: 'boundary', label: '必守边界' },
    { key: 'evidence', label: '当前证据' },
  ],
  'step-08': [
    { key: 'speed_advantage', label: '速度前移的原因' },
    { key: 'boundary_cost', label: '不能放松的边界' },
    { key: 'evidence', label: '当前证据' },
  ],
} as const;

export const TASK_CARD_CASE_OPTIONS = [
  { value: 'ship', label: '案例 A：客船航向控制' },
  { value: 'platform', label: '案例 B：船载稳定平台' },
] as const;

export const TASK_CARD_PRIORITY_OPTIONS = [
  { value: 'boundary_first', label: '先守边界，再争改善' },
  { value: 'speed_first', label: '先抢速度，同时补足储备' },
  { value: 'balanced', label: '先写折中任务，再分主次' },
] as const;

export const TASK_CARD_FIELDS = [
  { key: 'object', label: '对象' },
  { key: 'goal', label: '目标' },
  { key: 'hardConstraint', label: '硬约束' },
  { key: 'softTarget', label: '软目标' },
  { key: 'observationMetric', label: '观察指标' },
  { key: 'evidenceSource', label: '证据来源' },
] as const;

export const TASK_CARD_EVIDENCE_BANK = [
  '客船：Mp <= 15%，ts <= 45 s，需优先保证平顺与储备',
  '客船：根轨迹和相频线索都提示边界不能被继续压缩',
  '平台：高带宽和高速度是当前主任务，但储备仍需补足',
  '平台：特殊布局综合图同时暴露快速极点信息与储备代价',
] as const;
