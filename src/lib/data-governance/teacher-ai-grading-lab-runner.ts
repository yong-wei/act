import { createHash } from 'node:crypto';

import { complete } from './teacher-ai-grading-lab-run-store';

type ExperimentDb = Record<string, any>;

export interface TeacherAiGradingRawOutputMetadata {
  key: string;
  ownerId: string;
  checksum: string;
  claimFingerprint: string;
  attempt: number;
}

export interface TeacherAiGradingRawOutputWriter {
  write(input: TeacherAiGradingRawOutputMetadata & {
    bytes: Uint8Array;
    mimeType: 'application/json';
    signal?: AbortSignal;
  }): Promise<string>;
  head(key: string): Promise<TeacherAiGradingRawOutputMetadata | null>;
  delete(key: string, signal?: AbortSignal): Promise<void>;
}

export async function persistClaimedRawOutput(input: {
  db: ExperimentDb;
  executionId: string;
  claimToken: string;
  bytes: Uint8Array;
  writer: TeacherAiGradingRawOutputWriter;
  clock?: () => Date;
  beforeComplete?: () => Promise<void>;
  signal?: AbortSignal;
}): Promise<any> {
  if (input.bytes.byteLength === 0) throw new Error('experiment-raw-output-empty');
  const clock = input.clock ?? (() => new Date());
  const execution = await input.db.teacherAiGradingExperimentExecution.findUnique({ where: { id: input.executionId } });
  const startedAt = clock();
  if (!execution) throw new Error('experiment-execution-not-found');
  if (execution.state !== 'RUNNING'
    || execution.claimToken !== input.claimToken
    || !execution.leaseExpiresAt
    || execution.leaseExpiresAt <= startedAt) {
    throw new Error('experiment-execution-fenced');
  }

  const claimFingerprint = sha256(input.claimToken);
  const ownerId = `teacher-ai-grading-execution:${execution.id}`;
  const checksum = sha256(input.bytes);
  const key = [
    'teacher-ai-grading',
    'raw-output',
    encodeURIComponent(execution.id),
    String(execution.attemptCount),
    `${claimFingerprint.slice(7)}.json`,
  ].join('/');
  const metadata = {
    key,
    ownerId,
    checksum,
    claimFingerprint,
    attempt: execution.attemptCount,
  };

  const writtenKey = await input.writer.write({
    ...metadata,
    bytes: input.bytes,
    mimeType: 'application/json',
    signal: input.signal,
  });
  try {
    if (writtenKey !== key) throw new Error('experiment-raw-output-key-not-stable');
    await assertOwnedRawOutput(input.writer, metadata);
    await input.beforeComplete?.();
    return await complete({
      db: input.db,
      executionId: execution.id,
      claimToken: input.claimToken,
      rawOutputObjectKey: key,
      rawOutputChecksum: checksum,
      now: clock(),
    });
  } catch (error) {
    await deleteOwnedRawOutput(input.writer, { ...metadata, key: writtenKey });
    throw error;
  }
}

async function assertOwnedRawOutput(
  writer: TeacherAiGradingRawOutputWriter,
  expected: TeacherAiGradingRawOutputMetadata,
): Promise<void> {
  const stored = await writer.head(expected.key);
  if (!stored
    || stored.ownerId !== expected.ownerId
    || stored.checksum !== expected.checksum
    || stored.claimFingerprint !== expected.claimFingerprint
    || stored.attempt !== expected.attempt) {
    throw new Error('experiment-raw-output-ownership-verification-failed');
  }
}

async function deleteOwnedRawOutput(
  writer: TeacherAiGradingRawOutputWriter,
  expected: TeacherAiGradingRawOutputMetadata,
): Promise<void> {
  const stored = await writer.head(expected.key);
  if (!stored) return;
  if (stored.ownerId !== expected.ownerId
    || stored.checksum !== expected.checksum
    || stored.claimFingerprint !== expected.claimFingerprint
    || stored.attempt !== expected.attempt) {
    throw new Error('experiment-raw-output-orphan-owner-mismatch');
  }
  await writer.delete(expected.key);
}

function sha256(value: string | Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
