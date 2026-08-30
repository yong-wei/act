import type {
  ArenaAttemptStatus,
  ArenaSubmissionEvidenceWriteback,
  ArenaSubmissionRecord,
} from './types';
import {
  getRegisteredPersonalizationGoalPlugin,
  resolvePersonalizationGoalContext,
  type PersonalizationArenaOfficialTarget,
} from '@/features/personalization/plugins/public-api';

export const GENERIC_ARENA_OFFICIAL_TARGET_LABEL = 'Arena 官方提交';

export function resolveArenaOfficialTarget(
  taskId: string,
): PersonalizationArenaOfficialTarget | null {
  const resolution = resolvePersonalizationGoalContext({ taskId });
  if (resolution.status !== 'resolved') return null;
  const plugin = getRegisteredPersonalizationGoalPlugin(resolution.context.goalId);
  if (!plugin || plugin.status !== 'active') return null;
  return plugin.arenaOfficialTarget ?? null;
}

export function arenaOfficialTargetLabel(taskId: string): string {
  return resolveArenaOfficialTarget(taskId)?.targetLabel ?? GENERIC_ARENA_OFFICIAL_TARGET_LABEL;
}

export function getArenaAttemptStatus(submission: ArenaSubmissionRecord): ArenaAttemptStatus {
  if (!submission.evaluation.valid) return 'invalid';
  if (submission.isLate) return 'late';
  if (submission.evaluation.score <= 0) return 'zero-score';
  if (submission.reusedEvaluation) return 'duplicate-only';
  return 'effective';
}

export function buildMissingArenaSubmissionEvidenceWriteback(
  submission: ArenaSubmissionRecord,
  options: {
    consumer?: 'student' | 'teacher' | 'admin' | 'service';
  } = {},
): ArenaSubmissionEvidenceWriteback {
  const exposeLimitationCodes = options.consumer === 'teacher' || options.consumer === 'admin' || options.consumer === 'service';
  return {
    status: 'degraded',
    sourceRef: { kind: 'ArenaSubmission', id: submission.id },
    attemptStatus: getArenaAttemptStatus(submission),
    visibilityState: 'unavailable',
    targetLabel: arenaOfficialTargetLabel(submission.taskId),
    summary: '官方提交尚未读取到持久化证据回流结果，保留原有排名资格但暂不作为掌握证据。',
    recoveryAction: '等待证据回流完成；若持续缺失，请由教师或管理员复核写回任务。',
    limitationCodes: exposeLimitationCodes ? ['missing-persisted-writeback'] : [],
    overlayCount: 0,
    terminalValidationAccepted: false,
  };
}
