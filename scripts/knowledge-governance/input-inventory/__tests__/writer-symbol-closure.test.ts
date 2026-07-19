import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRegistry, type Registry } from '../registry';
import { discoverWriters, validateLearningFactProducerContracts, type WriterEvidence } from '../writer-discovery';

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
  it.each([
    ['qualified', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); const sourceEventId = `arena-official:${id}`; await tx.learningFact.create({ data: { sourceEventId, contextJson: { knowledgeRevisionRef: activeKnowledgeRevision.id } } }); });", []],
    ['same revision on declared paths', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); await tx.learningFact.create({ data: { sourceEventId: `arena-official:${id}`, contextJson: { knowledgeRevisionRef: activeKnowledgeRevision.id, evidenceGovernance: { knowledgeRevisionRef: activeKnowledgeRevision.id } } } }); });", []],
    ['single-item revision array', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); await tx.learningFact.create({ data: { sourceEventId: `arena-official:${id}`, contextJson: { knowledgeRevisionRefs: [activeKnowledgeRevision.id] } } }); });", []],
    ['unnamespaced source', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); await tx.learningFact.create({ data: { sourceEventId: id, contextJson: { knowledgeRevisionRef: activeKnowledgeRevision.id } } }); });", ['LEARNING_FACT_PRODUCER_SOURCE_NAMESPACE_UNRESOLVED']],
    ['unknown prefix', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); await tx.learningFact.create({ data: { sourceEventId: `evil:${id}`, contextJson: { knowledgeRevisionRef: activeKnowledgeRevision.id } } }); });", ['LEARNING_FACT_PRODUCER_SOURCE_NAMESPACE_UNRESOLVED']],
    ['fake namespace helper', "function classifyLearningFactSource(value: string) { return `arena-official:${value}`; } await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); await tx.learningFact.create({ data: { sourceEventId: classifyLearningFactSource(id), contextJson: { knowledgeRevisionRef: activeKnowledgeRevision.id } } }); });", ['LEARNING_FACT_PRODUCER_SOURCE_NAMESPACE_UNRESOLVED']],
    ['missing source identity', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); await tx.learningFact.create({ data: { contextJson: { knowledgeRevisionRef: activeKnowledgeRevision.id } } }); });", ['LEARNING_FACT_PRODUCER_SOURCE_ID_MISSING']],
    ['nested source forgery', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); await tx.learningFact.create({ data: { metadata: { sourceEventId: `arena-official:${id}` }, contextJson: { knowledgeRevisionRef: activeKnowledgeRevision.id } } }); });", ['LEARNING_FACT_PRODUCER_SOURCE_ID_MISSING']],
    ['nested revision forgery', "await db.$transaction(async (tx: any) => { await tx.learningFact.create({ data: { sourceEventId: `arena-official:${id}`, metadata: { knowledgeRevisionRef: 'forged' } } }); });", ['LEARNING_FACT_PRODUCER_KNOWLEDGE_REVISION_MISSING']],
    ['wrong callback client', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); await db.learningFact.create({ data: { sourceEventId: `arena-official:${id}`, contextJson: { knowledgeRevisionRef: activeKnowledgeRevision.id } } }); });", ['LEARNING_FACT_PRODUCER_ACTIVE_REVISION_UNRESOLVED', 'LEARNING_FACT_PRODUCER_NON_ATOMIC']],
    ['multiple revisions', "await db.$transaction(async (tx: any) => { const activeKnowledgeRevision = await resolveActiveKnowledgeRevision(tx); const sourceLogId = `interaction-log:${id}`; await tx.learningFact.create({ data: { sourceLogId, contextJson: { knowledgeRevisionRefs: [activeKnowledgeRevision.id, otherRevision] } } }); });", ['LEARNING_FACT_PRODUCER_MULTIPLE_REVISIONS_POSSIBLE']],
  ])('validates LearningFact producer revision and source namespace contract: %s', async (_label, body, expectedCodes) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'writer-producer-contract-'));
    try {
      await put(root, 'src/lib/data-governance/knowledge-truth-revision.ts', `export async function resolveActiveKnowledgeRevision(tx: any) { return { id: 'revision-1' }; }`);
      await put(root, 'src/producer.ts', `import { resolveActiveKnowledgeRevision } from './lib/data-governance/knowledge-truth-revision'; export async function persist(db: any, id: string, otherRevision: string) { ${body} }`);
      const evidence: WriterEvidence[] = [{
        path: 'src/producer.ts', mutations: ['LearningFact.create'], dynamic_raw: false,
        targets: [{ model: 'LearningFact', operation: 'create', nested_relation: null }], calls: [], imports: {},
        call_paths: [{ symbols: ['src/producer.ts#persist', 'src/producer.ts#db.$transaction[callback:0]'], target: { model: 'LearningFact', operation: 'create', nested_relation: null } }],
      }];
      const sourceRegistry = { knowledge_truth_revision_contract: { producer_source_prefixes: ['arena-official', 'interaction-log'], learning_fact_fields: ['LearningFact.contextJson.knowledgeRevisionRef', 'LearningFact.contextJson.knowledgeRevisionRefs', 'LearningFact.contextJson.evidenceGovernance.knowledgeRevisionRef', 'LearningFact.contextJson.evidenceGovernance.knowledgeRevisionRefs'] } } as unknown as Registry;
      const drift = await validateLearningFactProducerContracts(root, sourceRegistry, evidence);
      expect(drift.map((item) => item.code)).toEqual(expectedCodes);
    } finally { await rm(root, { recursive: true }); }
  });

  it('rejects comments, unrelated helpers, transaction-external revision resolution and raw inserts as producer proof', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'writer-producer-bypass-'));
    try {
      await put(root, 'src/producer.ts', `
        async function unused() { /* sourceEventId arena: knowledgeRevisionRef */ await resolveActiveKnowledgeRevision(db); return db.$transaction(() => 1); }
        export async function persist(db: any, id: string) {
          const active = await resolveActiveKnowledgeRevision(db);
          return db.$transaction((tx: any) => tx.learningFact.create({ data: { sourceEventId: id, contextJson: { knowledgeRevisionRef: active.id } } }));
        }
        export async function raw(db: any) { return db.$executeRaw\`INSERT INTO "LearningFact" (id) VALUES ('x')\`; }
      `);
      await put(root, 'src/nested.ts', `export async function nested(db: any) { return db.user.update({ where: { id: 'u' }, data: { learningFacts: { create: { sourceEventId: 'arena:x' } } } }); }`);
      const contract = { knowledge_truth_revision_contract: { producer_source_prefixes: ['arena-official'], learning_fact_fields: ['LearningFact.contextJson.knowledgeRevisionRef'] } } as unknown as Registry;
      const evidence: WriterEvidence[] = [{
        path: 'src/producer.ts', mutations: [], dynamic_raw: false, targets: [], calls: [], imports: {},
        call_paths: [
          { symbols: ['src/producer.ts#persist', 'src/producer.ts#db.$transaction[callback:0]'], target: { model: 'LearningFact', operation: 'create', nested_relation: null } },
          { symbols: ['src/producer.ts#raw'], target: { model: 'LearningFact', operation: 'raw_insert', nested_relation: null } },
        ],
      }, { path: 'src/nested.ts', mutations: [], dynamic_raw: false, targets: [], calls: [], imports: {}, call_paths: [{ symbols: ['src/nested.ts#nested'], target: { model: 'LearningFact', operation: 'create', nested_relation: 'learningFacts' } }] }];
      const codes = (await validateLearningFactProducerContracts(root, contract, evidence)).map((item) => item.code);
      expect(codes).toContain('LEARNING_FACT_PRODUCER_ACTIVE_REVISION_UNRESOLVED');
      expect(codes).toContain('LEARNING_FACT_PRODUCER_SOURCE_ID_MISSING');
      expect(codes).toContain('LEARNING_FACT_PRODUCER_NON_ATOMIC');
    } finally { await rm(root, { recursive: true }); }
  });

  it('accepts an actual transaction callback call path into a helper that resolves and writes through the same tx', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'writer-producer-helper-'));
    try {
      await put(root, 'src/lib/data-governance/knowledge-truth-revision.ts', `export async function resolveActiveKnowledgeRevision(tx: any) { return { id: 'revision-1' }; } export function classifyLearningFactSource(id: string) { return \`arena-official:\${id}\`; }`);
      await put(root, 'src/producer.ts', `
        import { classifyLearningFactSource, resolveActiveKnowledgeRevision } from './lib/data-governance/knowledge-truth-revision';
        async function persist(tx: any, id: string) {
          const resolverClient = tx;
          const sinkClient = tx;
          const active = await resolveActiveKnowledgeRevision(resolverClient);
          const firstRevision = active.id;
          const secondRevision = firstRevision;
          return sinkClient.learningFact.create({ data: { sourceEventId: classifyLearningFactSource(id), contextJson: { knowledgeRevisionRef: firstRevision, evidenceGovernance: { knowledgeRevisionRef: secondRevision } } } });
        }
        export async function run(db: any, id: string) { return db.$transaction((tx: any) => { const callbackClient = tx; return persist(callbackClient, id); }); }
      `);
      const contract = { knowledge_truth_revision_contract: { producer_source_prefixes: ['arena-official'], learning_fact_fields: ['LearningFact.contextJson.knowledgeRevisionRef', 'LearningFact.contextJson.evidenceGovernance.knowledgeRevisionRef'] } } as unknown as Registry;
      const evidence: WriterEvidence[] = [{ path: 'src/producer.ts', mutations: [], dynamic_raw: false, targets: [], calls: [], imports: {}, call_paths: [{ symbols: ['src/producer.ts#run', 'src/producer.ts#db.$transaction[callback:0]', 'src/producer.ts#persist'], target: { model: 'LearningFact', operation: 'create', nested_relation: null } }] }];
      expect(await validateLearningFactProducerContracts(root, contract, evidence)).toEqual([]);
    } finally { await rm(root, { recursive: true }); }
  });

  it('discovers nested LearningFact relation creates and sends them through the producer gate', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'writer-nested-learning-fact-'));
    try {
      await put(root, 'prisma/schema.prisma', `
        datasource db { provider = "postgresql" url = env("DATABASE_URL") }
        generator client { provider = "prisma-client-js" }
        model Parent {
          id String @id
          facts LearningFact[]
        }
        model LearningFact {
          id String @id
          parentId String
          parent Parent @relation(fields: [parentId], references: [id])
        }
      `);
      await put(root, 'src/nested.ts', `
        export async function persist(db: any) { return db.parent.create({ data: { id: 'p', facts: { create: { id: 'f' } } } }); }
        export async function connect(db: any) { return db.parent.create({ data: { id: 'p2', facts: { connectOrCreate: { where: { id: 'f2' }, create: { id: 'f2' } } } } }); }
      `);
      const sourceRegistry = registry(['src/nested.ts']);
      sourceRegistry.knowledge_truth_revision_contract = { producer_source_prefixes: ['arena-official'], learning_fact_fields: ['LearningFact.contextJson.knowledgeRevisionRef'] };
      const result = await discoverWriters(root, sourceRegistry);
      expect(result.evidence[0]?.targets).toContainEqual({ model: 'LearningFact', operation: 'create', nested_relation: null });
      expect(result.evidence[0]?.targets).toContainEqual({ model: 'LearningFact', operation: 'connectOrCreate', nested_relation: null });
      expect(result.drift.map((item) => item.code)).toEqual(expect.arrayContaining([
        'LEARNING_FACT_PRODUCER_SOURCE_ID_MISSING',
        'LEARNING_FACT_PRODUCER_KNOWLEDGE_REVISION_MISSING',
        'LEARNING_FACT_PRODUCER_NON_ATOMIC',
      ]));
    } finally { await rm(root, { recursive: true }); }
  });

  it('rejects a same-named active revision resolver imported from the wrong module', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'writer-producer-wrong-resolver-'));
    try {
      await put(root, 'src/fake-revision.ts', `export async function resolveActiveKnowledgeRevision(tx: any) { return { id: 'forged' }; }`);
      await put(root, 'src/producer.ts', `
        import { resolveActiveKnowledgeRevision } from './fake-revision';
        export async function persist(db: any, id: string) { return db.$transaction(async (tx: any) => {
          const active = await resolveActiveKnowledgeRevision(tx);
          return tx.learningFact.create({ data: { sourceEventId: \`arena-official:\${id}\`, contextJson: { knowledgeRevisionRef: active.id } } });
        }); }
      `);
      const contract = { knowledge_truth_revision_contract: { producer_source_prefixes: ['arena-official'], learning_fact_fields: ['LearningFact.contextJson.knowledgeRevisionRef'] } } as unknown as Registry;
      const evidence: WriterEvidence[] = [{ path: 'src/producer.ts', mutations: [], dynamic_raw: false, targets: [], calls: [], imports: {}, call_paths: [{ symbols: ['src/producer.ts#persist', 'src/producer.ts#db.$transaction[callback:0]'], target: { model: 'LearningFact', operation: 'create', nested_relation: null } }] }];
      expect((await validateLearningFactProducerContracts(root, contract, evidence)).map((item) => item.code)).toEqual(['LEARNING_FACT_PRODUCER_ACTIVE_REVISION_UNRESOLVED']);
    } finally { await rm(root, { recursive: true }); }
  });

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
