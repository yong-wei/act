/**
 * Competency Calculation Engine
 *
 * Calculates competency scores from learning facts.
 */

import type { LearningFact } from '@prisma/client';
import type {
  CompetencyVector,
  CompetencyScore,
  TrendVector,
  CompetencyDimension,
} from './competency-model';
import {
  COMPETENCY_DIMENSIONS,
  createEmptyCompetencyVector,
  calculateTrendDirection,
  getCompetencyLabel,
} from './competency-model';
import { resolveLearningFactProfileWeight } from './learning-fact-quality-weight';

export interface EvidenceQuestionSummary {
  questionId?: string;
  prompt?: string;
  studentAnswer?: string | null;
  referenceAnswer?: string;
  isCorrect?: boolean;
}

export interface EvidenceDetail {
  evidenceTitle?: string;
  stepId?: string;
  questionSummaries?: EvidenceQuestionSummary[];
}

export interface CompetencyEvidenceSummaryItem {
  id: string;
  factType: string;
  outcome: string;
  score?: number;
  moduleId?: string | null;
  lessonId?: string | null;
  sessionId?: string | null;
  sourceLogId?: string | null;
  sourceEventId?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  timeSpent?: number | null;
  quality?: string;
  evidenceTitle?: string;
  stepId?: string;
  questionSummaries?: EvidenceQuestionSummary[];
}

// Time windows for calculations
export type TimeWindow = '2w' | '1m' | '3m' | 'all';

const TIME_WINDOW_DAYS: Record<TimeWindow, number> = {
  '2w': 14,
  '1m': 30,
  '3m': 90,
  'all': 365 * 10, // 10 years effectively "all"
};

/**
 * Calculate competency vector from learning facts
 */
export function calculateCompetencyVector(
  facts: LearningFact[],
  timeWindow: TimeWindow = '1m'
): CompetencyVector {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - TIME_WINDOW_DAYS[timeWindow]);

  // Filter facts by time window
  const recentFacts = facts.filter(f => f.startedAt >= cutoffDate);

  // Group facts by competency contribution
  const factsByCompetency = groupFactsByCompetency(recentFacts);

  // Calculate score for each dimension
  const vector = createEmptyCompetencyVector();
  const now = new Date().toISOString();

  for (const dimension of COMPETENCY_DIMENSIONS) {
    const dimensionFacts = factsByCompetency[dimension] || [];
    vector[dimension] = calculateDimensionScore(dimensionFacts, dimension, now);
  }

  return vector;
}

/**
 * Group facts by their primary competency contribution
 */
function groupFactsByCompetency(
  facts: LearningFact[]
): Record<CompetencyDimension, LearningFact[]> {
  const grouped: Record<string, LearningFact[]> = {};

  for (const fact of facts) {
    const contribution = fact.competencyContribution as Record<string, number> || {};
    const profileWeight = resolveLearningFactProfileWeight(fact.contextJson);
    if (profileWeight <= 0) continue;

    for (const [competency, value] of Object.entries(contribution)) {
      const context = fact.contextJson && typeof fact.contextJson === 'object' && !Array.isArray(fact.contextJson)
        ? fact.contextJson as Record<string, unknown>
        : {};
      const normalizedRubricPerformance = fact.factType === 'document_rubric_grading'
        && typeof context.rubricWeight === 'number';
      if (!Number.isFinite(value) || (value * profileWeight === 0 && !normalizedRubricPerformance)) {
        continue;
      }

      if (!grouped[competency]) {
        grouped[competency] = [];
      }
      grouped[competency].push(fact);
    }
  }

  return grouped as Record<CompetencyDimension, LearningFact[]>;
}

/**
 * Calculate score for a single competency dimension
 */
function calculateDimensionScore(
  facts: LearningFact[],
  dimension: CompetencyDimension,
  now: string
): CompetencyScore {
  if (facts.length === 0) {
    return {
      score: 0,
      trend: 'stable',
      confidence: 0,
      evidenceCount: 0,
      lastUpdated: now,
    };
  }

  // Calculate weighted score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const fact of facts) {
    const weight = calculateFactWeight(fact);
    const contribution = getFactCompetencyContribution(fact, dimension);

    weightedSum += contribution * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0
    ? Math.max(0, Math.min(100, (weightedSum / totalWeight) * 100))
    : 0;

  const confidence = calculateConfidence(facts.length, facts);

  return {
    score: Math.round(score * 10) / 10,
    trend: 'stable', // Will be updated by comparing with previous snapshot
    confidence: Math.round(confidence * 100) / 100,
    evidenceCount: facts.length,
    lastUpdated: now,
  };
}

/**
 * Calculate weight for a fact based on recency and quality
 */
function calculateFactWeight(fact: LearningFact): number {
  const now = Date.now();
  const factTime = new Date(fact.startedAt).getTime();
  const daysAgo = (now - factTime) / (1000 * 60 * 60 * 24);

  // Recency decay (half-life of 30 days)
  const recencyWeight = Math.exp(-daysAgo / 30);

  // Outcome quality
  const outcomeWeights: Record<string, number> = {
    success: 1.0,
    partial: 0.7,
    failure: 0.3,
    abandoned: 0.1,
  };
  const outcomeWeight = outcomeWeights[fact.outcome] || 0.5;

  // Time spent (more time = more weight, but capped)
  const timeWeight = Math.min((fact.timeSpent || 0) / 300, 1); // Cap at 5 minutes

  const context = fact.contextJson && typeof fact.contextJson === 'object' && !Array.isArray(fact.contextJson)
    ? fact.contextJson as Record<string, unknown>
    : {};
  const rubricWeight = typeof context.rubricWeight === 'number' && Number.isFinite(context.rubricWeight) && context.rubricWeight > 0
    ? context.rubricWeight
    : null;
  if (rubricWeight !== null) return recencyWeight * (0.5 + 0.5 * timeWeight) * rubricWeight;

  return recencyWeight * outcomeWeight * (0.5 + 0.5 * timeWeight);
}

