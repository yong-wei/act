/**
 * Test-only mint helpers (#1113). NOT re-exported from the production barrel.
 * Runtime guards inside capability still block production NODE_ENV deep imports.
 */

export {
  mintAcceptedDeltaEvidenceForTests,
  mintFormalTeachingProjectionProofForTests,
  mintVerifiedCoverageForTests,
  mintVerifiedKaqPinnedContextForTests,
} from './authority-capability';
