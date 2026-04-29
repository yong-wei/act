export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: string;
}

export interface ChoiceOption {
  value: string;
  label: string;
}

export const PRETEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '关于频域中的结构变化，下列哪项判断最准确？',
    options: [
      { value: 'A', label: '只要幅频曲线抬高，系统就一定更快更好' },
      { value: 'B', label: '必须同时看被改写的频带、幅值与相位代价' },
      { value: 'C', label: '只要出现零点，系统就一定更快' },
    ],
    answer: 'B',
    explanation: '频域判断必须同时看频带、幅值和相位，不能只看曲线有没有抬高。',
  },
  {
    key: 'q2',
    prompt: 'Nyquist 快判时第一步应该先做什么？',
    options: [
      { value: 'A', label: '先看曲线包围了几圈' },
      { value: 'B', label: '先数开环右半平面极点 P' },
      { value: 'C', label: '先判断相角裕度够不够' },
    ],
    answer: 'B',
    explanation: 'Nyquist 判稳必须先数 P，再数 N，最后算 Z。',
  },
  {
    key: 'q3',
    prompt: '关于截止频率和带宽，下列说法哪项更准确？',
    options: [
      { value: 'A', label: '它们永远是同一个量，只是名字不同' },
      { value: 'B', label: '开环读余量，闭环看带宽，两者相关但不能直接混为一项' },
      { value: 'C', label: '只要截止频率提高，超调一定变小' },
    ],
    answer: 'B',
    explanation: '截止频率是开环读余量的入口，带宽是闭环读速度的量，不能直接混用。',
  },
  {
    key: 'q4',
    prompt: '关于非最小相系统的频域直觉，下列哪项更合理？',
    options: [
      { value: 'A', label: '只要继续加大带宽，性能一定继续改善' },
      { value: 'B', label: '应先识别相位代价和边界，再决定是否继续推进' },
      { value: 'C', label: '右半平面零点等于右半平面极点' },
    ],
    answer: 'B',
    explanation: '非最小相问题常先落在相位代价和边界，而不是一味追求更大带宽。',
  },
] as const;

export const POSTTEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: 'Nyquist 判稳的固定顺序是什么？',
    options: [
      { value: 'A', label: 'N -> P -> Z' },
      { value: 'B', label: 'P -> N -> Z' },
      { value: 'C', label: 'Z -> P -> N' },
    ],
    answer: 'B',
    explanation: '必须先数开环右半平面极点 P，再数包围数 N，最后算闭环右半平面极点 Z。',
  },
  {
    key: 'q2',
    prompt: '关于 Bode 判稳的说法，哪一项最合理？',
    options: [
      { value: 'A', label: 'Bode 判稳是与 Nyquist 完全无关的另一套规则' },
      { value: 'B', label: 'Bode 判稳是在对数坐标上读同一临界边界' },
      { value: 'C', label: '只要相角裕度为正，其他指标都可以不看' },
    ],
    answer: 'B',
    explanation: 'Bode 与 Nyquist 读的是同一条临界边界，只是坐标系不同。',
  },
  {
    key: 'q3',
    prompt: '如果任务从“尽快跟踪”切到“优先减小超调并减轻执行器波动”，第一动作更应该是什么？',
    options: [
      { value: 'A', label: '先重新判断优先改写哪一段频率' },
      { value: 'B', label: '先默认继续抬低频增益' },
      { value: 'C', label: '先把所有频段一起抬高' },
    ],
    answer: 'A',
    explanation: '任务切换后应先重判目标对应的频带，而不是直接沿用上一题的补偿直觉。',
  },
  {
    key: 'q4',
    prompt: '面对非最小相边界时，哪项判断更准确？',
    options: [
      { value: 'A', label: '只要继续加大带宽，系统一定更快更稳' },
      { value: 'B', label: '应先识别相位代价和带宽边界，再决定是否继续推进' },
      { value: 'C', label: '右半平面零点说明系统一定闭环不稳定' },
    ],
    answer: 'B',
    explanation: '非最小相系统不能无限追求带宽，必须先看相位代价与边界。',
  },
] as const;

export const ROW_FOCUS_TOGGLE_ROWS = [
  {
    key: 'gain',
    label: '增益提升',
    band: '更像整体抬高',
    benefit: '可能提高精度',
    cost: '裕量可能被压缩',
  },
  {
    key: 'lhp-zero',
    label: '左半平面零点',
    band: '中频优先',
    benefit: '速度和相角裕度有改善机会',
    cost: '高频噪声代价可能上升',
  },
  {
    key: 'integral-lag',
    label: '积分 / 滞后',
    band: '低频优先',
    benefit: '稳态精度改善',
    cost: '中频附近可能带来代价',
  },
  {
    key: 'nmp',
    label: '非最小相',
    band: '相位代价先暴露',
    benefit: '帮助识别边界',
    cost: '带宽推进受限',
  },
] as const;

