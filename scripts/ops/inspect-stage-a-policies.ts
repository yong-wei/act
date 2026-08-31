import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');
import { createPrismaClient } from '../../src/lib/prisma-client';
const prisma = createPrismaClient({ log: ['warn', 'error'] });
async function main() {
  const rows = await prisma.gradingProviderPolicy.findMany({ where: { enabled: true }, select: { id: true, purpose: true, provider: true, model: true, version: true }, orderBy: { purpose: 'asc' } });
  console.log(JSON.stringify(rows));
}
void main().finally(() => prisma.$disconnect());
