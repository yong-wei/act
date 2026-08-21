import { describe, expect, it } from 'vitest';

import { buildGeneratedQuestion, PRESET_QUESTIONS } from '@/features/assessment/adaptive-question-bank';
import { MICRO_TUTORING_PRACTICE_BASELINE_VERSION } from '@/features/assessment/micro-tutoring-coverage-audit';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/lib/adaptive-learning-path-planner';
import { resolveItemTypeTerminalValidation } from '@/lib/adaptive-planning/item-type-terminal-validation';

import {
  AdaptiveAssessmentCatalogSelectionError,
  selectCatalogBackedAssessmentItemFromArtifacts,
} from '../adaptive-assessment-catalog-selector';
import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '../adaptive-assessment-item-catalog';
import { loadAssessmentItemSemanticReviewSource } from '../adaptive-assessment-semantic-review';
import {
  DEFAULT_LIFECYCLE_COVERAGE_V2_POLICY,
  LIFECYCLE_COVERAGE_STAGES,
  LIFECYCLE_COVERAGE_V2_VERSION,
  buildAdaptiveAssessmentLifecycleCoverage,
  buildTerminalValidationOverlayCatalog,
  buildTerminalValidationReviewDecisions,
  detectLifecycleBaselineDrift,
} from '../adaptive-assessment-lifecycle-coverage';
import { REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS } from '../learning-goal-checkpoint-question-sets';
import { REVIEWED_TERMINAL_VALIDATION_QUESTIONS } from '../learning-goal-terminal-validation-question-sets';

async function loadCatalogAndDecisions() {
  const sources = await loadAdaptiveAssessmentCatalogSources();
  const catalog = buildAdaptiveAssessmentItemCatalog({
    acqStaticQuestions: sources.acqStaticQuestions,
    icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
    icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
    kaqReviewedItems: sources.kaqReviewedItems,
  });
  const decisions = await loadAssessmentItemSemanticReviewSource(catalog.items);
  return { catalog, decisions };
}

