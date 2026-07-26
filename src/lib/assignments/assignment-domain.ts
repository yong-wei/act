import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import {
  hasAtMostOneDecimal,
  validateDetailedRubricLevels,
} from './assignment-rubric-contract';

export const ASSIGNMENT_LIMITS = {
  title: 160,
  instructions: 20_000,
  prompt: 20_000,
  answer: 20_000,
  questions: 100,
  criteria: 20,
  levels: 10,
  audiences: 50,
} as const;

const boundedText = (max: number) => z.string().trim().min(1).max(max);
const points = z.number().finite().positive().max(10_000).refine(hasAtMostTwoDecimals, 'score-must-use-0.01-quantum');

export const rubricLevelSchema = z.object({
  id: boundedText(80),
  label: boundedText(120),
  minPoints: z.number().finite().min(0).refine(hasAtMostTwoDecimals, 'score-must-use-0.01-quantum'),
  maxPoints: z.number().finite().min(0).refine(hasAtMostTwoDecimals, 'score-must-use-0.01-quantum'),
  description: boundedText(2_000),
}).strict();

export const rubricCriterionSchema = z.object({
  id: boundedText(80),
  label: boundedText(160),
  maxPoints: points,
  evidenceDescription: boundedText(2_000),
  feedbackGuidance: boundedText(2_000),
  studentVisibleGuidance: z.string().trim().max(2_000).optional(),
  levels: z.array(rubricLevelSchema).min(1).max(ASSIGNMENT_LIMITS.levels),
}).strict();

