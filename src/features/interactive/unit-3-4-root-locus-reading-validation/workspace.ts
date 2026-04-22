import type { ControlAnalysisRequest, RootLocusSamplePoint } from '@/resources/control-system/analysis/types';
import type { AxisPreset } from '@/resources/control-system/charts/control-bode-options';

export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: 'input' | 'select' | 'button' | 'drag';
}

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ActivityCardField {
  key: string;
  label: string;
  prompt: string;
  inputKind: 'text' | 'single_choice';
  placeholder?: string;
  options?: readonly ChoiceOption[];
}

export interface TripleMatchField {
  key: string;
  label: string;
  prompt: string;
  options: readonly ChoiceOption[];
}

export interface Step05TargetQuestion {
  key: string;
  label: string;
  shortLabel: string;
  prompt: string;
  target: { re: number; im: number };
  acceptMirror: boolean;
  maxDistance: number;
}

export const READING_SEQUENCE_OPTIONS = [
  { value: 'skeleton', label: '先看骨架' },
  { value: 'keynodes', label: '再找关键节点' },
  { value: 'windows', label: '再判稳定 / 可接受窗口' },
  { value: 'consequence', label: '最后才谈工程后果' },
] as const;

export const STEP05_TARGET_QUESTIONS: readonly Step05TargetQuestion[] = [
  {
    key: 'breakaway',
    shortLabel: '分离点',
    label: '问题一：分离点',
    prompt: '把闭环极点拖到分离点附近后提交。',
    target: { re: -0.0494, im: 0 },
    acceptMirror: false,
    maxDistance: 0.03,
  },
  {
    key: 'imaginary_boundary',
    shortLabel: '虚轴边界',
    label: '问题二：虚轴边界',
    prompt: '把闭环极点拖到虚轴边界附近后提交。',
    target: { re: 0, im: 0.4626 },
    acceptMirror: true,
    maxDistance: 0.06,
  },
  {
    key: 'reference_B',
    shortLabel: '参考工作点 B',
    label: '问题三：参考工作点 B',
    prompt: '把闭环极点拖到参考工作点 B 附近后提交。',
    target: { re: -0.0488, im: 0.0496 },
    acceptMirror: true,
    maxDistance: 0.03,
  },
] as const;

export const STEP05_AXIS_PRESET: AxisPreset = {
  x: [-2.4, 0.25],
  y: [-0.7, 0.7],
};

export const STEP05_DEFAULT_POINT = { re: -0.0488, im: 0.0496 } as const;

export function buildUnit34Step05AnalysisRequest(): ControlAnalysisRequest {
  return {
    runtimeMode: 'analysis',
    caseId: 'unit-3-4-step-05-root-locus-targeting',
    plant: {
      numerator: [0.01715],
      denominator: [1, 2.24375, 0.214375, 0],
      coefficientOrder: 'descending',
      label: 'G(s)=0.01715K/[s(s+0.1)(s+2.14375)]',
    },
    structures: [{ kind: 'gain', enabled: true, params: { k: 0.6064 }, label: 'K' }],
    outputs: ['root_locus'],
    timeRange: { start: 0, end: 60, samples: 300 },
    frequencyRange: { min: 1e-3, max: 1e2, samples: 300 },
    rootLocus: { minGain: 0, maxGain: 30, samples: 480, currentGain: 0.6064 },
  };
}

export function findNearestSample(
  branches: RootLocusSamplePoint[][],
  target: { re: number; im: number } | null,
) {
  if (!target) {
    return null;
  }

  let best: RootLocusSamplePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const branch of branches) {
    for (const sample of branch) {
      const distance = Math.hypot(sample.re - target.re, sample.im - target.im);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = sample;
      }
    }
  }
  return best;
}

export function measureStep05TargetDistance(
  sample: Pick<RootLocusSamplePoint, 're' | 'im'>,
  question: Step05TargetQuestion,
) {
  const direct = Math.hypot(sample.re - question.target.re, sample.im - question.target.im);
  if (!question.acceptMirror) {
    return direct;
  }
  const mirrored = Math.hypot(sample.re - question.target.re, sample.im + question.target.im);
  return Math.min(direct, mirrored);
}

export function isStep05TargetSatisfied(
  sample: Pick<RootLocusSamplePoint, 're' | 'im'>,
  question: Step05TargetQuestion,
) {
  return measureStep05TargetDistance(sample, question) <= question.maxDistance;
}

