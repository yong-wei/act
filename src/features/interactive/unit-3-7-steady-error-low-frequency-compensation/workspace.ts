export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: string;
}

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ActivityCardField {
  key: string;
  label: string;
  prompt: string;
  inputKind: 'text' | 'single_choice' | 'match';
  placeholder?: string;
  options?: readonly ChoiceOption[];
}

export const PRETEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '显式扰动进入对象输入端时，能否直接把它当成另一种输入型别来套误差系数表？',
    options: [
      { value: 'A', label: '能，只要输入是多项式就能直接套表' },
      { value: 'B', label: '不能，先分扰动通道再写总误差式' },
      { value: 'C', label: '能，只要系统稳定就可以' },
    ],
    answer: 'B',
    explanation: '扰动不是另一种输入型别，而是另一条进入闭环的信号通道。',
  },
  {
    key: 'q2',
    prompt: '一个 I 型系统如果只把增益继续调大，斜坡稳态误差会怎样？',
    options: [
      { value: 'A', label: '一定结构性变成 0' },
      { value: 'B', label: '只会继续压小，型别不变就不能结构性归零' },
      { value: 'C', label: '一定先变大再变小' },
    ],
    answer: 'B',
    explanation: '增益变大只能压小有限误差；要改变误差阶次，必须看型别是否变化。',
  },
  {
    key: 'q3',
    prompt: '关于 PI 与滞后校正，下列说法最准确的是：',
    options: [
      { value: 'A', label: '滞后就是更弱一点的积分' },
      { value: 'B', label: 'PI 改型别，滞后通常不改型别而是抬低频增益' },
      { value: 'C', label: '两者只在实现电路上不同，分析结论完全一样' },
    ],
    answer: 'B',
    explanation: 'PI 与滞后都站在低频补偿线上，但结构抓手与代价分布不同。',
  },
] as const;

export const POSTTEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '遇到给定与扰动共同作用时，第一步应该优先选哪条路径？',
    options: [
      { value: 'A', label: '先直接套型别与误差系数表' },
      { value: 'B', label: '先分通道，写总误差式，再做终值极限' },
      { value: 'C', label: '先比较 PI 与滞后哪个更好' },
    ],
    answer: 'B',
    explanation: '双输入问题优先走直接求路径，不能跳过总误差列式。',
  },
  {
    key: 'q2',
    prompt: '下列哪类情形最适合优先用型别和静态误差系数快速判断？',
    options: [
      { value: 'A', label: '标准负反馈、只问典型给定输入稳态误差' },
      { value: 'B', label: '显式给定和扰动共同存在' },
      { value: 'C', label: '任何出现扰动的闭环题目' },
    ],
    answer: 'A',
    explanation: '快判适用于标准给定输入场景；显式扰动和双输入问题优先直接求。',
  },
  {
    key: 'q3',
    prompt: '如果目标是把原来有限的斜坡误差结构性变成 0，第一判断应是什么？',
    options: [
      { value: 'A', label: '继续把 K 调大' },
      { value: 'B', label: '先看是否必须引入积分、提高型别' },
      { value: 'C', label: '先看 Nyquist 判据' },
    ],
    answer: 'B',
    explanation: '要改变误差阶次，核心不在继续调增益，而在是否改变型别。',
  },
  {
    key: 'q4',
    prompt: '在频域比较里，哪项最符合“动态速度优先”的方案特征？',
    options: [
      { value: 'A', label: '斜坡误差结构性归零、截止频率更低' },
      { value: 'B', label: '截止频率更高、相位裕度更高，但仍保留有限斜坡误差' },
      { value: 'C', label: '既不改型别，也不改变带宽和裕量' },
    ],
    answer: 'B',
    explanation: 'PD 方案代表动态速度优先：更高带宽、更高相位裕度，但低频误差不如 PI。',
  },
] as const;

export const HOTSPOT_FIELDS = [
  { key: 'reference_entry', label: '给定入口' },
  { key: 'disturbance_entry', label: '扰动入口' },
  { key: 'total_output', label: '总输出' },
  { key: 'total_error', label: '总误差' },
] as const;