export const legacyAnalyticRubricSchema = z.object({
  schemaVersion: z.literal('assignment-analytic-rubric.v1'),
  criteria: z.array(rubricCriterionSchema).min(1).max(ASSIGNMENT_LIMITS.criteria),
}).strict().superRefine((rubric, ctx) => {
  const criterionIds = new Set<string>();
  for (const [criterionIndex, criterion] of rubric.criteria.entries()) {
    if (criterionIds.has(criterion.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria', criterionIndex, 'id'], message: 'duplicate-criterion-id' });
    }
    criterionIds.add(criterion.id);
    const levelIds = new Set<string>();
    let previousMinCents: number | null = null;
    const criterionMaxCents = toCents(criterion.maxPoints);
    for (const [levelIndex, level] of criterion.levels.entries()) {
      if (levelIds.has(level.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria', criterionIndex, 'levels', levelIndex, 'id'], message: 'duplicate-level-id' });
      }
      levelIds.add(level.id);
      if (level.minPoints > level.maxPoints || level.maxPoints > criterion.maxPoints) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria', criterionIndex, 'levels', levelIndex], message: 'invalid-level-score-range' });
      }
      const minCents = toCents(level.minPoints);
      const maxCents = toCents(level.maxPoints);
      if ((levelIndex === 0 && maxCents !== criterionMaxCents)
        || (previousMinCents !== null && maxCents !== previousMinCents - 1)
        || (levelIndex === criterion.levels.length - 1 && minCents !== 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria', criterionIndex, 'levels', levelIndex], message: 'score-bands-must-cover-descending-0.01-grid' });
      }
      previousMinCents = minCents;
    }
  }
});

export const rubricLevelV2Schema = z.object({
  id: boundedText(80),
  label: boundedText(120),
  maxPoints: z.number().finite().min(0.1).max(10_000)
    .refine(hasAtMostOneDecimal, 'score-must-use-0.1-quantum'),
  guideline: z.string().trim().max(2_000),
}).strict();

export const rubricCriterionV2Schema = z.object({
  id: boundedText(80),
  label: boundedText(160),
  maxPoints: z.number().finite().min(1).max(10_000)
    .refine(hasAtMostOneDecimal, 'score-must-use-0.1-quantum'),
  scoringStandard: z.string().trim().max(2_000),
  detailedRubricEnabled: z.boolean(),
  evidenceDescription: z.string().trim().max(2_000).optional(),
  feedbackGuidance: z.string().trim().max(2_000).optional(),
  studentVisibleGuidance: z.string().trim().max(2_000).optional(),
  levels: z.array(rubricLevelV2Schema).max(ASSIGNMENT_LIMITS.levels),
}).strict();

export const scoringRubricV2Schema = z.object({
  schemaVersion: z.literal('assignment-scoring-rubric.v2'),
  criteria: z.array(rubricCriterionV2Schema).min(1).max(ASSIGNMENT_LIMITS.criteria),
}).strict().superRefine((rubric, ctx) => {
  const criterionIds = new Set<string>();
  for (const [criterionIndex, criterion] of rubric.criteria.entries()) {
    if (criterionIds.has(criterion.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria', criterionIndex, 'id'], message: 'duplicate-criterion-id' });
    }
    criterionIds.add(criterion.id);
    if (!criterion.detailedRubricEnabled && criterion.levels.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria', criterionIndex, 'levels'], message: 'standard-only-rubric-must-not-contain-levels' });
    }
    if (criterion.detailedRubricEnabled) {
      for (const issue of validateDetailedRubricLevels(criterion.levels, criterion.maxPoints)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria', criterionIndex, 'levels'], message: issue });
      }
    }
  }
});

export const analyticRubricSchema = z.union([
  legacyAnalyticRubricSchema,
  scoringRubricV2Schema,
]);

export type AnalyticRubric = z.infer<typeof analyticRubricSchema>;

export const questionSnapshotSchema = z.object({
  stableQuestionId: boundedText(100),
  responseType: z.enum(['SUBJECTIVE_TEXT', 'SUBJECTIVE_FILE']),
  points,
  prompt: boundedText(ASSIGNMENT_LIMITS.prompt),
  referenceAnswer: boundedText(ASSIGNMENT_LIMITS.answer),
  rubric: analyticRubricSchema,
  source: z.discriminatedUnion('family', [
    z.object({
      family: z.literal('MANUAL'),
      authoringMarker: z.literal('assignment-authoring'),
    }).strict(),
    z.object({
      family: z.literal('ADAPTIVE_ASSESSMENT_CATALOG'),
      sourceId: boundedText(200),
      sourceVersion: boundedText(120),
      sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      reviewState: z.enum(['reviewed', 'approved']),
      lineage: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    }).strict(),
    z.object({
      family: z.literal('ASSIGNMENT_DERIVATIVE'),
      parentSourceId: boundedText(200),
      parentSourceVersion: boundedText(120),
      parentSourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      catalogItemId: boundedText(240),
      originalSourceFamily: boundedText(120),
      reviewState: boundedText(120),
      eligibilityState: boundedText(120),
      allowedStages: z.array(boundedText(120)).min(1).max(20),
      limitations: z.array(boundedText(240)).max(50),
      selectionProof: z.string().regex(/^hmac-sha256:[a-f0-9]{64}$/),
      contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      authoringMarker: z.literal('assignment-authoring'),
    }).strict(),
  ]),
}).strict();

export type AssignmentQuestionSnapshot = z.infer<typeof questionSnapshotSchema> & { contentHash: string };

export const solutionReleasePolicySchema = z.discriminatedUnion('mode', [
  z.object({ version: z.literal(1), mode: z.literal('PRIVATE') }).strict(),
  z.object({
    version: z.literal(1),
    mode: z.literal('AT_TIME'),
    releaseAt: z.string().datetime(),
    audienceClassIds: z.array(boundedText(120)).min(1).max(ASSIGNMENT_LIMITS.audiences),
    includeReferenceAnswer: z.boolean(),
    includeStudentVisibleGuidance: z.boolean(),
  }).strict(),
]);

export type SolutionReleasePolicy = z.infer<typeof solutionReleasePolicySchema>;

export const latePolicySchema = z.discriminatedUnion('mode', [
  z.object({ version: z.literal(1), mode: z.literal('CLOSED') }).strict(),
  z.object({ version: z.literal(1), mode: z.literal('ALLOW'), penaltyPercentPerDay: z.number().min(0).max(100) }).strict(),
]);

export const responsePolicySchema = z.object({
  version: z.literal(1),
  allowedResponseTypes: z.array(z.enum(['SUBJECTIVE_TEXT', 'SUBJECTIVE_FILE'])).min(1).max(2),
}).strict();

export const resubmissionPolicySchema = z.object({
  version: z.literal(1),
  maxAttempts: z.number().int().min(1).max(20),
  untilDueAt: z.boolean(),
}).strict();

export const assignmentDraftSchema = z.object({
  title: boundedText(ASSIGNMENT_LIMITS.title),
  instructions: z.string().max(ASSIGNMENT_LIMITS.instructions),
  totalPoints: points,
  questions: z.array(questionSnapshotSchema).max(ASSIGNMENT_LIMITS.questions),
  latePolicy: latePolicySchema,
  responsePolicy: responsePolicySchema,
  resubmissionPolicy: resubmissionPolicySchema,
  solutionReleasePolicy: solutionReleasePolicySchema,
}).strict().superRefine((draft, ctx) => {
  const ids = new Set<string>();
  for (const [index, question] of draft.questions.entries()) {
    if (ids.has(question.stableQuestionId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['questions', index, 'stableQuestionId'], message: 'duplicate-stable-question-id' });
    }
    ids.add(question.stableQuestionId);
    if (!draft.responsePolicy.allowedResponseTypes.includes(question.responseType)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['responsePolicy', 'allowedResponseTypes'], message: `question-response-type-not-allowed:${question.stableQuestionId}` });
    }
    if (question.rubric.schemaVersion === 'assignment-scoring-rubric.v2') {
      if (!hasAtMostOneDecimal(question.points)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['questions', index, 'points'], message: 'score-must-use-0.1-quantum' });
      }
      if (!hasAtMostOneDecimal(draft.totalPoints)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['totalPoints'], message: 'score-must-use-0.1-quantum' });
      }
    }
  }
});

