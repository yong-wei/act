/**
 * Immutable legacy CourseCoverage audit manifest reader (#1265).
 *
 * Provenance / audit counts only. Never writes Authority, Repository,
 * CourseCoverage, or consumer selector state. Tamper → fail closed.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { sha256Canonical } from './hash';
import {
  type LegacyAuditState,
  parseLegacyAuditState,
} from './authority-boundary-states';
import { evaluateHistoricalDeferImpact } from './authority-boundary-gate';

export const LEGACY_COURSE_COVERAGE_AUDIT_SCHEMA_VERSION =
  'legacy-course-coverage-audit-manifest/v1' as const;

export const LEGACY_COURSE_COVERAGE_AUDIT_STRATEGY_VERSION =
  'legacy-course-coverage-audit/v1' as const;

export const LEGACY_COURSE_COVERAGE_AUDIT_PROTOCOL_VERSION =
  'current-course-coverage-batch-review/1' as const;

export const LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_PATH =
  'course-content/authoring/knowledge/legacy-course-coverage-audit/legacy-audit-manifest.json' as const;

/** Frozen published digest of the exact 34-batch / 4,891-member manifest. */
export const LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST =
  'f0a997e976294b4f0ea6b1863fe0efc428a32a91c48153b1d689f1a458ebe984' as const;

export const LEGACY_AUDIT_EXPECTED_COUNTS = {
  batches: 34,
  members: 4891,
  included: 11,
  deferred: 4880,
  excluded: 0,
  conflicts: 0,
} as const;

export class LegacyAuditTamperError extends Error {
  readonly code = 'legacy-audit-tamper' as const;

  constructor(message: string) {
    super(message);
    this.name = 'LegacyAuditTamperError';
  }
}

export interface LegacyAuditBatchSummary {
  issueDir: string;
  receiptPath: string;
  receiptDigest: string;
  receiptBytesSha256: string;
  status: string;
  batchId: string;
  memberCount: number;
  memberDigest: string;
  worklistDigest: string;
  manifestDigest: string;
  included: number;
  deferredEvidenceBlocked: number;
  aggregateCoverageGate: string;
}

export interface LegacyAuditProvenance {
  schemaVersion: typeof LEGACY_COURSE_COVERAGE_AUDIT_SCHEMA_VERSION;
  strategyVersion: typeof LEGACY_COURSE_COVERAGE_AUDIT_STRATEGY_VERSION;
  protocolVersion: typeof LEGACY_COURSE_COVERAGE_AUDIT_PROTOCOL_VERSION;
  kind: 'legacy-audit-manifest';
  immutable: true;
  authority: 'AUDIT_ONLY';
  selectorAuthority: false;
  capture: {
    identityKind: string;
    gitHeads: string[];
    worklistDigests: string[];
    batchCount: number;
    memberCount: number;
  };
  sourceIssueRange: {
    firstIssue: number;
    lastIssue: number;
    issueDirs: string[];
  };
  counts: {
    batches: number;
    members: number;
    included: number;
    deferred: number;
    excluded: number;
    conflicts: number;
  };
  batches: LegacyAuditBatchSummary[];
  manifestDigest: string;
  state: LegacyAuditState;
  /** Always false: this reader never mutates selector / Authority state. */
  writesAuthorityState: false;
  writesRepositoryState: false;
  writesCourseCoverageState: false;
  writesConsumerSelectorState: false;
  historicalDeferImpact: ReturnType<typeof evaluateHistoricalDeferImpact>;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LegacyAuditTamperError(`Legacy audit rejected: ${field} must be an object`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new LegacyAuditTamperError(`Legacy audit rejected: ${field} must be a non-empty string`);
  }
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new LegacyAuditTamperError(`Legacy audit rejected: ${field} must be an integer`);
  }
  return value;
}

function asArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new LegacyAuditTamperError(`Legacy audit rejected: ${field} must be an array`);
  }
  return value;
}

/** Recompute the content digest over every field except manifestDigest. */
export function computeLegacyAuditManifestDigest(manifest: unknown): string {
  const record = asRecord(manifest, 'manifest');
  const { manifestDigest: _ignored, ...rest } = record;
  return sha256Canonical(rest);
}

/**
 * Validate frozen counts / protocol / digest. Returns audit provenance only.
 * Throws LegacyAuditTamperError on any mismatch (fail closed).
 */
