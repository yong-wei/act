import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalJson, normalizedFile, sortUnique, taggedDigest } from './normalize';
import { classifyRegisteredSymlinks, enumerateRepository, loadRegistry, matchGlob } from './registry';
import { validateOutputPrivacy, validateRegistrySchema } from './schema-validation';
import { discoverWriters } from './writer-discovery';
import { loadImmutableExport, noDatabaseSnapshot, validateDatabaseClosure } from './database-snapshot';
import { decoderContractDigest, validateFixtureClosure, validateSyntheticDecoderGraph, type ShapeFixture } from './decoder-validation';
import { extractRecordSets } from './extract-records';
import type { AnchorRecord } from './records';
import { extractAuthoritativeAnchorCandidates, verifyAnchorReviewAttestation } from './anchors';
import { assertManifestSchema } from './output-validation';
import type { Drift, InventoryOptions, Json } from './types';
import { collectInputObservations, publicObservation } from './input-codecs';
import { currentDatabaseExportAuthority } from './database-export';

const DEFAULT_REGISTRY = 'docs/proposals/course-knowledge-base-governance-source-registry.yaml';

export async function repositoryRevision(root: string): Promise<string> {
  const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const revision = result.stdout.trim();
  if (result.status !== 0 || !/^[0-9a-f]{40}$/u.test(revision)) throw new Error(`unable to resolve repository HEAD: ${result.stderr.trim()}`);
  return revision;
}

function mergeRepositoryObservations(
  repository: Awaited<ReturnType<typeof enumerateRepository>>,
  mainRepository: Awaited<ReturnType<typeof enumerateRepository>>,
): Awaited<ReturnType<typeof enumerateRepository>> {
  const roles = repository.roles.map((role) => {
    const mainRole = mainRepository.roles.find((item) => item.role === role.role);
    const physicalPaths = sortUnique([...(role.physical_paths as string[]), ...((mainRole?.physical_paths as string[] | undefined) ?? [])]);
    const rules = (role.rules as Array<Record<string, Json>>).map((rule) => {
      const pattern = typeof rule.pattern === 'string' ? rule.pattern : null;
      const exclude = typeof rule.exclude === 'string' ? rule.exclude : null;
      const hitCount = pattern ? physicalPaths.filter((file) => matchGlob(file, pattern) && !(exclude && matchGlob(file, exclude))).length : 0;
      return { ...rule, hit_count: hitCount };
    });
    return { ...role, rules, physical_paths: physicalPaths, hit_count: physicalPaths.length };
  });
  const instructionalPaths = sortUnique([
    ...(repository.unclassified as string[]),
    ...(mainRepository.unclassified as string[]),
    ...roles.flatMap((role) => role.physical_paths as string[]),
  ]);
  const classifications = new Map<string, string[]>();
  for (const role of roles) for (const file of role.physical_paths as string[]) {
    classifications.set(file, [...(classifications.get(file) ?? []), String(role.role)]);
  }
  return {
    ...repository,
    sources: repository.sources.map((source) => {
      const mainSource = mainRepository.sources.find((item) => item.id === source.id);
      const physicalPaths = sortUnique([...(source.physical_paths as string[]), ...((mainSource?.physical_paths as string[] | undefined) ?? [])]);
      return { ...source, physical_paths: physicalPaths, hit_count: physicalPaths.length, logical_inputs: (source.logical_inputs as Array<Record<string, Json>>).map((logical) => {
        const count = physicalPaths.filter((file) => matchGlob(file, String(logical.pattern))).length;
        return { ...logical, state: count === 0 ? 'missing' : 'present', reason_code: count === 0 ? 'NO_GLOB_HIT' : null, hit_count: count };
      }) };
    }),
    roles,
    unclassified: instructionalPaths.filter((file) => !classifications.has(file)),
    multiply_classified: [...classifications]
      .filter(([, assignedRoles]) => assignedRoles.length > 1)
      .map(([file, assignedRoles]) => ({ path: file, roles: sortUnique(assignedRoles) })),
  };
}

function resolvedRepositoryMissingDrift(drift: Drift[], repository: Awaited<ReturnType<typeof enumerateRepository>>): Drift[] {
  return drift.filter((item) => {
    if (item.code === 'REPOSITORY_SOURCE_MISSING') {
      const source = repository.sources.find((candidate) => candidate.id === item.scope);
      return !source || Number(source.hit_count) === 0;
    }
    if (item.code === 'DECLARED_INPUT_MISSING' && typeof item.expected === 'string') {
      const source = repository.sources.find((candidate) => candidate.id === item.scope);
      const logical = (source?.logical_inputs as Array<Record<string, Json>> | undefined)?.find((candidate) => candidate.pattern === item.expected);
      return !logical || Number(logical.hit_count) === 0;
    }
    return true;
  });
}

