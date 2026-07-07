import { describe, expect, it } from 'vitest';

import { buildGeneratedQuestion, PRESET_QUESTIONS } from '@/features/assessment/adaptive-question-bank';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/lib/adaptive-learning-path-planner';

import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '../adaptive-assessment-item-catalog';
import {
  buildCheckpointAuthoredSemanticReviewDecisions,
  buildKaqFoundationSemanticReviewDecisions,
} from '../adaptive-assessment-semantic-review';
import {
  buildLearningGoalAssessmentCoverageArtifacts,
  LEARNING_GOAL_ASSESSMENT_STAGE_REQUIREMENTS,
} from '../learning-goal-assessment-coverage';

function goals() {
  return Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS).map((registeredGoal) => {
    const definition = registeredGoal.learningGoal!;
    return {
      id: definition.id,
      title: definition.title,
      terminalValidationRequired: definition.terminalValidationPolicy.required,
      acceptedTerminalEvidenceTypes: definition.terminalValidationPolicy.acceptedEvidenceTypes,
    };
  });
}

function goalIds() {
  return goals().map((goal) => goal.id);
}

describe('LearningGoal assessment coverage', () => {
  it('builds complete reviewed stage coverage for every current path-ready LearningGoal', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: PRESET_QUESTIONS,
      acqStaticQuestions: sources.acqStaticQuestions,
      icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
      icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
      kaqReviewedItems: sources.kaqReviewedItems,
    });
    const decisions = [
      ...buildKaqFoundationSemanticReviewDecisions(catalog.items, sources.kaqReviewedItems),
      ...buildCheckpointAuthoredSemanticReviewDecisions(catalog.items),
    ];
    const decisionStageByItemId = new Map(decisions.map((decision) => [
      decision.catalogItemId,
      decision.selectedStagePurpose === 'readiness-gate' || decision.selectedStagePurpose === 'precheck'
        ? 'readiness'
        : decision.selectedStagePurpose === 'low-stakes-practice'
          ? 'practice'
          : decision.selectedStagePurpose,
    ]));
    const artifacts = buildLearningGoalAssessmentCoverageArtifacts({
      items: catalog.items,
      decisions,
      goals: goals(),
      generatedAt: '2026-07-03T00:00:00.000Z',
    });

    expect(artifacts.matrix.stageRequirements).toEqual(LEARNING_GOAL_ASSESSMENT_STAGE_REQUIREMENTS);
    expect(artifacts.matrix.batchLearningGoalIds).toEqual(goalIds());
    expect(artifacts.matrix.totals).toMatchObject({
      learningGoalCount: 9,
      complete: 9,
      limited: 0,
      reviewedPathEligibleItemCount: 137,
    });
    for (const row of artifacts.matrix.rows) {
      expect(row.assessmentCoverageState).toBe('complete');
      expect(row.incompleteStages).toEqual([]);
      for (const stage of row.stageCoverage) {
        expect(stage.reviewedPathEligibleCount).toBeGreaterThanOrEqual(stage.requiredCount);
        for (const catalogItemId of stage.countedCatalogItemIds) {
          expect(decisionStageByItemId.get(catalogItemId)).toBe(stage.stage);
        }
        expect(stage.sourceMix).not.toHaveProperty('generated-adaptive-question');
        expect(stage.kaqObjectiveCoverage.length).toBeGreaterThan(0);
        expect(stage.graphNodeCoverage.length).toBeGreaterThan(0);
        expect(stage.remediationResourceNodeIds.length).toBeGreaterThan(0);
      }
    }

    const terminalGoal = artifacts.matrix.rows.find((row) => row.learningGoalId === 'simulation-validation-practice');
    expect(terminalGoal?.terminalValidationSupport).toMatchObject({
      required: true,
      assessmentItemsReplaceTerminalEvidence: false,
      limitationReason: 'assessment-items-support-diagnosis-but-do-not-replace-typed-terminal-evidence',
    });
  });

  it('does not count generated or unreviewed items toward minimum coverage', async () => {
    const generatedQuestion = buildGeneratedQuestion(
      'generated-q-coverage-test',
      '生成题不能计入正式覆盖。',
      0.5,
      ['generated'],
      ['coverage'],
    );
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: [],
      checkpointQuestions: [],
      generatedQuestions: [{ question: generatedQuestion }],
    });
    const artifacts = buildLearningGoalAssessmentCoverageArtifacts({
      items: catalog.items,
      decisions: [{
        catalogItemId: 'adaptive-assessment-item:generated-adaptive-question:generated-q-coverage-test',
        decisionKind: 'machine-suggestion',
        outcome: 'approved',
        sourceContentHash: catalog.items[0].contentHash,
        selectedLearningGoalIds: ['control-correction'],
        selectedKaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
        selectedGraphNodeIds: ['kn:autocontrol:controller-correction'],
        selectedStagePurpose: 'checkpoint',
        misconceptionRefs: ['misconception:generated'],
        remediationRefs: ['registry:lesson09-correction-precheck'],
        metadataVersionRefs: catalog.items[0].versionRefs,
      }],
      goals: [goals()[0]],
      generatedAt: '2026-07-03T00:00:00.000Z',
    });

    expect(artifacts.matrix.rows[0]).toMatchObject({
      assessmentCoverageState: 'limited',
      reviewedPathEligibleItemCount: 0,
      incompleteStages: ['readiness', 'practice', 'checkpoint', 'remediation'],
    });
  });

  it('does not count approved decisions that fail semantic review field validation', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: PRESET_QUESTIONS,
      acqStaticQuestions: sources.acqStaticQuestions,
      icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
      icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
      kaqReviewedItems: sources.kaqReviewedItems,
    });
    const item = catalog.items.find((candidate) =>
      candidate.reviewState === 'path-eligible' &&
      candidate.allowedStages.includes('readiness') &&
      !candidate.allowedStages.includes('checkpoint')
    );
    expect(item).toBeDefined();

    const artifacts = buildLearningGoalAssessmentCoverageArtifacts({
      items: [item!],
      decisions: [{
        catalogItemId: item!.catalogItemId,
        decisionKind: 'human-review',
        outcome: 'approved',
        reviewerId: 'semantic-reviewer',
        reviewedAt: '2026-07-03T00:00:00.000Z',
        reviewBatchId: 'semantic-review-regression.v1',
        sourceContentHash: item!.contentHash,
        selectedLearningGoalIds: [goals()[0].id],
        selectedKaqObjectiveIds: item!.semanticRefs.kaqObjectiveIds,
        selectedGraphNodeIds: item!.semanticRefs.graphNodeIds,
        selectedStagePurpose: 'checkpoint',
        difficulty: item!.semanticRefs.difficulty ?? undefined,
        cognitiveLevel: item!.semanticRefs.cognitiveLevel ?? undefined,
        misconceptionRefs: [],
        remediationRefs: item!.semanticRefs.remediationResourceNodeIds,
        metadataVersionRefs: item!.versionRefs,
      }],
      goals: [goals()[0]],
      generatedAt: '2026-07-03T00:00:00.000Z',
    });

    expect(artifacts.matrix.rows[0].stageCoverage.flatMap((stage) => stage.countedCatalogItemIds)).toEqual([]);
    expect(artifacts.matrix.rows[0]).toMatchObject({
      assessmentCoverageState: 'limited',
      reviewedPathEligibleItemCount: 0,
    });
  });

  it('does not count approved decisions with invalid known K/A/Q graph or remediation refs', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: PRESET_QUESTIONS,
      acqStaticQuestions: sources.acqStaticQuestions,
      icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
      icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
      kaqReviewedItems: sources.kaqReviewedItems,
    });
    const validDecision = buildCheckpointAuthoredSemanticReviewDecisions(catalog.items)
      .find((decision) => decision.selectedLearningGoalIds.includes(goals()[0].id));
    expect(validDecision).toBeDefined();
    const item = catalog.items.find((candidate) => candidate.catalogItemId === validDecision!.catalogItemId);
    expect(item).toBeDefined();
    const invalidDecision = {
      ...validDecision!,
      selectedKaqObjectiveIds: ['knowledge:not-a-kaq-objective'],
      selectedGraphNodeIds: ['kn:not-a-graph-node'],
      remediationRefs: ['registry:not-a-remediation-resource'],
    };

    const oldPathArtifacts = buildLearningGoalAssessmentCoverageArtifacts({
      items: [item!],
      decisions: [invalidDecision],
      goals: [goals()[0]],
      generatedAt: '2026-07-03T00:00:00.000Z',
    });
    expect(oldPathArtifacts.matrix.rows[0].reviewedPathEligibleItemCount).toBe(1);

    const artifacts = buildLearningGoalAssessmentCoverageArtifacts({
      items: [item!],
      decisions: [invalidDecision],
      goals: [goals()[0]],
      knownLearningGoalIds: [goals()[0].id],
      knownKaqObjectiveIds: item!.semanticRefs.kaqObjectiveIds,
      knownGraphNodeIds: item!.semanticRefs.graphNodeIds,
      knownRemediationResourceNodeIds: item!.semanticRefs.remediationResourceNodeIds,
      generatedAt: '2026-07-03T00:00:00.000Z',
    });

    expect(artifacts.matrix.rows[0].stageCoverage.flatMap((stage) => stage.countedCatalogItemIds)).toEqual([]);
    expect(artifacts.matrix.rows[0]).toMatchObject({
      assessmentCoverageState: 'limited',
      reviewedPathEligibleItemCount: 0,
    });
  });

  it('does not count globally known semantic refs outside the selected LearningGoal boundary', async () => {
    const sources = await loadAdaptiveAssessmentCatalogSources();
    const catalog = buildAdaptiveAssessmentItemCatalog({
      presetQuestions: PRESET_QUESTIONS,
      acqStaticQuestions: sources.acqStaticQuestions,
      icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
      icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
      kaqReviewedItems: sources.kaqReviewedItems,
    });
    const validDecision = buildCheckpointAuthoredSemanticReviewDecisions(catalog.items)
      .find((decision) => decision.selectedLearningGoalIds.includes(goals()[0].id));
    expect(validDecision).toBeDefined();
    const item = catalog.items.find((candidate) => candidate.catalogItemId === validDecision!.catalogItemId);
    expect(item).toBeDefined();

    const knownIds = {
      knownLearningGoalIds: [goals()[0].id],
      knownKaqObjectiveIds: [
        ...item!.semanticRefs.kaqObjectiveIds,
        'knowledge:other-goal-known-objective',
      ],
      knownGraphNodeIds: [
        ...item!.semanticRefs.graphNodeIds,
        'kn:other-goal-known-node',
      ],
      knownRemediationResourceNodeIds: [
        ...item!.semanticRefs.remediationResourceNodeIds,
        'registry:other-goal-known-remediation',
      ],
    };
    const crossGoalMutations = [
      {
        field: 'selectedKaqObjectiveIds',
        decision: {
          ...validDecision!,
          selectedKaqObjectiveIds: ['knowledge:other-goal-known-objective'],
        },
      },
      {
        field: 'selectedGraphNodeIds',
        decision: {
          ...validDecision!,
          selectedGraphNodeIds: ['kn:other-goal-known-node'],
        },
      },
      {
        field: 'remediationRefs',
        decision: {
          ...validDecision!,
          remediationRefs: ['registry:other-goal-known-remediation'],
        },
      },
    ];

    for (const mutation of crossGoalMutations) {
      const globallyKnownArtifacts = buildLearningGoalAssessmentCoverageArtifacts({
        items: [item!],
        decisions: [mutation.decision],
        goals: [goals()[0]],
        ...knownIds,
        generatedAt: '2026-07-03T00:00:00.000Z',
      });
      expect(globallyKnownArtifacts.matrix.rows[0].reviewedPathEligibleItemCount).toBe(1);

      const artifacts = buildLearningGoalAssessmentCoverageArtifacts({
        items: [item!],
        decisions: [mutation.decision],
        goals: [{
          ...goals()[0],
          semanticBoundary: {
            kaqObjectiveIds: item!.semanticRefs.kaqObjectiveIds,
            graphNodeIds: item!.semanticRefs.graphNodeIds,
            remediationResourceNodeIds: item!.semanticRefs.remediationResourceNodeIds,
          },
        }],
        ...knownIds,
        generatedAt: '2026-07-03T00:00:00.000Z',
      });

      expect(artifacts.matrix.rows[0].stageCoverage.flatMap((stage) => stage.countedCatalogItemIds), mutation.field).toEqual([]);
      expect(artifacts.matrix.rows[0], mutation.field).toMatchObject({
        assessmentCoverageState: 'limited',
        reviewedPathEligibleItemCount: 0,
      });
    }
  });
});
