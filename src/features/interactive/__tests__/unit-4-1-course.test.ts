import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { isUNIT_4_1AiPageType } from '@/lib/unit-4-1-course';

vi.mock('server-only', () => ({}));
vi.mock('@/resources/control-system/charts/control-figure-workspace', () => ({
  ControlFigureWorkspace: () => 'control figure workspace',
}));

const repoRoot = process.cwd();
const routeSegment = 'unit-4-1-design-task-expression';
const featureBase = join(repoRoot, 'src/features/interactive', routeSegment);
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/4-1/interactive-manifest.json');
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;

function readRuntimeManifest() {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error('4-1 interactive manifest is invalid');
  return { raw, manifest };
}

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 4-1 interactive course', () => {
  it('registers the 4-1 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-4-1-design-task-expression-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('设计起点');
  });

  it('defines the full 13-step lesson flow from the exported runtime manifest', async () => {
    const courseModule = await import('@/lib/unit-4-1-course');
    const { manifest } = readRuntimeManifest();

    expect((courseModule as Record<string, unknown>).UNIT_4_1_RUNTIME_MANIFEST).toBeUndefined();
    expect(courseModule.UNIT_4_1_LESSON_STEPS).toHaveLength(13);
    expect(courseModule.UNIT_4_1_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual(manifest.stepOrder);
    expect(courseModule.UNIT_4_1_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_4_1_LESSON_STEPS[11]?.id).toBe('step-12');
    expect(courseModule.UNIT_4_1_LESSON_STEPS[12]?.id).toBe('step-13');
    expect(courseModule.UNIT_4_1_LESSON_STEPS[3]?.pageType).toBe('parameter_slider');
    expect(courseModule.UNIT_4_1_LESSON_STEPS[4]?.pageType).toBe('parameter_slider');
    expect(courseModule.UNIT_4_1_LESSON_STEPS[8]?.pageType).toBe('task_card_workspace');
    expect(courseModule.UNIT_4_1_LESSON_STEPS[11]?.pageType).toBe('quiz_group');
    expect(courseModule.UNIT_4_1_LESSON_STEPS[12]?.pageType).toBe('summary');
  });

  it('exposes AI quick questions for the task-card step', () => {
    const quickQuestions = getStepQuickQuestions('unit-4-1-design-task-expression-v1', 'step-09');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('任务');
  });

  it('maps runtime media using the real 4-1 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-4-1-course');

    expect(courseModule.getUNIT_4_1MediaSrc('step-04')).toContain('4-1-ship-heading-quad');
    expect(courseModule.getUNIT_4_1MediaSrc('step-05')).toContain('4-1-platform-pitch-quad');
    expect(courseModule.getUNIT_4_1MediaSrc('step-12')).toBeNull();
    expect(courseModule.getUNIT_4_1MediaSrc('step-13')).toContain('4-1-info.png');
    expect(courseModule.getUNIT_4_1MediaSrc('step-06')).toBeNull();
    expect(courseModule.getUNIT_4_1MediaSrc('step-07')).toBeNull();
    expect(courseModule.getUNIT_4_1MediaSrc('step-09')).toBeNull();
    expect(courseModule.getUNIT_4_1MediaSrc('step-10')).toBeNull();
  });

  it('exports a manifest-first runtime contract with object content blocks for 4-1', async () => {
    const { raw, manifest } = readRuntimeManifest();
    const courseModule = await import('@/lib/unit-4-1-course');

    expect(existsSync(manifestPath)).toBe(true);
    expect(raw.steps['step-01'].content_blocks).not.toBeInstanceOf(Array);
    expect(Object.keys(raw.steps['step-01'].content_blocks)).toEqual(['cover_comic', 'infograph', 'intro_question']);
    expect(manifest.steps).toHaveLength(13);
    expect(manifest.steps[0]?.contentBlocks.intro_question).toMatchObject({
      title: '导入问题',
    });

    const step04Contract = courseModule.getUNIT_4_1PageContractFromManifest(manifest, 'step-04');
    expect(step04Contract.layout.template).toEqual(manifest.steps[3]?.layout.template);
    expect(step04Contract.layout.regions).toEqual(manifest.steps[3]?.layout.regions);
    expect(step04Contract.interactionKind).toBe('parameter_slider');
    expect(step04Contract.teacherControls?.releaseActivity).toBe('teacher_toggle');
    expect(step04Contract.previewDemoPath).toBe(
      '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-04',
    );
  });

  it('keeps runtime-derived page contracts aligned with the authoring interactive contract for all 13 steps', async () => {
    const contract = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-1/design/4-1-interactive-contract.yaml'),
        'utf8',
      ),
    ) as {
      steps: Record<string, {
        title: string;
        layout: {
          template: string;
          regions: Array<{ id: string; width: string; order: number }>;
          reading_order: string[];
        };
        interaction_spec: { interaction_kind: string; interaction_archetype: string };
        teacher_insight_spec: { widgets: string[] };
        telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
        ai_context_spec: { delivery_mode: string };
        preview_contract: { demo_path: string };
        interactive_figure_spec?: {
          layout_mirror: string;
          controls: { placement: string; collapsed_by_default: boolean };
        };
      }>;
    };

    const courseModule = await import('@/lib/unit-4-1-course');
    const { manifest } = readRuntimeManifest();
    const interactiveSteps = new Map(
      courseModule.UNIT_4_1_LESSON_STEPS.map((step: { id: string; title: string; pageType: string }) => [step.id, step]),
    );
    const expectedStepIds = Object.keys(contract.steps);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.getUNIT_4_1PageContractFromManifest(manifest, stepId);

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? stepId === 'step-13' ? 'summary' : 'display'
          : authoringStep.interaction_spec.interaction_kind,
      );
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.aiDeliveryMode).toBe(authoringStep.ai_context_spec.delivery_mode);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);

      if (authoringStep.interactive_figure_spec) {
        expect(localPageContract?.figureLayoutMirror).toBe(authoringStep.interactive_figure_spec.layout_mirror);
        expect(localPageContract?.controlsPlacement).toBe(authoringStep.interactive_figure_spec.controls.placement);
        expect(localPageContract?.controlsCollapsedByDefault).toBe(
          authoringStep.interactive_figure_spec.controls.collapsed_by_default,
        );
      }
    }
  });

  it('keeps AI as hidden page context instead of rendering a visible page-level assistant', () => {
    expect(isUNIT_4_1AiPageType('display')).toBe(false);
    expect(isUNIT_4_1AiPageType('parameter_slider')).toBe(false);
    expect(isUNIT_4_1AiPageType('task_card_workspace')).toBe(false);
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-4-1-design-task-expression')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('4-1：设计起点：性能指标体系、工程约束与可行域表达'),
    ).toEqual({
      routeSegment: 'unit-4-1-design-task-expression',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub and runtime sections', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-1-design-task-expression/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('PremiumLessonEntryPage');
    expect(entrySource).toContain('<PremiumLessonEntryPage');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });

  it('passes the runtime manifest into the 4-1 student and teacher classroom pages', () => {
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');

    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(studentPageSource).toContain('getUNIT_4_1PageContractFromManifest');
    expect(teacherPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(teacherPageSource).toContain('getUNIT_4_1PageContractFromManifest');
  });

  it('renders the shared control figure workspace instead of inline svg chart builders for step 04 and step 05', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain("4-1-ship-heading-quad.png");
    expect(stepPanelsSource).not.toContain("4-1-platform-pitch-quad.png");
    expect(stepPanelsSource).toContain('ControlFigureWorkspace');
    expect(stepPanelsSource).not.toContain('function StepResponseChart');
    expect(stepPanelsSource).not.toContain('function RootLocusChart');
  });

  it('keeps complete formulas visible for steps 04, 05, 07, and 10', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('P_h(s)=\\\\frac{0.01715}{s(s+0.1)(s+2.14375)}');
    expect(stepPanelsSource).toContain('L_h(s)=K_hP_h(s)=\\\\frac{0.0385875}{s(s+0.1)(s+2.14375)}');
    expect(stepPanelsSource).toContain('P_p(s)=\\\\frac{2960\\\\left(\\\\frac{s}{15}+1\\\\right)}{s\\\\left(\\\\frac{s}{3}+1\\\\right)');
    expect(stepPanelsSource).toContain('J_{\\\\mathrm{ISE}}=\\\\int_{0}^{\\\\infty} e^2(t)\\\\,\\\\mathrm{d}t');
    expect(stepPanelsSource).toContain('\\\\mathcal{O}\\\\subseteq\\\\mathcal{S}\\\\subseteq\\\\mathcal{F}');
  });

  it('renders step-06/07/09/10 as native panels instead of static images', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('4-1-case-compare-summary.png');
    expect(stepPanelsSource).not.toContain('4-1-indicator-role-matrix.png');
    expect(stepPanelsSource).not.toContain('4-1-task-card-template.png');
    expect(stepPanelsSource).not.toContain('4-1-region-layering.png');
    expect(stepPanelsSource).toContain('function ContrastSummaryMatrixPanel');
    expect(stepPanelsSource).toContain('data-progressive-reveal="row_or_column_reveal"');
    expect(stepPanelsSource).toContain('data-progressive-reveal="section_click_reveal"');
    expect(stepPanelsSource).toContain('data-progressive-reveal="step_click_reveal"');
  });

  it('routes migrated canonical 4-1 modules through native lesson renderers', async () => {
    const { manifest } = readRuntimeManifest();
    const courseModule = await import('@/lib/unit-4-1-course');
    const featureModule = await import('@/features/interactive/unit-4-1-design-task-expression/step-panels');

    const step04Html = renderToStaticMarkup(
      createElement(featureModule.UNIT_4_1StepContentPanel, {
        step: courseModule.getUNIT_4_1Step('step-04'),
        manifest,
        revealProgress: 0,
        allowInlineReveal: true,
        role: 'student',
      }),
    );
    const step11Html = renderToStaticMarkup(
      createElement(featureModule.UNIT_4_1StepContentPanel, {
        step: courseModule.getUNIT_4_1Step('step-11'),
        manifest,
        revealProgress: 0,
        allowInlineReveal: true,
        role: 'student',
      }),
    );
    const summaryHtml = renderToStaticMarkup(
      createElement(featureModule.UNIT_4_1StepContentPanel, {
        step: courseModule.getUNIT_4_1Step('step-13'),
        manifest,
        revealProgress: 0,
        allowInlineReveal: true,
        role: 'student',
        submittedCount: 2,
        viewedCount: 13,
        postTestCompletion: 1,
        parameterSubmissionCount: 4,
      }),
    );

    expect(step04Html).toContain('客船航向控制对象框图');
    expect(step04Html).toContain('控件栏');
    expect(step11Html).toContain('五步清单');
    expect(summaryHtml).toContain('个人课堂表现');
    expect(`${step04Html}\n${step11Html}\n${summaryHtml}`).not.toContain('互动页模块渲染缺失');
  });

  it('keeps step-07/09/10 layout and formula wiring aligned with the revised page requirements', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain("const STEP07_INTEGRAL_FORMULA =");
    expect(stepPanelsSource).toContain("const STEP10_LAYER_FORMULA = '\\\\mathcal{O}\\\\subseteq\\\\mathcal{S}\\\\subseteq\\\\mathcal{F}';");
    expect(stepPanelsSource).toContain('formula={STEP07_INTEGRAL_FORMULA}');
    expect(stepPanelsSource).toContain('math={STEP10_LAYER_FORMULA}');
    expect(stepPanelsSource).toContain('data-layout="step07-formula-full-width"');
    expect(stepPanelsSource).toContain('data-layout="step07-table-full-width"');
    expect(stepPanelsSource).toContain('data-layout="step09-top-pair"');
    expect(stepPanelsSource).toContain('data-layout="step09-example-pair"');
    expect(stepPanelsSource).toContain('data-layout="step09-evidence-full-width"');
    expect(stepPanelsSource).toContain('y="56"');
    expect(stepPanelsSource).toContain('y="118"');
  });

  it('keeps the revised misconception checklist and exit summary static blocks for step-11 and step-12', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('五步清单');
    expect(stepPanelsSource).toContain('当前场景最不能接受的后果是什么。');
    expect(stepPanelsSource).toContain('最后该怎样写成任务书。');
    expect(stepPanelsSource).toContain('四句带走');
    expect(stepPanelsSource).toContain('任务卡是后续设计的共享输入。');
    expect(stepPanelsSource).toContain('4-4：用失败诊断回看任务卡。');
  });

  it('routes 4-1 submissions through the shared manifest activity runtime', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx'),
      'utf8',
    );
    const sharedActivitySource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('renderStudentInteractiveActivity');
    expect(stepPanelsSource).toContain('renderTeacherInteractiveActivity');
    expect(stepPanelsSource).not.toContain('PRETEST_QUESTIONS');
    expect(stepPanelsSource).not.toContain('POSTTEST_QUESTIONS');
    expect(sharedActivitySource).toContain('renderTeacherInteractiveActivity');
  });

  it('parses the 4-1 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-1/media/4-1-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '4-1-intro-video.mp4',
      '4-1-audio.m4a',
      '4-1-slides.pdf',
      '4-1-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
      title: '用导入情境聚焦“在同一间自动控制实验教室里，客船航向控制沙盘和船载稳定平台姿态演示架同时运行”。',
    });
    expect(resources[1]).toMatchObject({
      kind: 'audio',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
      title: '别再盲目修改K值了',
    });
    expect(resources[2]).toMatchObject({
      kind: 'pdf',
      accessMode: 'new_tab',
      embedMode: 'none',
      status: 'ready',
      title: '控制工程：从理论到通关的“任务表达”指南',
    });
    expect(resources[3]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
      title: '控制系统的“翻译”艺术',
    });
  });

  it('keeps handout summary outside mediaResources when parsing 4-1 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-1/media/4-1-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('客船航向控制');
    expect(parsed.handoutSummary).toContain('船载稳定平台');
  });

  it('tightens the interactive lesson implementation skill for dynamic figures and native diagram redraw', () => {
    const skillSource = readFileSync(
      join(repoRoot, '.agents/skills/interactive-lesson/SKILL.md'),
      'utf8',
    );

    expect(skillSource).toContain('控件直接驱动同页曲线或图示的原生重绘');
    expect(skillSource).toContain('任务表达卡模板');
    expect(skillSource).toContain('指标角色矩阵');
    expect(skillSource).toContain('stable_equals_done');
  });
});
