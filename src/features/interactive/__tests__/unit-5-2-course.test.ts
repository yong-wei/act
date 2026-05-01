import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeSegment = 'unit-5-2-nonlinear-analysis-entry';
const routeBase = join(repoRoot, 'src/app/interactive-learning/courses', routeSegment);
const featureBase = join(repoRoot, 'src/features/interactive', routeSegment);
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/5-2/interactive-manifest.json');

function readManifest() {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error('5-2 interactive manifest is invalid');
  return manifest;
}

function pageTypeFromManifest(stepId: string, interactionKind: string) {
  if (interactionKind === 'none') return stepId === 'step-18' ? 'summary' : 'display';
  return interactionKind;
}

describe('unit 5-2 interactive course', () => {
  it('defines the 18-step lesson flow from the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-2-course');

    expect(courseModule.UNIT_5_2_LESSON_STEPS).toHaveLength(18);
    expect(courseModule.UNIT_5_2_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_5_2_LESSON_STEPS.map((step: { title: string }) => step.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(courseModule.UNIT_5_2_LESSON_STEPS.map((step: { id: string; pageType: string }) => step.pageType)).toEqual(
      manifest.steps.map((step) => pageTypeFromManifest(step.id, step.interactionSpec.interactionKind)),
    );
  });

  it('keeps page contracts aligned with the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-2-course');

    for (const manifestStep of manifest.steps) {
      const localStep = courseModule.UNIT_5_2_LESSON_STEPS.find(
        (step: { id: string }) => step.id === manifestStep.id,
      ) as { title: string; pageType: string } | undefined;
      const localContract = courseModule.getUNIT_5_2PageContractFromManifest(manifest, manifestStep.id);

      expect(localStep?.title).toBe(manifestStep.title);
      expect(localStep?.pageType).toBe(pageTypeFromManifest(manifestStep.id, manifestStep.interactionSpec.interactionKind));
      expect(localContract?.layout).toEqual(manifestStep.layout);
      expect(localContract?.interactionKind).toBe(manifestStep.interactionSpec.interactionKind);
      expect(localContract?.teacherControls).toEqual(manifestStep.teacherControls);
      expect(localContract?.teacherInsightWidgets).toEqual(manifestStep.teacherInsightSpec.widgets);
      expect(localContract?.previewDemoPath).toBe(manifestStep.previewContract.demoPath);
      expect(localContract?.aiPageGoal).toBe(manifestStep.aiContextSpec.pageGoal);
    }
  });

  it('exposes route files and keeps step-panels as a thin manifest runtime adapter', () => {
    expect(existsSync(join(routeBase, 'page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'teacher/[sessionId]/page.tsx'))).toBe(true);

    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-5-2-course.ts'), 'utf8');

    expect(courseSource).not.toContain('course-content/runtime/lessons/5-2/interactive-manifest.json');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('Unit52NonlinearAnalysisPanel');
    expect(stepPanelsSource).toContain('useNonlinearAnalysisEngine');
    expect(stepPanelsSource).toContain('5-2 runtime manifest is required for page rendering.');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/5-2/');
  });

  it('keeps post-test and summary separated and exposes summary role statistics', async () => {
    const courseModule = await import('@/lib/unit-5-2-course');
    const featureSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(courseModule.UNIT_5_2_LESSON_STEPS[16]).toMatchObject({
      id: 'step-17',
      pageType: 'quiz_group',
    });
    expect(courseModule.UNIT_5_2_LESSON_STEPS[17]).toMatchObject({
      id: 'step-18',
      pageType: 'summary',
    });
    expect(featureSource).toContain('Unit52StudentSummaryStats');
    expect(featureSource).toContain('Unit52TeacherSummaryStats');
    expect(featureSource).toContain('参数探索覆盖');
    expect(featureSource).toContain('客观题正确率');
    expect(featureSource).toContain('常见误判标签');
    expect(featureSource).toContain('data-role-hidden-module={module.id}');
  });

  it('implements reviewed nonlinear interaction semantics for steps 7 to 11', () => {
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(stepPanelsSource).toContain('interactive_perturbation_curve_panel');
    expect(stepPanelsSource).toContain('onPointerDown');
    expect(stepPanelsSource).toContain('onPointerMove');
    expect(stepPanelsSource).toContain('onPointerUp');
    expect(stepPanelsSource).toContain('重置');
    expect(stepPanelsSource).toContain('unstable_limit_cycle');
    expect(stepPanelsSource).toContain('stable_limit_cycle');

    expect(stepPanelsSource).toContain('rust_memoryless_nonlinearity_tabs');
    expect(stepPanelsSource).toContain('deadzone_saturation');
    expect(stepPanelsSource).toContain('rust_relay_hysteresis_backlash_tabs');
    expect(stepPanelsSource).toContain('deadzone_relay');
    expect(stepPanelsSource).toContain('hysteresis_relay');
    expect(stepPanelsSource).toContain('backlash');

    expect(stepPanelsSource).toContain('relayOutput');
    expect(stepPanelsSource).toContain('filteredOutput');
    expect(stepPanelsSource).toContain('describingFunctionApproximation');
    expect(stepPanelsSource).toContain('spectrum');
  });
});
