/**
 * Capability brands + verified pinned context for KAQ authority (#1113).
 *
 * Runtime brands are module-private Symbols. Production mint factories are NOT
 * exported. Only:
 * - loadKaqPinnedContextFromDb (server path, dynamic prisma import)
 * - *ForTests helpers (runtime-guarded to VITEST/NODE_ENV=test)
 * may mint branded evidence / verified pinned context.
 */

import { createHash } from 'node:crypto';

import { ACTIVE_COURSE_COVERAGE_ROLES } from '@/lib/aggregate-governance/contracts';

import {
  PINNED_KAQ_AGGREGATE_RELEASE_ID,
  PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
  PINNED_KAQ_COVERAGE_OVERLAY_ID,
  type KaqCanonicalPinnedContext,
  type KaqCanonicalPinnedContextFields,
} from './contracts';
import {
  assertKaqPinnedContextFingerprint,
  buildKaqPinnedContext,
  KaqPinnedContextError,
} from './pinned-context';

/**
 * Selector for AggregateCourseCoverageVersion. Field-compatible with the legacy
 * CourseCoverageSelector shape, but authority is #1126 aggregate coverage +
 * AggregateGovernanceReceipt — not CourseCoverageOverlayVersion.
 */
export type KaqAggregateCoverageSelector = {
  courseId: string;
  overlayId: string;
  overlayVersion: string;
  releaseSetId: string;
  releaseId: string;
};

/**
 * Raw aggregate coverage + governance identity closed against an accepted Delta.
 * Not a branded capability — private mint + server loader only.
 */
export type AggregateCoverageAuthoritySource = {
  selector: KaqAggregateCoverageSelector;
  version: {
    id: string;
    courseId: string;
    overlayId: string;
    overlayVersion: string;
    releaseSetId: string;
    releaseId: string;
    releaseHash: string;
    sourceDatasetHash: string | null;
    deltaReceiptId: string;
    authoringRevision: string;
    captureRevision: string;
    sourceHash: string;
    lifecycleState: string;
  };
  entries: ReadonlyArray<{
    canonicalId: string;
    role: string;
    ordinal: number;
    lifecycleState: string;
  }>;
  governance: {
    id: string;
    coverageVersionId: string | null;
    releaseSetId: string;
    releaseId: string;
    releaseHash: string;
    sourceDatasetHash: string | null;
    deltaReceiptId: string;
    deltaOutputDigest: string;
    deltaCaptureRevision: string;
    coverageSourceHash: string | null;
    captureRevision: string;
    authoringRevision: string | null;
    authorityState: string;
    productionAuthoritative: boolean;
  };
};

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;

const ACCEPTED_DELTA_BRAND = Symbol('kaq.accepted-delta-evidence');
const VERIFIED_COVERAGE_BRAND = Symbol('kaq.verified-course-coverage');
const FORMAL_TP_PROOF_BRAND = Symbol('kaq.formal-teaching-projection-proof');
const VERIFIED_PINNED_BRAND = Symbol('kaq.verified-pinned-context');

/**
 * Instance provenance registries. Symbol brand alone is not sufficient:
 * callers holding a legitimate capability can reflect Symbols and copy them
 * onto clones. Only exact sealed instances registered at mint time pass assert.
 * Not exported.
 */
const ACCEPTED_DELTA_REGISTRY = new WeakSet<object>();
const VERIFIED_COVERAGE_REGISTRY = new WeakSet<object>();
const VERIFIED_PINNED_REGISTRY = new WeakSet<object>();
const FORMAL_TP_PROOF_REGISTRY = new WeakSet<object>();

export const ACCEPTED_DELTA_RECEIPT_EVIDENCE_VERSION =
  'act-accepted-delta-receipt-evidence/v1' as const;
export const FORMAL_TEACHING_PROJECTION_PROOF_VERSION =
  'act-formal-teaching-projection-proof/v1' as const;
export const VERIFIED_COURSE_COVERAGE_BUNDLE_VERSION =
  'act-verified-course-coverage-bundle/v1' as const;

const ACTIVE_COVERAGE_ROLE_SET = new Set<string>(ACTIVE_COURSE_COVERAGE_ROLES);

/**
 * Attach a non-enumerable, non-writable, non-configurable capability brand.
 * Object spread / Object.assign will not copy this property.
 */
