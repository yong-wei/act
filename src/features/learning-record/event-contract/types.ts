export const LEARNING_RECORD_SCHEMA_VERSION = '1';
export const LEARNING_RECORD_DECODER_VERSION = '1';
export const LEARNING_RECORD_MATERIALIZER_VERSION = '1';

export type PrivacyClassification =
  | 'public'
  | 'student-private'
  | 'teacher-scoped'
  | 'restricted';

export type SourceTrustClass =
  | 'server-authoritative'
  | 'web-untrusted-client-time'
  | 'outbox-authoritative'
  | 'legacy-compat';

export type LearningRecordErrorCode =
  | 'unknown-discriminator'
  | 'unsupported-schema-version'
  | 'scope-conflict'
  | 'authority-conflict'
  | 'schema-invalid'
  | 'dedupe-collision'
  | 'clock-skew'
  | 'cross-revision'
  | 'forbidden-field'
  | 'legacy-unsafe'
  | 'replay-unauthorized'
  | 'raw-artifact-forbidden'
  | 'retention-not-terminal';

export interface RegistryEntry {
  discriminator: string;
  schemaVersion: string;
  sourceVersion: string;
  action: string;
  owner: string;
  authority: string;
  privacyClassification: PrivacyClassification;
  payloadSchema?: Record<string, unknown>;
  trustClass: SourceTrustClass;
  clockSkewMs: number;
  migrated: boolean;
}

export interface LearningRecordAnchors {
  sourceEventId: string;
  sourceLogId?: string;
  canonicalActivityId?: string;
  canonicalResourceId?: string;
  canonicalKnowledgeId?: string;
  revision: string;
  captureRevision: string;
  schemaVersion: string;
  decoderVersion: string;
  materializerVersion: string;
}

export interface LearningRecordEnvelope {
  eventId: string;
  discriminator: string;
  schemaVersion: string;
  sourceVersion: string;
  action: string;
  owner: string;
  authority: string;
  privacyClassification: PrivacyClassification;
  trustedOccurredAt: string;
  receivedAt: string;
  materializedAt?: string;
  reportedClientAt?: string;
  clockSkew?: boolean;
  subjectRef: string;
  tenantRef?: string;
  courseRef?: string;
  sessionRef?: string;
  causationId: string;
  dedupeKey: string;
  payload: Record<string, string | number | boolean>;
  anchors: LearningRecordAnchors;
  inputDigest: string;
  trustedSetDigest: string;
}

export interface TrustedServerContext {
  subjectId: string;
  role: 'student' | 'teacher' | 'admin';
  producerAuthority: string;
  receivedAt: Date;
  tenantId?: string;
  courseId?: string;
  sessionId?: string;
  classId?: string;
  captureRevision: string;
  revision: string;
}

export interface ClientEventHint {
  discriminator?: string;
  schemaVersion?: string;
  action?: string;
  eventId?: string;
  sourceEventId?: string;
  sourceLogId?: string;
  causationId?: string;
  dedupeKey?: string;
  reportedClientAt?: string | number;
  subjectId?: string;
  role?: string;
  tenantId?: string;
  courseId?: string;
  sessionId?: string;
  classId?: string;
  payload?: Record<string, unknown>;
  revision?: string;
  captureRevision?: string;
}

export interface AcceptedLearningRecord {
  envelope: LearningRecordEnvelope;
  duplicate: boolean;
}

export interface LearningRecordAcceptanceStore {
  getByDedupeKey(key: string): Promise<AcceptedLearningRecord | null>;
  put(record: AcceptedLearningRecord): Promise<AcceptedLearningRecord>;
}
