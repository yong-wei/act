import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import pg from 'pg';

const root = process.cwd();
const required = process.env.ARENA_OFFICIAL_FOLLOWUP_POSTGRES_REQUIRED === '1';
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'arena-official-followup-pg-'));

function run(file: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(file, args, {
    cwd: root,
    encoding: 'utf8',
    env,
  });
}

function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function requireOk(result: ReturnType<typeof run>, label: string) {
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stderr || result.stdout}`);
  }
}

async function startEphemeralPostgres() {
  const bindir = run('pg_config', ['--bindir']);
  requireOk(bindir, 'pg_config --bindir');
  const postgresBin = bindir.stdout.trim();
  const initdb = path.join(postgresBin, 'initdb');
  const pgCtl = path.join(postgresBin, 'pg_ctl');
  const dataDir = path.join(tempRoot, 'data');
  requireOk(run(initdb, ['-D', dataDir, '--auth=trust', '--username=postgres', '--no-locale']), 'initdb');
  const port = await availablePort();
  requireOk(run(pgCtl, [
    '-D', dataDir,
    '-l', path.join(tempRoot, 'postgres.log'),
    '-o', `-p ${port} -h 127.0.0.1`,
    '-w',
    'start',
  ]), 'pg_ctl start');
  return {
    pgCtl,
    dataDir,
    adminUrl: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    databaseUrl: `postgresql://postgres@127.0.0.1:${port}/arena_followup_smoke`,
  };
}

