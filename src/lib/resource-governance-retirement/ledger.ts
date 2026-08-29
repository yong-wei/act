/**
 * Monotonic architecture allowlist / deprecation ledger (#1592).
 */

import {
  RESOURCE_GOVERNANCE_RETIREMENT_LEDGER_CONTRACT,
  ResourceGovernanceRetirementGateError,
  type AllowlistException,
  type DeprecationLedgerEntry,
  type ResourceGovernanceDeprecationLedger,
} from './contracts';
import { isGitRevision, retirementDigest } from './hash';

export function buildDeprecationLedger(input: {
  captureRevision: string;
  allowlist?: readonly AllowlistException[];
  entries: readonly DeprecationLedgerEntry[];
}): ResourceGovernanceDeprecationLedger {
  if (!isGitRevision(input.captureRevision)) {
    throw new ResourceGovernanceRetirementGateError(
      'ledger-revision-invalid',
      'deprecation ledger captureRevision must be a 40-char git sha',
    );
  }
  const allowlist = [...(input.allowlist ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const entries = [...input.entries].sort((a, b) => a.id.localeCompare(b.id));
  const body = {
    contract: RESOURCE_GOVERNANCE_RETIREMENT_LEDGER_CONTRACT,
    captureRevision: input.captureRevision,
    allowlist,
    entries,
  };
  return {
    ...body,
    ledgerDigest: retirementDigest(body),
  };
}

function patternBroadens(prior: string, next: string): boolean {
  if (prior === next) return false;
  if (next === '*' || next === '**') return true;
  if (prior.endsWith('/**') && !next.startsWith(prior.slice(0, -3))) return true;
  if (!prior.includes('*') && next.includes('*')) return true;
  if (next.length < prior.length && prior.startsWith(next.replace(/\*+$/u, ''))) {
    return true;
  }
  return false;
}

/**
 * Later ledgers may only remove entries, narrow to an explicit historical
 * adapter, or keep retained rows. New exceptions, broadened patterns, and
 * unexplained resurrection fail closed.
 */
export function compareLedgers(
  prior: ResourceGovernanceDeprecationLedger | null,
  next: ResourceGovernanceDeprecationLedger,
): string[] {
  const reasons: string[] = [];
  const expectedDigest = retirementDigest({
    contract: next.contract,
    captureRevision: next.captureRevision,
    allowlist: next.allowlist,
    entries: next.entries,
  });
  if (next.ledgerDigest !== expectedDigest) {
    reasons.push('ledger-digest-tamper');
  }
  if (!prior) return reasons;

  const priorAllow = new Map(prior.allowlist.map((row) => [row.id, row]));
  const nextAllow = new Map(next.allowlist.map((row) => [row.id, row]));
  for (const id of nextAllow.keys()) {
    if (!priorAllow.has(id)) {
      reasons.push(`allowlist-new-exception:${id}`);
    }
  }
  for (const [id, priorRow] of priorAllow) {
    const nextRow = nextAllow.get(id);
    if (!nextRow) continue;
    if (patternBroadens(priorRow.pattern, nextRow.pattern)) {
      reasons.push(`allowlist-pattern-broadened:${id}`);
    }
  }

  const priorEntries = new Map(prior.entries.map((row) => [row.id, row]));
  const nextEntries = new Map(next.entries.map((row) => [row.id, row]));

  for (const id of nextEntries.keys()) {
    if (!priorEntries.has(id)) {
      reasons.push(`ledger-new-entry:${id}`);
    }
  }

  for (const [id, priorRow] of priorEntries) {
    const nextRow = nextEntries.get(id);
    if (!nextRow) {
      if (priorRow.state !== 'deleted' && priorRow.state !== 'already-absent') {
        reasons.push(`ledger-unexplained-removal:${id}`);
      }
      continue;
    }
    if (priorRow.state === 'deleted' && nextRow.state !== 'deleted') {
      reasons.push(`ledger-resurrection:${id}`);
    }
    if (
      priorRow.state === 'historical-adapter'
      && nextRow.state === 'retained'
    ) {
      reasons.push(`ledger-unexplained-state-reversal:${id}`);
    }
    if (
      priorRow.state === 'already-absent'
      && nextRow.state === 'retained'
    ) {
      reasons.push(`ledger-unexplained-state-reversal:${id}`);
    }
  }

  if (next.allowlist.length > prior.allowlist.length) {
    reasons.push('allowlist-count-increased');
  }
  if (next.entries.length > prior.entries.length) {
    reasons.push('ledger-entry-count-increased');
  }

  return reasons;
}

export function assertLedgerMonotonic(
  prior: ResourceGovernanceDeprecationLedger | null,
  next: ResourceGovernanceDeprecationLedger,
): void {
  const reasons = compareLedgers(prior, next);
  if (reasons.length > 0) {
    throw new ResourceGovernanceRetirementGateError(
      'ledger-not-monotonic',
      'architecture allowlist / deprecation ledger must only decrease or narrow',
      reasons,
    );
  }
}
