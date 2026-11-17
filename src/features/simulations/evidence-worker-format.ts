import { canonicalJson } from '@/lib/student-model-artifact-contract';
import { simulationOssReference } from '@/features/simulations/public-api';
import { vesselTraceMetadata, type VesselRunEvidence, type VesselTraceChunkData } from './run-evidence';
import type { VesselEvidenceProgress } from './run-evidence';
import type { VesselEvidenceOssObject, VesselEvidenceClose } from '@/features/ilab/public-api';
import type { vesselEvidenceOpeningInput } from './evidence-opening';

const MAX_BYTES = 4 * 1024 * 1024;
export type PreparedVesselOssObject = { descriptor: VesselEvidenceOssObject; body: Blob };
export type PreparedVesselOssSave = {
  objects: PreparedVesselOssObject[];
  close: Omit<VesselEvidenceClose, 'checkpoint'> & { baseCheckpointReference: string };
  checkpointReference: string;
};

async function checksum(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function encode(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  if (bytes.byteLength > MAX_BYTES) throw new Error('单份实验记录过大，请保留本机记录后重试。');
  const hash = await checksum(bytes);
  const body = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  if (body.size > MAX_BYTES) throw new Error('单份实验记录过大，请保留本机记录后重试。');
  return { checksum: hash, body, uncompressedBytes: bytes.byteLength, storedBytes: body.size };
}

/** run中的采样数组只包含服务端前缀之后的记录，避免反复复制完整历史。 */
export async function prepareVesselOssSave(run: VesselRunEvidence, progress: VesselEvidenceProgress,
  opening?: ReturnType<typeof vesselEvidenceOpeningInput>): Promise<PreparedVesselOssSave> {
  if (!run.checkpointPreview) throw new Error('这次实验的恢复检查尚未完成，请再次保存。');
  if (!progress.checkpointReference) throw new Error('这次运行的恢复点回执缺失，请重新读取进度。');
  const preview = { ...run.checkpointPreview, appliedFinalInput: { ...run.checkpointPreview.appliedFinalInput },
    metrics: { ...run.checkpointPreview.metrics },
    parameters: run.checkpointPreview.parameters ? { ...run.checkpointPreview.parameters } : undefined,
    fineStepMetrics: run.checkpointPreview.fineStepMetrics ? { ...run.checkpointPreview.fineStepMetrics } : undefined,
    cruiseComfort: run.checkpointPreview.cruiseComfort ? { ...run.checkpointPreview.cruiseComfort } : undefined,
    voyage: run.checkpointPreview.voyage ? { ...run.checkpointPreview.voyage } : undefined };
  const objects: PreparedVesselOssObject[] = [];
  let openingReference = progress.openingReference?.startsWith('simulation-cas:oss:') ? progress.openingReference : undefined;
  if (opening) {
    if (!progress.openingHash) throw new Error('这次运行的初态回执缺失，请重新读取进度。');
    const encoded = await encode({ schema: 'act.vessel-run-opening.v1', ...opening });
    openingReference = simulationOssReference(run.id, 'opening', 0, encoded.checksum, encoded.storedBytes);
    objects.push({ body: encoded.body, descriptor: { purpose: 'opening', reference: openingReference,
      uncompressedBytes: encoded.uncompressedBytes, storedBytes: encoded.storedBytes, openingHash: progress.openingHash } });
  }
  const fineSamples = run.fineStepSamples ?? [];
  let current = { ...progress };
  let controlOffset = 0;
  let nativeOffset = 0;
  let fineOffset = 0;
  while (controlOffset < run.trace.length || nativeOffset < run.nativeSensorSamples.length || fineOffset < fineSamples.length) {
    const endTimeS = Math.min((Math.floor((current.lastTimeS + 1e-7) / 5) + 1) * 5, run.lastTimeS);
    const finalChunk = endTimeS >= run.lastTimeS - 1e-7;
    let controlEnd = controlOffset;
    while (controlEnd < run.trace.length && (run.trace[controlEnd].timeS < endTimeS - 1e-7 || finalChunk)) controlEnd++;
    let nativeEnd = nativeOffset;
    while (nativeEnd < run.nativeSensorSamples.length && run.nativeSensorSamples[nativeEnd].measurement.t_arrive_s <= endTimeS + 1e-7) nativeEnd++;
    let fineEnd = fineOffset;
    while (fineEnd < fineSamples.length && fineSamples[fineEnd].timeS <= endTimeS + 1e-7) fineEnd++;
    if (controlEnd === controlOffset && nativeEnd === nativeOffset && fineEnd === fineOffset) break;
    const chunk: VesselTraceChunkData = {
      schema: 'act.vessel-trace-chunk.v1', runRef: run.id, chunkIndex: current.chunkCount,
      parameterHash: run.parameterHash, controlStart: current.controlCount, nativeStart: current.nativeCount,
      endTimeS, points: run.trace.slice(controlOffset, controlEnd).map(point => ({ ...point,
        measurements: Object.fromEntries(Object.entries(point.measurements).map(([key, reading]) =>
          [key, reading.quality === 'Undefined' ? { ...reading, value: null } : reading])) })),
      nativeSamples: run.nativeSensorSamples.slice(nativeOffset, nativeEnd).map(sample =>
        sample.measurement.quality === 'Undefined' ? { ...sample, measurement: { ...sample.measurement, value: null } } : sample),
      ...(run.fineStepSamples ? { fineStart: current.fineCount ?? 0, fineSamples: fineSamples.slice(fineOffset, fineEnd) } : {}),
      changes: run.changes.filter(change => change.timeS >= current.lastTimeS - 1e-7
        && (change.timeS < endTimeS - 1e-7 || finalChunk)),
    };
    const encoded = await encode(chunk);
    const firstReceipt = chunk.points.length
      ? await checksum(new TextEncoder().encode(canonicalJson(chunk.points[0]))) : undefined;
    const reference = simulationOssReference(run.id, 'chunk', current.chunkCount, encoded.checksum, encoded.storedBytes);
    objects.push({ body: encoded.body, descriptor: { purpose: 'chunk', reference,
      uncompressedBytes: encoded.uncompressedBytes, storedBytes: encoded.storedBytes,
      chunk: vesselTraceMetadata(chunk, firstReceipt) } });
    current = { ...current, chunkCount: current.chunkCount + 1,
      controlCount: current.controlCount + controlEnd - controlOffset,
      nativeCount: current.nativeCount + nativeEnd - nativeOffset,
      fineCount: (current.fineCount ?? 0) + fineEnd - fineOffset, lastTimeS: endTimeS };
    controlOffset = controlEnd;
    nativeOffset = nativeEnd;
    fineOffset = fineEnd;
  }
  if (controlOffset !== run.trace.length || nativeOffset !== run.nativeSensorSamples.length || fineOffset !== fineSamples.length) {
    throw new Error('本机采样尚未形成连续记录，请保留当前实验后重试。');
  }
  const close: PreparedVesselOssSave['close'] = {
    endTimeS: run.lastTimeS, controlCount: current.controlCount, nativeCount: current.nativeCount,
    reason: run.stoppedAtMs === null ? 'checkpoint' : run.stopReason!, failure: run.failure, durationS: run.durationS,
    pendingChunks: objects.filter(object => object.descriptor.purpose === 'chunk').map(object => object.descriptor.reference),
    checkpointPreview: preview, ...(openingReference ? { openingReference } : {}),
    baseCheckpointReference: progress.checkpointReference,
    ...(run.fineStepSamples ? { fineCount: current.fineCount } : {}),
  };
  const encoded = await encode({ schema: 'act.vessel-run-close.v1', ...close,
    checkpoint: run.checkpoint, appliedFinalInput: preview.appliedFinalInput });
  const checkpointReference = simulationOssReference(run.id, 'checkpoint', current.controlCount, encoded.checksum, encoded.storedBytes);
  objects.push({ body: encoded.body, descriptor: { purpose: 'checkpoint', reference: checkpointReference,
    uncompressedBytes: encoded.uncompressedBytes, storedBytes: encoded.storedBytes,
    close: { ...close, checkpointPreview: preview } } });
  return { objects, close, checkpointReference };
}

async function readBounded(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_BYTES) throw new Error('实验记录大小超过允许范围。');
      parts.push(part.value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}

export async function decodeVesselOssObject(reference: string, body: Blob) {
  if (body.size > MAX_BYTES) throw new Error('实验记录大小超过允许范围。');
  const bytes = await readBounded(body.stream().pipeThrough(new DecompressionStream('gzip')));
  if (await checksum(bytes) !== reference.slice(reference.lastIndexOf(':') + 1)) {
    throw new Error('实验记录内容校验失败，请重新读取进度。');
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export async function downloadVesselOssObject(input: { url: string; reference: string; storedBytes?: number | null }) {
  const response = await fetch(input.url, { credentials: 'omit' });
  if (!response.ok || !response.body) {
    throw Object.assign(new Error('实验记录暂时无法下载，请重新读取保存进度。'), { status: response.status });
  }
  const compressed = await readBounded(response.body);
  if (input.storedBytes !== undefined && input.storedBytes !== null && compressed.byteLength !== input.storedBytes) {
    throw new Error('下载的实验记录长度不一致，请重新读取进度。');
  }
  return decodeVesselOssObject(input.reference, new Blob([compressed]));
}
