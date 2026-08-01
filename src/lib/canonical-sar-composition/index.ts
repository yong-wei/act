/**
 * Canonical SAR composition public surface (#1114).
 *
 * Query-time multi-authority composition. Production selector remains LEGACY
 * until #1117 cutover.
 *
 * Intentionally NOT exported:
 * - ./testing (test-only mints)
 * - any unrestricted seal/mint for raw bindings
 * - path/learner production cross-namespace projectors (no governed producer yet)
 */

export {
  assertCompleteAdapterSet,
  createFiveSourceAdapterSet,
  createStaticSarSourceAdapter,
  type StaticSourceRecord,
} from './adapters';
export {
  assertNoConflictingDuplicateHits,
  assertTrustedAdapterResult,
  mergeHitIntoIndex,
  SarAdapterResultError,
  type SarAdapterValidationFailureCode,
} from './adapter-validation';
export {
  assertPipelineReadinessCannotReplaceProduction,
  assertProductionSelectorUnchanged,
  assertShadowCannotActivateSarCutover,
  canonicalCompositionEnabled,
  productionRetrievalUsesLegacy,
  resolveSarAuthorityMode,
  SarCutoverActivationError,
  selectSarAuthority,
  tryActivateCanonicalSarCutover,
  type SarCutoverVerificationFailure,
  type SelectSarAuthorityOptions,
} from './authority';
export {
  assertAcceptedBindingEvidence,
  assertBindingKindMatrix,
  assertPinnedMatchesVersion,
  assertVerifiedSarBindingSet,
  mergeVerifiedSarBindingSets,
  projectReviewedKaqBindingsToSar,
  projectReviewedResourceBindingsToSar,
  SarBindingCapabilityError,
  type SarBindingShapeFailureCode,
} from './binding-capability';
export {
  evaluateBindingForTraversal,
  isReviewedCrossNamespaceBinding,
  rejectSameNameAsBinding,
} from './bindings';
export {
  bindingTraversalRecord,
  buildSarCompositionCacheKey,
  cacheKeysDiffer,
  computeBindingSetDigest,
  SAR_CACHE_INVALIDATION_FIELDS,
  type SarCacheKeyInput,
} from './cache';
export { composeCanonicalSar } from './composition';
export {
  CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION,
  CANONICAL_SAR_CONSUMER_ID,
  PINNED_SAR_AGGREGATE_RELEASE_ID,
  PINNED_SAR_AGGREGATE_RELEASE_SET_ID,
  PINNED_SAR_COVERAGE_OVERLAY_ID,
  SAR_AUTHORITY_OWNERS,
  SAR_CUTOVER_AUTHORITY_SCHEMA_VERSION,
  SAR_EXPANSION_DEFAULTS,
  SAR_SOURCE_NAMESPACES,
  SAR_SUPPORTED_OBJECT_TYPES,
  SAR_SUPPORTED_TRAVERSAL_PREDICATES,
  SAR_UNSUPPORTED_STORED_PREDICATES,
  SAR_VERSION_CONTEXT_FIELD_KEYS,
  type SarAuthorityConsumer,
  type SarAuthorityMode,
  type SarAuthorityOwner,
  type SarAuthoritySelector,
  type SarCandidateEdge,
  type SarCandidateKind,
  type SarCandidateNode,
  type SarCandidateProjection,
  type SarCompositionBudget,
  type SarCompositionDiagnostics,
  type SarCompositionInput,
  type SarCompositionResult,
  type SarCompositionScope,
  type SarCompositionSeed,
  type SarCompositionStatus,
  type SarCompositionVersionContext,
  type SarCompositionVersionFields,
  type SarCrossNamespaceBinding,
  type SarCrossNamespaceBindingKind,
  type SarCrossNamespaceBindingReviewState,
  type SarCutoverAuthorityReceipt,
  type SarKaqBindingPredicate,
  type SarProvenance,
  type SarResourceBindingPredicate,
  type SarShadowEvidence,
  type SarSourceAdapter,
  type SarSourceAdapterSet,
  type SarSourceHit,
  type SarSourceNamespace,
  type SarSourceNeighborEdge,
  type SarSourceQueryResult,
  type SarSupportedObjectType,
  type SarSupportedTraversalPredicate,
  type SarTraversalSkipReason,
  type SarUnsupportedStoredPredicate,
  type VerifiedSarBindingSet,
} from './contracts';
export {
  buildFixtureAdapters,
  buildFixtureBindingRecords,
  buildFixtureBindings,
  buildFixtureScope,
  buildFixtureSeeds,
  buildFixtureVersion,
  buildOfflineCompositionFixture,
  CANONICAL_SAR_FIXTURE_IDS,
} from './fixtures';
export {
  assertSarQualifiedId,
  isSarSourceNamespace,
  parseSarQualifiedId,
  qualifySarId,
  sameSarEndpoint,
  SAR_NAMESPACE_ID_SEPARATOR,
  type SarQualifiedId,
} from './identity';
export {
  getSarPredicateAdapter,
  isSarSupportedObjectType,
  isSarSupportedTraversalPredicate,
  isSarUnsupportedStoredPredicate,
  mapKaqRoleToSarPredicate,
  mapResourceRoleToSarPredicate,
  resolveSarTraversalNeighbor,
  SAR_PREDICATE_ADAPTERS,
  type SarPredicateAdapter,
  type SarPredicateExpansion,
} from './semantics';
export {
  assertCompleteSarVersionContext,
  assertSarVersionContextFields,
  buildSarVersionContext,
  computeSarVersionContextDigest,
  membershipMatchesSarVersion,
  SarVersionContextError,
  type SarVersionContextFailureCode,
} from './version-context';
export {
  expectedAdapterVersionIdentity,
  expectedSourceVersionClosure,
  type SarSourceVersionClosure,
} from './version-identity';
