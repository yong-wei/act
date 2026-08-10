import type { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  createIsolatedAdmissionDatabase,
} from '../../../scripts/knowledge-cutover/admit-latest-actkg-aggregate';

describe('createIsolatedAdmissionDatabase schema-only mode', () => {
  it('creates only a schema, passes the schema URL to migration and Prisma, and drops it on cleanup', async () => {
    const sourceUrl = 'postgresql://user:password@localhost:5432/act_obe';
    const queries: string[] = [];
    const admin = {
      connect: vi.fn(async () => undefined),
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('CREATE DATABASE')) throw new Error('CREATE DATABASE must not be attempted');
        return { rows: [] };
      }),
      end: vi.fn(async () => undefined),
    } as unknown as Client;
    const database = {
      $disconnect: vi.fn(async () => undefined),
    } as unknown as PrismaClient;
    const migrationResult = {
      pid: 0,
      output: [],
      status: 0,
      stdout: '',
      stderr: '',
      signal: null,
    } as unknown as ReturnType<typeof spawnSync>;
    const migrationRunnerMock = vi.fn((..._args: unknown[]) => migrationResult);
    let prismaUrl: string | undefined;
    const prismaClientFactory = vi.fn(() => {
      prismaUrl = process.env.DATABASE_URL;
      return database;
    });
    const previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = sourceUrl;

    try {
      const isolated = await createIsolatedAdmissionDatabase('/repo', {
        schemaOnly: true,
        adminClientFactory: () => admin,
        migrationRunner: migrationRunnerMock as unknown as typeof spawnSync,
        prismaClientFactory,
      });

      expect(isolated.mode).toBe('schema');
      expect(isolated.name).toMatch(/^actkg_admission_[a-z0-9_]+$/u);
      expect(queries[0]).toBe(`CREATE SCHEMA "${isolated.name}"`);
      expect(queries.some((query) => query.includes('CREATE DATABASE'))).toBe(false);

      const migrationOptions = migrationRunnerMock.mock.calls[0]?.[2] as { env?: NodeJS.ProcessEnv } | undefined;
      expect(migrationOptions?.env?.DATABASE_URL).toBeDefined();
      const isolatedUrl = new URL(migrationOptions!.env!.DATABASE_URL as string);
      expect(isolatedUrl.searchParams.get('schema')).toBe(isolated.name);
      expect(isolatedUrl.searchParams.get('options')).toBe(`-csearch_path=${isolated.name},public`);
      expect(prismaUrl).toBe(migrationOptions!.env!.DATABASE_URL);
      expect(process.env.DATABASE_URL).toBe(sourceUrl);

      await isolated.cleanup();
      expect(database.$disconnect).toHaveBeenCalledOnce();
      expect(queries.at(-1)).toBe(`DROP SCHEMA IF EXISTS "${isolated.name}" CASCADE`);
      expect(admin.end).toHaveBeenCalledOnce();
    } finally {
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    }
  });
});
