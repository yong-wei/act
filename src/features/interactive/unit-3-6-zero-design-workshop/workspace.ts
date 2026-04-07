export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: 'input' | 'select' | 'button' | 'drag';
}

export const PRETEST_QUESTIONS = [
  {
    key: 'q1',
    prompt: '面对超调量 Mp 和调节时间 ts，第一入口应是什么？',
    type: 'choice',
    options: [
      { value: 'root-region', label: '先翻译成目标极点区域' },
      { value: 'bode', label: '先看 Bode 图' },
      { value: 'parameter-guess', label: '先猜一个控制器参数' },
    ],
  },
  {
    key: 'q2',
    prompt: '面对 PM 与 wc 这组指标，第一入口应是什么？',
    type: 'choice',
    options: [
      { value: 'bode', label: '先看相角裕度与截止频率目标' },
      { value: 'root-locus', label: '先画根轨迹找主导极点' },
      { value: 'parameter-guess', label: '先把增益调大' },
    ],
  },
  {
    key: 'q3',
    prompt: '若对象带右半平面零点，第一反应更应该是什么？',
    type: 'choice',
    options: [
      { value: 'review-goal', label: '先重审目标与可行带宽' },
      { value: 'push-bandwidth', label: '继续把带宽往上推' },
      { value: 'reuse-answer', label: '直接沿用前一题结构答案' },
    ],
  },
  {
    key: 'reason',
    prompt: '写一句理由：你最容易混淆的是哪一种入口？',
    type: 'text',
  },
] as const;

export const POST_QUIZ_QUESTIONS = [
  {
    key: 'q1',
    prompt: '为什么任务 C 和任务 D 必须沿用同一组频域指标？',
    type: 'choice',
    options: [
      { value: 'same-goal', label: '只有同目标，才能比较 PD 和超前的真实代价差异' },
      { value: 'any-goal', label: '指标不同也能直接比较谁更强' },
      { value: 'time-only', label: '因为频域指标并不重要，只看时域回查即可' },
    ],
  },
  {
    key: 'q2',
    prompt: '为什么测速反馈的入口是等效极点位置？',
    type: 'choice',
    options: [
      { value: 'equivalent-pole', label: '因为它先改变等效特征方程，再由此反求 Kt' },
      { value: 'forward-zero', label: '因为测速反馈本质上就是显式加一个前向零点' },
      { value: 'same-as-pd', label: '因为测速反馈和 PD 的求参顺序完全一样' },
    ],
  },
  {
    key: 'q3',
    prompt: '为什么右半平面零点下先要重审目标交叉频率？',
    type: 'choice',
    options: [
      { value: 'nmp-boundary', label: '因为非最小相边界会压缩可行带宽，不能继续盲推' },
      { value: 'gain-only', label: '因为只要增益足够大，目标仍可原样保持' },
      { value: 'ignore-phase', label: '因为右半平面零点只影响时域，不影响频域边界' },
    ],
  },
  {
    key: 'reason',
    prompt: '写一句你现在最想保留的设计判断。',
    type: 'text',
  },
] as const;

export const ENTRY_BUCKETS = [
  { key: 'time-domain', title: '先上目标极点区域' },
  { key: 'frequency-domain', title: '先上 Bode 目标卡' },
  { key: 'boundary-review', title: '先重审目标边界' },
] as const;

export const DESIGN_TASK_CARDS = [
  { id: 'task-a', title: '任务 A', label: 'PD 时域设计', summary: '设计点 -> 相角条件 -> 模值条件 -> 验收' },
  { id: 'task-b', title: '任务 B', label: '测速反馈时域设计', summary: '等效极点 -> Kt -> K -> 验收' },
  { id: 'task-c', title: '任务 C', label: '超前频域设计', summary: '补角 -> 布置频带 -> 回查阶跃' },
  { id: 'task-d', title: '任务 D', label: '同指标下的 PD 设计', summary: '沿用频域目标 -> 比较时域代价' },
  { id: 'task-e', title: '任务 E', label: '非最小相边界选择', summary: '先改目标 -> 再选结构' },
] as const;

export const CONSTRAINT_TRANSLATION_FIELDS = [
  { key: 'zeta', label: '阻尼比下界' },
  { key: 'sigma', label: '实部边界' },
  { key: 'pureGainFailure', label: '纯增益为什么不够' },
] as const;

export const PARAMETER_WORKSPACE_FIELDS = [
  { key: 'designPoint', label: '设计点 / 目标频带' },
  { key: 'parameterChoice', label: '关键参数' },
  { key: 'validation', label: '验收结果' },
  { key: 'reason', label: '一句设计说明' },
] as const;

export const DIFFERENCE_TAG_OPTIONS = [
  { value: 'same-frequency-goal', label: '同一频域目标下完成对照' },
  { value: 'different-time-penalty', label: '时域副作用不同' },
  { value: 'different-structure-cost', label: '结构代价不同' },
  { value: 'need-recheck-goal', label: '边界下需要重审目标' },
] as const;

export const BOUNDARY_STRUCTURE_OPTIONS = [
  { value: 'pd', label: '优先选 PD' },
  { value: 'rate-feedback', label: '优先选测速反馈' },
  { value: 'lead', label: '优先选超前' },
] as const;
