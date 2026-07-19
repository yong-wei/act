import { taggedDigest, canonicalJson, sortUnique } from './normalize';
import type { Drift, Json } from './types';
import { auditIdBearingPaths } from './json-selector';
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

function shape(value: Json): Json {
  if (Array.isArray(value)) return value.length ? [shape(value[0]!)] : [];
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)]));
  if (value === null) return null;
  return typeof value;
}

export function shapeDigest(payload: Json): string {
  return taggedDigest('synthetic-payload-shape/v1', canonicalJson(shape(payload)));
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
