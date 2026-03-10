/**
 * 课程知识卡片数据
 * Lesson Knowledge Cards Data
 *
 * 按课程组织的知识卡片，用于知识图谱展示
 */

import type { KnowledgeNodeData } from '../knowledge-graph-system';

/**
 * 知识卡片扩展接口
 * 包含 LaTeX 公式和课程关联信息
 */
export interface LessonKnowledgeCard extends KnowledgeNodeData {
  /** 课程 ID */
  lessonId: string;
  /** 课程阶段 */
  phase: string;
  /** LaTeX 公式（连续时间） */
  formulaContinuous?: string;
  /** LaTeX 公式（离散时间） */
  formulaDiscrete?: string;
  /** 详细解释 */
  explanation: string;
  /** 应用领域 */
  applications: string[];
  /** 前置知识 ID */
  prerequisites: string[];
  /** 相关主题 ID */
  relatedTopics: string[];
}

/**
 * Lesson 02: 拉氏变换——工程直觉的数学实现
 * 知识卡片数据
 */
export const LESSON_02_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-laplace-transform',
    name: '拉普拉斯变换的工程意义',
    nodeType: 'THEORY',
    description: '把时域信号投影到 s 域，微分方程变成代数方程。',
    explanation:
      '拉氏变换通过引入 e^{-\\sigma t} 权重，让原本可能发散的积分收敛，从而把系统动态转换到 s 域。工程上最重要的价值是化微分为代数，便于求解与控制器设计。',
    positionX: -40,
    positionY: 0,
    positionZ: 20,
    lessonId: 'lesson-02',
    phase: 'bridge',
    formulaContinuous: 'F(s)=\\int_0^{\\infty} f(t)e^{-st}dt',
    applications: ['RLC 电路分析', '系统稳定性判断', '控制器设计'],
    prerequisites: [],
    relatedTopics: ['node-transfer-function', 'node-laplace-properties'],
  },
  {
    id: 'node-laplace-interpretation',
    name: 's 平面直觉',
    nodeType: 'THEORY',
    description: '实部决定衰减，虚部决定振荡频率。',
    explanation:
      's=\\sigma+j\\omega 将系统响应拆成衰减与振荡两部分。极点实部越负，衰减越快；虚部越大，振荡越快。工程上用 s 平面判断系统“性格”。',
    positionX: -25,
    positionY: 10,
    positionZ: 22,
    lessonId: 'lesson-02',
    phase: 'participatory',
    formulaContinuous: 'e^{(\\sigma + j\\omega)t}=e^{\\sigma t}(\\cos\\omega t + j\\sin\\omega t)',
    applications: ['稳定性判断', '响应快慢分析'],
    prerequisites: ['node-laplace-transform'],
    relatedTopics: ['node-laplace-properties'],
  },
  {
    id: 'node-laplace-properties',
    name: '拉氏变换常用定理',
    nodeType: 'THEORY',
    description: '线性、微分、积分、位移与卷积定理构成工程计算主力。',
    explanation:
      '常用定理可以把时域操作直接映射到 s 域表达：微分变乘 s，积分变除 s，卷积变乘积。掌握这些定理是高效解题的关键。',
    positionX: -20,
    positionY: -10,
    positionZ: 22,
    lessonId: 'lesson-02',
    phase: 'participatory',
    formulaContinuous: "L\\{f'(t)\\}=sF(s)-f(0)",
    applications: ['快速求解', '响应估计'],
    prerequisites: ['node-laplace-transform'],
    relatedTopics: ['node-inverse-laplace-methods'],
  },
  {
    id: 'node-inverse-laplace-methods',
    name: '拉氏反变换方法',
    nodeType: 'THEORY',
    description: '部分分式、待定系数与留数法让 s 域回到时域。',
    explanation:
      '工程上常用部分分式分解与待定系数法处理反变换，先判断是否真分式与是否重根，再选择合适方法回到时域。',
    positionX: -10,
    positionY: 0,
    positionZ: 24,
    lessonId: 'lesson-02',
    phase: 'posttest',
    applications: ['时域响应还原', '系统验证'],
    prerequisites: ['node-laplace-properties'],
    relatedTopics: ['node-transfer-function'],
  },
];

/**
 * 知识卡片之间的连接关系
 */
export const LESSON_02_CARD_LINKS = [
  {
    id: 'lk1',
    sourceId: 'node-laplace-transform',
    targetId: 'node-laplace-interpretation',
    relation: '直觉展开',
  },
  {
    id: 'lk2',
    sourceId: 'node-laplace-transform',
    targetId: 'node-laplace-properties',
    relation: '引出定理',
  },
  {
    id: 'lk3',
    sourceId: 'node-laplace-properties',
    targetId: 'node-inverse-laplace-methods',
    relation: '计算路径',
  },
  {
    id: 'lk4',
    sourceId: 'node-laplace-transform',
    targetId: 'node-transfer-function',
    relation: '导向传递函数',
  },
];

/**
 * 根据 ID 获取知识卡片
 */
export function getLessonKnowledgeCard(id: string): LessonKnowledgeCard | undefined {
  return LESSON_02_CARDS.find((card) => card.id === id);
}

/**
 * 根据课程 ID 获取所有知识卡片
 */
export function getCardsByLesson(lessonId: string): LessonKnowledgeCard[] {
  return LESSON_02_CARDS.filter((card) => card.lessonId === lessonId);
}

/**
 * 根据阶段获取知识卡片
 */
export function getCardByPhase(lessonId: string, phase: string): LessonKnowledgeCard | undefined {
  return LESSON_02_CARDS.find((card) => card.lessonId === lessonId && card.phase === phase);
}

/**
 * 获取所有课程知识卡片（用于知识图谱）
 */
export function getAllLessonCards(): KnowledgeNodeData[] {
  return LESSON_02_CARDS.map((card) => ({
    id: card.id,
    name: card.name,
    nodeType: card.nodeType,
    description: card.description,
    positionX: card.positionX,
    positionY: card.positionY,
    positionZ: card.positionZ,
    content: {
      formulaContinuous: card.formulaContinuous,
      formulaDiscrete: card.formulaDiscrete,
      explanation: card.explanation,
      applications: card.applications,
      lessonId: card.lessonId,
      phase: card.phase,
    },
  }));
}

/**
 * 获取所有课程知识卡片的连接
 */
export function getAllLessonCardLinks() {
  return LESSON_02_CARD_LINKS;
}
