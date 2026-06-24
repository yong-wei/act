import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL ||
  'postgresql://prisma-generate:prisma-generate@localhost:5432/prisma_generate';

const datasource = {
  url: databaseUrl,
  ...(process.env.SHADOW_DATABASE_URL
    ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
    : {}),
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource,
});
