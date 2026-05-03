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

describe('unit 3-4 interactive course', () => {
  it('registers the 3-4 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-4-root-locus-reading-validation-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('根轨迹读图与对象化验证');
  });

  it('defines the revised 16-step lesson flow after deleting the meaningless old step-14', async () => {
    const courseModule = await import('@/lib/unit-3-4-course');

    expect(courseModule.UNIT_3_4_LESSON_STEPS).toHaveLength(16);
    expect(courseModule.UNIT_3_4_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_4_LESSON_STEPS[12]?.id).toBe('step-13');
    expect(courseModule.UNIT_3_4_LESSON_STEPS[13]?.id).toBe('step-14');
    expect(courseModule.UNIT_3_4_LESSON_STEPS[14]?.id).toBe('step-15');
    expect(courseModule.UNIT_3_4_LESSON_STEPS[15]?.id).toBe('step-16');
    expect(courseModule.UNIT_3_4_LESSON_STEPS.find((step) => step.id === 'step-13')?.pageType).toBe(
      'worked_example_workspace',
    );
    expect(courseModule.UNIT_3_4_LESSON_STEPS.find((step) => step.id === 'step-14')?.pageType).toBe('activity_cards');
    expect(courseModule.UNIT_3_4_LESSON_STEPS.find((step) => step.id === 'step-15')?.pageType).toBe('quiz_group');
    expect(courseModule.UNIT_3_4_LESSON_STEPS.find((step) => step.id === 'step-16')?.pageType).toBe('summary');
    expect(courseModule.UNIT_3_4_LESSON_STEPS.some((step) => step.id === 'step-17')).toBe(false);
  });

  it('exposes AI quick questions for the generalized parameter-window step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-4-root-locus-reading-validation-v1', 'step-14');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('非增益参数');
  });

  it('maps runtime media to the revised step responsibilities instead of the removed legacy figures', async () => {
    const courseModule = await import('@/lib/unit-3-4-course');

    expect(courseModule.getUNIT_3_4MediaSrc('step-03')).toBeNull();
    expect(courseModule.getUNIT_3_4MediaSrc('step-05')).toBeNull();
    expect(courseModule.getUNIT_3_4MediaSrc('step-08')).toBeNull();
    expect(courseModule.getUNIT_3_4MediaSrc('step-10')).toContain('3-4-step-compare.png');
    expect(courseModule.getUNIT_3_4MediaSrc('step-11')).toContain('3-4-bode-compare.png');
    expect(courseModule.getUNIT_3_4MediaSrc('step-12')).toBeNull();
    expect(courseModule.getUNIT_3_4MediaSrc('step-13')).toContain('3-4-local-feedback-block.png');
    expect(courseModule.getUNIT_3_4MediaSrc('step-14')).toContain('3-4-generalized-root-locus.png');
    expect(courseModule.getUNIT_3_4MediaSrc('step-16')).toContain('3-4-info.png');
    expect(courseModule.getUNIT_3_4MediaSrc('step-17')).toBeNull();
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all revised 16 steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-4/design/3-4-interactive-contract.yaml'),
        'utf8',
      ),
    ) as {
      steps: Record<
        string,
        {
          title: string;
          layout: { template: string; regions: Array<{ id: string; width: string; order: number }> };
          interaction_spec: { interaction_kind: string };
          teacher_controls: {
            release_activity: string;
            open_browse: string;
            teacher_step_reveal: string;
            reveal_reference_answer: string;
          };
          teacher_insight_spec: { widgets: string[] };
          telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
          preview_contract: { demo_path: string };
        }
      >;
    };

    const courseModule = await import('@/lib/unit-3-4-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_4_LESSON_STEPS.map((step) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    expect(expectedStepIds).toHaveLength(16);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_4_PAGE_CONTRACTS[stepId];
      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? stepId === 'step-16'
            ? 'summary'
            : 'display'
          : authoringStep.interaction_spec.interaction_kind;

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(expectedPageType);
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.teacherControls.releaseActivity).toBe(authoringStep.teacher_controls.release_activity);
      expect(localPageContract?.teacherControls.openBrowse).toBe(authoringStep.teacher_controls.open_browse);
      expect(localPageContract?.teacherControls.teacherStepReveal).toBe(authoringStep.teacher_controls.teacher_step_reveal);
      expect(localPageContract?.teacherControls.revealReferenceAnswer).toBe(authoringStep.teacher_controls.reveal_reference_answer);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
    }
  });

  it('keeps the step-05 target questions and tolerance-based validation explicit in workspace helpers', async () => {
    const workspaceModule = await import(
      '@/features/interactive/unit-3-4-root-locus-reading-validation/workspace'
    );

    expect(workspaceModule.STEP05_TARGET_QUESTIONS.map((item) => item.key)).toEqual([
      'breakaway',
      'imaginary_boundary',
      'reference_B',
    ]);
    expect(workspaceModule.STEP05_TARGET_QUESTIONS[0]?.maxDistance).toBeCloseTo(0.03, 6);
    expect(workspaceModule.STEP05_TARGET_QUESTIONS[1]?.acceptMirror).toBe(true);
    expect(
      workspaceModule.isStep05TargetSatisfied(
        { re: 0.001, im: -0.46 },
        workspaceModule.STEP05_TARGET_QUESTIONS[1],
      ),
    ).toBe(true);
    expect(
      workspaceModule.isStep05TargetSatisfied(
        { re: -0.2, im: 0.2 },
        workspaceModule.STEP05_TARGET_QUESTIONS[2],
      ),
    ).toBe(false);
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-4-root-locus-reading-validation')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上'),
    ).toEqual({
      routeSegment: 'unit-3-4-root-locus-reading-validation',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('PremiumLessonEntryPage');
    expect(entrySource).toContain('<PremiumLessonEntryPage');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });

  it('parses the 3-4 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-4/media/3-4-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-4-intro-video.mp4',
      '3-4-audio.m4a',
      '3-4-slides.pdf',
      '3-4-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('根轨迹主图和候选窗口');
  });

  it('keeps handout summary outside mediaResources when parsing 3-4 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-4/media/3-4-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('船舶航向控制系统');
    expect(parsed.handoutSummary).toContain('三域对照');
  });

  it('keeps the classroom panels focused on the revised 16-step evidence chain without regressing to old images or old reveal controls', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('useControlEngine');
    expect(stepPanelsSource).toContain('RootLocusPanel');
    expect(stepPanelsSource).toContain('buildUnit34Step05AnalysisRequest');
    expect(stepPanelsSource).toContain('STEP05_TARGET_QUESTIONS');
    expect(stepPanelsSource).toContain('findNearestSample');
    expect(stepPanelsSource).toContain('isStep05TargetSatisfied');
    expect(stepPanelsSource).toContain('3-4-bode-compare.png');
    expect(stepPanelsSource).toContain('3-4-turning-track-k06064.png');
    expect(stepPanelsSource).toContain('3-4-turning-track-k20.png');
    expect(stepPanelsSource).toContain('3-4-generalized-root-locus.png');
    expect(stepPanelsSource).toContain('3-4-info.png');
    expect(stepPanelsSource).toContain('data-progressive-reveal="step_click_reveal"');
    expect(stepPanelsSource).toContain('点击当前最下方已显影步骤可继续展开下一层');
    expect(stepPanelsSource).toContain('重置步骤');
    expect(stepPanelsSource).toContain('题面固定显示');
    expect(stepPanelsSource).toContain("case 'step-05':");
    expect(stepPanelsSource).toContain("case 'step-06':");
    expect(stepPanelsSource).toContain("case 'step-13':");
    expect(stepPanelsSource).not.toContain('显示下一步');
    expect(stepPanelsSource).not.toContain('3-4-root-locus-summary.png');
    expect(stepPanelsSource).not.toContain('3-4-gain-conversion-card.png');
    expect(stepPanelsSource).not.toContain('3-4-dominant-pole-selection.png');
    expect(stepPanelsSource).not.toContain('3-4-generalized-root-locus-debug.png');
    expect(stepPanelsSource).not.toContain('页内 AI 助手');

    expect(workspaceSource).toContain('STEP05_TARGET_QUESTIONS');
    expect(workspaceSource).toContain('STEP05_AXIS_PRESET');
    expect(workspaceSource).toContain('STEP05_DEFAULT_POINT');
    expect(workspaceSource).toContain('ACTIVITY_CARD_FIELDS');
    expect(workspaceSource).toContain('WORKED_EXAMPLE_FIELDS');
    expect(workspaceSource).toContain('POST_QUIZ_QUESTIONS');
    expect(workspaceSource).not.toContain('HOTSPOT_LABEL_FIELDS');
  });

  it('keeps release and browse controls aligned with teacher_toggle/page_load_open semantics and retains teacher reveal progress sync', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx'),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page.tsx'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain("pageContract.teacherControls.releaseActivity === 'page_load_open'");
    expect(studentPageSource).toContain("pageContract.teacherControls.openBrowse === 'page_load_open'");
    expect(studentPageSource).toContain("pageContract.teacherControls.revealReferenceAnswer === 'teacher_toggle'");
    expect(studentPageSource).toContain("pageContract.teacherControls.teacherStepReveal === 'teacher_toggle'");
    expect(teacherPageSource).toContain("pageContract.teacherControls.openBrowse === 'page_load_open'");
    expect(teacherPageSource).toContain('teacherRevealProgress[step.id] ?? 0');
    expect(stepPanelsSource).toContain("pageContract.teacherControls.releaseActivity === 'teacher_toggle'");
    expect(stepPanelsSource).toContain("pageContract.teacherControls.openBrowse === 'teacher_toggle'");
    expect(stepPanelsSource).toContain('教师尚未开放浏览，请先阅读已显示的静态内容。');
  });

  it('does not hardcode full reveal progress in demo mode for progressive-reveal steps', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).not.toMatch(/isDemo\s*\?\s*99/);
  });

  it('keeps step-13 formulas free of doubled backslashes in source strings', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('formula="G_1(s)=\\\\dfrac{3.43}{s+2.14375}"');
    expect(stepPanelsSource).not.toContain('formula="G_{1,\\\\mathrm{eq}}(s)=\\\\dfrac{3.43}{s+2.14375+3.43a}"');
  });

  it('renders step-13 reveal content as structured items with formula-capable blocks instead of plain text strings only', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toMatch(/case 'step-13':[\s\S]*?steps:\s*\[[\s\S]*?formula:/);
  });

  it('uses hidden page AI context inside the student page and removes explicit page AI assistants from both views', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx'),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit34StepAIContext');
    expect(studentPageSource).toContain('updatePageContext({');
    expect(studentPageSource).not.toContain('getUnit33StepAIContext');
    expect(studentPageSource).not.toContain('UNIT_3_4StepAiAssistant');
    expect(teacherPageSource).not.toContain('UNIT_3_4StepAiAssistant');
  });
});
