import { createHash } from 'node:crypto';

export type PublicationCandidateStatus = 'TEACHER_CONFIRMATION_REQUIRED' | 'CONFIRMED' | 'REJECTED';

export interface CandidateCriterion {
  criterionId: string;
  maxScore: number;
  aiScore: number;
  score: number;
}

export interface CandidateAnnotation {
  id: string;
  questionId: string;
  criterionId: string;
  reason: string;
  comment: string;
  source: 'AI' | 'TEACHER_BASELINE_ALIGNMENT';
}

export interface IndependentQuestionResult {
  questionId: string;
  maxScore: number;
  score: number;
  criteria: readonly CandidateCriterion[];
  annotations: readonly CandidateAnnotation[];
}

export interface TeacherBaselineQuestion {
  questionId: string;
  maxScore: number;
  teacherScore: number;
  annotations: readonly CandidateAnnotation[];
}

export interface TeacherAiGradingPublicationCandidate {
  id: string;
  sourceIndependentResultId: string;
  baselineVersion: string;
  revision: number;
  status: PublicationCandidateStatus;
  excludedFromMetrics: true;
  questions: readonly {
    questionId: string;
    maxScore: number;
    independentScore: number;
    teacherScore: number;
    criteria: readonly CandidateCriterion[];
    annotations: readonly CandidateAnnotation[];
  }[];
  totalScore: number;
  maxScore: number;
  contentHash: string;
  createdAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export interface PublicationCandidateDecision {
  expectedRevision: number;
  operatorUserId: string;
  decision: Extract<PublicationCandidateStatus, 'CONFIRMED' | 'REJECTED'>;
  now?: Date;
}

function token(value: string, code: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}

function finiteScore(value: number, maxScore: number, code: string): number {
  if (!Number.isFinite(value) || value < 0 || value > maxScore) throw new Error(code);
  return value;
}

function hash(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function roundScore(value: number): number {
  return Math.round(value * 2) / 2;
}

function allocateTeacherDeductions(
  criteria: readonly CandidateCriterion[],
  teacherScore: number,
): CandidateCriterion[] {
  const maxScore = criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
  const deductions = roundScore(maxScore - teacherScore);
  if (deductions < 0) throw new Error('teacher-ai-grading-publication-baseline-score-invalid');
  const sorted = [...criteria].sort((a, b) => a.criterionId.localeCompare(b.criterionId));
  let remaining = deductions;
  const result = sorted.map((criterion) => {
    const aiDeduction = Math.max(0, criterion.maxScore - criterion.aiScore);
    const allocation = Math.min(criterion.maxScore, remaining, aiDeduction);
    remaining = roundScore(remaining - allocation);
    return { ...criterion, score: roundScore(criterion.maxScore - allocation) };
  });
  for (const criterion of result) {
    if (remaining <= 0) break;
    const available = roundScore(criterion.score);
    const allocation = Math.min(available, remaining);
    criterion.score = roundScore(criterion.score - allocation);
    remaining = roundScore(remaining - allocation);
  }
  if (remaining !== 0) throw new Error('teacher-ai-grading-publication-deduction-allocation-failed');
  return result.sort((a, b) => a.criterionId.localeCompare(b.criterionId));
}

export function buildTeacherAiGradingPublicationCandidate(input: {
  sourceIndependentResultId: string;
  baselineVersion: string;
  questions: readonly IndependentQuestionResult[];
  baseline: readonly TeacherBaselineQuestion[];
  now?: Date;
}): TeacherAiGradingPublicationCandidate | null {
  const sourceId = token(input.sourceIndependentResultId, 'teacher-ai-grading-publication-source-missing');
  const baselineVersion = token(input.baselineVersion, 'teacher-ai-grading-publication-baseline-version-missing');
  const baselineByQuestion = new Map(input.baseline.map((question) => [question.questionId, question]));
  const questions = input.questions.map((question) => {
    const baseline = baselineByQuestion.get(question.questionId);
    if (!baseline || baseline.maxScore !== question.maxScore) throw new Error('teacher-ai-grading-publication-question-scope-mismatch');
    finiteScore(question.score, question.maxScore, 'teacher-ai-grading-publication-ai-score-invalid');
    finiteScore(baseline.teacherScore, baseline.maxScore, 'teacher-ai-grading-publication-baseline-score-invalid');
    const criteria = allocateTeacherDeductions(question.criteria, baseline.teacherScore);
    const changed = Math.abs(question.score - baseline.teacherScore) > 1e-9;
    return {
      questionId: question.questionId,
      maxScore: question.maxScore,
      independentScore: question.score,
      teacherScore: baseline.teacherScore,
      criteria,
      annotations: [
        ...question.annotations,
        ...baseline.annotations,
        ...(changed ? criteria.filter((criterion) => criterion.score !== criterion.aiScore).map((criterion) => ({
          id: `baseline-alignment:${question.questionId}:${criterion.criterionId}`,
          questionId: question.questionId,
          criterionId: criterion.criterionId,
          reason: 'teacher-baseline-alignment',
          comment: '候选稿按人工基准重新分配小题扣分，须由教师确认后发布。',
          source: 'TEACHER_BASELINE_ALIGNMENT' as const,
        })) : []),
      ],
    };
  });
  const hasDifference = questions.some((question) => Math.abs(question.independentScore - question.teacherScore) > 1e-9);
  if (!hasDifference) return null;
  const body = {
    sourceIndependentResultId: sourceId,
    baselineVersion,
    questions,
    excludedFromMetrics: true as const,
  };
  const createdAt = (input.now ?? new Date()).toISOString();
  return {
    id: `publication-candidate:${hash(body).slice(-32)}`,
    ...body,
    revision: 0,
    status: 'TEACHER_CONFIRMATION_REQUIRED',
    totalScore: questions.reduce((sum, question) => sum + question.teacherScore, 0),
    maxScore: questions.reduce((sum, question) => sum + question.maxScore, 0),
    contentHash: hash({ ...body, createdAt }),
    createdAt,
    confirmedBy: null,
    confirmedAt: null,
  };
}

export function decideTeacherAiGradingPublicationCandidate(
  candidate: TeacherAiGradingPublicationCandidate,
  input: PublicationCandidateDecision,
): TeacherAiGradingPublicationCandidate {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error('teacher-ai-grading-publication-revision-invalid');
  if (candidate.revision !== input.expectedRevision) throw new Error('teacher-ai-grading-publication-version-conflict');
  const operatorUserId = token(input.operatorUserId, 'teacher-ai-grading-publication-operator-missing');
  if (candidate.status !== 'TEACHER_CONFIRMATION_REQUIRED') throw new Error('teacher-ai-grading-publication-candidate-already-decided');
  const now = (input.now ?? new Date()).toISOString();
  return {
    ...candidate,
    revision: candidate.revision + 1,
    status: input.decision,
    confirmedBy: input.decision === 'CONFIRMED' ? operatorUserId : null,
    confirmedAt: input.decision === 'CONFIRMED' ? now : null,
    contentHash: hash({ ...candidate, revision: candidate.revision + 1, status: input.decision, operatorUserId, now }),
  };
}

export function assertPublicationCandidateExcludedFromMetrics(candidate: TeacherAiGradingPublicationCandidate): void {
  if (candidate.excludedFromMetrics !== true) {
    throw new Error('teacher-ai-grading-publication-candidate-metrics-inclusion-forbidden');
  }
}
