/**
 * Server-only KAQ authority loaders (#1113).
 *
 * Forwards DB loaders only — no row/result/adapter injection surface.
 * Import from server modules; do NOT re-export from the client barrel.
 */

import 'server-only';

export {
  loadKaqPinnedContextFromDb,
  loadTeachingProjectionAvailabilityFromDb,
  type VerifiedKaqPinnedContext,
  type AcceptedDeltaReceiptEvidence,
  type FormalTeachingProjectionProof,
} from './authority-capability';
