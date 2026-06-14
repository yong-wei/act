import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { UNIT_2_3_LESSON_STEPS, UNIT_2_3_PAGE_CONTRACTS, getUNIT_2_3MediaSrc } from '@/lib/unit-2-3-course';

const repoRoot = process.cwd();

describe('unit 2-3 interactive course', () => {
  it('registers the 2-3 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-2-3-frequency-response-bode-intro-v1'];

    expect(registry).toBeDefined();
    expect(registry.courseMeta.courseTitle).toContain('频率响应基础');
  });

  it('defines the full 17-step lesson flow', () => {
    expect(UNIT_2_3_LESSON_STEPS).toHaveLength(17);
    expect(UNIT_2_3_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(UNIT_2_3_LESSON_STEPS[16]?.id).toBe('step-17');
  });

  it('exposes AI quick questions for the AI compare step', () => {
    const quickQuestions = getStepQuickQuestions('unit-2-3-frequency-response-bode-intro-v1', 'step-15');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('AI');
  });

  it('maps runtime media using the real 2-3 prefixed asset names', () => {
    expect(getUNIT_2_3MediaSrc('step-02')).toContain('2-3-fr-01-command-vs-disturbance.svg');
    expect(getUNIT_2_3MediaSrc('step-13')).toContain('2-3-fr-06-bode-skeleton-workflow.svg');
    expect(getUNIT_2_3MediaSrc('step-17')).toContain('2-3-info.png');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', () => {
    const contract = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/2-3/design/2-3-interactive-contract.yaml'),
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

    const interactiveSteps = new Map(UNIT_2_3_LESSON_STEPS.map((step) => [step.id, step]));
    const expectedStepIds = ['step-06', 'step-09', 'step-12', 'step-13', 'step-15', 'step-16'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = UNIT_2_3_PAGE_CONTRACTS[stepId];

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

  it('promotes the contract-defined interaction page types instead of reusing 2-2 fallbacks', () => {
    const pageTypes = new Map(UNIT_2_3_LESSON_STEPS.map((step) => [step.id, step.pageType]));

    expect(pageTypes.get('step-06')).toBe('parameter_slider');
    expect(pageTypes.get('step-07')).toBe('reason_check');
    expect(pageTypes.get('step-08')).toBe('tab_switch');
    expect(pageTypes.get('step-09')).toBe('triple_match');
    expect(pageTypes.get('step-10')).toBe('single_choice');
    expect(pageTypes.get('step-11')).toBe('highlight_toggle');
    expect(pageTypes.get('step-12')).toBe('card_sort');
    expect(pageTypes.get('step-13')).toBe('workspace_builder');
    expect(pageTypes.get('step-14')).toBe('worked_example_workspace');
    expect(pageTypes.get('step-15')).toBe('ai_compare_workspace');
    expect(pageTypes.get('step-16')).toBe('quiz_group');
  });

  it('renders the runtime entry page with the shared pre-study media hub instead of hardcoded media links', () => {
    const entrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-2-3-frequency-response/entry-page.tsx'),
      'utf8',
    );
    const sharedMediaHubSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/lesson-entry-media-hub.tsx'),
      'utf8',
    );

    expect(entrySource).toContain('CourseEntryShell');
    expect(entrySource).toContain('<CourseEntryShell');
    expect(entrySource).toContain('lessonRuntime={lessonRuntime}');
    expect(entrySource).toContain('mediaCourseLabel');
    expect(entrySource).not.toContain('2-3-media.md');
    expect(entrySource).not.toContain('objectshowpreview');
    expect(sharedMediaHubSource).toContain('lessonRuntime.mediaResources');
    expect(sharedMediaHubSource).toContain('lessonRuntime.handoutPdfPath');
    expect(sharedMediaHubSource).toContain('useResourceInteractionTracking');
  });
});
