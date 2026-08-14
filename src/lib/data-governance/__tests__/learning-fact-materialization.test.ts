import { describe, expect, it } from 'vitest';
import type { LearningEvent } from '../event-protocol';
import { eventToLearningFactInput } from '../learning-fact-materialization';

function createEvent(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    eventId: 'event-001',
    occurredAt: '2026-04-16T02:41:03.547Z',
    userId: 'user-001',
    role: 'student',
    pagePath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/session-001',
    pageType: 'classroom',
    actionType: 'submit',
    sessionId: 'session-001',
    payload: {
      eventType: 'lesson_submit',
      stepId: 'step-04',
      lessonKey: 'unit-3-6-zero-design-workshop-v1',
      score: 67,
      answerKeys: { q1: 'root-region', q2: 'root-locus', q3: 'review-goal' },
    },
    source: 'web',
    priority: 'secondary',
    ...overrides,
  };
}

const TEST_KAQ_VERSION_REFS = {
  artifactVersioningVersion: 'kaq-artifact-versioning.v1',
  learningGoalPackageVersion: 'learning-goal-package/v1',
  objectiveCatalogVersion: 'autocontrol-kaq-objectives.v1',
  graphCatalogVersion: 'autocontrol-kaq-graph.v1',
  resourceRegistryVersion: 'resource-node-registry.v1',
  resourceProjectionVersion: 'resource-semantic-projection.v1',
  overlayVersion: 'graph-center-overlay.v1',
  plannerVersion: 'adaptive-learning-path-planner.v1',
  groundingVersion: 'konling-graph-grounding.v1',
  questionBankVersion: 'kaq-quiz-foundation-bank.v1',
};

function createGovernedKaqQuizEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    questionSnapshotId: 'question-snapshot:reviewed',
    quizSetId: 'kaq-quiz-set:control-correction:readiness-gate',
    questionId: 'preset-q-01',
    answerId: 'answer-1',
    sessionId: 'adaptive-student-1',
    attemptKey: 'adaptive-student-1:preset-q-01',
    scoringVersion: 'adaptive-assessment-bkt-v1',
    rubricVersion: 'kaq-quiz-foundation-bank.v1:rubric',
    denominator: 1,
    retryPolicy: { maxAttemptsAffectingMastery: 1, idempotencyScope: 'session-question' },
    eventSource: 'adaptive_assessment',
    eventType: 'answer_submit',
    sourceLogId: 'adaptive-assessment:answer-1',
    dedupeKey: 'adaptive-assessment:adaptive-student-1:preset-q-01',
    occurredAt: '2026-04-16T02:41:03.547Z',
    score: 100,
    isCorrect: true,
    confidence: { level: 'high', score: 1, basis: 'reviewed-question-bank' },
    reviewState: 'reviewed',
    reviewAudit: {
      state: 'reviewed',
      reviewerRole: 'assessment-content-reviewer',
      reviewedAt: '2026-06-24T00:00:00.000Z',
      reviewBatchId: 'kaq-quiz-foundation-bank.v1',
      sourceHash: 'hash',
      metadataVersionRef: 'kaq-quiz-foundation-bank.v1',
    },
    learningGoalIds: ['control-correction'],
    kaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
    knowledgeObjectiveIds: ['knowledge:autocontrol:controller-correction'],
    applicationObjectiveIds: ['capability:autocontrol:synthesize-controller-correction'],
    qualityObjectiveIds: ['quality:autocontrol:evidence-integrity'],
    graphNodeIds: ['kn:autocontrol:controller-correction'],
    capabilityTargetIds: ['capability:autocontrol:synthesize-controller-correction'],
    qualityTargetIds: ['quality:autocontrol:evidence-integrity'],
    learningFactEligible: true,
    readinessGateEligible: true,
    terminalValidationEligible: true,
    studentCompetencySnapshotEffect: 'update',
    versionRefs: TEST_KAQ_VERSION_REFS,
    ...overrides,
  };
}

