import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/unit-3-4-ai-contexts', () => ({
  getUnit34StepAIContext: () => undefined,
  getUnit34StepQuickQuestions: () => [],
}));

const repoRoot = process.cwd();
const routeBase = join(
  repoRoot,
  'src/app/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization',
);
const featureBase = join(
  repoRoot,
  'src/features/interactive/unit-4-5-constraint-aware-parameter-optimization',
);

describe('unit 4-5 interactive course', () => {
  it('defines the full 13-step lesson flow from the authoring contract', async () => {
    const courseModule = await import('@/lib/unit-4-5-course');

    expect(courseModule.UNIT_4_5_LESSON_STEPS).toHaveLength(13);
    expect(courseModule.UNIT_4_5_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual([
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
    ]);
    expect(courseModule.UNIT_4_5_LESSON_STEPS.map((step: { pageType: string }) => step.pageType)).toEqual([
      'display',
      'display',
      'display',
      'activity_card_set',
      'activity_card_set',
      'teacher_reveal_only',
      'teacher_reveal_only',
      'teacher_reveal_only',
      'teacher_reveal_only',
      'teacher_reveal_only',
      'teacher_reveal_only',
      'quiz_group',
      'summary',
    ]);
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all 13 steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-5/design/interactive-contract.yaml'),
        'utf8',
      ),
    ) as {
      steps: Record<
        string,
        {
          title: string;
          layout: {
            template: string;
            regions: Array<{ id: string; width: string; order: number }>;
          };
          interaction_spec: { interaction_kind: string };
          teacher_controls: {
            release_activity: string;
            open_browse: string;
            teacher_step_reveal: string;
            reveal_reference_answer: string;
          };
          teacher_insight_spec: { widgets: string[] };
          telemetry_spec: { summary_fields: string[]; misconception_tags?: string[] };
          ai_context_spec: { page_goal: string };
          preview_contract: { demo_path: string };
        }
      >;
    };

    const courseModule = await import('@/lib/unit-4-5-course');
    const interactiveSteps = new Map(courseModule.UNIT_4_5_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    expect(expectedStepIds).toHaveLength(13);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_4_5_PAGE_CONTRACTS[stepId];
      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? stepId === 'step-13'
            ? 'summary'
            : 'display'
          : authoringStep.interaction_spec.interaction_kind;

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(expectedPageType);
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherControls.releaseActivity).toBe(authoringStep.teacher_controls.release_activity);
      expect(localPageContract?.teacherControls.openBrowse).toBe(authoringStep.teacher_controls.open_browse);
      expect(localPageContract?.teacherControls.teacherStepReveal).toBe(authoringStep.teacher_controls.teacher_step_reveal);
      expect(localPageContract?.teacherControls.revealReferenceAnswer).toBe(
        authoringStep.teacher_controls.reveal_reference_answer,
      );
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
      expect(localPageContract?.aiPageGoal).toBe(authoringStep.ai_context_spec.page_goal);
    }
  });

  it('exposes the dedicated route files for entry, student and teacher pages', () => {
    expect(existsSync(join(routeBase, 'page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'teacher/[sessionId]/page.tsx'))).toBe(true);
  });

  it('keeps the runtime lesson slice on runtime media only and without inline AI entry', () => {
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-4-5-course.ts'), 'utf8');

    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/4-5/media/processed/');
    expect(stepPanelsSource).not.toContain('/ai');
    expect(stepPanelsSource).toContain('点击当前最下方步骤继续显示下一层。');
    expect(courseSource).toContain('/course-runtime/lessons/4-5/media/');
    expect(courseSource).not.toContain('/course-runtime/lessons/4-4/media/');

    expect(studentPageSource).toContain('updatePageContext({');
    expect(studentPageSource).not.toContain('AI 助手');
    expect(studentPageSource).toContain('allowInlineReveal={isDemo || browseEnabled}');
    expect(teacherPageSource).toContain('UNIT_4_5TeacherActivitySummary');
  });

  it('uses the constrained weight-sweep figure and dedicated summary infographic in the later steps', async () => {
    const courseModule = await import('@/lib/unit-4-5-course');

    expect(courseModule.UNIT_4_5_LESSON_STEPS[8]).toMatchObject({
      id: 'step-09',
      title: '权重影响：可行域不变时，收益会怎样被重新分配',
    });
    expect(courseModule.UNIT_4_5_LESSON_STEPS[12]).toMatchObject({
      id: 'step-13',
      title: '总结：把越界证据、约束翻译与结构边界连成一条链',
      pageType: 'summary',
    });
    expect(courseModule.getUNIT_4_5MediaSrc('step-09')).toBe(
      '/course-runtime/lessons/4-5/media/4-5-weight-sweep-constrained-summary.png',
    );
    expect(courseModule.getUNIT_4_5MediaSrc('step-13')).toBe('/course-runtime/lessons/4-5/media/4-5-info.png');
  });

  it('renders formula-bearing table cells and prompts through math-aware cells instead of raw text', () => {
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');

    expect(stepPanelsSource).toContain("['对象', { kind: 'math', value: 'P_h(s)=");
    expect(stepPanelsSource).toContain("['结构', { kind: 'math', value: 'C_h(s)=");
    expect(stepPanelsSource).toContain("['起点与范围', { kind: 'math', value: 'x_0=");
    expect(stepPanelsSource).toContain("prompt: '$1\\\\le K\\\\le 6$ 与 $u_{\\\\max}\\\\le 7$ 分别在回答什么问题？'");
  });

  it('wires teacher reveal and per-card helpers to the intended steps', async () => {
    const courseModule = await import('@/lib/unit-4-5-course');

    expect(courseModule.isUNIT_4_5StepReleasedByDefault('step-05')).toBe(false);
    expect(courseModule.isUNIT_4_5StepReleasedByDefault('step-06')).toBe(true);
    expect(courseModule.isUNIT_4_5StepReleasedByDefault('step-07')).toBe(false);
    expect(courseModule.isUNIT_4_5StepReleasedByDefault('step-04')).toBe(false);
    expect(courseModule.isUNIT_4_5PerCardTextStep('step-04')).toBe(true);
    expect(courseModule.isUNIT_4_5PerCardTextStep('step-07')).toBe(true);
    expect(courseModule.isUNIT_4_5PerCardTextStep('step-08')).toBe(true);
    expect(courseModule.isUNIT_4_5PerCardTextStep('step-09')).toBe(false);
    expect(courseModule.isUNIT_4_5PerCardQuizStep('step-12')).toBe(true);
    expect(courseModule.isUNIT_4_5PerCardQuizStep('step-03')).toBe(false);
  });

  it('keeps the global AI registry backed by the dedicated unit-4-5 module', () => {
    const registrySource = readFileSync(join(repoRoot, 'src/lib/course-ai-contexts.ts'), 'utf8');

    expect(registrySource).toContain("from './unit-4-5-ai-contexts'");
    expect(registrySource).not.toContain('const UNIT_4_5_STEP_CONFIG = {');
    expect(registrySource).not.toContain("export const UNIT_4_5_COURSE_META = {");
  });
});
