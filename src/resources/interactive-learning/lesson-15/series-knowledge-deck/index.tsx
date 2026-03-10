'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-series-compensation',
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
    id: 'node-lead-network-feature',
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
    id: 'node-lead-max-phase',
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
    id: 'node-lead-design-steps',
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
    id: 'node-lag-network-feature',
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
    id: 'node-lag-design-steps',
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
    id: 'node-lag-lead-compensation',
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
    id: 'node-lag-lead-workflow',
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
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(KNOWLEDGE_CARDS[0]?.id ?? 'node-series-compensation');
  const [visited, setVisited] = useState<string[]>([]);

  const activeCard = useMemo(
    () => KNOWLEDGE_CARDS.find((card) => card.id === activeId) ?? KNOWLEDGE_CARDS[0],
    [activeId]
  );

  useEffect(() => {
    if (visited.includes(activeId)) return;
    const nextVisited = [...visited, activeId];
    setVisited(nextVisited);
    const progressValue = Math.round((nextVisited.length / KNOWLEDGE_CARDS.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { cardId: activeId, visitedCount: nextVisited.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
    interactive?.tracking.emit('interact', snapshot.data);

    if (nextVisited.length === KNOWLEDGE_CARDS.length && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: { visited: nextVisited, total: KNOWLEDGE_CARDS.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [activeId, visited, interactive, onComplete, onStateChange]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">串联校正与滞后超前知识卡片</h2>
        <p className="text-slate-600">8 张卡片串起“超前 → 滞后 → 联合设计”</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            知识导航
          </div>
          <div className="mt-4 space-y-2">
            {KNOWLEDGE_CARDS.map((card, index) => (
              <button
                key={card.id}
                onClick={() => setActiveId(card.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeId === card.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {index + 1}. {card.name}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            已浏览 {visited.length}/{KNOWLEDGE_CARDS.length}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Layers className="h-4 w-4" />
            先超前后滞后，双指标统筹。
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Target className="h-5 w-5 text-amber-500" />
            <h3 className="text-xl font-semibold">{activeCard?.name}</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600">{activeCard?.description}</p>
          {activeCard && (
            <div className="mt-5">
              <KnowledgeCard node={activeCard} defaultExpanded variant="inline" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
