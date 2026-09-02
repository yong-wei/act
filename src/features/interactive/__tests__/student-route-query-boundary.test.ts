import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveStudentRouteDemoStepId } from '../shared/student-route-query';

const repoRoot = process.cwd();

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/course-bundle', () => ({
  loadLessonRuntimeEntry: vi.fn(),
  loadSessionBoundLessonRuntime: vi.fn(),
}));

vi.mock('@/features/lesson-engine/course-bundle-drift-state', () => ({
  CourseBundleDriftState: vi.fn(() => null),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: { providers: [] },
}));

vi.mock('@/lib/interactive-session-access', () => ({
  redirectInactiveStudentSessionToLessonEntry: vi.fn(),
}));

vi.mock('@/features/interactive/unit-1-1-see-the-full-picture/student-page', () => ({
  UNIT_1_1StudentPage: vi.fn(() => null),
}));
vi.mock('@/features/interactive/unit-1-1-see-the-full-picture/entry-page', () => ({
  UNIT_1_1CourseEntryPage: vi.fn(() => null),
}));
vi.mock('@/features/interactive/unit-1-1-see-the-full-picture/teacher-page', () => ({
  UNIT_1_1TeacherPage: vi.fn(() => null),
}));

vi.mock('@/features/interactive/unit-2-1-modeling-language/student-page', () => ({
  UNIT_2_1StudentPage: vi.fn(() => null),
}));
vi.mock('@/features/interactive/unit-2-1-modeling-language/entry-page', () => ({
  UNIT_2_1CourseEntryPage: vi.fn(() => null),
}));
vi.mock('@/features/interactive/unit-2-1-modeling-language/teacher-page', () => ({
  UNIT_2_1TeacherPage: vi.fn(() => null),
}));

vi.mock('@/lib/layered-graph', () => ({
  buildCoursePackageLayeredScope: vi.fn(() => ({})),
  resolveCoursePageLayeredGraphContext: vi.fn(() => ({ payload: {}, resourceLaunchTargets: {}, resourceRegistryIds: {} })),
}));

function readSource(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

async function loadRouteMocks() {
  const [
    { getServerSession },
    bundleMocks,
    { redirectInactiveStudentSessionToLessonEntry },
  ] = await Promise.all([
    import('next-auth'),
    import('@/lib/course-bundle'),
    import('@/lib/interactive-session-access'),
  ]);
  const { loadLessonRuntimeEntry, loadSessionBoundLessonRuntime } = bundleMocks;

  return {
    getServerSession: vi.mocked(getServerSession),
    loadLessonRuntimeEntry: vi.mocked(loadLessonRuntimeEntry),
    loadSessionBoundLessonRuntime: vi.mocked(loadSessionBoundLessonRuntime),
    redirectInactiveStudentSessionToLessonEntry: vi.mocked(redirectInactiveStudentSessionToLessonEntry),
  };
}

describe('interactive student route query boundary', () => {
  beforeEach(async () => {
    const mocks = await loadRouteMocks();
    mocks.getServerSession.mockReset();
    mocks.loadLessonRuntimeEntry.mockReset();
    mocks.loadSessionBoundLessonRuntime.mockReset();
    mocks.redirectInactiveStudentSessionToLessonEntry.mockReset();
    mocks.redirectInactiveStudentSessionToLessonEntry.mockResolvedValue(undefined);
    mocks.loadSessionBoundLessonRuntime.mockResolvedValue({
      status: 'legacy',
      lessonRuntime: {} as never,
    });
  });

  it('resolves the first non-empty step query value at the server route boundary', () => {
    expect(resolveStudentRouteDemoStepId(undefined)).toBeUndefined();
    expect(resolveStudentRouteDemoStepId({})).toBeUndefined();
    expect(resolveStudentRouteDemoStepId({ step: '  ' })).toBeUndefined();
    expect(resolveStudentRouteDemoStepId({ step: 'lesson-step-2' })).toBe('lesson-step-2');
    expect(resolveStudentRouteDemoStepId({ step: ['lesson-step-3', 'lesson-step-4'] })).toBe('lesson-step-3');
  });

  it('keeps representative student clients free of direct search param reads', () => {
    const studentPages = [
      'src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx',
      'src/features/interactive/unit-2-1-modeling-language/student-page.tsx',
    ];

    for (const pagePath of studentPages) {
      const source = readSource(pagePath);
      expect(source).not.toContain('useSearchParams');
      expect(source).toContain('demoStepId?: string');
    }
  });

  it('keeps redirect ordering before auth/runtime awaits while passing demoStepId from the route', () => {
    const source = readSource('src/features/interactive/shared/batch-a-classroom-pages.tsx');
    expect(source).toContain('searchParams?: StudentRouteSearchParams');
    expect(source).toContain('resolveStudentRouteDemoStepId(input.searchParams)');
    expect(source).toContain('demoStepId={demoStepId}');
    const studentSource = source.slice(
      source.indexOf('export async function renderBatchAStudent'),
      source.indexOf('export async function renderBatchATeacher'),
    );
    const redirectIndex = studentSource.indexOf('redirectInactiveStudentSessionToLessonEntry');
    const runtimeIndex = studentSource.indexOf('loadSessionBoundLessonRuntime');
    expect(redirectIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeIndex).toBeGreaterThan(redirectIndex);
  });

  it('passes demoStepId through representative route auth and non-auth branches', async () => {
    const { renderBatchAStudent } = await import('../shared/batch-a-classroom-pages');
    const routes = [
      { routeSegment: 'unit-1-1-see-the-full-picture', expectedLessonId: '1-1' },
      { routeSegment: 'unit-2-1-modeling-language', expectedLessonId: '2-1' },
    ] as const;

    for (const route of routes) {
      const mocks = await loadRouteMocks();

      mocks.getServerSession.mockResolvedValueOnce(null);
      const anonymousElement = await renderBatchAStudent({
        routeSegment: route.routeSegment,
        sessionId: 'demo',
        searchParams: { step: 'step-07' },
      });
      expect(anonymousElement?.props).toMatchObject({ sessionId: 'demo', demoStepId: 'step-07' });
      expect(mocks.loadSessionBoundLessonRuntime).toHaveBeenLastCalledWith({
        sessionId: 'demo',
        expectedCanonicalId: route.expectedLessonId,
        role: 'student',
      });

      mocks.getServerSession.mockResolvedValueOnce({ user: { id: 'student-1', name: '学生' } });
      const authenticatedElement = await renderBatchAStudent({
        routeSegment: route.routeSegment,
        sessionId: 'session-1',
        searchParams: { step: ['step-08'] },
      });
      expect(authenticatedElement?.props).toMatchObject({ sessionId: 'session-1', demoStepId: 'step-08' });
      expect(mocks.redirectInactiveStudentSessionToLessonEntry).toHaveBeenLastCalledWith(
        'session-1',
        expect.stringMatching(/^\/interactive-learning\/courses\//),
      );
    }
  });

  it('does not load auth or runtime data when inactive session redirect stops the route', async () => {
    const mocks = await loadRouteMocks();
    mocks.redirectInactiveStudentSessionToLessonEntry.mockRejectedValueOnce(new Error('redirected'));
    const { renderBatchAStudent } = await import('../shared/batch-a-classroom-pages');

    await expect(renderBatchAStudent({
      routeSegment: 'unit-2-1-modeling-language',
      sessionId: 'closed-session',
      searchParams: { step: 'step-02' },
    })).rejects.toThrow('redirected');

    expect(mocks.loadSessionBoundLessonRuntime).not.toHaveBeenCalled();
  });
});
