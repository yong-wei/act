import { describe, expect, it } from 'vitest';

import {
  CONTROL_WORKBENCH_DIAGNOSTIC_POLICY,
  CONTROL_WORKBENCH_EVIDENCE_SCHEMA_VERSION,
  buildControlWorkbenchClientEvidenceDraft,
  buildControlWorkbenchEvidenceSample,
  buildControlWorkbenchTeacherDiagnostics,
  materializeControlWorkbenchEvidenceFromSubmissionPayload,
  materializeControlWorkbenchEvidenceSample,
} from '@/features/interactive/shared/manifest-runtime/control-workbench-evidence';

describe('control workbench evidence contract', () => {
  it('builds the unified evidence sample with trusted source log and workbench payload fields', () => {
    const sample = buildControlWorkbenchEvidenceSample({
      eventType: 'lesson_submit',
      clientEventId: 'client-1',
      attemptKey: 'step-04:attempt-1',
      sourceLogId: 'log-trusted-1',
      lessonKey: 'unit-4-2-controller-selection-first-start-v1',
      stepId: 'step-04',
      moduleId: 'frequency-workbench',
      componentId: 'frequency-workbench',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      capabilityId: 'control-frequency-reading-workbench',
      visiblePanelIds: ['bode', 'nyquist'],
      parameterSnapshot: { kp: 1.2, phaseMargin: 48, observationText: 'student free text' },
      selectedDesignState: { candidate: 'lag', nested: { note: 'private note' } },
      derivedResultRefs: [{ kind: 'InteractionLog', id: 'log-trusted-1' }],
      answerPayload: { judgment: 'safe-margin', answerText: 'student explanation' },
      releaseState: 'released',
      fallbackState: 'supported',
      classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
      serverRecordedAt: '2026-06-18T00:00:01.000Z',
    });

    expect(sample).toMatchObject({
      eventType: 'lesson_submit',
      clientEventId: 'client-1',
      attemptKey: 'step-04:attempt-1',
      sourceLogId: 'log-trusted-1',
      lessonKey: 'unit-4-2-controller-selection-first-start-v1',
      stepId: 'step-04',
      moduleId: 'frequency-workbench',
      componentKind: 'compute.panel',
      componentId: 'frequency-workbench',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      schemaVersion: CONTROL_WORKBENCH_EVIDENCE_SCHEMA_VERSION,
      payload: {
        capabilityId: 'control-frequency-reading-workbench',
        visiblePanelIds: ['bode', 'nyquist'],
        parameterSnapshot: { kp: 1.2, phaseMargin: 48, observationText: '[redacted]' },
        selectedDesignState: { candidate: 'lag', nested: { note: '[redacted]' } },
        derivedResultRefs: [{ kind: 'InteractionLog', id: 'log-trusted-1' }],
        answerPayload: { judgment: 'safe-margin', answerText: '[redacted]' },
        releaseState: 'released',
        fallbackState: 'supported',
        classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
    });
  });

  it('keeps source log materialization on the server side', () => {
    const draft = buildControlWorkbenchClientEvidenceDraft({
      eventType: 'lesson_submit',
      clientEventId: 'client-2',
      attemptKey: 'step-04:attempt-1',
      lessonKey: 'unit-4-2-controller-selection-first-start-v1',
      stepId: 'step-04',
      moduleId: 'frequency-workbench',
      componentId: 'frequency-workbench',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      capabilityId: 'control-frequency-reading-workbench',
      visiblePanelIds: ['bode', 'nyquist'],
      parameterSnapshot: { kp: 1.2 },
      answerPayload: { comment: 'needs review' },
      releaseState: 'released',
      fallbackState: 'supported',
    });

    expect('sourceLogId' in draft).toBe(false);
    expect(draft.payload.answerPayload).toEqual({ comment: '[redacted]' });

    const materialized = materializeControlWorkbenchEvidenceSample({
      draft,
      trustedSourceLogId: 'log-trusted-2',
      serverRecordedAt: '2026-06-18T00:00:01.000Z',
    });

    expect(materialized.sourceLogId).toBe('log-trusted-2');
    expect(materialized.payload.serverRecordedAt).toBe('2026-06-18T00:00:01.000Z');
  });

  it('materializes a workbench draft from a manifest submission payload with server trust fields', () => {
    const draft = buildControlWorkbenchClientEvidenceDraft({
      eventType: 'lesson_submit',
      clientEventId: 'client-3',
      attemptKey: 'step-04:attempt-1',
      lessonKey: 'unit-4-2-controller-selection-first-start-v1',
      stepId: 'step-04',
      moduleId: 'frequency-workbench',
      componentId: 'frequency-workbench',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      capabilityId: 'control-frequency-reading-workbench',
      visiblePanelIds: ['bode'],
      parameterSnapshot: { kp: 1.2 },
      releaseState: 'released',
      fallbackState: 'supported',
    });

    const materialized = materializeControlWorkbenchEvidenceFromSubmissionPayload(
      {
        answerDigest: {
          'parameter.set': JSON.stringify(draft),
        },
      },
      {
        trustedSourceLogId: 'log-trusted-3',
        serverRecordedAt: '2026-06-18T00:00:02.000Z',
      },
    );

    expect(materialized).toMatchObject({
      sourceLogId: 'log-trusted-3',
      payload: {
        capabilityId: 'control-frequency-reading-workbench',
        serverRecordedAt: '2026-06-18T00:00:02.000Z',
      },
    });
  });

  it('reapplies redaction when the server materializes an untrusted client draft', () => {
    const rawDraft = {
      eventType: 'lesson_submit',
      clientEventId: 'client-4',
      attemptKey: 'step-04:attempt-1',
      lessonKey: 'unit-4-2-controller-selection-first-start-v1',
      stepId: 'step-04',
      moduleId: 'frequency-workbench',
      componentKind: 'compute.panel',
      componentId: 'frequency-workbench',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      schemaVersion: CONTROL_WORKBENCH_EVIDENCE_SCHEMA_VERSION,
      payload: {
        capabilityId: 'control-frequency-reading-workbench',
        visiblePanelIds: ['bode'],
        parameterSnapshot: { kp: 1.2, nested: { note: 'raw private note' } },
        selectedDesignState: null,
        derivedResultRefs: [],
        answerPayload: { answerText: 'raw student explanation' },
        releaseState: 'released',
        fallbackState: 'supported',
        classification: ['InteractionLog', 'StudentStepResponse'],
        serverRecordedAt: null,
      },
    };

    const materialized = materializeControlWorkbenchEvidenceFromSubmissionPayload(
      { answerDigest: { 'parameter.set': JSON.stringify(rawDraft) } },
      {
        trustedSourceLogId: 'log-trusted-4',
        serverRecordedAt: '2026-06-18T00:00:02.000Z',
      },
    );

    expect(materialized?.payload.parameterSnapshot).toEqual({ kp: 1.2, nested: { note: '[redacted]' } });
    expect(materialized?.payload.answerPayload).toEqual({ answerText: '[redacted]' });
  });

  it('summarizes teacher diagnostics with explicit denominator, dedupe, and redaction policy', () => {
    const diagnostics = buildControlWorkbenchTeacherDiagnostics([
      {
        actorId: 'student-a',
        actorRole: 'student',
        lessonKey: 'unit-4-2-controller-selection-first-start-v1',
        stepId: 'step-04',
        moduleId: 'frequency-workbench',
        viewed: true,
        submitted: false,
        releaseState: 'released',
        fallbackState: 'supported',
        touchedParameterIds: ['kp'],
        attemptKey: 'a1',
        clientEventId: 'client-a1',
        clientEventAt: '2026-06-18T00:00:10.000Z',
        serverRecordedAt: '2026-06-18T00:00:10.000Z',
      },
      {
        actorId: 'student-a',
        actorRole: 'student',
        lessonKey: 'unit-4-2-controller-selection-first-start-v1',
        stepId: 'step-04',
        moduleId: 'frequency-workbench',
        viewed: true,
        submitted: true,
        releaseState: 'released',
        fallbackState: 'supported',
        touchedParameterIds: ['kp', 'ki'],
        judgmentOutcome: 'safe-margin',
        attemptKey: 'a2',
        clientEventId: 'client-a2',
        clientEventAt: '2026-06-18T00:00:05.000Z',
        serverRecordedAt: '2026-06-18T00:00:20.000Z',
      },
      {
        actorId: 'student-b',
        actorRole: 'student',
        lessonKey: 'unit-4-2-controller-selection-first-start-v1',
        stepId: 'step-04',
        moduleId: 'frequency-workbench',
        viewed: true,
        submitted: false,
        releaseState: 'unreleased',
        fallbackState: 'unsupported',
        touchedParameterIds: [],
        attemptKey: 'b1',
        clientEventId: 'client-b1',
      },
    ]);

    expect(diagnostics.policy).toBe(CONTROL_WORKBENCH_DIAGNOSTIC_POLICY);
    expect(diagnostics).toMatchObject({
      viewedCount: 2,
      submittedCount: 1,
      releasedCount: 1,
      fallbackCount: 0,
      unsupportedCount: 1,
      parameterCoverage: [
        { parameterId: 'ki', count: 1 },
        { parameterId: 'kp', count: 1 },
      ],
      judgmentOutcomes: [{ outcome: 'safe-margin', count: 1 }],
      latestAttemptKeys: ['a2', 'b1'],
    });
    expect(diagnostics.policy.access).toBe('teacher-admin-only');
    expect(diagnostics.policy.freeTextRedaction).toBe('redact-by-default');
  });
});
