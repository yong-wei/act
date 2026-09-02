import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { WriteBoundaryError } from '@/features/learning-record/write-boundary/public-api';
import {
  BACKFILL_LANE_CAPTURE_SHA,
  BACKFILL_LANE_ROWS,
  BackfillLaneError,
  assertOnlineDoesNotImportBackfill,
  assertOrdinaryBackfillDoesNotPublishCurrent,
  beginAuthorizedBackfillApply,
  computeBackfillInputDigest,
  createFileReceiptStore,
  isAtOrBeforeFrozenCutoff,
  isAuxiliaryStateAtOrBeforeFrozenCutoff,
  rejectOnlineBackfillFallback,
  type BackfillReceiptStore,
  type BackfillTerminalReceipt,
} from '../public-api';

function memoryStore(): BackfillReceiptStore {
  const receipts = new Map<string, BackfillTerminalReceipt>();
  return {
    get: (operationId) => receipts.get(operationId),
    put: (receipt) => {
      receipts.set(receipt.operationId, receipt);
    },
  };
}

describe('Learning Record backfill lane', () => {
  it('binds the online/backfill inventory to the C9 capture SHA', () => {
    expect(BACKFILL_LANE_CAPTURE_SHA).toMatch(/^[0-9a-f]{40}$/);
    expect(BACKFILL_LANE_ROWS.some((row) => row.kind === 'online-reader' && row.mode === 'online')).toBe(true);
    expect(BACKFILL_LANE_ROWS.some((row) => row.kind === 'backfill-command' && row.mode === 'ordinary-backfill')).toBe(true);
  });

  it('keeps dry-run apply unauthorized and persists a receipt only after authorized apply', () => {
    const store = memoryStore();
    const auth = {
      operationId: 'op-1',
      authorizedBy: 'operator',
      frozenCutoff: '2026-05-21T00:00:00.000Z',
    };
    const digest = computeBackfillInputDigest({
      lane: 'course-evidence',
      frozenCutoff: auth.frozenCutoff,
      scope: { sessionIds: ['session-a'] },
    });
    expect(() => beginAuthorizedBackfillApply({}, digest, store)).toThrow(WriteBoundaryError);
    expect(beginAuthorizedBackfillApply(auth, digest, store).existing).toBeUndefined();
    store.put({
      ...auth,
      lane: 'course-evidence',
      mode: 'apply',
      captureRevision: '',
      inputDigest: digest,
      status: 'applied',
      outcomes: { accepted: 1 },
      factsCreated: 0,
      factsUpdated: 1,
      currentPointerMoved: false,
    });
    expect(beginAuthorizedBackfillApply(auth, digest, store).existing?.status).toBe('applied');
    const drifted = { ...auth, frozenCutoff: '2026-05-22T00:00:00.000Z' };
    expect(() => beginAuthorizedBackfillApply(drifted, computeBackfillInputDigest({
      lane: 'course-evidence',
      frozenCutoff: drifted.frozenCutoff,
      scope: { sessionIds: ['session-a'] },
    }), store)).toThrow(BackfillLaneError);
    expect(computeBackfillInputDigest({
      lane: 'course-evidence',
      frozenCutoff: auth.frozenCutoff,
      scope: { filters: { to: new Date('2026-05-20T00:00:00.000Z') } },
    })).not.toBe(computeBackfillInputDigest({
      lane: 'course-evidence',
      frozenCutoff: auth.frozenCutoff,
      scope: { filters: { to: new Date('2026-05-21T00:00:00.000Z') } },
    }));
    const dir = mkdtempSync(path.join(tmpdir(), 'backfill-receipt-'));
    const files = createFileReceiptStore(dir);
    files.put({
      ...auth,
      lane: 'course-evidence',
      mode: 'apply',
      captureRevision: '',
      inputDigest: digest,
      status: 'applied',
      outcomes: { accepted: 1 },
      factsCreated: 0,
      factsUpdated: 1,
      currentPointerMoved: false,
    });
    expect(files.get('op-1')?.inputDigest).toBe(digest);
    expect(readFileSync(path.join(dir, 'op-1.json'), 'utf8')).toContain(digest);
    expect(isAtOrBeforeFrozenCutoff('2026-05-21T00:30:00.000Z', '2026-05-21T08:00:00+08:00')).toBe(false);
    expect(isAtOrBeforeFrozenCutoff('2026-05-20T23:00:00.000Z', '2026-05-21T08:00:00+08:00')).toBe(true);
    expect(isAuxiliaryStateAtOrBeforeFrozenCutoff(
      '2026-05-21T00:30:00.000Z',
      '2026-05-20T23:00:00.000Z',
      '2026-05-21T08:00:00+08:00',
    )).toBe(false);
  });

  it('rejects online backfill fallback and proves current ports never import backfill', () => {
    expect(() => rejectOnlineBackfillFallback()).toThrow(BackfillLaneError);
    expect(assertOnlineDoesNotImportBackfill(process.cwd())).toEqual([]);
  });

  it('keeps ordinary backfill off the online current pointer', () => {
    expect(assertOrdinaryBackfillDoesNotPublishCurrent(process.cwd())).toEqual([]);
    expect(readFileSync('src/features/learning-record/projections/pointer.ts', 'utf8')).toContain('cutoverFence');
  });
});
