import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileDecoderGraph, validateSyntheticDecoderGraph, type ShapeFixture } from '../decoder-validation';
import { assertManifestSchemaValue } from '../output-validation';
import type { Registry } from '../registry';
import type { Json } from '../types';

const root = path.resolve(import.meta.dirname, '../../../..');
const digest = `sha256:${'a'.repeat(64)}`;
const revision = 'a'.repeat(40);

function validManifest(): Record<string, Json> {
  return {
    schema_version: 'course-knowledge-input-inventory/v1', algorithm_version: 'v1', registry_id: 'registry', normalization_profile: 'nfc', captured_at: '2026-07-19T00:00:00.000Z', repository_revision: revision,
    repository: {
      sources: [{ id: 'source', item_kind: 'document', identity_namespace: 'source', declared_patterns: ['**/*.md'], logical_inputs: [{ pattern: '**/*.md', state: 'present', reason_code: null, hit_count: 1 }], physical_paths: ['safe.md'], hit_count: 1, missing_policy: 'fail' }],
      roles: [{ role: 'binding_content', declared_patterns: ['**/*.md'], rules: [{ pattern: '**/*.md', exclude: null, audience: null, derived: null, hit_count: 1 }], physical_paths: ['safe.md'], hit_count: 1 }],
      unclassified: [], multiply_classified: [],
    },
    repository_files: [{ path: 'safe.md', source_root: 'isolated-worktree', capture_revision: revision, vcs_state: 'tracked', state: 'observed', codec: 'markdown-utf8/v1', media_type: 'text/markdown', size: 1, raw_digest: digest, normalized_digest: digest }],
    record_sets: { physical: [{ item_kind: 'document', identity_namespace: 'source', source_id: 'source:safe.md', source_locator: 'safe.md', schema_version: 'normalized-file/v1', digest }], logical: [], drift: [] },
    source_digests: [{ source_id: 'source', source_locator: 'source', item_kind: 'document', identity_namespace: 'source', schema_version: 'registry/v1', digest, item_count: 1 }],
    database_source_digests: [{ source_id: 'db', source_locator: 'database:db', item_kind: 'rows', schema_version: 'registry/v1', digest, dataset_count: 0 }],
    decoder_digests: [{ decoder_id: 'decoder/v1', digest }], governance_contract_digest: digest, source_snapshot_digest: digest, upstream_manifest_digests: [],
    anchors: { records: [], nullable_scope_matrix: { course: { module_id: null, lesson_id: null } }, observed_count: 0, candidate_artifact_digest: digest, candidate_count: 0, review_artifact_digest: null, review_count: 0, admitted_artifact_digest: null, admitted_count: 0 },
    contracts: { repository_sources: 1, database_sources: 1, decoder_contracts: 1, field_decoders: 1, namespaces: 1, declared_writer_paths: 1, digest },
    dated_audit_baseline: { source: 'audit.md', evidence_date: '2026-07-19', observations: [{ metric: 'nodes', expected: 1, observed: 1 }] },
    writer_discovery: [{ path: 'writer.ts', mutations: [], dynamic_raw: false, targets: [], calls: [], imports: {}, call_paths: [] }],
    database_snapshot: { snapshot_id: digest, captured_at: '2026-07-19T00:00:00.000Z', snapshot_proof: { profile: 'immutable_export', export_object_id: 'object', generated_at: '2026-07-19T00:00:00.000Z', export_digest: digest }, datasets: [], dataset_watermarks: {} },
    drift: [{ code: 'EXPECTED_DRIFT', scope: 'fixture', expected: 1, observed: 2 }], readiness: false, snapshot_digest: digest,
  };
}

async function schema(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(root, 'scripts/knowledge-governance/input-inventory/manifest.schema.json'), 'utf8')) as Record<string, unknown>;
}

describe('nested manifest Draft 2020-12 execution', () => {
  it('accepts a fully typed manifest and rejects nested codec, missing, extra, proof and drift violations', async () => {
    const declared = await schema();
    expect(() => assertManifestSchemaValue(declared, validManifest())).not.toThrow();
    const mutations: Array<(manifest: Record<string, Json>) => void> = [
      (manifest) => { ((manifest.repository_files as Json[])[0] as Record<string, Json>).codec = 'opaque/unknown'; },
      (manifest) => { delete ((manifest.repository_files as Json[])[0] as Record<string, Json>).raw_digest; },
      (manifest) => { (((manifest.repository as Record<string, Json>).sources as Json[])[0] as Record<string, Json>).extra = true; },
      (manifest) => { delete (((manifest.database_snapshot as Record<string, Json>).snapshot_proof as Record<string, Json>).export_digest); },
      (manifest) => { (manifest.drift as Json[])[0] = { code: 'BAD', scope: 'fixture', extra: true }; },
    ];
    for (const mutate of mutations) {
      const manifest = structuredClone(validManifest());
      mutate(manifest);
      expect(() => assertManifestSchemaValue(declared, manifest)).toThrow(/manifest schema validation failed/u);
    }
  });

  it.each(['user_id', 'payload', 'raw_row_digest', 'sourceInputDigest', 'unique_semantic_name'])(
    'rejects nested forbidden key %s without echoing its value', async (key) => {
      const manifest = validManifest();
      (manifest.drift as Json[])[0] = { code: 'PRIVACY', scope: 'fixture', observed: { nested: { [key]: 'TOP-SECRET-VALUE' } } };
      let message = '';
      try { assertManifestSchemaValue(await schema(), manifest); } catch (error) { message = String(error); }
      expect(message).toMatch(/manifest schema validation failed/u);
      expect(message).not.toContain('TOP-SECRET-VALUE');
    },
  );
});

