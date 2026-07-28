import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const schemaName = `assignment_rubric_v2_${randomUUID().replaceAll('-', '')}`;
const migrationPath = join(
  process.cwd(),
  'prisma/migrations/20260727001000_assignment_rubric_v2_optional_level/migration.sql',
);

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}", public`);
    await client.query(`
    CREATE TABLE "GradingCriterionAssessment" (
      "id" text PRIMARY KEY,
      "levelId" text NOT NULL
    )
  `);
    await client.query(await readFile(migrationPath, 'utf8'));
    await client.query(`
    INSERT INTO "GradingCriterionAssessment" ("id", "levelId")
    VALUES ('standard-only-assessment', NULL)
  `);
    const result = await client.query<{ is_nullable: string }>(`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = 'GradingCriterionAssessment'
      AND column_name = 'levelId'
  `, [schemaName]);
    if (result.rows[0]?.is_nullable !== 'YES') {
      throw new Error('assignment-rubric-v2-level-id-remains-required');
    }
    process.stdout.write('assignment-rubric-v2-postgres: ok\n');
  } finally {
    await client.query('RESET search_path').catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => undefined);
    await client.end();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
