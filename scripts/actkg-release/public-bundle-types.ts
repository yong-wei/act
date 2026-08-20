// Storage-independent types for ActKG public Bundle compatibility.
// These types intentionally avoid Prisma, Repository, and runtime DTO imports.

export type JsonObject = Record<string, unknown>;

export type CompatibilityCode =
  | 'COMPATIBLE_CONTENT_UPDATE'
  | 'COMPATIBLE_PACKAGING_REVISION'
  | 'COMPATIBLE_OPTIONAL_EXTENSION'
  | 'ADAPTER_UPDATE_REQUIRED'
  | 'SCHEMA_REVIEW_REQUIRED'
  | 'INTEGRITY_REJECTED';

export interface MatchedContractIdentity {
  kind: 'bundle_contract' | 'schema' | 'artifact_contract' | 'lock' | 'bundle' | 'release';
  id: string;
  version?: string;
  sha256?: string;
}

export interface CompatibilityAssessment {
  code: CompatibilityCode;
  reasons: string[];
  matchedIdentities: MatchedContractIdentity[];
}

export interface BundleIdentity {
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
  bundleKind: 'module' | 'integration' | 'aggregate';
  releaseStage: 'candidate' | 'stable';
  bundleContractVersion: string;
  controlledPath: string;
  manifestRawSha256: string;
  normalization: string;
  publicationTag: string;
  sourceCommit: string;
  sourceTag: string;
}

export interface ReleaseIdentity {
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string;
}

export interface SchemaIdentity {
  version: string;
  rawSha256: string;
}

export interface ReleaseSetIdentity {
  releaseSetId: string;
  lockVersion: 'actkg-release-set-lock/v3';
  lockPath: string;
  lockRawSha256: string;
}

export interface ProjectionIdentity {
  projectionId: string;
  profile: string;
  projectionProfile: string;
  versionDigest: string;
  sourceRelease: string;
  sourceReleaseHash: string;
  sourceDatasetHash: string;
  nodeCount: number;
  linkCount: number;
  artifactPath: string;
  artifactSha256: string;
}

export interface ArtifactDescriptor {
  role: string;
  profile?: string;
  profiles?: string[];
  contractVersion: string;
  required: boolean;
  path: string;
  mediaType: string;
  sha256: string;
  byteLength: number;
  recordCount: number | null;
  known: boolean;
  semanticsEnabled: boolean;
}

export interface ValidatedRawArtifact {
  descriptor: ArtifactDescriptor;
  bytes: Buffer;
}

export interface ProjectionLinkMetadataRow {
  relationId: string;
  releaseTier: string;
  sourceRelease: string;
  sourceReleaseHash: string;
  evidenceRefs: string[];
  sourceComponentRelease?: string;
  targetComponentRelease?: string;
  relationComponentRelease?: string;
  payload: JsonObject;
}

export interface CrosswalkRow {
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
}

export interface ValidatedComponentReference {
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  componentRole: string;
  referenceKind: 'legacy_exact' | 'standard_bundle';
  controlledPath: string;
  /** Present for legacy_exact component packages. */
  releaseJsonName?: string;
  /** Present for legacy_exact component packages (raw Release JSON hash). */
  releaseRawSha256?: string;
  /** Present for standard_bundle component packages. */
  bundleId?: string;
  /** Present for standard_bundle component packages. */
  bundleDigest?: string;
  /** Present for standard_bundle component packages (raw Manifest hash). */
  manifestSha256?: string;
  sourceCommit?: string;
}

export interface RecomputedStatistics {
  releaseEntries: number;
  knowledgeNodes: number;
  publishedRelations: number;
  projectionNodes: number;
  projectionLinks: number;
  ragCrosswalkRows: number;
  componentCount: number;
  relationTypeCount: number;
  [key: string]: number;
}

