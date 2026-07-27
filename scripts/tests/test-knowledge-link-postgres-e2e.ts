import 'dotenv/config';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { Client } from 'pg';

import {
  buildRuntimeKnowledgeRelationInspectionItems,
  inspectRuntimeKnowledgeRelationCoverage,
} from '../../src/lib/knowledge-graph-relation-runtime';

const root = process.cwd();
const sourceUrl = process.env.DATABASE_URL;
const databaseRequired = process.env.KNOWLEDGE_POSTGRES_E2E_REQUIRED === '1';
if (!sourceUrl) {
  if (databaseRequired) throw new Error('DATABASE_URL is required for the PostgreSQL knowledge gate.');
  console.log('knowledge link isolated PostgreSQL E2E skipped: DATABASE_URL is unavailable');
  process.exit(0);
}

const databaseName = `act_knowledge_e2e_${process.pid}_${Date.now()}`;
let adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
let testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-link-e2e-'));
const graphRoot = path.join(tempRoot, 'graph');
const nodesPath = path.join(graphRoot, 'nodes.json');
const relationsPath = path.join(graphRoot, 'relations.jsonl');
const auditInputPath = path.join(tempRoot, 'knowledge-relation-coverage-audit.json');
fs.mkdirSync(graphRoot, { recursive: true });

const auditNodeRows = [
  { id: 'audit-source', name: 'Audit Source', nodeType: 'THEORY', description: 'Audit source', metadata: {} },
  { id: 'audit-target', name: 'Audit Target', nodeType: 'THEORY', description: 'Audit target', metadata: {} },
];
const auditRelationRows = [
  {
    id: 'audit-order', source_id: 'audit-source', target_id: 'audit-target', relation_type: 'leads_to',
    strength: 1, sourceDocument: 'isolated-postgres-e2e.md',
  },
  {
    id: 'audit-association', source_id: 'audit-source', target_id: 'audit-target', relation_type: 'supports',
    strength: 0.7, rationale: 'isolated association density fixture',
  },
];
const auditRelationIds = new Set(auditRelationRows.map((row) => row.id));
fs.writeFileSync(auditInputPath, JSON.stringify({
  schemaVersion: 1,
  orderSource: { relationIds: ['audit-order'] },
  density: { selectedNodeId: 'audit-source', visibleAssociationRelationIds: ['audit-association'] },
  provenance: [{
    relationId: 'audit-order', sourceId: 'audit-source', targetId: 'audit-target', canonicalType: 'leads_to',
  }],
  overlayTripleEligibility: [{
    relationId: 'audit-order', sourceId: 'audit-source', targetId: 'audit-target', normalizedType: 'leads_to',
  }],
}));

const cleanChildEnv = (extra: Record<string, string>) => {
  const env = { ...process.env, ...extra };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[key];
  return env;
};

function run(command: string, args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(command, args, {
    cwd: root,
    env: cleanChildEnv(extraEnv),
    encoding: 'utf8',
  });
}

function writeNodes(name = 'Node A') {
  writeNodeRows([
    { id: 'node-a', name, nodeType: 'THEORY', description: 'A', metadata: {} },
    { id: 'node-b', name: 'Node B', nodeType: 'THEORY', description: 'B', metadata: {} },
  ]);
}

function writeNodeRows(rows: unknown[]) {
  fs.writeFileSync(nodesPath, JSON.stringify([...rows, ...auditNodeRows]));
}

const relationRows = [
  {
    id: 'relation-applies', source_id: 'node-a', target_id: 'node-b', relation_type: 'applies_to',
    strength: 0.9, sourceDocument: '文档',
  },
  {
    id: 'relation-supports', source_id: 'node-a', target_id: 'node-b', relation_type: 'supports',
    strength: 0.8, rationale: '依据', source_chapter: 2, target_chapter: 3,
  },
];

