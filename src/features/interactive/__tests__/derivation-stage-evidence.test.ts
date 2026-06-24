import { describe, expect, it } from 'vitest';

import {
  DERIVATION_STAGE_DIAGNOSTIC_POLICY,
  DERIVATION_STAGE_EVIDENCE_SCHEMA_VERSION,
  buildDerivationStageClientEvidenceDraft,
  buildDerivationStageEvidenceSample,
  buildDerivationStageTeacherDiagnostics,
  materializeDerivationStageEvidenceSample,
  type DerivationStageEvidenceClassification,
} from '@/features/interactive/shared/manifest-runtime/derivation-stage-evidence';

describe('derivation stage evidence contract', () => {
  it('builds reveal-context evidence with trusted source log and formula focus fields', () => {
    const sample = buildDerivationStageEvidenceSample({
      eventType: 'derivation_answer',
      clientEventId: 'client-derivation-1',
      attemptKey: 'step-03:student-a:attempt-1',
      sourceLogId: 'trusted-derivation-log-1',
      lessonKey: 'derivation-stage-fixture',
      stepId: 'step-03',
      moduleId: 'derivation-stage',
      componentId: 'nonlinear-derivation-stage',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'dark',
      viewport: 'desktop',
      stageId: 'nonlinear-derivation-stage',
      activeRevealStepId: 'step-middle-block',
      maxRevealStepSeen: 3,
      visitedRevealStepIds: ['step-lower-left', 'step-upper-right', 'step-middle-block'],
      formulaBlockFocusEvents: [
        {
          formulaBlockId: 'cancel-term',
          revealStepId: 'step-middle-block',
          focusedAt: '2026-06-18T00:00:00.200Z',
        },
      ],
      activeHighlightIds: ['cancel-term'],
      answersByRevealStep: [
        {
          revealStepId: 'step-middle-block',
          formulaBlockIds: ['cancel-term', 'result-block'],
          answerText: '分母项决定闭环稳定性。',
          submittedAt: '2026-06-18T00:00:00.500Z',
          feedback: {
            misconceptionTagIds: ['missed-denominator'],
            studentFeedbackMode: 'hint',
            teacherNextPrompt: '说明分母为零的含义。',
            reviewAction: 'retry',
          },
        },
      ],
      classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
      serverRecordedAt: '2026-06-18T00:00:01.000Z',
    });

    expect(sample).toMatchObject({
      eventType: 'derivation_answer',
      clientEventId: 'client-derivation-1',
      attemptKey: 'step-03:student-a:attempt-1',
      sourceLogId: 'trusted-derivation-log-1',
      lessonKey: 'derivation-stage-fixture',
      stepId: 'step-03',
      moduleId: 'derivation-stage',
      componentKind: 'visual.derivationStage',
      componentId: 'nonlinear-derivation-stage',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'dark',
      viewport: 'desktop',
      schemaVersion: DERIVATION_STAGE_EVIDENCE_SCHEMA_VERSION,
      payload: {
        stageId: 'nonlinear-derivation-stage',
        activeRevealStepId: 'step-middle-block',
        maxRevealStepSeen: 3,
        visitedRevealStepIds: ['step-lower-left', 'step-upper-right', 'step-middle-block'],
        activeHighlightIds: ['cancel-term'],
        classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
    });
    expect(sample.payload.formulaBlockFocusEvents[0]).toMatchObject({
      formulaBlockId: 'cancel-term',
      revealStepId: 'step-middle-block',
    });
    expect(sample.payload.answersByRevealStep[0]?.feedback?.misconceptionTagIds).toEqual(['missed-denominator']);
  });

  it('keeps source log and server timestamp materialization server-side', () => {
    const draft = buildDerivationStageClientEvidenceDraft({
      eventType: 'formula_focus',
      clientEventId: 'client-derivation-2',
      attemptKey: 'step-03:student-a:attempt-1',
      lessonKey: 'derivation-stage-fixture',
      stepId: 'step-03',
      moduleId: 'derivation-stage',
      componentId: 'nonlinear-derivation-stage',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light',
      viewport: 'mobile',
      stageId: 'nonlinear-derivation-stage',
      activeRevealStepId: 'step-lower-left',
      maxRevealStepSeen: 1,
      visitedRevealStepIds: ['step-lower-left'],
      formulaBlockFocusEvents: [],
      activeHighlightIds: [],
      answersByRevealStep: [],
    });

    expect('sourceLogId' in draft).toBe(false);
    expect(draft.payload.serverRecordedAt).toBeNull();

    const materialized = materializeDerivationStageEvidenceSample({
      draft,
      trustedSourceLogId: 'trusted-derivation-log-2',
      serverRecordedAt: '2026-06-18T00:00:02.000Z',
    });

    expect(materialized.sourceLogId).toBe('trusted-derivation-log-2');
    expect(materialized.payload.serverRecordedAt).toBe('2026-06-18T00:00:02.000Z');
  });

  it('defaults answer drafts to StudentStepResponse instead of passive interaction-only evidence', () => {
    const draft = buildDerivationStageClientEvidenceDraft({
      eventType: 'derivation_answer',
      clientEventId: 'client-derivation-answer-default',
      attemptKey: 'step-03:student-a:attempt-2',
      lessonKey: 'derivation-stage-fixture',
      stepId: 'step-03',
      moduleId: 'derivation-stage',
      componentId: 'nonlinear-derivation-stage',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light',
      viewport: 'desktop',
      stageId: 'nonlinear-derivation-stage',
      activeRevealStepId: 'step-middle-block',
      maxRevealStepSeen: 3,
      visitedRevealStepIds: ['step-lower-left', 'step-upper-right', 'step-middle-block'],
      formulaBlockFocusEvents: [],
      activeHighlightIds: [],
      answersByRevealStep: [
        {
          revealStepId: 'step-middle-block',
          formulaBlockIds: ['cancel-term'],
          answerText: '闭环分母为零对应特征方程。',
          submittedAt: '2026-06-18T00:00:00.500Z',
        },
      ],
    });

    expect(draft.payload.classification).toEqual(['InteractionLog', 'StudentStepResponse']);
  });

  it('rejects answer evidence that omits StudentStepResponse classification', () => {
    expect(() => buildDerivationStageEvidenceSample({
      eventType: 'derivation_answer',
      clientEventId: 'client-derivation-answer-invalid',
      attemptKey: 'step-03:student-a:attempt-3',
      sourceLogId: 'trusted-derivation-log-invalid',
      lessonKey: 'derivation-stage-fixture',
      stepId: 'step-03',
      moduleId: 'derivation-stage',
      componentId: 'nonlinear-derivation-stage',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light',
      viewport: 'desktop',
      stageId: 'nonlinear-derivation-stage',
      activeRevealStepId: 'step-middle-block',
      maxRevealStepSeen: 3,
      visitedRevealStepIds: ['step-lower-left', 'step-upper-right', 'step-middle-block'],
      formulaBlockFocusEvents: [],
      activeHighlightIds: [],
      answersByRevealStep: [
        {
          revealStepId: 'step-middle-block',
          formulaBlockIds: ['cancel-term'],
          answerText: '闭环分母为零对应特征方程。',
          submittedAt: '2026-06-18T00:00:00.500Z',
        },
      ],
      classification: ['InteractionLog'],
    })).toThrow('derivation_answer evidence must include StudentStepResponse classification');
  });


  it('rejects mastery classification for passive view, focus, and teacher reveal events', () => {
    const passiveBase = {
      clientEventId: 'client-derivation-3',
      attemptKey: 'step-03:student-a:attempt-1',
      sourceLogId: 'trusted-derivation-log-3',
      lessonKey: 'derivation-stage-fixture',
      stepId: 'step-03',
      moduleId: 'derivation-stage',
      componentId: 'nonlinear-derivation-stage',
      actorRole: 'student' as const,
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light' as const,
      viewport: 'desktop' as const,
      stageId: 'nonlinear-derivation-stage',
      activeRevealStepId: 'step-lower-left',
      maxRevealStepSeen: 1,
      visitedRevealStepIds: ['step-lower-left'],
      formulaBlockFocusEvents: [],
      activeHighlightIds: [],
      answersByRevealStep: [],
      classification: ['InteractionLog', 'LearningFact'] as DerivationStageEvidenceClassification[],
    };

    expect(() => buildDerivationStageEvidenceSample({
      ...passiveBase,
      eventType: 'derivation_view',
    })).toThrow('derivation_view evidence cannot be classified as LearningFact');
    expect(() => buildDerivationStageEvidenceSample({
      ...passiveBase,
      eventType: 'formula_focus',
    })).toThrow('formula_focus evidence cannot be classified as LearningFact');
    expect(() => buildDerivationStageEvidenceSample({
      ...passiveBase,
      actorRole: 'teacher',
      eventType: 'teacher_reveal',
    })).toThrow('teacher_reveal evidence cannot be classified as LearningFact');
  });

  it('summarizes teacher diagnostics by reveal step, formula focus, and misconceptions', () => {
    const diagnostics = buildDerivationStageTeacherDiagnostics([
      {
        actorId: 'student-a',
        actorRole: 'student',
        lessonKey: 'derivation-stage-fixture',
        stepId: 'step-03',
        moduleId: 'derivation-stage',
        viewed: true,
        released: true,
        visitedRevealStepIds: ['step-lower-left', 'step-upper-right'],
        maxRevealStepSeen: 2,
        formulaBlockFocusIds: ['known-g'],
        answersByRevealStep: [],
        misconceptionTagIds: [],
        attemptKey: 'student-a:1',
        clientEventId: 'event-a',
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
      {
        actorId: 'student-b',
        actorRole: 'student',
        lessonKey: 'derivation-stage-fixture',
        stepId: 'step-03',
        moduleId: 'derivation-stage',
        viewed: true,
        released: true,
        visitedRevealStepIds: ['step-lower-left', 'step-upper-right', 'step-middle-block'],
        maxRevealStepSeen: 3,
        formulaBlockFocusIds: ['known-g', 'cancel-term'],
        answersByRevealStep: [
          {
            revealStepId: 'step-middle-block',
            formulaBlockIds: ['cancel-term'],
            answerText: '忽略了分母为零。',
            submittedAt: '2026-06-18T00:00:02.000Z',
            feedback: {
              misconceptionTagIds: ['missed-denominator'],
              studentFeedbackMode: 'hint',
              teacherNextPrompt: '回到闭环分母。',
              reviewAction: 'retry',
            },
          },
        ],
        misconceptionTagIds: [],
        attemptKey: 'student-b:1',
        clientEventId: 'event-b',
        serverRecordedAt: '2026-06-18T00:00:02.000Z',
      },
    ], ['step-lower-left', 'step-upper-right', 'step-middle-block']);

    expect(diagnostics).toEqual({
      policy: DERIVATION_STAGE_DIAGNOSTIC_POLICY,
      viewedCount: 2,
      submittedCount: 1,
      revealStepDistribution: [
        { revealStepId: 'step-lower-left', count: 2 },
        { revealStepId: 'step-upper-right', count: 2 },
        { revealStepId: 'step-middle-block', count: 1 },
      ],
      unvisitedRevealStepCount: 1,
      formulaBlockFocusDistribution: [
        { formulaBlockId: 'known-g', count: 2 },
        { formulaBlockId: 'cancel-term', count: 1 },
      ],
      misconceptionsByRevealStep: [
        { revealStepId: 'step-middle-block', misconceptionTagId: 'missed-denominator', count: 1 },
      ],
      latestAttemptKeys: ['student-a:1', 'student-b:1'],
    });
  });
});