function sealCapabilityBrand<T extends object>(
  target: T,
  brand: symbol,
): T {
  Object.defineProperty(target, brand, {
    value: brand,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return target;
}

/**
 * Deep-freeze plain objects and arrays reachable from a capability object.
 * Minimal and local — not a repository-wide utility.
 */
function deepFreezeCapability<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  const obj = value as object;
  for (const key of Reflect.ownKeys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (!desc || !('value' in desc)) continue;
    const child = desc.value;
    if (child !== null && typeof child === 'object') {
      deepFreezeCapability(child);
    }
  }
  return Object.freeze(value);
}

/**
 * Seal brand, freeze, and register the exact instance for provenance.
 * Registry membership is the authoritative runtime capability proof.
 */
function sealFreezeAndRegisterCapability<T extends object>(
  target: T,
  brand: symbol,
  registry: WeakSet<object>,
): T {
  sealCapabilityBrand(target, brand);
  deepFreezeCapability(target);
  registry.add(target);
  return target;
}

function assertRegisteredCapability(
  value: object,
  registry: WeakSet<object>,
  unbrandedCode: KaqAuthorityInputError['code'],
  message: string,
): void {
  if (!registry.has(value)) {
    throw new KaqAuthorityInputError(
      unbrandedCode,
      `${message} (reflected/copied brand without mint registration is rejected)`,
    );
  }
}

export class KaqAuthorityInputError extends Error {
  readonly code:
    | 'delta-missing'
    | 'delta-not-accepted'
    | 'delta-identity-mismatch'
    | 'delta-format-invalid'
    | 'delta-unbranded'
    | 'coverage-not-available'
    | 'coverage-identity-mismatch'
    | 'coverage-format-invalid'
    | 'coverage-unbranded'
    | 'teaching-proof-invalid'
    | 'teaching-proof-mismatch'
    | 'teaching-proof-unbranded'
    | 'teaching-projection-not-released'
    | 'pinned-unbranded'
    | 'test-only-mint';

  constructor(code: KaqAuthorityInputError['code'], message: string) {
    super(message);
    this.name = 'KaqAuthorityInputError';
    this.code = code;
  }
}

export type AcceptedDeltaReceiptEvidence = {
  readonly [ACCEPTED_DELTA_BRAND]: typeof ACCEPTED_DELTA_BRAND;
  schemaVersion: typeof ACCEPTED_DELTA_RECEIPT_EVIDENCE_VERSION;
  id: string;
  authorizationState: 'ACCEPTED';
  candidateReleaseSetId: string;
  candidateReleaseId: string;
  candidateReleaseHash: string;
  candidateSourceDatasetHash: string;
  outputDigest: string;
  captureRevision: string;
};

export type VerifiedCourseCoverageBundle = {
  readonly [VERIFIED_COVERAGE_BRAND]: typeof VERIFIED_COVERAGE_BRAND;
  schemaVersion: typeof VERIFIED_COURSE_COVERAGE_BUNDLE_VERSION;
  selector: KaqAggregateCoverageSelector;
  /**
   * Aggregate CourseCoverage + AggregateGovernanceReceipt identity.
   * Does not invent legacy overlay lock hashes or overlay-version table evidence.
   */
  identity: {
    coverageVersionId: string;
    courseId: string;
    overlayId: string;
    overlayVersion: string;
    authoringRevision: string;
    captureRevision: string;
    sourceHash: string;
    releaseSetId: string;
    releaseId: string;
    releaseHash: string;
    sourceDatasetHash: string;
    deltaReceiptId: string;
    governanceReceiptId: string;
    authorityState: 'SHADOW';
    productionAuthoritative: false;
  };
  entries: Array<{
    canonicalId: string;
    role: string;
    ordinal: number;
    lifecycleState: 'CURRENT';
  }>;
  admittedCanonicalIds: readonly string[];
};

export type FormalTeachingProjectionProof = {
  readonly [FORMAL_TP_PROOF_BRAND]: typeof FORMAL_TP_PROOF_BRAND;
  schemaVersion: typeof FORMAL_TEACHING_PROJECTION_PROOF_VERSION;
  proofKind: 'FORMAL_ACTKG_TEACHING_PROJECTION_RELEASE';
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  pinnedContextDigest: string;
  projectionId: string;
  projectionDigest: string;
  formalReleaseAttestationId: string;
  formalReleaseAttestationDigest: string;
  proofDigest: string;
};

/**
 * Opaque verified pinned context — the only pinned type consumer entry points
 * may accept. Raw `buildKaqPinnedContext()` output lacks this brand.
 */
export type VerifiedKaqPinnedContext = KaqCanonicalPinnedContext & {
  readonly [VERIFIED_PINNED_BRAND]: typeof VERIFIED_PINNED_BRAND;
};

function assertTestOnly(label: string): void {
  const isTest = process.env.VITEST === 'true'
    || process.env.NODE_ENV === 'test'
    || typeof process.env.VITEST_WORKER_ID === 'string';
  if (!isTest) {
    throw new KaqAuthorityInputError(
      'test-only-mint',
      `${label} is test-only and cannot mint capability brands in production`,
    );
  }
}

function validateDeltaFields(raw: {
  id: string;
  authorizationState: string;
  candidateReleaseSetId: string;
  candidateReleaseId: string;
  candidateReleaseHash: string;
  candidateSourceDatasetHash: string;
  outputDigest: string;
  captureRevision: string;
}): Omit<AcceptedDeltaReceiptEvidence, typeof ACCEPTED_DELTA_BRAND> {
  if (raw.authorizationState !== 'ACCEPTED') {
    throw new KaqAuthorityInputError(
      'delta-not-accepted',
      `Delta receipt authorizationState must be ACCEPTED (got ${raw.authorizationState})`,
    );
  }
  const id = raw.id.trim();
  if (!id || /unbound/iu.test(id)) {
    throw new KaqAuthorityInputError('delta-format-invalid', 'Delta receipt id is missing or unbound');
  }
  if (raw.candidateReleaseSetId !== PINNED_KAQ_AGGREGATE_RELEASE_SET_ID) {
    throw new KaqAuthorityInputError(
      'delta-identity-mismatch',
      `Delta candidateReleaseSetId is not pinned aggregate (${raw.candidateReleaseSetId})`,
    );
  }
  if (raw.candidateReleaseId !== PINNED_KAQ_AGGREGATE_RELEASE_ID) {
    throw new KaqAuthorityInputError(
      'delta-identity-mismatch',
      `Delta candidateReleaseId is not pinned aggregate (${raw.candidateReleaseId})`,
    );
  }
  if (!SHA256.test(raw.candidateReleaseHash)) {
    throw new KaqAuthorityInputError(
      'delta-format-invalid',
      'candidateReleaseHash must be 64-char lowercase sha256 hex',
    );
  }
  if (!SHA256.test(raw.candidateSourceDatasetHash)) {
    throw new KaqAuthorityInputError(
      'delta-format-invalid',
      'candidateSourceDatasetHash must be 64-char lowercase sha256 hex',
    );
  }
  if (!SHA256.test(raw.outputDigest)) {
    throw new KaqAuthorityInputError(
      'delta-format-invalid',
      'outputDigest must be 64-char lowercase sha256 hex',
    );
  }
  if (!GIT_COMMIT.test(raw.captureRevision)) {
    throw new KaqAuthorityInputError(
      'delta-format-invalid',
      'captureRevision must be a 40-char git commit',
    );
  }
  return {
    schemaVersion: ACCEPTED_DELTA_RECEIPT_EVIDENCE_VERSION,
    id,
    authorizationState: 'ACCEPTED',
    candidateReleaseSetId: raw.candidateReleaseSetId,
    candidateReleaseId: raw.candidateReleaseId,
    candidateReleaseHash: raw.candidateReleaseHash,
    candidateSourceDatasetHash: raw.candidateSourceDatasetHash,
    outputDigest: raw.outputDigest,
    captureRevision: raw.captureRevision,
  };
}

/** Private mint — not exported. */
function mintAcceptedDeltaReceiptEvidence(raw: {
  id: string;
  authorizationState: string;
  candidateReleaseSetId: string;
  candidateReleaseId: string;
  candidateReleaseHash: string;
  candidateSourceDatasetHash: string;
  outputDigest: string;
  captureRevision: string;
}): AcceptedDeltaReceiptEvidence {
  const fields = validateDeltaFields(raw);
  const obj = { ...fields } as unknown as AcceptedDeltaReceiptEvidence;
  return sealFreezeAndRegisterCapability(obj, ACCEPTED_DELTA_BRAND, ACCEPTED_DELTA_REGISTRY);
}

export function assertAcceptedDeltaReceiptEvidence(
  value: unknown,
): AcceptedDeltaReceiptEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KaqAuthorityInputError('delta-missing', 'Accepted Delta receipt evidence is required');
  }
  const record = value as Record<PropertyKey, unknown>;
  if (record[ACCEPTED_DELTA_BRAND] !== ACCEPTED_DELTA_BRAND) {
    throw new KaqAuthorityInputError(
      'delta-unbranded',
      'Accepted Delta evidence is unbranded or forged (must be minted by server loader)',
    );
  }
  assertRegisteredCapability(
    value,
    ACCEPTED_DELTA_REGISTRY,
    'delta-unbranded',
    'Accepted Delta evidence is not a mint-registered instance',
  );
  // Re-validate claimed fields on the same branded object; do not remint/rebrand.
  validateDeltaFields({
    id: String(record.id ?? ''),
    authorizationState: String(record.authorizationState ?? ''),
    candidateReleaseSetId: String(record.candidateReleaseSetId ?? ''),
    candidateReleaseId: String(record.candidateReleaseId ?? ''),
    candidateReleaseHash: String(record.candidateReleaseHash ?? ''),
    candidateSourceDatasetHash: String(record.candidateSourceDatasetHash ?? ''),
    outputDigest: String(record.outputDigest ?? ''),
    captureRevision: String(record.captureRevision ?? ''),
  });
  return value as AcceptedDeltaReceiptEvidence;
}

