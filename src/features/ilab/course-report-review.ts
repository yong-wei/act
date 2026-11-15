import { Prisma, type UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { vesselExperimentKey, vesselReportView } from './course-artifact-service';
import { VESSEL_EVIDENCE_DOMAIN, vesselRunStorageSummary } from './course-evidence-service';
import { summarizeVesselReview, vesselCourseStepReviewLimits, type VesselReportReviewInput, type VesselStepReview } from './course-report-review-contract';
import { IlabServiceError } from './run-lock';
import { finalizeVesselReportHtml } from '@/features/simulations/course-report';
import { uploadCourseReportToIlab } from './adapters/ilab-course-upload';

export interface VesselReportActor {id:string;role:UserRole}

export async function requireVesselReportAccess(actor:VesselReportActor, reportId:string, review=false) {
  const report = await prisma.virtualSimulationReport.findUnique({where:{id:reportId}});
  if (!report?.clientRef) throw new IlabServiceError('实验报告不存在。',404);
  const own = report.userId === actor.id;
  const assignedClass = actor.role === 'TEACHER' && report.classId
    ? await prisma.class.findFirst({where:{id:report.classId,teacherId:actor.id},select:{id:true}}) : null;
  const canReview = actor.role === 'ADMIN' || actor.role === 'TEACHER' && (Boolean(assignedClass) || report.reviewerId === actor.id);
  if (review ? !canReview || own : !canReview && !own) throw new IlabServiceError('实验报告不存在。',404);
  return report;
}

export async function readVesselReportEvidence(actor:VesselReportActor,reportId:string) {
  const report = await requireVesselReportAccess(actor,reportId);
  const experimentKey = vesselExperimentKey(report);
  const [runs,models,comparisons,attempts] = await Promise.all([
    prisma.simulationRun.findMany({where:{ownerUserId:report.userId,sourceDomain:VESSEL_EVIDENCE_DOMAIN,summary:{path:['reportId'],equals:report.id}},
      orderBy:{createdAt:'asc'},include:{traces:{select:{id:true,chunkIndex:true,sampleCount:true},orderBy:{chunkIndex:'asc'}}}}),
    prisma.studentModelArtifact.findMany({where:{userId:report.userId,experimentKey},orderBy:{createdAt:'asc'}}),
    prisma.comparisonArtifact.findMany({where:{userId:report.userId,experimentKey},orderBy:{createdAt:'asc'}}),
    prisma.stepSubmissionAttempt.findMany({where:{userId:report.userId,experimentKey},orderBy:{attemptSeq:'asc'}}),
  ]);
  return {report:vesselReportView(report),reportHtml:report.reportHtml,runs:runs.filter((run)=>vesselRunStorageSummary(run).reportId === report.id).map((run)=>({
    runRef:run.sourceRefId,status:run.status,stepSequence:vesselRunStorageSummary(run).stepSequence,
    timeS:vesselRunStorageSummary(run).lastTimeS,summary:run.summary,traces:run.traces,
  })),models,comparisons,attempts};
}

export async function readVesselReportWork(actor:VesselReportActor, reportId:string,kind:string,id:string) {
  const report = await requireVesselReportAccess(actor,reportId);
  const experimentKey = vesselExperimentKey(report);
  let reference:string | undefined;
  if (kind === 'attempt') {
    const attempt = await prisma.stepSubmissionAttempt.findFirst({where:{id,userId:report.userId,experimentKey}});
    reference = (attempt?.scoreResult as {workReference?:string})?.workReference;
    if (attempt && reference) {
      const work = await readSimulationTraceChunk<Record<string,unknown>>(reference);
      return {...work,outcome:attempt.status,validationFeedback:(attempt.scoreResult as {validationFeedback?:string})?.validationFeedback ?? null};
    }
  } else if (kind === 'comparison') {
    const comparison = await prisma.comparisonArtifact.findFirst({where:{id,userId:report.userId,experimentKey}});
    reference = (comparison?.curveRefs as {uri?:string})?.uri;
    if (comparison && reference) return {...await readSimulationTraceChunk<Record<string,unknown>>(reference),factorFlags:comparison.factorFlags};
  } else if (kind === 'trace') {
    const trace = await prisma.simulationTrace.findFirst({where:{id,run:{ownerUserId:report.userId,sourceDomain:VESSEL_EVIDENCE_DOMAIN}},include:{run:true}});
    if (trace && vesselRunStorageSummary(trace.run).reportId === report.id
      && (actor.id !== report.userId || trace.run.status !== 'running')) reference = trace.sampleStorageUri ?? undefined;
  }
  if (!reference) throw new IlabServiceError('实验原始证据不存在或仍在采集中。',404);
  return readSimulationTraceChunk<unknown>(reference);
}

/** 人工量规与确定性指标分开保存，最终成绩要求全部评分项和教师身份。 */
export async function reviewVesselCourseReport(actor:VesselReportActor,reportId:string,input:VesselReportReviewInput) {
  await requireVesselReportAccess(actor,reportId,true);
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VirtualSimulationReport" WHERE "id" = ${reportId} FOR UPDATE`;
    const report = await tx.virtualSimulationReport.findUniqueOrThrow({where:{id:reportId}});
    if (report.revision !== input.expectedRevision) throw new IlabServiceError('报告已经更新，请重新读取后复核。',409);
    if (report.status === 'finalized' || !['submitted','pending-review','reviewed'].includes(report.status)) throw new IlabServiceError('当前报告状态无法执行复核。',409);
    const experimentKey = vesselExperimentKey(report);
    let status = report.status;
    let rubric = report.rubric;
    let score = report.score;
    if (input.action === 'return') {
      if (!input.feedback.trim()) throw new IlabServiceError('请说明需要修改的证据或推理。',400);
      status = 'revision-requested';
    } else if (input.action === 'start') status = 'pending-review';
    else if (input.action === 'review') {
      if (new Set(input.steps.map((step)=>step.stepSequence)).size !== input.steps.length) throw new IlabServiceError('评分步骤重复。',400);
      for (const step of input.steps) {
        const attempt = await tx.stepSubmissionAttempt.findFirst({where:{id:step.attemptId,userId:report.userId,experimentKey,stepKey:`${report.experimentKey}-step-${step.stepSequence}`}});
        if (!attempt) throw new IlabServiceError('评分引用的步骤尝试不存在。',404);
        const limits = vesselCourseStepReviewLimits(report.experimentKey, step.stepSequence);
        if (Object.entries(limits).some(([key,limit]) => (step[key as keyof typeof limits] ?? 0) > limit+1e-7)) throw new IlabServiceError('评分超过本步固定量规。',400);
        if (attempt.status === 'invalid_run' && ((step.operation ?? 0) > 0 || (step.performance ?? 0) > 0)) throw new IlabServiceError('数值无效运行的操作和性能分需要重新核验有效证据。',400);
        await tx.stepSubmissionAttempt.updateMany({where:{userId:report.userId,experimentKey,stepKey:attempt.stepKey},data:{selectedFinalAt:null}});
        await tx.stepSubmissionAttempt.update({where:{id:attempt.id},data:{selectedFinalAt:new Date(),scoreResult:{
          ...(attempt.scoreResult as Prisma.JsonObject),teacherReview:{...step},reviewerId:actor.id,reviewedAt:new Date().toISOString(),
        }}});
      }
      const summary = summarizeVesselReview(input.steps);
      rubric = {steps:input.steps,summary} as unknown as Prisma.JsonObject;
      status = summary.complete ? 'reviewed' : 'pending-review';
      score = summary.finalScore ?? 0;
    } else {
      const steps = (report.rubric as {steps?:VesselStepReview[]})?.steps ?? [];
      const summary = summarizeVesselReview(steps);
      if (report.status !== 'reviewed' || !summary.complete || summary.finalScore === null) throw new IlabServiceError('全部步骤完成教师复核后才能确认最终成绩。',409);
      score = summary.finalScore;
      status = 'finalized';
    }
    const confirmedAt = input.action === 'finalize' ? new Date() : null;
    let reportHtml = report.reportHtml;
    if (confirmedAt) {
      const reviewer = await tx.user.findUniqueOrThrow({where:{id:actor.id},select:{name:true}});
      reportHtml = finalizeVesselReportHtml(reportHtml,{score,reviewerName:reviewer.name ?? '授课教师',confirmedAt,
        feedback:input.feedback,steps:(rubric as {steps:VesselStepReview[]}).steps});
    }
    const saved = await tx.virtualSimulationReport.update({where:{id:report.id},data:{
      status,score,rubric:rubric ?? Prisma.DbNull,reviewerId:actor.id,teacherFeedback:input.feedback,
      reviewedAt:input.action === 'review' ? new Date() : report.reviewedAt,
      finalizedAt:confirmedAt,reportHtml,revision:{increment:1},
    }});
    return {
      view: vesselReportView(saved),
      finalizedReportId: confirmedAt ? saved.id : null,
      studentUserId: saved.userId,
    };
  },{timeout:15000});

  if (outcome.finalizedReportId) {
    await uploadCourseReportToIlab({
      reportId: outcome.finalizedReportId,
      actorUserId: outcome.studentUserId,
      allowTeacherFinalize: true,
    }).catch((err: unknown) => {
      console.error('[ilab] 教师终审同步实验空间失败:', err);
    });
  }

  return outcome.view;
}