function writeRelations(rows: unknown[]) {
  const relations = rows.length > 0 ? [...rows, ...auditRelationRows] : rows;
  fs.writeFileSync(relationsPath, `${relations.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function seed() {
  return run(process.execPath, ['scripts/db/seed-all-knowledge.mjs'], {
    DATABASE_URL: testUrl.toString(),
    KNOWLEDGE_RUNTIME_ROOT: tempRoot,
    KNOWLEDGE_RELATION_AUDIT_INPUT: auditInputPath,
  });
}

function productionFallbackProbe(expectedCode?: string) {
  return run(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'run', 'src/lib/__tests__/knowledge-db-fallback-production.test.ts',
  ], {
    DATABASE_URL: testUrl.toString(),
    KNOWLEDGE_DB_FALLBACK_PROBE: '1',
    KNOWLEDGE_DB_FALLBACK_AUDIT_SCAFFOLD: '1',
    KNOWLEDGE_EXPECTED_RUNTIME_ROOT: tempRoot,
    KNOWLEDGE_RUNTIME_ROOT: path.join(tempRoot, 'unavailable-runtime'),
    ...(expectedCode ? { KNOWLEDGE_DB_FALLBACK_EXPECT_422: expectedCode } : {}),
  });
}

function productionConcurrencyProbe() {
  return run(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'run', 'src/lib/__tests__/knowledge-db-fallback-production.test.ts',
  ], {
    DATABASE_URL: testUrl.toString(),
    KNOWLEDGE_DB_FALLBACK_PROBE: '1',
    KNOWLEDGE_DB_FALLBACK_AUDIT_SCAFFOLD: '1',
    KNOWLEDGE_DB_CONCURRENCY_PROBE: '1',
    KNOWLEDGE_EXPECTED_RUNTIME_ROOT: tempRoot,
    KNOWLEDGE_RUNTIME_ROOT: path.join(tempRoot, 'unavailable-runtime'),
  });
}

function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function main() {
 let admin = new Client({ connectionString: adminUrl.toString() });
 let db: Client | null = null;
 let ephemeralPgCtl: string | null = null;
 let ephemeralDataDir: string | null = null;

try {
  try {
    await admin.connect();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      if (databaseRequired) throw new Error(`PostgreSQL is required but unavailable: ${code}`);
      console.log(`knowledge link isolated PostgreSQL E2E skipped: ${code}`);
      process.exit(0);
    }
    throw error;
  }
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    if ((error as { code?: string }).code !== '42501') throw error;
    await admin.end();
    const bindir = run('pg_config', ['--bindir']);
    assert.equal(bindir.status, 0, bindir.stderr || bindir.stdout);
    const postgresBin = bindir.stdout.trim();
    const initdb = path.join(postgresBin, 'initdb');
    ephemeralPgCtl = path.join(postgresBin, 'pg_ctl');
    ephemeralDataDir = path.join(tempRoot, 'postgres-data');
    const initialized = run(initdb, ['-D', ephemeralDataDir, '--auth=trust', '--username=postgres', '--no-locale']);
    assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
    const port = await availablePort();
    const started = run(ephemeralPgCtl, [
      '-D', ephemeralDataDir,
      '-l', path.join(tempRoot, 'postgres.log'),
      '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start',
    ]);
    assert.equal(started.status, 0, started.stderr || started.stdout);
    adminUrl = new URL(`postgresql://postgres@127.0.0.1:${port}/postgres`);
    testUrl = new URL(`postgresql://postgres@127.0.0.1:${port}/${databaseName}`);
    admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  }

  const priorPrismaRoot = path.join(tempRoot, 'prisma-before-relation-migration');
  const priorMigrationsRoot = path.join(priorPrismaRoot, 'migrations');
  fs.mkdirSync(priorMigrationsRoot, { recursive: true });
  fs.copyFileSync(path.join(root, 'prisma', 'schema.prisma'), path.join(priorPrismaRoot, 'schema.prisma'));
  fs.copyFileSync(path.join(root, 'prisma', 'migrations', 'migration_lock.toml'), path.join(priorMigrationsRoot, 'migration_lock.toml'));
  for (const entry of fs.readdirSync(path.join(root, 'prisma', 'migrations'), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name >= '20260714150000_preserve_knowledge_link_relations') continue;
    fs.cpSync(path.join(root, 'prisma', 'migrations', entry.name), path.join(priorMigrationsRoot, entry.name), { recursive: true });
  }
  const migratePrior = run(process.execPath, [
    'node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', path.join(priorPrismaRoot, 'schema.prisma'),
  ], { DATABASE_URL: testUrl.toString() });
  assert.equal(migratePrior.status, 0, migratePrior.stderr || migratePrior.stdout);

  db = new Client({ connectionString: testUrl.toString() });
  await db.connect();
  await db.query(`
    INSERT INTO "KnowledgeNode" ("id", "name", "nodeType", "description", "metadata", "tags") VALUES
      ('node-a', 'Node A legacy', 'THEORY', 'A', '{"source":"course-content/runtime/knowledge/graph/nodes.json"}', '{}'),
      ('node-b', 'Node B legacy', 'THEORY', 'B', '{"source":"course-content/runtime/knowledge/graph/nodes.json"}', '{}'),
      ('external-a', 'External A', 'THEORY', 'EA', '{}', '{}'),
      ('external-b', 'External B', 'THEORY', 'EB', '{}', '{}');
    INSERT INTO "KnowledgeLink" ("id", "sourceId", "targetId", "relation") VALUES
      ('relation-applies', 'node-a', 'node-b', 'applies_to'),
      ('external-owned', 'external-a', 'external-b', 'related'),
      ('mixed-owned', 'node-a', 'external-a', 'related');
  `);

  const migrate = run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    DATABASE_URL: testUrl.toString(),
  });
  assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
  const preSeedOwnership = (await db.query(`SELECT "metadata" FROM "KnowledgeLink"`)).rows;
  assert.equal(preSeedOwnership.every((row) => Object.keys(row.metadata).length === 0), true);
  writeNodes();
  writeRelations(relationRows);

  const firstSeed = seed();
  assert.equal(firstSeed.status, 0, firstSeed.stderr || firstSeed.stdout);
  const firstRows = (await db.query(`
    SELECT "id", "sourceId", "targetId", "relation", "strength", "metadata"
    FROM "KnowledgeLink" ORDER BY "id" ASC
  `)).rows;
  const allRuntimeRows = firstRows.filter((row) => (
    row.metadata.runtimeSource === 'course-content/runtime/knowledge/graph/relations.jsonl'
  ));
  const runtimeRows = allRuntimeRows.filter((row) => !auditRelationIds.has(row.id));
  assert.equal(runtimeRows.length, 2);
  assert.equal(runtimeRows.every((row) => row.sourceId === 'node-a' && row.targetId === 'node-b'), true);
  assert.equal(runtimeRows[1].metadata.rationale, '依据');
  assert.equal(runtimeRows[1].metadata.source_chapter, 2);
  assert.equal(firstRows.find((row) => row.id === 'external-owned').metadata.runtimeSource, undefined);
  assert.equal(firstRows.find((row) => row.id === 'mixed-owned').metadata.runtimeSource, undefined);

  const fingerprintSql = `SELECT md5(string_agg(concat_ws(chr(31), "id", "sourceId", "targetId", "relation", "strength", "metadata"::text), chr(30) ORDER BY "id")) AS hash FROM "KnowledgeLink" WHERE "metadata"->>'runtimeSource' = 'course-content/runtime/knowledge/graph/relations.jsonl'`;
  const firstHash = (await db.query(fingerprintSql)).rows[0].hash;
  const secondSeed = seed();
  assert.equal(secondSeed.status, 0, secondSeed.stderr || secondSeed.stdout);
  assert.equal((await db.query(fingerprintSql)).rows[0].hash, firstHash);
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM "KnowledgeLink" WHERE "id" = 'external-owned'`)).rows[0].count, 1);
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM "KnowledgeLink" WHERE "id" = 'mixed-owned'`)).rows[0].count, 1);
  const downgradeDuplicates = await db.query(`
    SELECT "sourceId", "targetId"
    FROM "KnowledgeLink"
    GROUP BY "sourceId", "targetId"
    HAVING count(*) > 1
  `);
  assert.equal(downgradeDuplicates.rowCount! > 0, true);
  const beforeDowngradeAttempt = (await db.query(`
    SELECT md5(string_agg(row_to_json(link)::text, chr(30) ORDER BY "id")) AS hash
    FROM "KnowledgeLink" AS link
  `)).rows[0].hash;
  let downgradeErrorCode: string | undefined;
  try {
    await db.query(`CREATE UNIQUE INDEX "KnowledgeLink_sourceId_targetId_key" ON "KnowledgeLink"("sourceId", "targetId")`);
  } catch (error) {
    downgradeErrorCode = (error as { code?: string }).code;
  }
  assert.equal(downgradeErrorCode, '23505');
  assert.equal((await db.query(`SELECT to_regclass('"KnowledgeLink_sourceId_targetId_key"') AS index`)).rows[0].index, null);
  assert.equal((await db.query(`
    SELECT md5(string_agg(row_to_json(link)::text, chr(30) ORDER BY "id")) AS hash
    FROM "KnowledgeLink" AS link
  `)).rows[0].hash, beforeDowngradeAttempt);

  const productionProbe = productionFallbackProbe();
  assert.equal(productionProbe.status, 0, productionProbe.stderr || productionProbe.stdout);

  await db.query(`UPDATE "KnowledgeNode" SET "isActive" = false WHERE "id" = 'node-b'`);
  const inactiveEndpointProbe = productionFallbackProbe('UNRESOLVED_RELATION_ENDPOINT');
  assert.equal(inactiveEndpointProbe.status, 0, inactiveEndpointProbe.stderr || inactiveEndpointProbe.stdout);
  await db.query(`UPDATE "KnowledgeNode" SET "isActive" = true WHERE "id" = 'node-b'`);

  await db.query(`UPDATE "KnowledgeLink" SET "metadata" = jsonb_set("metadata", '{runtimeSource}', '"course-content/runtime/knowledge/graph/relations.jsonl"') WHERE "id" = 'mixed-owned'`);
  const externalEndpointProbe = productionFallbackProbe('UNRESOLVED_RELATION_ENDPOINT');
  assert.equal(externalEndpointProbe.status, 0, externalEndpointProbe.stderr || externalEndpointProbe.stdout);
  await db.query(`UPDATE "KnowledgeLink" SET "metadata" = "metadata" - 'runtimeSource' WHERE "id" = 'mixed-owned'`);

  const concurrencyProbe = productionConcurrencyProbe();
  assert.equal(concurrencyProbe.status, 0, concurrencyProbe.stderr || concurrencyProbe.stdout);
  assert.equal(seed().status, 0);

  await db.query(`UPDATE "KnowledgeLink" SET "relation" = 'unknown-db-type' WHERE "id" = 'relation-supports'`);
  const unknownProbe = productionFallbackProbe('UNKNOWN_RELATION_TYPE');
  assert.equal(unknownProbe.status, 0, unknownProbe.stderr || unknownProbe.stdout);
  await db.query(`
    UPDATE "KnowledgeLink" SET "relation" = 'contains' WHERE "id" = 'relation-supports';
    UPDATE "KnowledgeLink" SET "relation" = 'contains', "sourceId" = 'node-b', "targetId" = 'node-a' WHERE "id" = 'relation-applies';
  `);
  const reverseProbe = productionFallbackProbe('REVERSE_CHILD_RELATION');
  assert.equal(reverseProbe.status, 0, reverseProbe.stderr || reverseProbe.stdout);
  await db.query(`
    UPDATE "KnowledgeLink" SET "relation" = 'supports', "sourceId" = 'node-a', "targetId" = 'node-b' WHERE "id" = 'relation-supports';
    UPDATE "KnowledgeLink" SET "relation" = 'applies_to', "sourceId" = 'node-a', "targetId" = 'node-b' WHERE "id" = 'relation-applies';
    UPDATE "KnowledgeLink" SET "metadata" = "metadata" - 'runtimeSource'
    WHERE "metadata"->>'runtimeSource' = 'course-content/runtime/knowledge/graph/relations.jsonl';
  `);
  const emptyProbe = productionFallbackProbe('EMPTY_RUNTIME_RELATIONS');
  assert.equal(emptyProbe.status, 0, emptyProbe.stderr || emptyProbe.stdout);
  assert.equal(seed().status, 0);

  const indexes = (await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'KnowledgeLink'`)).rows.map((row) => row.indexname);
  assert.equal(indexes.includes('KnowledgeLink_sourceId_idx'), true);
  assert.equal(indexes.includes('KnowledgeLink_targetId_idx'), true);
  const foreignKeys = Number((await db.query(`SELECT count(*)::int AS count FROM pg_constraint WHERE conrelid = '"KnowledgeLink"'::regclass AND contype = 'f'`)).rows[0].count);
  assert.equal(foreignKeys, 2);

  const fileContent = fs.readFileSync(relationsPath, 'utf8');
  const fixtureNodeIds = new Set(['node-a', 'node-b', 'audit-source', 'audit-target']);
  const fileRuntime = inspectRuntimeKnowledgeRelationCoverage(fileContent, { nodeIds: fixtureNodeIds });
  const dbContent = `${allRuntimeRows.map((row) => JSON.stringify({
    ...row.metadata,
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
    type: row.relation,
    strength: row.strength,
  })).join('\n')}\n`;
  const dbRuntime = inspectRuntimeKnowledgeRelationCoverage(dbContent, { nodeIds: fixtureNodeIds });
  assert.deepEqual(
    dbRuntime.projection.visualEdges.map((edge) => edge.key).filter((key) => !key.includes('audit-')),
    fileRuntime.projection.visualEdges.map((edge) => edge.key).filter((key) => !key.includes('audit-')),
  );
  const nodeMap = new Map([
    ['node-a', { id: 'node-a', name: 'Node A', nodeType: 'THEORY' }],
    ['node-b', { id: 'node-b', name: 'Node B', nodeType: 'THEORY' }],
  ]);
  const fileDetail = buildRuntimeKnowledgeRelationInspectionItems(fileRuntime.inspectionLinks, nodeMap, 'node-a');
  const dbDetail = buildRuntimeKnowledgeRelationInspectionItems(dbRuntime.inspectionLinks, nodeMap, 'node-a');
  assert.deepEqual(dbDetail, fileDetail);

  writeRelations([relationRows[1]]);
  assert.equal(seed().status, 0);
  assert.deepEqual(
    (await db.query(`SELECT "id" FROM "KnowledgeLink" WHERE "metadata"->>'runtimeSource' = 'course-content/runtime/knowledge/graph/relations.jsonl' ORDER BY "id"`)).rows
      .filter((row) => !auditRelationIds.has(row.id)),
    [{ id: 'relation-supports' }],
  );

  const beforeInvalid = (await db.query(`SELECT count(*)::int AS count FROM "KnowledgeLink"`)).rows[0].count;
  const invalidRelationSets = [
    [],
    [{ id: 'missing-type', source_id: 'node-a', target_id: 'node-b' }],
    [{ id: 'empty-type', source_id: 'node-a', target_id: 'node-b', relation_type: '' }],
    [{ id: 'whitespace-type', source_id: 'node-a', target_id: 'node-b', relation_type: ' related ' }],
    [{ id: 'unknown-type', source_id: 'node-a', target_id: 'node-b', relation_type: 'unknown-type' }],
    [{ id: ' whitespace-id ', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' }],
    [{ id: 'whitespace-endpoint', source_id: ' node-a ', target_id: 'node-b', relation_type: 'related' }],
    [{ id: 'conflict-a', relation_id: 'conflict-b', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' }],
    [{ id: 'unknown-endpoint', source_id: 'missing', target_id: 'node-b', relation_type: 'related' }],
    [
      { id: 'duplicate', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' },
      { id: 'duplicate', source_id: 'node-b', target_id: 'node-a', relation_type: 'related' },
    ],
    [
      { id: 'child-forward', source_id: 'node-a', target_id: 'node-b', relation_type: 'contains' },
      { id: 'child-reverse', source_id: 'node-b', target_id: 'node-a', relation_type: 'contains' },
    ],
  ];
  for (const invalidRelations of invalidRelationSets) {
    writeRelations(invalidRelations);
    const invalidSeed = seed();
    assert.notEqual(invalidSeed.status, 0);
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM "KnowledgeLink"`)).rows[0].count, beforeInvalid);
    assert.equal((await db.query(`SELECT "name" FROM "KnowledgeNode" WHERE "id" = 'node-a'`)).rows[0].name, 'Node A');
  }

  writeRelations([relationRows[1]]);
  const invalidNodeSets = [
    [
      { id: '', name: 'Blank', nodeType: 'THEORY', description: 'blank' },
      { id: 'node-b', name: 'Node B', nodeType: 'THEORY', description: 'B' },
    ],
    [
      { id: 'node-a', name: 'Node A', nodeType: 'THEORY', description: 'A' },
      { id: 'node-a', name: 'Duplicate', nodeType: 'THEORY', description: 'duplicate' },
      { id: 'node-b', name: 'Node B', nodeType: 'THEORY', description: 'B' },
    ],
    [
      { id: `node-${'x'.repeat(201)}`, name: 'Long', nodeType: 'THEORY', description: 'long' },
      { id: 'node-a', name: 'Node A', nodeType: 'THEORY', description: 'A' },
      { id: 'node-b', name: 'Node B', nodeType: 'THEORY', description: 'B' },
    ],
  ];
  for (const invalidNodes of invalidNodeSets) {
    writeNodeRows(invalidNodes);
    const invalidSeed = seed();
    assert.notEqual(invalidSeed.status, 0);
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM "KnowledgeLink"`)).rows[0].count, beforeInvalid);
    assert.equal((await db.query(`SELECT "name" FROM "KnowledgeNode" WHERE "id" = 'node-a'`)).rows[0].name, 'Node A');
  }

  await db.query(`
    CREATE FUNCTION fail_knowledge_seed() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id = 'z-force-fail' THEN RAISE EXCEPTION 'forced seed rollback'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER fail_knowledge_seed_trigger BEFORE INSERT OR UPDATE ON "KnowledgeLink"
    FOR EACH ROW EXECUTE FUNCTION fail_knowledge_seed();
  `);
  writeNodes('Changed Name Must Roll Back');
  writeRelations([
    relationRows[1],
    { id: 'z-force-fail', source_id: 'node-a', target_id: 'node-b', relation_type: 'related' },
  ]);
  const rollbackSeed = seed();
  assert.notEqual(rollbackSeed.status, 0);
  assert.equal((await db.query(`SELECT "name" FROM "KnowledgeNode" WHERE "id" = 'node-a'`)).rows[0].name, 'Node A');
  assert.deepEqual(
    (await db.query(`SELECT "id" FROM "KnowledgeLink" WHERE "metadata"->>'runtimeSource' = 'course-content/runtime/knowledge/graph/relations.jsonl' ORDER BY "id"`)).rows
      .filter((row) => !auditRelationIds.has(row.id)),
    [{ id: 'relation-supports' }],
  );

  console.log('knowledge link isolated PostgreSQL E2E passed');
} finally {
  if (db) await db.end().catch(() => {});
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]).catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  await admin.end().catch(() => {});
  if (ephemeralPgCtl && ephemeralDataDir) {
    run(ephemeralPgCtl, ['-D', ephemeralDataDir, '-m', 'fast', '-w', 'stop']);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
}

void main();