/**
 * Active CourseCoverage roles only (formal_objective / necessary_prerequisite /
 * explicit_extension). excluded_with_rationale never admits.
 */
export function admittedCanonicalIdsFromCoverageEntries(
  entries: readonly { canonicalId: string; role: string }[],
): string[] {
  return [...new Set(
    entries
      .filter((entry) => ACTIVE_COVERAGE_ROLE_SET.has(entry.role))
      .map((entry) => entry.canonicalId),
  )].sort();
}

function validateAggregateCoverageAgainstDelta(
  source: AggregateCoverageAuthoritySource,
  delta: AcceptedDeltaReceiptEvidence,
): {
  selector: KaqAggregateCoverageSelector;
  identity: VerifiedCourseCoverageBundle['identity'];
  entries: VerifiedCourseCoverageBundle['entries'];
  admittedCanonicalIds: string[];
} {
  const { selector, version, entries, governance } = source;

  if (version.lifecycleState !== 'CURRENT') {
    throw new KaqAuthorityInputError(
      'coverage-not-available',
      `AggregateCourseCoverageVersion lifecycleState must be CURRENT (got ${version.lifecycleState})`,
    );
  }
  if (selector.overlayId !== PINNED_KAQ_COVERAGE_OVERLAY_ID) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      `CourseCoverage overlayId is not aggregate overlay (${selector.overlayId})`,
    );
  }
  if (
    selector.courseId !== version.courseId
    || selector.overlayId !== version.overlayId
    || selector.overlayVersion !== version.overlayVersion
    || selector.releaseSetId !== version.releaseSetId
    || selector.releaseId !== version.releaseId
  ) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateCourseCoverageVersion does not match coverageSelector',
    );
  }
  if (
    version.releaseSetId !== delta.candidateReleaseSetId
    || version.releaseId !== delta.candidateReleaseId
    || version.releaseHash !== delta.candidateReleaseHash
    || version.deltaReceiptId !== delta.id
  ) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateCourseCoverageVersion Release/Delta identity does not match accepted Delta',
    );
  }
  const versionSourceDatasetHash = version.sourceDatasetHash?.trim() ?? '';
  if (!SHA256.test(versionSourceDatasetHash)) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'AggregateCourseCoverageVersion.sourceDatasetHash must be 64-char lowercase sha256 hex',
    );
  }
  if (versionSourceDatasetHash !== delta.candidateSourceDatasetHash) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateCourseCoverageVersion.sourceDatasetHash does not match accepted Delta',
    );
  }
  if (!SHA256.test(version.sourceHash)) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'AggregateCourseCoverageVersion.sourceHash must be 64-char lowercase sha256 hex',
    );
  }
  if (!GIT_COMMIT.test(version.authoringRevision)) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'AggregateCourseCoverageVersion.authoringRevision must be a 40-char git commit',
    );
  }
  if (!GIT_COMMIT.test(version.captureRevision)) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'AggregateCourseCoverageVersion.captureRevision must be a 40-char git commit',
    );
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'AggregateCourseCoverage requires non-empty CURRENT entries',
    );
  }
  const currentEntries: VerifiedCourseCoverageBundle['entries'] = [];
  const seenOrdinals = new Set<number>();
  for (const entry of entries) {
    if (entry.lifecycleState !== 'CURRENT') {
      throw new KaqAuthorityInputError(
        'coverage-format-invalid',
        `AggregateCourseCoverageEntry lifecycleState must be CURRENT (got ${entry.lifecycleState})`,
      );
    }
    if (!entry.canonicalId?.trim()) {
      throw new KaqAuthorityInputError(
        'coverage-format-invalid',
        'AggregateCourseCoverageEntry missing canonicalId',
      );
    }
    if (!Number.isInteger(entry.ordinal) || entry.ordinal < 0) {
      throw new KaqAuthorityInputError(
        'coverage-format-invalid',
        'AggregateCourseCoverageEntry ordinal must be a non-negative integer',
      );
    }
    if (seenOrdinals.has(entry.ordinal)) {
      throw new KaqAuthorityInputError(
        'coverage-format-invalid',
        `Duplicate AggregateCourseCoverageEntry ordinal ${entry.ordinal}`,
      );
    }
    seenOrdinals.add(entry.ordinal);
    if (!entry.role?.trim()) {
      throw new KaqAuthorityInputError(
        'coverage-format-invalid',
        'AggregateCourseCoverageEntry missing role',
      );
    }
    currentEntries.push({
      canonicalId: entry.canonicalId,
      role: entry.role,
      ordinal: entry.ordinal,
      lifecycleState: 'CURRENT',
    });
  }

  const admittedCanonicalIds = admittedCanonicalIdsFromCoverageEntries(currentEntries);
  if (admittedCanonicalIds.length === 0) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'CourseCoverage has no active admitted roles (excluded-only is not admitted)',
    );
  }

  // Governance receipt must bind the same coverage version + accepted Delta and
  // remain SHADOW / non-production authoritative.
  if (!governance.id?.trim()) {
    throw new KaqAuthorityInputError(
      'coverage-not-available',
      'AggregateGovernanceReceipt is required for aggregate CourseCoverage authority',
    );
  }
  if (governance.coverageVersionId !== version.id) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateGovernanceReceipt.coverageVersionId does not match coverage version',
    );
  }
  if (
    governance.releaseSetId !== delta.candidateReleaseSetId
    || governance.releaseId !== delta.candidateReleaseId
    || governance.releaseHash !== delta.candidateReleaseHash
    || governance.deltaReceiptId !== delta.id
  ) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateGovernanceReceipt Release/Delta identity does not match accepted Delta',
    );
  }
  const governanceSourceDatasetHash = governance.sourceDatasetHash?.trim() ?? '';
  if (
    !SHA256.test(governanceSourceDatasetHash)
    || governanceSourceDatasetHash !== delta.candidateSourceDatasetHash
  ) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateGovernanceReceipt.sourceDatasetHash does not match accepted Delta',
    );
  }
  if (governance.deltaOutputDigest !== delta.outputDigest) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateGovernanceReceipt.deltaOutputDigest does not match accepted Delta',
    );
  }
  if (governance.deltaCaptureRevision !== delta.captureRevision) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateGovernanceReceipt.deltaCaptureRevision does not match accepted Delta',
    );
  }
  const coverageSourceHash = governance.coverageSourceHash?.trim() ?? '';
  if (!SHA256.test(coverageSourceHash) || coverageSourceHash !== version.sourceHash) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateGovernanceReceipt.coverageSourceHash does not match coverage version',
    );
  }
  if (governance.captureRevision !== version.captureRevision) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateGovernanceReceipt.captureRevision does not match coverage version',
    );
  }
  const governanceAuthoring = governance.authoringRevision?.trim() ?? '';
  if (!GIT_COMMIT.test(governanceAuthoring) || governanceAuthoring !== version.authoringRevision) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'AggregateGovernanceReceipt.authoringRevision does not match coverage version',
    );
  }
  if (governance.authorityState !== 'SHADOW') {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      `AggregateGovernanceReceipt.authorityState must be SHADOW (got ${governance.authorityState})`,
    );
  }
  if (governance.productionAuthoritative !== false) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'AggregateGovernanceReceipt.productionAuthoritative must be false for shadow KAQ',
    );
  }

  return {
    selector: { ...selector },
    identity: {
      coverageVersionId: version.id,
      courseId: version.courseId,
      overlayId: version.overlayId,
      overlayVersion: version.overlayVersion,
      authoringRevision: version.authoringRevision,
      captureRevision: version.captureRevision,
      sourceHash: version.sourceHash,
      releaseSetId: version.releaseSetId,
      releaseId: version.releaseId,
      releaseHash: version.releaseHash,
      sourceDatasetHash: versionSourceDatasetHash,
      deltaReceiptId: version.deltaReceiptId,
      governanceReceiptId: governance.id,
      authorityState: 'SHADOW',
      productionAuthoritative: false,
    },
    entries: currentEntries,
    admittedCanonicalIds,
  };
}

