import { createHash } from 'node:crypto';

import type { ApplyGateInput, ApplyGateResult, CommandReceipt } from './types';
import { MIGRATION_BACKFILL_SCHEMA_VERSION } from './types';

const FIXTURE_APPROVAL = 'fixture-approval';

const FORBIDDEN = [
  /\/Users\//,
  /\/home\//,
  /password/i,
  /NEXTAUTH_SECRET/,
  /DATABASE_URL=/,
];

export function hashValue(value: string): string {
  return createHash('sha256').update(`${value}\n`).digest('hex');
}

export function redactTargetIdentity(raw: string): string {
  if (raw.startsWith('fixture:')) return raw;
  return 'redacted-target';
}

export function evaluateApplyGate(input: ApplyGateInput): ApplyGateResult {
  if (input.mode === 'dry-run') {
    return { allowed: true, executed: false, status: 'dry-run', reason: null };
  }
  if (!input.approval) {
    return { allowed: false, executed: false, status: 'apply-rejected', reason: 'approval-absent' };
  }
  if (!input.planHash) {
    return { allowed: false, executed: false, status: 'apply-rejected', reason: 'plan-hash-absent' };
  }
  if (input.planHash !== input.currentInputHash) {
    return { allowed: false, executed: false, status: 'apply-rejected', reason: 'plan-hash-stale' };
  }
  if (input.approval !== FIXTURE_APPROVAL || !input.targetIdentity.startsWith('fixture:')) {
    return { allowed: false, executed: false, status: 'apply-rejected', reason: 'production-apply-forbidden' };
  }
  return {
    allowed: true,
    executed: false,
    status: 'apply-authorized-not-executed',
    reason: 'this-change-does-not-execute-apply',
  };
}

export function buildCommandReceipt(input: {
  commandId: string;
  sourceRevision: string;
  sourceTree: string;
  planHash: string;
  inputHash: string;
  targetIdentity: string;
  gate: ApplyGateResult;
}): CommandReceipt {
  const approvalState = input.gate.reason === 'approval-absent'
    ? 'absent'
    : input.gate.reason === 'plan-hash-stale'
      ? 'stale'
      : input.gate.status === 'apply-authorized-not-executed'
        ? 'fixture-approved'
        : 'not-required';
  const receipt: CommandReceipt = {
    schemaVersion: MIGRATION_BACKFILL_SCHEMA_VERSION,
    commandId: input.commandId,
    sourceRevision: input.sourceRevision,
    sourceTree: input.sourceTree,
    planHash: input.planHash,
    inputHash: input.inputHash,
    targetIdentity: redactTargetIdentity(input.targetIdentity),
    approvalState,
    status: input.gate.status,
    executed: false,
  };
  const serialized = JSON.stringify(receipt);
  for (const pattern of FORBIDDEN) {
    if (pattern.test(serialized)) throw new Error(`privacy-unsafe-receipt:${pattern}`);
  }
  return receipt;
}
