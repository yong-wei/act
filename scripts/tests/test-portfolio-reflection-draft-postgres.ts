import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient();
const suffix = randomUUID();
const userId = `portfolio-draft-test-${suffix}`;
const idempotencyKey = randomUUID();

async function main() {
  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `portfolio-draft-${suffix}@example.test`,
        name: 'Portfolio Draft Verification',
        role: 'STUDENT',
      },
    });

    const first = await prisma.portfolioReflectionDraft.upsert({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      create: {
        userId,
        source: 'portfolio',
        assignment: 'PID 参数整定',
        intent: 'create-portfolio-reflection',
        title: 'AI 协作反思草稿',
        content: '先核对调节时间。',
        status: 'DRAFT',
        idempotencyKey,
      },
      update: {},
    });

    const repeated = await prisma.portfolioReflectionDraft.upsert({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      create: {
        userId,
        source: 'portfolio',
        intent: 'create-portfolio-reflection',
        title: '不应创建的重复草稿',
        content: '不应创建。',
        status: 'DRAFT',
        idempotencyKey,
      },
      update: { content: '比较超调量并记录下一步验证。' },
    });
    assert.equal(repeated.id, first.id);

    const active = await prisma.portfolioReflectionDraft.findMany({
      where: { userId, status: 'DRAFT' },
    });
    assert.equal(active.length, 1);
    assert.equal(active[0]?.content, '比较超调量并记录下一步验证。');
    assert.equal(await prisma.learningFact.count({ where: { userId } }), 0);

    await prisma.portfolioReflectionDraft.updateMany({
      where: { id: first.id, userId, status: 'DRAFT' },
      data: { status: 'DISCARDED' },
    });
    assert.equal(await prisma.portfolioReflectionDraft.count({ where: { userId, status: 'DRAFT' } }), 0);
    assert.equal(await prisma.learningFact.count({ where: { userId } }), 0);

    console.log('portfolio reflection draft PostgreSQL verification passed');
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

void main();