export const WORKED_EXAMPLE_FIELDS: Record<string, readonly ActivityCardField[]> = {
  'step-05': [
    {
      key: 'stability',
      label: '卡片 1',
      prompt: '写出终值定理三步法的第一步，并说明为什么不能跳过。',
      inputKind: 'text',
      placeholder: '先判稳定，因为……',
    },
    {
      key: 'error_expression',
      label: '卡片 2',
      prompt: '本题为什么必须先写误差传函，再谈终值极限？',
      inputKind: 'text',
      placeholder: '误差传函决定……',
    },
    {
      key: 'result',
      label: '卡片 3',
      prompt: '例题 1 的最终稳态误差结果是什么？',
      inputKind: 'text',
      placeholder: '写出 1/K 并说明来源',
    },
  ],
  'step-07': [
    {
      key: 'reference_term',
      label: '卡片 1',
      prompt: '写出给定通道在总误差式中的贡献。',
      inputKind: 'text',
      placeholder: 'E_r(s)=…',
    },
    {
      key: 'disturbance_term',
      label: '卡片 2',
      prompt: '写出扰动通道在总误差式中的贡献。',
      inputKind: 'text',
      placeholder: 'E_d(s)=…',
    },
    {
      key: 'result',
      label: '卡片 3',
      prompt: '为什么本题最终结果是 e_ss = 0.4？',
      inputKind: 'text',
      placeholder: '因为给定项与扰动项……',
    },
  ],
  'step-10': [
    {
      key: 'gain_limit',
      label: '卡片 1',
      prompt: '为什么纯增益不能把斜坡误差变为 0？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '因为纯增益会自动降低型别' },
        { value: 'B', label: '因为纯增益不改变型别，只能压小有限误差' },
        { value: 'C', label: '因为纯增益会让系统一定失稳' },
      ],
    },
    {
      key: 'feasible_region',
      label: '卡片 2',
      prompt: '时域指标换成可行域后，至少要同时写出哪两类边界？',
      inputKind: 'text',
      placeholder: '阻尼比边界与……',
    },
    {
      key: 'pi_role',
      label: '卡片 3',
      prompt: '在这个例题里，PI 的首要作用是什么？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '提高型别，使斜坡误差结构性归零' },
        { value: 'B', label: '只提高纯增益，不改结构' },
        { value: 'C', label: '把滞后网络换成超前网络' },
      ],
    },
  ],
  'step-11': [
    {
      key: 'gain_conflict',
      label: '卡片 1',
      prompt: '为什么只靠纯增益把 Kv 提高到 10，会先跌出阻尼边界？',
      inputKind: 'text',
      placeholder: '因为 K 过大时……',
    },
    {
      key: 'lag_position',
      label: '卡片 2',
      prompt: '把“零点在左 / 极点在右”的相对位置与作用匹配。',
      inputKind: 'match',
      options: [
        { value: 'left-zero', label: '零点在左：尽量少动中频骨架' },
        { value: 'right-pole', label: '极点在右：把低频增益单独抬高' },
      ],
    },
    {
      key: 'kv_result',
      label: '卡片 3',
      prompt: '本题滞后校正后的 Kv 结果应写成什么？',
      inputKind: 'text',
      placeholder: 'Kv = 10',
    },
  ],
  'step-13': [
    {
      key: 'gain_tradeoff',
      label: '卡片 1',
      prompt: '为什么频域 PI 设计要先说明纯增益不能两头兼顾？',
      inputKind: 'text',
      placeholder: '因为 Kv 与相位裕度……',
    },
    {
      key: 'design_sequence',
      label: '卡片 2',
      prompt: '写出频域 PI 设计链的顺序关键词。',
      inputKind: 'text',
      placeholder: '截止频率 -> 零点 -> 幅值条件 -> 回查',
    },
    {
      key: 'zero_rule',
      label: '卡片 3',
      prompt: 'PI 零点为什么要放在目标截止频率以下？',
      inputKind: 'text',
      placeholder: '为了减小截止频率附近的附加相位滞后……',
    },
  ],
  'step-14': [
    {
      key: 'pd_type',
      label: '卡片 1',
      prompt: '给定 PD 方案为什么仍然不是“低频精度优先”方案？',
      inputKind: 'text',
      placeholder: '因为它仍为 I 型……',
    },
    {
      key: 'pd_metrics',
      label: '卡片 2',
      prompt: '哪项指标最能体现这个方案更偏动态速度优先？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '更高截止频率与更高相位裕度' },
        { value: 'B', label: '更低截止频率与更低带宽' },
        { value: 'C', label: '更高型别与无限 Kv' },
      ],
    },
    {
      key: 'pd_reason',
      label: '卡片 3',
      prompt: '本页为什么强调“方案读取与核验”，而不是完整整定？',
      inputKind: 'text',
      placeholder: '因为讲义已直接给出方案……',
    },
  ],
};

