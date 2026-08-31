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
const routeBase = join(repoRoot, 'src/features/interactive/course-app-routes', routeSegment);
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

  it('renders Chinese module titles, list payloads, and KaTeX formulas from the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-2-course');
    const featureModule = await import('@/features/interactive/unit-5-2-nonlinear-analysis-entry/step-panels');
    const manifestText = JSON.stringify(manifest);

    expect(manifestText).not.toMatch(/payload":\{"block_key":"[^"]+","text":"\['/);
    expect(manifestText).not.toContain("']");

    const htmlByStep = new Map(
      manifest.steps.map((manifestStep) => [
        manifestStep.id,
        renderToStaticMarkup(
          createElement(featureModule.UNIT_5_2StepContentPanel, {
            step: courseModule.getUNIT_5_2Step(manifestStep.id),
            manifest,
            revealProgress: 6,
            allowInlineReveal: true,
            browseEnabled: true,
            viewerRole: 'student',
          }),
        ),
      ]),
    );
    const fullHtml = Array.from(htmlByStep.values()).join('\n');

    for (const leakedTitle of [
      'tool summary',
      'linearization formula',
      'memoryless formulas',
      'relay formulas',
      'relay reveal',
      'sat reveal',
      'three entry summary',
      'engineering consequence',
    ]) {
      expect(fullHtml).not.toContain(`>${leakedTitle}<`);
    }

    expect(htmlByStep.get('step-12')).toContain('饱和中 k 增大使曲线向原点靠近。');
    expect(htmlByStep.get('step-18')).toContain('局部线性化看工作点附近的小扰动。');
    expect(htmlByStep.get('step-18')).toContain('若海试中出现台架未暴露的周期误差');
    expect(htmlByStep.get('step-18')).toContain('工程验证重点');
    expect(htmlByStep.get('step-03')).toContain('基础知识点');
    expect(htmlByStep.get('step-03')).not.toContain('前测说明');
    expect(htmlByStep.get('step-03')).not.toContain('不提前');
    expect(fullHtml).not.toContain('前测说明');
    expect(fullHtml).not.toContain('不提前');
    expect(htmlByStep.get('step-04')).toContain('katex');
    expect(htmlByStep.get('step-13')).toContain('katex');
    expect(htmlByStep.get('step-14')).toContain('katex');
    expect(htmlByStep.get('step-16')).toContain('katex');
    expect(htmlByStep.get('step-06')).toContain('data-nonlinear-panel="rust_phase_plane_tabs"');
    expect(htmlByStep.get('step-08')).toContain('data-nonlinear-panel="rust_memoryless_nonlinearity_tabs"');
    expect(htmlByStep.get('step-08')).toContain('无记忆环节描述函数');
    expect(htmlByStep.get('step-08')).toContain('死区饱和');
    expect(htmlByStep.get('step-09')).toContain('继电与间隙描述函数');
    expect(htmlByStep.get('step-09')).toContain('滞环继电');
    expect(fullHtml).not.toContain('互动页模块渲染缺失');

    const stepById = new Map(manifest.steps.map((step) => [step.id, step]));
    const payload = (stepId: string, moduleId: string) => stepById.get(stepId)?.modules.find(
      (module) => module.id === moduleId,
    )?.payload;
    expect(payload('step-18', 'info')?.block_key).toBeUndefined();
    expect(payload('step-18', 'three-entry-summary')?.block_key).toBe('entries');
    expect(payload('step-18', 'limits')?.block_key).toBe('limits');
    expect(payload('step-18', 'engineering-focus')?.block_key).toBe('extension');
    expect(payload('step-13', 'relay-sim')?.block_key).toBeUndefined();
    expect(payload('step-14', 'sat-sim')?.block_key).toBeUndefined();
    expect(payload('step-16', 'rudder-sim')?.block_key).toBeUndefined();

    for (const [stepId, title, caption] of [
      ['step-13', '继电闭环交点与时域复核图', '理想继电闭环的描述函数交点与自振仿真'],
      ['step-14', '饱和闭环增益对比图', '饱和闭环中线性增益改变自振条件'],
      ['step-16', '舵机自振风险仿真图', '舵机死区饱和案例的交点判断与短脉冲仿真'],
      ['step-18', '三种非线性分析入口信息图', '非线性系统最小分析入口总结'],
    ] as const) {
      const html = htmlByStep.get(stepId) ?? '';
      expect(html.split(title)).toHaveLength(2);
      expect(html.split(caption)).toHaveLength(2);
    }

    const step03ActivityHtml = renderToStaticMarkup(
      createElement(featureModule.UNIT_5_2StudentActivityForm, {
        step: courseModule.getUNIT_5_2Step('step-03'),
        manifest,
        released: true,
        browseEnabled: true,
        answerVisible: false,
        revealProgress: 0,
        onSubmit: () => undefined,
      }),
    );
    const step04ActivityHtml = renderToStaticMarkup(
      createElement(featureModule.UNIT_5_2StudentActivityForm, {
        step: courseModule.getUNIT_5_2Step('step-04'),
        manifest,
        released: true,
        browseEnabled: true,
        answerVisible: false,
        revealProgress: 0,
        onSubmit: () => undefined,
      }),
    );
    expect(step03ActivityHtml).toContain('katex');
    expect(step03ActivityHtml).toContain('x_1=x');
    expect(step03ActivityHtml).toContain('e(t)=A');
    expect(step04ActivityHtml).toContain('katex');
    expect(step04ActivityHtml).toContain('f');
    expect(step04ActivityHtml).toContain('x_0');
  });

  it('exposes route files and keeps step-panels as a thin manifest runtime adapter', () => {
    expect(existsSync(join(routeBase, 'entry.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'student.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'teacher.tsx'))).toBe(true);

    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');
    const runtimeShellSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/lesson-runtime-shell.tsx'),
      'utf8',
    );
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
    expect(studentPageSource).toContain('LessonRuntimeShell');
    expect(runtimeShellSource).toContain('formatLessonStepMenuLabel');
    expect(runtimeShellSource).toContain('ChevronRight');
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
    expect(featureSource).toContain("viewerRole: 'student' | 'teacher'");
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
    const step14 = manifest.steps.find((step) => step.id === 'step-14');
    const courseModule = await import('@/lib/unit-5-2-course');
    const featureModule = await import('@/features/interactive/unit-5-2-nonlinear-analysis-entry/step-panels');

    expect(step13?.teacherControls.teacherStepReveal).toBe('enabled');
    expect(step13?.studentAccess.browse_required).toBe(true);
    expect(step13?.interactionSpec.activityCards?.[0]?.responseKind).toBe('text.short');
    expect(step14?.interactionSpec.activityCards?.[0]?.responseKind).toBe('text.short');

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
        viewerRole: 'student',
      }),
    );
    expect(studentLockedHtml).toContain('G(s)=\\dfrac{10}{s(s+2)^2}');
    expect(studentLockedHtml).toContain('katex');
    expect(studentLockedHtml).not.toContain('写出理想继电描述函数。');
    expect(studentLockedHtml).not.toContain('理想继电闭环的描述函数交点与自振仿真');

    const studentOpenHtml = renderToStaticMarkup(
      createElement(featureModule.UNIT_5_2StepContentPanel, {
        step: courseModule.getUNIT_5_2Step('step-13'),
        manifest,
        revealProgress: 0,
        allowInlineReveal: false,
        browseEnabled: true,
        viewerRole: 'student',
      }),
    );
    expect(studentOpenHtml).toContain('写出理想继电描述函数。');
    expect(studentOpenHtml).toContain('N(A)=\\dfrac{4}{\\pi A}');
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
    expect(stepPanelsSource).toContain('damped_second_order');
    expect(stepPanelsSource).toContain('stable_focus');
    expect(stepPanelsSource).toContain('P11_PERTURBATION_GEOMETRY');
    expect(stepPanelsSource).toContain('sampleCubicSegments');
    expect(stepPanelsSource).toContain('findCurveIntersections');
    expect(stepPanelsSource).toContain('releaseTargetForPerturbation');
    expect(stepPanelsSource).toContain('computePerturbationIntersections(linearCurve, negativeCurve)');
    expect(stepPanelsSource).toContain('linear_curve_path');
    expect(stepPanelsSource).toContain('negative_inverse_curve_path');
    expect(stepPanelsSource).toContain('document.body.style.userSelect');
    expect(stepPanelsSource).toContain('data-perturbation-drag-lock="active"');
    expect(stepPanelsSource).toContain('data-dragged-point={activePointId}');
    expect(stepPanelsSource).toContain('data-disturbance-direction={status.direction}');
    expect(stepPanelsSource).toContain('data-final-state={status.finalState}');
    expect(stepPanelsSource).not.toContain("analysisKind: 'perturbation_boundary'");
    expect(stepPanelsSource).not.toContain('small_perturbation_boundary');
    expect(stepPanelsSource).toContain('data-perturbation-drag-path="negative-inverse"');
    expect(stepPanelsSource).toContain('data-drag-constraint="red-negative-inverse-curve"');
    expect(stepPanelsSource).toContain('data-controls-position="bottom"');
    expect(stepPanelsSource).not.toContain('A_min');
    expect(stepPanelsSource).not.toContain('A_max');
    expect(stepPanelsSource).toContain('data-curve-mark={item.marks.start}');
    expect(stepPanelsSource).toContain('data-selected-amplitude={item.selectedPoint.amplitude?.toFixed(2)}');
  });

  it('locks p6 to p12 drawing ranges and removes curve-direction arrows', () => {
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(stepPanelsSource).toContain("van_der_pol: { x: [-3, 3], y: [-4, 4] }");
    expect(stepPanelsSource).toContain("damped_second_order: { x: [-3, 3], y: [-3, 3] }");
    expect(stepPanelsSource).toContain("stable_focus: { x: [-3, 3], y: [-3, 3] }");
    expect(stepPanelsSource).toContain("data-phase-start-point={item.id === 'phase' ? 'true' : undefined}");
    expect(stepPanelsSource).toContain('data-vector-arrow="phase-field"');
    expect(stepPanelsSource).not.toContain('markerEnd={item.points.length > 2');
    expect(stepPanelsSource).not.toContain('输入幅值边界');
    expect(stepPanelsSource).not.toContain('sineEnvelope');
    expect(stepPanelsSource).toContain('data-perturbation-figure="tex-figure-6"');
    expect(stepPanelsSource).toContain("const PERTURBATION_LABELS = ['A1', 'A2']");
    expect(stepPanelsSource).not.toContain('defaultPerturbationPoints');
    expect(stepPanelsSource).toContain('data-perturbation-label={intersection.id}');
    expect(stepPanelsSource).toContain('negativeInverseViewRange');
    expect(stepPanelsSource).toContain("fixedRangeId={id === 'rust_negative_inverse_family_panel' ? 'negative-inverse-family'");
    expect(stepPanelsSource).toContain('data-axis-font-size="12"');
  });

  it('uses a detailed p11 perturbation animation and left-figure right-status layout', () => {
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(stepPanelsSource).toContain('data-perturbation-layout="figure-left-status-right"');
    expect(stepPanelsSource).toContain('h-[460px]');
    expect(stepPanelsSource).toContain('animationFrameRef');
    expect(stepPanelsSource).toContain('requestAnimationFrame');
    expect(stepPanelsSource).toContain('P11_RELEASE_MOTION_MIN_DURATION_MS');
    expect(stepPanelsSource).toContain('P11_RELEASE_MOTION_MAX_DURATION_MS');
    expect(stepPanelsSource).toContain('easeInOutCubic');
    expect(stepPanelsSource).toContain('releaseMotionDurationForIndexes');
    expect(stepPanelsSource).toContain('motionPlansRef');
    expect(stepPanelsSource).toContain('startedAt: performance.now()');
    expect(stepPanelsSource).not.toContain('needsNextFrame');
    expect(stepPanelsSource).not.toContain('Math.max(0.55, Math.abs(distance) * 0.18)');
    expect(stepPanelsSource).toContain('native_svg_perturbation_curve_panel');
    expect(stepPanelsSource).toContain('data-animated-red-curve-motion="true"');
    expect(stepPanelsSource).toContain('data-red-motion-trail={intersection.id}');
    expect(stepPanelsSource).not.toContain('nearestFollowingIntersection');
    expect(stepPanelsSource).toContain('data-release-target={releaseTarget.index}');
    expect(stepPanelsSource).toContain('data-auto-motion-target={pointPositions[intersection.id]?.releaseTarget ?? \"drag\"}');
    expect(stepPanelsSource).toContain('data-stable-half-plane="left"');
    expect(stepPanelsSource).toContain('data-unstable-boundary="blue-curve"');
    expect(stepPanelsSource).not.toContain('<rect x="42" y="32" width="636" height="244" rx="12" fill="#d7d6ff"');
  });

  it('keeps nonlinear Rust panel headers as content titles without engineering labels', () => {
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(stepPanelsSource).not.toContain('Rust/WASM 非线性分析面板');
    expect(stepPanelsSource).not.toContain('微小扰动法拖动面板');
    expect(stepPanelsSource).toContain('premium-lesson-title text-base font-semibold leading-7 tracking-normal');
    expect(stepPanelsSource).not.toContain('<h3 className="premium-lesson-title mt-1 text-2xl font-semibold">');
  });

  it('keeps step 8 and 9 formula objects Chinese and hides step 12 scan bounds', async () => {
    const manifest = readManifest();
    const step08 = manifest.steps.find((step) => step.id === 'step-08');
    const step09 = manifest.steps.find((step) => step.id === 'step-09');
    const step12 = manifest.steps.find((step) => step.id === 'step-12');

    const step08FormulaModule = step08?.modules.find((module) => module.id === 'memoryless-formulas');
    const step09FormulaModule = step09?.modules.find((module) => module.id === 'relay-formulas');
    expect(JSON.stringify(step08FormulaModule?.payload)).toContain('饱和');
    expect(JSON.stringify(step08FormulaModule?.payload)).toContain('死区饱和');
    expect(JSON.stringify(step08FormulaModule?.payload)).not.toContain('saturation');
    expect(JSON.stringify(step09FormulaModule?.payload)).toContain('理想继电');
    expect(JSON.stringify(step09FormulaModule?.payload)).toContain('滞环继电');
    expect(JSON.stringify(step09FormulaModule?.payload)).not.toContain('hysteresis_relay');
    expect(step12?.interactiveFigureSpec.kind).toBe('rust_negative_inverse_family_panel');
    expect(step12?.interactiveFigureSpec.fallback_allowed).toBe(false);
    const step11 = manifest.steps.find((step) => step.id === 'step-11');
    expect(step11?.interactiveFigureSpec.kind).toBe('native_svg_perturbation_curve_panel');
    expect(JSON.stringify(step11?.interactiveFigureSpec)).not.toContain('perturbation_boundary');
    expect(JSON.stringify(step11?.interactiveFigureSpec)).toContain('required_svg_paths');
    expect(JSON.stringify(step11?.interactiveFigureSpec)).toContain('negative_inverse_curve_path');
    expect(JSON.stringify(step12?.interactiveFigureSpec.controls)).toContain('当前幅值 A');
    expect(JSON.stringify(step12?.interactiveFigureSpec.controls)).not.toContain('A_range');
    expect(JSON.stringify(step12?.interactiveFigureSpec.controls)).not.toContain('幅值扫描范围');
  });
});
