import { sortUnique } from './normalize';
import type { Registry } from './registry';
import type { Drift } from './types';
import type { ShapeFixture } from './decoder-validation';

export type DatabaseSummaryKind = 'version' | 'discriminator' | 'historical_shape';

export interface DatabaseObservationContract {
  sourceId: string;
  table: string;
  field: string;
  summary: DatabaseSummaryKind;
  accepted: string[];
  zeroObservation: 'allow_if_table_empty' | 'forbid';
}

export type JsonObservationKind = 'path' | 'root_type' | 'version' | 'version_presence' | 'legacy_shape' | 'discriminator';

export interface JsonObservationContract {
  table: string;
  field: string;
  decoderId: string;
  selector: string;
  summary: JsonObservationKind;
  accepted: string[];
  applicability?: 'any' | 'object_only';
  zeroObservation?: 'forbid';
  requiredParentSelector?: string;
}

export interface RelationObservationContract { table: string; field: string; joinTable: string; ownerColumn: string; targetColumn: string }

export function compileRelationObservationContracts(registry: Registry): RelationObservationContract[] {
  return registry.database_sources.flatMap((source) => Object.entries((source.relation_observation_contracts ?? {}) as Record<string, Record<string, unknown>>).map(([sourceField, value]) => {
    const [table, field] = sourceField.split('.');
    if (!table || !field || typeof value.join_table !== 'string' || typeof value.owner_column !== 'string' || typeof value.target_column !== 'string') throw new Error(`invalid relation observation contract: ${sourceField}`);
    return { table, field, joinTable: value.join_table, ownerColumn: value.owner_column, targetColumn: value.target_column };
  }));
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
    case 'object_or_null': return ['__null__', 'null', 'object'];
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

function joinSelector(prefix: string, selector: string): string {
  return prefix === '$' ? selector : `${prefix}${selector.slice(1)}`;
}

function selectorContainer(selector: string): string {
  return selector.endsWith('[*]') ? selector.slice(0, -3) : selector;
}

export function canonicalJsonSelector(selector: string): string {
  if (!selector.startsWith('$')) throw new Error(`invalid JSON selector: ${selector}`);
  const tokens = selector.slice(1).match(/\.[A-Za-z_][A-Za-z0-9_]*|\.\*|\[\*\]/gu) ?? [];
  if (tokens.join('') !== selector.slice(1)) throw new Error(`invalid JSON selector: ${selector}`);
  return `$${tokens.map((token) => token === '[*]' ? '/a' : token === '.*' ? '/d' : `/k:${token.slice(1)}`).join('')}`;
}

export function compileJsonObservationContracts(registry: Registry, fixtures: ShapeFixture[]): { contracts: JsonObservationContract[]; drift: Drift[] } {
  const drift: Drift[] = [];
  const contracts: JsonObservationContract[] = [];
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.decoder_id, fixture]));
  const visit = (table: string, field: string, decoderId: string, prefix: string, active: Set<string>, requiredParentSelector?: string): void => {
    const decoder = registry.decoder_contracts[decoderId];
    const fixture = fixtureById.get(decoderId);
    if (!decoder || !fixture || active.has(decoderId)) {
      drift.push({ code: 'DATABASE_JSON_DECODER_CONTRACT_UNRESOLVED', scope: `${table}.${field}`, observed: decoderId });
      return;
    }
    const next = new Set(active).add(decoderId);
    const variants = (selector: string): Array<{ selector: string; applicability: 'any' | 'object_only' }> => {
      if (decoder.root_type === 'array') return [{ selector: `$[*]${selector.slice(1)}`, applicability: 'any' }];
      if (decoder.root_type === 'array_or_object') return [
        { selector, applicability: 'object_only' },
        { selector: `$[*]${selector.slice(1)}`, applicability: 'any' },
      ];
      return [{ selector, applicability: 'any' }];
    };
    const selectors = [
      ...(decoder.selectors as string[] ?? []),
      ...(decoder.reference_selectors as string[] ?? []),
    ].flatMap(variants).map((item) => canonicalJsonSelector(selectorContainer(joinSelector(prefix, item.selector))));
    const versionSelectors = variants(String(registry.decoder_common_contract.payload_version_selector ?? '$.schemaVersion')).map((item) => ({ ...item, selector: joinSelector(prefix, item.selector) }));
    const discriminatorSelectors = (decoder.discriminator_selectors as string[] ?? []).flatMap(variants).map((item) => ({ ...item, selector: joinSelector(prefix, item.selector) }));
    const rootShapes = decoderRootShapes(decoder.root_type);
    if (!rootShapes) drift.push({ code: 'DATABASE_JSON_DECODER_ROOT_TYPE_UNRESOLVED', scope: `${table}.${field}`, observed: decoder.root_type ?? null });
    else contracts.push({ table, field, decoderId, selector: prefix, summary: 'root_type', accepted: rootShapes, ...(requiredParentSelector ? { zeroObservation: 'forbid' as const, requiredParentSelector } : {}) });
    contracts.push({ table, field, decoderId, selector: prefix, summary: 'path', accepted: sortUnique([...selectors, ...versionSelectors.map((item) => canonicalJsonSelector(item.selector)), ...discriminatorSelectors.map((item) => canonicalJsonSelector(item.selector))]) });
    for (const versionSelector of versionSelectors) {
      contracts.push({ table, field, decoderId, selector: versionSelector.selector, summary: 'version', accepted: sortUnique(fixture.accepted_versions), applicability: versionSelector.applicability });
      contracts.push({ table, field, decoderId, selector: versionSelector.selector, summary: 'version_presence', accepted: ['__missing__', '__present__'], applicability: versionSelector.applicability });
      contracts.push({ table, field, decoderId, selector: versionSelector.selector, summary: 'legacy_shape', accepted: sortUnique(fixture.legacy_shape_digests), applicability: versionSelector.applicability });
    }
    const discriminators = Object.keys((decoder.discriminator_namespaces as Record<string, string>) ?? {});
    for (const selector of discriminatorSelectors) {
      contracts.push({ table, field, decoderId, selector: selector.selector, summary: 'discriminator', accepted: sortUnique(discriminators), applicability: selector.applicability });
    }
    if (typeof decoder.item_decoder === 'string') visit(table, field, decoder.item_decoder, `${prefix}[*]`, next);
    if (typeof decoder.payload_decoder === 'string' && typeof decoder.payload_selector === 'string') {
      visit(table, field, decoder.payload_decoder, joinSelector(prefix, decoder.payload_selector), next, prefix);
    }
  };
  for (const item of registry.field_decoders) {
    if (typeof item.source_field !== 'string' || typeof item.json_decoder !== 'string') continue;
    const match = /^([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9]*)$/u.exec(item.source_field);
    if (match) visit(match[1]!, match[2]!, item.json_decoder, '$', new Set());
  }
  return { contracts, drift };
}
