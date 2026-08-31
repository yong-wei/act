import { describe, expect, it } from 'vitest';

import baselineMatrix from '../../../../course-content/runtime/resource-governance/learning-goal-resource-baseline-matrix.json';
import {
  checkpointAuthoredQuestionRuntimeId,
  REVIEWED_LEARNING_GOAL_CHECKPOINT_RUNTIME_QUESTIONS,
  REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS,
} from '../learning-goal-checkpoint-question-sets';
import { buildGeneratedQuestion, PRESET_QUESTIONS } from '../../assessment/adaptive-question-bank';
import {
  buildKaqQuizFoundationArtifacts,
  canQuizOutcomeSatisfyReadiness,
  materializeKaqQuizOutcomeEvidence,
  validateKaqQuizEvidenceContract,
} from '../kaq-quiz-foundation';

describe('K/A/Q quiz foundation coverage', () => {
  it('builds complete quiz set coverage for every baseline LearningGoal', () => {
    const artifacts = buildKaqQuizFoundationArtifacts({
      baselineMatrix,
      questions: PRESET_QUESTIONS,
    });

    expect(artifacts.coverageMatrix.artifactVersion).toBe('kaq-quiz-foundation-bank.v1');
    expect(artifacts.coverageMatrix.batchLearningGoalIds).toEqual(baselineMatrix.batchLearningGoalIds);
    expect(artifacts.coverageMatrix.rows).toHaveLength(baselineMatrix.batchLearningGoalIds.length);
    expect(artifacts.reviewedItems.length).toBe(PRESET_QUESTIONS.length);

    for (const row of artifacts.coverageMatrix.rows) {
      expect(row.quizSets.map((set) => set.purpose).sort()).toEqual([
        'checkpoint',
        'practice',
        'precheck',
        'readiness-gate',
        'remediation',
      ]);
      expect(row.denominator).toBeGreaterThan(0);
      expect(row.sourceWindow).toEqual(baselineMatrix.sourceWindow);
      expect(row.versionRefs).toMatchObject({
        baselineMatrixVersion: baselineMatrix.artifactVersion,
        questionBankVersion: 'kaq-quiz-foundation-bank.v1',
      });
    }

    expect(artifacts.reviewedItems[0]).toMatchObject({
      questionId: 'preset-q-01',
      metadata: expect.objectContaining({
        questionType: 'pole-to-behavior',
        learningGoalIds: expect.arrayContaining(['control-correction']),
        knowledgeObjectiveIds: expect.any(Array),
        capabilityTargetIds: expect.any(Array),
        qualityTargetIds: expect.any(Array),
        graphNodeIds: expect.any(Array),
        cognitiveLevel: expect.any(String),
        purpose: expect.any(String),
        misconceptionTags: expect.any(Array),
        outcomeRefs: expect.arrayContaining([expect.stringMatching(/^quiz-outcome:/)]),
        remediationResourceNodeIds: expect.arrayContaining([expect.any(String)]),
        immutableContentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        review: expect.objectContaining({
          state: 'reviewed',
          reviewerRole: 'assessment-content-reviewer',
          reviewBatchId: 'kaq-quiz-foundation-bank.v1',
          sourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          metadataVersionRef: 'kaq-quiz-foundation-bank.v1',
          staleInvalidationRules: expect.any(Array),
        }),
      }),
    });
    expect(artifacts.limitations.rows.some((row) => row.reason === 'generated-only-not-readiness-eligible')).toBe(true);
  });

  it('includes authored remediation questions in remediation quiz sets', () => {
    const authoredRemediation = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS.find((candidate) =>
      candidate.learningGoalId === 'control-correction' &&
      candidate.stagePurpose === 'remediation'
    );
    expect(authoredRemediation).toBeTruthy();

    const artifacts = buildKaqQuizFoundationArtifacts({
      baselineMatrix,
      questions: [...PRESET_QUESTIONS, ...REVIEWED_LEARNING_GOAL_CHECKPOINT_RUNTIME_QUESTIONS],
    });

    const controlCorrectionRow = artifacts.coverageMatrix.rows.find((row) => row.learningGoalId === 'control-correction');
    const remediationSet = controlCorrectionRow?.quizSets.find((set) => set.purpose === 'remediation');
    const controlCorrectionRemediationQuestionIds = REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS
      .filter((candidate) =>
        candidate.learningGoalId === 'control-correction' &&
        candidate.stagePurpose === 'remediation'
      )
      .map((candidate) => checkpointAuthoredQuestionRuntimeId(candidate.id));
    expect(remediationSet).toMatchObject({
      quizSetId: 'kaq-quiz-set:control-correction:remediation',
      questionIds: controlCorrectionRemediationQuestionIds,
      reviewedQuestionCount: controlCorrectionRemediationQuestionIds.length,
      generatedQuestionCount: 0,
    });
    const reviewedItem = artifacts.reviewedItems.find((item) =>
      item.questionId === checkpointAuthoredQuestionRuntimeId(authoredRemediation!.id)
    );
    expect(reviewedItem).toMatchObject({
      questionId: checkpointAuthoredQuestionRuntimeId(authoredRemediation!.id),
      metadata: expect.objectContaining({
        purpose: 'remediation',
        outcomeRefs: expect.arrayContaining([
          expect.stringContaining(':remediation:'),
        ]),
      }),
    });
  });

  it('prevents generated-only quiz outcomes from unlocking heavy nodes or terminal validation', () => {
    const generatedQuestion = buildGeneratedQuestion(
      'generated-q-kaq-1',
      '生成题：综合判断闭环校正的跨域权衡。',
      0.7,
      ['complex', 'frequency'],
      ['controller-tuning', 'robustness'],
    );

    const generatedEvidence = materializeKaqQuizOutcomeEvidence({
      question: generatedQuestion,
      sessionId: 'session-generated',
      answerId: 'answer-generated',
      isCorrect: true,
      score: 100,
      scoringVersion: 'adaptive-assessment-bkt-v1',
      occurredAt: '2026-06-24T08:30:00.000Z',
    });

    expect(generatedEvidence.reviewState).toBe('provisional');
    expect(generatedEvidence.learningFactEligible).toBe(false);
    expect(generatedEvidence.readinessGateEligible).toBe(false);
    expect(generatedEvidence.terminalValidationEligible).toBe(false);
    expect(generatedEvidence.learningGoalIds).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(generatedEvidence.kaqObjectiveIds).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(generatedEvidence.graphNodeIds).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(generatedEvidence.capabilityTargetIds).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(generatedEvidence.qualityTargetIds).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(generatedEvidence.misconceptionTags).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(generatedEvidence.studentCompetencySnapshotEffect).toBe('no-op');
    expect(canQuizOutcomeSatisfyReadiness(generatedEvidence, {
      requiresReviewedEvidence: true,
      requiresTerminalValidation: true,
      requiresHighConfidence: true,
    })).toBe(false);
  });

  it('prevents reviewed non-readiness quiz purposes from unlocking heavy nodes or terminal validation', () => {
    const practiceEvidence = materializeKaqQuizOutcomeEvidence({
      question: PRESET_QUESTIONS[2],
      sessionId: 'session-reviewed-practice',
      answerId: 'answer-reviewed-practice',
      isCorrect: true,
      score: 100,
      scoringVersion: 'adaptive-assessment-bkt-v1',
      occurredAt: '2026-06-24T08:32:00.000Z',
    });

    expect(practiceEvidence.reviewState).toBe('reviewed');
    expect(practiceEvidence.quizSetId).toContain(':practice');
    expect(practiceEvidence.learningFactEligible).toBe(true);
    expect(practiceEvidence.readinessGateEligible).toBe(false);
    expect(practiceEvidence.terminalValidationEligible).toBe(false);
    expect(canQuizOutcomeSatisfyReadiness(practiceEvidence, {
      requiresReviewedEvidence: true,
      requiresTerminalValidation: true,
      requiresHighConfidence: true,
    })).toBe(false);
  });

  it('rejects missing review audit, dedupe, denominator, and scoring fields', () => {
    const evidence = materializeKaqQuizOutcomeEvidence({
      question: PRESET_QUESTIONS[0],
      sessionId: 'session-contract',
      answerId: 'answer-contract',
      isCorrect: true,
      score: 100,
      scoringVersion: 'adaptive-assessment-bkt-v1',
      occurredAt: '2026-06-24T08:35:00.000Z',
    });

    expect(validateKaqQuizEvidenceContract(evidence)).toEqual([]);
    expect(validateKaqQuizEvidenceContract({
      ...evidence,
      questionSnapshotId: '',
      denominator: 0,
      scoringVersion: '',
      dedupeKey: '',
      reviewAudit: undefined,
    })).toEqual(expect.arrayContaining([
      'questionSnapshotId',
      'denominator',
      'scoringVersion',
      'dedupeKey',
      'reviewAudit',
    ]));
  });
});
