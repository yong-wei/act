import { fileURLToPath } from 'node:url';

import { Prisma } from '@prisma/client';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { TEACHER_CLASS_BINDING_ENFORCEMENT_SETTING } from '../../src/lib/teacher-class-binding-enforcement';

const DEFAULT_TRANSACTION_ATTEMPTS = 3;

export type DefaultClassReconciliationMode = 'dry-run' | 'apply' | 'verify';

export interface DefaultClassReconciliationOptions {
  mode: DefaultClassReconciliationMode;
  writerDrained: boolean;
  enableTeacherClassBinding?: boolean;
  producerInventoryVerified?: boolean;
}

export interface DefaultClassInvariantReport {
  invalidDefaultCount: number;
  missingDefaultCount: number;
  defaultWithoutActiveClassCount: number;
  duplicateDefaultCount: number;
}

export interface DefaultClassReconciliationResult {
  mode: DefaultClassReconciliationMode;
  changedDefaultCount: number;
  assignedDefaultCount: number;
  clearedDefaultCount: number;
  invariant: DefaultClassInvariantReport;
  teacherClassBindingEnabled: boolean;
}

type ReconciliationRow = {
  userId: string;
  currentDefaultClassId: string | null;
  desiredDefaultClassId: string | null;
};

type ReconciliationDb = {
  $transaction<T>(
    operation: (tx: ReconciliationTransaction) => Promise<T>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
};

type ReconciliationTransaction = {
  $executeRaw(query: Prisma.Sql): Promise<number>;
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
  platformSetting: {
    upsert(args: {
      where: { key: string };
      create: { key: string; value: Prisma.InputJsonValue };
      update: { value: Prisma.InputJsonValue };
    }): Promise<unknown>;
  };
};

export class DefaultClassReconciliationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'DefaultClassReconciliationError';
  }
}

const advisoryLockQuery = Prisma.sql`
  SELECT pg_advisory_xact_lock(hashtext('teacher-default-class-reconciliation'))
`;

const reconciliationPlanQuery = Prisma.sql`
  WITH ranked_active_classes AS (
    SELECT
      class_item."teacherId",
      class_item."id",
      ROW_NUMBER() OVER (
        PARTITION BY class_item."teacherId"
        ORDER BY class_item."createdAt" DESC, class_item."id" DESC
      ) AS "rank"
    FROM "Class" AS class_item
    INNER JOIN "User" AS teacher
      ON teacher."id" = class_item."teacherId"
      AND teacher."role" = 'TEACHER'
    WHERE class_item."isActive" = TRUE
  ), desired_defaults AS (
    SELECT
      user_item."id" AS "userId",
      user_item."defaultTeachingClassId" AS "currentDefaultClassId",
      CASE
        WHEN user_item."role" = 'TEACHER' AND current_class."id" IS NOT NULL
          THEN user_item."defaultTeachingClassId"
        WHEN user_item."role" = 'TEACHER'
          THEN replacement_class."id"
        ELSE NULL
      END AS "desiredDefaultClassId"
    FROM "User" AS user_item
    LEFT JOIN "Class" AS current_class
      ON current_class."id" = user_item."defaultTeachingClassId"
      AND current_class."teacherId" = user_item."id"
      AND current_class."isActive" = TRUE
    LEFT JOIN ranked_active_classes AS replacement_class
      ON replacement_class."teacherId" = user_item."id"
      AND replacement_class."rank" = 1
  )
  SELECT "userId", "currentDefaultClassId", "desiredDefaultClassId"
  FROM desired_defaults
  ORDER BY "userId" ASC
`;

