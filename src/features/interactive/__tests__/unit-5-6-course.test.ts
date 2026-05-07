import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeSegment = 'unit-5-6-method-comparison-cold-chain';
const routeBase = join(repoRoot, 'src/app/interactive-learning/courses', routeSegment);
const featureBase = join(repoRoot, 'src/features/interactive', routeSegment);
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/5-6/interactive-manifest.json');

function readManifest() {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error('5-6 interactive manifest is invalid');
  return manifest;
}

function pageTypeFromManifest(stepId: string, interactionKind: string) {
  if (interactionKind === 'none') return stepId === 'step-18' ? 'summary' : 'display';
  return interactionKind;
}

describe('unit 5-6 interactive course', () => {
  it('defines the 18-step lesson flow from the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-6-course');

    expect(courseModule.UNIT_5_6_LESSON_STEPS).toHaveLength(18);
    expect(courseModule.UNIT_5_6_ROUTE_SEGMENT).toBe(routeSegment);
    expect(courseModule.UNIT_5_6_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_5_6_LESSON_STEPS.map((step: { title: string }) => step.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(courseModule.UNIT_5_6_LESSON_STEPS.map((step: { id: string; pageType: string }) => step.pageType)).toEqual(
      manifest.steps.map((step) => pageTypeFromManifest(step.id, step.interactionSpec.interactionKind)),
    );
  });

  it('keeps page contracts aligned with the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-6-course');

    for (const manifestStep of manifest.steps) {
      const localContract = courseModule.getUNIT_5_6PageContractFromManifest(manifest, manifestStep.id);

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
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-5-6-course.ts'), 'utf8');

    expect(courseSource).not.toContain('course-content/runtime/lessons/5-6/interactive-manifest.json');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('ColdChainRouteComparePanel');
    expect(stepPanelsSource).toContain('data-testid="unit-5-6-cold-chain-route-compare-panel"');
    expect(stepPanelsSource).toContain('/course-runtime/lessons/5-6/media/generated-data');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/5-6/');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(teacherPageSource).toContain('currentItemId: nextStep.id');
    expect(teacherPageSource).toContain('currentStage: UNIT_5_6_STAGE_MAP[nextStep.stage]');
  });

  it('keeps step-11 as a runtime-data SVG route comparison panel with required submit fields', async () => {
    const manifest = readManifest();
    const step11 = manifest.steps.find((step) => step.id === 'step-11');
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(step11?.interactionSpec.interactionKind).toBe('interactive_figure_submit');
    expect(step11?.modules.find((module) => module.id === 'route-panel')?.payload.panel_id).toBe('rust_cold_chain_route_compare_panel');
    expect(step11?.interactiveFigureSpec.parameter_submit_spec).toMatchObject({
      submit_fields: ['route', 'recovery_time', 'benefit_judgment', 'boundary_judgment'],
    });

    expect(existsSync(join(repoRoot, 'course-content/runtime/lessons/5-6/media/generated-data/5-6-E2-classic-trace.csv'))).toBe(true);
    expect(existsSync(join(repoRoot, 'course-content/runtime/lessons/5-6/media/generated-data/5-6-E2-data-trace.csv'))).toBe(true);
    expect(existsSync(join(repoRoot, 'course-content/runtime/lessons/5-6/media/generated-data/5-6-E2-policy-trace.csv'))).toBe(true);
    expect(existsSync(join(repoRoot, 'course-content/runtime/lessons/5-6/media/generated-data/5-6-cold-chain-summary.json'))).toBe(true);
    expect(stepPanelsSource).toContain('route: activeRoute');
    expect(stepPanelsSource).toContain('recovery_time:');
    expect(stepPanelsSource).toContain('benefit_judgment:');
    expect(stepPanelsSource).toContain('boundary_judgment:');
    expect(stepPanelsSource).toContain('temperatureChannel');
    expect(stepPanelsSource).toContain('metricView');
    expect(stepPanelsSource).toContain('RecoveryThreshold');
  });

  it('renders the step-11 teacher aggregate from structured route observation payloads', async () => {
    const manifest = readManifest();
    const { UNIT_5_6_LESSON_STEPS } = await import('@/lib/unit-5-6-course');
    const { UNIT_5_6TeacherActivitySummary } = await import('@/features/interactive/unit-5-6-method-comparison-cold-chain/step-panels');

    const html = renderToStaticMarkup(
      createElement(UNIT_5_6TeacherActivitySummary, {
        step: UNIT_5_6_LESSON_STEPS[10],
        manifest,
        responses: [{
          studentName: '学生甲',
          response: {
            stepId: 'step-11',
            submittedAt: 1,
            answers: {
              'cold_chain_route_observation': JSON.stringify({
                route: 'data',
                recovery_time: '0 min',
                benefit_judgment: '预测补偿缩短恢复时间',
                boundary_judgment: '不能证明未见扰动可部署',
              }),
            },
          },
        }],
        released: true,
        browseEnabled: true,
        answerVisible: false,
        revealProgress: 0,
        onToggleRelease: () => undefined,
        onToggleBrowse: () => undefined,
        onToggleAnswerVisible: () => undefined,
        onAdvanceReveal: () => undefined,
        onResetReveal: () => undefined,
      }),
    );

    expect(html).toContain('路线观察聚合');
    expect(html).toContain('预测补偿');
    expect(html).toContain('0 min');
    expect(html).toContain('不能证明未见扰动可部署');
  });

  it('keeps post-test and summary separated and exposes summary role statistics', async () => {
    const courseModule = await import('@/lib/unit-5-6-course');
    const featureSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(courseModule.UNIT_5_6_LESSON_STEPS[16]).toMatchObject({
      id: 'step-17',
      pageType: 'quiz_group',
    });
    expect(courseModule.UNIT_5_6_LESSON_STEPS[17]).toMatchObject({
      id: 'step-18',
      pageType: 'summary',
    });
    expect(featureSource).toContain('个人课堂表现');
    expect(featureSource).toContain('班级课堂表现');
    expect(featureSource).toContain('路线观察提交');
    expect(featureSource).toContain('后测完成率');
  });
});
