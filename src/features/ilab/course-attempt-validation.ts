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
import { LNG_COURSE_STEPS } from '@/resources/simulations/experiments/lng-course';
import { validateLngCourseEvidence } from '@/resources/simulations/experiments/lng-evidence';
import { CONTAINER_COURSE_STEPS } from '@/resources/simulations/experiments/container-course';
import { validateContainerCourseEvidence } from '@/resources/simulations/experiments/container-evidence';
import {CRUISE_COURSE_STEPS} from '@/resources/simulations/experiments/cruise-course';
import {validateCruiseCourseEvidence} from '@/resources/simulations/experiments/cruise-evidence';

import { DRILLING_COURSE_STEPS } from '@/resources/simulations/experiments/drilling-course';
import { validateDrillingCourseEvidence } from '@/resources/simulations/experiments/drilling-evidence';
import {ICEBREAKER_COURSE_STEPS} from '@/resources/simulations/experiments/icebreaker-course';
import {validateIcebreakerEvidence} from '@/resources/simulations/experiments/icebreaker-evidence';
import {DREDGER_COURSE_STEPS} from '@/resources/simulations/experiments/dredger-course';
import {validateDredgerEvidence} from '@/resources/simulations/experiments/dredger-evidence';
import { hasVerifiedVesselEvidence } from './course-evidence-chunks';
import { IlabServiceError } from './service-error';

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
    const verified = hasVerifiedVesselEvidence(run);
    if ((summary.controlCount || summary.nativeCount || summary.fineCount) && !verified) {
      throw new IlabServiceError('运行进度已更新，请先完成当前证据核验后重试提交。', 409);
    }
    const opening = summary.recoveryHeader
      ?? await readSimulationTraceChunk<VesselEvidenceOpening>(summary.openingReference);
    let finalInput:VesselSessionInput | undefined;
    let stopReason:VesselRunSummary['stopReason'] = run.status === 'failed' ? 'failure' : run.status === 'completed' ? 'student' : null;
    if (run.completedAt) {
      const cachedEnding = summary.recoveryCheckpoint;
      const ending: {appliedFinalInput?:VesselSessionInput;checkpoint?:string;reason?:VesselRunSummary['stopReason']} =
        verified && cachedEnding?.appliedFinalInput && cachedEnding.reason && cachedEnding.reason !== 'checkpoint'
          ? { appliedFinalInput: cachedEnding.appliedFinalInput, reason: cachedEnding.reason }
          : await readSimulationTraceChunk(summary.lastCheckpointReference);
      finalInput = ending.appliedFinalInput ?? (ending.checkpoint ? JSON.parse(ending.checkpoint).input as VesselSessionInput : undefined);
      stopReason = ending.reason ?? stopReason;
    }
    runs.push({id:run.sourceRefId,scopeKey:experimentKey,courseVersion:summary.courseVersion,
      stepSequence:summary.stepSequence,createdAtMs:opening.startedAtMs,stoppedAtMs:run.completedAt?.getTime() ?? null,
      lastTimeS:summary.lastTimeS,durationS:summary.lastTimeS,sampleCount:summary.controlCount,
      configuration:opening.configuration,initialInput:opening.input,controllerSourceRunId:opening.controllerSourceRunId,
      finalInput,
      dredgerModeEvents:summary.dredgerModeEvents,
      designStudentModelId:opening.designStudentModelId,
      courseSettings:opening.courseSettings, stopReason});
  }
  const models:DestroyerModelEvidence[] = [];
  for (const model of storedModels) {
    if (!model.clientRef || (!includeAllArtifacts && !attempt.modelClientRefs.includes(model.clientRef))) continue;
    const payload = studentModelSaveSchema.safeParse({experimentKey:model.experimentKey,lineageKey:model.lineageKey,
      structure:model.structure,ioContract:model.ioContract,operatingPoint:model.operatingPoint,identification:model.identification,
      trainingRuns:model.trainingRuns,validationRuns:model.validationRuns,sampleDt:model.sampleDt});
    if (!payload.success) continue;
    models.push({id:model.clientRef,payload:payload.data,
      channel:payload.data.structure.kind === 'dp_low_freq3' ? 'dp-low-frequency'
        : payload.data.ioContract.inputChannel === 'WinchReferenceDifferential' ? 'winch-reference-to-sway'
        : payload.data.ioContract.inputChannel === 'WinchSpeedDifferential' ? 'winch-speed-to-sway'
        : payload.data.ioContract.inputChannel === 'EquivalentAzimuth' ? 'azimuth-to-yaw'
        : payload.data.ioContract.outputChannel === 'EquivalentAzimuth' ? 'azimuth-servo'
        : payload.data.ioContract.outputChannel === 'YawRate' ? 'rudder-to-yaw'
        : payload.data.ioContract.outputChannel === 'EstimatedRoll' ? 'fin-to-roll'
        : payload.data.ioContract.outputChannel.startsWith('SurfaceEncoder') ? 'rudder-servo'
          : payload.data.ioContract.inputChannel === 'ShaftReference0' ? 'shaft-reference-to-speed' : 'shaft-to-speed',
      createdAtMs:Number(payload.data.operatingPoint.clientFrozenAtMs ?? model.frozenAt.getTime())});
  }
  const comparisons:DestroyerComparisonEvidence[] = [];
  for (const comparison of storedComparisons) {
    if (!comparison.clientRef || (!includeAllArtifacts && !attempt.comparisonClientRefs.includes(comparison.clientRef))) continue;
    const reference = comparison.curveRefs as {uri?:string;purpose?:'forecast'|'validation';clientFrozenAtMs:number;modelClientRef:string;actuatorModelClientRef:string|null;actualSampleCount:number};
    const curve = reference.purpose === 'forecast' && reference.uri
      ? await readSimulationTraceChunk<{controllerInput?:VesselSessionInput}>(reference.uri) : undefined;
    comparisons.push({id:comparison.clientRef,modelId:reference.modelClientRef,actuatorModelId:reference.actuatorModelClientRef,
      runId:comparison.physicalRunRef,mode:comparison.mode as DestroyerComparisonEvidence['mode'],purpose:reference.purpose,
      createdAtMs:reference.clientFrozenAtMs,actualSampleCount:reference.actualSampleCount,controllerInput:curve?.controllerInput});
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
  if (courseKey === 'lng') {
    const step = LNG_COURSE_STEPS[attempt.stepSequence - 1];
    const selected = step.sequence === 20 ? runs.filter((run) => attempt.runRefs.includes(run.id)) : runs;
    const feedback = validateLngCourseEvidence(step, {runs: selected, models, comparisons, answers: attempt.answers});
    return {feedback, outcome: feedback ? 'model_mismatch' : attempt.outcome};
  }
  if (courseKey === 'dredger') {
    const step = DREDGER_COURSE_STEPS[attempt.stepSequence - 1];
    const selected = step.sequence === 20 ? runs.filter((run) => attempt.runRefs.includes(run.id)) : runs;
    const feedback = validateDredgerEvidence(step, {runs: selected, models, comparisons, answers: attempt.answers});
    return {feedback, outcome: feedback ? 'model_mismatch' : attempt.outcome};
  }
  if (courseKey === 'container') {
    const step = CONTAINER_COURSE_STEPS[attempt.stepSequence - 1];
    const selected = step.sequence === 20 ? runs.filter((run) => attempt.runRefs.includes(run.id)) : runs;
    const feedback = validateContainerCourseEvidence(step, {runs: selected, models, comparisons, answers: attempt.answers});
    return {feedback, outcome: feedback ? 'model_mismatch' : attempt.outcome};
  }
  if (courseKey === 'cruise') {
    const step=CRUISE_COURSE_STEPS[attempt.stepSequence-1];
    const selected=step.sequence === 20 ? runs.filter((run)=>attempt.runRefs.includes(run.id)) : runs;
    const feedback=validateCruiseCourseEvidence(step,{runs:selected,models,comparisons,answers:attempt.answers});
    return {feedback,outcome:feedback ? 'model_mismatch' : attempt.outcome};
  }
  if (courseKey === 'drilling') {
    const step = DRILLING_COURSE_STEPS[attempt.stepSequence - 1];
    const selected = step.sequence === 20 ? runs.filter((run) => attempt.runRefs.includes(run.id)) : runs;
    const feedback = validateDrillingCourseEvidence(step, {runs: selected, models, comparisons, answers: attempt.answers});
    return {feedback, outcome: feedback ? 'model_mismatch' : attempt.outcome};
  }
  if (courseKey === 'icebreaker') {
    const step=ICEBREAKER_COURSE_STEPS[attempt.stepSequence-1];
    const selected=step.sequence===20 ? runs.filter((run)=>attempt.runRefs.includes(run.id)) : runs;
    const feedback=validateIcebreakerEvidence(step,{runs:selected,models,comparisons,answers:attempt.answers});
    return {feedback,outcome:feedback ? 'model_mismatch' : attempt.outcome};
  }
  return {feedback:null,outcome:attempt.outcome};
}
