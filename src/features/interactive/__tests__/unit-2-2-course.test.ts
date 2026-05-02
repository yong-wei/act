import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { UNIT_2_2_LESSON_STEPS, UNIT_2_2_PAGE_CONTRACTS, getUNIT_2_2MediaSrc } from '@/lib/unit-2-2-course';

const repoRoot = process.cwd();

describe('unit 2-2 interactive course', () => {
  it('registers the 2-2 AI context registry entry', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY['unit-2-2-time-domain-response-v1'];

    expect(registry).toBeDefined();
    expect(registry.courseMeta.courseTitle).toContain('时域响应基础');
  });

  it('defines the full 17-step lesson flow', () => {
    expect(UNIT_2_2_LESSON_STEPS).toHaveLength(17);
    expect(UNIT_2_2_LESSON_STEPS[0]?.id).toBe('step-01');
    expect(UNIT_2_2_LESSON_STEPS[16]?.id).toBe('step-17');
  });

  it('exposes AI quick questions for the reverse-spec comparison step', () => {
    const quickQuestions = getStepQuickQuestions('unit-2-2-time-domain-response-v1', 'step-14');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('约束');
  });

  it('maps runtime media using the real 2-2 prefixed asset names', () => {
    expect(getUNIT_2_2MediaSrc('step-06')).toContain('2-2-td-02-first-order-step-time-constant.svg');
    expect(getUNIT_2_2MediaSrc('step-15')).toContain('2-2-td-06-time-spec-to-pole-region.svg');
  });

  it('keeps the first-order anchor ratio fixed at 63.2% when t equals T', async () => {
    const { calculateFirstOrderAnchorRatio } = await import('@/features/interactive/unit-2-2-time-response/time-response-math');

    expect(calculateFirstOrderAnchorRatio(1.2)).toBeCloseTo(63.2, 1);
    expect(calculateFirstOrderAnchorRatio(3.4)).toBeCloseTo(63.2, 1);
  });

  it('marks the enhanced workspaces for step-07, step-09, and step-13', () => {
    expect(UNIT_2_2_LESSON_STEPS.find((step) => step.id === 'step-07')?.workspaceKind).toBe('second-order-parameter-map');
    expect(UNIT_2_2_LESSON_STEPS.find((step) => step.id === 'step-09')?.workspaceKind).toBe('metric-overview');
    expect(UNIT_2_2_LESSON_STEPS.find((step) => step.id === 'step-13')?.workspaceKind).toBe('worked-example');
  });

  it('keeps step-14 and step-15 aligned with the handout examples and method bridge', () => {
    expect(UNIT_2_2_LESSON_STEPS.find((step) => step.id === 'step-14')?.title).toContain('例题二');
    expect(UNIT_2_2_LESSON_STEPS.find((step) => step.id === 'step-15')?.title).toContain('方法');
  });

  it('keeps local page contracts aligned with the authoring interactive contract for representative steps', () => {
    const contract = JSON.parse(
      readFileSync(
        join(repoRoot, 'course-content/authoring/lessons/2-2/design/interactive-contract.yaml'),
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

    const interactiveSteps = new Map(UNIT_2_2_LESSON_STEPS.map((step) => [step.id, step]));
    const expectedStepIds = ['step-06', 'step-07', 'step-09', 'step-14', 'step-15', 'step-16'] as const;

    for (const stepId of expectedStepIds) {
      const authoringStep = contract.steps[stepId];
      const localStep = interactiveSteps.get(stepId);
      const localPageContract = UNIT_2_2_PAGE_CONTRACTS[stepId];

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

  it('promotes participatory steps to contract-level interaction page types instead of form and ai fallbacks', () => {
    const pageTypes = new Map(UNIT_2_2_LESSON_STEPS.map((step) => [step.id, step.pageType]));

    expect(pageTypes.get('step-06')).toBe('parameter_slider');
    expect(pageTypes.get('step-07')).toBe('triple_match');
    expect(pageTypes.get('step-08')).toBe('tab_switch');
    expect(pageTypes.get('step-09')).toBe('metric_overlay');
    expect(pageTypes.get('step-10')).toBe('reason_check');
    expect(pageTypes.get('step-11')).toBe('formula_pair_check');
    expect(pageTypes.get('step-12')).toBe('parameter_workspace');
    expect(pageTypes.get('step-13')).toBe('worked_example_workspace');
    expect(pageTypes.get('step-14')).toBe('ai_compare_workspace');
    expect(pageTypes.get('step-15')).toBe('mapping_highlight');
    expect(pageTypes.get('step-16')).toBe('quiz_group');
  });

  it('keeps the 2-2 entry page runtime-first and wires knowledge interactions into lesson-entry tracking', () => {
    const unit22EntrySource = readFileSync(
      join(repoRoot, 'src/features/interactive/unit-2-2-time-response/entry-page.tsx'),
      'utf8',
    );
    const runtimeSectionsSource = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
      'utf8',
    );
    const knowledgeCardSource = readFileSync(
      join(repoRoot, 'src/features/knowledge/knowledge-card.tsx'),
      'utf8',
    );

    expect(unit22EntrySource).toContain('PremiumLessonEntryPage');
    expect(unit22EntrySource).toContain('mediaCourseLabel');
    expect(unit22EntrySource).not.toContain('2-2-media.md');
    expect(runtimeSectionsSource).toContain("surface: 'lesson_entry'");
    expect(runtimeSectionsSource).toContain('trackKnowledgeNodeFocus');
    expect(runtimeSectionsSource).toContain('trackingContext');
    expect(knowledgeCardSource).toContain('trackingContext');
    expect(knowledgeCardSource).toContain('onDetailOpen');
    expect(knowledgeCardSource).toContain('trackKnowledgeCardOpen');
    expect(knowledgeCardSource).toContain('extractInfographResource(resources)');
    expect(knowledgeCardSource).toContain('resolveKnowledgeInfographSrc');
    expect(knowledgeCardSource).toContain('setIsInfographOpen(true)');
    expect(knowledgeCardSource).toContain('aria-label={`放大查看${infographTitle}`}');
  });

  it('defines the second-order parameter mapping cards and metric callouts', async () => {
    const { SECOND_ORDER_PARAMETER_CARDS, TIME_DOMAIN_METRIC_CALLOUTS, WORKED_EXAMPLE_SEQUENCE } = await import(
      '@/features/interactive/unit-2-2-time-response/workspace'
    );

    expect(SECOND_ORDER_PARAMETER_CARDS.map((card) => card.key)).toEqual(['wn', 'zeta', 'wd']);
    expect(SECOND_ORDER_PARAMETER_CARDS.every((card) => card.formula.length > 0 && card.phenomenon.length > 0)).toBe(true);

    expect(TIME_DOMAIN_METRIC_CALLOUTS.map((item) => item.key)).toEqual(['tr', 'tp', 'mp', 'ts']);
    expect(TIME_DOMAIN_METRIC_CALLOUTS.every((item) => item.label.length > 0 && item.question.length > 0)).toBe(true);

    expect(WORKED_EXAMPLE_SEQUENCE.map((item) => item.key)).toEqual(['read', 'wd', 'metrics']);
    expect(WORKED_EXAMPLE_SEQUENCE[1]?.focus).toContain('wd');
  });

  it('solves a representative second-order example through wd before the four metrics', async () => {
    const { solveSecondOrderWorkedExample } = await import('@/features/interactive/unit-2-2-time-response/time-response-math');

    const result = solveSecondOrderWorkedExample({ wn: 4, zeta: 0.5, settlingBand: 2 });

    expect(result.wd).toBeCloseTo(3.464, 3);
    expect(result.tr).toBeCloseTo(0.605, 3);
    expect(result.tp).toBeCloseTo(0.907, 3);
    expect(result.mpPercent).toBeCloseTo(16.3, 1);
    expect(result.ts).toBeCloseTo(2, 3);
    expect(result.sequence).toEqual(['read', 'wd', 'metrics']);
  });
});
