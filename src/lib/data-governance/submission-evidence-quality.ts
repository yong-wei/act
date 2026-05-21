export type SubmissionEvidenceQuality = 'rich' | 'partial' | 'legacy' | 'missing';
export type SubmissionPayloadEvidenceQuality = 'rich' | 'partial' | 'missing' | 'legacy-envelope';

export type SubmissionEvidenceSourceState =
  | 'manifest-submission-v2'
  | 'final-state-enriched'
  | 'legacy-envelope'
  | 'legacy-unrecoverable';

export interface SubmissionEvidenceSummary {
  quality: SubmissionEvidenceQuality;
  payloadEvidenceQuality: SubmissionPayloadEvidenceQuality;
  reason:
    | 'scoreable_objective_evidence'
    | 'score_without_answer_evidence'
    | 'subjective_or_answer_evidence_without_score'
    | 'parameter_or_extra_evidence_without_score'
    | 'missing_manifest_evidence'
    | 'unsupported_legacy_envelope'
    | 'legacy_unrecoverable';
  sourceState: SubmissionEvidenceSourceState;
  schemaVersion: string | null;
  hasAnswerEvidence: boolean;
  hasScoreEvidence: boolean;
  hasQuestionSummaryEvidence: boolean;
  hasScoreableObjectiveEvidence: boolean;
  hasSubjectiveEvidence: boolean;
  hasParameterEvidence: boolean;
  hasExtraEvidence: boolean;
  answerCount: number;
  questionSummaryCount: number;
  scoreableObjectiveSubmissions: number;
  score: number | null;
}

export type SubmissionEvidenceQualityCounts = Record<SubmissionEvidenceQuality, number>;

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function hasRecordEntries(value: unknown): boolean {
  return Object.keys(readRecord(value)).length > 0;
}

function hasArrayEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function countRecordEntries(value: unknown): number {
  return Object.keys(readRecord(value)).length;
}

function readQuestionSummaries(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(readRecord).filter((entry) => Object.keys(entry).length > 0)
    : [];
}

function hasSubmittedAnswerValue(value: unknown): boolean {
  return value !== undefined
    && value !== null
    && !(typeof value === 'string' && value.trim().length === 0);
}

function hasSubmittedQuestionAnswer(summary: Record<string, unknown>): boolean {
  return summary.answered === true
    || hasSubmittedAnswerValue(summary.studentAnswer)
    || hasSubmittedAnswerValue(summary.selectedValue)
    || hasSubmittedAnswerValue(summary.answer)
    || hasSubmittedAnswerValue(summary.value);
}

function isScoreableQuestionSummary(summary: Record<string, unknown>): boolean {
  return typeof summary.isCorrect === 'boolean'
    || summary.referenceValue !== undefined
    || summary.referenceAnswer !== undefined
    || summary.reference_answer !== undefined
    || summary.correctAnswer !== undefined
    || summary.correct_answer !== undefined;
}

function countQuestionAnswers(questionSummaries: Record<string, unknown>[]): number {
  return questionSummaries.filter(hasSubmittedQuestionAnswer).length;
}

function resolveSourceState(data: Record<string, unknown>): SubmissionEvidenceSourceState {
  const backfill = readRecord(data.backfill);
  const status = readString(backfill.status);
  if (status === 'final-state-enriched') return 'final-state-enriched';
  if (status === 'legacy-unrecoverable') return 'legacy-unrecoverable';
  return data.schemaVersion === 'manifest-submission-v2'
    ? 'manifest-submission-v2'
    : 'legacy-envelope';
}

export function createSubmissionEvidenceQualityCounts(): SubmissionEvidenceQualityCounts {
  return {
    rich: 0,
    partial: 0,
    legacy: 0,
    missing: 0,
  };
}

