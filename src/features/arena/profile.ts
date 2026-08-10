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
export const ARENA_PORTFOLIO_RECENT_LIMIT = 5;
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

export interface ArenaVirtualTrainingRunRecord {
  id: string;
  userId: string;
  taskId: string;
  scenarioId: string;
  simulationRunId?: string | null;
  payload: unknown;
  createdAt: Date | string;
  simulationRun?: {
    status?: string | null;
    completedAt?: Date | string | null;
    summary?: unknown;
  } | null;
}

export interface ArenaTrainingRunQualityMetrics {
  trackingError: number;
  maxDeviation: number;
  controlEnergy: number;
  safetyViolations: number;
  smoothness: number;
}

export interface ArenaPortfolioRecentTrainingRun {
  id: string;
  taskId: string;
  taskTitle: string;
  scenarioId: string;
  simulationRunId: string | null;
  qualityMetrics: ArenaTrainingRunQualityMetrics;
  preview: true;
  officialEligible: false;
  confidence: 'low';
  trainedAt: string;
}

export interface ArenaPortfolioTrainingSummary {
  total: number;
  previewCount: number;
  evidenceConfidence: 'low';
  latestTrainedAt?: string;
  recentRuns: ArenaPortfolioRecentTrainingRun[];
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
  trainingSummary: ArenaPortfolioTrainingSummary;
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

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function toPersistedIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function isCompletedVirtualRun(run: ArenaVirtualTrainingRunRecord): boolean {
  if (!run.simulationRun) return true;
  return ['completed', 'succeeded', 'success'].includes(run.simulationRun.status ?? '');
}

function resolveArenaTrainingBoundary(run: ArenaVirtualTrainingRunRecord): {
  evaluationVisibility?: string;
  officialEligible?: boolean;
} {
  const payload = readRecord(run.payload);
  const payloadSummary = readRecord(payload.summary);
  const payloadTraining = readRecord(payloadSummary.arenaTraining);
  const payloadMetadata = readRecord(payload.metadata);
  const payloadBoundary = readRecord(payload.previewBoundary);
  const canonicalSummary = readRecord(run.simulationRun?.summary);
  const canonicalTraining = readRecord(canonicalSummary.arenaTraining);
  const canonicalBoundary = readRecord(canonicalSummary.previewBoundary);

  return {
    evaluationVisibility: readNonEmptyString(canonicalTraining.evaluationVisibility)
      ?? readNonEmptyString(canonicalBoundary.evaluationVisibility)
      ?? readNonEmptyString(payloadTraining.evaluationVisibility)
      ?? readNonEmptyString(payloadMetadata.evaluationVisibility)
      ?? readNonEmptyString(payloadBoundary.evaluationVisibility),
    officialEligible: typeof canonicalTraining.officialEligible === 'boolean'
      ? canonicalTraining.officialEligible
      : typeof canonicalBoundary.officialEligible === 'boolean'
        ? canonicalBoundary.officialEligible
        : typeof payloadTraining.officialEligible === 'boolean'
          ? payloadTraining.officialEligible
          : typeof payloadMetadata.officialEligible === 'boolean'
            ? payloadMetadata.officialEligible
            : typeof payloadBoundary.officialEligible === 'boolean'
              ? payloadBoundary.officialEligible
              : undefined,
  };
}

function resolveQualityMetrics(run: ArenaVirtualTrainingRunRecord): {
  trackingError: number;
  maxDeviation: number;
  controlEnergy: number;
  safetyViolations: number;
  smoothness: number;
} | null {
  const payload = readRecord(run.payload);
  const payloadSummary = readRecord(payload.summary);
  const canonicalSummary = readRecord(run.simulationRun?.summary);
  const candidates = [canonicalSummary, payloadSummary];

  for (const candidate of candidates) {
    const metrics = readRecord(candidate.metrics);
    const resolved = {
      trackingError: readFiniteNumber(candidate.trackingError) ?? readFiniteNumber(metrics.trackingError),
      maxDeviation: readFiniteNumber(candidate.maxDeviation) ?? readFiniteNumber(metrics.maxDeviation),
      controlEnergy: readFiniteNumber(candidate.controlEnergy) ?? readFiniteNumber(metrics.controlEnergy),
      safetyViolations: readFiniteNumber(candidate.safetyViolations) ?? readFiniteNumber(metrics.safetyViolations),
      smoothness: readFiniteNumber(candidate.smoothness) ?? readFiniteNumber(metrics.smoothness),
    };
    if (Object.values(resolved).every((value): value is number => value !== undefined)) {
      return {
        trackingError: resolved.trackingError!,
        maxDeviation: resolved.maxDeviation!,
        controlEnergy: resolved.controlEnergy!,
        safetyViolations: resolved.safetyViolations!,
        smoothness: resolved.smoothness!,
      };
    }
  }

  return null;
}

export function projectArenaPortfolioRecentTrainingRun(
  run: ArenaVirtualTrainingRunRecord,
): ArenaPortfolioRecentTrainingRun | null {
  if (!isCompletedVirtualRun(run)) return null;

  const taskId = readNonEmptyString(run.taskId);
  const scenarioId = readNonEmptyString(run.scenarioId);
  const trainedAt = toPersistedIso(run.simulationRun?.completedAt ?? null)
    ?? toPersistedIso(run.createdAt);
  const boundary = resolveArenaTrainingBoundary(run);
  const qualityMetrics = resolveQualityMetrics(run);
  if (!taskId || !scenarioId || !trainedAt || !qualityMetrics) return null;
  if (boundary.evaluationVisibility !== 'preview' || boundary.officialEligible !== false) return null;

  return {
    id: run.id,
    taskId,
    taskTitle: taskTitle(taskId),
    scenarioId,
    simulationRunId: run.simulationRunId ?? null,
    qualityMetrics,
    preview: true,
    officialEligible: false,
    confidence: 'low',
    trainedAt,
  } satisfies ArenaPortfolioRecentTrainingRun;
}

function buildTrainingSummary(
  trainingRuns: readonly ArenaVirtualTrainingRunRecord[],
  userId: string,
  persistedTrainingCount = trainingRuns.filter((run) => run.userId === userId).length,
): ArenaPortfolioTrainingSummary {
  const recentRuns = trainingRuns
    .filter((run) => run.userId === userId)
    .map(projectArenaPortfolioRecentTrainingRun)
    .filter((run): run is ArenaPortfolioRecentTrainingRun => Boolean(run))
    .sort((left, right) => Date.parse(right.trainedAt) - Date.parse(left.trainedAt));
  return {
    total: persistedTrainingCount,
    previewCount: persistedTrainingCount,
    evidenceConfidence: 'low',
    latestTrainedAt: recentRuns[0]?.trainedAt,
    recentRuns: recentRuns.slice(0, ARENA_PORTFOLIO_RECENT_LIMIT),
  };
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

function averageScore(submissions: readonly ArenaSubmissionRecord[]): number | null {
  if (submissions.length === 0) return null;
  return roundSignal(submissions.reduce((sum, submission) => sum + submission.evaluation.score, 0) / submissions.length);
}

function bestScore(submissions: readonly ArenaSubmissionRecord[]): number | null {
  if (submissions.length === 0) return null;
  return Math.max(...submissions.map((submission) => submission.evaluation.score));
}

function latestSubmittedAt(submissions: readonly ArenaSubmissionRecord[]): string | undefined {
  return submissions.slice().sort(sortBySubmittedAtDesc)[0]?.submittedAt;
}

function scoreImproved(submissions: readonly ArenaSubmissionRecord[]): boolean {
  if (submissions.length < 2) return false;
  const sorted = submissions.slice().sort(sortBySubmittedAtAsc);
  return sorted[sorted.length - 1].evaluation.score - sorted[0].evaluation.score >= 15;
}

function weakMetricIds(submissions: readonly ArenaSubmissionRecord[]): string[] {
  const latestMetricValues = new Map<string, number>();
  for (const submission of submissions.slice().sort(sortBySubmittedAtAsc)) {
    for (const [metricId, satisfaction] of Object.entries(submission.evaluation.satisfaction)) {
      if (Number.isFinite(satisfaction)) {
        latestMetricValues.set(metricId, satisfaction);
      }
    }
  }
  return Array.from(latestMetricValues.entries())
    .filter(([, satisfaction]) => satisfaction < WEAK_METRIC_SATISFACTION)
    .map(([metricId]) => metricId)
    .sort((left, right) => left.localeCompare(right));
}

function capabilityStatus(
  submissions: readonly ArenaSubmissionRecord[],
  weakMetrics: readonly string[],
): ArenaPortfolioCapabilityGrowth['status'] {
  if (submissions.length === 0) return 'no-evidence';
  const best = bestScore(submissions) ?? 0;
  const hasValid = submissions.some((submission) => submission.evaluation.valid);
  if (!hasValid || best < WEAK_CAPABILITY_SCORE || weakMetrics.length > 0) return 'needs-work';
  if (scoreImproved(submissions)) return 'improving';
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
      latestSubmittedAt: latestSubmittedAt(capabilitySubmissions),
      status,
      evidenceSummary: capabilitySubmissions.length === 0
        ? '暂无官方提交证据'
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
      evidenceLevel: 'beginner-safe',
      href: `/arena/challenges/${task.id}`,
    }));
}

