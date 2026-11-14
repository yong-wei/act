import type { Prisma } from '@prisma/client';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { studentModelSaveSchema } from '@/lib/student-model-artifact-contract';
import { DESTROYER_COURSE_STEPS } from '@/resources/simulations/experiments/destroyer-course';
import { validateDestroyerCourseEvidence, type DestroyerComparisonEvidence, type DestroyerModelEvidence } from '@/resources/simulations/experiments/destroyer-evidence';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { VESSEL_EVIDENCE_DOMAIN, vesselRunStorageSummary } from './course-evidence-service';
import type { VesselEvidenceOpening } from './course-evidence-contract';
import type { VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselCourseArtifactInput } from './course-artifact-contract';
import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';

/** 从同一报告的实际运行和冻结工件重建验收引用，客户端反馈仅作作品保存。 */
export async function validateSavedVesselAttempt(tx:Prisma.TransactionClient,userId:string,reportId:string,
  experimentKey:string,courseKey:string,
  attempt:Pick<NonNullable<VesselCourseArtifactInput['attempt']>,'stepSequence'|'runRefs'|'modelClientRefs'|'comparisonClientRefs'|'answers'|'outcome'>,
  includeAllArtifacts = false) {
  const [storedRuns,storedModels,storedComparisons] = await Promise.all([
    tx.simulationRun.findMany({where:{ownerUserId:userId,sourceDomain:VESSEL_EVIDENCE_DOMAIN,summary:{path:['reportId'],equals:reportId}}}),
    tx.studentModelArtifact.findMany({where:{userId,experimentKey}}),
    tx.comparisonArtifact.findMany({where:{userId,experimentKey}}),
  ]);
  const runs:VesselRunSummary[] = [];
  for (const run of storedRuns) {
    const summary = vesselRunStorageSummary(run);
    const opening = await readSimulationTraceChunk<VesselEvidenceOpening>(summary.openingReference);
    let finalInput:VesselSessionInput | undefined;
    if (run.completedAt) {
      const ending = await readSimulationTraceChunk<{appliedFinalInput?:VesselSessionInput;checkpoint?:string}>(summary.lastCheckpointReference);
      finalInput = ending.appliedFinalInput ?? (ending.checkpoint ? JSON.parse(ending.checkpoint).input as VesselSessionInput : undefined);
    }
    runs.push({id:run.sourceRefId,scopeKey:experimentKey,courseVersion:summary.courseVersion,
      stepSequence:summary.stepSequence,createdAtMs:opening.startedAtMs,stoppedAtMs:run.completedAt?.getTime() ?? null,
      lastTimeS:summary.lastTimeS,durationS:summary.lastTimeS,sampleCount:summary.controlCount,
      configuration:opening.configuration,initialInput:opening.input,controllerSourceRunId:opening.controllerSourceRunId,
      finalInput,
      designStudentModelId:opening.designStudentModelId,
      stopReason:run.status === 'failed' ? 'failure' : run.status === 'completed' ? 'student' : null});
  }
  const models:DestroyerModelEvidence[] = [];
  for (const model of storedModels) {
    if (!model.clientRef || (!includeAllArtifacts && !attempt.modelClientRefs.includes(model.clientRef))) continue;
    const payload = studentModelSaveSchema.safeParse({experimentKey:model.experimentKey,lineageKey:model.lineageKey,
      structure:model.structure,ioContract:model.ioContract,operatingPoint:model.operatingPoint,identification:model.identification,
      trainingRuns:model.trainingRuns,validationRuns:model.validationRuns,sampleDt:model.sampleDt});
    if (!payload.success) continue;
    models.push({id:model.clientRef,payload:payload.data,
      channel:payload.data.ioContract.outputChannel === 'YawRate' ? 'rudder-to-yaw' : payload.data.ioContract.outputChannel.startsWith('SurfaceEncoder') ? 'rudder-servo' : 'shaft-to-speed',
      createdAtMs:Number(payload.data.operatingPoint.clientFrozenAtMs ?? model.frozenAt.getTime())});
  }
  const comparisons:DestroyerComparisonEvidence[] = [];
  for (const comparison of storedComparisons) {
    if (!comparison.clientRef || (!includeAllArtifacts && !attempt.comparisonClientRefs.includes(comparison.clientRef))) continue;
    const reference = comparison.curveRefs as {purpose?:'forecast'|'validation';clientFrozenAtMs:number;modelClientRef:string;actuatorModelClientRef:string|null;actualSampleCount:number};
    comparisons.push({id:comparison.clientRef,modelId:reference.modelClientRef,actuatorModelId:reference.actuatorModelClientRef,
      runId:comparison.physicalRunRef,mode:comparison.mode as DestroyerComparisonEvidence['mode'],purpose:reference.purpose,
      createdAtMs:reference.clientFrozenAtMs,actualSampleCount:reference.actualSampleCount});
  }
  if (courseKey === 'destroyer') {
    const step = DESTROYER_COURSE_STEPS[attempt.stepSequence-1];
    const selectedRuns = attempt.stepSequence === 20 ? runs.filter((run)=>attempt.runRefs.includes(run.id)) : runs;
    const feedback = validateDestroyerCourseEvidence(step,
      {runs:selectedRuns,models,comparisons,answers:attempt.answers,designKp:(model) => {
        try { return computeVirtualSimulationServerStep<{kp:number}>({modelId:'student_model_analysis',
          operation:'heading_design',structure:model.payload.structure}).kp; }
        catch { return undefined; }
      }});
    const validPhysical = step.stepKind === 'analysis' || runs.some((run)=>run.stepSequence === attempt.stepSequence
      && run.stopReason !== 'failure' && run.stoppedAtMs !== null && run.lastTimeS+1e-7 >= (step.runDurationS ?? 0));
    return {feedback,outcome:feedback ? (validPhysical ? 'model_mismatch' : 'invalid_run') : attempt.outcome};
  }
  return {feedback:null,outcome:attempt.outcome};
}