function mintVerifiedCourseCoverageBundle(input: {
  coverage: AggregateCoverageAuthoritySource;
  delta: AcceptedDeltaReceiptEvidence;
}): VerifiedCourseCoverageBundle {
  const delta = assertAcceptedDeltaReceiptEvidence(input.delta);
  const closed = validateAggregateCoverageAgainstDelta(input.coverage, delta);
  const obj = {
    schemaVersion: VERIFIED_COURSE_COVERAGE_BUNDLE_VERSION,
    selector: { ...closed.selector },
    identity: { ...closed.identity },
    entries: closed.entries.map((entry) => ({ ...entry })),
    admittedCanonicalIds: [...closed.admittedCanonicalIds],
  } as unknown as VerifiedCourseCoverageBundle;
  return sealFreezeAndRegisterCapability(obj, VERIFIED_COVERAGE_BRAND, VERIFIED_COVERAGE_REGISTRY);
}

export function assertVerifiedCourseCoverageBundle(
  value: unknown,
): VerifiedCourseCoverageBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KaqAuthorityInputError(
      'coverage-not-available',
      'Verified CourseCoverage bundle is required',
    );
  }
  const record = value as Record<PropertyKey, unknown>;
  if (record[VERIFIED_COVERAGE_BRAND] !== VERIFIED_COVERAGE_BRAND) {
    throw new KaqAuthorityInputError(
      'coverage-unbranded',
      'CourseCoverage bundle is unbranded or forged (must be minted by server loader)',
    );
  }
  assertRegisteredCapability(
    value,
    VERIFIED_COVERAGE_REGISTRY,
    'coverage-unbranded',
    'CourseCoverage bundle is not a mint-registered instance',
  );
  if (record.schemaVersion !== VERIFIED_COURSE_COVERAGE_BUNDLE_VERSION) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'Verified CourseCoverage schemaVersion mismatch',
    );
  }
  // Re-check admitted set excludes non-active roles if entries present.
  const entries = Array.isArray(record.entries)
    ? (record.entries as Array<{ canonicalId: string; role: string }>)
    : [];
  const expectedAdmitted = admittedCanonicalIdsFromCoverageEntries(entries);
  const claimed = Array.isArray(record.admittedCanonicalIds)
    ? [...(record.admittedCanonicalIds as string[])].sort().join('\0')
    : '';
  if (claimed !== expectedAdmitted.join('\0')) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'Verified CourseCoverage admittedCanonicalIds does not match active roles only',
    );
  }
  const identity = record.identity as VerifiedCourseCoverageBundle['identity'] | undefined;
  if (
    !identity
    || identity.authorityState !== 'SHADOW'
    || identity.productionAuthoritative !== false
  ) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'Verified CourseCoverage identity must be SHADOW / non-production aggregate authority',
    );
  }
  // Return the same branded instance; never remint/rebrand.
  return value as VerifiedCourseCoverageBundle;
}

