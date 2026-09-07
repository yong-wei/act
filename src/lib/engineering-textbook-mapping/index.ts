export {
  ENGINEERING_TEXTBOOK_MAPPING_ROOT,
  EXCEPTION_REASONS,
  MAPPING_CANDIDATES_CONTRACT,
  MAPPING_COVERAGE_CONTRACT,
  MAPPING_COVERAGE_GATE,
  MAPPING_DENOMINATOR_CONTRACT,
  MAPPING_EXCEPTIONS_CONTRACT,
  MAPPING_EXCEPTIONS_PROPOSED_CONTRACT,
  MAPPING_REVIEWS_CONTRACT,
  MAPPING_SOURCES_INPUT_CONTRACT,
  NODE_SOURCES_LIMIT,
  EngineeringTextbookMappingError,
  candidateKeyOf,
} from './contracts';
export type {
  CandidateKey,
  MappingCandidateRow,
  MappingCandidatesFile,
  MappingCoverageFile,
  MappingDenominatorFile,
  MappingExceptionReason,
  MappingExceptionRow,
  MappingReviewRow,
  MappingSourcesInputFile,
  MappingSourcesInputFile as MappingSourcesInput,
  NodeSourceCitation,
  ReviewVerdict,
  StructuralUnitCoordinate,
} from './contracts';
export {
  DEFAULT_TEXTBOOKS_V2_RUNTIME_RELATIVE,
  resolveTextbookAlias,
  TEXTBOOK_ID_ALIASES,
  verifyTextbookAliasesAgainstManifests,
} from './aliases';
export type { TextbookAliasRow } from './aliases';
export {
  loadStructuralUnitIndex,
  resolveStructuralUnit,
} from './coordinates';
export type { StructuralUnitIndex, StructuralUnitRecord } from './coordinates';
export {
  artifactDigest,
  effectiveVerdicts,
  loadCandidates,
  loadCoverage,
  loadDenominator,
  loadExceptionLedger,
  loadReviewLedger,
  loadSourcesInput,
  mappingArtifactPath,
  readJsonArtifact,
  sha256Text,
  verifyCoverageLedgerBinding,
} from './ledger';
export { assertCoverageGate, computeCoverage } from './coverage';
export type { CoverageComputation } from './coverage';
