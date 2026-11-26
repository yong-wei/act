import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { config } from 'dotenv';
import { prisma } from '@/lib/prisma';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import { CONTROL_ENGINE_BUILD_HASH } from '@/lib/control-engine/identity.generated';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { vesselEvidenceOpeningInput } from '@/features/simulations/evidence-opening';
import { vesselEvidenceOpeningSchema, type VesselEvidenceOpening } from '../course-evidence-contract';
import { openVesselEvidenceRun } from '../course-evidence-service';
import { DESTROYER_COURSE_STEPS, VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import { vesselCourseArtifactSchema } from '../course-artifact-contract';
import { drainCourseVerification, enqueueCourseVerification, listQueuedCourseAttempts,
  readCourseVerification } from '../adapters/course-verification-queue';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname));
process.env.SIMULATION_VERIFICATION_QUEUE = '1';
for (const key of ['SUBMISSION_S3_ENDPOINT', 'SUBMISSION_S3_BUCKET', 'SUBMISSION_S3_ACCESS_KEY', 'SUBMISSION_S3_SECRET_KEY']) process.env[key] = '';
const root = await mkdtemp(join(tmpdir(), 'act-verify-queue-'));
process.env.SIMULATION_EVIDENCE_ROOT = root;
const where = { eventType: 'simulation.course.verify-attempt.v1' };
assert.equal(await prisma.evidenceOutbox.count({ where: { ...where, status: { in: ['pending', 'processing'] } } }), 0,
  'Use a local database with no active verification tasks');
