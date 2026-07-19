import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, sortUnique, taggedDigest } from './normalize';
import { assertAggregateExportShape, assertNoPrivateSummaryToken, DATABASE_PROOF_FORMAT, deriveProof, type AggregateDatabaseExport, type AggregateExportProof } from './database-export';
import type { DatabaseDataset, DatabaseSnapshot, Drift, Json, SnapshotProof } from './types';
import type { Registry } from './registry';
import { compileDatabaseObservationContracts, compileJsonObservationContracts, type DatabaseSummaryKind, type JsonObservationKind } from './database-observation';
import type { ShapeFixture } from './decoder-validation';

const PROOF_KEYS = ['export_digest', 'export_object_id', 'exported_snapshot_token', 'exporter_digest', 'generated_at', 'migration_head', 'profile', 'proof_digest', 'proof_format', 'query_plan_digest', 'registry_digest', 'schema_digest', 'shared_snapshot_import_count', 'source_identity_digest', 'transaction_isolation', 'transaction_read_only', 'transaction_started_at'];
const EXPORT_KEYS = ['captured_at', 'datasets', 'declared_table_count', 'exported_snapshot_token', 'exporter_digest', 'format_version', 'migration_head', 'postgres_version', 'query_plan_digest', 'registry_digest', 'schema_digest', 'schema_name', 'source_identity_digest', 'transaction_isolation', 'transaction_read_only', 'transaction_started_at'];
const DATASET_KEYS = ['count', 'discriminator_summaries', 'historical_shape_summaries', 'id', 'json_observation_summaries', 'shape', 'table', 'version_summaries', 'versions', 'watermark', 'watermarks'];
const LEGACY_DATASET_KEYS = DATASET_KEYS.filter((key) => key !== 'json_observation_summaries' && key !== 'watermarks');

function rejectRowContent(value: Json, pointer = ''): void {
  if (Array.isArray(value)) value.forEach((item, index) => rejectRowContent(item, `${pointer}/${index}`));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    try { assertNoPrivateSummaryToken(key, pointer || 'export'); }
    catch { throw new Error(`learner row content rejected at ${pointer}/${key}`); }
    rejectRowContent(child, `${pointer}/${key}`);
  }
}

function exactKeys(value: object, expected: string[], context: string): void {
  const observed = Object.keys(value).sort();
  if (observed.length !== expected.length || observed.some((key, index) => key !== expected[index])) throw new Error(`${context} contains caller-authored or missing fields`);
}

export async function loadImmutableExport(
  root: string,
  relativePath: string,
  proofPath: string,
  _drift: Drift[],
  authority: { registryDigest: string; exporterDigest: string },
): Promise<DatabaseSnapshot> {
  const exportFile = path.isAbsolute(relativePath) ? relativePath : path.join(root, relativePath);
  const proofFile = path.isAbsolute(proofPath) ? proofPath : path.join(root, proofPath);
  const bytes = await readFile(exportFile);
  const parsed = JSON.parse(bytes.toString('utf8')) as AggregateDatabaseExport;
  rejectRowContent(parsed as unknown as Json);
  if ('proof' in parsed) throw new Error('caller-declared proof embedded in export is rejected');
  exactKeys(parsed, EXPORT_KEYS, 'aggregate database export');
  parsed.datasets.forEach((dataset) => {
    const expected = 'watermarks' in dataset || 'json_observation_summaries' in dataset ? DATASET_KEYS : LEGACY_DATASET_KEYS;
    exactKeys(dataset, expected, `aggregate database dataset ${dataset.table}`);
  });
  if (!Buffer.from(canonicalJson(parsed as unknown as Json), 'utf8').equals(bytes)) throw new Error('aggregate database export is not canonical JSON');
  assertAggregateExportShape(parsed);
  if (parsed.registry_digest !== authority.registryDigest) throw new Error('aggregate database export registry authority mismatch');
  if (parsed.exporter_digest !== authority.exporterDigest) throw new Error('aggregate database export implementation authority mismatch');
  const proof = JSON.parse(await readFile(proofFile, 'utf8')) as AggregateExportProof;
  rejectRowContent(proof as unknown as Json);
  exactKeys(proof, PROOF_KEYS, 'aggregate database export proof');
  if (proof.proof_format !== DATABASE_PROOF_FORMAT || proof.profile !== 'repeatable_read_read_only') throw new Error('unsupported aggregate database export proof');
  const expectedProof = deriveProof(parsed, bytes);
  if (canonicalJson(proof as unknown as Json) !== canonicalJson(expectedProof as unknown as Json)) throw new Error('aggregate database export proof digest or closure mismatch');
  const datasets: DatabaseDataset[] = parsed.datasets.map((dataset) => ({
    id: dataset.id,
    table: dataset.table,
    count: dataset.count,
    watermark: dataset.watermark,
    watermarks: dataset.watermarks ?? {},
    shape: sortUnique(dataset.shape),
    versions: sortUnique(dataset.versions),
    version_summaries: dataset.version_summaries,
    discriminator_summaries: dataset.discriminator_summaries,
    historical_shape_summaries: dataset.historical_shape_summaries,
    json_observation_summaries: dataset.json_observation_summaries ?? {},
  })).sort((a, b) => a.id.localeCompare(b.id));
  const snapshotId = taggedDigest('database-snapshot-proof/v1', proof.proof_digest);
  return {
    snapshot_id: snapshotId,
    captured_at: proof.generated_at,
    snapshot_proof: proof as SnapshotProof,
    datasets,
    dataset_watermarks: Object.fromEntries(datasets.flatMap((dataset) => [[dataset.id, dataset.watermark], ...Object.entries(dataset.watermarks ?? {}).map(([field, value]) => [`${dataset.id}.${field}`, value] as const)])),
  };
}

