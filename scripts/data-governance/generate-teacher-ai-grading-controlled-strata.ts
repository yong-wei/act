import 'dotenv/config';

import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import JSZip from 'jszip';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { readTeacherAiGradingLabConfig } from '../../src/lib/data-governance/teacher-ai-grading-lab-contracts';
import { createFileSystemTeacherAiGradingLabDatasetStore } from '../../src/lib/data-governance/teacher-ai-grading-lab-dataset-store';
import { createTeacherAiGradingControlledStrataSnapshot } from '../../src/lib/data-governance/teacher-ai-grading-lab-strata';

interface Arguments {
  splitId: string;
  output: string;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const output = assertExternalOutput(args.output);
  const db = createPrismaClient();
  try {
    const split = await db.teacherAiGradingLabSplit.findUnique({
      where: { id: args.splitId },
      select: { id: true, datasetId: true, datasetVersion: true, version: true, contentHash: true },
    });
    if (!split) throw new Error('teacher-ai-grading-controlled-strata-split-missing');
    const members = await db.teacherAiGradingLabSplitMember.findMany({
      where: { splitId: split.id, partition: 'TUNING' },
      select: { sampleId: true },
      orderBy: { sampleId: 'asc' },
    });
    if (members.length === 0) throw new Error('teacher-ai-grading-controlled-strata-tuning-members-missing');
    const dataset = await createFileSystemTeacherAiGradingLabDatasetStore(readTeacherAiGradingLabConfig()).load({
      datasetId: split.datasetId,
      datasetVersion: split.datasetVersion,
    });
    const memberIds = new Set(members.map((member) => member.sampleId));
    const structures = [];
    for (const sample of dataset.manifest.samples.filter((candidate) => memberIds.has(candidate.sampleId))) {
      for (const submission of sample.submissions) {
        const structure = await inspectDocxStructure(await dataset.readSubmission(sample.sampleId, submission.questionId));
        structures.push({ sampleId: sample.sampleId, questionId: submission.questionId, ...structure });
      }
    }
    const snapshot = createTeacherAiGradingControlledStrataSnapshot(structures);
    const body = {
      ...snapshot,
      split: {
        id: split.id,
        version: String(split.version),
        contentHash: split.contentHash,
      },
    };
    await writeFile(output, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ output, stratumCount: snapshot.strata.length, contentHash: snapshot.contentHash })}\n`);
  } finally {
    await db.$disconnect();
  }
}

function parseArguments(argv: string[]): Arguments {
  if (argv.length !== 4 || argv[0] !== '--split-id' || argv[2] !== '--output') {
    throw new Error('teacher-ai-grading-controlled-strata-arguments-invalid');
  }
  const [splitId, output] = [argv[1], argv[3]];
  if (!splitId || !output) throw new Error('teacher-ai-grading-controlled-strata-arguments-invalid');
  return { splitId, output };
}

function assertExternalOutput(value: string): string {
  if (!isAbsolute(value)) throw new Error('teacher-ai-grading-controlled-strata-output-must-be-absolute');
  const output = resolve(value);
  const repositoryRelative = relative(process.cwd(), output);
  if (!repositoryRelative.startsWith('..') && !isAbsolute(repositoryRelative)) {
    throw new Error('teacher-ai-grading-controlled-strata-output-must-be-outside-repository');
  }
  return output;
}

async function inspectDocxStructure(bytes: Buffer): Promise<{ imageCount: number; formulaCount: number }> {
  const archive = await JSZip.loadAsync(bytes);
  const document = await archive.file('word/document.xml')?.async('text');
  if (!document) throw new Error('teacher-ai-grading-controlled-strata-docx-document-missing');
  return {
    imageCount: Object.values(archive.files).filter((file) => !file.dir && file.name.startsWith('word/media/')).length,
    formulaCount: (document.match(/<m:oMath(?:\s|>)/gu) ?? []).length,
  };
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'teacher-ai-grading-controlled-strata-failed'}\n`);
  process.exitCode = 1;
});
