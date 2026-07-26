import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const SUBMISSION_LIMITS = {
  text: 100_000,
  body: 256_000,
  file: 25 * 1024 * 1024,
  name: 240,
  assets: 10,
} as const;
export const ALLOWED_ASSIGNMENT_ASSET_FORMATS = [
  'PDF',
  'DOC',
  'DOCX',
  'PPTX',
  'PNG',
  'JPEG',
  'Markdown',
  '纯文本',
] as const;
export const checksumSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const embeddedAssetReferenceSchema = z.object({
  assetId: z.string().min(1).max(120),
  positionRef: z.string().regex(/^md:[a-zA-Z0-9_-]{1,80}$/),
}).strict();
export const textDraftSchema = z.object({
  version: z.number().int().positive(),
  text: z.string().max(SUBMISSION_LIMITS.text),
  embeddedAssets: z.array(embeddedAssetReferenceSchema).max(SUBMISSION_LIMITS.assets).default([]),
}).strict();
export const uploadIntentSchema = z.object({
  fileName: z.string().trim().min(1).max(SUBMISSION_LIMITS.name),
  mimeType: z.enum([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'text/markdown',
    'text/plain',
  ]),
  sizeBytes: z.number().int().positive().max(SUBMISSION_LIMITS.file),
  checksum: checksumSchema,
  assetRole: z.enum(['EMBEDDED_IMAGE', 'ATTACHMENT']).default('ATTACHMENT'),
  embeddedPosition: z.string().regex(/^md:[a-zA-Z0-9_-]{1,80}$/).optional(),
}).strict().superRefine((value, context) => {
  if (!isAllowedAssignmentAsset(value.fileName, value.mimeType)) {
    context.addIssue({ code: 'custom', path: ['fileName'], message: 'unsupported-assignment-asset-format' });
  }
  if (value.assetRole === 'EMBEDDED_IMAGE' && !['image/png', 'image/jpeg'].includes(value.mimeType)) {
    context.addIssue({ code: 'custom', path: ['mimeType'], message: 'embedded-asset-must-be-image' });
  }
  if (value.assetRole === 'EMBEDDED_IMAGE' && !value.embeddedPosition) {
    context.addIssue({ code: 'custom', path: ['embeddedPosition'], message: 'embedded-position-required' });
  }
  if (value.assetRole === 'ATTACHMENT' && value.embeddedPosition) {
    context.addIssue({ code: 'custom', path: ['embeddedPosition'], message: 'attachment-cannot-have-embedded-position' });
  }
});
export const finalizeSchema = z.object({ intentId: z.string().min(8).max(120), idempotencyKey: z.string().min(8).max(120) }).strict();
export const submitAnswerSchema = z.object({ answerVersion: z.number().int().positive(), idempotencyKey: z.string().min(8).max(120) }).strict();
export const reorderAssetsSchema = z.object({
  answerVersion: z.number().int().positive(),
  assetIds: z.array(z.string().min(1).max(120)).max(SUBMISSION_LIMITS.assets)
    .refine((ids) => new Set(ids).size === ids.length, 'duplicate-asset-reference'),
}).strict();
export const removeAssetSchema = z.object({
  answerVersion: z.number().int().positive(),
}).strict();

export class SubmissionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    public readonly metadata?: Record<string, unknown>,
  ) { super(code); }
}

const ASSIGNMENT_ASSET_EXTENSIONS: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'text/markdown': ['md', 'markdown'],
  'text/plain': ['txt'],
};

export function isAllowedAssignmentAsset(fileName: string, mimeType: string): boolean {
  const extension = fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return Boolean(extension && ASSIGNMENT_ASSET_EXTENSIONS[mimeType]?.includes(extension));
}

export function deriveLegacyAssignmentAssetOrder<T extends {
  id: string;
  version: number;
  createdAt: Date;
}>(assets: readonly T[]): T[] {
  return [...assets].sort((left, right) =>
    left.version - right.version
    || left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id));
}

export type LatePolicy = { version: 1; mode: 'CLOSED' } | { version: 1; mode: 'ALLOW'; penaltyPercentPerDay: number };

export function assertDeliveryWindow(input: { now: Date; availableAt: Date; dueAt: Date; latePolicy: LatePolicy }) {
  if (input.now < input.availableAt) throw new SubmissionError('assignment-not-available', 403);
  if (input.now > input.dueAt && input.latePolicy.mode === 'CLOSED') throw new SubmissionError('assignment-deadline-closed', 409);
}

export function mayReadSubmission(input: { currentClassId?: string | null; audienceClassId: string; studentId: string; ownerStudentId: string; hasSubmittedAttempt: boolean }) {
  return input.studentId === input.ownerStudentId
    && (input.currentClassId === input.audienceClassId || input.hasSubmittedAttempt);
}

export function deriveAggregate(requiredAnswers: Array<{ state: string }>) {
  const submittedRequiredCount = requiredAnswers.filter((answer) => answer.state === 'SUBMITTED').length;
  return {
    submittedRequiredCount,
    requiredQuestionCount: requiredAnswers.length,
    state: submittedRequiredCount === requiredAnswers.length && requiredAnswers.length > 0
      ? 'SUBMITTED' as const
      : requiredAnswers.some((answer) => answer.state !== 'NOT_STARTED') ? 'IN_PROGRESS' as const : 'NOT_STARTED' as const,
  };
}

export function opaqueObjectKey() {
  const token = randomBytes(24).toString('hex');
  return `quarantine/${token.slice(0, 2)}/${token}`;
}

export function submissionHash(value: unknown) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

export function assertSubmissionObjectIntegrity(bytes: Uint8Array, expectedSizeBytes: number, expectedChecksum: string): void {
  const actualChecksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (bytes.byteLength !== expectedSizeBytes || actualChecksum !== expectedChecksum) {
    throw new SubmissionError('asset-integrity-mismatch', 502);
  }
}
