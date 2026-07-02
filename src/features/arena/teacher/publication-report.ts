import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { isArenaSubmissionEffectiveForRanking } from '../submissions/ranking-policy';
import type { ControllerMethod } from '../types';
import { getArenaChallengeTask } from '../data/seed-challenges';
import {
  buildArenaRankingExplanation,
  buildMissingArenaSubmissionEvidenceWriteback,
  getArenaAttemptStatus,
  type ArenaAttemptStatus,
} from '../evidence-writeback';
import type { ArenaPublicationGradingPolicy, ArenaPublicationStatus, ArenaPublicationVisibility } from './publication-store';

const WEAK_METRIC_THRESHOLD = 0.6;

export interface ArenaPublicationReportPublication {
  id: string;
  taskId: string;
  classId: string;
  deadline: string;
  visibility: ArenaPublicationVisibility;
  leaderboardPolicyId: string;
  gradingPolicy: ArenaPublicationGradingPolicy;
  status?: ArenaPublicationStatus;
  context?: {
    assignmentTitle?: string;
    classTitle?: string;
    teacherName?: string;
    sourceLabel?: string;
  };
}

export interface ArenaPublicationReportRosterStudent {
  userId: string;
  studentLabel: string;
}

export interface BuildArenaPublicationReportInput {
  publication: ArenaPublicationReportPublication;
  submissions: readonly ArenaSubmissionRecord[];
  roster?: readonly ArenaPublicationReportRosterStudent[];
  excellentSolutionLimit?: number;
}

