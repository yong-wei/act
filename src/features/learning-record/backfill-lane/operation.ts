import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

export const BACKFILL_RECEIPT_DIR = 'artifacts/learning-record/backfill-receipts';

function jsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, jsonSafe(nested)]),
    );
  }
  return value;
}

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
    scope: jsonSafe(input.scope ?? null),
  });
}

function receiptFile(directory: string, operationId: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(operationId)) {
    throw new BackfillLaneError('input-drift', `unsafe backfill operation id: ${operationId}`);
  }
  return path.join(directory, `${operationId}.json`);
}

export function createFileReceiptStore(directory = BACKFILL_RECEIPT_DIR): BackfillReceiptStore {
  mkdirSync(directory, { recursive: true });
  return {
    get(operationId) {
      const file = receiptFile(directory, operationId);
      if (!existsSync(file)) return undefined;
      return JSON.parse(readFileSync(file, 'utf8')) as BackfillTerminalReceipt;
    },
    put(receipt) {
      writeFileSync(receiptFile(directory, receipt.operationId), `${JSON.stringify(receipt)}\n`);
    },
  };
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
