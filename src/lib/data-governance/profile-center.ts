import {
  COMPETENCY_LEVELS,
  getCompetencyDescription,
  getCompetencyLabel,
  type CompetencyDimension,
  type CompetencyVector,
} from '@/lib/data-governance/competency-model';
import type {
  Recommendation,
  RecommendationConfidenceState,
  RecommendationEvidenceBasis,
  RecommendationRationale,
} from '@/lib/data-governance/recommendation-engine';
import type { RiskFlag } from '@/lib/data-governance/risk-detector';
import type {
  StudentEvidenceCoverageState,
  StudentEvidenceFeatureReadResult,
  StudentEvidenceStatusMarker,
  StudentEvidenceWindow,
} from '@/lib/data-governance/student-evidence-feature-cache';

export type ProfileActivityCategory = 'classroom' | 'interactive' | 'simulation' | 'assessment';

export interface ProfileActivityItem {
  id: string;
  category: ProfileActivityCategory;
  title: string;
  description: string;
  timestamp: string;
  href?: string;
  badge?: string;
  dedupeKey?: string;
}

export interface ProfileActivityGroup {
  category: ProfileActivityCategory;
  label: string;
  items: ProfileActivityItem[];
}

export interface AdaptivePracticeSummary {
  estimatedAbility: number | null;
  confidenceInterval: [number, number] | null;
  weakAreas: string[];
  recommendedFocus: string[];
  questionCount: number;
  actionUrl: string;
}

export interface PersonalizedResourceCard {
  id: string;
  type: 'interactive' | 'simulation' | 'knowledge' | 'assessment' | 'path';
  title: string;
  description: string;
  reason: string;
  actionUrl: string;
  actionLabel: string;
  priority: number;
  estimatedTime?: string;
  tags: string[];
  rationale?: RecommendationRationale;
}

export interface StudentProfileEvidenceStatus {
  state: StudentEvidenceFeatureReadResult['state'];
  evidenceBasis: RecommendationEvidenceBasis;
  refreshedAt: string | null;
  evidenceWindow: StudentEvidenceWindow;
  sourceCounts: {
    LearningFact: number;
    StudentCompetencySnapshot: number;
    StudentProfileSummary: number;
    byFactType: Record<string, number>;
  };
  sourceCoverage: Record<'LearningFact' | 'StudentCompetencySnapshot' | 'StudentProfileSummary', StudentEvidenceCoverageState>;
  confidence: {
    state: RecommendationConfidenceState;
    level: 'none' | 'low' | 'medium' | 'high';
    score: number;
    evidenceCount: number;
    sourceCompleteness: number;
  };
  statusMarkers: StudentEvidenceStatusMarker[];
  rawReadExceptions: StudentEvidenceFeatureReadResult['rawReadExceptions'];
}

const ACTIVITY_CATEGORY_LABELS: Record<ProfileActivityCategory, string> = {
  classroom: '课堂参与',
  interactive: '互动与跨域探索',
  simulation: '仿真训练',
  assessment: '评测与题目',
};

const ACTIVITY_CATEGORY_ORDER: ProfileActivityCategory[] = [
  'classroom',
  'interactive',
  'simulation',
  'assessment',
];

const COMPETENCY_LEVEL_LABELS: Record<keyof typeof COMPETENCY_LEVELS, string> = {
  excellent: '优秀',
  good: '良好',
  average: '中等',
  needsImprovement: '需提升',
  atRisk: '需关注',
};

export function dedupeRiskFlags(riskFlags: RiskFlag[]): RiskFlag[] {
  const unique = new Map<string, RiskFlag>();

  for (const risk of riskFlags) {
    const key = `${risk.type}|${risk.severity}|${risk.description}`;
    const existing = unique.get(key);
    if (!existing || risk.triggeredAt > existing.triggeredAt) {
      unique.set(key, risk);
    }
  }

  return Array.from(unique.values()).sort(
    (left, right) => right.triggeredAt.getTime() - left.triggeredAt.getTime()
  );
}

export function dedupeRecommendations<T extends { type: string; title: string; actionUrl?: string; description: string }>(
  recommendations: T[]
): T[] {
  const unique = new Map<string, T>();

  for (const recommendation of recommendations) {
    const key = `${recommendation.type}|${recommendation.title}|${recommendation.actionUrl ?? ''}|${recommendation.description}`;
    if (!unique.has(key)) {
      unique.set(key, recommendation);
    }
  }

  return Array.from(unique.values());
}

