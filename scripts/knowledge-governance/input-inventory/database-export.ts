import { createHash } from 'node:crypto';
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, type ClientBase } from 'pg';
import { Prisma } from '@prisma/client';
import { canonicalJson, sortUnique, taggedDigest } from './normalize';
import { loadRegistry, type Registry } from './registry';
import type { Json } from './types';

export const DATABASE_EXPORT_FORMAT = 'course-knowledge-database-aggregate-export/v1';
export const DATABASE_PROOF_FORMAT = 'course-knowledge-database-export-proof/v1';
export const MIN_GROUP_SIZE = 5;

type SafeCount = number | 'suppressed';

export interface AggregateDatasetExport {
  id: string;
  table: string;
  count: number;
  watermark: string | null;
  shape: string[];
  versions: string[];
  version_summaries: Record<string, Record<string, SafeCount>>;
  discriminator_summaries: Record<string, Record<string, SafeCount>>;
  historical_shape_summaries: Record<string, Record<string, SafeCount>>;
}

export interface AggregateDatabaseExport {
  format_version: typeof DATABASE_EXPORT_FORMAT;
  captured_at: string;
  source_identity_digest: string;
  postgres_version: string;
  schema_name: string;
  schema_digest: string;
  migration_head: string;
  registry_digest: string;
  exporter_digest: string;
  query_plan_digest: string;
  transaction_isolation: 'repeatable read';
  transaction_read_only: true;
  transaction_started_at: string;
  exported_snapshot_token: string;
  declared_table_count: number;
  datasets: AggregateDatasetExport[];
}

export interface AggregateExportProof {
  proof_format: typeof DATABASE_PROOF_FORMAT;
  profile: 'repeatable_read_read_only';
  generated_at: string;
  export_digest: string;
  proof_digest: string;
  export_object_id: string;
  source_identity_digest: string;
  schema_digest: string;
  migration_head: string;
  registry_digest: string;
  exporter_digest: string;
  query_plan_digest: string;
  transaction_isolation: 'repeatable read';
  transaction_read_only: true;
  transaction_started_at: string;
  exported_snapshot_token: string;
  shared_snapshot_import_count: 1;
}

interface ExportOptions {
  root: string;
  registryPath: string;
  databaseUrl: string;
  outputPath: string;
  proofPath: string;
}

interface TableContract {
  table: string;
  fields: string[];
  watermarkField: string | null;
  versionFields: string[];
  discriminatorFields: string[];
  jsonFields: string[];
}

const DISCRIMINATOR_FIELDS = new Set([
  'actionType', 'actorRole', 'derivationKind', 'eventType', 'extractionState', 'factType',
  'flagType', 'isActive', 'isCompleted', 'isPublic', 'isResolved', 'itemType', 'kind',
  'mimeType', 'nodeType', 'recType', 'recordType', 'relation', 'reviewState', 'riskLevel',
  'severity', 'sourceType', 'stage', 'subjectKind', 'teacherOnly', 'type', 'valid',
]);

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SAFE_CATEGORY = /^[\p{L}\p{N}_.:+@/-]{1,128}$/u;

function exactSha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) throw new Error(`unsafe PostgreSQL identifier: ${value}`);
  return `"${value.replaceAll('"', '""')}"`;
}

function integer(value: unknown, context: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`invalid aggregate count for ${context}`);
  return parsed;
}

function timestamp(value: unknown, context: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.valueOf())) throw new Error(`invalid timestamp for ${context}`);
  return date.toISOString();
}

function safeCategory(value: unknown): string {
  const normalized = String(value).normalize('NFC');
  return SAFE_CATEGORY.test(normalized) ? normalized : '__non_public_category__';
}

function suppressRows(rows: Array<{ category: unknown; count: unknown }>): Record<string, SafeCount> {
  const visible = new Map<string, SafeCount>();
  for (const row of rows) {
    const count = integer(row.count, 'summary');
    const category = safeCategory(row.category ?? '__null__');
    if (count < MIN_GROUP_SIZE) visible.set(category, 'suppressed');
    else {
      const current = visible.get(category);
      visible.set(category, typeof current === 'number' ? current + count : count);
    }
  }
  const result: Record<string, SafeCount> = {};
  for (const category of [...visible.keys()].sort()) result[category] = visible.get(category)!;
  return result;
}

