/**
 * Frozen retain ledger for the #1592 denominator captured at R3 merge.
 */

import type {
  DeprecationLedgerEntry,
  ResourceGovernanceChangeSurface,
  ResourceGovernanceDeprecationLedger,
} from './contracts';
import {
  FROZEN_CALLERS,
  FROZEN_CANDIDATES,
  FROZEN_CAPTURE_REVISION,
} from './candidates';
import { buildDeprecationLedger } from './ledger';

export const CLEAN_CHANGE_SURFACE: ResourceGovernanceChangeSurface = {
  writesAuthority: false,
  writesTeachingProjection: false,
  writesRuntimeRelease: false,
  writesSelectors: false,
  writesProductionDeployment: false,
  writesLearningRecords: false,
  writesHistoricalArtifacts: false,
  includesPrismaMigration: false,
  usesDirectoryOrGlobDeletion: false,
  paths: [],
};

export function frozenLedgerEntries(): DeprecationLedgerEntry[] {
  return FROZEN_CANDIDATES.map((candidate) => {
    const callers = FROZEN_CALLERS[candidate.id] ?? [];
    const alreadyAbsent = !candidate.retireable;
    return {
      id: candidate.id,
      owner: candidate.owner,
      sourcePath: candidate.sourcePath,
      consumers: callers.map((hit) => hit.path),
      replacement: candidate.replacement.contract,
      migrationRevision: candidate.migrationRevision,
      state: alreadyAbsent ? 'already-absent' : 'retained',
      deletionCondition: candidate.deletionCondition,
      rollbackIdentity: FROZEN_CAPTURE_REVISION,
    };
  });
}

export function buildFrozenDeprecationLedger(): ResourceGovernanceDeprecationLedger {
  return buildDeprecationLedger({
    captureRevision: FROZEN_CAPTURE_REVISION,
    allowlist: [],
    entries: frozenLedgerEntries(),
  });
}
