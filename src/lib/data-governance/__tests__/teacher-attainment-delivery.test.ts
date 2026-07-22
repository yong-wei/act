import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  readLatestValidNativePortraitV2Snapshots: vi.fn(),
  prisma: {
    class: { findUnique: vi.fn() },
    studentProfile: { findMany: vi.fn() },
    classCompetencySnapshot: { findFirst: vi.fn() },
    classSession: { findMany: vi.fn() },
    learningFact: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

vi.mock('@/lib/data-governance/portrait-v2-model', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/data-governance/portrait-v2-model')>(),
  readLatestValidNativePortraitV2Snapshots: mocks.readLatestValidNativePortraitV2Snapshots,
}));

import { GET as getHeatmap } from '@/app/api/teacher/classes/[classId]/heatmap/route';
import {
  CUMULATIVE_CLASS_COMPETENCY_MATERIALIZATION_VERSION,
} from '@/lib/data-governance/class-scoped-learning-materialization';
import { parseTeacherAttainmentScope } from '@/lib/data-governance/teacher-attainment-scope';

const repoRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function request(query = '') {
  return new NextRequest(`http://localhost/api/teacher/classes/class-1/heatmap${query}`);
}

describe('teacher cumulative attainment delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T00:00:00.000Z'));
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({ teacherId: 'teacher-1' });
    mocks.prisma.studentProfile.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        studentNumber: 'S001',
        user: { id: 'student-1', name: '学生甲', image: null },
      },
    ]);
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue({
      snapshotAt: new Date('2026-07-21T00:00:00.000Z'),
    });
    mocks.prisma.classSession.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.readLatestValidNativePortraitV2Snapshots.mockResolvedValue(new Map([
      ['student-1', {
        derivation: { kind: 'native', limitations: [] },
        generatedAt: '2026-07-20T00:00:00.000Z',
        dimensions: [{
          id: 'controlModelingRepresentation',
          score: 82,
          evidenceSummary: { totalCount: 3 },
        }],
      }],
    ]));
  });

  it('defaults an omitted scope to cumulative native portrait delivery without synthetic change', async () => {
    const response = await getHeatmap(request(), {
      params: Promise.resolve({ classId: 'class-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      scope: 'cumulative',
      scopeLabel: '累计能力达成',
      nearStageChangeApplicable: false,
      coverage: { rosterStudents: 1, coveredStudents: 1 },
    });
    expect(payload.matrix).toEqual([
      expect.objectContaining({ studentId: 'student-1', score: 82, change: null }),
    ]);
    expect(payload.students[0].coverageState).toBe('covered');
    expect(mocks.prisma.classCompetencySnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        classId: 'class-1',
        materializationVersion: CUMULATIVE_CLASS_COMPETENCY_MATERIALIZATION_VERSION,
      },
      orderBy: { snapshotAt: 'desc' },
    });
    expect(mocks.prisma.learningFact.findMany).not.toHaveBeenCalled();
  });

  it('keeps the explicit recent scope on the existing 30/60-day fact window', async () => {
    const response = await getHeatmap(request('?scope=recent'), {
      params: Promise.resolve({ classId: 'class-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scope).toBe('recent');
    expect(payload.nearStageChangeApplicable).toBe(true);
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        startedAt: { gte: new Date('2026-05-23T00:00:00.000Z') },
      }),
    }));
    expect(mocks.readLatestValidNativePortraitV2Snapshots).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'zero',
      roster: [
        { userId: 'student-1', studentNumber: 'S001', user: { id: 'student-1', name: '学生甲', image: null } },
      ],
      portraits: new Map(),
      expected: { rosterStudents: 1, coveredStudents: 0 },
      states: ['no-evidence'],
    },
    {
      label: 'partial',
      roster: [
        { userId: 'student-1', studentNumber: 'S001', user: { id: 'student-1', name: '学生甲', image: null } },
        { userId: 'student-2', studentNumber: 'S002', user: { id: 'student-2', name: '学生乙', image: null } },
      ],
      portraits: new Map([['student-1', {
        derivation: { kind: 'native', limitations: [] },
        generatedAt: '2026-07-20T00:00:00.000Z',
        dimensions: [{ id: 'controlModelingRepresentation', score: 82, evidenceSummary: { totalCount: 3 } }],
      }]]),
      expected: { rosterStudents: 2, coveredStudents: 1 },
      states: ['covered', 'no-evidence'],
    },
  ])('reports $label cumulative coverage and per-student no-evidence state', async ({ roster, portraits, expected, states }) => {
    mocks.prisma.studentProfile.findMany.mockResolvedValue(roster);
    mocks.readLatestValidNativePortraitV2Snapshots.mockResolvedValue(portraits);

    const response = await getHeatmap(request(), { params: Promise.resolve({ classId: 'class-1' }) });
    const payload = await response.json();

    expect(payload.coverage).toEqual(expected);
    expect(payload.students.map((student: { coverageState: string }) => student.coverageState)).toEqual(states);
  });

  it('rejects unsupported scope values deterministically', async () => {
    expect(parseTeacherAttainmentScope('semester')).toBeNull();
    expect(parseTeacherAttainmentScope(null)).toBe('cumulative');
    expect(parseTeacherAttainmentScope('recent')).toBe('recent');

    const response = await getHeatmap(request('?scope=semester'), {
      params: Promise.resolve({ classId: 'class-1' }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '无效的学情范围' });
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
  });

  it('keeps the UI scope switch and historical portrait timestamp/no-evidence states visible', () => {
    const analytics = readSource('src/app/teacher/classes/[classId]/analytics-v2/page.tsx');
    const classPage = readSource('src/app/teacher/classes/[classId]/page.tsx');
    const growth = readSource('src/app/(main)/profile/growth/page.tsx');
    const growthRecordsRoute = readSource('src/app/api/student/growth-records/route.ts');
    const insightsRoute = readSource('src/app/api/teacher/classes/[classId]/insights/route.ts');

    expect(analytics).toContain("normalizeTeacherAttainmentScope(searchParams.get('scope'))");
    expect(analytics).toContain('useState<TeacherAttainmentScope>(() => queryScope)');
    expect(analytics).toContain('setScope(queryScope)');
    expect(analytics).toContain('insights?scope=${scope}');
    expect(analytics).toContain('heatmap?scope=${scope}');
    expect(analytics).toContain("不适用");
    expect(classPage).toContain('/insights?scope=cumulative');
    expect(classPage).toContain('口径：{insights.scopeLabel}');
    expect(classPage).toContain('data-recent-session-quality-not-applicable');
    expect(classPage).not.toContain('recentSessionQuality?.green');
    expect(insightsRoute).toContain("parseTeacherAttainmentScope(new URL(request.url).searchParams.get('scope'))");
    expect(insightsRoute).toContain('CUMULATIVE_CLASS_COMPETENCY_MATERIALIZATION_VERSION');
    expect(insightsRoute).toContain('readLatestValidNativePortraitV2Snapshots');
    expect(growth).toContain('画像生成时间：');
    expect(growth).toContain('data-portrait-no-evidence');
    expect(growth).toContain('这里不会显示零分、学习阶段或正向能力结论');
    expect(growth).not.toContain('portrait?.overallScore ?? 0');
    expect(growth).toContain("const hasPortrait = snapshot?.evidenceState === 'current'");
    expect(growth).toContain('{hasPortrait ? <div className="surface-card p-5" data-portrait-recommendation>');
    expect(growth).toContain('{hasPortrait ? <div className="mb-8" data-portrait-diagnosis>');
    expect(growth).toContain("record.type === 'learning_activity'");
    expect(growthRecordsRoute).toContain("type: 'learning_activity'");
    expect(growthRecordsRoute).toContain("metadata: { source: 'learning-fact' }");
    expect(analytics).toContain('data-cumulative-coverage-state');
    expect(analytics).toContain("coverageState === 'no-evidence' ? '无证据' : '-'");
    expect(analytics).toContain('切换近阶段学情查看近期风险、课堂质量与趋势');
  });
});
