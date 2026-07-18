'use client';

import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { KnowledgeDeck } from '@/resources/interactive-learning/shared/knowledge-deck';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: '拉普拉斯变换_2_c635236f',
    name: '拉普拉斯变换的工程意义',
    nodeType: 'THEORY',
    description: '用指数加权把时域信号投影到 s 域，让微分方程变成代数方程。',
    lessonId: 'lesson-02',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '拉普拉斯变换可以看作傅里叶变换的延伸：通过 e^{-\sigma t} 引入衰减，确保积分收敛。工程上最重要的结果是把微分方程代数化，使系统求解和控制器设计更高效。',
    formulaContinuous: 'F(s)=\int_0^{\infty} f(t)e^{-st}dt',
    applications: ['电路响应求解', '系统稳定性分析', '控制器设计'],
  },
  {
    id: '拉氏变换工程动机_2_11001',
    name: 's = σ + jω 的直觉',
    nodeType: 'THEORY',
    description: 'σ 决定衰减速度，ω 决定振荡频率。',
    lessonId: 'lesson-02',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      's 平面把系统“性格”写在复平面上：实部决定指数衰减/增长，虚部决定振荡频率。极点在左半平面意味着响应衰减，右半平面意味着发散。',
    formulaContinuous: 'e^{(\sigma + j\omega)t}=e^{\sigma t}(\cos\omega t + j\sin\omega t)',
    applications: ['极点分析', '响应快慢判断', '工程稳定性直觉'],
  },
  {
    id: '微分定理_2_11002',
    name: '拉氏变换常用定理',
    nodeType: 'METHOD',
    description: '线性、微分、积分、位移与卷积是工程计算的主力工具。',
    lessonId: 'lesson-02',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '线性定理让组合信号可拆解；微分/积分定理直接处理动态系统；位移定理处理时滞；卷积定理连接系统响应。初值/终值定理用于快速判断响应起点与稳态值。',
    formulaContinuous: "L\\{f'(t)\\}=sF(s)-f(0)",
    applications: ['快速求解', '系统响应估计', '工程验算'],
  },
  {
    id: '部分分式展开_7_d822352e',
    name: '拉氏反变换方法',
    nodeType: 'METHOD',
    description: '部分分式、待定系数与留数法让 s 域回到时域。',
    lessonId: 'lesson-02',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '工程上最常见的是部分分式法：将真分式拆解为标准形式，再查表反变换。遇到重根时使用待定系数法或留数法。',
    formulaContinuous: 'F(s)=\\sum_i \\frac{A_i}{s+a_i} + \\sum_k \\frac{B_k}{(s+a)^k}',
    applications: ['时域响应还原', '控制器验证', '动态性能评估'],
  },
];

interface LaplaceKnowledgeDeckProps extends BaseWidgetProps {}

export default function LaplaceKnowledgeDeck({ onComplete, onStateChange }: LaplaceKnowledgeDeckProps) {
  return (
    <KnowledgeDeck
      cards={KNOWLEDGE_CARDS}
      title="拉氏变换知识卡片"
      description="4 张卡片串起“直觉 → 定理 → 反变换”"
      footer="先理解，再应用。"
      targetIconClassName="text-amber-500 dark:text-amber-300"
      onComplete={onComplete}
      onStateChange={onStateChange}
    />
  );
}
