import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 4-2 interactive course', () => {
  it('registers the 4-2 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-4-2-controller-selection-first-start-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('控制器选型原理');
  });

  it('defines the full 13-step lesson flow after removing the old summary-infographic step', async () => {
    const courseModule = await import('@/lib/unit-4-2-course');

    expect(courseModule.UNIT_4_2_LESSON_STEPS).toHaveLength(13);
    expect(courseModule.UNIT_4_2_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[12]?.id).toBe('step-13');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[2]?.pageType).toBe('display');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[3]?.pageType).toBe('multi_select_matrix');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[4]?.pageType).toBe('activity_card_set');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[5]?.pageType).toBe('worked_example_reveal');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[10]?.pageType).toBe('task_card_workspace');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[11]?.pageType).toBe('quiz_card_grid');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[12]?.pageType).toBe('display');
  });

  it('exposes AI quick questions for the simplified start-card workspace step', () => {
    const quickQuestions = getStepQuickQuestions('unit-4-2-controller-selection-first-start-v1', 'step-11');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('起步卡');
  });

  it('maps runtime media only for remaining static-media steps and keeps native case panels off the legacy 4-1 png path', async () => {
    const courseModule = await import('@/lib/unit-4-2-course');

    expect(courseModule.getUNIT_4_2MediaSrc('step-01')).toContain('4-2-cover-comic.png');
    expect(courseModule.getUNIT_4_2MediaSrc('step-05')).toBeNull();
    expect(courseModule.getUNIT_4_2MediaSrc('step-07')).toBeNull();
    expect(courseModule.getUNIT_4_2MediaSrc('step-09')).toContain('4-2-input-feedforward-quad.png');
    expect(courseModule.getUNIT_4_2MediaSrc('step-10')).toContain('4-2-disturbance-feedforward-quad.png');
    expect(courseModule.getUNIT_4_2MediaSrc('step-13')).toContain('4-2-info.png');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all 13 steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-2/design/interactive-contract.yaml'),
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

    const courseModule = await import('@/lib/unit-4-2-course');
    const interactiveSteps = new Map(courseModule.UNIT_4_2_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    expect(expectedStepIds).toHaveLength(13);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_4_2_PAGE_CONTRACTS[stepId];

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

  it('exports a module-level runtime manifest for every 4-2 step', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
        'utf8',
      ),
    ) as {
      steps: Record<string, {
        modules?: Array<{ id: string; kind: string; must_be_visible?: boolean }>;
        interaction_spec?: { activity_cards?: unknown[] };
      }>;
    };

    const stepEntries = Object.entries(manifest.steps);

    expect(stepEntries).toHaveLength(13);
    expect(stepEntries.every(([, step]) => (step.modules ?? []).length > 0)).toBe(true);
    expect(
      stepEntries.flatMap(([, step]) => step.modules ?? []).filter((module) => module.must_be_visible).length,
    ).toBeGreaterThanOrEqual(47);
    expect(manifest.steps['step-04']?.interaction_spec?.activity_cards).toHaveLength(3);
    expect(manifest.steps['step-12']?.interaction_spec?.activity_cards).toHaveLength(4);
  });

  it('renders 4-2 through the shared manifest runtime with only narrow Rust adapters', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-2-controller-selection-first-start/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('rust-analysis-panel');
    expect(stepPanelsSource).not.toContain('switch (step.id)');
    expect(stepPanelsSource).not.toContain('PRETEST_QUESTIONS');
    expect(stepPanelsSource).not.toContain('CONTROLLER_TOOLBOX_ROWS');
    expect(stepPanelsSource).not.toContain('ASSESSMENT_CARD_FIELDS');
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-4-2-controller-selection-first-start')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('4-2：控制器选型原理：不同控制结构为何适合不同任务'),
    ).toEqual({
      routeSegment: 'unit-4-2-controller-selection-first-start',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub and runtime sections', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-2-controller-selection-first-start/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('PremiumLessonEntryPage');
    expect(entrySource).toContain('<PremiumLessonEntryPage');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });

  it('keeps the migrated 4-2 content blocks visible through the runtime manifest', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-2-controller-selection-first-start/step-panels.tsx'),
      'utf8',
    );
    const manifest = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
        'utf8',
      ),
    ) as { steps: Record<string, unknown> };
    const manifestText = JSON.stringify(manifest);

    expect(stepPanelsSource).not.toContain('String.raw`P_h(s)=');
    expect(stepPanelsSource).not.toContain('String.raw`P_p(s)=');
    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/4-2/media/processed/');
    expect(manifestText).toContain('/course-runtime/lessons/4-2/media/4-2-input-feedforward-vs-pd-structure.png');
    expect(manifestText).toContain('/course-runtime/lessons/4-2/media/4-2-disturbance-feedforward-structure-compare.png');
    expect(stepPanelsSource).toContain('ControlFigureWorkspace');
    expect(manifestText).toContain('表 5 的频域比较');
    expect(manifestText).toContain('工具箱总表');
    expect(manifestText).toContain('当前任务');
    expect(manifestText).toContain('主要代价');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).not.toContain('本页无需提交');
  });

  it('keeps the simplified workspace to six core start-card fields', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
        'utf8',
      ),
    ) as { steps: Record<string, { content_blocks?: { start_card_fields?: string[] } }> };
    const fields = manifest.steps['step-11']?.content_blocks?.start_card_fields ?? [];

    expect(fields).toEqual(['当前任务', '最紧矛盾', '首选单结构', '参数起步方向', '预期收益', '主要代价']);
    expect(fields).not.toContain('留给 4-3 的问题');
  });

  it('renders full mathematical expressions for the step-04 controller toolbox instead of only semantic labels', () => {
    const manifestText = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
      'utf8',
    );

    expect(manifestText).toContain('C_{PI}(s)=K_p+\\\\dfrac{K_i}{s}');
    expect(manifestText).toContain('C_{PD}(s)=K_p+K_d s');
    expect(manifestText).toContain('C_{lead}(s)=K\\\\dfrac{Ts+1}{\\\\alpha Ts+1}');
    expect(manifestText).toContain('C_{lag}(s)=K\\\\dfrac{Ts+1}{\\\\beta Ts+1}');
  });

  it('keeps step-06 and step-08 frequency-domain evidence complete instead of collapsing them into one-line comparisons', () => {
    const manifestText = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
      'utf8',
    );
    const interactivePageSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/4-2/design/interactive-page.md'),
      'utf8',
    );

    expect(interactivePageSource).toContain('频域公式链');
    expect(interactivePageSource).toContain('截止频率附近的幅值、相位比较');
    expect(interactivePageSource).toContain('PD / 超前 与 PI 的频域公式比较');

    expect(manifestText).toContain('C_{PI}(j\\\\omega_c)');
    expect(manifestText).toContain('C_{PD}(j\\\\omega_c)');
    expect(manifestText).toContain('1.414');
    expect(manifestText).toContain('45^\\\\circ');
    expect(manifestText).toContain('\\\\omega_i=5\\\\,\\\\text{rad/s}');
    expect(manifestText).toContain('表 5 的频域比较');
    expect(manifestText).toContain('表 7 的频域比较');
  });

  it('keeps step-09 and step-10 in handout order: principle/formulas before structure figure and comparison figure after analysis', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
        'utf8',
      ),
    ) as { steps: Record<string, { modules?: Array<{ id: string }> }> };
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-2-controller-selection-first-start/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain("pageContract.teacherControls.teacherStepReveal === 'not_applicable'");
    expect(studentPageSource).toContain('allowInlineReveal={allowInlineReveal}');
    expect(studentPageSource).not.toContain('allowInlineReveal={isDemo || browseEnabled}');

    expect(manifest.steps['step-09']?.modules?.map((module) => module.id)).toEqual([
      'input-ff-principle',
      'input-ff-structure',
      'input-ff-closed-loop-formulas',
      'input-ff-analysis',
      'input-ff-quad',
      'input-ff-cards',
    ]);
    expect(manifest.steps['step-10']?.modules?.map((module) => module.id)).toEqual([
      'disturbance-formulas',
      'disturbance-structure',
      'disturbance-analysis',
      'disturbance-boundary',
      'disturbance-quad',
      'disturbance-cards',
    ]);
  });

  it('lets worked-example reveal maintain local click-to-continue state instead of relying only on teacher progress', () => {
    const sharedRendererSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );
    const revealChainStart = sharedRendererSource.indexOf('function StepReveal');
    const revealChainEnd = sharedRendererSource.indexOf('export function createManifestContentModuleRegistry');
    const revealChainSlice = sharedRendererSource.slice(revealChainStart, revealChainEnd);

    expect(revealChainSlice).toContain('useState(');
    expect(revealChainSlice).toContain('setLocalVisibleCount');
    expect(revealChainSlice).toContain('onClick={showNext}');
  });

  it('does not directly reuse the unit-4-1 request builder or fallback fixtures inside the 4-2 step panels', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-2-controller-selection-first-start/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('unit-4-1-request-builder');
    expect(stepPanelsSource).not.toContain('unit-4-1-fixtures');
  });

  it('parses the 4-2 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-2/media/4-2-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '4-2-intro-video.mp4',
      '4-2-audio.m4a',
      '4-2-slides.pdf',
      '4-2-course.mp4',
    ]);
  });

  it('keeps handout summary outside mediaResources when parsing 4-2 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-2/media/4-2-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
  });
});
