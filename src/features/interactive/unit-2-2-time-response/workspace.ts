export interface WorkspaceParameterChange {
  key: string;
  value: number;
  source: 'slider' | 'toggle' | 'preset';
}

export interface SecondOrderParameterCard {
  key: 'wn' | 'zeta' | 'wd';
  label: string;
  formula: string;
  phenomenon: string;
  question: string;
}

export interface TimeDomainMetricCallout {
  key: 'tr' | 'tp' | 'mp' | 'ts';
  label: string;
  question: string;
  meaning: string;
  anchor: string;
  position: {
    x: number;
    y: number;
  };
}

export interface WorkedExampleStage {
  key: 'read' | 'wd' | 'metrics';
  title: string;
  focus: string;
  detail: string;
}

export const SECOND_ORDER_PARAMETER_CARDS: SecondOrderParameterCard[] = [
  {
    key: 'wn',
    label: '自然频率 wn',
    formula: 'wn = 时间尺度基准',
    phenomenon: '决定响应整体快慢，是“时间轴被压缩还是拉长”的第一把尺。',
    question: '如果只增大 wn 而不改 zeta，系统通常会整体变快还是变慢？',
  },
  {
    key: 'zeta',
    label: '阻尼比 zeta',
    formula: 'zeta = 衰减 / 振荡品质',
    phenomenon: '决定会不会明显振荡、超调会不会过大、回落会不会拖尾。',
    question: '为什么 Mp 更像是在读 zeta，而不是在读 wn？',
  },
  {
    key: 'wd',
    label: '阻尼振荡频率 wd',
    formula: 'wd = wn * sqrt(1 - zeta^2)',
    phenomenon: '决定欠阻尼波峰出现的实际节奏，是“峰与峰之间多快出现”的量。',
    question: '为什么已知 wn 和 zeta 后，仍然要单独算一次 wd？',
  },
];

export const TIME_DOMAIN_METRIC_CALLOUTS: TimeDomainMetricCallout[] = [
  {
    key: 'tr',
    label: '上升时间 tr',
    question: '系统起步快不快？',
    meaning: '第一次到达终值附近所需的时间。',
    anchor: '关注“从起点到第一次摸到目标”这段过程。',
    position: { x: 120, y: 172 },
  },
  {
    key: 'tp',
    label: '峰值时间 tp',
    question: '第一个峰出现得多快？',
    meaning: '第一次冲到最高点所需的时间。',
    anchor: '它读的是“第一个峰什么时候来”。',
    position: { x: 208, y: 62 },
  },
  {
    key: 'mp',
    label: '超调量 Mp',
    question: '第一次冲过头多少？',
    meaning: '峰值相对终值多出来的比例。',
    anchor: '它读的是“冲得有多高”，不是“冲得多快”。',
    position: { x: 280, y: 44 },
  },
  {
    key: 'ts',
    label: '调节时间 ts',
    question: '多久真正稳定下来？',
    meaning: '进入允许误差带并保持不再越界所需的时间。',
    anchor: '它读的是“何时真正进入稳态工作区间”。',
    position: { x: 380, y: 128 },
  },
];

export const WORKED_EXAMPLE_SEQUENCE: WorkedExampleStage[] = [
  {
    key: 'read',
    title: '读参数',
    focus: '先从标准二阶分母读出 wn 与 zeta。',
    detail: '不要一上来四个指标同时代公式，先明确系统属于哪个标准型。',
  },
  {
    key: 'wd',
    title: '求 wd',
    focus: '先算 wd = wn * sqrt(1 - zeta^2)。',
    detail: 'wd 是峰值时间和上升时间里的关键中间量，跳过这一步最容易出错。',
  },
  {
    key: 'metrics',
    title: '顺推指标',
    focus: '最后依次求 tr、tp、Mp、ts 四个指标。',
    detail: '先有中间量，再顺推四指标，解题链会更稳。',
  },
];
