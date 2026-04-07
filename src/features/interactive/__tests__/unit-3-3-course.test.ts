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

describe('unit 3-3 interactive course', () => {
  it('registers the 3-3 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-3-root-locus-rules-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('根轨迹机制');
  });

  it('defines the full 13-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-3-course');

    expect(courseModule.UNIT_3_3_LESSON_STEPS).toHaveLength(13);
    expect(courseModule.UNIT_3_3_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_3_LESSON_STEPS[12]?.id).toBe('step-13');
  });

  it('exposes AI quick questions for the formula ordering step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-3-root-locus-rules-v1', 'step-10');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('等效开环');
  });

  it('maps runtime media using the real 3-3 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-3-course');

    expect(courseModule.getUNIT_3_3MediaSrc('step-02')).toContain('3-3-pp-04-complete-rules-example');
    expect(courseModule.getUNIT_3_3MediaSrc('step-06')).toContain('3-3-pp-03-angle-and-magnitude-geometry');
    expect(courseModule.getUNIT_3_3MediaSrc('step-11')).toContain('3-3-pp-07-generalized-time-constant-example');
    expect(courseModule.getUNIT_3_3MediaSrc('step-12')).toContain('3-3-pp-08-dynamics-translation');
    expect(courseModule.getUNIT_3_3MediaSrc('step-13')).toContain('3-3-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-3/design/interactive-contract.yaml'),
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

    const courseModule = await import('@/lib/unit-3-3-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_3_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = ['step-06', 'step-07', 'step-09', 'step-10', 'step-12', 'step-13'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_3_PAGE_CONTRACTS[stepId];

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
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-3-root-locus-rules')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移'),
    ).toEqual({
      routeSegment: 'unit-3-3-root-locus-rules',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="3-3 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
  });

  it('parses the 3-3 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-3/media/3-3-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-3-intro-video.mp4',
      '3-3-audio.m4a',
      '3-3-slides.pdf',
      '3-3-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('物流舱随着旋钮 K 调大沿规律轨道迁移');
  });

  it('keeps handout summary outside mediaResources when parsing 3-3 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-3/media/3-3-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('根轨迹分析法');
    expect(parsed.handoutSummary).toContain('广义根轨迹');
  });

  it('keeps the classroom panels focused on root locus content instead of 3-2 residues', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('参数变化下的闭环根集合');
    expect(stepPanelsSource).toContain('先资格、后参数');
    expect(stepPanelsSource).toContain('G(s)H(s)=K/[s(s+1)(s+2)]');
    expect(stepPanelsSource).toContain('0<K<6');
    expect(stepPanelsSource).toContain('0° 根轨迹');
    expect(stepPanelsSource).not.toContain('劳斯');
    expect(stepPanelsSource).not.toContain('稳定区间：`-2 < k < 18`');

    expect(workspaceSource).toContain('RULE_HIGHLIGHT_OPTIONS');
    expect(workspaceSource).toContain('WORKED_EXAMPLE_SECTIONS');
    expect(workspaceSource).toContain('FORMULA_ORDERING_SEQUENCE');
    expect(workspaceSource).toContain('DYNAMIC_MAPPING_OPTIONS');
    expect(workspaceSource).not.toContain('BOUNDARY_MATCH_OPTIONS');
    expect(workspaceSource).not.toContain('CASE_BUCKETS');
  });

  it('uses the 3-3 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-3-root-locus-rules/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit33StepAIContext');
    expect(studentPageSource).not.toContain('getUnit32StepAIContext');
  });
});
