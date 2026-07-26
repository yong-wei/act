import 'dotenv/config';

import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';

import { Pool } from 'pg';

import {
  adoptCourseBasisVersion,
  deleteCourseBasisVersion,
  getCourseBasisVersionForEditing,
  retireCourseBasisVersion,
} from '../../src/lib/course-basis/service';

const lifecycleMigration = '20260726120000_govern_course_basis_document_lifecycle';
const nonce = `${process.pid}_${randomBytes(6).toString('hex')}`;
const containerName = `act_issue_1061_postgres_${nonce}`;
const databaseName = `act_issue_1061_${nonce}`;
const password = `issue-1061-${randomBytes(12).toString('hex')}`;
const teacherId = `teacher-${nonce}`;
const courseBasisId = `basis-${nonce}`;
const documentId = `document-${nonce}`;
const confirmedVersionId = `confirmed-${nonce}`;
const pendingVersionId = `pending-${nonce}`;
const selectedVersionId = `selected-${nonce}`;
const legacyTaskId = `legacy-task-${nonce}`;
const legacyPlanDraftId = `legacy-plan-draft-${nonce}`;
const legacyPlanId = `legacy-plan-${nonce}`;
const legacyCoursewareDraftId = `legacy-courseware-draft-${nonce}`;
const legacyCoursewareId = `legacy-courseware-${nonce}`;
const legacySelectedLinkId = `legacy-selected-link-${nonce}`;
const confirmedSegmentIds = [`confirmed-segment-a-${nonce}`, `confirmed-segment-b-${nonce}`];
const pendingSegmentId = `pending-segment-${nonce}`;
const pendingSegmentBId = `pending-segment-b-${nonce}`;
const selectedSegmentId = `selected-segment-${nonce}`;
const confirmedContentHash = `confirmed-content-hash-${nonce}`;
const pendingContentHash = `pending-content-hash-${nonce}`;
const selectedContentHash = `selected-content-hash-${nonce}`;
const confirmedAnchors = [
  { stableAnchor: 'root/paragraph:1', contentHash: `confirmed-anchor-a-${nonce}` },
  { stableAnchor: 'root/paragraph:2', contentHash: `confirmed-anchor-b-${nonce}` },
];
const actor = { id: teacherId, role: 'TEACHER' as const };

let databaseUrl = '';
let db: any;

async function main() {
  const port = await availablePort();
  databaseUrl = `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/${databaseName}`;
  try {
    startPostgres(port);
    await waitForPostgres(databaseUrl);
    await applyMigrationsWithLegacyFixture(databaseUrl);
    process.env.DATABASE_URL = databaseUrl;

    const { createPrismaClient } = await import('../../src/lib/prisma-client');
    db = createPrismaClient({ log: ['warn', 'error'] });

    await verifyMigrationBackfill();
    await verifyPendingProjectionAndSelectionDoesNotFreeze();
    await verifyConcurrentAdoptionIdentityAndLifecycle();

    console.log(JSON.stringify({
      result: 'passed',
      containerName,
      checks: [
        'all-prisma-migrations-applied',
        'legacy-plan-and-courseware-reference-identities-recovered',
        'legacy-selected-only-reference-removed',
        'pending-extracted-projection-present',
        'selected-source-does-not-freeze',
        'removed-source-history-blocks-delete',
        'concurrent-first-adoption-freezes-once',
        'same-adopter-anchor-update-succeeds',
        'referenced-delete-blocked',
        'retired-history-readable',
      ],
    }));
  } finally {
    const errors: unknown[] = [];
    await db?.$disconnect().catch((error: unknown) => errors.push(error));
    try {
      removeContainer(containerName);
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) throw new AggregateError(errors, 'issue-1061-postgres-cleanup-failed');
  }
}

async function applyMigrationsWithLegacyFixture(url: string) {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const migrationRoot = join(process.cwd(), 'prisma', 'migrations');
    const directories = (await readdir(migrationRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert(directories.includes(lifecycleMigration), 'course-basis lifecycle migration must exist');

    for (const directory of directories) {
      if (directory === lifecycleMigration) await seedLegacyCourseBasisFixture(pool);
      const sql = await readFile(join(migrationRoot, directory, 'migration.sql'), 'utf8');
      const result = spawnSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1'],
        { encoding: 'utf8', input: sql },
      );
      if (result.status !== 0) {
        throw new Error(`migration failed: ${directory}\n${result.stderr || result.stdout}`);
      }
    }
  } finally {
    await pool.end();
  }
}

