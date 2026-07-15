import type { LearningFact } from '@prisma/client';

import { calculateCompetencyVector } from './competency-engine';
import type { CompetencyVector } from './competency-model';

export const CLASS_COMPETENCY_MATERIALIZATION_VERSION = 'class-competency.v2';

export interface ClassScopedStudentProjection {
  userId: string;
  competencyVector: CompetencyVector;
  factCount: number;
  riskFlags: [];
  growthRecords: [];
  recommendations: [];
}

export function buildClassScopedStudentProjections(
  studentIds: string[],
  scopedFacts: LearningFact[],
): Map<string, ClassScopedStudentProjection> {
  const allowed = new Set(studentIds);
  const byUser = new Map<string, LearningFact[]>();
  for (const fact of scopedFacts) {
    if (!allowed.has(fact.userId)) continue;
    byUser.set(fact.userId, [...(byUser.get(fact.userId) ?? []), fact]);
  }
  return new Map([...byUser].map(([userId, facts]) => [userId, {
    userId,
    competencyVector: calculateCompetencyVector(facts, '1m'),
    factCount: facts.length,
    riskFlags: [],
    growthRecords: [],
    recommendations: [],
  }]));
}
