export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: 'input' | 'select' | 'button' | 'drag';
}

export type Unit35RootStepId = 'step-04' | 'step-05';
export type Unit35RootPointKind = 'pole' | 'zero';

export interface Unit35RootPointDefinition {
  id: string;
  kind: Unit35RootPointKind;
  position: number;
  draggable: boolean;
}

export interface Unit35RootModeDefinition {
  key: string;
  label: string;
  formula: string;
  points: Unit35RootPointDefinition[];
}

export interface Unit35RootWorkspaceDefinition {
  title: string;
  intro: string;
  range: { min: number; max: number };
  imagRange: { min: number; max: number };
  rootLocusMaxGain: number;
  rootLocusSamples: number;
  defaultGain: number;
  modes: Unit35RootModeDefinition[];
}

export const UNIT_3_5_ROOT_LOCUS_WORKSPACE_CONFIG: Record<Unit35RootStepId, Unit35RootWorkspaceDefinition> = {
  'step-04': {
    title: '二阶对象根轨迹工作区',
    intro: '公式区下方直接进入单根轨迹工作区。右侧只保留“基线”和“添加零点”两种模式；进入添加零点后，直接拖动零点标注即可比较不同位置的骨架重排。',
    range: { min: -4.5, max: 0.5 },
    imagRange: { min: -2.4, max: 2.4 },
    rootLocusMaxGain: 14,
    rootLocusSamples: 240,
    defaultGain: 1,
    modes: [
      {
        key: 'baseline',
        label: '基线',
        formula: 'L_0(s)=\\frac{K}{s(s+1)}',
        points: [
          { id: 'p0', kind: 'pole', position: 0, draggable: false },
          { id: 'p1', kind: 'pole', position: -1, draggable: false },
        ],
      },
      {
        key: 'add-zero',
        label: '添加零点',
        formula: 'L_z(s)=\\frac{K(s+z)}{s(s+1)},\\quad z>0',
        points: [
          { id: 'p0', kind: 'pole', position: 0, draggable: false },
          { id: 'p1', kind: 'pole', position: -1, draggable: false },
          { id: 'z2', kind: 'zero', position: -2, draggable: true },
        ],
      },
    ],
  },
  'step-05': {
    title: '三阶对象根轨迹工作区',
    intro: '延续同样的左右分栏组织。右侧模式切换只保留“基线”和“添加零点”；进入添加零点后，沿实轴拖动零点标注，观察主导分支如何重排。',
    range: { min: -4.8, max: 0.5 },
    imagRange: { min: -3.2, max: 3.2 },
    rootLocusMaxGain: 18,
    rootLocusSamples: 240,
    defaultGain: 1,
    modes: [
      {
        key: 'baseline',
        label: '基线',
        formula: 'L_3(s)=\\frac{K}{s(s+1)(s+4)}',
        points: [
          { id: 'p0', kind: 'pole', position: 0, draggable: false },
          { id: 'p1', kind: 'pole', position: -1, draggable: false },
          { id: 'p4', kind: 'pole', position: -4, draggable: false },
        ],
      },
      {
        key: 'add-zero',
        label: '添加零点',
        formula: 'L_z(s)=\\frac{K(s+z)}{s(s+1)(s+4)},\\quad z>0',
        points: [
          { id: 'p0', kind: 'pole', position: 0, draggable: false },
          { id: 'p1', kind: 'pole', position: -1, draggable: false },
          { id: 'p4', kind: 'pole', position: -4, draggable: false },
          { id: 'z04', kind: 'zero', position: -0.4, draggable: true },
        ],
      },
    ],
  },
};

export const PRETEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '如果系统仍在稳定窗口内，是否就意味着继续增大增益一定值得？',
    type: 'choice',
    options: [
      { value: 'yes', label: '是，只要还稳定就值得继续推' },
      { value: 'depends', label: '不一定，还要继续比较边界与代价' },
      { value: 'only-time-domain', label: '只要时域更快就值得' },
    ],
  },
  {
    key: 'q2',
    prompt: 'PD 和测速反馈都能减小振荡，它们是否只是名字不同？',
    type: 'choice',
    options: [
      { value: 'same', label: '是，结构上没有本质区别' },
      { value: 'different', label: '不是，测速反馈不显式增加前向零点' },
      { value: 'only-frequency', label: '频域相似，所以可以视作同一种结构' },
    ],
  },
  {
    key: 'q3',
    prompt: '一个零点让系统更快，是否就能推断“零点越靠右越好”？',
    type: 'choice',
    options: [
      { value: 'yes', label: '可以，越靠右越能提速' },
      { value: 'careful', label: '不能，右半平面零点会带来额外边界' },
      { value: 'only-root-locus', label: '只看根轨迹终点就能下结论' },
    ],
  },
  {
    key: 'intuition',
    prompt: '写一句你的直觉判断：今天你最担心哪类误判？',
    type: 'text',
  },
] as const;

