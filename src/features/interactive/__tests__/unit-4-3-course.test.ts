import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();

describe('unit 4-3 interactive course', () => {
  it('registers the 4-3 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-4-3-initial-scheme-practice-first-validation-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('经典复合控制的初始方案落地');
  });

  it('defines the full 19-step lesson flow from the authoring contract', async () => {
    const runtime = await loadLessonRuntimeEntry('4-3');
    const courseModule = await import('@/lib/unit-4-3-course');
    const steps = courseModule.buildUNIT_4_3RuntimeSteps(runtime.interactiveManifest);

    expect(steps).toHaveLength(19);
    expect(steps[0]?.id).toBe('step-01');
    expect(steps[18]?.id).toBe('step-19');
    expect(steps.map((step: { pageType: string }) => step.pageType)).toEqual([
      'display',
      'display',
      'quiz_group',
      'quiz_group',
      'card_sort',
      'step_reveal',
      'activity_card_set',
      'activity_card_set',
      'activity_card_set',
      'card_sort',
      'activity_card_set',
      'activity_card_set',
      'activity_card_set',
      'interactive_figure_submit',
      'interactive_figure_submit',
      'interactive_figure_submit',
      'interactive_figure_submit',
      'quiz_group',
      'display',
    ]);
  });

  it('keeps the authoring media contract on the real runtime path instead of legacy paths', () => {
    const contractSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/4-3/design/4-3-interactive-contract.yaml'),
      'utf8',
    );

    expect(contractSource).not.toContain('/course-runtime/lessons/legacy/4-3');
    expect(contractSource).toContain('/course-runtime/lessons/4-3/media');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all 19 steps', async () => {
    const runtime = await loadLessonRuntimeEntry('4-3');
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-3/design/4-3-interactive-contract.yaml'),
        'utf8',
      ),
    ) as {
      steps: Record<string, {
        title: string;
        layout: {
          template: string;
          regions: Array<{ id: string; width: string; order: number }>;
        };
        interaction_spec: { interaction_kind: string };
        teacher_controls: {
          release_activity: string;
          open_browse: string;
          teacher_step_reveal: string;
          reveal_reference_answer: string;
        };
        teacher_insight_spec: { widgets: string[] };
        telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
        ai_context_spec: { page_goal: string };
        preview_contract: { demo_path: string };
      }>;
    };

    const courseModule = await import('@/lib/unit-4-3-course');
    const manifestSteps = new Map(runtime.interactiveManifest?.steps.map((step) => [step.id, step]) ?? []);
    const interactiveSteps = new Map(
      courseModule.buildUNIT_4_3RuntimeSteps(runtime.interactiveManifest).map((step) => [step.id, step]),
    );
    const expectedStepIds = Object.keys(contract.steps);

    expect(expectedStepIds).toHaveLength(19);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const manifestStep = manifestSteps.get(stepId);

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? 'display'
          : authoringStep.interaction_spec.interaction_kind,
      );
      expect(manifestStep?.layout.template).toBe(authoringStep.layout.template);
      expect(manifestStep?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(manifestStep?.interactionSpec.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(manifestStep?.teacherControls.releaseActivity).toBe(authoringStep.teacher_controls.release_activity);
      expect(manifestStep?.teacherControls.openBrowse).toBe(authoringStep.teacher_controls.open_browse);
      expect(manifestStep?.teacherControls.teacherStepReveal).toBe(authoringStep.teacher_controls.teacher_step_reveal);
      expect(manifestStep?.teacherControls.revealReferenceAnswer).toBe(authoringStep.teacher_controls.reveal_reference_answer);
      expect(manifestStep?.teacherInsightSpec.widgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(manifestStep?.telemetrySpec.summaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(manifestStep?.telemetrySpec.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(manifestStep?.previewContract.demoPath).toBe(authoringStep.preview_contract.demo_path);
      expect(manifestStep?.aiContextSpec.pageGoal).toBe(authoringStep.ai_context_spec.page_goal);
    }
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-4-3-initial-scheme-practice-first-validation')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('4-3：经典复合控制的初始方案落地：从单结构候选到工程可运行方案'),
    ).toEqual({
      routeSegment: 'unit-4-3-initial-scheme-practice-first-validation',
      isPremiumCourse: true,
    });
  });

  it('exposes AI quick questions for the anti-windup validation step', () => {
    const quickQuestions = getStepQuickQuestions('unit-4-3-initial-scheme-practice-first-validation-v1', 'step-17');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('客船执行器保护与抗饱和验证');
  });

  it('renders runtime-first evidence pages without authoring media paths or inline AI blocks', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx'),
      'utf8',
    );
    const runtimeManifestSource = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-3/interactive-manifest.json'),
      'utf8',
    );
    const sharedContentRendererSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/4-3/media/processed/');
    expect(stepPanelsSource).not.toContain('/course-runtime/lessons/legacy/4-3');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('createUNIT_4_3ModuleRegistry');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).toContain('CompoundControlPanel');
    expect(stepPanelsSource).toContain('COMPOUND_CASE_DATA_URL');
    expect(stepPanelsSource).toContain('扰动前馈动态补偿面板');
    expect(stepPanelsSource).toContain('参考前馈动态补偿面板');
    expect(stepPanelsSource).toContain('给定滤波平顺性观察面板');
    expect(stepPanelsSource).toContain('抗饱和动态验证面板');
    expect(runtimeManifestSource).toContain('(s+2.14375)/0.01715');
    expect(runtimeManifestSource).toContain('Q_f(s)=1/(16s+1)');
    expect(sharedContentRendererSource).toContain('data-progressive-reveal="step_click_reveal"');
    expect(sharedContentRendererSource).toContain("'reveal-chain':");
    expect(runtimeManifestSource).toContain('首轮问题清单');
    expect(stepPanelsSource).toContain('ControlChartPanel');
    expect(stepPanelsSource).toContain('axisTooltipFormatter');
    expect(stepPanelsSource).toContain('md:grid-cols-2');
    expect(stepPanelsSource).not.toContain('baseline.plantTex.replace(/^.*?=/, \'\')');
    expect(stepPanelsSource).not.toContain("import {\n  CartesianGrid,");
    expect(stepPanelsSource).not.toContain('function OverlayLinePanel');
    expect(stepPanelsSource).not.toContain('本页无需提交');
    expect(stepPanelsSource).not.toContain('复制提示词');
    expect(stepPanelsSource).not.toContain('/ai');
  });

  it('keeps static KaTeX formulas in escaped string literals and avoids String.raw wrappers', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx'),
      'utf8',
    );
    const runtimeManifestSource = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-3/interactive-manifest.json'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('String.raw');
    expect(stepPanelsSource).not.toContain('<BlockMath math="');
    expect(runtimeManifestSource).toContain('u=C_b(s)(r_f-y)+F_r(s)r+F_d(s)d');
    expect(runtimeManifestSource).toContain('rateLimit');
    expect(runtimeManifestSource).toContain('F_r(s)=9.375s/(8s+1)');
    expect(runtimeManifestSource).toContain('\\\\dot x_i=e+(u_{act}-u_{raw})/T_{aw}');
  });

  it('aligns reveal rendering with the shared slice-based progressive reveal pattern', async () => {
    const sharedContentRendererSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/student-page.tsx'),
      'utf8',
    );
    const runtime = await loadLessonRuntimeEntry('4-3');
    const revealLayerCounts = Object.fromEntries(
      runtime.interactiveManifest!.steps
        .filter((step) => ['step-06', 'step-07', 'step-08', 'step-12'].includes(step.id))
        .map((step) => [step.id, Array.isArray(step.contentBlocks.reveal_layers) ? step.contentBlocks.reveal_layers.length : 0]),
    );

    expect(sharedContentRendererSource).toContain('items.slice(0, visibleCount)');
    expect(sharedContentRendererSource).toContain('点击当前最下方步骤继续显示下一层');
    expect(sharedContentRendererSource).not.toContain('const visible = index < visibleCount;');
    expect(revealLayerCounts).toEqual({ 'step-06': 3, 'step-07': 4, 'step-08': 4, 'step-12': 3 });
    expect(studentPageSource).toContain("stepManifest.teacherControls.teacherStepReveal === 'not_applicable'");
    expect(studentPageSource).toContain('allowInlineReveal={allowInlineReveal}');
    expect(studentPageSource).not.toContain('allowInlineReveal={isDemo || browseEnabled}');
  });

  it('adds explicit legends to the compound control charts so baseline and current curves stay distinguishable', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('legend:');
    expect(stepPanelsSource).toContain("data: ['参考输入', '扰动输入', config.baselineLabel, config.currentLabel]");
    expect(stepPanelsSource).toContain("itemStyle: { color: BASELINE_SERIES_COLOR }");
    expect(stepPanelsSource).toContain("itemStyle: { color: CURRENT_SERIES_COLOR }");
  });

  it('maps runtime media through the exported interactive manifest instead of a hardcoded step media table', async () => {
    const runtime = await loadLessonRuntimeEntry('4-3');

    expect(runtime.lesson.interactive_manifest_path).toContain('interactive-manifest.json');
    expect(runtime.interactiveManifest?.mediaPolicy).toMatchObject({
      runtime_only: true,
      runtime_export_required: true,
    });
    expect(runtime.interactiveManifest?.steps.find((step) => step.id === 'step-14')?.interactiveFigureSpec).toMatchObject({
      kind: 'unit43_disturbance_feedforward_panel',
      baseline_media: '/course-runtime/lessons/4-3/media/4-3-disturbance-feedforward-comparison.png',
    });
    expect(runtime.interactiveManifest?.steps.find((step) => step.id === 'step-17')?.interactiveFigureSpec).toMatchObject({
      kind: 'unit43_antiwindup_panel',
      baseline_media: '/course-runtime/lessons/4-3/media/4-3-antiwindup-comparison.png',
    });
  });

  it('exports the processed authoring media index to runtime instead of preserving stale runtime links', () => {
    const authoringMediaIndex = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/4-3/media/processed/4-3-media.md'),
      'utf8',
    );
    const runtimeMediaIndex = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-3/media/4-3-media.md'),
      'utf8',
    );

    expect(runtimeMediaIndex).toBe(authoringMediaIndex);
    expect(runtimeMediaIndex).toContain('/preview/v2/objectshowpreview.html?objectid=1a50c1d16508fe1d4bc869b994589a83');
    expect(runtimeMediaIndex).toContain('/preview/v2/objectshowpreview.html?objectid=2613b2f360c95d3501065357cca826a8');
    expect(runtimeMediaIndex).toContain('/preview/v2/objectshowpreview.html?objectid=72807c2c1b065890244844904f59977b');
  });

  it('routes migrated compute.panel compound panels through the native 4-3 renderer', async () => {
    const runtime = await loadLessonRuntimeEntry('4-3');
    const courseModule = await import('@/lib/unit-4-3-course');
    const featureModule = await import('@/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels');
    const manifest = runtime.interactiveManifest;
    if (!manifest) throw new Error('4-3 interactive manifest is missing');
    const runtimeStep = courseModule.buildUNIT_4_3RuntimeSteps(manifest).find((step) => step.id === 'step-14');
    const stepManifest = manifest.steps.find((step) => step.id === 'step-14');
    if (!runtimeStep || !stepManifest) throw new Error('4-3 step-14 is missing');

    const html = renderToStaticMarkup(
      createElement(featureModule.UNIT_4_3StepContentPanel, {
        manifest,
        step: runtimeStep,
        stepManifest,
        revealProgress: 0,
        allowInlineReveal: true,
      }),
    );

    expect(html).toContain('扰动前馈动态补偿面板');
    expect(html).toContain('正在读取本页运行时曲线数据');
    expect(html).not.toContain('互动页模块渲染缺失');
  });

  it('records the revised implementation acceptance evidence instead of the old static-media downgrade claim', () => {
    const acceptance = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-3/notes/interactive-implementation-acceptance.json'),
        'utf8',
      ),
    ) as {
      checks?: {
        static_media_downgrade?: {
          evidence?: string[];
        };
      };
    };

    expect(acceptance.checks?.static_media_downgrade?.evidence?.join('\n')).not.toContain('4-3 契约未要求参数联动工作区');
    expect(acceptance.checks?.static_media_downgrade?.evidence?.join('\n')).toContain('runtime 数据驱动的原生曲线联动面板');
  });

  it('wires the runtime entry page through shared media hub and runtime sections', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('PremiumLessonEntryPage');
    expect(entrySource).toContain('<PremiumLessonEntryPage');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });
});
