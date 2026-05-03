import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const routeBase = join(
  repoRoot,
  'src/app/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding',
);
const featureBase = join(
  repoRoot,
  'src/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding',
);

describe('unit 4-6 interactive course', () => {
  it('defines the 11-step lesson flow from the runtime manifest', async () => {
    const courseModule = await import('@/lib/unit-4-6-course');

    expect(courseModule.UNIT_4_6_LESSON_STEPS).toHaveLength(11);
    expect(courseModule.UNIT_4_6_LESSON_STEPS.map((step: { id: string }) => step.id)).toEqual([
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
    expect(courseModule.UNIT_4_6_LESSON_STEPS.map((step: { pageType: string }) => step.pageType)).toEqual([
      'display',
      'display',
      'activity_card_set',
      'teacher_reveal_only',
      'activity_card_set',
      'teacher_reveal_only',
      'teacher_reveal_only',
      'teacher_reveal_only',
      'teacher_reveal_only',
      'quiz_group',
      'summary',
    ]);
  });

  it('keeps page contracts aligned with authoring interactive-contract.yaml', async () => {
    const contract = parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/4-6/design/4-6-interactive-contract.yaml'),
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
    const courseModule = await import('@/lib/unit-4-6-course');
    const localSteps = new Map(courseModule.UNIT_4_6_LESSON_STEPS.map((step) => [step.id, step]));
    const runtimeManifest = normalizeInteractiveRuntimeManifest(contract);
    expect(runtimeManifest).not.toBeNull();

    for (const [stepId, authoringStep] of Object.entries(contract.steps)) {
      const localStep = localSteps.get(stepId) as { title: string; pageType: string } | undefined;
      const localContract = courseModule.getUNIT_4_6PageContractFromManifest(runtimeManifest, stepId);
      const fallbackContract = courseModule.UNIT_4_6_PAGE_CONTRACTS[stepId];
      const expectedPageType =
        authoringStep.interaction_spec.interaction_kind === 'none'
          ? stepId === 'step-11'
            ? 'summary'
            : 'display'
          : authoringStep.interaction_spec.interaction_kind;

      expect(localStep?.title).toBe(authoringStep.title);
      expect(localStep?.pageType).toBe(expectedPageType);
      expect(localContract?.layout.template).toBe(authoringStep.layout.template);
      expect(localContract?.layout.regions).toEqual(authoringStep.layout.regions);
      expect(localContract?.interactionKind).toBe(authoringStep.interaction_spec.interaction_kind);
      expect(localContract?.teacherControls.releaseActivity).toBe(authoringStep.teacher_controls.release_activity);
      expect(localContract?.teacherControls.openBrowse).toBe(authoringStep.teacher_controls.open_browse);
      expect(localContract?.teacherControls.teacherStepReveal).toBe(authoringStep.teacher_controls.teacher_step_reveal);
      expect(localContract?.teacherControls.revealReferenceAnswer).toBe(
        authoringStep.teacher_controls.reveal_reference_answer,
      );
      expect(localContract?.teacherInsightWidgets).toEqual(authoringStep.teacher_insight_spec.widgets);
      expect(localContract?.telemetrySummaryFields).toEqual(authoringStep.telemetry_spec.summary_fields);
      expect(localContract?.misconceptionTags ?? []).toEqual(authoringStep.telemetry_spec.misconception_tags ?? []);
      expect(localContract?.previewDemoPath).toBe(authoringStep.preview_contract.demo_path);
      expect(localContract?.aiPageGoal).toBe(authoringStep.ai_context_spec.page_goal);
      expect(fallbackContract?.aiPageGoal).toBe(authoringStep.ai_context_spec.page_goal);
    }
  });

  it('exposes the dedicated route files and keeps the implementation runtime-first', () => {
    expect(existsSync(join(routeBase, 'page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'student/[sessionId]/page.tsx'))).toBe(true);
    expect(existsSync(join(routeBase, 'teacher/[sessionId]/page.tsx'))).toBe(true);

    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const courseSource = readFileSync(join(repoRoot, 'src/lib/unit-4-6-course.ts'), 'utf8');

    expect(stepPanelsSource).not.toContain('/course-content/authoring/lessons/4-6/media/processed/');
    expect(courseSource).not.toContain('course-content/runtime/lessons/4-6/interactive-manifest.json');
    expect(studentPageSource).toContain('lessonRuntime.interactiveManifest');
    expect(studentPageSource).toContain('updatePageContext({');
    expect(studentPageSource).not.toContain('AI 助手');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
  });

  it('keeps post-test and summary separated', async () => {
    const courseModule = await import('@/lib/unit-4-6-course');

    expect(courseModule.UNIT_4_6_LESSON_STEPS[9]).toMatchObject({
      id: 'step-10',
      pageType: 'quiz_group',
    });
    expect(courseModule.UNIT_4_6_LESSON_STEPS[10]).toMatchObject({
      id: 'step-11',
      pageType: 'summary',
    });
  });
});
