import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 3-8 interactive course', () => {
  it('registers the 3-8 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-8-frequency-domain-translation-judgment-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('频域判别与跨域综合语言');
  });

  it('defines the full 20-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-8-course');

    expect(courseModule.UNIT_3_8_LESSON_STEPS).toHaveLength(20);
    expect(courseModule.UNIT_3_8_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_8_LESSON_STEPS[19]?.id).toBe('step-20');
    expect(courseModule.UNIT_3_8_LESSON_STEPS[4]?.pageType).toBe('curve_compare_panel');
    expect(courseModule.UNIT_3_8_LESSON_STEPS[13]?.pageType).toBe('goal_cards_plus_ai');
    expect(courseModule.UNIT_3_8_LESSON_STEPS[19]?.pageType).toBe('reflection_card');
  });

  it('exposes AI quick questions for the goal-switch page and keeps only that page as visible AI step', async () => {
    const quickQuestions = getStepQuickQuestions('unit-3-8-frequency-domain-translation-judgment-v1', 'step-14');
    const courseModule = await import('@/lib/unit-3-8-course');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('目标');
    expect(courseModule.isUNIT_3_8AiPageType('goal_cards_plus_ai')).toBe(true);
    expect(courseModule.isUNIT_3_8AiPageType('curve_compare_panel')).toBe(false);
    expect(courseModule.isUNIT_3_8AiPageType('structured_compare')).toBe(false);
  });

  it('maps runtime media to the actual 3-8 design steps', async () => {
    const courseModule = await import('@/lib/unit-3-8-course');

    expect(courseModule.getUNIT_3_8MediaSrc('step-01')).toContain('3-8-cover-comic');
    expect(courseModule.getUNIT_3_8MediaSrc('step-05')).toContain('3-8-zero-effect');
    expect(courseModule.getUNIT_3_8MediaSrc('step-09')).toContain('3-8-nyquist-quickcheck');
    expect(courseModule.getUNIT_3_8MediaSrc('step-10')).toContain('3-8-nyquist-example');
    expect(courseModule.getUNIT_3_8MediaSrc('step-11')).toContain('3-8-bode-example');
    expect(courseModule.getUNIT_3_8MediaSrc('step-13')).toContain('3-8-three-band-overview');
    expect(courseModule.getUNIT_3_8MediaSrc('step-15')).toContain('3-8-heading-baseline');
    expect(courseModule.getUNIT_3_8MediaSrc('step-16')).toContain('3-8-heading-case');
    expect(courseModule.getUNIT_3_8MediaSrc('step-17')).toContain('3-8-platform-block-diagram');
    expect(courseModule.getUNIT_3_8MediaSrc('step-18')).toContain('3-8-platform-case');
    expect(courseModule.getUNIT_3_8MediaSrc('step-20')).toContain('3-8-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all 20 steps', async () => {
    const contract = parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-8/design/interactive-contract.yaml'), 'utf8'),
    ) as {
      steps: Record<
        string,
        {
          title: string;
          layout: {
            template: string;
            regions: Array<{ id: string; width: string; order: number }>;
            reading_order?: string[];
          };
          interaction_spec: { interaction_kind: string };
          teacher_insight_spec: { widgets: string[] };
          telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
          ai_context_spec: { delivery_mode?: string };
          preview_contract: { demo_path: string };
        }
      >;
    };

    const courseModule = await import('@/lib/unit-3-8-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_8_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_8_PAGE_CONTRACTS[stepId];

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
    }
  });

  it('stores browse visibility and step reveal progress in the teacher sync payload', async () => {
    const courseModule = await import('@/lib/unit-3-8-course');

    const payload = courseModule.UNIT_3_8_SESSION_ADAPTER.buildTeacherSyncPayload({
      activeStepId: 'step-07',
      revealedAnswers: { 'step-07': false },
      releasedActivities: { 'step-06': true, 'step-07': true },
      browseEnabled: { 'step-07': true },
      teacherRevealProgress: { 'step-07': 2 },
      updatedAt: 123,
    });

    expect(payload).toMatchObject({
      kind: 'teacher_sync_unit38',
      activeStepId: 'step-07',
      releasedActivities: { 'step-06': true, 'step-07': true },
      browseEnabled: { 'step-07': true },
      teacherRevealProgress: { 'step-07': 2 },
      updatedAt: 123,
    });
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-8-frequency-domain-translation-judgment')).toBe(true);

    expect(resolveSessionRouteFromPlanTitle('3-8：频域判别与跨域综合语言')).toEqual({
      routeSegment: 'unit-3-8-frequency-domain-translation-judgment',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="3-8 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
  });

  it('parses the 3-8 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/media/3-8-media.md'), 'utf8');
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-8-intro-video.mp4',
      '3-8-audio.m4a',
      '3-8-slides.pdf',
      '3-8-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('频域不是新章节');
  });

  it('keeps handout summary outside mediaResources when parsing 3-8 runtime media document', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-8/media/3-8-media.md'), 'utf8');
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('Nyquist');
    expect(parsed.handoutSummary).toContain('航向控制系统');
  });

  it('keeps the classroom panels focused on unified frequency-domain judgment', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('为什么“只改增益”会左右为难');
    expect(stepPanelsSource).toContain('目标切换时，先改哪一段频带');
    expect(stepPanelsSource).toContain('把完整判断链独立走一遍');
    expect(stepPanelsSource).not.toContain('PI 与滞后都站在低频补偿线上');
    expect(stepPanelsSource).not.toContain('劳斯判据');

    expect(workspaceSource).toContain('ROW_FOCUS_TOGGLE_ROWS');
    expect(workspaceSource).toContain('CURVE_COMPARE_CONTROLS');
    expect(workspaceSource).toContain('GOAL_SWITCH_FIELDS');
    expect(workspaceSource).toContain('SCHEME_VOTE_OPTIONS');
    expect(workspaceSource).toContain('REFLECTION_PROMPTS');
  });

  it('uses the 3-8 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit38StepAIContext');
    expect(studentPageSource).not.toContain('getUnit37StepAIContext');
  });
});
