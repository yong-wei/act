import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  DiscardedDraftReplayError,
  savePortfolioReflectionDraft,
} from '../../src/lib/portfolio-reflection-drafts';

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

    const input = {
      source: 'portfolio',
      assignment: 'PID parameter tuning',
      intent: 'create-portfolio-reflection',
      title: 'AI collaboration reflection',
      content: 'Check the settling time first.',
      idempotencyKey,
    };
    const [first, concurrent] = await Promise.all([
      savePortfolioReflectionDraft(prisma, userId, input),
      savePortfolioReflectionDraft(prisma, userId, input),
    ]);
    assert.equal(concurrent.id, first.id);

    const active = await prisma.portfolioReflectionDraft.findMany({
      where: { userId, status: 'DRAFT' },
    });
    assert.equal(active.length, 1);
    assert.equal(active[0]?.content, first.content);
    assert.equal(active[0]?.source, first.source);
    assert.equal(await prisma.learningFact.count({ where: { userId } }), 0);

    await prisma.portfolioReflectionDraft.updateMany({
      where: { id: first.id, userId, status: 'DRAFT' },
      data: { status: 'DISCARDED' },
    });
    assert.equal(await prisma.portfolioReflectionDraft.count({ where: { userId, status: 'DRAFT' } }), 0);
    assert.equal(await prisma.learningFact.count({ where: { userId } }), 0);

    await assert.rejects(
      savePortfolioReflectionDraft(prisma, userId, input),
      (error: unknown) => error instanceof DiscardedDraftReplayError,
    );

    console.log('portfolio reflection draft PostgreSQL verification passed');
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

void main();
