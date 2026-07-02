export {
  buildSourcePack,
  buildUnavailableLimitation,
  type BuildSourcePackInput,
} from './builder';
export {
  retrieveSourcePack,
  type RetrieveSourcePackInput,
  type RetrieveSourcePackResult,
} from './hybrid-retriever';
export {
  diversifyRankedSourcePackItems,
  type DiversifySourcePackInput,
  type DiversifySourcePackResult,
} from './pack-diversifier';
export {
  rankSourcePackCandidates,
  type RankedSourcePackCandidate,
  type SourcePackRankingContext,
  type SourcePackRankingSignals,
} from './pack-ranker';
export {
  getSourcePackRetrievalProfile,
  listSourcePackRetrievalProfiles,
  type SourcePackCallerRole,
  type SourcePackRetrievalProfile,
  type SourcePackRetrievalProfileName,
} from './retrieval-profiles';
export {
  evaluateSourcePackRetrieval,
  sourcePackEvaluationFixtures,
  type SourcePackEvaluationCase,
  type SourcePackEvaluationResult,
} from './source-pack-eval';
export {
  buildSourcePackAuditOutput,
  serializeSourcePackAudit,
  serializeSourcePackJson,
  serializeSourcePackMarkdown,
  type SourcePackAuditOutput,
} from './serializers';
export {
  safeValidateSourcePack,
  sourcePackSchema,
  validateSourcePack,
} from './schema';
export type {
  SourcePack,
  SourcePackAccessMetadata,
  SourcePackAudit,
  SourcePackCitation,
  SourcePackCoverage,
  SourcePackIndexRefs,
  SourcePackItem,
  SourcePackLimitation,
  SourcePackModality,
  SourcePackProfile,
  SourcePackQuery,
  SourcePackScoreFields,
  SourcePackSourceKind,
} from './types';

// Corpus adapters
export {
  adaptLearningEvidenceChunk,
  adaptLearningEvidenceBatch,
  adaptTextbookSearchDocument,
  adaptResourceProjection,
  type AdaptLearningEvidenceChunkOptions,
  type AdaptCorpusResult,
} from './corpus-adapters';

// Citation hydrator
export {
  hydrateCitationFromAddress,
  hydrateCitationFromTarget,
  isSafeHref,
  buildUnsafeHrefLimitation,
  type HydratorCitationAddressInput,
  type HydratorCitationTargetInput,
} from './citation-hydrator';

// Resource projection adapter
export {
  adaptResourceProjectionRow,
  isProvisionalReview,
} from './resource-projection-adapter';
