import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSimulationAdmissionScale } from '@/lib/simulation-admission-pressure';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { vesselCourseArtifactSchema, type VesselCourseArtifactInput } from '../course-artifact-contract';
import { saveVesselCourseArtifact, vesselExperimentKey } from '../course-artifact-service';
import { VESSEL_EVIDENCE_DOMAIN, vesselRunStorageSummary } from '../course-evidence-service';
import { IlabServiceError } from '../service-error';
import type { VesselLocalStepAttempt } from '@/features/simulations/public-api';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

const EVENT = 'simulation.course.verify-attempt.v1';
const LEASE_MS = 300_000;
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const dedupeKey = (userId: string, ref: string) => `${EVENT}:${userId}:${ref}`;

type Work = {
  input: VesselCourseArtifactInput;
  digest: string;
  pinned: Record<string, string>;
  retries: number;
  result?: { id: string; status: string; validationFeedback: string | null };
  error?: string;
};
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function view(job: { status: string; payload: Prisma.JsonValue }, ref: string) {
  const work = job.payload as unknown as Work;
  return { verification: job.status, attemptRef: ref,
    ...(job.status === 'applied' ? { result: work.result } : {}),
    ...(job.status === 'failed' ? { error: work.error } : {}) };
}

export async function readCourseVerification(userId: string, ref: string) {
  const job = await prisma.evidenceOutbox.findUnique({ where: { dedupeKey: dedupeKey(userId, ref) } });
  if (job?.ownerUserId !== userId || job.eventType !== EVENT) throw new IlabServiceError('未找到本次提交回执。', 404);
  return view(job, ref);
}

export async function listQueuedCourseAttempts(userId: string, reportRef: string,
  courseKey: VesselCourseArtifactInput['courseKey']): Promise<VesselLocalStepAttempt[]> {
  if (process.env.SIMULATION_VERIFICATION_QUEUE !== '1') return [];
  const jobs = await prisma.evidenceOutbox.findMany({ where: { ownerUserId: userId, correlationId: reportRef,
    eventType: EVENT, status: { in: ['processing', 'pending', 'applied', 'failed'] } }, take: 40, orderBy: { createdAt: 'desc' },
    select: { payload: true, createdAt: true, status: true } });
  return jobs.flatMap(job => {
    const work = job.payload as unknown as Work;
    const attempt = work.input.attempt;
    if (!attempt || work.input.courseKey !== courseKey || work.input.courseVersion !== VESSEL_COURSE_VERSION) return [];
    const pending = job.status === 'processing' || job.status === 'pending';
    const result = job.status === 'applied' ? work.result : undefined;
    const status = result?.status;
    return [{ id: attempt.clientRef, scopeKey: '', stepSequence: attempt.stepSequence,
      runIds: attempt.runRefs, studentModelIds: attempt.modelClientRefs, comparisonIds: attempt.comparisonClientRefs,
      answers: attempt.answers, createdAtMs: job.createdAt.getTime(),
      status: pending || status === 'submitted' ? 'pending-review' as const :
        status === 'below_target' || status === 'model_mismatch' ? status : 'invalid_run' as const,
      serverId: result?.id ?? null, verificationPending: pending, verificationReceipt: true,
      validationFeedback: result?.validationFeedback ?? (job.status === 'failed' ? work.error : null) }];
  });
}

