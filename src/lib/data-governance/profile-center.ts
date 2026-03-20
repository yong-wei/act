import {
  COMPETENCY_LEVELS,
  getCompetencyDescription,
  getCompetencyLabel,
  type CompetencyDimension,
  type CompetencyVector,
} from '@/lib/data-governance/competency-model';
import type { Recommendation } from '@/lib/data-governance/recommendation-engine';
import type { RiskFlag } from '@/lib/data-governance/risk-detector';

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
  }));
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
