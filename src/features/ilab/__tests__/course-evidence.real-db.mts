import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import { collectVesselTracePoint, type VesselRunEvidence } from '@/features/simulations/run-evidence';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { uploadVesselRunEvidence } from '@/features/simulations/evidence-upload';
import { readVesselEvidenceJson } from '@/features/ilab/course-evidence-api';
import { vesselEvidenceOpeningSchema, vesselTraceChunkSchema, vesselEvidenceCloseSchema } from '@/features/ilab/course-evidence-contract';
import { openVesselEvidenceRun, findOwnedVesselRun } from '@/features/ilab/course-evidence-service';
import { appendVesselEvidenceChunk, closeVesselEvidenceRun } from '@/features/ilab/course-evidence-chunks';
import { DESTROYER_COURSE_STEPS, VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import { saveVesselCourseArtifact } from '@/features/ilab/course-artifact-service';
import { vesselCourseArtifactSchema } from '@/features/ilab/course-artifact-contract';
import { readVesselReportEvidence, reviewVesselCourseReport } from '@/features/ilab/course-report-review';
import { vesselStepReviewLimits } from '@/features/ilab/course-report-review-contract';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
assert(['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL!).hostname), 'Only a local database is permitted');
const privateRoot = await mkdtemp(path.join(os.tmpdir(),'act-course-evidence-'));
process.env.SIMULATION_EVIDENCE_ROOT = privateRoot;
for (const key of ['SUBMISSION_S3_ENDPOINT','SUBMISSION_S3_BUCKET','SUBMISSION_S3_ACCESS_KEY','SUBMISSION_S3_SECRET_KEY']) process.env[key] = '';
const user = await prisma.user.create({ data: { name: 'vessel evidence integration fixture' } });
const reviewer = await prisma.user.create({ data: { name:'vessel reviewer integration fixture',role:'ADMIN' } });
const native = createServerVesselSession(DESTROYER_COURSE_STEPS[0].configuration);
const fetchOriginal = globalThis.fetch;
const captured: Array<{ url: string; data: unknown }> = [];
try {
  const frame = JSON.parse(native.read()) as VesselSessionFrame;
  frame.input.feedback = 'measurement';
  native.advance(0,JSON.stringify(frame.input));
  const run: VesselRunEvidence = {
    id: randomUUID(), scopeKey:'integration-fixture', courseKey:'destroyer', courseVersion:VESSEL_COURSE_VERSION,
    stepSequence:1, prediction:'保持直航并检验量测时间、恢复和全部原始采样传输', durationS:11,
    createdAtMs:Date.now(), lastTimeS:0, stoppedAtMs:null,
    configuration:DESTROYER_COURSE_STEPS[0].configuration, initialInput:frame.input,
    parameterHash:frame.parameterHash, initialCheckpoint:native.snapshot(), checkpoint:native.snapshot(),
    trace:[], nativeSensorSamples:[], fineStepSamples:[], changes:[], stopReason:null, failure:null,
  };
  assert.match(run.initialCheckpoint,/"previousSaturation":false/);
  run.initialCheckpoint = run.initialCheckpoint.replace(/,"previousSaturation":false/,'');
  globalThis.fetch = async (url, options) => {
    const request = new Request(`http://127.0.0.1:3001${url}`,options);
    const data = await readVesselEvidenceJson(request);
    captured.push({ url:String(url), data });
    let result;
    if (String(url).endsWith('/chunks')) result = await appendVesselEvidenceChunk(user.id,vesselTraceChunkSchema.parse(data));
    else if (options?.method === 'PUT') result = await closeVesselEvidenceRun(user.id,run.id,vesselEvidenceCloseSchema.parse(data));
    else result = await openVesselEvidenceRun(user.id,vesselEvidenceOpeningSchema.parse(data));
    return Response.json(result);
  };
  for (let second = 0; second < 7; second++) {
    const current = JSON.parse(native.advance(1,JSON.stringify(frame.input))) as VesselSessionFrame;
    for (const packet of current.controlSamples) run.trace.push(collectVesselTracePoint(packet,run.trace.at(-1)?.measurements ?? {}));
    run.nativeSensorSamples.push(...current.samples);
    run.fineStepSamples!.push(...(current.fineStepSamples ?? []));
    run.lastTimeS = current.timeS;
  }
  run.checkpoint = native.snapshot();
  const reportClientRef = randomUUID();
  const partial = await uploadVesselRunEvidence(reportClientRef,run);
  assert.equal(partial.status,'running');
  assert.equal(partial.controlCount,140);
  assert.equal(partial.fineCount,120);
  const beforeRetry = await prisma.simulationTrace.count({where:{runId:(await findOwnedVesselRun(user.id,run.id)).id}});
  const originalChunk = captured.find((item)=>item.url.endsWith('/chunks'))!.data;
  await Promise.all([appendVesselEvidenceChunk(user.id,vesselTraceChunkSchema.parse(originalChunk)),appendVesselEvidenceChunk(user.id,vesselTraceChunkSchema.parse(originalChunk))]);
  assert.equal(await prisma.simulationTrace.count({where:{runId:(await findOwnedVesselRun(user.id,run.id)).id}}),beforeRetry);
  await assert.rejects(findOwnedVesselRun('unrelated-owner',run.id),/不存在/);
  const changed = vesselTraceChunkSchema.parse(originalChunk);
  changed.points[0].command.headingDeg += 1;
  await assert.rejects(appendVesselEvidenceChunk(user.id,changed),/内容不同/);
  for (let second = 7; second < 11; second++) {
    const current = JSON.parse(native.advance(1,JSON.stringify({...frame.input,targetHeadingDeg:10}))) as VesselSessionFrame;
    for (const packet of current.controlSamples) run.trace.push(collectVesselTracePoint(packet,run.trace.at(-1)?.measurements ?? {}));
    run.nativeSensorSamples.push(...current.samples);
    run.fineStepSamples!.push(...(current.fineStepSamples ?? []));
    run.lastTimeS = current.timeS;
  }
  native.setPaused(true);
  run.checkpoint = native.snapshot(); run.stoppedAtMs = Date.now(); run.stopReason = 'duration';
  const completed = await uploadVesselRunEvidence(reportClientRef,run);
  assert.equal(completed.status,'completed');
  assert.equal(completed.controlCount,220);
  assert.equal(completed.nativeCount,run.nativeSensorSamples.length);
  assert.equal(completed.fineCount,361);
  const completedSummary = (await findOwnedVesselRun(user.id,run.id)).summary as {fineStepMetrics:{values:{physicsSamples:number}}};
  assert.equal(completedSummary.fineStepMetrics.values.physicsSamples,1320);
  assert.deepEqual(await uploadVesselRunEvidence(reportClientRef,run),completed);
  await assert.rejects(uploadVesselRunEvidence(reportClientRef,{...run,trace:[...run.trace,run.trace.at(-1)!]}),/后续记录/);
  const envelope = await prisma.appliedRunEnvelope.findUniqueOrThrow({where:{runRef:run.id}});
  assert.match(envelope.firstSampleReceipt!,/^[a-f0-9]{64}$/);
  assert.equal(Number(envelope.simulationEndMs! - envelope.simulationStartMs),11000);
  const earlierConfiguration = {...DESTROYER_COURSE_STEPS[0].configuration};
  delete earlierConfiguration.courseEvidence;
  const earlierNative = createServerVesselSession(earlierConfiguration);
  try {
    const earlier = JSON.parse(earlierNative.read()) as VesselSessionFrame;
    earlier.input.feedback = 'measurement';
    earlierNative.advance(0,JSON.stringify(earlier.input));
    const receipt = await openVesselEvidenceRun(user.id,vesselEvidenceOpeningSchema.parse({
      reportClientRef,runRef:randomUUID(),courseKey:'destroyer',courseVersion:VESSEL_COURSE_VERSION,stepSequence:1,
      configuration:earlierConfiguration,input:earlier.input,parameterHash:earlier.parameterHash,
      initialCheckpoint:earlierNative.snapshot(),prediction:'earlier saved configuration remains uploadable',startedAtMs:Date.now(),
    }));
    assert.equal(receipt.fineCount,0);
  } finally {earlierNative.free();}
  const context = {reportClientRef,courseKey:'destroyer',courseVersion:VESSEL_COURSE_VERSION};
  const reportBeforeForeignWrite = await prisma.virtualSimulationReport.findUniqueOrThrow({where:{id:completed.reportId}});
  await assert.rejects(saveVesselCourseArtifact(reviewer.id,vesselCourseArtifactSchema.parse({...context,report:{sections:{problem:'',identification:'',validation:'',comparison:'',revision:'',conclusion:''},runRefs:[],action:'save'}})),/不存在/);
  assert.equal((await prisma.virtualSimulationReport.findUniqueOrThrow({where:{id:completed.reportId}})).updatedAt.getTime(),reportBeforeForeignWrite.updatedAt.getTime());
  const modelRef = randomUUID();
  const modelInput = vesselCourseArtifactSchema.parse({...context,model:{clientRef:modelRef,payload:{
    experimentKey:'destroyer',lineageKey:'fixture-window',structure:{kind:'nomoto1',k:.06,t_s:9.4},
    ioContract:{inputChannel:'SurfaceEncoder0',outputChannel:'YawRate',inputUnit:'°',outputUnit:'°/s'},
    operatingPoint:{speedMps:8,clientFrozenAtMs:Date.now()},identification:{algorithm:'fixture',settings:{},identifiedOk:true},
    trainingRuns:[{runRef:run.id,startS:0,endS:3}],validationRuns:[],sampleDt:.05,
  }}});
  const model = await saveVesselCourseArtifact(user.id,modelInput);
  assert.equal((await saveVesselCourseArtifact(user.id,modelInput)).id,model.id);
  const changedModel = structuredClone(modelInput);changedModel.model!.payload.structure = {kind:'nomoto1',k:.2,t_s:10};
  await assert.rejects(saveVesselCourseArtifact(user.id,changedModel),/新版本/);
  const comparison = await saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...context,comparison:{
    clientRef:randomUUID(),modelClientRef:modelRef,actuatorModelClientRef:null,runRef:run.id,mode:'hull_model',
    startS:5,endS:6,timeS:[5,6],actual:[0,0],predicted:[0,0],measuredInput:[0,0],predictedInput:null,
    metrics:{rmse:0},purpose:'validation',createdAtMs:Date.now(),
  }}));
  assert.equal(comparison.kind,'comparison');
  const submitted = [];
  for (let sequence=1;sequence<=20;sequence++) {
    const attempt = await saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...context,attempt:{
      clientRef:randomUUID(),stepSequence:sequence,runRefs:[run.id],modelClientRefs:[modelRef],comparisonClientRefs:[],
      answers:{interpretation:'fixture keeps incomplete numerical evidence distinguishable'},validationFeedback:null,outcome:'submitted',
    }}));
    if(sequence===1) assert.equal(attempt.status,'invalid_run');
    submitted.push(attempt);
  }
  const sections = Object.fromEntries(['problem','identification','validation','comparison','revision','conclusion'].map((key)=>[key,'fixture <script>unsafe()</script>']));
  await saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...context,report:{sections,runRefs:[run.id],action:'save'}}));
  const storedReport = await prisma.virtualSimulationReport.findUniqueOrThrow({where:{id:completed.reportId}});
  assert(!storedReport.reportHtml.includes('<script>unsafe'));
  assert(storedReport.reportHtml.includes('本人冻结模型'));
  assert(storedReport.reportHtml.includes('测量与学生模型预测曲线'));
  assert(storedReport.reportHtml.includes('120Hz物理细步最大横摇'));
  await assert.rejects(saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...context,report:{sections,runRefs:[run.id],action:'submit'}})),/至少4次/);
  await assert.rejects(readVesselReportEvidence({id:reviewer.id,role:'STUDENT'},completed.reportId),/不存在/);
  // Fixture-only transition isolates review-state tests from the full 20-step teaching acceptance.
  await prisma.virtualSimulationReport.update({where:{id:completed.reportId},data:{status:'submitted'}});
  const actor = {id:reviewer.id,role:'ADMIN' as const};
  let report = (await readVesselReportEvidence(actor,completed.reportId)).report;
  await assert.rejects(reviewVesselCourseReport(actor,report.id,{expectedRevision:report.revision,action:'finalize',feedback:'fixture',steps:[]}),/全部步骤/);
  report = await reviewVesselCourseReport(actor,report.id,{expectedRevision:report.revision,action:'start',feedback:'fixture',steps:[]});
  assert.equal(report.status,'pending-review');
  const reviews = submitted.map((attempt,index)=>({stepSequence:index+1,attemptId:attempt.id!,prediction:0,operation:0,performance:0,
    interpretation:vesselStepReviewLimits(index+1,index>=8 && index<19).interpretation,feedback:'fixture analysis credit only'}));
  const partialReview = {...reviews[0],interpretation:null};
  report = await reviewVesselCourseReport(actor,report.id,{expectedRevision:report.revision,action:'review',feedback:'fixture partial',steps:[partialReview]});
  assert.equal(report.score,null);
  report = await reviewVesselCourseReport(actor,report.id,{expectedRevision:report.revision,action:'review',feedback:'fixture complete',steps:reviews});
  assert.equal(report.status,'reviewed');assert.equal(report.score,29);
  report = await reviewVesselCourseReport(actor,report.id,{expectedRevision:report.revision,action:'finalize',feedback:'fixture final',steps:[]});
  assert.equal(report.status,'finalized');assert.equal(report.score,29);
  const finalizedHtml = (await prisma.virtualSimulationReport.findUniqueOrThrow({where:{id:report.id}})).reportHtml;
  assert(finalizedHtml.includes('教师最终评价'));
  assert(finalizedHtml.includes('最终成绩 29/100分'));
  await assert.rejects(saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...context,model:{...modelInput.model,clientRef:randomUUID()}})),/已提交/);
  console.log(JSON.stringify({status:'passed',controlSamples:completed.controlCount,nativeSamples:completed.nativeCount,
    chunks:completed.chunkCount,fineWindowSamples:completed.fineCount,reviewStateFixtureScore:report.score,
    checks:['gzip-bound','opening-identity','pause-prefix','concurrent-retry','conflict-409','foreign-404','append-resume','native-close','terminal-retry','receipt-time','model-freeze','comparison','server-attempt-validation','report-minimum','escaped-html','review-authorization','pending-score-null','fixed-rubric','finalization-freeze']}));
} finally {
  globalThis.fetch = fetchOriginal;
  native.free();
  await prisma.simulationRun.deleteMany({where:{ownerUserId:user.id}});
  await prisma.user.delete({where:{id:user.id}});
  await prisma.user.delete({where:{id:reviewer.id}});
  await prisma.$disconnect();
  await rm(privateRoot,{recursive:true,force:true});
}
