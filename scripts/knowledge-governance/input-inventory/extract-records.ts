import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { canonicalJson, normalizeText, taggedDigest } from './normalize';
import { typedDedupe, type TypedRecord } from './records';
import type { DatabaseSnapshot, Drift, Json } from './types';
import type { Registry } from './registry';
import { observationDigest, type FileObservation } from './input-codecs';

function logicalUnits(relative: string, text: string): Array<{ locator: string; schema: string; value: Json; cardinality: number }> {
  if (relative.endsWith('.json') || relative.endsWith('.jsonl')) {
    if (relative.endsWith('.jsonl')) {
      let cardinality = 0;
      let hasContent = false;
      for (let index = 0; index < text.length; index += 1) {
        if (text.charCodeAt(index) === 10) { if (hasContent) cardinality += 1; hasContent = false; }
        else if (![9, 13, 32].includes(text.charCodeAt(index))) hasContent = true;
      }
      if (hasContent) cardinality += 1;
      return [{ locator: `${relative}#records`, schema: 'jsonl-record-set/v1', value: { aggregate_digest: taggedDigest('jsonl-record-set/v1', text) }, cardinality }];
    }
    const value = JSON.parse(text) as Json;
    const cardinality = Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 1;
    return [{ locator: `${relative}#records`, schema: 'json-record-set/v1', value: { aggregate_digest: taggedDigest('json-record-set/v1', canonicalJson(value)) }, cardinality }];
  }
  if (relative.endsWith('.yaml') || relative.endsWith('.yml')) {
    const value = parse(text) as Json;
    const cardinality = Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 1;
    return [{ locator: `${relative}#records`, schema: 'yaml-record-set/v1', value: { aggregate_digest: taggedDigest('yaml-record-set/v1', canonicalJson(value)) }, cardinality }];
  }
  if (relative.endsWith('.md')) {
    const headings = [...text.matchAll(/^(#{1,6})\s+(.+)$/gmu)];
    return [{ locator: `${relative}#sections`, schema: 'markdown-section-set/v1', value: { aggregate_digest: taggedDigest('markdown-section-set/v1', text) }, cardinality: headings.length }];
  }
  return [];
}

export async function extractRecordSets(repository: { sources: Array<Record<string, Json>> }, database: DatabaseSnapshot, registry: Registry, fileMetadata: FileObservation[]): Promise<{ physical: TypedRecord[]; logical: TypedRecord[]; drift: Drift[] }> {
  const physical: TypedRecord[] = [];
  const logical: TypedRecord[] = [];
  const drift: Drift[] = [];
  for (const source of repository.sources) {
    for (const relative of source.physical_paths as string[]) {
    const observations = fileMetadata.filter((item) => item.path === relative);
    for (const metadata of observations) physical.push({ item_kind: String(source.item_kind), identity_namespace: String(source.identity_namespace), source_id: `${source.id}:${metadata.source_root}:${relative}`, source_locator: relative, schema_version: 'declared-file-observation/v1', digest: observationDigest(metadata), state: metadata.state, codec: metadata.codec, media_type: metadata.media_type, size: metadata.size, raw_digest: metadata.raw_digest, ...(metadata.normalized_digest ? { normalized_digest: metadata.normalized_digest } : {}), source_root: metadata.source_root, capture_revision: metadata.capture_revision, vcs_state: metadata.vcs_state, ...(metadata.absence_reason ? { absence_reason: metadata.absence_reason } : {}) });
    const metadata = observations.find((item) => item.source_root === 'isolated-worktree') ?? observations.find((item) => item.source_root === 'main-worktree');
    if (!metadata || metadata.state === 'invalid') continue;
    if (!/\.(?:json|jsonl|ya?ml|md)$/iu.test(relative)) continue;
    const bytes = await readFile(path.join(metadata.filesystem_root, relative));
    let text: string | null = null;
    try { text = normalizeText(bytes); }
    catch (error) {
      drift.push({ code: 'TEXT_NORMALIZATION_FAILED', scope: relative, detail: error instanceof Error ? error.message : String(error) });
      continue;
    }
    if (text !== null) try {
      for (const unit of logicalUnits(relative, text)) logical.push({ item_kind: `${source.item_kind}_logical`, identity_namespace: String(source.identity_namespace), source_id: `${source.id}:${unit.locator}`, source_locator: unit.locator, schema_version: unit.schema, digest: taggedDigest(unit.schema, canonicalJson(unit.value)), cardinality: unit.cardinality });
    } catch (error) { drift.push({ code: 'LOGICAL_RECORD_PARSE_FAILED', scope: relative, detail: error instanceof Error ? error.message : String(error) }); }
    }
  }
  for (const dataset of database.datasets) logical.push({ item_kind: 'database_dataset', identity_namespace: 'database_snapshot', source_id: dataset.id, source_locator: `database:${dataset.table}`, schema_version: 'database-dataset/v1', digest: taggedDigest('database-dataset-schema/v1', canonicalJson({ table: dataset.table, shape: dataset.shape, versions: dataset.versions } as unknown as Json)), cardinality: dataset.count });
  for (const decoder of registry.field_decoders) {
    const sourceField = String(decoder.source_field);
    const table = sourceField.split('.')[0]!;
    const dataset = database.datasets.find((item) => item.table === table);
    logical.push({ item_kind: String(decoder.item_kind), identity_namespace: String(decoder.identity_namespace), source_id: `field-decoder:${sourceField}`, source_locator: `database:${sourceField}`, schema_version: String(decoder.json_decoder ?? 'scalar-field/v1'), digest: taggedDigest('database-field-decoder/v1', canonicalJson(decoder as unknown as Json)), cardinality: dataset?.count ?? 0, state: dataset ? 'observed' : 'missing_snapshot' });
  }
  const dedupedPhysical = typedDedupe(physical);
  const dedupedLogical = typedDedupe(logical);
  return { physical: dedupedPhysical.records, logical: dedupedLogical.records, drift: [...drift, ...dedupedPhysical.drift, ...dedupedLogical.drift] };
}