export const POST_QUIZ_QUESTIONS = [
  {
    key: 'q1',
    prompt: '为什么“零点引入”不是“继续增大增益”的另一种表达？',
    type: 'choice',
    options: [
      { value: 'track-changes', label: '因为零点会改写根轨迹骨架，不只是沿原轨迹选点' },
      { value: 'same-as-gain', label: '因为两者只是写法不同，本质一样' },
      { value: 'time-domain-only', label: '因为只看时域就够了，不用看根轨迹' },
    ],
  },
  {
    key: 'q2',
    prompt: '为什么非最小相对象第一反应通常不是“继续把带宽往上推”？',
    type: 'choice',
    options: [
      { value: 'conservative-bandwidth', label: '因为右半平面零点会带来逆响应和额外相位滞后，应先保守带宽' },
      { value: 'push-harder', label: '因为带宽越高越能压住逆响应' },
      { value: 'ignore-phase', label: '因为非最小相只会影响时域，不影响频域' },
    ],
  },
  {
    key: 'summary_explanation',
    prompt: '写一句解释：你会把哪一个观察量先带进 3-6，并说明原因。',
    type: 'text',
  },
] as const;

export const BRANCH_REGION_OPTIONS = [
  { value: 'left-branch', label: '左侧主导分支被拉走' },
  { value: 'middle-branch', label: '中间分支被拉走' },
  { value: 'right-branch', label: '右侧主导分支被拉走' },
] as const;

export const REAL_AXIS_SEGMENT_OPTIONS = [
  { value: 'segment-a', label: '原来的核心实轴区段被截走' },
  { value: 'segment-b', label: '零点附近实轴区段被重排' },
  { value: 'segment-c', label: '原始实轴区段基本保持' },
] as const;

export const COMPARE_NOTE_KEYWORDS = [
  '零点位置',
  '主导分支',
  '终点分配',
  '重排',
  '左半平面',
  '风险边界',
] as const;

export const RISK_TAG_OPTIONS = [
  { value: 'optimistic', label: '我现在仍偏乐观，觉得右半平面零点也许只是“更快”' },
  { value: 'careful', label: '我怀疑它会把动态改善变成带条件判断' },
  { value: 'uncertain', label: '我还没法判断，需要后续证据' },
] as const;

export const DERIVATION_FIELDS = [
  { key: 'kd', label: 'PD 结构下的 Kd' },
  { key: 'kt', label: '测速反馈结构下的 Kt' },
  { key: 'derivation', label: '代入链与推导说明' },
  { key: 'check', label: '为什么这一步先看过程再看结果' },
] as const;

export const STRUCTURED_COMPARE_FIELDS = [
  { key: 'common', label: '共同点：两种结构都先改善了什么' },
  { key: 'root_locus_diff', label: '不同点：根轨迹/零点作用差异' },
  { key: 'time_domain_diff', label: '不同点：时域响应差异' },
  { key: 'frequency_domain_diff', label: '不同点：频域代价差异' },
] as const;

export const BAND_LABEL_OPTIONS = [
  { value: 'low-frequency', label: '低频基本不动' },
  { value: 'mid-high-rise', label: '拐点后中高频被抬起' },
  { value: 'high-frequency-risk', label: '高频代价与噪声放大' },
] as const;

export const PHASE_PEAK_OPTIONS = [
  { value: 'near-crossover', label: '相位峰应落在截止频率附近的关键频带' },
  { value: 'ultra-low', label: '相位峰应放在很低频，越低越好' },
  { value: 'ultra-high', label: '相位峰放到高频端，补角更强' },
] as const;

export const IMPROVED_METRIC_OPTIONS = [
  { value: 'phase-margin', label: '相角裕度' },
  { value: 'steady-state-error', label: '稳态误差' },
  { value: 'noise-floor', label: '噪声底线' },
] as const;

export const SCENARIO_SORT_COLUMNS = [
  { key: 'pd', title: '优先想 PD' },
  { key: 'lead', title: '优先想超前' },
  { key: 'neither', title: '两者都不够' },
] as const;

export const SCENARIO_CARDS = [
  { id: 'cross-over', label: '只想把截止频率往右推，允许中高频抬升' },
  { id: 'phase-margin', label: '目标是补相角并改善相角裕度，作用集中在关键频带' },
  { id: 'noise-risk', label: '高频噪声压力很大，不能简单持续抬高频增益' },
  { id: 'nmp-object', label: '对象已出现非最小相边界，需要先保守带宽' },
] as const;

export const TERM_EXPLAINER_KEYWORDS = [
  '镜像零点',
  '逆响应',
  '额外相位滞后',
  '不是最小相位',
] as const;

export const RULE_CHECK_OPTIONS = [
  { value: 'complete', label: '结论与原因都完整' },
  { value: 'missing-reason', label: '只有结论，缺少原因' },
  { value: 'missing-action', label: '只有风险描述，缺少保守动作' },
] as const;
