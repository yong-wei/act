import { createPrismaClient } from '../../src/lib/prisma-client';
import { getAllRegisteredResourceMetadata } from '../../src/lib/resource-registry-metadata';

const prisma = createPrismaClient();

const RESOURCE_REGISTRY_REPAIRS: Record<string, string> = {
  cmjrywg2v0001wi2jadnsjvz9: 'lesson02-modeling-handout-v1',
  cmjrywg380007wi2jy3k6ptx3: 'lesson02-nyquist-stability-quiz-v1',
  cmjrz8gq50001eg164l86jn57: 'lesson02-legacy-bridge-media-v1',
  cmjrz8gqf0003eg16o5q4uqzr: 'lesson02-legacy-objectives-handout-v1',
  cmjrz8gqg0005eg16dkorzjv5: 'lesson02-legacy-pretest-laws-v1',
  cmjrz8gqn000deg16ybf8kft0: 'lesson02-legacy-launcher-modeling-challenge-v1',
  cmjrz8gqo000feg16q6osuw5h: 'lesson02-legacy-summary-notes-v1',
};

async function main() {
  const metadataByRegistryId = new Map(
    getAllRegisteredResourceMetadata().map((resource) => [resource.id, resource]),
  );
  const resources = await prisma.teachingResource.findMany({
    select: {
      id: true,
      title: true,
      registryId: true,
      knowledgeNodes: { select: { id: true } },
    },
    orderBy: { id: 'asc' },
  });
  const existingKnowledgeNodeIds = new Set(
    (await prisma.knowledgeNode.findMany({ select: { id: true } })).map((node) => node.id),
  );
  const summary = {
    scannedTeachingResources: resources.length,
    registryRepairs: 0,
    knowledgeBindingRepairs: 0,
    skippedWithoutMetadata: [] as Array<{ id: string; title: string; registryId: string | null }>,
    skippedWithoutKnowledgeMetadata: [] as Array<{ id: string; title: string; registryId: string | null }>,
    skippedWithMissingKnowledgeNodes: [] as Array<{ id: string; registryId: string; missingNodeIds: string[] }>,
  };

  for (const resource of resources) {
    const repairedRegistryId = RESOURCE_REGISTRY_REPAIRS[resource.id] ?? resource.registryId;
    if (repairedRegistryId !== resource.registryId) {
      await prisma.teachingResource.update({
        where: { id: resource.id },
        data: { registryId: repairedRegistryId },
      });
      summary.registryRepairs += 1;
    }

    if (!repairedRegistryId) {
      summary.skippedWithoutMetadata.push({
        id: resource.id,
        title: resource.title,
        registryId: null,
      });
      continue;
    }

    const metadata = metadataByRegistryId.get(repairedRegistryId);
    if (!metadata) {
      summary.skippedWithoutMetadata.push({
        id: resource.id,
        title: resource.title,
        registryId: repairedRegistryId,
      });
      continue;
    }

    const knowledgeNodeIds = metadata.knowledgeNodeIds ?? [];
    if (knowledgeNodeIds.length === 0) {
      summary.skippedWithoutKnowledgeMetadata.push({
        id: resource.id,
        title: resource.title,
        registryId: repairedRegistryId,
      });
      continue;
    }

    const missingNodeIds = knowledgeNodeIds.filter((id) => !existingKnowledgeNodeIds.has(id));
    if (missingNodeIds.length > 0) {
      summary.skippedWithMissingKnowledgeNodes.push({
        id: resource.id,
        registryId: repairedRegistryId,
        missingNodeIds,
      });
      continue;
    }

    const existingBindingIds = resource.knowledgeNodes.map((node) => node.id).sort();
    const desiredBindingIds = [...new Set(knowledgeNodeIds)].sort();
    if (existingBindingIds.join('|') === desiredBindingIds.join('|')) continue;

    await prisma.teachingResource.update({
      where: { id: resource.id },
      data: {
        knowledgeNodes: {
          set: desiredBindingIds.map((id) => ({ id })),
        },
      },
    });
    summary.knowledgeBindingRepairs += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
