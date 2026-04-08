import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

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

  it('defines the full 12-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-8-course');

    expect(courseModule.UNIT_3_8_LESSON_STEPS).toHaveLength(12);
    expect(courseModule.UNIT_3_8_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_8_LESSON_STEPS[11]?.id).toBe('step-12');
  });

  it('exposes AI quick questions for the three-band compare workspace', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-8-frequency-domain-translation-judgment-v1', 'step-09');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('尽快跟踪');
  });

  it('maps runtime media using the real 3-8 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-8-course');

    expect(courseModule.getUNIT_3_8MediaSrc('step-01')).toContain('3-8-cover-comic');
    expect(courseModule.getUNIT_3_8MediaSrc('step-02')).toContain('3-8-gain-effect');
    expect(courseModule.getUNIT_3_8MediaSrc('step-05')).toContain('3-8-zero-effect');
    expect(courseModule.getUNIT_3_8MediaSrc('step-06')).toContain('3-8-nyquist-example-check');
    expect(courseModule.getUNIT_3_8MediaSrc('step-07')).toContain('3-8-nyquist-quickcheck');
    expect(courseModule.getUNIT_3_8MediaSrc('step-08')).toContain('3-8-bode-example');
    expect(courseModule.getUNIT_3_8MediaSrc('step-09')).toContain('3-8-three-band-overview');
    expect(courseModule.getUNIT_3_8MediaSrc('step-10')).toContain('3-8-heading-case');
    expect(courseModule.getUNIT_3_8MediaSrc('step-11')).toContain('3-8-platform-case');
    expect(courseModule.getUNIT_3_8MediaSrc('step-12')).toContain('3-8-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-8/design/interactive-contract.yaml'), 'utf8'),
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

    const courseModule = await import('@/lib/unit-3-8-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_8_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = [
      'step-02',
      'step-04',
      'step-05',
      'step-06',
      'step-07',
      'step-08',
      'step-09',
      'step-10',
      'step-11',
      'step-12',
    ] as const;

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

    expect(stepPanelsSource).toContain('Bode 判稳不是另一套规则');
    expect(stepPanelsSource).toContain('Nyquist 与 Bode 描述同一临界边界');
    expect(stepPanelsSource).toContain('真正有效的动作是中频定向补角');
    expect(stepPanelsSource).not.toContain('PI 与滞后都站在低频补偿线上');
    expect(stepPanelsSource).not.toContain('劳斯判据');

    expect(workspaceSource).toContain('HOTSPOT_FIELDS');
    expect(workspaceSource).toContain('TRIPLE_MATCH_FIELDS');
    expect(workspaceSource).toContain('CARD_SORT_ITEMS');
    expect(workspaceSource).toContain('AI_COMPARE_FIELDS');
    expect(workspaceSource).toContain('STRUCTURED_COMPARE_FIELDS');
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
