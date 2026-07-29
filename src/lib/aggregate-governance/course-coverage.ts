import {
  ACTIVE_COURSE_COVERAGE_ROLES,
  AGGREGATE_COURSE_COVERAGE_OVERLAY_ID,
  AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION,
  AGGREGATE_COURSE_ID,
  COURSE_COVERAGE_ROLES,
  type CourseCoverageAuthoringOverlay,
  type CourseCoverageDisposition,
  type CourseCoverageRole,
  type GovernanceMode,
} from './contracts';
import { sha256Canonical } from './hash';

const COMMIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

/** Reject unreviewed / candidate generator identities in production authoring. */
export function assertProductionReviewIdentity(
  reviewIdentity: string,
  context = 'disposition',
): void {
  const identity = reviewIdentity.trim();
  if (!identity) {
    throw new Error(`Course coverage rejected: ${context} requires review identity`);
  }
  // Case-insensitive, anywhere-in-string markers (not only prefixes).
  if (
    /candidate-generator\s*:/iu.test(identity)
    || /unreviewed/iu.test(identity)
    || /unbound/iu.test(identity)
  ) {
    throw new Error(
      `Course coverage rejected: ${context} uses non-production review identity (${identity})`,
    );
  }
}

export function assertProductionDeltaReceiptId(deltaReceiptId: string): void {
  if (!deltaReceiptId.trim()) {
    throw new Error(
      'Course coverage rejected: deltaReceiptId is required (must bind one accepted Delta Receipt)',
    );
  }
  if (/unbound/iu.test(deltaReceiptId)) {
    throw new Error(
      `Course coverage rejected: deltaReceiptId is unbound/candidate marker (${deltaReceiptId})`,
    );
  }
}

export function isCourseCoverageRole(value: string): value is CourseCoverageRole {
  return (COURSE_COVERAGE_ROLES as readonly string[]).includes(value);
}

export function isActiveCourseCoverageRole(
  value: string,
): value is (typeof ACTIVE_COURSE_COVERAGE_ROLES)[number] {
  return (ACTIVE_COURSE_COVERAGE_ROLES as readonly string[]).includes(value);
}

/** Course roles never create Teaching Projection edges. */
export function courseRoleCreatesTeachingProjectionEdge(_role: CourseCoverageRole): false {
  return false;
}

export function computeCoverageSourceHash(
  overlay: Omit<CourseCoverageAuthoringOverlay, 'sourceHash'> & { sourceHash?: string },
): string {
  const { sourceHash: _ignored, ...rest } = overlay;
  return sha256Canonical(rest);
}

export function dispositionEvidenceDigest(input: {
  canonicalId: string;
  role: CourseCoverageRole;
  rationale: string | null;
  evidenceRefs: readonly string[];
  reviewIdentity: string;
}): string {
  return sha256Canonical({
    canonicalId: input.canonicalId,
    role: input.role,
    rationale: input.rationale,
    evidenceRefs: [...input.evidenceRefs].sort(),
    reviewIdentity: input.reviewIdentity,
  });
}

export function normalizeDisposition(
  input: Omit<CourseCoverageDisposition, 'sourceEvidenceDigest'> & {
    sourceEvidenceDigest?: string;
    /** When true, allow candidate-generator identities (candidates/ only). */
    allowCandidateIdentity?: boolean;
  },
): CourseCoverageDisposition {
  if (!isCourseCoverageRole(input.role)) {
    throw new Error(`Course coverage rejected: unsupported role ${input.role}`);
  }
  // Every disposition — including active course roles — requires inspectable source evidence.
  const evidenceRefs = [...new Set(
    input.evidenceRefs
      .map((ref) => (typeof ref === 'string' ? ref.trim() : ''))
      .filter((ref) => ref.length > 0),
  )].sort();
  if (evidenceRefs.length === 0) {
    throw new Error(
      `Course coverage rejected: disposition for ${input.canonicalId} requires at least one source evidence ref`,
    );
  }
  const rationale = input.role === 'excluded_with_rationale'
    ? (input.rationale?.trim() || null)
    : (input.rationale?.trim() || null);
  if (input.role === 'excluded_with_rationale') {
    if (!rationale) {
      throw new Error(
        `Course coverage rejected: exclusion for ${input.canonicalId} requires rationale`,
      );
    }
  }
  if (!input.reviewIdentity.trim()) {
    throw new Error(
      `Course coverage rejected: disposition for ${input.canonicalId} requires review identity`,
    );
  }
  if (!input.allowCandidateIdentity) {
    assertProductionReviewIdentity(input.reviewIdentity.trim(), input.canonicalId);
  }
  const base = {
    canonicalId: input.canonicalId,
    role: input.role,
    rationale,
    evidenceRefs,
    reviewIdentity: input.reviewIdentity.trim(),
  };
  return {
    ...base,
    sourceEvidenceDigest: input.sourceEvidenceDigest
      ?? dispositionEvidenceDigest(base),
  };
}

