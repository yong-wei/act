import { taggedDigest, canonicalJson, sortUnique } from './normalize';
import type { Drift, Json } from './types';
import { auditIdBearingPaths, selectJson } from './json-selector';
import type { Registry } from './registry';

export interface ShapeFixture {
  decoder_id: string;
  accepted_versions: string[];
  legacy_shape_digests: string[];
  samples: Array<{ version?: string; payload: Json }>;
}

function contractSelectors(contract: Record<string, unknown>): string[] {
  const selectors = [
    ...(contract.selectors as string[] ?? []),
    ...(contract.reference_selectors as string[] ?? []),
  ];
  return selectors;
}

function jsonType(value: Json): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

export function shapeDescriptors(value: Json): string[] {
  const descriptors: string[] = [];
  const visit = (item: Json, pointer: string): void => {
    descriptors.push(`${pointer}\t${jsonType(item)}`);
    if (Array.isArray(item)) item.forEach((child) => visit(child, `${pointer}/[]`));
    else if (item && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) visit(child, `${pointer}/${JSON.stringify(key.normalize('NFC'))}`);
    }
  };
  visit(value, '$');
  return sortUnique(descriptors);
}

export function shapeDigest(payload: Json): string {
  return taggedDigest('synthetic-payload-shape/v2', shapeDescriptors(payload).join('\n'));
}

