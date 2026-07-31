import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertDeclaredAuthoritativeSnapshotReceipt,
  computeDeclaredAuthoritativeSnapshotReceiptDigest,
  validateDeclaredAuthoritativeSnapshotReceipt,
} from '../aggregate-governance/declared-authoritative-snapshot';

async function fixture(): Promise<Record<string, unknown>> {
  const source = await readFile(path.join(
    process.cwd(),
    'course-content/authoring/knowledge/issue-1117-v08-r3-chain/metadata/declared-authoritative-snapshot-receipt.json',
  ), 'utf8');
  return JSON.parse(source) as Record<string, unknown>;
}

describe('declared authoritative snapshot receipt', () => {
  it('accepts the frozen #1117 candidate receipt and recomputes its digest', async () => {
    const receipt = await fixture();
    expect(validateDeclaredAuthoritativeSnapshotReceipt(receipt)).toMatchObject({ valid: true, errors: [] });
    expect(() => assertDeclaredAuthoritativeSnapshotReceipt(receipt)).not.toThrow();
    expect(computeDeclaredAuthoritativeSnapshotReceiptDigest(receipt)).toBe(receipt.receiptDigest);
    expect((receipt.deltaReceipts as Array<Record<string, unknown>>)).toHaveLength(6);
  });

  it.each([
    ['captureRevision', (receipt: Record<string, unknown>) => { receipt.captureRevision = 'f'.repeat(40); }],
    ['candidate bundle link', (receipt: Record<string, unknown>) => {
      const delta = (receipt.deltaReceipts as Array<Record<string, unknown>>)[5];
      delta.candidateBundleDigest = 'f'.repeat(64);
    }],
    ['selector invariant', (receipt: Record<string, unknown>) => { receipt.selectorsChanged = 1; }],
    ['violations', (receipt: Record<string, unknown>) => { receipt.violations = ['digest-drift']; }],
    ['receipt digest', (receipt: Record<string, unknown>) => { receipt.receiptDigest = '0'.repeat(64); }],
  ])('rejects tampering of %s', async (_field, mutate) => {
    const receipt = await fixture();
    mutate(receipt);
    const result = validateDeclaredAuthoritativeSnapshotReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(() => assertDeclaredAuthoritativeSnapshotReceipt(receipt)).toThrow(/rejected/u);
  });
});
