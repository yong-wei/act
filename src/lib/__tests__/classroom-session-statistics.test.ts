import { describe, expect, it } from 'vitest';

import {
  buildClassroomSessionStatistics,
  formatClassroomSessionDate,
  parseSessionGovernanceSummary,
} from '@/lib/classroom-session-statistics';

describe('classroom session statistics', () => {
  it('uses governance summary when a compliant class report exists', () => {
    const statistics = buildClassroomSessionStatistics({
      startTime: new Date('2026-05-12T00:22:20.391Z'),
      endTime: new Date('2026-05-12T02:05:09.624Z'),
      studentStateCount: 0,
      reportData: {
        sessionGovernanceSummary: {
          qualityStatus: {
            status: 'yellow',
            reasons: ['snapshot_partially_missing'],
            metrics: {
              participants: 77,
              durableSubmissionCoverage: 0.82,
            },
          },
          sessionParticipants: 77,
          loggedParticipants: '73',
          factParticipants: 50,
          submittedParticipants: 49,
          snapshotUpdatedParticipants: 50,
          syncErrorUsers: 11,
        },
      },
    });

    expect(statistics.studentCount).toBe(77);
    expect(statistics.durationMinutes).toBe(103);
    expect(statistics.hasGovernanceSummary).toBe(true);
    expect(statistics.governanceSummary).toMatchObject({
      loggedParticipants: 73,
      submittedParticipants: 49,
      syncErrorUsers: 11,
      qualityStatus: {
        status: 'yellow',
        reasons: ['snapshot_partially_missing'],
      },
    });
  });

  it('falls back to StudentState count when no compliant report exists', () => {
    const statistics = buildClassroomSessionStatistics({
      startTime: new Date('2026-05-12T00:22:20.391Z'),
      endTime: null,
      studentStateCount: 12,
      reportData: { sessionGovernanceSummary: { sessionParticipants: 'not-a-number' } },
    });

    expect(statistics.studentCount).toBe(12);
    expect(statistics.durationMinutes).toBeNull();
    expect(statistics.hasGovernanceSummary).toBe(false);
  });

  it('formats classroom start time in Asia Shanghai regardless of server timezone', () => {
    expect(formatClassroomSessionDate(new Date('2026-05-12T00:22:20.391Z'))).toContain('08:22:20');
  });

  it('returns null for reports without governance summary', () => {
    expect(parseSessionGovernanceSummary({ interactionLogs: 1824 })).toBeNull();
  });
});
