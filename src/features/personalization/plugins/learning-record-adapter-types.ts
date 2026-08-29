import type { ReplayAuthorization } from '@/features/learning-record/event-contract/replay';

export const COURSE_ADAPTER_MATERIALIZATIONS = [
  'direct',
  'outbox',
  'correction',
  'replay',
  'backfill',
] as const;

export type CourseAdapterMaterialization = (typeof COURSE_ADAPTER_MATERIALIZATIONS)[number];

export type CourseAdapterRejectReason =
  | 'missing-goal'
  | 'unknown-mapping'
  | 'plugin-unavailable'
  | 'adapter-unavailable'
  | 'version-mismatch'
  | 'revision-mismatch'
  | 'stale-capture'
  | 'ambiguous-identity'
  | 'missing-canonical-identity'
  | 'forbidden-field'
  | 'official-overwrite-attempt'
  | 'raw-artifact-forbidden'
  | 'replay-unauthorized'
  | 'cross-revision';

export interface CourseAdapterRawArtifactRef {
  digest: string;
  expiresAt: string;
  accessPolicy: string;
}

export interface CourseAdapterOfficialArenaResult {
  score: number;
  valid: boolean;
  submissionId: string;
}

export interface CourseAdapterRebaseReceipt {
  sourceRevision: string;
  targetRevision: string;
  authorizedBy: string;
}

export interface CourseAdapterMapInput {
  goalId?: string | null;
  pluginId?: string | null;
  pluginVersion?: string | null;
  adapterVersion?: string | null;
  schemaVersion?: string | null;
  releaseRevision?: string | null;
  captureRevision: string;
  expectedCaptureRevision?: string | null;
  canonicalLessonId?: string | null;
  canonicalResourceId?: string | null;
  canonicalActivityId?: string | null;
  arenaReference?: {
    taskId?: string | null;
    submissionId?: string | null;
  } | null;
  sourceEventId: string;
  sourceLogId?: string | null;
  normalizedValue?: number | null;
  confidence?: number | null;
  trustedOccurredAt: string;
  receivedAt: string;
  reportedClientAt?: string | null;
  subjectRef: string;
  scopeRef?: string | null;
  idempotencyKey: string;
  materialization: CourseAdapterMaterialization;
  rawArtifactRef?: CourseAdapterRawArtifactRef | null;
  officialArenaResult?: CourseAdapterOfficialArenaResult | null;
  rebaseReceipt?: CourseAdapterRebaseReceipt | null;
  replayAuthorization?: ReplayAuthorization | null;
  extra?: Record<string, unknown> | null;
}

export interface NormalizedCourseEvidenceMapping {
  goalId: string;
  pluginId: string;
  pluginVersion: string;
  adapterId: string;
  adapterVersion: string;
  schemaVersion: string;
  captureRevision: string;
  releaseRevision: string;
  canonicalLessonId?: string;
  canonicalResourceId?: string;
  canonicalActivityId?: string;
  arenaReference?: { taskId: string; submissionId?: string };
  contributionKind: 'auxiliary-learning-evidence';
  cannotOverrideOfficial: true;
  sourceEventId: string;
  sourceLogId?: string;
  revision: string;
  decoderVersion: string;
  materializerVersion: string;
  normalizedValue: number | null;
  confidence: number | null;
  quality: 'missing' | 'low' | 'medium' | 'high';
  coverage: 'missing' | 'partial' | 'sufficient';
  trustedOccurredAt: string;
  receivedAt: string;
  reportedClientAt?: string;
  subjectRef: string;
  scopeRef?: string;
  idempotencyKey: string;
  materialization: CourseAdapterMaterialization;
  inputDigest: string;
  trustedSetDigest: string;
  officialAuthority: {
    owner: 'arena-submission-result';
    score: number | null;
    valid: boolean | null;
    submissionId: string | null;
    conflict: boolean;
  };
  rawArtifactRef?: CourseAdapterRawArtifactRef;
}

export interface PersonalizationAdapterProjection {
  goalId: string;
  pluginId: string;
  pluginVersion: string;
  quality: NormalizedCourseEvidenceMapping['quality'];
  coverage: NormalizedCourseEvidenceMapping['coverage'];
  provenance: {
    adapterId: string;
    adapterVersion: string;
    captureRevision: string;
    sourceEventId: string;
    officialAuthority: 'arena-submission-result';
  };
}

export type CourseAdapterMapResult =
  | { status: 'mapped'; mapping: NormalizedCourseEvidenceMapping }
  | {
      status: 'rejected';
      reason: CourseAdapterRejectReason;
      diagnostic: { code: string; fingerprint: string; stage: 'adapter' };
    }
  | { status: 'not-applicable' };

export interface CourseLearningRecordAdapter {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly schemaVersion: string;
  readonly releaseRevision: string;
  map(input: CourseAdapterMapInput): CourseAdapterMapResult;
  projectPersonalization(mapping: NormalizedCourseEvidenceMapping): PersonalizationAdapterProjection;
}
