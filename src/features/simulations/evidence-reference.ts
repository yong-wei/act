const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const MAX_VESSEL_EVIDENCE_BYTES = 4 * 1024 * 1024;
export const VESSEL_TRACE_COLUMNS = 'columns-v1';
const columnsGzip = `gzip-${VESSEL_TRACE_COLUMNS}`;
export const simulationTraceReferencePattern = new RegExp(
  `^simulation-cas:(?:(?:file|s3):sha256:|oss:(${uuid}):(opening|chunk|checkpoint):([0-9]+)(?::(gzip|${columnsGzip}):([1-9][0-9]*))?:sha256:)([0-9a-f]{64})$`,
);

export type SimulationOssPurpose = 'opening' | 'chunk' | 'checkpoint';

export function simulationOssReference(runRef: string, purpose: SimulationOssPurpose, sequence: number,
  checksum: string, storedBytes?: number, traceEncoding?: typeof VESSEL_TRACE_COLUMNS) {
  const encoding = storedBytes === undefined ? '' : `:${traceEncoding ? columnsGzip : 'gzip'}:${storedBytes}`;
  const reference = `simulation-cas:oss:${runRef}:${purpose}:${sequence}${encoding}:sha256:${checksum}`;
  if (!simulationTraceReferencePattern.test(reference) || !Number.isSafeInteger(sequence) || sequence < 0
    || (traceEncoding && (purpose !== 'chunk' || storedBytes === undefined))
    || (storedBytes !== undefined && (!Number.isSafeInteger(storedBytes) || storedBytes < 1 || storedBytes > MAX_VESSEL_EVIDENCE_BYTES))) {
    throw new Error('实验对象引用无效。');
  }
  return reference;
}

export function simulationOssLocation(reference: string) {
  const match = simulationTraceReferencePattern.exec(reference);
  if (!match?.[1]) throw new Error('实验对象引用无效。');
  const [, runRef, purpose, sequence, encoding, encodingBytes, checksum] = match;
  const storedBytes = encodingBytes === undefined ? undefined : Number(encodingBytes);
  const traceEncoding = encoding === columnsGzip ? VESSEL_TRACE_COLUMNS : undefined;
  if ((traceEncoding && purpose !== 'chunk')
    || (storedBytes !== undefined && (!Number.isSafeInteger(storedBytes) || storedBytes > MAX_VESSEL_EVIDENCE_BYTES))) {
    throw new Error('实验对象引用无效。');
  }
  const encodingSuffix = storedBytes === undefined ? '' : `.${storedBytes}`;
  const extension = traceEncoding ? `.${traceEncoding}.gz` : '.json.gz';
  return { runRef, purpose: purpose as SimulationOssPurpose, sequence: Number(sequence), checksum,
    storedBytes, traceEncoding, key: `experiments/${runRef}/${purpose}/${sequence}/${checksum}${encodingSuffix}${extension}` } as const;
}

/** Keep the index for older readers, which fetch this chunk through the existing JSON route. */
export function recoveryTraceReference(reference: string, supportsColumns: boolean | undefined) {
  return !supportsColumns && reference.includes(`:${columnsGzip}:`) ? '' : reference;
}
