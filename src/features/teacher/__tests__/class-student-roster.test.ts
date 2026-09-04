import { describe, expect, it } from 'vitest';

import {
  EMPTY_ROSTER_FILTERS,
  compareRosterStudents,
  filterClassStudents,
  isRosterPortraitUnavailable,
  rosterFiltersActive,
  type RosterInsight,
  type RosterStudentInput,
} from '@/features/teacher/class-student-roster';

function makeStudent(
  id: string,
  name: string,
  studentNumber: string | null,
): RosterStudentInput {
  return {
    id: `enrollment-${id}`,
    studentNumber,
    techScore: 80,
    ethicsScore: 80,
    user: { id, name, email: `${id}@example.test` },
  } as RosterStudentInput & { techScore: number; ethicsScore: number };
}

function makeInsight(
  id: string,
  overrides: Partial<RosterInsight> = {},
): RosterInsight {
  return {
    id,
    name: id,
    email: null,
    studentNumber: null,
    overallScore: 72,
    overallLevel: 'L2',
    overallScoreSource: null,
    riskLevel: 'none',
    riskLabel: '无风险',
    trendDirection: 'stable',
    strengths: [],
    weaknesses: [],
    riskBadges: [],
    factCount: 10,
    lastSnapshotAt: null,
    portraitV2: null,
    availabilityReason: 'available',
    evidenceStatus: {
      state: 'ready',
      refreshedAt: '2026-08-01T00:00:00.000Z',
      lastEvidenceAt: '2026-08-01T00:00:00.000Z',
      confidence: { level: 'high', score: 0.9, evidenceCount: 10, sourceCompleteness: 0.9 },
      statusMarkers: [],
    },
    ...overrides,
  } as RosterInsight;
}

const alice = makeStudent('alice', '张三', '2026001');
const bob = makeStudent('bob', '李四', '2026010');
const cara = makeStudent('cara', '王五', null);
const dave = makeStudent('dave', '赵六', null);

function insightMapOf(...insights: RosterInsight[]) {
  return new Map(insights.map((insight) => [insight.id, insight]));
}

describe('filterClassStudents', () => {
  const students = [dave, bob, cara, alice];
  const insights = insightMapOf(
    makeInsight('alice', { riskLevel: 'high', trendDirection: 'up' }),
    makeInsight('bob', {
      riskLevel: 'none',
      trendDirection: 'down',
      evidenceStatus: {
        state: 'missing',
        refreshedAt: null,
        lastEvidenceAt: null,
        confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
        statusMarkers: ['missing-source'],
      },
    }),
    makeInsight('cara', {
      riskLevel: 'medium',
      trendDirection: 'not-comparable',
      availabilityReason: 'migration-in-progress',
    }),
  );

  it('matches name search case-insensitively', () => {
    const result = filterClassStudents(students, insights, { ...EMPTY_ROSTER_FILTERS, search: '张三' });
    expect(result.map((student) => student.user.id)).toEqual(['alice']);
  });

  it('matches student number search', () => {
    const result = filterClassStudents(students, insights, { ...EMPTY_ROSTER_FILTERS, search: '202601' });
    expect(result.map((student) => student.user.id)).toEqual(['bob']);
  });

  it('returns empty list when nothing matches', () => {
    const result = filterClassStudents(students, insights, { ...EMPTY_ROSTER_FILTERS, search: '不存在' });
    expect(result).toEqual([]);
  });

  it('filters by risk level and excludes students without insight', () => {
    const result = filterClassStudents(students, insights, { ...EMPTY_ROSTER_FILTERS, riskLevel: 'high' });
    expect(result.map((student) => student.user.id)).toEqual(['alice']);
  });

  it('filters by trend direction', () => {
    const result = filterClassStudents(students, insights, { ...EMPTY_ROSTER_FILTERS, trendDirection: 'down' });
    expect(result.map((student) => student.user.id)).toEqual(['bob']);
  });

  it('filters students with missing evidence', () => {
    const result = filterClassStudents(students, insights, { ...EMPTY_ROSTER_FILTERS, evidenceState: 'missing' });
    expect(result.map((student) => student.user.id)).toEqual(['bob']);
  });

  it('filters students with unavailable portraits including missing insights', () => {
    const result = filterClassStudents(students, insights, { ...EMPTY_ROSTER_FILTERS, portraitAvailability: 'unavailable' });
    expect(result.map((student) => student.user.id)).toEqual(['cara', 'dave']);
  });

  it('combines search and multiple filters as an intersection', () => {
    const result = filterClassStudents(students, insights, {
      ...EMPTY_ROSTER_FILTERS,
      riskLevel: 'none',
      evidenceState: 'missing',
    });
    expect(result.map((student) => student.user.id)).toEqual(['bob']);
  });
});

describe('stable roster ordering', () => {
  it('orders numbered students numerically and unnumbered students after by name', () => {
    const ordered = filterClassStudents(
      [bob, alice, cara, dave],
      new Map<string, RosterInsight>(),
      EMPTY_ROSTER_FILTERS,
    );
    expect(ordered.map((student) => student.user.id)).toEqual(['alice', 'bob', 'cara', 'dave']);
  });

  it('keeps input order for equal sort keys', () => {
    const first = makeStudent('first', '同名', null);
    const second = makeStudent('second', '同名', null);
    const ordered = filterClassStudents(
      [first, second],
      new Map<string, RosterInsight>(),
      EMPTY_ROSTER_FILTERS,
    );
    expect(ordered.map((student) => student.user.id)).toEqual(['first', 'second']);
  });
});

describe('rosterFiltersActive', () => {
  it('is false for empty filters and whitespace search', () => {
    expect(rosterFiltersActive(EMPTY_ROSTER_FILTERS)).toBe(false);
    expect(rosterFiltersActive({ ...EMPTY_ROSTER_FILTERS, search: '   ' })).toBe(false);
  });

  it('is true when any filter is set', () => {
    expect(rosterFiltersActive({ ...EMPTY_ROSTER_FILTERS, riskLevel: 'high' })).toBe(true);
    expect(rosterFiltersActive({ ...EMPTY_ROSTER_FILTERS, search: '张' })).toBe(true);
  });
});

describe('isRosterPortraitUnavailable', () => {
  it('treats missing insight and non-available reasons as unavailable', () => {
    expect(isRosterPortraitUnavailable(undefined)).toBe(true);
    expect(isRosterPortraitUnavailable(makeInsight('x', { availabilityReason: 'processing-failed' }))).toBe(true);
    expect(isRosterPortraitUnavailable(makeInsight('x'))).toBe(false);
  });
});

describe('compareRosterStudents', () => {
  it('sorts student numbers numerically', () => {
    expect(compareRosterStudents(alice, bob)).toBeLessThan(0);
    expect(compareRosterStudents(bob, alice)).toBeGreaterThan(0);
  });
});