export interface ValidatedActKGBundle {
  /** Trusted ACT capture Git revision bound to this validation result. */
  captureRevision: string;
  /**
   * Governance disposition only. A true value does not enable Graph-RAG
   * consumption; it records that runtime intake remains blocked.
   */
  graphRagRuntimeIntakeBlocked: true;
  bundleIdentity: BundleIdentity;
  releaseIdentity: ReleaseIdentity;
  releaseSetIdentity: ReleaseSetIdentity;
  schemaIdentity: SchemaIdentity;
  selectedRuntimeProjection: {
    identity: ProjectionIdentity;
    payload: JsonObject;
  };
  preservedProjections: Array<{
    identity: ProjectionIdentity;
    payload: JsonObject;
  }>;
  runtimeLinkMetadata: ProjectionLinkMetadataRow[];
  allLinkMetadata: Array<{
    profiles: string[];
    path: string;
    rows: ProjectionLinkMetadataRow[];
  }>;
  crosswalk: CrosswalkRow[];
  components: ValidatedComponentReference[];
  /**
   * Complete public package bytes for packaging persistence and round-trip.
   * Includes every Manifest-declared Artifact plus reserved
   * `bundle-manifest.json` and `SHA256SUMS` (with descriptors).
   */
  rawArtifacts: ValidatedRawArtifact[];
  release: JsonObject;
  schema: JsonObject;
  statistics: RecomputedStatistics;
  compatibility: CompatibilityAssessment;
  unknownOptionalArtifacts: ArtifactDescriptor[];
}

/**
 * Lock v3 component entries.
 *
 * - Omitted `reference_kind` is treated as legacy_exact for backward compatibility
 *   with the reviewed v0.3 r2 lock data (no lock rewrite required).
 * - standard_bundle locks the controlled path plus Manifest raw hash / bundle id /
 *   digest; it does not require a Release JSON path.
 */
export interface ReleaseSetLockV3LegacyComponent {
  reference_kind?: 'legacy_exact';
  release_id: string;
  controlled_path: string;
  release_json_name: string;
  release_raw_sha256: string;
}

export interface ReleaseSetLockV3StandardBundleComponent {
  reference_kind: 'standard_bundle';
  release_id: string;
  controlled_path: string;
  bundle_id: string;
  bundle_digest: string;
  manifest_raw_sha256: string;
}

export type ReleaseSetLockV3Component =
  | ReleaseSetLockV3LegacyComponent
  | ReleaseSetLockV3StandardBundleComponent;

export interface ReleaseSetLockV3 {
  lock_version: 'actkg-release-set-lock/v3';
  release_set_id: string;
  bundle: {
    controlled_path: string;
    bundle_id: string;
    bundle_revision: number;
    bundle_digest: string;
    manifest_raw_sha256: string;
  };
  release: {
    release_id: string;
    release_version: string;
    release_hash: string;
    source_dataset_hash: string;
  };
  compatibility: {
    bundle_contract_version: string;
    schema_version: string;
    schema_sha256: string;
  };
  source_revision: {
    commit: string;
    tag: string;
  };
  components: ReleaseSetLockV3Component[];
}

export type PublicBundleRouteKind =
  | 'legacy-exact-v0.2'
  | 'actkg-public-bundle/1'
  | 'actkg-public-bundle/2';

export interface PublicBundleRouteDecision {
  kind: PublicBundleRouteKind;
  controlledPath: string;
  hasManifest: boolean;
  reason: string;
}

export interface BundleIdentityV2 {
  protocol: 'actkg-public-bundle/2';
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
  bundleKind: 'module' | 'integration' | 'aggregate';
  releaseStage: 'candidate' | 'stable';
  bundleContractVersion: 'actkg-public-bundle/2';
  controlledPath: string;
  manifestRawSha256: string;
  sha256sumsRawSha256: string;
}

export interface RevisionIdentity {
  tag: string;
  commit: string;
}

export interface PublicBundleV2UpstreamRepositoryIdentity {
  repositoryId: string;
  remoteUrl: string;
}

/**
 * The immutable registry identity copied into the registered binding. This is
 * descriptive provenance, not a cryptographic signature.
 */