export interface CoverageValidationResult {
  overlay: CourseCoverageAuthoringOverlay;
  entries: CourseCoverageDisposition[];
  versionId: string;
  mode: GovernanceMode;
}

/**
 * Validate exhaustive unique dispositions for baseline, or scoped entries for
 * incremental authoring patches (caller still merges with current set).
 */
export function validateCourseCoverageAuthoring(
  value: unknown,
  input: {
    currentCanonicalIds: readonly string[];
    releaseSetId: string;
    releaseId: string;
    releaseHash: string;
    sourceDatasetHash?: string | null;
    mode: 'baseline' | 'incremental';
    requireExhaustive?: boolean;
  },
): CoverageValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Course coverage rejected: authoring must be an object');
  }
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION) {
    throw new Error('Course coverage rejected: schemaVersion mismatch');
  }
  if (raw.overlayId !== AGGREGATE_COURSE_COVERAGE_OVERLAY_ID) {
    throw new Error('Course coverage rejected: overlayId mismatch');
  }
  if (raw.courseId !== AGGREGATE_COURSE_ID) {
    throw new Error('Course coverage rejected: courseId mismatch');
  }
  if (typeof raw.overlayVersion !== 'string' || !/^[1-9][0-9]*$/u.test(raw.overlayVersion)) {
    throw new Error('Course coverage rejected: overlayVersion invalid');
  }
  if (raw.releaseSetId !== input.releaseSetId || raw.releaseId !== input.releaseId) {
    throw new Error('Course coverage rejected: ReleaseSet identity drift');
  }
  if (raw.releaseHash !== input.releaseHash || !SHA256.test(String(raw.releaseHash ?? ''))) {
    throw new Error('Course coverage rejected: releaseHash drift');
  }
  if (
    input.sourceDatasetHash != null
    && raw.sourceDatasetHash != null
    && raw.sourceDatasetHash !== input.sourceDatasetHash
  ) {
    throw new Error('Course coverage rejected: sourceDatasetHash drift');
  }
  if (typeof raw.authoringRevision !== 'string' || !COMMIT.test(raw.authoringRevision)) {
    throw new Error('Course coverage rejected: authoringRevision invalid');
  }
  if (typeof raw.deltaReceiptId !== 'string') {
    throw new Error(
      'Course coverage rejected: deltaReceiptId is required (must bind one accepted Delta Receipt)',
    );
  }
  assertProductionDeltaReceiptId(raw.deltaReceiptId);
  if (!Array.isArray(raw.entries)) {
    throw new Error('Course coverage rejected: entries must be an array');
  }

  const entries = raw.entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Course coverage rejected: entry[${index}] invalid`);
    }
    const row = entry as Record<string, unknown>;
    return normalizeDisposition({
      canonicalId: String(row.canonicalId ?? ''),
      role: String(row.role ?? '') as CourseCoverageRole,
      rationale: row.rationale == null ? null : String(row.rationale),
      evidenceRefs: Array.isArray(row.evidenceRefs)
        ? row.evidenceRefs.map(String)
        : [],
      reviewIdentity: String(row.reviewIdentity ?? ''),
      sourceEvidenceDigest: row.sourceEvidenceDigest == null
        ? undefined
        : String(row.sourceEvidenceDigest),
    });
  });

  const byCanonical = new Map<string, CourseCoverageDisposition>();
  for (const entry of entries) {
    if (!entry.canonicalId) {
      throw new Error('Course coverage rejected: empty canonicalId');
    }
    if (byCanonical.has(entry.canonicalId)) {
      throw new Error(
        `Course coverage rejected: duplicate disposition for ${entry.canonicalId}`,
      );
    }
    byCanonical.set(entry.canonicalId, entry);
  }

  const current = new Set(input.currentCanonicalIds);
  for (const canonicalId of byCanonical.keys()) {
    if (!current.has(canonicalId)) {
      throw new Error(
        `Course coverage rejected: disposition references missing object ${canonicalId}`,
      );
    }
  }

  const exhaustive = input.requireExhaustive ?? input.mode === 'baseline';
  if (exhaustive) {
    const missing = [...current].filter((id) => !byCanonical.has(id)).sort();
    if (missing.length > 0) {
      throw new Error(
        `Course coverage rejected: baseline missing dispositions for ${missing.length} objects (first=${missing[0]})`,
      );
    }
  }

  const sorted = [...byCanonical.values()].sort((a, b) => (
    a.canonicalId.localeCompare(b.canonicalId)
  ));
  const overlayWithoutHash: Omit<CourseCoverageAuthoringOverlay, 'sourceHash'> = {
    schemaVersion: AGGREGATE_COURSE_COVERAGE_SCHEMA_VERSION,
    overlayId: AGGREGATE_COURSE_COVERAGE_OVERLAY_ID,
    overlayVersion: String(raw.overlayVersion),
    courseId: AGGREGATE_COURSE_ID,
    releaseSetId: String(raw.releaseSetId),
    releaseId: String(raw.releaseId),
    releaseHash: String(raw.releaseHash),
    sourceDatasetHash: raw.sourceDatasetHash == null ? null : String(raw.sourceDatasetHash),
    deltaReceiptId: String(raw.deltaReceiptId),
    mode: input.mode,
    authoringRevision: String(raw.authoringRevision),
    entries: sorted,
  };
  const sourceHash = computeCoverageSourceHash(overlayWithoutHash);
  if (raw.sourceHash !== sourceHash) {
    throw new Error('Course coverage rejected: source hash drift');
  }
  const overlay: CourseCoverageAuthoringOverlay = {
    ...overlayWithoutHash,
    sourceHash,
  };
  return {
    overlay,
    entries: sorted,
    versionId: `${overlay.overlayId}@${overlay.overlayVersion}`,
    mode: input.mode,
  };
}

export function mergeIncrementalCoverage(input: {
  current: readonly CourseCoverageDisposition[];
  patch: readonly CourseCoverageDisposition[];
  invalidateCanonicalIds: readonly string[];
  currentCanonicalIds: readonly string[];
}): CourseCoverageDisposition[] {
  const invalidated = new Set(input.invalidateCanonicalIds);
  const next = new Map<string, CourseCoverageDisposition>();
  for (const row of input.current) {
    if (invalidated.has(row.canonicalId)) continue;
    if (!input.currentCanonicalIds.includes(row.canonicalId)) continue;
    next.set(row.canonicalId, row);
  }
  for (const row of input.patch) {
    next.set(row.canonicalId, normalizeDisposition(row));
  }
  const missing = input.currentCanonicalIds.filter((id) => !next.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Course coverage rejected: incremental merge leaves uncovered objects (first=${missing[0]})`,
    );
  }
  return [...next.values()].sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
}

export function admittedCanonicalIds(
  entries: readonly CourseCoverageDisposition[],
): string[] {
  return entries
    .filter((entry) => isActiveCourseCoverageRole(entry.role))
    .map((entry) => entry.canonicalId)
    .sort((a, b) => a.localeCompare(b));
}

export function buildDispositionFromReview(input: {
  canonicalId: string;
  role: CourseCoverageRole;
  rationale?: string | null;
  evidenceRefs?: readonly string[];
  reviewIdentity: string;
  allowCandidateIdentity?: boolean;
}): CourseCoverageDisposition {
  return normalizeDisposition({
    canonicalId: input.canonicalId,
    role: input.role,
    rationale: input.rationale ?? null,
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    reviewIdentity: input.reviewIdentity,
    allowCandidateIdentity: input.allowCandidateIdentity,
  });
}
