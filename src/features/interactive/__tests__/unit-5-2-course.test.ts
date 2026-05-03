import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  createManifestTeacherActivityRegistry,
  renderTeacherInteractiveActivity,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';

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
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');
    const headerSource = readFileSync(join(featureBase, 'course-header.tsx'), 'utf8');
    const contentRendererSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-5-2-course.ts'), 'utf8');

    expect(courseSource).not.toContain('course-content/runtime/lessons/5-2/interactive-manifest.json');
    expect(courseSource).not.toContain('UNIT_5_2_RUNTIME_MANIFEST');
    expect(courseSource).not.toContain('fallbackManifestStep');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('extra: { revealProgress, allowInlineReveal, onInlineReveal: onAdvanceReveal }');
    expect(stepPanelsSource).toContain('Unit52NonlinearAnalysisPanel');
    expect(stepPanelsSource).toContain('useNonlinearAnalysisEngine');
    expect(stepPanelsSource).toContain('5-2 runtime manifest is required for page rendering.');
    expect(contentRendererSource).toContain('step.contentBlocks.reveal_layers ?? step.contentBlocks.reveal_steps');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).not.toContain('manifest ?? UNIT_5_2_RUNTIME_MANIFEST');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/5-2/');
    expect(headerSource).toContain('formatLessonStepMenuLabel');
    expect(headerSource).toContain('id="unit-5-2-step-select"');
    expect(headerSource).toContain('ChevronRight');
    expect(studentPageSource).toContain('isOutOfSync');
    expect(studentPageSource).toContain('跳到教师当前页');
    expect(studentPageSource).toContain("sessionInfo?.status === 'FINISHED'");
    expect(studentPageSource).toContain('__nonlinear_parameters');
    expect(studentPageSource).toContain('nonlinearParameterSnapshots');
    expect(studentPageSource).not.toContain('UNIT_5_2_LESSON_STEPS.map((item, index)');
    expect(teacherPageSource).toContain('当前在线学生');
    expect(teacherPageSource).toContain('buildSessionEndReturnHref');
    expect(teacherPageSource).toContain('currentItemId: nextStep.id');
    expect(teacherPageSource).toContain('currentStage: UNIT_5_2_STAGE_MAP[nextStep.stage]');
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
    expect(featureSource).toContain('后测完成率');
    expect(featureSource).toContain('常见误判标签');
    expect(featureSource).toContain('data-role-hidden-module={module.id}');
    expect(featureSource).toContain("role: 'student' | 'teacher'");
    expect(featureSource).toContain("role_visibility");
  });

  it('derives teacher objective scoring and misconception summary from manifest cards', () => {
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');

    expect(teacherPageSource).toContain('collectObjectiveCards(runtimeManifest)');
    expect(teacherPageSource).toContain('expectedObjectiveAnswer(card)');
    expect(teacherPageSource).toContain('isObjectiveAnswerCorrect(item, answer)');
    expect(teacherPageSource).toContain('step.telemetrySpec.misconceptionTags');
    expect(teacherPageSource).not.toContain('UNIT_5_2_OBJECTIVE_STEP_IDS');
    expect(teacherPageSource).toContain('misconceptionTag: tags[index] ?? tags[0]');
    expect(teacherPageSource).not.toContain('按题查看');
    expect(teacherPageSource).not.toContain('汇总提交后显示');
  });

  it('honors 5-2 teacher reveal and browse-required contracts from the real runtime manifest', async () => {
    const manifest = readManifest();
    const step13 = manifest.steps.find((step) => step.id === 'step-13');
    const courseModule = await import('@/lib/unit-5-2-course');
    const featureModule = await import('@/features/interactive/unit-5-2-nonlinear-analysis-entry/step-panels');

    expect(step13?.teacherControls.teacherStepReveal).toBe('enabled');
    expect(step13?.studentAccess.browse_required).toBe(true);

    const teacherHtml = renderToStaticMarkup(
      createElement(
        'div',
        null,
        renderTeacherInteractiveActivity({
          registry: createManifestTeacherActivityRegistry(),
          step: courseModule.getUNIT_5_2Step('step-13'),
          stepManifest: step13!,
          responses: [],
          released: true,
          browseEnabled: false,
          answerVisible: false,
          revealProgress: 0,
          onToggleRelease: () => undefined,
          onToggleBrowse: () => undefined,
          onToggleAnswerVisible: () => undefined,
          onAdvanceReveal: () => undefined,
          onResetReveal: () => undefined,
        }),
      ),
    );
    expect(teacherHtml).toContain('推进显影');
    expect(teacherHtml).toContain('重置显影');

    const studentLockedHtml = renderToStaticMarkup(
      createElement(featureModule.UNIT_5_2StepContentPanel, {
        step: courseModule.getUNIT_5_2Step('step-13'),
        manifest,
        revealProgress: 0,
        allowInlineReveal: false,
        browseEnabled: false,
        role: 'student',
      }),
    );
    expect(studentLockedHtml).toContain('G(s)=10/[s(s+2)^2]');
    expect(studentLockedHtml).not.toContain('写出 N(A)=4/(πA)。');
    expect(studentLockedHtml).not.toContain('理想继电闭环的描述函数交点与自振仿真');

    const studentOpenHtml = renderToStaticMarkup(
      createElement(featureModule.UNIT_5_2StepContentPanel, {
        step: courseModule.getUNIT_5_2Step('step-13'),
        manifest,
        revealProgress: 0,
        allowInlineReveal: false,
        browseEnabled: true,
        role: 'student',
      }),
    );
    expect(studentOpenHtml).toContain('写出 N(A)=4/(πA)。');
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
    expect(stepPanelsSource).toContain('showVectorField');
    expect(stepPanelsSource).toContain("onPointSelect={id === 'rust_phase_plane_tabs' ? handlePhasePointSelect : undefined}");
    expect(stepPanelsSource).toContain('A_min');
    expect(stepPanelsSource).toContain('A_max');
    expect(stepPanelsSource).toContain('data-curve-mark={item.marks.start}');
  });
});