export function noDatabaseSnapshot(capturedAt: string, drift: Drift[]): DatabaseSnapshot {
  drift.push({ code: 'DATABASE_SNAPSHOT_REQUIRED', scope: 'database_snapshot', expected: 'immutable_export_or_repeatable_read_read_only', observed: 'absent' });
  const proof: SnapshotProof = { profile: 'immutable_export', export_object_id: 'missing', generated_at: capturedAt, export_digest: 'missing' };
  return { snapshot_id: taggedDigest('database-snapshot-proof/v1', canonicalJson(proof as unknown as Json)), captured_at: capturedAt, snapshot_proof: proof, datasets: [], dataset_watermarks: {} };
}

export function validateDatabaseClosure(snapshot: DatabaseSnapshot, registry: Registry, fixtures: ShapeFixture[] = []): Drift[] {
  const drift: Drift[] = [];
  const byTable = new Map(snapshot.datasets.map((dataset) => [dataset.table, dataset]));
  for (const source of registry.database_sources) {
    const fields = source.fields as Record<string, string[]> ?? {};
    for (const table of source.tables as string[] ?? []) {
      const dataset = byTable.get(table);
      if (!dataset) { drift.push({ code: 'DATABASE_TABLE_SNAPSHOT_MISSING', scope: String(source.id), observed: table }); continue; }
      for (const field of fields[table] ?? []) if (!dataset.shape.includes(field)) drift.push({ code: 'DATABASE_SNAPSHOT_FIELD_MISSING', scope: `${source.id}/${table}`, observed: field });
    }
  }
  const declared = new Set(registry.database_sources.flatMap((source) => source.tables as string[] ?? []));
  for (const dataset of snapshot.datasets) if (!declared.has(dataset.table)) drift.push({ code: 'DATABASE_SNAPSHOT_TABLE_UNDECLARED', scope: dataset.id, observed: dataset.table });
  const compiled = compileDatabaseObservationContracts(registry);
  drift.push(...compiled.drift);
  const collectionFor = (dataset: DatabaseDataset, summary: DatabaseSummaryKind) => summary === 'version'
    ? dataset.version_summaries ?? {}
    : summary === 'discriminator'
      ? dataset.discriminator_summaries ?? {}
      : dataset.historical_shape_summaries ?? {};
  const expectedKeys = new Map<string, Set<string>>();
  for (const contract of compiled.contracts) {
    const dataset = byTable.get(contract.table);
    if (!dataset) continue;
    const collection = collectionFor(dataset, contract.summary);
    const key = `field:${contract.field}`;
    const collectionIdentity = `${contract.table}/${contract.summary}`;
    const expected = expectedKeys.get(collectionIdentity) ?? new Set<string>();
    expected.add(key);
    expectedKeys.set(collectionIdentity, expected);
    if (!(key in collection)) {
      drift.push({ code: 'DATABASE_OBSERVATION_SUMMARY_MISSING', scope: `${contract.table}.${contract.field}`, expected: contract.summary });
      continue;
    }
    const summary = collection[key]!;
    const categories = Object.keys(summary);
    if (categories.length === 0) {
      if (dataset.count > 0 || contract.zeroObservation === 'forbid') {
        drift.push({ code: 'DATABASE_OBSERVATION_EVIDENCE_MISSING', scope: `${contract.table}.${contract.field}`, expected: contract.summary, observed: dataset.count });
      }
      continue;
    }
    const accepted = new Set(contract.accepted);
    for (const category of categories) {
      if (category === '__suppressed__') {
        drift.push({ code: 'DATABASE_SUPPRESSED_CATEGORY_UNCLASSIFIED', scope: `${contract.table}.${contract.field}`, expected: contract.summary, observed: category });
      } else if (!accepted.has(category)) {
        const code = contract.summary === 'version'
          ? 'DATABASE_VERSION_OUTSIDE_CLOSED_SET'
          : contract.summary === 'discriminator'
            ? 'DATABASE_DISCRIMINATOR_OUTSIDE_CLOSED_SET'
            : 'DATABASE_HISTORICAL_SHAPE_OUTSIDE_CLOSED_SET';
        drift.push({ code, scope: `${contract.table}.${contract.field}`, expected: contract.accepted, observed: category });
      }
    }
  }
  for (const dataset of snapshot.datasets) {
    for (const [summary, collection] of [
      ['version', dataset.version_summaries ?? {}],
      ['discriminator', dataset.discriminator_summaries ?? {}],
      ['historical_shape', dataset.historical_shape_summaries ?? {}],
    ] as const) {
      const expected = expectedKeys.get(`${dataset.table}/${summary}`) ?? new Set<string>();
      for (const key of Object.keys(collection)) if (!expected.has(key)) {
        drift.push({ code: 'DATABASE_OBSERVATION_SUMMARY_UNDECLARED', scope: dataset.table, expected: summary, observed: key });
      }
    }
  }
  const jsonCompiled = compileJsonObservationContracts(registry, fixtures);
  drift.push(...jsonCompiled.drift);
  const jsonExpected = new Map<string, { accepted: Set<string>; summary: JsonObservationKind; scope: string }>();
  for (const contract of jsonCompiled.contracts) {
    const key = contract.summary === 'path' ? `path:${contract.field}` : `${contract.summary}:${contract.field}:${contract.selector}`;
    const identity = `${contract.table}/${key}`;
    const current = jsonExpected.get(identity) ?? { accepted: new Set<string>(), summary: contract.summary, scope: `${contract.table}.${contract.field}${contract.selector.slice(1)}` };
    contract.accepted.forEach((value) => current.accepted.add(value));
    jsonExpected.set(identity, current);
  }
  for (const dataset of snapshot.datasets) {
    const summaries = dataset.json_observation_summaries ?? {};
    for (const [identity, contract] of jsonExpected) {
      const [table, key] = identity.split('/', 2);
      if (table !== dataset.table || !key) continue;
      if (!(key in summaries)) {
        drift.push({ code: 'DATABASE_JSON_OBSERVATION_SUMMARY_MISSING', scope: contract.scope, expected: key });
        continue;
      }
      for (const category of Object.keys(summaries[key]!)) if (category === '__suppressed__' || !contract.accepted.has(category)) {
        const code = contract.summary === 'path'
          ? 'DATABASE_JSON_PATH_OUTSIDE_CLOSED_SET'
          : contract.summary === 'root_type'
            ? 'DATABASE_JSON_ROOT_TYPE_OUTSIDE_CLOSED_SET'
          : contract.summary === 'version'
            ? 'DATABASE_JSON_VERSION_OUTSIDE_CLOSED_SET'
            : contract.summary === 'discriminator'
              ? 'DATABASE_JSON_DISCRIMINATOR_OUTSIDE_CLOSED_SET'
              : contract.summary === 'legacy_shape'
                ? 'DATABASE_JSON_LEGACY_SHAPE_OUTSIDE_CLOSED_SET'
                : 'DATABASE_JSON_VERSION_PRESENCE_INVALID';
        drift.push({ code, scope: contract.scope, expected: [...contract.accepted].sort(), observed: category });
      }
    }
    for (const [key, presence] of Object.entries(summaries).filter(([key]) => key.startsWith('version_presence:'))) {
      const suffix = key.slice('version_presence:'.length);
      if ('__present__' in presence && Object.keys(summaries[`version:${suffix}`] ?? {}).length === 0) {
        drift.push({ code: 'DATABASE_JSON_VERSION_EVIDENCE_MISSING', scope: `${dataset.table}.${suffix}` });
      }
      if ('__missing__' in presence && Object.keys(summaries[`legacy_shape:${suffix}`] ?? {}).length === 0) {
        drift.push({ code: 'DATABASE_JSON_LEGACY_SHAPE_EVIDENCE_MISSING', scope: `${dataset.table}.${suffix}` });
      }
    }
    const expected = new Set([...jsonExpected.keys()].filter((identity) => identity.startsWith(`${dataset.table}/`)).map((identity) => identity.slice(dataset.table.length + 1)));
    for (const key of Object.keys(summaries)) if (!expected.has(key)) drift.push({ code: 'DATABASE_JSON_OBSERVATION_SUMMARY_UNDECLARED', scope: dataset.table, observed: key });
  }
  const observedVersions = sortUnique(snapshot.datasets.flatMap((dataset) => Object.values(dataset.version_summaries ?? {})
    .flatMap((summary) => Object.keys(summary).filter((category) => !category.startsWith('__')))));
  const listedVersions = sortUnique(snapshot.datasets.flatMap((dataset) => dataset.versions));
  if (canonicalJson(observedVersions as unknown as Json) !== canonicalJson(listedVersions as unknown as Json)) {
    drift.push({ code: 'DATABASE_VERSION_INDEX_MISMATCH', scope: 'database_snapshot', expected: observedVersions, observed: listedVersions });
  }
  return drift;
}
