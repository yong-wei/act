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

    process.stdout.write([
      'arena-official-followup-postgres: ok',
      `engine=${version.rows[0]?.version.split(',').at(0)}`,
      `index=AIIntervention_arenaOfficial_userId_sessionId_key`,
      `official_rows=${officialCount.rows[0]?.count}`,
      `unofficial_rows=${unofficialCount.rows[0]?.count}`,
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
    await db?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (ephemeral) {
      run(ephemeral.pgCtl, ['-D', ephemeral.dataDir, '-m', 'fast', '-w', 'stop']);
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
