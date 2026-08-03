/**
 * Inventory ReleaseSet Delta into ACT-facing generic change events (#1272).
 *
 * Exposes stable identity, category, predecessor/successor, relation, and
 * source-anchor signals. Does not synthesize CourseCoverage or teaching review.
 *
 * Structural types mirror scripts/actkg-release delta details without importing
 * the scripts tree (excluded from production typecheck).
 */

import type { ActDeltaChangeEvent, ActDeltaImpactCategory } from './contracts';
import { TeachingProjectionRebaseError } from './contracts';
import { projectionDigest } from '../hash';

/** Minimal object-delta view consumed by ACT impact inventory. */
export interface ActObjectDeltaChangesView {
  added: readonly string[];
  removed: readonly string[];
  payloadChanged: readonly string[];
  typeChanged: readonly string[];
  superseded: ReadonlyArray<{ from: string; to: string }>;
}

/** Minimal relation-delta view consumed by ACT impact inventory. */
export interface ActRelationDeltaChangesView {
  added: readonly string[];
  removed: readonly string[];
  predicateChanged: readonly string[];
  directionChanged: readonly string[];
  tierChanged: readonly string[];
  endpointChanged: readonly string[];
}

/** Structural ReleaseSet Delta details (generic downstream signals). */
export interface ActReleaseSetDeltaDetailsView {
  objects: ActObjectDeltaChangesView;
  relations: ActRelationDeltaChangesView;
}

/** Accepted delta receipt surface needed by ACT rebase. */
export interface ActAcceptedReleaseSetDeltaView {
  authorizationState: string;
  details: ActReleaseSetDeltaDetailsView;
  outputDigest?: string;
}

export interface DeltaObjectTypeIndex {
  baseTypes?: ReadonlyMap<string, string> | Record<string, string>;
  candidateTypes?: ReadonlyMap<string, string> | Record<string, string>;
}

/** Relation endpoint pair used to fill ACT impact source/target IDs. */
export interface ActRelationEndpointView {
  sourceId: string;
  targetId: string;
}

export interface DeltaRelationEndpointIndex {
  /**
   * Base (pre-delta) relation index: relationId → endpoints.
   * Required to resolve RELATION_RETIRED / RELATION_CHANGED when candidate omits the row.
   */
  baseRelations?:
    | ReadonlyMap<string, ActRelationEndpointView>
    | Record<string, ActRelationEndpointView>;
  /**
   * Candidate (post-delta) relation index: relationId → endpoints.
   * Preferred for RELATION_ADDED / RELATION_CHANGED.
   */
  candidateRelations?:
    | ReadonlyMap<string, ActRelationEndpointView>
    | Record<string, ActRelationEndpointView>;
}

export interface InventoryReleaseSetDeltaOptions
  extends DeltaObjectTypeIndex, DeltaRelationEndpointIndex {
  /**
   * Canonical IDs whose payload change is label/alias-only
   * (display rebuild; binding identity unchanged).
   */
  labelAliasOnlyIds?: ReadonlySet<string> | readonly string[];
  /**
   * Explicit source-anchor / source-document events (textbook locators).
   * Crosswalk changes alone are not automatically bound to textbooks.
   */
  sourceChanges?: readonly ActDeltaChangeEvent[];
}

function asMap(
  value: ReadonlyMap<string, string> | Record<string, string> | undefined,
): Map<string, string> {
  if (!value) return new Map();
  if (value instanceof Map) return new Map(value);
  return new Map(Object.entries(value));
}

function asRelationMap(
  value:
    | ReadonlyMap<string, ActRelationEndpointView>
    | Record<string, ActRelationEndpointView>
    | undefined,
): Map<string, ActRelationEndpointView> {
  if (!value) return new Map();
  if (value instanceof Map) return new Map(value);
  return new Map(Object.entries(value));
}

