import { createHash } from 'node:crypto';

import { prisma } from '../../src/lib/prisma';

type Mode = 'dry-run' | 'apply';

const args = process.argv.slice(2);
const mode: Mode = args.includes('--apply') ? 'apply' : 'dry-run';
const runId = args
  .find((value) => value.startsWith('--run-id='))
  ?.slice('--run-id='.length)
  .trim();

if (mode === 'apply' && !runId) {
  throw new Error('migration-run-id-required');
}

export async function runLegacyAssignmentAttachmentUnderstandingMigration(
  db: any,
  input: { mode: Mode; runId?: string | null },
) {
  const selectedMode = input.mode;
  const selectedRunId = input.runId?.trim() || null;
  if (selectedMode === 'apply' && !selectedRunId) {
    throw new Error('migration-run-id-required');
  }
  const conversions = await db.documentConversion.findMany({
    where: {
      adapter: { in: ['local-fallback', 'local-markitdown'] },
      asset: {
        is: {
          attemptId: { not: null },
          answerId: { not: null },
          mimeType: {
            in: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-powerpoint',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'image/png',
              'image/jpeg',
            ],
          },
        },
      },
    },
    include: {
      answerEvidence: {
        include: {
          gradingRuns: {
            include: { approvalSnapshot: true, jobs: true },
          },
          approvalSnapshots: true,
          batchItems: {
            include: {
              gradingRun: {
                include: { approvalSnapshot: true, jobs: true },
              },
              batch: {
                include: {
                  items: { select: { id: true, state: true } },
                  jobs: true,
                },
              },
              jobs: true,
            },
          },
        },
      },
      batchItems: {
        include: {
          gradingRun: {
            include: { approvalSnapshot: true, jobs: true },
          },
          batch: {
            include: {
              items: { select: { id: true, state: true } },
              jobs: true,
            },
          },
          jobs: true,
        },
      },
      jobs: true,
    },
    orderBy: { id: 'asc' },
  });

  const rows = conversions.map((conversion: any) => {
    const chain = collectChain(conversion);
    return {
      token: token(conversion.id),
      approved: chain.approved,
      requiresBlocking: chain.requiresBlocking,
      conversionState: conversion.state,
      evidence: chain.evidence
        ? {
            token: token(chain.evidence.id),
            readiness: chain.evidence.readiness,
            limitationState: chain.evidence.limitationState,
          }
        : null,
      runs: chain.runs.map((run) => ({
        token: token(run.id),
        state: run.state,
        approved: isApprovedRun(run),
        evidenceState: run.evidenceState,
        evaluatorReady: ['QUEUED', 'RUNNING', 'RETRYABLE'].includes(run.state),
        writebackReady: run.state === 'AWAITING_REVIEW',
      })),
      batchItems: chain.batchItems.map((item) => ({
        token: token(item.id),
        state: item.state,
        approved: isApprovedRun(item.gradingRun),
      })),
      batches: chain.batches.map((batch) => ({
        token: token(batch.id),
        state: batch.state,
      })),
      jobs: chain.jobs.map((job) => ({
        token: token(job.id),
        state: job.state,
      })),
    };
  });

  if (selectedMode === 'apply') {
    for (const conversion of conversions) {
      const chain = collectChain(conversion);
      await db.$transaction(async (tx: any) => {
        const now = new Date();
        if (!chain.approved) {
          await tx.documentConversion.update({
            where: { id: conversion.id },
            data: {
              state: 'BLOCKED',
              limitationState: 'legacy-ineligible',
              failureCode: 'legacy-local-binary-ineligible',
              cancellationRequestedAt: conversion.cancellationRequestedAt ?? now,
              completedAt: conversion.completedAt ?? now,
              updatedAt: now,
            },
          });
        }
        if (chain.evidence && !chain.approved) {
          await tx.answerEvidence.update({
            where: { id: chain.evidence.id },
            data: {
              readiness: 'BLOCKED',
              limitationState: 'legacy-ineligible',
              limitations: {
                set: [
                  ...new Set([
                    ...chain.evidence.limitations,
                    'legacy-local-binary-ineligible',
                  ]),
                ],
              },
              updatedAt: now,
            },
          });
        }
        const unapprovedRunIds = chain.runs
          .filter((run) => !isApprovedRun(run))
          .map((run) => run.id);
        if (unapprovedRunIds.length > 0) {
          await tx.gradingRun.updateMany({
            where: {
              id: { in: unapprovedRunIds },
              state: {
                in: ['QUEUED', 'RUNNING', 'RETRYABLE', 'AWAITING_REVIEW'],
              },
            },
            data: {
              state: 'BLOCKED',
              evidenceState: 'LEGACY_INELIGIBLE',
              blockedReasons: { set: ['legacy-local-binary-ineligible'] },
              updatedAt: now,
            },
          });
        }
        const unapprovedBatchItemIds = chain.batchItems
          .filter((item) => !isApprovedRun(item.gradingRun))
          .map((item) => item.id);
        if (unapprovedBatchItemIds.length > 0) {
          await tx.gradingBatchItem.updateMany({
            where: {
              id: { in: unapprovedBatchItemIds },
              state: {
                in: [
                  'QUEUED',
                  'CONVERTING',
                  'GRADING',
                  'RETRYABLE',
                  'SUCCEEDED',
                ],
              },
            },
            data: {
              state: 'BLOCKED',
              failureCode: 'legacy-local-binary-ineligible',
              workerClaimToken: null,
              workerClaimedAt: null,
              progress: 100,
              updatedAt: now,
            },
          });
        }
        await tx.gradingJob.updateMany({
          where: {
            OR: [
              { conversionId: conversion.id },
              ...(unapprovedBatchItemIds.length > 0
                ? [{ batchItemId: { in: unapprovedBatchItemIds } }]
                : []),
              ...(unapprovedRunIds.length > 0
                ? [{ gradingRunId: { in: unapprovedRunIds } }]
                : []),
            ],
            state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] },
          },
          data: {
            state: 'BLOCKED',
            cancelRequestedAt: now,
            lastErrorCode: 'legacy-local-binary-ineligible',
            workerClaimToken: null,
            workerClaimedAt: null,
            workerLeaseExpiresAt: null,
            completedAt: now,
            updatedAt: now,
          },
        });
        for (const batch of chain.batches) {
          const items = await tx.gradingBatchItem.findMany({
            where: { batchId: batch.id },
            select: { state: true },
          });
          const hasActiveItems = items.some((item: any) =>
            ['QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE']
              .includes(item.state));
          if (hasActiveItems) continue;
          const hasSucceededItems = items.some((item: any) =>
            item.state === 'SUCCEEDED');
          const terminalState = hasSucceededItems ? 'PARTIAL' : 'BLOCKED';
          await tx.gradingBatch.updateMany({
            where: {
              id: batch.id,
              state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] },
            },
            data: {
              state: terminalState,
              progress: 100,
              completedAt: now,
              lastErrorCode: 'legacy-local-binary-ineligible',
              updatedAt: now,
            },
          });
          await tx.gradingJob.updateMany({
            where: {
              batchId: batch.id,
              state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] },
            },
            data: {
              state: 'BLOCKED',
              cancelRequestedAt: now,
              lastErrorCode: 'legacy-local-binary-ineligible',
              workerClaimToken: null,
              workerClaimedAt: null,
              workerLeaseExpiresAt: null,
              completedAt: now,
              updatedAt: now,
            },
          });
        }
      });
    }
  }

  const report = {
    version: 'legacy-assignment-attachment-understanding.v1',
    mode: selectedMode,
    runId: selectedRunId ? token(selectedRunId) : null,
    candidateCount: rows.length,
    approvedPreservedCount: rows.filter((row: any) => row.approved).length,
    blockedCount: rows.filter((row: any) => row.requiresBlocking).length,
    evidenceCount: rows.filter((row: any) => row.evidence).length,
    gradingRunCount: rows.reduce(
      (sum: number, row: any) => sum + row.runs.length,
      0,
    ),
    batchItemCount: rows.reduce(
      (sum: number, row: any) => sum + row.batchItems.length,
      0,
    ),
    batchCount: rows.reduce(
      (sum: number, row: any) => sum + row.batches.length,
      0,
    ),
    activeJobCount: rows.reduce(
      (sum: number, row: any) => sum + row.jobs.filter(
        (job: any) => ['QUEUED', 'RUNNING', 'RETRYABLE'].includes(job.state),
      ).length,
      0,
    ),
    chains: rows,
  };

  return report;
}

