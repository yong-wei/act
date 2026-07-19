import { createHash, createPrivateKey, createPublicKey, randomUUID, sign } from 'node:crypto';
import { access, link, lstat, mkdir, readFile, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, type ClientBase } from 'pg';
import { Prisma } from '@prisma/client';
import { canonicalJson, sortUnique, taggedDigest } from './normalize';
import { loadRegistry, type Registry } from './registry';
import { canonicalJsonSelector, compileDatabaseObservationContracts, compileJsonObservationContracts, type JsonObservationContract } from './database-observation';
import type { ShapeFixture } from './decoder-validation';
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
  watermarks?: Record<string, string | null>;
  shape: string[];
  versions: string[];
  version_summaries: Record<string, Record<string, SafeCount>>;
  discriminator_summaries: Record<string, Record<string, SafeCount>>;
  historical_shape_summaries: Record<string, Record<string, SafeCount>>;
  json_observation_summaries?: Record<string, Record<string, SafeCount>>;
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
  shared_snapshot_import_count: 0;
  signature_algorithm: 'Ed25519';
  signing_key_id: string;
  signing_key_fingerprint: string;
  signature: string;
}

interface ExportOptions {
  root: string;
  registryPath: string;
  databaseUrl: string;
  outputPath: string;
  proofPath: string;
  signingPrivateKeyPath?: string;
  signingKeyId?: string;
}

