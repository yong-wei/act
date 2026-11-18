import { createHash } from 'node:crypto';
import { Prisma, type VirtualSimulationReport } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canonicalJson, studentModelContentHash } from '@/lib/student-model-artifact-contract/server-hash';
import { readSimulationTraceChunk,writeSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { findVesselCourse } from '@/resources/simulations/experiments/course-catalog';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import { VESSEL_EVIDENCE_DOMAIN, vesselRunStorageSummary } from './course-evidence-service';
import type { VesselCourseArtifactInput } from './course-artifact-contract';
import { IlabServiceError } from './run-lock';
import { validateSavedVesselAttempt } from './course-attempt-validation';
import { summarizeVesselReview, type VesselStepReview } from './course-report-review-contract';
import { vesselComparisonFactors } from '@/resources/simulations/experiments/comparison-factors';
import type { VesselEvidenceOpening } from './course-evidence-contract';
import { buildVesselCourseReportHtml, type VesselReportEvidence } from '@/features/simulations/course-report';
import { studentModelSaveSchema } from '@/lib/student-model-artifact-contract';
import { hasVerifiedVesselEvidence, verifyVesselEvidenceRun } from './course-evidence-chunks';
export { buildVesselCourseReportHtml } from '@/features/simulations/course-report';

const contentHash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
export function vesselExperimentKey(report: Pick<VirtualSimulationReport,'experimentKey'|'clientRef'>) {
  return `${report.experimentKey}:${report.clientRef}`;
}

export function vesselReportView(report: VirtualSimulationReport) {
  const reviewSteps = (report.rubric as {steps?:VesselStepReview[]}|null)?.steps;
  return { id:report.id, clientRef:report.clientRef, courseKey:report.experimentKey, courseVersion:report.experimentVersion,
    title:report.title, status:report.status, revision:report.revision, sections:report.sections,
    evidenceRefs:report.evidenceRefs, rubric:report.rubric, teacherFeedback:report.teacherFeedback,
    hasReportHtml:Boolean(report.reportHtml),
    reviewProgress:reviewSteps ? summarizeVesselReview(reviewSteps) : null,
    score:report.status === 'finalized' || report.status === 'reviewed' ? report.score : null,
    maxScore:report.maxScore, reviewedAt:report.reviewedAt, finalizedAt:report.finalizedAt, updatedAt:report.updatedAt };
}

async function requireOwnedReport(userId: string, input: VesselCourseArtifactInput) {
  const course = findVesselCourse(input.courseKey);
  if (!course || input.courseVersion !== VESSEL_COURSE_VERSION) throw new IlabServiceError('实验课程版本不匹配。',409);
  const profile = await prisma.studentProfile.findUnique({ where:{userId},select:{classId:true} });
  const report = await prisma.virtualSimulationReport.upsert({
    where:{clientRef:input.reportClientRef}, update:{}, create:{
      clientRef:input.reportClientRef, userId, experimentKey:course.key, experimentVersion:input.courseVersion,
      status:'draft', title:course.title, score:0, maxScore:100, reportHtml:'', stepScores:[],
      sections:{}, evidenceRefs:{}, classId:profile?.classId ?? null,
    },
  });
  if (report.userId !== userId) throw new IlabServiceError('实验报告不存在。',404);
  if (report.experimentKey !== course.key || report.experimentVersion !== input.courseVersion) throw new IlabServiceError('报告已绑定其他实验版本。',409);
  return report;
}

async function ownedRuns(db: Prisma.TransactionClient, userId: string, experimentKey: string, refs: string[]) {
  const unique = [...new Set(refs)];
  const runs = await db.simulationRun.findMany({ where:{ ownerUserId:userId, sourceDomain:VESSEL_EVIDENCE_DOMAIN, sourceRefId:{in:unique} } });
  if (runs.length !== unique.length || runs.some((run) => vesselRunStorageSummary(run).experimentKey !== experimentKey)) {
    throw new IlabServiceError('引用的运行记录不属于本次实验。',404);
  }
  return runs;
}

/** 复用四类工件表，同一报告锁串行保护版本、尝试序号和报告状态。 */
export async function saveVesselCourseArtifact(userId: string, input: VesselCourseArtifactInput) {
  const report = await requireOwnedReport(userId, input);
  const experimentKey = vesselExperimentKey(report);
  const neededRunRefs = input.attempt?.runRefs ?? (input.report?.action === 'submit' ? input.report.runRefs : []);
  if (neededRunRefs.length) {
    const runs = await prisma.simulationRun.findMany({ where: { ownerUserId: userId,
      sourceDomain: VESSEL_EVIDENCE_DOMAIN, sourceRefId: { in: neededRunRefs }, summary: { path: ['reportId'], equals: report.id } } });
    for (const run of runs) {
      const summary = vesselRunStorageSummary(run);
      if ((summary.controlCount || summary.nativeCount || summary.fineCount) && !hasVerifiedVesselEvidence(run)) {
        await verifyVesselEvidenceRun(userId, run.sourceRefId);
      }
    }
  }
  const comparison = input.comparison;
  const curve = comparison ? await writeSimulationTraceChunk({schema:'act.vessel-comparison.v1',...comparison}) : null;
  const attempt = input.attempt;
  const work = attempt ? await writeSimulationTraceChunk({schema:'act.vessel-step-work.v1',...attempt}) : null;
  const recordHash = contentHash(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VirtualSimulationReport" WHERE "id" = ${report.id} FOR UPDATE`;
    const current = await tx.virtualSimulationReport.findUniqueOrThrow({where:{id:report.id}});
    if (input.model) {
      const existing = await tx.studentModelArtifact.findUnique({where:{clientRef:input.model.clientRef}});
      const payload = {...input.model.payload, experimentKey};
      const hash = studentModelContentHash(payload);
      if (existing) {
        if (existing.userId !== userId || existing.experimentKey !== experimentKey) throw new IlabServiceError('学生模型不存在。',404);
        if (existing.contentHash !== hash) throw new IlabServiceError('该冻结模型内容已保存，请以新版本重新辨识。',409);
        return {kind:'model',id:existing.id,contentHash:hash,version:existing.version};
      }
      assertReportEditable(current);
      const windows = [...payload.trainingRuns,...payload.validationRuns];
      const runs = await ownedRuns(tx,userId,experimentKey,windows.map((window) => window.runRef));
      if (windows.some((window) => window.startS < 0 || window.endS > vesselRunStorageSummary(runs.find((run) => run.sourceRefId === window.runRef)!).lastTimeS + 1e-7)) {
        throw new IlabServiceError('模型分析窗口超出已经上传的量测范围。',400);
      }
      const previous = await tx.studentModelArtifact.findFirst({where:{userId,experimentKey,lineageKey:payload.lineageKey},orderBy:{version:'desc'}});
      const saved = await tx.studentModelArtifact.create({data:{
        clientRef:input.model.clientRef, userId, experimentKey, lineageKey:payload.lineageKey, version:(previous?.version ?? 0)+1,
        structure:payload.structure, ioContract:payload.ioContract, operatingPoint:payload.operatingPoint,
        identification:payload.identification, trainingRuns:payload.trainingRuns, validationRuns:payload.validationRuns,
        sampleDt:payload.sampleDt, contentHash:hash,
      }});
      return {kind:'model',id:saved.id,contentHash:hash,version:saved.version};
    }
    if (comparison && curve) {
      const existing = await tx.comparisonArtifact.findUnique({where:{clientRef:comparison.clientRef}});
      if (existing) {
        if (existing.userId !== userId || existing.experimentKey !== experimentKey) throw new IlabServiceError('对照记录不存在。',404);
        if ((existing.curveRefs as {recordHash?:string}).recordHash !== recordHash) throw new IlabServiceError('该对照内容已冻结。',409);
        return {kind:'comparison',id:existing.id};
      }
      assertReportEditable(current);
      const [physical] = await ownedRuns(tx,userId,experimentKey,[comparison.runRef]);
      const summary = vesselRunStorageSummary(physical);
      const opening = await readSimulationTraceChunk<VesselEvidenceOpening>(summary.openingReference);
      const model = await tx.studentModelArtifact.findFirst({where:{clientRef:comparison.modelClientRef,userId,experimentKey}});
      const actuator = comparison.actuatorModelClientRef ? await tx.studentModelArtifact.findFirst({where:{clientRef:comparison.actuatorModelClientRef,userId,experimentKey}}) : null;
      const io = model?.ioContract as {inputChannel?:string;outputChannel?:string;outputUnit?:string} | undefined;
      const speedReference = ['lng','container'].includes(input.courseKey) && io?.inputChannel === 'ShaftReference0'
        && io.outputChannel === 'SpeedLog' && (model?.structure as {kind?:string} | undefined)?.kind === 'fopdt';
      const winchReference = input.courseKey === 'dredger' && io?.inputChannel === 'WinchReferenceDifferential'
        && io.outputChannel === 'DredgerSwaySpeed';
      const jointReference = speedReference || winchReference;
      if (input.courseKey === 'cruise' && io?.inputChannel === 'FinDifferential'
        && (comparison.mode !== 'hull_model' || comparison.actuatorModelClientRef)) {
        throw new IlabServiceError('横摇局部模型需要A模式的实际差动鳍量测对照。',400);
      }
      const dpModel = input.courseKey === 'drilling' && io?.inputChannel === 'EstimatedTauBody3';
      if (dpModel && (comparison.mode !== 'hull_model' || comparison.actuatorModelClientRef
        || !comparison.actualEastM || !comparison.predictedEastM || !comparison.actualHeadingDeg || !comparison.predictedHeadingDeg)) {
        throw new IlabServiceError('三通道低频模型需要保存位置和航向的A模式独立对照。',400);
      }
      if (!model || (comparison.mode !== 'hull_model' && !jointReference && !actuator)) throw new IlabServiceError('所引用的冻结模型不存在。',404);
      if (speedReference && (comparison.mode === 'hull_model' || comparison.actuatorModelClientRef
        || comparison.outputChannel !== 'SpeedLog')) {
        throw new IlabServiceError('轴速参考联合模型需要B或C对照及相同的航速输出通道。',400);
      }
      if (winchReference && (comparison.mode === 'hull_model' || comparison.actuatorModelClientRef)) {
        throw new IlabServiceError('绞车指令联合模型需要B或C对照，A模式使用实际绞车速度模型。',400);
      }
      if ((comparison.outputChannel && comparison.outputChannel !== io?.outputChannel)
        || (comparison.outputUnit && comparison.outputUnit !== io?.outputUnit)) {
        throw new IlabServiceError('对照输出通道或单位与冻结模型不一致。',400);
      }
      if (speedReference && comparison.mode === 'independent_closed_loop'
        && (!(opening.input.longitudinal || opening.input.containerSpeed)
          || !(comparison.controllerInput?.longitudinal || comparison.controllerInput?.containerSpeed)
          || contentHash(comparison.controllerInput) !== contentHash(opening.input))) {
        throw new IlabServiceError('独立航速闭环需要本次物理运行的冻结控制器。',400);
      }
      if (winchReference && comparison.mode === 'independent_closed_loop'
        && (!opening.input.dredger || !comparison.controllerInput?.dredger
          || contentHash(comparison.controllerInput) !== contentHash(opening.input))) {
        throw new IlabServiceError('独立横移闭环需要本次物理运行的冻结控制器。',400);
      }
      if (comparison.purpose === 'validation' && comparison.endS > summary.lastTimeS + 1e-7) throw new IlabServiceError('对照窗口超出已上传的原始采样。',400);
      const training = model.trainingRuns as Array<{runRef:string;startS:number;endS:number}>;
      if (comparison.purpose === 'validation' && training.some((window) => window.runRef === comparison.runRef && window.startS < comparison.endS && comparison.startS < window.endS)) {
        throw new IlabServiceError('独立验证窗口与训练窗口重叠。',400);
      }
      const saved = await tx.comparisonArtifact.create({data:{
        clientRef:comparison.clientRef,userId,experimentKey,stepKey:`${input.courseKey}-step-${summary.stepSequence}`,
        mode:comparison.mode,studentModelId:model.id,physicalRunRef:comparison.runRef,
        controllerArtifactHash:comparison.controllerInput ? contentHash(comparison.controllerInput) : null,
        inputSource:dpModel ? 'estimated_thrust' : comparison.mode === 'hull_model' ? 'actuator_measurement' : 'command',
        alignmentWindow:{startS:comparison.startS,endS:comparison.endS},
        factorFlags:{...vesselComparisonFactors(opening.configuration,comparison.mode,summary.appliedFactors)},
        metrics:comparison.metrics,curveRefs:{uri:curve.uri,checksum:curve.checksum,recordHash,
          purpose:comparison.purpose,actuatorModelId:actuator?.id ?? null,clientFrozenAtMs:comparison.createdAtMs,
          modelClientRef:comparison.modelClientRef,actuatorModelClientRef:comparison.actuatorModelClientRef,
          actualSampleCount:comparison.actual.length,
          predictionSource:'student-model',metricsSource:'browser-wasm'},
      }});
      return {kind:'comparison',id:saved.id};
    }
    if (attempt && work) {
      const existing = await tx.stepSubmissionAttempt.findUnique({where:{clientRef:attempt.clientRef}});
      if (existing) {
        if (existing.userId !== userId || existing.experimentKey !== experimentKey) throw new IlabServiceError('步骤提交不存在。',404);
        if ((existing.scoreResult as {recordHash?:string})?.recordHash !== recordHash) throw new IlabServiceError('这次提交已经保存，请新增尝试。',409);
        return {kind:'attempt',id:existing.id,status:existing.status,
          validationFeedback:(existing.scoreResult as {validationFeedback?:string})?.validationFeedback ?? null};
      }
      assertReportEditable(current);
      await ownedRuns(tx,userId,experimentKey,attempt.runRefs);
      const modelRefs = [...new Set(attempt.modelClientRefs)];
      const comparisonRefs = [...new Set(attempt.comparisonClientRefs)];
      const models = await tx.studentModelArtifact.findMany({where:{userId,experimentKey,clientRef:{in:modelRefs}},select:{id:true}});
      const comparisons = await tx.comparisonArtifact.findMany({where:{userId,experimentKey,clientRef:{in:comparisonRefs}},select:{id:true}});
      if (models.length !== modelRefs.length || comparisons.length !== comparisonRefs.length) throw new IlabServiceError('步骤引用的模型或对照记录不存在。',404);
      const stepKey = `${input.courseKey}-step-${attempt.stepSequence}`;
      const validation = await validateSavedVesselAttempt(tx,userId,report.id,experimentKey,input.courseKey,attempt);
      const validationFeedback = validation.feedback;
      const outcome = validation.outcome;
      const previous = await tx.stepSubmissionAttempt.findFirst({where:{userId,experimentKey,stepKey},orderBy:{attemptSeq:'desc'}});
      const saved = await tx.stepSubmissionAttempt.create({data:{
        clientRef:attempt.clientRef,userId,experimentKey,stepKey,attemptSeq:(previous?.attemptSeq ?? 0)+1,
        status:outcome,runRefs:attempt.runRefs,studentModelIds:models.map((model)=>model.id),
        comparisonIds:comparisons.map((item)=>item.id),sketchRefs:attempt.answers.sketchImage ? [work.uri] : [],
        explanation:attempt.answers.interpretation ?? null,scoringVersion:input.courseVersion,
        scoreResult:{recordHash,workReference:work.uri,score:null,reviewStatus:'pending-review',validationFeedback},
      }});
      return {kind:'attempt',id:saved.id,status:saved.status,validationFeedback};
    }
    if (!input.report) throw new IlabServiceError('保存内容为空。',400);
    assertReportEditable(current);
    const draft = input.report;
    if (draft.expectedRevision !== undefined && draft.expectedRevision !== current.revision) throw new IlabServiceError('报告已在另一页面更新，请重新读取后保存。',409);
    const runs = await ownedRuns(tx,userId,experimentKey,draft.runRefs);
    if (draft.action === 'submit') {
      const minimum = input.courseKey === 'destroyer' ? 4 : ['lng','container','cruise'].includes(input.courseKey) ? 5 : 6;
      if (new Set(draft.runRefs).size < minimum || runs.some((run) => run.status === 'running')) throw new IlabServiceError(`报告需要至少${minimum}次独立的已结束运行，失败与修正前记录均可引用。`,400);
      if (Object.values(draft.sections).some((section)=>!section.trim())) throw new IlabServiceError('请完成报告的六部分说明。',400);
      const steps = await tx.stepSubmissionAttempt.findMany({where:{userId,experimentKey},select:{stepKey:true}});
      if (new Set(steps.map((step)=>step.stepKey)).size !== 20) throw new IlabServiceError('请保留全部20步的提交尝试后提交报告。',400);
      const validation = await validateSavedVesselAttempt(tx,userId,report.id,experimentKey,input.courseKey,
        {stepSequence:20,runRefs:draft.runRefs,modelClientRefs:[],comparisonClientRefs:[],answers:draft.sections,outcome:'submitted'},true);
      if (validation.feedback) throw new IlabServiceError(validation.feedback,400);
    }
    const assembly = await assembleVesselReportEvidence(tx,userId,experimentKey,runs);
    const saved = await tx.virtualSimulationReport.update({where:{id:current.id},data:{
      sections:draft.sections,evidenceRefs:{runRefs:[...new Set(draft.runRefs)]},
      status:draft.action === 'submit' ? 'submitted' : current.status,revision:{increment:1},
      reportHtml:buildVesselCourseReportHtml(current.title,draft.sections,assembly),
    }});
    return {kind:'report',report:vesselReportView(saved)};
  }, {timeout:15000});
}

