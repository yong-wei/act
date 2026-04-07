import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

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

describe('unit 3-2 interactive course', () => {
  it('registers the 3-2 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-2-routh-stability-boundary-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('劳斯判据');
  });

  it('defines the full 14-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-2-course');

    expect(courseModule.UNIT_3_2_LESSON_STEPS).toHaveLength(14);
    expect(courseModule.UNIT_3_2_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_2_LESSON_STEPS[13]?.id).toBe('step-14');
  });

  it('exposes AI quick questions for the interval workspace step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-2-routh-stability-boundary-v1', 'step-06');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('条件链');
  });

  it('maps runtime media using the real 3-2 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-2-course');

    expect(courseModule.getUNIT_3_2MediaSrc('step-02')).toContain('3-2-pole-migration');
    expect(courseModule.getUNIT_3_2MediaSrc('step-08')).toContain('3-2-special-cases-card');
    expect(courseModule.getUNIT_3_2MediaSrc('step-10')).toContain('3-2-step-comparison');
    expect(courseModule.getUNIT_3_2MediaSrc('step-11')).toContain('3-2-bode-magnitude');
    expect(courseModule.getUNIT_3_2MediaSrc('step-12')).toContain('3-2-parameter-range-flow');
    expect(courseModule.getUNIT_3_2MediaSrc('step-14')).toContain('3-2-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-2/design/interactive-contract.yaml'),
        'utf8',
      ),
    ) as {
      steps: Record<
        string,
        {
          title: string;
          layout: { template: string; regions: Array<{ id: string; width: string; order: number }> };
          interaction_spec: { interaction_kind: string };
          teacher_insight_spec: { widgets: string[] };
          telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
          preview_contract: { demo_path: string };
        }
      >;
    };

    const courseModule = await import('@/lib/unit-3-2-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_2_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = ['step-06', 'step-08', 'step-09', 'step-11', 'step-12', 'step-13'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_2_PAGE_CONTRACTS[stepId];

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

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-2-routh-stability-boundary')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-2：劳斯判据——从高阶系统稳定判定到参数可行域'),
    ).toEqual({
      routeSegment: 'unit-3-2-routh-stability-boundary',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-2-routh-stability-boundary/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="3-2 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
  });

  it('parses the 3-2 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-2/media/3-2-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-2-intro-video.mp4',
      '3-2-audio.m4a',
      '3-2-slides.pdf',
      '3-2-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      status: 'pending',
    });
    expect(resources[0]?.title).toContain('不必先求出全部根也能提前看见稳定边界');
  });

  it('keeps handout summary outside mediaResources when parsing 3-2 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-2/media/3-2-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('劳斯（Routh）判据');
    expect(parsed.handoutSummary).toContain('参数范围');
  });
});
