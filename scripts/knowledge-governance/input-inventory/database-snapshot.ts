import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, sortUnique, taggedDigest } from './normalize';
import type { DatabaseDataset, DatabaseSnapshot, Drift, Json, SnapshotProof } from './types';
import type { Registry } from './registry';

interface ExportDataset {
  id: string;
  table: string;
  count: number;
  watermark?: string | null;
  shape: string[];
  versions?: string[];
  dispositions?: Record<string, number>;
}

interface ImmutableExport { datasets: ExportDataset[]; proof?: never }

const PROHIBITED = /^(userId|description|reasoning|payload|row|rows|raw_row_digest|sourceInputDigest)$/iu;

function rejectRowContent(value: Json, pointer = ''): void {
  if (Array.isArray(value)) value.forEach((item, index) => rejectRowContent(item, `${pointer}/${index}`));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (PROHIBITED.test(key)) throw new Error(`learner row content rejected at ${pointer}/${key}`);
    rejectRowContent(child, `${pointer}/${key}`);
  }
}

function suppress(dispositions: Record<string, number> | undefined): Record<string, number | 'suppressed'> | undefined {
  if (!dispositions) return undefined;
  for (const key of Object.keys(dispositions)) if (/[|/×]/u.test(key)) throw new Error(`cross-dimension aggregate rejected: ${key}`);
  return Object.fromEntries(Object.entries(dispositions).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => [key, count < 5 ? 'suppressed' : count]));
}

export async function loadImmutableExport(root: string, relativePath: string, proofPath: string, _drift: Drift[]): Promise<DatabaseSnapshot> {
  const bytes = await readFile(path.join(root, relativePath));
  const parsed = JSON.parse(bytes.toString('utf8')) as ImmutableExport;
  rejectRowContent(parsed as unknown as Json);
  if ('proof' in parsed) throw new Error('caller-declared proof embedded in export is rejected');
  const proof = JSON.parse(await readFile(path.join(root, proofPath), 'utf8')) as SnapshotProof;
  if (proof.profile !== 'immutable_export' || !proof.export_object_id || !proof.generated_at || !proof.export_digest) throw new Error('incomplete immutable_export proof');
  const observedDigest = taggedDigest('immutable-database-export/v1', canonicalJson({ datasets: parsed.datasets } as unknown as Json));
  if (proof.export_digest !== observedDigest) throw new Error(`external immutable export digest mismatch for ${proof.export_object_id}`);
  const datasets: DatabaseDataset[] = parsed.datasets.map((dataset) => ({
    id: dataset.id,
    table: dataset.table,
    count: dataset.count,
    watermark: dataset.watermark ?? null,
    shape: sortUnique(dataset.shape),
    versions: sortUnique(dataset.versions ?? []),
    dispositions: suppress(dataset.dispositions),
  })).sort((a, b) => a.id.localeCompare(b.id));
  const snapshotId = taggedDigest('database-snapshot-proof/v1', canonicalJson(proof as unknown as Json));
  return {
    snapshot_id: snapshotId,
    captured_at: proof.generated_at,
    snapshot_proof: proof,
    datasets,
    dataset_watermarks: Object.fromEntries(datasets.map((dataset) => [dataset.id, dataset.watermark])),
  };
}

export function noDatabaseSnapshot(capturedAt: string, drift: Drift[]): DatabaseSnapshot {
  drift.push({ code: 'DATABASE_SNAPSHOT_REQUIRED', scope: 'database_snapshot', expected: 'immutable_export_or_repeatable_read_read_only', observed: 'absent' });
  const proof: SnapshotProof = { profile: 'immutable_export', export_object_id: 'missing', generated_at: capturedAt, export_digest: 'missing' };
  return { snapshot_id: taggedDigest('database-snapshot-proof/v1', canonicalJson(proof as unknown as Json)), captured_at: capturedAt, snapshot_proof: proof, datasets: [], dataset_watermarks: {} };
}

export function validateDatabaseClosure(snapshot: DatabaseSnapshot, registry: Registry): Drift[] {
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
  return drift;
}
