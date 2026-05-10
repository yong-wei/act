import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaMetricProfile,
} from './data/seed-challenges';
import { buildArenaLeaderboard } from './leaderboards/leaderboard';
import type { ArenaSubmissionRecord } from './submissions/submission-service';
import type { ChallengeObjectSource, ControllerMethod } from './types';

const FAILURE_SCORE_THRESHOLD = 50;
const IMPROVEMENT_THRESHOLD = 0.15;
const PORTFOLIO_RECENT_LIMIT = 5;
const PORTFOLIO_SIGNAL_LIMIT = 3;

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
    if (submission.artifact.method !== 'black-box-control') continue;

    const datasetHash = submission.artifact.params.experimentDatasetHash;
    const identificationModelId = submission.artifact.params.identificationModelId;
    if (typeof datasetHash !== 'string' || typeof identificationModelId !== 'string') continue;

    const key = `${submission.taskId}|${datasetHash}|${identificationModelId}`;
    const current = models.get(key);
    if (!current || Date.parse(submission.submittedAt) > Date.parse(current.submittedAt)) {
      models.set(key, {
        taskId: submission.taskId,
        taskTitle: taskTitle(submission.taskId),
        datasetHash,
        identificationModelId,
        submittedAt: submission.submittedAt,
      });
    }
  }

  return Array.from(models.values()).sort(sortBySubmittedAtDesc);
}

function buildPersonalBestByTask(
  allSubmissions: readonly ArenaSubmissionRecord[],
  userSubmissions: ArenaSubmissionRecord[],
): ArenaPortfolioTaskRank[] {
  const taskIds = Array.from(new Set(userSubmissions.map((submission) => submission.taskId)));
  const userSubmissionIds = new Set(userSubmissions.map((submission) => submission.id));

  return taskIds
    .map((taskId) => {
      const leaderboard = buildArenaLeaderboard(allSubmissions, { taskId, type: 'main' });
      const entry = leaderboard.entries.find((candidate) => userSubmissionIds.has(candidate.submissionId));
      if (!entry) return null;
      return {
        taskId,
        taskTitle: taskTitle(taskId),
        submissionId: entry.submissionId,
        bestScore: entry.score,
        rank: entry.rank,
        submittedAt: entry.submittedAt,
      } satisfies ArenaPortfolioTaskRank;
    })
    .filter((entry): entry is ArenaPortfolioTaskRank => Boolean(entry))
    .sort((left, right) => left.rank - right.rank || sortBySubmittedAtDesc(left, right));
}

function buildFailureObjects(submissions: ArenaSubmissionRecord[]): ArenaPortfolioFailureObject[] {
  const failures = new Map<string, ArenaPortfolioFailureObject>();

  for (const submission of submissions) {
    if (submission.evaluation.valid && submission.evaluation.score >= FAILURE_SCORE_THRESHOLD) {
      continue;
    }

    const task = getArenaChallengeTask(submission.taskId);
    if (!task) continue;
    const object = getArenaChallengeObject(task.objectId);
    if (!object) continue;

    const current = failures.get(object.id);
    failures.set(object.id, {
      objectId: object.id,
      objectName: object.name,
      source: object.source,
      failureCount: (current?.failureCount ?? 0) + 1,
      latestSubmittedAt:
        current && Date.parse(current.latestSubmittedAt) > Date.parse(submission.submittedAt)
          ? current.latestSubmittedAt
          : submission.submittedAt,
    });
  }

  return Array.from(failures.values())
    .sort((left, right) => (
      right.failureCount - left.failureCount
      || Date.parse(right.latestSubmittedAt) - Date.parse(left.latestSubmittedAt)
      || left.objectName.localeCompare(right.objectName, 'zh-Hans-CN')
    ))
    .slice(0, PORTFOLIO_SIGNAL_LIMIT);
}

function buildImprovingMetrics(submissions: ArenaSubmissionRecord[]): ArenaPortfolioImprovingMetric[] {
  const metricSignals = new Map<string, {
    metricId: string;
    taskId: string;
    first: { value: number; submittedAt: string };
    latest: { value: number; submittedAt: string };
  }>();

  for (const submission of submissions.slice().sort(sortBySubmittedAtAsc)) {
    for (const [metricId, satisfaction] of Object.entries(submission.evaluation.satisfaction)) {
      if (!Number.isFinite(satisfaction)) continue;

      const signalKey = `${submission.taskId}|${metricId}`;
      const current = metricSignals.get(signalKey);
      if (!current) {
        metricSignals.set(signalKey, {
          metricId,
          taskId: submission.taskId,
          first: { value: satisfaction, submittedAt: submission.submittedAt },
          latest: { value: satisfaction, submittedAt: submission.submittedAt },
        });
        continue;
      }

      current.latest = { value: satisfaction, submittedAt: submission.submittedAt };
      current.taskId = submission.taskId;
    }
  }

  return Array.from(metricSignals.values())
    .map((signal) => ({
      taskId: signal.taskId,
      taskTitle: taskTitle(signal.taskId),
      metricId: signal.metricId,
      metricLabel: metricLabel(signal.taskId, signal.metricId),
      firstSatisfaction: roundSignal(signal.first.value),
      latestSatisfaction: roundSignal(signal.latest.value),
      delta: roundSignal(signal.latest.value - signal.first.value),
    }))
    .filter((signal) => signal.delta >= IMPROVEMENT_THRESHOLD)
    .sort((left, right) => right.delta - left.delta || left.metricId.localeCompare(right.metricId))
    .slice(0, PORTFOLIO_SIGNAL_LIMIT);
}

export function buildArenaStudentPortfolio(
  submissions: readonly ArenaSubmissionRecord[],
  userId: string,
): ArenaStudentPortfolio {
  const userSubmissions = submissions
    .filter((submission) => submission.userId === userId)
    .slice()
    .sort(sortBySubmittedAtAsc);
  const latestSubmission = userSubmissions[userSubmissions.length - 1];

  return {
    userId,
    controllerCount: new Set(userSubmissions.map((submission) => submission.artifactHash)).size,
    methodDistribution: buildMethodDistribution(userSubmissions),
    identificationModels: buildIdentificationModels(userSubmissions),
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
    improvingMetrics: buildImprovingMetrics(userSubmissions),
  };
}
