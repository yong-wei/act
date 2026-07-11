import { describe, expect, it } from 'vitest';
import { belongsToAssignmentFilter } from '@/features/assignments/student-assignment-list';
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
});
