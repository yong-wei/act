import { describe, expect, it } from 'vitest';

import {
  ANNOTATED_MEDIA_DIAGNOSTIC_POLICY,
  ANNOTATED_MEDIA_EVIDENCE_SCHEMA_VERSION,
  buildAnnotatedMediaClientEvidenceDraft,
  buildAnnotatedMediaEvidenceSample,
  buildAnnotatedMediaTeacherDiagnostics,
  canViewAnnotatedMediaTeacherDiagnostics,
  materializeAnnotatedMediaEvidenceSample,
} from '@/features/interactive/shared/manifest-runtime/annotated-media-evidence';

describe('annotated media evidence contract', () => {
  it('builds governed media submission evidence with hotspot payload and top-level governance fields', () => {
    const sample = buildAnnotatedMediaEvidenceSample({
      eventType: 'media_submit',
      clientEventId: 'client-media-1',
      attemptKey: 'step-05:student-a:attempt-1',
      sourceLogId: 'trusted-media-log-1',
      lessonKey: 'annotated-media-fixture',
      stepId: 'step-05',
      moduleId: 'annotated-media',
      componentKind: 'visual.annotatedMedia',
      componentId: 'closed-loop-media',
      actorRole: 'student',
      clientEventAt: '2026-06-18T01:00:00.000Z',
      mediaId: 'closed-loop-media',
      activeRevealState: 'evidence-reveal',
      selectedAnnotationIds: ['input-hotspot', 'output-hotspot'],
      omittedRequiredAnnotationIds: ['risk-hotspot'],
      evidenceRoles: {
        'input-hotspot': 'input',
        'output-hotspot': 'output',
        'risk-hotspot': 'risk',
      },
      embeddedActivityAnchorId: 'media-choice-anchor',
      answerPayload: { responseContractId: 'choice.single', selectedAnswerId: 'input-hotspot' },
      teachingLabels: {
        'input-hotspot': '输入信号',
        'output-hotspot': '输出响应',
        'risk-hotspot': '反馈风险',
      },
      feedback: {
        misconceptionTagIds: ['missed-risk-hotspot'],
        studentFeedbackMode: 'hint',
        teacherNextPrompt: '请补充风险证据。',
        reviewAction: 'review',
      },
      classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
      serverRecordedAt: '2026-06-18T01:00:01.000Z',
    });

    expect(sample).toMatchObject({
      eventType: 'media_submit',
      sourceLogId: 'trusted-media-log-1',
      schemaVersion: ANNOTATED_MEDIA_EVIDENCE_SCHEMA_VERSION,
      serverRecordedAt: '2026-06-18T01:00:01.000Z',
      classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
      affectsTeacherDiagnostics: true,
      affectsAbilitySnapshots: true,
      affectsRecommendationInputs: true,
      payload: {
        mediaId: 'closed-loop-media',
        selectedAnnotationIds: ['input-hotspot', 'output-hotspot'],
        omittedRequiredAnnotationIds: ['risk-hotspot'],
        embeddedActivityAnchorId: 'media-choice-anchor',
        classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
        serverRecordedAt: '2026-06-18T01:00:01.000Z',
      },
    });
  });

  it('keeps trusted source log and server timestamp server-side for client drafts', () => {
    const draft = buildAnnotatedMediaClientEvidenceDraft({
      eventType: 'activity_answer',
      clientEventId: 'client-media-2',
      attemptKey: 'step-05:student-a:attempt-2',
      lessonKey: 'annotated-media-fixture',
      stepId: 'step-05',
      moduleId: 'embedded-activity',
      componentKind: 'visual.embedded-activity',
      componentId: 'media-choice',
      actorRole: 'student',
      clientEventAt: '2026-06-18T01:00:00.000Z',
      mediaId: 'closed-loop-media',
      activeRevealState: 'embedded-activity',
      selectedAnnotationIds: [],
      omittedRequiredAnnotationIds: [],
      evidenceRoles: {},
      embeddedActivityAnchorId: 'media-choice-anchor',
      answerPayload: { responseContractId: 'choice.single', selectedAnswerId: 'output-hotspot' },
      teachingLabels: { 'media-choice-anchor': '图上判断' },
    });

    expect('sourceLogId' in draft).toBe(false);
    expect(draft.classification).toEqual(['InteractionLog', 'StudentStepResponse']);
    expect(draft.payload.serverRecordedAt).toBeNull();

    const materialized = materializeAnnotatedMediaEvidenceSample({
      draft,
      trustedSourceLogId: 'trusted-media-log-2',
      serverRecordedAt: '2026-06-18T01:00:02.000Z',
    });

    expect(materialized.sourceLogId).toBe('trusted-media-log-2');
    expect(materialized.serverRecordedAt).toBe('2026-06-18T01:00:02.000Z');
    expect(materialized.payload.serverRecordedAt).toBe('2026-06-18T01:00:02.000Z');
  });

  it('aligns diagnostics policy and access helper with teacher/admin-only aggregation', () => {
    expect(ANNOTATED_MEDIA_DIAGNOSTIC_POLICY).toMatchObject({
      denominator: 'latest-attempt-per-student',
      dedupeKey: 'actorId:lessonKey:stepId:moduleId:attemptKey',
      resubmissionDisplay: 'latest-with-history-count',
      unreleasedStudentInclusion: 'include-as-unreleased-unvisited',
      freeTextRedaction: 'redact-by-default',
      access: 'teacher-admin-only',
      labelsUseTeachingSemantics: true,
    });
    expect(canViewAnnotatedMediaTeacherDiagnostics('teacher')).toBe(true);
    expect(canViewAnnotatedMediaTeacherDiagnostics('admin')).toBe(true);
    expect(canViewAnnotatedMediaTeacherDiagnostics('student')).toBe(false);
    expect(canViewAnnotatedMediaTeacherDiagnostics('guest')).toBe(false);
  });

  it('aggregates selected, omitted, and evidence-role diagnostics with teaching labels', () => {
    const diagnostics = buildAnnotatedMediaTeacherDiagnostics([
      {
        ...diagnosticEventBase(),
        actorId: 'student-a',
        selectedAnnotationIds: ['input-hotspot'],
        omittedRequiredAnnotationIds: ['risk-hotspot'],
        evidenceRoles: { 'input-hotspot': 'input' },
        teachingLabels: {
          'input-hotspot': '输入信号',
          'risk-hotspot': '反馈风险',
        },
        attemptKey: 'student-a:1',
        clientEventId: 'event-a',
        serverRecordedAt: '2026-06-18T01:00:01.000Z',
      },
      {
        ...diagnosticEventBase(),
        actorId: 'student-b',
        selectedAnnotationIds: ['input-hotspot', 'output-hotspot'],
        omittedRequiredAnnotationIds: [],
        evidenceRoles: { 'input-hotspot': 'input', 'output-hotspot': 'output' },
        teachingLabels: {
          'input-hotspot': '输入信号',
          'output-hotspot': '输出响应',
        },
        misconceptionTagIds: ['missed-output-evidence'],
        attemptKey: 'student-b:1',
        clientEventId: 'event-b',
        serverRecordedAt: '2026-06-18T01:00:02.000Z',
      },
    ]);

    expect(diagnostics.viewedCount).toBe(2);
    expect(diagnostics.submittedCount).toBe(2);
    expect(diagnostics.selectedAnnotationDistribution).toEqual([
      { annotationId: 'input-hotspot', label: '输入信号', count: 2 },
      { annotationId: 'output-hotspot', label: '输出响应', count: 1 },
    ]);
    expect(diagnostics.omittedRequiredAnnotationDistribution).toEqual([
      { annotationId: 'risk-hotspot', label: '反馈风险', count: 1 },
    ]);
    expect(diagnostics.evidenceRoleConfusionDistribution).toEqual([
      { evidenceRole: 'input', label: 'input', count: 2 },
      { evidenceRole: 'output', label: 'output', count: 1 },
    ]);
  });
});

function diagnosticEventBase() {
  return {
    actorId: 'student-a',
    actorRole: 'student' as const,
    lessonKey: 'annotated-media-fixture',
    stepId: 'step-05',
    moduleId: 'annotated-media',
    mediaId: 'closed-loop-media',
    viewed: true,
    submitted: true,
    activeRevealState: 'evidence-reveal',
    selectedAnnotationIds: [],
    omittedRequiredAnnotationIds: [],
    evidenceRoles: {},
    teachingLabels: {},
    misconceptionTagIds: [],
    attemptKey: 'student-a:1',
    clientEventId: 'event-base',
  };
}
