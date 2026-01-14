'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-laplace-transform',
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
    id: 'node-laplace-interpretation',
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
    id: 'node-laplace-properties',
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
    id: 'node-inverse-laplace-methods',
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
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(KNOWLEDGE_CARDS[0]?.id ?? 'node-laplace-transform');
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
        <h2 className="text-2xl font-bold text-slate-900">拉氏变换知识卡片</h2>
        <p className="text-slate-600">4 张卡片串起“直觉 → 定理 → 反变换”</p>
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
            先理解，再应用。
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
