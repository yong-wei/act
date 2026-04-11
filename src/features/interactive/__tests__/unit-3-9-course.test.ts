import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const courseFile = join(repoRoot, 'src/lib/unit-3-9-course.ts');
const aiFile = join(repoRoot, 'src/lib/unit-3-9-ai-contexts.ts');
const entryFile = join(
  repoRoot,
  'src/features/interactive/unit-3-9-cross-domain-mapping-lab/entry-page.tsx',
);
const studentFile = join(
  repoRoot,
  'src/features/interactive/unit-3-9-cross-domain-mapping-lab/student-page.tsx',
);
const teacherFile = join(
  repoRoot,
  'src/features/interactive/unit-3-9-cross-domain-mapping-lab/teacher-page.tsx',
);
const stepPanelsFile = join(
  repoRoot,
  'src/features/interactive/unit-3-9-cross-domain-mapping-lab/step-panels.tsx',
);
const workspaceFile = join(
  repoRoot,
  'src/features/interactive/unit-3-9-cross-domain-mapping-lab/workspace.ts',
);

let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 3-9 interactive course', () => {
  it('creates the expected 3-9 course source files first', () => {
    expect(existsSync(courseFile)).toBe(true);
    expect(existsSync(aiFile)).toBe(true);
    expect(existsSync(entryFile)).toBe(true);
    expect(existsSync(studentFile)).toBe(true);
    expect(existsSync(teacherFile)).toBe(true);
    expect(existsSync(stepPanelsFile)).toBe(true);
    expect(existsSync(workspaceFile)).toBe(true);
  });

  it('registers the route, catalog entry, preset and AI registry for 3-9', async () => {
    expect(existsSync(courseFile)).toBe(true);
    if (!existsSync(courseFile)) return;

    const courseModule = await import('@/lib/unit-3-9-course');
    const { FEATURED_LESSONS } = await import('@/features/interactive/learning-catalog');
    const { resolveSessionRouteFromPlanTitle } = await import('@/lib/classroom-session-route');
    const { COURSE_AI_CONTEXT_REGISTRY } = await import('@/lib/course-ai-contexts');

    expect(courseModule.UNIT_3_9_ROUTE_SEGMENT).toBe('unit-3-9-cross-domain-mapping-lab');
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-9-cross-domain-mapping-lab')).toBe(true);
    expect(resolveSessionRouteFromPlanTitle('3-9：稳定—动态—稳态综合映射实验')).toEqual({
      routeSegment: 'unit-3-9-cross-domain-mapping-lab',
      isPremiumCourse: true,
    });

    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-9-cross-domain-mapping-lab-v1'];
    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('稳定—动态—稳态综合映射实验');
  });

  it('defines the full 8-step lesson flow and real 3-9 media mapping', async () => {
    expect(existsSync(courseFile)).toBe(true);
    if (!existsSync(courseFile)) return;

    const courseModule = await import('@/lib/unit-3-9-course');

    expect(courseModule.UNIT_3_9_LESSON_STEPS).toHaveLength(8);
    expect(courseModule.UNIT_3_9_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_9_LESSON_STEPS[7]?.id).toBe('step-08');
    expect(courseModule.getUNIT_3_9MediaSrc('step-01')).toContain('3-9-cover-comic');
    expect(courseModule.getUNIT_3_9MediaSrc('step-03')).toContain('3-9-baseline-quad');
    expect(courseModule.getUNIT_3_9MediaSrc('step-04')).toContain('3-9-zero-line-quad');
    expect(courseModule.getUNIT_3_9MediaSrc('step-05')).toContain('3-9-integral-weak-quad');
    expect(courseModule.getUNIT_3_9MediaSrc('step-06')).toContain('3-9-lag-quad');
    expect(courseModule.getUNIT_3_9MediaSrc('step-08')).toContain('3-9-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract', async () => {
    expect(existsSync(courseFile)).toBe(true);
    if (!existsSync(courseFile)) return;

    const contract = JSON.parse(
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-9/design/interactive-contract.yaml'), 'utf8'),
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

    const courseModule = await import('@/lib/unit-3-9-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_9_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));

    for (const stepId of Object.keys(contract.steps)) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_9_PAGE_CONTRACTS[stepId];
      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? 'display'
          : authoringStep.interaction_spec.interaction_kind;

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(expectedPageType);
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
    }
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    expect(existsSync(entryFile)).toBe(true);
    if (!existsSync(entryFile)) return;

    const entrySource = readFileSync(entryFile, 'utf8');
    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="3-9 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
  });

  it('parses the 3-9 runtime media index and keeps handout summary outside mediaResources', () => {
    const mediaDocument = readFileSync(join(repoRoot, 'course-content/runtime/lessons/3-9/media/3-9-media.md'), 'utf8');
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-9-intro-video.mp4',
      '3-9-audio.m4a',
      '3-9-slides.pdf',
      '3-9-course.mp4',
    ]);
    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
  });

  it('uses 3-9 step AI context inside the student page and covers matrix/table workspaces', () => {
    expect(existsSync(studentFile)).toBe(true);
    expect(existsSync(stepPanelsFile)).toBe(true);
    expect(existsSync(workspaceFile)).toBe(true);
    if (!existsSync(studentFile) || !existsSync(stepPanelsFile) || !existsSync(workspaceFile)) return;

    const studentSource = readFileSync(studentFile, 'utf8');
    const stepPanelsSource = readFileSync(stepPanelsFile, 'utf8');
    const workspaceSource = readFileSync(workspaceFile, 'utf8');

    expect(studentSource).toContain('getUnit39StepAIContext');
    expect(stepPanelsSource).toContain('综合映射工作区');
    expect(stepPanelsSource).toContain('滞后能压小误差');
    expect(workspaceSource).toContain('MATRIX_WORKSPACE_FIELDS');
    expect(workspaceSource).toContain('TABLE_BUILDER_FIELDS');
  });
});
