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

describe('unit 3-1 interactive course', () => {
  it('registers the 3-1 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-1-pure-pole-stability-and-dynamics-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('纯极点视角');
  });

  it('defines the full 15-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-1-course');

    expect(courseModule.UNIT_3_1_LESSON_STEPS).toHaveLength(15);
    expect(courseModule.UNIT_3_1_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_1_LESSON_STEPS[14]?.id).toBe('step-15');
  });

  it('exposes AI quick questions for the AI compare step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-1-pure-pole-stability-and-dynamics-v1', 'step-12');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('证据');
  });

  it('maps runtime media using the real 3-1 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-1-course');

    expect(courseModule.getUNIT_3_1MediaSrc('step-05')).toContain('3-1-pp-01-stability-half-plane');
    expect(courseModule.getUNIT_3_1MediaSrc('step-02')).toBeNull();
    expect(courseModule.getUNIT_3_1MediaSrc('step-08')).toBeNull();
    expect(courseModule.getUNIT_3_1MediaSrc('step-11')).toBeNull();
    expect(courseModule.getUNIT_3_1MediaSrc('step-13')).toBeNull();
    expect(courseModule.getUNIT_3_1MediaSrc('step-15')).toContain('3-1-info.png');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-1/design/3-1-interactive-contract.yaml'),
        'utf8',
      ),
    ) as {
      steps: Record<string, {
        title: string;
        layout: { template: string; regions: Array<{ id: string; width: string; order: number }> };
        interaction_spec: { interaction_kind: string };
        teacher_insight_spec: { widgets: string[] };
        telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
        preview_contract: { demo_path: string };
      }>;
    };

    const courseModule = await import('@/lib/unit-3-1-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_1_LESSON_STEPS.map((step) => [step.id, step]));
    const expectedStepIds = [
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
      'step-12',
      'step-13',
      'step-14',
      'step-15',
    ] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_1_PAGE_CONTRACTS[stepId];
      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? stepId === 'step-15'
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
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
    }
  });

  it('updates the authoring contract for the new interactive exploration layout and worked-example constraints', () => {
    const contractSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-1/design/3-1-interactive-contract.yaml'),
      'utf8',
    );
    const contract = parse(
      contractSource,
    ) as {
      steps: Record<string, {
        layout: { regions: Array<{ id: string; width: string; order: number }> };
        content_blocks: Array<{ id: string; body?: string; value?: string }>;
        interaction_spec?: { step_reveal_policy?: { mode?: string } };
      }>;
    };

    expect(contract.steps['step-02']?.layout.regions).toEqual([
      { id: 'formula-strip', width: 'full', order: 1 },
      { id: 'root-locus', width: 'half', order: 2 },
      { id: 'response', width: 'half', order: 3 },
      { id: 'metrics', width: 'full', order: 4 },
      { id: 'interaction', width: 'full', order: 5 },
    ]);
    expect(contract.steps['step-03']?.layout.regions).toEqual([
      { id: 'goals', width: 'half', order: 1 },
      { id: 'chain', width: 'half', order: 2 },
      { id: 'boundary', width: 'full', order: 3 },
    ]);
    expect(contract.steps['step-08']?.interaction_spec?.step_reveal_policy?.mode).toBe('teacher_or_inline_progressive');
    expect(
      contract.steps['step-11']?.content_blocks.some((block) =>
        (block.body ?? '').includes('|G_ref(jω)|、|G_A(jω)|、|G_B(jω)|'),
      ),
    ).toBe(true);
    expect(contractSource).toContain('y_{\\\\text{step}}(t)');
  });

  it('keeps hidden AI, progressive reveal, and per-card submission constraints in the runtime panels', () => {
    const controlPanelsSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );
    const chartPanelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-chart-panel.tsx'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/step-panels.tsx'),
      'utf8',
    );
    const explorationSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/interactive-exploration-panel.tsx'),
      'utf8',
    );
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/student-page.tsx'),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/teacher-page.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('InteractiveAIPanel');
    expect(controlPanelsSource).toContain('interactiveHandles');
    expect(controlPanelsSource).toContain("kind: 'pole' | 'zero'");
    expect(controlPanelsSource).toContain('onHandlePointerDown');
    expect(controlPanelsSource).toContain('renderInteractiveHandle');
    expect(controlPanelsSource).toContain('convertToPixel');
    expect(chartPanelSource).toContain('onChartReady');
    expect(stepPanelsSource).toContain('显示下一步');
    expect(stepPanelsSource).toContain('重置步骤');
    expect(stepPanelsSource).toContain('提交答案');
    expect(stepPanelsSource).toContain('mt-4 grid gap-4 md:grid-cols-2');
    expect(stepPanelsSource).toContain('点击当前步骤可继续显影下一层');
    expect(stepPanelsSource).toContain('<StepInlineVisualContent key={step.id}');
    expect(stepPanelsSource).toContain('题面已固定显示');
    expect(stepPanelsSource).toContain('G_{\\\\mathrm{A}}(s)');
    expect(stepPanelsSource).toContain('分析三组模型在时域响应、运动模态与动态性能上的差异');
    expect(stepPanelsSource).toContain('卷积图下面继续给出具体例子');
    expect(stepPanelsSource).toContain('renderInlineMathText');
    expect(explorationSource).toContain('useControlEngine');
    expect(explorationSource).toContain('RootLocusPanel');
    expect(explorationSource).toContain('ControlChartPanel');
    expect(explorationSource).toContain('拖动附加极点');
    expect(explorationSource).toContain('buildRootLocusRequest');
    expect(explorationSource).toContain('pointermove');
    expect(explorationSource).toContain('interactiveHandles');
    expect(explorationSource).not.toContain('rounded-full border-2 border-amber-500');
    expect(explorationSource).not.toContain('直接拖动图中的开环附加极点');
    expect(stepPanelsSource).toContain('\\\\left|G_{A}(j\\\\omega)\\\\right|');
    expect(stepPanelsSource).toContain('\\\\left|G_{B}(j\\\\omega)\\\\right|');
    expect(stepPanelsSource).not.toContain('课程 runtime 配套图示');
    expect(stepPanelsSource).not.toContain('本页互动状态');
    expect(studentPageSource).not.toContain('UNIT_3_1StepAiAssistant');
    expect(teacherPageSource).not.toContain('UNIT_3_1StepAiAssistant');
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-1-pure-pole-stability-and-dynamics')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解'),
    ).toEqual({
      routeSegment: 'unit-3-1-pure-pole-stability-and-dynamics',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('CourseEntryShell');
    expect(entrySource).toContain('<CourseEntryShell');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
  });

  it('keeps runtime lesson metadata for handout pdf and media index in lesson.json', () => {
    const lessonJson = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/runtime/lessons/3-1/lesson.json'),
        'utf8',
      ),
    ) as {
      handout_pdf_path?: string;
      media_index_path?: string;
    };

    expect(lessonJson.handout_pdf_path).toBe('/course-runtime/lessons/3-1/3-1-handout.pdf');
    expect(lessonJson.media_index_path).toBe('/course-runtime/lessons/3-1/media/3-1-media.md');
  });

  it('parses the 3-1 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-1/media/3-1-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-1-intro-video.mp4',
      '3-1-audio.m4a',
      '3-1-slides.pdf',
      '3-1-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('同一对主导极点');
  });

  it('keeps handout summary outside mediaResources when parsing 3-1 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-1/media/3-1-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('高阶系统');
    expect(parsed.handoutSummary).toContain('Bode 图');
  });
});
