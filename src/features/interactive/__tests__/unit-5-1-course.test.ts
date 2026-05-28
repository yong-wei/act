import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeSegment = 'unit-5-1-linear-backbone-boundaries';
const routeBase = join(repoRoot, 'src/app/interactive-learning/courses', routeSegment);
const featureBase = join(repoRoot, 'src/features/interactive', routeSegment);
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/5-1/interactive-manifest.json');

function readManifest() {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error('5-1 interactive manifest is invalid');
  return manifest;
}

function pageTypeFromManifest(stepId: string, interactionKind: string) {
  if (interactionKind === 'none') return stepId === 'step-14' ? 'summary' : 'display';
  return interactionKind;
}

describe('unit 5-1 interactive course', () => {
  it('defines the 14-step lesson flow from the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-1-course');

    expect(courseModule.UNIT_5_1_LESSON_STEPS).toHaveLength(14);
    expect(courseModule.UNIT_5_1_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_5_1_LESSON_STEPS.map((step: { title: string }) => step.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(courseModule.UNIT_5_1_LESSON_STEPS.map((step: { id: string; pageType: string }) => step.pageType)).toEqual(
      manifest.steps.map((step) => pageTypeFromManifest(step.id, step.interactionSpec.interactionKind)),
    );
  });

  it('keeps page contracts aligned with the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-1-course');

    for (const manifestStep of manifest.steps) {
      const localStep = courseModule.UNIT_5_1_LESSON_STEPS.find(
        (step: { id: string }) => step.id === manifestStep.id,
      ) as { title: string; pageType: string } | undefined;
      const localContract = courseModule.getUNIT_5_1PageContractFromManifest(manifest, manifestStep.id);

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

  it('exposes route files and keeps step-panels as a shared manifest runtime adapter with a narrow nonlinear panel', () => {
    expect(existsSync(join(routeBase, 'page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'teacher/[sessionId]/page.tsx'))).toBe(true);

    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-5-1-course.ts'), 'utf8');

    expect(courseSource).not.toContain('course-content/runtime/lessons/5-1/interactive-manifest.json');
    expect(courseSource).not.toContain('UNIT_5_1_RUNTIME_MANIFEST');
    expect(courseSource).not.toContain('UNIT_5_1_PAGE_CONTRACTS');
    expect(courseSource).not.toContain('fallbackManifestStep');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(studentPageSource).toContain('useManifestSubmissionController');
    expect(studentPageSource).toContain('submitManifestStepResponse({');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('onInlineReveal: onAdvanceReveal');
    expect(stepPanelsSource).toContain('extra: { revealProgress, allowInlineReveal, onInlineReveal: onAdvanceReveal }');
    expect(stepPanelsSource).toContain('Unit51NonlinearBoundaryPanel');
    expect(stepPanelsSource).toContain('5-1 runtime manifest is required for page rendering.');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).not.toContain('manifest ?? UNIT_5_1_RUNTIME_MANIFEST');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/5-1/');
    expect(studentPageSource).toContain('updatePageContext({');
    expect(studentPageSource).toContain('__boundary_parameters');
    expect(studentPageSource).toContain('boundaryParameterSnapshots');
    expect(studentPageSource).toContain('parameterSubmitted');
    expect(studentPageSource).toContain('parameterSnapshots: currentBoundaryParameters');
    expect(studentPageSource).toContain('const handleBoundaryParameterChange = useCallback');
    expect(studentPageSource).toContain('onParameterChange={handleBoundaryParameterChange}');
    expect(studentPageSource).not.toContain('AI 助手');
  });

  it('lets the teacher advance reveal layers by clicking visible content', () => {
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');

    expect(teacherPageSource).toContain('allowInlineReveal={true}');
    expect(teacherPageSource).toContain('onAdvanceReveal={advanceReveal}');
  });

  it('keeps post-test and summary separated and exposes summary role statistics', async () => {
    const courseModule = await import('@/lib/unit-5-1-course');
    const featureSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(courseModule.UNIT_5_1_LESSON_STEPS[12]).toMatchObject({
      id: 'step-13',
      pageType: 'quiz_group',
    });
    expect(courseModule.UNIT_5_1_LESSON_STEPS[13]).toMatchObject({
      id: 'step-14',
      pageType: 'summary',
    });
    expect(featureSource).toContain('Unit51StudentSummaryStats');
    expect(featureSource).toContain('Unit51TeacherSummaryStats');
    expect(featureSource).toContain('参数探索提交');
    expect(featureSource).toContain('客观题正确率');
    expect(featureSource).toContain('主观题完整率');
    expect(featureSource).toContain('参数探索覆盖');
    expect(featureSource).toContain('常见误判标签');
    expect(featureSource).toContain('data-role-hidden-module={module.id}');
    expect(featureSource).toContain('const abilitySummary');
    expect(featureSource).not.toContain('边界证据链已记录');
    expect(featureSource).toContain('key={`${manifestStep.id}:${module.id}`}');
  });

  it('derives teacher objective scoring and misconception summary from manifest cards', () => {
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');

    expect(teacherPageSource).toContain('collectObjectiveCards(runtimeManifest)');
    expect(teacherPageSource).toContain('expectedObjectiveAnswer(card)');
    expect(teacherPageSource).toContain('isObjectiveAnswerCorrect(item, answer)');
    expect(teacherPageSource).toContain('step.telemetrySpec.misconceptionTags');
    expect(teacherPageSource).not.toContain('answeredFields');
    expect(teacherPageSource).not.toContain('possibleFields');
    expect(teacherPageSource).not.toContain('参数探索缺失');
  });

  it('keeps all 5-1 curve comparison pages on a real control panel instead of a static media downgrade', () => {
    const manifest = readManifest();
    const curveSteps = manifest.steps.filter((step) => step.interactionSpec.interactionKind === 'curve_compare_panel');

    expect(curveSteps.map((step) => step.id)).toEqual(['step-06', 'step-07', 'step-08', 'step-09', 'step-10', 'step-11']);
    for (const step of curveSteps) {
      const panel = step.modules.find((module) => module.kind === 'rust-analysis-panel');
      expect(panel?.mustBeVisible).toBe(true);
      expect(step.interactiveFigureSpec.layoutMirror).toBeTruthy();
      expect(step.interactiveFigureSpec.controlsPlacement ?? 'below_figure').toBe('below_figure');
    }
  });

  it('renders 5-1 objectives, matching cards, and formula reveal payloads from the runtime manifest', () => {
    const manifest = readManifest();
    const objectiveStep = manifest.steps.find((step) => step.id === 'step-02');
    const step04Card = manifest.steps.find((step) => step.id === 'step-04')?.interactionSpec.activityCards?.[0];
    const step05Card = manifest.steps.find((step) => step.id === 'step-05')?.interactionSpec.activityCards?.[0];
    const step13Card = manifest.steps.find((step) => step.id === 'step-13')?.interactionSpec.activityCards?.[0];
    const step06 = manifest.steps.find((step) => step.id === 'step-06');
    const step07 = manifest.steps.find((step) => step.id === 'step-07');

    expect(objectiveStep?.contentBlocks.objectives).toMatchObject({
      items: expect.arrayContaining([expect.stringContaining('说明线性定常主干默认依赖')]),
    });
    expect([step04Card?.responseKind, step05Card?.responseKind, step13Card?.responseKind]).toEqual([
      'matching.pairs',
      'matching.pairs',
      'matching.pairs',
    ]);
    expect([step04Card?.legacyResponseKind, step05Card?.legacyResponseKind, step13Card?.legacyResponseKind]).toEqual([
      'drag_match',
      'drag_match',
      'drag_match',
    ]);
    expect(step05Card?.options.map((option) => option.label.split(' -> ')[1])).toEqual([
      '比例近似',
      '固定增益近似',
      '小信号灵敏度',
      '单值',
      '连续',
      '结构固定',
      '参数稳定',
    ]);
    expect(step05Card?.referenceAnswer).toContain('饱和破坏比例近似');
    expect(step05Card?.referenceAnswer).toContain('速率限制破坏固定增益近似');
    expect(step05Card?.referenceAnswer).toContain('量化破坏连续');
    expect(step06?.modules.map((module) => module.id)).toEqual(
      expect.arrayContaining(['smooth-problem', 'smooth-reveal', 'smooth-panel']),
    );
    expect(step07?.modules.map((module) => module.id)).toEqual(
      expect.arrayContaining(['relay-problem', 'relay-reveal', 'relay-panel']),
    );
    expect((step06?.contentBlocks.reveal_layers as { layers?: unknown[] })?.layers).toHaveLength(5);
    expect((step06?.contentBlocks.rust_panel as { controls?: Array<{ kind?: string }> })?.controls).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ kind: 'toggle' })]),
    );
    expect((step07?.contentBlocks.rust_panel as { controls?: Array<{ kind?: string }> })?.controls).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ kind: 'toggle' })]),
    );
    expect(JSON.stringify(step06?.contentBlocks.rust_panel)).not.toContain('show_linearized');
    expect(JSON.stringify(step06?.contentBlocks.rust_panel)).not.toContain('show_original');
    expect(JSON.stringify(step07?.contentBlocks.rust_panel)).not.toContain('show_fake_gain');
  });
});
