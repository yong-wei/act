import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPrismaClient } from '../../src/lib/prisma-client';

const VALUE_FLAGS = new Set(['--session-id', '--class-id', '--teacher-id']);

export interface ClassSessionAttributionRepairOptions {
  sessionId: string;
  classId: string;
  teacherId: string | null;
  apply: boolean;
}

export interface ClassSessionAttributionRepairReport {
  mode: 'dry-run' | 'apply';
  eligible: number;
  updated: number;
  sessionRef: string;
  classRef: string;
  teacherRef: string;
}

interface RepairTransaction {
  classSession: {
    findUnique(args: Record<string, unknown>): Promise<{
      id: string;
      teacherId: string;
      classId: string | null;
      status: string;
    } | null>;
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  class: {
    findUnique(args: Record<string, unknown>): Promise<{
      id: string;
      teacherId: string;
    } | null>;
  };
}

interface RepairDatabase {
  $transaction<T>(
    operation: (transaction: RepairTransaction) => Promise<T>,
    options: { isolationLevel: 'Serializable' },
  ): Promise<T>;
}

export class ClassSessionAttributionRepairError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ClassSessionAttributionRepairError';
  }
}

export function parseClassSessionAttributionRepairArgs(
  argv: string[],
): ClassSessionAttributionRepairOptions {
  const values = new Map<string, string>();
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const separatorIndex = argument.indexOf('=');
    const name = separatorIndex >= 0 ? argument.slice(0, separatorIndex) : argument;
    const inlineValue = separatorIndex >= 0 ? argument.slice(separatorIndex + 1) : null;

    if (name === '--apply') {
      if (inlineValue !== null || apply) {
        throw new ClassSessionAttributionRepairError('invalid-or-duplicate-apply-flag');
      }
      apply = true;
      continue;
    }

    if (!VALUE_FLAGS.has(name)) {
      throw new ClassSessionAttributionRepairError('unsupported-class-session-repair-argument');
    }
    if (values.has(name)) {
      throw new ClassSessionAttributionRepairError('duplicate-class-session-repair-argument');
    }

    const value = inlineValue ?? argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new ClassSessionAttributionRepairError('missing-class-session-repair-argument-value');
    }
    if (inlineValue === null) {
      index += 1;
    }
    values.set(name, value);
  }

  const sessionId = values.get('--session-id');
  const classId = values.get('--class-id');
  if (!sessionId || !classId) {
    throw new ClassSessionAttributionRepairError(
      'class-session-repair-requires-session-id-and-class-id',
    );
  }

  return {
    sessionId,
    classId,
    teacherId: values.get('--teacher-id') ?? null,
    apply,
  };
}

export async function runClassSessionAttributionRepair(
  database: RepairDatabase,
  options: ClassSessionAttributionRepairOptions,
): Promise<ClassSessionAttributionRepairReport> {
  return database.$transaction(async (transaction) => {
    const session = await transaction.classSession.findUnique({
      where: { id: options.sessionId },
      select: {
        id: true,
        teacherId: true,
        classId: true,
        status: true,
      },
    });
    if (!session) {
      throw new ClassSessionAttributionRepairError('class-session-not-found');
    }
    if (options.teacherId && options.teacherId !== session.teacherId) {
      throw new ClassSessionAttributionRepairError('class-session-teacher-filter-mismatch');
    }
    if (session.status !== 'FINISHED') {
      throw new ClassSessionAttributionRepairError('class-session-repair-requires-finished-session');
    }
    if (session.classId !== null) {
      throw new ClassSessionAttributionRepairError('class-session-already-attributed');
    }

    const targetClass = await transaction.class.findUnique({
      where: { id: options.classId },
      select: {
        id: true,
        teacherId: true,
      },
    });
    if (!targetClass) {
      throw new ClassSessionAttributionRepairError('class-session-repair-class-not-found');
    }
    if (targetClass.teacherId !== session.teacherId) {
      throw new ClassSessionAttributionRepairError('class-session-repair-cross-teacher-rejected');
    }

    let updated = 0;
    if (options.apply) {
      const result = await transaction.classSession.updateMany({
        where: {
          id: session.id,
          teacherId: session.teacherId,
          status: 'FINISHED',
          classId: null,
        },
        data: {
          classId: targetClass.id,
        },
      });
      if (result.count !== 1) {
        throw new ClassSessionAttributionRepairError('class-session-repair-write-conflict');
      }
      updated = result.count;
    }

    return {
      mode: options.apply ? 'apply' : 'dry-run',
      eligible: 1,
      updated,
      sessionRef: redactedRef('session', session.id),
      classRef: redactedRef('class', targetClass.id),
      teacherRef: redactedRef('teacher', session.teacherId),
    };
  }, { isolationLevel: 'Serializable' });
}

function redactedRef(kind: string, id: string): string {
  return createHash('sha256')
    .update(`${kind}\0${id}`)
    .digest('hex')
    .slice(0, 12);
}

async function runCli(): Promise<void> {
  let database: ReturnType<typeof createPrismaClient> | null = null;
  try {
    const options = parseClassSessionAttributionRepairArgs(process.argv.slice(2));
    database = createPrismaClient();
    const report = await runClassSessionAttributionRepair(
      database as unknown as RepairDatabase,
      options,
    );
    console.log(JSON.stringify({ result: 'ok', ...report }));
  } catch (error) {
    const code = error instanceof ClassSessionAttributionRepairError
      ? error.code
      : 'unexpected-class-session-repair-failure';
    console.error(JSON.stringify({ result: 'failed', code }));
    process.exitCode = 1;
  } finally {
    await database?.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void runCli();
}
