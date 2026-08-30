'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

export interface KnowledgeDeckVisitState {
  activeIndex: number;
  visitedIndices: number[];
}

interface KnowledgeDeckProps extends BaseWidgetProps {
  cards: LessonKnowledgeCard[];
  title: string;
  description: string;
  footer: string;
  targetIconClassName?: string;
}

export function recordKnowledgeDeckVisit(
  current: KnowledgeDeckVisitState,
  nextActiveIndex: number
): KnowledgeDeckVisitState {
  return {
    activeIndex: nextActiveIndex,
    visitedIndices: current.visitedIndices.includes(nextActiveIndex)
      ? current.visitedIndices
      : [...current.visitedIndices, nextActiveIndex],
  };
}

export function knowledgeDeckCardKey(card: Pick<LessonKnowledgeCard, 'id'>, index: number): string {
  return `${card.id}:${index}`;
}

export function KnowledgeDeck({
  cards,
  title,
  description,
  footer,
  targetIconClassName = 'text-blue-500 dark:text-blue-300',
  onComplete,
  onStateChange,
}: KnowledgeDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const [visitState, setVisitState] = useState<KnowledgeDeckVisitState>({
    activeIndex: 0,
    visitedIndices: cards.length > 0 ? [0] : [],
  });
  const publishedVisitedCountRef = useRef(0);
  const allCardsVisited = cards.length > 0 && visitState.visitedIndices.length === cards.length;
  const completionResult = useMemo<WidgetResult>(() => ({
    success: true,
    score: 100,
    data: {
      visited: visitState.visitedIndices
        .map((index) => cards[index]?.id)
        .filter((id): id is string => !!id),
      visitedIndices: visitState.visitedIndices,
      total: cards.length,
    },
  }), [cards, visitState.visitedIndices]);

  const activeCard = useMemo(
    () => cards[visitState.activeIndex] ?? cards[0],
    [cards, visitState.activeIndex]
  );

  const recordVisit = useCallback((nextActiveIndex: number) => {
    setVisitState((current) => recordKnowledgeDeckVisit(current, nextActiveIndex));
  }, []);

  useEffect(() => {
    const visitedCount = visitState.visitedIndices.length;
    if (cards.length === 0 || publishedVisitedCountRef.current >= visitedCount) return;

    publishedVisitedCountRef.current = visitedCount;
    const latestVisitedIndex = visitState.visitedIndices[visitedCount - 1] ?? 0;
    const latestVisitedCard = cards[latestVisitedIndex] ?? cards[0];
    const progressValue = Math.round((visitedCount / cards.length) * 100);

    const snapshot = {
      progress: progressValue,
      data: {
        cardId: latestVisitedCard.id,
        knowledgeNodeId: latestVisitedCard.id,
        cardIndex: latestVisitedIndex,
        visitedCount,
      },
      timestamp: Date.now(),
    };

    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
    interactive?.tracking.emit('interact', snapshot.data);
  }, [cards, interactive, onStateChange, visitState.visitedIndices]);

  return (
    <div className="mx-auto w-full max-w-6xl text-slate-900 dark:text-slate-100" data-knowledge-deck-root="">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{title}</h2>
        <p className="text-slate-600 dark:text-slate-300">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/80">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <BookOpen className="h-4 w-4" />
            知识导航
          </div>
          <div className="mt-4 space-y-2">
            {cards.map((card, index) => (
              <button
                type="button"
                key={knowledgeDeckCardKey(card, index)}
                onClick={() => recordVisit(index)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  visitState.activeIndex === index
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {index + 1}. {card.name}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
            已浏览 {visitState.visitedIndices.length}/{cards.length}
          </div>
          <PathResourceContinueAction
            enabled={allCardsVisited}
            result={completionResult}
            onComplete={onComplete}
          />
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Layers className="h-4 w-4" />
            {footer}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950/80">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Target className={`h-5 w-5 ${targetIconClassName}`} />
            <h3 className="text-xl font-semibold">{activeCard?.name}</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {activeCard?.description}
          </p>
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
