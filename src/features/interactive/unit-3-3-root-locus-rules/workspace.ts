export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: 'input' | 'select' | 'button';
}

export interface RuleHighlightOption {
  value: string;
  label: string;
  figureCue: string;
  detail: string;
  category: 'skeleton' | 'keypoint';
  relatedRules: string[];
}

export const RULE_HIGHLIGHT_OPTIONS: RuleHighlightOption[] = [
  {
    value: 'start-end',
    label: '起点与终点',
    figureCue: '看开环极点出发、看开环零点或无穷远收束',
    detail: '根轨迹从开环极点出发，终止于开环零点或沿渐近线走向无穷远。',
    category: 'skeleton',
    relatedRules: ['起点终点', '分支数 = 开环极点数'],
  },
  {
    value: 'real-axis',
    label: '实轴区段',
    figureCue: '用奇偶判段判断哪些实轴段真正属于轨迹',
    detail: '实轴上某点右侧若有奇数个实极点和实零点，则该段属于根轨迹。',
    category: 'skeleton',
    relatedRules: ['实轴区段法则', '奇偶判段'],
  },
  {
    value: 'asymptote',
    label: '渐近线中心与夹角',
    figureCue: '分支走向无穷远时整体朝哪几个方向展开',
    detail: '当极点数多于零点数时，额外分支沿渐近线展开，中心与夹角先定骨架。',
    category: 'skeleton',
    relatedRules: ['渐近线中心', '渐近线夹角'],
  },
  {
    value: 'breakaway',
    label: '分离点/汇合点',
    figureCue: '分支离开实轴或重新并回实轴的位置',
    detail: '这是关键节点层，不属于第一轮骨架法则。',
    category: 'keypoint',
    relatedRules: ['关键节点', '后续精化'],
  },
  {
    value: 'imaginary-crossing',
    label: '虚轴交点',
    figureCue: '轨迹何时真正触碰稳定边界',
    detail: '这同样属于关键节点层，负责解释越轴与稳定边界。',
    category: 'keypoint',
    relatedRules: ['稳定边界', '关键节点'],
  },
] as const;

export interface KeypointMatchGroup {
  key: string;
  prompt: string;
  answer: string;
}

export const KEYPOINT_MATCH_OPTIONS = [
  { value: 'breakaway', label: '分离点 / 汇合点' },
  { value: 'imaginary-crossing', label: '虚轴交点' },
  { value: 'departure-angle', label: '起始角 / 终止角' },
] as const;

export const KEYPOINT_MATCH_GROUPS: KeypointMatchGroup[] = [
  {
    key: 'leave-real-axis',
    prompt: '回答“分支何时离开实轴、何时重新并回实轴”',
    answer: 'breakaway',
  },
  {
    key: 'touch-stability-boundary',
    prompt: '回答“根轨迹何时真正碰到稳定边界”',
    answer: 'imaginary-crossing',
  },
  {
    key: 'local-tangent-direction',
    prompt: '回答“复极点或复零点附近的局部切线方向”',
    answer: 'departure-angle',
  },
] as const;

export interface WorkedExampleSection {
  key: string;
  title: string;
  prompt: string;
  placeholder: string;
  reference: string;
  errorBucket: string;
}

