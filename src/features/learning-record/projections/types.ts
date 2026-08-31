export const PROJECTION_INDEPENDENT_LEARNER_MINIMUM = 5;

export const PROJECTION_STATUS = {
  qualified: 'qualified',
  partial: 'partial',
  stale: 'stale',
  conflict: 'conflict',
  unavailable: 'unavailable',
  failed: 'failed',
  unpublished: 'unpublished',
} as const;

export type ProjectionStatus = (typeof PROJECTION_STATUS)[keyof typeof PROJECTION_STATUS];

export const POINTER_MOVE = {
  create: 'create',
  advance: 'advance',
  duplicate: 'duplicate',
  stale: 'stale',
  conflict: 'conflict',
} as const;

export type PointerMove = (typeof POINTER_MOVE)[keyof typeof POINTER_MOVE];

export interface ProjectionAnchors {
  sourceEventIds: string[];
  sourceLogIds: string[];
  canonicalActivityIds: string[];
  canonicalResourceIds: string[];
  canonicalKnowledgeIds: string[];
  revision: string;
  captureRevision: string;
  schemaVersion: string;
  decoderVersion: string;
  materializerVersion: string;
}

export interface ProjectionTimes {
  trustedOccurredAt: string;
  receivedAt: string;
  materializedAt: string;
  reportedClientAt?: string;
}

export interface ProjectionEnvelope {
  subjectRef: string;
  scope: 'learner' | 'class';
  classId?: string;
  processingWatermark: string;
  stateWatermark: string;
  calculationVersion: string;
  captureRevision: string;
  generation: string;
  queueGeneration: string;
  cutoverFence: string;
  inputDigest: string;
  trustedSetDigest: string;
  outputDigest: string;
  coverage: number;
  freshness: string;
  confidence: number;
  qualification: ProjectionStatus;
  anchors: ProjectionAnchors;
  times: ProjectionTimes;
  rematerialization?: {
    decoderVersion: string;
    materializerVersion: string;
  };
}

export interface CurrentPointerRecord {
  subjectUserId: string;
  versionId: string;
  calculationVersion: string;
  generation: bigint;
  queueGeneration: bigint;
  stateWatermark: bigint;
  cutoverFence: bigint;
  inputDigest: string;
}

export interface PointerWriteDb {
  findUnique(args: { where: { userId: string } }): Promise<CurrentPointerRecord | null>;
  create?(args: { data: Record<string, unknown> }): Promise<unknown>;
  updateMany?(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
  upsert?(args: {
    where: { userId: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface ProjectionViewer {
  role: 'student' | 'teacher' | 'admin' | 'ai' | 'personalization';
  subjectUserId?: string;
  classIds?: string[];
}

export interface StudentProjectionRead {
  status: ProjectionStatus;
  envelope: ProjectionEnvelope | null;
  fields: {
    coverage: number;
    freshness: string | null;
    confidence: number | null;
    overallScore: number | null;
    provenanceRevision: string | null;
  };
  reason: string | null;
}

export interface TeacherClassProjectionRead {
  status: ProjectionStatus;
  independentLearnerCount: number;
  suppressed: boolean;
  coverage: number;
  aggregates: {
    averageScore: number | null;
    trend: string | null;
  } | null;
  reason: string | null;
}

export interface SafeFeatureRead {
  status: ProjectionStatus;
  subjectRef: string;
  coverage: number;
  confidence: number | null;
  freshness: string | null;
  provenanceRevision: string | null;
  masteryTarget: string | null;
}
