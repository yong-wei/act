import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  planAssignmentPublicationDuplicateRepair,
  type AssignmentPublicationRepairRevision,
} from '../../src/lib/assignments/assignment-publication-repair';
import { stableHash } from '../../src/lib/assignments/assignment-domain';
import { createPrismaClient } from '../../src/lib/prisma-client';

type CliOptions = {
  apply: boolean;
  runId: string;
  manifestPath: string;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const prisma = createPrismaClient();
  try {
    const revisions = await loadPublishedRevisions(prisma);
    const plan = planAssignmentPublicationDuplicateRepair(revisions);
    const manifest = {
      version: 'assignment-publication-duplicate-repair.v1',
      runId: options.runId,
      mode: options.apply ? 'apply' : 'dry-run',
      generatedAt: new Date().toISOString(),
      summary: {
        publishedRevisionCount: revisions.length,
        duplicateActionCount: plan.actions.length,
        deleteCount: plan.actions.filter((action) => action.action === 'delete-unreferenced').length,
        archiveCount: plan.actions.filter((action) => action.action === 'archive-dependent').length,
        ambiguousGroupCount: plan.ambiguous.length,
      },
      plan,
      applied: [] as Array<{ revisionId: string; action: string; affectedRows: number }>,
    };

    await persistManifest(options.manifestPath, manifest);
    if (options.apply) {
      for (const action of plan.actions) {
        const result = await prisma.$transaction(async (tx) => {
          if (action.action === 'archive-dependent') {
            const archived = await tx.assignmentAudience.updateMany({
              where: { assignmentRevisionId: action.revisionId, archivedAt: null },
              data: { archivedAt: new Date() },
            });
            return archived.count;
          }
          await tx.assignmentPublicationOperation.deleteMany({ where: { revisionId: action.revisionId } });
          await tx.assignmentAudience.deleteMany({ where: { assignmentRevisionId: action.revisionId } });
          await tx.assignmentQuestion.deleteMany({ where: { assignmentRevisionId: action.revisionId } });
          const deleted = await tx.assignmentRevision.deleteMany({
            where: {
              id: action.revisionId,
              submissions: { none: {} },
              gradingBatches: { none: {} },
              teacherReviews: { none: {} },
              approvalSnapshots: { none: {} },
              resubmissionGrants: { none: {} },
              questionExemptions: { none: {} },
              historicalOwnerships: { none: {} },
            },
          });
          if (deleted.count !== 1) throw new Error(`repair-dependency-drift:${action.revisionId}`);
          return deleted.count;
        });
        manifest.applied.push({ revisionId: action.revisionId, action: action.action, affectedRows: result });
        await persistManifest(options.manifestPath, manifest);
      }
    }
    process.stdout.write(`${JSON.stringify(manifest.summary)}\n`);
    process.stdout.write(`manifest=${options.manifestPath}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

async function loadPublishedRevisions(
  prisma: ReturnType<typeof createPrismaClient>,
): Promise<AssignmentPublicationRepairRevision[]> {
  const rows = await prisma.assignmentRevision.findMany({
    where: { state: 'PUBLISHED' },
    select: {
      id: true,
      assignmentId: true,
      revisionNumber: true,
      publishedAt: true,
      contentHash: true,
      audiences: {
        select: {
          id: true,
          classId: true,
          availableAt: true,
          dueAt: true,
          policySnapshot: true,
          archivedAt: true,
        },
      },
      _count: {
        select: {
          submissions: true,
          gradingBatches: true,
          teacherReviews: true,
          approvalSnapshots: true,
          resubmissionGrants: true,
          questionExemptions: true,
          historicalOwnerships: true,
        },
      },
    },
    orderBy: [{ assignmentId: 'asc' }, { revisionNumber: 'desc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    assignmentId: row.assignmentId,
    revisionNumber: row.revisionNumber,
    publishedAt: row.publishedAt,
    contentHash: row.contentHash,
    audienceSignature: stableHash(row.audiences
      .map((audience) => ({
        classId: audience.classId,
        availableAt: audience.availableAt.toISOString(),
        dueAt: audience.dueAt.toISOString(),
        policySnapshot: audience.policySnapshot,
      }))
      .sort((left, right) => left.classId.localeCompare(right.classId))),
    activeAudienceIds: row.audiences.filter((audience) => !audience.archivedAt).map((audience) => audience.id),
    dependencyCounts: row._count,
  }));
}

function parseOptions(args: string[]): CliOptions {
  const apply = args.includes('--apply');
  const runId = valueOf(args, '--run-id') ?? `dry-run-${new Date().toISOString().replaceAll(':', '-')}`;
  if (apply && !valueOf(args, '--run-id')) {
    throw new Error('--apply requires --run-id=<stable-id>');
  }
  if (!/^[A-Za-z0-9._-]{4,120}$/.test(runId)) throw new Error('invalid --run-id');
  const manifestPath = resolve(valueOf(args, '--manifest') ?? `.logs/assignment-publication-repair/${runId}.json`);
  return { apply, runId, manifestPath };
}

function valueOf(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function persistManifest(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
