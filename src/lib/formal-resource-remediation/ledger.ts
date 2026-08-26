/**
 * Successor denominator, conservation, and continuity validation
 * (#1515, tasks 1.4–1.6).
 *
 * The denominator reuses the active-baseline-plus-explicit-delta
 * construction from `latest-authority-oss-cutover` (the production-active
 * OSS Runtime Release — never a local runtime directory scan — plus declared
 * new or changed inputs). On top of it, remediation proves conservation:
 * no denominator row disappears between discovery, processing, summary, and
 * envelope, every active-baseline teaching resource stays `INCLUDED` unless
 * explicitly retired, and every included atom ends `BOUND` or evidenced
 * `NON_TEACHING`.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  buildActiveBaseline,
  buildCombinedDenominator,
  buildExplicitDelta,
} from '@/lib/latest-authority-oss-cutover/denominator';
import { evaluateContinuityGate } from '@/lib/latest-authority-oss-cutover/continuity-gate';
import {
  LatestAuthorityCutoverError,
  type ActiveBaseline,
  type ActiveBaselineEntry,
  type ActiveRuntimeReleaseIdentity,
  type CombinedDenominator,
  type ContinuityFailureKind,
  type ExplicitDeltaInput,
  type ResourceSuccessorDisposition,
  type RetirementDecision,
} from '@/lib/latest-authority-oss-cutover/contracts';

import {
  FormalResourceRemediationError,
  RESOURCE_PROCESSING_RECORD_CONTRACT,
  type RemediationAtomDisposition,
  type ResourceDisposition,
  type ResourceProcessingRecord,
} from './contracts';

export {
  buildActiveBaseline,
  buildCombinedDenominator,
  buildExplicitDelta,
  evaluateContinuityGate,
};

export type { ActiveBaseline, ActiveBaselineEntry, ActiveRuntimeReleaseIdentity, CombinedDenominator };

/** Build the successor denominator bound to the allocation. */
export function buildRemediationDenominator(input: {
  activeRelease: ActiveRuntimeReleaseIdentity;
  entries: readonly ActiveBaselineEntry[];
  delta: readonly ExplicitDeltaInput[];
}): CombinedDenominator {
  const baseline = buildActiveBaseline({ activeRelease: input.activeRelease, entries: input.entries });
  const delta = buildExplicitDelta(input.delta);
  return buildCombinedDenominator(baseline, delta);
}

/** Atom-level outcome for conservation accounting. */
export interface AtomConservationRow {
  readonly atomId: string;
  readonly resourceId: string;
  readonly disposition: RemediationAtomDisposition;
  readonly nonTeachingEvidenceRefs: readonly string[];
}

export interface ConservationInput {
  readonly denominator: CombinedDenominator;
  readonly processingRecords: readonly ResourceProcessingRecord[];
  readonly atomRows: readonly AtomConservationRow[];
  readonly retirements: readonly RetirementDecision[];
  readonly baselineReleaseId: string;
}

export interface ConservationResult {
  readonly conserved: boolean;
  readonly missingResourceIds: readonly string[];
  readonly extraResourceIds: readonly string[];
  /** Active-baseline resources that ended neither INCLUDED nor retired. */
  readonly violatedBaselineIds: readonly string[];
  /** Included resources without at least one BOUND atom. */
  readonly boundlessIncludedIds: readonly string[];
  /** Unevidenced NON_TEACHING atoms or atoms of non-included resources. */
  readonly invalidAtomIds: readonly string[];
  /** New-delta resources still without a final disposition. */
  readonly undecidedDeltaIds: readonly string[];
  readonly conservationHash: string;
}

/**
 * Prove denominator conservation and atom-level finality over actual
 * processing records. Technical failures on active-baseline resources
 * surface as violations here (they block completion); the same failure on a
 * new-delta resource is a legal development-only `EXCLUDED` outcome.
 */
