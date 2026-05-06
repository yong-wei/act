import { PrismaClient } from '@prisma/client';

import { refreshStudentGrowthEvaluation } from '@/lib/data-governance/growth-evaluation';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const inline = process.argv.find((item) => item.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1] ?? null;
  }

  return null;
}

async function main() {
  const classId = getArgValue('--class-id');
  const userIds = classId
    ? (await prisma.studentProfile.findMany({
        where: { classId },
        select: { userId: true },
      })).map((profile) => profile.userId)
    : undefined;

  const snapshots = await prisma.studentCompetencySnapshot.findMany({
    where: {
      factCount: { gt: 0 },
      ...(userIds ? { userId: { in: userIds } } : {}),
    },
    orderBy: [
      { userId: 'asc' },
      { snapshotAt: 'desc' },
    ],
  });
  const latestSnapshots = new Map<string, typeof snapshots[number]>();
  for (const snapshot of snapshots) {
    if (!latestSnapshots.has(snapshot.userId)) {
      latestSnapshots.set(snapshot.userId, snapshot);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let skippedNoEvidence = 0;

  for (const snapshot of latestSnapshots.values()) {
    if (isDryRun) {
      const existing = await prisma.growthRecord.findFirst({
        where: {
          userId: snapshot.userId,
          recordType: 'competency_evaluation',
          courseId: 'profile:growth-evaluation',
        },
        orderBy: { occurredAt: 'desc' },
      });
      if (existing) {
        skipped += 1;
      } else {
        created += 1;
      }
      continue;
    }

    const result = await refreshStudentGrowthEvaluation(prisma, {
      snapshot: {
        id: snapshot.id,
        userId: snapshot.userId,
        snapshotAt: snapshot.snapshotAt,
        factCount: snapshot.factCount,
        competencyVector: snapshot.competencyVector,
        evidenceSummary: snapshot.evidenceSummary,
      },
    });

    if (result.action === 'created') created += 1;
    else if (result.action === 'updated') updated += 1;
    else if (result.action === 'skipped_no_evidence') skippedNoEvidence += 1;
    else skipped += 1;
  }

  console.log(JSON.stringify({
    dryRun: isDryRun,
    classId: classId ?? null,
    candidateSnapshots: latestSnapshots.size,
    created,
    updated,
    skipped,
    skippedNoEvidence,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[BackfillGrowthEvaluations] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
