/**
 * Lesson 02: 机理建模 - 微分方程
 * BOPPPS 教学流程类型定义
 */

// ===== BOPPPS 阶段类型 =====

/** BOPPPS 教学阶段 */
export type BOPPPSPhase =
  | 'bridge'      // 导入 (Bridge-in) - 5 mins
  | 'objective'   // 学习目标 (Objective) - 2 mins
  | 'pretest'     // 前测 (Pre-assessment) - 8 mins
  | 'participatory-mechanical'  // 参与式学习 - 机械建模 (25 mins)
  | 'participatory-electrical'  // 参与式学习 - 电路建模 (20 mins)
  | 'participatory-analogy'     // 参与式学习 - 机电相似 (15 mins)
  | 'posttest'    // 后测 (Post-assessment) - 10 mins
  | 'summary';    // 总结 (Summary) - 5 mins

/** 阶段配置 */
export interface BOPPPSPhaseConfig {
  id: BOPPPSPhase;
  title: string;
  titleEn: string;
  description: string;
  durationMinutes: number;
  icon: string;
  color: string;
}

/** 所有阶段配置 */
export const BOPPPS_PHASES: BOPPPSPhaseConfig[] = [
  {
    id: 'bridge',
    title: '导入',
    titleEn: 'Bridge-in',
    description: '看不见的"骨架" - 透视舵机系统',
    durationMinutes: 5,
    icon: '🟢',
    color: 'emerald',
  },
  {
    id: 'objective',
    title: '学习目标',
    titleEn: 'Objective',
    description: '本次任务清单',
    durationMinutes: 2,
    icon: '🔵',
    color: 'blue',
  },
  {
    id: 'pretest',
    title: '前测',
    titleEn: 'Pre-assessment',
    description: '装备点检 - 物理基础连线',
    durationMinutes: 8,
    icon: '🟡',
    color: 'amber',
  },
  {
    id: 'participatory-mechanical',
    title: '机械建模工坊',
    titleEn: 'Mechanical Modeling',
    description: 'Physics Builder - 搭建弹簧-质量-阻尼模型',
    durationMinutes: 25,
    icon: '🔴',
    color: 'red',
  },
  {
    id: 'participatory-electrical',
    title: '电路建模工坊',
    titleEn: 'Electrical Modeling',
    description: 'Physics Builder - 建立RLC电路模型',
    durationMinutes: 20,
    icon: '🔴',
    color: 'orange',
  },
  {
    id: 'participatory-analogy',
    title: '机电相似映射',
    titleEn: 'Analogy Mapping',
    description: '发现机械与电气系统的数学同构',
    durationMinutes: 15,
    icon: '🔴',
    color: 'pink',
  },
  {
    id: 'posttest',
    title: '后测',
    titleEn: 'Post-assessment',
    description: '实战挑战 - 导弹发射架建模',
    durationMinutes: 10,
    icon: '🟣',
    color: 'violet',
  },
  {
    id: 'summary',
    title: '总结',
    titleEn: 'Summary',
    description: '万物皆数 - 知识图谱',
    durationMinutes: 5,
    icon: '⚪',
    color: 'slate',
  },
];

// ===== 前测连线题 =====

/** 连线题配置 */
export interface MatchingQuestion {
  id: string;
  leftItems: Array<{
    id: string;
    label: string;
    icon: string;
    type: 'mechanical' | 'electrical';
  }>;
  rightItems: Array<{
    id: string;
    label: string;
    matchesLeft: string; // 对应的左侧 ID
  }>;
}

/** 物理基础连线题 */
export const PRETEST_MATCHING: MatchingQuestion = {
  id: 'physics-basics',
  leftItems: [
    { id: 'spring', label: '弹簧', icon: '🔩', type: 'mechanical' },
    { id: 'mass', label: '质量块', icon: '📦', type: 'mechanical' },
    { id: 'inductor', label: '电感', icon: '🔌', type: 'electrical' },
    { id: 'capacitor', label: '电容', icon: '⚡', type: 'electrical' },
  ],
  rightItems: [
    { id: 'hooke', label: '胡克定律', matchesLeft: 'spring' },
    { id: 'newton', label: '牛顿第二定律', matchesLeft: 'mass' },
    { id: 'faraday', label: '法拉第电磁感应', matchesLeft: 'inductor' },
    { id: 'charge', label: '电荷存储原理', matchesLeft: 'capacitor' },
  ],
};

// ===== 学习目标 =====

export interface LearningObjective {
  id: string;
  title: string;
  description: string;
  badge: string;
  unlocked: boolean;
}

