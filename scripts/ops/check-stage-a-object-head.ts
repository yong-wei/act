import 'dotenv/config';

import { createHash } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';

if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const anonymous = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 12);

async function main() {
  const revision = await prisma.assignmentRevision.findFirstOrThrow({ where: { state: 'PUBLISHED', assignment: { courseContext: { startsWith: 'stage-a:T2S-20:' } } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  const batches = await prisma.gradingBatch.findMany({ where: { assignmentRevisionId: revision.id, visualPolicyId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { questionId: true, items: { include: { attempt: { include: { assets: { where: { state: 'FINALIZED' }, take: 1 } } } } } } });
  const latest = new Map<string, (typeof batches)[number]>();
  for (const batch of batches) if (!latest.has(batch.questionId)) latest.set(batch.questionId, batch);
  const assets = [...latest.values()].flatMap((batch) => batch.items.map((item) => item.attempt?.assets[0]).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset)));
  if (assets.length !== 12) throw new Error(`stage-a-asset-count:${assets.length}`);
  const store = createSubmissionObjectStore();
  const results = [];
  for (const asset of assets) {
    try {
      const metadata = await store.head(asset.objectKey);
      results.push({ objectKey: anonymous(asset.objectKey), status: metadata ? 'ok' : 'missing', scanState: metadata?.scanState ?? null });
    } catch (error) {
      results.push({ objectKey: anonymous(asset.objectKey), status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ count: assets.length, results }));
  if (results.some((result) => result.status !== 'ok')) process.exitCode = 1;
}

void main().finally(() => prisma.$disconnect());
