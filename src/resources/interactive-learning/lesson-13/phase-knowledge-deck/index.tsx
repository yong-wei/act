'use client';

import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { KnowledgeDeck } from '@/resources/interactive-learning/shared/knowledge-deck';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: '开环幅相特性曲线_5_fd86e289',
    name: '开环幅相特性（奈奎斯特图）',
    nodeType: 'THEORY',
    description: '频率响应的幅值与相位在复平面形成的极坐标轨迹。',
    lessonId: 'lesson-13',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '将 G(jω)=|G(jω)|∠φ(ω) 作为向量，随 ω 从 0 到 ∞ 扫频得到轨迹；它就是开环幅相特性，也称 Nyquist 图。',
    formulaContinuous: 'G(jω) = |G(jω)| ∠ φ(ω)',
    applications: ['稳定性判据', '频域校正', '频响实验验证'],
  },
  {
    id: '奈奎斯特曲线_5_deaa0845',
    name: '起点与终点',
    nodeType: 'THEORY',
    description: '低频段起点由 G(0) 决定，高频段终点由传函阶次决定。',
    lessonId: 'lesson-13',
    bloomLevel: 'REMEMBER',
    knowledgeDim: 'FACTUAL',
    explanation:
      '低频起点通常为 G(0)，高频终点随系统阶次趋向原点并呈现固定相角（每个高频极点贡献 -90°）。',
    formulaContinuous: 'lim_{ω→0} G(jω),  lim_{ω→∞} G(jω)',
    applications: ['概略绘制', '形状判断'],
  },
  {
    id: '穿越频率_5_c4c2b93c',
    name: '负实轴交点与穿越频率',
    nodeType: 'METHOD',
    description: '相位穿越与幅值穿越决定曲线是否接近 -1 点。',
    lessonId: 'lesson-13',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '负实轴交点对应 φ(ω) = -180° 的相位穿越频率；|G(jω)| = 1 对应幅值穿越频率。二者在 Bode 图上分别为相位曲线穿越 -180° 与幅频曲线穿越 0 dB。',
    formulaContinuous: 'φ(ω_c) = -180°,  |G(jω_g)| = 1',
    applications: ['稳定裕度', '对数判据'],
  },
  {
    id: '奈奎斯特曲线_5_deaa0845',
    name: '特征点求法',
    nodeType: 'METHOD',
    description: '通过实部/虚部方程锁定关键交点与转向趋势。',
    lessonId: 'lesson-13',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '先写出 G(jω) 的实部与虚部，求实轴或虚轴交点；再判断随 ω 增加时实虚部的符号变化，确定转向与弯折。',
    formulaContinuous: 'G(jω) = Re(ω) + j Im(ω)',
    applications: ['手工绘制', '近似判断'],
  },
  {
    id: '奈奎斯特曲线_5_deaa0845',
    name: '概略绘制步骤',
    nodeType: 'METHOD',
    description: '三步走：求频响 → 找特征点 → 概略连线。',
    lessonId: 'lesson-13',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '步骤一：求 G(jω)；步骤二：起点/终点/负实轴交点；步骤三：结合单调收缩、零点扭曲等规律完成草图。',
    formulaContinuous: 'Step 1: G(jω) · Step 2: key points · Step 3: sketch',
    applications: ['课堂推导', '快速判稳'],
  },
  {
    id: '幅角原理_5_f843970e',
    name: '幅角原理',
    nodeType: 'THEORY',
    description: '闭合曲线映射的转角变化量与零极点数量关联。',
    lessonId: 'lesson-13',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '当 s 平面曲线包围 Z 个零点与 P 个极点时，F(s) 的映射绕原点的圈数与 Z-P 成比例，这一关系构成 Nyquist 判据的理论基础。',
    formulaContinuous: 'Δarg F(s) = 2π(Z - P)',
    applications: ['稳定判据推导'],
  },
  {
    id: '奈奎斯特稳定判据_5_a1b34560',
    name: '奈奎斯特稳定判据',
    nodeType: 'THEORY',
    description: '由开环曲线包围 -1 的次数判断闭环极点分布。',
    lessonId: 'lesson-13',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '令 N 为 Nyquist 曲线逆时针包围 -1 的次数，P 为右半平面开环极点数，则闭环右半平面极点数 Z = P - N。稳定要求 Z=0。',
    formulaContinuous: 'Z = P - N (N: CCW)',
    applications: ['判稳', '结构调整'],
  },
  {
    id: '对数稳定判据_5_50391b50',
    name: '对数稳定判据',
    nodeType: 'METHOD',
    description: '用 Bode 图的 0 dB 与 -180° 穿越次数近似判稳。',
    lessonId: 'lesson-13',
    bloomLevel: 'EVALUATE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '将 Nyquist 判据转为对数坐标：幅频曲线穿越 0 dB 时，观察相位曲线穿越 -180° 的方向与次数，等价判定稳定性。',
    formulaContinuous: '|G(jω)| = 1 ↔ 0 dB,  φ(ω) = -180°',
    applications: ['工程快速判稳', '裕度分析'],
  },
];

interface PhaseKnowledgeDeckProps extends BaseWidgetProps {}

export default function PhaseKnowledgeDeck({ onComplete, onStateChange }: PhaseKnowledgeDeckProps) {
  return (
    <KnowledgeDeck
      cards={KNOWLEDGE_CARDS}
      title="幅相特性知识卡片"
      description="8 张关键卡片贯通“幅相特性 → 判稳思维”"
      footer="先理解定义，再用判据推稳定。"
      targetIconClassName="text-cyan-500 dark:text-cyan-300"
      onComplete={onComplete}
      onStateChange={onStateChange}
    />
  );
}
