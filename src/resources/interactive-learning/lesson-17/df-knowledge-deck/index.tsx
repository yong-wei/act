'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-describing-function-assumptions',
    name: '描述函数法的基本假设',
    nodeType: 'METHOD',
    description: '单一非线性 + 线性部分 + 低通滤波特性。',
    lessonId: 'lesson-17',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '系统可化为非线性环节与线性部分串联，非线性为奇对称，线性部分低通以削弱高次谐波。',
    applications: ['适用性判断', '模型简化'],
  },
  {
    id: 'node-negative-inverse-describing',
    name: '负倒描述函数',
    nodeType: 'METHOD',
    description: '将 -1/N(A) 绘制在复平面上，与 G(jω) 比较。',
    lessonId: 'lesson-17',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '负倒描述函数相当于把“非线性幅值效应”转化为复平面上的轨迹，便于交点判别。',
    formulaContinuous: '-1/N(A)',
    applications: ['交点判别', '自振分析'],
  },
  {
    id: 'node-nonlinear-stability-criterion',
    name: '非线性系统稳定性判据',
    nodeType: 'THEORY',
    description: 'G(jω) 不包围 -1/N(A) 时闭环稳定。',
    lessonId: 'lesson-17',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '将 -1/N(A) 视为广义的 (-1,0) 点，G(jω) 轨迹包围关系决定稳定性。',
    applications: ['判稳', '稳定裕度评估'],
  },
  {
    id: 'node-limit-cycle-condition',
    name: '自振存在条件',
    nodeType: 'THEORY',
    description: 'G(jω) 与 -1/N(A) 相交时可能出现自振。',
    lessonId: 'lesson-17',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '交点满足 N(A)G(jω)=-1，是自振存在的必要条件。',
    formulaContinuous: 'N(A)G(j\omega)=-1',
    applications: ['极限环判断'],
  },
  {
    id: 'node-limit-cycle-stability',
    name: '自振稳定性判别',
    nodeType: 'METHOD',
    description: '用微小扰动分析判断振幅是否收敛回交点。',
    lessonId: 'lesson-17',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '若扰动后轨迹推动振幅回到交点，则该自振稳定；否则不稳定。',
    applications: ['极限环稳定性分析'],
  },
  {
    id: 'node-negative-inverse-plot',
    name: '负倒描述函数绘制',
    nodeType: 'METHOD',
    description: '典型非线性往往在负实轴或第三象限形成轨迹。',
    lessonId: 'lesson-17',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '继电器/饱和/死区等特性可在负实轴上形成单调曲线，滞环则产生复数轨迹。',
    applications: ['快速作图', '交点求解'],
  },
  {
    id: 'node-limit-cycle-solving',
    name: '自振参数求解',
    nodeType: 'METHOD',
    description: '由 N(A)G(jω)=-1 同时解出振幅与频率。',
    lessonId: 'lesson-17',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '将幅值方程与相位方程拆分，求解 A 与 ω 的对应关系。',
    applications: ['自振频率估计', '工程设计'],
  },
];

interface DfKnowledgeDeckProps extends BaseWidgetProps {}

export default function DfKnowledgeDeck({ onComplete, onStateChange }: DfKnowledgeDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(KNOWLEDGE_CARDS[0]?.id ?? 'node-describing-function-assumptions');
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
        <h2 className="text-2xl font-bold text-slate-900">描述函数分析知识卡片</h2>
        <p className="text-slate-600">7 张卡片贯通“假设 → 交点 → 自振”</p>
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
            先掌握判据，再计算参数。
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