export interface PublicBundleV2RegistryIdentity {
  registryId: string;
  bundleContractVersion: string;
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
  manifestRawSha256: string;
  sha256sumsRawSha256: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  schemaVersion: string;
  schemaRawSha256: string;
}

/** Result returned by the separate upstream-Git admission check. */
export interface PublicBundleV2AdmissionResult {
  contractVersion: 'actkg-public-bundle-v2-admission/1';
  /** Gate-only outcome; this field is never copied into loader output. */
  status: 'PASS';
  registryIdentity: PublicBundleV2RegistryIdentity;
  upstreamRepository: PublicBundleV2UpstreamRepositoryIdentity;
  publicationRevision: RevisionIdentity;
  sourceRevision: RevisionIdentity;
}

export interface RegisteredAdmissionBundleIdentity {
  bundleContractVersion: 'actkg-public-bundle/2';
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
}

/**
 * Module-controlled registration provenance. The binding is derived from the
 * frozen registry at load time and never represents a Git operation performed
 * by the loader itself.
 */
export interface RegisteredAdmissionBinding {
  provenance: 'registry';
  verificationScope: 'admission-time';
  verifiedDuringLoad: false;
  registryIdentity: PublicBundleV2RegistryIdentity;
  upstreamRepository: PublicBundleV2UpstreamRepositoryIdentity;
  publicationRevision: RevisionIdentity;
  sourceRevision: RevisionIdentity;
  bundleIdentity: RegisteredAdmissionBundleIdentity;
}

export interface TypedProjectionProfileV2 {
  key: 'act' | 'domain' | 'review';
  manifestProfile: 'runtime' | 'domain' | 'review';
  profileId: string;
  profileSha256: string;
  projectionKind: string;
  profileVersion: string;
  mappingContractVersion: string;
  aggregationPolicy: string;
  payload: JsonObject;
}

export interface TypedMultilingualLabelV2 {
  entityId: string;
  language: string;
  label: string;
  labelType: string;
  terminologyAssertionId: string;
  payload: JsonObject;
}

export interface ValidatedComponentReferenceV2 {
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  componentRole: string;
  componentPath: string;
  componentSha256: string;
  sourceReleaseHash: string;
  sourceCommit: string;
  sourceTag?: string;
}

export interface RecomputedStatisticsV2 extends RecomputedStatistics {
  releaseNodes: number;
  terminologyAssertions: number;
}

/**
 * Storage-independent validated Bundle v2 result.
 * Downstream code must branch on `protocol` and must not treat this as
 * `ValidatedActKGBundle`.
 */
export interface ValidatedActKGBundleV2 {
  protocol: 'actkg-public-bundle/2';
  captureRevision: string;
  graphRagRuntimeIntakeBlocked: true;
  bundleIdentity: BundleIdentityV2;
  /** Source revision copied only from the raw Manifest. */
  manifestSourceRevision: RevisionIdentity;
  /** Registration provenance copied only from the frozen module registry. */
  registeredAdmissionBinding: RegisteredAdmissionBinding;
  releaseIdentity: ReleaseIdentity;
  schemaIdentity: SchemaIdentity;
  selectedRuntimeProjection: {
    identity: ProjectionIdentity;
    payload: JsonObject;
  };
  preservedProjections: Array<{
    identity: ProjectionIdentity;
    payload: JsonObject;
  }>;
  projectionProfiles: TypedProjectionProfileV2[];
  multilingualLabels: TypedMultilingualLabelV2[];
  runtimeLinkMetadata: ProjectionLinkMetadataRow[];
  allLinkMetadata: Array<{
    profiles: string[];
    path: string;
    rows: ProjectionLinkMetadataRow[];
  }>;
  crosswalk: CrosswalkRow[];
  components: ValidatedComponentReferenceV2[];
  rawArtifacts: ValidatedRawArtifact[];
  release: JsonObject;
  schema: JsonObject;
  statistics: RecomputedStatisticsV2;
  compatibility: CompatibilityAssessment;
  unknownOptionalArtifacts: ArtifactDescriptor[];
}
