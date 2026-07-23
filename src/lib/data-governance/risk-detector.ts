/**
 * Risk Detection Engine
 *
 * Automatically detects learning risks from competency data and facts.
 */

import type { LearningFact } from '@prisma/client';
// portrait-v2-legacy-compatibility-adapter: old six-dimension input is non-authoritative.
import type { CompetencyVector } from './competency-model';
import { calculateOverallScore } from './competency-model';
import type { PortraitV2PayloadShape } from './portrait-v2-model';

export type RiskType =
  | 'participation'
  | 'stagnation'
  | 'ai_misuse'
  | 'constraint'
  | 'cross_domain';

export type RiskSeverity = 'low' | 'medium' | 'high';
export type CumulativeRiskType = Extract<RiskType, 'constraint' | 'stagnation' | 'cross_domain'>;

export interface RiskFlag {
  type: RiskType;
  severity: RiskSeverity;
  description: string;
  evidence: Record<string, unknown>;
  triggeredAt: Date;
}

export interface RiskDetectionContext {
  userId: string;
  facts: LearningFact[];
  competencyVector: CompetencyVector;
  previousSnapshot?: CompetencyVector;
  classAverage?: CompetencyVector;
  portraitEvidenceAt?: Date | string;
}

export interface CumulativeRiskFact {
  id: string;
  factType?: string;
  startedAt: Date;
  outcome: string;
  competencyContribution: unknown;
}

export interface CumulativePortraitRiskDetectionContext {
  userId: string;
  facts: CumulativeRiskFact[];
  currentPortrait: PortraitV2PayloadShape;
  previousPortrait?: PortraitV2PayloadShape | null;
}

// portrait-v2-legacy-compatibility-adapter: preserve the non-authoritative legacy caller contract only.
export function detectRisks(context: RiskDetectionContext): RiskFlag[] {
  return detectRiskSet({
    facts: context.facts,
    // portrait-v2-legacy-compatibility-adapter: this input remains non-authoritative.
    currentScores: legacyScores(context.competencyVector),
    previousScores: context.previousSnapshot ? legacyScores(context.previousSnapshot) : null,
    portraitEvidenceAt: context.portraitEvidenceAt,
  });
}

export function detectCumulativePortraitRisks(
  context: CumulativePortraitRiskDetectionContext,
): RiskFlag[] {
  return detectRiskSet({
    facts: context.facts,
    currentScores: portraitScores(context.currentPortrait),
    previousScores: context.previousPortrait ? portraitScores(context.previousPortrait) : null,
    portraitEvidenceAt: latestPortraitEvidenceAt(context.currentPortrait),
  });
}

export interface EvidenceRiskStateChange {
  riskKey: CumulativeRiskType;
  type: CumulativeRiskType;
  isActive: boolean;
  severity: RiskSeverity;
  evidence: Record<string, unknown>;
  supportFactIds: string[];
  occurredAt: Date;
}

export function buildEvidenceRiskStateChanges(input: {
  previous: RiskFlag[];
  current: RiskFlag[];
  clearAt?: Date;
}): EvidenceRiskStateChange[] {
  const previous = new Map(input.previous
    .filter(isCumulativeRisk)
    .map((risk) => [risk.type, risk]));
  const current = new Map(input.current
    .filter(isCumulativeRisk)
    .map((risk) => [risk.type, risk]));
  const types: CumulativeRiskType[] = ['constraint', 'stagnation', 'cross_domain'];
  return types.flatMap((type) => {
    const next = current.get(type);
    const prior = previous.get(type);
    if (!next && !prior) return [];
    if (next && prior && sameRiskState(prior, next)) return [];
    const risk = next ?? prior!;
    return [{
      riskKey: type,
      type,
      isActive: Boolean(next),
      severity: risk.severity,
      evidence: { ...risk.evidence },
      supportFactIds: readSupportFactIds(risk.evidence),
      occurredAt: next
        ? new Date(next.triggeredAt)
        : new Date(input.clearAt ?? prior!.triggeredAt),
    }];
  });
}

interface RiskScoreSet {
  overall: number | null;
  controlModelingRepresentation: number | null;
  transferIntegratedApplication: number | null;
}

