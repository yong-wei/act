'use client';

import { useState } from 'react';
import { IntroPhase } from './teaching-phases/intro-phase';
import { MechanicalPhase } from './teaching-phases/mechanical-phase';
import { ElectricalPhase } from './teaching-phases/electrical-phase';
import { AnalogyPhase } from './teaching-phases/analogy-phase';
import { PracticePhase } from './teaching-phases/practice-phase';
import type { PhysicsNode, PhysicsEdge } from './types';

interface StandalonePhaseProps {
  onComplete?: () => void;
}

export function PhysicsModelingIntroResource({ onComplete }: StandalonePhaseProps) {
  const [seaState, setSeaState] = useState(5);

  return (
    <IntroPhase
      seaState={seaState}
      onSeaStateChange={setSeaState}
      onComplete={() => onComplete?.()}
      aiMessage="保持观察，尝试调整海况后再进入下一步。"
    />
  );
}

export function PhysicsModelingMechanicalResource({ onComplete }: StandalonePhaseProps) {
  const [nodes, setNodes] = useState<PhysicsNode[]>([]);
  const [edges, setEdges] = useState<PhysicsEdge[]>([]);
  const [equation, setEquation] = useState('');

  return (
    <MechanicalPhase
      nodes={nodes}
      edges={edges}
      onModelChange={(newNodes, newEdges) => {
        setNodes(newNodes);
        setEdges(newEdges);
      }}
      onComplete={() => onComplete?.()}
      generatedEquation={equation}
      onEquationChange={(newEquation, _isComplete) => setEquation(newEquation)}
    />
  );
}

export function PhysicsModelingElectricalResource({ onComplete }: StandalonePhaseProps) {
  const [nodes, setNodes] = useState<PhysicsNode[]>([]);
  const [edges, setEdges] = useState<PhysicsEdge[]>([]);
  const [equation, setEquation] = useState('');

  return (
    <ElectricalPhase
      nodes={nodes}
      edges={edges}
      onModelChange={(newNodes, newEdges) => {
        setNodes(newNodes);
        setEdges(newEdges);
      }}
      onComplete={() => onComplete?.()}
      generatedEquation={equation}
      onEquationChange={(newEquation, _isComplete) => setEquation(newEquation)}
    />
  );
}

export function PhysicsModelingAnalogyResource({ onComplete }: StandalonePhaseProps) {
  const [completedMappings, setCompletedMappings] = useState<string[]>([]);

  const handleMappingComplete = (mappingId: string) => {
    setCompletedMappings((prev) =>
      prev.includes(mappingId) ? prev : [...prev, mappingId]
    );
  };

  return (
    <AnalogyPhase
      completedMappings={completedMappings}
      onMappingComplete={handleMappingComplete}
      onComplete={() => onComplete?.()}
    />
  );
}

export function PhysicsModelingPracticeResource({ onComplete }: StandalonePhaseProps) {
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [aiFeedback, setAiFeedback] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!practiceAnswer.trim()) return;
    setIsSubmitting(true);
    const normalized = practiceAnswer.toLowerCase();
    const correct = normalized.includes('mgl') || normalized.includes('sin');
    setIsCorrect(correct);
    setAiFeedback(
      correct
        ? '包含重力项，整体思路正确。考虑线性化处理。'
        : '请检查是否包含重力项 mgl·sinθ。'
    );
    setIsSubmitting(false);
  };

  return (
    <PracticePhase
      practiceAnswer={practiceAnswer}
      onAnswerChange={setPracticeAnswer}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      aiFeedback={aiFeedback}
      isCorrect={isCorrect}
      onComplete={() => onComplete?.()}
    />
  );
}
