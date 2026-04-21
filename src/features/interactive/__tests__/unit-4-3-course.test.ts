import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
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
    const courseModule = await import('@/lib/unit-4-3-course');

    expect(courseModule.UNIT_4_3_LESSON_STEPS).toHaveLength(14);
    expect(courseModule.UNIT_4_3_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_4_3_LESSON_STEPS[13]?.id).toBe('step-14');
    expect(courseModule.UNIT_4_3_LESSON_STEPS.map((step: { pageType: string }) => step.pageType)).toEqual([
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
      join(repoRoot, 'course-content/authoring/lessons/4-3/design/interactive-contract.yaml'),
      'utf8',
    );

    expect(contractSource).not.toContain('/course-runtime/lessons/legacy/4-3');
    expect(contractSource).toContain('/course-runtime/lessons/4-3/media');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all 14 steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-3/design/interactive-contract.yaml'),
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
    const interactiveSteps = new Map(courseModule.UNIT_4_3_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    expect(expectedStepIds).toHaveLength(14);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_4_3_PAGE_CONTRACTS[stepId];

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? 'display'
          : authoringStep.interaction_spec.interaction_kind,
      );
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherControls.releaseActivity).toBe(authoringStep.teacher_controls.release_activity);
      expect(localPageContract?.teacherControls.openBrowse).toBe(authoringStep.teacher_controls.open_browse);
      expect(localPageContract?.teacherControls.teacherStepReveal).toBe(authoringStep.teacher_controls.teacher_step_reveal);
      expect(localPageContract?.teacherControls.revealReferenceAnswer).toBe(authoringStep.teacher_controls.reveal_reference_answer);
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
      expect(localPageContract?.aiPageGoal).toBe(authoringStep.ai_context_spec.page_goal);
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

    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/4-3/media/processed/');
    expect(stepPanelsSource).not.toContain('/course-runtime/lessons/legacy/4-3');
    expect(stepPanelsSource).toContain('useControlEngine');
    expect(stepPanelsSource).toContain('ControlFigureWorkspace');
    expect(stepPanelsSource).toContain('buildUnit43AnalysisRequest');
    expect(stepPanelsSource).toContain('getUnit43FallbackResult');
    expect(stepPanelsSource).toContain('当前控制器传函');
    expect(stepPanelsSource).toContain('校正前性能指标');
    expect(stepPanelsSource).toContain('当前性能指标');
    expect(stepPanelsSource).toContain('时域响应对比');
    expect(stepPanelsSource).toContain('Bode 对比');
    expect(stepPanelsSource).toContain('M_p=e^{-\\\\frac{\\\\pi\\\\zeta}{\\\\sqrt{1-\\\\zeta^2}}}');
    expect(stepPanelsSource).toContain('t_s\\\\approx\\\\dfrac{4}{\\\\zeta\\\\omega_n}');
    expect(stepPanelsSource).toContain('P_h(s)=\\\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}');
    expect(stepPanelsSource).toContain('P_e(s)=\\\\dfrac{1}{(s+1)(0.4s+1)(0.1s+1)}');
    expect(stepPanelsSource).toContain('练习 1：结构判断');
    expect(stepPanelsSource).toContain('data-progressive-reveal="step_click_reveal"');
    expect(stepPanelsSource).toContain("type: 'math'");
    expect(stepPanelsSource).toContain("type: 'text'");
    expect(stepPanelsSource).toContain('对象分析记录单');
    expect(stepPanelsSource).toContain('初始方案表达卡');
    expect(stepPanelsSource).toContain('问题清单移交表');
    expect(stepPanelsSource).toContain('renderPromptContent');
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

    expect(stepPanelsSource).not.toContain('String.raw');
    expect(stepPanelsSource).not.toContain('<BlockMath math="');
    expect(stepPanelsSource).toContain('P_1(s)=\\\\dfrac{1}{(s+1)(0.4s+1)}');
    expect(stepPanelsSource).toContain('P_2(s)=\\\\dfrac{1}{(s+1)(0.5s+1)(0.1s+1)}');
    expect(stepPanelsSource).toContain('P_3(s)=\\\\dfrac{1}{(s+1)(s+2)}');
    expect(stepPanelsSource).toContain('G_{\\\\varphi M_f}(s)=\\\\dfrac{1}{2.052s^2+0.3929s+1}');
  });

  it('aligns step-09 and step-11 reveal rendering with the 4-2 slice-based progressive reveal pattern', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('steps.slice(0, visibleCount)');
    expect(stepPanelsSource).toContain('点击当前最下方已显影步骤可继续展开下一层');
    expect(stepPanelsSource).not.toContain('const visible = index < visibleCount;');
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

  it('maps runtime media only for the remaining static anchor steps and keeps native analysis panels off the old image mapping', async () => {
    const courseModule = await import('@/lib/unit-4-3-course');

    expect(courseModule.getUNIT_4_3MediaSrc('step-01')).toContain('4-3-cover-comic.png');
    expect(courseModule.getUNIT_4_3MediaSrc('step-05')).toBeNull();
    expect(courseModule.getUNIT_4_3MediaSrc('step-06')).toBeNull();
    expect(courseModule.getUNIT_4_3MediaSrc('step-07')).toBeNull();
    expect(courseModule.getUNIT_4_3MediaSrc('step-10')).toBeNull();
    expect(courseModule.getUNIT_4_3MediaSrc('step-13')).toBeNull();
    expect(courseModule.getUNIT_4_3MediaSrc('step-14')).toContain('4-3-info.png');
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

    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="4-3 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
  });
});
