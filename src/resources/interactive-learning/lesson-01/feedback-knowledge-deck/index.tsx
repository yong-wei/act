'use client';

import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { KnowledgeDeck } from '@/resources/interactive-learning/shared/knowledge-deck';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: '反馈_1_1',
    name: '反馈的核心思想',
    nodeType: 'THEORY',
    description: '输出回到输入，误差驱动控制器调整行为。',
    lessonId: 'lesson-01',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '反馈控制通过比较期望输出与实际输出形成误差，控制器根据误差调整输入，使系统自动纠偏。它让系统具备自我修正能力。',
    applications: ['温控系统', '航向控制', '电机调速'],
  },
  {
    id: '自动控制系统_1_9678f418',
    name: '控制系统四要素',
    nodeType: 'THEORY',
    description: '对象、控制器、执行器、传感器构成闭环基础。',
    lessonId: 'lesson-01',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '对象是被控过程，控制器决策，执行器把控制信号变成动作，传感器测量输出并反馈给控制器。',
    applications: ['机器人', '工业控制', '生物医学系统'],
  },
  {
    id: '闭环控制_1_1',
    name: '开环 vs 闭环',
    nodeType: 'THEORY',
    description: '开环不看输出，闭环依赖反馈。',
    lessonId: 'lesson-01',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '开环控制依赖预设策略，抗扰动能力弱；闭环控制通过反馈抵消误差，但结构更复杂。',
    applications: ['定时加热', '自动驾驶', '无人机稳姿'],
  },
  {
    id: '反馈控制_1_516da087',
    name: '反馈带来的价值',
    nodeType: 'THEORY',
    description: '提高鲁棒性、减弱扰动、改善精度。',
    lessonId: 'lesson-01',
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '反馈能够抵御扰动与模型不确定性，提高稳定性与精度，但需要额外的传感与执行成本。',
    applications: ['抗风扰动', '稳态误差改善', '安全冗余设计'],
  },
];

interface FeedbackKnowledgeDeckProps extends BaseWidgetProps {}

export default function FeedbackKnowledgeDeck({ onComplete, onStateChange }: FeedbackKnowledgeDeckProps) {
  return (
    <KnowledgeDeck
      cards={KNOWLEDGE_CARDS}
      title="反馈控制知识卡片"
      description="4 张卡片串起反馈核心概念"
      footer="反馈是控制的核心语言。"
      targetIconClassName="text-emerald-500 dark:text-emerald-300"
      onComplete={onComplete}
      onStateChange={onStateChange}
    />
  );
}