async function main() {
  let ephemeral: Awaited<ReturnType<typeof startEphemeralPostgres>> | null = null;
  let admin: pg.Client | null = null;
  let db: pg.Client | null = null;
  let prisma: { $disconnect(): Promise<void> } | null = null;
  try {
    ephemeral = await startEphemeralPostgres();
    admin = new pg.Client({ connectionString: ephemeral.adminUrl });
    await admin.connect();
    await admin.query('CREATE DATABASE arena_followup_smoke');
    await admin.end();
    admin = null;

    const migrate = run(process.execPath, [
      'node_modules/prisma/build/index.js',
      'migrate',
      'deploy',
      '--config',
      './prisma.config.ts',
    ], {
      ...process.env,
      DATABASE_URL: ephemeral.databaseUrl,
    });
    requireOk(migrate, 'prisma migrate deploy');

    db = new pg.Client({ connectionString: ephemeral.databaseUrl });
    await db.connect();
    const version = await db.query<{ version: string }>('SELECT version()');
    assert.match(version.rows[0]?.version ?? '', /PostgreSQL/i);

    const index = await db.query<{ indexdef: string }>(`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'AIIntervention_arenaOfficial_userId_sessionId_key'
    `);
    assert.equal(index.rows.length, 1, 'partial unique index missing after migrate deploy');
    assert.match(index.rows[0]!.indexdef, /UNIQUE/i);
    assert.match(index.rows[0]!.indexdef, /arena-official:%/);

    await db.query(`
      INSERT INTO "User" ("id", "email", "role", "createdAt", "updatedAt")
      VALUES (
        'user-followup-smoke',
        'followup-smoke@example.test',
        'STUDENT',
        NOW(),
        NOW()
      )
    `);

    const officialSession = 'arena-official:task-1:submission-1';
    await db.query(`
      INSERT INTO "AIIntervention" (
        "id", "userId", "sessionId", "triggerType", "interventionType", "content"
      ) VALUES (
        'advice-1', 'user-followup-smoke', $1, 'arena-official:constraint-violation', 'guidance', 'next'
      )
    `, [officialSession]);

    await assert.rejects(async () => {
      await db!.query(`
        INSERT INTO "AIIntervention" (
          "id", "userId", "sessionId", "triggerType", "interventionType", "content"
        ) VALUES (
          'advice-2', 'user-followup-smoke', $1, 'arena-official:constraint-violation', 'guidance', 'dup'
        )
      `, [officialSession]);
    }, (error: unknown) => (error as { code?: string }).code === '23505');

    const unofficialSession = 'arena-practice:task-1:submission-1';
    await db.query(`
      INSERT INTO "AIIntervention" (
        "id", "userId", "sessionId", "triggerType", "interventionType", "content"
      ) VALUES
        ('practice-1', 'user-followup-smoke', $1, 'practice', 'guidance', 'a'),
        ('practice-2', 'user-followup-smoke', $1, 'practice', 'guidance', 'b')
    `, [unofficialSession]);

    const officialCount = await db.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM "AIIntervention"
      WHERE "userId" = 'user-followup-smoke' AND "sessionId" = $1
    `, [officialSession]);
    const unofficialCount = await db.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM "AIIntervention"
      WHERE "userId" = 'user-followup-smoke' AND "sessionId" = $1
    `, [unofficialSession]);
    assert.equal(officialCount.rows[0]?.count, '1');
    assert.equal(unofficialCount.rows[0]?.count, '2');

    const reservationTable = await db.query<{ tablename: string }>(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = 'ArenaOfficialSubmitReservation'
    `);
    assert.equal(reservationTable.rows.length, 1, 'official submit reservation table missing after migrate deploy');
    const reservationOrder = await db.query<{ indexdef: string }>(`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'ArenaOfficialSubmitReservation_scope_submittedAt_key'
    `);
    assert.equal(reservationOrder.rows.length, 1, 'official submit order unique index missing');
    assert.match(reservationOrder.rows[0]!.indexdef, /UNIQUE/i);

    process.env.DATABASE_URL = ephemeral.databaseUrl;
    const { createPrismaClient } = await import('../../src/lib/prisma-client');
    const {
      attachOfficialArenaSubmissionReservation,
      releaseOfficialSubmitReservation,
      reserveOfficialArenaSubmissionOrder,
    } = await import('../../src/features/arena/student/official-submit-gate');
    const { readArenaOfficialRevisit } = await import('../../src/features/arena/student/konling-official-followup');
    prisma = createPrismaClient();

    const userId = 'user-followup-smoke';
    const taskId = 'task-official-order';
    await insertOfficialSubmission(db, {
      id: 'submission-baseline',
      userId,
      taskId,
      artifactHash: 'hash-baseline',
      submittedAt: '2026-08-17T00:00:00.000Z',
      score: 40,
      valid: false,
    });
    await db.query(`
      UPDATE "AIIntervention"
      SET
        "sessionId" = $1,
        evidence = $2::jsonb
      WHERE id = 'advice-1'
    `, [
      `arena-official:${taskId}:submission-baseline`,
      JSON.stringify({
        sourceSubmissionId: 'submission-baseline',
        sourceSubmission: {
          score: 40,
          submittedAt: '2026-08-17T00:00:00.000Z',
          metrics: { settlingTime: 4 },
          hardConstraintResults: [{ id: 'stability', label: '稳定性', passed: false }],
        },
      }),
    ]);

    const earlier = await reserveOfficialArenaSubmissionOrder({
      db: prisma as never,
      userId,
      taskId,
    });
    const later = await reserveOfficialArenaSubmissionOrder({
      db: prisma as never,
      userId,
      taskId,
    });
    assert.ok(Date.parse(earlier.submittedAt) < Date.parse(later.submittedAt), 'reserved official order must be monotonic');
    const sameMs = await reserveOfficialArenaSubmissionOrder({
      db: prisma as never,
      userId,
      taskId: 'task-official-same-ms',
    });
    await assert.rejects(async () => {
      await db!.query(`
        INSERT INTO "ArenaOfficialSubmitReservation" ("id", "userId", "taskId", "classId", "submittedAt")
        VALUES ('reservation-forced-same-ms-dup', $1, 'task-official-same-ms', '', $2)
      `, [userId, sameMs.submittedAt]);
    }, (error: unknown) => (error as { code?: string }).code === '23505');
    const afterCollision = await reserveOfficialArenaSubmissionOrder({
      db: prisma as never,
      userId,
      taskId: 'task-official-same-ms',
    });
    assert.ok(
      Date.parse(afterCollision.submittedAt) > Date.parse(sameMs.submittedAt),
      'lock-scoped reserve must advance past an existing same-millisecond timestamp',
    );

    await insertOfficialSubmission(db, {
      id: 'submission-later',
      userId,
      taskId,
      artifactHash: 'hash-later',
      submittedAt: later.submittedAt,
      score: 80,
      valid: true,
    });
    await attachOfficialArenaSubmissionReservation({
      db: prisma as never,
      reservationId: later.id,
      submissionId: 'submission-later',
    });
    const laterRevisit = await readArenaOfficialRevisit({
      db: prisma as never,
      submission: officialRecord({
        id: 'submission-later',
        userId,
        taskId,
        submittedAt: later.submittedAt,
        score: 80,
        valid: true,
      }),
    });
    assert.equal(laterRevisit, null, 'later persisted claimant must not close before the reserved next submission');

    await insertOfficialSubmission(db, {
      id: 'submission-earlier',
      userId,
      taskId,
      artifactHash: 'hash-earlier',
      submittedAt: earlier.submittedAt,
      score: 70,
      valid: true,
    });
    await attachOfficialArenaSubmissionReservation({
      db: prisma as never,
      reservationId: earlier.id,
      submissionId: 'submission-earlier',
    });
    const earlierRevisit = await readArenaOfficialRevisit({
      db: prisma as never,
      submission: officialRecord({
        id: 'submission-earlier',
        userId,
        taskId,
        submittedAt: earlier.submittedAt,
        score: 70,
        valid: true,
      }),
    });
    assert.match(earlierRevisit ?? '', /得分变化/);

    const claimed = await db.query<{ outcome: { revisitedBySubmissionId?: string } }>(`
      SELECT outcome
      FROM "AIIntervention"
      WHERE id = 'advice-1'
    `);
    assert.equal(claimed.rows[0]?.outcome?.revisitedBySubmissionId, 'submission-earlier');

    await releaseOfficialSubmitReservation(later);
    await releaseOfficialSubmitReservation(earlier);
    await releaseOfficialSubmitReservation(sameMs);
    await releaseOfficialSubmitReservation(afterCollision);

    process.stdout.write([
      'arena-official-followup-postgres: ok',
      `engine=${version.rows[0]?.version.split(',').at(0)}`,
      `index=AIIntervention_arenaOfficial_userId_sessionId_key`,
      `official_rows=${officialCount.rows[0]?.count}`,
      `unofficial_rows=${unofficialCount.rows[0]?.count}`,
      'order_closer=submission-earlier',
    ].join('\n') + '\n');
  } catch (error) {
    if (required) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/pg_config|initdb|pg_ctl|ECONNREFUSED|ENOTFOUND/.test(message)) {
      process.stdout.write(`arena-official-followup-postgres skipped: ${message}\n`);
      return;
    }
    throw error;
  } finally {
    await prisma?.$disconnect().catch(() => undefined);
    await db?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (ephemeral) {
      run(ephemeral.pgCtl, ['-D', ephemeral.dataDir, '-m', 'fast', '-w', 'stop']);
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function insertOfficialSubmission(
  db: pg.Client,
  input: {
    id: string;
    userId: string;
    taskId: string;
    artifactHash: string;
    submittedAt: string;
    score: number;
    valid: boolean;
  },
) {
  const artifactId = `artifact-${input.id}`;
  const evaluationId = `evaluation-${input.id}`;
  await db.query(`
    INSERT INTO "ArenaControllerArtifact" (
      "id", "ownerId", "taskId", "artifactHash", "method", "payload", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, 'pid', '{"method":"pid","params":{}}'::jsonb, $5, $5
    )
  `, [artifactId, input.userId, input.taskId, input.artifactHash, input.submittedAt]);
  await db.query(`
    INSERT INTO "ArenaEvaluationRun" (
      "id", "taskId", "artifactHash", "protocolVersion", "artifactPayload",
      "valid", "score", "metrics", "satisfaction", "hardConstraintResults",
      "penalties", "explanation", "completedAt", "createdAt"
    ) VALUES (
      $1, $2, $3, 'whitebox-v1', '{}'::jsonb,
      $4, $5, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
      '[]'::jsonb, '[]'::jsonb, $6, $6
    )
  `, [evaluationId, input.taskId, input.artifactHash, input.valid, input.score, input.submittedAt]);
  await db.query(`
    INSERT INTO "ArenaSubmission" (
      "id", "taskId", "userId", "studentLabel", "artifactHash", "method",
      "score", "valid", "submittedAt", "createdAt",
      "controllerArtifactId", "evaluationRunId"
    ) VALUES (
      $1, $2, $3, '学生', $4, 'pid',
      $5, $6, $7, $7,
      $8, $9
    )
  `, [
    input.id,
    input.taskId,
    input.userId,
    input.artifactHash,
    input.score,
    input.valid,
    input.submittedAt,
    artifactId,
    evaluationId,
  ]);
}

function officialRecord(input: {
  id: string;
  userId: string;
  taskId: string;
  submittedAt: string;
  score: number;
  valid: boolean;
}) {
  return {
    id: input.id,
    userId: input.userId,
    taskId: input.taskId,
    studentLabel: '学生',
    artifactHash: `hash-${input.id}`,
    artifact: {
      id: input.id,
      taskId: input.taskId,
      method: 'pid' as const,
      params: {},
      createdAt: input.submittedAt,
    },
    evaluation: {
      taskId: input.taskId,
      artifact: {
        id: input.id,
        taskId: input.taskId,
        method: 'pid' as const,
        params: {},
        createdAt: input.submittedAt,
      },
      valid: input.valid,
      score: input.score,
      metrics: { settlingTime: input.valid ? 2 : 4 },
      satisfaction: {},
      hardConstraintResults: input.valid
        ? [{ id: 'stability', label: '稳定性', passed: true }]
        : [{ id: 'stability', label: '稳定性', passed: false, reason: '未通过' }],
      penalties: [],
      explanation: [],
    },
    submittedAt: input.submittedAt,
    reusedEvaluation: false,
  };
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