function resolveRelationEndpoints(
  relationId: string,
  category: 'RELATION_ADDED' | 'RELATION_CHANGED' | 'RELATION_RETIRED',
  indexes: {
    base: Map<string, ActRelationEndpointView>;
    candidate: Map<string, ActRelationEndpointView>;
  },
): { sourceId: string; targetId: string } {
  const preferred =
    category === 'RELATION_RETIRED'
      ? indexes.base.get(relationId) ?? indexes.candidate.get(relationId)
      : indexes.candidate.get(relationId) ?? indexes.base.get(relationId);

  const sourceId = preferred?.sourceId?.trim() ?? '';
  const targetId = preferred?.targetId?.trim() ?? '';

  if (!sourceId || !targetId) {
    // Fail closed for changed/retired: without endpoints impact cannot detect
    // ACT-bound prerequisites and would silently treat them as ENGINEERING_ONLY.
    if (category === 'RELATION_CHANGED' || category === 'RELATION_RETIRED') {
      throw new TeachingProjectionRebaseError(
        'relation-endpoints-unresolvable',
        `cannot resolve endpoints for ${category} relation ${relationId}; provide baseRelations/candidateRelations`,
      );
    }
    // RELATION_ADDED without index: emit null endpoints (engineering-only unless filled).
    return { sourceId: '', targetId: '' };
  }

  return { sourceId, targetId };
}

