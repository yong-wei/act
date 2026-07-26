import { describe, expect, it } from 'vitest';

import { buildRubricBackedSubjectiveAssignmentFixture } from '../assignments/assignment-fixtures';
import {
  migrateLegacyAssignmentDraftToRubricV2,
  planLegacyRubricMigration,
} from '../assignments/assignment-rubric-migration';

const legacy = {
  schemaVersion: 'assignment-analytic-rubric.v1',
  criteria: [{
    id: 'quality',
    label: '完成质量',
    maxPoints: 2.55,
    evidenceDescription: '依据证据评分。',
    feedbackGuidance: '给出反馈。',
    levels: [
      { id: 'high', label: '高', minPoints: 1.26, maxPoints: 2.55, description: '充分。' },
      { id: 'low', label: '低', minPoints: 0, maxPoints: 1.25, description: '不足。' },
    ],
  }],
};

describe('assignment rubric v2 migration report', () => {
  it('reports rounding while preserving immutable published v1 snapshots', () => {
    const report = planLegacyRubricMigration([
      { questionId: 'published-question', revisionState: 'PUBLISHED', questionPoints: 2.55, assignmentTotalPoints: 2.55, rubric: legacy },
      { questionId: 'draft-question', revisionState: 'DRAFT', questionPoints: 2.55, assignmentTotalPoints: 2.55, rubric: legacy },
    ]);
    expect(report.summary).toEqual(expect.objectContaining({
      candidateCount: 2,
      preservedPublishedCount: 1,
      mappableDraftCount: 1,
      roundingDifferenceCount: 8,
    }));
    expect(report.entries.every((entry) => entry.questionRef.length === 16)).toBe(true);
  });

  it('reports unmappable boundary collisions without inventing intervals', () => {
    const report = planLegacyRubricMigration([{
      questionId: 'collision',
      revisionState: 'DRAFT',
      rubric: {
        ...legacy,
        criteria: [{
          ...legacy.criteria[0],
          maxPoints: 1,
          levels: [
            { id: 'high', minPoints: 0.96, description: '高。' },
            { id: 'low', minPoints: 0.95, description: '低。' },
          ],
        }],
      },
    }]);
    expect(report.summary.unmappableCount).toBe(1);
    expect(report.entries[0].reasons).toContain('rounded-level-boundaries-collide');
  });

  it('creates a v2 next-draft shape without mutating the legacy source', () => {
    const source = buildRubricBackedSubjectiveAssignmentFixture();
    const migrated = migrateLegacyAssignmentDraftToRubricV2(source);
    expect(source.questions[0].rubric.schemaVersion).toBe('assignment-analytic-rubric.v1');
    expect(migrated.questions[0].rubric.schemaVersion).toBe('assignment-scoring-rubric.v2');
    const rubric = migrated.questions[0].rubric;
    if (rubric.schemaVersion !== 'assignment-scoring-rubric.v2') throw new Error('migration-version');
    expect(rubric.criteria[0].goalDimension).toBe('engineeringDecision');
    expect(rubric.criteria[0].levels.map((level) => level.maxPoints)).toEqual([8, 7, 3]);
  });
});
