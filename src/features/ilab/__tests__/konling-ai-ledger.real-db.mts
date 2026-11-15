import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { emptyAiLedger, isAiUsageLedger } from '../ai-data';
import { recordSimulationKonlingAiUsage } from '../adapters/konling-ai-ledger';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
const user = await prisma.user.create({ data: { name: 'konling concurrent ledger fixture', accountSource: 'ILAB' } });
const run = await prisma.ilabExperimentRun.create({ data: {
  originId: `ledger_${randomUUID()}`, userId: user.id, appId: 'local-ledger-fixture',
  ilabUsername: randomUUID(), accessToken: 'local-fixture', startTimeMs: BigInt(Date.now()),
  vesselId: 'fleet-container-msc', steps: [], aiLedger: emptyAiLedger(),
} });
try {
  const count = 20;
  await Promise.all(Array.from({ length: count }, (_, index) => recordSimulationKonlingAiUsage({
    userId: user.id, courseId: 'container-voyage-experiment', stepId: 'container-voyage-step-15',
    model: index % 2 ? 'fixture-a' : 'fixture-b', provider: 'local-fixture',
    endpoint: 'http://127.0.0.1:1', inputTokens: 7, outputTokens: 11,
  })));
  const saved = await prisma.ilabExperimentRun.findUniqueOrThrow({ where: { id: run.id } });
  assert(isAiUsageLedger(saved.aiLedger));
  assert.equal(saved.aiLedger.callCount, count, 'Concurrent replies must each contribute exactly once');
  assert.equal(saved.aiLedger.inputTokens, count * 7);
  assert.equal(saved.aiLedger.outputTokens, count * 11);
  assert.equal(saved.aiLedger.models?.length, 2);
  console.log(JSON.stringify({ concurrentCalls: count, callCount: saved.aiLedger.callCount,
    inputTokens: saved.aiLedger.inputTokens, outputTokens: saved.aiLedger.outputTokens }));
} finally {
  await prisma.ilabExperimentRun.delete({ where: { id: run.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
