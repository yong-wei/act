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
import type {
  CourseCoverageAuditIdentity,
  CourseCoverageRecord,
  CourseCoverageResult,
  CourseCoverageSelector,
} from '@/lib/authoritative-knowledge/contracts';

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
  selector: CourseCoverageSelector;
  audit: CourseCoverageAuditIdentity;
  entries: CourseCoverageRecord[];
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

function validateCoverageAgainstDelta(
  coverage: CourseCoverageResult,
  delta: AcceptedDeltaReceiptEvidence,
): {
  selector: CourseCoverageSelector;
  audit: CourseCoverageAuditIdentity;
  entries: CourseCoverageRecord[];
  admittedCanonicalIds: string[];
} {
  if (coverage.status !== 'available') {
    throw new KaqAuthorityInputError(
      'coverage-not-available',
      `CourseCoverage is not available (status=${coverage.status})`,
    );
  }
  if (coverage.productionAuthoritative !== false) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'CourseCoverage productionAuthoritative must be false for shadow KAQ',
    );
  }
  const { selector, audit, entries } = coverage;
  if (selector.overlayId !== PINNED_KAQ_COVERAGE_OVERLAY_ID) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      `CourseCoverage overlayId is not aggregate overlay (${selector.overlayId})`,
    );
  }
  if (
    selector.releaseSetId !== delta.candidateReleaseSetId
    || selector.releaseId !== delta.candidateReleaseId
  ) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'CourseCoverage selector Release identity does not match accepted Delta',
    );
  }
  if (
    audit.releaseSetId !== delta.candidateReleaseSetId
    || audit.releaseId !== delta.candidateReleaseId
    || audit.releaseHash !== delta.candidateReleaseHash
  ) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'CourseCoverage audit Release identity does not match accepted Delta',
    );
  }
  if (
    audit.overlayId !== selector.overlayId
    || audit.overlayVersion !== selector.overlayVersion
    || audit.courseId !== selector.courseId
  ) {
    throw new KaqAuthorityInputError(
      'coverage-identity-mismatch',
      'CourseCoverage audit does not match selector',
    );
  }
  if (!SHA256.test(audit.sourceHash)) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'CourseCoverage audit.sourceHash must be 64-char lowercase sha256 hex',
    );
  }
  if (!GIT_COMMIT.test(audit.captureRevision)) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'CourseCoverage audit.captureRevision must be a 40-char git commit',
    );
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'CourseCoverage available result requires non-empty entries',
    );
  }
  for (const entry of entries) {
    if (!entry.canonicalId?.trim()) {
      throw new KaqAuthorityInputError(
        'coverage-format-invalid',
        'CourseCoverage entry missing canonicalId',
      );
    }
  }
  const admittedCanonicalIds = admittedCanonicalIdsFromCoverageEntries(entries);
  if (admittedCanonicalIds.length === 0) {
    throw new KaqAuthorityInputError(
      'coverage-format-invalid',
      'CourseCoverage has no active admitted roles (excluded-only is not admitted)',
    );
  }
  return {
    selector,
    audit,
    entries: [...entries],
    admittedCanonicalIds,
  };
}

function mintVerifiedCourseCoverageBundle(input: {
  coverage: CourseCoverageResult;
  delta: AcceptedDeltaReceiptEvidence;
}): VerifiedCourseCoverageBundle {
  const delta = assertAcceptedDeltaReceiptEvidence(input.delta);
  const closed = validateCoverageAgainstDelta(input.coverage, delta);
  const obj = {
    schemaVersion: VERIFIED_COURSE_COVERAGE_BUNDLE_VERSION,
    selector: { ...closed.selector },
    audit: { ...closed.audit },
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
    ? (record.entries as CourseCoverageRecord[])
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
    coverageSourceHash: coverage.audit.sourceHash,
    coverageCaptureRevision: coverage.audit.captureRevision,
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
  coverage: CourseCoverageResult;
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
 */
export async function loadKaqPinnedContextFromDb(input: {
  deltaReceiptId: string;
  coverageSelector: CourseCoverageSelector;
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

  const { prisma } = await import('@/lib/prisma');
  const { AuthoritativeKnowledgeRepository } = await import(
    '@/lib/authoritative-knowledge/repository'
  );

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

  const repository = new AuthoritativeKnowledgeRepository(prisma);
  const coverage = await repository.readCourseCoverage(input.coverageSelector);
  const verifiedCoverage = mintVerifiedCourseCoverageBundle({ coverage, delta });
  return buildKaqPinnedContextFromVerifiedAuthority({ delta, coverage: verifiedCoverage });
}

export async function loadTeachingProjectionAvailabilityFromDb(input: {
  deltaReceiptId: string;
  coverageSelector: CourseCoverageSelector;
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
