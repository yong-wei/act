import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { getInteractiveRevealLayerCount } from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import { createFallbackNonlinearAnalysisResult } from '@/resources/control-system/analysis/use-nonlinear-analysis-engine';
import {
  completePlannedPathToActualExtent,
  polylineLength,
} from '@/features/interactive/unit-5-3-mass-coordination-chain/turning-path-utils';

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

    expect(step11?.modules.some(
      (module) => module.kind === 'compute.panel'
        && module.payload.legacyKind === 'interactive-figure-panel'
        && module.payload.capabilityRef === 'interactive-figure',
    )).toBe(true);
    expect(step11?.modules.find((module) => module.id === 'turning-rust-panel')?.payload.panel_id).toBe('rust_turning_radius_panel');
    expect(stepPanelsSource).toContain("analysisKind: 'turning_radius'");
    expect(stepPanelsSource).toContain('hasCompleteTurningRadiusResult');
    expect(stepPanelsSource).toContain('R_m');
    expect(stepPanelsSource).toContain('35');
    expect(stepPanelsSource).toContain('160');
    expect(stepPanelsSource).toContain('舵角指令');
    expect(stepPanelsSource).toContain('避障航线');
    expect(stepPanelsSource).toContain('估计舵角指令');
    expect(stepPanelsSource).toContain('实际舵角信号');
    expect(stepPanelsSource).toContain('premium-lesson-title text-base font-semibold leading-7 tracking-normal');
    expect(stepPanelsSource).not.toContain('<h3 className="premium-lesson-title mt-1 text-2xl font-semibold">');
    expect(stepPanelsSource).not.toContain('Rust/WASM 转弯半径联动面板');
    expect(stepPanelsSource).not.toContain('真实计算内核');
    expect(stepPanelsSource).toContain('min_distance_m');
    expect(stepPanelsSource).toContain('collision_active');
    expect(stepPanelsSource).toContain('maxX: 260');
    expect(stepPanelsSource).toContain('maxY: 165');
    expect(stepPanelsSource).toContain('maxY: 48');
    expect(stepPanelsSource).toContain('createEqualCoordinateScale');
    expect(stepPanelsSource).toContain('completePlannedPathToActualExtent');
    expect(stepPanelsSource).toContain('<circle');
    expect(stepPanelsSource).not.toContain('<ellipse');
    expect(stepPanelsSource).toContain('避障启动距离');
    expect(stepPanelsSource).toContain('名义舵角');
    expect(stepPanelsSource).toContain('最大实际舵角');
    expect(stepPanelsSource).toContain('舵角饱和');
    expect(stepPanelsSource).toContain('安全约束');
    expect(stepPanelsSource).not.toContain('displayResult.summary.metrics');
    expect(stepPanelsSource).not.toContain('5-3-turning-radius-saturation-comparison.png');

    const fallback = createFallbackNonlinearAnalysisResult({
      runtimeMode: 'nonlinear_analysis',
      analysisKind: 'turning_radius',
      modelId: 'mass_avoidance_turn',
      parameters: { R_m: 140 },
      timeRange: { start: 0, end: 82, samples: 180 },
    });
    const turning = fallback.turningRadius!;
    const completedPlannedPath = completePlannedPathToActualExtent(turning.path.nominal, turning.path.actual);
    expect(polylineLength(completedPlannedPath)).toBeGreaterThanOrEqual(polylineLength(turning.path.actual) * 0.92);

    const courseModule = await import('@/lib/unit-5-3-course');
    const featureModule = await import('@/features/interactive/unit-5-3-mass-coordination-chain/step-panels');
    const html = renderToStaticMarkup(
      createElement(featureModule.UNIT_5_3StepContentPanel, {
        step: courseModule.getUNIT_5_3Step('step-11'),
        manifest,
        revealProgress: 0,
        allowInlineReveal: true,
        browseEnabled: true,
        role: 'student',
      }),
    );
    expect(html).toContain('data-testid="unit-5-3-turning-status-tags"');
    expect(html).not.toContain('互动页模块渲染缺失');
  });

  it('keeps corrected page text and image captions in the 5-3 runtime manifest', () => {
    const manifest = readManifest();
    const step01 = manifest.steps.find((step) => step.id === 'step-01');
    const step03 = manifest.steps.find((step) => step.id === 'step-03');
    const step04 = manifest.steps.find((step) => step.id === 'step-04');
    const step07 = manifest.steps.find((step) => step.id === 'step-07');
    const step10 = manifest.steps.find((step) => step.id === 'step-10');
    const step11 = manifest.steps.find((step) => step.id === 'step-11');
    const step12 = manifest.steps.find((step) => step.id === 'step-12');
    const step14 = manifest.steps.find((step) => step.id === 'step-14');
    const step15 = manifest.steps.find((step) => step.id === 'step-15');

    expect(step01?.modules.find((module) => module.id === 'cover-comic')?.payload.caption).toBeUndefined();

    const step03Text = JSON.stringify(step03);
    expect(step03?.modules.some((module) => module.id === 'pretest-note')).toBe(false);
    expect(step03?.aiContextSpec.pageGoal).toContain('本页考察闭环误差、反馈质量和执行器限幅三类基础知识');
    expect(step03Text).not.toContain('要点');
    expect(step03Text).not.toContain('不提前考察');
    expect(step03Text).not.toContain('不考察');
    expect(step03Text).not.toContain('不检验');
    expect(step07?.modules.some((module) => module.id === 'planning-note')).toBe(false);
    expect(step07?.aiContextSpec.pageGoal).toContain('规划层面对任务空间，控制层拿到的是参考航迹、航向或速度剖面');
    expect(step10?.modules.some((module) => module.id === 'avoidance-problem')).toBe(false);
    expect(step10?.aiContextSpec.pageGoal).toContain('一艘自主水面船在狭窄航道保持计划航线');
    expect(step12?.modules.some((module) => module.id === 'automation-note')).toBe(false);
    expect(step12?.aiContextSpec.pageGoal).toContain('自动化等级描述运行形态和责任主体差异');
    const step12Caption = step12?.modules.find((module) => module.id === 'automation-image')?.payload.caption;
    expect(step12?.modules.find((module) => module.id === 'automation-image')?.payload.title).toBe('自动化程度与责任主体场景图');
    expect(step12Caption).toContain('责任主体如何变化');
    expect(step12Caption).not.toBe(step12?.title);

    const formulaPayload = step04?.modules.find((module) => module.id === 'chain-formula')?.payload as {
      formulas?: string[];
    } | undefined;
    const formula = formulaPayload?.formulas?.[0];
    expect(formula).toBe('\\mathrm{MASS}=\\text{感知}+\\text{估计}+\\text{规划}+\\text{控制}+\\text{执行}+\\text{监督}');
    const roleCard = step04?.interactionSpec.activityCards?.find((card) => card.id === 'role-match');
    expect(roleCard?.matchItems?.map((item) => item.label)).toContain('目标船轮廓识别');
    expect(roleCard?.matchOptions?.map((item) => item.label)).toEqual(['感知', '估计', '规划', '控制', '执行', '监督']);
    expect(roleCard?.referenceAnswer).toContain('目标船轮廓识别属于感知');

    const problemText = step11?.modules.find((module) => module.id === 'turning-problem')?.payload.text;
    expect(problemText).toContain('$v=4\\,\\mathrm{m/s}$');
    expect(problemText).toContain('$r_o=25\\,\\mathrm{m}$');
    expect(problemText).toContain('$m=16\\,\\mathrm{m}$');
    expect(problemText).toContain('$L=34\\,\\mathrm{m}$');
    expect(problemText).toContain('$\\delta_{\\max}=18^\\circ$');
    expect(JSON.stringify(step11)).not.toContain('Rust');
    expect(JSON.stringify(step11)).not.toContain('WASM');
    const revealLayer = step11?.contentBlocks.turning_diagnostic_reveal as { layers?: Array<{ body: string }> };
    const thirdRevealBody = revealLayer.layers?.[2]?.body ?? '';
    expect(thirdRevealBody).toContain('$\\delta_d\\approx\\arctan(L/R)$');
    expect(thirdRevealBody).not.toContain('δd≈arctan(L/R)');

    expect(step14?.modules.some((module) => module.id === 'posttest-note')).toBe(false);
    expect(step14?.aiContextSpec.pageGoal).toBe('检查链路诊断、可实现性判断和责任边界意识。');
    expect(JSON.stringify(step14?.modules ?? [])).not.toContain('本页检查是否已经形成链路诊断、可实现性判断和责任边界意识');

    const step15Caption = step15?.modules.find((module) => module.id === 'info-image')?.payload.caption;
    expect(step15Caption).toContain('上游信息、规划可行性和执行边界');
    expect(step15Caption).not.toBe('信息图：MASS 链路责任边界');
  });

  it('recognizes step-11 reveal layers through the manifest block key', () => {
    const manifest = readManifest();
    const step11 = manifest.steps.find((step) => step.id === 'step-11');

    expect(step11?.teacherControls.teacherStepReveal).toBe('teacher_direct');
    expect(step11?.modules.find((module) => module.id === 'turning-diagnostic-reveal')?.payload.block_key).toBe(
      'turning_diagnostic_reveal',
    );
    expect(getInteractiveRevealLayerCount(step11!)).toBe(4);
  });

  it('maps all 5-3 misconception tags to Chinese labels on the teacher page', () => {
    const manifest = readManifest();
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');
    const tags = Array.from(new Set(manifest.steps.flatMap((step) => step.telemetrySpec.misconceptionTags)));

    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(teacherPageSource).toContain(`${tag}:`);
    }
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
