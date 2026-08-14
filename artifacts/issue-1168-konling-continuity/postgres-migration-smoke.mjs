import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';

const repoRoot = process.cwd();
const artifactDir = path.join(repoRoot, 'artifacts/issue-1168-konling-continuity');
const codeCommit = process.env.CODE_COMMIT ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const migrationSource = path.join(
  repoRoot,
  'prisma/migrations/20260801163000_add_adaptive_assessment_companion_metadata/migration.sql',
);
const postgresBin = process.env.POSTGRES_BIN ?? 'D:/DevTools/PostgreSQL18/bin';
let port;
let databaseUrl;
let psqlUrl;

async function selectPort() {
  if (process.env.POSTGRES_SMOKE_PORT) return process.env.POSTGRES_SMOKE_PORT;
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const selected = typeof address === 'object' && address ? String(address.port) : '';
      server.close((error) => error ? reject(error) : resolve(selected));
    });
  });
}

function run(command, args, options = {}) {
  process.stderr.write(`> ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    timeout: 45_000,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with exit code ${result.status}`,
      result.error?.stack,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }
  return result.stdout.trim();
}

function postgresExecutable(name) {
  return path.join(postgresBin, `${name}.exe`);
}

function runPostgres(name, args) {
  return run(postgresExecutable(name), args);
}

function runPrisma(configPath) {
  return run(process.execPath, [
    path.join(repoRoot, 'node_modules/prisma/build/index.js'),
    'migrate',
    'deploy',
    '--config',
    configPath,
  ]);
}

function runRepositoryPrisma(command) {
  return run(process.execPath, [
    path.join(repoRoot, 'node_modules/prisma/build/index.js'),
    command,
    '--config',
    path.join(repoRoot, 'prisma.config.ts'),
  ]);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  port = await selectPort();
  databaseUrl = `postgresql://postgres@127.0.0.1:${port}/postgres?schema=public`;
  psqlUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  const tempRoot = await mkdtemp(path.join(repoRoot, '.issue-1168-postgres-'));
  const dataDir = path.join(tempRoot, 'data');
  const prismaDir = path.join(tempRoot, 'prisma');
  const baselineDir = path.join(prismaDir, 'migrations/20260801160000_baseline');
  const targetDir = path.join(prismaDir, 'migrations/20260801163000_add_adaptive_assessment_companion_metadata');
  const schemaPath = path.join(prismaDir, 'schema.prisma');
  const configPath = path.join(tempRoot, 'prisma.config.ts');
  let started = false;

  try {
    const prismaValidate = runRepositoryPrisma('validate');
    const prismaGenerate = runRepositoryPrisma('generate');
    await mkdir(baselineDir, { recursive: true });
    await writeFile(schemaPath, [
      'generator client {',
      '  provider = "prisma-client-js"',
      '}',
      'datasource db {',
      '  provider = "postgresql"',
      '}',
      'model AdaptiveAssessmentSession {',
      '  id       String @id',
      '  metadata Json   @default("{}")',
      '}',
      '',
    ].join('\n'));
    const normalizedSchemaPath = schemaPath.replaceAll('\\', '/');
    const normalizedMigrationsPath = path.join(prismaDir, 'migrations').replaceAll('\\', '/');
    await writeFile(configPath, [
      "import { defineConfig } from 'prisma/config';",
      'export default defineConfig({',
      `  schema: '${normalizedSchemaPath}',`,
      `  migrations: { path: '${normalizedMigrationsPath}' },`,
      '  datasource: { url: process.env.DATABASE_URL },',
      '});',
      '',
    ].join('\n'));
    await writeFile(path.join(prismaDir, 'migrations/migration_lock.toml'), 'provider = "postgresql"\n');
    await writeFile(
      path.join(baselineDir, 'migration.sql'),
      'CREATE TABLE "AdaptiveAssessmentSession" ("id" TEXT NOT NULL, CONSTRAINT "AdaptiveAssessmentSession_pkey" PRIMARY KEY ("id"));\n',
    );

    runPostgres('initdb', ['-D', dataDir, '-A', 'trust', '-U', 'postgres', '--encoding=UTF8', '--no-locale']);
    runPostgres('pg_ctl', ['-D', dataDir, '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start']);
    started = true;

    const baselineDeploy = runPrisma(configPath);
    runPostgres('psql', [psqlUrl, '-v', 'ON_ERROR_STOP=1', '-c',
      'INSERT INTO "AdaptiveAssessmentSession" ("id") VALUES (\'legacy-session\');',
    ]);

    await mkdir(targetDir, { recursive: true });
    const migrationSql = await readFile(migrationSource);
    await writeFile(path.join(targetDir, 'migration.sql'), migrationSql);
    const targetDeploy = runPrisma(configPath);

    const assertionSql = [
      "SELECT data_type, is_nullable, column_default FROM information_schema.columns",
      "WHERE table_schema = 'public' AND table_name = 'AdaptiveAssessmentSession' AND column_name = 'metadata';",
      'SELECT id, metadata::text AS metadata FROM "AdaptiveAssessmentSession" WHERE id = \'legacy-session\';',
    ].join(' ');
    const assertionOutput = runPostgres('psql', [psqlUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', '-c', assertionSql]);
    const lines = assertionOutput.split(/\r?\n/).filter(Boolean);
    const column = lines.find((line) => line.startsWith('jsonb|'));
    const legacy = lines.find((line) => line.startsWith('legacy-session|'));
    const passed = column === "jsonb|NO|'{}'::jsonb" && legacy === 'legacy-session|{}';

    const generatorPath = path.join(artifactDir, 'postgres-migration-smoke.mjs');
    const evidence = {
      issue: 1168,
      generatedAt: new Date().toISOString(),
      codeCommit,
      postgresVersion: runPostgres('psql', [psqlUrl, '-At', '-c', 'SHOW server_version;']),
      database: 'isolated temporary PostgreSQL cluster',
      migration: path.relative(repoRoot, migrationSource).replaceAll('\\', '/'),
      migrationSha256: sha256(migrationSql),
      generatorSha256: sha256(await readFile(generatorPath)),
      commands: {
        prismaValidate: prismaValidate.split(/\r?\n/).filter(Boolean),
        prismaGenerate: prismaGenerate.split(/\r?\n/).filter(Boolean),
        baselineDeploy: baselineDeploy.split(/\r?\n/).filter(Boolean),
        targetDeploy: targetDeploy.split(/\r?\n/).filter(Boolean),
      },
      assertions: {
        metadataType: column?.split('|')[0] ?? null,
        metadataNullable: column?.split('|')[1] ?? null,
        metadataDefault: column?.split('|')[2] ?? null,
        legacyRowMetadata: legacy?.split('|')[1] ?? null,
      },
      passed,
    };
    await mkdir(artifactDir, { recursive: true });
    await writeFile(path.join(artifactDir, 'postgres-migration-smoke.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    if (!passed) throw new Error(`Migration assertions failed:\n${assertionOutput}`);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    if (started) {
      runPostgres('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, 'postgres-migration-smoke-error.log'), `${error.stack ?? error}\n`);
  console.error(error);
  process.exit(1);
});