function mintVerifiedKaqPinnedContext(
  fields: KaqCanonicalPinnedContextFields,
): VerifiedKaqPinnedContext {
  const base = buildKaqPinnedContext(fields);
  const obj = {
    ...base,
    admittedCanonicalIds: [...base.admittedCanonicalIds],
  } as unknown as VerifiedKaqPinnedContext;
  return sealFreezeAndRegisterCapability(obj, VERIFIED_PINNED_BRAND, VERIFIED_PINNED_REGISTRY);
}

export function assertVerifiedKaqPinnedContext(
  value: unknown,
): VerifiedKaqPinnedContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KaqAuthorityInputError(
      'pinned-unbranded',
      'Verified KAQ pinned context is required',
    );
  }
  const record = value as Record<PropertyKey, unknown>;
  if (record[VERIFIED_PINNED_BRAND] !== VERIFIED_PINNED_BRAND) {
    throw new KaqAuthorityInputError(
      'pinned-unbranded',
      'KAQ pinned context is unbranded or forged (raw buildKaqPinnedContext output is not accepted)',
    );
  }
  assertRegisteredCapability(
    value,
    VERIFIED_PINNED_REGISTRY,
    'pinned-unbranded',
    'KAQ pinned context is not a mint-registered instance',
  );
  // Fingerprint re-validates field formats and contextDigest integrity on the
  // same object; do not remint (which would re-attach an enumerable brand via spread).
  assertKaqPinnedContextFingerprint(value as KaqCanonicalPinnedContext);
  return value as VerifiedKaqPinnedContext;
}

