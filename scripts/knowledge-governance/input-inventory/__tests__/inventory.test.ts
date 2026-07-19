import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, compareCodePoints, normalizePath, normalizeText, taggedDigest } from '../normalize';
import { loadImmutableExport, validateDatabaseClosure } from '../database-snapshot';
import { assertAggregateExportShape, contractsFromRegistry, DATABASE_EXPORT_FORMAT, deriveProof, exportAggregateDatabase, latestWatermark, type AggregateDatabaseExport, type AggregateDatasetExport } from '../database-export';
import { discoverWriters, discoverWritersInSource } from '../writer-discovery';
import { validateOutputPrivacy } from '../schema-validation';
import { sourceFingerprints } from '../manifest';
import { enumerateRepository, loadRegistry, matchGlob, type Registry } from '../registry';
import type { Json } from '../types';
import { effectiveDecoderContract, validateFixtureClosure, validateSyntheticPayload, type ShapeFixture } from '../decoder-validation';
import { makeAnchor, typedDedupe } from '../records';
import { auditIdBearingPaths, selectJson } from '../json-selector';
import { compileDatabaseObservationContracts, compileJsonObservationContracts } from '../database-observation';

const root = path.resolve(import.meta.dirname, '../../../..');
const digest = `sha256:${'0'.repeat(64)}`;
const authority = { registryDigest: digest, exporterDigest: digest };

function aggregateExport(datasets: AggregateDatasetExport[]): AggregateDatabaseExport {
  return {
    format_version: DATABASE_EXPORT_FORMAT,
    captured_at: '2026-01-01T00:00:00.000Z',
    source_identity_digest: digest,
    postgres_version: '16.1',
    schema_name: 'public',
    schema_digest: digest,
    migration_head: '20260101000000_fixture',
    registry_digest: digest,
    exporter_digest: digest,
    query_plan_digest: digest,
    transaction_isolation: 'repeatable read',
    transaction_read_only: true,
    transaction_started_at: '2026-01-01T00:00:00.000Z',
    exported_snapshot_token: '00000003-00000001-1',
    declared_table_count: datasets.length,
    datasets,
  };
}

