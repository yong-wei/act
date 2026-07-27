import { describe, expect, it } from 'vitest';
import type { ClientBase, QueryResult } from 'pg';
import { validateDatabaseClosure } from '../database-snapshot';
import type { Registry } from '../registry';
import type { DatabaseSnapshot } from '../types';
import { shapeDigest, type ShapeFixture } from '../decoder-validation';
import { canonicalJsonSelector, compileJsonObservationContracts } from '../database-observation';
import { groupedRelationSummary, relationSummaryKey } from '../database-export';

const fixtures: ShapeFixture[] = [{ decoder_id: 'payload/v1', accepted_versions: ['v1'], legacy_shape_digests: [], samples: [{ version: 'v1', payload: { id: 'safe' } }] }];

function registry(): Registry {
  return {
    schema_version: 'v1', registry_id: 'test', normalization_profile: 'nfc', algorithm_version: 'v1',
    anchor_record_contract: {}, instructional_source_role_matrix: {}, repository_codec_contract: { unknown_codec: 'invalid', codecs: [] }, repository_sources: [], database_snapshot: {}, evidence_deduplication_contract: {}, decoder_common_contract: {}, closed_namespaces: [], expected_inventory: {},
    database_sources: [{
      id: 'source', tables: ['Observed', 'Empty'], fields: { Observed: ['version', 'kind', 'payload'], Empty: ['version'] },
      observation_contracts: {
        'Observed.version': { versions: ['v1'], zero_observation: 'forbid' },
        'Observed.kind': { discriminators: ['known'], zero_observation: 'forbid' },
        'Observed.payload': { historical_shapes: 'decoder_root', zero_observation: 'forbid' },
        'Empty.version': { versions: ['v1'], zero_observation: 'allow_if_table_empty' },
      },
    }],
    decoder_contracts: { 'payload/v1': { root_type: 'object', selectors: ['$.id', '$.versionRefs.*'], reference_namespace: 'test', discriminator_selectors: ['$.targetType'], discriminator_namespaces: { known: 'test' } } },
    field_decoders: [{ source_field: 'Observed.payload', json_decoder: 'payload/v1', identity_namespace: 'test' }],
  } as unknown as Registry;
}

function snapshot(overrides: Partial<DatabaseSnapshot['datasets'][number]> = {}): DatabaseSnapshot {
  return {
    snapshot_id: 'snapshot', captured_at: '2026-01-01T00:00:00.000Z', snapshot_proof: { profile: 'immutable_export' }, dataset_watermarks: {}, summary_key_format: 'legacy',
    datasets: [
      {
        id: 'observed', table: 'Observed', count: 5, watermark: null, shape: ['version', 'kind', 'payload'], versions: ['v1'],
        version_summaries: { 'field:version': { v1: 5 } }, discriminator_summaries: { 'field:kind': { known: 5 } }, historical_shape_summaries: { 'field:payload': { object: 5 } },
        json_observation_summaries: {
          'path:payload': { '$/k:id': 5, '$/k:versionRefs/d': 5 },
          'root_type:payload:$': { object: 5 },
          'version:payload:$.schemaVersion': { v1: 5 },
          'version_presence:payload:$.schemaVersion': { __present__: 5 },
          'legacy_shape:payload:$.schemaVersion': {},
          'discriminator:payload:$.targetType': { known: 5 },
        },
        ...overrides,
      },
      { id: 'empty', table: 'Empty', count: 0, watermark: null, shape: ['version'], versions: [], version_summaries: { 'field:version': {} }, discriminator_summaries: {}, historical_shape_summaries: {} },
    ],
  };
}

