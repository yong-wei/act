export type ArenaAttemptStatus = 'effective' | 'late' | 'zero-score' | 'invalid' | 'duplicate-only';
export type ArenaEvidenceVisibilityState = 'materialized' | 'diagnostic-only' | 'unavailable';
export type ArenaEvidenceWritebackStatus = 'accepted' | 'degraded' | 'blocked';
export type ArenaControllerMethod =
  | 'serial-compensator'
  | 'pid'
  | 'optimized-pid'
  | 'composite-compensation'
  | 'mpc'
  | 'black-box-control'
  | 'code-controller';

export interface ArenaSubmissionControllerArtifact {
  id: string;
  taskId: string;
  method: ArenaControllerMethod;
  params: Record<string, number | string | boolean>;
  createdAt: string;
}

export interface ArenaSubmissionHardConstraintResult {
  id: string;
  label: string;
  passed: boolean;
  reason?: string;
}

export interface ArenaSubmissionEvaluationPenalty {
  id: string;
  label: string;
  value: number;
}

export interface ArenaSubmissionEvaluationResult {
  taskId: string;
  artifact: ArenaSubmissionControllerArtifact;
  valid: boolean;
  score: number;
  metrics: Record<string, number>;
  satisfaction: Record<string, number>;
  hardConstraintResults: ArenaSubmissionHardConstraintResult[];
  penalties: ArenaSubmissionEvaluationPenalty[];
  explanation: string[];
  metadata?: Record<string, unknown>;
}

export interface ArenaEvidenceWritebackProjection {
  id: string;
  status: ArenaEvidenceWritebackStatus;
  overlayUpdates: Array<{
    id: string;
    targetRef: unknown;
    sourceId: string | null;
    sourceRef: unknown | null;
    citationRefs: string[] | null;
  }>;
  audit: {
    targetRefs?: unknown[];
    versionRefs?: unknown;
    confidence?: number | null;
  } | null;
}

export interface ArenaSubmissionEvidenceWriteback {
  status: ArenaEvidenceWritebackStatus;
  sourceRef: {
    kind: 'ArenaSubmission';
    id: string;
  };
  attemptStatus: ArenaAttemptStatus;
  visibilityState: ArenaEvidenceVisibilityState;
  targetLabel: string;
  summary: string;
  recoveryAction: string;
  limitationCodes: string[];
  overlayCount: number;
  terminalValidationAccepted: boolean;
  projected?: ArenaEvidenceWritebackProjection;
}

export interface ArenaSubmissionRecord {
  id: string;
  taskId: string;
  userId?: string;
  classId?: string;
  seasonId?: string;
  publicationId?: string;
  isLate?: boolean;
  studentLabel: string;
  studentNumber?: string;
  artifactHash: string;
  artifact: ArenaSubmissionControllerArtifact;
  evaluation: ArenaSubmissionEvaluationResult;
  evaluationProtocolVersion?: string;
  evidenceWriteback?: ArenaSubmissionEvidenceWriteback;
  submittedAt: string;
  reusedEvaluation: boolean;
}

export interface CreateArenaSubmissionInput {
  taskId: string;
  artifact: ArenaSubmissionControllerArtifact;
  studentLabel: string;
  classId?: string;
  seasonId?: string;
  publicationId?: string;
  isLate?: boolean;
  submittedAt: string;
  existingSubmissions: ArenaSubmissionRecord[];
}
