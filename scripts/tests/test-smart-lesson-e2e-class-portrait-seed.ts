import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { Pool } from 'pg';

import { seedSmartLessonE2EClassContext } from './smart-lesson-e2e-acceptance-seed';

const baseDatabaseUrl = process.env.SMART_LESSON_TEST_DATABASE_BASE_URL ?? process.env.DATABASE_URL;
const schemaName = `smart_lesson939_e2e_seed_${process.pid}_${randomBytes(4).toString('hex')}`;
const teacherId = `smart-lesson-real-e2e-teacher-${process.pid}`;
const classId = `smart-lesson-real-class-${process.pid}`;

async function main() {
  if (!baseDatabaseUrl) throw new Error('smart-lesson-test-database-required');
  assertTemporarySchema(schemaName);
  const scopedDatabaseUrl = await createIsolatedDatabase();
  process.env.DATABASE_URL = scopedDatabaseUrl;
  try {
    deployMigrations(scopedDatabaseUrl);
    const [{ createPrismaClient }, { readTeacherClassEvidencePort }, { projectCurrentCumulativeClassPortrait }] = await Promise.all([
      import('../../src/lib/prisma-client'),
      import('../../src/features/learning-record/consumers/ports'),
      import('../../src/lib/smart-lesson-plan/domain'),
    ]);
    const prisma = createPrismaClient({ log: ['warn', 'error'] });
    try {
      await seedSmartLessonE2EClassContext(prisma, {
        teacherId,
        classId,
        schemaName,
        seedKey: String(process.pid),
      });
      const classRead = await readTeacherClassEvidencePort({
        db: prisma,
        viewer: { role: 'teacher', subjectUserId: teacherId, classIds: [classId] },
        classId,
        memberUserIds: [],
      });
      assert.equal(classRead.classPortrait.stateKind, 'SNAPSHOT');
      assert.equal(classRead.classRead.suppressed, false);
      const projected = projectCurrentCumulativeClassPortrait({
        classId,
        portrait: classRead.classPortrait,
      });
      assert.equal(projected.cohortBucket, '5-9');
      assert.equal(projected.overall.attainment, 0.65);
      assert.equal(projected.overall.coverage, 1);
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    await dropIsolatedDatabase();
  }
  console.log(JSON.stringify({
    result: 'passed',
    schema: schemaName,
    independentLearners: 5,
    cohortBucket: '5-9',
  }));
}

function deployMigrations(databaseUrl: string) {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('smart-lesson-migration-deploy-failed');
}

async function createIsolatedDatabase() {
  const admin = new URL(baseDatabaseUrl!);
  admin.searchParams.delete('schema');
  const pool = new Pool({ connectionString: admin.toString() });
  try {
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await pool.end();
  }
  return scopedDatabaseUrlFor(schemaName, admin.toString());
}

async function dropIsolatedDatabase() {
  const admin = new URL(baseDatabaseUrl!);
  admin.searchParams.delete('schema');
  const pool = new Pool({ connectionString: admin.toString() });
  try {
    assertTemporarySchema(schemaName);
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await pool.end();
  }
}

function scopedDatabaseUrlFor(schema: string, databaseUrl: string) {
  assertTemporarySchema(schema);
  const scoped = new URL(databaseUrl);
  scoped.searchParams.set('schema', schema);
  scoped.searchParams.set('options', `-c search_path=${schema},public`);
  return scoped.toString();
}

function assertTemporarySchema(value: string) {
  if (!/^smart_lesson939_e2e_[a-zA-Z0-9_]+$/.test(value) || value === 'public') {
    throw new Error('unsafe-smart-lesson-e2e-schema');
  }
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
