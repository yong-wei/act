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

describe('unit 3-5 interactive course', () => {
  it('registers the 3-5 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-3-5-zero-dynamic-improvement-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('零点引入与动态改善');
  });

  it('defines the full 16-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-3-5-course');

    expect(courseModule.UNIT_3_5_LESSON_STEPS).toHaveLength(16);
    expect(courseModule.UNIT_3_5_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_3_5_LESSON_STEPS[15]?.id).toBe('step-16');
  });

  it('exposes AI quick questions for the nonminimum-phase boundary step', () => {
    const quickQuestions = getStepQuickQuestions('unit-3-5-zero-dynamic-improvement-v1', 'step-15');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('带宽');
  });

  it('maps runtime media using the real 3-5 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-3-5-course');

    expect(courseModule.getUNIT_3_5MediaSrc('step-01')).toContain('3-5-cover-comic');
    expect(courseModule.getUNIT_3_5MediaSrc('step-04')).toContain('3-5-rl-01-low-order-zero-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-05')).toContain('3-5-rl-02-high-order-zero-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-07')).toContain('3-5-md-01-pd-rate-structure');
    expect(courseModule.getUNIT_3_5MediaSrc('step-11')).toContain('3-5-rl-03-pd-rate-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-12')).toContain('3-5-rl-04-pd-lead-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-14')).toContain('3-5-rl-05-nmp-compare');
    expect(courseModule.getUNIT_3_5MediaSrc('step-16')).toContain('3-5-info');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/3-5/design/interactive-contract.yaml'),
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

    const courseModule = await import('@/lib/unit-3-5-course');
    const interactiveSteps = new Map(courseModule.UNIT_3_5_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = ['step-03', 'step-04', 'step-08', 'step-09', 'step-11', 'step-13', 'step-15', 'step-16'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_3_5_PAGE_CONTRACTS[stepId];

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
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-3-5-zero-dynamic-improvement')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变'),
    ).toEqual({
      routeSegment: 'unit-3-5-zero-dynamic-improvement',
      isPremiumCourse: true,
    });
  });

  it('renders the runtime entry page with the shared pre-study media hub', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/entry-page.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('LessonEntryMediaHub');
    expect(entrySource).toContain('<LessonEntryMediaHub');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('courseLabel="3-5 · Pre-study"');
    expect(entrySource).toContain('<LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />');
  });

  it('parses the 3-5 runtime media index into typed pre-study resources', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-5/media/3-5-media.md'),
      'utf8',
    );
    const resources = parseRuntimeLessonMediaIndex(mediaDocument);

    expect(resources.map((item) => item.filename)).toEqual([
      '3-5-intro-video.mp4',
      '3-5-audio.m4a',
      '3-5-slides.pdf',
      '3-5-course.mp4',
    ]);
    expect(resources[0]).toMatchObject({
      kind: 'video',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(resources[0]?.title).toContain('零点');
  });

  it('keeps handout summary outside mediaResources when parsing 3-5 runtime media document', () => {
    const mediaDocument = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/3-5/media/3-5-media.md'),
      'utf8',
    );
    const parsed = parseRuntimeLessonMediaDocument(mediaDocument);

    expect(parsed.mediaResources.some((resource) => resource.filename === 'handout.md')).toBe(false);
    expect(parsed.handoutSummary).toContain('PD控制');
    expect(parsed.handoutSummary).toContain('非最小相位系统');
  });

  it('keeps the classroom panels focused on zero reallocation, PD/rate comparison, lead design and nonminimum-phase boundaries', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/workspace.ts'),
      'utf8',
    );

    expect(stepPanelsSource).toContain('测速反馈不显式增加前向零点');
    expect(stepPanelsSource).toContain('提高阻尼不等于结构相同');
    expect(stepPanelsSource).toContain('高频代价不能被省略');
    expect(stepPanelsSource).toContain('为什么非最小相对象往往要先保守带宽');
    expect(stepPanelsSource).not.toContain('劳斯判据');
    expect(stepPanelsSource).not.toContain('关键节点读图');

    expect(workspaceSource).toContain('PRETEST_QUESTIONS');
    expect(workspaceSource).toContain('RISK_TAG_OPTIONS');
    expect(workspaceSource).toContain('SCENARIO_SORT_COLUMNS');
    expect(workspaceSource).toContain('OBSERVATION_FOCUS_OPTIONS');
    expect(workspaceSource).toContain('PHASE_PEAK_OPTIONS');
    expect(workspaceSource).not.toContain('WINDOW_TAG_OPTIONS');
  });

  it('renders step-08, step-11 and step-12 formulas through KaTeX instead of raw LaTeX text', () => {
    const stepPanelsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).toContain("import 'katex/dist/katex.min.css';");
    expect(stepPanelsSource).toContain("import { BlockMath } from 'react-katex';");
    expect(stepPanelsSource).toContain('<BlockMath math={section.formula} />');
    expect(stepPanelsSource).not.toContain(
      "{section.formula ? <div className=\"mt-3 rounded-2xl bg-background/70 px-3 py-3 font-mono text-sm\">{section.formula}</div> : null}",
    );
    expect(stepPanelsSource).toContain("case 'step-08':");
    expect(stepPanelsSource).toContain("case 'step-11':");
    expect(stepPanelsSource).toContain("case 'step-12':");
  });

  it('uses the 3-5 step AI context inside the student page', () => {
    const studentPageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-3-5-zero-dynamic-improvement/student-page.tsx'),
      'utf8',
    );

    expect(studentPageSource).toContain('getUnit35StepAIContext');
    expect(studentPageSource).not.toContain('getUnit34StepAIContext');
  });
});
