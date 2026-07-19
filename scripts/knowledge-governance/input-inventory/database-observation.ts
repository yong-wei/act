import { sortUnique } from './normalize';
import type { Registry } from './registry';
import type { Drift } from './types';

export type DatabaseSummaryKind = 'version' | 'discriminator' | 'historical_shape';

export interface DatabaseObservationContract {
  sourceId: string;
  table: string;
  field: string;
  summary: DatabaseSummaryKind;
  accepted: string[];
  zeroObservation: 'allow_if_table_empty' | 'forbid';
}

interface RegistryObservationContract {
  versions?: string[];
  discriminators?: string[];
  historical_shapes?: string[] | 'decoder_root';
  zero_observation?: 'allow_if_table_empty' | 'forbid';
}

function decoderRootShapes(rootType: unknown): string[] | null {
  switch (rootType) {
    case 'object': return ['object'];
    case 'array': return ['array'];
    case 'object_or_null': return ['__null__', 'object'];
    case 'array_or_object': return ['array', 'object'];
    default: return null;
  }
}

export function compileDatabaseObservationContracts(registry: Registry): { contracts: DatabaseObservationContract[]; drift: Drift[] } {
  const drift: Drift[] = [];
  const contracts: DatabaseObservationContract[] = [];
  const declaredFields = new Set<string>();
  for (const source of registry.database_sources) {
    for (const [table, fields] of Object.entries((source.fields ?? {}) as Record<string, string[]>)) {
      for (const field of fields) declaredFields.add(`${table}.${field}`);
    }
  }
  const decoderByField = new Map<string, string>();
  for (const fieldDecoder of registry.field_decoders) {
    if (typeof fieldDecoder.source_field === 'string' && typeof fieldDecoder.json_decoder === 'string') {
      decoderByField.set(fieldDecoder.source_field, fieldDecoder.json_decoder);
    }
  }

  for (const source of registry.database_sources) {
    const sourceId = String(source.id);
    const observations = (source.observation_contracts ?? {}) as Record<string, RegistryObservationContract>;
    for (const [sourceField, observation] of Object.entries(observations)) {
      const match = /^([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9]*)$/u.exec(sourceField);
      if (!match || !declaredFields.has(sourceField)) {
        drift.push({ code: 'DATABASE_OBSERVATION_SOURCE_UNDECLARED', scope: sourceId, observed: sourceField });
        continue;
      }
      const [, table, field] = match;
      const zeroObservation = observation.zero_observation;
      if (zeroObservation !== 'allow_if_table_empty' && zeroObservation !== 'forbid') {
        drift.push({ code: 'DATABASE_OBSERVATION_ZERO_POLICY_MISSING', scope: sourceField });
        continue;
      }
      const add = (summary: DatabaseSummaryKind, values: string[]): void => {
        if (values.length === 0 || values.some((value) => typeof value !== 'string' || value.length === 0)) {
          drift.push({ code: 'DATABASE_OBSERVATION_ACCEPTED_SET_EMPTY', scope: `${sourceField}/${summary}` });
          return;
        }
        contracts.push({ sourceId, table: table!, field: field!, summary, accepted: sortUnique(values), zeroObservation });
      };
      if (observation.versions) add('version', observation.versions);
      if (observation.discriminators) add('discriminator', observation.discriminators);
      if (observation.historical_shapes === 'decoder_root') {
        const decoderId = decoderByField.get(sourceField);
        const decoder = decoderId ? registry.decoder_contracts[decoderId] : undefined;
        const shapes = decoderRootShapes(decoder?.root_type);
        if (!decoderId || !decoder || !shapes) drift.push({ code: 'DATABASE_OBSERVATION_DECODER_ROOT_UNRESOLVED', scope: sourceField, observed: decoderId ?? null });
        else add('historical_shape', shapes);
      } else if (Array.isArray(observation.historical_shapes)) add('historical_shape', observation.historical_shapes);
      if (!observation.versions && !observation.discriminators && observation.historical_shapes === undefined) {
        drift.push({ code: 'DATABASE_OBSERVATION_SUMMARY_KIND_MISSING', scope: sourceField });
      }
    }
  }

  const identities = new Set<string>();
  for (const contract of contracts) {
    const identity = `${contract.table}.${contract.field}/${contract.summary}`;
    if (identities.has(identity)) drift.push({ code: 'DATABASE_OBSERVATION_CONTRACT_DUPLICATE', scope: identity });
    identities.add(identity);
  }
  return { contracts, drift };
}
