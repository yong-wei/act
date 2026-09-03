import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MANIFEST_COURSE_ROUTE_SEGMENTS } from '@/features/interactive/shared/manifest-course-app-loaders';
import { listInteractiveLessonIdentityRecords } from '@/lib/interactive-lesson-identity';

const repoRoot = process.cwd();
const coursesAppDir = join(repoRoot, 'src/app/interactive-learning/courses');
const adapterRoot = join(repoRoot, 'src/features/interactive/course-app-routes');
const dispatcherRoot = join(coursesAppDir, '[routeSegment]');

function read(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function listTsx(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return listTsx(absolute);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [absolute] : [];
  });
}

describe('retire private course session route bridges', () => {
  it('keeps one shared dispatcher and zero private App Router course families', () => {
    const courseDirs = readdirSync(coursesAppDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(existsSync(join(coursesAppDir, 'page.tsx'))).toBe(true);
    expect(courseDirs).toEqual(['[routeSegment]']);
    expect(existsSync(join(dispatcherRoot, 'page.tsx'))).toBe(true);
    expect(existsSync(join(dispatcherRoot, 'student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(dispatcherRoot, 'teacher/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(dispatcherRoot, 'teacher/[sessionId]/waiting/page.tsx'))).toBe(true);
    expect(existsSync(join(dispatcherRoot, 'demo/page.tsx'))).toBe(true);

    for (const relativePath of [
      'src/app/interactive-learning/courses/[routeSegment]/page.tsx',
      'src/app/interactive-learning/courses/[routeSegment]/student/[sessionId]/page.tsx',
      'src/app/interactive-learning/courses/[routeSegment]/teacher/[sessionId]/page.tsx',
      'src/app/interactive-learning/courses/[routeSegment]/teacher/[sessionId]/waiting/page.tsx',
      'src/app/interactive-learning/courses/[routeSegment]/demo/page.tsx',
    ]) {
      const source = read(relativePath);
      expect(source).toContain('notFound()');
      expect(source).not.toContain('redirect(');
    }
    expect(read('src/app/interactive-learning/courses/[routeSegment]/page.tsx'))
      .toContain("from '@/features/interactive/shared/manifest-course-app-loaders'");
    expect(read('src/app/interactive-learning/courses/[routeSegment]/demo/page.tsx'))
      .toContain("from '@/features/interactive/shared/manifest-course-app-loaders'");
    expect(read('src/app/interactive-learning/courses/[routeSegment]/page.tsx')).toContain('dynamicParams = false');
    expect(read('src/app/interactive-learning/courses/[routeSegment]/demo/page.tsx')).toContain('dynamicParams = false');
  });

  it('registers leftover family adapters without leftover private trees', () => {
    expect(MANIFEST_COURSE_ROUTE_SEGMENTS).toHaveLength(32);
    for (const segment of MANIFEST_COURSE_ROUTE_SEGMENTS) {
      expect(existsSync(join(adapterRoot, segment)), segment).toBe(false);
      expect(existsSync(join(coursesAppDir, segment))).toBe(false);
    }

    const identitySegments = [...new Set(
      listInteractiveLessonIdentityRecords().flatMap((record) => [...record.routeSegments]),
    )].sort();
    expect(identitySegments).toEqual([...MANIFEST_COURSE_ROUTE_SEGMENTS].sort());
  });

  it('does not keep a private /api/session producer or uppercase renderer consumer', () => {
    const scanned = [
      ...listTsx(adapterRoot),
      ...listTsx(dispatcherRoot),
      join(repoRoot, 'src/features/lesson-engine/index.ts'),
    ];

    for (const file of scanned) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('/api/session');
      expect(source, file).not.toContain("from './ResourceRenderer'");
      expect(source, file).not.toContain("from '@/features/lesson-engine/ResourceRenderer'");
    }

    expect(existsSync(join(repoRoot, 'src/features/lesson-engine/ResourceRenderer.tsx'))).toBe(false);
    expect(existsSync(join(repoRoot, 'src/features/lesson-engine/LessonPlayer.tsx'))).toBe(false);
    expect(existsSync(join(repoRoot, 'src/features/lesson-engine/resource-renderer.tsx'))).toBe(true);

    const barrel = read('src/features/lesson-engine/index.ts');
    expect(barrel).not.toContain('LessonPlayer');
    expect(barrel).not.toContain('ResourceRenderer');
    expect(barrel).not.toContain('./ResourceRenderer');
  });
});
