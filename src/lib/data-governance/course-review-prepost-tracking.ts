import { buildManifestSubmissionTelemetry } from '@/features/interactive/shared/manifest-runtime/submission-telemetry';
import {
  getInteractiveRuntimeStep,
  type InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import type { CourseEvidenceSpec } from './course-evidence-specs';
import {
  summarizeSubmissionEvidencePayload,
  type SubmissionEvidenceQuality,
} from './submission-evidence-quality';

export type CourseReviewPrepostRecoverability = 'complete' | 'partial' | 'limited';
export type CourseReviewPrepostSource = 'compatibility-state' | 'durable-submission' | 'student-state' | 'missing';
export type CourseReviewCompatibilityKind = 'course_review' | 'showcase_review';

export interface CourseReviewAbilityVector {
  computational: number;
  crossDomain: number;
  designTradeoff: number;
  poleTimeMapping: number;
  frequencyStability: number;
}

export interface CourseReviewPrepostUser {
  id: string;
  name: string | null;
  profile: {
    studentNumber: string | null;
  } | null;
}

export interface CourseReviewPrepostSubmissionRow {
  lessonKey?: string | null;
  stepId: string;
  responseData: unknown;
  submittedAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
}

export interface CourseReviewPrepostAssessment {
  stepId: string;
  score: number | null;
  evidenceQuality: SubmissionEvidenceQuality;
  source: CourseReviewPrepostSource;
}

export interface CourseReviewPrepostRecord {
  userId: string;
  userName: string;
  studentNumber: string;
  spotlight: boolean;
  weakTag: string;
  focusDimensions: string[];
  pre: CourseReviewPrepostAssessment | null;
  post: CourseReviewPrepostAssessment | null;
  delta: number | null;
  evidenceQuality: SubmissionEvidenceQuality;
  recoverability: CourseReviewPrepostRecoverability;
  stepIds: {
    pre?: string;
    post?: string;
    summary?: string;
  };
  questionSummaries: Array<Record<string, unknown>>;
  compatibilityKind?: CourseReviewCompatibilityKind;
  compatibilityTracking?: {
    pre: CourseReviewAbilityVector;
    post: CourseReviewAbilityVector;
    delta: CourseReviewAbilityVector;
  };
  reinforcementPaths: Array<Record<string, unknown>>;
  recommendedQuestions: Array<Record<string, unknown>>;
}

export interface ParseCourseReviewPrepostInput {
  user: CourseReviewPrepostUser;
  stateData?: unknown;
  lessonKey?: string | null;
  spec?: CourseEvidenceSpec | null;
  manifest?: InteractiveRuntimeManifest | null;
  submissions: CourseReviewPrepostSubmissionRow[];
}

const DIMENSION_KEYS = [
  'computational',
  'crossDomain',
  'designTradeoff',
  'poleTimeMapping',
  'frequencyStability',
] as const;

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createZeroVector(): CourseReviewAbilityVector {
  return {
    computational: 0,
    crossDomain: 0,
    designTradeoff: 0,
    poleTimeMapping: 0,
    frequencyStability: 0,
  };
}

function normalizeVector(value: unknown): CourseReviewAbilityVector {
  const obj = readRecord(value);
  const vector = createZeroVector();
  for (const key of DIMENSION_KEYS) {
    const raw = readNumber(obj[key]);
    vector[key] = raw === null ? 0 : Math.round(clamp(raw, 0, 100));
  }
  return vector;
}

function diffVector(post: CourseReviewAbilityVector, pre: CourseReviewAbilityVector): CourseReviewAbilityVector {
  return {
    computational: post.computational - pre.computational,
    crossDomain: post.crossDomain - pre.crossDomain,
    designTradeoff: post.designTradeoff - pre.designTradeoff,
    poleTimeMapping: post.poleTimeMapping - pre.poleTimeMapping,
    frequencyStability: post.frequencyStability - pre.frequencyStability,
  };
}

function scoreVector(vector: CourseReviewAbilityVector): number | null {
  const values = DIMENSION_KEYS.map((key) => vector[key]);
  return values.some((value) => value > 0)
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
}

function inferWeakTagFromPost(vector: CourseReviewAbilityVector) {
  const pairs: Array<[string, number]> = [
    ['computational', vector.computational],
    ['cross-domain-mapping', vector.crossDomain],
    ['design-tradeoff', vector.designTradeoff],
    ['pole-time-mapping', vector.poleTimeMapping],
    ['frequency-stability-judgement', vector.frequencyStability],
  ];
  pairs.sort((a, b) => a[1] - b[1]);
  return pairs[0]?.[0] ?? 'cross-domain-mapping';
}

function normalizeAnswers(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(readRecord(value))
      .map(([key, answer]) => [key, answer === null || answer === undefined ? '' : String(answer)] as const)
      .filter(([, answer]) => answer.trim().length > 0),
  );
}

function readQuestionSummaries(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.map(readRecord).filter((item) => Object.keys(item).length > 0)
    : [];
}

