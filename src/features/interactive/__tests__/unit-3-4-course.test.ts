import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
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

  it('defines the full 14-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-4-course');

    expect(courseModule.UNIT_3_4_LESSON_STEPS).toHaveLength(17);
    expect(courseModule.UNIT_3_4_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_4_LESSON_STEPS[16]?.id).toBe('step-17');
  });

  it('exposes AI quick questions for the generalized root locus comparison step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-4-root-locus-reading-validation-v1', 'step-15');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('非增益参数');
  });

  it('maps runtime media using the real 3-4 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-4-course');

    expect(courseModule.getUNIT_3_4MediaSrc('step-03')).toContain('3-4-cover-comic');
    expect(courseModule.getUNIT_3_4MediaSrc('step-05')).toContain('3-4-root-locus-summary');
    expect(courseModule.getUNIT_3_4MediaSrc('step-08')).toContain('3-4-gain-conversion-card');
    expect(courseModule.getUNIT_3_4MediaSrc('step-10')).toContain('3-4-step-compare');
    expect(courseModule.getUNIT_3_4MediaSrc('step-11')).toContain('3-4-bode-compare');
    expect(courseModule.getUNIT_3_4MediaSrc('step-12')).toContain('3-4-turning-track-k20');
    expect(courseModule.getUNIT_3_4MediaSrc('step-13')).toContain('3-4-local-feedback-block');
    expect(courseModule.getUNIT_3_4MediaSrc('step-15')).toContain('3-4-generalized-root-locus');
    expect(courseModule.getUNIT_3_4MediaSrc('step-17')).toContain('3-4-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-4/design/interactive-contract.yaml'),
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
    const interactiveSteps = new Map(courseModule.UNIT_3_4_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = [
      'step-01',
      'step-03',
      'step-04',
      'step-05',
      'step-06',
      'step-07',
      'step-08',
      'step-09',
      'step-10',
      'step-11',
      'step-12',
      'step-13',
      'step-14',
      'step-15',
      'step-16',
      'step-17',
    ] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_4_PAGE_CONTRACTS[stepId];
      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? stepId === 'step-17'
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

    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="3-4 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
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

  it('keeps the classroom panels focused on reading, three-domain validation, and generalized root locus without page-level AI shells', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('稳定窗口不等于可接受窗口');
    expect(stepPanelsSource).toContain('k = 0.01715K');
    expect(stepPanelsSource).toContain('为什么必须三域互证');
    expect(stepPanelsSource).toContain('为什么不是“再调一次 K”');
    expect(stepPanelsSource).toContain('广义根轨迹');
    expect(stepPanelsSource).toContain('显示下一步');
    expect(stepPanelsSource).toContain('重置步骤');
    expect(stepPanelsSource).not.toContain('本页无需提交');
    expect(stepPanelsSource).not.toContain('页内 AI 助手');
    expect(stepPanelsSource).not.toContain('劳斯判据');

    expect(workspaceSource).toContain('READING_SEQUENCE_OPTIONS');
    expect(workspaceSource).toContain('HOTSPOT_LABEL_FIELDS');
    expect(workspaceSource).toContain('ACTIVITY_CARD_FIELDS');
    expect(workspaceSource).toContain('TRIPLE_MATCH_FIELDS');
    expect(workspaceSource).toContain('WORKED_EXAMPLE_FIELDS');
    expect(workspaceSource).toContain('POST_QUIZ_QUESTIONS');
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
