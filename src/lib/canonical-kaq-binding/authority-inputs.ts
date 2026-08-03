/**
 * Public pure authority-input surface for KAQ Canonical shadow (#1113).
 *
 * Does not export mint factories. Test mints live in `./testing`.
 * DB loaders live in `./server` (or re-exported load functions from capability
 * via server only).
 */

export {
  ACCEPTED_DELTA_RECEIPT_EVIDENCE_VERSION,
  FORMAL_TEACHING_PROJECTION_PROOF_VERSION,
  VERIFIED_COURSE_COVERAGE_BUNDLE_VERSION,
  KaqAuthorityInputError,
  admittedCanonicalIdsFromCoverageEntries,
  assertAcceptedDeltaReceiptEvidence,
  assertFormalTeachingProjectionProof,
  assertVerifiedCourseCoverageBundle,
  assertVerifiedKaqPinnedContext,
  buildKaqPinnedContextFromVerifiedAuthority,
  type AcceptedDeltaReceiptEvidence,
  type AggregateCoverageAuthoritySource,
  type FormalTeachingProjectionProof,
  type KaqAggregateCoverageSelector,
  type VerifiedCourseCoverageBundle,
  type VerifiedKaqPinnedContext,
} from './authority-capability';