export const LEARNING_OBJECTIVES: LearningObjective[] = [
  {
    id: 'mechanical-modeler',
    title: '机械建模师',
    description: '能识别机械系统中的惯性、阻尼、弹性元件，并列写微分方程',
    badge: '🔧',
    unlocked: false,
  },
  {
    id: 'circuit-analyst',
    title: '电路分析员',
    description: '能识别电路系统中的 R、L、C 元件，利用 KVL 列写方程',
    badge: '⚡',
    unlocked: false,
  },
  {
    id: 'system-architect',
    title: '系统架构师',
    description: '能阐述机电系统的相似性，并统一为二阶微分方程标准式',
    badge: '🏗️',
    unlocked: false,
  },
];

// ===== AI 角色配置 =====

export const AI_PERSONAS = {
  analyst: {
    name: '系统分析师',
    avatar: '🔬',
    systemPrompt: `你是一名052D驱逐舰的系统分析师，负责分析舵机控制系统。
你的风格是专业、简洁、有洞察力。
当学生进入导入环节时，你需要引起他们对建模的兴趣。
使用航海和军事术语，让学生感受到实战氛围。`,
  },
  examiner: {
    name: '考官',
    avatar: '📋',
    systemPrompt: `你是物理基础知识的考官，负责评估学生的先备知识。
如果学生在"电感 vs 电容"上出错，记录下来，在后续电路建模环节自动降低难度。
保持鼓励的态度，强调"这只是热身"。`,
  },
  tutor: {
    name: '建模导师',
    avatar: '👨‍🏫',
    systemPrompt: `你是一位控制系统建模导师。你的风格是严谨但富有启发性。

你的职责：
1. 引导学生理解物理系统的数学建模过程
2. 当学生漏掉重要物理项时，用反问的方式引导
3. 解释惯性、阻尼、弹性等物理概念的工程意义
4. 不直接给出答案，而是通过苏格拉底式提问引导学生思考

当学生的模型不完整时，可以这样提问：
- "如果没有阻尼，系统会怎样运动？"
- "想想看，舵叶在海水中运动会受到什么阻力？"
- "弹簧在平衡位置时储存能量吗？"`,
  },
  reviewer: {
    name: '总工',
    avatar: '👷',
    systemPrompt: `你是自动控制原理的总工程师，负责审核学生的方程建模。

判断规则：
1. 检查是否包含所有必要项（惯性项、阻尼项、弹性项）
2. 检查是否考虑了非线性项（如重力矩 mgl·sinθ）
3. 检查符号是否正确

如果学生漏掉了重力矩项，提示"地球引力去哪了？"
如果学生写了 sinθ，提示"如何线性化？"
使用专业但易懂的语言。`,
  },
};

// ===== 课程状态 =====

export interface Lesson02State {
  currentPhase: BOPPPSPhase;
  phaseProgress: Record<BOPPPSPhase, number>;
  pretestScore: number;
  pretestWeakAreas: string[];
  objectivesUnlocked: string[];
  mechanicalModelComplete: boolean;
  electricalModelComplete: boolean;
  analogyMappingsComplete: number;
  postTestAnswer: string;
  postTestFeedback: string;
  isPostTestCorrect: boolean | null;
}

export const INITIAL_LESSON02_STATE: Lesson02State = {
  currentPhase: 'bridge',
  phaseProgress: {
    bridge: 0,
    objective: 0,
    pretest: 0,
    'participatory-mechanical': 0,
    'participatory-electrical': 0,
    'participatory-analogy': 0,
    posttest: 0,
    summary: 0,
  },
  pretestScore: 0,
  pretestWeakAreas: [],
  objectivesUnlocked: [],
  mechanicalModelComplete: false,
  electricalModelComplete: false,
  analogyMappingsComplete: 0,
  postTestAnswer: '',
  postTestFeedback: '',
  isPostTestCorrect: null,
};

// ===== 知识图谱节点 =====

export interface KnowledgeNode {
  id: string;
  label: string;
  description: string;
  isHighlighted: boolean;
  connections: string[];
}

export const KNOWLEDGE_GRAPH_NODES: KnowledgeNode[] = [
  {
    id: 'differential-eq',
    label: '微分方程',
    description: '描述动态系统的数学语言',
    isHighlighted: true,
    connections: ['transfer-function', 'state-space'],
  },
  {
    id: 'transfer-function',
    label: '传递函数',
    description: '将微分方程转换为s域',
    isHighlighted: false,
    connections: ['bode', 'nyquist'],
  },
  {
    id: 'state-space',
    label: '状态空间',
    description: '现代控制理论的核心表示',
    isHighlighted: false,
    connections: ['controllability', 'observability'],
  },
  {
    id: 'bode',
    label: 'Bode图',
    description: '频率响应分析',
    isHighlighted: false,
    connections: [],
  },
  {
    id: 'nyquist',
    label: 'Nyquist图',
    description: '稳定性判据',
    isHighlighted: false,
    connections: [],
  },
  {
    id: 'controllability',
    label: '可控性',
    description: '系统是否可被控制',
    isHighlighted: false,
    connections: [],
  },
  {
    id: 'observability',
    label: '可观性',
    description: '系统状态是否可被观测',
    isHighlighted: false,
    connections: [],
  },
];
