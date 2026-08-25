/**
 * Deterministic summary generation with negative-case validation
 * (#1515, task 2.5).
 *
 * Summaries are recomputed from declared files: missing rows, duplicate
 * rows, orphan outputs, cross-capture inputs, hash drift, and unknown
 * disposition states all fail closed instead of degrading into partial
 * counts.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  FormalResourceRemediationError,
  type ResourceProcessingRecord,
} from './contracts';

export interface SummaryInputRow {
  readonly resourceId: string;
  readonly subtype: string;
  readonly disposition: string;
  readonly atomCount: number;
  readonly bindingCount: number;
  readonly sourceSha256: string;
  readonly allocationHash: string;
}

export interface RemediationSummary {
  readonly totalResources: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly bySubtype: readonly { readonly subtype: string; readonly total: number; readonly included: number; readonly excluded: number }[];
  readonly totalAtoms: number;
  readonly totalBindings: number;
  readonly summaryHash: string;
}

/**
 * Recompute the resource summary from declared rows. Duplicate resource
 * rows, unknown dispositions, and rows bound to a foreign allocation fail
 * closed.
 */
export function buildRemediationSummary(
  allocationHash: string,
  rows: readonly SummaryInputRow[],
): RemediationSummary {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.resourceId || typeof row.resourceId !== 'string') {
      throw new FormalResourceRemediationError(
        'summary-row-invalid',
        'A summary row is missing its resource identity.',
      );
    }
    if (seen.has(row.resourceId)) {
      throw new FormalResourceRemediationError(
        'summary-row-duplicate',
        `Resource ${row.resourceId} appears more than once in the summary input.`,
      );
    }
    seen.add(row.resourceId);
    if (row.disposition !== 'INCLUDED' && row.disposition !== 'EXCLUDED') {
      throw new FormalResourceRemediationError(
        'summary-row-invalid',
        `Resource ${row.resourceId} has an unknown disposition ${row.disposition}.`,
      );
    }
    if (row.allocationHash !== allocationHash) {
      throw new FormalResourceRemediationError(
        'summary-row-cross-capture',
        `Resource ${row.resourceId} was produced under allocation ${row.allocationHash.slice(0, 12)}, not ${allocationHash.slice(0, 12)}.`,
      );
    }
    if (!/^[a-f0-9]{64}$/u.test(row.sourceSha256)) {
      throw new FormalResourceRemediationError(
        'summary-row-invalid',
        `Resource ${row.resourceId} has a malformed source hash.`,
      );
    }
    if (!Number.isInteger(row.atomCount) || row.atomCount < 0
      || !Number.isInteger(row.bindingCount) || row.bindingCount < 0) {
      throw new FormalResourceRemediationError(
        'summary-row-invalid',
        `Resource ${row.resourceId} has non-integer atom/binding counts.`,
      );
    }
  }
  const bySubtypeMap = new Map<string, { total: number; included: number; excluded: number }>();
  for (const row of rows) {
    const entry = bySubtypeMap.get(row.subtype) ?? { total: 0, included: 0, excluded: 0 };
    entry.total += 1;
    if (row.disposition === 'INCLUDED') entry.included += 1;
    else entry.excluded += 1;
    bySubtypeMap.set(row.subtype, entry);
  }
  const bySubtype = [...bySubtypeMap.entries()]
    .map(([subtype, counts]) => ({ subtype, ...counts }))
    .sort((a, b) => a.subtype.localeCompare(b.subtype));
  const includedCount = rows.filter((row) => row.disposition === 'INCLUDED').length;
  const summaryHash = projectionDigest({
    totalResources: rows.length,
    includedCount,
    excludedCount: rows.length - includedCount,
    bySubtype,
    totalAtoms: rows.reduce((total, row) => total + row.atomCount, 0),
    totalBindings: rows.reduce((total, row) => total + row.bindingCount, 0),
  });
  return {
    totalResources: rows.length,
    includedCount,
    excludedCount: rows.length - includedCount,
    bySubtype,
    totalAtoms: rows.reduce((total, row) => total + row.atomCount, 0),
    totalBindings: rows.reduce((total, row) => total + row.bindingCount, 0),
    summaryHash,
  };
}

/**
 * Orphan-output validation: every output id referenced by a processing
 * record must exist in the declared output inventory.
 */
export function assertNoOrphanOutputs(
  records: readonly ResourceProcessingRecord[],
  declaredOutputIds: readonly string[],
): void {
  const declared = new Set(declaredOutputIds);
  const orphans: string[] = [];
  for (const record of records) {
    for (const outputId of [
      ...record.atomOutputIds,
      ...record.mappingOutputIds,
      ...record.anchorOutputIds,
      ...record.launchOutputIds,
    ]) {
      if (!declared.has(outputId)) {
        orphans.push(outputId);
      }
    }
  }
  if (orphans.length > 0) {
    throw new FormalResourceRemediationError(
      'orphan-output',
      `Processing records reference ${orphans.length} outputs absent from the declared inventory (first: ${orphans[0]}).`,
    );
  }
}

/** Hash-drift guard for reopened source files. */
export function assertSourceHashMatches(
  resourceId: string,
  declaredSha256: string,
  observedSha256: string,
): void {
  if (declaredSha256 !== observedSha256) {
    throw new FormalResourceRemediationError(
      'hash-drift',
      `Source for ${resourceId} hashes to ${observedSha256.slice(0, 12)} but was declared ${declaredSha256.slice(0, 12)}.`,
    );
  }
}
