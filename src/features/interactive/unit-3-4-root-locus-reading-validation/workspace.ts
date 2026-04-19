export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: 'input' | 'select' | 'button';
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

export const READING_SEQUENCE_OPTIONS = [
  { value: 'skeleton', label: '先看骨架' },
  { value: 'keynodes', label: '再找关键节点' },
  { value: 'windows', label: '再判稳定 / 可接受窗口' },
  { value: 'consequence', label: '最后才谈工程后果' },
] as const;

export const HOTSPOT_LABEL_FIELDS = [
  { key: 'breakaway', label: '分离点' },
  { key: 'imaginary_boundary', label: '虚轴边界' },
  { key: 'reference_B', label: '参考工作点 B' },
] as const;

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
  'step-14': [
    {
      key: 'rewrite_chain',
      label: '改写链：从局部反馈结构走到等效根轨迹',
      prompt: '请写出从局部反馈结构走到等效根轨迹对象的关键改写链。',
      inputKind: 'text',
      placeholder: 'G1(s) -> 特征方程 -> B(s)+aA(s)=0 -> Ge(s)=A(s)/B(s)',
    },
    {
      key: 'rule_statement',
      label: '为什么这里不是“换了一条根轨迹法则”',
      prompt: '为什么进入广义根轨迹后，真正变化的是对象而不是根轨迹法则本身？',
      inputKind: 'text',
      placeholder: '说明“法则不变、对象先改写”的含义……',
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
      label: '为什么仍要保留“近似可信但有限”',
      prompt: '为什么这里不能把主导极点近似直接当成“完全等价”？',
      inputKind: 'text',
      placeholder: '说明近似成立范围与残余误差……',
    },
  ],
  'step-11': [
    {
      key: 'low_mid_frequency',
      label: '哪里可以说“低中频近似成立”',
      prompt: '请写出一句说明低中频近似成立的结论。',
      inputKind: 'text',
      placeholder: '结合代表频率点说明……',
    },
    {
      key: 'high_frequency',
      label: '为什么高频差异仍要单列记录',
      prompt: '请写出一句说明高频差异不能被省略的结论。',
      inputKind: 'text',
      placeholder: '说明带宽外风险或相位变化……',
    },
  ],
  'step-12': [
    {
      key: 'benefit_sentence',
      label: '版本 C 的收益',
      prompt: '请写出一句只谈版本 C 收益的证据化判断。',
      inputKind: 'text',
      placeholder: '结合 Bode 或航迹证据说明……',
    },
    {
      key: 'cost_sentence',
      label: '版本 C 的代价',
      prompt: '请写出一句只谈版本 C 代价的证据化判断。',
      inputKind: 'text',
      placeholder: '说明高带宽、低裕量或航迹风险……',
    },
  ],
  'step-15': [
    {
      key: 'window_recommendation',
      label: 'a 的窗口建议',
      prompt: '请写出对 a 的实践窗口建议。',
      inputKind: 'text',
      placeholder: '说明比较基线、推荐区间和理由……',
    },
    {
      key: 'boundary_warning',
      label: '为什么不能把 a 压成“越大越好”',
      prompt: '请写出一句边界提醒，说明为什么 a 不能压成“越大越好”。',
      inputKind: 'text',
      placeholder: '说明主导极点、代价与边界……',
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
    prompt: '在 3-4 的完整判断链里，第一步固定动作应是什么？',
    options: [
      { value: 'A', label: '先猜哪个版本最优' },
      { value: 'B', label: '先按骨架 -> 关键节点 -> 窗口 -> 后果的顺序读图' },
      { value: 'C', label: '先看频域，再回头补主图' },
    ],
    answer: 'B',
    explanation: '读图顺序错了，后续窗口和三域结论都会串层。',
  },
  {
    key: 'q2',
    prompt: '若图上读到的是根轨迹增益 k，下一步最关键的动作是什么？',
    options: [
      { value: 'A', label: '直接把 k 当成工程参数 K' },
      { value: 'B', label: '先完成 k 到 K 的换算，再进入工程判断' },
      { value: 'C', label: '先只看时域，不需要换算' },
    ],
    answer: 'B',
    explanation: '图上参数先是根轨迹增益，必须先翻译回工程参数语言。',
  },
  {
    key: 'q3',
    prompt: '解释题：为什么局部反馈系数 a 不是“再调一次 K”？',
    answer: '',
    explanation: '理想回答应指出对象/特征方程先被改写，再说明法则不变但对象变化。',
  },
] as const;
