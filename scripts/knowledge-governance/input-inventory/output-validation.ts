import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Json } from './types';

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const manifestSchema = z.object({
  schema_version: z.literal('course-knowledge-input-inventory/v1'),
  algorithm_version: z.string(), registry_id: z.string(), normalization_profile: z.string(), captured_at: z.string().datetime(), repository_revision: z.string().regex(/^[0-9a-f]{40}$/u),
  repository: z.record(z.unknown()), repository_files: z.array(z.record(z.unknown())), record_sets: z.record(z.unknown()),
  source_digests: z.array(z.record(z.unknown())), database_source_digests: z.array(z.record(z.unknown())), decoder_digests: z.array(z.record(z.unknown())),
  governance_contract_digest: digest, source_snapshot_digest: digest, upstream_manifest_digests: z.array(z.record(z.unknown())),
  anchors: z.record(z.unknown()), contracts: z.record(z.unknown()), dated_audit_baseline: z.record(z.unknown()), writer_discovery: z.array(z.record(z.unknown())),
  database_snapshot: z.record(z.unknown()), drift: z.array(z.record(z.unknown())), readiness: z.boolean(), snapshot_digest: digest,
}).strict();

export async function assertManifestSchema(root: string, manifest: Json): Promise<void> {
  manifestSchema.parse(manifest);
  const declared = JSON.parse(await readFile(path.join(root, 'scripts/knowledge-governance/input-inventory/manifest.schema.json'), 'utf8')) as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean };
  if (declared.additionalProperties !== false) throw new Error('manifest JSON schema must reject additional properties');
  const object = manifest as Record<string, Json>;
  for (const key of declared.required) if (!(key in object)) throw new Error(`manifest JSON schema required key missing: ${key}`);
  for (const key of Object.keys(object)) if (!(key in declared.properties)) throw new Error(`manifest JSON schema additional key: ${key}`);
}