export const PRE_QUIZ_QUESTIONS = [
  {
    key: 'q1',
    prompt: '若 A、B、C 都还稳定，最准确的判断是：',
    options: [
      { value: 'A', label: '三者已经同样可用' },
      { value: 'B', label: '还要继续比较窗口和工程后果' },
      { value: 'C', label: '只需再看一下时域图就能下结论' },
    ],
    answer: 'B',
    explanation: '稳定只是底线，不能代替完整工程判断。',
  },
  {
    key: 'q2',
    prompt: '从主图往后做判断时，最先要固定的对象是：',
    options: [
      { value: 'A', label: '对象、记号与 A/B/C 三版本表' },
      { value: 'B', label: '直接给 Bode 图排序' },
      { value: 'C', label: '先猜谁最优，再补理由' },
    ],
    answer: 'A',
    explanation: '对象、记号和版本差异必须同时出现，后续判断才不漂移。',
  },
  {
    key: 'q3',
    prompt: '关于图上增益 k 与工程参数 K，下列说法最准确的是：',
    options: [
      { value: 'A', label: '两者可以直接当成同一个量' },
      { value: 'B', label: '必须先完成 k 到 K 的换算，再写工程判断' },
      { value: 'C', label: '只看主图时不需要区分它们' },
    ],
    answer: 'B',
    explanation: '图上先读到的是根轨迹增益，不是工程控制器增益。',
  },
] as const;

export const TRIPLE_MATCH_FIELDS: readonly TripleMatchField[] = [
  {
    key: 'root_locus_role',
    label: '主图 / 根轨迹',
    prompt: '主图最擅长回答什么问题？',
    options: [
      { value: 'dominant_poles', label: '关键节点、极点迁移与参数窗口边界' },
      { value: 'waveform', label: '直接给出超调和拖尾细节' },
      { value: 'gain_margin', label: '直接给出增益裕量和相位裕量' },
    ],
  },
  {
    key: 'time_domain_role',
    label: '时域',
    prompt: '时域最擅长回答什么问题？',
    options: [
      { value: 'dominant_poles', label: '关键节点、极点迁移与参数窗口边界' },
      { value: 'waveform', label: '快慢、振荡、拖尾与参考工作点的可见后果' },
      { value: 'gain_margin', label: '直接给出增益裕量和相位裕量' },
    ],
  },
  {
    key: 'frequency_domain_role',
    label: '频域',
    prompt: '频域最擅长回答什么问题？',
    options: [
      { value: 'dominant_poles', label: '关键节点、极点迁移与参数窗口边界' },
      { value: 'waveform', label: '直接给出快慢和拖尾图像' },
      { value: 'gain_margin', label: '带宽、相位变化、高频差异与风险暴露' },
    ],
  },
] as const;

export const WORKED_EXAMPLE_FIELDS: Record<string, readonly ActivityCardField[]> = {
  'step-08': [
    {
      key: 'formula_chain',
      label: '换算链：请写出 k 到 K 的完整步骤',
      prompt: '从图上读到 k 后，如何一步一步换算回工程参数 K？',
      inputKind: 'text',
      placeholder: '先写关系式，再代入 B 点数值……',
    },
    {
      key: 'warning',
      label: '为什么不能把 k 直接当成 K',
      prompt: '为什么图上读到的 k 不能直接被当作工程控制器增益 K？',
      inputKind: 'text',
      placeholder: '说明记号含义和工程后果……',
    },
  ],
  'step-13': [
    {
      key: 'rewrite_why',
      label: '为什么这里不能直接沿原普通根轨迹处理',
      prompt: '请写出一句说明对象为什么先被改写。',
      inputKind: 'text',
      placeholder: '说明 a 进入位置改变了对象与特征方程……',
    },
    {
      key: 'locus_type',
      label: '本题应按哪一种根轨迹理解',
      prompt: '本题应按 180° 还是 0° 根轨迹理解？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '按 180° 根轨迹理解，因为整理后是 1+aA(s)/B(s)=0' },
        { value: 'B', label: '按 0° 根轨迹理解，因为 a 出现在分子位置' },
        { value: 'C', label: '两者都不适用，因为广义根轨迹不再使用原条件' },
      ],
    },
  ],
};

