import { createHash } from 'node:crypto';
import type { Prisma, SimulationRun } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { evidenceCpuWorkersEnabled, runEvidenceCpuTask } from '@/lib/control-engine/evidence-cpu-pool';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { readSimulationTraceChunk, writeSimulationTraceChunk, storeEncodedSimulationTrace } from '@/lib/data-governance/simulation-trace-cas';
import { vesselTraceChunkSchema, type VesselEvidenceClose, type VesselTraceChunk } from './course-evidence-contract';
import { findOwnedVesselRun, vesselRunProgress, vesselRunStorageSummary } from './course-evidence-service';
import { prepareVesselEvidenceClose, type PreparedVesselClose } from './course-evidence-compute';
import { IlabServiceError } from './run-lock';
import { storedTraceData, advanceStoredSummary, validateChunkPrefix, type StoredChunk } from './course-evidence-prefix';
export { validateChunkPrefix } from './course-evidence-prefix';

const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

/** 按本人运行读取一个不可变采样分块，避免恢复完整实验时生成数GB的单次响应。 */
export async function readVesselEvidenceChunk(userId: string, runRef: string, chunkIndex: number) {
  const run = await findOwnedVesselRun(userId, runRef);
  const chunk = await prisma.simulationTrace.findUnique({
    where: { runId_chunkIndex: { runId: run.id, chunkIndex } }, select: { sampleStorageUri: true },
  });
  if (!chunk?.sampleStorageUri) throw new IlabServiceError('采样分块不存在。', 404);
  return readSimulationTraceChunk<VesselTraceChunk>(chunk.sampleStorageUri);
}

/** 暂存不会推进数据库采样水位，网络中断后仍可恢复上一个完整检查点。 */
export async function stageVesselEvidenceChunk(userId: string, chunk: VesselTraceChunk) {
  const run = await findOwnedVesselRun(userId, chunk.runRef);
  if (run.status !== 'running') {
    const existing = await prisma.simulationTrace.findUnique({
      where: { runId_chunkIndex: { runId: run.id, chunkIndex: chunk.chunkIndex } },
      select: { checksum: true, sampleStorageUri: true },
    });
    if (existing?.sampleStorageUri && existing.checksum === hash(chunk)) {
      return { reference: existing.sampleStorageUri };
    }
    throw new IlabServiceError('这次运行已经结束。',409);
  }
  const stored = await writeSimulationTraceChunk(chunk);
  return {reference:stored.uri};
}

/** 将原始请求的解析、校验与编码合并在同一次计算任务中。 */
export async function stageVesselEvidenceBytes(userId: string, runRef: string, bytes: Uint8Array) {
  if (!evidenceCpuWorkersEnabled()) {
    let value: unknown;
    try { value = JSON.parse(Buffer.from(bytes).toString('utf8')); }
    catch { throw new IlabServiceError('实验数据内容无法解析。',400); }
    const parsed = vesselTraceChunkSchema.safeParse(value);
    if (!parsed.success || parsed.data.runRef !== runRef) throw new IlabServiceError('原始采样分块内容不完整。',400);
    return stageVesselEvidenceChunk(userId, parsed.data as unknown as VesselTraceChunk);
  }
  const prepared = await runEvidenceCpuTask('trace-stage', bytes);
  if (prepared.runRef !== runRef) throw new IlabServiceError('原始采样分块内容不完整。',400);
  const run = await findOwnedVesselRun(userId, runRef);
  if (run.status !== 'running') {
    const existing = await prisma.simulationTrace.findUnique({
      where: { runId_chunkIndex: { runId: run.id, chunkIndex: prepared.chunkIndex } },
      select: { checksum: true, sampleStorageUri: true },
    });
    if (existing?.sampleStorageUri && existing.checksum === prepared.encoded.checksum) {
      return { reference: existing.sampleStorageUri };
    }
    throw new IlabServiceError('这次运行已经结束。',409);
  }
  const stored = await storeEncodedSimulationTrace(prepared.encoded);
  return { reference: stored.uri };
}

async function appendStoredChunk(tx: Prisma.TransactionClient, run: SimulationRun,
  chunk: VesselTraceChunk, stored: StoredChunk) {
  const latest = vesselRunStorageSummary(run);
  const watermarks = validateChunkPrefix(latest, chunk);
  await tx.simulationTrace.create({ data: storedTraceData(run, latest, chunk, stored) });
  const next = advanceStoredSummary(latest, chunk, watermarks);
  const saved = await tx.simulationRun.update({ where: { id: run.id }, data: { summary: next as unknown as Prisma.InputJsonValue } });
  if (latest.controlCount === 0 && chunk.points.length) {
    await tx.appliedRunEnvelope.update({ where: { runRef: chunk.runRef }, data: {
      firstSampleReceipt: hash(chunk.points[0]), quality: { status: 'recording', source: 'native-session' },
    } });
  }
  return saved;
}

