/**
 * Formal resource and teaching-projection remediation (#1515).
 *
 * This module owns the real corpus-execution contracts: ledgered resource
 * processing records, source provenance, per-resource hotword manifests,
 * the three-family relation closure, the complete Teaching Projection, and
 * the non-selectable handoff bundle. It reuses — never duplicates — the
 * shared coordination-allocation schema from
 * `latest-authority-oss-cutover`; remediation and the downstream cutover
 * seal and reopen one identical allocation record.
 */

export const FORMAL_RESOURCE_REMEDIATION_CONTRACT =
  'formal-resource-remediation/v1' as const;
export const RESOURCE_PROCESSING_RECORD_CONTRACT =
  'resource-processing-record/v1' as const;
export const EXTERNAL_INPUT_MANIFEST_CONTRACT =
  'remediation-external-input-manifest/v1' as const;
export const HOTWORD_MANIFEST_CONTRACT =
  'handout-derived-hotword-manifest/v1' as const;
export const PROCESSOR_REGISTRY_CONTRACT =
  'remediation-processor-registry/v1' as const;
export const REMEDIATION_ENVELOPE_CONTRACT =
  'remediation-formal-resource-envelope/v1' as const;
export const RELATION_REVIEW_PACK_CONTRACT =
  'remediation-relation-review-pack/v1' as const;
export const RELATION_COURSE_OWNER_DECISION_CONTRACT =
  'remediation-relation-course-owner-decision/v1' as const;
export const REMEDIATION_HANDOFF_CONTRACT =
  'remediation-handoff-manifest/v1' as const;
export const REMEDIATION_BUILDER_VERSION =
  'formal-resource-remediation-builder/v1' as const;

export const RESOURCE_DISPOSITIONS = ['INCLUDED', 'EXCLUDED'] as const;
export type ResourceDisposition = (typeof RESOURCE_DISPOSITIONS)[number];

export const REMEDIATION_ATOM_DISPOSITIONS = ['BOUND', 'NON_TEACHING'] as const;
export type RemediationAtomDisposition = (typeof REMEDIATION_ATOM_DISPOSITIONS)[number];

export const REMEDIATION_FAILURE_CODES = [
  'missing-source',
  'ambiguous-mapping',
  'hash-drift',
  'processor-failure',
  'qualification-failure',
  'anchor-failure',
  'launcher-failure',
  'privacy-violation',
  'unknown-disposition',
] as const;
export type RemediationFailureCode = (typeof REMEDIATION_FAILURE_CODES)[number];

export class FormalResourceRemediationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FormalResourceRemediationError';
    this.code = code;
  }
}

/** A governed content-addressed external input discovered outside Git. */
export interface ExternalInputManifest {
  readonly contract: typeof EXTERNAL_INPUT_MANIFEST_CONTRACT;
  readonly inputId: string;
  readonly contentSha256: string;
  readonly sizeBytes: number;
  /** Governed source registry identity (e.g. the Videos repository). */
  readonly sourceRegistryId: string;
  readonly sourceRevision: string;
  readonly relativePath: string;
  readonly mediaType: string;
  readonly manifestHash: string;
}

/**
 * One ledgered processing record per logical resource. Completion of the
 * remediation run is derived from reopening these records and their output
 * files, never from caller-provided hashes or writable completion fields.
 */
export interface ResourceProcessingRecord {
  readonly contract: typeof RESOURCE_PROCESSING_RECORD_CONTRACT;
  readonly recordId: string;
  readonly allocationHash: string;
  readonly resourceId: string;
  readonly resourceSubtype: string;
  readonly origin: 'ACTIVE_BASELINE' | 'NEW_DELTA';
  readonly sourceIdentity: string;
  readonly externalInputId: string | null;
  readonly processorIdentity: string;
  readonly validatorIdentity: string;
  readonly atomOutputIds: readonly string[];
  readonly mappingOutputIds: readonly string[];
  readonly anchorOutputIds: readonly string[];
  readonly launchOutputIds: readonly string[];
  readonly disposition: ResourceDisposition;
  readonly failureCodes: readonly RemediationFailureCode[];
  readonly limitations: readonly string[];
  readonly outputManifestHash: string;
}

