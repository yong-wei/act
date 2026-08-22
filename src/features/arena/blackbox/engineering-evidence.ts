import type {
  ArenaBlackBoxExperimentDataset,
  ArenaVirtualSimulationPreviewRun,
} from './contracts';

export type BlackBoxEngineeringEvidenceLevel = 'low' | 'medium' | 'high';
export type BlackBoxPreviewMismatchLevel = 'none' | BlackBoxEngineeringEvidenceLevel;

export interface ArenaBlackBoxExperimentBudget {
  limit: number;
  used: number;
  remaining: number;
}

export interface BlackBoxExperimentBudgetCoverageEvidence {
  budgetLimit: number;
  budgetUsed: number;
  budgetRemaining: number;
  budgetUsageRatio: number;
  latestCost: number;
  sampleCount: number;
  signalType: string;
  duration: number;
  inputRange: number;
  outputRange: number;
  coverageScore: number;
  coverageLevel: BlackBoxEngineeringEvidenceLevel;
  summary: string;
  suggestions: string[];
}

export interface BlackBoxNominalModelConfidenceEvidence {
  confidenceScore: number;
  confidenceLevel: BlackBoxEngineeringEvidenceLevel;
  previewMismatchScore: number | null;
  previewMismatchLevel: BlackBoxPreviewMismatchLevel;
  summary: string;
  boundaryNote: string;
  suggestions: string[];
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function levelFromScore(score: number): BlackBoxEngineeringEvidenceLevel {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

function numericRange(values: readonly number[]): number {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return 0;
  return Math.max(...finiteValues) - Math.min(...finiteValues);
}

function evidenceLevelLabel(level: BlackBoxEngineeringEvidenceLevel | BlackBoxPreviewMismatchLevel): string {
  if (level === 'high') return '高';
  if (level === 'medium') return '中';
  if (level === 'low') return '低';
  return '暂无';
}

export function buildBlackBoxExperimentBudgetCoverageEvidence(
  dataset: ArenaBlackBoxExperimentDataset,
  budget: ArenaBlackBoxExperimentBudget,
): BlackBoxExperimentBudgetCoverageEvidence {
  const sampleCount = dataset.samples.length;
  const inputRange = roundTwo(numericRange(dataset.samples.map((sample) => sample.input)));
  const outputRange = roundTwo(numericRange(dataset.samples.map((sample) => sample.output)));
  const sampleCoverage = clamp01(sampleCount / 80);
  const durationCoverage = clamp01(dataset.duration / 16);
  const excitationCoverage = clamp01(inputRange / 1.2);
  const outputCoverage = clamp01(outputRange / 0.7);
  const coverageScore = roundTwo(
    sampleCoverage * 0.3 +
    durationCoverage * 0.25 +
    excitationCoverage * 0.25 +
    outputCoverage * 0.2,
  );
  const coverageLevel = levelFromScore(coverageScore);
  const budgetUsageRatio = budget.limit > 0 ? roundTwo(budget.used / budget.limit) : 1;
  const suggestions = [
    coverageLevel === 'low' ? '补充更长时长或更丰富输入的公开实验，再保存名义模型。' : undefined,
    inputRange < 0.5 ? '当前输入激励范围偏窄，可尝试 PRBS 或正弦信号扩大覆盖。' : undefined,
    budget.remaining <= 0 ? '今日实验预算已用尽，后续只能基于已有公开实验证据调参。' : undefined,
  ].filter(Boolean) as string[];

  return {
    budgetLimit: budget.limit,
    budgetUsed: budget.used,
    budgetRemaining: budget.remaining,
    budgetUsageRatio,
    latestCost: dataset.budgetCost,
    sampleCount,
    signalType: dataset.signalType,
    duration: dataset.duration,
    inputRange,
    outputRange,
    coverageScore,
    coverageLevel,
    summary: `实验预算 ${budget.used}/${budget.limit}，本次消耗 ${dataset.budgetCost}；覆盖${evidenceLevelLabel(coverageLevel)}，${sampleCount} 个采样点。`,
    suggestions,
  };
}

export function buildBlackBoxNominalModelConfidenceEvidence({
  dataset,
  budget,
  preview,
}: {
  dataset: ArenaBlackBoxExperimentDataset;
  budget?: ArenaBlackBoxExperimentBudget;
  preview?: ArenaVirtualSimulationPreviewRun | null;
}): BlackBoxNominalModelConfidenceEvidence {
  const coverage = budget
    ? buildBlackBoxExperimentBudgetCoverageEvidence(dataset, budget)
    : undefined;
  const baseConfidence = clamp01(dataset.summary.dataQuality);
  const coverageScore = coverage?.coverageScore ?? clamp01(dataset.samples.length / 80);
  const previewMismatchScore = preview
    ? roundTwo(clamp01(
      preview.summary.trackingError / 0.45 * 0.45 +
      preview.summary.maxDeviation / 0.75 * 0.35 +
      Math.min(preview.summary.safetyViolations, 4) / 4 * 0.2,
    ))
    : null;
  const previewConfidence = previewMismatchScore === null ? 0.65 : 1 - previewMismatchScore;
  const confidenceScore = roundTwo(baseConfidence * 0.5 + coverageScore * 0.3 + previewConfidence * 0.2);
  const confidenceLevel = levelFromScore(confidenceScore);
  const previewMismatchLevel: BlackBoxPreviewMismatchLevel = previewMismatchScore === null
    ? 'none'
    : levelFromScore(previewMismatchScore);
  const suggestions = [
    confidenceLevel === 'low' ? '先扩大公开实验覆盖，再把名义模型用于控制器提交。' : undefined,
    previewMismatchLevel === 'high' ? '预演偏差较高，提交前应降低控制增益或调整能量约束。' : undefined,
    preview?.summary.safetyViolations ? '预演已出现安全违反，应先处理约束再提交官方评测。' : undefined,
  ].filter(Boolean) as string[];

  return {
    confidenceScore,
    confidenceLevel,
    previewMismatchScore,
    previewMismatchLevel,
    summary: `名义模型置信度${evidenceLevelLabel(confidenceLevel)}；预演偏差${evidenceLevelLabel(previewMismatchLevel)}。`,
    boundaryNote: '该证据只来自学生公开实验和虚拟预演，不代表官方隐藏对象或隐藏场景顺序。',
    suggestions,
  };
}
