import {
  canDeleteTransport,
  isRetentionExpired,
  retentionCapMs,
  type RetentionKind,
} from '@/features/learning-record/event-contract/retention';
import { authorizeRawArtifact, authorizeReplay } from '@/features/learning-record/event-contract/replay';

export const INGESTION_RETENTION = {
  transportReplayDefaultHours: 72,
  transportReplayMaxDays: 7,
  successfulPayloadHours: 24,
  failureReceiptDefaultDays: 30,
  failureReceiptMaxDays: 90,
  approvedRawDefaultHours: 24,
  approvedRawMaxDays: 7,
  publicAuditDays: 90,
  learningFactExtraDays: 365,
} as const;

export interface DeletionStore {
  object: boolean;
  index: boolean;
  cache: boolean;
  replica: boolean;
}

export function assertTerminalBeforeDelete(input: {
  terminalReceipt: boolean;
  terminalizationInProgress: boolean;
}): void {
  if (!canDeleteTransport(input)) {
    throw new Error('retention-not-terminal');
  }
}

export function verifyDeletionUnreadability(store: DeletionStore): boolean {
  return !store.object && !store.index && !store.cache && !store.replica;
}

export function successfulPayloadExpired(ageMs: number): boolean {
  return isRetentionExpired('successful-payload', ageMs);
}

export { authorizeRawArtifact, authorizeReplay, isRetentionExpired, retentionCapMs };
export type { RetentionKind };
