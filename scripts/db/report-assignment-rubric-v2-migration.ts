import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { planLegacyRubricMigration } from '../../src/lib/assignments/assignment-rubric-migration';
import { createPrismaClient } from '../../src/lib/prisma-client';

async function main() {
  const outputPath = resolve(valueOf(process.argv.slice(2), '--output')
    ?? `.logs/assignment-rubric-v2-migration/report-${new Date().toISOString().replaceAll(':', '-')}.json`);
  const prisma = createPrismaClient();
  try {
    const questions = await prisma.assignmentQuestion.findMany({
      select: {
        id: true,
        points: true,
        rubricSnapshot: true,
        revision: { select: { id: true, state: true, totalPoints: true } },
      },
      orderBy: { id: 'asc' },
    });
    const report = planLegacyRubricMigration(questions.map((question) => ({
      questionId: question.id,
      revisionId: question.revision.id,
      revisionState: question.revision.state,
      questionPoints: Number(question.points),
      assignmentTotalPoints: Number(question.revision.totalPoints),
      rubric: question.rubricSnapshot,
    })));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify({
      ...report,
      mode: 'dry-run',
      generatedAt: new Date().toISOString(),
    }, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(report.summary)}\n`);
    process.stdout.write(`report=${outputPath}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

function valueOf(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