export const WORKED_EXAMPLE_SECTIONS: WorkedExampleSection[] = [
  {
    key: 'skeleton',
    title: '第一步：先骨架',
    prompt: '写出起点、终点和渐近线大势。',
    placeholder: '例如：3 条分支从 0、-1、-2 出发；无有限零点；两条渐近线中心在 -1，夹角为 ±90°。',
    reference: '3 条分支从 0、-1、-2 出发；无有限零点；两条渐近线中心在 -1，夹角为 ±90°。',
    errorBucket: 'skeleton_setup',
  },
  {
    key: 'real-axis-and-keypoint',
    title: '第二步：补实轴区段与关键节点',
    prompt: '补上真正属于根轨迹的实轴区段，以及 K=6 对应的关键节点意义。',
    placeholder: '例如：实轴区段在 (-∞,-2) 与 (-1,0)；K=6 时轨迹穿越虚轴，是稳定边界点。',
    reference: '实轴区段在 (-∞,-2) 与 (-1,0)；K=6 时轨迹穿越虚轴，是稳定边界点。',
    errorBucket: 'keypoint_or_real_axis',
  },
  {
    key: 'stability-range',
    title: '第三步：回到稳定范围',
    prompt: '把图上的迁移结论翻译回稳定范围。',
    placeholder: '例如：闭环稳定范围为 0<K<6。',
    reference: '0<K<6',
    errorBucket: 'stability_translation',
  },
] as const;

export const WORKED_EXAMPLE_REFERENCE = {
  plant: 'G(s)H(s)=K/[s(s+1)(s+2)]',
  method: ['先骨架', '再关键点', '最后稳定范围'],
  stabilityRange: '0<K<6',
} as const;

export interface FormulaOrderingItem {
  id: string;
  label: string;
  explanation: string;
}

export const FORMULA_ORDERING_SEQUENCE: FormulaOrderingItem[] = [
  {
    id: 'general-form',
    label: '从一般参数特征方程出发：B(s)+aA(s)=0',
    explanation: '先承认参数不一定是增益 K，而可以是一般参数 a。',
  },
  {
    id: 'normalized-form',
    label: '把式子改写成：1+aA(s)/B(s)=0',
    explanation: '这一步把问题送回“1+开环=0”的普通根轨迹入口。',
  },
  {
    id: 'equivalent-open-loop',
    label: '认出等效开环：G_eq(s)=aA(s)/B(s)',
    explanation: '广义根轨迹没有新法则，只是换成新的等效开环。',
  },
  {
    id: 'reuse-rules',
    label: '复用普通根轨迹法则读取迁移规律',
    explanation: '之后仍然回到相角/幅值条件和完整法则。',
  },
] as const;

export interface TabSwitchOption {
  value: string;
  label: string;
  heading: string;
  bullets: string[];
}

export const TAB_SWITCH_OPTIONS: TabSwitchOption[] = [
  {
    value: 'time-constant',
    label: '时间常数例子',
    heading: '以时间常数 T_a 为参数',
    bullets: [
      '先把时间常数参数改写进特征方程，再转成等效开环。',
      '典型等效开环可整理为 s(s+1)/(s+2) 这一类对象。',
      '关注点不是“新算例”，而是“非增益参数也能转回普通根轨迹”。',
    ],
  },
  {
    value: 'zero-vs-oneeighty',
    label: '0° vs 180°',
    heading: '0° 根轨迹与 180° 根轨迹',
    bullets: [
      '两者研究对象相同，都是参数变化下的闭环根迁移。',
      '差异来自相角条件方向不同，因此图形展开方向会变。',
      '它们都属于广义根轨迹视角，而不是两套互不相干的工具。',
    ],
  },
] as const;

export interface DynamicMappingRow {
  key: string;
  cue: string;
  answer: string;
}

export const DYNAMIC_MAPPING_OPTIONS = [
  { value: 'faster', label: '更快' },
  { value: 'more-oscillatory', label: '更振荡' },
  { value: 'closer-to-boundary', label: '更靠近边界' },
] as const;

export const DYNAMIC_MAPPING_ROWS: DynamicMappingRow[] = [
  {
    key: 'move-left',
    cue: '主导极点整体向左远离虚轴',
    answer: 'faster',
  },
  {
    key: 'move-up-and-down',
    cue: '共轭极点离开实轴，虚部增大',
    answer: 'more-oscillatory',
  },
  {
    key: 'approach-imaginary-axis',
    cue: '主导分支贴近虚轴或穿越虚轴',
    answer: 'closer-to-boundary',
  },
] as const;