function asSet(
  value: ReadonlySet<string> | readonly string[] | undefined,
): Set<string> {
  if (!value) return new Set();
  if (value instanceof Set) return new Set(value);
  return new Set(value);
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortEvents(events: ActDeltaChangeEvent[]): ActDeltaChangeEvent[] {
  return [...events].sort((a, b) => {
    const byCat = compareCodePoint(a.category, b.category);
    if (byCat !== 0) return byCat;
    const byId = compareCodePoint(a.identity, b.identity);
    if (byId !== 0) return byId;
    return compareCodePoint(a.deltaIdentity, b.deltaIdentity);
  });
}

function event(
  partial: Omit<ActDeltaChangeEvent, 'predecessors' | 'successors'> & {
    predecessors?: string[];
    successors?: string[];
  },
): ActDeltaChangeEvent {
  return {
    category: partial.category,
    identity: partial.identity,
    deltaIdentity: partial.deltaIdentity,
    predecessors: [...(partial.predecessors ?? [])].sort(compareCodePoint),
    successors: [...(partial.successors ?? [])].sort(compareCodePoint),
    baseType: partial.baseType ?? null,
    candidateType: partial.candidateType ?? null,
    labelAliasOnly: partial.labelAliasOnly === true,
    sourceDocumentId: partial.sourceDocumentId ?? null,
    sectionId: partial.sectionId ?? null,
    relationSourceId: partial.relationSourceId ?? null,
    relationTargetId: partial.relationTargetId ?? null,
  };
}

/**
 * Classify superseded pairs into REPLACED_BY / SPLIT / MERGED.
 * - one from → one to, and that to has a single from → REPLACED_BY
 * - one from → many to → SPLIT
 * - many from → one to → MERGED (each predecessor)
 */
export function classifySupersessionTopology(
  superseded: ReadonlyArray<{ from: string; to: string }>,
): {
  replacedBy: Array<{ from: string; to: string }>;
  splits: Array<{ from: string; to: string[] }>;
  merges: Array<{ to: string; from: string[] }>;
} {
  const byFrom = new Map<string, string[]>();
  const byTo = new Map<string, string[]>();
  for (const pair of superseded) {
    const tos = byFrom.get(pair.from) ?? [];
    tos.push(pair.to);
    byFrom.set(pair.from, tos);
    const froms = byTo.get(pair.to) ?? [];
    froms.push(pair.from);
    byTo.set(pair.to, froms);
  }

  const replacedBy: Array<{ from: string; to: string }> = [];
  const splits: Array<{ from: string; to: string[] }> = [];
  const mergeTos = new Set<string>();

  for (const [from, tosRaw] of byFrom) {
    const tos = [...new Set(tosRaw)].sort(compareCodePoint);
    if (tos.length > 1) {
      splits.push({ from, to: tos });
      continue;
    }
    const to = tos[0]!;
    const froms = [...new Set(byTo.get(to) ?? [])].sort(compareCodePoint);
    if (froms.length > 1) {
      mergeTos.add(to);
      continue;
    }
    replacedBy.push({ from, to });
  }

  const merges: Array<{ to: string; from: string[] }> = [];
  for (const to of [...mergeTos].sort(compareCodePoint)) {
    merges.push({
      to,
      from: [...new Set(byTo.get(to) ?? [])].sort(compareCodePoint),
    });
  }

  return { replacedBy, splits, merges };
}

function inventoryObjects(
  objects: ActObjectDeltaChangesView,
  types: { base: Map<string, string>; candidate: Map<string, string> },
  labelAliasOnly: Set<string>,
): ActDeltaChangeEvent[] {
  const events: ActDeltaChangeEvent[] = [];
  const supersededFrom = new Set(objects.superseded.map((p) => p.from));
  const topology = classifySupersessionTopology(objects.superseded);

  for (const id of objects.added) {
    // Added nodes that are pure supersession targets still count as ADDED for
    // engineering, but successor edges are also emitted via REPLACED_BY/SPLIT/MERGE.
    events.push(event({
      category: 'ADDED',
      identity: id,
      deltaIdentity: `object:added:${id}`,
      candidateType: types.candidate.get(id) ?? null,
    }));
  }

  for (const id of objects.payloadChanged) {
    const category: ActDeltaImpactCategory = labelAliasOnly.has(id)
      ? 'LABEL_ALIAS_CHANGED'
      : 'METADATA_CHANGED';
    events.push(event({
      category,
      identity: id,
      deltaIdentity: `object:payload_changed:${id}`,
      baseType: types.base.get(id) ?? null,
      candidateType: types.candidate.get(id) ?? types.base.get(id) ?? null,
      labelAliasOnly: category === 'LABEL_ALIAS_CHANGED',
    }));
  }

  for (const id of objects.typeChanged) {
    events.push(event({
      category: 'TYPE_CHANGED',
      identity: id,
      deltaIdentity: `object:type_changed:${id}`,
      baseType: types.base.get(id) ?? null,
      candidateType: types.candidate.get(id) ?? null,
    }));
  }

  for (const pair of topology.replacedBy) {
    events.push(event({
      category: 'REPLACED_BY',
      identity: pair.from,
      deltaIdentity: `object:superseded:${pair.from}->${pair.to}`,
      predecessors: [pair.from],
      successors: [pair.to],
      baseType: types.base.get(pair.from) ?? null,
      candidateType: types.candidate.get(pair.to) ?? null,
    }));
    events.push(event({
      category: 'DEPRECATED',
      identity: pair.from,
      deltaIdentity: `object:deprecated:${pair.from}`,
      successors: [pair.to],
      baseType: types.base.get(pair.from) ?? null,
      candidateType: types.candidate.get(pair.to) ?? null,
    }));
  }

  for (const split of topology.splits) {
    events.push(event({
      category: 'SPLIT',
      identity: split.from,
      deltaIdentity: `object:split:${split.from}`,
      predecessors: [split.from],
      successors: split.to,
      baseType: types.base.get(split.from) ?? null,
    }));
  }

  for (const merge of topology.merges) {
    for (const from of merge.from) {
      events.push(event({
        category: 'MERGED',
        identity: from,
        deltaIdentity: `object:merged:${from}->${merge.to}`,
        predecessors: merge.from,
        successors: [merge.to],
        baseType: types.base.get(from) ?? null,
        candidateType: types.candidate.get(merge.to) ?? null,
      }));
    }
  }

  for (const id of objects.removed) {
    if (supersededFrom.has(id)) continue;
    events.push(event({
      category: 'REMOVED_WITHOUT_SUCCESSOR',
      identity: id,
      deltaIdentity: `object:removed:${id}`,
      baseType: types.base.get(id) ?? null,
      predecessors: [id],
      successors: [],
    }));
  }

  return events;
}

function inventoryRelations(
  relations: ActRelationDeltaChangesView,
  relationIndexes: {
    base: Map<string, ActRelationEndpointView>;
    candidate: Map<string, ActRelationEndpointView>;
  },
): ActDeltaChangeEvent[] {
  const events: ActDeltaChangeEvent[] = [];

  for (const id of relations.added) {
    const endpoints = resolveRelationEndpoints(id, 'RELATION_ADDED', relationIndexes);
    events.push(event({
      category: 'RELATION_ADDED',
      identity: id,
      deltaIdentity: `relation:added:${id}`,
      relationSourceId: endpoints.sourceId || null,
      relationTargetId: endpoints.targetId || null,
    }));
  }
  for (const id of relations.removed) {
    const endpoints = resolveRelationEndpoints(id, 'RELATION_RETIRED', relationIndexes);
    events.push(event({
      category: 'RELATION_RETIRED',
      identity: id,
      deltaIdentity: `relation:removed:${id}`,
      relationSourceId: endpoints.sourceId,
      relationTargetId: endpoints.targetId,
    }));
  }

  const changed = new Set<string>([
    ...relations.predicateChanged,
    ...relations.directionChanged,
    ...relations.tierChanged,
    ...relations.endpointChanged,
  ]);
  for (const id of [...changed].sort(compareCodePoint)) {
    const endpoints = resolveRelationEndpoints(id, 'RELATION_CHANGED', relationIndexes);
    events.push(event({
      category: 'RELATION_CHANGED',
      identity: id,
      deltaIdentity: `relation:changed:${id}`,
      relationSourceId: endpoints.sourceId,
      relationTargetId: endpoints.targetId,
    }));
  }

  return events;
}

/**
 * Build ACT-facing change events from ReleaseSet Delta details.
 * Pure function; does not activate authority or create teaching review.
 */
export function inventoryDeltaDetailsForAct(
  details: ActReleaseSetDeltaDetailsView,
  options: InventoryReleaseSetDeltaOptions = {},
): ActDeltaChangeEvent[] {
  const types = {
    base: asMap(options.baseTypes),
    candidate: asMap(options.candidateTypes),
  };
  const relationIndexes = {
    base: asRelationMap(options.baseRelations),
    candidate: asRelationMap(options.candidateRelations),
  };
  const labelAliasOnly = asSet(options.labelAliasOnlyIds);

  const events = [
    ...inventoryObjects(details.objects, types, labelAliasOnly),
    ...inventoryRelations(details.relations, relationIndexes),
    ...(options.sourceChanges ?? []),
  ];

  return sortEvents(events);
}

/**
 * Inventory a full accepted ReleaseSet Delta receipt for ACT consumers.
 * Rejects non-ACCEPTED deltas fail-closed. Does not mutate Delta authority.
 */
export function inventoryReleaseSetDeltaForAct(
  delta: ActAcceptedReleaseSetDeltaView,
  options: InventoryReleaseSetDeltaOptions = {},
): ActDeltaChangeEvent[] {
  if (delta.authorizationState !== 'ACCEPTED') {
    throw new TeachingProjectionRebaseError(
      'delta-not-accepted',
      `ReleaseSet Delta is ${delta.authorizationState}; ACT rebase requires ACCEPTED`,
    );
  }
  return inventoryDeltaDetailsForAct(delta.details, options);
}

/**
 * Deterministic digest over a sorted change-event list (fixture-safe).
 */
export function digestActDeltaChangeEvents(
  events: readonly ActDeltaChangeEvent[],
): string {
  return projectionDigest(sortEvents([...events]));
}

/**
 * Build fixture change events with stable deltaIdentity defaults.
 */
export function actDeltaChange(
  partial: Partial<ActDeltaChangeEvent> & Pick<ActDeltaChangeEvent, 'category' | 'identity'>,
): ActDeltaChangeEvent {
  return event({
    category: partial.category,
    identity: partial.identity,
    deltaIdentity: partial.deltaIdentity ?? `${partial.category}:${partial.identity}`,
    predecessors: partial.predecessors,
    successors: partial.successors,
    baseType: partial.baseType,
    candidateType: partial.candidateType,
    labelAliasOnly: partial.labelAliasOnly,
    sourceDocumentId: partial.sourceDocumentId,
    sectionId: partial.sectionId,
    relationSourceId: partial.relationSourceId,
    relationTargetId: partial.relationTargetId,
  });
}
