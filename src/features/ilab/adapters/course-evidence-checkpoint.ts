import type { SimulationRun } from '@prisma/client';
import { writeSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { CONTROL_ENGINE_BUILD_HASH } from '@/lib/control-engine/identity.generated';
import type { VesselEvidenceClose } from '../course-evidence-contract';
import type { PreparedVesselClose } from '../course-evidence-compute';
import { advanceVesselTraceMetadata, confirmedVesselTraceData, validateVesselTraceMetadata } from '../course-evidence-prefix';
import { confirmVesselEvidenceObject, loadConfirmedVesselChunks } from './course-evidence-objects';
import { vesselRunStorageSummary } from '../course-evidence-service';
import { IlabServiceError } from '../service-error';

/** 保存仅确认传输与恢复进度，正式证据状态由结束核验单独确认。 */
export async function prepareVesselCheckpoint(run: SimulationRun, input: VesselEvidenceClose,
  checkpointHash: string): Promise<PreparedVesselClose> {
  const summary = vesselRunStorageSummary(run);
  const confirmed = await loadConfirmedVesselChunks(run, input.pendingChunks ?? []);
  let projected = summary;
  let firstSampleReceipt: string | undefined;
  const traces = [];
  for (const { metadata, stored } of confirmed) {
    validateVesselTraceMetadata(projected, metadata);
    traces.push(confirmedVesselTraceData(run, projected, metadata, stored));
    projected = advanceVesselTraceMetadata(projected, metadata);
    if (summary.controlCount === 0) firstSampleReceipt ??= metadata.firstSampleReceipt;
  }
  if (input.controlCount !== projected.controlCount || input.nativeCount !== projected.nativeCount
    || (input.fineCount ?? 0) !== (projected.fineCount ?? 0) || input.endTimeS < projected.lastTimeS - 1e-7) {
    throw new IlabServiceError('原始采样尚未完整接收，请继续上传。', 409);
  }
  const preview = input.checkpointPreview;
  if (preview && (preview.parameterHash !== summary.parameterHash || preview.timeS !== input.endTimeS
    || preview.controllerTicks !== input.controlCount || preview.fineCount !== (input.fineCount ?? 0)
    || (preview.runtimeVersion && preview.runtimeVersion !== run.runtimeVersion
      && preview.runtimeVersion !== CONTROL_ENGINE_BUILD_HASH))) {
    throw new IlabServiceError('恢复点摘要与本次运行的版本或采样不一致。', 409);
  }
  let appliedFinalInput = preview?.appliedFinalInput;
  if (!preview) {
    try { appliedFinalInput = JSON.parse(input.checkpoint).input; }
    catch { throw new IlabServiceError('恢复点内容无法解析。', 400); }
    if (!appliedFinalInput || typeof appliedFinalInput !== 'object' || Array.isArray(appliedFinalInput)) {
      throw new IlabServiceError('恢复点缺少当前控制条件。', 400);
    }
  }
  const checkpoint = await writeSimulationTraceChunk({ schema: 'act.vessel-run-close.v1', ...input, appliedFinalInput });
  await confirmVesselEvidenceObject(run, checkpoint, 'checkpoint');
  return { traces, firstSampleReceipt, simulationEndMs: 0, quality: null,
    progress: { chunkCount: projected.chunkCount, controlCount: projected.controlCount,
      nativeCount: projected.nativeCount, lastTimeS: input.endTimeS, nativeWatermarks: projected.nativeWatermarks,
      ...(projected.fineCount !== undefined ? { fineCount: projected.fineCount,
        fineLastTimeS: projected.fineLastTimeS } : {}) },
    summaryUpdates: { checkpointHash, lastCheckpointReference: checkpoint.uri, stopReason: null,
      metrics: null, fineStepMetrics: null, voyage: null, fuelKg: null, cruiseComfort: null,
      browserPreview: preview ?? null,
      evidenceVerification: { status: 'pending', checkpointHash, runtimeVersion: run.runtimeVersion } },
  };
}
