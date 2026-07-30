import {
  ARENA_CHALLENGE_TASKS,
  ARENA_TRAINING_CAPABILITY_LABELS,
  ARENA_TRAINING_STAGE_LABELS,
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaMetricProfile,
} from './data/seed-challenges';
import { buildArenaLeaderboard } from './leaderboards/leaderboard';
import type { ArenaSubmissionRecord } from './submissions/submission-service';
import type { ArenaTrainingCapabilityId, ArenaTrainingStageId, ChallengeObjectSource, ControllerMethod } from './types';

const FAILURE_SCORE_THRESHOLD = 50;
const IMPROVEMENT_THRESHOLD = 0.15;
const PORTFOLIO_RECENT_LIMIT = 5;
const PORTFOLIO_SIGNAL_LIMIT = 3;
const STRONG_CAPABILITY_SCORE = 80;
const WEAK_CAPABILITY_SCORE = 60;
const WEAK_METRIC_SATISFACTION = 0.6;
const stageOrder = Object.keys(ARENA_TRAINING_STAGE_LABELS) as ArenaTrainingStageId[];

export interface ArenaPortfolioMethodCount {
  method: ControllerMethod;
  count: number;
}

export interface ArenaPortfolioIdentificationModel {
  taskId: string;
  taskTitle: string;
  datasetHash: string;
  identificationModelId: string;
  submittedAt: string;
}

export interface ArenaPortfolioSubmissionSummary {
  total: number;
  valid: number;
  invalid: number;
  latestSubmittedAt?: string;
}

export interface ArenaPortfolioRecentSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  method: ControllerMethod;
  score: number;
  valid: boolean;
  submittedAt: string;
}

export interface ArenaPortfolioTaskRank {
  taskId: string;
  taskTitle: string;
  submissionId: string;
  bestScore: number;
  rank: number;
  submittedAt: string;
}

export interface ArenaPortfolioFailureObject {
  objectId: string;
  objectName: string;
  source: ChallengeObjectSource;
  failureCount: number;
  latestSubmittedAt: string;
}

export interface ArenaPortfolioImprovingMetric {
  taskId: string;
  taskTitle: string;
  metricId: string;
  metricLabel: string;
  firstSatisfaction: number;
  latestSatisfaction: number;
  delta: number;
}

export interface ArenaPortfolioCapabilityGrowth {
  capability: ArenaTrainingCapabilityId;
  label: string;
  submissionCount: number;
  validSubmissionCount: number;
  bestScore: number | null;
  averageScore: number | null;
  weakMetricIds: string[];
  latestSubmittedAt?: string;
  status: 'no-evidence' | 'needs-work' | 'developing' | 'improving' | 'strong';
  evidenceSummary: string;
}

export interface ArenaNextChallengeRecommendation {
  taskId: string;
  taskTitle: string;
  stage: ArenaTrainingStageId;
  stageLabel: string;
  capabilityLabels: string[];
  reason: string;
  evidenceLevel: 'beginner-safe' | 'capability-gap' | 'weak-metric' | 'next-stage';
  href: string;
}

export interface ArenaPortfolioGrowthSummary {
  evidenceAvailable: boolean;
  capabilityCoverage: {
    covered: number;
    total: number;
  };
  weakCapabilities: string[];
  improvingCapabilities: string[];
  strongCapabilities: string[];
  capabilitySignals: ArenaPortfolioCapabilityGrowth[];
  nextChallenges: ArenaNextChallengeRecommendation[];
}

export interface ArenaTrainingRunSummary {
  taskId: string;
  taskTitle: string;
  scenarioId: string;
  completedAt: string;
}

export interface ArenaTrainingSummary {
  runCount: number;
  recentRuns: ArenaTrainingRunSummary[];
}

export interface ArenaStudentPortfolio {
  userId: string;
  controllerCount: number;
  methodDistribution: ArenaPortfolioMethodCount[];
  identificationModels: ArenaPortfolioIdentificationModel[];
  submissionSummary: ArenaPortfolioSubmissionSummary;
  recentSubmissions: ArenaPortfolioRecentSubmission[];
  personalBestByTask: ArenaPortfolioTaskRank[];
  frequentFailureObjects: ArenaPortfolioFailureObject[];
  improvingMetrics: ArenaPortfolioImprovingMetric[];
  trainingSummary: ArenaTrainingSummary;
  growth: ArenaPortfolioGrowthSummary;
}

