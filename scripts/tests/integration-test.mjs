import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log('DATABASE_URL not set; skipping integration test.');
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  await prisma.$connect();
  console.log('Integration test passed: database connection ok.');
} catch (error) {
  console.error('Integration test failed: database connection error.');
  console.error(error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
