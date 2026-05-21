import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { formatArenaMetric } from '../display-labels';

export type ArenaFeedbackMode = 'white-box' | 'black-box';
export type ArenaFeedbackRankingStatus = 'ranked' | 'not_ranked';
export type ArenaPersonalBestComparisonState = 'none' | 'improved' | 'regressed' | 'unchanged';

export interface ArenaFeedbackMetricSignal {
  metricId: string;
  label: string;
  satisfaction: number;
  officialOnly?: boolean;
}

export interface ArenaPersonalBestComparison {
  state: ArenaPersonalBestComparisonState;
  delta: number;
  previousBestScore?: number;
}

export interface ArenaHardConstraintGuidance {
  label: string;
  reason?: string;
  suggestion: string;
}

export interface ArenaSubmissionFeedback {
  rankingStatus: ArenaFeedbackRankingStatus;
  title: string;
  summary: string;
  score: number;
  protocolVersion?: string;
  scoreComposition: ArenaFeedbackMetricSignal[];
  strongestMetric?: ArenaFeedbackMetricSignal;
  weakestMetric?: ArenaFeedbackMetricSignal;
  hardConstraintFailures: string[];
  hardConstraintGuidance: ArenaHardConstraintGuidance[];
  weakestMetricGuidance?: string;
  personalBestComparison: ArenaPersonalBestComparison;
  issueTags: string[];
  boundaryNotes: string[];
  officialOnlyMetricNotes: string[];
  nextStepSuggestion: string;
  privacyNote?: string;
}

