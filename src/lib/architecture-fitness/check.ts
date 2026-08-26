import type { CensusCore } from '@/lib/architecture-census/types';
import { REQUIRED_BASELINE } from '@/lib/architecture-charter';
import { collectViolations } from './collect';
import type { FitnessAllowlist, FitnessReport, FitnessViolation } from './types';
import { FITNESS_SCHEMA_VERSION } from './types';

export function createAllowlist(
  core: CensusCore,
  charterSha256: string,
): FitnessAllowlist {
  if (core.captureIdentity.sourceCommit !== REQUIRED_BASELINE.sourceCommit) {
    throw new Error('baseline-commit-drift');
  }
  if (core.captureIdentity.sourceTree !== REQUIRED_BASELINE.sourceTree) {
    throw new Error('baseline-tree-drift');
  }
  return {
    schemaVersion: FITNESS_SCHEMA_VERSION,
    baselineSourceCommit: REQUIRED_BASELINE.sourceCommit,
    baselineSourceTree: REQUIRED_BASELINE.sourceTree,
    charterSha256,
    entries: collectViolations(core),
  };
}

export function checkFitness(core: CensusCore, allowlist: FitnessAllowlist): FitnessReport {
  if (allowlist.schemaVersion !== FITNESS_SCHEMA_VERSION) {
    throw new Error('unsupported-fitness-schema');
  }
  const current = collectViolations(core);
  const allowed = new Set(allowlist.entries.map((item) => item.id));
  const newViolations = current.filter((item) => !allowed.has(item.id));
  const remaining = current.filter((item) => allowed.has(item.id));
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
