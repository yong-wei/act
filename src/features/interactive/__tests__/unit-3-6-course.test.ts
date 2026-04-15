import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { isUNIT_3_6AiPageType } from '@/lib/unit-3-6-course';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
let parseRuntimeLessonMediaDocument: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaDocument;
let parseRuntimeLessonMediaIndex: typeof import('@/lib/course-runtime').parseRuntimeLessonMediaIndex;

beforeAll(async () => {
  ({ parseRuntimeLessonMediaDocument, parseRuntimeLessonMediaIndex } = await import('@/lib/course-runtime'));
});

describe('unit 3-6 interactive course', () => {
  it('registers the 3-6 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-6-zero-design-workshop-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('零点作用与动态改善实验');
  });

  it('defines the full 15-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-6-course');

    expect(courseModule.UNIT_3_6_LESSON_STEPS).toHaveLength(15);
    expect(courseModule.UNIT_3_6_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_6_LESSON_STEPS[14]?.id).toBe('step-15');
  });

  it('exposes AI quick questions for the boundary decision step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-6-zero-design-workshop-v1', 'step-14');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('非最小相');
  });

  it('maps runtime media using the real 3-6 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-6-course');

    expect(courseModule.getUNIT_3_6MediaSrc('step-01')).toContain('3-6-cover-comic');
    expect(courseModule.getUNIT_3_6MediaSrc('step-02')).toContain('3-6-design-map');
    expect(courseModule.getUNIT_3_6MediaSrc('step-07')).toContain('3-6-pd-design');
    expect(courseModule.getUNIT_3_6MediaSrc('step-08')).toBeNull();
    expect(courseModule.getUNIT_3_6MediaSrc('step-09')).toContain('3-6-rate-feedback-design');
    expect(courseModule.getUNIT_3_6MediaSrc('step-11')).toContain('3-6-lead-design');
    expect(courseModule.getUNIT_3_6MediaSrc('step-13')).toContain('3-6-pd-frequency-design');
    expect(courseModule.getUNIT_3_6MediaSrc('step-14')).toContain('3-6-rhp-boundary');
    expect(courseModule.getUNIT_3_6MediaSrc('step-15')).toContain('3-6-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-6/design/interactive-contract.yaml'),
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

    const courseModule = await import('@/lib/unit-3-6-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_6_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = ['step-01', 'step-04', 'step-06', 'step-08', 'step-10', 'step-11', 'step-13', 'step-14', 'step-15'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_6_PAGE_CONTRACTS[stepId];

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

  it('registers the course in the learning catalog and classroom route resolver', () => {
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-6-zero-design-workshop')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-6：零点作用与动态改善实验——从性能目标到校正设计'),
    ).toEqual({
      routeSegment: 'unit-3-6-zero-design-workshop',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="3-6 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
  });

  it('parses the 3-6 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-6/media/3-6-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-6-intro-video.mp4',
      '3-6-audio.m4a',
      '3-6-slides.pdf',
      '3-6-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('基准对象');
  });

  it('keeps handout summary outside mediaResources when parsing 3-6 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-6/media/3-6-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('超前频域设计');
    expect(parsed.handoutSummary).toContain('`PD` 频域设计');
  });

  it('keeps the classroom panels focused on goal-driven design, not on the 3-5 mechanism-only storyline', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('指标 -> 结构 -> 参数 -> 验收');
    expect(stepPanelsSource).toContain('先按目标分类，再进入工具');
    expect(stepPanelsSource).toContain('先定等效极点，再求 Kt');
    expect(stepPanelsSource).toContain('同一频域目标达标，不代表时域代价相同');
    expect(stepPanelsSource).toContain('先改目标，再选结构');
    expect(stepPanelsSource).not.toContain('零点越靠右越好');
    expect(stepPanelsSource).not.toContain('提高阻尼不等于结构相同');

    expect(workspaceSource).toContain('ENTRY_BUCKETS');
    expect(workspaceSource).toContain('PRETEST_QUESTIONS');
    expect(workspaceSource).toContain('DESIGN_TASK_CARDS');
    expect(workspaceSource).toContain('BOUNDARY_STRUCTURE_OPTIONS');
    expect(workspaceSource).not.toContain('RISK_TAG_OPTIONS');
    expect(workspaceSource).not.toContain('SENTENCE_REBUILD_TOKENS');
  });

  it('renders inline math inside step-06 and step-07 conclusion bullets instead of raw LaTeX text', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain("import ReactMarkdown from 'react-markdown';");
    expect(stepPanelsSource).toContain("import rehypeKatex from 'rehype-katex';");
    expect(stepPanelsSource).toContain("import remarkMath from 'remark-math';");
    expect(stepPanelsSource).toContain('<ReactMarkdown');
    expect(stepPanelsSource).toContain('阻尼比约束：$\\\\zeta \\\\ge 0.456$');
    expect(stepPanelsSource).toContain('先选设计点 $s_d=-1.1\\\\pm j1.67$');
  });

  it('uses the 3-6 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit36StepAIContext');
    expect(studentPageSource).not.toContain('getUnit35StepAIContext');
  });

  it('keeps AI as hidden page context instead of rendering a visible page-level assistant', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx'),
      'utf8',
    );
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/student-page.tsx'),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/teacher-page.tsx'),
      'utf8',
    );

    expect(isUNIT_3_6AiPageType('display')).toBe(false);
    expect(isUNIT_3_6AiPageType('quiz_group')).toBe(false);
    expect(isUNIT_3_6AiPageType('workspace_builder')).toBe(false);
    expect(studentPageSource).toContain('quickQuestions: stepContext.quickQuestions');
    expect(studentPageSource).not.toContain('UNIT_3_6StepAiAssistant');
    expect(teacherPageSource).not.toContain('UNIT_3_6StepAiAssistant');
    expect(stepPanelsSource).not.toContain('InteractiveAIPanel');
    expect(stepPanelsSource).not.toContain('useInteractiveAI');
    expect(stepPanelsSource).not.toContain('页内 AI 对照区');
    expect(stepPanelsSource).not.toContain('打开 AI 助手');
  });

  it('keeps step-03 as a static two-column overview instead of adding a separate activity area', () => {
    const authoringPageSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-6/design/interactive-page.md'),
      'utf8',
    );
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-6/design/interactive-contract.yaml'),
        'utf8',
      ),
    ) as {
      steps: Record<string, { layout: { regions: Array<{ id: string; width: string }> } }>;
    };
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx'),
      'utf8',
    );

    expect(authoringPageSource).toContain('并排两列');
    expect(contract.steps['step-03']?.layout.regions).toEqual([
      { id: 'chain', width: 'half', order: 1 },
      { id: 'outputs', width: 'half', order: 2 },
      { id: 'rules', width: 'full', order: 3 },
    ]);
    expect(stepPanelsSource).toContain('data-layout="step03-two-column"');
  });

  it('keeps step-06 on a shared root-locus engine with click-to-reveal formulas and a right-side record area', () => {
    const authoringPageSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-6/design/interactive-page.md'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx'),
      'utf8',
    );
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/student-page.tsx'),
      'utf8',
    );

    expect(authoringPageSource).toContain('时域指标如何变成设计可行域');
    expect(authoringPageSource).toContain('统一仿真引擎');
    expect(authoringPageSource).toContain('根轨迹面板在左，记录区在右');
    expect(stepPanelsSource).toContain('function UNIT_3_6Step06GainWorkspace');
    expect(stepPanelsSource).toContain('useControlEngine');
    expect(stepPanelsSource).toContain('RootLocusPanel');
    expect(stepPanelsSource).toContain('data-progressive-reveal="step_click_reveal"');
    expect(studentPageSource).toContain('step.id === \'step-06\'');
  });

  it('keeps step-08 as a native structure evidence board without bitmap fallback or a separate submit form', async () => {
    const courseModule = await import('@/lib/unit-3-6-course');
    const authoringPageSource = readFileSync(
      join(repoRoot, 'course-content/authoring/lessons/3-6/design/interactive-page.md'),
      'utf8',
    );
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx'),
      'utf8',
    );

    expect(courseModule.getUNIT_3_6MediaSrc('step-08')).toBeNull();
    expect(authoringPageSource).toContain('原生结构图');
    expect(authoringPageSource).toContain('不设置独立学生作答区');
    expect(stepPanelsSource).toContain('function UNIT_3_6RateFeedbackStructureDiagram');
    expect(stepPanelsSource).toContain('function UNIT_3_6Step08EvidenceBoard');
    expect(stepPanelsSource).not.toContain('3-6-pd-rate-structure');
  });
});
