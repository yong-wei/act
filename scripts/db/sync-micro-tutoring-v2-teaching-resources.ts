import { execFileSync } from 'node:child_process';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { getRegisteredResourceMetadata } from '../../src/lib/resource-registry-metadata';
import {
  ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
  ADAPTIVE_ASSESSMENT_BKT_PARAMETERS,
} from '../../src/features/assessment/adaptive-mastery';
import { GIT_SHA } from '../../src/features/assessment/micro-tutoring-teaching-resource-sync';
import { planMicroTutoringV2DatabaseSync } from '../../src/features/assessment/micro-tutoring-validation-item-ref-sync';

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

  const [existingResourceRows, existingKnowledgeNodeIds, existingItemRefs] = await Promise.all([
    prisma.teachingResource.findMany({
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
    }),
    prisma.knowledgeNode.findMany({ select: { id: true } }),
    prisma.adaptiveAssessmentItemRef.findMany({
      select: {
        id: true,
        questionId: true,
        contentHash: true,
        algorithmVersion: true,
        source: true,
        questionType: true,
        domains: true,
        knowledgeTags: true,
        difficulty: true,
        optionCount: true,
        metadata: true,
      },
    }),
  ]);

  const plan = planMicroTutoringV2DatabaseSync({
    teachingResourceRows: existingResourceRows.map((row) => ({
      ...row,
      knowledgeNodeIds: row.knowledgeNodes.map((node) => node.id),
    })),
    existingKnowledgeNodeIds: existingKnowledgeNodeIds.map((node) => node.id),
    validationItemRows: existingItemRefs,
    captureRevision,
    dirty,
  });
  if (!plan.ok) {
    console.error(JSON.stringify({
      ok: false,
      teachingIssues: plan.teachingIssues,
      validationIssues: plan.validationIssues,
    }, null, 2));
    process.exit(1);
  }

  const author = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (!author) {
    throw new Error('An ADMIN user is required to create TeachingResource rows.');
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of plan.teaching.entries) {
      if (entry.action === 'unchanged') continue;
      const metadata = getRegisteredResourceMetadata(entry.registryId);
      if (!metadata) {
        throw new Error(`Unknown registryId ${entry.registryId}`);
      }
      if (entry.action === 'create') {
        await tx.teachingResource.create({
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
      await tx.teachingResource.update({
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

    await tx.adaptiveAssessmentAlgorithmVersion.upsert({
      where: { version: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION },
      update: {},
      create: {
        version: ADAPTIVE_ASSESSMENT_ALGORITHM_VERSION,
        family: 'bkt-compatible',
        parameters: ADAPTIVE_ASSESSMENT_BKT_PARAMETERS,
        status: 'active',
        releasedAt: new Date(),
      },
    });

    for (const entry of plan.validation.entries) {
      if (entry.action !== 'create') continue;
      await tx.adaptiveAssessmentItemRef.create({
        data: {
          id: entry.id,
          questionId: entry.questionId,
          contentHash: entry.contentHash,
          source: entry.source,
          questionType: entry.questionType,
          domains: entry.domains,
          knowledgeTags: entry.knowledgeTags,
          difficulty: entry.difficulty,
          optionCount: entry.optionCount,
          algorithmVersion: entry.algorithmVersion,
          metadata: entry.metadata,
        },
      });
    }
  });

  console.log(JSON.stringify({
    ok: true,
    captureRevision: plan.captureRevision,
    teaching: {
      created: plan.teaching.entries.filter((entry) => entry.action === 'create').map((entry) => entry.registryId),
      updated: plan.teaching.entries.filter((entry) => entry.action === 'update').map((entry) => entry.registryId),
      unchanged: plan.teaching.entries.filter((entry) => entry.action === 'unchanged').map((entry) => entry.registryId),
    },
    validation: {
      created: plan.validation.entries.filter((entry) => entry.action === 'create').map((entry) => entry.sourceId),
      unchanged: plan.validation.entries.filter((entry) => entry.action === 'unchanged').map((entry) => entry.sourceId),
    },
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