const applyReconciliationQuery = Prisma.sql`
  WITH ranked_active_classes AS (
    SELECT
      class_item."teacherId",
      class_item."id",
      ROW_NUMBER() OVER (
        PARTITION BY class_item."teacherId"
        ORDER BY class_item."createdAt" DESC, class_item."id" DESC
      ) AS "rank"
    FROM "Class" AS class_item
    INNER JOIN "User" AS teacher
      ON teacher."id" = class_item."teacherId"
      AND teacher."role" = 'TEACHER'
    WHERE class_item."isActive" = TRUE
  ), desired_defaults AS (
    SELECT
      user_item."id" AS "userId",
      CASE
        WHEN user_item."role" = 'TEACHER' AND current_class."id" IS NOT NULL
          THEN user_item."defaultTeachingClassId"
        WHEN user_item."role" = 'TEACHER'
          THEN replacement_class."id"
        ELSE NULL
      END AS "desiredDefaultClassId"
    FROM "User" AS user_item
    LEFT JOIN "Class" AS current_class
      ON current_class."id" = user_item."defaultTeachingClassId"
      AND current_class."teacherId" = user_item."id"
      AND current_class."isActive" = TRUE
    LEFT JOIN ranked_active_classes AS replacement_class
      ON replacement_class."teacherId" = user_item."id"
      AND replacement_class."rank" = 1
  )
  UPDATE "User" AS user_item
  SET "defaultTeachingClassId" = desired_defaults."desiredDefaultClassId"
  FROM desired_defaults
  WHERE user_item."id" = desired_defaults."userId"
    AND user_item."defaultTeachingClassId"
      IS DISTINCT FROM desired_defaults."desiredDefaultClassId"
`;

const invariantReportQuery = Prisma.sql`
  SELECT
    (
      SELECT COUNT(*)
      FROM "User" AS user_item
      LEFT JOIN "Class" AS default_class
        ON default_class."id" = user_item."defaultTeachingClassId"
      WHERE user_item."defaultTeachingClassId" IS NOT NULL
        AND (
          user_item."role" <> 'TEACHER'
          OR default_class."teacherId" IS DISTINCT FROM user_item."id"
          OR default_class."isActive" IS NOT TRUE
        )
    ) AS "invalidDefaultCount",
    (
      SELECT COUNT(*)
      FROM "User" AS teacher
      WHERE teacher."role" = 'TEACHER'
        AND EXISTS (
          SELECT 1
          FROM "Class" AS active_class
          WHERE active_class."teacherId" = teacher."id"
            AND active_class."isActive" = TRUE
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "Class" AS default_class
          WHERE default_class."id" = teacher."defaultTeachingClassId"
            AND default_class."teacherId" = teacher."id"
            AND default_class."isActive" = TRUE
        )
    ) AS "missingDefaultCount",
    (
      SELECT COUNT(*)
      FROM "User" AS teacher
      WHERE teacher."role" = 'TEACHER'
        AND teacher."defaultTeachingClassId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "Class" AS active_class
          WHERE active_class."teacherId" = teacher."id"
            AND active_class."isActive" = TRUE
        )
    ) AS "defaultWithoutActiveClassCount",
    (
      SELECT COALESCE(SUM(duplicate_counts."count" - 1), 0)
      FROM (
        SELECT COUNT(*) AS "count"
        FROM "User"
        WHERE "defaultTeachingClassId" IS NOT NULL
        GROUP BY "defaultTeachingClassId"
        HAVING COUNT(*) > 1
      ) AS duplicate_counts
    ) AS "duplicateDefaultCount"
`;

export function parseDefaultClassReconciliationArgs(argv: string[]): DefaultClassReconciliationOptions {
  const apply = argv.includes('--apply');
  const verify = argv.includes('--verify');
  const dryRun = argv.includes('--dry-run');
  if ([apply, verify, dryRun].filter(Boolean).length > 1) {
    throw new DefaultClassReconciliationError('reconciliation-mode-must-be-exclusive');
  }
  if (apply && !argv.includes('--writer-drained')) {
    throw new DefaultClassReconciliationError('apply-requires-writer-drained');
  }
  if (argv.includes('--enable-teacher-class-binding') && !apply) {
    throw new DefaultClassReconciliationError('enable-requires-apply');
  }
  if (argv.includes('--enable-teacher-class-binding') && !argv.includes('--producer-inventory-verified')) {
    throw new DefaultClassReconciliationError('enable-requires-producer-inventory-verification');
  }
  return {
    mode: apply ? 'apply' : verify ? 'verify' : 'dry-run',
    writerDrained: argv.includes('--writer-drained'),
    enableTeacherClassBinding: argv.includes('--enable-teacher-class-binding'),
    producerInventoryVerified: argv.includes('--producer-inventory-verified'),
  };
}

