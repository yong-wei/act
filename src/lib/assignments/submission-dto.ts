export type StudentQuestionResponseType = 'SUBJECTIVE_TEXT' | 'SUBJECTIVE_FILE';
export type StudentAssignmentState = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'PARSING' | 'AWAITING_REVIEW' | 'IN_REVIEW' | 'AWAITING_TEACHER_CONFIRMATION' | 'REVIEWED' | 'RESUBMISSION_REQUIRED' | 'OVERDUE';
export type StudentAssignmentNextAction = 'start-answering' | 'continue-answering' | 'view-history' | 'wait-for-processing' | 'wait-for-review' | 'view-feedback' | 'resubmit-question' | 'contact-teacher';
export interface StudentQuestionDto {
  id: string; stableQuestionId: string; orderIndex: number; responseType: StudentQuestionResponseType; points: number; promptText: string;
  state: 'NOT_STARTED' | 'DRAFT' | 'READY' | 'SUBMITTED'; version: number; currentAttemptNumber: number; textDraft: string | null;
  history: Array<{ id: string; attemptNumber: number; submittedAt: Date; textSnapshot: string | null; assets: Array<{ id: string; displayName: string; mimeType: string; sizeBytes: number; role: string; orderIndex: number | null; embeddedPosition: string | null; canDownload: true }> }>;
  assets: Array<{ id: string; displayName: string; mimeType: string; sizeBytes: number; state: string; finalizedAt: Date | null; role: string; orderIndex: number | null; embeddedPosition: string | null }>;
  attachmentOrderProvenance: 'student-arranged' | 'legacy-fallback' | null;
  resubmission: { state: string; reason: string; allowedResponseType: string; deadlineAt: Date } | null;
}
export interface StudentAssignmentDto {
  id: string; revisionId: string; title: string; instructions: string; availableAt: Date; dueAt: Date;
  state: StudentAssignmentState; nextAction: StudentAssignmentNextAction;
  contextStatus: 'CURRENT' | 'HISTORICAL'; historicalOnly: boolean; canMutate: boolean;
  submittedRequiredCount: number; requiredQuestionCount: number; questions: StudentQuestionDto[];
  approvedTotal?: number | null;
  feedbackStatus?: 'HIDDEN' | 'PUBLISHING' | 'BLOCKED' | 'PUBLISHED';
  policyReason?: string;
  feedback?: StudentAssignmentFeedbackDto[];
}

export interface StudentAssignmentFeedbackDto {
  snapshotId: string;
  questionId: string;
  questionTitle: string;
  questionTotal: number;
  criteria: Array<{ criterionId?: string; levelId?: string; score?: number; comment?: string }>;
  annotations: Array<{ id?: string; criterionId?: string; status?: string; comment?: string; anchor?: Record<string, unknown> }>;
  overallComment: string;
  approvedAt: Date;
  reviewedAssets: Array<{ id?: string; label?: string; href?: string; mimeType?: string; precision?: string }>;
  limitations: string[];
  resubmission: { state: string; reason: string; allowedResponseType: string; deadlineAt: Date } | null;
}

export function deriveStudentAssignmentPresentation(input: { persistedState: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED'; dueAt: Date; now: Date; lateClosed: boolean; downstreamState?: Exclude<StudentAssignmentState, 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'OVERDUE'> | null }): { state: StudentAssignmentState; nextAction: StudentAssignmentNextAction } {
  if (input.downstreamState) return { state: input.downstreamState, nextAction: input.downstreamState === 'REVIEWED' ? 'view-feedback' : input.downstreamState === 'RESUBMISSION_REQUIRED' ? 'resubmit-question' : input.downstreamState === 'PARSING' ? 'wait-for-processing' : 'wait-for-review' };
  if (input.persistedState !== 'SUBMITTED' && input.now > input.dueAt && input.lateClosed) return { state: 'OVERDUE', nextAction: 'contact-teacher' };
  if (input.persistedState === 'SUBMITTED') return { state: 'SUBMITTED', nextAction: 'view-history' };
  if (input.persistedState === 'IN_PROGRESS') return { state: 'IN_PROGRESS', nextAction: 'continue-answering' };
  return { state: 'NOT_STARTED', nextAction: 'start-answering' };
}

export function safePromptText(snapshot: unknown): string {
  if (typeof snapshot === 'string') return snapshot.slice(0, 20_000);
  if (snapshot && typeof snapshot === 'object') {
    const candidate = (snapshot as Record<string, unknown>).prompt ?? (snapshot as Record<string, unknown>).text;
    if (typeof candidate === 'string') return candidate.slice(0, 20_000);
  }
  return '';
}
