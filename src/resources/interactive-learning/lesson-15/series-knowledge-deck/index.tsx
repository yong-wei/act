'use client';

import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { KnowledgeDeck } from '@/resources/interactive-learning/shared/knowledge-deck';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: '串联校正_6_fede5751',
    name: '串联校正（Series Compensation）',
    nodeType: 'THEORY',
    description: '在开环通道串联校正网络以调整频率特性。',
    lessonId: 'lesson-15',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '串联校正通过引入零极点调整开环幅相特性，目标是满足稳态误差、相角裕度与带宽等指标。常见结构包括超前、滞后与滞后-超前联合。',
    applications: ['频域调参', '控制器设计', '性能指标协调'],
  },
  {
    id: '超前网络_6_9cc2ad14',
    name: '超前网络特性',
    nodeType: 'THEORY',
    description: '相角超前、幅值抬升，提升相角裕度与响应速度。',
    lessonId: 'lesson-15',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '超前网络在中高频提供相角超前，并抬升幅值曲线，从而提高相角裕度与穿越频率。适合动态性能不足或相角裕度不够的场景。',
    formulaContinuous: 'G_c(s)=K\frac{Ts+1}{aTs+1},\;0<a<1',
    applications: ['提高相角裕度', '加快响应', '改善超调'],
  },
  {
    id: '无源超前网络_6_f044ba0d',
    name: '最大超前角',
    nodeType: 'THEORY',
    description: '一级超前网络可提供的最大相角超前。',
    lessonId: 'lesson-15',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '最大超前角由参数 a 决定，a 越小相角超前越大，但幅值抬升也更明显。通常在目标相角裕度附近布置峰值频率。',
    formulaContinuous: 'phi_{max}=\sin^{-1}\frac{1-a}{1+a},\;\omega_m=\frac{1}{T\sqrt{a}}',
    applications: ['参数估算', '频域设计'],
  },
  {
    id: '超前网络_6_9cc2ad14',
    name: '超前网络设计步骤',
    nodeType: 'METHOD',
    description: '由相角裕度目标反推 a 与 T。',
    lessonId: 'lesson-15',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '流程：确定目标相角裕度 → 估算所需相角超前 → 计算 a → 选取峰值频率并定 T → 验算裕度与带宽。',
    applications: ['设计流程', '工程校正'],
  },
  {
    id: '滞后网络_6_89977f28',
    name: '滞后网络特性',
    nodeType: 'THEORY',
    description: '低频增益提升、高频衰减并带来相角滞后。',
    lessonId: 'lesson-15',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '滞后网络提升低频增益以改善稳态误差，同时在高频衰减以抑制噪声，但会引入相位滞后，需避免削弱相角裕度。',
    formulaContinuous: 'G_c(s)=K\frac{Ts+1}{bTs+1},\;b>1',
    applications: ['稳态精度提升', '抗扰与噪声抑制'],
  },
  {
    id: '滞后网络_6_89977f28',
    name: '滞后网络设计步骤',
    nodeType: 'METHOD',
    description: '利用幅值衰减挖掘相角储备并提高低频增益。',
    lessonId: 'lesson-15',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '流程：检查相角裕度是否充足 → 根据稳态误差确定低频增益需求 → 选择 b 并布置零极点 → 验算幅值与相位影响。',
    applications: ['稳态误差设计', '幅值整形'],
  },
  {
    id: '串联滞后-超前校正_6_23ee8cb9',
    name: '滞后-超前联合校正',
    nodeType: 'THEORY',
    description: '同时提升稳态精度与相角裕度的双目标方案。',
    lessonId: 'lesson-15',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '当稳态误差偏大且相角裕度不足时，单独使用滞后或超前难以满足目标，可采用滞后-超前联合校正。',
    applications: ['双指标平衡', '复杂性能目标'],
  },
  {
    id: '无源滞后-超前网络_6_66afb311',
    name: '滞后-超前设计流程',
    nodeType: 'METHOD',
    description: '先超前、后滞后，分阶段完成指标达成。',
    lessonId: 'lesson-15',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '先用超前网络提升相角裕度与带宽，再根据超前后的幅值水平配置滞后网络提高低频增益，最后统一验算。',
    applications: ['综合设计流程', '工程验证'],
  },
];

interface SeriesKnowledgeDeckProps extends BaseWidgetProps {}

export default function SeriesKnowledgeDeck({ onComplete, onStateChange }: SeriesKnowledgeDeckProps) {
  return (
    <KnowledgeDeck
      cards={KNOWLEDGE_CARDS}
      title="串联校正与滞后超前知识卡片"
      description="8 张卡片串起“超前 → 滞后 → 联合设计”"
      footer="先超前后滞后，双指标统筹。"
      targetIconClassName="text-amber-500 dark:text-amber-300"
      onComplete={onComplete}
      onStateChange={onStateChange}
    />
  );
}
