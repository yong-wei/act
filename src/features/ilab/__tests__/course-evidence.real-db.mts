import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import { closeEvidenceCpuPool } from '@/lib/control-engine/evidence-cpu-pool';
import { collectVesselTracePoint, type VesselRunEvidence } from '@/features/simulations/run-evidence';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { uploadVesselRunEvidence } from '@/features/simulations/evidence-upload';
import { readVesselEvidenceJson } from '@/features/ilab/course-evidence-api';
import { vesselEvidenceOpeningSchema as openingSchema, vesselTraceChunkSchema as chunkSchema, vesselEvidenceCloseSchema,
  type VesselEvidenceOpening, type VesselTraceChunk } from '@/features/ilab/course-evidence-contract';
import { openVesselEvidenceRun, findOwnedVesselRun } from '@/features/ilab/course-evidence-service';
import { appendVesselEvidenceChunk, closeVesselEvidenceRun, stageVesselEvidenceChunk, stageVesselEvidenceBytes,
  readVesselEvidenceChunk, verifyVesselEvidenceRun } from '@/features/ilab/course-evidence-chunks';
import { DESTROYER_COURSE_STEPS, VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import { LNG_COURSE_STEPS, lngCourseDefaultSettings, lngCourseInput } from '@/resources/simulations/experiments/lng-course';
import {containerCourseConfiguration,containerCourseDefaultSettings,containerCourseInput} from '@/resources/simulations/experiments/container-course';
import {cruiseCourseConfiguration,cruiseCourseDefaultSettings,cruiseCourseInput} from '@/resources/simulations/experiments/cruise-course';
import type {FrozenVesselStudentModel} from '@/resources/simulations/experiments/student-analysis';
import { saveVesselCourseArtifact } from '@/features/ilab/course-artifact-service';
import { vesselCourseArtifactSchema } from '@/features/ilab/course-artifact-contract';
import { readVesselReportEvidence, reviewVesselCourseReport } from '@/features/ilab/course-report-review';
import { vesselStepReviewLimits } from '@/features/ilab/course-report-review-contract';
import { loadCourseSessionRecovery } from '@/features/ilab/adapters/course-session-recovery';

const vesselEvidenceOpeningSchema = openingSchema.transform(value => value as unknown as VesselEvidenceOpening);
const vesselTraceChunkSchema = chunkSchema.transform(value => value as unknown as VesselTraceChunk);

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
let interruptCheckpointCommit = false;
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
    if (String(url).includes('/chunks')) result = String(url).endsWith('?stage=1')
      ? await stageVesselEvidenceBytes(user.id,run.id,Buffer.from(JSON.stringify(data)))
      : await appendVesselEvidenceChunk(user.id,vesselTraceChunkSchema.parse(data));
    else if (options?.method === 'PUT') {
      if (interruptCheckpointCommit) throw new Error('Interrupted before atomic checkpoint commit');
      result = await closeVesselEvidenceRun(user.id,run.id,vesselEvidenceCloseSchema.parse(data));
    }
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
  const partialRecovery = await loadCourseSessionRecovery({userId:user.id,courseKey:'destroyer',courseVersion:VESSEL_COURSE_VERSION});
  const recoveredPartial = partialRecovery.runs.find((item) => item.id === run.id)!;
  const deferredRecovery = await loadCourseSessionRecovery({ userId:user.id,courseKey:'destroyer',
    courseVersion:VESSEL_COURSE_VERSION,deferTraceChunks:true });
  const deferred = deferredRecovery.runs.find((item) => item.id === run.id)!;
  assert.equal(deferred.trace.length, 0);
  assert.equal(deferred.nativeSensorSamples.length, 0);
  assert.equal(deferred.traceManifest?.controlCount, 140);
  assert.equal(deferred.checkpoint, run.checkpoint);
  assert(deferred.resumable);
  assert((await readVesselEvidenceChunk(user.id,run.id,0)).points.length > 0);
  await assert.rejects(readVesselEvidenceChunk('unrelated-owner',run.id,0),/不存在/);
  const resumed = createServerVesselSession(run.configuration);
  try {
    resumed.restore(recoveredPartial.checkpoint);
    const restoredFrame = JSON.parse(resumed.read()) as VesselSessionFrame;
    assert.equal(restoredFrame.timeS,7,'Server recovery must restore the uploaded in-progress checkpoint');
    assert.equal(restoredFrame.controllerTicks,recoveredPartial.trace.length);
    assert.equal(recoveredPartial.checkpoint,run.checkpoint);
    assert.equal(recoveredPartial.stoppedAtMs,null);
    assert.equal(recoveredPartial.resumable,true);
    assert.equal(recoveredPartial.durationS,11);
  } finally { resumed.free(); }
  const interruptedVerification = await findOwnedVesselRun(user.id, run.id);
  const savedSummary = interruptedVerification.summary as Record<string, unknown>;
  await prisma.simulationRun.update({ where: { id: interruptedVerification.id }, data: {
    summary: { ...savedSummary, evidenceVerification: { status: 'verifying',
      checkpointHash: savedSummary.checkpointHash, runtimeVersion: interruptedVerification.runtimeVersion } } as never,
  } });
  const verifiedProgress = await verifyVesselEvidenceRun(user.id, run.id);
  assert.equal(verifiedProgress.status, 'running');
  assert.equal(verifiedProgress.evidenceStatus, 'verified');
  assert.deepEqual(await verifyVesselEvidenceRun(user.id, run.id), verifiedProgress);
  const verifiedPrefix = await findOwnedVesselRun(user.id, run.id);
  assert.equal(verifiedPrefix.completedAt, null);
  assert((verifiedPrefix.summary as { metrics?: unknown }).metrics);
  const checkpointRequest=captured.find((item) => (item.data as {reason?:string}).reason === 'checkpoint')!;
  const checkpointInput=vesselEvidenceCloseSchema.parse(checkpointRequest.data);
  const repeatedCheckpoints=await Promise.all([
    closeVesselEvidenceRun(user.id,run.id,checkpointInput),
    closeVesselEvidenceRun(user.id,run.id,checkpointInput),
  ]);
  assert.deepEqual(repeatedCheckpoints,[verifiedProgress,verifiedProgress]);
  const batchRunRef = randomUUID();
  const openingRequest = captured.find((item) => item.url === '/api/ilab/experiment-runs')!;
  await openVesselEvidenceRun(user.id,vesselEvidenceOpeningSchema.parse({
    ...(openingRequest.data as Record<string,unknown>),runRef:batchRunRef,
  }));
  const batchRun = await findOwnedVesselRun(user.id,batchRunRef);
  try {
    const pendingChunks:string[] = [];
    for (const request of captured.filter((item) => item.url.includes('/chunks'))) {
      const staged = await stageVesselEvidenceChunk(user.id,vesselTraceChunkSchema.parse({
        ...(request.data as Record<string,unknown>),runRef:batchRunRef,
      }));
      pendingChunks.push(staged.reference);
    }
    assert.equal(pendingChunks.length,2);
    const originalRun = await findOwnedVesselRun(user.id,run.id);
    const collision = await prisma.simulationTrace.findFirstOrThrow({where:{runId:originalRun.id,chunkIndex:1}});
    await prisma.simulationTrace.create({data:{...collision,id:undefined,runId:batchRun.id,
      summaryMetrics: collision.summaryMetrics as Prisma.InputJsonValue,
      sampleStorageUri:pendingChunks[1],checksum:pendingChunks[1].split(':').at(-1)!}});
    const batchInput = {...checkpointInput,pendingChunks,
      baseCheckpointReference:(batchRun.summary as {lastCheckpointReference:string}).lastCheckpointReference};
    await assert.rejects(closeVesselEvidenceRun(user.id,batchRunRef,batchInput),{code:'P2002'});
    assert.deepEqual((await findOwnedVesselRun(user.id,batchRunRef)).summary,batchRun.summary);
    assert.deepEqual((await prisma.simulationTrace.findMany({where:{runId:batchRun.id}})).map((trace)=>trace.chunkIndex),[1]);
    assert.equal((await prisma.appliedRunEnvelope.findUniqueOrThrow({where:{runRef:batchRunRef}})).firstSampleReceipt,null);
    await prisma.simulationTrace.deleteMany({where:{runId:batchRun.id}});
    const batchSaved = await closeVesselEvidenceRun(user.id,batchRunRef,batchInput);
    assert.equal(batchSaved.controlCount,partial.controlCount);
    assert.equal(batchSaved.nativeCount,partial.nativeCount);
    assert.equal(batchSaved.fineCount,partial.fineCount);
    assert.deepEqual(await closeVesselEvidenceRun(user.id,batchRunRef,batchInput),batchSaved);
    const rows = await prisma.simulationTrace.findMany({where:{runId:batchRun.id},orderBy:{chunkIndex:'asc'}});
    assert.deepEqual(rows.map((trace)=>trace.sampleStorageUri),pendingChunks);
    assert(rows.every((trace)=>trace.summaryMetrics !== null));
  } finally { await prisma.simulationRun.delete({where:{id:batchRun.id}}); }
  await assert.rejects(stageVesselEvidenceChunk('unrelated-owner',vesselTraceChunkSchema.parse(
    captured.find((item)=>item.url.includes('/chunks'))!.data)),/不存在/);
  const beforeRetry = await prisma.simulationTrace.count({where:{runId:(await findOwnedVesselRun(user.id,run.id)).id}});
  const originalChunk = captured.find((item)=>item.url.includes('/chunks'))!.data;
  const withLateral = vesselTraceChunkSchema.parse(originalChunk);
  assert.equal(typeof withLateral.points[0].estimate.groundBodyLateralSpeedMps,'number');
  assert.equal(typeof withLateral.points[0].truth.waterLateralSpeedMps,'number');
  const oldChunk = structuredClone(withLateral);
  for (const point of oldChunk.points) {
    delete point.estimate.groundBodyLateralSpeedMps;
    delete point.truth.waterLateralSpeedMps;
  }
  assert.doesNotThrow(()=>vesselTraceChunkSchema.parse(oldChunk));
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
  interruptCheckpointCommit = true;
  await assert.rejects(uploadVesselRunEvidence(reportClientRef,run),/Interrupted before atomic checkpoint commit/);
  const interruptedRun = await findOwnedVesselRun(user.id,run.id);
  assert.equal((interruptedRun.summary as {lastTimeS:number}).lastTimeS,7);
  assert.equal(interruptedRun.completedAt,null);
  assert.equal(await prisma.simulationTrace.count({where:{runId:interruptedRun.id}}),beforeRetry);
  const interruptedRecovery = await loadCourseSessionRecovery({userId:user.id,courseKey:'destroyer',courseVersion:VESSEL_COURSE_VERSION});
  assert.equal(interruptedRecovery.runs.find((item) => item.id === run.id)!.checkpoint,recoveredPartial.checkpoint);
  interruptCheckpointCommit = false;
  const completed = await uploadVesselRunEvidence(reportClientRef,run);
  assert.equal(completed.status,'completed');
  assert.equal(completed.controlCount,220);
  assert.equal(completed.nativeCount,run.nativeSensorSamples.length);
  assert.equal(completed.fineCount,361);
  const completedSummary = (await findOwnedVesselRun(user.id,run.id)).summary as {fineStepMetrics:{values:{physicsSamples:number}}};
  assert.equal(completedSummary.fineStepMetrics.values.physicsSamples,1320);
  assert.deepEqual(await uploadVesselRunEvidence(reportClientRef,run),completed);
  await assert.rejects(uploadVesselRunEvidence(reportClientRef,{...run,trace:[...run.trace,run.trace.at(-1)!]}),/后续记录/);
  const savedChunk = vesselTraceChunkSchema.parse(captured.find((item) => item.url.includes('/chunks'))!.data);
  const storedChunk = await prisma.simulationTrace.findUniqueOrThrow({where:{runId_chunkIndex:{runId:interruptedRun.id,chunkIndex:savedChunk.chunkIndex}}});
  assert.deepEqual(await stageVesselEvidenceChunk(user.id,savedChunk),{reference:storedChunk.sampleStorageUri});
  await assert.rejects(stageVesselEvidenceChunk(user.id,{...savedChunk,endTimeS:savedChunk.endTimeS+1}),/已经结束/);
  await assert.rejects(stageVesselEvidenceChunk('unrelated-owner',savedChunk),/不存在/);
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
    const earlierManualInput = {...earlier.input,feedback:'estimate' as const};
    earlierNative.advance(0,JSON.stringify(earlierManualInput));
    const manualReceipt = await openVesselEvidenceRun(user.id,vesselEvidenceOpeningSchema.parse({
      reportClientRef,runRef:randomUUID(),courseKey:'destroyer',courseVersion:VESSEL_COURSE_VERSION,stepSequence:1,
      configuration:earlierConfiguration,input:earlierManualInput,parameterHash:earlier.parameterHash,
      initialCheckpoint:earlierNative.snapshot(),prediction:'Earlier manual input does not close a feedback loop',startedAtMs:Date.now(),
    }));
    assert.equal(manualReceipt.status,'running');
    await assert.rejects(openVesselEvidenceRun(user.id,vesselEvidenceOpeningSchema.parse({
      reportClientRef,runRef:randomUUID(),courseKey:'destroyer',courseVersion:VESSEL_COURSE_VERSION,stepSequence:9,
      configuration:DESTROYER_COURSE_STEPS[8].configuration,input:{...earlierManualInput,controlMode:'p'},
      parameterHash:earlier.parameterHash,initialCheckpoint:earlierNative.snapshot(),
      prediction:'Closed-loop teaching still requires measurement feedback',startedAtMs:Date.now(),
    })),/实际运行条件/);
  } finally {earlierNative.free();}
  const lngConfiguration = LNG_COURSE_STEPS[9].configuration;
  const lngNative = createServerVesselSession(lngConfiguration);
  try {
    const initial = JSON.parse(lngNative.read()) as VesselSessionFrame;
    const shaftReferenceRpm = initial.input.actuators.shafts[0].speed_reference_rad_s*30/Math.PI;
    const lngInput = lngCourseInput(LNG_COURSE_STEPS[9],lngCourseDefaultSettings(10),initial.input,initial,
      {structure:{kind:'fopdt',k:.05,t_s:100,delay_s:2},speedMps:4,shaftReferenceRpm});
    lngNative.advance(0,JSON.stringify(lngInput));
    const lngReportRef = randomUUID(), lngRunRef = randomUUID();
    const lngContext = {reportClientRef:lngReportRef,courseKey:'lng',courseVersion:VESSEL_COURSE_VERSION};
    const lngModelRef = randomUUID();
    const earlierLngInitial = lngNative.snapshot().replace(/"lng":\{[^{}]*\},/,'').replace(/,"lngLateralWindow":\[\]/,'');
    assert(!earlierLngInitial.includes('"lng":'));
    await openVesselEvidenceRun(user.id,vesselEvidenceOpeningSchema.parse({...lngContext,runRef:lngRunRef,
      stepSequence:10,configuration:lngConfiguration,input:lngInput,parameterHash:initial.parameterHash,
      courseSettings:lngCourseDefaultSettings(10),designStudentModelId:lngModelRef,
      initialCheckpoint:earlierLngInitial,prediction:'Declared fixture checks speed comparison persistence',startedAtMs:Date.now()}));
    const points:VesselRunEvidence['trace'] = [], nativeSamples:VesselRunEvidence['nativeSensorSamples'] = [];
    const fineSamples:NonNullable<VesselRunEvidence['fineStepSamples']> = [];
    for (let second=0;second<3;second++) {
      const current = JSON.parse(lngNative.advance(1,'')) as VesselSessionFrame;
      for (const packet of current.controlSamples) points.push(collectVesselTracePoint(packet,points.at(-1)?.measurements ?? {}));
      nativeSamples.push(...current.samples);fineSamples.push(...(current.fineStepSamples ?? []));
    }
    assert.equal(points[0].liquid?.modeHeightsM.length,8);
    assert.equal(points[0].liquid?.cornerHeightsM.length,4);
    assert.equal(typeof points[0].longitudinal?.referenceMps,'number');
    await appendVesselEvidenceChunk(user.id,vesselTraceChunkSchema.parse({schema:'act.vessel-trace-chunk.v1',runRef:lngRunRef,chunkIndex:0,
      parameterHash:initial.parameterHash,controlStart:0,nativeStart:0,fineStart:0,endTimeS:3,
      points,nativeSamples,fineSamples,changes:[]}));
    await closeVesselEvidenceRun(user.id,lngRunRef,vesselEvidenceCloseSchema.parse({checkpoint:lngNative.snapshot(),
      endTimeS:3,controlCount:points.length,nativeCount:nativeSamples.length,fineCount:fineSamples.length,
      reason:'duration',failure:null}));
    const lngSaved = await findOwnedVesselRun(user.id,lngRunRef);
    const lngMetrics = (lngSaved.summary as unknown as {fineStepMetrics:NonNullable<VesselSessionFrame['fineStepMetrics']>}).fineStepMetrics.values.lng;
    assert.equal(lngMetrics?.physicsSamples,360);
    assert.equal(lngMetrics?.lateralWindowDurationS,3);
    await saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...lngContext,model:{clientRef:lngModelRef,payload:{
      experimentKey:'lng',lineageKey:'reference-speed-fixture',structure:{kind:'fopdt',k:.05,t_s:100,delay_s:2},
      ioContract:{inputChannel:'ShaftReference0',outputChannel:'SpeedLog',inputUnit:'r/min',outputUnit:'m/s'},
      operatingPoint:{speedMps:4,inputOrigin:shaftReferenceRpm,outputOrigin:4},
      identification:{algorithm:'fixture',settings:{},identifiedOk:true},
      trainingRuns:[{runRef:lngRunRef,startS:0,endS:1}],validationRuns:[],sampleDt:.2,
    }}}));
    const speedComparison = {clientRef:randomUUID(),modelClientRef:lngModelRef,actuatorModelClientRef:null,
      runRef:lngRunRef,mode:'command_to_output',startS:2,endS:3,timeS:[2,3],actual:[4,3.99],predicted:[4,3.99],
      measuredInput:[shaftReferenceRpm,shaftReferenceRpm],predictedInput:null,metrics:{rmse:0},
      purpose:'validation',createdAtMs:Date.now(),outputUnit:'m/s',outputChannel:'SpeedLog'};
    assert.equal((await saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...lngContext,comparison:speedComparison}))).kind,'comparison');
    const independent = {...speedComparison,clientRef:randomUUID(),mode:'independent_closed_loop',controllerInput:lngInput};
    assert.equal((await saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...lngContext,comparison:independent}))).kind,'comparison');
    await assert.rejects(saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...lngContext,
      comparison:{...independent,clientRef:randomUUID(),controllerInput:undefined}})),/冻结控制器/);
    await assert.rejects(saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...lngContext,
      comparison:{...speedComparison,clientRef:randomUUID(),outputChannel:'YawRate'}})),/航速输出通道/);
    const recovered=await loadCourseSessionRecovery({userId:user.id,courseKey:'lng',courseVersion:VESSEL_COURSE_VERSION});
    assert.equal(recovered.models.find((item)=>item.id===lngModelRef)?.channel,'shaft-reference-to-speed');
    assert.equal(recovered.runs.find((item)=>item.id===lngRunRef)?.parameters?.massKg,initial.parameters.massKg);
    assert.equal(recovered.comparisons.find((item)=>item.id===speedComparison.clientRef)?.outputChannel,'SpeedLog');
  } finally {lngNative.free();}
  const containerSettings = {...containerCourseDefaultSettings(7),modelIds:[randomUUID(),randomUUID(),randomUUID()] as [string,string,string]};
  const containerConfiguration = containerCourseConfiguration(7,containerSettings);
  const containerNative = createServerVesselSession(containerConfiguration);
  try {
    const initial = JSON.parse(containerNative.read()) as VesselSessionFrame;
    const rpm = initial.input.actuators.shafts[0].speed_reference_rad_s*30/Math.PI;
    const models = [.2,.6,.9].map((loading,index) => ({id:containerSettings.modelIds[index],channel:'shaft-reference-to-speed',
      payload:{structure:{kind:'fopdt',k:.05,t_s:160,delay_s:2},operatingPoint:{loadingRatio:loading,speedMps:8,inputOrigin:rpm}}})) as unknown as FrozenVesselStudentModel[];
    const input = containerCourseInput(7,containerSettings,initial.input,initial,models);
    const applied = JSON.parse(containerNative.advance(0,JSON.stringify(input))) as VesselSessionFrame;
    const reportClientRef = randomUUID(),runRef = randomUUID();
    const opening = vesselEvidenceOpeningSchema.parse({reportClientRef,runRef,courseKey:'container',courseVersion:VESSEL_COURSE_VERSION,
      stepSequence:7,configuration:containerConfiguration,input:applied.input,parameterHash:initial.parameterHash,
      initialCheckpoint:containerNative.snapshot(),courseSettings:containerSettings,designStudentModelId:containerSettings.modelIds[1],
      prediction:'Declared fixture checks native container scheduling channels and private persistence',startedAtMs:Date.now()});
    await openVesselEvidenceRun(user.id,opening);
    await assert.rejects(openVesselEvidenceRun(user.id,{...opening,runRef:randomUUID(),
      configuration:{...containerConfiguration,seed:17}}),/课程约定/);
    const points:VesselRunEvidence['trace']=[],nativeSamples:VesselRunEvidence['nativeSensorSamples']=[];
    const fineSamples:NonNullable<VesselRunEvidence['fineStepSamples']>=[];
    for (let second=0;second<3;second++) {
      const current=JSON.parse(containerNative.advance(1,'')) as VesselSessionFrame;
      for (const packet of current.controlSamples) points.push(collectVesselTracePoint(packet,points.at(-1)?.measurements ?? {}));
      nativeSamples.push(...current.samples);fineSamples.push(...(current.fineStepSamples ?? []));
    }
    assert.equal(typeof points[0].container?.integralRpm,'number');
    assert.deepEqual(points[0].container?.modelWeights,[0,1,0]);
    const chunk=vesselTraceChunkSchema.parse({schema:'act.vessel-trace-chunk.v1',runRef,chunkIndex:0,parameterHash:initial.parameterHash,
      controlStart:0,nativeStart:0,fineStart:0,endTimeS:3,points,nativeSamples,fineSamples,changes:[]});
    assert.deepEqual(chunk.points[0].container,points[0].container);
    await appendVesselEvidenceChunk(user.id,chunk);
    await closeVesselEvidenceRun(user.id,runRef,vesselEvidenceCloseSchema.parse({checkpoint:containerNative.snapshot(),endTimeS:3,
      controlCount:points.length,nativeCount:nativeSamples.length,fineCount:fineSamples.length,reason:'duration',failure:null}));
    const saved=await findOwnedVesselRun(user.id,runRef);
    const summary=saved.summary as {parameters:VesselSessionFrame['parameters'];fuelKg:number};
    assert.equal(summary.parameters.massKg,initial.parameters.massKg);
    assert.equal(summary.parameters.windAreasM2?.lateral,initial.parameters.windAreasM2?.lateral);
    assert(summary.fuelKg > 0);
  } finally {containerNative.free();}
  const cruiseSettings = cruiseCourseDefaultSettings(16);
  const cruiseConfiguration = cruiseCourseConfiguration(16,cruiseSettings);
  const cruiseNative = createServerVesselSession(cruiseConfiguration);
  try {
    const initial=JSON.parse(cruiseNative.read()) as VesselSessionFrame;
    const model={id:randomUUID(),channel:'fin-to-roll',payload:{
      structure:{kind:'roll_oscillator',natural_freq_rad_s:.3,damping:.05,control_gain:1e6},
      operatingPoint:{rollInertiaKgM2:initial.parameters.rollInertiaKgM2}}} as unknown as FrozenVesselStudentModel;
    const input=cruiseCourseInput(16,cruiseSettings,initial.input,initial,model);
    const applied=JSON.parse(cruiseNative.advance(0,JSON.stringify(input))) as VesselSessionFrame;
    const reportClientRef=randomUUID(),runRef=randomUUID();
    const opening=vesselEvidenceOpeningSchema.parse({reportClientRef,runRef,courseKey:'cruise',courseVersion:VESSEL_COURSE_VERSION,
      stepSequence:16,configuration:cruiseConfiguration,input:applied.input,parameterHash:initial.parameterHash,
      initialCheckpoint:cruiseNative.snapshot(),courseSettings:cruiseSettings,designStudentModelId:model.id,
      prediction:'Declared fixture checks actual cruise IMU feedback and two-point comfort evidence',startedAtMs:Date.now()});
    await openVesselEvidenceRun(user.id,opening);
    await assert.rejects(openVesselEvidenceRun(user.id,{...opening,runRef:randomUUID(),
      input:{...applied.input,feedback:'truth'}} as unknown as VesselEvidenceOpening),/课程约定/);
    const points:VesselRunEvidence['trace']=[],nativeSamples:VesselRunEvidence['nativeSensorSamples']=[];
    const fineSamples:NonNullable<VesselRunEvidence['fineStepSamples']>=[];
    for(let second=0;second<3;second++) {
      const current=JSON.parse(cruiseNative.advance(1,'')) as VesselSessionFrame;
      for(const packet of current.controlSamples) points.push(collectVesselTracePoint(packet,points.at(-1)?.measurements ?? {}));
      nativeSamples.push(...current.samples);fineSamples.push(...(current.fineStepSamples ?? []));
    }
    assert.equal(typeof points.at(-1)!.cruise?.estimatedRollRad,'number');
    const chunk=vesselTraceChunkSchema.parse({schema:'act.vessel-trace-chunk.v1',runRef,chunkIndex:0,parameterHash:initial.parameterHash,
      controlStart:0,nativeStart:0,fineStart:0,endTimeS:3,points,nativeSamples,fineSamples,changes:[]});
    for(const key of ['estimatedRollRad','estimatedPitchRad','filteredRollRad','filteredRollRateRadS',
      'requestedMomentNm','availableMomentNm','allocatedMomentNm','anglesRad','measurementGood','lowSpeedAuthority','samples'] as const) {
      assert.deepEqual(chunk.points.at(-1)!.cruise?.[key],points.at(-1)!.cruise?.[key]);
    }
    await appendVesselEvidenceChunk(user.id,chunk);
    await closeVesselEvidenceRun(user.id,runRef,vesselEvidenceCloseSchema.parse({checkpoint:cruiseNative.snapshot(),endTimeS:3,
      controlCount:points.length,nativeCount:nativeSamples.length,fineCount:fineSamples.length,reason:'student',failure:null}));
    const saved=await findOwnedVesselRun(user.id,runRef);
    const summary=saved.summary as unknown as {cruiseComfort:NonNullable<VesselSessionFrame['cruiseComfort']>};
    assert.equal(summary.cruiseComfort.physicsSamples,360);
    assert.equal(summary.cruiseComfort.passengers.length,2);
    assert.equal(summary.cruiseComfort.comfortInterpretation,'teaching_proxy_unweighted');
    assert(summary.cruiseComfort.positivePropulsionWorkJ>0);
    assert(summary.cruiseComfort.finServoElectricWorkJ>0);
    const context={reportClientRef,courseKey:'cruise',courseVersion:VESSEL_COURSE_VERSION};
    await saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...context,model:{clientRef:model.id,payload:{
      experimentKey:'cruise',lineageKey:'roll-evidence-fixture',structure:model.payload.structure,
      ioContract:{inputChannel:'FinDifferential',outputChannel:'EstimatedRoll',inputUnit:'°',outputUnit:'°'},
      operatingPoint:model.payload.operatingPoint,identification:{algorithm:'fixture',settings:{},identifiedOk:true},
      trainingRuns:[{runRef,startS:0,endS:1}],validationRuns:[],sampleDt:.05,
    }}}));
    const comparison={clientRef:randomUUID(),modelClientRef:model.id,actuatorModelClientRef:null,runRef,mode:'hull_model',
      startS:2,endS:3,timeS:[2,3],actual:[0,0],predicted:[0,0],measuredInput:[0,0],predictedInput:null,
      metrics:{rmse:0},purpose:'validation',createdAtMs:Date.now(),outputUnit:'°',outputChannel:'EstimatedRoll'};
    assert.equal((await saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...context,comparison}))).kind,'comparison');
    await assert.rejects(saveVesselCourseArtifact(user.id,vesselCourseArtifactSchema.parse({...context,
      comparison:{...comparison,clientRef:randomUUID(),mode:'command_to_output'}})),/A模式/);
    const recovered=await loadCourseSessionRecovery({userId:user.id,courseKey:'cruise',courseVersion:VESSEL_COURSE_VERSION});
    const recoveredRun=recovered.runs.find((item)=>item.id===runRef);
    assert.equal(recovered.models.find((item)=>item.id===model.id)?.channel,'fin-to-roll');
    assert.equal(recoveredRun?.parameters?.rollInertiaKgM2,initial.parameters.rollInertiaKgM2);
    assert.equal(recoveredRun?.cruiseComfort?.physicsSamples,360);
    assert.equal(recoveredRun?.courseSettings?.dampingRatio,cruiseSettings.dampingRatio);
    assert.equal(recovered.comparisons.find((item)=>item.id===comparison.clientRef)?.outputChannel,'EstimatedRoll');
  } finally {cruiseNative.free();}
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
    checks:['gzip-bound','opening-identity','pause-prefix','exact-running-checkpoint','atomic-interrupted-upload',
      'atomic-batch-unique-conflict','atomic-batch-rollback','atomic-batch-retry',
      'concurrent-checkpoint-retry','concurrent-retry','conflict-409','foreign-404','append-resume','native-close','terminal-retry','closed-chunk-retry','closed-chunk-conflict','closed-chunk-owner',
      'receipt-time','model-freeze','comparison','server-attempt-validation','report-minimum','escaped-html',
      'review-authorization','pending-score-null','fixed-rubric','finalization-freeze']}));
} finally {
  globalThis.fetch = fetchOriginal;
  native.free();
  await closeEvidenceCpuPool();
  await prisma.simulationRun.deleteMany({where:{ownerUserId:user.id}});
  await prisma.user.delete({where:{id:user.id}});
  await prisma.user.delete({where:{id:reviewer.id}});
  await prisma.$disconnect();
  await rm(privateRoot,{recursive:true,force:true});
}