function sortBySubmittedAtAsc(left: ArenaSubmissionRecord, right: ArenaSubmissionRecord): number {
  return Date.parse(left.submittedAt) - Date.parse(right.submittedAt);
}

function sortBySubmittedAtDesc(left: { submittedAt: string }, right: { submittedAt: string }): number {
  return Date.parse(right.submittedAt) - Date.parse(left.submittedAt);
}

function roundSignal(value: number): number {
  return Math.round(value * 100) / 100;
}

function taskTitle(taskId: string): string {
  return getArenaChallengeTask(taskId)?.title ?? taskId;
}

function metricLabel(taskId: string, metricId: string): string {
  const task = getArenaChallengeTask(taskId);
  const profile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
  return profile?.rankingMetrics.find((metric) => metric.id === metricId)?.label ?? metricId;
}

function buildMethodDistribution(submissions: ArenaSubmissionRecord[]): ArenaPortfolioMethodCount[] {
  const counts = new Map<ControllerMethod, number>();
  for (const submission of submissions) {
    counts.set(submission.artifact.method, (counts.get(submission.artifact.method) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function buildIdentificationModels(submissions: ArenaSubmissionRecord[]): ArenaPortfolioIdentificationModel[] {
  const models = new Map<string, ArenaPortfolioIdentificationModel>();

  for (const submission of submissions) {
    const key = submission.taskId;
    const existing = models.get(key);
    if (!existing || Date.parse(submission.submittedAt) > Date.parse(existing.submittedAt)) {
      models.set(key, {
        taskId: submission.taskId,
        taskTitle: taskTitle(submission.taskId),
        datasetHash: submission.artifactHash,
        identificationModelId: `model-${submission.artifactHash.slice(0, 8)}`,
        submittedAt: submission.submittedAt,
      });
    }
  }

  return Array.from(models.values())
    .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt));
}

function bestScore(submissions: ArenaSubmissionRecord[]): number | null {
  if (submissions.length === 0) return null;
  return Math.max(...submissions.map((submission) => submission.evaluation.score));
}

function averageScore(submissions: ArenaSubmissionRecord[]): number | null {
  if (submissions.length === 0) return null;
  const total = submissions.reduce((sum, submission) => sum + submission.evaluation.score, 0);
  return roundSignal(total / submissions.length);
}

function weakMetricIds(submissions: ArenaSubmissionRecord[]): string[] {
  const metricScores = new Map<string, number[]>();
  for (const submission of submissions) {
    const task = getArenaChallengeTask(submission.taskId);
    if (!task) continue;
    const profile = getArenaMetricProfile(task.metricProfileId);
    if (!profile) continue;
    for (const metric of profile.rankingMetrics) {
      const metrics = submission.evaluation.metrics as Record<string, number> | undefined;
      const value = metrics?.[metric.id];
      if (typeof value === 'number') {
        const scores = metricScores.get(metric.id) ?? [];
        scores.push(value);
        metricScores.set(metric.id, scores);
      }
    }
  }

  const weak: string[] = [];
  for (const [metricId, scores] of metricScores) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < WEAK_METRIC_SATISFACTION) {
      weak.push(metricId);
    }
  }
  return weak;
}

function capabilityStatus(
  submissions: ArenaSubmissionRecord[],
  weakMetrics: string[],
): ArenaPortfolioCapabilityGrowth['status'] {
  if (submissions.length === 0) return 'no-evidence';
  const hasValid = submissions.some((submission) => submission.evaluation.valid);
  const best = bestScore(submissions);
  if (!hasValid || best === null) return 'needs-work';
  if (weakMetrics.length > 0) return 'developing';
  if (best >= WEAK_CAPABILITY_SCORE && best < STRONG_CAPABILITY_SCORE) return 'improving';
  if (hasValid && best >= STRONG_CAPABILITY_SCORE) return 'strong';
  return 'developing';
}

