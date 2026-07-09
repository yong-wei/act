'use client';

import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { KnowledgeDeck } from '@/resources/interactive-learning/shared/knowledge-deck';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: '微分方程_2_775c96a3',
    name: '微分方程模型',
    nodeType: 'THEORY',
    description: '用输入/输出的导数关系描述系统动态。',
    lessonId: 'lesson-03',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '微分方程模型是控制系统最基础的时域描述形式，强调输入、输出及其各阶导数之间的关系。',
    formulaContinuous: 'a_n y^{(n)}+\cdots+a_1 \dot{y}+a_0 y=b_m u^{(m)}+\cdots+b_0 u',
    applications: ['时域分析', '传递函数推导', '控制器设计'],
  },
  {
    id: '分析法_2_bc08248e',
    name: '机理建模方法',
    nodeType: 'THEORY',
    description: '基于物理/化学定律分析系统动态。',
    lessonId: 'lesson-03',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '机理建模强调“从机制出发”，常用基尔霍夫定律、牛顿定律与热力学定律建立运动方程。',
    applications: ['电路系统', '机械系统', '热力系统'],
  },
  {
    id: '实验法_系统辨识__2_b07364ee',
    name: '黑箱建模（系统辨识）',
    nodeType: 'THEORY',
    description: '用实验数据逼近系统模型。',
    lessonId: 'lesson-03',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '黑箱建模通过输入输出数据拟合模型，适合复杂机理难以解析的系统。神经网络建模可视为系统辨识的一种特例。',
    applications: ['系统辨识', '数据驱动建模'],
  },
  {
    id: '系统模型转换_1_18f4b178',
    name: '控制系统模型类型',
    nodeType: 'THEORY',
    description: '时域、复数域与频率域的模型表达。',
    lessonId: 'lesson-03',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '控制系统模型可在时域（微分/差分方程）、复数域（传递函数、结构图）与频率域（频率特性）表达。',
    applications: ['模型转换', '多域分析'],
  },
  {
    id: '动态数学模型_2_b7f98344',
    name: '微分方程建模步骤',
    nodeType: 'METHOD',
    description: '确定变量、列方程、消去中间量。',
    lessonId: 'lesson-03',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '流程：确定输入/输出/扰动 → 引入必要中间变量 → 根据定律列方程 → 消去中间变量得到标准形式。',
    applications: ['建模流程', '工程建模'],
  },
  {
    id: '数学模型_2_b21e01f6',
    name: '典型建模案例',
    nodeType: 'THEORY',
    description: 'RLC、电机与机械位移系统的建模路径。',
    lessonId: 'lesson-03',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      'RLC 串联电路、电机系统与机械位移系统均遵循“列方程 → 消元 → 标准化”链路，可快速识别系统阶次与关键参数。',
    applications: ['RLC 电路', '电机系统', '机械系统'],
  },
  {
    id: '非线性微分方程的线性化_2_caa86ba6',
    name: '非线性模型线性化',
    nodeType: 'THEORY',
    description: '在均衡点附近做泰勒展开保留一阶项。',
    lessonId: 'lesson-03',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '线性化使非线性模型在工作点附近可用线性工具分析，是经典控制理论的基础。',
    applications: ['小信号分析', '局部线性控制'],
  },
  {
    id: '模态_2_d586e1e6',
    name: '运动模态与齐次解',
    nodeType: 'THEORY',
    description: '齐次微分方程解可表示为模态叠加。',
    lessonId: 'lesson-03',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '无重根、多重根与共轭复根对应不同运动模态，齐次解为各模态的线性组合。',
    applications: ['稳定性理解', '响应特性分析'],
  },
];

interface DiffKnowledgeDeckProps extends BaseWidgetProps {}

export default function DiffKnowledgeDeck({ onComplete, onStateChange }: DiffKnowledgeDeckProps) {
  return (
    <KnowledgeDeck
      cards={KNOWLEDGE_CARDS}
      title="微分方程建模知识卡片"
      description="8 张卡片贯通“方法 → 步骤 → 示例 → 线性化”"
      footer="先方法后流程，再看案例。"
      targetIconClassName="text-emerald-500 dark:text-emerald-300"
      onComplete={onComplete}
      onStateChange={onStateChange}
    />
  );
}
