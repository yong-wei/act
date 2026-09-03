import { describe, expect, it } from 'vitest';
import {
  assertPublicationCandidateExcludedFromMetrics,
  buildTeacherAiGradingPublicationCandidate,
  decideTeacherAiGradingPublicationCandidate,
} from '../teacher-ai-grading-publication-candidate';

const independent = {
  sourceIndependentResultId: 'independent-result-1',
  baselineVersion: 'baseline-v3',
  questions: [{
    questionId: 'T1-1', maxScore: 10, score: 7,
    criteria: [
      { criterionId: 'c1', maxScore: 5, aiScore: 4, score: 4 },
      { criterionId: 'c2', maxScore: 5, aiScore: 3, score: 3 },
    ],
    annotations: [{ id: 'ai-1', questionId: 'T1-1', criterionId: 'c1', reason: 'r', comment: 'c', source: 'AI' as const }],
  }],
  baseline: [{
    questionId: 'T1-1', maxScore: 10, teacherScore: 8,
    annotations: [{ id: 'teacher-1', questionId: 'T1-1', criterionId: 'c2', reason: 'r2', comment: 'c2', source: 'AI' as const }],
  }],
};

describe('teacher AI publication candidate isolation', () => {
  it('aligns question and criterion scores to the human baseline and excludes the candidate from metrics', () => {
    const candidate = buildTeacherAiGradingPublicationCandidate(independent);
    expect(candidate).toMatchObject({
      sourceIndependentResultId: 'independent-result-1',
      baselineVersion: 'baseline-v3',
      status: 'TEACHER_CONFIRMATION_REQUIRED',
      excludedFromMetrics: true,
      totalScore: 8,
      revision: 0,
    });
    expect(candidate?.questions[0]?.criteria.reduce((sum, criterion) => sum + criterion.score, 0)).toBe(8);
    expect(candidate?.questions[0]?.annotations.map((annotation) => annotation.id)).toEqual(expect.arrayContaining(['ai-1', 'teacher-1']));
    expect(candidate?.questions[0]?.annotations.some((annotation) => annotation.source === 'TEACHER_BASELINE_ALIGNMENT')).toBe(true);
  });

  it('does not create a candidate when independent and baseline scores already agree', () => {
    const candidate = buildTeacherAiGradingPublicationCandidate({
      ...independent,
      questions: [{ ...independent.questions[0], score: 8, criteria: independent.questions[0].criteria.map((criterion) => ({ ...criterion, aiScore: criterion.score })) }],
    });
    expect(candidate).toBeNull();
  });

  it('keeps independent results and baseline values as source snapshots', () => {
    const input = structuredClone(independent);
    const candidate = buildTeacherAiGradingPublicationCandidate(input)!;
    input.questions[0].score = 1;
    input.baseline[0].teacherScore = 1;
    expect(candidate.questions[0]).toMatchObject({ independentScore: 7, teacherScore: 8 });
  });

  it('uses optimistic concurrency for one teacher confirmation', () => {
    const candidate = buildTeacherAiGradingPublicationCandidate(independent)!;
    const confirmed = decideTeacherAiGradingPublicationCandidate(candidate, {
      expectedRevision: 0, operatorUserId: 'teacher-1', decision: 'CONFIRMED', now: new Date('2026-08-26T00:00:00.000Z'),
    });
    expect(confirmed).toMatchObject({ status: 'CONFIRMED', revision: 1, confirmedBy: 'teacher-1' });
    expect(() => decideTeacherAiGradingPublicationCandidate(candidate, {
      expectedRevision: 1, operatorUserId: 'teacher-2', decision: 'CONFIRMED',
    })).toThrowError('teacher-ai-grading-publication-version-conflict');
    expect(() => decideTeacherAiGradingPublicationCandidate(confirmed, {
      expectedRevision: 1, operatorUserId: 'teacher-2', decision: 'REJECTED',
    })).toThrowError('teacher-ai-grading-publication-candidate-already-decided');
  });

  it('never permits a candidate to enter independent metrics', () => {
    const candidate = buildTeacherAiGradingPublicationCandidate(independent)!;
    expect(() => assertPublicationCandidateExcludedFromMetrics(candidate)).not.toThrow();
    const confirmed = decideTeacherAiGradingPublicationCandidate(candidate, { expectedRevision: 0, operatorUserId: 'teacher-1', decision: 'CONFIRMED' });
    expect(() => assertPublicationCandidateExcludedFromMetrics(confirmed)).not.toThrow();
  });
});
