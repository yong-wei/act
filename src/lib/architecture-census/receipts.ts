import { serializeDeterministic, sha256Text } from './serialize';
import type { MeasurementReceipt } from './types';
import { MEASUREMENT_RECEIPT_SCHEMA_VERSION } from './types';

export function createMeasurementReceipt(input: Omit<MeasurementReceipt, 'schemaVersion' | 'receiptId'>): MeasurementReceipt {
  const draft = {
    schemaVersion: MEASUREMENT_RECEIPT_SCHEMA_VERSION,
    ...input,
  };
  return {
    ...draft,
    receiptId: sha256Text(serializeDeterministic(draft)),
  };
}

export function projectWithReceipts(
  censusCoreHash: string,
  receipts: readonly MeasurementReceipt[],
): string {
  return serializeDeterministic({
    censusCoreHash,
    receiptIds: receipts.map((receipt) => receipt.receiptId).sort(),
    receipts: [...receipts].sort((left, right) => left.receiptId.localeCompare(right.receiptId)),
  });
}