async function seedLegacyCourseBasisFixture(pool: Pool) {
  const now = new Date('2026-07-26T12:00:00.000Z');
  await pool.query(
    `INSERT INTO "User" ("id", "name", "role", "createdAt", "updatedAt")
     VALUES ($1, 'Issue 1061 PostgreSQL Teacher', 'TEACHER', $2, $2)`,
    [teacherId, now],
  );
  await pool.query(
    `INSERT INTO "CourseBasis"
       ("id", "ownerId", "courseIdentity", "title", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'Issue 1061 Course Basis', $4, $4)`,
    [courseBasisId, teacherId, `course-${nonce}`, now],
  );
  await pool.query(
    `INSERT INTO "CourseBasisDocument"
       ("id", "courseBasisId", "title", "kind", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Lifecycle Document', 'STANDARD', $3, $3)`,
    [documentId, courseBasisId, now],
  );
  await insertLegacyVersion(pool, {
    id: confirmedVersionId,
    versionNumber: 1,
    contentHash: confirmedContentHash,
    reviewState: 'CONFIRMED',
    reviewedAt: now,
  });
  await insertLegacySegment(pool, confirmedSegmentIds[0], confirmedVersionId, 0, confirmedAnchors[0]);
  await insertLegacySegment(pool, confirmedSegmentIds[1], confirmedVersionId, 1, confirmedAnchors[1]);
  const planBinding = {
    citationId: `legacy-plan-citation-${nonce}`,
    sourceVersionId: confirmedVersionId,
    anchor: confirmedAnchors[0].stableAnchor,
    contentHash: confirmedAnchors[0].contentHash,
  };
  const coursewareBinding = {
    citationId: `legacy-courseware-citation-${nonce}`,
    sourceVersionId: confirmedVersionId,
    anchor: confirmedAnchors[1].stableAnchor,
    contentHash: confirmedAnchors[1].contentHash,
  };
  await pool.query(
    `INSERT INTO "SmartLessonTask" (
       "id", "ownerId", "courseBasisId", "lineageId", "topic", "audience", "prerequisites",
       "durationMinutes", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, 'Legacy exact citation', 'teachers', 'none', 45, $5, $5)`,
    [legacyTaskId, teacherId, courseBasisId, `legacy-task-lineage-${nonce}`, now],
  );
  await pool.query(
    `INSERT INTO "SmartLessonDraft" (
       "id", "ownerId", "taskId", "state", "version", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, 'APPROVED', 1, $4, $4)`,
    [legacyPlanDraftId, teacherId, legacyTaskId, now],
  );
  await pool.query(
    `INSERT INTO "SmartLessonRevision" (
       "id", "ownerId", "taskId", "taskRevision", "draftId", "revisionNumber",
       "displayName", "content", "contentHash", "sourcesSnapshot",
       "knowledgeSnapshot", "goalsSnapshot", "provenanceSnapshot",
       "approvalIdempotencyKey", "approvalRequestHash", "approvedById", "approvedAt"
     ) VALUES (
       $1, $2, $3, 1, $4, 1, 'Legacy Plan 1', $5::jsonb, $6,
       $7::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, $8, $9, $2, $10
     )`,
    [
      legacyPlanId,
      teacherId,
      legacyTaskId,
      legacyPlanDraftId,
      JSON.stringify({ sources: [planBinding] }),
      `legacy-plan-content-${nonce}`,
      JSON.stringify([confirmedVersionId]),
      `legacy-plan-approval-${nonce}`,
      `legacy-plan-request-${nonce}`,
      now,
    ],
  );
  await pool.query(
    `INSERT INTO "SmartCoursewareDraft" (
       "id", "ownerId", "planRevisionId", "planRevisionNumber", "planContentHash",
       "authoringLineageRoot", "state", "version", "creationIdempotencyKey", "creationRequestHash",
       "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, 1, $4, $5, 'ACCEPTED', 1, $6, $7, $8, $8)`,
    [
      legacyCoursewareDraftId,
      teacherId,
      legacyPlanId,
      `legacy-plan-content-${nonce}`,
      `legacy-courseware-lineage-${nonce}`,
      `legacy-courseware-create-${nonce}`,
      `legacy-courseware-create-request-${nonce}`,
      now,
    ],
  );
  await pool.query(
    `INSERT INTO "SmartCoursewareRevision" (
       "id", "ownerId", "draftId", "revisionNumber", "planRevisionId",
       "planRevisionNumber", "planContentHash", "manifestSnapshot", "manifestHash",
       "moduleMetadataSnapshot", "moduleMetadataHash", "gapsSnapshot",
       "provenanceSnapshot", "validationSnapshot", "contentHash",
       "approvalIdempotencyKey", "approvalRequestHash", "approvedById", "approvedAt"
     ) VALUES (
       $1, $2, $3, 1, $4, 1, $5, '{}'::jsonb, $6, $7::jsonb, $8,
       '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, $9, $10, $11, $2, $12
     )`,
    [
      legacyCoursewareId,
      teacherId,
      legacyCoursewareDraftId,
      legacyPlanId,
      `legacy-plan-content-${nonce}`,
      `legacy-manifest-${nonce}`,
      JSON.stringify([{ moduleId: 'legacy-module', sourceBindings: [coursewareBinding] }]),
      `legacy-module-metadata-${nonce}`,
      `legacy-courseware-content-${nonce}`,
      `legacy-courseware-approval-${nonce}`,
      `legacy-courseware-request-${nonce}`,
      now,
    ],
  );
  await pool.query(
    `INSERT INTO "CourseBasisReferenceLink"
       ("id", "versionId", "referenceType", "referenceId", "createdAt")
     VALUES
       ($1, $2, 'LESSON_PLAN_REVISION', $3, $5),
       ($4, $2, 'COURSEWARE_REVISION', $6, $5)`,
    [
      `legacy-plan-link-${nonce}`,
      confirmedVersionId,
      legacyPlanId,
      `legacy-courseware-link-${nonce}`,
      now,
      legacyCoursewareId,
    ],
  );

  await insertLegacyVersion(pool, {
    id: pendingVersionId,
    versionNumber: 2,
    contentHash: pendingContentHash,
    reviewState: 'PENDING',
  });
  await insertLegacySegment(
    pool,
    pendingSegmentId,
    pendingVersionId,
    0,
    { stableAnchor: 'pending/paragraph:1', contentHash: `pending-anchor-${nonce}` },
  );
  await insertLegacySegment(
    pool,
    pendingSegmentBId,
    pendingVersionId,
    1,
    { stableAnchor: 'pending/paragraph:2', contentHash: `pending-anchor-b-${nonce}` },
  );
  await insertLegacyVersion(pool, {
    id: selectedVersionId,
    versionNumber: 3,
    contentHash: selectedContentHash,
    reviewState: 'PENDING',
  });
  await insertLegacySegment(
    pool,
    selectedSegmentId,
    selectedVersionId,
    0,
    { stableAnchor: 'selected/paragraph:1', contentHash: `selected-anchor-${nonce}` },
  );
  await pool.query(
    `INSERT INTO "CourseBasisReferenceLink"
       ("id", "versionId", "referenceType", "referenceId", "createdAt")
     VALUES ($1, $2, 'LESSON_PLAN_REVISION', $3, $4)`,
    [legacySelectedLinkId, selectedVersionId, legacyPlanId, now],
  );
}

