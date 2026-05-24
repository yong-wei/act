export interface SessionFinalizeStep {
  id: string;
  stage?: string | null;
}

export interface SessionFinalizeTelemetry {
  currentStepId: string;
  finalStepId: string;
  finalStepIndex: number;
  totalSteps: number;
  completionRatio: number;
  endedBeforeAssessment: boolean;
  endedBeforeSummary: boolean;
  outcome: 'success' | 'partial';
  countAfterSessionEnd: true;
}

export interface FinalizeInteractiveLessonSessionInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: SessionFinalizeTelemetry) => void;
  currentStepId: string;
  steps: readonly SessionFinalizeStep[];
}

function buildInteractiveSessionFinalizeTelemetry({
  currentStepId,
  steps,
}: {
  currentStepId: string;
  steps: readonly SessionFinalizeStep[];
}): SessionFinalizeTelemetry {
  const totalSteps = steps.length;
  const rawIndex = steps.findIndex((step) => step.id === currentStepId);
  const finalStepIndex = rawIndex >= 0 ? rawIndex : 0;
  const finalStepId = steps[finalStepIndex]?.id ?? currentStepId;
  const assessmentStepIndex = steps.findIndex((step) => step.stage === 'P3');
  const completionRatio =
    totalSteps > 0 ? Math.min(1, Math.max(0, (finalStepIndex + 1) / totalSteps)) : 0;
  const endedBeforeAssessment =
    assessmentStepIndex >= 0 ? finalStepIndex < assessmentStepIndex : completionRatio < 1;
  const endedBeforeSummary = totalSteps > 0 ? finalStepIndex < totalSteps - 1 : true;

  return {
    currentStepId,
    finalStepId,
    finalStepIndex,
    totalSteps,
    completionRatio,
    endedBeforeAssessment,
    endedBeforeSummary,
    outcome: endedBeforeAssessment || endedBeforeSummary || completionRatio < 1 ? 'partial' : 'success',
    countAfterSessionEnd: true,
  };
}

export async function finalizeInteractiveLessonSession(
  input: FinalizeInteractiveLessonSessionInput,
) {
  await input.finishSession();
  const telemetry = buildInteractiveSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: input.steps,
  });
  input.trackSessionFinalize(telemetry);
  return telemetry;
}