function buildCapabilityGrowth(submissions: ArenaSubmissionRecord[]): ArenaPortfolioCapabilityGrowth[] {
  const allCapabilityIds = Object.keys(ARENA_TRAINING_CAPABILITY_LABELS) as ArenaTrainingCapabilityId[];

  return allCapabilityIds.map((capability) => {
    const capabilitySubmissions = submissions.filter((submission) => {
      const task = getArenaChallengeTask(submission.taskId);
      return task?.training.capabilityTags.includes(capability) ?? false;
    });
    const weakMetrics = weakMetricIds(capabilitySubmissions);
    const status = capabilityStatus(capabilitySubmissions, weakMetrics);
    const capabilityBestScore = bestScore(capabilitySubmissions);

    return {
      capability,
      label: ARENA_TRAINING_CAPABILITY_LABELS[capability],
      submissionCount: capabilitySubmissions.length,
      validSubmissionCount: capabilitySubmissions.filter((submission) => submission.evaluation.valid).length,
      bestScore: capabilityBestScore === null ? null : roundSignal(capabilityBestScore),
      averageScore: averageScore(capabilitySubmissions),
      weakMetricIds: weakMetrics,
      latestSubmittedAt: capabilitySubmissions.length > 0
        ? capabilitySubmissions
            .slice()
            .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0]
            .submittedAt
        : undefined,
      status,
      evidenceSummary: capabilitySubmissions.length === 0
        ? '无提交证据'
        : status === 'needs-work'
          ? `有 ${capabilitySubmissions.length} 次提交但均未通过验证`
          : `${capabilitySubmissions.length} 次官方提交，最好 ${roundSignal(capabilityBestScore ?? 0)} 分`,
    } satisfies ArenaPortfolioCapabilityGrowth;
  });
}

function capabilityLabels(capabilities: readonly ArenaTrainingCapabilityId[]): string[] {
  return capabilities.map((capability) => ARENA_TRAINING_CAPABILITY_LABELS[capability]);
}

function stageIndex(stage: ArenaTrainingStageId): number {
  return stageOrder.indexOf(stage);
}

function buildBeginnerRecommendations(): ArenaNextChallengeRecommendation[] {
  return ARENA_CHALLENGE_TASKS
    .filter((task) => task.training.stage === 'foundation')
    .slice(0, 3)
    .map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      stage: task.training.stage,
      stageLabel: ARENA_TRAINING_STAGE_LABELS[task.training.stage],
      capabilityLabels: capabilityLabels(task.training.capabilityTags),
      reason: '暂无官方 Arena 提交证据，先从基础阶段建立可评价的第一条记录。',
      evidenceLevel: 'beginner-safe' as const,
      href: `/arena/challenges/${task.id}`,
    }));
}

function buildNextChallengeRecommendations(
  submissions: ArenaSubmissionRecord[],
  capabilitySignals: ArenaPortfolioCapabilityGrowth[],
): ArenaNextChallengeRecommendation[] {
  if (submissions.length === 0) {
    return buildBeginnerRecommendations();
  }

  const attemptedTaskIds = new Set(submissions.map((submission) => submission.taskId));
  const weakCapabilities = new Set(
    capabilitySignals
      .filter((signal) => signal.status === 'needs-work' || signal.status === 'developing')
      .map((signal) => signal.capability),
  );
  const weakMetrics = new Set(capabilitySignals.flatMap((signal) => signal.weakMetricIds));
  const highestStageIndex = Math.max(
    0,
    ...submissions
      .map((submission) => getArenaChallengeTask(submission.taskId)?.training.stage)
      .filter((stage): stage is ArenaTrainingStageId => Boolean(stage))
      .map(stageIndex),
  );

  const prerequisiteReadyCapabilities = new Set(
    capabilitySignals
      .filter((signal) => signal.status === 'improving' || signal.status === 'strong')
      .map((signal) => signal.capability),
  );

  const candidates = ARENA_CHALLENGE_TASKS
    .filter((task) => !attemptedTaskIds.has(task.id))
    .map((task) => {
      const missingPrerequisites = task.training.prerequisiteCapabilityTags.filter(
        (capability) => !prerequisiteReadyCapabilities.has(capability),
      );
      const weakOverlap = task.training.capabilityTags.filter((capability) => weakCapabilities.has(capability));
      const taskStageIndex = stageIndex(task.training.stage);
      const metricReason = task.primaryMetrics.find((metricId) => weakMetrics.has(metricId));
      let priority = 5;
      let evidenceLevel: ArenaNextChallengeRecommendation['evidenceLevel'] = 'next-stage';
      let reason = `进入${ARENA_TRAINING_STAGE_LABELS[task.training.stage]}阶段，延伸${capabilityLabels(task.training.capabilityTags).join('、')}训练。`;

      if (missingPrerequisites.length > 0) {
        priority = 6;
        evidenceLevel = 'capability-gap';
        reason = `先补齐${capabilityLabels(missingPrerequisites).join('、')}，再进入该挑战。`;
      } else if (weakOverlap.length > 0) {
        priority = 2;
        evidenceLevel = 'capability-gap';
        reason = `针对${capabilityLabels(weakOverlap).join('、')}的薄弱证据继续练习。`;
      } else if (metricReason) {
        priority = 3;
        evidenceLevel = 'weak-metric';
        reason = `围绕薄弱指标 ${metricReason} 选择下一项挑战。`;
      } else if (taskStageIndex > highestStageIndex) {
        priority = 4;
      }

      return {
        recommendation: {
          taskId: task.id,
          taskTitle: task.title,
          stage: task.training.stage,
          stageLabel: ARENA_TRAINING_STAGE_LABELS[task.training.stage],
          capabilityLabels: capabilityLabels(task.training.capabilityTags),
          reason,
          evidenceLevel,
          href: `/arena/challenges/${task.id}`,
        } satisfies ArenaNextChallengeRecommendation,
        priority,
        stageIndex: taskStageIndex,
      };
    })
    .sort((left, right) => (
      left.priority - right.priority
      || left.stageIndex - right.stageIndex
      || left.recommendation.taskTitle.localeCompare(right.recommendation.taskTitle, 'zh-Hans-CN')
    ));

  return candidates.slice(0, 3).map((candidate) => candidate.recommendation);
}

