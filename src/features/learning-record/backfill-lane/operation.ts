import { sha256Canonical } from '@/features/learning-record/event-contract/digest';
import {
  assertExplicitHistoricalApply,
  type HistoricalApplyAuthorization,
} from '@/features/learning-record/write-boundary/public-api';

import {
  BackfillLaneError,
  type BackfillReceiptStore,
  type BackfillTerminalReceipt,
} from './types';

export function computeBackfillInputDigest(input: {
  lane: string;
  frozenCutoff: string;
  captureRevision?: string;
  scope?: unknown;
}): string {
  return sha256Canonical({
    lane: input.lane,
    frozenCutoff: input.frozenCutoff,
    captureRevision: input.captureRevision ?? '',
    scope: input.scope ?? null,
  });
}

export function buildBackfillTerminalReceipt(
  auth: HistoricalApplyAuthorization,
  input: {
    lane: string;
    captureRevision?: string;
    inputDigest: string;
    status: BackfillTerminalReceipt['status'];
    outcomes?: BackfillTerminalReceipt['outcomes'];
    factsCreated?: number;
    factsUpdated?: number;
  },
): BackfillTerminalReceipt {
  return {
    operationId: auth.operationId,
    authorizedBy: auth.authorizedBy,
    lane: input.lane,
    mode: 'apply',
    frozenCutoff: auth.frozenCutoff,
    captureRevision: input.captureRevision ?? '',
    inputDigest: input.inputDigest,
    status: input.status,
    outcomes: input.outcomes ?? {},
    factsCreated: input.factsCreated ?? 0,
    factsUpdated: input.factsUpdated ?? 0,
    currentPointerMoved: false,
  };
}

export function beginAuthorizedBackfillApply(
  input: Partial<HistoricalApplyAuthorization> | undefined,
  digest: string,
  store?: BackfillReceiptStore,
): { auth: HistoricalApplyAuthorization; existing?: BackfillTerminalReceipt } {
  const auth = assertExplicitHistoricalApply(input);
  const existing = store?.get(auth.operationId);
  if (existing && existing.inputDigest !== digest) {
    throw new BackfillLaneError(
      'input-drift',
      `backfill operation ${auth.operationId} input digest drifted`,
    );
  }
  return { auth, existing };
}

export function rejectOnlineBackfillFallback(): never {
  throw new BackfillLaneError(
    'online-backfill-forbidden',
    'online consumers cannot invoke backfill or raw aggregation as a projection fallback',
  );
}