/**
 * Get competency contribution from a fact
 */
function getFactCompetencyContribution(fact: LearningFact, dimension: CompetencyDimension): number {
  const contribution = fact.competencyContribution as Record<string, number> || {};
  return (contribution[dimension] || 0) * resolveLearningFactProfileWeight(fact.contextJson);
}

/**
 * Calculate confidence based on evidence quantity and quality
 */
export function calculateConfidence(evidenceCount: number, facts: LearningFact[]): number {
  // Base confidence from count (diminishing returns after 10)
  const countConfidence = Math.min(evidenceCount / 10, 1);

  // Quality factor based on score variance
  const scores = facts.map(f => f.score).filter((s): s is number => s !== null);
  if (scores.length < 2) return countConfidence * 0.5;

  const variance = calculateVariance(scores);
  const qualityFactor = Math.exp(-variance / 100); // Lower variance = higher confidence

  return countConfidence * qualityFactor;
}

/**
 * Calculate variance of an array
 */
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate trend vector by comparing current and previous snapshots
 */
export function calculateTrendVector(
  current: CompetencyVector,
  previous: CompetencyVector
): TrendVector {
  return {
    controlModeling: calculateTrendDirection(
      current.controlModeling.score,
      previous.controlModeling.score
    ),
    parameterDesign: calculateTrendDirection(
      current.parameterDesign.score,
      previous.parameterDesign.score
    ),
    crossDomainTransfer: calculateTrendDirection(
      current.crossDomainTransfer.score,
      previous.crossDomainTransfer.score
    ),
    engineeringDecision: calculateTrendDirection(
      current.engineeringDecision.score,
      previous.engineeringDecision.score
    ),
    inquiryReflection: calculateTrendDirection(
      current.inquiryReflection.score,
      previous.inquiryReflection.score
    ),
    selfDirectedLearning: calculateTrendDirection(
      current.selfDirectedLearning.score,
      previous.selfDirectedLearning.score
    ),
  };
}

/**
 * Generate evidence summary for each dimension
 */
export function generateEvidenceSummary(
  facts: LearningFact[],
  topN: number = 3,
  evidenceDetails: Record<string, EvidenceDetail> = {},
): Record<CompetencyDimension, CompetencyEvidenceSummaryItem[]> {
  const grouped = groupFactsByCompetency(facts);
  const summary = {} as Record<CompetencyDimension, CompetencyEvidenceSummaryItem[]>;

  for (const dimension of COMPETENCY_DIMENSIONS) {
    const dimensionFacts = grouped[dimension] || [];
    summary[dimension] = dimensionFacts
      .sort(compareLearningFactRecencyDesc)
      .slice(0, topN)
      .map(f => {
        const detail = f.sourceLogId ? evidenceDetails[f.sourceLogId] : undefined;
        const context = readEvidenceContext(f.contextJson);
        return {
          id: f.id,
          factType: f.factType,
          outcome: f.outcome,
          score: typeof f.score === 'number' ? f.score : undefined,
          moduleId: f.moduleId,
          lessonId: f.lessonId,
          sessionId: f.sessionId,
          sourceLogId: f.sourceLogId,
          sourceEventId: f.sourceEventId,
          startedAt: f.startedAt.toISOString(),
          finishedAt: f.finishedAt?.toISOString() ?? null,
          createdAt: f.createdAt.toISOString(),
          timeSpent: f.timeSpent,
          quality: context.quality,
          evidenceTitle: detail?.evidenceTitle,
          stepId: detail?.stepId ?? context.stepId ?? (f.moduleId?.startsWith('step-') ? f.moduleId : undefined),
          questionSummaries: detail?.questionSummaries,
        };
      });
  }

  return summary;
}

function compareLearningFactRecencyDesc(a: LearningFact, b: LearningFact): number {
  const startedDiff = b.startedAt.getTime() - a.startedAt.getTime();
  if (startedDiff !== 0) return startedDiff;
  const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdDiff !== 0) return createdDiff;
  return b.id.localeCompare(a.id);
}

function readEvidenceContext(value: unknown): { quality?: string; stepId?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const context = value as Record<string, unknown>;
  const scoring = context.scoring && typeof context.scoring === 'object' && !Array.isArray(context.scoring)
    ? context.scoring as Record<string, unknown>
    : {};
  const quality = typeof scoring.evidenceQuality === 'string'
    ? scoring.evidenceQuality
    : typeof context.evidenceQuality === 'string'
      ? context.evidenceQuality
      : undefined;
  const stepId = typeof context.stepId === 'string' ? context.stepId : undefined;

  return { quality, stepId };
}

/**
 * Identify strengths (top 2 dimensions)
 */
export function identifyStrengths(vector: CompetencyVector): string[] {
  const dimensions = COMPETENCY_DIMENSIONS.map(d => ({
    dimension: d,
    score: vector[d].score,
    label: getCompetencyLabel(d),
  }));

  return dimensions
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .filter(d => d.score > 60) // Only if score > 60
    .map(d => d.label);
}

/**
 * Identify weaknesses (bottom 2 dimensions)
 */
export function identifyWeaknesses(vector: CompetencyVector): string[] {
  const dimensions = COMPETENCY_DIMENSIONS.map(d => ({
    dimension: d,
    score: vector[d].score,
    label: getCompetencyLabel(d),
  }));

  return dimensions
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .filter(d => d.score < 70) // Only if score < 70
    .map(d => d.label);
}