export interface BuildArenaSubmissionFeedbackInput {
  latest: ArenaSubmissionRecord;
  previousSubmissions?: readonly ArenaSubmissionRecord[];
  mode: ArenaFeedbackMode;
  officialOnlyMetricIds?: readonly string[];
  protocolVersion?: string;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function metricSignals(
  submission: ArenaSubmissionRecord,
  officialOnlyMetricIds: readonly string[] = [],
): ArenaFeedbackMetricSignal[] {
  const officialOnlyMetricSet = new Set(officialOnlyMetricIds);
  return Object.entries(submission.evaluation.satisfaction)
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
    .map(([metricId, satisfaction]) => ({
      metricId,
      label: formatArenaMetric(metricId),
      satisfaction: roundTwo(satisfaction),
      officialOnly: officialOnlyMetricSet.has(metricId),
    }));
}

function strongestMetric(
  submission: ArenaSubmissionRecord,
  officialOnlyMetricIds: readonly string[],
): ArenaFeedbackMetricSignal | undefined {
  return metricSignals(submission, officialOnlyMetricIds).sort((left, right) => (
    right.satisfaction - left.satisfaction || left.metricId.localeCompare(right.metricId)
  ))[0];
}

function weakestMetric(
  submission: ArenaSubmissionRecord,
  officialOnlyMetricIds: readonly string[],
): ArenaFeedbackMetricSignal | undefined {
  return metricSignals(submission, officialOnlyMetricIds).sort((left, right) => (
    left.satisfaction - right.satisfaction || left.metricId.localeCompare(right.metricId)
  ))[0];
}

function hardConstraintGuidance(submission: ArenaSubmissionRecord): ArenaHardConstraintGuidance[] {
  return submission.evaluation.hardConstraintResults
    .filter((result) => !result.passed)
    .map((result) => ({
      label: result.label,
      reason: result.reason,
      suggestion: `先让${result.label}达标，再比较评分指标。`,
    }));
}

function hardConstraintFailures(guidance: ArenaHardConstraintGuidance[]): string[] {
  return guidance.map((result) => (result.reason ? `${result.label}：${result.reason}` : result.label));
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
  hardConstraintGuidanceItems: ArenaHardConstraintGuidance[] = [],
): string {
  if (failures.length > 0) {
    return `${hardConstraintGuidanceItems[0]?.suggestion ?? `先修复硬约束：${failures[0]}，再重新比较评分指标。`}`;
  }

  if (comparison?.state === 'regressed') {
    const regressedMetric = metricWithLargestRegression(input.latest, input.previousSubmissions ?? []) ?? weakest?.metricId;
    return `本次低于个人最佳，建议回到 ${regressedMetric ? formatArenaMetric(regressedMetric) : '变化最大的指标'} 检查参数调整。`;
  }

  if (issueTags.includes('energy-heavy')) {
    return '当前方案控制能量/能耗偏重，建议降低控制增益或提高能量权重后再提交。';
  }

  if (weakest) {
    return `下一步优先改善 ${weakest.label}，同时保持当前优势指标不退化。`;
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
  if (comparison.state === 'unchanged') {
    return `本次官方评测得分 ${scoreText}，与个人最佳持平。`;
  }
  return `本次官方评测得分 ${scoreText}。`;
}

function resolveProtocolVersion(input: BuildArenaSubmissionFeedbackInput): string | undefined {
  const metadataProtocol = input.latest.evaluation.metadata?.protocolVersion;
  return input.protocolVersion ??
    input.latest.evaluationProtocolVersion ??
    (typeof metadataProtocol === 'string' ? metadataProtocol : undefined);
}

function buildBoundaryNotes(protocolVersion?: string, hasOfficialOnlyMetrics = false): string[] {
  const notes = [
    '工作台预览只用于提交前检查，不进入正式排行榜。',
    protocolVersion
      ? `官方评测使用 ${protocolVersion} 协议生成得分、硬约束和排行榜记录。`
      : '官方评测会重新生成得分、硬约束和排行榜记录。',
  ];
  if (hasOfficialOnlyMetrics) {
    notes.push('官方专属指标可能不会出现在工作台预览中，只在官方评测后参与解释。');
  }
  return notes;
}

function buildOfficialOnlyMetricNotes(officialOnlyMetricIds: readonly string[]): string[] {
  return officialOnlyMetricIds.map((metricId) => (
    `${formatArenaMetric(metricId)} 仅官方评测后显示，用于解释正式排名，不从工作台预览泄露。`
  ));
}

function buildWeakestMetricGuidance(weakest?: ArenaFeedbackMetricSignal): string | undefined {
  if (!weakest) return undefined;
  if (/energy|controlEnergy/i.test(weakest.metricId)) {
    return `${weakest.label}偏弱，优先检查控制增益、能量权重和执行量约束。`;
  }
  return `${weakest.label}是当前最弱指标，先做小幅参数扰动并保留优势指标。`;
}

export function buildArenaSubmissionFeedback(input: BuildArenaSubmissionFeedbackInput): ArenaSubmissionFeedback {
  const officialOnlyMetricIds = input.officialOnlyMetricIds ?? [];
  const protocolVersion = resolveProtocolVersion(input);
  const scoreComposition = metricSignals(input.latest, officialOnlyMetricIds);
  const hardConstraintGuidanceItems = hardConstraintGuidance(input.latest);
  const failures = hardConstraintFailures(hardConstraintGuidanceItems);
  const rankingStatus: ArenaFeedbackRankingStatus = input.latest.evaluation.valid && failures.length === 0
    ? 'ranked'
    : 'not_ranked';
  const strongest = strongestMetric(input.latest, officialOnlyMetricIds);
  const weakest = weakestMetric(input.latest, officialOnlyMetricIds);
  const comparison = comparePersonalBest(input);
  const issueTags = buildIssueTags(input, weakest);
  const officialOnlyMetricNotes = buildOfficialOnlyMetricNotes(officialOnlyMetricIds);

  return {
    rankingStatus,
    title: rankingStatus === 'ranked' ? '提交已进入正式排名' : '提交未进入正式排名',
    summary: buildSummary(input.latest, comparison),
    score: roundOne(input.latest.evaluation.score),
    protocolVersion,
    scoreComposition,
    strongestMetric: strongest,
    weakestMetric: weakest,
    hardConstraintFailures: failures,
    hardConstraintGuidance: hardConstraintGuidanceItems,
    weakestMetricGuidance: buildWeakestMetricGuidance(weakest),
    personalBestComparison: comparison,
    issueTags,
    boundaryNotes: buildBoundaryNotes(protocolVersion, officialOnlyMetricNotes.length > 0),
    officialOnlyMetricNotes,
    nextStepSuggestion: buildSuggestion(
      input,
      failures,
      weakest,
      comparison,
      issueTags,
      hardConstraintGuidanceItems,
    ),
    privacyNote: input.mode === 'black-box'
      ? '黑箱反馈只展示聚合弱项，不公开隐藏场景参数、顺序或轨迹。'
      : undefined,
  };
}
