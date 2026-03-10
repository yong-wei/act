'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-differential-equation-model',
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
    id: 'node-modeling-methods',
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
    id: 'node-black-box-modeling',
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
    id: 'node-system-model-types',
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
    id: 'node-differential-modeling-steps',
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
    id: 'node-modeling-examples',
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
    id: 'node-linearization-equilibrium',
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
    id: 'node-motion-modes',
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
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(KNOWLEDGE_CARDS[0]?.id ?? 'node-differential-equation-model');
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
        <h2 className="text-2xl font-bold text-slate-900">微分方程建模知识卡片</h2>
        <p className="text-slate-600">8 张卡片贯通“方法 → 步骤 → 示例 → 线性化”</p>
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
            先方法后流程，再看案例。
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Target className="h-5 w-5 text-emerald-500" />
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
