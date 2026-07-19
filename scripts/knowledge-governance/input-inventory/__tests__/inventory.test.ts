import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, compareCodePoints, normalizePath, normalizeText, taggedDigest } from '../normalize';
import { loadImmutableExport, validateDatabaseClosure } from '../database-snapshot';
import { discoverWriters, discoverWritersInSource } from '../writer-discovery';
import { validateOutputPrivacy } from '../schema-validation';
import { sourceFingerprints } from '../manifest';
import { enumerateRepository, loadRegistry, matchGlob, type Registry } from '../registry';
import type { Json } from '../types';
import { effectiveDecoderContract, validateFixtureClosure, validateSyntheticPayload, type ShapeFixture } from '../decoder-validation';
import { makeAnchor, typedDedupe } from '../records';
import { auditIdBearingPaths, selectJson } from '../json-selector';

const root = path.resolve(import.meta.dirname, '../../../..');

describe('normalization contract', () => {
  it('normalizes NFC and LF, rejects BOM, and sorts by Unicode code point', () => {
    expect(normalizeText(Buffer.from('e\u0301\r\n'))).toBe('é\n');
    expect(() => normalizeText(Buffer.from('\ufefftext'))).toThrow(/BOM/u);
    expect(['😀', '中', 'a'].sort(compareCodePoints)).toEqual(['a', '中', '😀']);
    expect(() => normalizePath('../escape')).toThrow(/escaping/u);
    expect(taggedDigest('a', 'bc')).not.toBe(taggedDigest('ab', 'c'));
  });

  it('keeps equal IDs in separate namespaces and detects same-type collisions', () => {
    const base = { item_kind: 'reference', source_id: 'same', source_locator: 'fixture' };
    const result = typedDedupe([
      { ...base, identity_namespace: 'canonical_knowledge_node' },
      { ...base, identity_namespace: 'resource_node_ref' },
      { ...base, identity_namespace: 'canonical_knowledge_node', source_locator: 'different' },
    ]);
    expect(result.records).toHaveLength(2);
    expect(result.drift).toEqual([expect.objectContaining({ code: 'TYPED_RECORD_COLLISION' })]);
  });

  it('covers nullable course/module/lesson anchors without synthetic hierarchy IDs', () => {
    const text_digest = taggedDigest('text/v1', 'objective');
    expect(makeAnchor({ anchor_scope: 'course', anchor_type: 'formal_objective', course_id: 'course', module_id: null, lesson_id: null, source_locator: 'fixture#1', text_digest }).module_id).toBeNull();
    expect(makeAnchor({ anchor_scope: 'module', anchor_type: 'necessary_prerequisite', course_id: 'course', module_id: 'm1', lesson_id: null, source_locator: 'fixture#2', text_digest }).lesson_id).toBeNull();
    expect(makeAnchor({ anchor_scope: 'lesson', anchor_type: 'explicit_extension', course_id: 'course', module_id: 'm1', lesson_id: 'l1', source_locator: 'fixture#3', text_digest }).lesson_id).toBe('l1');
    expect(() => makeAnchor({ anchor_scope: 'course', anchor_type: 'formal_objective', course_id: 'course', module_id: 'synthetic', lesson_id: null, source_locator: 'fixture', text_digest })).toThrow();
  });

  it('treats bracketed route segments literally, not as globs', () => {
    expect(matchGlob('src/app/[id]/route.ts', 'src/app/[id]/route.ts')).toBe(true);
    expect(matchGlob('src/app/i/route.ts', 'src/app/[id]/route.ts')).toBe(false);
  });

  it('emits canonical byte-identical JSON', () => {
    const first = canonicalJson({ é: 'e\u0301', a: 1 } as Json);
    const second = canonicalJson({ a: 1, 'e\u0301': 'é' } as Json);
    expect(first).toBe(second);
  });
});

