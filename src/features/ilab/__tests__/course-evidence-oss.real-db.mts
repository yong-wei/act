import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from 'dotenv';
import { prisma } from '@/lib/prisma';
import { CONTROL_ENGINE_BUILD_HASH } from '@/lib/control-engine/identity.generated';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { collectVesselTracePoint, type VesselRunEvidence } from '@/features/simulations/run-evidence';
import { vesselEvidenceOpeningInput } from '@/features/simulations/evidence-opening';
import { prepareVesselOssSave, decodeVesselOssObject } from '@/features/simulations/evidence-worker-format';
import { vesselEvidenceOpeningSchema, vesselEvidenceOssGrantSchema, vesselEvidenceOssObjectSchema, vesselEvidenceDirectCloseSchema,
  vesselEvidenceCloseSchema, vesselTraceChunkSchema, type VesselTraceChunk, type VesselEvidenceOpening } from '../course-evidence-contract';
import { openVesselEvidenceRun, findOwnedVesselRun, vesselRunProgress } from '../course-evidence-service';
import { authorizeOwnedVesselUploads, commitOwnedVesselUpload, authorizeOwnedVesselDownloads } from '../adapters/course-evidence-oss';
import { loadCourseSessionRecovery } from '../adapters/course-session-recovery';
import { hasVerifiedVesselEvidence, stageVesselEvidenceChunk, closeVesselEvidenceRun, readVesselEvidenceChunk } from '../course-evidence-chunks';
import { simulationOssLocation, simulationOssReference } from '@/features/simulations/public-api';
import { canonicalJson } from '@/lib/student-model-artifact-contract';
import { DESTROYER_COURSE_STEPS, VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname), 'Only a local database is permitted');
assert.equal(process.env.SIMULATION_EVIDENCE_OSS_BUCKET, 'act-simulation-evidence');
assert.equal(process.env.SIMULATION_EVIDENCE_DIRECT_UPLOAD, '1');
const privateRoot = await mkdtemp(path.join(os.tmpdir(), 'act-direct-evidence-'));
process.env.SIMULATION_EVIDENCE_ROOT = privateRoot;
for (const key of ['SUBMISSION_S3_ENDPOINT', 'SUBMISSION_S3_BUCKET', 'SUBMISSION_S3_ACCESS_KEY', 'SUBMISSION_S3_SECRET_KEY']) process.env[key] = '';
const user = await prisma.user.create({ data: { name: 'private OSS evidence integration fixture' } });
const native = createServerVesselSession(DESTROYER_COURSE_STEPS[0].configuration);
const runRef = `00000000-0000-4000-8000-${randomBytes(6).toString('hex')}`;
const reportClientRef = randomUUID();
let frame = JSON.parse(native.read()) as VesselSessionFrame;
frame.input.feedback = 'measurement';
native.advance(0, JSON.stringify(frame.input));
const run: VesselRunEvidence = {
  id: runRef, scopeKey: 'direct-evidence-fixture', courseKey: 'destroyer', courseVersion: VESSEL_COURSE_VERSION,
  stepSequence: 1, prediction: ' \n验证本人原始记录直传、断网、并发提交与独立核验。\n ', durationS: 11,
  createdAtMs: Date.now(), lastTimeS: 0, stoppedAtMs: null, configuration: DESTROYER_COURSE_STEPS[0].configuration,
  initialInput: frame.input, parameterHash: frame.parameterHash, runtimeVersion: CONTROL_ENGINE_BUILD_HASH,
  initialCheckpoint: native.snapshot(), checkpoint: native.snapshot(), trace: [], nativeSensorSamples: [],
  fineStepSamples: [], changes: [], stopReason: null, failure: null,
};
const opening = vesselEvidenceOpeningSchema.parse(vesselEvidenceOpeningInput(reportClientRef, run)) as unknown as VesselEvidenceOpening;
const checks: string[] = [];
async function advance(seconds: number) {
  for (let index = 0; index < seconds; index++) {
    frame = JSON.parse(native.advance(1, JSON.stringify(run.initialInput))) as VesselSessionFrame;
    for (const point of frame.controlSamples) run.trace.push(collectVesselTracePoint(point, run.trace.at(-1)?.measurements ?? {}));
    run.nativeSensorSamples.push(...frame.samples);
    run.fineStepSamples!.push(...(frame.fineStepSamples ?? []));
    run.lastTimeS = frame.timeS;
  }
  run.checkpoint = native.snapshot();
  run.checkpointPreview = { schema: 'act.vessel-checkpoint-preview.v1', recoverable: true,
    runtimeVersion: CONTROL_ENGINE_BUILD_HASH, parameterHash: frame.parameterHash, timeS: frame.timeS,
    controllerTicks: frame.controllerTicks, fineCount: frame.fineStepWindowSampleCount ?? 0,
    appliedFinalInput: frame.input, metrics: {} as never };
}
async function prepare() {
  const progress = vesselRunProgress(await findOwnedVesselRun(user.id, runRef));
  return prepareVesselOssSave({ ...run, trace: run.trace.slice(progress.controlCount),
    nativeSensorSamples: run.nativeSensorSamples.slice(progress.nativeCount),
    fineStepSamples: run.fineStepSamples!.slice(progress.fineCount) }, progress,
  progress.openingReference.startsWith('simulation-cas:oss:') ? undefined : vesselEvidenceOpeningInput(reportClientRef, run));
}
async function upload(prepared: Awaited<ReturnType<typeof prepare>>) {
  const descriptors = vesselEvidenceOssGrantSchema.parse({ objects: prepared.objects.map(object => object.descriptor) }).objects;
  const result = await authorizeOwnedVesselUploads(user.id, runRef, descriptors);
  for (const object of prepared.objects) {
    const grant = result.objects.find(grant => grant.reference === object.descriptor.reference)!;
    if (grant.confirmed) continue;
    const form = new FormData();
    for (const [key, value] of Object.entries(grant.fields)) form.append(key, value);
    form.append('file', new Blob([object.body], { type: 'application/gzip' }), 'evidence.json.gz');
    const response = await fetch(grant.url, { method: 'POST', body: form });
    assert([200, 409].includes(response.status), `OSS upload ${response.status}`);
  }
}
async function alternativeEncoding(prepared: Awaited<ReturnType<typeof prepare>>): Promise<Awaited<ReturnType<typeof prepare>>> {
  const original = prepared.objects.find(object => object.descriptor.purpose === 'chunk')!;
  assert(original.descriptor.purpose === 'chunk');
  const value = await decodeVesselOssObject(original.descriptor.reference, original.body);
  const encoded = Buffer.from(canonicalJson(value));
  const compressed = gzipSync(encoded, { level: 1 });
  assert.notEqual(compressed.length, original.body.size);
  const location = simulationOssLocation(original.descriptor.reference);
  const reference = simulationOssReference(runRef, 'chunk', location.sequence, location.checksum, compressed.length);
  const replacement = { body: new Blob([new Uint8Array(compressed)]),
    descriptor: { ...original.descriptor, reference, storedBytes: compressed.length } };
  const close = { ...prepared.close,
    pendingChunks: prepared.close.pendingChunks!.map(ref => ref === original.descriptor.reference ? reference : ref) };
  const checkpoint = { schema: 'act.vessel-run-close.v1', ...close, checkpoint: run.checkpoint,
    appliedFinalInput: run.checkpointPreview!.appliedFinalInput };
  const raw = Buffer.from(canonicalJson(checkpoint));
  const zipped = gzipSync(raw);
  const checkpointReference = simulationOssReference(runRef, 'checkpoint', close.controlCount,
    createHash('sha256').update(raw).digest('hex'), zipped.length);
  return { close, checkpointReference, objects: [
    ...prepared.objects.filter(object => object !== original && object.descriptor.purpose !== 'checkpoint'), replacement,
    { body: new Blob([new Uint8Array(zipped)]), descriptor: vesselEvidenceOssObjectSchema.parse({ purpose: 'checkpoint',
      reference: checkpointReference, uncompressedBytes: raw.length, storedBytes: zipped.length,
      close: { ...close, checkpointPreview: run.checkpointPreview! } }) },
  ] };
}
const inputFor = (prepared: Awaited<ReturnType<typeof prepare>>) => vesselEvidenceDirectCloseSchema.parse({
  ...prepared.close, checkpointReference: prepared.checkpointReference,
});
async function legacySave() {
  const prepared = await prepare();
  const pendingChunks: string[] = [];
  for (const object of prepared.objects.filter(object => object.descriptor.purpose === 'chunk')) {
    const value = await decodeVesselOssObject(object.descriptor.reference, object.body);
    const chunk = vesselTraceChunkSchema.parse(value) as unknown as VesselTraceChunk;
    pendingChunks.push((await stageVesselEvidenceChunk(user.id, chunk)).reference);
  }
  const { openingReference: _openingReference, ...close } = prepared.close;
  return closeVesselEvidenceRun(user.id, runRef, vesselEvidenceCloseSchema.parse({ ...close, pendingChunks, checkpoint: run.checkpoint }));
}
try {
  await openVesselEvidenceRun(user.id, opening);
  await advance(4);
  const legacy = await legacySave();
  assert(legacy.checkpointReference.startsWith('simulation-cas:file:'));
  const legacyRun = await findOwnedVesselRun(user.id, runRef);
  const { recoveryHeader: _header, recoveryCheckpoint: _recoveryCheckpoint, ...legacySummary } = legacyRun.summary as Record<string, unknown>;
  await prisma.simulationRun.update({ where: { id: legacyRun.id }, data: { summary: legacySummary as never } });
  const legacyRecovery = await loadCourseSessionRecovery({ userId: user.id, courseKey: 'destroyer', reportClientRef,
    deferTraceChunks: true, lazyHistory: true, deferStateObjects: true });
  assert('checkpoint' in legacyRecovery.runs[0]);
  assert.equal(legacyRecovery.runs[0].checkpoint, run.checkpoint);
  const cachedLegacy = (await findOwnedVesselRun(user.id, runRef)).summary as Record<string, unknown>;
  assert.equal(cachedLegacy.controlCount, 80);
  assert.equal(cachedLegacy.lastCheckpointReference, legacy.checkpointReference);
  assert(cachedLegacy.recoveryHeader && cachedLegacy.recoveryCheckpoint);
  assert(!('initialCheckpoint' in (cachedLegacy.recoveryHeader as object)));
  assert(!('checkpoint' in (cachedLegacy.recoveryCheckpoint as object)));
  checks.push('legacy-recovery-metadata-backfill');
  await advance(3);
  const originalEncoding = await prepare();
  await authorizeOwnedVesselUploads(user.id, runRef, vesselEvidenceOssGrantSchema.parse({ objects: originalEncoding.objects.map(object => object.descriptor) }).objects);
  await assert.rejects(commitOwnedVesselUpload(user.id, runRef, inputFor(originalEncoding)));
  assert.equal(vesselRunProgress(await findOwnedVesselRun(user.id, runRef)).controlCount, 80);
  checks.push('partial-upload-preserves-progress');
  await upload(originalEncoding);
  const first = await alternativeEncoding(originalEncoding);
  await upload(first);
  await upload(first);
  checks.push('lost-upload-receipt-duplicate-object', 'different-gzip-encoding-after-partial-upload');
  const repeated = await Promise.all([
    commitOwnedVesselUpload(user.id, runRef, inputFor(first)), commitOwnedVesselUpload(user.id, runRef, inputFor(first)),
  ]);
  assert.deepEqual(repeated[0], repeated[1]);
  assert.equal(repeated[0].controlCount, 140);
  assert.equal(repeated[0].evidenceStatus, 'pending');
  assert.equal(await prisma.simulationTrace.count({ where: { run: { ownerUserId: user.id } } }), 3);
  checks.push('concurrent-atomic-prefix', 'metadata-only-checkpoint', 'legacy-file-prefix-to-oss');
  const recovery = await loadCourseSessionRecovery({ userId: user.id, courseKey: 'destroyer', reportClientRef,
    deferTraceChunks: true, lazyHistory: true, deferStateObjects: true });
  assert.equal(recovery.runs.length, 1);
  assert('stateObjects' in recovery.runs[0]);
  assert(!('checkpoint' in recovery.runs[0]));
  assert.equal(recovery.runs[0].traceManifest?.references?.length, 3);
  const grants = await authorizeOwnedVesselDownloads(user.id, runRef, first.objects.map(object => object.descriptor.reference));
  assert.equal(grants.objects.length, first.objects.length);
  await assert.rejects(authorizeOwnedVesselDownloads('unrelated-owner', runRef, [first.checkpointReference]), /不存在/);
  checks.push('reference-only-recovery', 'private-owned-download');
  process.env.SIMULATION_EVIDENCE_DIRECT_UPLOAD = '0';
  await advance(1);
  const fallback = await legacySave();
  assert.equal(fallback.transport, 'legacy');
  assert.equal((await readVesselEvidenceChunk(user.id, runRef, 1)).runRef, runRef);
  checks.push('reader-preserved-with-direct-upload-disabled');
  process.env.SIMULATION_EVIDENCE_DIRECT_UPLOAD = '1';
  await advance(3);
  const validCheckpoint = run.checkpoint;
  run.stoppedAtMs = Date.now();
  run.stopReason = 'duration';
  run.checkpoint = 'invalid-checkpoint';
  const invalid = await prepare();
  await upload(invalid);
  await assert.rejects(commitOwnedVesselUpload(user.id, runRef, inputFor(invalid)), error => {
    assert.equal((error as { savedProgress: { controlCount: number } }).savedProgress.controlCount, 220);
    return true;
  });
  const failed = await findOwnedVesselRun(user.id, runRef);
  assert.equal(failed.status, 'running');
  assert.equal(vesselRunProgress(failed).evidenceStatus, 'failed');
  checks.push('formal-verification-independent', 'failed-verification-preserves-evidence');
  run.checkpoint = validCheckpoint;
  const ending = await prepare();
  await upload(ending);
  const completed = await commitOwnedVesselUpload(user.id, runRef, inputFor(ending));
  assert.equal(completed.status, 'completed');
  assert.equal(completed.evidenceStatus, 'verified');
  assert(hasVerifiedVesselEvidence(await findOwnedVesselRun(user.id, runRef)));
  assert.deepEqual(await commitOwnedVesselUpload(user.id, runRef, inputFor(ending)), completed);
  checks.push('formal-retry', 'formal-success-reused', 'normalized-opening-formal-verification');
  const result = { status: 'passed', controlSamples: completed.controlCount,
    nativeSamples: completed.nativeCount, recoveryBytes: Buffer.byteLength(JSON.stringify(recovery)), checks };
  await writeFile('.logs/direct-evidence-real-db-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  const objects = await prisma.simulationEvidenceObject.findMany({ where: { run: { ownerUserId: user.id } },
    select: { reference: true, storedBytes: true } });
  await writeFile('.logs/direct-evidence-real-db-objects.json', JSON.stringify({ runRef, privateRoot, cleanupPending: true,
    objects: objects.filter(object => object.reference.startsWith('simulation-cas:oss:'))
      .map(object => ({ ...object, key: simulationOssLocation(object.reference).key })) }, null, 2), { mode: 0o600 });
  await prisma.simulationRun.deleteMany({ where: { ownerUserId: user.id } });
  await prisma.virtualSimulationReport.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  native.free();
  await prisma.$disconnect();
  await rm(privateRoot, { recursive: true, force: true });
}