function latestTimestamp(value: CourseReviewPrepostSubmissionRow, index: number) {
  const raw = value.submittedAt ?? value.createdAt;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return index;
}

function latestSubmissionForStep(
  submissions: CourseReviewPrepostSubmissionRow[],
  stepId: string,
  lessonKey?: string | null,
): CourseReviewPrepostSubmissionRow | null {
  return submissions
    .map((submission, index) => ({ submission, timestamp: latestTimestamp(submission, index) }))
    .filter((item) => item.submission.stepId === stepId && submissionMatchesLessonKey(item.submission, lessonKey))
    .sort((a, b) => b.timestamp - a.timestamp)[0]?.submission ?? null;
}

function submissionMatchesLessonKey(row: CourseReviewPrepostSubmissionRow, lessonKey?: string | null) {
  return !lessonKey || !row.lessonKey || row.lessonKey === lessonKey;
}

function buildAssessmentFromSubmission(row: CourseReviewPrepostSubmissionRow): CourseReviewPrepostAssessment {
  const summary = summarizeSubmissionEvidencePayload(row.responseData);
  return {
    stepId: row.stepId,
    score: summary.score,
    evidenceQuality: summary.quality,
    source: 'durable-submission',
  };
}

function buildAssessmentFromState(input: {
  stateData: Record<string, unknown>;
  stepId: string;
  manifest?: InteractiveRuntimeManifest | null;
}): CourseReviewPrepostAssessment | null {
  const responses = readRecord(input.stateData.responses);
  const response = readRecord(responses[input.stepId]);
  if (Object.keys(response).length === 0) {
    return null;
  }

  const answers = normalizeAnswers(response.answers);
  if (Object.keys(answers).length === 0) {
    return {
      stepId: input.stepId,
      score: null,
      evidenceQuality: 'legacy',
      source: 'student-state',
    };
  }

  const stepManifest = input.manifest ? getInteractiveRuntimeStep(input.manifest, input.stepId) : null;
  const telemetry = buildManifestSubmissionTelemetry({
    stepId: input.stepId,
    submittedAt: readNumber(response.submittedAt) ?? Date.now(),
    answers,
  }, stepManifest);
  const summary = summarizeSubmissionEvidencePayload(telemetry);

  return {
    stepId: input.stepId,
    score: summary.score,
    evidenceQuality: summary.quality,
    source: 'student-state',
  };
}

function buildAssessment(input: {
  stateData: Record<string, unknown>;
  stepId?: string;
  lessonKey?: string | null;
  manifest?: InteractiveRuntimeManifest | null;
  submissions: CourseReviewPrepostSubmissionRow[];
}): CourseReviewPrepostAssessment | null {
  if (!input.stepId) return null;

  const durable = latestSubmissionForStep(input.submissions, input.stepId, input.lessonKey);
  if (durable) return buildAssessmentFromSubmission(durable);

  const stateAssessment = buildAssessmentFromState({
    stateData: input.stateData,
    stepId: input.stepId,
    manifest: input.manifest,
  });
  if (stateAssessment) return stateAssessment;

  return {
    stepId: input.stepId,
    score: null,
    evidenceQuality: 'missing',
    source: 'missing',
  };
}

function aggregateEvidenceQuality(assessments: Array<CourseReviewPrepostAssessment | null>): SubmissionEvidenceQuality {
  const qualities = assessments
    .filter((item): item is CourseReviewPrepostAssessment => Boolean(item))
    .map((item) => item.evidenceQuality);
  if (qualities.length === 0) return 'missing';
  if (qualities.every((quality) => quality === 'rich')) return 'rich';
  if (qualities.some((quality) => quality === 'partial')) return 'partial';
  if (qualities.some((quality) => quality === 'rich')) return 'partial';
  if (qualities.some((quality) => quality === 'legacy')) return 'legacy';
  return 'missing';
}

function resolveRecoverability(pre: CourseReviewPrepostAssessment | null, post: CourseReviewPrepostAssessment | null) {
  const scores = [pre?.score, post?.score].filter((score): score is number => typeof score === 'number');
  if (scores.length === 2) return 'complete';
  if (scores.length === 1) return 'partial';
  return 'limited';
}

function collectQuestionSummaries(
  submissions: CourseReviewPrepostSubmissionRow[],
  stepIds: Array<string | undefined>,
  lessonKey?: string | null,
) {
  return stepIds.flatMap((stepId) => {
    if (!stepId) return [];
    const row = latestSubmissionForStep(submissions, stepId, lessonKey);
    return readQuestionSummaries(readRecord(row?.responseData).questionSummaries);
  });
}

