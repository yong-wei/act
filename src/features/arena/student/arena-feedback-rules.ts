import type { ArenaSubmissionRecord } from '../submissions/submission-service';

export type ArenaFeedbackMode = 'white-box' | 'black-box';
export type ArenaFeedbackRankingStatus = 'ranked' | 'not_ranked';
export type ArenaPersonalBestComparisonState = 'none' | 'improved' | 'regressed' | 'unchanged';

export interface ArenaFeedbackMetricSignal {
  metricId: string;
  satisfaction: number;
}

export interface ArenaPersonalBestComparison {
  state: ArenaPersonalBestComparisonState;
  delta: number;
  previousBestScore?: number;
}

export interface ArenaSubmissionFeedback {
  rankingStatus: ArenaFeedbackRankingStatus;
  title: string;
  summary: string;
  score: number;
  strongestMetric?: ArenaFeedbackMetricSignal;
  weakestMetric?: ArenaFeedbackMetricSignal;
  hardConstraintFailures: string[];
  personalBestComparison: ArenaPersonalBestComparison;
  issueTags: string[];
  nextStepSuggestion: string;
  privacyNote?: string;
}

export interface BuildArenaSubmissionFeedbackInput {
  latest: ArenaSubmissionRecord;
  previousSubmissions?: readonly ArenaSubmissionRecord[];
  mode: ArenaFeedbackMode;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function metricSignals(submission: ArenaSubmissionRecord): ArenaFeedbackMetricSignal[] {
  return Object.entries(submission.evaluation.satisfaction)
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
    .map(([metricId, satisfaction]) => ({ metricId, satisfaction: roundTwo(satisfaction) }));
}

function strongestMetric(submission: ArenaSubmissionRecord): ArenaFeedbackMetricSignal | undefined {
  return metricSignals(submission).sort((left, right) => (
    right.satisfaction - left.satisfaction || left.metricId.localeCompare(right.metricId)
  ))[0];
}

function weakestMetric(submission: ArenaSubmissionRecord): ArenaFeedbackMetricSignal | undefined {
  return metricSignals(submission).sort((left, right) => (
    left.satisfaction - right.satisfaction || left.metricId.localeCompare(right.metricId)
  ))[0];
}

function hardConstraintFailures(submission: ArenaSubmissionRecord): string[] {
  return submission.evaluation.hardConstraintResults
    .filter((result) => !result.passed)
    .map((result) => (result.reason ? `${result.label}：${result.reason}` : result.label));
}

function comparePersonalBest(input: BuildArenaSubmissionFeedbackInput): ArenaPersonalBestComparison {
  const previous = (input.previousSubmissions ?? [])
    .filter((submission) => (
      submission.taskId === input.latest.taskId
      && (input.latest.userId ? submission.userId === input.latest.userId : submission.studentLabel === input.latest.studentLabel)
      && submission.id !== input.latest.id
    ));
  if (previous.length === 0) {
    return { state: 'none', delta: 0 };
  }

  const previousBestScore = Math.max(...previous.map((submission) => submission.evaluation.score));
  const delta = roundOne(input.latest.evaluation.score - previousBestScore);
  if (delta > 0) {
    return { state: 'improved', delta, previousBestScore };
  }
  if (delta < 0) {
    return { state: 'regressed', delta, previousBestScore };
  }
  return { state: 'unchanged', delta: 0, previousBestScore };
}

function metricWithLargestRegression(
  latest: ArenaSubmissionRecord,
  previousSubmissions: readonly ArenaSubmissionRecord[],
): string | undefined {
  const previousBest = previousSubmissions
    .filter((submission) => (
      submission.taskId === latest.taskId
      && (latest.userId ? submission.userId === latest.userId : submission.studentLabel === latest.studentLabel)
      && submission.id !== latest.id
    ))
    .sort((left, right) => right.evaluation.score - left.evaluation.score)[0];
  if (!previousBest) return undefined;

  let selected: { metricId: string; delta: number } | undefined;
  for (const [metricId, latestSatisfaction] of Object.entries(latest.evaluation.satisfaction)) {
    const previousSatisfaction = previousBest.evaluation.satisfaction[metricId];
    if (!Number.isFinite(latestSatisfaction) || !Number.isFinite(previousSatisfaction)) continue;
    const delta = latestSatisfaction - previousSatisfaction;
    if (!selected || delta < selected.delta) {
      selected = { metricId, delta };
    }
  }

  return selected?.metricId;
}

function buildIssueTags(input: BuildArenaSubmissionFeedbackInput, weakest?: ArenaFeedbackMetricSignal): string[] {
  const tags: string[] = [];
  if (!input.latest.evaluation.valid) tags.push('hard-constraint-failure');
  if (weakest && /energy|controlEnergy/i.test(weakest.metricId) && weakest.satisfaction < 0.5) {
    tags.push('energy-heavy');
  }
  if (input.mode === 'black-box') {
    tags.push('black-box-aggregate');
  }
  return tags;
}

function buildSuggestion(
  input: BuildArenaSubmissionFeedbackInput,
  failures: string[],
  weakest?: ArenaFeedbackMetricSignal,
  comparison?: ArenaPersonalBestComparison,
  issueTags: string[] = [],
): string {
  if (failures.length > 0) {
    return `先修复硬约束：${failures[0]}，再重新比较评分指标。`;
  }

  if (comparison?.state === 'regressed') {
    const regressedMetric = metricWithLargestRegression(input.latest, input.previousSubmissions ?? []) ?? weakest?.metricId;
    return `本次低于个人最佳，建议回到 ${regressedMetric ?? '变化最大的指标'} 检查参数调整。`;
  }

  if (issueTags.includes('energy-heavy')) {
    return '当前方案能耗偏重，建议降低控制增益或提高能量权重后再提交。';
  }

  if (weakest) {
    return `下一步优先改善 ${weakest.metricId}，同时保持当前优势指标不退化。`;
  }

  return '继续保留当前方案，并尝试用一次小幅参数扰动验证鲁棒性。';
}

function buildSummary(
  latest: ArenaSubmissionRecord,
  comparison: ArenaPersonalBestComparison,
): string {
  const scoreText = `${roundOne(latest.evaluation.score)} 分`;
  if (comparison.state === 'improved') {
    return `本次官方评测得分 ${scoreText}，较个人最佳提升 ${comparison.delta} 分。`;
  }
  if (comparison.state === 'regressed') {
    return `本次官方评测得分 ${scoreText}，低于个人最佳 ${Math.abs(comparison.delta)} 分。`;
  }
  return `本次官方评测得分 ${scoreText}。`;
}

export function buildArenaSubmissionFeedback(input: BuildArenaSubmissionFeedbackInput): ArenaSubmissionFeedback {
  const failures = hardConstraintFailures(input.latest);
  const rankingStatus: ArenaFeedbackRankingStatus = input.latest.evaluation.valid && failures.length === 0
    ? 'ranked'
    : 'not_ranked';
  const strongest = strongestMetric(input.latest);
  const weakest = weakestMetric(input.latest);
  const comparison = comparePersonalBest(input);
  const issueTags = buildIssueTags(input, weakest);

  return {
    rankingStatus,
    title: rankingStatus === 'ranked' ? '提交已进入正式排名' : '提交未进入正式排名',
    summary: buildSummary(input.latest, comparison),
    score: roundOne(input.latest.evaluation.score),
    strongestMetric: strongest,
    weakestMetric: weakest,
    hardConstraintFailures: failures,
    personalBestComparison: comparison,
    issueTags,
    nextStepSuggestion: buildSuggestion(input, failures, weakest, comparison, issueTags),
    privacyNote: input.mode === 'black-box'
      ? '黑箱反馈只展示聚合弱项，不公开隐藏场景参数、顺序或轨迹。'
      : undefined,
  };
}
