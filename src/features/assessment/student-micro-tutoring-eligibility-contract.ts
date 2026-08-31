import type { AdaptiveQuestionScope } from '@/features/assessment/adaptive-engine';

export type StudentMicroTutoringStage = AdaptiveQuestionScope;

export type StudentMicroTutoringUnavailableReason =
  | 'NOT_COVERED'
  | 'EVIDENCE_DRIFT'
  | 'RESOURCE_UNAVAILABLE'
  | 'VALIDATION_UNAVAILABLE'
  | 'ACCESS_REVOKED';

export interface StudentMicroTutoringEligibility {
  stage: StudentMicroTutoringStage;
  qualified: boolean;
  unavailableReason: StudentMicroTutoringUnavailableReason | null;
  retryAttribution: boolean;
}

const STAGE_LABELS: Record<StudentMicroTutoringStage, string> = {
  practice: '常规练习',
  readiness: '准备度练习',
  checkpoint: '检查点练习',
  remediation: '补救练习',
  'terminal-validation': '终结验证',
};

const UNAVAILABLE_COPY: Record<StudentMicroTutoringUnavailableReason, string> = {
  NOT_COVERED: '这道题还不在可编排的微辅导范围内。你可以重新作答，系统不会改写刚才的记录。',
  EVIDENCE_DRIFT: '题目内容已更新，当前作答不能用于微辅导。请重新作答，系统不会改写刚才的记录。',
  RESOURCE_UNAVAILABLE: '这道错题还没有可学习的微辅导资源。',
  VALIDATION_UNAVAILABLE: '这道错题还没有独立验证题，暂时不能开始微辅导。',
  ACCESS_REVOKED: '当前微辅导入口已不再对学生开放。',
};

export function normalizeStudentMicroTutoringStage(value: unknown): StudentMicroTutoringStage {
  if (typeof value !== 'string') return 'practice';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'practice' || normalized === 'low-stakes-practice') return 'practice';
  if (normalized === 'readiness' || normalized === 'readiness-gate' || normalized === 'precheck') {
    return 'readiness';
  }
  if (normalized === 'checkpoint') return 'checkpoint';
  if (normalized === 'remediation') return 'remediation';
  if (normalized === 'terminal-validation') return 'terminal-validation';
  return 'practice';
}

export function studentMicroTutoringStageLabel(stage: StudentMicroTutoringStage): string {
  return STAGE_LABELS[stage];
}

export function studentMicroTutoringUnavailableCopy(
  reason: StudentMicroTutoringUnavailableReason,
): string {
  return UNAVAILABLE_COPY[reason];
}

export function isStudentMicroTutoringEligibility(
  value: unknown,
): value is StudentMicroTutoringEligibility {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const stage = row.stage;
  const reason = row.unavailableReason;
  return (stage === 'practice'
      || stage === 'readiness'
      || stage === 'checkpoint'
      || stage === 'remediation'
      || stage === 'terminal-validation')
    && typeof row.qualified === 'boolean'
    && typeof row.retryAttribution === 'boolean'
    && (reason === null
      || reason === 'NOT_COVERED'
      || reason === 'EVIDENCE_DRIFT'
      || reason === 'RESOURCE_UNAVAILABLE'
      || reason === 'VALIDATION_UNAVAILABLE'
      || reason === 'ACCESS_REVOKED');
}