describe('eventToLearningFactInput', () => {
  it('materializes legacy submit events as lesson_submit facts when payload carries the canonical event type', () => {
    const fact = eventToLearningFactInput(createEvent());

    expect(fact).toMatchObject({
      userId: 'user-001',
      factType: 'question',
      sessionId: 'session-001',
      lessonId: 'unit-3-6-zero-design-workshop-v1',
      outcome: 'partial',
      score: 67,
      sourceEventId: 'event-001',
    });
    expect(fact?.competencyContribution).toEqual({});
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'legacy',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'legacy_evidence_context_only',
      },
    });
  });

  it('ignores low-value secondary events that should not update student competency facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      actionType: 'view',
      payload: { eventType: 'lesson_step_view', stepId: 'step-01' },
    }));

    expect(fact).toBeNull();
  });

  it('materializes sampled parameter exploration as auditable context-only evidence without a profile contribution', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'workspace-param-sampled-001',
      actionType: 'param_change',
      payload: {
        eventType: 'workspace_param_change',
        stepId: 'step-04',
        lessonKey: 'unit-4-1-design-task-expression-v1',
        sampled: true,
        changeCount: 8,
        flushReason: 'step_leave',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'workspace-param-sampled-001',
      factType: 'simulation',
      lessonId: 'unit-4-1-design-task-expression-v1',
      outcome: 'success',
    });
    expect(fact?.competencyContribution).toEqual({});
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'missing',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'unmanaged_learning_fact_context_only',
      },
    });
  });

  it('keeps second-based duration payloads as seconds in canonical facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'simulation-duration-seconds-001',
      actionType: 'simulation_finish',
      payload: {
        eventType: 'simulation_finish',
        moduleId: 'module-3',
        durationSeconds: 140,
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'simulation-duration-seconds-001',
      factType: 'simulation',
      timeSpent: 140,
    });
  });

  it('does not materialize raw parameter ticks or sync errors', () => {
    const rawTick = eventToLearningFactInput(createEvent({
      actionType: 'param_change',
      payload: {
        eventType: 'workspace_param_change',
        stepId: 'step-04',
        sampled: false,
      },
    }));
    const syncError = eventToLearningFactInput(createEvent({
      actionType: 'error',
      payload: {
        eventType: 'sync_error',
        stepId: 'step-04',
      },
    }));

    expect(rawTick).toBeNull();
    expect(syncError).toBeNull();
  });

  it('does not materialize knowledge card opens as LearningFacts', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'knowledge-card-open-001',
      actionType: 'knowledge_card_open',
      payload: {
        eventType: 'knowledge_card_open',
        nodeId: 'knowledge-card:feedback-loop',
        targetLabel: '反馈回路',
      },
    }));

    expect(fact).toBeNull();
  });

  it('materializes adaptive assessment evidence with privacy-safe references only', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'adaptive-assessment:answer-1',
      actionType: 'answer_submit',
      sessionId: 'adaptive-student-1',
      payload: {
        eventType: 'answer_submit',
        assessmentSource: 'adaptive_assessment',
        moduleId: 'adaptive-assessment',
        sessionId: 'adaptive-student-1',
        answerId: 'answer-1',
        questionId: 'preset-q-01',
        questionRefId: 'item-ref-1',
        selectedOptionKey: 'A',
        correctOptionKey: 'A',
        isCorrect: true,
        score: 100,
        durationSeconds: 42,
        knowledgeTags: ['pole-stability'],
        abilityEstimate: 2.1,
        masteryPosterior: 0.74,
        masteryConfidence: 0.82,
        confidence: 0.82,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        kaqQuizEvidence: {
          questionSnapshotId: 'question-snapshot:reviewed',
          quizSetId: 'kaq-quiz-set:control-correction:readiness-gate',
          questionId: 'preset-q-01',
          answerId: 'answer-1',
          sessionId: 'adaptive-student-1',
          attemptKey: 'adaptive-student-1:preset-q-01',
          scoringVersion: 'adaptive-assessment-bkt-v1',
          rubricVersion: 'kaq-quiz-foundation-bank.v1:rubric',
          denominator: 1,
          retryPolicy: { maxAttemptsAffectingMastery: 1, idempotencyScope: 'session-question' },
          eventSource: 'adaptive_assessment',
          eventType: 'answer_submit',
          sourceLogId: 'adaptive-assessment:answer-1',
          dedupeKey: 'adaptive-assessment:adaptive-student-1:preset-q-01',
          occurredAt: '2026-04-16T02:41:03.547Z',
          score: 100,
          isCorrect: true,
          confidence: { level: 'high', score: 1, basis: 'reviewed-question-bank' },
          reviewState: 'reviewed',
          reviewAudit: {
            state: 'reviewed',
            reviewerRole: 'assessment-content-reviewer',
            reviewedAt: '2026-06-24T00:00:00.000Z',
            reviewBatchId: 'kaq-quiz-foundation-bank.v1',
            sourceHash: 'hash',
            metadataVersionRef: 'kaq-quiz-foundation-bank.v1',
          },
          learningGoalIds: ['control-correction'],
          kaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
          knowledgeObjectiveIds: ['knowledge:autocontrol:controller-correction'],
          applicationObjectiveIds: ['capability:autocontrol:synthesize-controller-correction'],
          qualityObjectiveIds: ['quality:autocontrol:evidence-integrity'],
          graphNodeIds: ['kn:autocontrol:controller-correction'],
          capabilityTargetIds: ['capability:autocontrol:synthesize-controller-correction'],
          qualityTargetIds: ['quality:autocontrol:evidence-integrity'],
          learningFactEligible: true,
          readinessGateEligible: true,
          terminalValidationEligible: true,
          studentCompetencySnapshotEffect: 'update',
          versionRefs: TEST_KAQ_VERSION_REFS,
        },
        privacyLevel: 'restricted',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'adaptive-assessment:answer-1',
      factType: 'question',
      moduleId: 'adaptive-assessment',
      score: 100,
      outcome: 'success',
    });
    expect(fact?.contextJson).toMatchObject({
      adaptiveAssessment: {
        answerId: 'answer-1',
        questionId: 'preset-q-01',
        questionRefId: 'item-ref-1',
        selectedOptionKey: 'A',
        correctOptionKey: 'A',
        privacyLevel: 'restricted',
      },
      evidenceGovernance: {
        evidenceQuality: 'rich',
        policyReason: 'adaptive_assessment_evidence',
      },
    });
    expect(JSON.stringify(fact)).not.toContain('超调增大且振荡衰减变慢');
  });

  it('keeps adaptive assessment events without K/A/Q evidence as context-only facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'adaptive-assessment:legacy-answer-1',
      actionType: 'answer_submit',
      sessionId: 'adaptive-legacy-1',
      payload: {
        eventType: 'answer_submit',
        assessmentSource: 'adaptive_assessment',
        moduleId: 'adaptive-assessment',
        sessionId: 'adaptive-legacy-1',
        answerId: 'legacy-answer-1',
        questionId: 'preset-q-01',
        questionRefId: 'item-ref-legacy',
        selectedOptionKey: 'A',
        correctOptionKey: 'A',
        isCorrect: true,
        score: 100,
        durationSeconds: 30,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
      },
    }));

    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_missing_kaq_context_only',
      },
    });
    expect(fact?.competencyContribution).toEqual({});
  });

  it('keeps incomplete non-empty K/A/Q adaptive evidence as context-only facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'adaptive-assessment:malformed-answer-1',
      actionType: 'answer_submit',
      sessionId: 'adaptive-malformed-1',
      payload: {
        eventType: 'answer_submit',
        assessmentSource: 'adaptive_assessment',
        moduleId: 'adaptive-assessment',
        sessionId: 'adaptive-malformed-1',
        answerId: 'malformed-answer-1',
        questionId: 'preset-q-01',
        questionRefId: 'item-ref-malformed',
        selectedOptionKey: 'A',
        correctOptionKey: 'A',
        isCorrect: true,
        score: 100,
        durationSeconds: 30,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        kaqQuizEvidence: {
          questionSnapshotId: 'question-snapshot:malformed',
        },
      },
    }));

    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_missing_kaq_context_only',
      },
    });
    expect(fact?.competencyContribution).toEqual({});
  });

  it('requires complete governed K/A/Q evidence before assigning adaptive profile weight', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'adaptive-assessment:incomplete-reviewed-answer-1',
      actionType: 'answer_submit',
      sessionId: 'adaptive-incomplete-reviewed-1',
      payload: {
        eventType: 'answer_submit',
        assessmentSource: 'adaptive_assessment',
        moduleId: 'adaptive-assessment',
        sessionId: 'adaptive-incomplete-reviewed-1',
        answerId: 'incomplete-reviewed-answer-1',
        questionId: 'preset-q-01',
        questionRefId: 'item-ref-incomplete-reviewed',
        selectedOptionKey: 'A',
        correctOptionKey: 'A',
        isCorrect: true,
        score: 100,
        durationSeconds: 30,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        kaqQuizEvidence: {
          questionSnapshotId: 'question-snapshot:incomplete-reviewed',
          quizSetId: 'kaq-quiz-set:control-correction:readiness-gate',
          questionId: 'preset-q-01',
          answerId: 'incomplete-reviewed-answer-1',
          sessionId: 'adaptive-incomplete-reviewed-1',
          attemptKey: 'adaptive-incomplete-reviewed-1:preset-q-01',
          scoringVersion: 'adaptive-assessment-bkt-v1',
          rubricVersion: 'kaq-quiz-foundation-bank.v1:rubric',
          denominator: 1,
          retryPolicy: { maxAttemptsAffectingMastery: 1, idempotencyScope: 'session-question' },
          eventSource: 'adaptive_assessment',
          eventType: 'answer_submit',
          sourceLogId: 'adaptive-assessment:incomplete-reviewed-answer-1',
          dedupeKey: 'adaptive-assessment:adaptive-incomplete-reviewed-1:preset-q-01',
          occurredAt: '2026-04-16T02:41:03.547Z',
          confidence: { level: 'high', score: 1, basis: 'reviewed-question-bank' },
          reviewState: 'reviewed',
          reviewAudit: {
            state: 'reviewed',
            reviewerRole: 'assessment-content-reviewer',
            reviewedAt: '2026-06-24T00:00:00.000Z',
            reviewBatchId: 'kaq-quiz-foundation-bank.v1',
            sourceHash: 'hash',
            metadataVersionRef: 'kaq-quiz-foundation-bank.v1',
          },
          learningFactEligible: true,
          readinessGateEligible: true,
          terminalValidationEligible: true,
          studentCompetencySnapshotEffect: 'update',
        },
      },
    }));

    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_missing_kaq_context_only',
      },
    });
    expect(fact?.competencyContribution).toEqual({});
  });

  it('keeps K/A/Q adaptive evidence with empty governance strings as context-only facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'adaptive-assessment:empty-governance-answer-1',
      actionType: 'answer_submit',
      sessionId: 'adaptive-empty-governance-1',
      payload: {
        eventType: 'answer_submit',
        assessmentSource: 'adaptive_assessment',
        moduleId: 'adaptive-assessment',
        sessionId: 'adaptive-empty-governance-1',
        answerId: 'empty-governance-answer-1',
        questionId: 'preset-q-01',
        questionRefId: 'item-ref-empty-governance',
        selectedOptionKey: 'A',
        correctOptionKey: 'A',
        isCorrect: true,
        score: 100,
        durationSeconds: 30,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        kaqQuizEvidence: createGovernedKaqQuizEvidence({
          questionSnapshotId: '',
          sourceLogId: '   ',
          confidence: { level: '', score: 1, basis: 'reviewed-question-bank' },
          reviewAudit: {
            state: 'reviewed',
            reviewerRole: 'assessment-content-reviewer',
            reviewedAt: '2026-06-24T00:00:00.000Z',
            reviewBatchId: '',
            sourceHash: '',
            metadataVersionRef: 'kaq-quiz-foundation-bank.v1',
          },
        }),
      },
    }));

    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_missing_kaq_context_only',
      },
    });
    expect(fact?.competencyContribution).toEqual({});
  });

  it('keeps K/A/Q adaptive evidence without evidence score as context-only facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'adaptive-assessment:missing-score-answer-1',
      actionType: 'answer_submit',
      sessionId: 'adaptive-missing-score-1',
      payload: {
        eventType: 'answer_submit',
        assessmentSource: 'adaptive_assessment',
        moduleId: 'adaptive-assessment',
        sessionId: 'adaptive-missing-score-1',
        answerId: 'missing-score-answer-1',
        questionId: 'preset-q-01',
        questionRefId: 'item-ref-missing-score',
        selectedOptionKey: 'A',
        correctOptionKey: 'A',
        durationSeconds: 30,
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        kaqQuizEvidence: createGovernedKaqQuizEvidence({
          score: undefined,
          isCorrect: undefined,
        }),
      },
    }));

    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_missing_kaq_context_only',
      },
    });
    expect(fact?.competencyContribution).toEqual({});
  });

  it('keeps provisional K/A/Q adaptive evidence out of profile contribution and raw context', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'adaptive-assessment:generated-answer-1',
      actionType: 'answer_submit',
      sessionId: 'adaptive-generated-1',
      payload: {
        eventType: 'answer_submit',
        assessmentSource: 'adaptive_assessment',
        moduleId: 'adaptive-assessment',
        sessionId: 'adaptive-generated-1',
        answerId: 'generated-answer-1',
        questionId: 'generated-q-01',
        questionRefId: 'item-ref-generated',
        selectedOptionKey: 'A',
        correctOptionKey: 'A',
        isCorrect: true,
        score: 100,
        durationSeconds: 30,
        knowledgeTags: ['controller-tuning'],
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        kaqQuizEvidence: {
          questionSnapshotId: 'question-snapshot:generated',
          quizSetId: 'kaq-quiz-set:control-correction:practice',
          questionId: 'generated-q-01',
          answerId: 'generated-answer-1',
          sessionId: 'adaptive-generated-1',
          attemptKey: 'adaptive-generated-1:generated-q-01',
          scoringVersion: 'adaptive-assessment-bkt-v1',
          rubricVersion: 'kaq-quiz-foundation-bank.v1:rubric',
          denominator: 1,
          retryPolicy: { maxAttemptsAffectingMastery: 1, idempotencyScope: 'session-question' },
          eventSource: 'adaptive_assessment',
          eventType: 'answer_submit',
          sourceLogId: 'adaptive-assessment:generated-answer-1',
          dedupeKey: 'adaptive-assessment:adaptive-generated-1:generated-q-01',
          occurredAt: '2026-06-24T08:30:00.000Z',
          score: 100,
          isCorrect: true,
          confidence: { level: 'low', score: 0.45, basis: 'generated-question-provisional' },
          reviewState: 'provisional',
          reviewAudit: {
            state: 'provisional',
            reviewerRole: 'system-generator',
            reviewedAt: '2026-06-24T00:00:00.000Z',
            reviewBatchId: 'kaq-quiz-foundation-bank.v1',
            sourceHash: 'hash',
            metadataVersionRef: 'kaq-quiz-foundation-bank.v1',
            generationModel: 'rule-based-generator',
          },
          learningGoalIds: ['control-correction'],
          kaqObjectiveIds: ['knowledge:autocontrol:controller-correction'],
          graphNodeIds: ['kn:autocontrol:controller-correction'],
          capabilityTargetIds: ['capability:autocontrol:synthesize-controller-correction'],
          qualityTargetIds: ['quality:autocontrol:evidence-integrity'],
          learningFactEligible: false,
          readinessGateEligible: false,
          terminalValidationEligible: false,
          studentCompetencySnapshotEffect: 'no-op',
          outcomeRefs: ['quiz-outcome:control-correction:practice:generated-q-01'],
          remediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
          rawStem: '不应进入 context 的完整题干',
          rawAnswerBody: '不应进入 context 的答案正文',
        },
      },
    }));

    expect(fact?.contextJson).toMatchObject({
      adaptiveAssessment: {
        kaqQuizEvidence: {
          learningFactEligible: false,
          readinessGateEligible: false,
          terminalValidationEligible: false,
          studentCompetencySnapshotEffect: 'no-op',
          learningGoalIds: ['control-correction'],
        },
      },
      evidenceGovernance: {
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_provisional_context_only',
      },
    });
    expect(fact?.competencyContribution).toEqual({});
    expect(JSON.stringify(fact)).not.toContain('完整题干');
    expect(JSON.stringify(fact)).not.toContain('答案正文');
  });

  it('redacts raw interactive quiz answers from LearningFact context', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'interactive-quiz-redaction-001',
      actionType: 'submit',
      payload: {
        eventType: 'lesson_submit',
        stepId: 'step-04',
        lessonKey: 'unit-3-6-zero-design-workshop-v1',
        questionSummaries: [
          {
            questionId: 'card-1',
            stem: '完整中文题干：请解释相位裕度与超调量之间的关系。',
            studentAnswer: '学生原文：我认为应该直接提高比例系数。',
            referenceAnswer: '参考答案：相位裕度降低通常会增加超调风险。',
            isCorrect: false,
          },
        ],
      },
    }));

    const serialized = JSON.stringify(fact);
    expect(fact?.contextJson).toMatchObject({
      interactiveQuiz: {
        scoring: {
          supported: true,
          correctCount: 0,
          totalCount: 1,
        },
        cards: [
          {
            cardId: 'card-1',
            answered: true,
            isCorrect: false,
          },
        ],
      },
    });
    expect(serialized).not.toContain('完整中文题干');
    expect(serialized).not.toContain('学生原文');
    expect(serialized).not.toContain('参考答案');
  });

  it('marks unfinished session finalization as partial instead of success', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'client-event-finalize-001',
      actionType: 'complete',
      payload: {
        eventType: 'session_finalize',
        lessonKey: 'unit-3-7-steady-error-low-frequency-compensation-v1',
        currentStepId: 'step-12',
        finalStepId: 'step-12',
        finalStepIndex: 11,
        totalSteps: 17,
        completionRatio: 0.7059,
        endedBeforeAssessment: true,
        endedBeforeSummary: true,
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'client-event-finalize-001',
      factType: 'question',
      lessonId: 'unit-3-7-steady-error-low-frequency-compensation-v1',
      outcome: 'partial',
    });
  });

  it('preserves sourceLogId when materializing a fact from a persisted interaction log', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'interaction-log:log-001',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-3-6-zero-design-workshop-v1',
        sourceLogId: 'log-001',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'interaction-log:log-001',
      sourceLogId: 'log-001',
    });
  });

  it('keeps scored client submission evidence but rejects forged profile contributions', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-4-submit-001',
      actionType: 'submit',
      sessionId: 'session-4-4',
      source: 'system',
      derivedMetrics: { engineeringDecision: 0.9 },
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
        stepId: 'step-08',
        moduleId: 'step-08',
        score: 100,
        outcome: 'success',
        competencyContribution: {
          parameterDesign: 0.7,
          controlModeling: 0.4,
        },
        evidenceTitle: '4-4 step-08：目标函数与权重表达',
        questionSummaries: [
          {
            questionId: 'weight-preference',
            prompt: '若更担心动作代价继续抬高，更应优先保留哪一组偏好？',
            studentAnswer: 'C',
            referenceAnswer: 'C',
            isCorrect: true,
          },
        ],
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'unit-4-4-submit-001',
      factType: 'question',
      sessionId: 'session-4-4',
      moduleId: 'step-08',
      lessonId: 'unit-4-4-fixed-structure-optimization-modeling-v1',
      outcome: 'success',
      score: 100,
    });
    expect(fact?.competencyContribution).toEqual({});
    expect(fact?.contextJson).toMatchObject({
      interactiveQuiz: {
        cards: [
          expect.objectContaining({
            cardId: 'weight-preference',
            answered: true,
            isCorrect: true,
          }),
        ],
      },
    });
  });

  it('scores objective lesson submissions from per-card question summaries', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-001',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        evidenceQuality: 'rich',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        attemptKey: 'step-02:response:1778550642900',
        clientEventId: 'client-step-02-submit',
        sourceLogId: 'log-step-02-submit',
        questionSummaries: [
          {
            questionId: 'model-order',
            studentAnswer: 'A',
            referenceAnswer: 'A',
          },
          {
            questionId: 'disturbance-boundary',
            studentAnswer: 'B',
            referenceAnswer: 'A',
          },
        ],
      },
    }));

    expect(fact).toMatchObject({
      score: 50,
      outcome: 'partial',
      contextJson: {
        evidenceGovernance: {
          evidenceQuality: 'rich',
          profileWeight: 1,
          skipProfileContribution: false,
          policyReason: 'rich_objective_evidence',
        },
        interactiveQuiz: {
          lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
          stepId: 'step-02',
          attemptKey: 'step-02:response:1778550642900',
          clientEventId: 'client-step-02-submit',
          sourceLogId: 'log-step-02-submit',
          scoring: {
            supported: true,
            evidenceQuality: 'rich',
            answeredCount: 2,
            correctCount: 1,
            totalCount: 2,
            score: 50,
            basis: 'questionSummaries',
          },
          cards: [
            {
              cardId: 'model-order',
              isCorrect: true,
            },
            {
              cardId: 'disturbance-boundary',
              isCorrect: false,
            },
          ],
        },
      },
    });
    expect(JSON.stringify(fact)).not.toContain('studentAnswer');
    expect(JSON.stringify(fact)).not.toContain('referenceAnswer');
  });

  it('keeps unanswered objective cards in the scoring denominator', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-partial',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        questionSummaries: [
          {
            questionId: 'model-order',
            studentAnswer: 'a',
            referenceAnswer: '选 A。名义模型阶次应保留为二阶。',
            referenceValue: 'a',
            answered: true,
            isCorrect: true,
          },
          {
            questionId: 'disturbance-boundary',
            studentAnswer: null,
            referenceAnswer: '选 A。扰动边界不能忽略。',
            referenceValue: 'a',
            answered: false,
            isCorrect: false,
          },
        ],
      },
    }));

    expect(fact).toMatchObject({
      score: 50,
      outcome: 'partial',
      contextJson: {
        interactiveQuiz: {
          scoring: {
            supported: true,
            answeredCount: 1,
            correctCount: 1,
            totalCount: 2,
            score: 50,
          },
          cards: [
            {
              cardId: 'model-order',
              answered: true,
              isCorrect: true,
            },
            {
              cardId: 'disturbance-boundary',
              answered: false,
              isCorrect: false,
            },
          ],
        },
      },
    });
    const serialized = JSON.stringify(fact);
    expect(serialized).not.toContain('名义模型阶次');
    expect(serialized).not.toContain('扰动边界不能忽略');
  });

  it('uses versioned per-card partial scores when materializing objective facts', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-5-3-step-14-submit-partial',
      actionType: 'submit',
      sessionId: 'session-5-3',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        evidenceQuality: 'rich',
        lessonKey: 'unit-5-3-mass-coordination-chain-v1',
        stepId: 'step-14',
        questionSummaries: [
          {
            questionId: 'multi-evidence',
            responseKind: 'multi_select',
            studentAnswer: 'A|C',
            referenceValue: ['A', 'B'],
            answered: true,
            isCorrect: false,
            scoringVersion: 'manifest-objective-scoring/v1',
            score: 1 / 3,
            normalizedSubmitted: ['A', 'C'],
            normalizedReference: ['A', 'B'],
            scoringDetail: {
              correctHits: ['A'],
              missedCorrectOptions: ['B'],
              extraWrongOptions: ['C'],
            },
          },
        ],
      },
    }));

    expect(fact).toMatchObject({
      score: 33.3,
      outcome: 'failure',
      contextJson: {
        interactiveQuiz: {
          scoring: {
            supported: true,
            scoringVersion: 'manifest-objective-scoring/v1',
            totalScore: 1 / 3,
            totalCount: 1,
            score: 33.3,
          },
          cards: [
            {
              cardId: 'multi-evidence',
              score: 1 / 3,
              scoringVersion: 'manifest-objective-scoring/v1',
              normalizedSubmitted: ['A', 'C'],
              normalizedReference: ['A', 'B'],
              detail: {
                correctHits: ['A'],
                missedCorrectOptions: ['B'],
                extraWrongOptions: ['C'],
              },
            },
          ],
        },
      },
    });
  });

  it('keeps unsupported-only objective cards traceable without materialized scores', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-unsupported-card',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        evidenceQuality: 'missing',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        questionSummaries: [
          {
            questionId: 'model-order',
            responseKind: 'single_choice',
            answered: false,
            scoringVersion: 'manifest-objective-scoring/v1',
            normalizedSubmitted: null,
            normalizedReference: null,
            scoringDetail: {},
            unsupportedReason: 'missing_reference',
          },
        ],
      },
    }));

    expect(fact?.score).toBeUndefined();
    expect(fact?.contextJson).toMatchObject({
      interactiveQuiz: {
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        scoring: {
          supported: false,
          evidenceQuality: 'missing',
          answeredCount: 0,
          totalCount: 0,
          scoringVersion: 'manifest-objective-scoring/v1',
          basis: 'questionSummaries',
          reason: 'missing_reference',
        },
        cards: [
          {
            cardId: 'model-order',
            answered: false,
            scoringVersion: 'manifest-objective-scoring/v1',
            unsupportedReason: 'missing_reference',
          },
        ],
      },
    });
  });

  it('marks unsupported objective scoring explicitly instead of writing a zero score', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-unsupported',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        evidenceQuality: 'partial',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        attemptKey: 'step-02:response:1778550642999',
        answers: {
          'model-order': 'A',
        },
      },
    }));

    expect(fact?.score).toBeUndefined();
    expect(fact?.contextJson).toMatchObject({
      interactiveQuiz: {
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        scoring: {
          supported: false,
          evidenceQuality: 'partial',
          reason: 'missing_objective_answer_keys',
          answeredCount: 1,
        },
      },
    });
  });

  it('downgrades partial manifest submissions while keeping fact traceability', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-7-step-02-submit-answer-only',
      actionType: 'submit',
      sessionId: 'session-4-7',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
        stepId: 'step-02',
        answers: {
          'model-order': 'A',
        },
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'unit-4-7-step-02-submit-answer-only',
      factType: 'question',
      lessonId: 'unit-4-7-destroyer-hifi-design-closure-v1',
    });
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'partial',
        profileWeight: 0.25,
        skipProfileContribution: false,
        policyReason: 'partial_evidence_low_weight',
      },
    });
  });

  it('keeps missing manifest submissions traceable without profile contribution', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-5-1-missing-submit-001',
      actionType: 'submit',
      payload: {
        eventType: 'lesson_submit',
        schemaVersion: 'manifest-submission-v2',
        lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
        stepId: 'step-05',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'unit-5-1-missing-submit-001',
      lessonId: 'unit-5-1-linear-backbone-boundaries-v1',
    });
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'missing',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'missing_evidence_context_only',
      },
    });
  });

  it('does not materialize classroom completion facts from after-session events by default', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'late-submit-001',
      actionType: 'submit',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-3-7-steady-error-low-frequency-compensation-v1',
        afterSessionEnd: true,
      },
    }));

    expect(fact).toBeNull();
  });

  it('does not materialize lesson submits explicitly marked as non-governance evidence', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'unit-4-4-unsupported-submit-001',
      actionType: 'submit',
      payload: {
        eventType: 'lesson_submit',
        lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
        stepId: 'step-12',
        skipLearningFact: true,
      },
    }));

    expect(fact).toBeNull();
  });

  it('materializes client Arena evaluation completion as non-official context evidence', () => {
    const fact = eventToLearningFactInput(createEvent({
      eventId: 'arena-evaluation-001',
      actionType: 'arena_evaluation_complete',
      pagePath: '/arena/task-second-order-lead-pid',
      pageType: 'workspace',
      payload: {
        eventType: 'arena_evaluation_complete',
        taskId: 'task-second-order-lead-pid',
        score: 91,
        valid: true,
        method: 'pid',
      },
    }));

    expect(fact).toMatchObject({
      sourceEventId: 'arena-evaluation-001',
      factType: 'design',
      outcome: 'success',
      score: 91,
    });
    expect(fact?.competencyContribution).toEqual({});
    expect(fact?.contextJson).toMatchObject({
      evidenceGovernance: {
        evidenceQuality: 'partial',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'arena_client_evaluation_context_only',
      },
    });
  });

  it('does not materialize Arena open and view events as competency facts', () => {
    for (const eventType of [
      'arena_challenge_open',
      'arena_workspace_start',
      'arena_result_view',
      'arena_leaderboard_view',
      'arena_feedback_view',
    ]) {
      expect(eventToLearningFactInput(createEvent({
        eventId: `${eventType}-001`,
        actionType: eventType,
        pagePath: '/arena/task-second-order-lead-pid',
        pageType: 'workspace',
        payload: {
          eventType,
          taskId: 'task-second-order-lead-pid',
        },
      }))).toBeNull();
    }
  });
});
