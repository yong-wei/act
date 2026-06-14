import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

  it('builds the full 11-step lesson flow from the runtime manifest', async () => {
    expect(existsSync(courseFile)).toBe(true);
    if (!existsSync(courseFile)) return;

    const runtime = await loadLessonRuntimeEntry('3-9');
    const courseModule = await import('@/lib/unit-3-9-course');
    const steps = courseModule.buildUNIT_3_9RuntimeSteps(runtime.interactiveManifest);

    expect(steps).toHaveLength(11);
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
      'step-11',
    ]);
    expect(steps.map((step: { pageType: string }) => step.pageType)).toEqual([
      'display',
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
      readFileSync(join(repoRoot, 'course-content/authoring/lessons/3-9/design/3-9-interactive-contract.yaml'), 'utf8'),
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
      courseModule.buildUNIT_3_9RuntimeSteps(runtime.interactiveManifest).map((step) => [step.id, step]),
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
    expect(entrySource).toContain('CourseEntryShell');
    expect(entrySource).toContain('<CourseEntryShell');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
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
    expect(stepPanelsSource).toContain('ManifestTeacherControls');
    expect(stepPanelsSource).toContain('TeacherParameterWorkspace');
    expect(stepPanelsSource).toContain('ControlFigureWorkspace');
    expect(stepPanelsSource).toContain('buildUnit39AnalysisRequest');
    expect(stepPanelsSource).not.toContain('STEP_BLUEPRINTS');
    expect(stepPanelsSource).not.toContain('unit39-inline-ai');
    expect(stepPanelsSource).not.toContain('本页无需提交');
    expect(stepPanelsSource).not.toContain('复制提示词');
    expect(workspaceSource).toContain('MATRIX_WORKSPACE_FIELDS');
    expect(workspaceSource).toContain('TABLE_BUILDER_FIELDS');
  });

  it('uses the shared finalization order before tracking session finalization', async () => {
    const courseModule = await import('@/lib/unit-3-9-course');
    const calls: string[] = [];

    await courseModule.finalizeUNIT_3_9TeacherSession({
      currentStepId: 'step-11',
      trackSessionFinalize(data) {
        calls.push(`track:${data.currentStepId}`);
      },
      async finishSession() {
        calls.push('finish');
      },
    });

    expect(calls).toEqual(['finish', 'track:step-11']);
  });

  it('sends full student response details in 3-9 lesson submit telemetry', () => {
    const studentSource = readFileSync(studentFile, 'utf8');

    expect(studentSource).toContain('buildUNIT_3_9SubmissionTelemetry(response)');
    expect(studentSource).not.toContain('data: { stepId: step.id }');
  });

  it('keeps the redesigned page requirements in the 3-9 runtime manifest', async () => {
    const runtime = await loadLessonRuntimeEntry('3-9');
    const steps = new Map(runtime.interactiveManifest?.steps.map((step) => [step.id, step]) ?? []);

    expect(
      steps.get('step-01')?.modules.some((module) =>
        module.kind === 'content.figure' && module.payload.legacyKind === 'figure',
      ),
    ).toBe(true);
    expect(JSON.stringify(steps.get('step-01'))).toContain('3-9-cover-comic.png');
    expect(JSON.stringify(steps.get('step-01'))).not.toContain('边界提醒');
    expect(steps.get('step-02')?.interactionSpec.interactionKind).toBe('none');
    expect(JSON.stringify(steps.get('step-02'))).toContain('完成本单元后，学习者能够：');
    expect(JSON.stringify(steps.get('step-02'))).not.toContain('本次课程目标');
    expect(JSON.stringify(steps.get('step-02'))).toContain('识别');
    expect(JSON.stringify(steps.get('step-02'))).toContain('解释');
    expect(JSON.stringify(steps.get('step-02'))).toContain('比较');
    expect(JSON.stringify(steps.get('step-02'))).toContain('判断');
    expect(JSON.stringify(steps.get('step-03'))).not.toContain('本次课程目标');
    expect(JSON.stringify(steps.get('step-03'))).not.toContain('AI');
    expect(steps.get('step-03')?.interactionSpec.interactionKind).toBe('quiz_group');
    expect(JSON.stringify(steps.get('step-04'))).toContain('控制对象');
    expect(
      steps.get('step-05')?.modules.some((module) =>
        module.kind === 'compute.panel'
        && module.payload.legacyKind === 'rust-analysis-panel'
        && module.payload.capabilityRef === 'rust-analysis',
      ),
    ).toBe(true);
    expect(JSON.stringify(steps.get('step-05'))).toContain('超调量');
    expect(steps.get('step-06')?.interactionSpec.interactionKind).toBe('parameter_slider');
    expect(steps.get('step-07')?.interactionSpec.interactionKind).toBe('parameter_slider');
    expect(JSON.stringify(steps.get('step-07'))).toContain('单位斜坡误差');
    expect(steps.get('step-08')?.interactionSpec.interactionKind).toBe('parameter_slider');
    expect(JSON.stringify(steps.get('step-08'))).toContain('参数调节目标');
    expect(JSON.stringify(steps.get('step-08'))).not.toContain('设计任务');
    expect(
      steps.get('step-08')?.modules.some((module) =>
        module.kind === 'content.formula' && module.payload.legacyKind === 'formula-card',
      ),
    ).toBe(true);
    expect(JSON.stringify(steps.get('step-08'))).toContain('C_{ic}(s)');
    expect(JSON.stringify(steps.get('step-08'))).not.toContain('讲义 5.4');
    expect(JSON.stringify(steps.get('step-08'))).toContain('单位斜坡误差');
    expect(steps.get('step-09')?.interactionSpec.interactionKind).toBe('parameter_slider');
    expect(JSON.stringify(steps.get('step-09'))).toContain('不改变型别');
    expect(JSON.stringify(steps.get('step-09'))).toContain('低频增益提高一倍');
    expect(JSON.stringify(steps.get('step-09'))).toContain('单位斜坡误差');
    expect(steps.get('step-10')?.interactionSpec.interactionKind).toBe('table_builder');
    expect(steps.get('step-11')?.interactionSpec.interactionKind).toBe('summary');
    expect(
      steps.get('step-11')?.modules.some((module) =>
        module.kind === 'content.figure' && module.payload.legacyKind === 'figure',
      ),
    ).toBe(true);
    expect(JSON.stringify(steps.get('step-11'))).toContain('3-9-info.png');
  });

  it('renders migrated 3-9 compute.panel modules through the Rust analysis panel', async () => {
    const runtime = await loadLessonRuntimeEntry('3-9');
    const courseModule = await import('@/lib/unit-3-9-course');
    const { UNIT_3_9StepContentPanel } = await import(
      '@/features/interactive/unit-3-9-cross-domain-mapping-lab/step-panels'
    );
    const manifest = runtime.interactiveManifest;
    const step = courseModule.UNIT_3_9_LESSON_STEPS.find((item) => item.id === 'step-05');
    const stepManifest = manifest?.steps.find((item) => item.id === 'step-05');

    if (!manifest || !step || !stepManifest) throw new Error('3-9 step-05 runtime manifest missing');

    const html = renderToStaticMarkup(
      createElement(UNIT_3_9StepContentPanel, {
        manifest,
        step,
        stepManifest,
        revealProgress: 0,
        allowInlineReveal: false,
      }),
    );

    expect(html).toContain('基准版本四联图');
    expect(html).not.toContain('综合比较面板');
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
