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

export interface ArenaTrainingRunQualityMetrics {
  trackingError: number;
  maxDeviation: number;
  controlEnergy: number;
  safetyViolations: number;
  smoothness: number;
}

export interface ArenaTrainingRunSummary {
  taskId: string;
  taskTitle: string;
  scenarioId: string;
  completedAt: string;
  evaluationVisibility: 'official' | 'preview';
  officialEligible: boolean;
  qualityMetrics: ArenaTrainingRunQualityMetrics;
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
    const modelId = submission.artifact.params.identificationModelId;
    if (typeof modelId === 'string' && modelId && !models.has(modelId)) {
      const datasetHash = submission.artifact.params.experimentDatasetHash;
      models.set(modelId, {
        taskId: submission.taskId,
        taskTitle: taskTitle(submission.taskId),
        datasetHash: typeof datasetHash === 'string' ? datasetHash : '',
        identificationModelId: modelId,
        submittedAt: submission.submittedAt,
      });
    }
  }
  return Array.from(models.values());
}

function buildImprovingMetrics(submissions: ArenaSubmissionRecord[]): ArenaPortfolioImprovingMetric[] {
  const metricMap = new Map<string, {
    taskId: string;
    entries: Array<{ satisfaction: number; submittedAt: string }>;
  }>();

  for (const submission of submissions) {
    if (!submission.evaluation.valid) continue;
    for (const [metricId, satisfaction] of Object.entries(submission.evaluation.satisfaction)) {
      if (typeof satisfaction !== 'number') continue;
      const key = `${submission.taskId}::${metricId}`;
      const existing = metricMap.get(key);
      if (existing) {
        existing.entries.push({ satisfaction, submittedAt: submission.submittedAt });
      } else {
        metricMap.set(key, {
          taskId: submission.taskId,
          entries: [{ satisfaction, submittedAt: submission.submittedAt }],
        });
      }
    }
  }

  const improving: ArenaPortfolioImprovingMetric[] = [];
  for (const [key, data] of metricMap) {
    const sorted = data.entries.sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
    if (sorted.length < 2) continue;
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    const delta = latest.satisfaction - first.satisfaction;
    if (delta > IMPROVEMENT_THRESHOLD) {
      const [, metricId] = key.split('::');
      improving.push({
        taskId: data.taskId,
        taskTitle: taskTitle(data.taskId),
        metricId,
        metricLabel: metricLabel(data.taskId, metricId),
        firstSatisfaction: roundSignal(first.satisfaction),
        latestSatisfaction: roundSignal(latest.satisfaction),
        delta: roundSignal(delta),
      });
    }
  }

  return improving.sort((a, b) => b.delta - a.delta);
}

function buildPersonalBestByTask(allSubmissions: ArenaSubmissionRecord[], userSubmissions: ArenaSubmissionRecord[]): ArenaPortfolioTaskRank[] {
  const userBestByTask = new Map<string, { submission: ArenaSubmissionRecord; bestScore: number }>();
  for (const submission of userSubmissions) {
    const existing = userBestByTask.get(submission.taskId);
    if (!existing || submission.evaluation.score > existing.bestScore) {
      userBestByTask.set(submission.taskId, { submission, bestScore: submission.evaluation.score });
    }
  }

  const allBestByTask = new Map<string, ArenaSubmissionRecord[]>();
  for (const submission of allSubmissions) {
    const list = allBestByTask.get(submission.taskId) ?? [];
    list.push(submission);
    allBestByTask.set(submission.taskId, list);
  }

  const ranks: ArenaPortfolioTaskRank[] = [];
  for (const [taskId, { submission, bestScore }] of userBestByTask) {
    const allForTask = allBestByTask.get(taskId) ?? [];
    const sortedScores = allForTask
      .map((s) => s.evaluation.score)
      .sort((a, b) => b - a);
    const rank = sortedScores.indexOf(bestScore) + 1;
    ranks.push({
      taskId,
      taskTitle: taskTitle(taskId),
      submissionId: submission.id,
      bestScore,
      rank,
      submittedAt: submission.submittedAt,
    });
  }

  return ranks.sort((a, b) => a.rank - b.rank || a.taskId.localeCompare(b.taskId));
}

function buildFailureObjects(submissions: ArenaSubmissionRecord[]): ArenaPortfolioFailureObject[] {
  const objectFailures = new Map<string, {
    objectId: string;
    objectName: string;
    source: ChallengeObjectSource;
    count: number;
    latestSubmittedAt: string;
  }>();

  for (const submission of submissions) {
    if (submission.evaluation.valid) continue;
    const task = getArenaChallengeTask(submission.taskId);
    const object_ = task ? getArenaChallengeObject(task.objectId) : undefined;
    if (!object_) continue;
    const existing = objectFailures.get(object_.id);
    if (existing) {
      existing.count += 1;
      if (Date.parse(submission.submittedAt) > Date.parse(existing.latestSubmittedAt)) {
        existing.latestSubmittedAt = submission.submittedAt;
      }
    } else {
      objectFailures.set(object_.id, {
        objectId: object_.id,
        objectName: object_.name,
        source: object_.source,
        count: 1,
        latestSubmittedAt: submission.submittedAt,
      });
    }
  }

  return Array.from(objectFailures.values())
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      objectId: entry.objectId,
      objectName: entry.objectName,
      source: entry.source,
      failureCount: entry.count,
      latestSubmittedAt: entry.latestSubmittedAt,
    }));
}

