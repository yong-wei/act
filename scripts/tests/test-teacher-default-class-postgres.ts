import 'dotenv/config';

import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { UserRole } from '@prisma/client';
import { Pool } from 'pg';

const adminDatabaseUrl = process.env.TEACHER_DEFAULT_CLASS_TEST_DATABASE_ADMIN_URL;
const nonce = `${process.pid}_${randomBytes(5).toString('hex')}`;
const databaseName = `teacher_default_class_e2e_${nonce}`;
const teacherId = `teacher-${nonce}`;
const classAId = `class-a-${nonce}`;
const classBId = `class-b-${nonce}`;
const classRaceId = `class-race-${nonce}`;
const classDuplicateRaceId = `class-duplicate-race-${nonce}`;
const planId = `plan-${nonce}`;

let scopedDatabaseUrl = '';
let db: any;

async function main() {
  if (!adminDatabaseUrl) {
    console.log(JSON.stringify({
      result: 'skipped',
      reason: 'TEACHER_DEFAULT_CLASS_TEST_DATABASE_ADMIN_URL is required',
    }));
    return;
  }
  assertSafeAdminUrl(adminDatabaseUrl);
  assertTemporaryDatabase(databaseName);
  try {
    scopedDatabaseUrl = await createDatabase(adminDatabaseUrl);
    process.env.DATABASE_URL = scopedDatabaseUrl;
    deployMigrations();

    const [{ createPrismaClient }, { createTeacherDefaultClassService }, { reconcileTeacherDefaultClasses }, { createClassBoundSession }] = await Promise.all([
      import('../../src/lib/prisma-client'),
      import('../../src/lib/teacher-default-class-service'),
      import('../db/reconcile-teacher-default-classes'),
      import('../../src/lib/session-class-binding'),
    ]);
    db = createPrismaClient({ log: ['warn', 'error'] });
    await seedFixtures();

    const reconciliation = await reconcileTeacherDefaultClasses(db, {
      mode: 'apply',
      writerDrained: true,
    });
    assert(reconciliation.changedDefaultCount === 1, 'reconciliation must assign the newest active class');
    assert((await teacher()).defaultTeachingClassId === classBId, 'newest active class must become the initial default');

    const service = createTeacherDefaultClassService(db);
    await service.deactivateClass(teacherId, classBId);
    assert((await teacher()).defaultTeachingClassId === classAId, 'deactivation must replace the default with the newest remaining active class');
    await service.activateClass(teacherId, classBId);
    assert((await teacher()).defaultTeachingClassId === classAId, 'reactivation must retain a still-valid default');
    await service.setDefaultClass(teacherId, classBId);
    assert((await teacher()).defaultTeachingClassId === classBId, 'explicit active default must persist');

    const competing = await Promise.allSettled([
      service.deactivateClass(teacherId, classBId),
      service.setDefaultClass(teacherId, classBId),
    ]);
    assert(competing.some((result) => result.status === 'fulfilled'), 'at least one competing default mutation must complete');
    await assertDefaultInvariant();
    if (!(await db.class.findUnique({ where: { id: classBId }, select: { isActive: true } })).isActive) {
      await service.activateClass(teacherId, classBId);
    }

    const session = await createClassBoundSession(db, {
      actorId: teacherId,
      actorRole: UserRole.TEACHER,
      classId: classBId,
      create: (tx) => tx.classSession.create({
        data: {
          joinCode: `S${nonce}`.slice(0, 6),
          planId,
          teacherId,
          classId: classBId,
        },
      }),
    });
    assert(session.classId === classBId, 'class-bound session must persist its selected class');
    await expectServiceError(
      service.deleteClass(teacherId, classBId),
      'class-has-sessions',
    );
    assert(
      await db.classSession.count({ where: { id: session.id, classId: classBId } }) === 1,
      'rejected deletion must preserve historical class attribution',
    );

    await db.class.create({ data: {
      id: classRaceId,
      code: `R${nonce}`.slice(0, 30),
      name: '默认班级集成测试并发班',
      teacherId,
      createdAt: new Date('2026-07-03T00:00:00.000Z'),
    } });

    const deleteAndCreate = await Promise.allSettled([
      service.deleteClass(teacherId, classRaceId),
      createClassBoundSession(db, {
        actorId: teacherId,
        actorRole: UserRole.TEACHER,
        classId: classRaceId,
        create: (tx) => tx.classSession.create({
          data: {
            joinCode: `R${nonce}`.slice(0, 6),
            planId,
            teacherId,
            classId: classRaceId,
          },
        }),
      }),
    ]);
    assert(
      deleteAndCreate.filter((result) => result.status === 'fulfilled').length === 1,
      'class deletion and class-bound creation must serialize to one winner',
    );
    const raceSession = deleteAndCreate[1];
    if (raceSession.status === 'fulfilled') {
      assert(
        await db.classSession.count({ where: { id: raceSession.value.id, classId: classRaceId } }) === 1,
        'a winning class-bound creation must retain its class attribution',
      );
    } else {
      assert(
        await db.class.count({ where: { id: classRaceId } }) === 0,
        'a winning deletion must prevent any subsequent class-bound creation',
      );
    }
    await assertDefaultInvariant();

    await db.class.create({ data: {
      id: classDuplicateRaceId,
      code: `D${nonce}`.slice(0, 30),
      name: '预置互动课并发去重班',
      teacherId,
      createdAt: new Date('2026-07-04T00:00:00.000Z'),
    } });
    const createDuplicateCheckedSession = (joinCode: string) => createClassBoundSession(db, {
      actorId: teacherId,
      actorRole: UserRole.TEACHER,
      classId: classDuplicateRaceId,
      create: async (tx) => {
        const active = await tx.classSession.findFirst({
          where: {
            teacherId,
            classId: classDuplicateRaceId,
            planId,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (active) throw new Error('duplicate-active-classroom');
        return tx.classSession.create({
          data: {
            joinCode,
            planId,
            teacherId,
            classId: classDuplicateRaceId,
          },
        });
      },
    });
    const duplicateCreateRace = await Promise.allSettled([
      createDuplicateCheckedSession(`D1${nonce}`.slice(0, 6)),
      createDuplicateCheckedSession(`D2${nonce}`.slice(0, 6)),
    ]);
    assert(
      duplicateCreateRace.filter((result) => result.status === 'fulfilled').length === 1,
      'concurrent duplicate-checked classroom starts must create exactly one active session',
    );
    assert(
      await db.classSession.count({
        where: { teacherId, classId: classDuplicateRaceId, planId, status: 'ACTIVE' },
      }) === 1,
      'class advisory locking must make the final duplicate check and creation atomic',
    );

    console.log(JSON.stringify({
      result: 'passed',
      database: databaseName,
      defaultClassId: (await teacher()).defaultTeachingClassId,
      sessionId: session.id,
    }));
  } finally {
    await db?.$disconnect();
    await dropDatabase(adminDatabaseUrl);
  }
}

async function seedFixtures() {
  await db.user.create({ data: { id: teacherId, email: `${teacherId}@example.test`, role: 'TEACHER' } });
  await db.lessonPlan.create({ data: { id: planId, title: '默认班级集成测试教案', authorId: teacherId } });
  await db.class.createMany({ data: [
    {
      id: classAId,
      code: `A${nonce}`.slice(0, 30),
      name: '默认班级集成测试 A',
      teacherId,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    },
    {
      id: classBId,
      code: `B${nonce}`.slice(0, 30),
      name: '默认班级集成测试 B',
      teacherId,
      createdAt: new Date('2026-07-02T00:00:00.000Z'),
    },
  ] });
}

async function teacher() {
  return db.user.findUniqueOrThrow({
    where: { id: teacherId },
    select: { defaultTeachingClassId: true },
  });
}

async function assertDefaultInvariant() {
  const current = await teacher();
  const active = await db.class.findMany({
    where: { teacherId, isActive: true },
    select: { id: true },
  });
  if (active.length === 0) {
    assert(current.defaultTeachingClassId === null, 'teachers with no active class must have no default');
    return;
  }
  assert(active.some((classItem: { id: string }) => classItem.id === current.defaultTeachingClassId), 'default must be one owned active class');
}

async function expectServiceError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    assert(error && typeof error === 'object' && 'code' in error && error.code === code, `expected ${code}`);
    return;
  }
  throw new Error(`expected ${code}`);
}

async function createDatabase(adminUrl: string) {
  const admin = new URL(adminUrl);
  admin.searchParams.delete('schema');
  const pool = new Pool({ connectionString: admin.toString() });
  try {
    await pool.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await pool.end();
  }
  admin.pathname = `/${databaseName}`;
  return admin.toString();
}

function deployMigrations() {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: scopedDatabaseUrl },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('teacher-default-class-migration-deploy-failed');
}

async function dropDatabase(adminUrl: string | undefined) {
  if (!adminUrl || !scopedDatabaseUrl) return;
  const admin = new URL(adminUrl);
  admin.searchParams.delete('schema');
  const pool = new Pool({ connectionString: admin.toString() });
  try {
    assertTemporaryDatabase(databaseName);
    await pool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  } finally {
    await pool.end();
  }
}

function assertSafeAdminUrl(value: string) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.searchParams.has('schema')) {
    throw new Error('test database URL must be PostgreSQL without a schema');
  }
}

function assertTemporaryDatabase(value: string) {
  if (!/^teacher_default_class_e2e_[A-Za-z0-9_]+$/.test(value) || value === 'public') {
    throw new Error('unsafe teacher default class test database');
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