export function buildKaqPinnedContextFromVerifiedAuthority(input: {
  delta: AcceptedDeltaReceiptEvidence;
  coverage: VerifiedCourseCoverageBundle;
}): VerifiedKaqPinnedContext {
  const delta = assertAcceptedDeltaReceiptEvidence(input.delta);
  const coverage = assertVerifiedCourseCoverageBundle(input.coverage);
  return mintVerifiedKaqPinnedContext({
    releaseSetId: delta.candidateReleaseSetId,
    releaseId: delta.candidateReleaseId,
    releaseHash: delta.candidateReleaseHash,
    sourceDatasetHash: delta.candidateSourceDatasetHash,
    deltaReceiptId: delta.id,
    coverageOverlayId: coverage.selector.overlayId,
    coverageOverlayVersion: coverage.selector.overlayVersion,
    coverageSourceHash: coverage.identity.sourceHash,
    coverageCaptureRevision: coverage.identity.captureRevision,
    admittedCanonicalIds: coverage.admittedCanonicalIds,
  });
}

function teachingProofFields(
  proof: Omit<FormalTeachingProjectionProof, typeof FORMAL_TP_PROOF_BRAND | 'proofDigest'>,
): string {
  return [
    `schemaVersion=${proof.schemaVersion}`,
    `proofKind=${proof.proofKind}`,
    `releaseSetId=${proof.releaseSetId}`,
    `releaseId=${proof.releaseId}`,
    `releaseHash=${proof.releaseHash}`,
    `pinnedContextDigest=${proof.pinnedContextDigest}`,
    `projectionId=${proof.projectionId}`,
    `projectionDigest=${proof.projectionDigest}`,
    `formalReleaseAttestationId=${proof.formalReleaseAttestationId}`,
    `formalReleaseAttestationDigest=${proof.formalReleaseAttestationDigest}`,
  ].join('\n');
}

function computeProofDigest(
  proof: Omit<FormalTeachingProjectionProof, typeof FORMAL_TP_PROOF_BRAND | 'proofDigest'>,
): string {
  return createHash('sha256').update(teachingProofFields(proof), 'utf8').digest('hex');
}

function mintFormalTeachingProjectionProof(input: {
  pinned: VerifiedKaqPinnedContext;
  projectionId: string;
  projectionDigest: string;
  formalReleaseAttestationId: string;
  formalReleaseAttestationDigest: string;
}): FormalTeachingProjectionProof {
  const pinned = assertVerifiedKaqPinnedContext(input.pinned);
  if (!input.projectionId.trim()) {
    throw new KaqAuthorityInputError('teaching-proof-invalid', 'projectionId required');
  }
  if (!SHA256.test(input.projectionDigest)) {
    throw new KaqAuthorityInputError(
      'teaching-proof-invalid',
      'projectionDigest must be 64-char lowercase sha256 hex',
    );
  }
  if (!input.formalReleaseAttestationId.trim()) {
    throw new KaqAuthorityInputError(
      'teaching-proof-invalid',
      'formalReleaseAttestationId required',
    );
  }
  if (!SHA256.test(input.formalReleaseAttestationDigest)) {
    throw new KaqAuthorityInputError(
      'teaching-proof-invalid',
      'formalReleaseAttestationDigest must be 64-char lowercase sha256 hex',
    );
  }
  const base = {
    schemaVersion: FORMAL_TEACHING_PROJECTION_PROOF_VERSION,
    proofKind: 'FORMAL_ACTKG_TEACHING_PROJECTION_RELEASE' as const,
    releaseSetId: pinned.releaseSetId,
    releaseId: pinned.releaseId,
    releaseHash: pinned.releaseHash,
    pinnedContextDigest: pinned.contextDigest,
    projectionId: input.projectionId.trim(),
    projectionDigest: input.projectionDigest,
    formalReleaseAttestationId: input.formalReleaseAttestationId.trim(),
    formalReleaseAttestationDigest: input.formalReleaseAttestationDigest,
  };
  const obj = {
    ...base,
    proofDigest: computeProofDigest(base),
  } as unknown as FormalTeachingProjectionProof;
  return sealFreezeAndRegisterCapability(obj, FORMAL_TP_PROOF_BRAND, FORMAL_TP_PROOF_REGISTRY);
}

