'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
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
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = KNOWLEDGE_CARDS[0]?.id ?? '反馈_1_1';
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
        <h2 className="text-2xl font-bold text-slate-900">反馈控制知识卡片</h2>
        <p className="text-slate-600">4 张卡片串起反馈核心概念</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            知识导航
          </div>
          <div className="mt-4 space-y-2">
            {KNOWLEDGE_CARDS.map((card, index) => (
              <button type="button"
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
            反馈是控制的核心语言。
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