export type AssignmentDraftInput = z.infer<typeof assignmentDraftSchema>;

export interface AssignmentRevisionRecord extends AssignmentDraftInput {
  id: string;
  assignmentId: string;
  revisionNumber: number;
  version: number;
  state: 'DRAFT' | 'PUBLISHED';
  questions: AssignmentQuestionSnapshot[];
  contentHash: string | null;
  publishedAt: string | null;
  frozenAt: string | null;
}

export interface AssignmentRecord {
  id: string;
  authorId: string;
  courseContext?: string;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  archivedAt: string | null;
  currentDraft: AssignmentRevisionRecord | null;
  revisions: AssignmentRevisionRecord[];
}

export interface AssignmentAudienceInput {
  classId: string;
  availableAt: string;
  dueAt: string;
}

export interface AssignmentAudienceRecord extends AssignmentAudienceInput {
  revisionId: string;
  policySnapshot: {
    latePolicy: Record<string, unknown>;
    responsePolicy: Record<string, unknown>;
    resubmissionPolicy: Record<string, unknown>;
    solutionReleasePolicy: SolutionReleasePolicy;
  };
}

export interface PublicationResult {
  revision: AssignmentRevisionRecord;
  audiences: AssignmentAudienceRecord[];
  idempotentReplay: boolean;
}

export class AssignmentDomainError extends Error {
  constructor(public readonly code: string, public readonly details: readonly string[] = []) {
    super(code);
  }
}

export function stableHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

export interface CatalogSelectionIdentity {
  parentSourceId: string;
  parentSourceVersion: string;
  parentSourceHash: string;
  catalogItemId: string;
  originalSourceFamily: string;
  reviewState: string;
  eligibilityState: string;
  allowedStages: string[];
  limitations: string[];
}

export function signCatalogSelectionIdentity(identity: CatalogSelectionIdentity, secret: string): string {
  return `hmac-sha256:${createHmac('sha256', secret).update(stableStringify(identity)).digest('hex')}`;
}

