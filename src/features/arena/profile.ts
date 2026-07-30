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
  evaluationVisibility: 'official' | 'preview';
  officialEligible: boolean;
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

function capabilityLabels(capabilityIds: ArenaTrainingCapabilityId[]): string[] {
  return capabilityIds.map((id) => ARENA_TRAINING_CAPABILITY_LABELS[id] ?? id);
}

function stageIndex(stage: ArenaTrainingStageId): number {
  return stageOrder.indexOf(stage);
}

function buildMethodDistribution(submissions: ArenaSubmissionRecord[]): ArenaPortfolioMethodCount[] {
  const counts = new Map<ControllerMethod, number>();
  for (const submission of submissions) {
    counts.set(submission.artifact.method, (counts.get(submission.artifact.method) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => right.count - left.count);
}

function buildIdentificationModels(submissions: ArenaSubmissionRecord[]): ArenaPortfolioIdentificationModel[] {
  const blackBoxSubmissions = submissions.filter(
    (submission) => submission.artifact.method === 'black-box-control',
  );
  return blackBoxSubmissions.map((submission) => ({
    taskId: submission.taskId,
    taskTitle: taskTitle(submission.taskId),
    datasetHash: String(submission.artifact.params.experimentDatasetHash ?? ''),
    identificationModelId: String(submission.artifact.params.identificationModelId ?? ''),
    submittedAt: submission.submittedAt,
  }));
}

function buildPersonalBestByTask(
  allSubmissions: readonly ArenaSubmissionRecord[],
  userSubmissions: ArenaSubmissionRecord[],
): ArenaPortfolioTaskRank[] {
  const taskIds = new Set(userSubmissions.map((submission) => submission.taskId));
  const results: ArenaPortfolioTaskRank[] = [];

  for (const taskId of taskIds) {
    const leaderboard = buildArenaLeaderboard(allSubmissions, { taskId, type: 'main' });
    const userBest = userSubmissions
      .filter((submission) => submission.taskId === taskId)
      .sort((left, right) => right.evaluation.score - left.evaluation.score)[0];

    if (!userBest) continue;

    const rank = leaderboard.findIndex((entry) => entry.submissionId === userBest.id) + 1;
    results.push({
      taskId,
      taskTitle: taskTitle(taskId),
      submissionId: userBest.id,
      bestScore: userBest.evaluation.score,
      rank: rank || leaderboard.length + 1,
      submittedAt: userBest.submittedAt,
    });
  }

  return results.sort((left, right) => right.bestScore - left.bestScore);
}

function buildFailureObjects(submissions: ArenaSubmissionRecord[]): ArenaPortfolioFailureObject[] {
  const failedSubmissions = submissions.filter((submission) => submission.evaluation.score < FAILURE_SCORE_THRESHOLD);
  const objectFailures = new Map<string, { objectName: string; source: ChallengeObjectSource; failureCount: number; latestSubmittedAt: string }>();

  for (const submission of failedSubmissions) {
    const task = getArenaChallengeTask(submission.taskId);
    if (!task) continue;
    const object = getArenaChallengeObject(task.objectId);
    if (!object) continue;
    const key = object.id;
    const existing = objectFailures.get(key);
    if (!existing || Date.parse(submission.submittedAt) > Date.parse(existing.latestSubmittedAt)) {
      objectFailures.set(key, {
        objectName: object.name,
        source: object.source,
        failureCount: (existing?.failureCount ?? 0) + 1,
        latestSubmittedAt: submission.submittedAt,
      });
    } else {
      existing.count++;
    }
  }

  return Array.from(objectFailures.entries())
    .map(([objectId, data]) => ({ objectId, ...data }))
    .sort((left, right) => right.count - left.count);
}

function buildImprovingMetrics(submissions: ArenaSubmissionRecord[]): ArenaPortfolioImprovingMetric[] {
  const taskGroups = new Map<string, ArenaSubmissionRecord[]>();
  for (const submission of submissions) {
    const group = taskGroups.get(submission.taskId) ?? [];
    group.push(submission);
    taskGroups.set(submission.taskId, group);
  }

  const results: ArenaPortfolioImprovingMetric[] = [];

  for (const [taskId, taskSubmissions] of taskGroups) {
    const sorted = [...taskSubmissions].sort(sortBySubmittedAtAsc);
    if (sorted.length < 2) continue;

    const first = sorted[0];
    const latest = sorted[sorted.length - 1];

    const metricIds = new Set([
      ...Object.keys(first.evaluation.satisfaction),
      ...Object.keys(latest.evaluation.satisfaction),
    ]);

    for (const metricId of metricIds) {
      const firstSat = first.evaluation.satisfaction[metricId] ?? 0;
      const latestSat = latest.evaluation.satisfaction[metricId] ?? 0;
      const delta = latestSat - firstSat;

      if (delta >= IMPROVEMENT_THRESHOLD) {
        results.push({
          taskId,
          taskTitle: taskTitle(taskId),
          metricId,
          metricLabel: metricLabel(taskId, metricId),
          firstSatisfaction: roundSignal(firstSat),
          latestSatisfaction: roundSignal(latestSat),
          delta: roundSignal(delta),
        });
      }
    }
  }

  return results.sort((left, right) => right.delta - left.delta);
}

function buildCapabilityGrowth(submissions: ArenaSubmissionRecord[]): ArenaPortfolioCapabilityGrowth[] {
  const capabilityMap = new Map<ArenaTrainingCapabilityId, { submissions: ArenaSubmissionRecord[]; weakMetrics: Set<string> }>();

  for (const submission of submissions) {
    const task = getArenaChallengeTask(submission.taskId);
    if (!task) continue;
    for (const cap of task.training.capabilityTags) {
      const entry = capabilityMap.get(cap) ?? { submissions: [], weakMetrics: new Set() };
      entry.submissions.push(submission);
      for (const metricId of Object.keys(submission.evaluation.satisfaction)) {
        if (submission.evaluation.satisfaction[metricId] < WEAK_METRIC_SATISFACTION) {
          entry.weakMetrics.add(metricId);
        }
      }
      capabilityMap.set(cap, entry);
    }
  }

  return Array.from(capabilityMap.entries())
    .map(([capability, { submissions: capSubmissions, weakMetrics }]) => {
      const scores = capSubmissions.map((submission) => submission.evaluation.score);
      const validSubmissions = capSubmissions.filter((submission) => submission.evaluation.valid);
      const bestScore = scores.length > 0 ? Math.max(...scores) : null;
      const averageScore = scores.length > 0 ? roundSignal(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
      const latestSubmittedAt = capSubmissions.length > 0
        ? capSubmissions.sort(sortBySubmittedAtDesc)[0].submittedAt
        : undefined;

      let status: ArenaPortfolioCapabilityGrowth['status'] = 'no-evidence';
      if (validSubmissions.length > 0 && bestScore !== null && bestScore >= STRONG_CAPABILITY_SCORE) {
        status = 'strong';
      } else if (validSubmissions.length > 0 && bestScore !== null && bestScore >= WEAK_CAPABILITY_SCORE) {
        status = 'improving';
      } else if (validSubmissions.length > 0) {
        status = 'developing';
      } else if (capSubmissions.length > 0) {
        status = 'needs-work';
      }

      return {
        capability,
        label: ARENA_TRAINING_CAPABILITY_LABELS[capability] ?? capability,
        submissionCount: capSubmissions.length,
        validSubmissionCount: validSubmissions.length,
        bestScore,
        averageScore,
        weakMetricIds: Array.from(weakMetrics),
        latestSubmittedAt,
        status,
        evidenceSummary: capSubmissions.length === 0
          ? '暂无证据'
          : `${capSubmissions.length} 次提交，${validSubmissions.length} 次有效，最高 ${bestScore ?? '—'} 分`,
      };
    })
    .sort((left, right) => {
      const order: Record<ArenaPortfolioCapabilityGrowth['status'], number> = {
        'no-evidence': 0,
        'needs-work': 1,
        'developing': 2,
        'improving': 3,
        'strong': 4,
      };
      return (order[right.status] ?? 0) - (order[left.status] ?? 0);
    });
}

function buildNextChallengeRecommendations(
  submissions: ArenaSubmissionRecord[],
  capabilitySignals: ArenaPortfolioCapabilityGrowth[],
): ArenaNextChallengeRecommendation[] {
  const weakCapabilities = new Set(
    capabilitySignals
      .filter((signal) => signal.status === 'needs-work' || signal.status === 'developing')
      .map((signal) => signal.capability),
  );
  const completedTaskIds = new Set(submissions.map((submission) => submission.taskId));
  const highestStageIndex = submissions.length === 0
    ? -1
    : Math.max(...submissions.map((submission) => {
        const task = getArenaChallengeTask(submission.taskId);
        return task ? stageIndex(task.training.stage) : -1;
      }));

  const candidates = ARENA_CHALLENGE_TASKS
    .map((task) => {
      const missingPrerequisites = task.training.prerequisites.filter((cap) => !capabilitySignals.some((signal) => signal.capability === cap && signal.validSubmissionCount > 0));
      const weakOverlap = task.training.capabilityTags.filter((cap) => weakCapabilities.has(cap));
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
  trainingRuns: Array<{
    taskId: string;
    scenarioId: string;
    completedAt: string;
    evaluationVisibility?: string;
    officialEligible?: boolean;
  }>,
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
      evaluationVisibility: (run.evaluationVisibility === 'official' ? 'official' : 'preview') as 'official' | 'preview',
      officialEligible: run.officialEligible ?? false,
    })),
  };
}

export function buildArenaStudentPortfolio(
  submissions: readonly ArenaSubmissionRecord[],
  userId: string,
  trainingRuns?: Array<{
    taskId: string;
    scenarioId: string;
    completedAt: string;
    evaluationVisibility?: string;
    officialEligible?: boolean;
  }>,
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
