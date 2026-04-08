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

describe('unit 3-7 interactive course', () => {
  it('registers the 3-7 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-7-steady-error-low-frequency-compensation-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('型别、积分环节与稳态改善');
  });

  it('defines the full 12-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-7-course');

    expect(courseModule.UNIT_3_7_LESSON_STEPS).toHaveLength(12);
    expect(courseModule.UNIT_3_7_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_7_LESSON_STEPS[11]?.id).toBe('step-12');
  });

  it('exposes AI quick questions for the low-frequency compensation compare step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-7-steady-error-low-frequency-compensation-v1', 'step-10');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('PI');
  });

  it('maps runtime media using the real 3-7 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-7-course');

    expect(courseModule.getUNIT_3_7MediaSrc('step-01')).toContain('3-7-cover-comic');
    expect(courseModule.getUNIT_3_7MediaSrc('step-04')).toContain('3-7-error-dual-channel');
    expect(courseModule.getUNIT_3_7MediaSrc('step-07')).toContain('3-7-example2-structure');
    expect(courseModule.getUNIT_3_7MediaSrc('step-09')).toContain('3-7-low-frequency-compensators');
    expect(courseModule.getUNIT_3_7MediaSrc('step-10')).toContain('3-7-pi-time-domain-design');
    expect(courseModule.getUNIT_3_7MediaSrc('step-11')).toContain('3-7-pi-frequency-design');
    expect(courseModule.getUNIT_3_7MediaSrc('step-12')).toContain('3-7-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-7/design/interactive-contract.yaml'), 'utf8'),
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

    const courseModule = await import('@/lib/unit-3-7-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_7_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = ['step-03', 'step-04', 'step-05', 'step-06', 'step-08', 'step-09', 'step-10', 'step-11', 'step-12'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_7_PAGE_CONTRACTS[stepId];

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
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-7-steady-error-low-frequency-compensation')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理'),
    ).toEqual({
      routeSegment: 'unit-3-7-steady-error-low-frequency-compensation',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="3-7 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
  });

  it('parses the 3-7 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-7/media/3-7-media.md'), 'utf8');
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-7-intro-video.mp4',
      '3-7-audio.m4a',
      '3-7-slides.pdf',
      '3-7-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('稳态误差为什么能减小');
  });

  it('keeps handout summary outside mediaResources when parsing 3-7 runtime media document', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-7/media/3-7-media.md'), 'utf8');
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('稳态误差分析');
    expect(parsed.handoutSummary).toContain('PI控制');
  });

  it('keeps the classroom panels focused on dual-channel error and low-frequency compensation', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('分母相同反映结构');
    expect(stepPanelsSource).toContain('e_ss = 0.4');
    expect(stepPanelsSource).toContain('PI 与滞后都站在低频补偿线上');
    expect(stepPanelsSource).toContain('为什么 PI 更准、PD 更快');
    expect(stepPanelsSource).not.toContain('劳斯判据');
    expect(stepPanelsSource).not.toContain('根轨迹增益');

    expect(workspaceSource).toContain('HOTSPOT_FIELDS');
    expect(workspaceSource).toContain('WORKED_EXAMPLE_FIELDS');
    expect(workspaceSource).toContain('TRIPLE_MATCH_FIELDS');
    expect(workspaceSource).toContain('CARD_SORT_ITEMS');
    expect(workspaceSource).toContain('STRUCTURED_COMPARE_FIELDS');
  });

  it('uses the 3-7 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit37StepAIContext');
    expect(studentPageSource).not.toContain('getUnit36StepAIContext');
  });
});
