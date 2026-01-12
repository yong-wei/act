'use client';

import { useCallback, useEffect, useState } from 'react';
import { BridgePhase } from './phases/bridge-phase';
import { ObjectivePhase } from './phases/objective-phase';
import { PretestPhase } from './phases/pretest-phase';
import { MechanicalPhase } from './phases/mechanical-phase';
import { ElectricalPhase } from './phases/electrical-phase';
import { AnalogyPhase } from './phases/analogy-phase';
import { PosttestPhase } from './phases/posttest-phase';
import { SummaryPhase } from './phases/summary-phase';
import { ANALOGY_MAPPINGS } from '../physics-modeling/types';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult, WidgetState } from '@/resources/widgets/widget-props';

interface StandalonePhaseProps extends BaseWidgetProps {}

function useWidgetBridge(onComplete?: (result?: WidgetResult) => void, onStateChange?: (state: WidgetState) => void) {
  const interactive = useOptionalInteractiveContext();

  const reportProgress = useCallback((progress: number, data: Record<string, unknown> = {}) => {
    const snapshot: WidgetState = {
      phase: typeof data.phase === 'string' ? data.phase : undefined,
      progress,
      data,
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progress);
    interactive?.tracking.emit('interact', data);
  }, [interactive, onStateChange]);

  const markComplete = useCallback((result?: WidgetResult) => {
    const completion = result || { success: true };
    interactive?.progress.markComplete(completion);
    onComplete?.(completion);
  }, [interactive, onComplete]);

  return { reportProgress, markComplete };
}

export function Lesson02BridgeResource({ onComplete, onStateChange }: StandalonePhaseProps) {
  const { reportProgress, markComplete } = useWidgetBridge(onComplete, onStateChange);
  return <BridgePhase onComplete={() => {
    reportProgress(100, { phase: 'bridge' });
    markComplete();
  }} />;
}

export function Lesson02ObjectiveResource({ onComplete, onStateChange }: StandalonePhaseProps) {
  const { reportProgress, markComplete } = useWidgetBridge(onComplete, onStateChange);
  return (
    <ObjectivePhase
      unlockedObjectives={[]}
      onComplete={() => {
        reportProgress(100, { phase: 'objective' });
        markComplete();
      }}
    />
  );
}

export function Lesson02PretestResource({ onComplete, onStateChange }: StandalonePhaseProps) {
  const { reportProgress, markComplete } = useWidgetBridge(onComplete, onStateChange);
  return (
    <PretestPhase
      onComplete={(score, weakAreas) => {
        reportProgress(100, { phase: 'pretest', score, weakAreas });
        markComplete({ success: true, score: Math.round(score || 0), data: { weakAreas } });
      }}
      onNext={() => {
        reportProgress(100, { phase: 'pretest' });
        markComplete();
      }}
    />
  );
}

export function Lesson02MechanicalResource({ onComplete, onStateChange }: StandalonePhaseProps) {
  const { reportProgress, markComplete } = useWidgetBridge(onComplete, onStateChange);
  return (
    <MechanicalPhase
      weakAreas={[]}
      onComplete={() => {
        reportProgress(100, { phase: 'participatory-mechanical' });
        markComplete();
      }}
      onNext={() => {
        reportProgress(100, { phase: 'participatory-mechanical' });
        markComplete();
      }}
    />
  );
}

export function Lesson02ElectricalResource({ onComplete, onStateChange }: StandalonePhaseProps) {
  const { reportProgress, markComplete } = useWidgetBridge(onComplete, onStateChange);
  return (
    <ElectricalPhase
      weakAreas={[]}
      onComplete={() => {
        reportProgress(100, { phase: 'participatory-electrical' });
        markComplete();
      }}
      onNext={() => {
        reportProgress(100, { phase: 'participatory-electrical' });
        markComplete();
      }}
    />
  );
}

export function Lesson02AnalogyResource({ onComplete, onStateChange }: StandalonePhaseProps) {
  const { reportProgress, markComplete } = useWidgetBridge(onComplete, onStateChange);
  const [completedCount, setCompletedCount] = useState(0);
  const totalMappings = ANALOGY_MAPPINGS.length;

  return (
    <AnalogyPhase
      completedCount={completedCount}
      onProgress={(count) => {
        setCompletedCount(count);
        const progressValue = Math.round((count / totalMappings) * 100);
        reportProgress(progressValue, { phase: 'participatory-analogy', completedCount: count });
      }}
      onComplete={() => {
        reportProgress(100, { phase: 'participatory-analogy', completedCount });
        markComplete();
      }}
    />
  );
}

export function Lesson02PosttestResource({ onComplete, onStateChange }: StandalonePhaseProps) {
  const { reportProgress, markComplete } = useWidgetBridge(onComplete, onStateChange);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = () => {
    if (!answer.trim()) return;
    setIsLoading(true);
    const normalized = answer.toLowerCase();
    const correct = normalized.includes('mgl') || normalized.includes('sin');
    setIsCorrect(correct);
    setFeedback(
      correct
        ? '包含重力矩项，思路正确。可以继续考虑线性化。'
        : '检查是否遗漏重力矩项 mgl·sinθ。'
    );
    setIsLoading(false);
  };

  return (
    <PosttestPhase
      answer={answer}
      feedback={feedback}
      isCorrect={isCorrect}
      isLoading={isLoading}
      onAnswerChange={setAnswer}
      onSubmit={handleSubmit}
      onComplete={() => {
        reportProgress(100, { phase: 'posttest', isCorrect });
        markComplete({ success: !!isCorrect, score: isCorrect ? 100 : 60, data: { answer, feedback } });
      }}
    />
  );
}

export function Lesson02SummaryResource({ onComplete, onStateChange }: StandalonePhaseProps) {
  const { reportProgress, markComplete } = useWidgetBridge(onComplete, onStateChange);

  useEffect(() => {
    reportProgress(100, { phase: 'summary' });
    markComplete();
  }, [reportProgress, markComplete]);

  return <SummaryPhase unlockedObjectives={[]} pretestScore={0} />;
}
