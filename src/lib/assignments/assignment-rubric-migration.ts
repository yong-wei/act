import { createHash } from 'node:crypto';

import { roundUpToOneDecimal } from './assignment-rubric-contract';
import type { AssignmentDraftInput } from './assignment-domain';

export interface LegacyRubricMigrationCandidate {
  questionId: string;
  revisionId?: string;
  revisionState: 'DRAFT' | 'PUBLISHED';
  questionPoints?: number;
  assignmentTotalPoints?: number;
  rubric: unknown;
}

export interface LegacyRubricMigrationEntry {
  questionRef: string;
  disposition: 'already-v2' | 'preserve-published-v1' | 'mappable-draft-v1' | 'unmappable';
  roundingDifferences: number;
  reasons: string[];
}

export interface LegacyRubricMigrationReport {
  version: 'assignment-rubric-v2-migration-report.v1';
  summary: {
    candidateCount: number;
    alreadyV2Count: number;
    preservedPublishedCount: number;
    mappableDraftCount: number;
    unmappableCount: number;
    roundingDifferenceCount: number;
  };
  entries: LegacyRubricMigrationEntry[];
}

export function planLegacyRubricMigration(
  candidates: readonly LegacyRubricMigrationCandidate[],
): LegacyRubricMigrationReport {
  const countedRevisions = new Set<string>();
  const entries = candidates.map((candidate) => {
    const includeAssignmentTotal = !candidate.revisionId || !countedRevisions.has(candidate.revisionId);
    if (candidate.revisionId) countedRevisions.add(candidate.revisionId);
    return planCandidate(candidate, includeAssignmentTotal);
  });
  return {
    version: 'assignment-rubric-v2-migration-report.v1',
    summary: {
      candidateCount: entries.length,
      alreadyV2Count: count(entries, 'already-v2'),
      preservedPublishedCount: count(entries, 'preserve-published-v1'),
      mappableDraftCount: count(entries, 'mappable-draft-v1'),
      unmappableCount: count(entries, 'unmappable'),
      roundingDifferenceCount: entries.reduce((sum, entry) => sum + entry.roundingDifferences, 0),
    },
    entries,
  };
}

export function migrateLegacyAssignmentDraftToRubricV2(
  draft: AssignmentDraftInput,
): AssignmentDraftInput {
  return {
    ...draft,
    totalPoints: roundUpToOneDecimal(draft.totalPoints),
    questions: draft.questions.map((question) => {
      if (question.rubric.schemaVersion === 'assignment-scoring-rubric.v2') {
        return {
          ...question,
          points: roundUpToOneDecimal(question.points),
        };
      }
      return {
        ...question,
        points: roundUpToOneDecimal(question.points),
        rubric: {
          schemaVersion: 'assignment-scoring-rubric.v2' as const,
          criteria: question.rubric.criteria.map((criterion) => ({
            id: criterion.id,
            label: criterion.label,
            maxPoints: roundUpToOneDecimal(criterion.maxPoints),
            scoringStandard: criterion.evidenceDescription,
            detailedRubricEnabled: true,
            evidenceDescription: criterion.evidenceDescription,
            feedbackGuidance: criterion.feedbackGuidance,
            studentVisibleGuidance: criterion.studentVisibleGuidance,
            levels: criterion.levels.map((level, index) => ({
              id: level.id,
              label: level.label,
              maxPoints: roundUpToOneDecimal(index === 0
                ? criterion.maxPoints
                : criterion.levels[index - 1].minPoints),
              guideline: level.description,
            })),
          })),
        },
      };
    }),
  };
}

function planCandidate(
  candidate: LegacyRubricMigrationCandidate,
  includeAssignmentTotal: boolean,
): LegacyRubricMigrationEntry {
  const questionRef = createHash('sha256').update(candidate.questionId).digest('hex').slice(0, 16);
  const rubric = asRecord(candidate.rubric);
  if (!rubric) return { questionRef, disposition: 'unmappable', roundingDifferences: 0, reasons: ['rubric-not-object'] };
  if (rubric.schemaVersion === 'assignment-scoring-rubric.v2') {
    return { questionRef, disposition: 'already-v2', roundingDifferences: 0, reasons: [] };
  }
  if (rubric.schemaVersion !== 'assignment-analytic-rubric.v1') {
    return { questionRef, disposition: 'unmappable', roundingDifferences: 0, reasons: ['unsupported-schema-version'] };
  }
  const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : [];
  const reasons: string[] = [];
  let roundingDifferences = 0;
  for (const value of [
    candidate.questionPoints,
    includeAssignmentTotal ? candidate.assignmentTotalPoints : undefined,
  ]) {
    if (value !== undefined && Math.abs(roundUpToOneDecimal(value) - value) > 1e-8) {
      roundingDifferences += 1;
    }
  }
  if (criteria.length === 0) reasons.push('criteria-missing');
  for (const criterionValue of criteria) {
    const criterion = asRecord(criterionValue);
    if (!criterion) {
      reasons.push('criterion-not-object');
      continue;
    }
    const maxPoints = finiteNumber(criterion.maxPoints);
    const levels = Array.isArray(criterion.levels) ? criterion.levels : [];
    if (!String(criterion.id ?? '').trim()) reasons.push('criterion-id-missing');
    if (maxPoints === null || maxPoints < 1) reasons.push('criterion-maximum-below-1.0');
    if (!String(criterion.evidenceDescription ?? '').trim()) reasons.push('scoring-standard-source-missing');
    if (levels.length === 0) reasons.push('legacy-levels-missing');
    const mappedThresholds: number[] = [];
    for (const [index, levelValue] of levels.entries()) {
      const level = asRecord(levelValue);
      if (!level) {
        reasons.push('level-not-object');
        continue;
      }
      const previousLevel = index > 0 ? asRecord(levels[index - 1]) : null;
      const source = index === 0 ? maxPoints : finiteNumber(previousLevel?.minPoints);
      if (source === null) {
        reasons.push('level-boundary-missing');
        continue;
      }
      const rounded = roundUpToOneDecimal(source);
      if (Math.abs(rounded - source) > 1e-8) roundingDifferences += 1;
      mappedThresholds.push(rounded);
      if (!String(level.description ?? '').trim()) reasons.push('level-guideline-source-missing');
    }
    for (let index = 1; index < mappedThresholds.length; index += 1) {
      if (mappedThresholds[index] >= mappedThresholds[index - 1]) reasons.push('rounded-level-boundaries-collide');
    }
  }
  const uniqueReasons = [...new Set(reasons)];
  if (uniqueReasons.length > 0) {
    return { questionRef, disposition: 'unmappable', roundingDifferences, reasons: uniqueReasons };
  }
  return {
    questionRef,
    disposition: candidate.revisionState === 'PUBLISHED'
      ? 'preserve-published-v1'
      : 'mappable-draft-v1',
    roundingDifferences,
    reasons: [],
  };
}

function count(entries: readonly LegacyRubricMigrationEntry[], disposition: LegacyRubricMigrationEntry['disposition']): number {
  return entries.filter((entry) => entry.disposition === disposition).length;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
