import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const SUBMISSION_LIMITS = { text: 100_000, body: 256_000, file: 25 * 1024 * 1024, name: 240 } as const;
export const checksumSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const textDraftSchema = z.object({ version: z.number().int().positive(), text: z.string().max(SUBMISSION_LIMITS.text) }).strict();
export const uploadIntentSchema = z.object({
  fileName: z.string().trim().min(1).max(SUBMISSION_LIMITS.name),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  sizeBytes: z.number().int().positive().max(SUBMISSION_LIMITS.file),
  checksum: checksumSchema,
}).strict();
export const finalizeSchema = z.object({ intentId: z.string().min(8).max(120), idempotencyKey: z.string().min(8).max(120) }).strict();
export const submitAnswerSchema = z.object({ answerVersion: z.number().int().positive(), idempotencyKey: z.string().min(8).max(120) }).strict();

export class SubmissionError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
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