interface TableContract {
  table: string;
  fields: string[];
  watermarkFields: string[];
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
const SAFE_CATEGORY = /^[\p{L}\p{N}_.:+@/\[\]$*-]{1,256}$/u;
const CANONICAL_WATERMARK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u;
const PRIVATE_SUMMARY_TOKEN = /^(?:userid|answer|answers|payload|eventpayload|eventspayload|row|rows|rawrowdigest|reversiblekey|description|reasoning|sourceinputdigest)$/iu;
const SUMMARY_FIELD = '[A-Za-z_][A-Za-z0-9_]*';
const SUMMARY_LOCATOR = new RegExp(`^${SUMMARY_FIELD}$|^(?:field|path):${SUMMARY_FIELD}$|^(?:version|discriminator|root_type|version_presence|legacy_shape):${SUMMARY_FIELD}:selector_[0-9a-f]{64}$`, 'u');

function exactSha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export async function currentDatabaseExportAuthority(root: string, registryPath: string): Promise<{ registryDigest: string; exporterDigest: string }> {
  return {
    registryDigest: exactSha256(await readFile(path.join(root, registryPath))),
    exporterDigest: exactSha256(await readFile(fileURLToPath(import.meta.url))),
  };
}

export function assertPublicSummaryLocator(locator: string, context: string): void {
  if (!SUMMARY_LOCATOR.test(locator)) throw new Error(`unknown summary locator rejected: ${context}.${locator}`);
  assertNoPrivateSummaryToken(locator, context);
}

export function assertNoPrivateSummaryToken(value: string, context: string): void {
  const tokens = value
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  const compact = tokens.join('');
  const locatorPayload = tokens.length > 1 && ['field', 'path', 'version', 'discriminator', 'root', 'root_type', 'version_presence', 'legacy_shape'].includes(tokens[0]!) ? tokens.slice(1).join('') : compact;
  if (tokens.some((token) => PRIVATE_SUMMARY_TOKEN.test(token)) || PRIVATE_SUMMARY_TOKEN.test(compact) || PRIVATE_SUMMARY_TOKEN.test(locatorPayload)) throw new Error(`private summary field rejected: ${context}.${value}`);
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

export function latestWatermark(watermarks: Record<string, string | null>): string | null {
  return Object.values(watermarks).filter((value): value is string => value !== null).sort().at(-1) ?? null;
}

function watermarkExpression(column: string, dataType: string): string {
  const field = quoteIdentifier(column);
  const format = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;
  if (dataType === 'date') return `to_char(max(${field})::timestamp, ${format})`;
  if (dataType === 'timestamp without time zone') return `to_char(max(${field}), ${format})`;
  if (dataType === 'timestamp with time zone') return `to_char(max(${field}) AT TIME ZONE 'UTC', ${format})`;
  throw new Error(`unsupported watermark column type: ${column} (${dataType})`);
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

export function contractsFromRegistry(registry: Registry): TableContract[] {
  const fields = new Map<string, Set<string>>();
  const watermarks = new Map<string, Set<string>>();
  const versions = new Map<string, Set<string>>();
  const jsonFields = new Map<string, Set<string>>();
  const observations = compileDatabaseObservationContracts(registry);
  if (observations.drift.length > 0) throw new Error(`invalid database observation contracts: ${observations.drift.map((item) => item.code).join(', ')}`);
  for (const observation of observations.contracts.filter((item) => item.summary === 'version')) {
    const target = versions.get(observation.table) ?? new Set<string>();
    target.add(observation.field);
    versions.set(observation.table, target);
  }
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
      watermarkFields: watermarkCandidates.length > 0 ? watermarkCandidates : [['updatedAt', 'createdAt', 'snapshotAt', 'submittedAt', 'startedAt'].find((field) => declaredFields.includes(field))].filter((field): field is string => Boolean(field)),
      versionFields: sortUnique([...(versions.get(table) ?? []), ...declaredFields.filter((field) => /(?:schema|payload|calculation|migration|materialization|extraction)?version$/iu.test(field))]),
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

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function jsonWalkSql(table: string, field: string, selectors: string[]): string {
  const edges = new Map<string, Set<string>>();
  for (const selector of selectors) {
    let parent = '$';
    for (const segment of selector.slice(1).split('/').filter(Boolean)) {
      if (segment.startsWith('k:')) {
        const keys = edges.get(parent) ?? new Set<string>();
        keys.add(segment.slice(2));
        edges.set(parent, keys);
      }
      parent += `/${segment}`;
    }
  }
  const known = [...edges].map(([parent, keys]) => `(walk.path = ${quoteLiteral(parent)} AND entry.key IN (${[...keys].sort().map(quoteLiteral).join(', ')}))`).join(' OR ') || 'FALSE';
  return `WITH RECURSIVE walk(path, value, terminal_key) AS (
    SELECT '$'::text, ${quoteIdentifier(field)}::jsonb, NULL::text FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(field)} IS NOT NULL
    UNION ALL
    SELECT walk.path || child.segment, child.value, child.terminal_key
    FROM walk
    CROSS JOIN LATERAL (
      SELECT CASE WHEN ${known} THEN '/k:' || entry.key ELSE '/d' END AS segment, entry.value, entry.key AS terminal_key
      FROM jsonb_each(CASE WHEN jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END) AS entry
      UNION ALL
      SELECT '/a' AS segment, item.value, NULL::text AS terminal_key
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(walk.value) = 'array' THEN walk.value ELSE '[]'::jsonb END) AS item(value)
    ) AS child
  )`;
}

async function groupedJsonPathSummary(client: ClientBase, table: string, field: string, selectors: string[], monitoredKeys: string[]): Promise<{ summary: Record<string, SafeCount>; plan: string }> {
  const declared = selectors.length > 0 ? ` OR path IN (${selectors.map(quoteLiteral).join(', ')})` : '';
  const monitored = monitoredKeys.length > 0 ? ` OR terminal_key IN (${monitoredKeys.map(quoteLiteral).join(', ')})` : '';
  const sql = `${jsonWalkSql(table, field, selectors)} SELECT path AS category, count(*)::text AS count FROM walk WHERE terminal_key ~ '(?:Id|Ids)$'${monitored}${declared} GROUP BY 1 ORDER BY 1`;
  const [result, plan] = await Promise.all([client.query(sql), explainDigest(client, sql)]);
  const opaqueRows = (result.rows as Array<{ category: unknown; count: unknown }>).map((row) => ({ ...row, category: jsonPathCategoryKey(String(row.category)) }));
  return { summary: suppressRows(opaqueRows), plan };
}

async function groupedJsonValueSummary(client: ClientBase, table: string, field: string, selector: string, accepted: string[]): Promise<{ summary: Record<string, SafeCount>; plan: string }> {
  const allowed = accepted.map(quoteLiteral).join(', ');
  const scalar = "COALESCE(value #>> '{}', '__null__')";
  const category = allowed.length > 0 ? `CASE WHEN ${scalar} IN (${allowed}) THEN ${scalar} ELSE '__unknown_value__' END` : "'__unknown_value__'";
  const canonicalSelector = canonicalJsonSelector(selector);
  const sql = `${jsonWalkSql(table, field, [canonicalSelector])} SELECT ${category} AS category, count(*)::text AS count FROM walk WHERE path = ${quoteLiteral(canonicalSelector)} GROUP BY 1 ORDER BY 1`;
  const [result, plan] = await Promise.all([client.query(sql), explainDigest(client, sql)]);
  return { summary: suppressRows(result.rows as Array<{ category: unknown; count: unknown }>), plan };
}

function versionSelectorParts(selector: string): { root: string; key: string } {
  const match = /^(.*)\.([A-Za-z_][A-Za-z0-9_]*)$/u.exec(selector);
  if (!match) throw new Error(`invalid JSON version selector: ${selector}`);
  return { root: match[1] || '$', key: match[2]! };
}

function jsonDecoderRootsSql(table: string, field: string, selector: string, applicability: 'any' | 'object_only' = 'any'): string {
  const { root } = versionSelectorParts(selector);
  canonicalJsonSelector(root);
  const applicabilitySql = applicability === 'object_only' ? " AND jsonb_typeof(target.value) = 'object'" : '';
  return `SELECT row_number() OVER () AS root_id, target.value AS value
    FROM ${quoteIdentifier(table)}
    CROSS JOIN LATERAL jsonb_path_query(${quoteIdentifier(field)}::jsonb, ${quoteLiteral(`strict ${root}`)}::jsonpath, '{}'::jsonb, true) AS target(value)
    WHERE ${quoteIdentifier(field)} IS NOT NULL${applicabilitySql}`;
}

async function groupedJsonVersionPresenceSummary(client: ClientBase, table: string, field: string, selector: string, applicability: 'any' | 'object_only'): Promise<{ summary: Record<string, SafeCount>; plan: string }> {
  const { key } = versionSelectorParts(selector);
  const sql = `WITH roots AS (${jsonDecoderRootsSql(table, field, selector, applicability)})
    SELECT CASE WHEN jsonb_typeof(value) <> 'object' THEN '__invalid_root__' WHEN jsonb_typeof(value -> ${quoteLiteral(key)}) = 'string' THEN '__present__' ELSE '__missing__' END AS category, count(*)::text AS count
    FROM roots GROUP BY 1 ORDER BY 1`;
  const [result, plan] = await Promise.all([client.query(sql), explainDigest(client, sql)]);
  return { summary: suppressRows(result.rows as Array<{ category: unknown; count: unknown }>), plan };
}

async function groupedJsonLegacyShapeSummary(client: ClientBase, table: string, field: string, selector: string, applicability: 'any' | 'object_only'): Promise<{ summary: Record<string, SafeCount>; plan: string }> {
  const { key } = versionSelectorParts(selector);
  const tag = 'synthetic-payload-shape/v2';
  const sql = `WITH RECURSIVE roots AS (${jsonDecoderRootsSql(table, field, selector, applicability)}),
    missing AS (SELECT root_id, value FROM roots WHERE jsonb_typeof(value) = 'object' AND jsonb_typeof(value -> ${quoteLiteral(key)}) IS DISTINCT FROM 'string'),
    walk(root_id, path, value) AS (
      SELECT root_id, '$'::text, value FROM missing
      UNION ALL
      SELECT walk.root_id, walk.path || child.segment, child.value
      FROM walk
      CROSS JOIN LATERAL (
        SELECT '/' || to_jsonb(entry.key)::text AS segment, entry.value
        FROM jsonb_each(CASE WHEN jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END) AS entry
        UNION ALL
        SELECT '/[]' AS segment, item.value
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(walk.value) = 'array' THEN walk.value ELSE '[]'::jsonb END) AS item(value)
      ) AS child
    ), descriptors AS (
      SELECT DISTINCT root_id, path || E'\\t' || jsonb_typeof(value) AS descriptor FROM walk
    ), signatures AS (
      SELECT root_id, string_agg(descriptor, E'\\n' ORDER BY descriptor COLLATE "C") AS signature FROM descriptors GROUP BY root_id
    ), shapes AS (
      SELECT 'sha256:' || encode(sha256(
        convert_to(${quoteLiteral(tag)}, 'UTF8') || decode('00', 'hex') ||
        convert_to(octet_length(convert_to(signature, 'UTF8'))::text, 'UTF8') || decode('00', 'hex') ||
        convert_to(signature, 'UTF8')
      ), 'hex') AS category
      FROM signatures
    ) SELECT category, count(*)::text AS count FROM shapes GROUP BY 1 ORDER BY 1`;
  const [result, plan] = await Promise.all([client.query(sql), explainDigest(client, sql)]);
  return { summary: suppressRows(result.rows as Array<{ category: unknown; count: unknown }>), plan };
}

async function groupedJsonRootTypeSummary(client: ClientBase, table: string, field: string, selector: string): Promise<{ summary: Record<string, SafeCount>; plan: string }> {
  canonicalJsonSelector(selector);
  const sql = `SELECT COALESCE(jsonb_typeof(target.value), '__null__') AS category, count(*)::text AS count
    FROM ${quoteIdentifier(table)}
    CROSS JOIN LATERAL jsonb_path_query(${quoteIdentifier(field)}::jsonb, ${quoteLiteral(`strict ${selector}`)}::jsonpath, '{}'::jsonb, true) AS target(value)
    WHERE ${quoteIdentifier(field)} IS NOT NULL GROUP BY 1 ORDER BY 1`;
  const [result, plan] = await Promise.all([client.query(sql), explainDigest(client, sql)]);
  return { summary: suppressRows(result.rows as Array<{ category: unknown; count: unknown }>), plan };
}

export function jsonSummaryKey(contract: Pick<JsonObservationContract, 'summary' | 'field' | 'selector'>): string {
  const field = fieldSummaryToken(contract.field);
  if (contract.summary === 'path') return `path:${field}`;
  const selectorDigest = createHash('sha256').update(contract.selector, 'utf8').digest('hex');
  return `${contract.summary}:${field}:selector_${selectorDigest}`;
}

function fieldSummaryToken(field: string): string {
  return `column_${createHash('sha256').update(field, 'utf8').digest('hex')}`;
}

export function fieldSummaryKey(field: string): string { return `field:${fieldSummaryToken(field)}`; }

export function jsonPathCategoryKey(category: string): string {
  return `path_${createHash('sha256').update('json-path-category/v1\0', 'utf8').update(category.normalize('NFC'), 'utf8').digest('hex')}`;
}

async function prospectiveRealPath(target: string): Promise<string> {
  const parent = path.dirname(target);
  const suffix: string[] = [];
  let candidate = parent;
  while (true) {
    try {
      const existing = await realpath(candidate);
      return path.join(existing, ...suffix, path.basename(target));
    } catch {
      const next = path.dirname(candidate);
      if (next === candidate) throw new Error(`unable to resolve database export target ancestor: ${target}`);
      suffix.unshift(path.basename(candidate));
      candidate = next;
    }
  }
}

interface InspectedExportTarget {
  resolvedPath: string;
  exists: boolean;
  device: number | null;
  inode: number | null;
}

async function inspectExportTarget(target: string): Promise<InspectedExportTarget> {
  try { await lstat(target); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { resolvedPath: await prospectiveRealPath(target), exists: false, device: null, inode: null };
  }
  let resolvedPath: string;
  try { resolvedPath = await realpath(target); }
  catch { throw new Error(`database export target must resolve to an existing file: ${target}`); }
  const metadata = await stat(target);
  return { resolvedPath, exists: true, device: metadata.dev, inode: metadata.ino };
}

async function assertOutsideRepository(root: string, target: string, resolvedTarget: string): Promise<void> {
  if (!path.isAbsolute(target)) throw new Error('database export and proof paths must be absolute');
  const repository = await realpath(root);
  if (resolvedTarget === repository || resolvedTarget.startsWith(`${repository}${path.sep}`)) throw new Error(`database export artifact must be outside repository: ${target}`);
  let ancestor = path.dirname(resolvedTarget);
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

export function proofCore(exported: AggregateDatabaseExport, exportDigest: string): Omit<AggregateExportProof, 'proof_digest' | 'export_object_id' | 'signature_algorithm' | 'signing_key_id' | 'signing_key_fingerprint' | 'signature'> {
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
    shared_snapshot_import_count: 0,
  };
}

export function deriveProof(exported: AggregateDatabaseExport, exportBytes: Buffer, signer: { privateKey: string | Buffer; keyId: string }): AggregateExportProof {
  const exportDigest = exactSha256(exportBytes);
  const core = proofCore(exported, exportDigest);
  const proofDigest = taggedDigest('database-export-proof/v1', canonicalJson(core as unknown as Json));
  const exportObjectId = taggedDigest('database-export-object/v1', `${exportDigest}\n${proofDigest}\n`);
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(signer.keyId)) throw new Error('invalid database proof signing key id');
  const privateKey = createPrivateKey(signer.privateKey);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('database proof signing key must be Ed25519');
  const publicDer = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const signingKeyFingerprint = exactSha256(publicDer);
  const unsigned = { ...core, proof_digest: proofDigest, export_object_id: exportObjectId, signature_algorithm: 'Ed25519' as const, signing_key_id: signer.keyId, signing_key_fingerprint: signingKeyFingerprint };
  const payload = Buffer.from(canonicalJson(unsigned as unknown as Json), 'utf8');
  return { ...unsigned, signature: sign(null, payload, privateKey).toString('base64') };
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
    if (dataset.watermarks) {
      if (dataset.watermark !== null && !CANONICAL_WATERMARK.test(dataset.watermark)) throw new Error(`invalid dataset watermark: ${dataset.table}`);
      for (const [field, value] of Object.entries(dataset.watermarks)) if (value !== null && !CANONICAL_WATERMARK.test(value)) throw new Error(`invalid dataset watermark: ${dataset.table}.${field}`);
      if (dataset.watermark !== latestWatermark(dataset.watermarks)) throw new Error(`aggregate database export watermark compatibility mismatch: ${dataset.table}`);
    } else if (dataset.watermark !== null && !Number.isFinite(Date.parse(dataset.watermark))) throw new Error(`invalid dataset watermark: ${dataset.table}`);
    for (const collection of [dataset.version_summaries, dataset.discriminator_summaries, dataset.historical_shape_summaries, dataset.json_observation_summaries ?? {}]) for (const [field, summary] of Object.entries(collection)) {
      assertPublicSummaryLocator(field, dataset.table);
      for (const [category, count] of Object.entries(summary)) {
        if (category === '__suppressed__') { if (count !== 'suppressed') throw new Error(`invalid suppression marker: ${dataset.table}.${field}`); continue; }
        assertNoPrivateSummaryToken(category, `${dataset.table}.${field}`);
        if (!SAFE_CATEGORY.test(category) && category !== '__null__' && category !== '__non_public_category__') throw new Error(`unsafe summary category: ${dataset.table}.${field}`);
        if (count !== 'suppressed' && (!Number.isSafeInteger(count) || count < MIN_GROUP_SIZE)) throw new Error(`unsuppressed small cell rejected: ${dataset.table}.${field}`);
      }
    }
    for (const [field, summary] of Object.entries(dataset.historical_shape_summaries)) for (const category of Object.keys(summary)) {
      if (!['__null__', '__suppressed__', 'array', 'boolean', 'number', 'object', 'string'].includes(category)) throw new Error(`unknown historical shape class: ${dataset.table}.${field}.${category}`);
    }
  }
}

export async function publishExportArtifacts(outputPath: string, outputBytes: Buffer, proofPath: string, proofBytes: Buffer): Promise<void> {
  const outputTemp = path.join(path.dirname(outputPath), `.${path.basename(outputPath)}.${randomUUID()}.tmp`);
  const proofTemp = path.join(path.dirname(proofPath), `.${path.basename(proofPath)}.${randomUUID()}.tmp`);
  let outputPublished = false;
  try {
    await writeFile(outputTemp, outputBytes, { flag: 'wx', mode: 0o600 });
    await writeFile(proofTemp, proofBytes, { flag: 'wx', mode: 0o600 });
    await link(outputTemp, outputPath);
    outputPublished = true;
    await link(proofTemp, proofPath);
  } catch (error) {
    if (outputPublished) {
      const [published, temporary] = await Promise.all([lstat(outputPath).catch(() => null), lstat(outputTemp).catch(() => null)]);
      if (published && temporary && published.dev === temporary.dev && published.ino === temporary.ino) await unlink(outputPath);
    }
    throw error;
  } finally {
    await Promise.all([unlink(outputTemp).catch(() => undefined), unlink(proofTemp).catch(() => undefined)]);
  }
}

export async function exportAggregateDatabase(options: ExportOptions): Promise<{ exported: AggregateDatabaseExport; proof: AggregateExportProof }> {
  if (!path.isAbsolute(options.outputPath) || !path.isAbsolute(options.proofPath)) throw new Error('database export and proof paths must be absolute');
  const outputTarget = await inspectExportTarget(options.outputPath);
  const proofTarget = await inspectExportTarget(options.proofPath);
  await assertOutsideRepository(options.root, options.outputPath, outputTarget.resolvedPath);
  await assertOutsideRepository(options.root, options.proofPath, proofTarget.resolvedPath);
  const sameInode = outputTarget.exists && proofTarget.exists
    && outputTarget.device === proofTarget.device && outputTarget.inode === proofTarget.inode;
  if (outputTarget.resolvedPath === proofTarget.resolvedPath || sameInode) throw new Error('database export and proof paths must differ');
  if (outputTarget.exists || proofTarget.exists) throw new Error('database export artifacts already exist; overwrite is forbidden');
  const registry = await loadRegistry(options.root, options.registryPath);
  const contracts = contractsFromRegistry(registry);
  const fixtureFile = JSON.parse(await readFile(path.join(options.root, 'scripts/knowledge-governance/input-inventory/fixtures/synthetic-history-payload-shapes.json'), 'utf8')) as { fixtures: ShapeFixture[] };
  const jsonObservations = compileJsonObservationContracts(registry, fixtureFile.fixtures);
  if (jsonObservations.drift.length > 0) throw new Error(`invalid database JSON observation contracts: ${jsonObservations.drift.map((item) => item.code).join(', ')}`);
  if (contracts.length !== 37) throw new Error(`declared database table count mismatch: expected 37, observed ${contracts.length}`);
  for (const contract of contracts) {
    for (const field of [...contract.versionFields, ...contract.discriminatorFields, ...contract.jsonFields]) assertPublicSummaryLocator(fieldSummaryKey(field), contract.table);
  }
  for (const contract of jsonObservations.contracts) {
    assertPublicSummaryLocator(jsonSummaryKey(contract), contract.table);
  }
  const registryBytes = await readFile(path.join(options.root, options.registryPath));
  const exporterBytes = await readFile(fileURLToPath(import.meta.url));
  const prismaModels = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
  for (const contract of contracts) {
    const model = prismaModels.get(contract.table);
    if (!model) throw new Error(`declared database model missing from Prisma DMMF: ${contract.table}`);
    for (const field of contract.fields) if (!model.fields.some((candidate) => candidate.name === field)) throw new Error(`declared database field missing from Prisma DMMF: ${contract.table}.${field}`);
  }
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await mkdir(path.dirname(options.proofPath), { recursive: true });
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
    const columnTypes = new Map<string, string>();
    for (const row of columns.rows as Array<{ table_name: string; column_name: string; data_type: string }>) { const target = columnsByTable.get(row.table_name) ?? new Set<string>(); target.add(row.column_name); columnsByTable.set(row.table_name, target); columnTypes.set(`${row.table_name}.${row.column_name}`, row.data_type); }
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
      const watermarkSql = contract.watermarkFields.map((field, index) => {
        const modelField = prismaModels.get(contract.table)!.fields.find((candidate) => candidate.name === field)!;
        const column = modelField.dbName ?? field;
        return `, ${watermarkExpression(column, columnTypes.get(`${contract.table}.${column}`) ?? '')} AS watermark_${index}`;
      }).join('');
      const countSql = `SELECT count(*)::text AS count${watermarkSql} FROM ${tableSql}`;
      const [aggregate, countPlan] = await Promise.all([client.query(countSql), explainDigest(client, countSql)]);
      planDigests.push(countPlan);
      const versionSummaries: Record<string, Record<string, SafeCount>> = {};
      const discriminatorSummaries: Record<string, Record<string, SafeCount>> = {};
      const historicalShapeSummaries: Record<string, Record<string, SafeCount>> = {};
      const jsonObservationSummaries: Record<string, Record<string, SafeCount>> = {};
      for (const field of contract.versionFields) { const result = await groupedSummary(client, contract.table, field); versionSummaries[fieldSummaryKey(field)] = result.summary; planDigests.push(result.plan); }
      for (const field of contract.discriminatorFields) { const result = await groupedSummary(client, contract.table, field); discriminatorSummaries[fieldSummaryKey(field)] = result.summary; planDigests.push(result.plan); }
      for (const field of contract.jsonFields) { const result = await groupedSummary(client, contract.table, field, `jsonb_typeof(${quoteIdentifier(field)}::jsonb)`); historicalShapeSummaries[fieldSummaryKey(field)] = result.summary; planDigests.push(result.plan); }
      const tableJsonContracts = jsonObservations.contracts.filter((item) => item.table === contract.table);
      for (const field of sortUnique(tableJsonContracts.map((item) => item.field))) {
        const fieldContracts = tableJsonContracts.filter((item) => item.field === field);
        const pathSelectors = sortUnique(fieldContracts.filter((item) => item.summary === 'path').flatMap((item) => item.accepted));
        const monitoredKeys = sortUnique(fieldContracts.filter((item) => item.summary === 'version' || item.summary === 'discriminator').map((item) => /\.([A-Za-z_][A-Za-z0-9_]*)$/u.exec(item.selector)?.[1]).filter((item): item is string => Boolean(item)));
        const paths = await groupedJsonPathSummary(client, contract.table, field, pathSelectors, monitoredKeys);
        jsonObservationSummaries[jsonSummaryKey({ summary: 'path', field, selector: '$' })] = paths.summary;
        planDigests.push(paths.plan);
        for (const item of fieldContracts.filter((candidate) => candidate.summary !== 'path')) {
          const applicability = item.applicability ?? 'any';
          const result = item.summary === 'root_type'
            ? await groupedJsonRootTypeSummary(client, contract.table, field, item.selector)
            : item.summary === 'version_presence'
            ? await groupedJsonVersionPresenceSummary(client, contract.table, field, item.selector, applicability)
            : item.summary === 'legacy_shape'
              ? await groupedJsonLegacyShapeSummary(client, contract.table, field, item.selector, applicability)
              : await groupedJsonValueSummary(client, contract.table, field, item.selector, item.accepted);
          jsonObservationSummaries[jsonSummaryKey(item)] = result.summary;
          planDigests.push(result.plan);
        }
      }
      const row = aggregate.rows[0] as Record<string, unknown>;
      const watermarks = Object.fromEntries(contract.watermarkFields.map((field, index) => [field, row[`watermark_${index}`] == null ? null : String(row[`watermark_${index}`])])) as Record<string, string | null>;
      const watermark = latestWatermark(watermarks);
      datasets.push({
        id: `postgres-aggregate:${contract.table}`,
        table: contract.table,
        count: integer(row.count, contract.table),
        watermark,
        watermarks,
        shape: contract.fields,
        versions: sortUnique(Object.values(versionSummaries).flatMap((summary) => Object.keys(summary).filter((value) => !value.startsWith('__')))),
        version_summaries: versionSummaries,
        discriminator_summaries: discriminatorSummaries,
        historical_shape_summaries: historicalShapeSummaries,
        json_observation_summaries: jsonObservationSummaries,
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
    if (!options.signingPrivateKeyPath || !options.signingKeyId) throw new Error('database proof Ed25519 signing private key path and key id are required');
    const proof = deriveProof(exported, exportBytes, { privateKey: await readFile(options.signingPrivateKeyPath), keyId: options.signingKeyId });
    await publishExportArtifacts(options.outputPath, exportBytes, options.proofPath, Buffer.from(canonicalJson(proof as unknown as Json), 'utf8'));
    return { exported, proof };
  } finally {
    if (began) await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}