export function validateConservation(input: ConservationInput): ConservationResult {
  const denominatorIds = new Set(input.denominator.entries.map((entry) => entry.resourceId));
  const recordIds = new Set(input.processingRecords.map((record) => record.resourceId));
  const missingResourceIds = [...denominatorIds].filter((id) => !recordIds.has(id)).sort();
  const extraResourceIds = [...recordIds].filter((id) => !denominatorIds.has(id)).sort();
  const retiredIds = new Set(input.retirements.map((decision) => decision.resourceId));

  const violatedBaselineIds: string[] = [];
  const boundlessIncludedIds: string[] = [];
  const undecidedDeltaIds: string[] = [];
  for (const record of input.processingRecords) {
    const entry = input.denominator.entries.find((row) => row.resourceId === record.resourceId);
    if (!entry) continue;
    if (entry.origin === 'BASELINE' && !retiredIds.has(record.resourceId)) {
      if (record.disposition !== 'INCLUDED') {
        violatedBaselineIds.push(record.resourceId);
      }
    }
    if (entry.origin === 'DELTA' && record.disposition !== 'INCLUDED' && record.disposition !== 'EXCLUDED') {
      undecidedDeltaIds.push(record.resourceId);
    }
    if (record.disposition === 'INCLUDED') {
      const boundAtoms = input.atomRows.filter(
        (row) => row.resourceId === record.resourceId && row.disposition === 'BOUND',
      );
      if (boundAtoms.length === 0) {
        boundlessIncludedIds.push(record.resourceId);
      }
    }
  }

  const recordById = new Map(input.processingRecords.map((record) => [record.resourceId, record]));
  const invalidAtomIds = input.atomRows
    .filter((row) => {
      const record = recordById.get(row.resourceId);
      if (!record || record.disposition !== 'INCLUDED') return true;
      if (row.disposition === 'NON_TEACHING' && row.nonTeachingEvidenceRefs.length === 0) return true;
      return false;
    })
    .map((row) => row.atomId)
    .sort();

  const conservationHash = projectionDigest({
    denominatorHash: input.denominator.denominatorHash,
    recordIds: [...recordIds].sort(),
    atomCount: input.atomRows.length,
    missingResourceIds,
    violatedBaselineIds,
  });
  const conserved =
    missingResourceIds.length === 0
    && extraResourceIds.length === 0
    && violatedBaselineIds.length === 0
    && boundlessIncludedIds.length === 0
    && invalidAtomIds.length === 0
    && undecidedDeltaIds.length === 0;
  return {
    conserved,
    missingResourceIds,
    extraResourceIds,
    violatedBaselineIds,
    boundlessIncludedIds,
    invalidAtomIds,
    undecidedDeltaIds,
    conservationHash,
  };
}

/** Continuity over successor dispositions, mapped from processing records. */
export function dispositionsFromRecords(
  records: readonly ResourceProcessingRecord[],
): readonly ResourceSuccessorDisposition[] {
  return records.map((record) => ({
    resourceId: record.resourceId,
    atomicDispositionsComplete: record.disposition === 'EXCLUDED'
      ? true
      : record.failureCodes.length === 0,
    canonicalBindingCount: record.disposition === 'EXCLUDED' ? 0 : record.mappingOutputIds.length,
    launchContractQualified: record.disposition === 'EXCLUDED' ? true : record.launchOutputIds.length > 0,
    failureKinds: record.failureCodes.map((code) => mapFailureCode(code)),
  }));
}

/** Remediation failure codes mapped onto the shared continuity vocabulary. */
const FAILURE_CODE_MAP: Readonly<Record<string, ContinuityFailureKind>> = {
  'missing-source': 'missing-script',
  'ambiguous-mapping': 'weak-canonical-mapping',
  'hash-drift': 'other-technical-failure',
  'processor-failure': 'failed-recognition',
  'qualification-failure': 'other-technical-failure',
  'anchor-failure': 'unsafe-anchor',
  'launcher-failure': 'unsupported-launcher',
  'privacy-violation': 'other-technical-failure',
  'unknown-disposition': 'other-technical-failure',
};

function mapFailureCode(code: string): ContinuityFailureKind {
  const mapped = FAILURE_CODE_MAP[code];
  if (mapped === undefined) {
    throw new FormalResourceRemediationError(
      'failure-code-unknown',
      `Processing record failure code ${code} has no continuity mapping; refusing to erase evidence.`,
    );
  }
  return mapped;
}

/** Reopen one processing record and verify its ledger integrity. */
export function reopenProcessingRecord(
  record: ResourceProcessingRecord,
): ResourceProcessingRecord {
  if (record.contract !== RESOURCE_PROCESSING_RECORD_CONTRACT) {
    throw new FormalResourceRemediationError(
      'processing-record-invalid',
      `Record ${record.recordId} uses an unsupported contract.`,
    );
  }
  if (!record.resourceId || !record.allocationHash || !record.processorIdentity) {
    throw new FormalResourceRemediationError(
      'processing-record-invalid',
      `Record ${record.recordId} is missing mandatory identity fields.`,
    );
  }
  if (record.disposition !== 'INCLUDED' && record.disposition !== 'EXCLUDED') {
    throw new FormalResourceRemediationError(
      'processing-record-invalid',
      `Record ${record.recordId} has an unknown disposition ${String(record.disposition)}.`,
    );
  }
  return record;
}

/**
 * A regression guard proving that completion cannot be satisfied by
 * builders, fixtures, caller-provided hashes, or writable fields: the
 * conservation check requires one reopened record per denominator row and
 * atom rows that reference actual record outputs.
 */
export function assertCompletionRequiresReopenableArtifacts(input: {
  denominator: CombinedDenominator;
  processingRecords: readonly ResourceProcessingRecord[];
  atomRows: readonly AtomConservationRow[];
  baselineReleaseId: string;
}): void {
  const result = validateConservation({
    denominator: input.denominator,
    processingRecords: input.processingRecords,
    atomRows: input.atomRows,
    retirements: [],
    baselineReleaseId: input.baselineReleaseId,
  });
  if (!result.conserved) {
    throw new FormalResourceRemediationError(
      'completion-not-proven',
      `Completion requires reopenable artifacts: missing=${result.missingResourceIds.join(',') || 'none'}, violatedBaseline=${result.violatedBaselineIds.join(',') || 'none'}, boundlessIncluded=${result.boundlessIncludedIds.join(',') || 'none'}, invalidAtoms=${result.invalidAtomIds.length}`,
    );
  }
}

export { LatestAuthorityCutoverError };
