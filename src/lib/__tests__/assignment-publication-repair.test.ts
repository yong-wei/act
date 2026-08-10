import { describe, expect, it } from 'vitest';

import { planAssignmentPublicationDuplicateRepair } from '../assignments/assignment-publication-repair';
import { selectCurrentPublishedRevisions } from '../assignments/submission-service';

describe('assignment publication duplicate repair', () => {
  it('deletes only unreferenced duplicates and archives dependent history', () => {
    const plan = planAssignmentPublicationDuplicateRepair([
      revision('revision-current', 3, '2026-07-03T00:00:00Z'),
      revision('revision-dependent', 2, '2026-07-02T00:00:00Z', { submissions: 1 }),
      revision('revision-empty', 1, '2026-07-01T00:00:00Z'),
    ]);

    expect(plan.actions).toEqual([
      expect.objectContaining({
        revisionId: 'revision-dependent',
        retainedRevisionId: 'revision-current',
        action: 'archive-dependent',
      }),
      expect.objectContaining({
        revisionId: 'revision-empty',
        retainedRevisionId: 'revision-current',
        action: 'delete-unreferenced',
      }),
    ]);
    expect(plan.ambiguous).toEqual([]);
  });

  it('leaves missing-digest histories unchanged and reports them', () => {
    const plan = planAssignmentPublicationDuplicateRepair([
      revision('revision-known', 2, '2026-07-02T00:00:00Z'),
      { ...revision('revision-unknown', 1, '2026-07-01T00:00:00Z'), contentHash: null },
    ]);

    expect(plan.actions).toEqual([]);
    expect(plan.ambiguous).toEqual([{
      assignmentId: 'assignment-1',
      revisionIds: ['revision-known', 'revision-unknown'],
      reason: 'missing-content-digest',
    }]);
  });

  it('does not merge equal content published to different audience schedules', () => {
    const plan = planAssignmentPublicationDuplicateRepair([
      revision('revision-current', 2, '2026-07-02T00:00:00Z'),
      {
        ...revision('revision-other-audience', 1, '2026-07-01T00:00:00Z'),
        audienceSignature: `sha256:${'c'.repeat(64)}`,
      },
    ]);

    expect(plan.actions).toEqual([]);
    expect(plan.ambiguous).toEqual([]);
  });

  it('produces the same archive plan after audiences are already archived', () => {
    const input = [
      revision('revision-current', 2, '2026-07-02T00:00:00Z'),
      { ...revision('revision-history', 1, '2026-07-01T00:00:00Z', { teacherReviews: 1 }), activeAudienceIds: [] },
    ];

    expect(planAssignmentPublicationDuplicateRepair(input)).toEqual(
      planAssignmentPublicationDuplicateRepair(input),
    );
  });
});

describe('student assignment current-publication projection', () => {
  it('keeps only the first ordered published revision per stable assignment', () => {
    expect(selectCurrentPublishedRevisions([
      { id: 'assignment-a-new', assignmentId: 'assignment-a' },
      { id: 'assignment-a-old', assignmentId: 'assignment-a' },
      { id: 'assignment-b', assignmentId: 'assignment-b' },
    ])).toEqual([
      { id: 'assignment-a-new', assignmentId: 'assignment-a' },
      { id: 'assignment-b', assignmentId: 'assignment-b' },
    ]);
  });
});

function revision(
  id: string,
  revisionNumber: number,
  publishedAt: string,
  dependencyCounts: Record<string, number> = {},
) {
  return {
    id,
    assignmentId: 'assignment-1',
    revisionNumber,
    publishedAt: new Date(publishedAt),
    contentHash: `sha256:${'a'.repeat(64)}`,
    audienceSignature: `sha256:${'b'.repeat(64)}`,
    activeAudienceIds: [`audience-${id}`],
    dependencyCounts,
  };
}
