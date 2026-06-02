import { createPrismaClient } from '../lib/prisma-client.mjs';

import fs from 'fs/promises';
import path from 'path';

const prisma = createPrismaClient();

const LESSON_ID = 'lesson-13-cruise-comfort';

// Data Definitions
const CARDS = [
  {
    id: 'node-iso-2631',
    name: 'ISO 2631 舒适度标准',
    filename: 'iso-2631.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    description: '国际标准化组织制定的关于人体承受全身振动评价的标准。',
    position: { x: 0, y: 0, z: 0 }
  },
  {
    id: 'node-fin-stabilizer',
    name: '主动减摇鳍',
    filename: 'fin-stabilizer.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'REMEMBER',
    knowledgeDim: 'FACTUAL',
    description: '安装在船体两侧的翼状装置，通过改变攻角产生升力。',
    position: { x: 10, y: 0, z: 0 }
  },
  {
    id: 'node-comfort-index',
    name: '舒适度指数',
    filename: 'comfort-index.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    description: '综合考虑加速度、频率和暴露时间的量化指标。',
    position: { x: 0, y: 10, z: 0 }
  },
  {
    id: 'node-roll-damping',
    name: '横摇阻尼',
    filename: 'roll-damping.mdx',
    nodeType: 'THEORY',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    description: '船舶在横摇运动中受到的阻力矩。',
    position: { x: 10, y: 10, z: 0 }
  },
  {
    id: 'node-trade-off',
    name: '工程折衷 (Trade-off)',
    filename: 'trade-off.mdx',
    nodeType: 'ETHICS',
    bloomLevel: 'EVALUATE',
    knowledgeDim: 'METACOGNITIVE',
    description: '在相互冲突的工程目标之间进行权衡的决策过程。',
    position: { x: 5, y: 5, z: 5 }
  }
];

const LINKS = [
  { sourceId: 'node-roll-damping', targetId: 'node-comfort-index', relation: 'influences' },
  { sourceId: 'node-fin-stabilizer', targetId: 'node-roll-damping', relation: 'implements' },
  { sourceId: 'node-iso-2631', targetId: 'node-comfort-index', relation: 'defines' },
  { sourceId: 'node-trade-off', targetId: 'node-fin-stabilizer', relation: 'governs' }
];

async function main() {
  console.log(`🌱 Starting knowledge seeding for ${LESSON_ID}...`);

  const contentDir = path.join(process.cwd(), 'content', 'concepts');

  // 1. Seed Nodes
  for (const card of CARDS) {
    console.log(`Processing node: ${card.name}`);

    // Read MDX Content
    const filePath = path.join(contentDir, card.filename);
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`⚠️ Could not read file ${card.filename}, using description as fallback.`);
      content = card.description;
    }

    const metadata = {
      type: 'mdx',
      content: content,
      lessonId: LESSON_ID,
    };

    await prisma.knowledgeNode.upsert({
      where: { id: card.id },
      update: {
        name: card.name,
        nodeType: card.nodeType,
        description: card.description,
        bloomLevel: card.bloomLevel,
        knowledgeDim: card.knowledgeDim,
        positionX: card.position.x,
        positionY: card.position.y,
        positionZ: card.position.z,
        metadata: metadata,
        tags: [LESSON_ID],
        isActive: true
      },
      create: {
        id: card.id,
        name: card.name,
        nodeType: card.nodeType,
        description: card.description,
        bloomLevel: card.bloomLevel,
        knowledgeDim: card.knowledgeDim,
        positionX: card.position.x,
        positionY: card.position.y,
        positionZ: card.position.z,
        metadata: metadata,
        tags: [LESSON_ID],
        isActive: true
      }
    });
  }

  // 2. Seed Links
  for (const link of LINKS) {
    console.log(`Processing link: ${link.sourceId} -> ${link.targetId}`);

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
      console.warn(`Skipping link: Source or Target node missing for ${link.sourceId} -> ${link.targetId}`);
    }
  }

  console.log(`✅ Knowledge seeding for ${LESSON_ID} completed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
