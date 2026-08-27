import { createHash } from 'node:crypto';

import type { CommandReceipt } from './types';
import { TOOLCHAIN_RECEIPT_SCHEMA_VERSION } from './types';

const FORBIDDEN = [
  /\/Users\//,
  /\/home\//,
  /[A-Za-z]:\\/,
  /password/i,
  /api[_-]?key/i,
  /NEXTAUTH_SECRET/,
  /raw answers?/i,
];

export function buildCommandReceipt(input: Omit<CommandReceipt, 'schemaVersion'>): CommandReceipt {
  return {
    schemaVersion: TOOLCHAIN_RECEIPT_SCHEMA_VERSION,
    ...input,
  };
}

export function validateReceipt(receipt: CommandReceipt): string[] {
  const serialized = JSON.stringify(receipt);
  const failures: string[] = [];
  for (const pattern of FORBIDDEN) {
    if (pattern.test(serialized)) failures.push(`forbidden-receipt-content:${pattern}`);
  }
  if (!receipt.commandId || !receipt.sourceRevision || !receipt.sourceTree) {
    failures.push('incomplete-receipt-identity');
  }
  return failures;
}

export function digestJson(value: unknown): string {
  return createHash('sha256').update(`${JSON.stringify(value)}\n`).digest('hex');
}
