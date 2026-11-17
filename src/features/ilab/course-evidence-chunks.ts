import { createHash } from 'node:crypto';
import type { Prisma, SimulationRun } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { evidenceCpuWorkersEnabled, runEvidenceCpuTask } from '@/lib/control-engine/evidence-cpu-pool';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { readSimulationTraceChunk, writeSimulationTraceChunk, storeEncodedSimulationTrace } from '@/lib/data-governance/simulation-trace-cas';
import { vesselTraceChunkSchema, vesselEvidenceCloseSchema, type VesselEvidenceClose, type VesselEvidenceSave, type VesselTraceChunk,
  type VesselTraceChunkMetadata } from './course-evidence-contract';
import { findOwnedVesselRun, vesselRunProgress, vesselRunStorageSummary } from './course-evidence-service';
import { prepareVesselEvidenceClose, type PreparedVesselClose } from './course-evidence-compute';
import { IlabServiceError } from './run-lock';
import { storedTraceData, advanceStoredSummary, validateChunkPrefix, describeVesselTraceChunk,
  type StoredChunk } from './course-evidence-prefix';
import { confirmVesselEvidenceObject } from './adapters/course-evidence-objects';
import { prepareVesselCheckpoint } from './adapters/course-evidence-checkpoint';
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
  const metadata = describeVesselTraceChunk(chunk);
  const stored = await writeSimulationTraceChunk(chunk);
  await confirmVesselEvidenceObject(run, stored, 'chunk', metadata);
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
  await confirmVesselEvidenceObject(run, stored, 'chunk', prepared.metadata as VesselTraceChunkMetadata);
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

/** 先原子保存恢复进度，完整核验只在运行结束时执行。 */
export async function closeVesselEvidenceRun(userId: string, runRef: string, input: VesselEvidenceClose) {
  return saveVesselEvidenceRun(userId, runRef, input, hash(input));
}

export async function closeDirectVesselEvidenceRun(userId: string, runRef: string,
  input: VesselEvidenceSave, checkpoint: StoredChunk) {
  return saveVesselEvidenceRun(userId, runRef, input, checkpoint.checksum, checkpoint);
}

async function readDirectVesselClose(reference: string): Promise<VesselEvidenceClose> {
  const saved = await readSimulationTraceChunk<Record<string, unknown>>(reference);
  const parsed = vesselEvidenceCloseSchema.safeParse(saved);
  if (saved.schema !== 'act.vessel-run-close.v1' || !parsed.success || !parsed.data.checkpointPreview
    || canonicalJson(saved.appliedFinalInput) !== canonicalJson(parsed.data.checkpointPreview.appliedFinalInput)) {
    throw new IlabServiceError('已上传恢复点的正文与控制摘要不一致。', 409);
  }
  return parsed.data;
}

