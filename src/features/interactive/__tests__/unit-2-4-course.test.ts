import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

const repoRoot = process.cwd();

describe('unit 2-4 interactive course', () => {
  it('registers the 2-4 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-2-4-nyquist-margin-entry-v1'];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toContain('Nyquist');
  });

  it('defines the full 17-step lesson flow', async () => {
    const courseModule = await import('@/lib/unit-2-4-course');

    expect(courseModule.UNIT_2_4_LESSON_STEPS).toHaveLength(17);
    expect(courseModule.UNIT_2_4_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(courseModule.UNIT_2_4_LESSON_STEPS[16]?.id).toBe('step-17');
  });

  it('exposes AI quick questions for the AI compare step', () => {
    const quickQuestions = getStepQuickQuestions('unit-2-4-nyquist-margin-entry-v1', 'step-15');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('对象');
  });

  it('maps runtime media using the real 2-4 prefixed asset names', async () => {
    const courseModule = await import('@/lib/unit-2-4-course');

    expect(courseModule.getUNIT_2_4MediaSrc('step-02')).toContain('2-4-fd-08-bode-nyquist-consistency-panel');
    expect(courseModule.getUNIT_2_4MediaSrc('step-11')).toContain('2-4-fd-09-bode-sketch-checklist');
    expect(courseModule.getUNIT_2_4MediaSrc('step-17')).toContain('2-4-info.png');
  });

  it('keeps the local page contracts aligned with the authoring interactive contract for representative steps', async () => {
    const contract = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/2-4/design/interactive-contract.yaml'),
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

    const courseModule = await import('@/lib/unit-2-4-course');
    const interactiveSteps = new Map(courseModule.UNIT_2_4_LESSON_STEPS.map((step: { id: string }) => [step.id, step]));
    const expectedStepIds = ['step-06', 'step-09', 'step-10', 'step-12', 'step-15', 'step-16'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = courseModule.UNIT_2_4_PAGE_CONTRACTS[stepId];

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
    expect(FEATURED_LESSONS.some((lesson) => lesson.id === 'unit-2-4-nyquist-margin-entry')).toBe(true);

    expect(
      resolveSessionRouteFromPlanTitle('2-4：Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别'),
    ).toEqual({
      routeSegment: 'unit-2-4-nyquist-margin-entry',
      isPremiumCourse: true,
    });
  });
});
