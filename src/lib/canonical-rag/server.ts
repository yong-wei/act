/**
 * Server-only Canonical RAG entry (#1112).
 *
 * Import from server modules and tests for harness + textbook fixture.
 * Do NOT re-export from client-reachable barrels such as `@/lib/source-pack`.
 */

import 'server-only';

export {
  selectRagAuthority,
  type SelectRagAuthorityOptions,
} from './authority';
export {
  GOVERNED_TEXTBOOK_FIXTURE_ID,
  GOVERNED_TEXTBOOK_FIXTURE_KIND,
  loadGovernedTextbookFixture,
  type GovernedTextbookFixture,
} from './governed-textbook-fixture';
export {
  governedSeedMatchesSourcePackItem,
  mapGovernedSeedsToSourcePackItems,
  productionNumberedCitations,
  runLegacyProductionWithCanonicalShadow,
  type LegacyProductionWithCanonicalShadowResult,
  type ProductionShadowSeparationProof,
  type RunLegacyProductionWithCanonicalShadowInput,
} from './production-shadow-harness';
export {
  extractProductionForegroundIdentities,
  maybeRunKonlingCanonicalRagShadowDiagnostic,
  runKonlingCanonicalRagShadowDiagnostic,
  type KonlingCanonicalRagShadowContext,
  type KonlingCanonicalRagShadowDiagnostic,
  type ProductionForegroundIdentity,
} from './konling-integration';
