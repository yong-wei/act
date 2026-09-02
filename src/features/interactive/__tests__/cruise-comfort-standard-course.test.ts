import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY,
  REQUIRED_RUNTIME_FIRST_GATE_LESSONS,
} from '@/features/interactive/course-submission-gate-inventory';
import {
  collectManifestResponseProducingSteps,
  evaluateManifestSubmissionPageGate,
  evaluateStandardCourseFinalizationGate,
} from '@/features/interactive/shared/manifest-runtime/submission-gate';
import { resolveCourseEvidenceSpec } from '@/lib/data-governance/course-evidence-specs';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

const repoRoot = process.cwd();
const cruiseLessonId = 'cruise-comfort-boppps';
const cruiseManifestPath = join(
  repoRoot,
  'course-content/runtime/lessons/cruise-comfort-boppps/interactive-manifest.json',
);

function readCruiseManifest() {
  const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(cruiseManifestPath, 'utf8')));
  if (!manifest) throw new Error('cruise comfort runtime manifest is invalid');
  return manifest;
}

describe('cruise comfort standard course migration', () => {
  it('provides a standard runtime manifest on the existing public route', () => {
    expect(existsSync(cruiseManifestPath)).toBe(true);

    const manifest = readCruiseManifest();
    expect(manifest.lessonId).toBe(cruiseLessonId);
    expect(manifest.courseRouteSegment).toBe(cruiseLessonId);
    expect(manifest.steps.length).toBeGreaterThanOrEqual(8);
    expect(collectManifestResponseProducingSteps(manifest, cruiseLessonId).length).toBeGreaterThanOrEqual(6);
  });

  it('registers cruise comfort in CourseEvidenceSpec and the submission gate inventory', () => {
    const manifest = readCruiseManifest();
    const evidenceSpec = resolveCourseEvidenceSpec({ manifest });

    expect(evidenceSpec).toMatchObject({
      status: 'supported',
      spec: {
        lessonId: cruiseLessonId,
        routeSegment: cruiseLessonId,
      },
    });
    expect(REQUIRED_RUNTIME_FIRST_GATE_LESSONS).toContain(cruiseLessonId);
    expect(COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY).toContainEqual(
      expect.objectContaining({
        lessonId: cruiseLessonId,
        routeSegment: cruiseLessonId,
        studentPagePath: 'src/features/interactive/cruise-comfort-standard-course/student-page.tsx',
      }),
    );
  });

  it('routes student submissions through the shared manifest evidence path', () => {
    const manifest = readCruiseManifest();
    const evidenceSpec = resolveCourseEvidenceSpec({ manifest });
    if (evidenceSpec.status !== 'supported') {
      throw new Error(`cruise evidence spec is ${evidenceSpec.reason}`);
    }
    const inventoryItem = COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY.find((item) => item.lessonId === cruiseLessonId);
    if (!inventoryItem) throw new Error('cruise comfort is missing from the submission gate inventory');

    const result = evaluateManifestSubmissionPageGate({
      lessonId: cruiseLessonId,
      routeSegment: cruiseLessonId,
      manifestGetterName: inventoryItem.manifestGetterName,
      studentPageSource: readFileSync(join(repoRoot, inventoryItem.studentPagePath), 'utf8'),
      responseSteps: collectManifestResponseProducingSteps(manifest, cruiseLessonId)
        .filter((step) => evidenceSpec.spec.responseProducingStepIds.includes(step.stepId)),
      minimumResponseSteps: inventoryItem.minimumResponseSteps,
    });

    expect(result).toMatchObject({
      lessonId: cruiseLessonId,
      passed: true,
      violations: [],
    });
  });

  it('routes teacher finalization through the shared adapter', () => {
    const courseSource = readFileSync(join(repoRoot, 'src/lib/cruise-course.ts'), 'utf8');

    const result = evaluateStandardCourseFinalizationGate({
      lessonId: cruiseLessonId,
      routeSegment: cruiseLessonId,
      courseSource,
    });

    expect(result).toMatchObject({
      lessonId: cruiseLessonId,
      passed: true,
      violations: [],
    });
  });

  it('keeps the route while removing the legacy cruise classroom implementation path', () => {
    const sharedRoute = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/batch-a-classroom-pages.tsx'),
      'utf8',
    );
    expect(sharedRoute).not.toContain('cruise-classroom');
    expect(existsSync(join(repoRoot, 'src/features/interactive/course-app-routes/cruise-comfort-boppps'))).toBe(false);
    expect(existsSync(join(repoRoot, 'src/features/interactive/cruise-classroom'))).toBe(false);
  });

  it('keeps role guards on cruise student and teacher session routes', () => {
    const sharedRoute = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/batch-a-classroom-pages.tsx'),
      'utf8',
    );

    expect(sharedRoute).toContain('getServerSession(authOptions)');
    expect(sharedRoute).toContain('isTeacherOrAdminRole');
    expect(sharedRoute).toContain('canonicalId: \'cruise-comfort-boppps\'');
    expect(sharedRoute).toContain('`/interactive-learning/courses/${input.routeSegment}/teacher/${input.sessionId}`');
  });
});
