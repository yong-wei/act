import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeSegment = 'unit-5-3-mass-coordination-chain';
const routeBase = join(repoRoot, 'src/app/interactive-learning/courses', routeSegment);
const featureBase = join(repoRoot, 'src/features/interactive', routeSegment);
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/5-3/interactive-manifest.json');

function readManifest() {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error('5-3 interactive manifest is invalid');
  return manifest;
}

function pageTypeFromManifest(stepId: string, interactionKind: string) {
  if (interactionKind === 'none') return stepId === 'step-15' ? 'summary' : 'display';
  return interactionKind;
}

describe('unit 5-3 interactive course', () => {
  it('defines the 15-step lesson flow from the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-3-course');

    expect(courseModule.UNIT_5_3_LESSON_STEPS).toHaveLength(15);
    expect(courseModule.UNIT_5_3_ROUTE_SEGMENT).toBe(routeSegment);
    expect(courseModule.UNIT_5_3_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_5_3_LESSON_STEPS.map((step: { title: string }) => step.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(courseModule.UNIT_5_3_LESSON_STEPS.map((step: { id: string; pageType: string }) => step.pageType)).toEqual(
      manifest.steps.map((step) => pageTypeFromManifest(step.id, step.interactionSpec.interactionKind)),
    );
  });

  it('keeps page contracts aligned with the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-3-course');

    for (const manifestStep of manifest.steps) {
      const localContract = courseModule.getUNIT_5_3PageContractFromManifest(manifest, manifestStep.id);

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
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-5-3-course.ts'), 'utf8');

    expect(courseSource).not.toContain('course-content/runtime/lessons/5-3/interactive-manifest.json');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('rust_turning_radius_panel');
    expect(stepPanelsSource).toContain('useNonlinearAnalysisEngine');
    expect(stepPanelsSource).toContain('5-3 runtime manifest is required for page rendering.');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/5-3/');
    expect(teacherPageSource).toContain('currentItemId: nextStep.id');
    expect(teacherPageSource).toContain('currentStage: UNIT_5_3_STAGE_MAP[nextStep.stage]');
  });

  it('implements step-11 as a Rust turning-radius panel without static fallback acceptance', async () => {
    const manifest = readManifest();
    const step11 = manifest.steps.find((step) => step.id === 'step-11');
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(step11?.modules.some((module) => module.kind === 'interactive-figure-panel')).toBe(true);
    expect(step11?.modules.find((module) => module.id === 'turning-rust-panel')?.payload.panel_id).toBe('rust_turning_radius_panel');
    expect(stepPanelsSource).toContain("analysisKind: 'turning_radius'");
    expect(stepPanelsSource).toContain('R_m');
    expect(stepPanelsSource).toContain('35');
    expect(stepPanelsSource).toContain('160');
    expect(stepPanelsSource).toContain('fallbackMessage');
    expect(stepPanelsSource).not.toContain('5-3-turning-radius-saturation-comparison.png');
  });

  it('keeps post-test and summary separated and exposes summary role statistics', async () => {
    const courseModule = await import('@/lib/unit-5-3-course');
    const featureSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(courseModule.UNIT_5_3_LESSON_STEPS[13]).toMatchObject({
      id: 'step-14',
      pageType: 'quiz_group',
    });
    expect(courseModule.UNIT_5_3_LESSON_STEPS[14]).toMatchObject({
      id: 'step-15',
      pageType: 'summary',
    });
    expect(featureSource).toContain('Unit53StudentSummaryStats');
    expect(featureSource).toContain('Unit53TeacherSummaryStats');
    expect(featureSource).toContain('个人课堂表现');
    expect(featureSource).toContain('班级整体表现统计');
    expect(featureSource).toContain('后测完成');
  });
});
