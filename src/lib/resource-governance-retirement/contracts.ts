/**
 * Resource-governance retirement contracts (#1592).
 *
 * Evidence-gated deletion of identity / eligibility / registry-read /
 * knowledge-resource projection entrypoints replaced by R1/R2/R3.
 * The gate is not an activation, selector, or release writer.
 */

import { KNOWLEDGE_SURFACE_CONTRACT } from '@/lib/knowledge-surface';
import { RESOURCE_ELIGIBILITY_CONTRACT } from '@/features/knowledge/resource-eligibility/public-api';
import { RESOURCE_REGISTRY_INDEX_CONTRACT } from '@/features/knowledge/resource-index/public-api';

export const RESOURCE_GOVERNANCE_RETIREMENT_CONTRACT =
  'act-resource-governance-retirement/v1' as const;
export const RESOURCE_GOVERNANCE_RETIREMENT_MANIFEST_CONTRACT =
  'act-resource-governance-retirement-manifest/v1' as const;
export const RESOURCE_GOVERNANCE_RETIREMENT_LEDGER_CONTRACT =
  'act-resource-governance-retirement-ledger/v1' as const;
export const RESOURCE_GOVERNANCE_RETIREMENT_ARCHIVE_CONTRACT =
  'act-resource-governance-retirement-archive/v1' as const;
export const RESOURCE_GOVERNANCE_RETIREMENT_DELETION_RECEIPT_CONTRACT =
  'act-resource-governance-retirement-deletion-receipt/v1' as const;
export const RESOURCE_GOVERNANCE_RETIREMENT_BUILDER_VERSION =
  'act-resource-governance-retirement-builder/v1' as const;

export const R1_REGISTRY_INDEX_CONTRACT = RESOURCE_REGISTRY_INDEX_CONTRACT;
export const R2_ELIGIBILITY_CONTRACT = RESOURCE_ELIGIBILITY_CONTRACT;
export const R3_KNOWLEDGE_SURFACE_CONTRACT = KNOWLEDGE_SURFACE_CONTRACT;

export const IMPLEMENTED_REPLACEMENT_CONTRACTS = [
  R1_REGISTRY_INDEX_CONTRACT,
  R2_ELIGIBILITY_CONTRACT,
  R3_KNOWLEDGE_SURFACE_CONTRACT,
] as const;

export type ImplementedReplacementContract =
  (typeof IMPLEMENTED_REPLACEMENT_CONTRACTS)[number];

export const CALLER_CLASSES = [
  'production',
  'test',
  'generated',
  'compatibility',
  'framework',
  'route-api',
  'model',
  'script',
  'browser',
  'reverse',
  'dynamic',
  'historical',
  'rollback',
] as const;

export type CallerClass = (typeof CALLER_CLASSES)[number];

export const CANDIDATE_ROLES = [
  'identity-read',
  'eligibility-read',
  'registry-read',
  'knowledge-resource-projection',
] as const;

export type CandidateRole = (typeof CANDIDATE_ROLES)[number];

export const LEDGER_ENTRY_STATES = [
  'retained',
  'historical-adapter',
  'deleted',
  'already-absent',
] as const;

export type LedgerEntryState = (typeof LEDGER_ENTRY_STATES)[number];

export const RETIREMENT_DISPOSITIONS = [
  'blocked',
  'retain',
  'ready-for-deletion',
  'deleted',
] as const;

export type RetirementDisposition = (typeof RETIREMENT_DISPOSITIONS)[number];

export const REVIEWER_DECISIONS = [
  'unreviewed',
  'retain',
  'approve-delete',
] as const;

export type ReviewerDecision = (typeof REVIEWER_DECISIONS)[number];

export class ResourceGovernanceRetirementError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ResourceGovernanceRetirementError';
    this.code = code;
  }
}

export class ResourceGovernanceRetirementGateError extends ResourceGovernanceRetirementError {
  readonly reasons: string[];

  constructor(code: string, message: string, reasons: string[] = []) {
    super(code, message);
    this.name = 'ResourceGovernanceRetirementGateError';
    this.reasons = reasons;
  }
}

export interface GraphCaller {
  path: string;
  symbol: string | null;
  callerClass: CallerClass;
  kind:
    | 'import'
    | 'string'
    | 'route'
    | 'script'
    | 'dynamic'
    | 'generated'
    | 'reverse'
    | 'test';
}

export interface GraphFile {
  path: string;
  content: string;
  digest: string;
  isDirectory?: boolean;
}

export interface ReplacementParity {
  identity: boolean;
  sourceOwnership: boolean;
  role: boolean;
  authorization: boolean;
  scope: boolean;
  revision: boolean;
  optionalDegradation: boolean;
  failClosed: boolean;
  cache: boolean;
  publicResponse: boolean;
  /** True when the replacement is a re-export / renamed wrapper / flag / no-op. */
  facade: boolean;
}

export interface ReplacementIdentity {
  contract: ImplementedReplacementContract;
  publicApiPath: string;
  publicSymbol: string;
  implemented: boolean;
  captureRevision: string;
  parity: ReplacementParity;
}

export interface RetirementCandidate {
  id: string;
  owner: string;
  sourcePath: string;
  exportName: string | null;
  semanticRole: CandidateRole;
  replacement: ReplacementIdentity;
  migrationRevision: string;
  retireable: boolean;
  deletionCondition: string;
}