export const ACTIVITY_CARD_FIELDS: Record<string, readonly ActivityCardField[]> = {
  'step-06': [
    {
      key: 'fast_path_scope',
      label: '卡片 1',
      prompt: '哪类问题最适合优先用型别与静态误差系数快速判断？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '标准给定输入的单回路负反馈问题' },
        { value: 'B', label: '显式给定与扰动共同作用的问题' },
        { value: 'C', label: '任何带有输入函数的闭环问题' },
      ],
    },
    {
      key: 'table_boundary',
      label: '卡片 2',
      prompt: '为什么“扰动题不能直接套表”是本页边界？',
      inputKind: 'text',
      placeholder: '因为扰动要先分通道……',
    },
    {
      key: 'type_rule',
      label: '卡片 3',
      prompt: '如果目标是判断是否必须引入积分，第一步该看什么？',
      inputKind: 'text',
      placeholder: '先看型别……',
    },
  ],
  'step-09': [
    {
      key: 'pi_focus',
      label: '卡片 1',
      prompt: 'PI 的结构抓手最适合归到哪一项？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '提高型别' },
        { value: 'B', label: '提高相位补偿' },
        { value: 'C', label: '只在高频降噪' },
      ],
    },
    {
      key: 'lag_focus',
      label: '卡片 2',
      prompt: '滞后校正最核心的收益是什么？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '把斜坡误差结构性归零' },
        { value: 'B', label: '在型别不变时抬高低频增益' },
        { value: 'C', label: '主要提高相位裕度' },
      ],
    },
    {
      key: 'lag_warning',
      label: '卡片 3',
      prompt: '为什么不能把滞后直接理解成“弱积分”？',
      inputKind: 'text',
      placeholder: '因为它并不新增积分个数……',
    },
  ],
  'step-12': [
    {
      key: 'pi_scene',
      label: '卡片 1',
      prompt: '若目标是把斜坡误差结构性变成 0，应优先想到哪种方法？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: 'PI' },
        { value: 'B', label: '滞后' },
      ],
    },
    {
      key: 'lag_scene',
      label: '卡片 2',
      prompt: '若要求型别不变但 Kv 提高，应更偏向哪种方法？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: 'PI' },
        { value: 'B', label: '滞后' },
      ],
    },
    {
      key: 'time_compare',
      label: '卡片 3',
      prompt: '时域两法比较时，至少应并列写出哪三类信息？',
      inputKind: 'text',
      placeholder: '收益、代价、适用场景',
    },
  ],
  'step-15': [
    {
      key: 'accuracy_priority',
      label: '卡片 1',
      prompt: '若更强调低频精度优先，应更接近哪种方案？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: 'PI' },
        { value: 'B', label: 'PD' },
      ],
    },
    {
      key: 'speed_priority',
      label: '卡片 2',
      prompt: '若更强调动态速度优先，应更接近哪种方案？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: 'PI' },
        { value: 'B', label: 'PD' },
      ],
    },
    {
      key: 'freq_compare',
      label: '卡片 3',
      prompt: '比较 PI 与 PD 时，为什么不能只看单一指标？',
      inputKind: 'text',
      placeholder: '需要把低频精度、截止频率和相位裕度一起看……',
    },
  ],
};

export const ASSESSMENT_CARD_FIELDS = POSTTEST_QUESTIONS;
