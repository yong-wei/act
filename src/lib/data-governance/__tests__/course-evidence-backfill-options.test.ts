import { describe, expect, it } from 'vitest';

import { parseCourseEvidenceBackfillOptions } from '../../../../scripts/db/course-evidence-backfill-options';

describe('parseCourseEvidenceBackfillOptions', () => {
  it('defaults to dry-run and parses targeted apply options', () => {
    expect(parseCourseEvidenceBackfillOptions([
      'node',
      'backfill-course-evidence-and-reporting.ts',
      '--session-id=session-a,session-b',
      '--lesson-key=unit-5-1-linear-backbone-boundaries-v1',
      '--lesson-key=5-2',
      '--from=2026-05-20T00:00:00.000Z',
      '--to=2026-05-21T00:00:00.000Z',
      '--apply',
      '--operation-id=op-1',
      '--authorize=operator',
      '--frozen-cutoff=2026-05-21T00:00:00.000Z',
      '--regenerate-reports',
      '--refresh-cache',
      '--json',
      '--compact',
    ])).toEqual({
      apply: true,
      json: true,
      compact: true,
      regenerateReports: true,
      refreshCache: true,
      operationId: 'op-1',
      authorizedBy: 'operator',
      frozenCutoff: '2026-05-21T00:00:00.000Z',
      filters: {
        sessionIds: ['session-a', 'session-b'],
        lessonKeys: ['unit-5-1-linear-backbone-boundaries-v1', '5-2'],
        from: new Date('2026-05-20T00:00:00.000Z'),
        to: new Date('2026-05-21T00:00:00.000Z'),
      },
    });
  });

  it('uses frozen cutoff as the query upper bound', () => {
    expect(parseCourseEvidenceBackfillOptions([
      'node',
      'backfill-course-evidence-and-reporting.ts',
      '--to=2026-05-21T00:00:00.000Z',
      '--frozen-cutoff=2026-05-20T00:00:00.000Z',
    ]).filters.to).toEqual(new Date('2026-05-20T00:00:00.000Z'));
  });

  it('runs without mutations unless apply is explicit', () => {
    expect(parseCourseEvidenceBackfillOptions([
      'node',
      'backfill-course-evidence-and-reporting.ts',
      '--session-id=session-a',
    ])).toEqual({
      apply: false,
      json: false,
      compact: false,
      regenerateReports: false,
      refreshCache: false,
      operationId: undefined,
      authorizedBy: undefined,
      frozenCutoff: undefined,
      filters: {
        sessionIds: ['session-a'],
      },
    });
  });
});
