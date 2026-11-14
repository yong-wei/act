import type { VesselCourseKey } from '@/resources/simulations/experiments/course-catalog';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import type { VesselReportSections } from '@/features/ilab/course-artifact-contract';
import { requestVesselEvidence, uploadVesselRunEvidence } from './evidence-upload';
import { listRunEvidence, readRunEvidence, listFrozenStudentModels, listModelComparisons, listLocalStepAttempts,
  saveFrozenStudentModel, saveModelComparison, saveLocalStepAttempt, saveRunUploadReceipt } from './local-evidence-store';
import type { VesselLocalStepAttempt, VesselRunEvidence } from './run-evidence';

export interface VesselReportProgress {
  id:string;
  clientRef:string;
  status:string;
  revision:number;
  score:number | null;
  maxScore:number;
  teacherFeedback:string | null;
  sections:VesselReportSections;
  hasReportHtml?:boolean;
  reviewProgress?:{earned:number;complete:boolean;finalScore:number|null}|null;
}

export async function uploadVesselCourseRun(reportClientRef:string,run:VesselRunEvidence) {
  const receipt = await uploadVesselRunEvidence(reportClientRef,run);
  await saveRunUploadReceipt(run.id,reportClientRef,receipt);
  return receipt;
}

/** 模型和对照按本人引用顺序上传，回执保存后重试沿用同一工件标识。 */
export async function uploadVesselCourseArtifacts(reportClientRef: string, courseKey: VesselCourseKey, scopeKey: string) {
  const context = {reportClientRef,courseKey,courseVersion:VESSEL_COURSE_VERSION};
  for (const summary of await listRunEvidence(scopeKey)) {
    if (summary.uploadedToReportRef === reportClientRef) continue;
    const run = await readRunEvidence(summary.id);
    if (run) await uploadVesselCourseRun(reportClientRef,run);
  }
  const models = await listFrozenStudentModels(scopeKey);
  for (const model of models) {
    if (model.serverId) continue;
    const receipt = await requestVesselEvidence<{id:string;contentHash:string}>('/api/ilab/experiment-reports', {
      ...context,model:{clientRef:model.id,payload:{...model.payload,
        operatingPoint:{...model.payload.operatingPoint,clientFrozenAtMs:model.createdAtMs}}},
    });
    await saveFrozenStudentModel({...model,serverId:receipt.id,contentHash:receipt.contentHash});
  }
  for (const comparison of await listModelComparisons(scopeKey)) {
    if (comparison.serverId) continue;
    const receipt = await requestVesselEvidence<{id:string}>('/api/ilab/experiment-reports', {
      ...context, comparison:{clientRef:comparison.id,modelClientRef:comparison.modelId,
        actuatorModelClientRef:comparison.actuatorModelId,runRef:comparison.runId,mode:comparison.mode,
        startS:comparison.startS,endS:comparison.endS,timeS:comparison.timeS,actual:comparison.actual,
        predicted:comparison.predicted,measuredInput:comparison.measuredInput,predictedInput:comparison.predictedInput,
        metrics:comparison.metrics,purpose:comparison.purpose ?? 'validation',controllerInput:comparison.controllerInput,
        outputUnit:comparison.outputUnit,actualHeadingDeg:comparison.actualHeadingDeg,predictedHeadingDeg:comparison.predictedHeadingDeg,
        createdAtMs:comparison.createdAtMs},
    });
    await saveModelComparison({...comparison,serverId:receipt.id});
  }
  for (const attempt of await listLocalStepAttempts(scopeKey)) {
    if (attempt.serverId) continue;
    const receipt = await requestVesselEvidence<{id:string;status:'submitted'|VesselLocalStepAttempt['status'];validationFeedback:string|null}>('/api/ilab/experiment-reports', {
      ...context, attempt:{clientRef:attempt.id,stepSequence:attempt.stepSequence,runRefs:attempt.runIds,
        modelClientRefs:attempt.studentModelIds,comparisonClientRefs:attempt.comparisonIds,answers:attempt.answers,
        validationFeedback:attempt.validationFeedback ?? null,outcome:attempt.status === 'pending-review' ? 'submitted' : attempt.status},
    });
    await saveLocalStepAttempt({...attempt,serverId:receipt.id,
      status:receipt.status === 'submitted' ? 'pending-review' : receipt.status,validationFeedback:receipt.validationFeedback});
  }
}

export async function saveVesselCourseReport(reportClientRef: string, courseKey: VesselCourseKey,
  sections:VesselReportSections, runRefs:string[], action:'save'|'submit', expectedRevision?:number) {
  const result = await requestVesselEvidence<{report:VesselReportProgress}>('/api/ilab/experiment-reports', {
    reportClientRef,courseKey,courseVersion:VESSEL_COURSE_VERSION,report:{sections,runRefs,action,expectedRevision},
  });
  return result.report;
}