export const ACTIVITY_CARD_FIELDS: Record<string, readonly ActivityCardField[]> = {
  'step-06': [
    {
      key: 'record_sentence',
      label: '参考工作点 B 的读图判断',
      prompt: '请写出一句完整的 B 点工程判断。',
      inputKind: 'text',
      placeholder: '至少包含关键节点、位置与后果……',
    },
    {
      key: 'compare_sentence',
      label: '版本 C 为什么还不能直接拿来做参考',
      prompt: '请写出一句包含位置与后果的 C 点判断。',
      inputKind: 'text',
      placeholder: '说明它位于哪一侧、对应什么风险……',
    },
  ],
  'step-07': [
    {
      key: 'stable_window',
      label: '哪个判断只说明“还稳定”',
      prompt: '以下哪一句更接近“稳定窗口”的语言？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '还没有穿过虚轴边界，因此系统尚处于稳定窗口内' },
        { value: 'B', label: '动态速度和代价已经取得理想平衡' },
        { value: 'C', label: '只要还稳定，就一定值得继续推进' },
      ],
    },
    {
      key: 'acceptable_window',
      label: '哪个判断才属于“可接受窗口”',
      prompt: '以下哪一句更接近“可接受窗口”的语言？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '只要极点还在左半平面就够了' },
        { value: 'B', label: '除了稳定，还要同时兼顾速度、振荡与工程代价' },
        { value: 'C', label: '只要频域图好看，就自动可接受' },
      ],
    },
  ],
  'step-10': [
    {
      key: 'reference_point_reason',
      label: '版本 B 为什么更像参考工作点',
      prompt: '从时域角度说明 B 为什么更像参考工作点。',
      inputKind: 'text',
      placeholder: '结合快慢、振荡和拖尾说明……',
    },
    {
      key: 'approximation_limit',
      label: '为什么这张阶跃对照还不能代替后续频域与持续跟踪验证',
      prompt: '为什么这张阶跃对照还不能代替后续频域与持续跟踪验证？',
      inputKind: 'text',
      placeholder: '说明为什么当前时域证据仍需要后续验证链补证……',
    },
  ],
  'step-11': [
    {
      key: 'benefit_frequency',
      label: '版本 C 的频域收益',
      prompt: '请写出一句只谈版本 C 频域收益的判断。',
      inputKind: 'text',
      placeholder: '围绕带宽提升或跟踪能力增强作答……',
    },
    {
      key: 'cost_frequency',
      label: '版本 C 的频域代价',
      prompt: '请写出一句只谈版本 C 频域代价的判断。',
      inputKind: 'text',
      placeholder: '围绕低裕量或高共振峰作答……',
    },
  ],
  'step-12': [
    {
      key: 'track_tradeoff',
      label: '连续跟踪中的收益-代价句',
      prompt: '请补写一句连续跟踪中的收益-代价判断。',
      inputKind: 'text',
      placeholder: '把连续跟踪收益和风险代价写在一句话里……',
    },
    {
      key: 'track_window',
      label: '版本 C 在窗口中的位置',
      prompt: '版本 C 更接近哪一种窗口位置？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '稳定窗口内的取舍型参数' },
        { value: 'B', label: '可接受窗口中心' },
        { value: 'C', label: '已经失稳' },
      ],
    },
  ],
  'step-14': [
    {
      key: 'window_recommendation',
      label: 'a 的窗口建议',
      prompt: '请写出对 a 的比较基线、实践窗口与边界提醒。',
      inputKind: 'text',
      placeholder: '说明 a=0、0<a≲0.5、a≳1 各自的窗口语言……',
    },
    {
      key: 'boundary_warning',
      label: '为什么不能把 a 压成“越大越好”',
      prompt: '请写出一句边界提醒，说明为什么 a 不能压成“越大越好”。',
      inputKind: 'text',
      placeholder: '说明主导极点、速度与振荡之间的权衡……',
    },
  ],
};

export const BINARY_CHOICE_OPTIONS = [
  { value: 'A', label: 'a 只是再调一次 K，法则和对象都没有变' },
  { value: 'B', label: 'a 改写了对象与特征方程，所以不能当成再调一次 K' },
] as const;

export const POST_QUIZ_QUESTIONS = [
  {
    key: 'q1',
    prompt: '分离点、虚轴边界与参考工作点 B 各回答什么？',
    options: [
      { value: 'A', label: '分离点给稳定上界，虚轴边界给工作点命名，B 只表示换算示例' },
      { value: 'B', label: '分离点区分主导形态，虚轴边界给稳定窗口上界，B 标记均衡参考工作点' },
      { value: 'C', label: '三者都只表示图上的位置，无工程含义' },
    ],
    answer: 'B',
    explanation: '三者对应的是不同层次的主图判断，而不是三个并列名词。',
  },
  {
    key: 'q2',
    prompt: '为什么“还稳定”不足以构成完整工程判断？',
    options: [
      { value: 'A', label: '因为稳定已经足够说明速度、振荡和裕量都合格' },
      { value: 'B', label: '因为还稳定只是一条底线，还要继续判断速度、振荡、裕量和代价是否可接受' },
      { value: 'C', label: '因为只要在稳定窗口内，就必然位于可接受窗口中心' },
    ],
    answer: 'B',
    explanation: '窗口判断必须把“能不能工作”和“值不值得采用”分开。',
  },
  {
    key: 'q3',
    prompt: '写出 k=0.0104 对应的 K。',
    answer: '0.6064',
    explanation: 'K = 0.0104 / 0.01715 ≈ 0.6064。',
  },
  {
    key: 'q4',
    prompt: '三域互证怎样支撑或限制 B/C 的判断？',
    options: [
      { value: 'A', label: '三域互证只是重复表达，不会改变对 B/C 的判断' },
      { value: 'B', label: '三域互证分别补充主图判断的时域支撑、频域支撑和代价边界，因此能支撑或限制对 B/C 的最终判断' },
      { value: 'C', label: '三域互证只在失稳时才有价值' },
    ],
    answer: 'B',
    explanation: '主图给位置，时域和频域给对象化后果与边界。',
  },
  {
    key: 'q5',
    prompt: '为什么 a 不能按普通增益根轨迹直接理解？',
    options: [
      { value: 'A', label: '因为 a 只是另一种写法的 K' },
      { value: 'B', label: '因为 a 会改变参数进入方式和对象结构，所以必须先改写问题再继续用根轨迹条件' },
      { value: 'C', label: '因为广义根轨迹完全不再使用原来的法则' },
    ],
    answer: 'B',
    explanation: '法则仍然可用，但对象先被改写。',
  },
] as const;
