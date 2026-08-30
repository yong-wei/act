import { INGESTION_STATUS } from '@/features/learning-record/ingestion/types';

export type DrainReceiptKind = 'applied' | 'duplicate' | 'failure';

export function isConfirmedQueueReceipt(status: string): boolean {
  return status === INGESTION_STATUS.applied
    || status === INGESTION_STATUS.deduplicated
    || status === INGESTION_STATUS.terminalFailed;
}

export function classifyDrainReceipt(status: string): DrainReceiptKind | 'deferred' {
  if (status === INGESTION_STATUS.applied) return 'applied';
  if (status === INGESTION_STATUS.deduplicated) return 'duplicate';
  if (status === INGESTION_STATUS.terminalFailed) return 'failure';
  return 'deferred';
}

export function selectAckClaims<T>(claims: readonly T[], statuses: readonly string[]): T[] {
  return claims.filter((_, index) => isConfirmedQueueReceipt(statuses[index] ?? ''));
}