export function assertFormalTeachingProjectionProof(
  value: unknown,
  pinned: VerifiedKaqPinnedContext,
): FormalTeachingProjectionProof {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KaqAuthorityInputError('teaching-proof-invalid', 'Teaching Projection proof is required');
  }
  const raw = value as Record<PropertyKey, unknown>;
  if (raw[FORMAL_TP_PROOF_BRAND] !== FORMAL_TP_PROOF_BRAND) {
    throw new KaqAuthorityInputError(
      'teaching-proof-unbranded',
      'Teaching Projection proof is unbranded or forged (must be minted by server loader)',
    );
  }
  assertRegisteredCapability(
    value,
    FORMAL_TP_PROOF_REGISTRY,
    'teaching-proof-unbranded',
    'Teaching Projection proof is not a mint-registered instance',
  );
  const closedPinned = assertVerifiedKaqPinnedContext(pinned);

  if (raw.schemaVersion !== FORMAL_TEACHING_PROJECTION_PROOF_VERSION) {
    throw new KaqAuthorityInputError('teaching-proof-invalid', 'Teaching proof schemaVersion mismatch');
  }
  if (raw.proofKind !== 'FORMAL_ACTKG_TEACHING_PROJECTION_RELEASE') {
    throw new KaqAuthorityInputError('teaching-proof-invalid', 'Teaching proofKind is not formal release');
  }

  const releaseSetId = String(raw.releaseSetId ?? '');
  const releaseId = String(raw.releaseId ?? '');
  const releaseHash = String(raw.releaseHash ?? '');
  const pinnedContextDigest = String(raw.pinnedContextDigest ?? '');
  const projectionId = String(raw.projectionId ?? '');
  const projectionDigest = String(raw.projectionDigest ?? '');
  const formalReleaseAttestationId = String(raw.formalReleaseAttestationId ?? '');
  const formalReleaseAttestationDigest = String(raw.formalReleaseAttestationDigest ?? '');
  const claimedProofDigest = String(raw.proofDigest ?? '');

  if (
    releaseSetId !== closedPinned.releaseSetId
    || releaseId !== closedPinned.releaseId
    || releaseHash !== closedPinned.releaseHash
    || pinnedContextDigest !== closedPinned.contextDigest
  ) {
    throw new KaqAuthorityInputError(
      'teaching-proof-mismatch',
      'Teaching proof Release/pinned identity does not match verified pinned context',
    );
  }
  if (!projectionId.trim() || !SHA256.test(projectionDigest)) {
    throw new KaqAuthorityInputError(
      'teaching-proof-invalid',
      'Teaching proof projection identity invalid',
    );
  }
  if (!formalReleaseAttestationId.trim() || !SHA256.test(formalReleaseAttestationDigest)) {
    throw new KaqAuthorityInputError(
      'teaching-proof-invalid',
      'Teaching proof formal attestation identity invalid',
    );
  }

  const expectedDigest = computeProofDigest({
    schemaVersion: FORMAL_TEACHING_PROJECTION_PROOF_VERSION,
    proofKind: 'FORMAL_ACTKG_TEACHING_PROJECTION_RELEASE',
    releaseSetId,
    releaseId,
    releaseHash,
    pinnedContextDigest,
    projectionId,
    projectionDigest,
    formalReleaseAttestationId,
    formalReleaseAttestationDigest,
  });
  // Reject mismatched claimed integrity digests — never silent remint/normalize.
  if (claimedProofDigest !== expectedDigest) {
    throw new KaqAuthorityInputError(
      'teaching-proof-invalid',
      'Teaching proofDigest does not match proof fields (forged or drifted)',
    );
  }

  return value as FormalTeachingProjectionProof;
}

// ─── Test-only mints (runtime-guarded; still fail in production NODE_ENV) ───

export function mintAcceptedDeltaEvidenceForTests(raw: {
  id: string;
  authorizationState: string;
  candidateReleaseSetId: string;
  candidateReleaseId: string;
  candidateReleaseHash: string;
  candidateSourceDatasetHash: string;
  outputDigest: string;
  captureRevision: string;
}): AcceptedDeltaReceiptEvidence {
  assertTestOnly('mintAcceptedDeltaEvidenceForTests');
  return mintAcceptedDeltaReceiptEvidence(raw);
}

export function mintVerifiedCoverageForTests(input: {
  coverage: AggregateCoverageAuthoritySource;
  delta: AcceptedDeltaReceiptEvidence;
}): VerifiedCourseCoverageBundle {
  assertTestOnly('mintVerifiedCoverageForTests');
  return mintVerifiedCourseCoverageBundle(input);
}

export function mintFormalTeachingProjectionProofForTests(input: {
  pinned: VerifiedKaqPinnedContext;
  projectionId: string;
  projectionDigest: string;
  formalReleaseAttestationId: string;
  formalReleaseAttestationDigest: string;
}): FormalTeachingProjectionProof {
  assertTestOnly('mintFormalTeachingProjectionProofForTests');
  return mintFormalTeachingProjectionProof(input);
}

export function mintVerifiedKaqPinnedContextForTests(
  fields: KaqCanonicalPinnedContextFields,
): VerifiedKaqPinnedContext {
  assertTestOnly('mintVerifiedKaqPinnedContextForTests');
  return mintVerifiedKaqPinnedContext(fields);
}

/**
 * Server DB loader — stable ids only. Private mints stay in this module.
 * Dynamic-imports prisma so static client bundles that only pull asserts
 * do not eagerly load the Prisma singleton at import time.
 *
 * Authority source is #1126 AggregateCourseCoverageVersion + CURRENT entries
 * + AggregateGovernanceReceipt (SHADOW, non-production). Never reads legacy
 * overlay-version tables or the authoritative-knowledge repository coverage API.
 */
