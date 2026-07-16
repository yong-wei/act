import type { LearningFact } from '@prisma/client';

import { calculateCompetencyVector, type TimeWindow } from './competency-engine';
// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: this vector is a non-authoritative class-scoped compatibility artifact.
import type { CompetencyVector } from './competency-model';

export const CLASS_COMPETENCY_MATERIALIZATION_VERSION = 'class-competency.v2';

export interface ClassScopedStudentProjection {
  userId: string;
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative vector retained for explicit compatibility consumers.
  competencyVector: CompetencyVector;
  factCount: number;
  riskFlags: [];
  growthRecords: [];
  recommendations: [];
}

export function buildClassScopedStudentProjections(
  studentIds: string[],
  scopedFacts: LearningFact[],
  timeWindow: TimeWindow = '1m',
): Map<string, ClassScopedStudentProjection> {
  const allowed = new Set(studentIds);
  const byUser = new Map<string, LearningFact[]>();
  for (const fact of scopedFacts) {
    if (!allowed.has(fact.userId)) continue;
    byUser.set(fact.userId, [...(byUser.get(fact.userId) ?? []), fact]);
  }
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: materialize legacy vectors only for explicit compatibility consumers.
  return new Map([...byUser].map(([userId, facts]) => [userId, {
    userId,
    competencyVector: calculateCompetencyVector(facts, timeWindow),
    factCount: facts.length,
    riskFlags: [],
    growthRecords: [],
    recommendations: [],
  }]));
}
