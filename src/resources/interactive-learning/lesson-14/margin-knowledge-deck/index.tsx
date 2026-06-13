'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-stability-margin-definition',
    name: '稳定裕度（Stability Margin）',
    nodeType: 'THEORY',
    description: '系统在幅值与相角方面的稳定储备量，描述“离失稳边界还有多远”。',
    lessonId: 'lesson-14',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '稳定裕度包含相角裕度与幅值裕度，两者共同刻画开环频率特性距离临界稳定边界的余量。裕度越大，系统越稳健，但响应可能变慢。',
    formulaContinuous: '\\varphi_m = 180^\\circ + \\varphi(\\omega_g),\\; A_m = 1/|G(j\\omega_c)|',
    applications: ['鲁棒性评估', '控制器调参', '工程安全裕度'],
  },
  {
    id: 'node-phase-margin',
    name: '相角裕度',
    nodeType: 'THEORY',
    description: '增益穿越频率处相位与 -180° 的距离。',
    lessonId: 'lesson-14',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '在 |G(jω)|=1 的频率处读取相位，与 -180° 的差值即相角裕度。相角裕度越大，一般超调越小、阻尼越好。',
    formulaContinuous: '\\varphi_m = 180^\\circ + \\varphi(\\omega_g)',
    applications: ['超调控制', '动态响应评估', '稳定性设计'],
  },
  {
    id: 'node-gain-margin',
    name: '幅值裕度',
    nodeType: 'THEORY',
    description: '相位穿越频率处幅值距离 1（0 dB）的倍率。',
    lessonId: 'lesson-14',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '当相位达到 -180° 时读取幅值，幅值裕度表示允许的增益放大倍数。通常用 dB 表示。',
    formulaContinuous: 'A_m = 1/|G(j\\omega_c)|,\\; 20\\log_{10} A_m',
    applications: ['增益调节', '安全裕度评估'],
  },
  {
    id: 'node-margin-bode-estimation',
    name: 'Bode 图估算稳定裕度',
    nodeType: 'METHOD',
    description: '用幅频与相频曲线的穿越点快速估算裕度。',
    lessonId: 'lesson-14',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '步骤：先找 0 dB 穿越频率 ω_g，读取相位计算相角裕度；再找相位 -180° 穿越频率 ω_c，读取幅值计算增益裕度。',
    formulaContinuous: '|G(j\\omega_g)|=1,\\; \\varphi(\\omega_c)=-180^\\circ',
    applications: ['快速判稳', '工程评估', '控制调参与验证'],
  },
  {
    id: 'node-three-band-theory',
    name: '三频段理论',
    nodeType: 'THEORY',
    description: '低频段、中频段、高频段各自对应不同的性能指标。',
    lessonId: 'lesson-14',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '三频段理论强调频域分工：低频段决定稳态误差与抗扰，中频段决定动态性能与带宽，高频段决定噪声抑制与鲁棒性。',
    applications: ['频域整形', '性能需求分解'],
  },
  {
    id: 'node-low-frequency-band',
    name: '低频段：稳态误差',
    nodeType: 'THEORY',
    description: '低频增益越高，稳态误差越小。',
    lessonId: 'lesson-14',
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '低频段的增益决定系统型别与跟踪能力。提高低频增益可改善稳态误差与抗扰，但需注意执行机构饱和。',
    applications: ['稳态误差控制', '抗扰性能设计'],
  },
  {
    id: 'node-mid-frequency-band',
    name: '中频段：动态性能',
    nodeType: 'THEORY',
    description: '中频段与穿越频率附近形状决定超调与调节时间。',
    lessonId: 'lesson-14',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '中频段的斜率与带宽影响响应速度与相角裕度。常希望以约 -20 dB/dec 的斜率穿越 0 dB，保证足够裕度。',
    applications: ['带宽设计', '动态响应优化'],
  },
  {
    id: 'node-high-frequency-band',
    name: '高频段：抗噪与鲁棒性',
    nodeType: 'THEORY',
    description: '高频衰减用于抑制噪声与未建模高频动态。',
    lessonId: 'lesson-14',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '高频段越陡，噪声衰减越强，但可能带来相位滞后。高频整形需在抗噪与稳定裕度之间权衡。',
    applications: ['噪声抑制', '鲁棒性提升'],
  },
];

interface MarginKnowledgeDeckProps extends BaseWidgetProps {}

export default function MarginKnowledgeDeck({ onComplete, onStateChange }: MarginKnowledgeDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = KNOWLEDGE_CARDS[0]?.id ?? 'node-stability-margin-definition';
  const [activeId, setActiveId] = useState(initialActiveId);
  const [visited, setVisited] = useState<string[]>(() => [initialActiveId]);
  const publishedVisitedCountRef = useRef(0);

  const activeCard = useMemo(
    () => KNOWLEDGE_CARDS.find((card) => card.id === activeId) ?? KNOWLEDGE_CARDS[0],
    [activeId]
  );

  const recordVisit = useCallback((nextActiveId: string) => {
    setActiveId(nextActiveId);
    setVisited((current) =>
      current.includes(nextActiveId) ? current : [...current, nextActiveId]
    );
  }, []);

  useEffect(() => {
    if (publishedVisitedCountRef.current >= visited.length) return;
    publishedVisitedCountRef.current = visited.length;
    const nextVisited = visited;
    const latestVisitedId = nextVisited[nextVisited.length - 1] ?? initialActiveId;
    const progressValue = Math.round((nextVisited.length / KNOWLEDGE_CARDS.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { cardId: latestVisitedId, visitedCount: nextVisited.length },
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
  }, [initialActiveId, visited, interactive, onComplete, onStateChange]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">稳定裕度与三频段知识卡片</h2>
        <p className="text-slate-600">8 张关键卡片贯通“稳定裕度 → 频段分工 → 设计取舍”</p>
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
                onClick={() => recordVisit(card.id)}
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
            先看裕度，再看频段分工。
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
