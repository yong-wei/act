import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { COURSE_AI_CONTEXT_REGISTRY } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/unit-3-4-ai-contexts', () => ({
  getUnit34StepAIContext: () => undefined,
  getUnit34StepQuickQuestions: () => [],
}));

const repoRoot = process.cwd();

describe('unit 4-4 interactive course', () => {
  it('registers the 4-4 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-4-4-fixed-structure-optimization-modeling-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('多目标权衡');
  });

  it('defines the full 14-step lesson flow from the authoring contract', async () => {
    const courseModule = await import('@/lib/unit-4-4-course');

    expect(courseModule.UNIT_4_4_LESSON_STEPS).toHaveLength(14);
    expect(courseModule.UNIT_4_4_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_4_4_LESSON_STEPS[13]?.id).toBe('step-14');
    expect(courseModule.UNIT_4_4_LESSON_STEPS.map((step: { pageType: string }) => step.pageType)).toEqual([
      'display',
      'display',
      'quiz_group',
      'activity_card_set',
      'activity_card_set',
      'display',
      'teacher_reveal_only',
      'single_choice',
      'activity_card_set',
      'single_choice',
      'single_choice',
      'task_card_workspace',
      'quiz_group',
      'display',
    ]);
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for all 14 steps', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-4/design/interactive-contract.yaml'),
        'utf8',
      ),
    ) as {
      steps: Record<string, {
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
      }>;
    };

    const courseModule = await import('@/lib/unit-4-4-course');
    const interactiveSteps = new Map(courseModule.UNIT_4_4_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = Object.keys(contract.steps);

    expect(expectedStepIds).toHaveLength(14);

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_4_4_PAGE_CONTRACTS[stepId];
      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? 'display'
          : authoringStep.interaction_spec.interaction_kind;

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(expectedPageType);
      expect(localPageContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localPageContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localPageContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localPageContract?.teacherControls.releaseActivity).toBe(authoringStep.teacher_controls.release_activity);
      expect(localPageContract?.teacherControls.openBrowse).toBe(authoringStep.teacher_controls.open_browse);
      expect(localPageContract?.teacherControls.teacherStepReveal).toBe(authoringStep.teacher_controls.teacher_step_reveal);
      expect(localPageContract?.teacherControls.revealReferenceAnswer).toBe(authoringStep.teacher_controls.reveal_reference_answer);
      expect(localPageContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localPageContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localPageContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localPageContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
      expect(localPageContract?.aiPageGoal).toBe(authoringStep.ai_context_spec.page_goal);
    }
  });

  it('registers the course in the learning catalog and classroom route resolver', async () => {
    const courseModule = await import('@/lib/unit-4-4-course');

    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-4-4-fixed-structure-optimization-modeling')).toBe(true);

    expect(resolveSessionRouteFromPlanTitle('4-4：多目标权衡与控制器优化设计')).toEqual({
      routeSegment: courseModule.UNIT_4_4_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('exposes a dedicated preset and app-router entry files for the 4-4 premium course', async () => {
    const presetModule = await import('@/features/teacher/preset-lessons/presets');

    expect(presetModule.UNIT_4_4_FIXED_STRUCTURE_OPTIMIZATION_MODELING_PRESET).toBeDefined();
    expect(presetModule.ALL_PRESETS.some((preset: { key: string }) => preset.key === 'unit-4-4-fixed-structure-optimization-modeling-v1')).toBe(true);

    expect(
      existsSync(
        join(
          repoRoot,
          'src/app/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/page.tsx',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          repoRoot,
          'src/app/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/[sessionId]/page.tsx',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          repoRoot,
          'src/app/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/teacher/[sessionId]/page.tsx',
        ),
      ),
    ).toBe(true);
  });

  it('implements runtime-first step panels and teacher reveal flow in the dedicated 4-4 lesson slice', async () => {
    const courseModule = await import('@/lib/unit-4-4-course');
    const stepPanelsPath = join(
      repoRoot,
      'src/features/interactive/unit-4-4-fixed-structure-optimization-modeling/step-panels.tsx',
    );

    expect(existsSync(stepPanelsPath)).toBe(true);

    const stepPanelsSource = readFileSync(stepPanelsPath, 'utf8');
    const studentPageSource = readFileSync(
      join(
        repoRoot,
        'src/features/interactive/unit-4-4-fixed-structure-optimization-modeling/student-page.tsx',
      ),
      'utf8',
    );
    const teacherPageSource = readFileSync(
      join(
        repoRoot,
        'src/features/interactive/unit-4-4-fixed-structure-optimization-modeling/teacher-page.tsx',
      ),
      'utf8',
    );
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-4-4-course.ts'), 'utf8');
    const manifestSource = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-4/interactive-manifest.json'),
      'utf8',
    );
    const sharedContentRendererSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );
    const sharedActivityRendererSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/4-4/media/processed/');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).toContain('createManifestStudentActivityRegistry');
    expect(stepPanelsSource).toContain('GradientDescentNativeFigure');
    expect(stepPanelsSource).toContain('ParetoFrontNativeFigure');
    expect(courseSource).toContain('/course-runtime/lessons/4-4/media/');
    expect(manifestSource).toContain('J_{free}(θ)');
    expect(manifestSource).toContain('P_h(s)=0.01715/[s(s+0.1)(s+2.14375)]');
    expect(manifestSource).toContain('Pareto front');
    expect(manifestSource).toContain('横摇边界案例');
    expect(courseModule.UNIT_4_4_PARETO_FRONT_READING_BULLETS).toEqual([
      '越往左走，控制能量更小，但 ITAE 会明显变差。',
      '越往上走，拖尾改善有限，但动作代价更容易被压低。',
      'Pareto front 不是绝对最优点，而是一族可继续保留的候选。',
    ]);
    expect(courseModule.UNIT_4_4_PARETO_POINT_READING_BULLETS).toEqual([
      '从 P_3 走向 P_1，可以显著压低 ITAE，但必须接受更高控制能量。',
      '从 P_1 回到 P_3，可以大幅节省动作代价，但必须接受更长拖尾。',
      'P_2 夹在中间，没有把另一边彻底碾压掉。',
    ]);
    expect(manifestSource).toContain('Pareto front 保留的是一组非支配候选，而不是一个绝对最优点。');
    expect(manifestSource).not.toContain('越往下，拖尾更短');
    expect(sharedContentRendererSource).toContain('点击当前最下方步骤继续显示下一层。');
    expect(sharedActivityRendererSource).toContain('buildPerCardSubmissionAnswers');
    expect(studentPageSource).toContain('isUNIT_4_4StepReleasedByDefault(step.id, runtimeManifest)');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(studentPageSource).toContain("pageContract.teacherControls.teacherStepReveal === 'not_applicable'");
    expect(studentPageSource).toContain('allowInlineReveal={allowInlineReveal}');
    expect(studentPageSource).not.toContain('allowInlineReveal={isDemo || browseEnabled}');
    expect(teacherPageSource).toContain('UNIT_4_4TeacherActivitySummary');
    expect(stepPanelsSource).not.toContain('/ai');
  });

  it('marks teacher-reveal pages as open by default in the shared lesson contract helpers', async () => {
    const courseModule = await import('@/lib/unit-4-4-course');

    expect(courseModule.isUNIT_4_4StepReleasedByDefault('step-07')).toBe(true);
    expect(courseModule.isUNIT_4_4StepReleasedByDefault('step-03')).toBe(false);
  });

  it('marks step-03 as a per-card quiz submission page in shared lesson helpers', async () => {
    const courseModule = await import('@/lib/unit-4-4-course');

    expect(courseModule.isUNIT_4_4PerCardQuizStep('step-03')).toBe(true);
    expect(courseModule.isUNIT_4_4PerCardQuizStep('step-10')).toBe(false);
  });

  it('re-aligns the revised 4-4 steps to the latest authoring sequence and native figure requirements', async () => {
    const courseModule = await import('@/lib/unit-4-4-course');
    const stepPanelsPath = join(
      repoRoot,
      'src/features/interactive/unit-4-4-fixed-structure-optimization-modeling/step-panels.tsx',
    );
    const stepPanelsSource = readFileSync(stepPanelsPath, 'utf8');
    const manifestSource = readFileSync(
      join(repoRoot, 'course-content/runtime/lessons/4-4/interactive-manifest.json'),
      'utf8',
    );
    const sharedContentRendererSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
      'utf8',
    );

    expect(stepPanelsSource).not.toContain('本课七项目标');
    expect(manifestSource).toContain('完成本次课程后，学习者能够：');
    expect(manifestSource).toContain('你认为上一课中的方案还有哪些可以改进的地方？');
    expect(sharedContentRendererSource).toContain("import { BlockMath, InlineMath } from 'react-katex';");
    expect(stepPanelsSource).toContain('GradientDescentNativeFigure');
    expect(stepPanelsSource).toContain('ParetoFrontNativeFigure');
    expect(manifestSource).toContain('t_s / 40');
    expect(manifestSource).toContain('ITAE / ITAE_0');
    expect(sharedContentRendererSource).toContain('renderTableCell');
    expect(manifestSource).toContain('2.796(10s+1)/(4.06s+1)');
    expect(manifestSource).toContain('J_{free}(θ)');
    expect(manifestSource).toContain('拖动曲线上的候选点');
    expect(manifestSource).toContain('上一轮设计结果回看');
    expect(manifestSource).toContain('阶段判断后测');
    expect(manifestSource).toContain('非支配候选');

    expect(courseModule.isUNIT_4_4PerCardTextStep('step-13')).toBe(false);
    expect(courseModule.isUNIT_4_4PerCardQuizStep('step-13')).toBe(true);
  });
});
