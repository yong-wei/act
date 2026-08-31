import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createPrismaClient } from '../../src/lib/prisma-client';
import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { processDocumentConversionJob, writeRenderedObjectToSubmissionStore } from '../../src/lib/data-governance/math-document-grading-persistence';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({ where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  const jobs = await prisma.gradingJob.findMany({ where: { kind: 'CONVERSION', state: { in: ['QUEUED', 'RETRYABLE'] }, conversion: { attempt: { answer: { submission: { assignmentRevisionId: revision.id } } } } }, select: { id: true } });
  const store = createSubmissionObjectStore();
  const results = [];
  for (const job of jobs) {
    try {
      const processed = await processDocumentConversionJob({ db: prisma, jobId: job.id, store, writeRendered: (rendered) => writeRenderedObjectToSubmissionStore({ store, ...rendered }) });
      results.push({ job: job.id, state: processed.conversion.state, failureCode: processed.conversion.failureCode, readiness: processed.evidence?.readiness ?? null });
    } catch (error) {
      results.push({ job: job.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const conversions = await prisma.documentConversion.findMany({ where: { attempt: { answer: { submission: { assignmentRevisionId: revision.id } } } }, select: { state: true, failureCode: true, canonicalMarkdown: true, renderedObjectKey: true } });
  console.log(JSON.stringify({ revisionId: revision.id, queuedJobs: jobs.length, results, conversions: conversions.map((row) => ({ state: row.state, failureCode: row.failureCode, hasMarkdown: Boolean(row.canonicalMarkdown), hasRenderedPdf: Boolean(row.renderedObjectKey) })) }));
}
void main().finally(() => prisma.$disconnect());
