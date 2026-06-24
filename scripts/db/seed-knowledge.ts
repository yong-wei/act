import { createPrismaClient } from '../../src/lib/prisma-client';

import { KnowledgeNodeType, BloomLevel, KnowledgeDimension } from '@prisma/client';
import { LESSON_02_CARDS, LESSON_02_CARD_LINKS } from '../src/features/knowledge/data/lesson-knowledge-cards';

const prisma = createPrismaClient();

async function main() {
  console.log('🌱 Starting knowledge seeding...');

  // 1. Seed Nodes
  for (const card of LESSON_02_CARDS) {
    console.log(`Processing node: ${card.name}`);
    
    // Construct standardized metadata
    const metadata = {
      type: 'rich-text',
      content: card.explanation,
      learningObjectives: [], // Placeholder
      formulas: {
        continuous: card.formulaContinuous,
        discrete: card.formulaDiscrete
      },
      applications: card.applications,
      lessonId: card.lessonId,
      phase: card.phase
    };

    // Construct resources
    const resources = card.relatedTopics.map(topic => ({
      type: 'internal-link',
      targetId: topic,
      label: 'Related Topic'
    }));

    await prisma.knowledgeNode.upsert({
      where: { id: card.id },
      update: {
        name: card.name,
        nodeType: card.nodeType as KnowledgeNodeType, // Ensure type match
        description: card.description,
        bloomLevel: BloomLevel.UNDERSTAND, // Default for now
        knowledgeDim: KnowledgeDimension.CONCEPTUAL, // Default for now
        positionX: card.positionX,
        positionY: card.positionY,
        positionZ: card.positionZ,
        metadata: metadata,
        resources: resources,
        tags: ['lesson-02', card.phase],
        isActive: true
      },
      create: {
        id: card.id,
        name: card.name,
        nodeType: card.nodeType as KnowledgeNodeType,
        description: card.description,
        bloomLevel: BloomLevel.UNDERSTAND,
        knowledgeDim: KnowledgeDimension.CONCEPTUAL,
        positionX: card.positionX,
        positionY: card.positionY,
        positionZ: card.positionZ,
        metadata: metadata,
        resources: resources,
        tags: ['lesson-02', card.phase],
        isActive: true
      }
    });
  }

  // 2. Seed Links
  for (const link of LESSON_02_CARD_LINKS) {
    console.log(`Processing link: ${link.sourceId} -> ${link.targetId}`);
    
    // Check if both nodes exist (to avoid FK errors if target is missing)
    const sourceExists = await prisma.knowledgeNode.findUnique({ where: { id: link.sourceId } });
    const targetExists = await prisma.knowledgeNode.findUnique({ where: { id: link.targetId } });

    if (sourceExists && targetExists) {
        await prisma.knowledgeLink.upsert({
            where: {
                sourceId_targetId: {
                    sourceId: link.sourceId,
                    targetId: link.targetId
                }
            },
            update: {
                relation: link.relation
            },
            create: {
                sourceId: link.sourceId,
                targetId: link.targetId,
                relation: link.relation
            }
        });
    } else {
        console.warn(`Skipping link ${link.id}: Source or Target node missing.`);
    }
  }

  console.log('✅ Knowledge seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
