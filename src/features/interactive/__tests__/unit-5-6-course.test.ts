import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeSegment = 'unit-5-6-method-comparison-cold-chain';
const routeBase = join(repoRoot, 'src/features/interactive/course-app-routes', routeSegment);
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

function normalizeLatexSource(value: string | undefined) {
  return (value ?? '').replace(/\\\\/g, '\\');
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
    expect(existsSync(join(routeBase, 'entry.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'student.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'teacher.tsx'))).toBe(true);

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
    expect(teacherPageSource).toContain('onInlineReveal={advanceReveal}');
  });

  it('keeps the pretest page limited to prerequisite skills without a separate range module', () => {
    const manifest = readManifest();
    const step03 = manifest.steps.find((step) => step.id === 'step-03');

    expect(step03?.modules.map((module) => module.id)).toEqual(['pretest-quiz']);
    expect(step03?.modules.some((module) => module.kind === 'summary-card')).toBe(false);
    expect(step03?.contentBlocks.intro).toBeUndefined();
    expect(step03?.aiContextSpec.pageGoal).toContain('快慢状态判断');
    expect(step03?.aiContextSpec.pageGoal).toContain('执行限幅理解');
    expect(step03?.aiContextSpec.pageGoal).toContain('多指标读表能力');
    expect(step03?.aiContextSpec.pageGoal).not.toContain('不提前');
    expect(JSON.stringify(step03)).not.toContain('三路线');
    expect(JSON.stringify(step03)).not.toContain('策略监督层结论');
  });

  it('uses upright math operators and explicit metric symbols in the 5-6 manifest formulas', () => {
    const manifest = readManifest();
    const step06 = manifest.steps.find((step) => step.id === 'step-06');
    const step07 = manifest.steps.find((step) => step.id === 'step-07');
    const step09 = manifest.steps.find((step) => step.id === 'step-09');
    const step06FormulaBlock = step06?.contentBlocks.formula_block as { formulas?: string[] } | undefined;
    const step06RevealLayers = step06?.contentBlocks.reveal_layers as Array<{ body?: string }> | undefined;
    const step06ParamTable = step06?.contentBlocks.param_table as { rows?: unknown[][] } | undefined;
    const step07FormulaBlock = step07?.contentBlocks.formula_block as { formulas?: string[] } | undefined;
    const step09FormulaBlock = step09?.contentBlocks.formula_block as { formulas?: string[]; symbols?: Array<{ symbol: string; meaning: string }> } | undefined;

    expect(normalizeLatexSource(step06FormulaBlock?.formulas?.join('\n'))).toContain('\\mathrm{clip}');
    expect(normalizeLatexSource(step06RevealLayers?.[0]?.body)).toContain('\\mathrm{clip}');
    expect(normalizeLatexSource(step06RevealLayers?.[0]?.body)).toContain('I_{\\mathrm{min}}');
    expect(normalizeLatexSource(step06RevealLayers?.[0]?.body)).toContain('I_{\\mathrm{max}}');
    expect(normalizeLatexSource(String(step06ParamTable?.rows?.[3]?.[0]))).toBe('$I_{\\mathrm{min}},I_{\\mathrm{max}}$');
    expect(normalizeLatexSource(step07FormulaBlock?.formulas?.join('\n'))).toContain('\\mathrm{clip}');
    expect(normalizeLatexSource(step07FormulaBlock?.formulas?.join('\n'))).toContain('\\mathrm{max}');
    expect(normalizeLatexSource(step09FormulaBlock?.formulas?.join('\n'))).toContain('t_{\\mathrm{rec}}=');
    const step09Symbols = step09FormulaBlock?.symbols?.map((item) => ({
      symbol: normalizeLatexSource(item.symbol),
      meaning: item.meaning,
    }));
    expect(step09Symbols).toContainEqual({
      symbol: 'E',
      meaning: '归一化能耗，按 48 小时内压缩机占空比累加并换算为小时量。',
    });
    expect(step09Symbols).toContainEqual({
      symbol: 't_{\\mathrm{rec}}',
      meaning: '主要热负荷结束后，空气温度与货品核心温度同时回到恢复阈值以下所需时间。',
    });
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

    const { UNIT_5_6_LESSON_STEPS } = await import('@/lib/unit-5-6-course');
    const { UNIT_5_6StepContentPanel } = await import('@/features/interactive/unit-5-6-method-comparison-cold-chain/step-panels');
    const html = renderToStaticMarkup(
      createElement(UNIT_5_6StepContentPanel, {
        step: UNIT_5_6_LESSON_STEPS[10],
        manifest,
        revealProgress: 0,
        allowInlineReveal: true,
        mode: 'student',
      }),
    );
    expect(html).toMatch(/data-testid="unit-5-6-cold-chain-(route-compare-panel|diagnostic-fallback)"/);
    expect(html).not.toContain('互动页模块渲染缺失');
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

  it('renders the post-test title-card body from its manifest block key', async () => {
    const manifest = readManifest();
    const { UNIT_5_6_LESSON_STEPS } = await import('@/lib/unit-5-6-course');
    const { UNIT_5_6StepContentPanel } = await import('@/features/interactive/unit-5-6-method-comparison-cold-chain/step-panels');

    const html = renderToStaticMarkup(
      createElement(UNIT_5_6StepContentPanel, {
        step: UNIT_5_6_LESSON_STEPS[16],
        manifest,
        revealProgress: 0,
        allowInlineReveal: false,
        mode: 'student',
      }),
    );

    expect(html).toContain('后测任务');
    expect(html).toContain('本页检查同题比较、路线推荐和证据责任判断。');
    expect(html).not.toContain('互动页模块渲染缺失');
  });
});
