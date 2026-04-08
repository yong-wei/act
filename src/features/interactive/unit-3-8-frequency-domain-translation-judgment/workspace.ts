export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: string;
}

export const PRETEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '关于频域中的结构变化，下列哪项判断最准确？',
    options: [
      { value: 'A', label: '频域只要看幅值变化，曲线抬高就说明一定更快更好' },
      { value: 'B', label: '频域要同时看被改写的频带和相位代价' },
      { value: 'C', label: '只要有零点，系统就一定变快' },
    ],
    answer: 'B',
    explanation: '频域判断必须同时看幅值、相位和频带落点，不能只看“有没有抬高”。',
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
    explanation: 'Nyquist 判稳必须先数 P，再数 N，最后算 Z，顺序不能反。',
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
    explanation: '截止频率是开环读余量的重要入口，带宽是闭环性能读回量，不能简单合并。',
  },
  {
    key: 'q4',
    prompt: '关于非最小相系统的频域直觉，下列哪项更合理？',
    options: [
      { value: 'A', label: '只要带宽继续加大，性能一定继续改善' },
      { value: 'B', label: '非最小相系统常先暴露相位代价，不能无边界追求更大带宽' },
      { value: 'C', label: '右半平面零点等于右半平面极点' },
    ],
    answer: 'B',
    explanation: '非最小相问题的关键常常先落在相位和边界约束上，而不是一味追求更大带宽。',
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
    prompt: '关于截止频率和带宽的关系，哪一项最合理？',
    options: [
      { value: 'A', label: '截止频率就是闭环带宽' },
      { value: 'B', label: '截止频率是开环读余量入口，带宽是闭环读回量' },
      { value: 'C', label: '它们只在 Nyquist 图里才相关' },
    ],
    answer: 'B',
    explanation: '本课要求区分开环读余量和闭环读速度，不能把截止频率直接改写成带宽。',
  },
  {
    key: 'q3',
    prompt: '如果任务从“尽快跟踪”切到“优先减小超调并减轻执行器波动”，第一动作更应该是什么？',
    options: [
      { value: 'A', label: '先重新判断优先改写哪一段频率' },
      { value: 'B', label: '先默认继续抬低频增益' },
      { value: 'C', label: '先把所有频段都一起抬高' },
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

export const REASON_CHECK_FIELDS = [
  { key: 'auxiliary', label: '先写辅助函数' },
  { key: 'countP', label: '先数 P' },
  { key: 'countN', label: '再数 N' },
  { key: 'conclusion', label: '最后下稳定结论' },
] as const;

export const TRIPLE_MATCH_FIELDS = [
  { key: 'changeType', label: '结构变化类型' },
  { key: 'band', label: '首要频带' },
  { key: 'tradeoff', label: '典型收益 / 代价' },
] as const;

export const CARD_SORT_ITEMS = [
  { key: 'objA', label: '对象 A' },
  { key: 'objB', label: '对象 B' },
  { key: 'objC', label: '对象 C' },
  { key: 'objD', label: '对象 D' },
] as const;

export const SORT_BUCKETS = [
  { key: 'stable', label: '闭环稳定' },
  { key: 'unstable', label: '闭环不稳定' },
  { key: 'open-unstable-but-closed-stable', label: '开环不稳定但闭环稳定' },
] as const;

export const HOTSPOT_FIELDS = [
  { key: 'omegaC', label: '截止频率 ωc' },
  { key: 'omegaPi', label: '相位穿越频率 ωπ' },
  { key: 'gamma', label: '相角裕度 γ' },
  { key: 'gm', label: '增益裕度 Gm' },
] as const;

export const AI_COMPARE_FIELDS = [
  { key: 'taskA', label: '任务 A：优先频带判断' },
  { key: 'taskB', label: '任务 B：优先频带判断' },
  { key: 'evidence', label: '你的频带证据' },
  { key: 'revision', label: 'AI 对照后的修订' },
] as const;

export const STRUCTURED_COMPARE_FIELDS = {
  'step-10': [
    { key: 'band', label: '被优先改写的频段' },
    { key: 'benefit', label: '主要收益' },
    { key: 'cost', label: '主要代价是否被压住' },
  ],
  'step-11': [
    { key: 'baseline', label: '激进基线：速度 / 超调 / 余量' },
    { key: 'lowerGain', label: '仅降增益：速度 / 超调 / 余量' },
    { key: 'lead', label: '超前校正：速度 / 超调 / 余量' },
    { key: 'judgment', label: '最终判断：为什么中频定向校正更优' },
  ],
} as const;
