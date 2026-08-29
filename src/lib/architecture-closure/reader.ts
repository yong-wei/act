import { existsSync, readFileSync } from 'node:fs';

import { recomputeClosureReceiptId } from './generate';
import { privacyViolation, serializeDeterministic, sha256Text } from './serialize';
import { CLOSURE_SCHEMA_VERSION, CLOSURE_STATUSES } from './types';
import type { NormalizedClosureReceipt } from './types';

const RECEIPT_ID = /^[a-f0-9]{64}$/u;

function sidecarPath(path: string): string {
  return path.endsWith('.json') ? `${path.slice(0, -5)}.sha256` : `${path}.sha256`;
}

function assertFileDigest(path: string, text: string): void {
  const sidecar = sidecarPath(path);
  if (!existsSync(sidecar)) return;
  const expected = readFileSync(sidecar, 'utf8').trim().split(/\s+/u)[0] ?? '';
  if (!RECEIPT_ID.test(expected)) {
    throw new Error(`invalid-file-digest:${expected}`);
  }
  const actual = sha256Text(text);
  if (actual !== expected) {
    throw new Error('receipt-file-digest-mismatch');
  }
}

export function parseArchitectureClosureReceipt(text: string): NormalizedClosureReceipt {
  const parsed = JSON.parse(text) as NormalizedClosureReceipt;
  if (parsed.schemaVersion !== CLOSURE_SCHEMA_VERSION) {
    throw new Error(`unsupported-closure-schema:${String(parsed.schemaVersion)}`);
  }
  if (!(CLOSURE_STATUSES as readonly string[]).includes(parsed.status)) {
    throw new Error(`invalid-closure-status:${String(parsed.status)}`);
  }
  if (!parsed.sourceIdentity?.sourceCommit || !parsed.sourceIdentity?.sourceTree) {
    throw new Error('missing-source-identity');
  }
  if (!Array.isArray(parsed.inputReceiptIdentities) || !parsed.totals || !parsed.terminalCoverage) {
    throw new Error('invalid-closure-receipt');
  }
  if (!RECEIPT_ID.test(parsed.receiptId)) {
    throw new Error(`invalid-receipt-id:${String(parsed.receiptId)}`);
  }
  const violation = privacyViolation(text);
  if (violation) throw new Error(`privacy-violation:${violation}`);
  if (recomputeClosureReceiptId(parsed) !== parsed.receiptId) {
    throw new Error('receipt-id-mismatch');
  }
  return parsed;
}

export function loadArchitectureClosureReceipt(path: string): NormalizedClosureReceipt {
  const text = readFileSync(path, 'utf8');
  assertFileDigest(path, text);
  return parseArchitectureClosureReceipt(text);
}

export function receiptDigest(receipt: NormalizedClosureReceipt): string {
  return sha256Text(serializeDeterministic(receipt));
}