function contractsFromRegistry(registry: Registry): TableContract[] {
  const fields = new Map<string, Set<string>>();
  const watermarks = new Map<string, Set<string>>();
  const versions = new Map<string, Set<string>>();
  const jsonFields = new Map<string, Set<string>>();
  for (const source of registry.database_sources) {
    for (const [table, names] of Object.entries((source.fields ?? {}) as Record<string, string[]>)) {
      const target = fields.get(table) ?? new Set<string>();
      names.forEach((name) => target.add(name));
      fields.set(table, target);
    }
    for (const reference of (source.watermark_fields ?? []) as string[]) {
      const [table, field] = reference.split('.');
      if (!table || !field) throw new Error(`invalid watermark field: ${reference}`);
      const target = watermarks.get(table) ?? new Set<string>(); target.add(field); watermarks.set(table, target);
    }
    for (const reference of Object.keys((source.json_selectors ?? {}) as Record<string, unknown>)) {
      const [table, field] = reference.split('.');
      if (!table || !field) continue;
      const target = jsonFields.get(table) ?? new Set<string>(); target.add(field); jsonFields.set(table, target);
    }
    for (const contract of Object.values((source.dataset_contracts ?? {}) as Record<string, Record<string, unknown>>)) {
      const table = typeof contract.table === 'string' ? contract.table : null;
      if (!table) continue;
      if (typeof contract.watermark === 'string') { const target = watermarks.get(table) ?? new Set<string>(); target.add(contract.watermark); watermarks.set(table, target); }
      for (const field of (contract.version_fields ?? []) as string[]) { const target = versions.get(table) ?? new Set<string>(); target.add(field); versions.set(table, target); }
    }
  }
  const declaredTables = sortUnique(registry.database_sources.flatMap((source) => (source.tables ?? []) as string[]));
  return declaredTables.map((table) => {
    const declaredFields = sortUnique([...(fields.get(table) ?? [])]);
    const watermarkCandidates = sortUnique([...(watermarks.get(table) ?? [])]);
    return {
      table,
      fields: declaredFields,
      watermarkField: watermarkCandidates[0] ?? ['updatedAt', 'createdAt', 'snapshotAt', 'submittedAt', 'startedAt'].find((field) => declaredFields.includes(field)) ?? null,
      versionFields: sortUnique([...(versions.get(table) ?? []), ...declaredFields.filter((field) => /(?:^|_)(?:schema|payload|calculation|migration|materialization|extraction)?version$/iu.test(field))]),
      discriminatorFields: declaredFields.filter((field) => DISCRIMINATOR_FIELDS.has(field)),
      jsonFields: sortUnique([...(jsonFields.get(table) ?? [])]),
    };
  });
}