describe('adaptive assessment lifecycle coverage v2', () => {
  it('keeps practice-v1 identity and reports five layered stages for nine goals', async () => {
    const { catalog, decisions } = await loadCatalogAndDecisions();
    const overlay = buildTerminalValidationOverlayCatalog();
    const overlayDecisions = buildTerminalValidationReviewDecisions(overlay.items);
    const artifacts = buildAdaptiveAssessmentLifecycleCoverage({
      items: catalog.items,
      decisions,
      overlayItems: overlay.items,
      overlayDecisions,
      generatedAt: '2026-08-21T00:00:00.000Z',
    });

    expect(catalog.items).toHaveLength(576);
    expect(Object.keys(ADAPTIVE_LEARNING_GOAL_DEFINITIONS)).toHaveLength(9);
    expect(artifacts.matrix.practiceV1BaselineVersion).toBe(MICRO_TUTORING_PRACTICE_BASELINE_VERSION);
    expect(artifacts.matrix.artifactVersion).toBe(LIFECYCLE_COVERAGE_V2_VERSION);
    expect(artifacts.matrix.learningGoalIds).toHaveLength(9);
    expect(artifacts.matrix.stageMinimums).toEqual(DEFAULT_LIFECYCLE_COVERAGE_V2_POLICY.stageMinimums);
    expect(REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS).toHaveLength(133);
    expect(REVIEWED_TERMINAL_VALIDATION_QUESTIONS).toHaveLength(9);

    for (const row of artifacts.matrix.rows) {
      expect(row.cells.map((cell) => cell.stage)).toEqual(LIFECYCLE_COVERAGE_STAGES);
      const practice = row.cells.find((cell) => cell.stage === 'practice');
      const terminal = row.cells.find((cell) => cell.stage === 'terminal-validation');
      expect(practice?.counts.registered).toBeGreaterThanOrEqual(practice?.counts.allowed ?? 0);
      expect(practice?.counts.allowed).toBeGreaterThanOrEqual(practice?.counts.approved ?? 0);
      expect(practice?.counts.approved).toBeGreaterThanOrEqual(practice?.counts.selectable ?? 0);
      expect(terminal?.status).toBe('complete');
      expect(terminal?.counts.selectable).toBeGreaterThanOrEqual(1);
      expect(terminal?.limitations).toEqual([]);
    }
  });

  it('does not treat allowedStages as approved or selectable coverage', () => {
    const generated = buildGeneratedQuestion(
      'generated-lifecycle-test',
      '生成题不得填补终结验证。',
      0.4,
      ['time'],
      ['generated'],
    );
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [PRESET_QUESTIONS[0]],
      checkpointQuestions: [],
      generatedQuestions: [{ question: generated }],
    });
    const overlay = buildTerminalValidationOverlayCatalog();
    const artifacts = buildAdaptiveAssessmentLifecycleCoverage({
      items: catalog.items,
      decisions: [],
      overlayItems: overlay.items,
      overlayDecisions: [],
    });
    const control = artifacts.matrix.rows.find((row) => row.learningGoalId === 'control-correction');
    const terminal = control?.cells.find((cell) => cell.stage === 'terminal-validation');
    expect(terminal?.status).toBe('incomplete');
    expect(terminal?.counts.selectable).toBe(0);
    expect(terminal?.limitations).toEqual(expect.arrayContaining([
      'minimum-selectable-terminal-validation-coverage-not-met',
    ]));
    expect(artifacts.itemRecords.some((record) => (
      record.sourceFamily === 'generated-adaptive-question' && record.missingLayers.includes('selectable')
    ))).toBe(true);
  });

  it('fails closed on content-hash drift without a baseline upgrade', async () => {
    const { catalog, decisions } = await loadCatalogAndDecisions();
    const overlay = buildTerminalValidationOverlayCatalog();
    const overlayDecisions = buildTerminalValidationReviewDecisions(overlay.items);
    const frozen = buildAdaptiveAssessmentLifecycleCoverage({
      items: catalog.items,
      decisions,
      overlayItems: overlay.items,
      overlayDecisions,
    }).baseline.entries;
    const drifted = overlay.items.map((item, index) => (
      index === 0 ? { ...item, contentHash: '0'.repeat(64) } : item
    ));

    expect(detectLifecycleBaselineDrift(frozen, frozen)).toEqual([]);
    expect(() => buildAdaptiveAssessmentLifecycleCoverage({
      items: catalog.items,
      decisions,
      overlayItems: drifted,
      overlayDecisions,
      frozenBaseline: frozen,
      strictBaseline: true,
    })).toThrow(/lifecycle-coverage-baseline-drift:content-hash-drift/);
  });

  it('selects independent terminal-validation items and rejects practice or provisional substitutes', () => {
    const overlay = buildTerminalValidationOverlayCatalog();
    const overlayDecisions = buildTerminalValidationReviewDecisions(overlay.items);
    const selected = selectCatalogBackedAssessmentItemFromArtifacts({
      learningGoalId: 'control-correction',
      requestedStage: 'terminal-validation',
      askedQuestionIds: new Set(),
      answeredQuestionIds: new Set(),
      targetDifficulty: 0.74,
      weakAreas: new Set(),
      artifacts: {
        items: overlay.items,
        decisions: overlayDecisions,
      },
    });

    expect(selected.catalogItem.sourceId).toBe('control-correction-terminal-validation-01');
    expect(selected.reviewDecision.selectedStagePurpose).toBe('terminal-validation');
    expect(selected.reviewDecision.reviewBatchId).toContain('terminal-validation');
    expect(selected.catalogItem.adaptiveAssessmentItemRef).toMatchObject({
      relationship: 'answer-time-snapshot',
      immutable: true,
      catalogUpdatesRewriteHistoricalAnswers: false,
    });

    expect(() => selectCatalogBackedAssessmentItemFromArtifacts({
      learningGoalId: 'control-correction',
      requestedStage: 'terminal-validation',
      askedQuestionIds: new Set(),
      answeredQuestionIds: new Set(),
      targetDifficulty: 0.5,
      weakAreas: new Set(),
      artifacts: {
        items: overlay.items,
        decisions: overlayDecisions.map((decision) => ({
          ...decision,
          selectedStagePurpose: 'checkpoint',
        })),
      },
    })).toThrow(AdaptiveAssessmentCatalogSelectionError);
  });

  it('resolves item-type terminal validation without replacing simulation or Arena evidence', () => {
    const ready = resolveItemTypeTerminalValidation({ learningGoalId: 'simulation-validation-practice' });
    const missing = resolveItemTypeTerminalValidation({
      learningGoalId: 'not-a-registered-learning-goal',
    });

    expect(ready.status).toBe('ready');
    expect(ready.replacesTypedTerminalEvidence).toBe(false);
    expect(ready.combinesWith).toEqual(['simulation', 'arena']);
    expect(missing.status).toBe('unavailable');
    expect(missing.limitationReason).toContain('no-reviewed-path-eligible-terminal-validation-items');
  });
});
