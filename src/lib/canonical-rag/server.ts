/**
 * Server-only Canonical RAG entry (#1112).
 *
 * Import from server modules and tests for harness + textbook fixture.
 * Do NOT re-export from client-reachable barrels such as `@/lib/source-pack`.
 */

import 'server-only';

export {
  readRagProductionAuthorityDial,
  selectRagAuthority,
  type RagProductionAuthorityDial,
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
  runKonlingComposedRagShadowDiagnostic,
  type KonlingComposedRagShadowDiagnostic,
  type ProductionForegroundIdentity,
} from './konling-integration';