describe('database decoder observation closure', () => {
  it.each([
    ['$[*].nodeId', '$/a/k:nodeId'],
    ['$[*].nodeIds[*]', '$/a/k:nodeIds'],
    ['$.versionRefs.*', '$/k:versionRefs/d'],
  ])('canonically encodes normalized JSON selector %s as %s', (selector, observed) => {
    const effective = selector.endsWith('[*]') ? selector.slice(0, -3) : selector;
    expect(canonicalJsonSelector(effective)).toBe(observed);
  });

  it('keeps nested keys distinct from a dotted dynamic key and rejects bracket-key syntax', () => {
    expect(canonicalJsonSelector('$.evidenceGovernance.knowledgeNodeIds')).toBe('$/k:evidenceGovernance/k:knowledgeNodeIds');
    expect(canonicalJsonSelector('$.evidenceGovernance.knowledgeNodeIds')).not.toBe('$/d');
    expect(() => canonicalJsonSelector('$.bracket[key].nodeId')).toThrow(/invalid JSON selector/u);
  });

  it('accepts a closed snapshot and an explicitly permitted empty-table observation', () => {
    expect(validateDatabaseClosure(snapshot(), registry(), fixtures)).toEqual([]);
  });

  it.each([
    ['object', ['$.schemaVersion'], ['$.targetType']],
    ['array', ['$[*].schemaVersion'], ['$[*].targetType']],
    ['array_or_object', ['$.schemaVersion', '$[*].schemaVersion'], ['$.targetType', '$[*].targetType']],
  ] as const)('places version and discriminator selectors at the %s decoder root', (rootType, versions, discriminators) => {
    const candidate = registry();
    candidate.decoder_contracts['payload/v1']!.root_type = rootType;
    const compiled = compileJsonObservationContracts(candidate, fixtures).contracts;
    expect(compiled.filter((item) => item.summary === 'version').map((item) => item.selector)).toEqual(versions);
    expect(compiled.filter((item) => item.summary === 'discriminator').map((item) => item.selector)).toEqual(discriminators);
  });

  it.each(['number', 'null', 'array'])('rejects a %s where an array item decoder requires an object', (observedType) => {
    const candidate = registry();
    candidate.decoder_contracts['payload/v1'] = { root_type: 'array', item_decoder: 'item/v1', selectors: ['$.id'], reference_namespace: 'test' };
    candidate.decoder_contracts['item/v1'] = { root_type: 'object', selectors: ['$.id'], reference_namespace: 'test' };
    const candidateFixtures: ShapeFixture[] = [
      fixtures[0]!,
      { decoder_id: 'item/v1', accepted_versions: ['v1'], legacy_shape_digests: [], samples: [{ version: 'v1', payload: { id: 'safe' } }] },
    ];
    const summaries = {
      ...snapshot().datasets[0]!.json_observation_summaries!,
      'root_type:payload:$': { array: 5 },
      'root_type:payload:$[*]': { [observedType]: 5 },
      'version_presence:payload:$[*].schemaVersion': { __invalid_root__: 5 },
    };
    const drift = validateDatabaseClosure(snapshot({ json_observation_summaries: summaries }), candidate, candidateFixtures);
    expect(drift).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DATABASE_JSON_ROOT_TYPE_OUTSIDE_CLOSED_SET', observed: observedType }),
      expect.objectContaining({ code: 'DATABASE_JSON_VERSION_PRESENCE_INVALID', observed: '__invalid_root__' }),
    ]));
  });

  it('distinguishes an absent SQL value from a JSON null for object_or_null decoders', () => {
    const candidate = registry();
    candidate.decoder_contracts['payload/v1']!.root_type = 'object_or_null';
    const base = snapshot().datasets[0]!.json_observation_summaries!;
    const sqlNull = validateDatabaseClosure(snapshot({
      historical_shape_summaries: { 'field:payload': { __null__: 5 } },
      json_observation_summaries: { ...base, 'root_type:payload:$': {}, 'version:payload:$.schemaVersion': {}, 'version_presence:payload:$.schemaVersion': {}, 'legacy_shape:payload:$.schemaVersion': {} },
    }), candidate, fixtures);
    const jsonNull = validateDatabaseClosure(snapshot({
      historical_shape_summaries: { 'field:payload': { null: 5 } },
      json_observation_summaries: {
        ...base,
        'path:payload': {},
        'root_type:payload:$': { null: 5 },
        'version:payload:$.schemaVersion': {},
        'version_presence:payload:$.schemaVersion': {},
        'legacy_shape:payload:$.schemaVersion': {},
        'discriminator:payload:$.targetType': {},
      },
    }), candidate, fixtures);
    for (const drift of [sqlNull, jsonNull]) {
      expect(drift).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: expect.stringMatching(/(?:ROOT_TYPE|HISTORICAL_SHAPE)_OUTSIDE_CLOSED_SET/u) })]));
    }

    const scalar = validateDatabaseClosure(snapshot({
      historical_shape_summaries: { 'field:payload': { number: 5 } },
      json_observation_summaries: { ...base, 'root_type:payload:$': { number: 5 } },
    }), candidate, fixtures);
    expect(scalar).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DATABASE_HISTORICAL_SHAPE_OUTSIDE_CLOSED_SET', observed: 'number' }),
      expect.objectContaining({ code: 'DATABASE_JSON_ROOT_TYPE_OUTSIDE_CLOSED_SET', observed: 'number' }),
    ]));
  });

  it('limits object_or_null child observations to object roots', () => {
    const candidate = registry();
    candidate.decoder_contracts['payload/v1']!.root_type = 'object_or_null';
    const observations = compileJsonObservationContracts(candidate, fixtures);

    expect(observations.drift).toEqual([]);
    expect(observations.contracts.filter((item) =>
      item.decoderId === 'payload/v1'
      && ['version', 'version_presence', 'legacy_shape', 'discriminator'].includes(item.summary)
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ summary: 'version', applicability: 'object_only' }),
      expect.objectContaining({ summary: 'version_presence', applicability: 'object_only' }),
      expect.objectContaining({ summary: 'legacy_shape', applicability: 'object_only' }),
      expect.objectContaining({ summary: 'discriminator', applicability: 'object_only' }),
    ]));
  });

  it('rejects a missing version unless its exact legacy shape digest is enumerated', () => {
    const digest = shapeDigest({ id: 'legacy' });
    const summaries = {
      'path:payload': { '$/k:id': 5, '$/k:versionRefs/d': 5 },
      'version:payload:$.schemaVersion': {},
      'version_presence:payload:$.schemaVersion': { __missing__: 5 },
      'legacy_shape:payload:$.schemaVersion': { [digest]: 5 },
      'discriminator:payload:$.targetType': { known: 5 },
    };
    const rejected = validateDatabaseClosure(snapshot({ json_observation_summaries: summaries }), registry(), fixtures);
    expect(rejected).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DATABASE_JSON_LEGACY_SHAPE_OUTSIDE_CLOSED_SET', observed: digest })]));

    const acceptedFixtures = [{ ...fixtures[0]!, legacy_shape_digests: [digest] }];
    expect(validateDatabaseClosure(snapshot({ json_observation_summaries: summaries }), registry(), acceptedFixtures))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ code: expect.stringContaining('LEGACY_SHAPE') })]));
  });

  it('rejects missing-version presence without legacy shape evidence', () => {
    const summaries = {
      ...snapshot().datasets[0]!.json_observation_summaries!,
      'version:payload:$.schemaVersion': {},
      'version_presence:payload:$.schemaVersion': { __missing__: 5 },
      'legacy_shape:payload:$.schemaVersion': {},
    };
    expect(validateDatabaseClosure(snapshot({ json_observation_summaries: summaries }), registry(), fixtures))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DATABASE_JSON_LEGACY_SHAPE_EVIDENCE_MISSING' })]));
  });

  it.each([
    ['version_summaries', { 'field:version': { v999: 5 } }, ['v999'], 'DATABASE_VERSION_OUTSIDE_CLOSED_SET'],
    ['discriminator_summaries', { 'field:kind': { unknown: 5 } }, ['v1'], 'DATABASE_DISCRIMINATOR_OUTSIDE_CLOSED_SET'],
    ['historical_shape_summaries', { 'field:payload': { array: 5 } }, ['v1'], 'DATABASE_HISTORICAL_SHAPE_OUTSIDE_CLOSED_SET'],
  ] as const)('rejects unknown %s evidence', (collection, summary, versions, code) => {
    const drift = validateDatabaseClosure(snapshot({ [collection]: summary, versions }), registry(), fixtures);
    expect(drift).toEqual(expect.arrayContaining([expect.objectContaining({ code, scope: expect.stringContaining('Observed.') })]));
  });

  it('rejects missing, undeclared and unclassified-suppressed summary evidence', () => {
    const drift = validateDatabaseClosure(snapshot({
      version_summaries: {},
      discriminator_summaries: { 'field:kind': { __suppressed__: 'suppressed' }, 'field:other': { known: 5 } },
    }), registry(), fixtures);
    expect(drift).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DATABASE_OBSERVATION_SUMMARY_MISSING', scope: 'Observed.version' }),
      expect.objectContaining({ code: 'DATABASE_SUPPRESSED_CATEGORY_UNCLASSIFIED', scope: 'Observed.kind' }),
      expect.objectContaining({ code: 'DATABASE_OBSERVATION_SUMMARY_UNDECLARED', observed: 'field:other' }),
    ]));
  });

  it('does not treat an empty summary on a non-empty table as allowed zero observation', () => {
    expect(validateDatabaseClosure(snapshot({ version_summaries: { 'field:version': {} }, versions: [] }), registry(), fixtures))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DATABASE_OBSERVATION_EVIDENCE_MISSING', scope: 'Observed.version' })]));
  });

  it('requires aggregate evidence for a declared implicit many-to-many relation', () => {
    const candidate = registry();
    candidate.database_sources.push({
      id: 'resources', tables: ['TeachingResource'], fields: { TeachingResource: ['knowledgeNodes'] },
      relation_observation_contracts: { 'TeachingResource.knowledgeNodes': { join_table: '_KnowledgeNodeToTeachingResource', owner_column: 'B', target_column: 'A' } },
    } as never);
    const relationSnapshot: DatabaseSnapshot = {
      snapshot_id: 'snapshot', captured_at: '2026-01-01T00:00:00.000Z', snapshot_proof: { profile: 'immutable_export' }, dataset_watermarks: {}, summary_key_format: 'opaque',
      datasets: [{ id: 'resources', table: 'TeachingResource', count: 5, watermark: null, shape: ['knowledgeNodes'], versions: [], version_summaries: {}, discriminator_summaries: {}, historical_shape_summaries: {}, json_observation_summaries: {}, relation_summaries: { [relationSummaryKey('knowledgeNodes')]: {} } }],
    };
    expect(validateDatabaseClosure(relationSnapshot, candidate, fixtures)).toContainEqual(expect.objectContaining({ code: 'DATABASE_RELATION_OBSERVATION_EVIDENCE_MISSING', scope: 'TeachingResource.knowledgeNodes' }));
    relationSnapshot.datasets[0]!.relation_summaries = { [relationSummaryKey('knowledgeNodes')]: { linked: 5 } };
    expect(validateDatabaseClosure(relationSnapshot, candidate, fixtures)).not.toContainEqual(expect.objectContaining({ code: expect.stringContaining('RELATION_OBSERVATION') }));
  });

  it('returns an empty relation summary when the join query has zero linked rows', async () => {
    const queries: string[] = [];
    const client = {
      query: async (sql: string) => {
        queries.push(sql);
        return { rows: sql.startsWith('EXPLAIN ') ? [{ 'QUERY PLAN': [] }] : [] } as unknown as QueryResult;
      },
    } as unknown as ClientBase;
    await expect(groupedRelationSummary(client, '_KnowledgeNodeToTeachingResource', 'B', 'A')).resolves.toMatchObject({ summary: {} });
    expect(queries.find((sql) => !sql.startsWith('EXPLAIN '))).toMatch(/GROUP BY 1$/u);
  });

  it('fails closed when a required payload decoder has no nested payload observations', () => {
    const candidate = registry();
    candidate.decoder_contracts['payload/v1']!.payload_decoder = 'child/v1';
    candidate.decoder_contracts['payload/v1']!.payload_selector = '$.payload';
    candidate.decoder_contracts['child/v1'] = { root_type: 'object', selectors: ['$.id'], reference_namespace: 'test' };
    const candidateFixtures: ShapeFixture[] = [...fixtures, { decoder_id: 'child/v1', accepted_versions: ['v1'], legacy_shape_digests: [], samples: [{ version: 'v1', payload: { id: 'child' } }] }];
    const summaries = { ...snapshot().datasets[0]!.json_observation_summaries!, 'root_type:payload:$.payload': {} };
    expect(validateDatabaseClosure(snapshot({ json_observation_summaries: summaries }), candidate, candidateFixtures)).toContainEqual(expect.objectContaining({
      code: 'DATABASE_JSON_OBSERVATION_EVIDENCE_MISSING', scope: 'Observed.payload.payload', observed: 0,
    }));
  });

  it.each([
    [{ 'path:payload': { '$/d': 5 }, 'version:payload:$.schemaVersion': { v1: 5 }, 'discriminator:payload:$.targetType': { known: 5 } }, 'DATABASE_JSON_PATH_OUTSIDE_CLOSED_SET'],
    [{ 'path:payload': { '$/k:id': 5, '$/d/k:schemaVersion': 5 }, 'version:payload:$.schemaVersion': { v1: 5 }, 'discriminator:payload:$.targetType': { known: 5 } }, 'DATABASE_JSON_PATH_OUTSIDE_CLOSED_SET'],
    [{ 'path:payload': { '$/k:id': 5 }, 'version:payload:$.schemaVersion': { v999: 5 }, 'discriminator:payload:$.targetType': { known: 5 } }, 'DATABASE_JSON_VERSION_OUTSIDE_CLOSED_SET'],
    [{ 'path:payload': { '$/k:id': 5 }, 'version:payload:$.schemaVersion': { v1: 5 }, 'discriminator:payload:$.targetType': { unknown: 5 } }, 'DATABASE_JSON_DISCRIMINATOR_OUTSIDE_CLOSED_SET'],
  ] as const)('rejects unknown nested JSON path or value exactly', (json_observation_summaries, code) => {
    expect(validateDatabaseClosure(snapshot({ json_observation_summaries }), registry(), fixtures))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });
});