describe('writer AST discovery', () => {
  it('covers delegate alias, transaction, createManyAndReturn, nested writes and external/dynamic raw', () => {
    const source = `
      const node = prisma.knowledgeNode;
      await node.createManyAndReturn({ data: [{ links: { create: [] } }] });
      await prisma.$transaction(async (tx) => tx.learningFact.create({ data: input }));
      const { knowledgeLink: links } = tx;
      await links.upsert({ where: key, create: data, update: data });
      await prisma.$executeRaw(sqlFromOutside);
    `;
    const result = discoverWritersInSource('external/writer.ts', source)!;
    expect(result.mutations).toEqual(expect.arrayContaining(['knowledgeNode.createManyAndReturn', 'learningFact.create', 'knowledgeLink.upsert', 'nested.links', 'raw.$executeRaw']));
    expect(result.dynamic_raw).toBe(true);
  });

  it('propagates a target mutation through an imported producer helper chain', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-writers-'));
    try {
      await mkdir(path.join(directory, 'src'), { recursive: true });
      await writeFile(path.join(directory, 'src/helper.ts'), 'export async function persist() { return prisma.learningFact.create({ data: input }); }');
      await writeFile(path.join(directory, 'src/route.ts'), "import { persist } from './helper'; export async function POST() { return persist(); }");
      const registry = { repository_sources: [{ id: 'knowledge-direct-writers', include: ['src/helper.ts', 'src/route.ts'], static_discovery: { roots: ['src'], exclude: [], prisma_mutations: ['LearningFact'] } }] } as unknown as Registry;
      const result = await discoverWriters(directory, registry);
      expect(result.evidence.find((item) => item.path === 'src/route.ts')?.mutations).toEqual(['producer:src/helper.ts']);
      expect(result.drift).toEqual([]);
    } finally { await rm(directory, { recursive: true }); }
  });
});

describe('filesystem closure', () => {
  it('reports allowlisted symlinks instead of silently skipping them', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-symlink-'));
    try {
      await writeFile(path.join(directory, 'target.md'), '# target');
      await symlink('target.md', path.join(directory, 'linked.md'));
      const registry = { repository_sources: [{ id: 'source', item_kind: 'doc', identity_namespace: 'repository_path', include: ['*.md'], missing: 'fail' }], instructional_source_role_matrix: {} } as unknown as Registry;
      const drift: never[] = [];
      await enumerateRepository(directory, registry, drift);
      expect(drift).toEqual([expect.objectContaining({ code: 'SYMLINK_INPUT_REJECTED', scope: 'linked.md' })]);
    } finally { await rm(directory, { recursive: true }); }
  });
});

