'use client';

import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { KnowledgeDeck } from '@/resources/interactive-learning/shared/knowledge-deck';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: '传递函数_2_2c5e2589',
    name: '传递函数定义',
    nodeType: 'THEORY',
    description: '零初始条件下输出拉氏变换与输入拉氏变换之比。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation: '传递函数是线性定常系统的 s 域描述，强调输入输出之间的关系。',
    formulaContinuous: 'G(s)=Y(s)/U(s)',
    applications: ['系统建模', '控制器设计', '频域分析'],
  },
  {
    id: '零初始条件响应_2_fce2116f',
    name: '零初始条件',
    nodeType: 'THEORY',
    description: '传递函数定义的前提假设。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation: '零初始条件保证拉氏变换后不带初始项，便于直接求 Y(s)/U(s)。',
    applications: ['模型简化', '响应分解'],
  },
  {
    id: '传递函数_2_2c5e2589',
    name: '微分方程→传递函数',
    nodeType: 'THEORY',
    description: '拉氏变换并整理为输入/输出比值。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: '步骤：确定输入/输出 → 拉氏变换 → 零初始代入 → 整理为 Y/U。',
    formulaContinuous: 'a_n s^n Y(s)+\cdots+a_0 Y(s)=b_m s^m U(s)+\cdots+b_0 U(s)',
    applications: ['系统建模', '工程推导'],
  },
  {
    id: '传递函数标准形式_2_11003',
    name: '零极点形式',
    nodeType: 'THEORY',
    description: '传函可写成零点与极点的乘积形式。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation: '零点来自分子根，极点来自分母根，极点位置决定稳定性与响应形态。',
    formulaContinuous: 'G(s)=K\frac{\prod (s-z_i)}{\prod (s-p_i)}',
    applications: ['稳定性判断', '根轨迹', '频域分析'],
  },
  {
    id: '闭环特征方程_3_87c88e19',
    name: '特征多项式与系统阶次',
    nodeType: 'THEORY',
    description: '分母多项式阶次即系统阶次。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation: '特征多项式根对应系统特征根，与自然响应和稳定性直接相关。',
    applications: ['阶次判断', '动态特性分析'],
  },
  {
    id: '传递函数_2_2c5e2589',
    name: '传递函数性质',
    nodeType: 'THEORY',
    description: '线性定常系统可串并联/反馈组合。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: '串联传函相乘、并联相加，负反馈可用闭环公式快速化简。',
    applications: ['结构图化简', '系统组合'],
  },
  {
    id: '典型环节_5_8187e2ed',
    name: '典型环节',
    nodeType: 'THEORY',
    description: '比例、积分、微分、一阶惯性、二阶振荡等标准形式。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: '识别典型环节有助于快速判断系统动态特征。',
    formulaContinuous: 'G(s)=K,\;K/s,\;Ks,\;1/(Ts+1),\;\omega_n^2/(s^2+2\zeta\omega_n s+\omega_n^2)',
    applications: ['系统辨识', '结构匹配'],
  },
  {
    id: '传递函数_2_2c5e2589',
    name: 'RLC 电路示例',
    nodeType: 'THEORY',
    description: '从 KVL 方程得到二阶传函。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: 'RLC 串联电路在 s 域表现为二阶振荡，参数决定阻尼比与固有频率。',
    applications: ['电路建模', '滤波器设计'],
  },
  {
    id: '电枢控制直流电机_2_af1f8c56',
    name: '机械/电机系统示例',
    nodeType: 'THEORY',
    description: '弹簧-阻尼与电机系统可统一为标准传函。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: '机械系统常呈二阶形式，电机系统常见一阶或二阶模型。',
    applications: ['机电系统建模', '伺服控制'],
  },
  {
    id: 'MATLAB控制系统工具箱_1_e058c580',
    name: 'MATLAB 传递函数工具',
    nodeType: 'METHOD',
    description: '用 tf/zpk/step/bode 快速建模与分析。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    explanation: 'MATLAB 提供标准函数构建传函并绘制时域与频域响应。',
    applications: ['快速仿真', '课堂演示'],
  },
];

interface TransferKnowledgeDeckProps extends BaseWidgetProps {}

export default function TransferKnowledgeDeck({ onComplete, onStateChange }: TransferKnowledgeDeckProps) {
  return (
    <KnowledgeDeck
      cards={KNOWLEDGE_CARDS}
      title="传递函数知识卡片"
      description="10 张卡片串起“定义 → 推导 → 零极点 → 典型环节”"
      footer="从定义到典型环节，建立直觉。"
      targetIconClassName="text-blue-500 dark:text-blue-300"
      onComplete={onComplete}
      onStateChange={onStateChange}
    />
  );
}
