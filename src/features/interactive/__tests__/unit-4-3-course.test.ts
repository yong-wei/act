import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { buildUnit43AnalysisRequest } from '@/resources/control-system/analysis/unit-4-3-request-builder';
import { getControlAxisPreset } from '@/resources/control-system/charts/control-bode-options';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();

describe('unit 4-3 interactive course', () => {
  it('registers the 4-3 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-4-3-initial-scheme-practice-first-validation-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('初始方案落地实践');
  });

  it('defines the full 14-step lesson flow from the authoring contract', async () => {
    const runtime = await loadLessonRuntimeEntry('4-3');
    const courseModule = await import('@/lib/unit-4-3-course');
    const steps = courseModule.buildUNIT_4_3RuntimeSteps(runtime.interactiveManifest);

    expect(steps).toHaveLength(14);
    expect(steps[0]?.id).toBe('step-01');
    expect(steps[13]?.id).toBe('step-14');
    expect(steps.map((step: { pageType: string }) => step.pageType)).toEqual([
      'display',
      'activity_card_set',
      'single_choice',
      'display',
      'activity_card_set',
      'activity_card_set',
      'activity_card_set',
      'activity_card_set',
      'worked_example_reveal',
      'activity_card_set',
      'worked_example_reveal',
      'task_card_workspace',
      'activity_card_set',
      'quiz_group',
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

  it('keeps the local page contracts aligned with the authoring interactive contract for all 14 steps', async () => {
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
      courseModule.buildUNIT_4_3RuntimeSteps(runtime.interactiveManifest).map((step: { id: string }) => [step.id, step]),
    );
    const expectedStepIds = Object.keys(contract.steps);

    expect(expectedStepIds).toHaveLength(14);

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
      resolveSessionRouteFromPlanTitle('4-3：初始方案落地实践：从对象分析到结构组合与首轮验证'),
    ).toEqual({
      routeSegment: 'unit-4-3-initial-scheme-practice-first-validation',
      isPremiumCourse: true,
    });
  });

  it('exposes AI quick questions for the practice workspace step', () => {
    const quickQuestions = getStepQuickQuestions('unit-4-3-initial-scheme-practice-first-validation-v1', 'step-12');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('对象分析记录单');
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
    expect(stepPanelsSource).toContain('useControlEngine');
    expect(stepPanelsSource).toContain('ControlFigureWorkspace');
    expect(stepPanelsSource).toContain('buildUnit43AnalysisRequest');
    expect(stepPanelsSource).toContain('getUnit43FallbackResult');
    expect(stepPanelsSource).toContain('当前控制器传函');
    expect(stepPanelsSource).toContain('校正前性能指标');
    expect(stepPanelsSource).toContain('当前性能指标');
    expect(stepPanelsSource).toContain('时域响应对比');
    expect(stepPanelsSource).toContain('Bode 对比');
    expect(runtimeManifestSource).toContain('M_p=e^{-\\\\frac{\\\\pi\\\\zeta}{\\\\sqrt{1-\\\\zeta^2}}}');
    expect(runtimeManifestSource).toContain('t_s\\\\approx\\\\dfrac{4}{\\\\zeta\\\\omega_n}');
    expect(sharedContentRendererSource).toContain('data-progressive-reveal="step_click_reveal"');
    expect(runtimeManifestSource).toContain('对象分析记录单');
    expect(runtimeManifestSource).toContain('初始方案表达卡');
    expect(runtimeManifestSource).toContain('问题清单移交表');
    expect(stepPanelsSource).toContain('formatUnit43PlantFormula');
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
    expect(runtimeManifestSource).toContain('P_1(s)=\\\\dfrac{1}{(s+1)(0.4s+1)}');
    expect(runtimeManifestSource).toContain('P_2(s)=\\\\dfrac{1}{(s+1)(0.5s+1)(0.1s+1)}');
    expect(runtimeManifestSource).toContain('P_3(s)=\\\\dfrac{1}{(s+1)(s+2)}');
    expect(runtimeManifestSource).toContain('G_{\\\\varphi M_f}(s)=\\\\dfrac{1}{2.052s^2+0.3929s+1}');
  });

  it('aligns step-09 and step-11 reveal rendering with the shared slice-based progressive reveal pattern', async () => {
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
        .filter((step) => step.id === 'step-09' || step.id === 'step-11')
        .map((step) => [step.id, Array.isArray(step.contentBlocks.reveal_layers) ? step.contentBlocks.reveal_layers.length : 0]),
    );

    expect(sharedContentRendererSource).toContain('items.slice(0, visibleCount)');
    expect(sharedContentRendererSource).toContain('点击当前最下方步骤继续显示下一层');
    expect(sharedContentRendererSource).not.toContain('const visible = index < visibleCount;');
    expect(revealLayerCounts).toEqual({ 'step-09': 5, 'step-11': 4 });
    expect(studentPageSource).toContain("stepManifest.teacherControls.teacherStepReveal === 'not_applicable'");
    expect(studentPageSource).toContain('allowInlineReveal={allowInlineReveal}');
    expect(studentPageSource).not.toContain('allowInlineReveal={isDemo || browseEnabled}');
  });

  it('adds an explicit legend to the step-13 comparison chart so baseline and current curves stay distinguishable', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('legend:');
    expect(stepPanelsSource).toContain("data: ['原系统', '当前参数']");
    expect(stepPanelsSource).toContain("itemStyle: { color: BASELINE_SERIES_COLOR }");
    expect(stepPanelsSource).toContain("itemStyle: { color: CURRENT_SERIES_COLOR }");
  });

  it('keeps the step-13 roll-boundary comparison aligned to the 0-40 s authoring window', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx'),
      'utf8',
    );

    expect(getControlAxisPreset('unit43_roll_boundary', 'step')).toEqual({
      x: [0, 40],
      y: [-0.2, 1.2],
    });

    expect(
      buildUnit43AnalysisRequest('roll_boundary', { kp: 0.7858, ki: 2, kd: 4.104 }).timeRange.end,
    ).toBe(40);
    expect(stepPanelsSource).toContain("yAxisName: '\\\\varphi / rad'");
  });

  it('maps runtime media through the exported interactive manifest instead of a hardcoded step media table', async () => {
    const runtime = await loadLessonRuntimeEntry('4-3');

    expect(runtime.lesson.interactive_manifest_path).toContain('interactive-manifest.json');
    expect(runtime.interactiveManifest?.mediaPolicy).toMatchObject({
      runtime_only: true,
      runtime_export_required: true,
    });
    expect(runtime.interactiveManifest?.steps.find((step) => step.id === 'step-05')?.contentBlocks.media_requirements).toMatchObject({
      baseline_media: '/course-runtime/lessons/4-3/media/4-3-pi-lead-compound-quad.png',
    });
    expect(runtime.interactiveManifest?.steps.find((step) => step.id === 'step-13')?.contentBlocks.media_requirements).toMatchObject({
      validation_media: '/course-runtime/lessons/4-3/media/4-3-roll-boundary-compare.png',
    });
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
    expect(acceptance.checks?.static_media_downgrade?.evidence?.join('\n')).toContain('Rust/WASM');
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
