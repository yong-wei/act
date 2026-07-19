import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, normalizedFile, sortUnique, taggedDigest } from './normalize';
import { enumerateRepository, loadRegistry } from './registry';
import { validateOutputPrivacy, validateRegistrySchema } from './schema-validation';
import { discoverWriters } from './writer-discovery';
import { loadImmutableExport, noDatabaseSnapshot, validateDatabaseClosure } from './database-snapshot';
import { decoderContractDigest, effectiveDecoderContract, validateFixtureClosure, validateSyntheticPayload, type ShapeFixture } from './decoder-validation';
import { extractRecordSets } from './extract-records';
import { makeAnchor, type AnchorRecord } from './records';
import { assertManifestSchema } from './output-validation';
import type { Drift, InventoryOptions, Json } from './types';

const DEFAULT_REGISTRY = 'docs/proposals/course-knowledge-base-governance-source-registry.yaml';

async function repositoryRevision(root: string): Promise<string> {
  const dotGit = await readFile(path.join(root, '.git'), 'utf8');
  const gitDirectory = dotGit.startsWith('gitdir: ') ? path.resolve(root, dotGit.slice(8).trim()) : path.join(root, '.git');
  const head = (await readFile(path.join(gitDirectory, 'HEAD'), 'utf8')).trim();
  if (!head.startsWith('ref: ')) return head;
  const ref = head.slice(5);
  try { return (await readFile(path.join(gitDirectory, ref), 'utf8')).trim(); }
  catch {
    const commonDirText = await readFile(path.join(gitDirectory, 'commondir'), 'utf8').catch(() => '.');
    const commonDir = path.resolve(gitDirectory, commonDirText.trim());
    return (await readFile(path.join(commonDir, ref), 'utf8')).trim();
  }
}