async function insertLegacyVersion(pool: Pool, input: {
  id: string;
  versionNumber: number;
  contentHash: string;
  reviewState: 'PENDING' | 'CONFIRMED';
  reviewedAt?: Date;
}) {
  const text = `version ${input.versionNumber} normalized text`;
  await pool.query(
    `INSERT INTO "CourseBasisDocumentVersion" (
       "id", "documentId", "versionNumber", "sourceType", "sourceName", "mimeType",
       "byteSize", "contentHash", "originalContent", "normalizedText",
       "extractionState", "extractionVersion", "reviewState", "reviewedById", "reviewedAt"
     ) VALUES ($1, $2, $3, 'MARKDOWN', $4, 'text/markdown', $5, $6, $7, $8,
       'EXTRACTED', 'course-basis-extraction-v1', $9, $10, $11)`,
    [
      input.id,
      documentId,
      input.versionNumber,
      `version-${input.versionNumber}.md`,
      Buffer.byteLength(text),
      input.contentHash,
      Buffer.from(text),
      text,
      input.reviewState,
      input.reviewState === 'CONFIRMED' ? teacherId : null,
      input.reviewedAt ?? null,
    ],
  );
}

async function insertLegacySegment(
  pool: Pool,
  id: string,
  versionId: string,
  orderIndex: number,
  anchor: { stableAnchor: string; contentHash: string },
) {
  await pool.query(
    `INSERT INTO "CourseBasisSegment" (
       "id", "versionId", "orderIndex", "stableAnchor", "headingPath",
       "paragraphNumber", "text", "contentHash"
     ) VALUES ($1, $2, $3, $4, ARRAY['Issue 1061'], $5, $6, $7)`,
    [id, versionId, orderIndex, anchor.stableAnchor, orderIndex + 1, `segment ${orderIndex + 1}`, anchor.contentHash],
  );
}