const user = await prisma.user.create({ data: { name: 'local verification fixture' } });
try {
  const clientRef = randomUUID();
  const input = vesselCourseArtifactSchema.parse({ reportClientRef: randomUUID(), courseKey: 'destroyer',
    courseVersion: VESSEL_COURSE_VERSION, attempt: { clientRef, stepSequence: 1,
      runRefs: [], modelClientRefs: [], comparisonClientRefs: [], answers: { prediction: '本地队列核验' },
      validationFeedback: null, outcome: 'submitted' } });
  const start = performance.now();
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => enqueueCourseVerification(user.id, input)));
  const receipts = results.map(result => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
  const ingestionMs = performance.now() - start;
  assert(receipts.every(receipt => receipt.verification === 'pending' && receipt.attemptRef === clientRef));
  assert.equal(await prisma.evidenceOutbox.count({ where: { ...where, ownerUserId: user.id } }), 1);
  assert.equal(await prisma.stepSubmissionAttempt.count({ where: { userId: user.id } }), 0);
  process.env.SIMULATION_ADAPTIVE_ADMISSION = '1';
  assert.equal(await drainCourseVerification(), false, 'Without a valid pressure sample, do not claim a new job');
  assert.equal((await readCourseVerification(user.id, clientRef)).verification, 'pending');
  process.env.SIMULATION_ADAPTIVE_ADMISSION = '0';
  assert.equal((await listQueuedCourseAttempts(user.id, input.reportClientRef, 'destroyer'))[0]?.verificationPending, true);
  await assert.rejects(readCourseVerification(randomUUID(), clientRef), { status: 404 });
  await assert.rejects(enqueueCourseVerification(user.id, {
    ...input, attempt: { ...input.attempt!, answers: { prediction: '更改已收件内容' } },
  }), { status: 409 });
  // Simulate a previous worker exiting after claiming the task.
  await prisma.evidenceOutbox.updateMany({ where: { ...where, ownerUserId: user.id },
    data: { status: 'processing', availableAt: new Date(Date.now() - 1000) } });
  const startWorker = performance.now();
  const workers = await Promise.all([drainCourseVerification(), drainCourseVerification(), drainCourseVerification()]);
  const workerMs = performance.now() - startWorker;
  assert.equal(workers.filter(Boolean).length, 1);
  const receipt = await readCourseVerification(user.id, clientRef);
  assert.equal(receipt.verification, 'applied');
  assert.equal(receipt.result?.status, 'invalid_run');
  const storedReceipt = (await listQueuedCourseAttempts(user.id, input.reportClientRef, 'destroyer'))[0];
  assert.equal(storedReceipt?.verificationPending, false);
  assert.deepEqual(storedReceipt?.answers, {}, 'Lightweight applied receipts do not duplicate formal answers');
  assert.equal(await prisma.stepSubmissionAttempt.count({ where: { userId: user.id } }), 1);
  assert.equal((await enqueueCourseVerification(user.id, input)).result?.id, receipt.result?.id);
  const leaseAttempt = async (reportClientRef: string) => {
    const clientRef = randomUUID();
    await enqueueCourseVerification(user.id, { ...input, reportClientRef, attempt: { ...input.attempt!, clientRef } });
    return clientRef;
  };
  const lease = async (ref: string, availableAt: Date) => prisma.evidenceOutbox.updateMany({
    where: { ...where, ownerUserId: user.id, causationId: ref }, data: { status: 'processing', availableAt },
  });
  const validLease = new Date(Date.now() + 60_000);
  const expiredLease = new Date(Date.now() - 1000);
  const held = await leaseAttempt(input.reportClientRef);
  const sameReport = await leaseAttempt(input.reportClientRef);
  const otherReport = await leaseAttempt(randomUUID());
  await lease(held, validLease);
  process.env.SIMULATION_VERIFICATION_CONCURRENCY = '1';
  assert.equal(await drainCourseVerification(), false, 'Single-slot rollback honors the existing lease');
  process.env.SIMULATION_VERIFICATION_CONCURRENCY = '2';
  await lease(otherReport, validLease);
  const thirdReport = await leaseAttempt(randomUUID());
  assert.equal(await drainCourseVerification(), false, 'Two live leases exhaust the shared limit');
  await lease(otherReport, expiredLease);
  assert(await drainCourseVerification(), 'Another report can run while the first report holds a lease');
  assert.equal((await readCourseVerification(user.id, otherReport)).verification, 'applied');
  assert.equal((await readCourseVerification(user.id, sameReport)).verification, 'pending');
  assert(await drainCourseVerification());
  assert.equal((await readCourseVerification(user.id, thirdReport)).verification, 'applied');
  assert.equal(await drainCourseVerification(), false, 'The same-report task still waits for the owner');
  await lease(held, expiredLease);
  assert(await drainCourseVerification());
  assert(await drainCourseVerification());
  assert.equal((await readCourseVerification(user.id, sameReport)).verification, 'applied');
  assert.equal(await prisma.stepSubmissionAttempt.count({ where: { userId: user.id } }), 5);
  const configuration = DESTROYER_COURSE_STEPS[0].configuration;
  const native = createServerVesselSession(configuration);
  const runRef = randomUUID();
  try {
    const initial = JSON.parse(native.read()) as VesselSessionFrame;
    const checkpoint = native.snapshot();
    const opening = vesselEvidenceOpeningSchema.parse(vesselEvidenceOpeningInput(input.reportClientRef, {
      id: runRef, scopeKey: 'local-verification-fixture', courseKey: 'destroyer', courseVersion: VESSEL_COURSE_VERSION,
      stepSequence: 1, prediction: '检查点绑定', durationS: 11, createdAtMs: Date.now(), lastTimeS: 0,
      configuration, initialInput: initial.input, parameterHash: initial.parameterHash, runtimeVersion: CONTROL_ENGINE_BUILD_HASH,
      initialCheckpoint: checkpoint, checkpoint, stoppedAtMs: null, trace: [], nativeSensorSamples: [], changes: [],
      stopReason: null, failure: null,
    })) as VesselEvidenceOpening;
    await openVesselEvidenceRun(user.id, opening);
    const nextRef = randomUUID();
    await enqueueCourseVerification(user.id, {
      ...input, attempt: { ...input.attempt!, clientRef: nextRef, runRefs: [runRef] },
    });
    // Change the persisted reference between admission and processing.
    const run = await prisma.simulationRun.findFirstOrThrow({ where: { ownerUserId: user.id, sourceRefId: runRef } });
    await prisma.simulationRun.update({ where: { id: run.id },
      data: { summary: { ...(run.summary as object), lastCheckpointReference: 'different-checkpoint' } } });
    assert(await drainCourseVerification());
    assert.equal((await readCourseVerification(user.id, nextRef)).verification, 'failed');
    assert.equal(await prisma.stepSubmissionAttempt.count({ where: { userId: user.id } }), 5);
  } finally { native.free(); }
  console.log(JSON.stringify({ duplicateRequests: 10, ingestionMs, workerMs, formalStatus: receipt.result?.status,
    changedCheckpointRejected: true }));
} finally {
  await prisma.evidenceOutbox.deleteMany({ where: { ...where, ownerUserId: user.id } });
  await prisma.stepSubmissionAttempt.deleteMany({ where: { userId: user.id } });
  await prisma.simulationRun.deleteMany({ where: { ownerUserId: user.id } });
  await prisma.virtualSimulationReport.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
  await rm(root, { recursive: true, force: true });
}
