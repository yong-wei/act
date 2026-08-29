import { readFileSync } from 'node:fs';

import { privacyViolation, serializeDeterministic, sha256Text } from './serialize';
import { CLOSURE_SCHEMA_VERSION, CLOSURE_STATUSES } from './types';
import type { NormalizedClosureReceipt } from './types';

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
  const violation = privacyViolation(text);
  if (violation) throw new Error(`privacy-violation:${violation}`);
  return parsed;
}

export function loadArchitectureClosureReceipt(path: string): NormalizedClosureReceipt {
  return parseArchitectureClosureReceipt(readFileSync(path, 'utf8'));
}

export function receiptDigest(receipt: NormalizedClosureReceipt): string {
  return sha256Text(serializeDeterministic(receipt));
}
