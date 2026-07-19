import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRegistry, type Registry } from '../registry';
import { discoverWriters } from '../writer-discovery';

function registry(include: string[]): Registry {
  return {
    repository_sources: [{
      id: 'knowledge-direct-writers',
      include,
      static_discovery: {
        roots: ['src', 'scripts'],
        exclude: [],
        prisma_mutations: ['KnowledgeNode', 'KnowledgeLink', 'LessonItem.knowledgeNodeId', 'LearningFact'],
      },
    }],
  } as unknown as Registry;
}

async function put(root: string, file: string, text: string): Promise<void> {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), text);
}

describe('symbol-level writer and producer closure', () => {
  it('follows aliases, relative and alias re-exports, same-file calls and multiple hops without contaminating unrelated symbols', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'writer-symbols-'));
    try {
      await put(root, 'src/sink.ts', `
        export async function persist(input: { db: any }) {
          return input.db.learningFact.create({ data: { score: 1 } });
        }
      `);
      await put(root, 'src/barrel.ts', `export { persist as writeFact } from './sink';`);
      await put(root, 'src/middle.ts', `
        import { writeFact } from './barrel';
        export const bridge = (input: { db: any }) => writeFact(input);
        export const unrelated = () => 'read-only';
      `);
      await put(root, 'src/route.ts', `
        import { bridge } from '@/middle';
        export async function POST(input: { db: any }) { return bridge(input); }
        export async function GET() { return 'read-only'; }
      `);
      const include = ['src/middle.ts', 'src/route.ts', 'src/sink.ts'];
      const first = await discoverWriters(root, registry(include));
      const second = await discoverWriters(root, registry(include));
      expect(second).toEqual(first);
      expect(first.drift).toEqual([]);
      const route = first.evidence.find((item) => item.path === 'src/route.ts')!;
      expect(route.call_paths).toContainEqual(expect.objectContaining({
        symbols: ['src/route.ts#POST', 'src/middle.ts#bridge', 'src/sink.ts#persist'],
        target: expect.objectContaining({ model: 'LearningFact', operation: 'create' }),
      }));
      expect(route.call_paths.some((item) => item.symbols.some((symbol) => symbol.endsWith('#GET')))).toBe(false);
      expect(first.evidence.find((item) => item.path === 'src/middle.ts')?.call_paths.some((item) => item.symbols.some((symbol) => symbol.endsWith('#unrelated')))).toBe(false);
    } finally { await rm(root, { recursive: true }); }
  });

  it('covers transaction clients, delegate aliases, resolved nested fields, MJS and conservative interface dispatch', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'writer-shapes-'));
    try {
      await put(root, 'prisma/schema.prisma', `
        datasource db { provider = "postgresql" url = env("DATABASE_URL") }
        generator client { provider = "prisma-client-js" }
        model LessonPlan {
          id String @id
          items LessonItem[]
        }
        model LessonItem {
          id String @id
          knowledgeNodeId String?
          planId String
          plan LessonPlan @relation(fields: [planId], references: [id])
        }
        model LearningFact {
          id String @id
          score Float
        }
        model KnowledgeNode {
          id String @id
        }
        model KnowledgeLink {
          id String @id
        }
      `);
      await put(root, 'src/interface.ts', `
        export interface Writer { persist(): Promise<unknown> }
        export async function dispatch(writer: Writer) { return writer.persist(); }
        export const writer: Writer = {
          async persist() { return db.learningFact.upsert({ where: { id: 'x' }, create: { id: 'x' }, update: {} }); }
        };
      `);
      await put(root, 'src/interface-route.ts', `
        import { dispatch, writer } from './interface';
        export function POST() { return dispatch(writer); }
      `);
      await put(root, 'src/lesson.ts', `
        const normalizedItems = [{ knowledgeNodeId: 'node-1' }];
        export async function createLesson(input: { db: any }) {
          const client = input.db;
          return client.$transaction(async (tx: any) => tx.lessonPlan.create({ data: { items: { create: normalizedItems } } }));
        }
      `);
      await put(root, 'scripts/seed.mjs', `
        const nodes = db.knowledgeNode;
        export async function seed() { return nodes.createMany({ data: [] }); }
        seed();
      `);
      const include = ['scripts/seed.mjs', 'src/interface-route.ts', 'src/interface.ts', 'src/lesson.ts'];
      const result = await discoverWriters(root, registry(include));
      expect(result.drift).toEqual([]);
      expect(result.evidence.find((item) => item.path === 'src/interface-route.ts')?.call_paths).toContainEqual(expect.objectContaining({
        symbols: ['src/interface-route.ts#POST', 'src/interface.ts#dispatch', 'src/interface.ts#writer.persist'],
        target: expect.objectContaining({ model: 'LearningFact', operation: 'upsert' }),
      }));
      expect(result.evidence.find((item) => item.path === 'src/lesson.ts')?.targets).toContainEqual({ model: 'LessonItem', operation: 'create', nested_relation: 'knowledgeNodeId' });
      expect(result.evidence.find((item) => item.path === 'scripts/seed.mjs')?.targets).toContainEqual({ model: 'KnowledgeNode', operation: 'createMany', nested_relation: null });
    } finally { await rm(root, { recursive: true }); }
  });

  it('classifies static reads, advisory locks and out-of-scope CTE writes while failing closed only for unparseable possible writes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'writer-sql-'));
    try {
      await put(root, 'src/safe.ts', `
        export async function inspect(db: any) {
          await db.$queryRaw\`SELECT * FROM "LearningFact"\`;
          await db.$queryRaw\`SELECT pg_advisory_lock(1)\`;
          await db.$executeRaw\`WITH derived AS (SELECT 1) SELECT * FROM derived\`;
          await db.$executeRaw\`WITH retired AS (DELETE FROM "AuditLog" RETURNING id) SELECT * FROM retired\`;
        }
      `);
      await put(root, 'src/target.ts', `export const write = (db: any) => db.$executeRaw\`WITH changed AS (UPDATE "LearningFact" SET score = 1 RETURNING id) SELECT * FROM changed\`;`);
      await put(root, 'src/unresolved.ts', `export const maybeWrite = (db: any, sql: unknown) => db.$executeRaw(sql);`);
      const result = await discoverWriters(root, registry(['src/target.ts', 'src/unresolved.ts']));
      expect(result.evidence.some((item) => item.path === 'src/safe.ts')).toBe(false);
      expect(result.evidence.find((item) => item.path === 'src/target.ts')?.targets).toContainEqual({ model: 'LearningFact', operation: 'raw_update', nested_relation: null });
      expect(result.drift).toEqual([{ code: 'DYNAMIC_RAW_SQL_UNRESOLVED', scope: 'src/unresolved.ts' }]);
    } finally { await rm(root, { recursive: true }); }
  });

  it('closes the real registry and retains representative seed, nested lesson, Arena, virtual and GC symbol paths', async () => {
    const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
    const sourceRegistry = await loadRegistry(repositoryRoot, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    const result = await discoverWriters(repositoryRoot, sourceRegistry);
    const writerDrift = new Set(['DISCOVERED_WRITER_UNDECLARED', 'DECLARED_WRITER_NOT_DISCOVERED', 'DYNAMIC_RAW_SQL_UNRESOLVED']);
    expect(result.drift.filter((item) => writerDrift.has(item.code))).toEqual([]);

    const evidence = new Map(result.evidence.map((item) => [item.path, item]));
    expect(evidence.get('scripts/db/seed-all-knowledge.mjs')?.call_paths.some((item) =>
      item.symbols.some((symbol) => symbol.includes('$transaction')) && item.target.model === 'KnowledgeNode')).toBe(true);
    expect(evidence.get('src/app/api/lesson-plans/route.ts')?.targets).toContainEqual({ model: 'LessonItem', operation: 'create', nested_relation: 'knowledgeNodeId' });
    expect(evidence.get('src/app/api/arena/evaluate/route.ts')?.call_paths.some((item) =>
      item.symbols.some((symbol) => symbol.includes('evidence-writeback-persistence.ts')) && item.target.model === 'LearningFact')).toBe(true);
    expect(evidence.get('src/app/api/arena/virtual-simulation-runs/route.ts')?.call_paths.some((item) =>
      item.symbols.some((symbol) => symbol.includes('controller-preview.ts')) && item.target.model === 'LearningFact')).toBe(true);
    expect(evidence.get('src/app/api/admin/users/[id]/route.ts')?.targets).toEqual(expect.arrayContaining([
      { model: 'LessonItem', operation: 'deleteMany', nested_relation: 'knowledgeNodeId' },
      { model: 'TeachingResource', operation: 'deleteMany', nested_relation: 'knowledgeNodes' },
    ]));
  }, 30_000);
});