interface NormalizedRiskDetectionContext {
  facts: CumulativeRiskFact[];
  currentScores: RiskScoreSet;
  previousScores: RiskScoreSet | null;
  portraitEvidenceAt?: Date | string;
}

function detectRiskSet(context: NormalizedRiskDetectionContext): RiskFlag[] {
  return [
    detectConstraintRisk(context),
    detectStagnationRisk(context),
    detectCrossDomainRisk(context),
  ].filter((risk): risk is RiskFlag => risk !== null);
}

function detectConstraintRisk(context: NormalizedRiskDetectionContext): RiskFlag | null {
  const ethicalViolations = context.facts.filter((fact) =>
    fact.factType === 'ethical' && fact.outcome === 'failure');
  const simulationViolations = context.facts.filter((fact) => {
    if (fact.factType !== 'simulation') return false;
    const contribution = asRecord(fact.competencyContribution);
    return typeof contribution.engineeringDecision === 'number' && contribution.engineeringDecision < 0;
  });
  const support = [...ethicalViolations, ...simulationViolations];
  if (ethicalViolations.length < 3 && simulationViolations.length < 3) return null;
  const high = ethicalViolations.length >= 5;
  return {
    type: 'constraint',
    severity: high ? 'high' : 'medium',
    description: high ? '多次违反工程约束或伦理规范' : '存在持续支持的工程约束违规证据',
    evidence: {
      violationCount: ethicalViolations.length,
      poorConstraintCount: simulationViolations.length,
      supportFactIds: orderedFactIds(support),
    },
    triggeredAt: latestEvidenceTime(context, support),
  };
}

function detectStagnationRisk(context: NormalizedRiskDetectionContext): RiskFlag | null {
  if (!context.previousScores) return null;
  const currentScore = context.currentScores.overall;
  const previousScore = context.previousScores.overall;
  if (currentScore === null || previousScore === null) return null;
  const change = currentScore - previousScore;
  if (change >= -5) return null;
  const supportingFacts = factsWithProfileContribution(context.facts);
  return {
    type: 'stagnation',
    severity: change < -10 ? 'high' : 'medium',
    description: change < -10 ? '能力值出现明显下滑' : '能力值出现下滑趋势',
    evidence: { currentScore, previousScore, change, supportFactIds: orderedFactIds(supportingFacts) },
    triggeredAt: latestEvidenceTime(context, supportingFacts),
  };
}

function detectCrossDomainRisk(context: NormalizedRiskDetectionContext): RiskFlag | null {
  const controlScore = context.currentScores.controlModelingRepresentation;
  const crossDomainScore = context.currentScores.transferIntegratedApplication;
  if (controlScore === null || crossDomainScore === null) return null;
  const assessments = context.facts.filter((fact) =>
    fact.factType === 'question' &&
    hasCrossDomainContribution(fact.competencyContribution));
  const crossDomainRate = assessments.length === 0
    ? null
    : assessments.filter((fact) => fact.outcome === 'success').length / assessments.length;
  const high = (controlScore > 75 && crossDomainScore < 50) ||
    (assessments.length >= 3 && crossDomainRate !== null && crossDomainRate < 0.3);
  const medium = controlScore > 65 && crossDomainScore < 45;
  if (!high && !medium) return null;
  return {
    type: 'cross_domain',
    severity: high ? 'high' : 'medium',
    description: high ? '跨域知识迁移存在明显障碍' : '跨域知识迁移能力有待提升',
    evidence: {
      controlScore,
      crossDomainScore,
      ...(crossDomainRate === null ? {} : { crossDomainRate, totalAttempts: assessments.length }),
      supportFactIds: orderedFactIds(assessments),
    },
    triggeredAt: latestEvidenceTime(context, assessments),
  };
}

function latestEvidenceTime(
  context: Pick<NormalizedRiskDetectionContext, 'currentScores' | 'previousScores' | 'portraitEvidenceAt'>,
  supportingFacts: CumulativeRiskFact[],
): Date {
  const candidates = supportingFacts.map((fact) => fact.startedAt.getTime());
  if (candidates.length > 0) return new Date(Math.max(...candidates));
  const portraitEvidenceAt = normalizeTime(context.portraitEvidenceAt);
  if (portraitEvidenceAt !== null) candidates.push(portraitEvidenceAt);
  return new Date(candidates.length === 0 ? 0 : Math.max(...candidates));
}