function parseCompatibilityRecord(input: ParseCourseReviewPrepostInput): CourseReviewPrepostRecord | null {
  const payload = readRecord(input.stateData);
  const kind = payload.kind;
  if (kind !== 'course_review' && kind !== 'showcase_review') {
    return null;
  }

  const tracking = readRecord(payload.tracking);
  const preVector = normalizeVector(tracking.pre);
  const postVector = normalizeVector(tracking.post);
  const deltaVector = normalizeVector(tracking.delta);
  const computedDelta = diffVector(postVector, preVector);
  const deltaHasData = DIMENSION_KEYS.some((key) => deltaVector[key] !== 0);
  const preScore = scoreVector(preVector);
  const postScore = scoreVector(postVector);

  return {
    userId: input.user.id,
    userName: input.user.name || '未命名学生',
    studentNumber: input.user.profile?.studentNumber || '-',
    spotlight: Boolean(payload.spotlight),
    weakTag: readString(tracking.weakTag) ?? inferWeakTagFromPost(postVector),
    focusDimensions: Array.isArray(tracking.focusDimensions)
      ? tracking.focusDimensions.filter((item): item is string => typeof item === 'string')
      : [],
    pre: {
      stepId: 'compatibility-pre',
      score: preScore,
      evidenceQuality: 'rich',
      source: 'compatibility-state',
    },
    post: {
      stepId: 'compatibility-post',
      score: postScore,
      evidenceQuality: 'rich',
      source: 'compatibility-state',
    },
    delta: preScore !== null && postScore !== null ? postScore - preScore : null,
    evidenceQuality: 'rich',
    recoverability: 'complete',
    stepIds: {},
    questionSummaries: [],
    compatibilityKind: kind,
    compatibilityTracking: {
      pre: preVector,
      post: postVector,
      delta: deltaHasData ? deltaVector : computedDelta,
    },
    reinforcementPaths: Array.isArray(payload.reinforcementPaths)
      ? payload.reinforcementPaths.map(readRecord).filter((item) => Object.keys(item).length > 0)
      : [],
    recommendedQuestions: Array.isArray(payload.recommendedQuestions)
      ? payload.recommendedQuestions.map(readRecord).filter((item) => Object.keys(item).length > 0)
      : [],
  };
}

export function inferCourseReviewLessonIdFromStateData(value: unknown): string | null {
  const kind = readString(readRecord(value).kind);
  const match = kind?.match(/^unit(\d)(\d+)_student_state$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

export function parseCourseReviewPrepostRecord(
  input: ParseCourseReviewPrepostInput,
): CourseReviewPrepostRecord | null {
  const compatibility = parseCompatibilityRecord(input);
  if (compatibility) return compatibility;

  const spec = input.spec ?? null;
  if (!spec) return null;

  const stateData = readRecord(input.stateData);
  const lessonKey = readString(input.lessonKey);
  const stateKind = readString(stateData.kind);
  const kindMatches = stateKind === spec.studentStateKind;
  const hasRelevantSubmission = input.submissions.some((submission) => (
    (submission.stepId === spec.preAssessmentStepId || submission.stepId === spec.postAssessmentStepId)
      && submissionMatchesLessonKey(submission, lessonKey)
  ));

  if (stateKind && !kindMatches) {
    return null;
  }

  if (!kindMatches && !hasRelevantSubmission) {
    return null;
  }

  const pre = buildAssessment({
    stateData,
    stepId: spec.preAssessmentStepId,
    lessonKey,
    manifest: input.manifest,
    submissions: input.submissions,
  });
  const post = buildAssessment({
    stateData,
    stepId: spec.postAssessmentStepId,
    lessonKey,
    manifest: input.manifest,
    submissions: input.submissions,
  });
  const delta = typeof pre?.score === 'number' && typeof post?.score === 'number'
    ? Math.round((post.score - pre.score) * 10) / 10
    : null;
  const evidenceQuality = aggregateEvidenceQuality([pre, post]);
  const recoverability = resolveRecoverability(pre, post);

  const hasSourceEvidence = [pre, post].some((assessment) => assessment && assessment.source !== 'missing');
  if (!hasSourceEvidence) {
    return null;
  }

  return {
    userId: input.user.id,
    userName: input.user.name || '未命名学生',
    studentNumber: input.user.profile?.studentNumber || '-',
    spotlight: recoverability !== 'complete' || (typeof post?.score === 'number' && post.score < 60),
    weakTag: typeof post?.score === 'number' && post.score < 60 ? 'design-tradeoff' : 'cross-domain-mapping',
    focusDimensions: ['computational', 'designTradeoff'],
    pre,
    post,
    delta,
    evidenceQuality,
    recoverability,
    stepIds: {
      ...(spec.preAssessmentStepId ? { pre: spec.preAssessmentStepId } : {}),
      ...(spec.postAssessmentStepId ? { post: spec.postAssessmentStepId } : {}),
      ...(spec.summaryStepId ? { summary: spec.summaryStepId } : {}),
    },
    questionSummaries: collectQuestionSummaries(input.submissions, [spec.preAssessmentStepId, spec.postAssessmentStepId], lessonKey),
    reinforcementPaths: [],
    recommendedQuestions: [],
  };
}
