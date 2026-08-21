import type {
  KaqEvidenceWritebackProjection,
  KaqEvidenceWritebackStatus,
} from '@/lib/data-governance/kaq-evidence-writeback';

import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ControllerArtifact } from '../types';

export type ArenaAttemptStatus = 'effective' | 'late' | 'zero-score' | 'invalid' | 'duplicate-only';
export type ArenaEvidenceVisibilityState = 'materialized' | 'diagnostic-only' | 'unavailable';

export interface ArenaSubmissionEvidenceWriteback {
  status: KaqEvidenceWritebackStatus;
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
  projected?: KaqEvidenceWritebackProjection;
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
  artifact: ControllerArtifact;
  evaluation: ArenaEvaluationResult;
  evaluationProtocolVersion?: string;
  evidenceWriteback?: ArenaSubmissionEvidenceWriteback;
  submittedAt: string;
  reusedEvaluation: boolean;
}

export interface CreateArenaSubmissionInput {
  taskId: string;
  artifact: ControllerArtifact;
  studentLabel: string;
  classId?: string;
  seasonId?: string;
  publicationId?: string;
  isLate?: boolean;
  submittedAt: string;
  existingSubmissions: ArenaSubmissionRecord[];
}