export function validateSyntheticPayload(contract: Record<string, unknown>, fixture: ShapeFixture, payload: Json, declaredVersion?: string): Drift[] {
  const drift: Drift[] = [];
  const selectors = contractSelectors(contract);
  const discriminatorFields = (contract.discriminator_selectors as string[] ?? []).map((selector) => selector.replace(/^\$\./u, ''));
  const discriminators = contract.discriminator_namespaces as Record<string, string> ?? {};
  if ('*' in discriminators) drift.push({ code: 'CATCH_ALL_DISCRIMINATOR_FORBIDDEN', scope: fixture.decoder_id });
  const object = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  const version = declaredVersion ?? (object && typeof object.schemaVersion === 'string' ? object.schemaVersion : undefined);
  if (version && !fixture.accepted_versions.includes(version)) drift.push({ code: 'UNKNOWN_PAYLOAD_VERSION', scope: fixture.decoder_id, observed: version });
  if (!version && !fixture.legacy_shape_digests.includes(shapeDigest(payload))) drift.push({ code: 'UNKNOWN_LEGACY_SHAPE', scope: fixture.decoder_id, observed: shapeDigest(payload) });
  const visit = (value: Json, pointer: string): void => {
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${pointer}/${index}`));
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (discriminatorFields.includes(key) && typeof child === 'string' && !(child in discriminators)) drift.push({ code: 'UNKNOWN_DISCRIMINATOR', scope: `${fixture.decoder_id}${pointer}/${key}`, observed: child });
      visit(child, `${pointer}/${key}`);
    }
  };
  visit(payload, '');
  drift.push(...auditIdBearingPaths(payload, selectors, fixture.decoder_id));
  return drift;
}

export function decoderContractDigest(id: string, contract: Record<string, unknown>, schemaSources: Array<{ locator: string; digest: string }>): string {
  return taggedDigest('decoder-contract/v1', canonicalJson({ decoder_id: id, contract: contract as Json, schema_sources: schemaSources.sort((a, b) => a.locator.localeCompare(b.locator)) as unknown as Json } as unknown as Json));
}

export function validateFixtureClosure(decoderIds: string[], fixtures: ShapeFixture[]): Drift[] {
  const drift: Drift[] = [];
  const ids = fixtures.map((fixture) => fixture.decoder_id);
  for (const id of sortUnique(decoderIds.filter((item) => !ids.includes(item)))) drift.push({ code: 'DECODER_FIXTURE_MISSING', scope: id });
  for (const id of sortUnique(ids.filter((item) => !decoderIds.includes(item)))) drift.push({ code: 'FIXTURE_DECODER_UNKNOWN', scope: id });
  for (const fixture of fixtures) if (fixture.accepted_versions.length === 0 || fixture.samples.length === 0) drift.push({ code: 'DECODER_FIXTURE_INCOMPLETE', scope: fixture.decoder_id });
  return drift;
}

export interface DecoderGraph {
  roots: string[];
  reachable: string[];
  drift: Drift[];
}

function decoderChildren(contract: Record<string, unknown>): Array<{ edge: 'item_decoder' | 'payload_decoder'; id: string }> {
  return (['item_decoder', 'payload_decoder'] as const)
    .filter((edge) => typeof contract[edge] === 'string')
    .map((edge) => ({ edge, id: String(contract[edge]) }));
}

function validateContractClosure(id: string, contract: Record<string, unknown>, drift: Drift[]): void {
  const selectors = [
    ...(contract.selectors as string[] ?? []),
    ...(contract.reference_selectors as string[] ?? []),
  ];
  const discriminatorSelectors = contract.discriminator_selectors as string[] ?? [];
  const namespaces = [
    contract.reference_namespace,
    ...Object.values((contract.field_namespaces as Record<string, string>) ?? {}),
    ...Object.values((contract.namespace_by_field as Record<string, string>) ?? {}),
    ...Object.values((contract.field_namespace_overrides as Record<string, string>) ?? {}),
    ...Object.values((contract.discriminator_namespaces as Record<string, string>) ?? {}),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (selectors.length === 0 && decoderChildren(contract).length === 0) drift.push({ code: 'DECODER_SELECTOR_CLOSURE_MISSING', scope: id });
  if (namespaces.length === 0 && decoderChildren(contract).length === 0) drift.push({ code: 'DECODER_NAMESPACE_CLOSURE_MISSING', scope: id });
  if (discriminatorSelectors.length > 0 && Object.keys((contract.discriminator_namespaces as Record<string, string>) ?? {}).length === 0) drift.push({ code: 'DECODER_DISCRIMINATOR_CLOSURE_MISSING', scope: id });
  if (!contract.schema_source || (Array.isArray(contract.schema_source) && contract.schema_source.length === 0)) drift.push({ code: 'DECODER_SCHEMA_SOURCE_CLOSURE_MISSING', scope: id });
  if (!contract.parent_join && !contract.source_joins && !contract.join_applicability) drift.push({ code: 'DECODER_JOIN_CLOSURE_MISSING', scope: id });
  if (typeof contract.payload_decoder === 'string' && typeof contract.payload_selector !== 'string') drift.push({ code: 'DECODER_CHILD_SELECTOR_MISSING', scope: `${id}.payload_decoder`, observed: contract.payload_decoder });
}

export function compileDecoderGraph(registry: Registry): DecoderGraph {
  const drift: Drift[] = [];
  const roots = sortUnique(registry.field_decoders
    .map((decoder) => decoder.json_decoder)
    .filter((value): value is string => typeof value === 'string'));
  const visited = new Set<string>();
  const active: string[] = [];
  const visit = (id: string): void => {
    const contract = registry.decoder_contracts[id];
    if (!contract) {
      drift.push({ code: 'DECODER_GRAPH_UNKNOWN_CHILD', scope: active.at(-1) ?? 'field_decoders', observed: id });
      return;
    }
    const activeIndex = active.indexOf(id);
    if (activeIndex >= 0) {
      drift.push({ code: 'DECODER_GRAPH_CYCLE', scope: id, observed: [...active.slice(activeIndex), id] });
      return;
    }
    if (visited.has(id)) return;
    active.push(id);
    validateContractClosure(id, contract, drift);
    for (const child of decoderChildren(contract)) {
      if (!registry.decoder_contracts[child.id]) drift.push({ code: 'DECODER_GRAPH_UNKNOWN_CHILD', scope: `${id}.${child.edge}`, observed: child.id });
      else visit(child.id);
    }
    active.pop();
    visited.add(id);
  };
  roots.forEach(visit);
  for (const id of Object.keys(registry.decoder_contracts)) if (!visited.has(id)) drift.push({ code: 'DECODER_GRAPH_ORPHAN', scope: id });
  return { roots, reachable: sortUnique([...visited]), drift };
}

function declaredPayloadVersion(value: Json): string | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) && typeof value.schemaVersion === 'string'
    ? value.schemaVersion
    : undefined;
}

export function validateSyntheticDecoderGraph(
  registry: Registry,
  fixtures: ShapeFixture[],
  rootId: string,
  payload: Json,
  declaredVersion?: string,
): Drift[] {
  const graph = compileDecoderGraph(registry);
  if (graph.drift.length > 0) return graph.drift;
  const fixturesById = new Map(fixtures.map((fixture) => [fixture.decoder_id, fixture]));
  const drift: Drift[] = [];
  const visit = (id: string, value: Json, path: string, version?: string): void => {
    const contract = registry.decoder_contracts[id];
    const fixture = fixturesById.get(id);
    if (!contract || !fixture) {
      drift.push({ code: contract ? 'DECODER_FIXTURE_MISSING' : 'DECODER_GRAPH_UNKNOWN_CHILD', scope: path, observed: id });
      return;
    }
    for (const item of validateSyntheticPayload(effectiveDecoderContract(registry, id), fixture, value, version)) {
      drift.push({ ...item, scope: `${path}:${item.scope}` });
    }
    if (typeof contract.item_decoder === 'string') {
      if (!Array.isArray(value)) drift.push({ code: 'DECODER_CHILD_TYPE_MISMATCH', scope: path, expected: 'array', observed: typeof value });
      else value.forEach((child, index) => visit(contract.item_decoder as string, child, `${path}[${index}]`, declaredPayloadVersion(child)));
    }
    if (typeof contract.payload_decoder === 'string' && typeof contract.payload_selector === 'string') {
      const selected = selectJson(value, contract.payload_selector);
      if (selected.length === 0) drift.push({ code: 'DECODER_CHILD_PAYLOAD_MISSING', scope: `${path}${contract.payload_selector.slice(1)}`, observed: contract.payload_decoder });
      for (const child of selected) visit(contract.payload_decoder, child.value, `${path}${child.path.slice(1)}`, declaredPayloadVersion(child.value));
    }
  };
  visit(rootId, payload, '$', declaredVersion ?? declaredPayloadVersion(payload));
  return drift;
}

export function effectiveDecoderContract(registry: Registry, id: string, seen = new Set<string>()): Record<string, unknown> {
  const contract = registry.decoder_contracts[id] ?? {};
  if (seen.has(id)) return contract;
  const nextSeen = new Set(seen).add(id);
  const selectors = [...(contract.selectors as string[] ?? []), ...(contract.reference_selectors as string[] ?? [])];
  if (typeof contract.item_decoder === 'string') {
    const child = effectiveDecoderContract(registry, contract.item_decoder, nextSeen);
    selectors.push(...contractSelectors(child).map((selector) => `$[*]${selector.slice(1)}`));
  }
  if (typeof contract.payload_decoder === 'string' && typeof contract.payload_selector === 'string') {
    const child = effectiveDecoderContract(registry, contract.payload_decoder, nextSeen);
    selectors.push(...contractSelectors(child).map((selector) => `${contract.payload_selector}${selector.slice(1)}`));
  }
  return { ...contract, selectors };
}