function assertReportEditable(report: VirtualSimulationReport) {
  if (!['draft','revision-requested'].includes(report.status)) throw new IlabServiceError('报告已提交复核，请读取当前状态。',409);
}

async function assembleVesselReportEvidence(tx:Prisma.TransactionClient,userId:string,experimentKey:string,
  runs:Awaited<ReturnType<typeof ownedRuns>>):Promise<VesselReportEvidence> {
  const [models,comparisons] = await Promise.all([
    tx.studentModelArtifact.findMany({where:{userId,experimentKey},orderBy:{createdAt:'asc'}}),
    tx.comparisonArtifact.findMany({where:{userId,experimentKey,physicalRunRef:{in:runs.map((run)=>run.sourceRefId)}},orderBy:{createdAt:'asc'}}),
  ]);
  const runData = await Promise.all(runs.map(async (run)=> {
    const summary = vesselRunStorageSummary(run);
    const opening = await readSimulationTraceChunk<VesselEvidenceOpening>(summary.openingReference);
    const end = run.completedAt ? await readSimulationTraceChunk<{appliedFinalInput?:VesselEvidenceOpening['input']}>(summary.lastCheckpointReference) : null;
    const stored = run.summary as unknown as Partial<VesselReportEvidence['runs'][number]>;
    return {id:run.sourceRefId,stepSequence:summary.stepSequence,timeS:summary.lastTimeS,status:run.status,
      configuration:opening.configuration,input:end?.appliedFinalInput ?? opening.input,
      metrics:(run.summary as {metrics?:Record<string,number|null>}).metrics,
      parameters:stored.parameters,voyage:stored.voyage ?? undefined,fuelKg:stored.fuelKg ?? undefined,
      cruiseComfort:stored.cruiseComfort ?? undefined,
      fineStepMetrics:(run.summary as {fineStepMetrics?:VesselReportEvidence['runs'][number]['fineStepMetrics']}).fineStepMetrics};
  }));
  return {runs:runData,models:models.map((model)=> {
    const payload = studentModelSaveSchema.parse({experimentKey,lineageKey:model.lineageKey,
      structure:model.structure,ioContract:model.ioContract,operatingPoint:model.operatingPoint,
      identification:model.identification,trainingRuns:model.trainingRuns,validationRuns:model.validationRuns,sampleDt:model.sampleDt});
    return {id:model.clientRef ?? undefined,label:`本人模型 · 版本${model.version}`,payload,
      frozenAtMs:Number(payload.operatingPoint.clientFrozenAtMs ?? model.frozenAt.getTime())};
    }),
    comparisons:await Promise.all(comparisons.map(async (comparison)=> {
      const reference = comparison.curveRefs as {uri:string};
      const work = await readSimulationTraceChunk<NonNullable<VesselCourseArtifactInput['comparison']>>(reference.uri);
      return {...work,runId:work.runRef,modelId:work.modelClientRef,actuatorModelId:work.actuatorModelClientRef};
    }))};
}
