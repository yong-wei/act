import type { VesselRunEvidence } from './run-evidence';

export function vesselEvidenceOpeningInput(reportClientRef: string, run: VesselRunEvidence) {
  return { reportClientRef, runRef: run.id, courseKey: run.courseKey, courseVersion: run.courseVersion,
    stepSequence: run.stepSequence, configuration: run.configuration, input: run.initialInput,
    parameterHash: run.parameterHash, initialCheckpoint: run.initialCheckpoint, runtimeVersion: run.runtimeVersion,
    prediction: run.prediction, startedAtMs: run.createdAtMs, designStudentModelId: run.designStudentModelId || undefined,
    courseSettings: run.courseSettings, controllerSourceRunId: run.controllerSourceRunId || undefined };
}
