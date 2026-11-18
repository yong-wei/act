// Mirrors the browser's object descriptors using the frozen trajectory bytes.
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { canonicalJson } from '../../src/lib/student-model-artifact-contract/index.ts';
import { vesselTraceMetadata } from '../../src/features/simulations/run-evidence.ts';
import { simulationOssLocation, simulationOssReference, VESSEL_TRACE_COLUMNS } from '../../src/features/simulations/evidence-reference.ts';
import { decodeVesselTraceColumns, encodeVesselTraceColumns } from '../../src/features/simulations/evidence-chunk-columns.ts';

const hash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
function encode(runRef, purpose, sequence, value, metadata, traceEncoding) {
  const packed = traceEncoding === VESSEL_TRACE_COLUMNS ? encodeVesselTraceColumns(value) : undefined;
  const bytes = packed ?? Buffer.from(canonicalJson(value));
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const body = gzipSync(bytes);
  return { body, descriptor: { purpose, reference: simulationOssReference(runRef, purpose, sequence, checksum, body.length,
    packed ? VESSEL_TRACE_COLUMNS : undefined),
    uncompressedBytes: bytes.length, storedBytes: body.length, ...metadata } };
}

export function prepareDirectLoadPacket(opening, progress, sourceChunks, closing, preview) {
  const objects = [];
  let openingReference = progress.openingReference?.startsWith('simulation-cas:oss:') ? progress.openingReference : undefined;
  if (!openingReference) {
    const object = encode(opening.runRef, 'opening', 0, { schema: 'act.vessel-run-opening.v1', ...opening },
      { openingHash: progress.openingHash });
    objects.push(object);openingReference = object.descriptor.reference;
  }
  for (const source of sourceChunks) {
    if (source.chunkIndex < progress.chunkCount) continue;
    const chunk = { ...source, runRef: opening.runRef };
    objects.push(encode(opening.runRef, 'chunk', chunk.chunkIndex, chunk,
      { chunk: vesselTraceMetadata(chunk, chunk.points.length ? hash(chunk.points[0]) : undefined) }, progress.traceEncoding));
  }
  const { checkpoint, ...sourceClose } = closing;
  const close = { ...sourceClose, checkpointPreview: preview, openingReference,
    baseCheckpointReference: progress.checkpointReference,
    pendingChunks: objects.filter(object => object.descriptor.purpose === 'chunk').map(object => object.descriptor.reference) };
  const object = encode(opening.runRef, 'checkpoint', close.controlCount,
    { schema: 'act.vessel-run-close.v1', ...close, checkpoint, appliedFinalInput: preview.appliedFinalInput }, { close });
  objects.push(object);
  return { objects, close, checkpointReference: object.descriptor.reference };
}

export function decodeDirectLoadObject(reference, compressed, decode) {
  const location = simulationOssLocation(reference);
  if (location.storedBytes !== undefined && compressed.byteLength !== location.storedBytes) throw Error('Downloaded evidence size mismatch');
  const bytes = decode(compressed);
  if (createHash('sha256').update(bytes).digest('hex') !== location.checksum) throw Error('Downloaded evidence hash mismatch');
  return location.traceEncoding ? decodeVesselTraceColumns(bytes) : JSON.parse(bytes);
}
