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
      key: 'formula_path',
      label: '1. 终值定理直接求的首要动作是什么？',
      prompt: '终值定理直接求的首要动作是什么？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '先写误差通道，再判断能否做终值极限' },
        { value: 'B', label: '先直接查型别表，再补误差式' },
        { value: 'C', label: '先把所有输入都改成单位阶跃' },
      ],
    },
    {
      key: 'result_reason',
      label: '2. 为什么例题 1 最后只剩 1/K？',
      prompt: '为什么例题 1 最后只剩 `1/K` 这一项？',
      inputKind: 'text',
      placeholder: '说明是哪个输入分量决定了最终误差……',
    },
  ],
  'step-07': [
    {
      key: 'first_move',
      label: '1. 例题 2 第一动作应是什么？',
      prompt: '例题 2 第一动作应是什么？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '先把给定项与扰动项分通道，再写总误差式' },
        { value: 'B', label: '直接把两个输入一起套进型别表' },
        { value: 'C', label: '先判它更像 PI 还是滞后问题' },
      ],
    },
    {
      key: 'formula_reason',
      label: '2. 为什么本题不能直接套型别表？',
      prompt: '为什么本题不能直接用型别与误差系数表得到 `e_ss = 0.4`？',
      inputKind: 'text',
      placeholder: '从双通道和总误差式说明……',
    },
  ],
  'step-10': [
    {
      key: 'gain_limit',
      label: '1. 为什么纯增益不能把斜坡误差变为 0？',
      prompt: '为什么纯增益不能把斜坡误差变为 0？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '因为纯增益会自动降低型别' },
        { value: 'B', label: '因为纯增益不改变型别，只能压小有限误差' },
        { value: 'C', label: '因为纯增益会让系统一定失稳' },
      ],
    },
    {
      key: 'pi_role',
      label: '2. 在这个例题里，PI 的首要作用是什么？',
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
      label: '1. 为什么只靠纯增益会先跌出阻尼边界？',
      prompt: '为什么只靠纯增益把 Kv 提高到 10，会先跌出阻尼边界？',
      inputKind: 'text',
      placeholder: '因为 K 过大时……',
    },
    {
      key: 'lag_role',
      label: '2. 滞后校正最关键的结构作用是什么？',
      prompt: '滞后校正最关键的结构作用是什么？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '提高型别，把有限斜坡误差直接变成 0' },
        { value: 'B', label: '在型别不变时抬高低频增益，并尽量少动中频骨架' },
        { value: 'C', label: '主要提高高频相位超前' },
      ],
    },
  ],
  'step-13': [
    {
      key: 'gain_tradeoff',
      label: '1. 为什么频域 PI 设计要先说明纯增益不能两头兼顾？',
      prompt: '为什么频域 PI 设计要先说明纯增益不能两头兼顾？',
      inputKind: 'text',
      placeholder: '因为 Kv 与相位裕度……',
    },
    {
      key: 'design_sequence',
      label: '2. 频域 PI 设计链的顺序关键词是什么？',
      prompt: '写出频域 PI 设计链的顺序关键词。',
      inputKind: 'text',
      placeholder: '截止频率 -> 零点 -> 幅值条件 -> 回查',
    },
  ],
  'step-14': [
    {
      key: 'pd_type',
      label: '1. 给定 PD 方案为什么不是低频精度优先？',
      prompt: '给定 PD 方案为什么仍然不是“低频精度优先”方案？',
      inputKind: 'text',
      placeholder: '因为它仍为 I 型……',
    },
    {
      key: 'pd_metrics',
      label: '2. 哪项指标最能体现动态速度优先？',
      prompt: '哪项指标最能体现这个方案更偏动态速度优先？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '更高截止频率与更高相位裕度' },
        { value: 'B', label: '更低截止频率与更低带宽' },
        { value: 'C', label: '更高型别与无限 Kv' },
      ],
    },
  ],
};

export const ACTIVITY_CARD_FIELDS: Record<string, readonly ActivityCardField[]> = {
  'step-04': [
    {
      key: 'reference_output_tf',
      label: '1. 下列哪一个是给定到输出传函？',
      prompt: '下列哪一个是“给定到输出传函”？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '$\\dfrac{C(s)}{R(s)}=\\dfrac{G_c(s)G_p(s)}{1+G_c(s)G_p(s)H(s)}$' },
        { value: 'B', label: '$\\dfrac{C(s)}{D(s)}=\\dfrac{G_p(s)}{1+G_c(s)G_p(s)H(s)}$' },
        { value: 'C', label: '$\\dfrac{E_d(s)}{D(s)}=-\\dfrac{G_p(s)H(s)}{1+G_c(s)G_p(s)H(s)}$' },
      ],
    },
    {
      key: 'disturbance_channel_judgement',
      label: '2. 显式扰动应先走哪条分析路径？',
      prompt: '显式扰动从哪一条信号判断链进入稳态误差分析？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '先看给定输入型别，再直接套标准误差表' },
        { value: 'B', label: '先写扰动到输出或误差的通道，再并入总误差式' },
        { value: 'C', label: '只看闭环分母，不必区分分子与入口' },
      ],
    },
  ],
  'step-06': [
    {
      key: 'fast_path_scope',
      label: '1. 哪类问题最适合优先用快判？',
      prompt: '哪类问题最适合优先用型别与静态误差系数快速判断？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '标准给定输入的单回路负反馈问题' },
        { value: 'B', label: '显式给定与扰动共同作用的问题' },
        { value: 'C', label: '任何带有输入函数的闭环问题' },
      ],
    },
    {
      key: 'type_rule',
      label: '2. 判断是否必须引入积分时先看什么？',
      prompt: '如果目标是判断是否必须引入积分，第一步该看什么？',
      inputKind: 'text',
      placeholder: '先看型别……',
    },
  ],
  'step-09': [
    {
      key: 'pi_focus',
      label: '1. PI 的结构抓手最适合归到哪一项？',
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
      label: '2. 滞后校正最核心的收益是什么？',
      prompt: '滞后校正最核心的收益是什么？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: '把斜坡误差结构性归零' },
        { value: 'B', label: '在型别不变时抬高低频增益' },
        { value: 'C', label: '主要提高相位裕度' },
      ],
    },
  ],
  'step-12': [
    {
      key: 'pi_scene',
      label: '1. 斜坡误差结构性变成 0 时应先想到哪种方法？',
      prompt: '若目标是把斜坡误差结构性变成 0，应优先想到哪种方法？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: 'PI' },
        { value: 'B', label: '滞后' },
      ],
    },
    {
      key: 'lag_scene',
      label: '2. 型别不变但 Kv 提高时更偏向哪种方法？',
      prompt: '若要求型别不变但 Kv 提高，应更偏向哪种方法？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: 'PI' },
        { value: 'B', label: '滞后' },
      ],
    },
  ],
  'step-15': [
    {
      key: 'accuracy_priority',
      label: '1. 低频精度优先时更接近哪种方案？',
      prompt: '若更强调低频精度优先，应更接近哪种方案？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: 'PI' },
        { value: 'B', label: 'PD' },
      ],
    },
    {
      key: 'speed_priority',
      label: '2. 动态速度优先时更接近哪种方案？',
      prompt: '若更强调动态速度优先，应更接近哪种方案？',
      inputKind: 'single_choice',
      options: [
        { value: 'A', label: 'PI' },
        { value: 'B', label: 'PD' },
      ],
    },
  ],
};

export const ASSESSMENT_CARD_FIELDS = POSTTEST_QUESTIONS;
