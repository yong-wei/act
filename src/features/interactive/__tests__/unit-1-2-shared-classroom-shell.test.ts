import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LEGACY_LESSON_RUNTIME_ROUTE_SLUGS } from '@/lib/platform-appshell-contract';
import { resolveSessionRouteSegment } from '@/lib/classroom-session-route';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

const repoRoot = process.cwd();
const featureDir = join(repoRoot, 'src/features/interactive/unit-1-2-modeling-from-object-to-system');
const privateAppDir = join(repoRoot, 'src/app/interactive-learning/courses/unit-1-2-modeling-from-object-to-system');
const adapterDir = join(repoRoot, 'src/features/interactive/course-app-routes/unit-1-2-modeling-from-object-to-system');
const dispatcherDir = join(repoRoot, 'src/app/interactive-learning/courses/[routeSegment]');
const runtimeManifestPath = join(repoRoot, 'course-content/runtime/lessons/1-2/interactive-manifest.json');

function read(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('unit-1-2 shared classroom shell characterization', () => {
  it('freezes the runtime identity, manifest hash, and bundle-bound route', () => {
    const raw = readFileSync(runtimeManifestPath);
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(raw.toString('utf8')));
    expect(manifest?.lessonId).toBe('1-2');
    expect(createHash('sha256').update(raw).digest('hex')).toHaveLength(64);

    expect(resolveSessionRouteSegment({
      bundleCanonicalLessonId: '1-2',
      bundleBound: true,
      planTitle: '完全无关的可变标题',
    })).toMatchObject({
      routeSegment: 'unit-1-2-modeling-from-object-to-system',
      source: 'bundle-binding',
    });
  });

  it('keeps classroom routes on shared shell and session application boundaries', () => {
    const sharedRoute = read('src/features/interactive/shared/batch-a-classroom-pages.tsx');
    const entryPage = read('src/features/interactive/unit-1-2-modeling-from-object-to-system/entry-page.tsx');
    const studentPage = read('src/features/interactive/unit-1-2-modeling-from-object-to-system/student-page.tsx');
    const teacherPage = read('src/features/interactive/unit-1-2-modeling-from-object-to-system/teacher-page.tsx');
    const stepPanels = read('src/features/interactive/unit-1-2-modeling-from-object-to-system/step-panels.tsx');

    expect(sharedRoute).toContain('loadLessonRuntimeEntry(lesson.canonicalId)');
    expect(sharedRoute).toContain("expectedCanonicalId: lesson.canonicalId");
    expect(sharedRoute).toContain('loadSessionBoundLessonRuntime');
    expect(sharedRoute).toContain('TeacherClassroomWaitingRoute');
    expect(sharedRoute).toContain("canonicalId: '1-2'");
    expect(entryPage).toContain('CourseEntryShell');
    expect(studentPage).toContain('LessonRuntimeShell');
    expect(teacherPage).toContain('LessonRuntimeShell');
    expect(studentPage).toMatch(/onIndexChange=\{\(index\) => setActiveIndex\(index\)\}/);
    expect(studentPage).not.toMatch(/onIndexChange=\{\(index\) => \{[\s\S]*trackStepLeave/);
    expect(studentPage).toContain('useManifestSubmissionController');
    expect(stepPanels).toContain('createManifestContentModuleRegistry');
    expect(stepPanels).toContain('createManifestStudentActivityRegistry');
    expect(stepPanels).toContain('createManifestTeacherActivityRegistry');

    for (const source of [sharedRoute, entryPage, studentPage, teacherPage, stepPanels]) {
      expect(source).not.toContain('course-content/authoring');
      expect(source).not.toContain('/api/session');
      expect(source).not.toContain('LessonPlan.title');
      expect(source).not.toContain('premium-lesson-topbar');
    }

    expect(existsSync(join(featureDir, 'course-header.tsx'))).toBe(false);
    expect(existsSync(join(privateAppDir, 'page.tsx'))).toBe(false);
    expect(existsSync(join(adapterDir, 'entry.tsx'))).toBe(false);
    expect(existsSync(join(dispatcherDir, 'page.tsx'))).toBe(true);
    expect(read('src/app/interactive-learning/courses/[routeSegment]/page.tsx')).toContain('notFound()');
    expect(LEGACY_LESSON_RUNTIME_ROUTE_SLUGS).not.toContain('unit-1-2-modeling-from-object-to-system');
  });
});