/** 只追加已接收前缀，同一分块的重试以服务端内容哈希核对。 */
export async function appendVesselEvidenceChunk(userId: string, chunk: VesselTraceChunk) {
  const run = await findOwnedVesselRun(userId, chunk.runRef);
  const summary = vesselRunStorageSummary(run);
  const checksum = hash(chunk);
  const existing = await prisma.simulationTrace.findUnique({ where: { runId_chunkIndex: { runId: run.id, chunkIndex: chunk.chunkIndex } } });
  if (existing) {
    if (existing.checksum !== checksum) throw new IlabServiceError('已经接收的采样分块与本次内容不同。',409);
    return vesselRunProgress(run);
  }
  validateChunkPrefix(summary, chunk);
  const stored = await writeSimulationTraceChunk(chunk);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VirtualSimulationReport" WHERE "id" = ${summary.reportId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "SimulationRun" WHERE "id" = ${run.id} FOR UPDATE`;
    const current = await tx.simulationRun.findUniqueOrThrow({ where: { id: run.id } });
    const latest = vesselRunStorageSummary(current);
    const duplicate = await tx.simulationTrace.findUnique({ where: { runId_chunkIndex: { runId: run.id, chunkIndex: chunk.chunkIndex } } });
    if (duplicate) {
      if (duplicate.checksum !== checksum) throw new IlabServiceError('已经接收的采样分块与本次内容不同。',409);
      return vesselRunProgress(current);
    }
    const report = await tx.virtualSimulationReport.findUniqueOrThrow({ where: { id: latest.reportId } });
    if (current.status !== 'running' || !['draft','revision-requested'].includes(report.status)) {
      throw new IlabServiceError('这次运行已经结束或报告已提交，无法追加采样。',409);
    }
    return vesselRunProgress(await appendStoredChunk(tx, current, chunk, stored));
  });
}

/** 同一事务提交原始采样和恢复点，结束时再生成可复核的评价。 */
export async function closeVesselEvidenceRun(userId: string, runRef: string, input: VesselEvidenceClose) {
  const run = await findOwnedVesselRun(userId, runRef);
  const summary = vesselRunStorageSummary(run);
  const closeHash = hash(input);
  const previousClose = (run.summary as { closeHash?: string }).closeHash;
  const previousCheckpoint = (run.summary as { checkpointHash?: string }).checkpointHash;
  if (previousClose) {
    if (previousClose !== closeHash) throw new IlabServiceError('这次运行已经以其他结束状态保存。',409);
    return vesselRunProgress(run);
  }
  if (previousCheckpoint === closeHash) return vesselRunProgress(run);
  const isCheckpoint = input.reason === 'checkpoint';
  const traces = isCheckpoint ? [] : await prisma.simulationTrace.findMany({
    where: { runId: run.id }, orderBy: { chunkIndex: 'asc' }, select: { sampleStorageUri: true },
  });
  const task = { run: { id: run.id, runtimeVersion: run.runtimeVersion, modelVersion: run.modelVersion, seed: run.seed },
    runRef, summary, input, closeHash, traces };
  const prepared = evidenceCpuWorkersEnabled()
    ? await runEvidenceCpuTask('close-prepare', task) as PreparedVesselClose
    : await prepareVesselEvidenceClose(task);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VirtualSimulationReport" WHERE "id" = ${summary.reportId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "SimulationRun" WHERE "id" = ${run.id} FOR UPDATE`;
    const current = await tx.simulationRun.findUniqueOrThrow({ where: { id: run.id } });
    const latest = vesselRunStorageSummary(current);
    const currentClose = (current.summary as { closeHash?: string }).closeHash;
    const currentCheckpoint = (current.summary as { checkpointHash?: string }).checkpointHash;
    if (currentClose) {
      if (currentClose !== closeHash) throw new IlabServiceError('这次运行已经结束。',409);
      return vesselRunProgress(current);
    }
    if (currentCheckpoint === closeHash) return vesselRunProgress(current);
    const report = await tx.virtualSimulationReport.findUniqueOrThrow({ where: { id: summary.reportId } });
    if (!['draft','revision-requested'].includes(report.status) || latest.controlCount !== summary.controlCount
      || latest.nativeCount !== summary.nativeCount || latest.chunkCount !== summary.chunkCount
      || currentCheckpoint !== previousCheckpoint) {
      throw new IlabServiceError('实验进度已经变化，请读取保存状态后重试。',409);
    }
    // 锁内确认采样前缀及恢复点未变后，整批写入并只更新一次累计进度。
    // 不忽略唯一键冲突，任一分块失败均由同一事务回滚。
    if (prepared.traces.length) await tx.simulationTrace.createMany({ data: prepared.traces });
    if (latest.controlCount === 0 && prepared.firstSampleReceipt) {
      await tx.appliedRunEnvelope.update({ where: { runRef }, data: {
        firstSampleReceipt: prepared.firstSampleReceipt, quality: { status: 'recording', source: 'native-session' },
      } });
    }
    const saved = await tx.simulationRun.update({ where: { id: run.id }, data: {
      status: isCheckpoint ? 'running' : input.reason === 'failure' ? 'failed' : 'completed',
      completedAt: isCheckpoint ? null : new Date(),
      summary: { ...latest, ...prepared.progress, ...prepared.summaryUpdates } as unknown as Prisma.InputJsonValue,
    } });
    if (isCheckpoint) return vesselRunProgress(saved);
    await tx.appliedRunEnvelope.update({ where: { runRef }, data: {
      simulationEndMs: BigInt(prepared.simulationEndMs),
      terminationReason: input.reason, quality: prepared.quality as unknown as Prisma.InputJsonValue,
    } });
    return vesselRunProgress(saved);
  }, {timeout:30_000});
}
