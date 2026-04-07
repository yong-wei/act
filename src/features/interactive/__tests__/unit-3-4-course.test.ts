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

describe('unit 3-4 interactive course', () => {
  it('registers the 3-4 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-4-root-locus-reading-validation-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('根轨迹读图与对象化验证');
  });

  it('defines the full 14-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-4-course');

    expect(courseModule.UNIT_3_4_LESSON_STEPS).toHaveLength(14);
    expect(courseModule.UNIT_3_4_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_4_LESSON_STEPS[13]?.id).toBe('step-14');
  });

  it('exposes AI quick questions for the conversion review step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-4-root-locus-reading-validation-v1', 'step-10');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('换算链');
  });

  it('maps runtime media using the real 3-4 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-4-course');

    expect(courseModule.getUNIT_3_4MediaSrc('step-02')).toContain('3-4-cover-comic');
    expect(courseModule.getUNIT_3_4MediaSrc('step-07')).toContain('3-4-root-locus-keynodes');
    expect(courseModule.getUNIT_3_4MediaSrc('step-08')).toContain('3-4-conditional-stability-window');
    expect(courseModule.getUNIT_3_4MediaSrc('step-09')).toContain('3-4-gain-conversion-card');
    expect(courseModule.getUNIT_3_4MediaSrc('step-11')).toContain('3-4-step-compare');
    expect(courseModule.getUNIT_3_4MediaSrc('step-12')).toContain('3-4-bode-compare');
    expect(courseModule.getUNIT_3_4MediaSrc('step-14')).toContain('3-4-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = JSON.parse(
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
          teacher_insight_spec: { widgets: string[] };
          telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
          preview_contract: { demo_path: string };
        }
      >;
    };

    const courseModule = await import('@/lib/unit-3-4-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_4_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = ['step-05', 'step-06', 'step-07', 'step-08', 'step-09', 'step-10', 'step-12', 'step-14'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_4_PAGE_CONTRACTS[stepId];

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

  it('keeps the classroom panels focused on reading, windows, conversion and three-domain validation', () => {
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
    expect(stepPanelsSource).toContain('A 保守但慢');
    expect(stepPanelsSource).toContain('哪个版本的风险在频域里最先暴露');
    expect(stepPanelsSource).not.toContain('劳斯判据');
    expect(stepPanelsSource).not.toContain('广义根轨迹');

    expect(workspaceSource).toContain('READING_SEQUENCE_OPTIONS');
    expect(workspaceSource).toContain('VERSION_PREDICTION_FIELDS');
    expect(workspaceSource).toContain('KEYNODE_OPTIONS');
    expect(workspaceSource).toContain('WINDOW_TAG_OPTIONS');
    expect(workspaceSource).toContain('GAIN_CONVERSION_FIELDS');
    expect(workspaceSource).toContain('FINAL_RANKING_OPTIONS');
    expect(workspaceSource).not.toContain('BOUNDARY_MATCH_OPTIONS');
    expect(workspaceSource).not.toContain('FORMULA_ORDERING_SEQUENCE');
  });

  it('uses the 3-4 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit34StepAIContext');
    expect(studentPageSource).not.toContain('getUnit33StepAIContext');
  });
});