async function verifyMigrationBackfill() {
  const legacyPlanLink = await db.courseBasisReferenceLink.findUniqueOrThrow({
    where: {
      versionId_referenceType_referenceId: {
        versionId: confirmedVersionId,
        referenceType: 'LESSON_PLAN_REVISION',
        referenceId: legacyPlanId,
      },
    },
  });
  assert(legacyPlanLink.contentHash === confirmedContentHash, 'legacy plan link must inherit version content hash');
  assert(
    sameAnchors(legacyPlanLink.anchors, [confirmedAnchors[0]]),
    'legacy plan link must recover only its exact cited anchor',
  );
  const legacyCoursewareLink = await db.courseBasisReferenceLink.findUniqueOrThrow({
    where: {
      versionId_referenceType_referenceId: {
        versionId: confirmedVersionId,
        referenceType: 'COURSEWARE_REVISION',
        referenceId: legacyCoursewareId,
      },
    },
  });
  assert(legacyCoursewareLink.contentHash === confirmedContentHash, 'legacy courseware link must inherit version content hash');
  assert(
    sameAnchors(legacyCoursewareLink.anchors, confirmedAnchors),
    'legacy courseware link must recover plan and module anchors without inventing other segments',
  );
  assert(
    await db.courseBasisReferenceLink.findUnique({ where: { id: legacySelectedLinkId } }) === null,
    'legacy selected-only links without immutable snapshot anchors must be removed',
  );
  assert(
    await db.courseBasisProjection.count({ where: { versionId: confirmedVersionId } }) === 2,
    'migration must project every confirmed extracted segment',
  );
}

async function verifyPendingProjectionAndSelectionDoesNotFreeze() {
  assert(
    await db.courseBasisProjection.count({ where: { versionId: pendingVersionId } }) === 2,
    'migration must preserve an editable projection for pending extracted content',
  );

  const taskId = `task-${nonce}`;
  await db.smartLessonTask.create({
    data: {
      id: taskId,
      ownerId: teacherId,
      courseBasisId,
      topic: 'Issue 1061 selected-only check',
      audience: 'teachers',
      prerequisites: 'none',
      durationMinutes: 45,
    },
  });
  await db.smartLessonSourceSelection.create({
    data: {
      id: `selection-${nonce}`,
      ownerId: teacherId,
      taskId,
      sourceVersionId: selectedVersionId,
      state: 'SELECTED',
    },
  });
  const selected = await db.courseBasisDocumentVersion.findUniqueOrThrow({
    where: { id: selectedVersionId },
    select: { reviewState: true, reviewedAt: true },
  });
  assert(selected.reviewState === 'PENDING' && selected.reviewedAt === null, 'SELECTED alone must not freeze a version');
  await db.smartLessonSourceSelection.update({
    where: { id: `selection-${nonce}` },
    data: { state: 'REMOVED', removedAt: new Date('2026-07-26T12:20:00.000Z') },
  });
  await expectCourseBasisError(
    deleteCourseBasisVersion(db, { actor, versionId: selectedVersionId }),
    'version-delete-referenced',
  );
}