export function summarizeSubmissionEvidencePayload(responseData: unknown): SubmissionEvidenceSummary {
  const data = readRecord(responseData);
  const schemaVersion = readString(data.schemaVersion);
  const sourceState = resolveSourceState(data);
  const explicitEvidenceQuality = readString(data.evidenceQuality);
  const questionSummaries = readQuestionSummaries(data.questionSummaries);
  const hasQuestionSummaryEvidence = questionSummaries.length > 0;
  const answerCount = Math.max(
    countRecordEntries(data.answers),
    countRecordEntries(data.answerDigest),
    countRecordEntries(data.answerKeys),
    countQuestionAnswers(questionSummaries),
  );
  const hasAnswerEvidence = answerCount > 0;
  const hasScoreEvidence = typeof data.score === 'number' && Number.isFinite(data.score);
  const hasScoreableObjectiveEvidence = questionSummaries.some(isScoreableQuestionSummary);
  const subjectiveCompleteness = readRecord(data.subjectiveCompleteness);
  const hasSubjectiveEvidence = Object.keys(subjectiveCompleteness).length > 0
    || Boolean(hasAnswerEvidence && !hasScoreableObjectiveEvidence);
  const hasParameterEvidence = hasRecordEntries(data.parameterSnapshots);
  const hasExtraEvidence = hasRecordEntries(data.extraEvidence);

  if (explicitEvidenceQuality === 'legacy-envelope' || sourceState === 'legacy-unrecoverable') {
    const legacyUnrecoverable = sourceState === 'legacy-unrecoverable';
    return {
      quality: 'legacy',
      payloadEvidenceQuality: 'legacy-envelope',
      reason: legacyUnrecoverable ? 'legacy_unrecoverable' : 'unsupported_legacy_envelope',
      sourceState,
      schemaVersion,
      hasAnswerEvidence,
      hasScoreEvidence,
      hasQuestionSummaryEvidence,
      hasScoreableObjectiveEvidence,
      hasSubjectiveEvidence,
      hasParameterEvidence,
      hasExtraEvidence,
      answerCount,
      questionSummaryCount: questionSummaries.length,
      scoreableObjectiveSubmissions: hasScoreableObjectiveEvidence ? 1 : 0,
      score: hasScoreEvidence ? data.score as number : null,
    };
  }

  if (schemaVersion !== 'manifest-submission-v2') {
    return {
      quality: 'legacy',
      payloadEvidenceQuality: 'legacy-envelope',
      reason: 'unsupported_legacy_envelope',
      sourceState,
      schemaVersion,
      hasAnswerEvidence,
      hasScoreEvidence,
      hasQuestionSummaryEvidence,
      hasScoreableObjectiveEvidence,
      hasSubjectiveEvidence,
      hasParameterEvidence,
      hasExtraEvidence,
      answerCount,
      questionSummaryCount: questionSummaries.length,
      scoreableObjectiveSubmissions: hasScoreableObjectiveEvidence ? 1 : 0,
      score: hasScoreEvidence ? data.score as number : null,
    };
  }

  if (hasAnswerEvidence && hasScoreableObjectiveEvidence) {
    return {
      quality: 'rich',
      payloadEvidenceQuality: 'rich',
      reason: 'scoreable_objective_evidence',
      sourceState,
      schemaVersion,
      hasAnswerEvidence,
      hasScoreEvidence,
      hasQuestionSummaryEvidence,
      hasScoreableObjectiveEvidence,
      hasSubjectiveEvidence,
      hasParameterEvidence,
      hasExtraEvidence,
      answerCount,
      questionSummaryCount: questionSummaries.length,
      scoreableObjectiveSubmissions: 1,
      score: hasScoreEvidence ? data.score as number : null,
    };
  }

  if (hasScoreEvidence) {
    return {
      quality: 'partial',
      payloadEvidenceQuality: 'partial',
      reason: 'score_without_answer_evidence',
      sourceState,
      schemaVersion,
      hasAnswerEvidence,
      hasScoreEvidence,
      hasQuestionSummaryEvidence,
      hasScoreableObjectiveEvidence,
      hasSubjectiveEvidence,
      hasParameterEvidence,
      hasExtraEvidence,
      answerCount,
      questionSummaryCount: questionSummaries.length,
      scoreableObjectiveSubmissions: hasScoreableObjectiveEvidence ? 1 : 0,
      score: data.score as number,
    };
  }

  if (hasAnswerEvidence || hasSubjectiveEvidence || hasQuestionSummaryEvidence) {
    return {
      quality: 'partial',
      payloadEvidenceQuality: 'partial',
      reason: 'subjective_or_answer_evidence_without_score',
      sourceState,
      schemaVersion,
      hasAnswerEvidence,
      hasScoreEvidence,
      hasQuestionSummaryEvidence,
      hasScoreableObjectiveEvidence,
      hasSubjectiveEvidence,
      hasParameterEvidence,
      hasExtraEvidence,
      answerCount,
      questionSummaryCount: questionSummaries.length,
      scoreableObjectiveSubmissions: hasScoreableObjectiveEvidence ? 1 : 0,
      score: hasScoreEvidence ? data.score as number : null,
    };
  }

  if (hasParameterEvidence || hasExtraEvidence) {
    return {
      quality: 'partial',
      payloadEvidenceQuality: 'partial',
      reason: 'parameter_or_extra_evidence_without_score',
      sourceState,
      schemaVersion,
      hasAnswerEvidence,
      hasScoreEvidence,
      hasQuestionSummaryEvidence,
      hasScoreableObjectiveEvidence,
      hasSubjectiveEvidence,
      hasParameterEvidence,
      hasExtraEvidence,
      answerCount,
      questionSummaryCount: questionSummaries.length,
      scoreableObjectiveSubmissions: 0,
      score: hasScoreEvidence ? data.score as number : null,
    };
  }

  return {
    quality: 'missing',
    payloadEvidenceQuality: 'missing',
    reason: 'missing_manifest_evidence',
    sourceState,
    schemaVersion,
    hasAnswerEvidence,
    hasScoreEvidence,
    hasQuestionSummaryEvidence,
    hasScoreableObjectiveEvidence,
    hasSubjectiveEvidence,
    hasParameterEvidence,
    hasExtraEvidence,
    answerCount,
    questionSummaryCount: questionSummaries.length,
    scoreableObjectiveSubmissions: 0,
    score: hasScoreEvidence ? data.score as number : null,
  };
}

export function resolveSubmissionPayloadEvidenceQuality(
  payload: Record<string, unknown>,
  canonicalEventType: string,
): SubmissionPayloadEvidenceQuality | undefined {
  if (canonicalEventType !== 'lesson_submit' && canonicalEventType !== 'lesson_resubmit') {
    return undefined;
  }
  return summarizeSubmissionEvidencePayload(payload).payloadEvidenceQuality;
}