async function writeAggregateExport(directory: string, exported: AggregateDatabaseExport): Promise<void> {
  const bytes = Buffer.from(canonicalJson(exported as unknown as Json));
  await writeFile(path.join(directory, 'export.json'), bytes);
  await writeFile(path.join(directory, 'proof.json'), canonicalJson(deriveProof(exported, bytes) as unknown as Json));
}

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
      expect(result.evidence.find((item) => item.path === 'src/route.ts')?.call_paths).toContainEqual({
        symbols: ['src/route.ts#POST', 'src/helper.ts#persist'],
        target: { model: 'LearningFact', operation: 'create', nested_relation: null },
      });
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
  it('rejects unsafe export paths before creating any directory', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-export-paths-'));
    const repository = path.join(directory, 'repository');
    const outside = path.join(directory, 'outside');
    try {
      await mkdir(repository);
      await writeFile(path.join(repository, '.git'), 'gitdir: fixture\n');
      const options = { root: repository, registryPath: 'registry.yaml', databaseUrl: 'postgresql://invalid', outputPath: path.join(outside, 'new', 'export.json'), proofPath: 'relative-proof.json' };
      await expect(exportAggregateDatabase(options)).rejects.toThrow(/absolute/u);
      expect(existsSync(path.join(outside, 'new'))).toBe(false);

      const insideParent = path.join(repository, 'not-created', 'nested');
      await expect(exportAggregateDatabase({ ...options, outputPath: path.join(insideParent, 'export.json'), proofPath: path.join(outside, 'proof.json') })).rejects.toThrow(/outside repository/u);
      expect(existsSync(insideParent)).toBe(false);

      const alias = path.join(directory, 'repository-alias');
      await symlink(repository, alias);
      const escapedParent = path.join(alias, 'escaped', 'nested');
      await expect(exportAggregateDatabase({ ...options, outputPath: path.join(escapedParent, 'export.json'), proofPath: path.join(outside, 'proof.json') })).rejects.toThrow(/outside repository/u);
      expect(existsSync(path.join(repository, 'escaped'))).toBe(false);
      expect(existsSync(outside)).toBe(false);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('resolves existing target files and forbids symlink, inode alias and regular-file overwrite side effects', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-export-target-files-'));
    const repository = path.join(directory, 'repository');
    const artifacts = path.join(directory, 'artifacts');
    try {
      await mkdir(repository);
      await mkdir(artifacts);
      await writeFile(path.join(repository, '.git'), 'gitdir: fixture\n');
      const tracked = path.join(repository, 'tracked.json');
      await writeFile(tracked, 'repository authority\n');
      const base = { root: repository, registryPath: 'registry.yaml', databaseUrl: 'postgresql://invalid' };

      const repositoryLink = path.join(artifacts, 'repository-link.json');
      await symlink(tracked, repositoryLink);
      const missingProof = path.join(artifacts, 'missing-proof.json');
      const beforeRepositoryLink = await readdir(artifacts);
      await expect(exportAggregateDatabase({ ...base, outputPath: repositoryLink, proofPath: missingProof })).rejects.toThrow(/outside repository/u);
      expect(await readFile(tracked, 'utf8')).toBe('repository authority\n');
      expect(await readdir(artifacts)).toEqual(beforeRepositoryLink);

      const shared = path.join(artifacts, 'shared.json');
      await writeFile(shared, 'shared immutable artifact\n');
      const firstLink = path.join(artifacts, 'first-link.json');
      const secondLink = path.join(artifacts, 'second-link.json');
      await symlink(shared, firstLink);
      await symlink(shared, secondLink);
      const beforeSameTarget = await readdir(artifacts);
      await expect(exportAggregateDatabase({ ...base, outputPath: firstLink, proofPath: secondLink })).rejects.toThrow(/paths must differ/u);
      expect(await readFile(shared, 'utf8')).toBe('shared immutable artifact\n');
      expect(await readdir(artifacts)).toEqual(beforeSameTarget);

      const firstHardLink = path.join(artifacts, 'first-hard-link.json');
      const secondHardLink = path.join(artifacts, 'second-hard-link.json');
      await link(shared, firstHardLink);
      await link(shared, secondHardLink);
      await expect(exportAggregateDatabase({ ...base, outputPath: firstHardLink, proofPath: secondHardLink })).rejects.toThrow(/paths must differ/u);

      const existingOutput = path.join(artifacts, 'existing-output.json');
      await writeFile(existingOutput, 'do not overwrite\n');
      await expect(exportAggregateDatabase({ ...base, outputPath: existingOutput, proofPath: missingProof })).rejects.toThrow(/overwrite is forbidden/u);
      expect(await readFile(existingOutput, 'utf8')).toBe('do not overwrite\n');
      expect(existsSync(missingProof)).toBe(false);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('writes no artifact when the registry requests a private nested payload summary', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-private-summary-block-'));
    const artifactParent = path.join(directory, 'not-created');
    const outputPath = path.join(artifactParent, 'export.json');
    const proofPath = path.join(artifactParent, 'proof.json');
    try {
      await expect(exportAggregateDatabase({
        root,
        registryPath: 'docs/proposals/course-knowledge-base-governance-source-registry.yaml',
        databaseUrl: 'postgresql://must-not-connect',
        outputPath,
        proofPath,
      })).rejects.toThrow(/private summary field/u);
      expect(existsSync(outputPath)).toBe(false);
      expect(existsSync(proofPath)).toBe(false);
      expect(existsSync(artifactParent)).toBe(false);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('derives snapshot id from proof and accepts only already-suppressed 1-4 person cells', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-export-'));
    try {
      const datasets: AggregateDatasetExport[] = [{ id: 'learner', table: 'Snapshot', count: 9, watermark: '2026-01-01T00:00:00.000000Z', watermarks: { watermark: '2026-01-01T00:00:00.000000Z' }, shape: ['version', 'watermark'], versions: ['v1'], version_summaries: { version: { v1: 5, __suppressed__: 'suppressed' } }, discriminator_summaries: {}, historical_shape_summaries: {}, json_observation_summaries: {} }];
      await writeAggregateExport(directory, aggregateExport(datasets));
      const drift: never[] = [];
      const snapshot = await loadImmutableExport(directory, 'export.json', 'proof.json', drift, authority);
      expect(snapshot.snapshot_id).toMatch(/^sha256:/u);
      expect(snapshot.datasets[0]!.version_summaries).toEqual({ version: { v1: 5, __suppressed__: 'suppressed' } });
      expect(drift).toEqual([]);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('continues to verify legacy v1 proofs while withholding new readiness evidence', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-legacy-export-'));
    try {
      const enhanced: AggregateDatasetExport = { id: 'legacy', table: 'Snapshot', count: 0, watermark: null, watermarks: {}, shape: [], versions: [], version_summaries: {}, discriminator_summaries: {}, historical_shape_summaries: {}, json_observation_summaries: {} };
      const { watermarks: _watermarks, json_observation_summaries: _json, ...legacy } = enhanced;
      await writeAggregateExport(directory, aggregateExport([legacy]));
      const snapshot = await loadImmutableExport(directory, 'export.json', 'proof.json', [], authority);
      expect(snapshot.datasets[0]).toMatchObject({ watermarks: {}, json_observation_summaries: {} });
    } finally { await rm(directory, { recursive: true }); }
  });

  it('rejects rows, users, payloads and row digests recursively', () => {
    expect(validateOutputPrivacy({ safe: { payload: 'secret' } } as Json)).toEqual([expect.objectContaining({ code: 'PROHIBITED_OUTPUT_FIELD' })]);
  });

  it('rejects caller-embedded proof and inconsistent external object metadata', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-proof-reject-'));
    try {
      const exported = aggregateExport([]);
      const bytes = Buffer.from(canonicalJson(exported as unknown as Json));
      const proof = deriveProof(exported, bytes);
      await writeFile(path.join(directory, 'proof.json'), canonicalJson({ ...proof, export_object_id: digest } as unknown as Json));
      await writeFile(path.join(directory, 'embedded.json'), canonicalJson({ ...exported, proof } as unknown as Json));
      await writeFile(path.join(directory, 'export.json'), bytes);
      await expect(loadImmutableExport(directory, 'embedded.json', 'proof.json', [], authority)).rejects.toThrow(/embedded/u);
      await expect(loadImmutableExport(directory, 'export.json', 'proof.json', [], authority)).rejects.toThrow(/proof digest or closure mismatch/u);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('rejects unsuppressed small cells, private row material and caller-authored proof labels', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-private-export-'));
    try {
      const baseDataset: AggregateDatasetExport = { id: 'learner', table: 'Snapshot', count: 4, watermark: null, watermarks: {}, shape: ['version'], versions: [], version_summaries: { version: { v1: 4 } }, discriminator_summaries: {}, historical_shape_summaries: {}, json_observation_summaries: {} };
      await writeAggregateExport(directory, aggregateExport([baseDataset]));
      await expect(loadImmutableExport(directory, 'export.json', 'proof.json', [], authority)).rejects.toThrow(/unsuppressed small cell/u);

      const privateExport = { ...aggregateExport([{ ...baseDataset, version_summaries: { version: { __suppressed__: 'suppressed' } } }]), userId: 'private-user' };
      const privateBytes = Buffer.from(canonicalJson(privateExport as unknown as Json));
      await writeFile(path.join(directory, 'private.json'), privateBytes);
      await writeFile(path.join(directory, 'private-proof.json'), canonicalJson(deriveProof(privateExport, privateBytes) as unknown as Json));
      await expect(loadImmutableExport(directory, 'private.json', 'private-proof.json', [], authority)).rejects.toThrow(/learner row content/u);

      const prefixedPrivate = aggregateExport([{ ...baseDataset, version_summaries: { 'field:userId': { value: 5 } } }]);
      const prefixedBytes = Buffer.from(canonicalJson(prefixedPrivate as unknown as Json));
      await writeFile(path.join(directory, 'prefixed-private.json'), prefixedBytes);
      await writeFile(path.join(directory, 'prefixed-private-proof.json'), canonicalJson(deriveProof(prefixedPrivate, prefixedBytes) as unknown as Json));
      await expect(loadImmutableExport(directory, 'prefixed-private.json', 'prefixed-private-proof.json', [], authority)).rejects.toThrow(/learner row content/u);
      expect(() => assertAggregateExportShape(prefixedPrivate)).toThrow(/private summary field/u);

      for (const locator of ['field-userId', 'field_user_id', 'field:payload.reasoning']) {
        const malformed = aggregateExport([{ ...baseDataset, version_summaries: { [locator]: { value: 5 } } }]);
        expect(() => assertAggregateExportShape(malformed)).toThrow(/summary (?:locator|field)/u);
      }

      const safeExport = aggregateExport([]);
      const safeBytes = Buffer.from(canonicalJson(safeExport as unknown as Json));
      const freeLabelProof = { ...deriveProof(safeExport, safeBytes), label: 'trusted-by-caller' };
      await writeFile(path.join(directory, 'safe.json'), safeBytes);
      await writeFile(path.join(directory, 'free-label-proof.json'), canonicalJson(freeLabelProof as unknown as Json));
      await expect(loadImmutableExport(directory, 'safe.json', 'free-label-proof.json', [], authority)).rejects.toThrow(/caller-authored/u);
    } finally { await rm(directory, { recursive: true }); }
  });

  it.each([
    ['registry', { registry_digest: `sha256:${'1'.repeat(64)}` }, /registry authority mismatch/u],
    ['exporter', { exporter_digest: `sha256:${'1'.repeat(64)}` }, /implementation authority mismatch/u],
  ])('rejects a self-consistent proof from an old %s authority', async (_label, replacement, expected) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-old-authority-'));
    try {
      const exported = { ...aggregateExport([]), ...replacement };
      const bytes = Buffer.from(canonicalJson(exported as unknown as Json));
      await writeFile(path.join(directory, 'export.json'), bytes);
      await writeFile(path.join(directory, 'proof.json'), canonicalJson(deriveProof(exported, bytes) as unknown as Json));
      await expect(loadImmutableExport(directory, 'export.json', 'proof.json', [], authority)).rejects.toThrow(expected);
    } finally { await rm(directory, { recursive: true }); }
  });

  it.each(['unique_semantic_name', 'domain_membership', 'relation_approval', 'resource_binding_approval', 'user_id', 'payload', 'raw_row_digest'])(`rejects prohibited output key %s`, (key) => {
    expect(validateOutputPrivacy({ nested: { [key]: 'forbidden' } } as Json)).toEqual([expect.objectContaining({ code: 'PROHIBITED_OUTPUT_FIELD' })]);
  });

  it('blocks the declared database closure when a nested selector names a private payload field', async () => {
    const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    const fixtureFile = JSON.parse(await readFile(path.join(root, 'scripts/knowledge-governance/input-inventory/fixtures/synthetic-history-payload-shapes.json'), 'utf8')) as { fixtures: ShapeFixture[] };
    const observations = compileDatabaseObservationContracts(registry);
    const jsonObservations = compileJsonObservationContracts(registry, fixtureFile.fixtures);
    expect(observations.drift).toEqual([]);
    expect(jsonObservations.drift).toEqual([]);
    const tableFields = new Map<string, Set<string>>();
    for (const source of registry.database_sources) for (const [table, fields] of Object.entries(source.fields as Record<string, string[]>)) {
      const current = tableFields.get(table) ?? new Set<string>();
      fields.forEach((field) => current.add(field));
      tableFields.set(table, current);
    }
    const datasets: AggregateDatasetExport[] = [...tableFields].map(([table, fields]) => {
      const contracts = observations.contracts.filter((contract) => contract.table === table);
      const summaries = (kind: 'version' | 'discriminator' | 'historical_shape') => Object.fromEntries(contracts
        .filter((contract) => contract.summary === kind)
        .map((contract) => [`field:${contract.field}`, { [contract.accepted[0]!]: 5 }]));
      const versionSummaries = summaries('version');
      return {
        id: `synthetic-${table}`, table, count: 5, watermark: null, watermarks: {}, shape: [...fields],
        versions: [...new Set(Object.values(versionSummaries).flatMap((summary) => Object.keys(summary).filter((value) => !value.startsWith('__'))))].sort(),
        version_summaries: versionSummaries,
        discriminator_summaries: summaries('discriminator'),
        historical_shape_summaries: summaries('historical_shape'),
        json_observation_summaries: Object.fromEntries(jsonObservations.contracts.filter((item) => item.table === table).map((item) => [item.summary === 'path' ? `path:${item.field}` : `${item.summary}:${item.field}:${item.selector}`, {}])),
      };
    });
    const directory = await mkdtemp(path.join(os.tmpdir(), 'inventory-full-export-'));
    try {
      await writeAggregateExport(directory, aggregateExport(datasets));
      await expect(loadImmutableExport(directory, 'export.json', 'proof.json', [], authority)).rejects.toThrow(/learner row content/u);
      expect(() => assertAggregateExportShape(aggregateExport(datasets))).toThrow(/private summary field/u);
    } finally { await rm(directory, { recursive: true }); }
  });

  it('derives camelCase observation versions and retains every declared watermark', async () => {
    const registry = await loadRegistry(root, 'docs/proposals/course-knowledge-base-governance-source-registry.yaml');
    const contracts = contractsFromRegistry(registry);
    expect(contracts.find((item) => item.table === 'CourseBasisDocumentVersion')?.versionFields).toContain('extractionVersion');
    expect(contracts.find((item) => item.table === 'LearningEventBatch')?.watermarkFields).toEqual(['batchDate', 'processedAt']);
  });

  it('selects the compatibility watermark independently of the host timezone', () => {
    const original = process.env.TZ;
    const watermarks = { batchDate: '2026-07-19T00:00:00.000000Z', processedAt: '2026-07-19T15:30:00.000000Z' };
    try {
      process.env.TZ = 'UTC';
      const utc = latestWatermark(watermarks);
      process.env.TZ = 'Asia/Shanghai';
      expect(latestWatermark(watermarks)).toBe(utc);
      expect(utc).toBe(watermarks.processedAt);
    } finally { process.env.TZ = original; }
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
    expect(registry.repository_sources.find((source) => source.id === 'knowledge-direct-writers')?.include).toHaveLength(47);
    const expected = JSON.parse(await readFile(path.join(root, 'scripts/knowledge-governance/input-inventory/fixtures/real-repository-structure.json'), 'utf8')) as { registry_contract: Record<string, number> };
    expect(expected.registry_contract).toEqual({ repository_sources: 14, database_sources: 9, decoder_contracts: 16, field_decoders: 41, namespaces: 45, declared_writer_paths: 47 });
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
    const parsed = JSON.parse(first.stdout) as { readiness: boolean; repository_revision: string; anchors: { records: unknown[]; candidate_count: number; review_count: number; admitted_count: number; review_artifact_digest: string | null; admitted_artifact_digest: string | null }; record_sets: { physical: unknown[]; logical: unknown[] }; drift: Array<{ code: string }> };
    expect(parsed.repository_revision).toMatch(/^[0-9a-f]{40}$/u);
    expect(parsed.record_sets.physical.length).toBeGreaterThan(0);
    expect(parsed.record_sets.logical.length).toBeGreaterThan(0);
    expect(parsed.anchors).toMatchObject({ records: [], candidate_count: 32, review_count: 0, admitted_count: 0, review_artifact_digest: null, admitted_artifact_digest: null });
    expect(parsed.drift.some((item) => item.code === 'ANCHOR_REVIEW_ATTESTATION_MISSING')).toBe(true);
    expect(parsed.readiness).toBe(false);
    expect(parsed.drift.some((item) => item.code === 'DATABASE_SNAPSHOT_REQUIRED')).toBe(true);
  }, 120_000);

  it('admits only independently reviewed authoritative anchors through an exact attestation', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/knowledge-governance/input-inventory/cli.ts', '--captured-at', '2026-07-19T00:00:00.000Z', '--anchor-review-attestation', 'scripts/knowledge-governance/input-inventory/fixtures/anchor-review-attestation.json', '--allow-blocked'], { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    expect(result.status).toBe(0);
    const manifest = JSON.parse(result.stdout) as { anchors: { records: Array<{ anchor_id: string }>; observed_count: number; candidate_count: number; review_count: number; admitted_count: number; candidate_artifact_digest: string; review_artifact_digest: string; admitted_artifact_digest: string }; drift: Array<{ code: string }> };
    expect(manifest.anchors).toMatchObject({ observed_count: 32, candidate_count: 32, review_count: 32, admitted_count: 32, candidate_artifact_digest: 'sha256:523ce88e050b4eb7de9af279b290bed503caf51363cf617e0e754cb7ee757e85', review_artifact_digest: 'sha256:de57075b69ccc3634041eb1058ef42ad784c77dcbe6cd3bc4c75c0e6af0c58e6', admitted_artifact_digest: 'sha256:592773c45df8b24e6e97d0ba3a2f660ca2a8715a6c55c3347809ab4fea05610e' });
    expect(manifest.anchors.records.every((anchor) => /^sha256:/u.test(anchor.anchor_id))).toBe(true);
    expect(manifest.drift.some((item) => item.code.startsWith('ANCHOR_REVIEW_ATTESTATION_'))).toBe(false);
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