function buildGrowthSummary(submissions: ArenaSubmissionRecord[]): ArenaPortfolioGrowthSummary {
  const capabilitySignals = buildCapabilityGrowth(submissions);
  const weakCapabilities = capabilitySignals
    .filter((signal) => signal.status === 'needs-work')
    .map((signal) => signal.label);
  const improvingCapabilities = capabilitySignals
    .filter((signal) => signal.status === 'improving')
    .map((signal) => signal.label);
  const strongCapabilities = capabilitySignals
    .filter((signal) => signal.status === 'strong')
    .map((signal) => signal.label);

  return {
    evidenceAvailable: submissions.length > 0,
    capabilityCoverage: {
      covered: capabilitySignals.filter((signal) => signal.submissionCount > 0).length,
      total: capabilitySignals.length,
    },
    weakCapabilities,
    improvingCapabilities,
    strongCapabilities,
    capabilitySignals,
    nextChallenges: buildNextChallengeRecommendations(submissions, capabilitySignals),
  };
}

function buildPersonalBestByTask(
  allSubmissions: ArenaSubmissionRecord[],
  userSubmissions: ArenaSubmissionRecord[],
): ArenaPortfolioTaskRank[] {
  const taskBests = new Map<string, { score: number; submissionId: string; submittedAt: string }>();
  for (const submission of allSubmissions) {
    const existing = taskBests.get(submission.taskId);
    if (!existing || submission.evaluation.score > existing.score) {
      taskBests.set(submission.taskId, {
        score: submission.evaluation.score,
        submissionId: submission.id,
        submittedAt: submission.submittedAt,
      });
    }
  }

  const sorted = Array.from(taskBests.entries())
    .map(([taskId, best]) => ({
      taskId,
      taskTitle: taskTitle(taskId),
      submissionId: best.submissionId,
      bestScore: best.score,
      rank: 0,
      submittedAt: best.submittedAt,
    }))
    .sort((left, right) => right.bestScore - left.bestScore);

  sorted.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return sorted.filter((entry) =>
    userSubmissions.some((submission) => submission.taskId === entry.taskId),
  );
}

function buildFailureObjects(submissions: ArenaSubmissionRecord[]): ArenaPortfolioFailureObject[] {
  const objectFailures = new Map<string, { name: string; source: ChallengeObjectSource; count: number; latestSubmittedAt: string }>();

  for (const submission of submissions) {
    if (submission.evaluation.valid) continue;
    const object_ = getArenaChallengeObject(submission.taskId);
    if (!object_) continue;
    const key = object_.id;
    const existing = objectFailures.get(key);
    if (existing) {
      existing.count += 1;
      if (Date.parse(submission.submittedAt) > Date.parse(existing.latestSubmittedAt)) {
        existing.latestSubmittedAt = submission.submittedAt;
      }
    } else {
      objectFailures.set(key, {
        name: object_.name,
        source: object_.source,
        count: 1,
        latestSubmittedAt: submission.submittedAt,
      });
    }
  }

  return Array.from(objectFailures.entries())
    .map(([objectId, data]) => ({
      objectId,
      objectName: data.name,
      source: data.source,
      failureCount: data.count,
      latestSubmittedAt: data.latestSubmittedAt,
    }))
    .sort((left, right) => right.failureCount - left.failureCount)
    .slice(0, PORTFOLIO_SIGNAL_LIMIT);
}

