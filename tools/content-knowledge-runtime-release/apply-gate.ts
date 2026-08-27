import { createHash } from 'node:crypto';

import type { ApplyGateInput, ApplyGateResult, CommandReceipt, ReleaseCommand, ReleaseIdentity } from './types';
import { PROJECTION_HANDOFF, RELEASE_TOOLCHAIN_SCHEMA_VERSION } from './types';

const FIXTURE_APPROVAL = 'fixture-approval';
const FORBIDDEN = [
  /\/Users\//,
  /\/home\//,
  /NEXTAUTH_SECRET/,
  /DATABASE_URL=/,
];

export function hashValue(value: string): string {
  return createHash('sha256').update(`${value}\n`).digest('hex');
}

export function commandInputHash(
  command: Pick<ReleaseCommand, 'commandId' | 'role' | 'safetyMode'>,
  blobSha: string,
): string {
  return hashValue(`${command.commandId}\n${command.role}\n${command.safetyMode}\n${blobSha}`);
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

export function claimedIdentityMatches(
  claimed: { sourceRevision: string; sourceTree: string } | null,
  current: Pick<ReleaseIdentity, 'sourceRevision' | 'sourceTree'>,
): boolean {
  if (!claimed) return true;
  return claimed.sourceRevision === current.sourceRevision && claimed.sourceTree === current.sourceTree;
}

export function buildCommandReceipt(input: {
  command: Pick<ReleaseCommand, 'commandId' | 'toolchain'>;
  sourceRevision: string;
  sourceTree: string;
  planHash: string;
  inputHash: string;
  targetIdentity: string;
  gate: ApplyGateResult;
  inputDigest?: string;
  outputDigest?: string;
  statusOverride?: CommandReceipt['status'];
}): CommandReceipt {
  const approvalState = input.gate.reason === 'approval-absent'
    ? 'absent'
    : input.gate.reason === 'plan-hash-stale'
      ? 'stale'
      : input.gate.status === 'apply-authorized-not-executed'
        ? 'fixture-approved'
        : 'not-required';
  const receipt: CommandReceipt = {
    schemaVersion: RELEASE_TOOLCHAIN_SCHEMA_VERSION,
    commandId: input.command.commandId,
    sourceRevision: input.sourceRevision,
    sourceTree: input.sourceTree,
    toolchain: input.command.toolchain,
    inputDigest: input.inputDigest ?? input.inputHash,
    outputDigest: input.outputDigest ?? hashValue(input.gate.status),
    executed: false,
    productionActivation: false,
    selectorMutation: false,
    planHash: input.planHash,
    inputHash: input.inputHash,
    targetIdentity: redactTargetIdentity(input.targetIdentity),
    approvalState,
    status: input.statusOverride ?? input.gate.status,
    projectionHandoff: input.command.toolchain === 'knowledge-release' ? PROJECTION_HANDOFF : null,
  };
  const serialized = JSON.stringify({
    ...receipt,
    commandId: 'redacted-command',
  });
  for (const pattern of FORBIDDEN) {
    if (pattern.test(serialized)) throw new Error(`privacy-unsafe-receipt:${pattern}`);
  }
  return receipt;
}
