import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { ControllerMethod } from '../types';
import type { ArenaPublicationGradingPolicy, ArenaPublicationVisibility } from './publication-store';

const WEAK_METRIC_THRESHOLD = 0.6;

export interface ArenaPublicationReportPublication {
  id: string;
  taskId: string;
  classId: string;
  deadline: string;
  visibility: ArenaPublicationVisibility;
  leaderboardPolicyId: string;
  gradingPolicy: ArenaPublicationGradingPolicy;
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
    method: ControllerMethod;
    submittedAt: string;
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

function sortByScoreDesc(left: { score: number; submittedAt: string }, right: { score: number; submittedAt: string }): number {
  return right.score - left.score || Date.parse(left.submittedAt) - Date.parse(right.submittedAt);
}

function filterPublicationSubmissions(input: BuildArenaPublicationReportInput): ArenaSubmissionRecord[] {
  return input.submissions.filter((submission) => (
    submission.publicationId === input.publication.id
    && submission.taskId === input.publication.taskId
    && (input.publication.visibility !== 'class' || submission.classId === input.publication.classId)
  ));
}

function buildScoreSummary(submissions: readonly ArenaSubmissionRecord[]): ArenaPublicationReport['scores'] {
  if (submissions.length === 0) {
    return { average: null, median: null, highest: null };
  }

  const scores = submissions
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
    const userId = submission.userId ?? submission.studentLabel;
    const candidate = {
      userId,
      studentLabel: submission.studentLabel,
      submissionId: submission.id,
      score: submission.evaluation.score,
      valid: submission.evaluation.valid,
      method: submission.artifact.method,
      submittedAt: submission.submittedAt,
    };
    const current = bestByStudent.get(userId);
    if (!current || sortByScoreDesc(candidate, current) < 0) {
      bestByStudent.set(userId, candidate);
    }
  }

  return Array.from(bestByStudent.values()).sort(sortByScoreDesc);
}

function buildExcellentSolutions(
  submissions: readonly ArenaSubmissionRecord[],
  limit: number,
): ArenaPublicationReport['excellentSolutions'] {
  return submissions
    .filter((submission) => submission.evaluation.valid)
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
      validCount: current.validCount + (submission.evaluation.valid ? 1 : 0),
      scoreTotal: current.scoreTotal + submission.evaluation.score,
    });
  }

  return Array.from(groups.entries())
    .map(([method, group]) => ({
      method,
      count: group.count,
      validCount: group.validCount,
      averageScore: group.count > 0 ? roundTwo(group.scoreTotal / group.count) : null,
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
    return '截止前隐藏完整同伴榜单；教师报告仍可用于查看进度、未提交和课堂复盘证据。';
  }
  return '榜单实时可见；教师报告中的分数与方法分布仍应作为教学反馈，不直接等同作业成绩。';
}

function buildGradingMessage(publication: ArenaPublicationReportPublication): string {
  if (publication.gradingPolicy.hideFullLeaderboardBeforeDeadline) {
    return '作业评价以达标提交、指标掌握和诊断证据为主，排行榜名次只作为比较反馈。';
  }
  return '当前发布不强制隐藏完整榜单，报告仍区分官方评价结果与作业评价解释。';
}

export function buildArenaPublicationReport(input: BuildArenaPublicationReportInput): ArenaPublicationReport {
  const scopedSubmissions = filterPublicationSubmissions(input);
  const participantUserIds = new Set(scopedSubmissions.map((submission) => submission.userId ?? submission.studentLabel));
  const roster = input.publication.visibility === 'class' ? input.roster ?? [] : [];
  const nonSubmitters = roster.filter((student) => !participantUserIds.has(student.userId));
  const validSubmissionCount = scopedSubmissions.filter((submission) => submission.evaluation.valid).length;
  const hardConstraintFailures = buildHardConstraintFailures(scopedSubmissions);
  const weakMetrics = buildWeakMetrics(scopedSubmissions);
  const methodDistribution = buildMethodDistribution(scopedSubmissions);
  const excellentSolutions = buildExcellentSolutions(scopedSubmissions, input.excellentSolutionLimit ?? 5);

  return {
    publication: input.publication,
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