async function main() {
  const report = await runLegacyAssignmentAttachmentUnderstandingMigration(
    prisma,
    { mode, runId },
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.env.ASSIGNMENT_ATTACHMENT_MIGRATION_IMPORT !== '1') {
  main()
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

function token(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function collectChain(conversion: any) {
  const evidence = conversion.answerEvidence;
  const batchItems = uniqueById([
    ...conversion.batchItems,
    ...(evidence?.batchItems ?? []),
  ]);
  const runs = uniqueById([
    ...(evidence?.gradingRuns ?? []),
    ...batchItems
      .map((item) => item.gradingRun)
      .filter(Boolean),
  ]);
  const batches = uniqueById(
    batchItems.map((item) => item.batch).filter(Boolean),
  );
  const jobs = uniqueById([
    ...conversion.jobs,
    ...batchItems.flatMap((item) => item.jobs ?? []),
    ...runs.flatMap((run) => run.jobs ?? []),
    ...batches.flatMap((batch) => batch.jobs ?? []),
  ]);
  const approved = Boolean(
    evidence?.approvalSnapshots.length ||
    runs.some(isApprovedRun),
  );
  const requiresBlocking = !approved
    || runs.some((run) => !isApprovedRun(run))
    || batchItems.some((item) => !isApprovedRun(item.gradingRun))
    || jobs.some((job) =>
      ['QUEUED', 'RUNNING', 'RETRYABLE'].includes(job.state));
  return {
    evidence,
    batchItems,
    batches,
    runs,
    jobs,
    approved,
    requiresBlocking,
  };
}

function isApprovedRun(run: any): boolean {
  return Boolean(
    run && (run.approvalSnapshot || run.state === 'APPROVED'),
  );
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  return values.filter(
    (value, index) => values.findIndex((candidate) => candidate.id === value.id) === index,
  );
}