async function saveVesselEvidenceRun(userId: string, runRef: string, input: VesselEvidenceSave,
  closeHash: string, checkpoint?: StoredChunk) {
  let run = await findOwnedVesselRun(userId, runRef);
  const previous = run.summary as { closeHash?: string; checkpointHash?: string };
  if (previous.closeHash) {
    if (previous.closeHash !== closeHash) throw new IlabServiceError('这次运行已经以其他结束状态保存。', 409);
    return vesselRunProgress(run);
  }
  const isCheckpoint = input.reason === 'checkpoint';
  if (previous.checkpointHash === closeHash && isCheckpoint) return vesselRunProgress(run);
  if (previous.checkpointHash !== closeHash && input.baseCheckpointReference
    && vesselRunStorageSummary(run).lastCheckpointReference !== input.baseCheckpointReference) {
    throw new IlabServiceError('这次运行已在另一页面保存，请读取最新恢复点后继续。', 409);
  }
  if (previous.checkpointHash !== closeHash) {
    const prepared = await prepareVesselCheckpoint(run, input, closeHash, checkpoint);
    run = await commitVesselEvidenceProgress(run, runRef, input, closeHash, prepared, 'save');
  }
  if (isCheckpoint) return vesselRunProgress(run);
  try {
    const fullInput = checkpoint ? await readDirectVesselClose(checkpoint.uri) : input as VesselEvidenceClose;
    if (checkpoint) {
      const { checkpoint: _snapshot, ...metadata } = fullInput;
      if (canonicalJson(metadata) !== canonicalJson(input)) {
        throw new IlabServiceError('已上传恢复点与提交的保存描述不一致。', 409);
      }
    }
    const currentSummary = vesselRunStorageSummary(run);
    const traces = await prisma.simulationTrace.findMany({
      where: { runId: run.id }, orderBy: { chunkIndex: 'asc' }, select: { sampleStorageUri: true },
    });
    const task = { run: { id: run.id, runtimeVersion: run.runtimeVersion, modelVersion: run.modelVersion, seed: run.seed },
      runRef, summary: currentSummary, input: { ...fullInput, pendingChunks: [] }, closeHash, traces, checkpoint };
    const prepared = evidenceCpuWorkersEnabled()
      ? await runEvidenceCpuTask('close-prepare', task) as PreparedVesselClose
      : await prepareVesselEvidenceClose(task);
    if (prepared.checkpoint) await confirmVesselEvidenceObject(run, prepared.checkpoint, 'checkpoint');
    return vesselRunProgress(await commitVesselEvidenceProgress(run, runRef, input, closeHash, prepared, 'complete'));
  } catch (error) {
    // 原始对象与恢复点已经保存，核验失败只更新核验状态。
    const saved = await commitVesselEvidenceProgress(run, runRef, input, closeHash,
      failedVerificationPatch(run, closeHash), 'state');
    if (saved.completedAt) return vesselRunProgress(saved);
    throw Object.assign(error instanceof Error ? error : new Error('实验记录已保存，证据核验暂未完成。'),
      { savedProgress: vesselRunProgress(saved) });
  }
}

async function commitVesselEvidenceProgress(run: SimulationRun, runRef: string, input: VesselEvidenceSave,
  closeHash: string, prepared: PreparedVesselClose, phase: 'save' | 'complete' | 'state') {
  const summary = vesselRunStorageSummary(run);
  const previousCheckpoint = (run.summary as { checkpointHash?: string }).checkpointHash;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VirtualSimulationReport" WHERE "id" = ${summary.reportId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "SimulationRun" WHERE "id" = ${run.id} FOR UPDATE`;
    const current = await tx.simulationRun.findUniqueOrThrow({ where: { id: run.id } });
    const latest = vesselRunStorageSummary(current);
    const currentClose = (current.summary as { closeHash?: string }).closeHash;
    const currentCheckpoint = (current.summary as { checkpointHash?: string }).checkpointHash;
    if (currentClose) {
      if (currentClose !== closeHash) throw new IlabServiceError('这次运行已经结束。', 409);
      return current;
    }
    if (phase === 'save' && currentCheckpoint === closeHash) return current;
    if (phase === 'state' && currentCheckpoint === closeHash && hasVerifiedVesselEvidence(current)) return current;
    const report = await tx.virtualSimulationReport.findUniqueOrThrow({ where: { id: summary.reportId } });
    if (current.ownerUserId !== run.ownerUserId || current.status !== 'running'
      || !['draft', 'revision-requested'].includes(report.status) || latest.controlCount !== summary.controlCount
      || latest.nativeCount !== summary.nativeCount || latest.chunkCount !== summary.chunkCount
      || currentCheckpoint !== previousCheckpoint) {
      throw new IlabServiceError('实验进度已经变化，请读取保存状态后重试。', 409);
    }
    if (prepared.traces.length) await tx.simulationTrace.createMany({ data: prepared.traces });
    if (latest.controlCount === 0 && prepared.firstSampleReceipt) {
      await tx.appliedRunEnvelope.update({ where: { runRef }, data: {
        firstSampleReceipt: prepared.firstSampleReceipt, quality: { status: 'recording', source: 'native-session' },
      } });
    }
    const saved = await tx.simulationRun.update({ where: { id: run.id }, data: {
      status: phase === 'complete' ? input.reason === 'failure' ? 'failed' : 'completed' : 'running',
      completedAt: phase === 'complete' ? new Date() : null,
      summary: { ...latest, ...prepared.progress, ...prepared.summaryUpdates } as unknown as Prisma.InputJsonValue,
    } });
    if (phase === 'complete') await tx.appliedRunEnvelope.update({ where: { runRef }, data: {
      simulationEndMs: BigInt(prepared.simulationEndMs),
      terminationReason: input.reason, quality: prepared.quality as unknown as Prisma.InputJsonValue,
    } });
    return saved;
  }, { timeout: 30_000 });
}