export interface ArenaPublicationReport {
  publication: ArenaPublicationReportPublication;
  publicationContext: {
    taskTitle: string;
    assignmentTitle: string;
    classTitle: string;
    teacherLabel: string;
    sourceLabel: string;
    deadlineLabel: string;
    reportTitle: string;
  };
  lifecycle: {
    state: 'active' | 'expired' | 'report-ready' | 'late-only' | 'unavailable';
    tone: 'success' | 'warning' | 'neutral' | 'muted';
    primaryLabel: string;
    detail: string;
    actionLabel: string;
  };
  leaderboardBoundary: {
    scope: 'global' | 'class' | 'assignment';
    sourceLabel: string;
    rankingSource: 'ArenaSubmission';
    attemptPolicy: 'best-effective-attempt';
    explanation: string;
  };
  deliveryActions: Array<{
    id: 'export-report' | 'send-report' | 'lock-board' | 'copy-commentary';
    label: string;
    statusLabel: string;
    available: boolean;
  }>;
  attemptPolicy: {
    officialSubmissionLabel: string;
    rankingSource: 'best-effective-attempt';
    effectiveRule: string;
    lateRule: string;
    zeroScoreRule: string;
    displayRule: string;
    effectiveSubmissionCount: number;
    lateSubmissionCount: number;
    zeroScoreSubmissionCount: number;
    invalidSubmissionCount: number;
    multipleSubmitterCount: number;
  };
  participation: {
    expectedStudentCount: number;
    participantCount: number;
    nonSubmitterCount: number;
    nonSubmitters: ArenaPublicationReportRosterStudent[];
  };
  submissions: {
    submissionCount: number;
    validSubmissionCount: number;
    invalidSubmissionCount: number;
    validSubmissionRate: number;
  };
  evidenceWriteback: {
    acceptedCount: number;
    degradedCount: number;
    blockedCount: number;
    terminalValidationAcceptedCount: number;
    latestLimitationCodes: string[];
    studentVisibleRule: string;
    teacherRecoveryRule: string;
  };
  scores: {
    average: number | null;
    median: number | null;
    highest: number | null;
  };
  hardConstraintFailures: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  weakMetrics: Array<{
    metricId: string;
    affectedSubmissionCount: number;
    lowestSatisfaction: number;
  }>;
  methodDistribution: Array<{
    method: ControllerMethod;
    count: number;
  }>;
  personalBests: Array<{
    userId: string;
    studentLabel: string;
    submissionId: string;
    score: number;
    valid: boolean;
    attemptStatus: ArenaAttemptStatus;
    effectiveForRanking: boolean;
    rankingExplanation: string;
    method: ControllerMethod;
    submittedAt: string;
    evidenceWritebackStatus: 'accepted' | 'degraded' | 'blocked';
  }>;
  excellentSolutions: Array<{
    userId?: string;
    studentLabel: string;
    submissionId: string;
    score: number;
    method: ControllerMethod;
    submittedAt: string;
  }>;
  classroomReview: {
    anonymizedByDefault: true;
    privacyNote: string;
    gradingMessage: string;
    leaderboardVisibilityMessage: string;
    participationSummary: string;
    typicalFailures: Array<{
      id: string;
      kind: 'hard-constraint' | 'weak-metric';
      label: string;
      count: number;
      reviewPrompt: string;
    }>;
    weakMetricPatterns: Array<{
      metricId: string;
      affectedSubmissionCount: number;
      lowestSatisfaction: number;
      reviewPrompt: string;
    }>;
    methodPatterns: Array<{
      method: ControllerMethod;
      count: number;
      validCount: number;
      averageScore: number | null;
    }>;
    showcaseCandidates: Array<{
      anonymousLabel: string;
      submissionId: string;
      score: number;
      method: ControllerMethod;
      evidenceSummary: string;
    }>;
  };
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildAttemptPolicy(submissions: readonly ArenaSubmissionRecord[]): ArenaPublicationReport['attemptPolicy'] {
  const attemptsByStudent = new Map<string, number>();
  let effectiveSubmissionCount = 0;
  let lateSubmissionCount = 0;
  let zeroScoreSubmissionCount = 0;
  let invalidSubmissionCount = 0;

  for (const submission of submissions) {
    const userId = submission.userId ?? submission.studentLabel;
    attemptsByStudent.set(userId, (attemptsByStudent.get(userId) ?? 0) + 1);
    if (isArenaSubmissionEffectiveForRanking(submission)) effectiveSubmissionCount += 1;
    if (submission.isLate) lateSubmissionCount += 1;
    if (submission.evaluation.valid && submission.evaluation.score <= 0) zeroScoreSubmissionCount += 1;
    if (!submission.evaluation.valid) invalidSubmissionCount += 1;
  }

  return {
    officialSubmissionLabel: '官方提交',
    rankingSource: 'best-effective-attempt',
    effectiveRule: '每名学生以最高分的有效尝试作为正式个人最佳；无有效尝试时仅显示最高记录并标注不计排名。',
    lateRule: '截止后提交标记为迟交，不进入优秀方案候选。',
    zeroScoreRule: '零分提交显示为诊断结果，不标记为优秀方案。',
    displayRule: '教师报告展示有效尝试统计、最高记录、优秀方案和全部尝试计数；学生侧保留最新提交、全部尝试记录和证据入口。',
    effectiveSubmissionCount,
    lateSubmissionCount,
    zeroScoreSubmissionCount,
    invalidSubmissionCount,
    multipleSubmitterCount: Array.from(attemptsByStudent.values()).filter((count) => count > 1).length,
  };
}

function buildEvidenceWritebackSummary(
  submissions: readonly ArenaSubmissionRecord[],
): ArenaPublicationReport['evidenceWriteback'] {
  const writebacks = submissions.map((submission) => (
    submission.evidenceWriteback ?? buildMissingArenaSubmissionEvidenceWriteback(submission, { consumer: 'teacher' })
  ));
  const latestLimitationCodes = Array.from(new Set(writebacks.flatMap((writeback) => writeback.limitationCodes))).sort();
  return {
    acceptedCount: writebacks.filter((writeback) => writeback.status === 'accepted').length,
    degradedCount: writebacks.filter((writeback) => writeback.status === 'degraded').length,
    blockedCount: writebacks.filter((writeback) => writeback.status === 'blocked').length,
    terminalValidationAcceptedCount: writebacks.filter((writeback) => writeback.terminalValidationAccepted).length,
    latestLimitationCodes,
    studentVisibleRule: '学生侧显示官方 ArenaSubmission 证据回流状态；迟交、零分和无效尝试只保留诊断证据。',
    teacherRecoveryRule: '教师报告保留限制代码；可要求学生重新提交有效官方结果，或由管理员补充 KAQ 目标绑定后重试。',
  };
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function buildPublicationContext(publication: ArenaPublicationReportPublication): ArenaPublicationReport['publicationContext'] {
  const taskTitle = getArenaChallengeTask(publication.taskId)?.title ?? '未命名 Arena 任务';
  const assignmentTitle = publication.context?.assignmentTitle ?? (
    publication.visibility === 'class' ? '班级 Arena 发布' : '课程 Arena 发布'
  );
  const classTitle = publication.context?.classTitle ?? (
    publication.visibility === 'public'
      ? '公开挑战'
      : publication.visibility === 'course'
        ? '课程范围'
        : `班级 ${publication.classId}`
  );
  const teacherLabel = publication.context?.teacherName ?? '教师发布';
  const sourceLabel = publication.context?.sourceLabel ?? (
    publication.visibility === 'public' ? '公开 Arena' : '课堂发布'
  );

  return {
    taskTitle,
    assignmentTitle,
    classTitle,
    teacherLabel,
    sourceLabel,
    deadlineLabel: formatDateLabel(publication.deadline),
    reportTitle: `${taskTitle} · ${assignmentTitle}`,
  };
}

function buildLifecycle(
  publication: ArenaPublicationReportPublication,
  submissions: readonly ArenaSubmissionRecord[],
): ArenaPublicationReport['lifecycle'] {
  const status = publication.status ?? 'active';
  if (status === 'archived' || status === 'closed') {
    return {
      state: 'report-ready',
      tone: 'neutral',
      primaryLabel: '报告已归档',
      detail: '挑战已结束，当前页面用于复盘官方提交与课堂证据。',
      actionLabel: '查看报告',
    };
  }
  if (status === 'draft' || status === 'paused') {
    return {
      state: 'unavailable',
      tone: 'muted',
      primaryLabel: status === 'draft' ? '尚未发布' : '已暂停',
      detail: '当前发布不接受新的官方提交，保留上下文供教师确认。',
      actionLabel: '查看上下文',
    };
  }

  const isExpired = Date.now() > Date.parse(publication.deadline);
  if (!isExpired) {
    return {
      state: 'active',
      tone: 'success',
      primaryLabel: '进行中',
      detail: '学生仍可在截止前提交官方 Arena 结果。',
      actionLabel: '查看挑战',
    };
  }
  if (publication.gradingPolicy.allowLateSubmissions) {
    return {
      state: 'late-only',
      tone: 'warning',
      primaryLabel: '已截止，可接收迟交',
      detail: `已有 ${submissions.length} 条官方提交；迟交保留记录但不进入优秀方案候选。`,
      actionLabel: '查看迟交与报告',
    };
  }
  return {
    state: 'expired',
    tone: 'warning',
    primaryLabel: '已截止',
    detail: '截止后不再接收新的正式提交，报告聚焦已形成的官方记录。',
    actionLabel: '查看报告',
  };
}

function buildLeaderboardBoundary(
  publication: ArenaPublicationReportPublication,
): ArenaPublicationReport['leaderboardBoundary'] {
  if (publication.visibility === 'public') {
    return {
      scope: 'global',
      sourceLabel: '公开全局榜单',
      rankingSource: 'ArenaSubmission',
      attemptPolicy: 'best-effective-attempt',
      explanation: '公开榜单只使用服务端 ArenaSubmission 官方记录；LearningFact 仅作辅助学习证据。',
    };
  }
  if (publication.visibility === 'course') {
    return {
      scope: 'assignment',
      sourceLabel: '课程任务榜单',
      rankingSource: 'ArenaSubmission',
      attemptPolicy: 'best-effective-attempt',
      explanation: '课程任务榜单按本发布的 ArenaSubmission 聚合，迟交、零分和无效尝试遵循提交口径说明。',
    };
  }
  return {
    scope: 'class',
    sourceLabel: '班级发布榜单',
    rankingSource: 'ArenaSubmission',
    attemptPolicy: 'best-effective-attempt',
    explanation: '班级榜单限定本发布与本班级的 ArenaSubmission；LearningFact Arena 上下文不能生成正式排名。',
  };
}

function buildDeliveryActions(
  lifecycle: ArenaPublicationReport['lifecycle'],
  submissions: readonly ArenaSubmissionRecord[],
): ArenaPublicationReport['deliveryActions'] {
  const hasSubmissions = submissions.length > 0;
  const isFinalState = lifecycle.state === 'expired' || lifecycle.state === 'report-ready';
  return [
    {
      id: 'export-report',
      label: '导出报告',
      statusLabel: hasSubmissions ? '可导出当前官方提交报告' : '暂无提交，导出上下文摘要',
      available: true,
    },
    {
      id: 'send-report',
      label: '发送/发布给学生',
      statusLabel: isFinalState ? '可发布复盘说明' : '进行中，建议截止后发布',
      available: isFinalState,
    },
    {
      id: 'lock-board',
      label: '锁定/定榜',
      statusLabel: isFinalState ? '可锁定当前榜单口径' : '榜单仍随有效提交更新',
      available: isFinalState,
    },
    {
      id: 'copy-commentary',
      label: '复制讲评',
      statusLabel: hasSubmissions ? '可复制课堂复盘讲评' : '可复制发布背景说明',
      available: true,
    },
  ];
}

function sortByScoreDesc(left: { score: number; submittedAt: string }, right: { score: number; submittedAt: string }): number {
  return right.score - left.score || Date.parse(left.submittedAt) - Date.parse(right.submittedAt);
}

function comparePersonalBest(left: ArenaPublicationReport['personalBests'][number], right: ArenaPublicationReport['personalBests'][number]): number {
  if (left.effectiveForRanking !== right.effectiveForRanking) {
    return left.effectiveForRanking ? -1 : 1;
  }
  return sortByScoreDesc(left, right);
}

function filterPublicationSubmissions(input: BuildArenaPublicationReportInput): ArenaSubmissionRecord[] {
  return input.submissions.filter((submission) => (
    submission.publicationId === input.publication.id
    && submission.taskId === input.publication.taskId
    && (input.publication.visibility !== 'class' || submission.classId === input.publication.classId)
  ));
}

function buildScoreSummary(submissions: readonly ArenaSubmissionRecord[]): ArenaPublicationReport['scores'] {
  const effectiveSubmissions = submissions.filter(isArenaSubmissionEffectiveForRanking);
  if (effectiveSubmissions.length === 0) {
    return { average: null, median: null, highest: null };
  }

  const scores = effectiveSubmissions
    .map((submission) => submission.evaluation.score)
    .sort((left, right) => left - right);
  const midpoint = Math.floor(scores.length / 2);
  const median = scores.length % 2 === 0
    ? (scores[midpoint - 1] + scores[midpoint]) / 2
    : scores[midpoint];
  const total = scores.reduce((sum, score) => sum + score, 0);

  return {
    average: roundTwo(total / scores.length),
    median: roundTwo(median),
    highest: roundTwo(scores[scores.length - 1]),
  };
}

function buildHardConstraintFailures(
  submissions: readonly ArenaSubmissionRecord[],
): ArenaPublicationReport['hardConstraintFailures'] {
  const failures = new Map<string, { label: string; count: number }>();

  for (const submission of submissions) {
    for (const result of submission.evaluation.hardConstraintResults) {
      if (result.passed) continue;
      const current = failures.get(result.id) ?? { label: result.label, count: 0 };
      failures.set(result.id, { label: current.label, count: current.count + 1 });
    }
  }

  return Array.from(failures.entries())
    .map(([id, failure]) => ({ id, label: failure.label, count: failure.count }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
}

function buildWeakMetrics(submissions: readonly ArenaSubmissionRecord[]): ArenaPublicationReport['weakMetrics'] {
  const weakMetrics = new Map<string, { affectedSubmissionCount: number; lowestSatisfaction: number }>();

  for (const submission of submissions) {
    for (const [metricId, satisfaction] of Object.entries(submission.evaluation.satisfaction)) {
      if (!Number.isFinite(satisfaction) || satisfaction >= WEAK_METRIC_THRESHOLD) continue;
      const current = weakMetrics.get(metricId) ?? { affectedSubmissionCount: 0, lowestSatisfaction: 1 };
      weakMetrics.set(metricId, {
        affectedSubmissionCount: current.affectedSubmissionCount + 1,
        lowestSatisfaction: Math.min(current.lowestSatisfaction, roundTwo(satisfaction)),
      });
    }
  }

  return Array.from(weakMetrics.entries())
    .map(([metricId, signal]) => ({ metricId, ...signal }))
    .sort((left, right) => (
      right.affectedSubmissionCount - left.affectedSubmissionCount
      || left.lowestSatisfaction - right.lowestSatisfaction
      || left.metricId.localeCompare(right.metricId)
    ));
}

function buildMethodDistribution(
  submissions: readonly ArenaSubmissionRecord[],
): ArenaPublicationReport['methodDistribution'] {
  const methods = new Map<ControllerMethod, number>();
  for (const submission of submissions) {
    methods.set(submission.artifact.method, (methods.get(submission.artifact.method) ?? 0) + 1);
  }

  return Array.from(methods.entries())
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function buildPersonalBests(submissions: readonly ArenaSubmissionRecord[]): ArenaPublicationReport['personalBests'] {
  const bestByStudent = new Map<string, ArenaPublicationReport['personalBests'][number]>();

  for (const submission of submissions) {
    if (!isArenaSubmissionEffectiveForRanking(submission)) continue;
    const userId = submission.userId ?? submission.studentLabel;
    const attemptStatus = getArenaAttemptStatus(submission);
    const evidenceWriteback = submission.evidenceWriteback ?? buildMissingArenaSubmissionEvidenceWriteback(submission, { consumer: 'teacher' });
    const candidate = {
      userId,
      studentLabel: submission.studentLabel,
      submissionId: submission.id,
      score: submission.evaluation.score,
      valid: submission.evaluation.valid,
      attemptStatus,
      effectiveForRanking: isArenaSubmissionEffectiveForRanking(submission),
      rankingExplanation: buildArenaRankingExplanation(attemptStatus),
      method: submission.artifact.method,
      submittedAt: submission.submittedAt,
      evidenceWritebackStatus: evidenceWriteback.status,
    };
    const current = bestByStudent.get(userId);
    if (!current || comparePersonalBest(candidate, current) < 0) {
      bestByStudent.set(userId, candidate);
    }
  }

  return Array.from(bestByStudent.values()).sort(comparePersonalBest);
}

function buildExcellentSolutions(
  submissions: readonly ArenaSubmissionRecord[],
  limit: number,
): ArenaPublicationReport['excellentSolutions'] {
  return submissions
    .filter(isArenaSubmissionEffectiveForRanking)
    .map((submission) => ({
      userId: submission.userId,
      studentLabel: submission.studentLabel,
      submissionId: submission.id,
      score: submission.evaluation.score,
      method: submission.artifact.method,
      submittedAt: submission.submittedAt,
    }))
    .sort(sortByScoreDesc)
    .slice(0, limit);
}

function buildTypicalFailures(
  hardConstraintFailures: ArenaPublicationReport['hardConstraintFailures'],
  weakMetrics: ArenaPublicationReport['weakMetrics'],
): ArenaPublicationReport['classroomReview']['typicalFailures'] {
  return [
    ...hardConstraintFailures.map((failure) => ({
      id: failure.id,
      kind: 'hard-constraint' as const,
      label: failure.label,
      count: failure.count,
      reviewPrompt: `复盘 ${failure.label} 约束失败的对象条件和控制器取舍。`,
    })),
    ...weakMetrics.map((metric) => ({
      id: metric.metricId,
      kind: 'weak-metric' as const,
      label: metric.metricId,
      count: metric.affectedSubmissionCount,
      reviewPrompt: `对照 ${metric.metricId} 的低满意度提交，讨论指标改善方向。`,
    })),
  ].sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
}

function buildWeakMetricPatterns(
  weakMetrics: ArenaPublicationReport['weakMetrics'],
): ArenaPublicationReport['classroomReview']['weakMetricPatterns'] {
  return weakMetrics.map((metric) => ({
    ...metric,
    reviewPrompt: `最低满意度 ${roundTwo(metric.lowestSatisfaction)}，优先检查该指标与其他指标的取舍。`,
  }));
}

function buildMethodPatterns(
  submissions: readonly ArenaSubmissionRecord[],
): ArenaPublicationReport['classroomReview']['methodPatterns'] {
  const groups = new Map<ControllerMethod, { count: number; validCount: number; scoreTotal: number }>();
  for (const submission of submissions) {
    const current = groups.get(submission.artifact.method) ?? { count: 0, validCount: 0, scoreTotal: 0 };
    groups.set(submission.artifact.method, {
      count: current.count + 1,
      validCount: current.validCount + (isArenaSubmissionEffectiveForRanking(submission) ? 1 : 0),
      scoreTotal: current.scoreTotal + (isArenaSubmissionEffectiveForRanking(submission) ? submission.evaluation.score : 0),
    });
  }

  return Array.from(groups.entries())
    .map(([method, group]) => ({
      method,
      count: group.count,
      validCount: group.validCount,
      averageScore: group.validCount > 0 ? roundTwo(group.scoreTotal / group.validCount) : null,
    }))
    .sort((left, right) => right.count - left.count || left.method.localeCompare(right.method));
}

function buildShowcaseCandidates(
  excellentSolutions: ArenaPublicationReport['excellentSolutions'],
): ArenaPublicationReport['classroomReview']['showcaseCandidates'] {
  return excellentSolutions.map((solution, index) => ({
    anonymousLabel: `匿名方案 ${index + 1}`,
    submissionId: solution.submissionId,
    score: solution.score,
    method: solution.method,
    evidenceSummary: `${solution.method} 方法，得分 ${roundTwo(solution.score)}，适合课堂比较设计证据。`,
  }));
}

function buildLeaderboardVisibilityMessage(publication: ArenaPublicationReportPublication): string {
  if (publication.gradingPolicy.hideFullLeaderboardBeforeDeadline) {
    return '截止前隐藏完整同伴榜单；教师报告以有效尝试解释进度、未提交和课堂复盘证据。';
  }
  return '榜单实时可见；教师报告仍区分有效尝试、迟交、零分和无效提交，不直接等同作业成绩。';
}

function buildGradingMessage(publication: ArenaPublicationReportPublication): string {
  if (publication.gradingPolicy.hideFullLeaderboardBeforeDeadline) {
    return '作业评价以达标提交、指标掌握和诊断证据为主，排行榜名次只作为比较反馈。';
  }
  return '当前发布不强制隐藏完整榜单，报告仍区分官方评价结果与作业评价解释。';
}

function withTeacherEvidenceWritebacks(
  submissions: readonly ArenaSubmissionRecord[],
): ArenaSubmissionRecord[] {
  return submissions.map((submission) => ({
    ...submission,
    evidenceWriteback: submission.evidenceWriteback ?? buildMissingArenaSubmissionEvidenceWriteback(submission, { consumer: 'teacher' }),
  }));
}

export function buildArenaPublicationReport(input: BuildArenaPublicationReportInput): ArenaPublicationReport {
  const scopedSubmissions = withTeacherEvidenceWritebacks(filterPublicationSubmissions(input));
  const participantUserIds = new Set(scopedSubmissions.map((submission) => submission.userId ?? submission.studentLabel));
  const roster = input.publication.visibility === 'class' ? input.roster ?? [] : [];
  const nonSubmitters = roster.filter((student) => !participantUserIds.has(student.userId));
  const validSubmissionCount = scopedSubmissions.filter((submission) => submission.evaluation.valid).length;
  const hardConstraintFailures = buildHardConstraintFailures(scopedSubmissions);
  const weakMetrics = buildWeakMetrics(scopedSubmissions);
  const methodDistribution = buildMethodDistribution(scopedSubmissions);
  const excellentSolutions = buildExcellentSolutions(scopedSubmissions, input.excellentSolutionLimit ?? 5);
  const lifecycle = buildLifecycle(input.publication, scopedSubmissions);

  return {
    publication: input.publication,
    publicationContext: buildPublicationContext(input.publication),
    lifecycle,
    leaderboardBoundary: buildLeaderboardBoundary(input.publication),
    deliveryActions: buildDeliveryActions(lifecycle, scopedSubmissions),
    attemptPolicy: buildAttemptPolicy(scopedSubmissions),
    participation: {
      expectedStudentCount: roster.length,
      participantCount: participantUserIds.size,
      nonSubmitterCount: nonSubmitters.length,
      nonSubmitters,
    },
    submissions: {
      submissionCount: scopedSubmissions.length,
      validSubmissionCount,
      invalidSubmissionCount: scopedSubmissions.length - validSubmissionCount,
      validSubmissionRate: scopedSubmissions.length > 0 ? validSubmissionCount / scopedSubmissions.length : 0,
    },
    evidenceWriteback: buildEvidenceWritebackSummary(scopedSubmissions),
    scores: buildScoreSummary(scopedSubmissions),
    hardConstraintFailures,
    weakMetrics,
    methodDistribution,
    personalBests: buildPersonalBests(scopedSubmissions),
    excellentSolutions,
    classroomReview: {
      anonymizedByDefault: true,
      privacyNote: '课堂复盘默认使用匿名方案与摘要证据，不展示原始控制器参数或私有提交载荷。',
      gradingMessage: buildGradingMessage(input.publication),
      leaderboardVisibilityMessage: buildLeaderboardVisibilityMessage(input.publication),
      participationSummary: `已参与 ${participantUserIds.size} 人，未提交 ${nonSubmitters.length} 人。`,
      typicalFailures: buildTypicalFailures(hardConstraintFailures, weakMetrics),
      weakMetricPatterns: buildWeakMetricPatterns(weakMetrics),
      methodPatterns: buildMethodPatterns(scopedSubmissions),
      showcaseCandidates: buildShowcaseCandidates(excellentSolutions),
    },
  };
}
