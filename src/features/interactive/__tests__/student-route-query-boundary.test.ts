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

vi.mock('@/features/interactive/unit-2-1-modeling-language/student-page', () => ({
  UNIT_2_1StudentPage: vi.fn(() => null),
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
    const routes = [
      'src/features/interactive/course-app-routes/unit-1-1-see-the-full-picture/student.tsx',
      'src/features/interactive/course-app-routes/unit-2-1-modeling-language/student.tsx',
    ];

    for (const routePath of routes) {
      const source = readSource(routePath);
      expect(source).toContain('searchParams?: Promise<StudentRouteSearchParams>');
      expect(source).toContain('resolveStudentRouteDemoStepId(searchParams)');
      expect(source).toContain('demoStepId={demoStepId}');
      expect(source).toContain('export const metadata');

      const redirectIndex = source.indexOf('redirectInactiveStudentSessionToLessonEntry');
      const serverAwaitIndex = source.indexOf('Promise.all([\n    getServerSession(authOptions),');
      expect(redirectIndex).toBeGreaterThanOrEqual(0);
      expect(serverAwaitIndex).toBeGreaterThan(redirectIndex);
    }
  });

  it('passes demoStepId through representative route auth and non-auth branches', async () => {
    const routes = [
      {
        modulePath: '@/features/interactive/course-app-routes/unit-1-1-see-the-full-picture/student',
        expectedLessonId: '1-1',
      },
      {
        modulePath: '@/features/interactive/course-app-routes/unit-2-1-modeling-language/student',
        expectedLessonId: '2-1',
      },
    ] as const;

    for (const route of routes) {
      const mocks = await loadRouteMocks();
      const routeModule = await import(route.modulePath);

      mocks.getServerSession.mockResolvedValueOnce(null);
      const anonymousElement = await routeModule.default({
        params: Promise.resolve({ sessionId: 'demo' }),
        searchParams: Promise.resolve({ step: 'step-07' }),
      });
      expect(anonymousElement.props).toMatchObject({ sessionId: 'demo', demoStepId: 'step-07' });
      expect(mocks.loadSessionBoundLessonRuntime).toHaveBeenLastCalledWith({
        sessionId: 'demo',
        expectedCanonicalId: route.expectedLessonId,
        role: 'student',
      });

      mocks.getServerSession.mockResolvedValueOnce({ user: { id: 'student-1', name: '学生' } });
      const authenticatedElement = await routeModule.default({
        params: Promise.resolve({ sessionId: 'session-1' }),
        searchParams: Promise.resolve({ step: ['step-08'] }),
      });
      expect(authenticatedElement.props).toMatchObject({ sessionId: 'session-1', demoStepId: 'step-08' });
      expect(mocks.redirectInactiveStudentSessionToLessonEntry).toHaveBeenLastCalledWith(
        'session-1',
        expect.stringMatching(/^\/interactive-learning\/courses\//),
      );
    }
  });

  it('does not load auth or runtime data when inactive session redirect stops the route', async () => {
    const mocks = await loadRouteMocks();
    mocks.redirectInactiveStudentSessionToLessonEntry.mockRejectedValueOnce(new Error('redirected'));

    const routeModule = await import('@/features/interactive/course-app-routes/unit-2-1-modeling-language/student');

    await expect(routeModule.default({
      params: Promise.resolve({ sessionId: 'closed-session' }),
      searchParams: Promise.resolve({ step: 'step-02' }),
    })).rejects.toThrow('redirected');

    expect(mocks.getServerSession).not.toHaveBeenCalled();
    expect(mocks.loadSessionBoundLessonRuntime).not.toHaveBeenCalled();
  });
});
