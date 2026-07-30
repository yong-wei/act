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
  growth: ArenaPortfolioGrowthSummary;
  trainingSummary: ArenaTrainingSummary;
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
  const blackBoxSubmissions = submissions.filter((submission) => submission.artifact.method === 'black-box-control');
  const models: ArenaPortfolioIdentificationModel[] = [];
  const seenArtifactHashes = new Set<string>();

  for (const submission of blackBoxSubmissions) {
    const params = submission.artifact.params as Record<string, unknown>;
    const datasetHash = typeof params.experimentDatasetHash === 'string' ? params.experimentDatasetHash : null;
    const identificationModelId = typeof params.identificationModelId === 'string' ? params.identificationModelId : null;
    if (!datasetHash || !identificationModelId) continue;

    const compositeKey = `${datasetHash}|${identificationModelId}`;
    if (seenArtifactHashes.has(compositeKey)) continue;
    seenArtifactHashes.add(compositeKey);

    models.push({
      taskId: submission.taskId,
      taskTitle: taskTitle(submission.taskId),
      datasetHash,
      identificationModelId,
      submittedAt: submission.submittedAt,
    });
  }

  return models;
}

function buildPersonalBestByTask(
  allSubmissions: readonly ArenaSubmissionRecord[],
  userSubmissions: ArenaSubmissionRecord[],
): ArenaPortfolioTaskRank[] {
  const bestByTask = new Map<string, ArenaPortfolioTaskRank>();

  for (const submission of userSubmissions) {
    const taskId = submission.taskId;
    const existing = bestByTask.get(taskId);
    if (!existing || submission.evaluation.score > existing.bestScore) {
      const leaderboard = buildArenaLeaderboard(allSubmissions, taskId);
      const rankEntry = leaderboard.find((entry) => entry.userId === submission.userId);
      bestByTask.set(taskId, {
        taskId,
        taskTitle: taskTitle(taskId),
        submissionId: submission.id,
        bestScore: submission.evaluation.score,
        rank: rankEntry?.rank ?? 0,
        submittedAt: submission.submittedAt,
      });
    }
  }

  return Array.from(bestByTask.values())
    .sort((left, right) => right.bestScore - left.bestScore);
}

function buildFailureObjects(userSubmissions: ArenaSubmissionRecord[]): ArenaPortfolioFailureObject[] {
  const failureCounts = new Map<string, {
    objectName: string;
    source: ChallengeObjectSource;
    count: number;
    latestSubmittedAt: string;
  }>();

  for (const submission of userSubmissions) {
    if (submission.evaluation.score >= FAILURE_SCORE_THRESHOLD) continue;
    const object = getArenaChallengeObject(submission.taskId, submission.artifact.taskId);
    if (!object) continue;

    const existing = failureCounts.get(object.objectId);
    if (existing) {
      existing.count++;
      if (submission.submittedAt > existing.latestSubmittedAt) {
        existing.latestSubmittedAt = submission.submittedAt;
      }
    } else {
      failureCounts.set(object.objectId, {
        objectName: object.objectName,
        source: object.source,
        count: 1,
        latestSubmittedAt: submission.submittedAt,
      });
    }
  }

  return Array.from(failureCounts.entries())
    .map(([objectId, data]) => ({
      objectId,
      objectName: data.objectName,
      source: data.source,
      failureCount: data.count,
      latestSubmittedAt: data.latestSubmittedAt,
    }))
    .sort((left, right) => right.failureCount - left.failureCount);
}

function buildImprovingMetrics(userSubmissions: ArenaSubmissionRecord[]): ArenaPortfolioImprovingMetric[] {
  const taskMetrics = new Map<string, Map<string, { first: number; latest: number; taskId: string }>>();

  for (const submission of userSubmissions) {
    const satisfaction = submission.evaluation.satisfaction;
    if (!satisfaction) continue;
    if (!taskMetrics.has(submission.taskId)) {
      taskMetrics.set(submission.taskId, new Map());
    }
    const metricMap = taskMetrics.get(submission.taskId)!;
    for (const [metricId, value] of Object.entries(satisfaction)) {
      if (typeof value !== 'number') continue;
      const existing = metricMap.get(metricId);
      if (!existing) {
        metricMap.set(metricId, { first: value, latest: value, taskId: submission.taskId });
      } else {
        existing.latest = value;
      }
    }
  }

  const improvements: ArenaPortfolioImprovingMetric[] = [];
  for (const [taskId, metricMap] of taskMetrics) {
    for (const [metricId, data] of metricMap) {
      const delta = data.latest - data.first;
      if (delta >= IMPROVEMENT_THRESHOLD) {
        improvements.push({
          taskId,
          taskTitle: taskTitle(taskId),
          metricId,
          metricLabel: metricLabel(taskId, metricId),
          firstSatisfaction: roundSignal(data.first),
          latestSatisfaction: roundSignal(data.latest),
          delta: roundSignal(delta),
        });
      }
    }
  }

  return improvements.sort((left, right) => right.delta - left.delta);
}