export const CURVE_COMPARE_VARIANTS = [
  { key: 'gain', label: '增益提升', accent: 'cyan' },
  { key: 'lhp-zero', label: '左半平面零点', accent: 'emerald' },
  { key: 'integral-lag', label: '积分 / 滞后', accent: 'amber' },
  { key: 'nmp', label: '非最小相', accent: 'rose' },
] as const;

export const CURVE_COMPARE_CONTROLS = {
  gain: { key: 'gain', label: '增益 K', min: 0.6, max: 2.2, step: 0.1, defaultValue: 1.2 },
  zero: { key: 'zero', label: '零点位置', min: 0.4, max: 2.5, step: 0.1, defaultValue: 1.1 },
  lag: { key: 'lag', label: '低频补偿比', min: 1.5, max: 6, step: 0.5, defaultValue: 3 },
  nmp: { key: 'nmp', label: '右半平面零点', min: 0.2, max: 1.6, step: 0.1, defaultValue: 0.6 },
} as const;

export const ACTIVITY_CARD_FIELDS = {
  'step-06': [
    { key: 'bandChoice', label: '先判断主要被改写的频带' },
    { key: 'tradeoffChoice', label: '再说明典型收益与代价' },
  ],
  'step-12': [
    { key: 'boundarySide', label: '系统位于临界边界哪一侧' },
    { key: 'correctionDirection', label: '下一步修正方向' },
  ],
} as const;

export const STEP_REVEAL_SEGMENTS = [
  { key: 'arg', label: '先看总转角怎么变' },
  { key: 'p', label: '再看 P 对应什么对象' },
  { key: 'z', label: '最后看 Z 如何接回闭环稳定' },
] as const;

export const REASON_CHAIN_FIELDS = [
  { key: 'auxiliary', label: '先写辅助函数' },
  { key: 'geometry', label: '再解释为什么盯住 (-1,0)' },
  { key: 'counting', label: '再把 P、N、Z 接起来' },
  { key: 'conclusion', label: '最后回到稳定结论' },
] as const;

export const MATRIX_CHOICE_CARDS = [
  { key: 'objA', label: '对象 A' },
  { key: 'objB', label: '对象 B' },
  { key: 'objC', label: '对象 C' },
  { key: 'objD', label: '对象 D' },
] as const;

export const STABILITY_LABELS = [
  { value: 'stable', label: '闭环稳定' },
  { value: 'unstable', label: '闭环不稳定' },
  { value: 'open-unstable-but-closed-stable', label: '开环不稳定但闭环稳定' },
] as const;

export const CARD_SORT_SCENARIOS = [
  { key: 'edge-near', label: '靠近边界但未越过' },
  { key: 'edge-cross', label: '已经越过边界' },
  { key: 'margin-safe', label: '离边界较远' },
  { key: 'gain-too-high', label: '继续提高增益后越界' },
] as const;

export const HOTSPOT_FIELDS = [
  { key: 'omegaC', label: '截止频率 ωc' },
  { key: 'omegaPi', label: '相位穿越频率 ωπ' },
  { key: 'gamma', label: '相角裕度 γ' },
  { key: 'gm', label: '增益裕度 Gm' },
] as const;

export const BAND_FOCUS_ITEMS = [
  { key: 'low', label: '低频', role: '稳态精度' },
  { key: 'mid', label: '中频', role: '速度与相角裕度' },
  { key: 'high', label: '高频', role: '噪声与执行器代价' },
] as const;

export const GOAL_SWITCH_FIELDS = [
  { key: 'goalA', label: '目标 A：先判断优先频带' },
  { key: 'goalB', label: '目标 B：再判断优先频带' },
  { key: 'evidence', label: '你的频带证据' },
  { key: 'revision', label: '核对后的修订' },
] as const;

export const EVIDENCE_MARK_FIELDS = [
  { key: 'timeEvidence', label: '时域现象里最关键的证据' },
  { key: 'frequencyEvidence', label: '频域证据里最关键的证据' },
  { key: 'baselineProblem', label: '你认为基线方案的核心问题' },
] as const;

export const STRUCTURED_COMPARE_FIELDS = {
  'step-16': [
    { key: 'focusBand', label: '被优先改写的频段' },
    { key: 'translatedMetrics', label: '时域指标翻译成的频域目标' },
    { key: 'leadReason', label: '为什么超前校正主要改写中频' },
  ],
  'step-18': [
    { key: 'baseline', label: '激进基线：速度 / 超调 / 余量 / 高频代价' },
    { key: 'lowerGain', label: '仅降增益：速度 / 超调 / 余量 / 高频代价' },
    { key: 'lead', label: '超前校正：速度 / 超调 / 余量 / 高频代价' },
    { key: 'judgment', label: '最终判断：为什么中频定向校正更优' },
  ],
} as const;

export const SCHEME_VOTE_OPTIONS = [
  { value: 'baseline', label: '激进基线' },
  { value: 'lowerGain', label: '仅降增益' },
  { value: 'lead', label: '超前校正' },
] as const;

export const REFLECTION_PROMPTS = [
  { key: 'summary', label: '用一句话总结本课的完整判断链' },
  { key: 'next', label: '3-9 或 4-1 会从哪里接走这条判断链' },
] as const;