function buildCapabilityGrowth(submissions: ArenaSubmissionRecord[]): ArenaPortfolioCapabilityGrowth[] {
  const capabilityMap = new Map<ArenaTrainingCapabilityId, {
    submissions: ArenaSubmissionRecord[];
    validSubmissions: ArenaSubmissionRecord[];
  }>();

  for (const task of ARENA_CHALLENGE_TASKS) {
    if (!capabilityMap.has(task.training.stage as ArenaTrainingCapabilityId)) {
      capabilityMap.set(task.training.stage as ArenaTrainingCapabilityId, {
        submissions: [],
        validSubmissions: [],
      });
    }
  }

  for (const submission of submissions) {
    const task = getArenaChallengeTask(submission.taskId);
    if (!task) continue;
    for (const cap of task.training.capabilityTags) {
      const entry = capabilityMap.get(cap);
      if (entry) {
        entry.submissions.push(submission);
        if (submission.evaluation.valid) {
          entry.validSubmissions.push(submission);
        }
      }
    }
  }

  const signals: ArenaPortfolioCapabilityGrowth[] = [];
  for (const [capability, data] of capabilityMap) {
    const scores = data.validSubmissions.map((s) => s.evaluation.score);
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

    const weakMetricIds = new Set<string>();
    for (const submission of data.validSubmissions) {
      for (const [metricId, satisfaction] of Object.entries(submission.evaluation.satisfaction)) {
        if (typeof satisfaction === 'number' && satisfaction < WEAK_METRIC_SATISFACTION) {
          weakMetricIds.add(metricId);
        }
      }
    }

    let status: ArenaPortfolioCapabilityGrowth['status'] = 'no-evidence';
    if (data.submissions.length === 0) {
      status = 'no-evidence';
    } else if (bestScore !== null && bestScore >= STRONG_CAPABILITY_SCORE) {
      status = 'strong';
    } else if (averageScore !== null && averageScore >= WEAK_CAPABILITY_SCORE && weakMetricIds.size === 0) {
      status = 'improving';
    } else if (data.validSubmissions.length > 0) {
      status = 'developing';
    } else {
      status = 'needs-work';
    }

    signals.push({
      capability,
      label: ARENA_TRAINING_CAPABILITY_LABELS[capability] ?? capability,
      submissionCount: data.submissions.length,
      validSubmissionCount: data.validSubmissions.length,
      bestScore,
      averageScore,
      weakMetricIds: Array.from(weakMetricIds),
      latestSubmittedAt: data.submissions.length > 0
        ? data.submissions.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0].submittedAt
        : undefined,
      status,
      evidenceSummary: buildCapabilityEvidenceSummary(status, data.submissions.length, data.validSubmissions.length, bestScore, averageScore),
    });
  }

  return signals;
}

function buildCapabilityEvidenceSummary(
  status: ArenaPortfolioCapabilityGrowth['status'],
  submissionCount: number,
  validCount: number,
  bestScore: number | null,
  averageScore: number | null,
): string {
  switch (status) {
    case 'no-evidence':
      return '暂无相关提交记录';
    case 'needs-work':
      return `已有${submissionCount}次提交但均未通过有效评估`;
    case 'developing':
      return `${validCount}次有效提交，最高分${bestScore ?? 0}`;
    case 'improving':
      return `${validCount}次有效提交，均分${averageScore ?? 0}，指标持续改善`;
    case 'strong':
      return `${validCount}次有效提交，最高分${bestScore ?? 0}，已形成稳定能力`;
    default:
      return '';
  }
}

function buildNextChallengeRecommendations(
  submissions: ArenaSubmissionRecord[],
  capabilitySignals: ArenaPortfolioCapabilityGrowth[],
): ArenaNextChallengeRecommendation[] {
  const attemptedTaskIds = new Set(submissions.map((s) => s.taskId));
  const weakCapabilities = new Set(
    capabilitySignals
      .filter((signal) => signal.status === 'needs-work' || signal.status === 'developing')
      .map((signal) => signal.capability),
  );
  const prerequisiteReadyCapabilities = new Set(
    capabilitySignals
      .filter((signal) => signal.status !== 'no-evidence')
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
  trainingRuns: Array<{
    taskId: string;
    scenarioId: string;
    completedAt: string;
    evaluationVisibility?: string;
    officialEligible?: boolean;
    trackingError?: number;
    maxDeviation?: number;
    controlEnergy?: number;
    safetyViolations?: number;
    smoothness?: number;
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
      qualityMetrics: {
        trackingError: typeof run.trackingError === 'number' ? run.trackingError : 0,
        maxDeviation: typeof run.maxDeviation === 'number' ? run.maxDeviation : 0,
        controlEnergy: typeof run.controlEnergy === 'number' ? run.controlEnergy : 0,
        safetyViolations: typeof run.safetyViolations === 'number' ? run.safetyViolations : 0,
        smoothness: typeof run.smoothness === 'number' ? run.smoothness : 0,
      },
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
    trackingError?: number;
    maxDeviation?: number;
    controlEnergy?: number;
    safetyViolations?: number;
    smoothness?: number;
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