function decoderRegistry(): Registry {
  const common = (parent_join: string) => ({ root_type: 'object', schema_source: 'fixture.ts#schema', parent_join, selectors: ['$.knowledgeNodeIds[*]'], reference_namespace: 'canonical_knowledge_node' });
  return {
    decoder_contracts: {
      'learning-event-batch/v1': { root_type: 'array', schema_source: 'fixture.ts#batch', parent_join: 'Batch.id -> Batch.events', item_decoder: 'learning-event-record/v1' },
      'learning-event-record/v1': { ...common('Batch.id -> Batch.events'), discriminator_selectors: ['$.targetType'], discriminator_namespaces: { knowledge_node: 'canonical_knowledge_node' }, reference_selectors: ['$.targetId'], payload_decoder: 'learning-event-payload/v1', payload_selector: '$.payload' },
      'learning-event-payload/v1': { ...common('Batch.id -> Batch.events') },
    },
    field_decoders: [{ source_field: 'Batch.events', json_decoder: 'learning-event-batch/v1' }],
    closed_namespaces: ['canonical_knowledge_node'],
  } as unknown as Registry;
}

function decoderFixtures(): ShapeFixture[] {
  return ['learning-event-batch/v1', 'learning-event-record/v1', 'learning-event-payload/v1'].map((decoder_id) => ({ decoder_id, accepted_versions: ['v1'], legacy_shape_digests: [], samples: [{ version: 'v1', payload: {} }] }));
}

describe('compiled recursive decoder graph', () => {
  it('closes batch -> record -> payload and reports the complete deep path', () => {
    const registry = decoderRegistry();
    expect(compileDecoderGraph(registry).drift).toEqual([]);
    const payload = [{ schemaVersion: 'v1', targetType: 'knowledge_node', targetId: 'node', payload: { schemaVersion: 'v999', knowledgeNodeIds: ['node'], deep: { secretNodeId: 'unknown' } } }] as Json;
    const drift = validateSyntheticDecoderGraph(registry, decoderFixtures(), 'learning-event-batch/v1', payload, 'v1');
    expect(drift).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNKNOWN_PAYLOAD_VERSION' }),
      expect.objectContaining({ code: 'UNKNOWN_ID_BEARING_PATH', observed: '$[0].payload.deep.secretNodeId' }),
    ]));
  });

  it('validates a child discriminator instead of trusting the parent decoder', () => {
    const payload = [{ schemaVersion: 'v1', targetType: 'future_target', targetId: 'node', payload: { schemaVersion: 'v1', knowledgeNodeIds: ['node'] } }] as Json;
    expect(validateSyntheticDecoderGraph(decoderRegistry(), decoderFixtures(), 'learning-event-batch/v1', payload, 'v1')).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNKNOWN_DISCRIMINATOR', observed: 'future_target' }),
    ]));
  });

  it('fails closed for unknown children, cycles, orphans and incomplete child contracts', () => {
    const unknown = decoderRegistry();
    unknown.decoder_contracts['learning-event-record/v1']!.payload_decoder = 'missing/v1';
    expect(compileDecoderGraph(unknown).drift).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DECODER_GRAPH_UNKNOWN_CHILD' })]));

    const cycle = decoderRegistry();
    cycle.decoder_contracts['learning-event-payload/v1']!.payload_decoder = 'learning-event-batch/v1';
    cycle.decoder_contracts['learning-event-payload/v1']!.payload_selector = '$.next';
    expect(compileDecoderGraph(cycle).drift).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DECODER_GRAPH_CYCLE' })]));

    const orphan = decoderRegistry();
    orphan.decoder_contracts['orphan/v1'] = { root_type: 'object', schema_source: 'fixture.ts#orphan', parent_join: 'A.id -> B.id', selectors: ['$.nodeId'], reference_namespace: 'canonical_knowledge_node' };
    expect(compileDecoderGraph(orphan).drift).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DECODER_GRAPH_ORPHAN', scope: 'orphan/v1' })]));

    const incomplete = decoderRegistry();
    incomplete.decoder_contracts['learning-event-payload/v1'] = { root_type: 'object' };
    expect(compileDecoderGraph(incomplete).drift).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DECODER_SELECTOR_CLOSURE_MISSING' }),
      expect.objectContaining({ code: 'DECODER_NAMESPACE_CLOSURE_MISSING' }),
      expect.objectContaining({ code: 'DECODER_JOIN_CLOSURE_MISSING' }),
      expect.objectContaining({ code: 'DECODER_SCHEMA_SOURCE_CLOSURE_MISSING' }),
    ]));
  });
});