function buildImprovingMetrics(submissions: ArenaSubmissionRecord[]): ArenaPortfolioImprovingMetric[] {
  const metrics = new Map<string, ArenaPortfolioImprovingMetric>();

  const sorted = submissions
    .slice()
    .sort(sortBySubmittedAtAsc);

  for (const submission of sorted) {
    const task = getArenaChallengeTask(submission.taskId);
    if (!task) continue;
    const profile = getArenaMetricProfile(task.metricProfileId);
    if (!profile) continue;

    for (const metric of profile.rankingMetrics) {
      const evalMetrics = submission.evaluation.metrics as Record<string, number> | undefined;
      const value = evalMetrics?.[metric.id];
      if (typeof value !== 'number') continue;

      const key = `${submission.taskId}|${metric.id}`;
      const existing = metrics.get(key);
      if (!existing) {
        metrics.set(key, {
          taskId: submission.taskId,
          taskTitle: taskTitle(submission.taskId),
          metricId: metric.id,
          metricLabel: metric.label,
          firstSatisfaction: value,
          latestSatisfaction: value,
          delta: 0,
        });
      } else {
        existing.latestSatisfaction = value;
        existing.delta = existing.latestSatisfaction - existing.firstSatisfaction;
      }
    }
  }

  return Array.from(metrics.values())
    .filter((metric) => metric.delta > IMPROVEMENT_THRESHOLD)
    .sort((left, right) => right.delta - left.delta)
    .slice(0, PORTFOLIO_SIGNAL_LIMIT);
}

function buildTrainingSummary(
  trainingRuns: Array<{ taskId: string; scenarioId: string; completedAt: string }>,
): ArenaTrainingSummary {
  const sorted = [...trainingRuns].sort(
    (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
  );
  return {
    runCount: sorted.length,
    recentRuns: sorted.slice(0, PORTFOLIO_RECENT_LIMIT).map((run) => ({
      taskId: run.taskId,
      taskTitle: taskTitle(run.taskId),
      scenarioId: run.scenarioId,
      completedAt: run.completedAt,
    })),
  };
}

export function buildArenaStudentPortfolio(
  submissions: readonly ArenaSubmissionRecord[],
  userId: string,
  trainingRuns?: Array<{ taskId: string; scenarioId: string; completedAt: string }>,
): ArenaStudentPortfolio {
  const userSubmissions = submissions
    .filter((submission) => submission.userId === userId)
    .slice()
    .sort(sortBySubmittedAtAsc);
  const latestSubmission = userSubmissions[userSubmissions.length - 1];

  const methodDistribution = buildMethodDistribution(userSubmissions);
  const identificationModels = buildIdentificationModels(userSubmissions);
  const improvingMetrics = buildImprovingMetrics(userSubmissions);

  return {
    userId,
    controllerCount: new Set(userSubmissions.map((submission) => submission.artifactHash)).size,
    methodDistribution,
    identificationModels,
    submissionSummary: {
      total: userSubmissions.length,
      valid: userSubmissions.filter((submission) => submission.evaluation.valid).length,
      invalid: userSubmissions.filter((submission) => !submission.evaluation.valid).length,
      latestSubmittedAt: latestSubmission?.submittedAt,
    },
    recentSubmissions: userSubmissions
      .slice()
      .sort(sortBySubmittedAtDesc)
      .slice(0, PORTFOLIO_RECENT_LIMIT)
      .map((submission) => ({
        id: submission.id,
        taskId: submission.taskId,
        taskTitle: taskTitle(submission.taskId),
        method: submission.artifact.method,
        score: submission.evaluation.score,
        valid: submission.evaluation.valid,
        submittedAt: submission.submittedAt,
      })),
    personalBestByTask: buildPersonalBestByTask(submissions, userSubmissions),
    frequentFailureObjects: buildFailureObjects(userSubmissions),
    improvingMetrics,
    trainingSummary: buildTrainingSummary(trainingRuns ?? []),
    growth: buildGrowthSummary(userSubmissions),
  };
}
