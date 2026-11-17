const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const simulationTraceReferencePattern = new RegExp(
  `^simulation-cas:(?:(?:file|s3):sha256:|oss:(${uuid}):(opening|chunk|checkpoint):([0-9]+):sha256:)([0-9a-f]{64})$`,
);

export type SimulationOssPurpose = 'opening' | 'chunk' | 'checkpoint';

export function simulationOssReference(runRef: string, purpose: SimulationOssPurpose, sequence: number, checksum: string) {
  const reference = `simulation-cas:oss:${runRef}:${purpose}:${sequence}:sha256:${checksum}`;
  if (!simulationTraceReferencePattern.test(reference) || !Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error('实验对象引用无效。');
  }
  return reference;
}

export function simulationOssLocation(reference: string) {
  const match = simulationTraceReferencePattern.exec(reference);
  if (!match?.[1]) throw new Error('实验对象引用无效。');
  const [, runRef, purpose, sequence, checksum] = match;
  return { runRef, purpose: purpose as SimulationOssPurpose, sequence: Number(sequence), checksum,
    key: `experiments/${runRef}/${purpose}/${sequence}/${checksum}.json.gz` };
}