export function buildCompetencyDimensions(vector: CompetencyVector) {
  return (Object.keys(vector) as CompetencyDimension[]).map((key) => ({
    key,
    label: getCompetencyLabel(key),
    description: getCompetencyDescription(key),
    score: Math.round(vector[key].score),
    trend: vector[key].trend,
    confidence: Number(vector[key].confidence.toFixed(2)),
    evidenceCount: vector[key].evidenceCount,
  }));
}

export function getCompetencyLevelLabel(level: keyof typeof COMPETENCY_LEVELS) {
  return COMPETENCY_LEVEL_LABELS[level];
}

export function buildProfileActivityFeed(items: ProfileActivityItem[], previewSize: number = 3) {
  const deduped = new Map<string, ProfileActivityItem>();

  for (const item of items) {
    const dedupeKey = item.dedupeKey ?? `${item.category}|${item.title}|${item.timestamp}`;
    const existing = deduped.get(dedupeKey);
    if (!existing || new Date(item.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      deduped.set(dedupeKey, item);
    }
  }

  const sorted = Array.from(deduped.values()).sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );

  const grouped = ACTIVITY_CATEGORY_ORDER
    .map((category) => ({
      category,
      label: ACTIVITY_CATEGORY_LABELS[category],
      items: sorted.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return {
    preview: sorted.slice(0, previewSize),
    grouped,
    total: sorted.length,
  };
}

export function buildAdaptivePracticeSummary(input: {
  estimatedAbility?: number | null;
  confidenceInterval?: [number, number] | null;
  timeline?: Array<{ timestamp: number; theta: number; accuracy: number }>;
  weakAreas?: string[];
  recommendedFocus?: string[];
}): AdaptivePracticeSummary {
  return {
    estimatedAbility: input.estimatedAbility ?? null,
    confidenceInterval: input.confidenceInterval ?? null,
    weakAreas: input.weakAreas ?? [],
    recommendedFocus: input.recommendedFocus ?? [],
    questionCount: input.timeline?.length ?? 0,
    actionUrl: '/assessment/adaptive-practice',
  };
}

export function mapRecommendationsToResourceCards(
  recommendations: Recommendation[]
): PersonalizedResourceCard[] {
  return recommendations.map((recommendation) => ({
    id: recommendation.id,
    type: inferResourceType(recommendation.actionUrl, recommendation.tags),
    title: recommendation.title,
    description: recommendation.description,
    reason: recommendation.reason,
    actionUrl: recommendation.actionUrl,
    actionLabel: recommendation.actionLabel,
    priority: recommendation.priority,
    estimatedTime: recommendation.estimatedTime,
    tags: recommendation.tags,
    rationale: recommendation.rationale,
  }));
}

export function buildStudentProfileEvidenceStatus(input: {
  featureRead: StudentEvidenceFeatureReadResult;
  learningFacts: Array<{ startedAt: Date; factType?: string | null }>;
  hasLatestSnapshot: boolean;
}): StudentProfileEvidenceStatus {
  if (input.featureRead.cache) {
    const cache = input.featureRead.cache;
    const sourceCounts = normalizeSourceCounts(cache.sourceCounts);
    const statusMarkers = normalizeStatusMarkers(cache.statusMarkers);
    const confidence = normalizeConfidence(cache.confidenceMarkers);

    return {
      state: input.featureRead.state,
      evidenceBasis: 'student-evidence-feature-cache',
      refreshedAt: dateToIso(cache.refreshedAt),
      evidenceWindow: normalizeEvidenceWindow(cache.evidenceWindow),
      sourceCounts,
      sourceCoverage: normalizeSourceCoverage(cache.sourceCoverage),
      confidence: {
        state: resolveProfileConfidenceState(input.featureRead.state, statusMarkers),
        level: confidence.level,
        score: confidence.score,
        evidenceCount: confidence.evidenceCount || sourceCounts.LearningFact,
        sourceCompleteness: confidence.sourceCompleteness,
      },
      statusMarkers,
      rawReadExceptions: input.featureRead.rawReadExceptions,
    };
  }

  const evidenceCount = input.learningFacts.length;

  return {
    state: 'missing',
    evidenceBasis: evidenceCount > 0 ? 'governed-facts' : 'fallback',
    refreshedAt: null,
    evidenceWindow: buildLearningFactWindow(input.learningFacts),
    sourceCounts: {
      LearningFact: evidenceCount,
      StudentCompetencySnapshot: input.hasLatestSnapshot ? 1 : 0,
      StudentProfileSummary: 0,
      byFactType: countFactsByType(input.learningFacts),
    },
    sourceCoverage: {
      LearningFact: evidenceCount > 0 ? 'available' : 'missing',
      StudentCompetencySnapshot: input.hasLatestSnapshot ? 'available' : 'missing',
      StudentProfileSummary: 'missing',
    },
    confidence: {
      state: 'missing',
      level: evidenceCount > 0 || input.hasLatestSnapshot ? 'low' : 'none',
      score: evidenceCount > 0 || input.hasLatestSnapshot ? 0.25 : 0,
      evidenceCount,
      sourceCompleteness: input.hasLatestSnapshot ? 0.5 : 0,
    },
    statusMarkers: ['missing-source'],
    rawReadExceptions: input.featureRead.rawReadExceptions,
  };
}

function inferResourceType(actionUrl: string, tags: string[]) {
  if (actionUrl.includes('/assessment/')) {
    return 'assessment';
  }
  if (actionUrl.includes('/simulations/')) {
    return 'simulation';
  }
  if (actionUrl.includes('/knowledge') || tags.includes('知识卡片')) {
    return 'knowledge';
  }
  if (actionUrl.includes('/interactive-learning/')) {
    return 'interactive';
  }
  return 'path';
}

function normalizeEvidenceWindow(value: unknown): StudentEvidenceWindow {
  const window = getObject(value);
  return {
    firstStartedAt: stringOrNull(window.firstStartedAt),
    lastStartedAt: stringOrNull(window.lastStartedAt),
    daysCovered: numberValue(window.daysCovered),
  };
}

function buildLearningFactWindow(facts: Array<{ startedAt: Date }>): StudentEvidenceWindow {
  if (facts.length === 0) {
    return {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    };
  }

  const sorted = [...facts].sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
  const first = sorted[0].startedAt;
  const last = sorted[sorted.length - 1].startedAt;

  return {
    firstStartedAt: first.toISOString(),
    lastStartedAt: last.toISOString(),
    daysCovered: Math.ceil((last.getTime() - first.getTime()) / 86400000),
  };
}

function countFactsByType(facts: Array<{ factType?: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const fact of facts) {
    if (fact.factType) {
      counts[fact.factType] = (counts[fact.factType] ?? 0) + 1;
    }
  }
  return counts;
}

function normalizeSourceCounts(value: unknown): StudentProfileEvidenceStatus['sourceCounts'] {
  const counts = getObject(value);
  return {
    LearningFact: numberValue(counts.LearningFact),
    StudentCompetencySnapshot: numberValue(counts.StudentCompetencySnapshot),
    StudentProfileSummary: numberValue(counts.StudentProfileSummary),
    byFactType: normalizeFactTypeCounts(counts.byFactType),
  };
}

function normalizeFactTypeCounts(value: unknown): Record<string, number> {
  const counts = getObject(value);
  return Object.fromEntries(
    Object.entries(counts).filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
  );
}

function normalizeSourceCoverage(
  value: unknown
): StudentProfileEvidenceStatus['sourceCoverage'] {
  const coverage = getObject(value);
  return {
    LearningFact: normalizeCoverageState(coverage.LearningFact),
    StudentCompetencySnapshot: normalizeCoverageState(coverage.StudentCompetencySnapshot),
    StudentProfileSummary: normalizeCoverageState(coverage.StudentProfileSummary),
  };
}

function normalizeCoverageState(value: unknown): StudentEvidenceCoverageState {
  return value === 'available' || value === 'partial' || value === 'missing'
    ? value
    : 'missing';
}

function normalizeConfidence(value: unknown): {
  level: StudentProfileEvidenceStatus['confidence']['level'];
  score: number;
  evidenceCount: number;
  sourceCompleteness: number;
} {
  const confidence = getObject(value);
  const level = confidence.level;
  return {
    level: level === 'none' || level === 'low' || level === 'medium' || level === 'high'
      ? level
      : 'none',
    score: numberValue(confidence.score),
    evidenceCount: numberValue(confidence.evidenceCount),
    sourceCompleteness: numberValue(confidence.sourceCompleteness),
  };
}

function normalizeStatusMarkers(value: unknown): StudentEvidenceStatusMarker[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is StudentEvidenceStatusMarker =>
    item === 'stale' ||
    item === 'partial' ||
    item === 'low-confidence' ||
    item === 'missing-source'
  );
}

function resolveProfileConfidenceState(
  readState: StudentEvidenceFeatureReadResult['state'],
  markers: StudentEvidenceStatusMarker[]
): RecommendationConfidenceState {
  if (readState === 'missing' || readState === 'stale') {
    return readState;
  }
  if (markers.includes('partial')) {
    return 'partial';
  }
  if (markers.includes('low-confidence') || markers.includes('missing-source')) {
    return 'low-confidence';
  }
  return 'ready';
}

function getObject(value: unknown): Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function dateToIso(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
