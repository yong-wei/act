import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function main() {
  const schema = read('prisma/schema.prisma');
  const lock = read('prisma/migrations/migration_lock.toml');
  assert.match(schema, /provider\s*=\s*["']postgresql["']/u, 'Prisma datasource must remain PostgreSQL');
  assert.match(lock, /provider\s*=\s*["']postgresql["']/u, 'Prisma migration lock must remain PostgreSQL');

  const migrations = readdirSync(join(root, 'prisma/migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.ok(migrations.length > 0, 'Prisma migration directory must not be empty');
  for (const migration of migrations) {
    const sqlPath = join(root, 'prisma/migrations', migration, 'migration.sql');
    assert.ok(statSync(sqlPath).isFile(), `migration ${migration} must contain migration.sql`);
    assert.ok(readFileSync(sqlPath, 'utf8').trim().length > 0, `migration ${migration} must not be empty`);
  }

  execFileSync('npx', ['prisma', 'validate'], { cwd: root, stdio: 'inherit' });
  console.log(JSON.stringify({ status: 'passed', migrationCount: migrations.length }));
}

main();
