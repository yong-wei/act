import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

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
let loadLessonRuntimeEntry: typeof import('@/lib/course-runtime').loadLessonRuntimeEntry;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex, loadLessonRuntimeEntry } = await import('@/lib/course-runtime'));
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

  it('builds the full 10-step lesson flow from the runtime manifest', async () => {
    expect(existsSync(courseFile)).toBe(true);
    if (!existsSync(courseFile)) return;

    const runtime = await loadLessonRuntimeEntry('3-9');
    const courseModule = await import('@/lib/unit-3-9-course');
    const steps = courseModule.buildUNIT_3_9RuntimeSteps(runtime.interactiveManifest);

    expect(steps).toHaveLength(10);
    expect(steps.map((step: { id: string }) => step.id)).toEqual([
      'step-01',
      'step-02',
      'step-03',
      'step-04',
      'step-05',
      'step-06',
      'step-07',
      'step-08',
      'step-09',
      'step-10',
    ]);
    expect(steps.map((step: { pageType: string }) => step.pageType)).toEqual([
      'display',
      'quiz_group',
      'display',
      'structured_compare',
      'parameter_slider',
      'parameter_slider',
      'parameter_slider',
      'parameter_slider',
      'table_builder',
      'summary',
    ]);
  });

  it('keeps the local page contracts aligned with the authoring interactive contract', async () => {
    expect(existsSync(courseFile)).toBe(true);
    if (!existsSync(courseFile)) return;

    const runtime = await loadLessonRuntimeEntry('3-9');
    const contract = parse(
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
    const interactiveSteps = new Map(
      courseModule.buildUNIT_3_9RuntimeSteps(runtime.interactiveManifest).map((step: { id: string }) => [step.id, step]),
    );
    const manifestSteps = new Map(runtime.interactiveManifest?.steps.map((step) => [step.id, step]) ?? []);

    for (const stepId of Object.keys(contract.steps)) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const manifestStep = manifestSteps.get(stepId);
      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? 'display'
          : authoringStep.interaction_spec.interaction_kind;

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(expectedPageType);
      expect(manifestStep?.layout.template).toBe(authoringStep.layout.template);
      expect(manifestStep?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(manifestStep?.interactionSpec.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(manifestStep?.teacherInsightSpec.widgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(manifestStep?.telemetrySpec.summaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(manifestStep?.telemetrySpec.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(manifestStep?.previewContract.demoPath).toBe(authoringStep.preview_contract.demo_path);
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

  it('uses shared manifest rendering and removes page-local AI and display-page placeholders', () => {
    expect(existsSync(studentFile)).toBe(true);
    expect(existsSync(stepPanelsFile)).toBe(true);
    expect(existsSync(workspaceFile)).toBe(true);
    if (!existsSync(studentFile) || !existsSync(stepPanelsFile) || !existsSync(workspaceFile)) return;

    const studentSource = readFileSync(studentFile, 'utf8');
    const stepPanelsSource = readFileSync(stepPanelsFile, 'utf8');
    const workspaceSource = readFileSync(workspaceFile, 'utf8');

    expect(studentSource).toContain('buildUNIT_3_9RuntimeSteps');
    expect(studentSource).toContain('lessonRuntime.interactiveManifest');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('ControlFigureWorkspace');
    expect(stepPanelsSource).toContain('buildUnit39AnalysisRequest');
    expect(stepPanelsSource).not.toContain('STEP_BLUEPRINTS');
    expect(stepPanelsSource).not.toContain('unit39-inline-ai');
    expect(stepPanelsSource).not.toContain('本页无需提交');
    expect(stepPanelsSource).not.toContain('复制提示词');
    expect(workspaceSource).toContain('MATRIX_WORKSPACE_FIELDS');
    expect(workspaceSource).toContain('TABLE_BUILDER_FIELDS');
  });

  it('keeps the redesigned page requirements in the 3-9 runtime manifest', async () => {
    const runtime = await loadLessonRuntimeEntry('3-9');
    const steps = new Map(runtime.interactiveManifest?.steps.map((step) => [step.id, step]) ?? []);

    expect(steps.get('step-01')?.modules.some((module) => module.kind === 'figure')).toBe(true);
    expect(JSON.stringify(steps.get('step-01'))).toContain('3-9-cover-comic.png');
    expect(JSON.stringify(steps.get('step-01'))).not.toContain('边界提醒');
    expect(JSON.stringify(steps.get('step-02'))).not.toContain('AI');
    expect(JSON.stringify(steps.get('step-02'))).toContain('本次课程目标');
    expect(JSON.stringify(steps.get('step-02'))).toContain('识别');
    expect(JSON.stringify(steps.get('step-02'))).toContain('解释');
    expect(JSON.stringify(steps.get('step-02'))).toContain('比较');
    expect(JSON.stringify(steps.get('step-02'))).toContain('判断');
    expect(JSON.stringify(steps.get('step-03'))).toContain('控制对象');
    expect(steps.get('step-04')?.modules.some((module) => module.kind === 'rust-analysis-panel')).toBe(true);
    expect(JSON.stringify(steps.get('step-04'))).toContain('超调量');
    expect(steps.get('step-05')?.interactionSpec.interactionKind).toBe('parameter_slider');
    expect(steps.get('step-06')?.interactionSpec.interactionKind).toBe('parameter_slider');
    expect(JSON.stringify(steps.get('step-06'))).toContain('单位斜坡误差');
    expect(steps.get('step-07')?.interactionSpec.interactionKind).toBe('parameter_slider');
    expect(JSON.stringify(steps.get('step-07'))).toContain('设计任务');
    expect(JSON.stringify(steps.get('step-07'))).toContain('C_{ic}(s)');
    expect(JSON.stringify(steps.get('step-07'))).not.toContain('讲义 5.4');
    expect(JSON.stringify(steps.get('step-07'))).toContain('单位斜坡误差');
    expect(steps.get('step-08')?.interactionSpec.interactionKind).toBe('parameter_slider');
    expect(JSON.stringify(steps.get('step-08'))).toContain('不改变型别');
    expect(JSON.stringify(steps.get('step-08'))).toContain('低频增益提高一倍');
    expect(JSON.stringify(steps.get('step-08'))).toContain('单位斜坡误差');
    expect(steps.get('step-09')?.interactionSpec.interactionKind).toBe('table_builder');
    expect(steps.get('step-10')?.interactionSpec.interactionKind).toBe('summary');
    expect(steps.get('step-10')?.modules.some((module) => module.kind === 'figure')).toBe(true);
    expect(JSON.stringify(steps.get('step-10'))).toContain('3-9-info.png');
  });

  it('builds 3-9 Rust analysis requests for baseline, lead, integral and lag panels', async () => {
    const { buildUnit39AnalysisRequest, buildUnit39RampAnalysisRequest, formatUnit39ControllerFormula } = await import(
      '@/resources/control-system/analysis/unit-3-9-request-builder'
    );

    expect(buildUnit39AnalysisRequest('baseline', {}).structures.map((item) => item.kind)).toEqual(['gain']);
    expect(buildUnit39AnalysisRequest('lead', { gain: 2.25, zeroFrequency: 0.5, poleFrequency: 2 }).structures.map((item) => item.kind)).toEqual([
      'gain',
      'lead',
    ]);
    expect(buildUnit39AnalysisRequest('integral', { gain: 2.25, integralZeroFrequency: 0.025 }).structures.map((item) => item.kind)).toEqual([
      'gain',
      'pi',
    ]);
    expect(buildUnit39AnalysisRequest('integral_example', { zeroFrequency: 0.05, poleFrequency: 0.5 }).structures.map((item) => item.kind)).toEqual([
      'gain',
      'pi',
      'lead',
    ]);
    expect(buildUnit39AnalysisRequest('lag', { gain: 4.5, zeroFrequency: 0.025, poleFrequency: 0.0125 }).structures.map((item) => item.kind)).toEqual([
      'gain',
      'lag',
    ]);
    expect(buildUnit39RampAnalysisRequest('integral', { gain: 2.25, integralZeroFrequency: 0.025 }).responseType).toBe('ramp');
    expect(buildUnit39RampAnalysisRequest('lag', { gain: 4.5, zeroFrequency: 0.025, poleFrequency: 0.0125 }).caseId).toContain('_ramp');
    expect(formatUnit39ControllerFormula('lead', { gain: 2.25, zeroFrequency: 0.5, poleFrequency: 2 })).toContain('C(s)=');
  });
});
