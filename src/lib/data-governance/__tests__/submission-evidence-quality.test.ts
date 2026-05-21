import { describe, expect, it } from 'vitest';

import {
  createSubmissionEvidenceQualityCounts,
  resolveSubmissionPayloadEvidenceQuality,
  summarizeSubmissionEvidencePayload,
} from '../submission-evidence-quality';

describe('submission evidence quality', () => {
  it('classifies scoreable manifest objective evidence as rich', () => {
    const summary = summarizeSubmissionEvidencePayload({
      schemaVersion: 'manifest-submission-v2',
      answers: { q1: 'A' },
      score: 100,
      questionSummaries: [
        { questionId: 'q1', studentAnswer: 'A', referenceValue: 'A', isCorrect: true },
      ],
    });

    expect(summary).toMatchObject({
      quality: 'rich',
      payloadEvidenceQuality: 'rich',
      reason: 'scoreable_objective_evidence',
      sourceState: 'manifest-submission-v2',
      hasAnswerEvidence: true,
      hasScoreEvidence: true,
      hasQuestionSummaryEvidence: true,
      hasScoreableObjectiveEvidence: true,
      scoreableObjectiveSubmissions: 1,
    });
  });

  it('classifies subjective answers without scoreable objective context as partial', () => {
    const summary = summarizeSubmissionEvidencePayload({
      schemaVersion: 'manifest-submission-v2',
      answers: { reflection: '需要先判断非线性影响范围' },
      subjectiveCompleteness: {
        answeredCount: 1,
        totalCount: 1,
        complete: true,
      },
    });

    expect(summary).toMatchObject({
      quality: 'partial',
      payloadEvidenceQuality: 'partial',
      reason: 'subjective_or_answer_evidence_without_score',
      hasAnswerEvidence: true,
      hasSubjectiveEvidence: true,
      scoreableObjectiveSubmissions: 0,
    });
  });

  it('classifies parameter evidence without answers as partial', () => {
    const summary = summarizeSubmissionEvidencePayload({
      schemaVersion: 'manifest-submission-v2',
      parameterSnapshots: { kp: 2.5, ki: 0.2 },
    });

    expect(summary).toMatchObject({
      quality: 'partial',
      payloadEvidenceQuality: 'partial',
      reason: 'parameter_or_extra_evidence_without_score',
      hasParameterEvidence: true,
      hasAnswerEvidence: false,
    });
  });

  it('classifies empty manifest envelopes as missing', () => {
    const summary = summarizeSubmissionEvidencePayload({
      schemaVersion: 'manifest-submission-v2',
      answers: {},
      questionSummaries: [],
    });

    expect(summary).toMatchObject({
      quality: 'missing',
      payloadEvidenceQuality: 'missing',
      reason: 'missing_manifest_evidence',
      sourceState: 'manifest-submission-v2',
    });
  });

  it('does not count null objective question answers as answer evidence', () => {
    const summary = summarizeSubmissionEvidencePayload({
      schemaVersion: 'manifest-submission-v2',
      questionSummaries: [
        {
          questionId: 'disturbance-boundary',
          studentAnswer: null,
          referenceValue: 'a',
          answered: false,
          isCorrect: false,
        },
      ],
    });

    expect(summary).toMatchObject({
      quality: 'partial',
      payloadEvidenceQuality: 'partial',
      hasAnswerEvidence: false,
      hasQuestionSummaryEvidence: true,
      hasScoreableObjectiveEvidence: true,
      answerCount: 0,
      scoreableObjectiveSubmissions: 1,
    });
  });

  it('preserves score-only manifest submissions as partial evidence', () => {
    const summary = summarizeSubmissionEvidencePayload({
      schemaVersion: 'manifest-submission-v2',
      score: 72.5,
    });

    expect(summary).toMatchObject({
      quality: 'partial',
      payloadEvidenceQuality: 'partial',
      reason: 'score_without_answer_evidence',
      hasAnswerEvidence: false,
      hasScoreEvidence: true,
      answerCount: 0,
      score: 72.5,
    });
  });

  it('classifies unsupported legacy envelopes explicitly', () => {
    const summary = summarizeSubmissionEvidencePayload({
      eventType: 'lesson_submit',
      stepId: 'step-03',
    });

    expect(summary).toMatchObject({
      quality: 'legacy',
      payloadEvidenceQuality: 'legacy-envelope',
      reason: 'unsupported_legacy_envelope',
      sourceState: 'legacy-envelope',
    });
  });

  it('keeps final-state recovery visible as a source state', () => {
    const summary = summarizeSubmissionEvidencePayload({
      schemaVersion: 'manifest-submission-v2',
      answers: { 'linear-boundary': 'b' },
      score: 100,
      questionSummaries: [
        { questionId: 'linear-boundary', studentAnswer: 'b', referenceValue: 'b', isCorrect: true },
      ],
      backfill: {
        version: 'course-evidence-backfill-v1',
        status: 'final-state-enriched',
        source: 'final-state',
      },
    });

    expect(summary).toMatchObject({
      quality: 'rich',
      payloadEvidenceQuality: 'rich',
      sourceState: 'final-state-enriched',
    });
  });

  it('keeps unrecoverable legacy backfill visible as a source state', () => {
    const summary = summarizeSubmissionEvidencePayload({
      evidenceQuality: 'legacy-envelope',
      backfill: {
        version: 'course-evidence-backfill-v1',
        status: 'legacy-unrecoverable',
        source: 'legacy-envelope',
        reason: 'missing_durable_answers',
      },
    });

    expect(summary).toMatchObject({
      quality: 'legacy',
      payloadEvidenceQuality: 'legacy-envelope',
      reason: 'legacy_unrecoverable',
      sourceState: 'legacy-unrecoverable',
    });
  });

  it('creates zero-filled counters and resolves payload quality for submit events only', () => {
    expect(createSubmissionEvidenceQualityCounts()).toEqual({
      rich: 0,
      partial: 0,
      legacy: 0,
      missing: 0,
    });
    expect(resolveSubmissionPayloadEvidenceQuality({
      schemaVersion: 'manifest-submission-v2',
      answers: { q1: 'A' },
    }, 'lesson_submit')).toBe('partial');
    expect(resolveSubmissionPayloadEvidenceQuality({
      schemaVersion: 'manifest-submission-v2',
      answers: { q1: 'A' },
    }, 'page_view')).toBeUndefined();
  });
});
