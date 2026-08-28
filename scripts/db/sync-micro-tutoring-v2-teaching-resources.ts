import { execFileSync } from 'node:child_process';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { getRegisteredResourceMetadata } from '../../src/lib/resource-registry-metadata';
import {
  GIT_SHA,
  planMicroTutoringTeachingResourceSync,
} from '../../src/features/assessment/micro-tutoring-teaching-resource-sync';

const prisma = createPrismaClient();

function gitCapture(): { captureRevision: string; dirty: boolean } {
  const captureRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
  return { captureRevision, dirty };
}

async function main() {
  const { captureRevision, dirty } = gitCapture();
  if (!GIT_SHA.test(captureRevision)) {
    throw new Error('Git HEAD is not a 40-character SHA.');
  }

  const existingRows = await prisma.teachingResource.findMany({
    select: {
      id: true,
      registryId: true,
      teacherOnly: true,
      title: true,
      displayName: true,
      description: true,
      type: true,
      category: true,
      content: true,
      config: true,
      knowledgeNodes: { select: { id: true } },
    },
  });
  const existingKnowledgeNodeIds = (await prisma.knowledgeNode.findMany({
    select: { id: true },
  })).map((node) => node.id);

  const plan = planMicroTutoringTeachingResourceSync({
    existingRows: existingRows.map((row) => ({
      ...row,
      knowledgeNodeIds: row.knowledgeNodes.map((node) => node.id),
    })),
    existingKnowledgeNodeIds,
    captureRevision,
    dirty,
  });
  if (!plan.ok) {
    console.error(JSON.stringify({ ok: false, issues: plan.issues }, null, 2));
    process.exit(1);
  }

  const author = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (!author) {
    throw new Error('An ADMIN user is required to create TeachingResource rows.');
  }

  for (const entry of plan.entries) {
    if (entry.action === 'unchanged') continue;
    const metadata = getRegisteredResourceMetadata(entry.registryId);
    if (!metadata) {
      throw new Error(`Unknown registryId ${entry.registryId}`);
    }
    if (entry.action === 'create') {
      await prisma.teachingResource.create({
        data: {
          id: entry.id,
          registryId: entry.registryId,
          title: entry.title,
          displayName: entry.title,
          description: entry.title,
          type: metadata.type,
          teacherOnly: false,
          config: entry.nextConfig,
          authorId: author.id,
          ...(entry.connectKnowledgeNodeId
            ? { knowledgeNodes: { connect: { id: entry.connectKnowledgeNodeId } } }
            : {}),
        },
      });
      continue;
    }
    await prisma.teachingResource.update({
      where: { id: entry.id },
      data: {
        registryId: entry.registryId,
        teacherOnly: false,
        config: entry.nextConfig,
        ...(entry.connectKnowledgeNodeId
          ? { knowledgeNodes: { connect: { id: entry.connectKnowledgeNodeId } } }
          : {}),
      },
    });
  }

  console.log(JSON.stringify({
    ok: true,
    captureRevision: plan.captureRevision,
    created: plan.entries.filter((entry) => entry.action === 'create').map((entry) => entry.registryId),
    updated: plan.entries.filter((entry) => entry.action === 'update').map((entry) => entry.registryId),
    unchanged: plan.entries.filter((entry) => entry.action === 'unchanged').map((entry) => entry.registryId),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
