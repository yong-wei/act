import { describe, expect, it } from 'vitest';
import { validateDatabaseClosure } from '../database-snapshot';
import type { Registry } from '../registry';
import type { DatabaseSnapshot } from '../types';

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
    decoder_contracts: { 'payload/v1': { root_type: 'object', selectors: ['$.id'], reference_namespace: 'test' } },
    field_decoders: [{ source_field: 'Observed.payload', json_decoder: 'payload/v1', identity_namespace: 'test' }],
  } as unknown as Registry;
}

function snapshot(overrides: Partial<DatabaseSnapshot['datasets'][number]> = {}): DatabaseSnapshot {
  return {
    snapshot_id: 'snapshot', captured_at: '2026-01-01T00:00:00.000Z', snapshot_proof: { profile: 'immutable_export' }, dataset_watermarks: {},
    datasets: [
      {
        id: 'observed', table: 'Observed', count: 5, watermark: null, shape: ['version', 'kind', 'payload'], versions: ['v1'],
        version_summaries: { 'field:version': { v1: 5 } }, discriminator_summaries: { 'field:kind': { known: 5 } }, historical_shape_summaries: { 'field:payload': { object: 5 } },
        ...overrides,
      },
      { id: 'empty', table: 'Empty', count: 0, watermark: null, shape: ['version'], versions: [], version_summaries: { 'field:version': {} }, discriminator_summaries: {}, historical_shape_summaries: {} },
    ],
  };
}

describe('database decoder observation closure', () => {
  it('accepts a closed snapshot and an explicitly permitted empty-table observation', () => {
    expect(validateDatabaseClosure(snapshot(), registry())).toEqual([]);
  });

  it.each([
    ['version_summaries', { 'field:version': { v999: 5 } }, ['v999'], 'DATABASE_VERSION_OUTSIDE_CLOSED_SET'],
    ['discriminator_summaries', { 'field:kind': { unknown: 5 } }, ['v1'], 'DATABASE_DISCRIMINATOR_OUTSIDE_CLOSED_SET'],
    ['historical_shape_summaries', { 'field:payload': { array: 5 } }, ['v1'], 'DATABASE_HISTORICAL_SHAPE_OUTSIDE_CLOSED_SET'],
  ] as const)('rejects unknown %s evidence', (collection, summary, versions, code) => {
    const drift = validateDatabaseClosure(snapshot({ [collection]: summary, versions }), registry());
    expect(drift).toEqual(expect.arrayContaining([expect.objectContaining({ code, scope: expect.stringContaining('Observed.') })]));
  });

  it('rejects missing, undeclared and unclassified-suppressed summary evidence', () => {
    const drift = validateDatabaseClosure(snapshot({
      version_summaries: {},
      discriminator_summaries: { 'field:kind': { __suppressed__: 'suppressed' }, 'field:other': { known: 5 } },
    }), registry());
    expect(drift).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DATABASE_OBSERVATION_SUMMARY_MISSING', scope: 'Observed.version' }),
      expect.objectContaining({ code: 'DATABASE_SUPPRESSED_CATEGORY_UNCLASSIFIED', scope: 'Observed.kind' }),
      expect.objectContaining({ code: 'DATABASE_OBSERVATION_SUMMARY_UNDECLARED', observed: 'field:other' }),
    ]));
  });

  it('does not treat an empty summary on a non-empty table as allowed zero observation', () => {
    expect(validateDatabaseClosure(snapshot({ version_summaries: { 'field:version': {} }, versions: [] }), registry()))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DATABASE_OBSERVATION_EVIDENCE_MISSING', scope: 'Observed.version' })]));
  });
});
