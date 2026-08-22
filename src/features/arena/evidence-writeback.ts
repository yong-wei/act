import { materializeKaqEvidenceWriteback, projectKaqEvidenceWritebackForConsumer } from '@/lib/data-governance/kaq-evidence-writeback';
import { buildKaqArtifactVersionRefs } from '@/lib/kaq-artifact-versioning';

import type {
  ArenaAttemptStatus,
  ArenaEvidenceVisibilityState,
  ArenaSubmissionEvidenceWriteback,
  ArenaSubmissionRecord,
} from './submissions/types';
import {
  ARENA_OFFICIAL_TARGET,
  buildMissingArenaSubmissionEvidenceWriteback,
  getArenaAttemptStatus,
} from './submissions/evidence-status';
import { isArenaSubmissionEffectiveForRanking } from './submissions/ranking-policy';

export type {
  ArenaAttemptStatus,
  ArenaEvidenceVisibilityState,
  ArenaSubmissionEvidenceWriteback,
} from './submissions/types';
export {
  buildMissingArenaSubmissionEvidenceWriteback,
  getArenaAttemptStatus,
} from './submissions/evidence-status';

const CONTROL_CORRECTION_OFFICIAL_ARENA_TASKS = new Set([
  'task-second-order-lead-pid',
]);

export function buildArenaRankingExplanation(status: ArenaAttemptStatus): string {
  if (status === 'effective') return '有效尝试：计入个人最佳和优秀方案候选。';
  if (status === 'late') return '迟交尝试：保留记录，但不作为优秀方案或正式排名依据。';
  if (status === 'zero-score') return '零分尝试：保留诊断证据，但不标记为优秀方案。';
  if (status === 'duplicate-only') return '重复提交：复用既有评测，只保留诊断记录，不新增正式掌握证据。';
  return '无效尝试：保留失败原因，用于课堂复盘。';
}

function scoreConfidence(submission: ArenaSubmissionRecord): number {
  return Math.max(0, Math.min(1, submission.evaluation.score / 100));
}

function buildLimitedWriteback(
  submission: ArenaSubmissionRecord,
  attemptStatus: ArenaAttemptStatus,
  limitationCodes: string[],
  exposeLimitationCodes: boolean,
): ArenaSubmissionEvidenceWriteback {
  const reason = attemptStatus === 'late'
    ? '迟交官方提交已保留为诊断证据，但不写入终端掌握判定。'
    : attemptStatus === 'zero-score'
      ? '零分官方提交已保留为诊断证据，需要重新提交有效尝试后才能形成掌握证据。'
      : attemptStatus === 'invalid'
        ? '无效官方提交保留失败原因，不写入掌握证据。'
        : attemptStatus === 'duplicate-only'
          ? '重复官方提交复用既有评测，只保留诊断记录，不新增终端掌握判定。'
          : '官方提交缺少完整证据绑定，暂不能写入掌握证据。';

  return {
    status: 'blocked',
    sourceRef: { kind: 'ArenaSubmission', id: submission.id },
    attemptStatus,
    visibilityState: 'diagnostic-only',
    targetLabel: ARENA_OFFICIAL_TARGET.targetLabel,
    summary: reason,
    recoveryAction: '重新提交一次截止前、有效且非零分的官方 Arena 结果；若仍无法写回，请由教师在报告中复核证据绑定。',
    limitationCodes: exposeLimitationCodes ? limitationCodes : [],
    overlayCount: 0,
    terminalValidationAccepted: false,
  };
}