export interface ProtectedSurface {
  id: string;
  issueRefs: readonly string[];
  paths: readonly string[];
  reason: string;
}

export interface AllowlistException {
  id: string;
  pattern: string;
  reason: string;
}

export interface DeprecationLedgerEntry {
  id: string;
  owner: string;
  sourcePath: string;
  consumers: readonly string[];
  replacement: string;
  migrationRevision: string;
  state: LedgerEntryState;
  deletionCondition: string;
  rollbackIdentity: string | null;
}

export interface ResourceGovernanceDeprecationLedger {
  contract: typeof RESOURCE_GOVERNANCE_RETIREMENT_LEDGER_CONTRACT;
  captureRevision: string;
  allowlist: readonly AllowlistException[];
  entries: readonly DeprecationLedgerEntry[];
  ledgerDigest: string;
}

export interface RollbackArchiveEntry {
  candidateId: string;
  path: string;
  contentDigest: string;
  immutable: true;
}

export interface ResourceGovernanceRollbackArchive {
  contract: typeof RESOURCE_GOVERNANCE_RETIREMENT_ARCHIVE_CONTRACT;
  captureRevision: string;
  entries: readonly RollbackArchiveEntry[];
  archiveDigest: string;
}

export interface ZeroCallerReceipt {
  candidateId: string;
  captureRevision: string;
  scanRules: {
    exactPath: true;
    exactSymbol: true;
    includeTests: true;
    includeDynamic: true;
    includeGenerated: true;
    excludedFrameworkFiles: readonly string[];
  };
  hits: readonly GraphCaller[];
  zeroCallers: boolean;
  receiptDigest: string;
}

export interface ProtectedSurfaceScan {
  captureRevision: string;
  intact: boolean;
  reachableFromProtected: readonly string[];
  missingProtected: readonly string[];
  scanDigest: string;
}

export interface ResourceGovernanceRetirementManifest {
  contract: typeof RESOURCE_GOVERNANCE_RETIREMENT_MANIFEST_CONTRACT;
  builderVersion: typeof RESOURCE_GOVERNANCE_RETIREMENT_BUILDER_VERSION;
  retirementId: string;
  captureRevision: string;
  headRevision: string;
  reviewedAt: string | null;
  reviewerDecision: ReviewerDecision;
  candidateSetHash: string;
  denominatorHash: string;
  replacementIdentities: readonly ReplacementIdentity[];
  migrationRevision: string;
  zeroCallerReceipts: readonly ZeroCallerReceipt[];
  protectedSurfaceScan: ProtectedSurfaceScan;
  rollbackArchiveDigest: string;
  ledgerDigest: string;
  reviewerReasons: readonly string[];
  invariants: {
    doesNotWriteAuthority: true;
    doesNotWriteTeachingProjection: true;
    doesNotWriteRuntimeRelease: true;
    doesNotWriteSelectors: true;
    doesNotDeploy: true;
    doesNotIncludePrismaMigration: true;
    doesNotCreatePermanentFacade: true;
    failClosedOnMissingEvidence: true;
  };
  status: RetirementDisposition;
  reasons: readonly string[];
  manifestDigest: string;
}

export interface ResourceGovernanceChangeSurface {
  writesAuthority: boolean;
  writesTeachingProjection: boolean;
  writesRuntimeRelease: boolean;
  writesSelectors: boolean;
  writesProductionDeployment: boolean;
  writesLearningRecords: boolean;
  writesHistoricalArtifacts: boolean;
  includesPrismaMigration: boolean;
  usesDirectoryOrGlobDeletion: boolean;
  paths: readonly string[];
}

export interface ResourceGovernanceGraph {
  captureRevision: string;
  headRevision: string;
  files: readonly GraphFile[];
  candidates: readonly RetirementCandidate[];
  callersByCandidate: Readonly<Record<string, readonly GraphCaller[]>>;
  protectedSurfaces: readonly ProtectedSurface[];
  priorLedger: ResourceGovernanceDeprecationLedger | null;
  currentLedger: ResourceGovernanceDeprecationLedger;
  rollbackArchive: ResourceGovernanceRollbackArchive;
  archiveBytes: Readonly<Record<string, string>>;
  changeSurface: ResourceGovernanceChangeSurface;
  excludedFrameworkFiles: readonly string[];
}

export interface ResourceGovernanceRetirementVerdict {
  contract: typeof RESOURCE_GOVERNANCE_RETIREMENT_CONTRACT;
  status: RetirementDisposition;
  reasons: readonly string[];
  candidateSetHash: string;
  denominatorHash: string;
  ledgerDigest: string;
  deletionsAuthorized: readonly string[];
  retained: ReadonlyArray<{
    id: string;
    deletionCondition: string;
    state: LedgerEntryState;
  }>;
  protectedSurfacesIntact: boolean;
  rollbackArchiveDigest: string;
  writesSelectorsOrReleases: false;
  verdictDigest: string;
}

export interface DeletionReceipt {
  contract: typeof RESOURCE_GOVERNANCE_RETIREMENT_DELETION_RECEIPT_CONTRACT;
  receiptId: string;
  retirementId: string;
  manifestDigest: string;
  deletedPaths: readonly string[];
  deletedAt: string;
  postDeleteZeroCaller: boolean;
  postDeleteImportBuild: boolean;
  status: 'deleted' | 'blocked' | 'retained';
  reasons: readonly string[];
  receiptDigest: string;
}
