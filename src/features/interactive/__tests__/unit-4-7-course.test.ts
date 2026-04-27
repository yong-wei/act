import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeSegment = 'unit-4-7-destroyer-hifi-design-closure';
const routeBase = join(repoRoot, 'src/app/interactive-learning/courses', routeSegment);
const featureBase = join(repoRoot, 'src/features/interactive', routeSegment);
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/4-7/interactive-manifest.json');

function readManifest() {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error('4-7 interactive manifest is invalid');
  return manifest;
}

function pageTypeFromManifest(stepId: string, interactionKind: string) {
  if (interactionKind === 'none') return stepId === 'step-12' ? 'summary' : 'display';
  return interactionKind;
}

describe('unit 4-7 interactive course', () => {
  it('defines the 12-step lesson flow from the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-4-7-course');

    expect(courseModule.UNIT_4_7_RUNTIME_MANIFEST.stepOrder).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_4_7_LESSON_STEPS).toHaveLength(12);
    expect(courseModule.UNIT_4_7_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_4_7_LESSON_STEPS.map((step: { title: string }) => step.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(courseModule.UNIT_4_7_LESSON_STEPS.map((step: { id: string; pageType: string }) => step.pageType)).toEqual(
      manifest.steps.map((step) => pageTypeFromManifest(step.id, step.interactionSpec.interactionKind)),
    );
  });

  it('keeps page contracts aligned with the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-4-7-course');

    for (const manifestStep of manifest.steps) {
      const localStep = courseModule.UNIT_4_7_LESSON_STEPS.find(
        (step: { id: string }) => step.id === manifestStep.id,
      ) as { title: string; pageType: string } | undefined;
      const localContract = courseModule.UNIT_4_7_PAGE_CONTRACTS[manifestStep.id];

      expect(localStep?.title).toBe(manifestStep.title);
      expect(localStep?.pageType).toBe(pageTypeFromManifest(manifestStep.id, manifestStep.interactionSpec.interactionKind));
      expect(localContract?.layout).toEqual(manifestStep.layout);
      expect(localContract?.interactionKind).toBe(manifestStep.interactionSpec.interactionKind);
      expect(localContract?.teacherControls).toEqual(manifestStep.teacherControls);
      expect(localContract?.teacherInsightWidgets).toEqual(manifestStep.teacherInsightSpec.widgets);
      expect(localContract?.telemetrySummaryFields).toEqual(manifestStep.telemetrySpec.summaryFields);
      expect(localContract?.misconceptionTags ?? []).toEqual(manifestStep.telemetrySpec.misconceptionTags);
      expect(localContract?.previewDemoPath).toBe(manifestStep.previewContract.demoPath);
      expect(localContract?.aiPageGoal).toBe(manifestStep.aiContextSpec.pageGoal);
    }
  });

  it('exposes route files and keeps step-panels as a shared manifest runtime adapter', () => {
    expect(existsSync(join(routeBase, 'page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'teacher/[sessionId]/page.tsx'))).toBe(true);

    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-4-7-course.ts'), 'utf8');

    expect(courseSource).toContain('course-content/runtime/lessons/4-7/interactive-manifest.json');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/4-7/');
    expect(studentPageSource).toContain('updatePageContext({');
    expect(studentPageSource).not.toContain('AI 助手');
  });

  it('keeps post-test and summary separated', async () => {
    const courseModule = await import('@/lib/unit-4-7-course');

    expect(courseModule.UNIT_4_7_LESSON_STEPS[10]).toMatchObject({
      id: 'step-11',
      pageType: 'quiz_group',
    });
    expect(courseModule.UNIT_4_7_LESSON_STEPS[11]).toMatchObject({
      id: 'step-12',
      pageType: 'summary',
    });
  });
});