export function buildArenaSubmissionEvidenceWriteback(
  submission: ArenaSubmissionRecord,
  options: {
    actorId?: string;
    consumer?: 'student' | 'teacher' | 'admin' | 'service';
  } = {},
): ArenaSubmissionEvidenceWriteback {
  const attemptStatus = getArenaAttemptStatus(submission);
  const exposeLimitationCodes = options.consumer === 'teacher' || options.consumer === 'admin' || options.consumer === 'service';
  if (attemptStatus !== 'effective') {
    return buildLimitedWriteback(submission, attemptStatus, [`attempt-not-effective:${attemptStatus}`], exposeLimitationCodes);
  }

  if (!submission.userId) {
    return {
      status: 'blocked',
      sourceRef: { kind: 'ArenaSubmission', id: submission.id },
      attemptStatus,
      visibilityState: 'unavailable',
      targetLabel: ARENA_OFFICIAL_TARGET.targetLabel,
      summary: '官方提交缺少学生所有者，无法写入学生证据时间线。',
      recoveryAction: '教师需要在报告中复核提交身份，并重新触发带有学生身份的官方提交。',
      limitationCodes: exposeLimitationCodes ? ['missing-subject-owner'] : [],
      overlayCount: 0,
      terminalValidationAccepted: false,
    };
  }

  if (!CONTROL_CORRECTION_OFFICIAL_ARENA_TASKS.has(submission.taskId)) {
    return {
      status: 'degraded',
      sourceRef: { kind: 'ArenaSubmission', id: submission.id },
      attemptStatus,
      visibilityState: 'diagnostic-only',
      targetLabel: ARENA_OFFICIAL_TARGET.targetLabel,
      summary: '该 Arena 任务尚未绑定到 KAQ 目标，官方结果保留为诊断证据并继续参与排名。',
      recoveryAction: '教师报告中保留官方提交记录；管理员需要为该任务补充 KAQ 目标绑定后再重试写回，以获得完整掌握证据。',
      limitationCodes: exposeLimitationCodes ? ['missing-target-binding'] : [],
      overlayCount: 0,
      terminalValidationAccepted: false,
    };
  }

  const result = materializeKaqEvidenceWriteback({
    id: `arena-official:${submission.id}`,
    source: {
      sourceClass: 'arena-official',
      sourceId: submission.id,
      sourceRef: { kind: 'ArenaSubmission', id: submission.id },
      official: true,
      teacherApproved: false,
      aiGenerated: false,
    },
    subject: {
      ownerUserId: submission.userId,
      studentId: submission.userId,
      classId: submission.classId ?? null,
    },
    actor: {
      type: 'service',
      id: options.actorId ?? 'arena-evaluator',
    },
    privacyScope: 'student',
    materializedAt: submission.submittedAt,
    evidenceWindow: { from: null, to: submission.submittedAt },
    versionRefs: buildKaqArtifactVersionRefs(),
    contributions: [
      {
        domain: 'capability',
        objectiveId: ARENA_OFFICIAL_TARGET.objectiveId,
        graphNodeId: ARENA_OFFICIAL_TARGET.graphNodeId,
        learningGoalId: ARENA_OFFICIAL_TARGET.learningGoalId,
        confidence: scoreConfidence(submission),
        terminalValidationCandidate: true,
      },
    ],
  });
  const projected = projectKaqEvidenceWritebackForConsumer(result, options.consumer ?? 'student');
  const terminalValidationAccepted = result.overlayUpdates.some((update) => update.terminalValidationAccepted);
  const summary = result.status === 'accepted'
    ? '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。'
    : result.status === 'degraded'
      ? '官方 Arena 结果已形成受限证据；限制原因会在教师报告中保留。'
      : '官方 Arena 结果未能写入学生证据时间线。';

  return {
    status: result.status,
    sourceRef: { kind: 'ArenaSubmission', id: submission.id },
    attemptStatus,
    visibilityState: result.status === 'accepted'
      ? 'materialized'
      : result.status === 'degraded'
        ? 'diagnostic-only'
        : 'unavailable',
    targetLabel: ARENA_OFFICIAL_TARGET.targetLabel,
    summary,
    recoveryAction: result.status === 'accepted'
      ? '无需处理；教师报告可直接引用该官方证据。'
      : '请教师在报告中检查限制代码，必要时重新触发官方提交或补充目标绑定。',
    limitationCodes: exposeLimitationCodes ? result.audit.limitationCodes : [],
    overlayCount: result.overlayUpdates.length,
    terminalValidationAccepted,
    projected,
  };
}
