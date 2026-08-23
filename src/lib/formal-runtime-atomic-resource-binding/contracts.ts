/**
 * Formal Runtime atomic Canonical resource binding (#1503).
 *
 * Runtime Release v2 remains the only release selector. This module never
 * activates production or mutates current.json.
 */

export const FORMAL_RESOURCE_CONTRACT =
  'formal-runtime-atomic-resource-binding/v1' as const;
export const FORMAL_RESOURCE_INVENTORY_CONTRACT =
  'formal-runtime-resource-inventory/v1' as const;
export const FORMAL_RESOURCE_ATOM_CONTRACT =
  'formal-runtime-resource-atom/v1' as const;
export const FORMAL_RESOURCE_BINDING_CONTRACT =
  'formal-runtime-atomic-binding/v1' as const;
export const FORMAL_RESOURCE_ENVELOPE_CONTRACT =
  'formal-runtime-resource-envelope/v1' as const;
export const FORMAL_RESOURCE_BUILDER_VERSION =
  'formal-runtime-atomic-resource-binding-builder/v1' as const;
export const MEDIA_TIME_RULE_VERSION = 'media-paragraph-end-from-next-start/v1' as const;

export const FORMAL_RESOURCE_SUBTYPES = [
  'video',
  'audio',
  'podcast',
  'card',
  'textbook',
  'handout',
  'slides',
  'exercise',
  'simulation',
  'project',
  'lesson',
  'step',
] as const;
export type FormalResourceSubtype = (typeof FORMAL_RESOURCE_SUBTYPES)[number];

export const FORMAL_TEACHING_ROLES = [
  'COVERS',
  'EXPLAINS',
  'PRACTICES',
  'ASSESSES',
] as const;
export type FormalTeachingRole = (typeof FORMAL_TEACHING_ROLES)[number];

export const FORMAL_RESOURCE_DISPOSITIONS = ['INCLUDED', 'EXCLUDED'] as const;
export type FormalResourceDisposition = (typeof FORMAL_RESOURCE_DISPOSITIONS)[number];

export const FORMAL_ATOM_DISPOSITIONS = ['BOUND', 'NON_TEACHING', 'UNRESOLVED'] as const;
export type FormalAtomDisposition = (typeof FORMAL_ATOM_DISPOSITIONS)[number];

export const FORMAL_SOURCE_KINDS = ['git-blob', 'external-input'] as const;
export type FormalSourceKind = (typeof FORMAL_SOURCE_KINDS)[number];

export const FORMAL_ENTRY_CLASSIFICATIONS = ['resource', 'non-resource'] as const;
export type FormalEntryClassification = (typeof FORMAL_ENTRY_CLASSIFICATIONS)[number];

export const FORMAL_PIPELINE_KINDS = [
  'asr',
  'segmentation',
  'time-alignment',
  'canonical-mapping',
] as const;
export type FormalPipelineKind = (typeof FORMAL_PIPELINE_KINDS)[number];

export const FORMAL_VISUAL_FAMILIES = [
  'media',
  'text',
  'exercise',
  'simulation',
  'project',
] as const;
export type FormalVisualFamily = (typeof FORMAL_VISUAL_FAMILIES)[number];

export interface FormalAuthorityIdentity {
  readonly releaseId: string;
  readonly snapshotHash: string;
}

export interface FormalSourceIdentity {
  readonly kind: FormalSourceKind;
  readonly gitObjectId?: string;
  readonly externalInputId?: string;
  readonly contentSha256: string;
}

export interface FormalReleaseEntry {
  readonly entryId: string;
  readonly path: string;
  readonly source: FormalSourceIdentity;
  readonly classification: FormalEntryClassification;
  readonly subtype?: FormalResourceSubtype;
}

export interface FormalResourceCandidate {
  readonly contract: typeof FORMAL_RESOURCE_INVENTORY_CONTRACT;
  readonly resourceId: string;
  readonly subtype: FormalResourceSubtype;
  readonly courseScopeId: string;
  readonly source: FormalSourceIdentity;
  readonly deliveryMode: 'REQUIRED' | 'OPTIONAL';
  readonly disposition: FormalResourceDisposition;
  readonly exclusionReasons: readonly string[];
}

export interface FormalAtomAnchor {
  readonly kind: 'media-paragraph' | 'text-paragraph' | 'question-item';
  readonly startSeconds?: number;
  readonly endSeconds?: number;
  readonly durationSeconds?: number;
  readonly paragraphId?: string;
  readonly questionId?: string;
}

export interface FormalResourceAtom {
  readonly contract: typeof FORMAL_RESOURCE_ATOM_CONTRACT;
  readonly atomId: string;
  readonly resourceId: string;
  readonly subtype: FormalResourceSubtype;
  readonly contentSha256: string;
  readonly source: FormalSourceIdentity;
  readonly courseScopeId: string;
  readonly anchor: FormalAtomAnchor;
  readonly disposition: FormalAtomDisposition;
  readonly evidenceRefs: readonly string[];
}

export interface FormalBinding {
  readonly contract: typeof FORMAL_RESOURCE_BINDING_CONTRACT;
  readonly bindingId: string;
  readonly resourceId: string;
  readonly atomId: string;
  readonly canonicalId: string;
  readonly role: FormalTeachingRole;
  readonly scopeId: string;
  readonly envelopeHash: string;
  readonly source: FormalSourceIdentity;
}

export interface FormalQualificationReceipt {
  readonly pipelineKind: FormalPipelineKind;
  readonly pipelineVersion: string;
  readonly pipelineConfigDigest: string;
  readonly goldDigest: string;
  readonly holdoutDigest: string;
  readonly outputHash: string;
  readonly threshold: number;
  readonly passed: boolean;
  readonly receiptId: string;
}

export interface FormalResourceEnvelope {
  readonly contract: typeof FORMAL_RESOURCE_ENVELOPE_CONTRACT;
  readonly builderVersion: typeof FORMAL_RESOURCE_BUILDER_VERSION;
  readonly releaseId: string;
  readonly sourceRevision: string;
  readonly treeSha256: string;
  readonly authority: FormalAuthorityIdentity;
  readonly courseScopeId: string;
  readonly candidateCount: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly bindingCount: number;
  readonly candidateHash: string;
  readonly includedHash: string;
  readonly excludedHash: string;
  readonly bindingHash: string;
  readonly envelopeHash: string;
  readonly qualificationReceiptIds: readonly string[];
}

export interface FormalProductProjection {
  readonly title: string;
  readonly subtype: FormalResourceSubtype;
  readonly visualFamily: FormalVisualFamily;
  readonly role: FormalTeachingRole;
  readonly atomAnchorSummary: string;
  readonly launchDescriptor: {
    readonly kind: string;
    readonly atomId: string;
    readonly startSeconds?: number;
  };
}

export const FORBIDDEN_IDENTITY_SIGNALS = [
  'filename',
  'title',
  'url',
  'signed-url',
  'local-path',
  'runtime-registry',
  'successful-output-scan',
] as const;