export async function reconcileTeacherDefaultClasses(
  db: ReconciliationDb,
  options: DefaultClassReconciliationOptions,
  transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
  now = () => new Date(),
): Promise<DefaultClassReconciliationResult> {
  if (!Number.isInteger(transactionAttempts) || transactionAttempts < 1) {
    throw new TypeError('transactionAttempts must be a positive integer');
  }
  if (options.mode === 'apply' && !options.writerDrained) {
    throw new DefaultClassReconciliationError('apply-requires-writer-drained');
  }
  if (options.enableTeacherClassBinding
    && (options.mode !== 'apply' || !options.producerInventoryVerified)) {
    throw new DefaultClassReconciliationError('enable-requires-producer-inventory-verification');
  }

  for (let attempt = 0; attempt < transactionAttempts; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.$executeRaw(advisoryLockQuery);
        const invariantBefore = await readInvariantReport(tx);
        if (options.mode === 'verify') {
          assertZeroViolations(invariantBefore);
          return emptyResult(options.mode, invariantBefore);
        }

        const plan = await tx.$queryRaw<ReconciliationRow[]>(reconciliationPlanQuery);
        const changes = plan.filter(
          (item) => item.currentDefaultClassId !== item.desiredDefaultClassId,
        );
        const result = {
          mode: options.mode,
          changedDefaultCount: changes.length,
          assignedDefaultCount: changes.filter((item) => item.desiredDefaultClassId !== null).length,
          clearedDefaultCount: changes.filter((item) => item.desiredDefaultClassId === null).length,
          invariant: invariantBefore,
          teacherClassBindingEnabled: false,
        } satisfies DefaultClassReconciliationResult;
        if (options.mode === 'dry-run') return result;

        const updatedCount = await tx.$executeRaw(applyReconciliationQuery);
        if (updatedCount !== result.changedDefaultCount) {
          throw new DefaultClassReconciliationError('reconciliation-plan-drift');
        }
        const invariantAfter = await readInvariantReport(tx);
        assertZeroViolations(invariantAfter);
        if (options.enableTeacherClassBinding) {
          const verifiedAt = now().toISOString();
          await tx.platformSetting.upsert({
            where: { key: TEACHER_CLASS_BINDING_ENFORCEMENT_SETTING },
            create: {
              key: TEACHER_CLASS_BINDING_ENFORCEMENT_SETTING,
              value: {
                version: 1,
                enabled: true,
                invariantVerifiedAt: verifiedAt,
                producerInventoryVerifiedAt: verifiedAt,
              },
            },
            update: {
              value: {
                version: 1,
                enabled: true,
                invariantVerifiedAt: verifiedAt,
                producerInventoryVerifiedAt: verifiedAt,
              },
            },
          });
        }
        return {
          ...result,
          invariant: invariantAfter,
          teacherClassBindingEnabled: Boolean(options.enableTeacherClassBinding),
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!hasPrismaCode(error, 'P2034') || attempt === transactionAttempts - 1) throw error;
    }
  }
  throw new DefaultClassReconciliationError('transaction-conflict-retryable');
}

async function readInvariantReport(tx: ReconciliationTransaction): Promise<DefaultClassInvariantReport> {
  const [report] = await tx.$queryRaw<Array<Record<string, unknown>>>(invariantReportQuery);
  return {
    invalidDefaultCount: toCount(report?.invalidDefaultCount),
    missingDefaultCount: toCount(report?.missingDefaultCount),
    defaultWithoutActiveClassCount: toCount(report?.defaultWithoutActiveClassCount),
    duplicateDefaultCount: toCount(report?.duplicateDefaultCount),
  };
}

function emptyResult(
  mode: DefaultClassReconciliationMode,
  invariant: DefaultClassInvariantReport,
): DefaultClassReconciliationResult {
  return {
    mode,
    changedDefaultCount: 0,
    assignedDefaultCount: 0,
    clearedDefaultCount: 0,
    invariant,
    teacherClassBindingEnabled: false,
  };
}

function assertZeroViolations(invariant: DefaultClassInvariantReport) {
  if (Object.values(invariant).some((count) => count !== 0)) {
    throw new DefaultClassReconciliationError('default-class-invariant-violation');
  }
}

function toCount(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'bigint' && value >= BigInt(0) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new DefaultClassReconciliationError('invalid-invariant-count');
}

function hasPrismaCode(error: unknown, code: string) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === code,
  );
}

async function main() {
  const db = createPrismaClient();
  try {
    const result = await reconcileTeacherDefaultClasses(
      db as unknown as ReconciliationDb,
      parseDefaultClassReconciliationArgs(process.argv.slice(2)),
    );
    console.log(JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    const code = error instanceof DefaultClassReconciliationError
      ? error.code
      : 'operation-failed';
    console.error(JSON.stringify({ status: 'failed', code }));
    process.exitCode = 1;
  });
}
