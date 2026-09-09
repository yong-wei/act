/**
 * Engineering-textbook source mapping governance contracts (#2043).
 *
 * Governs the canonical→textbook mapping pipeline artifacts: the candidate
 * ledger (retrieval recall), the append-only independent semantic review
 * ledger, the explicit exception ledger, and the fail-closed coverage gate.
 * Mapping coordinates are textbooks-v2 structural-unit coordinates — the same
 * identity used by the reader href and the hybrid retrieval index.
 */

export const ENGINEERING_TEXTBOOK_MAPPING_ROOT =
  'course-content/authoring/knowledge/engineering-textbook-mapping' as const;

export const MAPPING_DENOMINATOR_CONTRACT =
  'engineering-textbook-mapping-denominator/v1' as const;
export const MAPPING_CANDIDATES_CONTRACT =
  'engineering-textbook-mapping-candidates/v1' as const;
export const MAPPING_REVIEWS_CONTRACT =
  'engineering-textbook-mapping-reviews/v1' as const;
export const MAPPING_EXCEPTIONS_CONTRACT =
  'engineering-textbook-mapping-exceptions/v1' as const;
export const MAPPING_EXCEPTIONS_PROPOSED_CONTRACT =
  'engineering-textbook-mapping-exceptions-proposed/v1' as const;
export const MAPPING_COVERAGE_CONTRACT =
  'engineering-textbook-mapping-coverage/v1' as const;
export const MAPPING_SOURCES_INPUT_CONTRACT =
  'engineering-textbook-mapping-sources-input/v1' as const;

/** Fail-closed coverage gate line: approved + explicit exceptions ≥ 95%. */
export const MAPPING_COVERAGE_GATE = 0.95 as const;

/** Max sources emitted per node into node-detail shards (#2043 risk budget). */
export const NODE_SOURCES_LIMIT = 6 as const;

export const EXCEPTION_REASONS = [
  'no-textbook-content',
  'candidates-rejected',
  'no-candidate',
  'type-unsuitable',
] as const;

export type MappingExceptionReason = (typeof EXCEPTION_REASONS)[number];

export type ReviewVerdict = 'approved' | 'rejected';

/** Stable candidate identity: canonical + v2 structural-unit coordinate. */
export type CandidateKey = string;

export function candidateKeyOf(input: {
  canonicalId: string;
  structuralUnitId: string;
}): CandidateKey {
  return `${input.canonicalId}\u001f${input.structuralUnitId}`;
}

/** A textbooks-v2 structural-unit coordinate resolvable against the runtime manifests. */
export interface StructuralUnitCoordinate {
  bookId: string;
  edition: string;
  structuralUnitId: string;
  structuralPath: readonly string[];
}

export interface MappingDenominatorFile {
  contract: typeof MAPPING_DENOMINATOR_CONTRACT;
  authorityReleaseId: string;
  snapshotId: string;
  catalogId: string;
  generatorVersion: string;
  totalObjects: number;
  domains: Array<{
    domainId: string;
    objectCount: number;
    canonicalIds: string[];
  }>;
}

export interface MappingCandidateRow {
  canonicalId: string;
  domainId: string;
  structuralUnitId: string;
  bookId: string;
  edition: string;
  structuralPath: string[];
  unitTitle: string;
  rank: number;
  recallQuery: string;
  lexicalScore: number | null;
  vectorScore: number | null;
}

export interface MappingCandidatesFile {
  contract: typeof MAPPING_CANDIDATES_CONTRACT;
  authorityReleaseId: string;
  denominatorDigest: string;
  generatorVersion: string;
  generatedAt: string;
  rows: MappingCandidateRow[];
}

export interface MappingReviewRow {
  schemaVersion: typeof MAPPING_REVIEWS_CONTRACT;
  reviewOrdinal: number;
  candidateKey: CandidateKey;
  verdict: ReviewVerdict;
  reason: string;
  reviewerIdentity: string;
  reviewerModel: string;
  appendedAt: string;
}

export interface MappingExceptionRow {
  schemaVersion: typeof MAPPING_EXCEPTIONS_CONTRACT;
  canonicalId: string;
  domainId: string;
  reason: MappingExceptionReason;
  detail: string;
}

export interface MappingCoverageFile {
  contract: typeof MAPPING_COVERAGE_CONTRACT;
  authorityReleaseId: string;
  denominatorTotal: number;
  denominatorDigest: string;
  candidatesDigest: string;
  reviewsDigest: string;
  exceptionsDigest: string;
  approvedCount: number;
  exceptionCount: number;
  coveredCount: number;
  coverageRate: number;
  gate: number;
  passed: boolean;
  perDomain: Array<{
    domainId: string;
    denominator: number;
    approved: number;
    exceptions: number;
    coverageRate: number;
  }>;
  generatedAt: string;
}

/** Node-detail source citation entry (sealed shard contract shape). */
export interface NodeSourceCitation {
  sourceEditionId: string;
  sectionId: string;
  label: string | null;
}

export interface MappingSourcesInputFile {
  contract: typeof MAPPING_SOURCES_INPUT_CONTRACT;
  authorityReleaseId: string;
  coverageDigest: string;
  nodeLimit: number;
  entries: Array<{
    nodeId: string;
    sources: NodeSourceCitation[];
  }>;
}

export class EngineeringTextbookMappingError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'EngineeringTextbookMappingError';
    this.code = code;
  }
}
