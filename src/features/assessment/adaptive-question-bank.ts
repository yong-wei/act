export type QuestionDomain = 'time' | 'frequency' | 'complex' | 'physical';

export type QuestionType =
  | 'pole-to-behavior'
  | 'bode-to-stability'
  | 'design-tradeoff'
  | 'multi-criteria';

export interface QuestionOption {
  label: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface CrossDomainQuestion {
  id: string;
  stem: string;
  domains: QuestionDomain[];
  type: QuestionType;
  difficulty: number;
  knowledgeTags: string[];
  options: QuestionOption[];
  generatedMetadata?: {
    model: string;
    generationKind?: 'template' | 'ai' | 'human';
    generationTime: number;
    validatedBy: string[];
    learningGoalIds?: string[];
    graphNodeIds?: string[];
    intendedStage?: 'low-stakes-practice' | 'readiness' | 'checkpoint' | 'remediation' | 'terminal-validation';
    ownerUserId?: string;
    sessionId?: string;
  };
}

const TAGS = [
  'pole-stability',
  'damping-ratio',
  'phase-margin',
  'gain-margin',
  'overshoot',
  'settling-time',
  'disturbance-rejection',
  'comfort-constraint',
  'robustness',
  'controller-tuning',
] as const;

const DOMAIN_PATTERNS: QuestionDomain[][] = [
  ['complex', 'time'],
  ['frequency', 'time'],
  ['complex', 'frequency'],
  ['time', 'physical'],
  ['frequency', 'physical'],
];

function makeOptions(correctLabel: string, wrongLabels: string[], explanation: string): QuestionOption[] {
  const options = [
    {
      label: correctLabel,
      text: correctLabel,
      isCorrect: true,
      explanation,
    },
    ...wrongLabels.map((label) => ({
      label,
      text: label,
      isCorrect: false,
      explanation: '该选项与题干的跨域映射不一致，请结合极点位置、裕度和时域指标综合判断。',
    })),
  ];

  return options.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

function makeQuestion(index: number): CrossDomainQuestion {
  const pattern = DOMAIN_PATTERNS[index % DOMAIN_PATTERNS.length];
  const tagA = TAGS[index % TAGS.length];
  const tagB = TAGS[(index + 3) % TAGS.length];
  const difficulty = Number((((index % 10) + 1) / 10).toFixed(2));

  const typeCycle: QuestionType[] = ['pole-to-behavior', 'bode-to-stability', 'design-tradeoff', 'multi-criteria'];
  const type = typeCycle[index % typeCycle.length];

  const stemVariants = [
    `在闭环系统中，若主导极点由 -1±j2 移动到 -0.4±j2.1，以下哪项最符合“复域→时域”映射？`,
    `某系统相位裕度从 45° 降到 20°，且增益交叉频率上升。下列对时域表现的判断最合理的是？`,
    `邮轮航向控制中，为降低 MSI，设计者将带宽从 0.45rad/s 下调到 0.28rad/s。该操作最可能带来什么权衡？`,
    `破冰船在参数不确定条件下，若 K 下降 30%、T 上升 20%，哪个控制目标最应优先保持？`,
  ];

  const optionGroups = [
    makeOptions(
      '超调增大且振荡衰减变慢',
      ['超调减小且稳态误差变大', '上升时间变长但振荡显著减弱', '几乎不影响动态指标'],
      '极点更靠近虚轴意味着阻尼减小，通常会导致超调增加并且衰减更慢。'
    ),
    makeOptions(
      '超调风险升高且鲁棒性下降',
      ['超调下降且抗扰增强', '动态几乎不变，仅稳态误差变化', '系统一定变成无振荡响应'],
      '相位裕度下降通常对应阻尼下降，超调上升，且系统对模型不确定性更敏感。'
    ),
    makeOptions(
      '舒适度提升，但响应速度可能下降',
      ['舒适度与响应速度同时显著提升', '舒适度下降但稳态精度提升', '只影响频域，不影响乘客体感'],
      '降低带宽可减弱高频扰动放大，舒适性改善，但闭环响应通常变慢。'
    ),
    makeOptions(
      '闭环稳定与扰动抑制能力',
      ['最小控制能耗，不考虑鲁棒性', '最短调节时间，允许失稳边界', '保持参数不变，避免任何探索'],
      '在不确定和扰动环境下，优先保证稳定和基本抗扰能力是鲁棒控制的底线。'
    ),
  ];

  return {
    id: `preset-q-${String(index + 1).padStart(2, '0')}`,
    stem: stemVariants[index % stemVariants.length],
    domains: pattern,
    type,
    difficulty,
    knowledgeTags: [tagA, tagB],
    options: optionGroups[index % optionGroups.length],
  };
}

export const PRESET_QUESTIONS: CrossDomainQuestion[] = Array.from({ length: 50 }, (_, index) => makeQuestion(index));

export function buildGeneratedQuestion(
  id: string,
  stem: string,
  difficulty: number,
  domains: QuestionDomain[],
  knowledgeTags: string[],
  generatedMetadata?: {
    learningGoalIds?: string[];
    graphNodeIds?: string[];
    intendedStage?: 'low-stakes-practice' | 'readiness' | 'checkpoint' | 'remediation' | 'terminal-validation';
    ownerUserId?: string;
    sessionId?: string;
  },
): CrossDomainQuestion {
  return {
    id,
    stem,
    domains,
    type: 'multi-criteria',
    difficulty,
    knowledgeTags,
    options: makeOptions(
      '先识别主导约束，再按跨域因果逐步调参',
      ['直接大幅提高 Kp 并忽略约束', '仅根据单一指标做一次性定参', '只追求最快响应，不评估稳定裕度'],
      '跨域问题应先明确约束，再基于“极点-频域-时域”因果做迭代优化。'
    ),
    generatedMetadata: {
      model: 'rule-based-generator',
      generationKind: 'template',
      generationTime: Date.now(),
      validatedBy: ['system-auto-check'],
      ...(generatedMetadata?.learningGoalIds?.length ? {
        learningGoalIds: generatedMetadata.learningGoalIds,
      } : {}),
      ...(generatedMetadata?.graphNodeIds?.length ? {
        graphNodeIds: generatedMetadata.graphNodeIds,
      } : {}),
      ...(generatedMetadata?.intendedStage ? {
        intendedStage: generatedMetadata.intendedStage,
      } : {}),
      ...(generatedMetadata?.ownerUserId ? { ownerUserId: generatedMetadata.ownerUserId } : {}),
      ...(generatedMetadata?.sessionId ? { sessionId: generatedMetadata.sessionId } : {}),
    },
  };
}