export async function enqueueCourseVerification(userId: string, input: VesselCourseArtifactInput): Promise<ReturnType<typeof view>> {
  const attempt = input.attempt;
  if (!attempt) throw new IlabServiceError('步骤提交内容不完整。', 400);
  const ref = attempt.clientRef;
  const key = dedupeKey(userId, ref);
  const digest = hash(input);
  const prior = await prisma.evidenceOutbox.findUnique({ where: { dedupeKey: key } });
  if (prior) {
    if ((prior.payload as unknown as Work).digest !== digest) throw new IlabServiceError('本次提交已收件，请保留原记录。', 409);
    return view(prior, ref);
  }
  if (input.courseVersion !== VESSEL_COURSE_VERSION) throw new IlabServiceError('实验课程版本不匹配。', 409);
  const report = await prisma.virtualSimulationReport.findUnique({ where: { clientRef: input.reportClientRef },
    select: { id: true, userId: true, clientRef: true, experimentKey: true, experimentVersion: true } });
  if (report && report.userId !== userId) throw new IlabServiceError('实验报告不存在。', 404);
  if (report && (report.experimentKey !== input.courseKey || report.experimentVersion !== input.courseVersion)) {
    throw new IlabServiceError('报告已绑定其他实验版本。', 409);
  }
  if (!report && attempt.runRefs.length) throw new IlabServiceError('请先保存本轮运行证据。', 409);
  const refs = [...new Set(attempt.runRefs)];
  const runs = await prisma.simulationRun.findMany({ where: { ownerUserId: userId,
    sourceDomain: VESSEL_EVIDENCE_DOMAIN, sourceRefId: { in: refs } } });
  if (runs.length !== refs.length || runs.some(run => !report || vesselRunStorageSummary(run).experimentKey !== vesselExperimentKey(report))) {
    throw new IlabServiceError('所选运行证据不属于本轮实验。', 404);
  }
  const pinned = Object.fromEntries(runs.map(run => [run.sourceRefId, vesselRunStorageSummary(run).lastCheckpointReference]));
  const payload = json({ input, pinned, digest, retries: 0 });
  const stored = await prisma.evidenceOutbox.createMany({ data: {
    eventType: EVENT, dedupeKey: key, ownerUserId: userId, correlationId: input.reportClientRef, causationId: ref, payload,
  }, skipDuplicates: true });
  if (stored.count) return { verification: 'pending', attemptRef: ref };
  const job = await prisma.evidenceOutbox.findUniqueOrThrow({ where: { dedupeKey: key } });
  if ((job.payload as unknown as Work).digest !== digest) throw new IlabServiceError('本次提交已收件，请保留原记录。', 409);
  return view(job, ref);
}

/** 共享事务锁串行分配处理名额，任务回执保存在数据库。 */
export async function drainCourseVerification() {
  if (await getSimulationAdmissionScale() === 0) return false;
  const job = await prisma.$transaction(async tx => {
    const now = new Date();
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(760061, 53) AS acquired`;
    if (!lock?.acquired || await tx.evidenceOutbox.count({ where: { eventType: EVENT, status: 'processing', availableAt: { gt: now } } })) return;
    const next = await tx.evidenceOutbox.findFirst({ where: {
      eventType: EVENT, status: { in: ['pending', 'processing'] }, availableAt: { lte: now },
    }, orderBy: [{ availableAt: 'asc' }, { id: 'asc' }] });
    if (!next) return;
    return tx.evidenceOutbox.update({ where: { id: next.id }, data: { status: 'processing',
      availableAt: new Date(now.getTime() + LEASE_MS) } });
  });
  if (!job) return false;
  const payload = job.payload as unknown as Work;
  let lease = job.availableAt;
  let heartbeat: Promise<unknown> | undefined;
  const timer = setInterval(() => {
    if (heartbeat) return;
    const next = new Date(Date.now() + LEASE_MS);
    heartbeat = prisma.evidenceOutbox.updateMany({ where: { id: job.id, status: 'processing', availableAt: lease },
      data: { availableAt: next } }).then(receipt => { if (receipt.count) lease = next; }).catch(() => undefined)
      .finally(() => { heartbeat = undefined; });
  }, 30_000);
  const settle = async (data: Prisma.EvidenceOutboxUpdateManyMutationInput) => {
    clearInterval(timer);
    await heartbeat;
    await prisma.evidenceOutbox.updateMany({ where: { id: job.id, status: 'processing', availableAt: lease }, data });
  };
  try {
    const input = vesselCourseArtifactSchema.parse(payload.input);
    const result = await saveVesselCourseArtifact(job.ownerUserId, input, payload.pinned);
    // The formal attempt owns the original answers after verification.
    const receiptInput = input.attempt ? { ...input, attempt: { ...input.attempt, answers: {} } } : input;
    await settle({ status: 'applied', processedAt: new Date(), payload: json({ ...payload, input: receiptInput, result }) });
  } catch (error) {
    const retries = payload.retries + 1;
    const permanent = (error instanceof IlabServiceError && error.status < 500) || retries >= 5;
    await settle({ status: permanent ? 'failed' : 'pending', availableAt: new Date(Date.now() + retries * 5000),
      payload: json({ ...payload, retries, error: error instanceof IlabServiceError ? error.message : '核验暂未完成，请保留本机记录。' }) });
  }
  return true;
}
