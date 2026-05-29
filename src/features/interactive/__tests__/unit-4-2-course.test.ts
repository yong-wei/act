import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

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

  it('defines the full 20-step lesson flow from the refreshed interactive design', async () => {
    const courseModule = await import('@/lib/unit-4-2-course');

    expect(courseModule.UNIT_4_2_LESSON_STEPS).toHaveLength(20);
    expect(courseModule.UNIT_4_2_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[19]?.id).toBe('step-20');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[2]?.pageType).toBe('quiz_group');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[5]?.pageType).toBe('drag_match');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[6]?.pageType).toBe('step_reveal');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[10]?.pageType).toBe('interactive_figure_submit');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[13]?.pageType).toBe('interactive_figure_submit');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[17]?.pageType).toBe('task_card_workspace');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[18]?.pageType).toBe('quiz_group');
    expect(courseModule.UNIT_4_2_LESSON_STEPS[19]?.pageType).toBe('display');
  });

  it('exposes AI quick questions for the simplified start-card workspace step', () => {
    const quickQuestions = getStepQuickQuestions('unit-4-2-controller-selection-first-start-v1', 'step-18');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('起步卡');
  });

  it('maps runtime media only for remaining static-media steps and keeps native case panels off the legacy 4-1 png path', async () => {
    const courseModule = await import('@/lib/unit-4-2-course');

    expect(courseModule.getUNIT_4_2MediaSrc('step-01')).toContain('4-2-cover-comic.png');
    expect(courseModule.getUNIT_4_2MediaSrc('step-11')).toBeNull();
    expect(courseModule.getUNIT_4_2MediaSrc('step-17')).toBeNull();
    expect(courseModule.getUNIT_4_2MediaSrc('step-09')).toBeNull();
    expect(courseModule.getUNIT_4_2MediaSrc('step-10')).toBeNull();
    expect(courseModule.getUNIT_4_2MediaSrc('step-20')).toContain('4-2-info.png');
  });

  it('keeps the runtime page contracts aligned with the authoring interactive contract for all 20 steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-2/design/4-2-interactive-contract.yaml'),
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
    const runtimeManifest = normalizeInteractiveRuntimeManifest(JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
        'utf8',
      ),
    ));
    const interactiveSteps = new Map(courseModule.UNIT_4_2_LESSON_STEPS.map((step) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    expect(runtimeManifest).not.toBeNull();
    expect(expectedStepIds).toHaveLength(20);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.getUNIT_4_2PageContractFromManifest(runtimeManifest, stepId);

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
        interaction_spec?: { activity_cards?: unknown[]; submit_fields?: string[] };
      }>;
    };

    const stepEntries = Object.entries(manifest.steps);

    expect(stepEntries).toHaveLength(20);
    expect(stepEntries.every(([, step]) => (step.modules ?? []).length > 0)).toBe(true);
    expect(
      stepEntries.flatMap(([, step]) => step.modules ?? []).filter((module) => module.must_be_visible).length,
    ).toBeGreaterThanOrEqual(53);
    expect(manifest.steps['step-03']?.interaction_spec?.activity_cards).toHaveLength(3);
    expect(manifest.steps['step-11']?.interaction_spec?.submit_fields).toEqual([
      'Ti',
      'Kp',
      'Ki',
      'time_observation',
      'frequency_review',
    ]);
    expect(manifest.steps['step-19']?.interaction_spec?.activity_cards).toHaveLength(3);
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
    expect(manifestText).toContain('/course-runtime/lessons/4-2/media/4-2-controller-frequency-characteristics.png');
    expect(manifestText).toContain('/course-runtime/lessons/4-2/media/4-2-controller-selection-decision-tree.png');
    expect(manifestText).toContain('/course-runtime/lessons/4-2/media/4-2-ship-controller-candidates-bode.png');
    expect(stepPanelsSource).toContain('ControlFigureWorkspace');
    expect(stepPanelsSource).toContain('Unit42ExampleTuningPanel');
    expect(stepPanelsSource).toContain('Unit42ShipCandidateComparePanel');
    expect(manifestText).toContain('典型控制结构的频域特性矩阵');
    expect(manifestText).toContain('控制器结构选型决策树');
    expect(manifestText).toContain('当前任务');
    expect(manifestText).toContain('主要代价');
    expect(manifestText).toContain('四类复核证据');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).not.toContain('本页无需提交');
  });

  it('keeps the start-card workspace to the eight refreshed design fields', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
        'utf8',
      ),
    ) as { steps: Record<string, { interaction_spec?: { activity_cards?: Array<{ title?: string; prompt?: string }> } }> };
    const fields = manifest.steps['step-18']?.interaction_spec?.activity_cards?.map((card) => card.title ?? card.prompt) ?? [];

    expect(fields).toEqual(['当前任务', '最紧矛盾', '首选单结构', '整定入口', '关键参数', '预期收益', '主要代价', '四类复核证据']);
    expect(fields).not.toContain('留给 4-3 的问题');
  });

  it('renders full mathematical expressions for the controller toolbox and tuning methods', () => {
    const manifestText = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
      'utf8',
    );

    expect(manifestText).toContain('L(s)=C(s)G(s)');
    expect(manifestText).toContain('1+C(s)G(s)=0');
    expect(manifestText).toContain('omega_z=omega_c/3 sim omega_c/10');
    expect(manifestText).toContain('beta=e_ss/e_ss^star');
    expect(manifestText).toContain('alpha=(1-sin phi_max)/(1+sin phi_max)');
    expect(manifestText).toContain('K_c=sqrt(alpha)/|G(j omega_c)|');
    expect(manifestText).toContain('F_d(s)=-G_d(s)/G(s)');
  });

  it('keeps frequency-domain evidence and worked examples complete instead of collapsing them into one-line comparisons', () => {
    const manifestText = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
      'utf8',
    );
    const interactivePageSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/4-2/design/4-2-interactive-page.md'),
      'utf8',
    );

    expect(interactivePageSource).toContain('频域图 + 原生工具箱表 + 多选矩阵');
    expect(interactivePageSource).toContain('例题 5.1');
    expect(interactivePageSource).toContain('例题 5.4');
    expect(interactivePageSource).toContain('控件放在图形下方');

    expect(manifestText).toContain('G_1(s)=1/(s+1)');
    expect(manifestText).toContain('K_p=1/(0.707*1.031)=1.372');
    expect(manifestText).toContain('C_lead(s)=1.95(1.025s+1)/(0.244s+1)');
    expect(manifestText).toContain('C_lag(s)=2.5(10s+1)/(25s+1)');
    expect(manifestText).toContain('C_PID(s)=2.4(s+1)^2/s');
    expect(manifestText).toContain('unit42_example_pid_zn');
  });

  it('keeps worked-example figure panels and reveal behavior aligned with the refreshed design', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/4-2/interactive-manifest.json'),
        'utf8',
      ),
    ) as { steps: Record<string, { modules?: Array<{ id: string; kind: string; payload?: { legacyKind?: string; panel_id?: string } }> }> };
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-2-controller-selection-first-start/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('const allowInlineReveal = isDemo || browseEnabled');
    expect(studentPageSource).toContain('allowInlineReveal={allowInlineReveal}');
    expect(studentPageSource).not.toContain('allowInlineReveal={isDemo || browseEnabled}');

    expect(manifest.steps['step-11']?.modules?.map((module) => [module.kind, module.payload?.legacyKind])).toEqual([
      ['content.cardSet', 'worked-example-card'],
      ['compute.panel', 'interactive-figure-panel'],
      ['activity.panel', 'activity-card-set'],
    ]);
    expect(manifest.steps['step-14']?.modules?.map((module) => [module.kind, module.payload?.legacyKind])).toEqual([
      ['content.cardSet', 'worked-example-card'],
      ['content.figure', 'image-panel'],
      ['compute.panel', 'interactive-figure-panel'],
      ['activity.panel', 'activity-card-set'],
    ]);
    expect(manifest.steps['step-17']?.modules?.map((module) => [module.kind, module.payload?.legacyKind])).toEqual([
      ['content.figure', 'image-panel'],
      ['content.figure', 'image-panel'],
      ['content.figure', 'image-panel'],
      ['content.table', 'table-card'],
      ['compute.panel', 'interactive-figure-panel'],
    ]);
    expect(manifest.steps['step-11']?.modules?.some((module) => module.payload?.panel_id === 'unit42_example_pi')).toBe(true);
    expect(manifest.steps['step-12']?.modules?.some((module) => module.payload?.panel_id === 'unit42_example_lead')).toBe(true);
    expect(manifest.steps['step-13']?.modules?.some((module) => module.payload?.panel_id === 'unit42_example_lag')).toBe(true);
    expect(manifest.steps['step-14']?.modules?.some((module) => module.payload?.panel_id === 'unit42_example_pid_zn')).toBe(true);
    expect(manifest.steps['step-17']?.modules?.some((module) => module.payload?.panel_id === 'unit42_ship_candidate_compare')).toBe(true);
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