export function readLegacyCourseCoverageAudit(
  manifest: unknown,
): LegacyAuditProvenance {
  const root = asRecord(manifest, 'manifest');
  if (root.schemaVersion !== LEGACY_COURSE_COVERAGE_AUDIT_SCHEMA_VERSION) {
    throw new LegacyAuditTamperError('Legacy audit rejected: schemaVersion mismatch');
  }
  if (root.strategyVersion !== LEGACY_COURSE_COVERAGE_AUDIT_STRATEGY_VERSION) {
    throw new LegacyAuditTamperError('Legacy audit rejected: strategyVersion mismatch');
  }
  if (root.protocolVersion !== LEGACY_COURSE_COVERAGE_AUDIT_PROTOCOL_VERSION) {
    throw new LegacyAuditTamperError('Legacy audit rejected: protocolVersion mismatch');
  }
  if (root.kind !== 'legacy-audit-manifest') {
    throw new LegacyAuditTamperError('Legacy audit rejected: kind mismatch');
  }
  if (root.immutable !== true || root.authority !== 'AUDIT_ONLY' || root.selectorAuthority !== false) {
    throw new LegacyAuditTamperError('Legacy audit rejected: immutability markers drifted');
  }
  if (
    root.writesAuthorityState !== false
    || root.writesRepositoryState !== false
    || root.writesCourseCoverageState !== false
    || root.writesConsumerSelectorState !== false
  ) {
    throw new LegacyAuditTamperError('Legacy audit rejected: write-capability markers must remain false');
  }

  const counts = asRecord(root.counts, 'counts');
  const batchCount = asNumber(counts.batches, 'counts.batches');
  const memberCount = asNumber(counts.members, 'counts.members');
  const included = asNumber(counts.included, 'counts.included');
  const deferred = asNumber(counts.deferred, 'counts.deferred');
  const excluded = asNumber(counts.excluded, 'counts.excluded');
  const conflicts = asNumber(counts.conflicts, 'counts.conflicts');

  if (batchCount !== LEGACY_AUDIT_EXPECTED_COUNTS.batches
    || memberCount !== LEGACY_AUDIT_EXPECTED_COUNTS.members
    || included !== LEGACY_AUDIT_EXPECTED_COUNTS.included
    || deferred !== LEGACY_AUDIT_EXPECTED_COUNTS.deferred
    || excluded !== LEGACY_AUDIT_EXPECTED_COUNTS.excluded
    || conflicts !== LEGACY_AUDIT_EXPECTED_COUNTS.conflicts) {
    throw new LegacyAuditTamperError(
      'Legacy audit rejected: frozen counts drifted '
      + `(batches=${batchCount}, members=${memberCount}, included=${included}, deferred=${deferred})`,
    );
  }

  const batchesRaw = asArray(root.batches, 'batches');
  if (batchesRaw.length !== LEGACY_AUDIT_EXPECTED_COUNTS.batches) {
    throw new LegacyAuditTamperError(
      `Legacy audit rejected: batch array length ${batchesRaw.length} !== 34`,
    );
  }

  let summedMembers = 0;
  let summedIncluded = 0;
  let summedDeferred = 0;
  const batches: LegacyAuditBatchSummary[] = batchesRaw.map((raw, index) => {
    const batch = asRecord(raw, `batches[${index}]`);
    const binding = asRecord(batch.batchBinding, `batches[${index}].batchBinding`);
    const batchCounts = asRecord(batch.counts, `batches[${index}].counts`);
    const members = asNumber(batchCounts.members, `batches[${index}].counts.members`);
    const includedCount = asNumber(batchCounts.included, `batches[${index}].counts.included`);
    const deferredCount = asNumber(
      batchCounts.deferredEvidenceBlocked,
      `batches[${index}].counts.deferredEvidenceBlocked`,
    );
    summedMembers += members;
    summedIncluded += includedCount;
    summedDeferred += deferredCount;
    const ordered = asArray(batch.orderedMembers, `batches[${index}].orderedMembers`);
    const terminal = asArray(batch.terminalMembers, `batches[${index}].terminalMembers`);
    if (ordered.length !== members || terminal.length !== members) {
      throw new LegacyAuditTamperError(
        `Legacy audit rejected: batches[${index}] member list length drift`,
      );
    }
    return {
      issueDir: asString(batch.issueDir, `batches[${index}].issueDir`),
      receiptPath: asString(batch.receiptPath, `batches[${index}].receiptPath`),
      receiptDigest: asString(batch.receiptDigest, `batches[${index}].receiptDigest`),
      receiptBytesSha256: asString(batch.receiptBytesSha256, `batches[${index}].receiptBytesSha256`),
      status: asString(batch.status, `batches[${index}].status`),
      batchId: asString(binding.batchId, `batches[${index}].batchBinding.batchId`),
      memberCount: members,
      memberDigest: asString(binding.memberDigest, `batches[${index}].batchBinding.memberDigest`),
      worklistDigest: asString(binding.worklistDigest, `batches[${index}].batchBinding.worklistDigest`),
      manifestDigest: asString(binding.manifestDigest, `batches[${index}].batchBinding.manifestDigest`),
      included: includedCount,
      deferredEvidenceBlocked: deferredCount,
      aggregateCoverageGate: asString(
        batch.aggregateCoverageGate,
        `batches[${index}].aggregateCoverageGate`,
      ),
    };
  });

  if (
    summedMembers !== LEGACY_AUDIT_EXPECTED_COUNTS.members
    || summedIncluded !== LEGACY_AUDIT_EXPECTED_COUNTS.included
    || summedDeferred !== LEGACY_AUDIT_EXPECTED_COUNTS.deferred
  ) {
    throw new LegacyAuditTamperError(
      'Legacy audit rejected: per-batch count aggregate drifted',
    );
  }

  const storedDigest = asString(root.manifestDigest, 'manifestDigest');
  const recomputed = computeLegacyAuditManifestDigest(root);
  if (storedDigest !== recomputed || storedDigest !== LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST) {
    throw new LegacyAuditTamperError(
      `Legacy audit rejected: manifestDigest mismatch `
      + `(stored=${storedDigest}, recomputed=${recomputed}, expected=${LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_DIGEST})`,
    );
  }

  const capture = asRecord(root.capture, 'capture');
  const sourceIssueRange = asRecord(root.sourceIssueRange, 'sourceIssueRange');
  const issueDirs = asArray(sourceIssueRange.issueDirs, 'sourceIssueRange.issueDirs')
    .map((dir, index) => asString(dir, `sourceIssueRange.issueDirs[${index}]`));
  if (issueDirs.length !== LEGACY_AUDIT_EXPECTED_COUNTS.batches) {
    throw new LegacyAuditTamperError('Legacy audit rejected: issueDirs length drift');
  }

  return {
    schemaVersion: LEGACY_COURSE_COVERAGE_AUDIT_SCHEMA_VERSION,
    strategyVersion: LEGACY_COURSE_COVERAGE_AUDIT_STRATEGY_VERSION,
    protocolVersion: LEGACY_COURSE_COVERAGE_AUDIT_PROTOCOL_VERSION,
    kind: 'legacy-audit-manifest',
    immutable: true,
    authority: 'AUDIT_ONLY',
    selectorAuthority: false,
    capture: {
      identityKind: asString(capture.identityKind, 'capture.identityKind'),
      gitHeads: asArray(capture.gitHeads, 'capture.gitHeads')
        .map((head, index) => asString(head, `capture.gitHeads[${index}]`)),
      worklistDigests: asArray(capture.worklistDigests, 'capture.worklistDigests')
        .map((digest, index) => asString(digest, `capture.worklistDigests[${index}]`)),
      batchCount: asNumber(capture.batchCount, 'capture.batchCount'),
      memberCount: asNumber(capture.memberCount, 'capture.memberCount'),
    },
    sourceIssueRange: {
      firstIssue: asNumber(sourceIssueRange.firstIssue, 'sourceIssueRange.firstIssue'),
      lastIssue: asNumber(sourceIssueRange.lastIssue, 'sourceIssueRange.lastIssue'),
      issueDirs,
    },
    counts: {
      batches: batchCount,
      members: memberCount,
      included,
      deferred,
      excluded,
      conflicts,
    },
    batches,
    manifestDigest: storedDigest,
    state: parseLegacyAuditState('IMMUTABLE_VALID'),
    writesAuthorityState: false,
    writesRepositoryState: false,
    writesCourseCoverageState: false,
    writesConsumerSelectorState: false,
    historicalDeferImpact: evaluateHistoricalDeferImpact({
      deferCount: deferred,
      includeCount: included,
    }),
  };
}