async function verifyConcurrentAdoptionIdentityAndLifecycle() {
  const adopter = {
    referenceType: 'GENERATION_JOB' as const,
    referenceId: `generation-${nonce}`,
  };
  const input = {
    actor,
    versionId: pendingVersionId,
    adopter,
    anchors: [{ stableAnchor: 'pending/paragraph:1', contentHash: `pending-anchor-${nonce}` }],
    now: new Date('2026-07-26T12:30:00.000Z'),
  };
  const results = await Promise.all([adoptCourseBasisVersion(db, input), adoptCourseBasisVersion(db, input)]);
  assert(results.filter((result) => result.frozenNow).length === 1, 'concurrent first adoption must freeze exactly once');
  assert(results.every((result) => result.version.reviewState === 'CONFIRMED'), 'both adopters must observe frozen content');
  assert(
    results.every((result) =>
      result.referenceLink.contentHash === pendingContentHash
      && sameAnchors(result.referenceLink.anchors, input.anchors)),
    'adoption identity must include version and anchor content hashes',
  );
  assert(
    await db.courseBasisReferenceLink.count({
      where: { versionId: pendingVersionId, referenceType: adopter.referenceType, referenceId: adopter.referenceId },
    }) === 1,
    'concurrent replay must create one reference identity',
  );

  const updatedAdoption = await adoptCourseBasisVersion(db, {
    ...input,
    anchors: [{ stableAnchor: 'pending/paragraph:2', contentHash: `pending-anchor-b-${nonce}` }],
  });
  assert(
    sameAnchors(updatedAdoption.referenceLink.anchors, [{
      stableAnchor: 'pending/paragraph:2',
      contentHash: `pending-anchor-b-${nonce}`,
    }]),
    'the same adopter must be able to replace its anchor binding on the frozen content identity',
  );
  await expectCourseBasisError(
    adoptCourseBasisVersion(db, {
      ...input,
      anchors: [],
    }),
    'anchors-required',
  );
  await expectCourseBasisError(
    deleteCourseBasisVersion(db, { actor, versionId: pendingVersionId }),
    'version-delete-referenced',
  );

  await retireCourseBasisVersion(db, {
    actor,
    versionId: pendingVersionId,
    now: new Date('2026-07-26T13:00:00.000Z'),
  });
  const historical = await getCourseBasisVersionForEditing(db, { actor, versionId: pendingVersionId });
  assert(historical.frozen && historical.lifecycle.state === 'DISABLED', 'retired version must remain readable as disabled history');
  assert(
    await db.courseBasisReferenceLink.count({ where: { versionId: pendingVersionId } }) === 1,
    'retirement must preserve historical reference identity',
  );
}

async function expectCourseBasisError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    assert(
      error instanceof Error && 'code' in error && (error as { code: unknown }).code === code,
      `expected CourseBasisError ${code}`,
    );
    return;
  }
  throw new Error(`expected CourseBasisError ${code}`);
}

function startPostgres(port: number) {
  runDocker([
    'run',
    '-d',
    '--name',
    containerName,
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    `POSTGRES_DB=${databaseName}`,
    '-p',
    `127.0.0.1:${port}:5432`,
    'postgres:16-alpine',
  ]);
}

async function waitForPostgres(url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const pool = new Pool({ connectionString: url });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch {
      await pool.end().catch(() => undefined);
      await delay(200);
    }
  }
  throw new Error('temporary PostgreSQL 16 did not become ready');
}

function runDocker(args: string[]) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `docker ${args[0]} failed`);
}

function removeContainer(name: string) {
  const result = spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
  if (result.status !== 0 && !result.stderr.includes('No such container')) {
    throw new Error(result.stderr || result.stdout || `failed to remove ${name}`);
  }
}

function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sameAnchors(actual: unknown, expected: Array<{ stableAnchor: string; contentHash: string }>) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((entry, index) =>
      entry
      && typeof entry === 'object'
      && (entry as { stableAnchor?: unknown }).stableAnchor === expected[index].stableAnchor
      && (entry as { contentHash?: unknown }).contentHash === expected[index].contentHash);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
