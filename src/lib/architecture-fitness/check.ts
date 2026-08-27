import type { CensusCore, CensusSourceFile } from '@/lib/architecture-census/types';
import { REQUIRED_BASELINE } from '@/lib/architecture-charter';
import { collectViolations } from './collect';
import type { FitnessAllowlist, FitnessReport, FitnessViolation } from './types';
import { FITNESS_SCHEMA_VERSION } from './types';

export function createAllowlist(
  core: CensusCore,
  charterSha256: string,
  files: readonly CensusSourceFile[] = [],
): FitnessAllowlist {
  return {
    schemaVersion: FITNESS_SCHEMA_VERSION,
    baselineSourceCommit: REQUIRED_BASELINE.sourceCommit,
    baselineSourceTree: REQUIRED_BASELINE.sourceTree,
    charterSha256,
    entries: collectViolations(core, files),
  };
}

export function checkFitness(
  core: CensusCore,
  allowlist: FitnessAllowlist,
  files: readonly CensusSourceFile[] = [],
): FitnessReport {
  if (allowlist.schemaVersion !== FITNESS_SCHEMA_VERSION) {
    throw new Error('unsupported-fitness-schema');
  }
  const current = collectViolations(core, files);
  const allowed = new Set(allowlist.entries.map((item) => item.id));
  const allowlistedSccs = allowlist.entries
    .filter((item) => item.kind === 'scc')
    .map((item) => item.identity.replace(/^scc:/u, '').split('|'));
  const isExistingScc = (identity: string): boolean => {
    const members = identity.replace(/^scc:/u, '').split('|');
    return allowlistedSccs.some((allowedMembers) => members.every((member) => allowedMembers.includes(member)));
  };
  const newViolations = current.filter((item) => (
    !allowed.has(item.id)
    && !(item.kind === 'scc' && isExistingScc(item.identity))
  ));
  const remaining = current.filter((item) => !newViolations.some((violation) => violation.id === item.id));
  return {
    ok: newViolations.length === 0,
    allowlistCount: allowlist.entries.length,
    currentCount: current.length,
    newViolations,
    remaining,
  };
}

export function assertFitness(report: FitnessReport): void {
  if (!report.ok) {
    const sample = report.newViolations[0];
    throw new Error(`new-architecture-violation:${sample?.id ?? 'unknown'}`);
  }
}

export type { FitnessViolation };