/** One hotword manifest derived from the exact bound handout truth. */
export interface HotwordManifest {
  readonly contract: typeof HOTWORD_MANIFEST_CONTRACT;
  readonly manifestId: string;
  readonly allocationHash: string;
  readonly resourceId: string;
  readonly sourceResourceId: string;
  readonly sourceParagraphIds: readonly string[];
  readonly sourceContentSha256: string;
  readonly locale: string;
  readonly extractorVersion: string;
  readonly extractorConfigDigest: string;
  readonly terminologyRegistryId: string;
  readonly entries: readonly {
    readonly term: string;
    readonly weight: number;
    readonly pronunciationAlias?: string;
  }[];
  readonly exclusions: readonly { readonly term: string; readonly reason: string }[];
  readonly requestRepresentation: string;
  readonly manifestHash: string;
}

/** The frozen identity of one exact local processor (e.g. Fun-ASR-Nano). */
export interface ProcessorIdentity {
  readonly processorKind: 'fun-asr-nano' | 'whisper-diagnostic' | 'videos-importer'
    | 'handout-processor' | 'textbook-processor' | 'card-processor'
    | 'infograph-processor' | 'exercise-processor' | 'simulation-processor';
  readonly modelId: string | null;
  readonly modelRevision: string | null;
  readonly weightHashes: readonly string[];
  readonly quantization: string | null;
  readonly runtimeVersion: string | null;
  readonly apiVersion: string | null;
  readonly backend: string | null;
  readonly timestampMode: string | null;
  readonly hotwordContract: string | null;
  readonly decodingConfigDigest: string | null;
}

/** The sealed registry of processors admitted by this remediation run. */
export interface ProcessorRegistry {
  readonly contract: typeof PROCESSOR_REGISTRY_CONTRACT;
  readonly allocationHash: string;
  readonly processors: readonly {
    readonly identity: ProcessorIdentity;
    /** Sealed qualification receipt binding this exact identity, when required. */
    readonly qualificationReceiptId: string | null;
  }[];
  readonly registryHash: string;
}

/** One course-owner decision over a relation exception pack. */
export interface RelationCourseOwnerDecision {
  readonly contract: typeof RELATION_COURSE_OWNER_DECISION_CONTRACT;
  readonly decisionId: string;
  readonly reviewPackId: string;
  readonly canonicalId: string;
  readonly family: 'containment' | 'prerequisite' | 'association';
  readonly decision: 'accept' | 'reject' | 'replace' | 'no-relation';
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly evidenceRefs: readonly string[];
  readonly rationale: string;
  /** For `replace`: the replacement edge or disposition payload digest. */
  readonly replacementDigest: string | null;
  readonly decisionHash: string;
}

/** The non-selectable remediation handoff manifest for the downstream cutover. */
export interface RemediationHandoffManifest {
  readonly contract: typeof REMEDIATION_HANDOFF_CONTRACT;
  readonly builderVersion: typeof REMEDIATION_BUILDER_VERSION;
  readonly handoffId: string;
  readonly sealedAt: string;
  readonly selectable: false;
  readonly allocationHash: string;
  readonly authorityCaptureHash: string;
  readonly denominatorHash: string;
  readonly resourceEnvelopeHash: string;
  readonly closureReceiptHash: string;
  readonly teachingProjectionHash: string;
  readonly prerequisitePublicationHash: string;
  readonly domainFragmentsHash: string;
  readonly domainShardsHash: string;
  readonly consumerProjectionsHash: string;
  readonly processorRegistryHash: string;
  readonly reportsHash: string;
  readonly handoffHash: string;
}