describe('immutable database privacy boundary', () => {
  it('derives snapshot id from proof and suppresses 1-4 person cells', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-export-'));
    try {
      const datasets = [{ id: 'learner', table: 'Snapshot', count: 9, watermark: '2026-01-01T00:00:00Z', shape: ['version', 'watermark'], versions: ['v1'], dispositions: { preserved: 4, recomputed: 5 } }];
      const exportDigest = taggedDigest('immutable-database-export/v1', canonicalJson({ datasets } as unknown as Json));
      const proof = { profile: 'immutable_export', export_object_id: 'object-1', generated_at: '2026-01-01T00:00:00.000Z', export_digest: exportDigest };
      await writeFile(path.join(directory, 'export.json'), canonicalJson({ datasets } as unknown as Json));
      await writeFile(path.join(directory, 'proof.json'), canonicalJson(proof as unknown as Json));
      const drift: never[] = [];
      const snapshot = await loadImmutableExport(directory, 'export.json', 'proof.json', drift);
      expect(snapshot.snapshot_id).toMatch(/^sha256:/u);
      expect(snapshot.datasets[0]!.dispositions).toEqual({ preserved: 'suppressed', recomputed: 5 });
      expect(drift).toEqual([]);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('rejects rows, users, payloads and row digests recursively', () => {
    expect(validateOutputPrivacy({ safe: { payload: 'secret' } } as Json)).toEqual([expect.objectContaining({ code: 'PROHIBITED_OUTPUT_FIELD' })]);
  });

  it('rejects caller-embedded proof and inconsistent external object metadata', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-proof-reject-'));
    try {
      const datasets: unknown[] = [];
      const proof = { profile: 'immutable_export', export_object_id: 'external-object', generated_at: '2026-01-01T00:00:00.000Z', export_digest: taggedDigest('immutable-database-export/v1', 'different') };
      await writeFile(path.join(directory, 'proof.json'), canonicalJson(proof as unknown as Json));
      await writeFile(path.join(directory, 'embedded.json'), canonicalJson({ proof, datasets } as unknown as Json));
      await writeFile(path.join(directory, 'export.json'), canonicalJson({ datasets } as unknown as Json));
      await expect(loadImmutableExport(directory, 'embedded.json', 'proof.json', [])).rejects.toThrow(/embedded/u);
      await expect(loadImmutableExport(directory, 'export.json', 'proof.json', [])).rejects.toThrow(/digest mismatch/u);
    } finally { await rm(directory, { recursive: true }); }
  });

  it.each(['unique_semantic_name', 'domain_membership', 'relation_approval', 'resource_binding_approval', 'user_id', 'payload', 'raw_row_digest'])(`rejects prohibited output key %s`, (key) => {
    expect(validateOutputPrivacy({ nested: { [key]: 'forbidden' } } as Json)).toEqual([expect.objectContaining({ code: 'PROHIBITED_OUTPUT_FIELD' })]);
  });

  it('proves the full declared database table/field closure from one immutable export', async () => {
    const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    const tableFields = new Map<string, Set<string>>();
    for (const source of registry.database_sources) for (const [table, fields] of Object.entries(source.fields as Record<string, string[]>)) {
      const current = tableFields.get(table) ?? new Set<string>();
      fields.forEach((field) => current.add(field));
      tableFields.set(table, current);
    }
    const datasets = [...tableFields].map(([table, fields]) => ({ id: `synthetic-${table}`, table, count: 5, watermark: null, shape: [...fields], versions: ['synthetic-v1'] }));
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-full-export-'));
    try {
      const export_digest = taggedDigest('immutable-database-export/v1', canonicalJson({ datasets } as unknown as Json));
      const proof = { profile: 'immutable_export', export_object_id: 'full-object', generated_at: '2026-01-01T00:00:00.000Z', export_digest };
      await writeFile(path.join(directory, 'export.json'), canonicalJson({ datasets } as unknown as Json));
      await writeFile(path.join(directory, 'proof.json'), canonicalJson(proof as unknown as Json));
      const drift: never[] = [];
      const snapshot = await loadImmutableExport(directory, 'export.json', 'proof.json', drift);
      expect(validateDatabaseClosure(snapshot, registry)).toEqual([]);
    } finally { await rm(directory, { recursive: true }); }
  });
});

describe('closed decoder fixtures', () => {
  it('covers every decoder and fails closed on unknown version, discriminator and ID-bearing field', async () => {
    const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    const file = JSON.parse(await readFile(path.join(root, 'scripts/knowledge-governance/input-inventory/fixtures/synthetic-history-payload-shapes.json'), 'utf8')) as { fixtures: ShapeFixture[] };
    expect(validateFixtureClosure(Object.keys(registry.decoder_contracts), file.fixtures)).toEqual([]);
    const fixture = file.fixtures.find((item) => item.decoder_id === 'learning-event-payload/v1')!;
    const contract = effectiveDecoderContract(registry, fixture.decoder_id);
    expect(validateSyntheticPayload(contract, fixture, { schemaVersion: 'v999', targetType: 'new-kind', secretNodeId: 'x' })).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNKNOWN_PAYLOAD_VERSION' }),
      expect.objectContaining({ code: 'UNKNOWN_DISCRIMINATOR' }),
      expect.objectContaining({ code: 'UNKNOWN_ID_BEARING_PATH' }),
    ]));
    for (const item of file.fixtures) {
      expect(item.accepted_versions.length).toBeGreaterThan(0);
      expect(item.samples.length).toBeGreaterThan(0);
      expect((registry.decoder_contracts[item.decoder_id]!.selectors as string[] | undefined)?.length
        ?? (registry.decoder_contracts[item.decoder_id]!.reference_selectors as string[] | undefined)?.length
        ?? Number(Boolean(registry.decoder_contracts[item.decoder_id]!.item_decoder))).toBeTruthy();
    }
  });

  it('matches complete selector paths through arrays/wildcards and rejects unknown nested IDs', () => {
    const payload = { events: [{ payload: { evidenceGovernance: { knowledgeNodeIds: ['n1'] } }, totallyUnknown: { nodeId: 'n2' } }] } as Json;
    expect(selectJson(payload, '$.events[*].payload.evidenceGovernance.knowledgeNodeIds[*]')).toEqual([{ path: '$.events[0].payload.evidenceGovernance.knowledgeNodeIds[0]', value: 'n1' }]);
    expect(auditIdBearingPaths(payload, ['$.events[*].payload.evidenceGovernance.knowledgeNodeIds[*]'], 'nested')).toEqual([expect.objectContaining({ code: 'UNKNOWN_ID_BEARING_PATH', observed: '$.events[0].totallyUnknown.nodeId' })]);
  });
});

