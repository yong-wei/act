export type StudentAssignmentState = StudentAssignmentDto['state'];

export type StudentQuestionState = 'NOT_STARTED' | 'DRAFT' | 'UPLOADING' | 'READY' | 'SUBMITTED';

export interface StudentAssignmentQuestion {
  id: string;
  stableQuestionId: string;
  orderIndex: number;
  promptText: string;
  responseType: StudentQuestionDto['responseType'];
  points: number;
  required?: boolean;
  state: StudentQuestionState;
  version: number;
  currentAttemptNumber?: number | null;
  textDraft?: string | null;
  assets?: Array<{ id: string; displayName: string; sizeBytes?: number }>;
  resubmission?: { state: string; reason: string; allowedResponseType: string; deadlineAt: string } | null;
}

export interface StudentAssignmentSummary {
  id: string;
  revisionId: string;
  title: string;
  instructions: string;
  availableAt: string;
  dueAt: string | null;
  state: StudentAssignmentState;
  nextAction: StudentAssignmentDto['nextAction'] | null;
  submittedRequiredCount: number;
  requiredQuestionCount: number;
  questions: StudentAssignmentQuestion[];
  historicalOnly?: boolean;
  canMutate?: boolean;
  contextStatus?: StudentAssignmentDto['contextStatus'] | 'STALE';
  policyReason?: string | null;
}

export interface StudentAnswerAttempt extends Omit<StudentQuestionDto['history'][number], 'submittedAt'> {
  submittedAt: string;
  assets: StudentQuestionDto['history'][number]['assets'];
}

export interface StudentAssignmentDetail extends StudentAssignmentSummary {
  history?: Record<string, StudentAnswerAttempt[]>;
  approvedTotal?: number | null;
  feedbackStatus?: 'HIDDEN' | 'PUBLISHING' | 'BLOCKED' | 'PUBLISHED';
  feedback?: Array<{
    snapshotId: string;
    questionId: string;
    questionTitle: string;
    questionTotal: number;
    criteria: Array<{ criterionId?: string; levelId?: string; score?: number; comment?: string }>;
    annotations: Array<{ id?: string; criterionId?: string; status?: string; comment?: string; anchor?: Record<string, unknown> }>;
    overallComment: string;
    approvedAt: string;
    reviewedAssets: Array<{ id?: string; label?: string; href?: string; mimeType?: string; precision?: string }>;
    limitations: string[];
    resubmission: { state: string; reason: string; allowedResponseType: string; deadlineAt: string } | null;
  }>;
}

export const assignmentStateLabels: Record<StudentAssignmentState, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '作答中',
  SUBMITTED: '已提交',
  PARSING: '解析中',
  AWAITING_REVIEW: '待批阅',
  IN_REVIEW: '批阅中',
  AWAITING_TEACHER_CONFIRMATION: '待教师确认',
  REVIEWED: '已批阅',
  RESUBMISSION_REQUIRED: '需重交',
  OVERDUE: '已逾期',
};

export const questionStateLabels: Record<StudentQuestionState, string> = {
  NOT_STARTED: '未作答',
  DRAFT: '草稿已保存',
  UPLOADING: '附件上传中',
  READY: '可提交',
  SUBMITTED: '已提交',
};

export function formatAssignmentDeadline(value: string | Date | null): string {
  if (!value) return '无截止时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '截止时间待确认';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
import type { StudentAssignmentDto, StudentQuestionDto } from '@/lib/assignments/submission-dto';
