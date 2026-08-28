export const CONTRACT_SCHEMA = 'act-practice-lab-artifact-run-contract/v1' as const;
export const TOOL_VERSION = 'practice-lab-run-contract/1' as const;

export const SOURCE_KINDS = [
  'arena-preview',
  'arena-official-evaluation',
  'arena-submission',
  'practice-outcome',
  'simulation-run',
] as const;
export type ArtifactRunSourceKind = (typeof SOURCE_KINDS)[number];

export const AUTHORITIES = [
  'practice',
  'arena-artifact',
  'arena-evaluator',
  'arena-submission',
  'simulation-run',
] as const;
export type ArtifactRunAuthority = (typeof AUTHORITIES)[number];

export const EVALUATION_VISIBILITIES = ['preview', 'practice', 'official'] as const;
export type EvaluationVisibility = (typeof EVALUATION_VISIBILITIES)[number];

export const VISIBILITIES = ['public', 'private'] as const;
export type FieldVisibility = (typeof VISIBILITIES)[number];

export const HIDDEN_PUBLIC_KEYS = [
  'hiddenScenario',
  'hiddenInputs',
  'hiddenDataset',
  'referenceTrajectory',
  'rawAnswer',
  'qTable',
  'identificationInternals',
  'privateDataset',
  'modelSnapshot',
] as const;

export const DEFAULT_TOLERANCE_PROFILE = {
  absolute: 1e-6,
  relative: 1e-3,
} as const;

export interface ArtifactRunOwnerRef {
  readonly kind: 'student' | 'teacher-batch' | 'class' | 'system';
  readonly id: string;
}

export interface ArtifactRunIdentity {
  readonly schemaVersion: typeof CONTRACT_SCHEMA;
  readonly sourceKind: ArtifactRunSourceKind;
  readonly sourceId: string | null;
  readonly ownerRef: ArtifactRunOwnerRef;
  readonly authority: ArtifactRunAuthority;
  readonly taskId: string;
  readonly specHash: string;
  readonly artifactHash: string;
  readonly controllerSnapshotRef: string;
  readonly protocolVersion: string;
  readonly runtimeVersion: string;
  readonly modelVersion: string;
  readonly controllerSchemaVersion: string;
  readonly executor: 'browser' | 'worker' | 'server';
  readonly authoritySource: string;
  readonly modelRelation: 'surrogate' | 'identified';
  readonly teachingSemantics: string;
  readonly prohibitsMixedClaims: true;
  readonly parameterVisibility: FieldVisibility;
  readonly resultVisibility: FieldVisibility;
  readonly evaluationVisibility: EvaluationVisibility;
  readonly officialEligible: boolean;
  readonly seed: number | null;
  readonly checksum: string | null;
  readonly toleranceProfile: { readonly absolute: number; readonly relative: number };
  readonly canonicalIdentityHash: string;
}

export interface PublicRunProjection {
  readonly schemaVersion: typeof CONTRACT_SCHEMA;
  readonly sourceKind: ArtifactRunSourceKind;
  readonly taskId: string;
  readonly specHash: string;
  readonly artifactHash: string;
  readonly evaluationVisibility: EvaluationVisibility;
  readonly officialEligible: boolean;
  readonly modelRelation: 'surrogate' | 'identified';
  readonly teachingSemantics: string;
  readonly prohibitsMixedClaims: true;
  readonly executor: ArtifactRunIdentity['executor'];
  readonly authoritySource: string;
  readonly checksum: string | null;
  readonly summary: Record<string, number> | null;
  readonly traceRef: string | null;
}

export const CAPTURED_SOURCE_COMMIT = 'e41e0731f5815daa3a8e496914fc89c79afbfa38' as const;
