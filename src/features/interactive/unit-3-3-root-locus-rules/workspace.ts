export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: 'input' | 'select' | 'button' | 'drag';
}

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ActivityCardDefinition {
  key: string;
  title: string;
  prompt: string;
  placeholder: string;
  reference: string;
}

export interface SequenceSortItem {
  id: string;
  label: string;
  explanation: string;
}

export interface ClassificationCardDefinition {
  key: string;
  prompt: string;
  answer: string;
}

export interface QuizQuestion {
  key: string;
  prompt: string;
  type?: 'choice' | 'text';
  options?: ChoiceOption[];
  answer?: string;
  explanation: string;
}

export const STEP07_CARDS: ActivityCardDefinition[] = [
  {
    key: 'real-axis',
    title: '实轴区段判断',
    prompt: '哪些实轴区段属于根轨迹。',
    placeholder: '例如：(-∞,-4) 与 (-2,0) 属于轨迹。',
    reference: '(-∞,-4) 与 (-2,0) 属于轨迹。',
  },
  {
    key: 'asymptote',
    title: '渐近线重心与角度',
    prompt: '渐近线重心与角度如何确定。',
    placeholder: '例如：重心在 -2，角度为 60°、180°、300°。',
    reference: '重心在 -2，角度为 60°、180°、300°。',
  },
];

export const STEP09_CARDS: ActivityCardDefinition[] = [
  {
    key: 'breakaway',
    title: '真实分离点筛选',
    prompt: '哪一个候选点是真实分离点。',
    placeholder: '例如：只有位于根轨迹实轴区段且对应 K>0 的候选点才保留。',
    reference: '只保留位于根轨迹实轴区段且对应 K>0 的候选点。',
  },
  {
    key: 'imaginary-crossing',
    title: '临界增益与虚轴交点',
    prompt: '临界增益与虚轴交点如何对应。',
    placeholder: '例如：K=6 对应 s=±j√2，回答的是稳定边界。',
    reference: 'K=6 对应 s=±j√2，回答的是稳定边界。',
  },
];

export const STEP11_CARDS: ActivityCardDefinition[] = [
  {
    key: 'departure-angle',
    title: '复极点出射角',
    prompt: '上半平面复极点的出射角是多少。',
    placeholder: '例如：先列角度平衡，再给出上半平面 26.565° 的出射角结果。',
    reference: '先由角度平衡求出上半平面复极点的出射角 26.565°，再用共轭对称得到下半平面结果。',
  },
  {
    key: 'root-sum',
    title: '根之和约束',
    prompt: '根之和原则如何限制另一实根的位置。',
    placeholder: '例如：根之和 = -4，因此局部方向与整图位置必须同时自洽。',
    reference: '根之和 = -4，因此局部方向与整图位置必须同时自洽。',
  },
];

export const WORKFLOW_SEQUENCE: SequenceSortItem[] = [
  { id: 'poles-zeros', label: '写出极点与零点', explanation: '先交代对象和分支出发 / 终止位置。' },
  { id: 'real-axis', label: '判实轴区段', explanation: '用奇偶判段找出真正属于轨迹的实轴段。' },
  { id: 'asymptote', label: '求渐近线', explanation: '先看无穷远方向的大势。' },
  { id: 'real-keypoints', label: '找实轴关键点', explanation: '再补分离点 / 汇合点等实轴关键点。' },
  { id: 'imaginary-axis', label: '查虚轴交点', explanation: '判断何时碰到稳定边界。' },
  { id: 'local-direction', label: '补局部方向', explanation: '再补复极点 / 复零点附近的局部切线方向。' },
  { id: 'global-check', label: '做全图复核', explanation: '最后用对称性、根之和等约束检查整图是否自洽。' },
];

export const CLASSIFICATION_OPTIONS: ChoiceOption[] = [
  { value: 'origin-pole', label: '原点极点' },
  { value: 'real-pole', label: '实轴极点' },
  { value: 'complex-pole', label: '共轭复极点' },
];

export const CLASSIFICATION_CARDS: ClassificationCardDefinition[] = [
  {
    key: 'integrator-trend',
    prompt: '“更接近积分型结构，需要优先警惕低频拖尾” 对应哪类开环极点？',
    answer: 'origin-pole',
  },
  {
    key: 'real-axis-trend',
    prompt: '“直接决定实轴区段与分离 / 汇合可能” 对应哪类开环极点？',
    answer: 'real-pole',
  },
  {
    key: 'oscillation-trend',
    prompt: '“必须补出射角，振荡趋势更明显” 对应哪类开环极点？',
    answer: 'complex-pole',
  },
];

export const POSTTEST_QUESTIONS: QuizQuestion[] = [
  {
    key: 'q1',
    prompt: '判断某个点是否属于根轨迹时，正确顺序是：',
    options: [
      { value: 'angle-first', label: '先看相角条件，再用幅值条件确定参数大小' },
      { value: 'magnitude-first', label: '先算参数，再回头看相角是否凑得上' },
      { value: 'either', label: '两者顺序无关，只要最后都算到即可' },
    ],
    answer: 'angle-first',
    explanation: '相角条件先回答“有没有资格在轨迹上”，幅值条件再回答“若在轨迹上，对应多大参数”。',
  },
  {
    key: 'q2',
    prompt: '读图时为什么必须先骨架、再关键点、最后补局部方向？',
    options: [
      { value: 'skeleton-first', label: '因为骨架先回答整体走向，再由关键点和局部方向补细节' },
      { value: 'keypoint-first', label: '因为关键点最难，所以应该最先抓住' },
      { value: 'any-order', label: '顺序无关，只要法则都算到即可' },
    ],
    answer: 'skeleton-first',
    explanation: '骨架先给整张图的大势，关键点和局部方向是在骨架之后做修正与补细节。',
  },
  {
    key: 'q3',
    prompt: '在例题中，dK/ds、劳斯判据、出射角和根之和各自回答什么问题？',
    type: 'text',
    explanation: '理想回答应覆盖实轴关键点、稳定边界、局部方向与整图守恒四个职责。',
  },
];
