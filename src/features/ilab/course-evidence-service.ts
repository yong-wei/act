import { createHash } from 'node:crypto';
import type { Prisma, SimulationRun } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import { CONTROL_ENGINE_BUILD_HASH } from '@/lib/control-engine/identity.generated';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { writeSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { findVesselCourse } from '@/resources/simulations/experiments/course-catalog';
import { DESTROYER_COURSE_STEPS, VESSEL_COURSE_VERSION, destroyerCourseVariants } from '@/resources/simulations/experiments/destroyer-course';
import { IlabServiceError } from './run-lock';
import { activeVesselFactors } from '@/resources/simulations/experiments/comparison-factors';
import type { VesselEvidenceOpening } from './course-evidence-contract';
import { LNG_COURSE_STEPS, lngCourseConfiguration, validateLngCourseSettings, type LngCourseSettings } from '@/resources/simulations/experiments/lng-course';
import { CONTAINER_COURSE_STEPS, containerCourseConfiguration, validateContainerCourseSettings,
  type ContainerCourseSettings } from '@/resources/simulations/experiments/container-course';
import {CRUISE_COURSE_STEPS,cruiseCourseConfiguration,validateCruiseCourseSettings,
  type CruiseCourseSettings} from '@/resources/simulations/experiments/cruise-course';

export const VESSEL_EVIDENCE_DOMAIN = 'ilab-course';
export interface VesselRunStorageSummary {
  schema:'act.vessel-run-storage.v1';
  reportId:string;
  experimentKey:string;
  openingHash:string;
  openingReference:string;
  configurationHash:string;
  parameterHash:string;
  courseKey:string;
  courseVersion:string;
  stepSequence:number;
  chunkCount:number;
  controlCount:number;
  nativeCount:number;
  fineCount?:number;
  fineLastTimeS?:number;
  lastTimeS:number;
  lastCheckpointReference:string;
  nativeWatermarks:Record<string,number>;
  validationRuntimeVersion?:string;
  appliedFactors?:string[];
}

export function vesselRunStorageSummary(run: SimulationRun): VesselRunStorageSummary {
  const summary = run.summary as unknown as VesselRunStorageSummary;
  if (summary?.schema !== 'act.vessel-run-storage.v1') throw new IlabServiceError('实验运行记录格式无法识别。',409);
  return summary;
}

export async function findOwnedVesselRun(userId: string,runRef: string) {
  const run = await prisma.simulationRun.findUnique({
    where:{ sourceDomain_sourceRefId:{ sourceDomain:VESSEL_EVIDENCE_DOMAIN,sourceRefId:runRef } },
  });
  if (!run || run.ownerUserId !== userId) throw new IlabServiceError('实验运行记录不存在。',404);
  return run;
}

export function vesselRunProgress(run: SimulationRun) {
  const summary = vesselRunStorageSummary(run);
  return { runRef:run.sourceRefId,reportId:summary.reportId,experimentKey:summary.experimentKey,status:run.status,
    chunkCount:summary.chunkCount,controlCount:summary.controlCount,nativeCount:summary.nativeCount,
    fineCount:summary.fineCount ?? 0,
    lastTimeS:summary.lastTimeS,parameterHash:summary.parameterHash };
}

/** 报告、物理记录及已有生效信封使用同一实验版本和运行引用。 */
export async function openVesselEvidenceRun(userId: string,input: VesselEvidenceOpening) {
  const course = findVesselCourse(input.courseKey);
  if (!course || input.courseVersion !== VESSEL_COURSE_VERSION || input.configuration.vessel !== course.vessel
    || input.configuration.parameterVersion !== course.parameterVersion) {
    throw new IlabServiceError('实验版本或船型参数不匹配，请重新读取本次实验。',409);
  }
  if (course.key === 'destroyer') {
    const step = DESTROYER_COURSE_STEPS[input.stepSequence-1];
    const variants = destroyerCourseVariants(step.sequence);
    const currentConfigurations = variants.length ? variants.map((variant)=>({...step.configuration,...variant.configuration})) : [step.configuration];
    const configurations = [...currentConfigurations,...currentConfigurations.map((configuration)=> {
      const savedBeforeFineStepEvidence = {...configuration};
      delete savedBeforeFineStepEvidence.courseEvidence;
      return savedBeforeFineStepEvidence;
    })];
    if (step.stepKind !== 'run' || !configurations.some((configuration)=>canonicalJson(configuration) === canonicalJson(input.configuration))
      || !step.allowedModes.includes(input.input.controlMode)
      || (input.input.controlMode !== 'manual' && input.input.feedback !== 'measurement')) {
      throw new IlabServiceError('实际运行条件与本步课程约定不一致。',409);
    }
  }
  if (course.key === 'lng') {
    const step = LNG_COURSE_STEPS[input.stepSequence - 1];
    const settings = input.courseSettings as unknown as LngCourseSettings;
    if (step.stepKind !== 'run' || validateLngCourseSettings(settings)
      || canonicalJson(lngCourseConfiguration(step.sequence, settings)) !== canonicalJson(input.configuration)
      || input.input.controlMode !== 'pd' || input.input.feedback !== 'measurement'
      || canonicalJson(input.input.pid) !== canonicalJson({kp: 1.5, ki: 0, kd: 20})
      || Boolean(input.input.longitudinal) !== step.speedControl
      || Boolean(input.input.berthPlan) !== step.berthTask) {
      throw new IlabServiceError('实际运行条件与本步课程约定不一致。', 409);
    }
    if (step.speedControl && (canonicalJson(input.input.berthPlan ?? null) !== canonicalJson(step.berthTask
      ? {brakingDistanceM: settings.brakingDistanceM, nodes: settings.speedNodes,
        ...([16,18,19].includes(step.sequence) && settings.headingNodes ? {headingNodes:settings.headingNodes} : {})} : null)
      || !input.designStudentModelId)) throw new IlabServiceError('请保存对应的本人航速模型与减速方案。', 409);
  }
  if (course.key === 'container') {
    const step = CONTAINER_COURSE_STEPS[input.stepSequence - 1];
    const settings = input.courseSettings as unknown as ContainerCourseSettings;
    const control = input.input.containerSpeed;
    if (step.stepKind !== 'run' || validateContainerCourseSettings(settings)
      || canonicalJson(containerCourseConfiguration(step.sequence, settings)) !== canonicalJson(input.configuration)
      || input.input.controlMode !== (step.sequence === 2 ? 'manual' : 'pd') || input.input.feedback !== 'measurement'
      || canonicalJson(input.input.pid) !== canonicalJson({kp: 1.5, ki: 0, kd: 20})
      || Boolean(control) !== step.speedControl || input.input.longitudinal || input.input.berthPlan) {
      throw new IlabServiceError('实际运行条件与本步课程约定不一致。', 409);
    }
    if (step.speedControl && (!control || input.designStudentModelId !== settings.modelIds[1]
      || control.kpMultiplier !== settings.kpMultiplier || control.tiMultiplier !== settings.tiMultiplier
      || control.schedulingEnabled !== (step.sequence >= 9 && settings.schedulingEnabled)
      || control.bumpless !== settings.bumpless || control.antiWindup !== settings.antiWindup
      || control.filterTauS !== settings.filterTauS || control.fixedModelIndex !== 1
      || control.feedback !== (step.sequence === 13 ? settings.feedback : 'water')
      || control.losLookaheadM !== ([13,16,17,18,19].includes(step.sequence) ? settings.losLookaheadM : null))) {
      throw new IlabServiceError('请保存对应的本人三点航速模型与控制方案。', 409);
    }
  }
  if (course.key === 'cruise') {
    const step=CRUISE_COURSE_STEPS[input.stepSequence-1],settings=input.courseSettings as unknown as CruiseCourseSettings;
    const fins=input.input.cruiseFins;
    if (step.stepKind !== 'run' || validateCruiseCourseSettings(settings)
      || canonicalJson(cruiseCourseConfiguration(step.sequence,settings)) !== canonicalJson(input.configuration)
      || input.input.controlMode !== 'pd' || input.input.feedback !== 'measurement'
      || canonicalJson(input.input.pid) !== canonicalJson({kp:1.5,ki:0,kd:20}) || Boolean(fins) !== step.finControl
      || input.input.longitudinal || input.input.berthPlan || input.input.containerSpeed) {
      throw new IlabServiceError('实际运行条件与本步课程约定不一致。',409);
    }
    if (step.finControl && (!fins || !input.designStudentModelId || fins.enabled !== settings.finsEnabled
      || fins.dampingRatio !== (step.sequence === 8 ? .5 : settings.dampingRatio)
      || fins.stiffnessFraction !== settings.stiffnessFraction || fins.lowPassCutoffHz !== settings.lowPassCutoffHz
      || canonicalJson(fins.notch) !== canonicalJson(step.sequence >= 15 && settings.notchEnabled
        ? {centerHz:settings.notchCenterHz,bandwidthHz:settings.notchBandwidthHz} : null))) {
      throw new IlabServiceError('请保存对应的本人横摇模型和鳍反馈方案。',409);
    }
  }
  const existingReport = await prisma.virtualSimulationReport.findUnique({ where:{ clientRef:input.reportClientRef } });
  if (existingReport && existingReport.userId !== userId) throw new IlabServiceError('实验报告不存在。',404);
  if (existingReport && (existingReport.experimentKey !== course.key || existingReport.experimentVersion !== input.courseVersion)) {
    throw new IlabServiceError('这份报告已绑定其他实验版本。',409);
  }
  const openingHash = createHash('sha256').update(canonicalJson(input)).digest('hex');
  const previous = await prisma.simulationRun.findUnique({
    where:{ sourceDomain_sourceRefId:{ sourceDomain:VESSEL_EVIDENCE_DOMAIN,sourceRefId:input.runRef } },
  });
  if (previous) {
    if (previous.ownerUserId !== userId) throw new IlabServiceError('实验运行记录不存在。',404);
    if (vesselRunStorageSummary(previous).openingHash !== openingHash) throw new IlabServiceError('这次运行的初始配置已经保存，请开启新的运行。',409);
    return vesselRunProgress(previous);
  }
  if (existingReport && !['draft','revision-requested'].includes(existingReport.status)) {
    throw new IlabServiceError('这份报告正在复核或已经完成，请先读取报告状态。',409);
  }
  let native: ReturnType<typeof createServerVesselSession>;
  try { native = createServerVesselSession(input.configuration); }
  catch { throw new IlabServiceError('船型初态或环境配置无法建立有效运行。',400); }
  let frame: VesselSessionFrame;
  let configurationHash: string;
  let appliedFactors:string[];
  let appliedEnvironment:string;
  try {
    frame = JSON.parse(native.advance(0,JSON.stringify(input.input))) as VesselSessionFrame;
    const checkpoint = native.snapshot();
    native.restore(input.initialCheckpoint);
    if (frame.parameterHash !== input.parameterHash || native.snapshot() !== checkpoint) {
      throw new IlabServiceError('实际初态、控制参数或参数包与本次运行不一致。',409);
    }
    const actual = JSON.parse(checkpoint);
    configurationHash = createHash('sha256').update(canonicalJson(actual.configuration)).digest('hex');
    const environment = actual.plant.environment;
    if (!environment?.switches) throw new IlabServiceError('实际环境回执尚未就绪。',503);
    appliedFactors = activeVesselFactors(input.configuration,environment.switches);
    appliedEnvironment = canonicalJson({switches:environment.switches,wave:environment.wave.condition,
      wind:environment.wind.true_wind,currentNed:environment.current_ned});
  } catch (error) {
    if (error instanceof IlabServiceError) throw error;
    throw new IlabServiceError('这次运行的控制配置无效。',400);
  } finally { native.free(); }
  const occupied = await prisma.appliedRunEnvelope.findUnique({ where:{ runRef:input.runRef },select:{ userId:true } });
  if (occupied) {
    if (occupied.userId !== userId) throw new IlabServiceError('实验运行记录不存在。',404);
    throw new IlabServiceError('这个运行引用已经用于其他实验，请开启新的运行。',409);
  }
  const opening = await writeSimulationTraceChunk({ schema:'act.vessel-run-opening.v1',...input });
  const profile = await prisma.studentProfile.findUnique({ where:{ userId },select:{ classId:true } });
  const save = () => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VirtualSimulationReport" WHERE "clientRef" = ${input.reportClientRef} FOR UPDATE`;
    let report = await tx.virtualSimulationReport.findUnique({ where:{ clientRef:input.reportClientRef } });
    if (report && report.userId !== userId) throw new IlabServiceError('实验报告不存在。',404);
    if (report && !['draft','revision-requested'].includes(report.status)) throw new IlabServiceError('这份报告正在复核或已经完成。',409);
    if (!report) report = await tx.virtualSimulationReport.create({ data:{
      clientRef:input.reportClientRef,userId,experimentKey:course.key,experimentVersion:input.courseVersion,
      status:'draft',title:course.title,score:0,maxScore:100,reportHtml:'',stepScores:[],
      sections:{},evidenceRefs:{},classId:profile?.classId ?? null,
    } });
    const experimentKey = `${course.key}:${input.reportClientRef}`;
    const summary: VesselRunStorageSummary = { schema:'act.vessel-run-storage.v1',reportId:report.id,experimentKey,
      openingHash,openingReference:opening.uri,configurationHash,parameterHash:frame.parameterHash,courseKey:course.key,
      courseVersion:input.courseVersion,stepSequence:input.stepSequence,chunkCount:0,controlCount:0,nativeCount:0,
      lastTimeS:0,lastCheckpointReference:opening.uri,nativeWatermarks:{},validationRuntimeVersion:CONTROL_ENGINE_BUILD_HASH,appliedFactors };
    const run = await tx.simulationRun.create({ data:{ ownerUserId:userId,classId:profile?.classId ?? null,
      runKind:'vessel-teaching',sourceDomain:VESSEL_EVIDENCE_DOMAIN,sourceRefId:input.runRef,
      status:'running',protocolVersion:'act.vessel-evidence.v2',runtimeVersion:input.runtimeVersion ?? 'unrecorded-development',
      modelVersion:frame.modelVersion,sceneSpecVersion:input.courseVersion,
      seed:BigInt(input.configuration.seed ?? 20261106),startedAt:new Date(input.startedAtMs),
      summary:{...summary,parameters:frame.parameters} as unknown as Prisma.InputJsonValue } });
    await tx.appliedRunEnvelope.create({ data:{ userId,experimentKey,runRef:input.runRef,
      stepKey:`${course.key}-step-${input.stepSequence}`,courseVersion:input.courseVersion,
      modelId:course.vessel,modelVersion:input.configuration.parameterVersion!,parameterBundleHash:frame.parameterHash,
      seed:String(input.configuration.seed ?? 20261106),simulationStartMs:BigInt(input.startedAtMs),
      initialState:{ configuration:canonicalJson(input.configuration),input:canonicalJson(frame.input),checkpointReference:opening.uri,
        environment:appliedEnvironment },
      appliedFactorMask:course.key === 'destroyer' ? [...DESTROYER_COURSE_STEPS[input.stepSequence-1].factorMask]
        : [input.configuration.environment ?? 'P0',input.configuration.noiseLevel ?? 'N0'],
      quality:{ status:'open',source:'native-session' } } });
    return vesselRunProgress(run);
  });
  try { return await save(); }
  catch (error) {
    if ((error as { code?:string }).code !== 'P2002') throw error;
    const stored = await prisma.simulationRun.findUnique({
      where:{ sourceDomain_sourceRefId:{ sourceDomain:VESSEL_EVIDENCE_DOMAIN,sourceRefId:input.runRef } },
    });
    if (stored) {
      if (stored.ownerUserId !== userId) throw new IlabServiceError('实验运行记录不存在。',404);
      if (vesselRunStorageSummary(stored).openingHash !== openingHash) throw new IlabServiceError('运行配置已经保存，请开启新的运行。',409);
      return vesselRunProgress(stored);
    }
    return save();
  }
}
