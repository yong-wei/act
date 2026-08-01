import { describe, expect, it } from 'vitest';
import { belongsToAssignmentFilter, studentAssignmentHref } from '@/features/assignments/student-assignment-list';
import { formatAssignmentDeadline } from '@/features/assignments/student-assignment-types';

describe('student assignment task center view model', () => {
  it('keeps open, submitted pipeline, and reviewed filters semantically distinct', () => {
    expect(belongsToAssignmentFilter('NOT_STARTED', 'open')).toBe(true);
    expect(belongsToAssignmentFilter('RESUBMISSION_REQUIRED', 'open')).toBe(true);
    expect(belongsToAssignmentFilter('AWAITING_REVIEW', 'submitted')).toBe(true);
    expect(belongsToAssignmentFilter('IN_REVIEW', 'submitted')).toBe(true);
    expect(belongsToAssignmentFilter('REVIEWED', 'reviewed')).toBe(true);
    expect(belongsToAssignmentFilter('REVIEWED', 'submitted')).toBe(false);
  });

  it('does not invent a deadline when the publication has none or stale data', () => {
    expect(formatAssignmentDeadline(null)).toBe('无截止时间');
    expect(formatAssignmentDeadline('not-a-date')).toBe('截止时间待确认');
  });

  it('routes historical entries to the exact owned revision', () => {
    expect(studentAssignmentHref({ id: 'assignment/1', revisionId: 'revision/1', historicalOnly: true }))
      .toBe('/missions/assignments/assignment%2F1?revisionId=revision%2F1');
    expect(studentAssignmentHref({ id: 'assignment/1', revisionId: 'revision/2', historicalOnly: false }))
      .toBe('/missions/assignments/assignment%2F1');
  });
});