export async function buildManifest(options: InventoryOptions): Promise<Json> {
  const registryPath = options.registryPath ?? DEFAULT_REGISTRY;
  const registry = await loadRegistry(options.root, registryPath);
  const drift: Drift[] = [];
  const repository = await enumerateRepository(options.root, registry, drift);
  drift.push(...await validateRegistrySchema(options.root, registry));
  const fixtureFile = JSON.parse(await readFile(path.join(options.root, 'scripts/knowledge-governance/input-inventory/fixtures/synthetic-history-payload-shapes.json'), 'utf8')) as { fixtures: ShapeFixture[] };
  drift.push(...validateFixtureClosure(Object.keys(registry.decoder_contracts), fixtureFile.fixtures));
  for (const fixture of fixtureFile.fixtures) for (const sample of fixture.samples) drift.push(...validateSyntheticPayload(effectiveDecoderContract(registry, fixture.decoder_id), fixture, sample.payload, sample.version));
  const writers = await discoverWriters(options.root, registry);
  drift.push(...writers.drift);
  const allPaths = sortUnique(repository.sources.flatMap((source) => source.physical_paths as string[]));
  const mediaPaths = new Set(repository.roles.filter((role) => ['production_provenance', 'runtime_projection', 'binding_content'].includes(String(role.role))).flatMap((role) => role.physical_paths as string[]).filter((item) => /\.(?:png|jpe?g|gif|webp|svg|pdf|mp[34]|wav|ogg|webm|zip)$/iu.test(item)));
  const fileRecords = [];
  for (const relative of allPaths) {
    try { fileRecords.push(await normalizedFile(options.root, relative, { allowBinary: mediaPaths.has(relative) })); }
    catch (error) { drift.push({ code: 'INPUT_READ_FAILED', scope: relative, detail: error instanceof Error ? error.message : String(error) }); }
  }
  const sourceDigests = repository.sources.map((source) => {
    const records = fileRecords.filter((record) => (source.physical_paths as string[]).includes(record.path));
    return { source_id: source.id, source_locator: source.id, item_kind: source.item_kind, identity_namespace: source.identity_namespace, schema_version: registry.schema_version, digest: taggedDigest('repository-source/v1', canonicalJson(records as unknown as Json)), item_count: records.length };
  });
  const decoderDigests = [];
  for (const [id, contract] of Object.entries(registry.decoder_contracts)) {
    const locators = (Array.isArray(contract.schema_source) ? contract.schema_source : [contract.schema_source]).filter((item): item is string => typeof item === 'string');
    const schemaSources = [];
    for (const locator of locators) {
      const sourcePath = locator.split('#')[0]!;
      try { schemaSources.push({ locator, digest: (await normalizedFile(options.root, sourcePath, { allowBinary: false })).digest }); }
      catch { /* unresolved source already has structured registry drift */ }
    }
    decoderDigests.push({ decoder_id: id, digest: decoderContractDigest(id, contract, schemaSources) });
  }
  const auditPath = 'docs/knowledge-graph-current-state-audit-2026-07-18.md';
  const auditText = await readFile(path.join(options.root, auditPath), 'utf8');
  const expectedNodes = Number(/\| 活动知识节点 \| ([\d,]+) \|/u.exec(auditText)?.[1]?.replaceAll(',', ''));
  const expectedCards = Number(/\| 绑定 runtime 知识卡 \| ([\d,]+) \|/u.exec(auditText)?.[1]?.replaceAll(',', ''));
  const nodes = JSON.parse(await readFile(path.join(options.root, 'course-content/runtime/knowledge/graph/nodes.json'), 'utf8')) as unknown[];
  const observedNodes = Array.isArray(nodes) ? nodes.length : 0;
  const observedCards = fileRecords.filter((record) => /^course-content\/runtime\/knowledge\/cards\/nodes\/.*\.md$/u.test(record.path)).length;
  const auditBaseline = { source: auditPath, evidence_date: '2026-07-18', observations: [
    { metric: 'runtime_active_knowledge_nodes', expected: expectedNodes, observed: observedNodes },
    { metric: 'runtime_bound_knowledge_cards', expected: expectedCards, observed: observedCards },
  ] };
  for (const observation of auditBaseline.observations) if (observation.expected !== observation.observed) drift.push({ code: 'DATED_AUDIT_BASELINE_DRIFT', scope: observation.metric, expected: observation.expected, observed: observation.observed });
  const capturedAt = options.capturedAt ?? '1970-01-01T00:00:00.000Z';
  let database;
  if (options.databaseExportPath && options.databaseExportProofPath) database = await loadImmutableExport(options.root, options.databaseExportPath, options.databaseExportProofPath, drift);
  else if (options.databaseExportPath || options.databaseExportProofPath) throw new Error('database export and external proof paths must be supplied together');
  else database = noDatabaseSnapshot(capturedAt, drift);
  if (options.databaseExportPath && options.databaseExportProofPath) drift.push(...validateDatabaseClosure(database, registry));
  const effectiveCapturedAt = options.databaseExportPath && options.databaseExportProofPath ? database.captured_at : capturedAt;
  const recordSets = await extractRecordSets(options.root, repository, database, mediaPaths, registry, fileRecords);
  drift.push(...recordSets.drift);
  let anchorRecords: AnchorRecord[] = [];
  if (options.anchorFixturePath) {
    const fixture = JSON.parse(await readFile(path.join(options.root, options.anchorFixturePath), 'utf8')) as { anchors: Array<Omit<AnchorRecord, 'anchor_id' | 'text_digest'> & { text: string }> };
    anchorRecords = fixture.anchors.map(({ text, ...anchor }) => makeAnchor({ ...anchor, text_digest: taggedDigest('anchor-text/v1', text) }));
  } else drift.push({ code: 'ANCHOR_EXTRACTION_CONTRACT_MISSING', scope: 'anchor_record_contract', detail: 'nullable shape is declared but no closed extraction selector is present' });
  const databaseSourceDigests = registry.database_sources.map((source) => {
    const tables = new Set(source.tables as string[] ?? []);
    const datasets = database.datasets.filter((dataset) => tables.has(dataset.table));
    return { source_id: String(source.id), source_locator: `database:${source.id}`, item_kind: String(source.item_kind), schema_version: registry.schema_version, digest: taggedDigest('database-source/v1', canonicalJson(datasets as unknown as Json)), dataset_count: datasets.length };
  });
  const anchorScopes = (registry.anchor_record_contract.anchor_scopes ?? {}) as Record<string, unknown>;
  const manifest: Record<string, Json> = {
    schema_version: 'course-knowledge-input-inventory/v1',
    algorithm_version: registry.algorithm_version,
    registry_id: registry.registry_id,
    normalization_profile: registry.normalization_profile,
    captured_at: effectiveCapturedAt,
    repository_revision: await repositoryRevision(options.root),
    repository: repository as unknown as Json,
    repository_files: fileRecords as unknown as Json,
    record_sets: recordSets as unknown as Json,
    source_digests: sourceDigests as unknown as Json,
    database_source_digests: databaseSourceDigests as unknown as Json,
    decoder_digests: decoderDigests as unknown as Json,
    governance_contract_digest: taggedDigest('governance-contract/v1', canonicalJson(sourceDigests.filter((item) => ['governance-contract', 'governance-adrs'].includes(String(item.source_id))) as unknown as Json)),
    source_snapshot_digest: taggedDigest('source-snapshot/v1', canonicalJson({ repository: sourceDigests, database: databaseSourceDigests, snapshot_proof: database.snapshot_proof } as unknown as Json)),
    upstream_manifest_digests: [],
    anchors: { records: anchorRecords as unknown as Json, nullable_scope_matrix: anchorScopes as unknown as Json, observed_count: anchorRecords.length },
    contracts: {
      repository_sources: registry.repository_sources.length,
      database_sources: registry.database_sources.length,
      decoder_contracts: Object.keys(registry.decoder_contracts).length,
      field_decoders: registry.field_decoders.length,
      namespaces: registry.closed_namespaces.length,
      declared_writer_paths: registry.repository_sources.find((source) => source.id === 'knowledge-direct-writers')?.include?.length ?? 0,
      digest: taggedDigest('inventory-contract/v1', canonicalJson({ registry_path: registryPath, registry_file: await normalizedFile(options.root, registryPath) } as unknown as Json)),
    },
    dated_audit_baseline: auditBaseline as unknown as Json,
    writer_discovery: writers.evidence as unknown as Json,
    database_snapshot: database as unknown as Json,
    drift: drift as unknown as Json,
    readiness: false,
  };
  const privacy = validateOutputPrivacy(manifest);
  drift.push(...privacy);
  manifest.drift = drift as unknown as Json;
  manifest.readiness = drift.length === 0;
  manifest.snapshot_digest = taggedDigest('course-knowledge-input-inventory/v1', canonicalJson({ ...manifest, snapshot_digest: null } as unknown as Json));
  await assertManifestSchema(options.root, manifest);
  return manifest;
}

export async function sourceFingerprints(root: string, paths: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const relative of paths) {
    const metadata = await stat(path.join(root, relative));
    const record = await normalizedFile(root, relative, { allowBinary: /\.(?:png|jpe?g|gif|webp|svg|pdf|mp[34]|wav|ogg|webm|zip)$/iu.test(relative) });
    result[relative] = `${metadata.mode}:${metadata.size}:${record.digest}`;
  }
  return result;
}

export { canonicalJson } from './normalize';
