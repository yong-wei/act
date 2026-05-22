import {
  buildSessionFinalizeTelemetry,
  type SessionFinalizeStep,
  type SessionFinalizeTelemetry,
} from './session-finalize-telemetry';

export interface FinalizeInteractiveLessonSessionInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: SessionFinalizeTelemetry) => void;
  currentStepId: string;
  steps: readonly SessionFinalizeStep[];
}

export async function finalizeInteractiveLessonSession(
  input: FinalizeInteractiveLessonSessionInput,
) {
  await input.finishSession();
  const telemetry = buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: input.steps,
  });
  input.trackSessionFinalize(telemetry);
  return telemetry;
}