export function verifyCatalogSelectionIdentity(identity: CatalogSelectionIdentity, proof: string, secret: string): boolean {
  const expected = signCatalogSelectionIdentity(identity, secret);
  const left = Buffer.from(expected);
  const right = Buffer.from(proof);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createQuestionSnapshot(input: z.input<typeof questionSnapshotSchema>): AssignmentQuestionSnapshot {
  const parsed = questionSnapshotSchema.parse(input);
  return deepFreeze({ ...structuredClone(parsed), contentHash: stableHash(parsed) });
}

export function validatePublicationScores(draft: AssignmentDraftInput): string[] {
  const issues: string[] = [];
  const questionTotal = sum(draft.questions.map((question) => question.points));
  if (!sameScore(questionTotal, draft.totalPoints)) {
    issues.push(`assignment-total-mismatch:${draft.totalPoints}:${questionTotal}`);
  }
  for (const question of draft.questions) {
    const criterionTotal = sum(question.rubric.criteria.map((criterion) => criterion.maxPoints));
    if (!sameScore(criterionTotal, question.points)) {
      issues.push(`question-rubric-total-mismatch:${question.stableQuestionId}:${question.points}:${criterionTotal}`);
    }
    if (question.rubric.schemaVersion === 'assignment-scoring-rubric.v2') {
      for (const criterion of question.rubric.criteria) {
        if (!criterion.detailedRubricEnabled && !criterion.scoringStandard.trim()) {
          issues.push(`scoring-standard-required:${question.stableQuestionId}:${criterion.id}`);
        }
        if (criterion.detailedRubricEnabled) {
          if (criterion.levels.some((level) => !level.guideline.trim())) {
            issues.push(`level-guideline-required:${question.stableQuestionId}:${criterion.id}`);
          }
          for (const levelIssue of validateDetailedRubricLevels(criterion.levels, criterion.maxPoints)) {
            issues.push(`invalid-detailed-rubric:${question.stableQuestionId}:${criterion.id}:${levelIssue}`);
          }
        }
      }
    }
  }
  return issues;
}

export function validatePublicationSchedule(audiences: readonly AssignmentAudienceInput[], now: Date): string[] {
  const issues: string[] = [];
  if (audiences.length === 0 || audiences.length > ASSIGNMENT_LIMITS.audiences) issues.push('invalid-audience-count');
  const ids = new Set<string>();
  for (const audience of audiences) {
    if (!audience.classId.trim() || ids.has(audience.classId)) issues.push(`invalid-or-duplicate-audience:${audience.classId}`);
    ids.add(audience.classId);
    const availableAt = Date.parse(audience.availableAt);
    const dueAt = Date.parse(audience.dueAt);
    if (!Number.isFinite(availableAt) || !Number.isFinite(dueAt) || dueAt <= availableAt || dueAt <= now.getTime()) {
      issues.push(`invalid-schedule:${audience.classId}`);
    }
  }
  return issues;
}

export function canTeacherReadHistory(input: {
  assignmentAuthorId: string;
  teacherId: string;
  isAdmin?: boolean;
  grants: readonly { teacherId: string; revokedAt?: string | null; expiresAt?: string | null }[];
  now: Date;
}): boolean {
  if (input.isAdmin || input.assignmentAuthorId === input.teacherId) return true;
  return input.grants.some((grant) => grant.teacherId === input.teacherId && !grant.revokedAt && (!grant.expiresAt || Date.parse(grant.expiresAt) > input.now.getTime()));
}

export function canStudentReadHistory(input: {
  studentId: string;
  ownerships: readonly { studentId: string; assignmentRevisionId: string }[];
  assignmentRevisionId: string;
}): boolean {
  return input.ownerships.some((ownership) => ownership.studentId === input.studentId && ownership.assignmentRevisionId === input.assignmentRevisionId);
}

export function canStudentReadCurrentDelivery(input: {
  studentId: string;
  audienceClassId: string;
  currentMemberships: readonly { studentId: string; classId: string }[];
  audiences: readonly { classId: string; availableAt: string; dueAt: string; archivedAt?: string | null }[];
  now: Date;
}): boolean {
  const isCurrentMember = input.currentMemberships.some((membership) => membership.studentId === input.studentId && membership.classId === input.audienceClassId);
  if (!isCurrentMember) return false;
  return input.audiences.some((audience) => audience.classId === input.audienceClassId
    && !audience.archivedAt
    && Date.parse(audience.availableAt) <= input.now.getTime()
    && Date.parse(audience.dueAt) >= input.now.getTime());
}

export function projectRevisionForTeacher(revision: AssignmentRevisionRecord): AssignmentRevisionRecord {
  return structuredClone(revision);
}

export function projectRevisionForStudent(input: {
  revision: AssignmentRevisionRecord;
  audienceClassId: string;
  now: Date;
}): Record<string, unknown> {
  const policy = input.revision.solutionReleasePolicy;
  const released = policy.mode === 'AT_TIME'
    && policy.audienceClassIds.includes(input.audienceClassId)
    && Date.parse(policy.releaseAt) <= input.now.getTime();
  return {
    id: input.revision.id,
    assignmentId: input.revision.assignmentId,
    revisionNumber: input.revision.revisionNumber,
    title: input.revision.title,
    instructions: input.revision.instructions,
    totalPoints: input.revision.totalPoints,
    questions: input.revision.questions.map((question) => ({
      stableQuestionId: question.stableQuestionId,
      responseType: question.responseType,
      points: question.points,
      prompt: question.prompt,
      ...(released && policy.includeReferenceAnswer ? { referenceAnswer: question.referenceAnswer } : {}),
      ...(released && policy.includeStudentVisibleGuidance ? {
        rubricGuidance: question.rubric.criteria.flatMap((criterion) => criterion.studentVisibleGuidance ? [{ criterionId: criterion.id, guidance: criterion.studentVisibleGuidance }] : []),
      } : {}),
    })),
  };
}

export const assignmentMutationEnvelopeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(16).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

export function assertMutationRequest(input: {
  method: string;
  requestOrigin: string | null;
  allowedOrigin: string;
  contentLength: number | null;
  maxBytes?: number;
}): void {
  if (input.method === 'GET' || input.method === 'HEAD') throw new AssignmentDomainError('mutation-method-required');
  if (!input.requestOrigin || normalizeOrigin(input.requestOrigin) !== normalizeOrigin(input.allowedOrigin)) {
    throw new AssignmentDomainError('invalid-origin');
  }
  if (input.contentLength !== null && input.contentLength > (input.maxBytes ?? 256_000)) {
    throw new AssignmentDomainError('payload-too-large');
  }
}

function normalizeOrigin(value: string): string {
  try { return new URL(value).origin; } catch { return ''; }
}

function sameScore(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.000_001;
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 0.000_000_1;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}
