const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const simulationTraceReferencePattern = new RegExp(
  `^simulation-cas:(?:(?:file|s3):sha256:|oss:(${uuid}):(opening|chunk|checkpoint):([0-9]+)(?::gzip:([1-9][0-9]*))?:sha256:)([0-9a-f]{64})$`,
);

export type SimulationOssPurpose = 'opening' | 'chunk' | 'checkpoint';

export function simulationOssReference(runRef: string, purpose: SimulationOssPurpose, sequence: number,
  checksum: string, storedBytes?: number) {
  const encoding = storedBytes === undefined ? '' : `:gzip:${storedBytes}`;
  const reference = `simulation-cas:oss:${runRef}:${purpose}:${sequence}${encoding}:sha256:${checksum}`;
  if (!simulationTraceReferencePattern.test(reference) || !Number.isSafeInteger(sequence) || sequence < 0
    || (storedBytes !== undefined && (!Number.isSafeInteger(storedBytes) || storedBytes < 1 || storedBytes > 4 * 1024 * 1024))) {
    throw new Error('实验对象引用无效。');
  }
  return reference;
}

export function simulationOssLocation(reference: string) {
  const match = simulationTraceReferencePattern.exec(reference);
  if (!match?.[1]) throw new Error('实验对象引用无效。');
  const [, runRef, purpose, sequence, encodingBytes, checksum] = match;
  const storedBytes = encodingBytes === undefined ? undefined : Number(encodingBytes);
  if (storedBytes !== undefined && (!Number.isSafeInteger(storedBytes) || storedBytes > 4 * 1024 * 1024)) {
    throw new Error('实验对象引用无效。');
  }
  const encodingSuffix = storedBytes === undefined ? '' : `.${storedBytes}`;
  return { runRef, purpose: purpose as SimulationOssPurpose, sequence: Number(sequence), checksum,
    storedBytes, key: `experiments/${runRef}/${purpose}/${sequence}/${checksum}${encodingSuffix}.json.gz` };
}