function orderedFactIds(facts: CumulativeRiskFact[]): string[] {
  return [...new Map([...facts]
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime() || left.id.localeCompare(right.id))
    .map((fact) => [fact.id, fact.id])).values()];
}

function readSupportFactIds(evidence: Record<string, unknown>): string[] {
  return Array.isArray(evidence.supportFactIds)
    ? evidence.supportFactIds.filter((value): value is string => typeof value === 'string')
    : [];
}

function isCumulativeRisk(risk: RiskFlag): risk is RiskFlag & { type: CumulativeRiskType } {
  return risk.type === 'constraint' || risk.type === 'stagnation' || risk.type === 'cross_domain';
}

function sameRiskState(left: RiskFlag, right: RiskFlag): boolean {
  return left.severity === right.severity &&
    stableJson(left.evidence) === stableJson(right.evidence);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function portraitScores(payload: PortraitV2PayloadShape): RiskScoreSet {
  const evidenced = payload.dimensions.filter((dimension) =>
    dimension.evidenceSummary.totalCount > 0);
  return {
    overall: average(evidenced.map((dimension) => dimension.score)),
    controlModelingRepresentation: dimensionScore(payload, 'controlModelingRepresentation'),
    transferIntegratedApplication: dimensionScore(payload, 'transferIntegratedApplication'),
  };
}

// portrait-v2-legacy-compatibility-adapter: translate legacy scores without changing cumulative portrait semantics.
function legacyScores(vector: CompetencyVector): RiskScoreSet {
  return {
    overall: calculateOverallScore(vector),
    controlModelingRepresentation: vector.controlModeling.score,
    transferIntegratedApplication: vector.crossDomainTransfer.score,
  };
}

function dimensionScore(payload: PortraitV2PayloadShape, id: string): number | null {
  const dimension = payload.dimensions.find((item) =>
    item.id === id && item.evidenceSummary.totalCount > 0);
  return dimension?.score ?? null;
}

function latestPortraitEvidenceAt(payload: PortraitV2PayloadShape): string | undefined {
  const values = payload.dimensions.flatMap((dimension) =>
    dimension.evidenceSummary.totalCount > 0 && dimension.freshness.asOf
      ? [dimension.freshness.asOf]
      : []);
  return values.length === 0
    ? undefined
    : values.reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest);
}

function factsWithProfileContribution(facts: CumulativeRiskFact[]): CumulativeRiskFact[] {
  return facts.filter((fact) =>
    Object.values(asRecord(fact.competencyContribution))
      .some((value) => typeof value === 'number' && Number.isFinite(value) && value !== 0));
}

function hasCrossDomainContribution(value: unknown): boolean {
  const contribution = asRecord(value);
  return Object.prototype.hasOwnProperty.call(contribution, 'crossDomainTransfer') ||
    Object.prototype.hasOwnProperty.call(contribution, 'transferIntegratedApplication');
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeTime(value: Date | string | undefined): number | null {
  if (value === undefined) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * Get risk level description
 */
export function getRiskLevelDescription(riskCount: number): string {
  if (riskCount === 0) return '无风险';
  if (riskCount === 1) return '低风险';
  if (riskCount <= 2) return '中风险';
  return '高风险';
}

/**
 * Get recommended scaffolding based on risks
 */
export function getRecommendedScaffolding(risks: RiskFlag[]): string {
  const riskTypes = new Set(risks.map(r => r.type));

  if (riskTypes.has('participation')) {
    return '建议教师主动关注，了解学习障碍，提供参与激励';
  }

  if (riskTypes.has('ai_misuse')) {
    return '引导学生正确使用AI助手：先独立思考，再针对性提问';
  }

  if (riskTypes.has('cross_domain')) {
    return '加强跨域概念联系，推荐联动练习和对比分析';
  }

  if (riskTypes.has('constraint')) {
    return '强化工程约束意识，在仿真前明确安全边界';
  }

  if (riskTypes.has('stagnation')) {
    return '调整学习路径难度，提供阶梯式挑战和及时反馈';
  }

  return '继续保持当前学习节奏';
}