async function explainDigest(client: ClientBase, sql: string): Promise<string> {
  const result = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`);
  return taggedDigest('postgres-query-plan/v1', canonicalJson(result.rows as unknown as Json));
}

async function groupedSummary(client: ClientBase, table: string, field: string, expression?: string): Promise<{ summary: Record<string, SafeCount>; plan: string }> {
  const tableSql = quoteIdentifier(table);
  const fieldSql = quoteIdentifier(field);
  const category = expression ?? `${fieldSql}::text`;
  const sql = `SELECT COALESCE(${category}, '__null__') AS category, count(*)::text AS count FROM ${tableSql} GROUP BY 1 ORDER BY 1`;
  const [result, plan] = await Promise.all([client.query(sql), explainDigest(client, sql)]);
  return { summary: suppressRows(result.rows as Array<{ category: unknown; count: unknown }>), plan };
}

async function assertOutsideRepository(root: string, target: string): Promise<void> {
  if (!path.isAbsolute(target)) throw new Error('database export and proof paths must be absolute');
  const repository = await realpath(root);
  const parent = await realpath(path.dirname(target));
  if (parent === repository || parent.startsWith(`${repository}${path.sep}`)) throw new Error(`database export artifact must be outside repository: ${target}`);
  let ancestor = parent;
  while (true) {
    try { await access(path.join(ancestor, '.git')); throw new Error(`database export artifact must be outside every Git worktree: ${target}`); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('database export artifact')) throw error;
    }
    const next = path.dirname(ancestor);
    if (next === ancestor) break;
    ancestor = next;
  }
}

export function proofCore(exported: AggregateDatabaseExport, exportDigest: string): Omit<AggregateExportProof, 'proof_digest' | 'export_object_id'> {
  return {
    proof_format: DATABASE_PROOF_FORMAT,
    profile: 'repeatable_read_read_only',
    generated_at: exported.captured_at,
    export_digest: exportDigest,
    source_identity_digest: exported.source_identity_digest,
    schema_digest: exported.schema_digest,
    migration_head: exported.migration_head,
    registry_digest: exported.registry_digest,
    exporter_digest: exported.exporter_digest,
    query_plan_digest: exported.query_plan_digest,
    transaction_isolation: exported.transaction_isolation,
    transaction_read_only: exported.transaction_read_only,
    transaction_started_at: exported.transaction_started_at,
    exported_snapshot_token: exported.exported_snapshot_token,
    shared_snapshot_import_count: 1,
  };
}

export function deriveProof(exported: AggregateDatabaseExport, exportBytes: Buffer): AggregateExportProof {
  const exportDigest = exactSha256(exportBytes);
  const core = proofCore(exported, exportDigest);
  const proofDigest = taggedDigest('database-export-proof/v1', canonicalJson(core as unknown as Json));
  const exportObjectId = taggedDigest('database-export-object/v1', `${exportDigest}\n${proofDigest}\n`);
  return { ...core, proof_digest: proofDigest, export_object_id: exportObjectId };
}

export function assertAggregateExportShape(exported: AggregateDatabaseExport): void {
  if (exported.format_version !== DATABASE_EXPORT_FORMAT) throw new Error('unsupported aggregate database export format');
  if (!DIGEST.test(exported.source_identity_digest) || !DIGEST.test(exported.schema_digest) || !DIGEST.test(exported.registry_digest) || !DIGEST.test(exported.exporter_digest) || !DIGEST.test(exported.query_plan_digest)) throw new Error('invalid aggregate database export digest');
  if (exported.transaction_isolation !== 'repeatable read' || exported.transaction_read_only !== true) throw new Error('aggregate database export is not repeatable-read read-only');
  if (exported.captured_at !== exported.transaction_started_at || !Number.isFinite(Date.parse(exported.captured_at))) throw new Error('aggregate database export transaction time mismatch');
  if (!/^[0-9A-F]+-[0-9A-F]+-[0-9]+$/iu.test(exported.exported_snapshot_token)) throw new Error('invalid PostgreSQL exported snapshot token');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(exported.schema_name) || !/^[A-Za-z0-9_.+-]+$/u.test(exported.postgres_version) || !/^[A-Za-z0-9_]+$/u.test(exported.migration_head)) throw new Error('unsafe database metadata');
  if (exported.declared_table_count !== exported.datasets.length || new Set(exported.datasets.map((dataset) => dataset.table)).size !== exported.datasets.length) throw new Error('aggregate database export table closure mismatch');
  for (const dataset of exported.datasets) {
    if (!Number.isSafeInteger(dataset.count) || dataset.count < 0) throw new Error(`invalid dataset count: ${dataset.table}`);
    if (dataset.watermark !== null && !Number.isFinite(Date.parse(dataset.watermark))) throw new Error(`invalid dataset watermark: ${dataset.table}`);
    for (const collection of [dataset.version_summaries, dataset.discriminator_summaries, dataset.historical_shape_summaries]) for (const [field, summary] of Object.entries(collection)) {
      if (/^(?:userId|user_id|answer|answers|payload|event_payload|events_payload|row|rows|description|reasoning|sourceInputDigest)$/iu.test(field)) throw new Error(`private summary field rejected: ${dataset.table}.${field}`);
      for (const [category, count] of Object.entries(summary)) {
        if (category === '__suppressed__') { if (count !== 'suppressed') throw new Error(`invalid suppression marker: ${dataset.table}.${field}`); continue; }
        if (!SAFE_CATEGORY.test(category) && category !== '__null__' && category !== '__non_public_category__') throw new Error(`unsafe summary category: ${dataset.table}.${field}`);
        if (count !== 'suppressed' && (!Number.isSafeInteger(count) || count < MIN_GROUP_SIZE)) throw new Error(`unsuppressed small cell rejected: ${dataset.table}.${field}`);
      }
    }
    for (const [field, summary] of Object.entries(dataset.historical_shape_summaries)) for (const category of Object.keys(summary)) {
      if (!['__null__', '__suppressed__', 'array', 'boolean', 'number', 'object', 'string'].includes(category)) throw new Error(`unknown historical shape class: ${dataset.table}.${field}.${category}`);
    }
  }
}

export async function exportAggregateDatabase(options: ExportOptions): Promise<{ exported: AggregateDatabaseExport; proof: AggregateExportProof }> {
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await mkdir(path.dirname(options.proofPath), { recursive: true });
  await assertOutsideRepository(options.root, options.outputPath);
  await assertOutsideRepository(options.root, options.proofPath);
  if (path.resolve(options.outputPath) === path.resolve(options.proofPath)) throw new Error('database export and proof paths must differ');

  const registry = await loadRegistry(options.root, options.registryPath);
  const contracts = contractsFromRegistry(registry);
  if (contracts.length !== 37) throw new Error(`declared database table count mismatch: expected 37, observed ${contracts.length}`);
  const registryBytes = await readFile(path.join(options.root, options.registryPath));
  const exporterBytes = await readFile(fileURLToPath(import.meta.url));
  const prismaModels = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
  for (const contract of contracts) {
    const model = prismaModels.get(contract.table);
    if (!model) throw new Error(`declared database model missing from Prisma DMMF: ${contract.table}`);
    for (const field of contract.fields) if (!model.fields.some((candidate) => candidate.name === field)) throw new Error(`declared database field missing from Prisma DMMF: ${contract.table}.${field}`);
  }
  const client = new Client({ connectionString: options.databaseUrl, application_name: 'course-knowledge-aggregate-exporter' });
  await client.connect();
  let began = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    began = true;
    const transaction = await client.query<{ transaction_isolation: string; transaction_read_only: string; transaction_started_at: Date; exported_snapshot_token: string }>(
      "SELECT current_setting('transaction_isolation') AS transaction_isolation, current_setting('transaction_read_only') AS transaction_read_only, transaction_timestamp() AS transaction_started_at, pg_export_snapshot() AS exported_snapshot_token",
    );
    const tx = transaction.rows[0];
    if (!tx || tx.transaction_isolation !== 'repeatable read' || tx.transaction_read_only !== 'on') throw new Error('PostgreSQL refused REPEATABLE READ READ ONLY transaction');
    const identity = await client.query("SELECT current_database() AS database_name, current_schema() AS schema_name, COALESCE(inet_server_addr()::text, 'local') AS server_address, COALESCE(inet_server_port(), 0) AS server_port, current_setting('server_version_num') AS postgres_version");
    const identityRow = identity.rows[0] as Record<string, unknown> | undefined;
    if (!identityRow || typeof identityRow.schema_name !== 'string' || typeof identityRow.postgres_version !== 'string') throw new Error('database identity query returned no row');
    const sourceIdentityDigest = taggedDigest('database-source-identity/v1', canonicalJson(identityRow as Json));
    const tableNames = contracts.map((contract) => contract.table);
    const columns = await client.query(
      'SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ANY($1::text[]) ORDER BY table_name, ordinal_position',
      [tableNames],
    );
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of columns.rows as Array<{ table_name: string; column_name: string }>) { const target = columnsByTable.get(row.table_name) ?? new Set<string>(); target.add(row.column_name); columnsByTable.set(row.table_name, target); }
    for (const contract of contracts) {
      const actual = columnsByTable.get(contract.table);
      if (!actual) throw new Error(`declared database table missing: ${contract.table}`);
      const model = prismaModels.get(contract.table)!;
      for (const field of contract.fields) {
        const dmmfField = model.fields.find((candidate) => candidate.name === field)!;
        if (dmmfField.kind !== 'object' && !actual.has(dmmfField.dbName ?? field)) throw new Error(`declared database field missing: ${contract.table}.${field}`);
      }
    }
    const migration = await client.query<{ migration_name: string }>('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC, migration_name DESC LIMIT 1');
    const migrationHead = migration.rows[0]?.migration_name;
    if (!migrationHead) throw new Error('Prisma migration head is unavailable');

    const datasets: AggregateDatasetExport[] = [];
    const planDigests: string[] = [];
    for (const contract of contracts) {
      const tableSql = quoteIdentifier(contract.table);
      const watermarkSql = contract.watermarkField ? `, max(${quoteIdentifier(contract.watermarkField)})::text AS watermark` : ", NULL::text AS watermark";
      const countSql = `SELECT count(*)::text AS count${watermarkSql} FROM ${tableSql}`;
      const [aggregate, countPlan] = await Promise.all([client.query(countSql), explainDigest(client, countSql)]);
      planDigests.push(countPlan);
      const versionSummaries: Record<string, Record<string, SafeCount>> = {};
      const discriminatorSummaries: Record<string, Record<string, SafeCount>> = {};
      const historicalShapeSummaries: Record<string, Record<string, SafeCount>> = {};
      for (const field of contract.versionFields) { const result = await groupedSummary(client, contract.table, field); versionSummaries[`field:${field}`] = result.summary; planDigests.push(result.plan); }
      for (const field of contract.discriminatorFields) { const result = await groupedSummary(client, contract.table, field); discriminatorSummaries[`field:${field}`] = result.summary; planDigests.push(result.plan); }
      for (const field of contract.jsonFields) { const result = await groupedSummary(client, contract.table, field, `jsonb_typeof(${quoteIdentifier(field)}::jsonb)`); historicalShapeSummaries[`field:${field}`] = result.summary; planDigests.push(result.plan); }
      const row = aggregate.rows[0] as { count: unknown; watermark: unknown };
      datasets.push({
        id: `postgres-aggregate:${contract.table}`,
        table: contract.table,
        count: integer(row.count, contract.table),
        watermark: row.watermark == null ? null : String(row.watermark),
        shape: contract.fields,
        versions: sortUnique(Object.values(versionSummaries).flatMap((summary) => Object.keys(summary).filter((value) => !value.startsWith('__')))),
        version_summaries: versionSummaries,
        discriminator_summaries: discriminatorSummaries,
        historical_shape_summaries: historicalShapeSummaries,
      });
    }
    const capturedAt = timestamp(tx.transaction_started_at, 'transaction start');
    const exported: AggregateDatabaseExport = {
      format_version: DATABASE_EXPORT_FORMAT,
      captured_at: capturedAt,
      source_identity_digest: sourceIdentityDigest,
      postgres_version: String(identityRow.postgres_version),
      schema_name: String(identityRow.schema_name),
      schema_digest: taggedDigest('database-schema/v1', canonicalJson({ columns: columns.rows, dmmf: contracts.map((contract) => ({ table: contract.table, fields: contract.fields.map((field) => { const item = prismaModels.get(contract.table)!.fields.find((candidate) => candidate.name === field)!; return { name: item.name, kind: item.kind, type: item.type, is_list: item.isList, is_required: item.isRequired, db_name: item.dbName ?? null }; }) })) } as unknown as Json)),
      migration_head: migrationHead,
      registry_digest: exactSha256(registryBytes),
      exporter_digest: exactSha256(exporterBytes),
      query_plan_digest: taggedDigest('database-query-plans/v1', canonicalJson(sortUnique(planDigests) as unknown as Json)),
      transaction_isolation: 'repeatable read',
      transaction_read_only: true,
      transaction_started_at: capturedAt,
      exported_snapshot_token: tx.exported_snapshot_token,
      declared_table_count: contracts.length,
      datasets: datasets.sort((a, b) => a.table.localeCompare(b.table)),
    };
    assertAggregateExportShape(exported);
    const exportBytes = Buffer.from(canonicalJson(exported as unknown as Json), 'utf8');
    const proof = deriveProof(exported, exportBytes);
    await writeFile(options.outputPath, exportBytes, { flag: 'wx', mode: 0o600 });
    await writeFile(options.proofPath, canonicalJson(proof as unknown as Json), { flag: 'wx', mode: 0o600 });
    return { exported, proof };
  } finally {
    if (began) await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}