function buildCapabilityGrowth(submissions: ArenaSubmissionRecord[]): ArenaPortfolioCapabilityGrowth[] {
  const capabilityData = new Map<ArenaTrainingCapabilityId, {
    submissions: ArenaSubmissionRecord[];
    validCount: number;
    bestScore: number;
    totalScore: number;
    weakMetrics: Set<string>;
  }>();

  for (const submission of submissions) {
    const task = getArenaChallengeTask(submission.taskId);
    if (!task) continue;
    for (const capability of task.training.capabilityTags) {
      const existing = capabilityData.get(capability);
      if (existing) {
        existing.submissions.push(submission);
        if (submission.evaluation.valid) existing.validCount++;
        existing.bestScore = Math.max(existing.bestScore, submission.evaluation.score);
        existing.totalScore += submission.evaluation.score;
        const satisfaction = submission.evaluation.satisfaction;
        if (satisfaction) {
          for (const [metricId, value] of Object.entries(satisfaction)) {
            if (typeof value === 'number' && value < WEAK_METRIC_SATISFACTION) {
              existing.weakMetrics.add(metricId);
            }
          }
        }
      } else {
        const weakMetrics = new Set<string>();
        const satisfaction = submission.evaluation.satisfaction;
        if (satisfaction) {
          for (const [metricId, value] of Object.entries(satisfaction)) {
            if (typeof value === 'number' && value < WEAK_METRIC_SATISFACTION) {
              weakMetrics.add(metricId);
            }
          }
        }
        capabilityData.set(capability, {
          submissions: [submission],
          validCount: submission.evaluation.valid ? 1 : 0,
          bestScore: submission.evaluation.score,
          totalScore: submission.evaluation.score,
          weakMetrics,
        });
      }
    }
  }

  return Array.from(capabilityData.entries())
    .map(([capability, data]) => {
      const count = data.submissions.length;
      const validCount = data.validCount;
      const bestScore = data.bestScore;
      const averageScore = count > 0 ? Math.round((data.totalScore / count) * 10) / 10 : null;
      const weakMetricIds = Array.from(data.weakMetrics);
      const latestSubmission = data.submissions
        .slice()
        .sort(sortBySubmittedAtDesc)[0];

      let status: ArenaPortfolioCapabilityGrowth['status'] = 'no-evidence';
      if (count > 0 && validCount === 0) {
        status = 'needs-work';
      } else if (count > 0 && bestScore >= WEAK_CAPABILITY_SCORE && bestScore < STRONG_CAPABILITY_SCORE) {
        status = validCount >= 2 ? 'improving' : 'developing';
      } else if (bestScore >= STRONG_CAPABILITY_SCORE) {
        status = 'strong';
      } else if (count > 0) {
        status = 'needs-work';
      }

      const label = ARENA_TRAINING_CAPABILITY_LABELS[capability] ?? capability;
      const evidenceSummary = count === 0
        ? `暂无 ${label} 证据`
        : `${count} 次提交，最佳 ${bestScore} 分`;

      return {
        capability,
        label,
        submissionCount: count,
        validSubmissionCount: validCount,
        bestScore: count > 0 ? bestScore : null,
        averageScore,
        weakMetricIds,
        latestSubmittedAt: latestSubmission?.submittedAt,
        status,
        evidenceSummary,
      };
    })
    .sort((left, right) => {
      const statusPriority = (s: ArenaPortfolioCapabilityGrowth['status']) => {
        switch (s) {
          case 'needs-work': return 0;
          case 'developing': return 1;
          case 'improving': return 2;
          case 'strong': return 3;
          default: return 4;
        }
      };
      return statusPriority(left.status) - statusPriority(right.status);
    });
}

function stageIndex(stage: ArenaTrainingStageId): number {
  return stageOrder.indexOf(stage);
}

function capabilityLabels(capabilities: ArenaTrainingCapabilityId[]): string[] {
  return capabilities.map((id) => ARENA_TRAINING_CAPABILITY_LABELS[id] ?? id);
}

function buildNextChallengeRecommendations(
  submissions: ArenaSubmissionRecord[],
  capabilitySignals: ArenaPortfolioCapabilityGrowth[],
): ArenaNextChallengeRecommendation[] {
  const attemptedTaskIds = new Set(submissions.map((s) => s.taskId));
  const weakCapabilities = new Set(
    capabilitySignals
      .filter((signal) => signal.status === 'needs-work')
      .map((signal) => signal.capability),
  );
  const prerequisiteReadyCapabilities = new Set(
    capabilitySignals
      .filter((signal) => signal.status !== 'no-evidence' && signal.status !== 'needs-work')
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
