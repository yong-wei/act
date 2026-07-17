import { fileURLToPath } from 'node:url';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { createDefaultReviewedDerivativeRenderer } from '../../src/lib/data-governance/teacher-assignment-review-derivative-storage';
import { defaultReviewedDerivativeOptions } from '../../src/lib/data-governance/teacher-assignment-review-derivative';
import {
  drainTeacherAssignmentReviewOutbox,
  type TeacherAssignmentReviewOutboxHandlers,
} from '../../src/lib/data-governance/teacher-assignment-review-outbox';
import { drainTeacherAssignmentResubmissionIntakes } from '../../src/lib/data-governance/teacher-assignment-resubmission-intake';

const DEFAULT_INTERVAL_MS = 5_000;

export async function runTeacherAssignmentReviewOutboxWorkerTick(input: {
  db: any;
  handlers: TeacherAssignmentReviewOutboxHandlers;
  limit?: number;
  now?: () => Date;
}) {
  const [reviewOutbox, resubmissionIntakes] = await Promise.all([
    drainTeacherAssignmentReviewOutbox(input),
    drainTeacherAssignmentResubmissionIntakes({ db: input.db, limit: input.limit, now: input.now }),
  ]);
  return { reviewOutbox, resubmissionIntakes };
}

export function createTeacherAssignmentReviewOutboxWorker(input: {
  db: any;
  handlers: TeacherAssignmentReviewOutboxHandlers;
  intervalMs?: number;
  limit?: number;
  onError?: (error: unknown) => void;
}) {
  let closed = false;
  let active: Promise<unknown> | null = null;
  const tick = () => {
    if (closed || active) return active ?? Promise.resolve();
    active = runTeacherAssignmentReviewOutboxWorkerTick({ db: input.db, handlers: input.handlers, limit: input.limit })
      .catch((error) => input.onError?.(error))
      .finally(() => { active = null; });
    return active;
  };
  const timer = setInterval(() => { void tick(); }, input.intervalMs ?? DEFAULT_INTERVAL_MS);
  timer.unref?.();
  void tick();
  return {
    tick,
    async close() {
      closed = true;
      clearInterval(timer);
      await active;
    },
  };
}

async function start() {
  const db = createPrismaClient();
  const renderer = createDefaultReviewedDerivativeRenderer();
  const controller = createTeacherAssignmentReviewOutboxWorker({
    db,
    handlers: {
      derivativeRenderer: renderer,
      derivativeOptions: defaultReviewedDerivativeOptions({ generatorVersion: process.env.TEACHER_REVIEW_DERIVATIVE_GENERATOR_VERSION, markitdownVersion: process.env.MARKITDOWN_VERSION, mathpixVersion: process.env.MATHPIX_VERSION }),
    },
    intervalMs: parsePositiveInt(process.env.TEACHER_REVIEW_OUTBOX_INTERVAL_MS, DEFAULT_INTERVAL_MS),
    limit: parsePositiveInt(process.env.TEACHER_REVIEW_OUTBOX_BATCH_SIZE, 25),
    onError: (error) => console.error('[TeacherAssignmentReviewOutbox] tick failed', safeError(error)),
  });
  const shutdown = async (code: number) => {
    await controller.close();
    await db.$disconnect();
    process.exit(code);
  };
  process.on('SIGTERM', () => void shutdown(0));
  process.on('SIGINT', () => void shutdown(0));
  console.log('[TeacherAssignmentReviewOutbox] worker started');
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function safeError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start().catch((error) => {
    console.error('[TeacherAssignmentReviewOutbox] worker failed to start', safeError(error));
    process.exit(1);
  });
}
