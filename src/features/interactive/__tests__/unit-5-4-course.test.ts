import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeSegment = 'unit-5-4-data-driven-mpc-transition';
const routeBase = join(repoRoot, 'src/app/interactive-learning/courses', routeSegment);
const featureBase = join(repoRoot, 'src/features/interactive', routeSegment);
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/5-4/interactive-manifest.json');

function readManifest() {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error('5-4 interactive manifest is invalid');
  return manifest;
}

function pageTypeFromManifest(stepId: string, interactionKind: string) {
  if (interactionKind === 'none') return stepId === 'step-17' ? 'summary' : 'display';
  return interactionKind;
}

describe('unit 5-4 interactive course', () => {
  it('defines the 17-step lesson flow from the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-4-course');

    expect(courseModule.UNIT_5_4_LESSON_STEPS).toHaveLength(17);
    expect(courseModule.UNIT_5_4_ROUTE_SEGMENT).toBe(routeSegment);
    expect(courseModule.UNIT_5_4_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_5_4_LESSON_STEPS.map((step: { title: string }) => step.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(courseModule.UNIT_5_4_LESSON_STEPS.map((step: { id: string; pageType: string }) => step.pageType)).toEqual(
      manifest.steps.map((step) => pageTypeFromManifest(step.id, step.interactionSpec.interactionKind)),
    );
  });

  it('keeps page contracts aligned with the runtime manifest', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-5-4-course');

    for (const manifestStep of manifest.steps) {
      const localContract = courseModule.getUNIT_5_4PageContractFromManifest(manifest, manifestStep.id);

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
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-5-4-course.ts'), 'utf8');

    expect(courseSource).not.toContain('course-content/runtime/lessons/5-4/interactive-manifest.json');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('rust_prediction_error_panel');
    expect(stepPanelsSource).toContain('rust_three_route_compare_panel');
    expect(stepPanelsSource).toContain('5-4-model-mismatch-prediction.csv');
    expect(stepPanelsSource).toContain('5-4-mpc-drift-comparison.csv');
    expect(stepPanelsSource).toContain('5-4 runtime manifest is required for page rendering.');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/5-4/');
    expect(teacherPageSource).toContain('currentItemId: nextStep.id');
    expect(teacherPageSource).toContain('currentStage: UNIT_5_4_STAGE_MAP[nextStep.stage]');
  });

  it('implements step-06 and step-14 as runtime-data figure panels without static-only fallback acceptance', async () => {
    const manifest = readManifest();
    const step06 = manifest.steps.find((step) => step.id === 'step-06');
    const step14 = manifest.steps.find((step) => step.id === 'step-14');
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(step06?.modules.some(
      (module) => module.kind === 'compute.panel'
        && module.payload.legacyKind === 'interactive-figure-panel'
        && module.payload.capabilityRef === 'interactive-figure',
    )).toBe(true);
    expect(step14?.modules.some(
      (module) => module.kind === 'compute.panel'
        && module.payload.legacyKind === 'interactive-figure-panel'
        && module.payload.capabilityRef === 'interactive-figure',
    )).toBe(true);
    expect(step06?.modules.find((module) => module.id === 'prediction-panel')?.payload.panel_id).toBe('rust_prediction_error_panel');
    expect(step14?.modules.find((module) => module.id === 'route-compare-panel')?.payload.panel_id).toBe('rust_three_route_compare_panel');
    expect(stepPanelsSource).toContain('data-testid="unit-5-4-prediction-error-panel"');
    expect(stepPanelsSource).toContain('data-testid="unit-5-4-route-compare-panel"');
    expect(stepPanelsSource).toContain('data-runtime-data="5-4-model-mismatch-prediction.csv"');
    expect(stepPanelsSource).toContain('data-runtime-data="5-4-mpc-drift-comparison.csv"');
    expect(stepPanelsSource).toContain('仿真数据暂未载入');
  });

  it('removes duplicated p3-p5 explanation modules and migrates their copy into title descriptions', () => {
    const manifest = readManifest();
    const step03 = manifest.steps.find((step) => step.id === 'step-03');
    const step04 = manifest.steps.find((step) => step.id === 'step-04');
    const step05 = manifest.steps.find((step) => step.id === 'step-05');

    expect(step03?.modules.map((module) => module.id)).not.toContain('pretest-note');
    expect(step03?.contentBlocks).not.toHaveProperty('note');
    expect(step03?.aiContextSpec.pageGoal).toContain('考察知识点：一阶对象 $G(s)=K/(Ts+1)$');
    expect(step03?.aiContextSpec.pageGoal).toContain('$e(t)=r(t)-y(t)$');
    expect(step03?.aiContextSpec.pageGoal).toContain('$|\\delta|\\le 12^\\circ$');

    expect(step04?.modules.map((module) => module.id)).not.toContain('context');
    expect(step04?.contentBlocks).not.toHaveProperty('context');
    expect(step04?.modules[0]).toMatchObject({ id: 'model-formula', region: 'formula' });
    expect(step04?.aiContextSpec.pageGoal).toBe('模型驱动控制先把对象动态关系写清楚，再根据这个关系分析稳定性、性能和约束。');

    expect(step05?.modules.map((module) => module.id)).not.toContain('pressure-intro');
    expect(step05?.contentBlocks).not.toHaveProperty('intro');
    expect(step05?.modules[0]).toMatchObject({ id: 'pressure-table', region: 'table' });
    expect(step05?.aiContextSpec.pageGoal).toBe('模型压力来自模型独自承担的任务过重，而不是模型失去价值。');
  });

  it('keeps p6, p10, and p13 formula-heavy copy in KaTeX-readable strings', () => {
    const manifest = readManifest();
    const step06 = manifest.steps.find((step) => step.id === 'step-06');
    const step10 = manifest.steps.find((step) => step.id === 'step-10');
    const step13 = manifest.steps.find((step) => step.id === 'step-13');

    expect(step06?.contentBlocks.problem).toMatchObject({
      body: expect.stringContaining('$K_m=0.18$'),
    });
    expect(JSON.stringify(step06?.contentBlocks.problem)).toContain('$T_m=8.0\\\\ \\\\mathrm{s}$');
    expect(JSON.stringify(step06?.contentBlocks.problem)).toContain('$K_a=0.125$');
    expect(JSON.stringify(step06?.contentBlocks.problem)).toContain('$T_a=11.5\\\\ \\\\mathrm{s}$');

    const revealItems = (step10?.contentBlocks.reveal_chain as { items?: Array<{ body?: string; formula?: string }> } | undefined)?.items ?? [];
    expect(revealItems[0]?.body).toContain('$r_{j+1}=a r_j+b\\delta_j+c$');
    expect(revealItems[0]?.body).toContain('$\\delta_j$');
    expect(revealItems[1]?.body).toContain('$\\hat a_k,\\hat b_k,\\hat c_k$');
    expect(revealItems[1]?.formula).toContain('\\hat T_k=\\frac{\\Delta t}{1-\\hat a_k}');
    expect(revealItems[1]?.formula).toContain('\\hat K_k=\\frac{\\hat b_k\\hat T_k}{\\Delta t}');
    expect(revealItems[1]?.formula).toContain('\\hat d_k=\\frac{\\hat c_k}{\\Delta t}');

    const step13Problem = JSON.stringify(step13?.contentBlocks.problem);
    expect(step13Problem).toContain('$G_m(s)=K_m/(T_m s+1)$');
    expect(step13Problem).toContain('$K=0.18,T=8.0\\\\ \\\\mathrm{s}$');
    expect(step13Problem).toContain('$K=0.065,T=18.0\\\\ \\\\mathrm{s}$');
    expect(step13Problem).toContain('$t=28\\\\ \\\\mathrm{s}$');
    expect(step13Problem).toContain('$t=108\\\\ \\\\mathrm{s}$');
  });

  it('keeps p4, p7, and p8 formula content valid for shared KaTeX rendering', () => {
    const manifest = readManifest();
    const step04 = manifest.steps.find((step) => step.id === 'step-04');
    const step07 = manifest.steps.find((step) => step.id === 'step-07');
    const step08 = manifest.steps.find((step) => step.id === 'step-08');

    const step04FormulaBlock = step04?.contentBlocks.formula_block as
      | { formulas?: string[]; symbols?: Array<{ symbol?: string; meaning?: string }> }
      | undefined;
    const step07FormulaBlock = step07?.contentBlocks.formula_block as
      | { formulas?: string[]; symbols?: Array<{ symbol?: string; meaning?: string }> }
      | undefined;
    const step08CaseText = step08?.contentBlocks.case_text as { body?: string } | undefined;

    expect(step04FormulaBlock?.formulas).toEqual(['x_{k+1}=f(x_k,u_k,p_k)', 'y_k=h(x_k,u_k)']);
    expect(step04FormulaBlock?.symbols?.map((item) => item.symbol)).toEqual([
      'x_k',
      'u_k',
      'y_k',
      'p_k',
      'f(\\cdot)',
      'h(\\cdot)',
    ]);

    expect(step07FormulaBlock?.formulas).toContain(
      '\\min_{u_0,\\ldots,u_{N-1}} \\sum_{i=0}^{N-1}\\left(\\left\\|y_{k+i}-r_{k+i}\\right\\|_Q^2+\\left\\|u_{k+i}\\right\\|_R^2\\right)',
    );
    expect(step07FormulaBlock?.formulas).toContain(
      'x_{k+i+1}=f(x_{k+i},u_{k+i}),\\quad y_{k+i}=h(x_{k+i}),\\quad u_{\\min}\\le u_{k+i}\\le u_{\\max}',
    );
    const step07FormulaText = step07FormulaBlock?.formulas?.join('\n') ?? '';
    expect(step07FormulaText).not.toMatch(/(^|[^\\])min_/);
    expect(step07FormulaText).not.toMatch(/(^|[^\\])sum_/);
    expect(step07FormulaText).not.toContain('u_min<=');
    expect(step07FormulaBlock?.symbols?.map((item) => item.symbol)).toEqual([
      'N',
      'r_{k+i}',
      'Q',
      'R',
      'u_{k+i}',
      'u_{\\min}',
      'u_{\\max}',
    ]);

    expect(step08CaseText?.body).toContain('$20\\ \\mathrm{s}$');
    expect(step08CaseText?.body).toContain('$18^\\circ$');
    expect(step08CaseText?.body).toContain('$|\\delta|\\le 12^\\circ$');
  });

  it('maps p14 runtime route metric keys to Chinese labels in the route comparison adapter', () => {
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(stepPanelsSource).toContain("traditional_fixed: '传统固定控制'");
    expect(stepPanelsSource).toContain("nominal_model_mpc: '名义模型 MPC'");
    expect(stepPanelsSource).toContain("data_driven_model_mpc: '数据驱动模型 MPC'");
    expect(stepPanelsSource).toContain('route: routeMethodLabel(focused.method)');
    expect(stepPanelsSource).toContain('当前最低：{routeMethodLabel(bestFocusedRow.method)}');
    expect(stepPanelsSource).toContain('<td className="px-3 py-2">{routeMethodLabel(row.method)}</td>');
  });

  it('keeps post-test and summary separated and exposes summary role statistics', async () => {
    const courseModule = await import('@/lib/unit-5-4-course');
    const featureSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(courseModule.UNIT_5_4_LESSON_STEPS[15]).toMatchObject({
      id: 'step-16',
      pageType: 'quiz_group',
    });
    expect(courseModule.UNIT_5_4_LESSON_STEPS[16]).toMatchObject({
      id: 'step-17',
      pageType: 'summary',
    });
    expect(featureSource).toContain('SummaryStats');
    expect(featureSource).toContain('TeacherStats');
    expect(featureSource).toContain('个人课堂表现');
    expect(featureSource).toContain('班级课堂表现');
    expect(featureSource).toContain('后测完成率');
  });
});