function buildNextChallengeRecommendations(
  submissions: ArenaSubmissionRecord[],
  capabilitySignals: readonly ArenaPortfolioCapabilityGrowth[],
): ArenaNextChallengeRecommendation[] {
  if (submissions.length === 0) return buildBeginnerRecommendations();

  const attemptedTaskIds = new Set(submissions.map((submission) => submission.taskId));
  const prerequisiteReadyCapabilities = new Set(
    capabilitySignals
      .filter((signal) => !['no-evidence', 'needs-work'].includes(signal.status))
      .map((signal) => signal.capability),
  );
  const weakCapabilities = new Set(
    capabilitySignals
      .filter((signal) => signal.status === 'needs-work')
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

export function buildArenaStudentPortfolio(
  submissions: readonly ArenaSubmissionRecord[],
  userId: string,
  trainingRuns: readonly ArenaVirtualTrainingRunRecord[] = [],
  persistedTrainingCount?: number,
): ArenaStudentPortfolio {
  const userSubmissions = submissions
    .filter((submission) => submission.userId === userId)
    .slice()
    .sort(sortBySubmittedAtAsc);
  const latestSubmission = userSubmissions[userSubmissions.length - 1];

  const methodDistribution = buildMethodDistribution(userSubmissions);
  const identificationModels = buildIdentificationModels(userSubmissions);
  const improvingMetrics = buildImprovingMetrics(userSubmissions);
  const trainingSummary = buildTrainingSummary(trainingRuns, userId, persistedTrainingCount);

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
      .slice(0, ARENA_PORTFOLIO_RECENT_LIMIT)
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
    growth: buildGrowthSummary(userSubmissions),
    trainingSummary,
  };
}
