'use client';

import { useState } from 'react';
import { BridgePhase } from './phases/bridge-phase';
import { ObjectivePhase } from './phases/objective-phase';
import { PretestPhase } from './phases/pretest-phase';
import { MechanicalPhase } from './phases/mechanical-phase';
import { ElectricalPhase } from './phases/electrical-phase';
import { AnalogyPhase } from './phases/analogy-phase';
import { PosttestPhase } from './phases/posttest-phase';
import { SummaryPhase } from './phases/summary-phase';

interface StandalonePhaseProps {
  onComplete?: () => void;
}

export function Lesson02BridgeResource({ onComplete }: StandalonePhaseProps) {
  return <BridgePhase onComplete={() => onComplete?.()} />;
}

export function Lesson02ObjectiveResource({ onComplete }: StandalonePhaseProps) {
  return (
    <ObjectivePhase
      unlockedObjectives={[]}
      onComplete={() => onComplete?.()}
    />
  );
}

export function Lesson02PretestResource({ onComplete }: StandalonePhaseProps) {
  return (
    <PretestPhase
      onComplete={(_score, _weakAreas) => onComplete?.()}
      onNext={() => onComplete?.()}
    />
  );
}

export function Lesson02MechanicalResource({ onComplete }: StandalonePhaseProps) {
  return (
    <MechanicalPhase
      weakAreas={[]}
      onComplete={() => onComplete?.()}
      onNext={() => onComplete?.()}
    />
  );
}

export function Lesson02ElectricalResource({ onComplete }: StandalonePhaseProps) {
  return (
    <ElectricalPhase
      weakAreas={[]}
      onComplete={() => onComplete?.()}
      onNext={() => onComplete?.()}
    />
  );
}

export function Lesson02AnalogyResource({ onComplete }: StandalonePhaseProps) {
  const [completedCount, setCompletedCount] = useState(0);

  return (
    <AnalogyPhase
      completedCount={completedCount}
      onProgress={setCompletedCount}
      onComplete={() => onComplete?.()}
    />
  );
}

export function Lesson02PosttestResource({ onComplete }: StandalonePhaseProps) {
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
      onComplete={() => onComplete?.()}
    />
  );
}

export function Lesson02SummaryResource() {
  return <SummaryPhase unlockedObjectives={[]} pretestScore={0} />;
}
