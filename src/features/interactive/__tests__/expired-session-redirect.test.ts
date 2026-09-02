import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  prisma: {
    classSession: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

function listStudentSessionRoutes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listStudentSessionRoutes(fullPath);
    }
    return entry.name === 'student.tsx' ? [fullPath] : [];
  });
}

describe('expired interactive student session redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects finished student sessions to the lesson entry page', async () => {
    mocks.prisma.classSession.findUnique.mockResolvedValue({ status: 'FINISHED' });

    await redirectInactiveStudentSessionToLessonEntry('session-1', '/interactive-learning/courses/unit-4-2');

    expect(mocks.redirect).toHaveBeenCalledWith('/interactive-learning/courses/unit-4-2');
  });

  it('redirects unknown session ids instead of rendering a stale classroom shell', async () => {
    mocks.prisma.classSession.findUnique.mockResolvedValue(null);

    await redirectInactiveStudentSessionToLessonEntry('session-1.', '/interactive-learning/courses/unit-4-2');

    expect(mocks.redirect).toHaveBeenCalledWith('/interactive-learning/courses/unit-4-2');
  });

  it('keeps active sessions and demo sessions on the classroom route', async () => {
    mocks.prisma.classSession.findUnique.mockResolvedValue({ status: 'ACTIVE' });

    await redirectInactiveStudentSessionToLessonEntry('session-1', '/interactive-learning/courses/unit-4-2');
    await redirectInactiveStudentSessionToLessonEntry('demo', '/interactive-learning/courses/unit-4-2');

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.prisma.classSession.findUnique).toHaveBeenCalledTimes(1);
  });

  it('guards every interactive student session route before rendering the page component', () => {
    const repoRoot = process.cwd();
    const routesRoot = join(repoRoot, 'src/features/interactive/course-app-routes');
    const routeFiles = listStudentSessionRoutes(routesRoot);

    expect(routeFiles.length).toBeGreaterThan(0);

    for (const routeFile of routeFiles) {
      const source = readFileSync(routeFile, 'utf8');
      expect(source).toContain("import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';");
      expect(source).toContain(
        "await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/",
      );
    }

    const sharedStudent = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/batch-a-classroom-pages.tsx'),
      'utf8',
    );
    expect(sharedStudent).toContain("import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';");
    expect(sharedStudent).toContain('await redirectInactiveStudentSessionToLessonEntry(');
  });
});
