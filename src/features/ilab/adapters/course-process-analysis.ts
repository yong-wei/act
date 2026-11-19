import type { Prisma, PrismaClient } from '@prisma/client';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { vesselTraceChunkSchema, type VesselTraceChunk, type VesselTraceChunkMetadata } from '../course-evidence-contract';
import { describeVesselTraceChunk } from '../course-evidence-prefix';

const EVENT_TYPE = 'simulation.course.process-analysis.v1';
const CHUNKS_PER_TICK = 4;
const LEASE_MS = 120_000;
const MAX_FAILURES = 5;

type Analysis = {
  runId: string;
  runRef: string;
  checkpointHash: string;
  chunkCount: number;
  nextChunk: number;
  nativeSamples: number;
  controlChanges: number;
  lastChangeTimeS: number | null;
  failures: number;
};

export async function enqueueVesselProcessAnalysis(tx: Prisma.TransactionClient, input: Pick<Analysis,
  'runId' | 'runRef' | 'checkpointHash' | 'chunkCount'> & { ownerUserId: string; reportId: string }) {
  const { ownerUserId, reportId, ...run } = input;
  const payload: Analysis = { ...run, nextChunk: 0, nativeSamples: 0, controlChanges: 0, lastChangeTimeS: null, failures: 0 };
  await tx.evidenceOutbox.createMany({ skipDuplicates: true, data: {
    eventType: EVENT_TYPE, ownerUserId, correlationId: reportId, causationId: run.runId,
    dedupeKey: `${EVENT_TYPE}:${run.runId}:${run.checkpointHash}`, payload,
  } });
}

/** 一次只处理一项的少量不可变分块。此结果仅用于平台过程分析。 */
export async function drainVesselProcessAnalysis(db: PrismaClient, ownerUserId?: string) {
  const now = new Date();
  const job = await db.evidenceOutbox.findFirst({ where: {
    eventType: EVENT_TYPE, status: { in: ['pending', 'processing'] }, availableAt: { lte: now }, ownerUserId,
  }, orderBy: { availableAt: 'asc' } });
  if (!job) return false;
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  const leased = await db.evidenceOutbox.updateMany({
    where: { id: job.id, status: job.status, availableAt: job.availableAt },
    data: { status: 'processing', availableAt: leaseUntil },
  });
  if (!leased.count) return false;
  const payload = job.payload as unknown as Analysis;
  const lease = { id: job.id, status: 'processing', availableAt: leaseUntil };
  try {
    const run = await db.simulationRun.findFirst({ where: {
      id: payload.runId, sourceRefId: payload.runRef, ownerUserId: job.ownerUserId,
      AND: [{ summary: { path: ['checkpointHash'], equals: payload.checkpointHash } },
        { summary: { path: ['reportId'], equals: job.correlationId } }],
    }, select: { id: true } });
    if (!run) {
      await db.evidenceOutbox.updateMany({ where: lease, data: { status: 'cancelled', processedAt: new Date() } });
      return true;
    }
    const end = Math.min(payload.nextChunk + CHUNKS_PER_TICK, payload.chunkCount);
    const traces = await db.simulationTrace.findMany({ where: {
      runId: run.id, chunkIndex: { gte: payload.nextChunk, lt: end },
    }, orderBy: { chunkIndex: 'asc' }, select: { chunkIndex: true, sampleStorageUri: true, summaryMetrics: true } });
    if (traces.length !== end - payload.nextChunk) throw new Error('Process analysis chunk index incomplete');
    const next = { ...payload, nextChunk: end, failures: 0 };
    for (const [index, trace] of traces.entries()) {
      if (!trace.sampleStorageUri || trace.chunkIndex !== payload.nextChunk + index) throw new Error('Process analysis chunk missing');
      const chunk = vesselTraceChunkSchema.parse(await readSimulationTraceChunk(trace.sampleStorageUri)) as unknown as VesselTraceChunk;
      if (chunk.runRef !== payload.runRef || chunk.chunkIndex !== trace.chunkIndex) throw new Error('Process analysis chunk mismatch');
      const archive = (trace.summaryMetrics as { nativeArchive?: VesselTraceChunkMetadata }).nativeArchive;
      if (archive && canonicalJson(describeVesselTraceChunk(chunk)) !== canonicalJson(archive)) {
        throw new Error('Process analysis archive metadata mismatch');
      }
      next.nativeSamples += chunk.nativeSamples.length;
      next.controlChanges += chunk.changes.length;
      next.lastChangeTimeS = chunk.changes.at(-1)?.timeS ?? next.lastChangeTimeS;
    }
    const done = end === payload.chunkCount;
    await db.evidenceOutbox.updateMany({ where: lease, data: { payload: next,
      status: done ? 'applied' : 'pending', processedAt: done ? new Date() : null, availableAt: new Date() } });
  } catch (error) {
    const failures = payload.failures + 1;
    await db.evidenceOutbox.updateMany({ where: lease, data: { payload: { ...payload, failures },
      status: failures >= MAX_FAILURES ? 'failed' : 'pending', availableAt: new Date(Date.now() + failures * 60_000) } });
    throw error;
  }
  return true;
}