export async function buildManifest(options: InventoryOptions): Promise<Json> {
  const registryPath = options.registryPath ?? DEFAULT_REGISTRY;
  const registry = await loadRegistry(options.root, registryPath);
  const drift: Drift[] = [];
  const isolatedRevision = await repositoryRevision(options.root);
  if (Boolean(options.mainWorktreeRoot) !== Boolean(options.mainWorktreeRevision)) throw new Error('--main-worktree-root and --main-worktree-revision must be supplied together');
  let authorizedMainRoot: string | undefined;
  let mainRepository: Awaited<ReturnType<typeof enumerateRepository>> | null = null;
  if (options.mainWorktreeRoot && options.mainWorktreeRevision) {
    const observedRevision = await repositoryRevision(options.mainWorktreeRoot);
    if (observedRevision !== options.mainWorktreeRevision) drift.push({ code: 'MAIN_WORKTREE_REVISION_MISMATCH', scope: 'main-worktree', expected: options.mainWorktreeRevision, observed: observedRevision });
    else authorizedMainRoot = options.mainWorktreeRoot;
  }
  const symlinks = await classifyRegisteredSymlinks(options.root, registry, authorizedMainRoot);
  const repository = await enumerateRepository(options.root, registry, drift, authorizedMainRoot);
  if (authorizedMainRoot) mainRepository = await enumerateRepository(authorizedMainRoot, registry, []);
  drift.push(...await validateRegistrySchema(options.root, registry));
  const fixtureFile = JSON.parse(await readFile(path.join(options.root, 'scripts/knowledge-governance/input-inventory/fixtures/synthetic-history-payload-shapes.json'), 'utf8')) as { fixtures: ShapeFixture[] };
  drift.push(...validateFixtureClosure(Object.keys(registry.decoder_contracts), fixtureFile.fixtures));
  for (const fixture of fixtureFile.fixtures) for (const sample of fixture.samples) drift.push(...validateSyntheticDecoderGraph(registry, fixtureFile.fixtures, fixture.decoder_id, sample.payload, sample.version));
  const writers = await discoverWriters(options.root, registry);
  drift.push(...writers.drift);
  const isolatedPaths = new Set(repository.sources.flatMap((source) => source.physical_paths as string[]));
  const mainOnlyOrReplacementPaths = mainRepository
    ? mainRepository.sources.flatMap((source) => source.physical_paths as string[]).filter((relative) => (
      !isolatedPaths.has(relative) || symlinks.authorized_main_worktree_replacements.includes(relative)
    ))
    : [];
  const fileRecords = await collectInputObservations({ isolatedRoot: options.root, isolatedRevision, isolatedPaths: [...isolatedPaths], ...(mainRepository && authorizedMainRoot && options.mainWorktreeRevision ? { mainRoot: authorizedMainRoot, mainRevision: options.mainWorktreeRevision, mainPaths: mainOnlyOrReplacementPaths, isolatedSymlinkReplacements: symlinks.authorized_main_worktree_replacements } : {}) }, registry, drift);
  const effectiveRepository = mainRepository ? mergeRepositoryObservations(repository, mainRepository) : repository;
  if (mainRepository) {
    const reconciled = resolvedRepositoryMissingDrift(drift, effectiveRepository);
    drift.splice(0, drift.length, ...reconciled);
  }
  const sourceDigests = repository.sources.map((source) => {
    const declared = new Set(source.physical_paths as string[]);
    const mainSource = mainRepository?.sources.find((item) => item.id === source.id);
    for (const item of (mainSource?.physical_paths as string[] | undefined) ?? []) declared.add(item);
    const records = fileRecords.filter((record) => declared.has(record.path)).map(publicObservation);
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
  const observedCards = new Set(fileRecords.filter((record) => /^course-content\/runtime\/knowledge\/cards\/nodes\/.*\.md$/u.test(record.path)).map((record) => record.path)).size;
  const auditBaseline = { source: auditPath, evidence_date: '2026-07-18', observations: [
    { metric: 'runtime_active_knowledge_nodes', expected: expectedNodes, observed: observedNodes },
    { metric: 'runtime_bound_knowledge_cards', expected: expectedCards, observed: observedCards },
  ] };
  for (const observation of auditBaseline.observations) if (observation.expected !== observation.observed) drift.push({ code: 'DATED_AUDIT_BASELINE_DRIFT', scope: observation.metric, expected: observation.expected, observed: observation.observed });
  const capturedAt = options.capturedAt ?? '1970-01-01T00:00:00.000Z';
  let database;
  if (options.databaseExportPath && options.databaseExportProofPath) database = await loadImmutableExport(
    options.root,
    options.databaseExportPath,
    options.databaseExportProofPath,
    drift,
    await currentDatabaseExportAuthority(options.root, registryPath),
  );
  else if (options.databaseExportPath || options.databaseExportProofPath) throw new Error('database export and external proof paths must be supplied together');
  else database = noDatabaseSnapshot(capturedAt, drift);
  if (options.databaseExportPath && options.databaseExportProofPath) drift.push(...validateDatabaseClosure(database, registry, fixtureFile.fixtures));
  const effectiveCapturedAt = options.databaseExportPath && options.databaseExportProofPath ? database.captured_at : capturedAt;
  const recordSets = await extractRecordSets(effectiveRepository, database, registry, fileRecords);
  drift.push(...recordSets.drift);
  let anchorRecords: AnchorRecord[] = [];
  let anchorCandidateDigest: string;
  let anchorCandidateCount: number;
  let anchorReviewDigest: string | null = null;
  let anchorReviewCount = 0;
  let anchorAdmittedDigest: string | null = null;
  let anchorAdmittedCount = 0;
  if (options.anchorReviewAttestationPath) {
    try {
      const verified = await verifyAnchorReviewAttestation(options.root, options.anchorReviewAttestationPath);
      anchorCandidateDigest = verified.candidates.artifact_digest;
      anchorCandidateCount = verified.candidates.candidates.length;
      anchorReviewDigest = verified.review.artifact_digest;
      anchorReviewCount = verified.review.decisions.length;
      anchorAdmittedDigest = verified.admitted.artifact_digest;
      anchorAdmittedCount = verified.admitted.admitted.length;
      anchorRecords = verified.admitted.admitted.map((item) => ({
        anchor_id: item.anchor_id, anchor_scope: item.anchor_scope, anchor_type: item.anchor_type,
        course_id: item.course_id, module_id: item.module_id, lesson_id: item.lesson_id,
        source_locator: item.source_locator, text_digest: item.text_digest,
      }));
    } catch (error) {
      const candidates = await extractAuthoritativeAnchorCandidates({ root: options.root, repositoryRevision: isolatedRevision, extractionRun: 'unattested-anchor-extraction/v1' });
      anchorCandidateDigest = candidates.artifact_digest;
      anchorCandidateCount = candidates.candidates.length;
      drift.push({ code: 'ANCHOR_REVIEW_ATTESTATION_INVALID', scope: 'anchor_record_contract', detail: error instanceof Error ? error.message : String(error) });
    }
  } else {
    const candidates = await extractAuthoritativeAnchorCandidates({ root: options.root, repositoryRevision: isolatedRevision, extractionRun: 'unattested-anchor-extraction/v1' });
    anchorCandidateDigest = candidates.artifact_digest;
    anchorCandidateCount = candidates.candidates.length;
    drift.push({ code: 'ANCHOR_REVIEW_ATTESTATION_MISSING', scope: 'anchor_record_contract', detail: 'independent review attestation is required before anchor admission' });
  }
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
    repository_revision: isolatedRevision,
    repository: effectiveRepository as unknown as Json,
    repository_files: fileRecords.map(publicObservation) as unknown as Json,
    record_sets: recordSets as unknown as Json,
    source_digests: sourceDigests as unknown as Json,
    database_source_digests: databaseSourceDigests as unknown as Json,
    decoder_digests: decoderDigests as unknown as Json,
    governance_contract_digest: taggedDigest('governance-contract/v1', canonicalJson(sourceDigests.filter((item) => ['governance-contract', 'governance-adrs'].includes(String(item.source_id))) as unknown as Json)),
    source_snapshot_digest: taggedDigest('source-snapshot/v1', canonicalJson({ repository: sourceDigests, database: databaseSourceDigests, snapshot_proof: database.snapshot_proof } as unknown as Json)),
    upstream_manifest_digests: [],
    anchors: {
      records: anchorRecords as unknown as Json,
      nullable_scope_matrix: anchorScopes as unknown as Json,
      observed_count: anchorRecords.length,
      candidate_artifact_digest: anchorCandidateDigest,
      candidate_count: anchorCandidateCount,
      review_artifact_digest: anchorReviewDigest,
      review_count: anchorReviewCount,
      admitted_artifact_digest: anchorAdmittedDigest,
      admitted_count: anchorAdmittedCount,
    },
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