function failedVerificationPatch(run: SimulationRun, checkpointHash: string): PreparedVesselClose {
  const summary = vesselRunStorageSummary(run);
  return { traces: [], progress: { chunkCount: summary.chunkCount, controlCount: summary.controlCount,
    nativeCount: summary.nativeCount, lastTimeS: summary.lastTimeS, nativeWatermarks: summary.nativeWatermarks },
    summaryUpdates: { evidenceVerification: { status: 'failed', checkpointHash, runtimeVersion: run.runtimeVersion } },
    simulationEndMs: 0, quality: null };
}

export function hasVerifiedVesselEvidence(run: SimulationRun) {
  const summary = vesselRunStorageSummary(run);
  const checkpointHash = (run.summary as { checkpointHash?: string }).checkpointHash;
  if (summary.evidenceVerification) return summary.evidenceVerification.status === 'verified'
    && summary.evidenceVerification.checkpointHash === checkpointHash
    && summary.evidenceVerification.runtimeVersion === run.runtimeVersion
    && Boolean(summary.evidenceVerification.evidenceHash);
  // 历史版本每次检查点已经执行完整服务端状态核验。
  return Boolean(run.completedAt || (checkpointHash && (run.summary as { metricsRuntimeVersion?: string }).metricsRuntimeVersion));
}

/** 步骤提交也可核验尚未结束的已保存前缀，保留其继续运行能力。 */
export async function verifyVesselEvidenceRun(userId: string, runRef: string) {
  const run = await findOwnedVesselRun(userId, runRef);
  if (hasVerifiedVesselEvidence(run)) return vesselRunProgress(run);
  const summary = vesselRunStorageSummary(run);
  const checkpointHash = (run.summary as { checkpointHash?: string }).checkpointHash;
  if (!checkpointHash) throw new IlabServiceError('请先保存这次运行的恢复点。', 409);
  const direct = summary.lastCheckpointReference.startsWith('simulation-cas:oss:');
  const saved = direct ? await readDirectVesselClose(summary.lastCheckpointReference)
    : await readSimulationTraceChunk(summary.lastCheckpointReference);
  const input = { ...saved as VesselEvidenceClose, reason: 'checkpoint' as const, pendingChunks: [] };
  // 同步核验期间保持待核验状态，进程中断后可直接从保存点重试。
  try {
    const traces = await prisma.simulationTrace.findMany({ where: { runId: run.id },
      orderBy: { chunkIndex: 'asc' }, select: { sampleStorageUri: true } });
    const task = { run: { id: run.id, runtimeVersion: run.runtimeVersion, modelVersion: run.modelVersion, seed: run.seed },
      runRef, summary: vesselRunStorageSummary(run), input, closeHash: checkpointHash, traces, verifyCheckpoint: true,
      ...(direct ? { checkpoint: { uri: summary.lastCheckpointReference,
        checksum: summary.lastCheckpointReference.slice(summary.lastCheckpointReference.lastIndexOf(':') + 1) } } : {}) };
    const prepared = evidenceCpuWorkersEnabled()
      ? await runEvidenceCpuTask('close-prepare', task) as PreparedVesselClose
      : await prepareVesselEvidenceClose(task);
    if (prepared.checkpoint) await confirmVesselEvidenceObject(run, prepared.checkpoint, 'checkpoint');
    return vesselRunProgress(await commitVesselEvidenceProgress(run, runRef, input, checkpointHash, prepared, 'state'));
  } catch (error) {
    const current = await commitVesselEvidenceProgress(run, runRef, input, checkpointHash,
      failedVerificationPatch(run, checkpointHash), 'state');
    if (hasVerifiedVesselEvidence(current)) return vesselRunProgress(current);
    throw error;
  }
}
