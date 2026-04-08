export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: string;
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
    prompt: '关于 PI 与滞后低频补偿的代价，下列哪项判断最准确？',
    options: [
      { value: 'A', label: '它们都只带来收益，不会把代价推向别的频段' },
      { value: 'B', label: '低频收益常常伴随截止频率、相位裕度或时域速度方面的代价' },
      { value: 'C', label: '代价只会出现在高频噪声，不会影响中频附近' },
    ],
    answer: 'B',
    explanation: '3-7 的核心就是把低频收益和中频/动态代价同时看见，并把这条语言接到 3-8。',
  },
] as const;

export const HOTSPOT_FIELDS = [
  { key: 'reference_entry', label: '给定入口' },
  { key: 'disturbance_entry', label: '扰动入口' },
  { key: 'total_output', label: '总输出' },
  { key: 'total_error', label: '总误差' },
] as const;

export const WORKED_EXAMPLE_FIELDS = {
  'step-05': [
    { key: 'stability', label: '先判稳定' },
    { key: 'error_expression', label: '写误差传函' },
    { key: 'limit_chain', label: '写终值极限链' },
    { key: 'result', label: '稳态误差结果' },
  ],
  'step-07': [
    { key: 'reference_term', label: '给定项列式' },
    { key: 'disturbance_term', label: '扰动项列式' },
    { key: 'total_error', label: '总误差式' },
    { key: 'result', label: '稳态误差结果与原因' },
  ],
} as const;

export const TRIPLE_MATCH_FIELDS = {
  'step-06': [
    { key: 'input_type', label: '输入类型' },
    { key: 'coefficient', label: '可用误差系数' },
    { key: 'error_form', label: '误差形式' },
  ],
  'step-11': [
    { key: 'accuracy_focus', label: '更准 / 更快 / 裕量代价' },
    { key: 'method', label: '对应方法' },
    { key: 'band', label: '对应频段' },
  ],
} as const;

export const CARD_SORT_ITEMS = [
  { key: 'raise_type', label: '提高型别' },
  { key: 'raise_kv', label: '抬高低频增益' },
  { key: 'phase_lag', label: '相位滞后增加' },
  { key: 'lower_wc', label: '截止频率下降' },
] as const;

export const STRUCTURED_COMPARE_FIELDS = [
  { key: 'pi_structure', label: 'PI：结构抓手' },
  { key: 'pi_accuracy', label: 'PI：精度收益' },
  { key: 'pi_cost', label: 'PI：动态代价' },
  { key: 'lag_structure', label: '滞后：结构抓手' },
  { key: 'lag_accuracy', label: '滞后：精度收益' },
  { key: 'lag_cost', label: '滞后：动态代价' },
] as const;
