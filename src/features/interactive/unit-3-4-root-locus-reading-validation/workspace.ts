export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: 'input' | 'select' | 'button';
}

export const READING_SEQUENCE_OPTIONS = [
  { value: 'skeleton', label: '先看骨架' },
  { value: 'keynodes', label: '再找关键节点' },
  { value: 'windows', label: '再判稳定 / 可接受窗口' },
  { value: 'consequence', label: '最后才谈参数与后果' },
] as const;

export const VERSION_OPTIONS = [
  { value: 'A', label: '版本 A' },
  { value: 'B', label: '版本 B' },
  { value: 'C', label: '版本 C' },
] as const;

export const VERSION_PREDICTION_FIELDS = [
  { key: 'slowest', label: '谁最慢' },
  { key: 'balanced', label: '谁最平衡' },
  { key: 'risky', label: '谁最冒险' },
] as const;

export const KEYNODE_OPTIONS = [
  { value: 'breakaway', label: '分离点' },
  { value: 'imag-axis', label: '虚轴交点' },
  { value: 'dominant-pole', label: '主导极点候选' },
  { value: 'window-boundary', label: '稳定窗口边界' },
] as const;

export const WINDOW_TAG_OPTIONS = [
  { value: 'stable', label: '稳定' },
  { value: 'acceptable', label: '可接受' },
  { value: 'not-recommended', label: '不宜继续推进' },
] as const;

export const GAIN_CONVERSION_FIELDS = [
  { key: 'read_k', label: '图上读到的 k' },
  { key: 'converted_K', label: '换算得到的 K' },
  { key: 'formula_chain', label: '换算步骤' },
  { key: 'warning', label: '为什么不能把 k 直接当 K' },
] as const;

export const TIME_DOMAIN_CHOICES = [
  { value: 'A', label: 'A 保守但慢' },
  { value: 'B', label: 'B 最平衡' },
  { value: 'C', label: 'C 开始冒险' },
] as const;

export const FINAL_RANKING_OPTIONS = [
  { value: 'B>A>C', label: 'B > A > C' },
  { value: 'B>C>A', label: 'B > C > A' },
  { value: 'A>B>C', label: 'A > B > C' },
  { value: 'C>B>A', label: 'C > B > A' },
] as const;

export const EVIDENCE_DOMAIN_OPTIONS = [
  { value: 'root-locus', label: '主图 / 根轨迹' },
  { value: 'time-domain', label: '时域' },
  { value: 'frequency-domain', label: '频域' },
] as const;

export const POST_QUIZ_QUESTIONS = [
  {
    key: 'q1',
    prompt: '“系统还稳定”与“系统已经可接受”之间，最准确的关系是：',
    type: 'choice',
    options: [
      { value: 'same', label: '两者等价' },
      { value: 'different', label: '稳定只是底线，还要继续比较窗口和后果' },
      { value: 'depends', label: '只要频域舒服就等价' },
    ],
    answer: 'different',
    explanation: '稳定只说明还能工作，不代表已经值得继续采用。',
  },
  {
    key: 'q2',
    prompt: '已知图上根轨迹增益满足 k = 0.01715K，若图上读到 k，下一步最关键的是：',
    type: 'choice',
    options: [
      { value: 'direct-use', label: '直接把 k 当作控制器增益 K' },
      { value: 'convert', label: '先完成 k 到 K 的换算，再写工程结论' },
      { value: 'skip', label: '只看时域，不需要换算' },
    ],
    answer: 'convert',
    explanation: '图上参数先是根轨迹增益，必须先翻译回工程参数语言。',
  },
  {
    key: 'q3',
    prompt: '解释题：若你选择 B 作为参考工作点，至少应补充哪两类证据？',
    type: 'text',
    explanation: '理想回答至少出现“关键节点 / 窗口 / 换算 / 三域”中的两个关键词。',
  },
] as const;