describe('registry and real repository fixed integration', () => {
  it('has the complete declared contract cardinalities without freezing snapshot counts', async () => {
    const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    expect(registry.repository_sources).toHaveLength(14);
    expect(registry.database_sources).toHaveLength(9);
    expect(Object.keys(registry.decoder_contracts)).toHaveLength(16);
    expect(registry.field_decoders).toHaveLength(41);
    expect(registry.closed_namespaces).toHaveLength(45);
    expect(registry.repository_sources.find((source) => source.id === 'knowledge-direct-writers')?.include).toHaveLength(45);
    const expected = JSON.parse(await readFile(path.join(root, 'scripts/knowledge-governance/input-inventory/fixtures/real-repository-structure.json'), 'utf8')) as { registry_contract: Record<string, number> };
    expect(expected.registry_contract).toEqual({ repository_sources: 14, database_sources: 9, decoder_contracts: 16, field_decoders: 41, namespaces: 45, declared_writer_paths: 45 });
  });

  it('is repeatable for a fixed real repository snapshot and preserves inventoried inputs', async () => {
    const registryBefore = await readFile(path.join(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml'));
    const gitBefore = await readFile(path.join(root, '.git'));
    const args = ['--import', 'tsx', 'scripts/knowledge-governance/input-inventory/cli.ts', '--captured-at', '2026-07-19T00:00:00.000Z', '--allow-blocked'];
    const first = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    const second = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    expect(first.status).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    expect(await readFile(path.join(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml'))).toEqual(registryBefore);
    expect(await readFile(path.join(root, '.git'))).toEqual(gitBefore);
    const parsed = JSON.parse(first.stdout) as { readiness: boolean; repository_revision: string; anchors: { records: unknown[] }; record_sets: { physical: unknown[]; logical: unknown[] }; drift: Array<{ code: string }> };
    expect(parsed.repository_revision).toMatch(/^[0-9a-f]{40}$/u);
    expect(parsed.record_sets.physical.length).toBeGreaterThan(0);
    expect(parsed.record_sets.logical.length).toBeGreaterThan(0);
    expect(parsed.readiness).toBe(false);
    expect(parsed.drift.some((item) => item.code === 'DATABASE_SNAPSHOT_REQUIRED')).toBe(true);
  }, 120_000);

  it('routes synthetic anchors through the manifest anchor constructor', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/knowledge-governance/input-inventory/cli.ts', '--captured-at', '2026-07-19T00:00:00.000Z', '--anchor-fixture', 'scripts/knowledge-governance/input-inventory/fixtures/synthetic-anchors.json', '--allow-blocked'], { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    expect(result.status).toBe(0);
    const manifest = JSON.parse(result.stdout) as { anchors: { records: Array<{ anchor_id: string }>; observed_count: number }; drift: Array<{ code: string }> };
    expect(manifest.anchors.observed_count).toBe(3);
    expect(manifest.anchors.records.every((anchor) => /^sha256:/u.test(anchor.anchor_id))).toBe(true);
    expect(manifest.drift.some((item) => item.code === 'ANCHOR_EXTRACTION_CONTRACT_MISSING')).toBe(false);
  }, 120_000);

  it('CLI is stdout-only with transport/write traps and preserves tracked, untracked, ignored, runtime and inventoried fingerprints', async () => {
    const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    const inventoryDrift: never[] = [];
    const repository = await enumerateRepository(root, registry, inventoryDrift);
    const inventoried = repository.sources.flatMap((source) => source.physical_paths as string[]);
    const fingerprintPaths = [...new Set([...inventoried, 'scripts/knowledge-governance/input-inventory/manifest.ts', 'scripts/knowledge-governance/input-inventory/manifest.schema.json'])];
    const fingerprintsBefore = await sourceFingerprints(root, fingerprintPaths);
    const gitBefore = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).stdout;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-trap-'));
    try {
      const trap = `const net=require('node:net'),http=require('node:http'),https=require('node:https'),fs=require('node:fs'); const deny=()=>{throw new Error('transport/write trap');}; net.Socket.prototype.connect=deny; http.request=deny; https.request=deny; global.fetch=deny; for(const k of ['writeFile','appendFile','createWriteStream','rename','unlink']) fs[k]=deny;`;
      const trapPath = path.join(directory, 'trap.cjs');
      await writeFile(trapPath, trap);
      const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require=${trapPath}`, GH_TOKEN: 'transport-trap', GITHUB_TOKEN: 'transport-trap', DATABASE_URL: 'postgresql://transport-trap.invalid/db' };
      const blocked = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/knowledge-governance/input-inventory/cli.ts', '--captured-at', '2026-07-19T00:00:00.000Z'], { cwd: root, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
      expect(blocked.status).toBe(2);
      expect(blocked.stderr).toBe('');
      expect(JSON.parse(blocked.stdout).readiness).toBe(false);
      const inspect = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/knowledge-governance/input-inventory/cli.ts', '--captured-at', '2026-07-19T00:00:00.000Z', '--allow-blocked'], { cwd: root, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
      expect(inspect.status).toBe(0);
      expect(inspect.stdout).toBe(blocked.stdout);
    } finally { await rm(directory, { recursive: true }); }
    expect(await sourceFingerprints(root, fingerprintPaths)).toEqual(fingerprintsBefore);
    expect(spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).stdout).toBe(gitBefore);
  }, 120_000);
});
