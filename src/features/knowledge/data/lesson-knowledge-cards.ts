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
 * Lesson 02: 机理建模——微分方程
 * 知识卡片数据
 */
export const LESSON_02_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'concept-modeling-intro',
    name: '为什么需要建模？',
    nodeType: 'THEORY',
    description: '模型是控制的基础——不懂舵机的"脾气"，控制器就只能瞎指挥。',
    explanation:
      '物理系统与数学模型的关系：控制器需要一个"数学档案"来了解被控对象的特性。没有模型，控制器无法预测系统行为，只能被动响应。就像医生需要先了解病情才能开药。强调"模型是控制的基础"。',
    positionX: -50,
    positionY: 0,
    positionZ: 30,
    lessonId: 'lesson-02',
    phase: 'bridge',
    applications: ['舵机控制', '电机调速', '温度控制', '航向控制'],
    prerequisites: [],
    relatedTopics: ['concept-newton-law-application', 'concept-kirchhoff-law'],
  },
  {
    id: 'concept-newton-law-application',
    name: '牛顿定律在旋转体中的应用',
    nodeType: 'THEORY',
    description: '转动版的 F=ma：T = Jα，力矩等于转动惯量乘以角加速度。',
    explanation:
      '牛顿第二定律 F=ma 适用于平动，对于旋转运动则变成 T=Jα。其中 J 是转动惯量（类似质量的旋转版），α 是角加速度。不同形状物体的转动惯量不同，这决定了它们"转起来有多费劲"。',
    positionX: -30,
    positionY: 15,
    positionZ: 25,
    lessonId: 'lesson-02',
    phase: 'mechanical',
    formulaContinuous: 'T = J\\alpha = J\\ddot{\\theta}',
    applications: ['舵机系统', '机械臂', '飞轮储能', '陀螺仪'],
    prerequisites: ['concept-modeling-intro'],
    relatedTopics: ['concept-linearization', 'concept-kirchhoff-law'],
  },
  {
    id: 'concept-kirchhoff-law',
    name: 'KVL与动态电路',
    nodeType: 'THEORY',
    description: 'KVL：回路中电压升等于电压降。动态元件让方程变成微分方程。',
    explanation:
      '基尔霍夫电压定律(KVL)说明回路电压代数和为零。电感和电容是"动态元件"：电感电压与电流变化率成正比(u=L·di/dt)，电容电压与电荷成正比(u=q/C)。这让电路方程变成微分方程，与机械系统形成对偶。',
    positionX: -30,
    positionY: -15,
    positionZ: 25,
    lessonId: 'lesson-02',
    phase: 'electrical',
    formulaContinuous: 'L\\frac{di}{dt} + Ri + \\frac{1}{C}\\int i\\,dt = u(t)',
    applications: ['电机电枢回路', 'RLC滤波器', '电力电子', '信号处理'],
    prerequisites: ['concept-modeling-intro'],
    relatedTopics: ['concept-newton-law-application'],
  },
  {
    id: 'concept-linearization',
    name: '非线性线性化',
    nodeType: 'THEORY',
    description: '在工作点附近，用直线近似曲线。小偏差时 sinθ ≈ θ。',
    explanation:
      '很多物理系统是非线性的（如重力摆的 sinθ 项），但线性控制理论更成熟。通过泰勒展开，在平衡点附近将非线性项线性化。例如 sinθ 在 θ=0 附近展开：sinθ≈θ。这让我们能用线性工具分析非线性系统。',
    positionX: -10,
    positionY: 0,
    positionZ: 35,
    lessonId: 'lesson-02',
    phase: 'posttest',
    formulaContinuous: '\\sin\\theta \\approx \\theta \\quad (|\\theta| \\ll 1)',
    applications: ['倒立摆', '导弹发射架', '悬挂系统', '机器人关节'],
    prerequisites: ['concept-newton-law-application'],
    relatedTopics: ['concept-kirchhoff-law'],
  },
];

/**
 * 知识卡片之间的连接关系
 */
export const LESSON_02_CARD_LINKS = [
  {
    id: 'lk1',
    sourceId: 'concept-modeling-intro',
    targetId: 'concept-newton-law-application',
    relation: '引出机械建模',
  },
  {
    id: 'lk2',
    sourceId: 'concept-modeling-intro',
    targetId: 'concept-kirchhoff-law',
    relation: '引出电路建模',
  },
  {
    id: 'lk3',
    sourceId: 'concept-newton-law-application',
    targetId: 'concept-kirchhoff-law',
    relation: '机电类比',
  },
  {
    id: 'lk4',
    sourceId: 'concept-newton-law-application',
    targetId: 'concept-linearization',
    relation: '非线性扩展',
  },
  // 连接到现有知识图谱节点
  {
    id: 'lk5',
    sourceId: 'concept-modeling-intro',
    targetId: '1', // 传递函数
    relation: '建模基础',
  },
  {
    id: 'lk6',
    sourceId: 'concept-kirchhoff-law',
    targetId: '3', // PID控制器
    relation: '电路应用',
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