export async function loadKaqPinnedContextFromDb(input: {
  deltaReceiptId: string;
  coverageSelector: KaqAggregateCoverageSelector;
}): Promise<VerifiedKaqPinnedContext> {
  const deltaReceiptId = input.deltaReceiptId?.trim();
  if (!deltaReceiptId) {
    throw new KaqAuthorityInputError('delta-missing', 'deltaReceiptId is required');
  }
  if (!input.coverageSelector) {
    throw new KaqAuthorityInputError(
      'coverage-not-available',
      'coverageSelector is required',
    );
  }
  const selector = input.coverageSelector;

  const { prisma } = await import('@/lib/prisma');

  const row = await prisma.actkgReleaseSetDeltaReceipt.findUnique({
    where: { id: deltaReceiptId },
    select: {
      id: true,
      authorizationState: true,
      candidateReleaseSetId: true,
      candidateReleaseId: true,
      candidateReleaseHash: true,
      candidateSourceDatasetHash: true,
      outputDigest: true,
      captureRevision: true,
    },
  });
  if (!row) {
    throw new KaqAuthorityInputError(
      'delta-missing',
      `ActkgReleaseSetDeltaReceipt not found: ${deltaReceiptId}`,
    );
  }

  const delta = mintAcceptedDeltaReceiptEvidence({
    id: row.id,
    authorizationState: row.authorizationState,
    candidateReleaseSetId: row.candidateReleaseSetId,
    candidateReleaseId: row.candidateReleaseId,
    candidateReleaseHash: row.candidateReleaseHash,
    candidateSourceDatasetHash: row.candidateSourceDatasetHash,
    outputDigest: row.outputDigest,
    captureRevision: row.captureRevision,
  });

  // Exact selector + CURRENT lifecycle. Unique key is overlayId+overlayVersion;
  // remaining selector fields and lifecycle are closed below.
  const version = await prisma.aggregateCourseCoverageVersion.findUnique({
    where: {
      overlayId_overlayVersion: {
        overlayId: selector.overlayId,
        overlayVersion: selector.overlayVersion,
      },
    },
    select: {
      id: true,
      courseId: true,
      overlayId: true,
      overlayVersion: true,
      releaseSetId: true,
      releaseId: true,
      releaseHash: true,
      sourceDatasetHash: true,
      deltaReceiptId: true,
      authoringRevision: true,
      captureRevision: true,
      sourceHash: true,
      lifecycleState: true,
    },
  });
  if (!version) {
    throw new KaqAuthorityInputError(
      'coverage-not-available',
      `AggregateCourseCoverageVersion not found for overlay ${selector.overlayId}@${selector.overlayVersion}`,
    );
  }

  const entryRows = await prisma.aggregateCourseCoverageEntry.findMany({
    where: {
      versionId: version.id,
      releaseId: version.releaseId,
      lifecycleState: 'CURRENT',
    },
    orderBy: [{ ordinal: 'asc' }, { canonicalId: 'asc' }],
    select: {
      canonicalId: true,
      role: true,
      ordinal: true,
      lifecycleState: true,
    },
  });

  const governance = await prisma.aggregateGovernanceReceipt.findFirst({
    where: {
      coverageVersionId: version.id,
      releaseId: version.releaseId,
      releaseSetId: version.releaseSetId,
      deltaReceiptId: delta.id,
      authorityState: 'SHADOW',
      productionAuthoritative: false,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      coverageVersionId: true,
      releaseSetId: true,
      releaseId: true,
      releaseHash: true,
      sourceDatasetHash: true,
      deltaReceiptId: true,
      deltaOutputDigest: true,
      deltaCaptureRevision: true,
      coverageSourceHash: true,
      captureRevision: true,
      authoringRevision: true,
      authorityState: true,
      productionAuthoritative: true,
    },
  });
  if (!governance) {
    throw new KaqAuthorityInputError(
      'coverage-not-available',
      'AggregateGovernanceReceipt not found for coverage version + accepted Delta (SHADOW)',
    );
  }

  const coverageSource: AggregateCoverageAuthoritySource = {
    selector: {
      courseId: selector.courseId,
      overlayId: selector.overlayId,
      overlayVersion: selector.overlayVersion,
      releaseSetId: selector.releaseSetId,
      releaseId: selector.releaseId,
    },
    version: {
      id: version.id,
      courseId: version.courseId,
      overlayId: version.overlayId,
      overlayVersion: version.overlayVersion,
      releaseSetId: version.releaseSetId,
      releaseId: version.releaseId,
      releaseHash: version.releaseHash,
      sourceDatasetHash: version.sourceDatasetHash,
      deltaReceiptId: version.deltaReceiptId,
      authoringRevision: version.authoringRevision,
      captureRevision: version.captureRevision,
      sourceHash: version.sourceHash,
      lifecycleState: version.lifecycleState,
    },
    entries: entryRows.map((entry) => ({
      canonicalId: entry.canonicalId,
      role: entry.role,
      ordinal: entry.ordinal,
      lifecycleState: entry.lifecycleState,
    })),
    governance: {
      id: governance.id,
      coverageVersionId: governance.coverageVersionId,
      releaseSetId: governance.releaseSetId,
      releaseId: governance.releaseId,
      releaseHash: governance.releaseHash,
      sourceDatasetHash: governance.sourceDatasetHash,
      deltaReceiptId: governance.deltaReceiptId,
      deltaOutputDigest: governance.deltaOutputDigest,
      deltaCaptureRevision: governance.deltaCaptureRevision,
      coverageSourceHash: governance.coverageSourceHash,
      captureRevision: governance.captureRevision,
      authoringRevision: governance.authoringRevision,
      authorityState: governance.authorityState,
      productionAuthoritative: governance.productionAuthoritative,
    },
  };

  const verifiedCoverage = mintVerifiedCourseCoverageBundle({
    coverage: coverageSource,
    delta,
  });
  return buildKaqPinnedContextFromVerifiedAuthority({
    delta,
    coverage: verifiedCoverage,
  });
}

export async function loadTeachingProjectionAvailabilityFromDb(input: {
  deltaReceiptId: string;
  coverageSelector: KaqAggregateCoverageSelector;
}): Promise<{
  pinned: VerifiedKaqPinnedContext;
  availability: import('./contracts').TeachingProjectionAvailability;
}> {
  const pinned = await loadKaqPinnedContextFromDb(input);
  // No formal Teaching Projection artifact path in ACT yet — fail closed.
  const { unavailableTeachingProjection } = await import('./teaching-projection');
  return {
    pinned,
    availability: unavailableTeachingProjection(),
  };
}