/**
 * Load the frozen on-disk manifest relative to repo root (or cwd).
 * Fail closed on I/O or digest mismatch.
 */
export function loadLegacyCourseCoverageAudit(options: {
  repoRoot?: string;
} = {}): LegacyAuditProvenance {
  const root = options.repoRoot ?? process.cwd();
  const absolute = path.join(root, LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_PATH);
  let raw: string;
  try {
    raw = readFileSync(absolute, 'utf8');
  } catch (error) {
    throw new LegacyAuditTamperError(
      `Legacy audit rejected: cannot read manifest at ${LEGACY_COURSE_COVERAGE_AUDIT_MANIFEST_PATH}`
      + ` (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new LegacyAuditTamperError(
      `Legacy audit rejected: manifest JSON parse failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  return readLegacyCourseCoverageAudit(parsed);
}

/**
 * Explicit non-writer API surface: callers cannot obtain a mutator.
 * Always returns the same frozen write-capability flags.
 */
export function legacyAuditWriteCapabilities(): {
  writesAuthorityState: false;
  writesRepositoryState: false;
  writesCourseCoverageState: false;
  writesConsumerSelectorState: false;
} {
  return {
    writesAuthorityState: false,
    writesRepositoryState: false,
    writesCourseCoverageState: false,
    writesConsumerSelectorState: false,
  };
}
