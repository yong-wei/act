import {
  canonicalJson,
  compareCodePoints,
  sortUnique,
  taggedDigest,
} from '../input-inventory/normalize';
import { makeAnchor } from '../input-inventory/records';
import type {
  Drift,
  IdentityCandidateInput,
  InventoryAnchor,
  InventoryManifest,
  Json,
} from './types';

export const SCHEMA_VERSION = 'knowledge-identity-candidate-manifest/v1';
export const ALGORITHM_VERSION = 'global-exact-reviewed-alias-union-find/v1';

interface BuildOptions {
  inventory: InventoryManifest;
  input: IdentityCandidateInput;
  inventoryFileDigest: string;
}

function canonicalInput(input: IdentityCandidateInput): IdentityCandidateInput {
  return {
    ...input,
    concepts: [...input.concepts].sort((a, b) => compareCodePoints(`${a.identity_namespace}\0${a.source_concept_id}`, `${b.identity_namespace}\0${b.source_concept_id}`)),
    reviewed_aliases: input.reviewed_aliases.map((item) => {
      const [left, right] = [item.left, item.right].sort(compareCodePoints);
      return { ...item, left: left!, right: right! };
    }).sort((a, b) => compareCodePoints(`${a.left}\0${a.right}\0${a.review_id}`, `${b.left}\0${b.right}\0${b.review_id}`)),
    near_similar: input.near_similar.map((item) => {
      const [left, right] = [item.left, item.right].sort(compareCodePoints);
      return { ...item, left: left!, right: right! };
    }).sort((a, b) => compareCodePoints(`${a.left}\0${a.right}\0${a.review_id}`, `${b.left}\0${b.right}\0${b.review_id}`)),
    pending_splits: input.pending_splits.map((item) => ({
      ...item,
      alternatives: item.alternatives.map((alternative) => ({ ...alternative, proposed_member_ids: sortUnique(alternative.proposed_member_ids) }))
        .sort((a, b) => compareCodePoints(a.alternative_id, b.alternative_id)),
    })).sort((a, b) => compareCodePoints(`${a.source_concept_id}\0${a.review_id}`, `${b.source_concept_id}\0${b.review_id}`)),
    history_ambiguities: input.history_ambiguities.map((item) => ({ ...item, candidate_alternative_ids: sortUnique(item.candidate_alternative_ids) }))
      .sort((a, b) => compareCodePoints(`${a.source_concept_id}\0${a.history_locator}`, `${b.source_concept_id}\0${b.history_locator}`)),
    anchor_bindings: [...input.anchor_bindings].sort((a, b) => compareCodePoints(`${a.source_concept_id}\0${a.anchor_id}`, `${b.source_concept_id}\0${b.anchor_id}`)),
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value !== value.normalize('NFC')) {
    throw new Error(`${field} must be a non-empty NFC string`);
  }
  return value;
}

function conceptKey(value: { identity_namespace: string; source_concept_id: string }): string {
  return `${value.identity_namespace}:${value.source_concept_id}`;
}

function validateDigest(value: string, field: string): void {
  if (!/^sha256:[0-9a-f]{64}$/u.test(value)) throw new Error(`${field} must be a sha256 digest`);
}

function validateAnchor(anchor: InventoryAnchor): void {
  const expectedKeys = ['anchor_id', 'anchor_scope', 'anchor_type', 'course_id', 'lesson_id', 'module_id', 'source_locator', 'text_digest'];
  const observedKeys = Object.keys(anchor as unknown as Record<string, unknown>).sort(compareCodePoints);
  if (canonicalJson(expectedKeys as Json) !== canonicalJson(observedKeys as Json)) throw new Error('anchor must contain exactly the course-scope-anchor/v1 fields');
  requiredString(anchor.anchor_id, 'anchor_id');
  validateDigest(anchor.anchor_id, 'anchor_id');
  if (!['course', 'module', 'lesson'].includes(anchor.anchor_scope)) throw new Error('unknown anchor_scope');
  if (!['formal_objective', 'necessary_prerequisite', 'explicit_extension'].includes(anchor.anchor_type)) throw new Error('unknown anchor_type');
  validateDigest(anchor.text_digest, 'anchor.text_digest');
  requiredString(anchor.course_id, 'anchor.course_id');
  requiredString(anchor.source_locator, 'anchor.source_locator');
  if (anchor.module_id !== null) requiredString(anchor.module_id, 'anchor.module_id');
  if (anchor.lesson_id !== null) requiredString(anchor.lesson_id, 'anchor.lesson_id');
  if (anchor.anchor_scope === 'course' && (anchor.module_id !== null || anchor.lesson_id !== null)) throw new Error('course anchor scope matrix mismatch');
  if (anchor.anchor_scope === 'module' && (anchor.module_id === null || anchor.lesson_id !== null)) throw new Error('module anchor scope matrix mismatch');
  if (anchor.anchor_scope === 'lesson' && (anchor.module_id === null || anchor.lesson_id === null)) throw new Error('lesson anchor scope matrix mismatch');
  const { anchor_id: observedAnchorId, ...body } = anchor;
  const expectedAnchorId = makeAnchor(body).anchor_id;
  if (observedAnchorId !== expectedAnchorId) throw new Error('anchor_id does not match course-scope-anchor/v1 content');
}

function expectedSnapshotDigest(inventory: InventoryManifest): string {
  return taggedDigest(
    'course-knowledge-input-inventory/v1',
    canonicalJson({ ...inventory, snapshot_digest: null } as unknown as Json),
  );
}

function blockedManifest(options: BuildOptions, drift: Drift[]): Record<string, Json> {
  const base: Record<string, Json> = {
    schema_version: SCHEMA_VERSION,
    algorithm_version: ALGORITHM_VERSION,
    normalization_profile: options.inventory.normalization_profile,
    source_digests: [
      { source_id: 'identity-candidate-input', digest: taggedDigest('knowledge-identity-candidate-input/v1', canonicalJson(canonicalInput(options.input) as unknown as Json)) },
      { source_id: 'input-inventory-file', digest: options.inventoryFileDigest },
    ],
    governance_contract_digest: options.inventory.governance_contract_digest,
    source_snapshot_digest: options.inventory.source_snapshot_digest,
    upstream_manifest_digests: [{
      manifest: 'course-knowledge-input-inventory/v1',
      expected: options.input.expected_inventory_digest,
      observed: options.inventory.snapshot_digest,
    }],
    drift: drift as unknown as Json,
    readiness: false,
    current: null,
  };
  base.snapshot_digest = taggedDigest(SCHEMA_VERSION, canonicalJson({ ...base, snapshot_digest: null } as unknown as Json));
  return base;
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  add(value: string): void { this.parent.set(value, value); }

  find(value: string): string {
    const parent = this.parent.get(value);
    if (parent === undefined) throw new Error(`unknown concept reference: ${value}`);
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left: string, right: string): void {
    const a = this.find(left);
    const b = this.find(right);
    if (a === b) return;
    const [first, second] = [a, b].sort(compareCodePoints);
    this.parent.set(second!, first!);
  }
}

export function buildIdentityCandidateManifest(options: BuildOptions): Record<string, Json> {
  const inventory = options.inventory;
  const input = canonicalInput(options.input);
  const semanticInputDigest = taggedDigest('knowledge-identity-candidate-input/v1', canonicalJson(input as unknown as Json));
  if (input.schema_version !== 'knowledge-identity-candidate-input/v1') throw new Error('unsupported identity candidate input schema');
  validateDigest(input.expected_inventory_digest, 'expected_inventory_digest');
  validateDigest(inventory.snapshot_digest, 'inventory.snapshot_digest');
  const upstreamDrift: Drift[] = [];
  if (inventory.schema_version !== 'course-knowledge-input-inventory/v1') upstreamDrift.push({ code: 'UPSTREAM_INVENTORY_SCHEMA_MISMATCH', scope: 'input-inventory', expected: 'course-knowledge-input-inventory/v1', observed: inventory.schema_version });
  if (inventory.readiness !== true) upstreamDrift.push({ code: 'UPSTREAM_INVENTORY_NOT_READY', scope: 'input-inventory', expected: true, observed: inventory.readiness });
  const recomputed = expectedSnapshotDigest(inventory);
  if (recomputed !== inventory.snapshot_digest) upstreamDrift.push({ code: 'UPSTREAM_INVENTORY_SELF_DIGEST_MISMATCH', scope: 'input-inventory', expected: recomputed, observed: inventory.snapshot_digest });
  if (input.expected_inventory_digest !== inventory.snapshot_digest) upstreamDrift.push({ code: 'UPSTREAM_INVENTORY_DIGEST_MISMATCH', scope: 'input-inventory', expected: input.expected_inventory_digest, observed: inventory.snapshot_digest });
  if (upstreamDrift.length > 0) return blockedManifest(options, upstreamDrift);

  const orderedConcepts = [...input.concepts].map((concept) => ({
    ...concept,
    source_concept_id: requiredString(concept.source_concept_id, 'source_concept_id'),
    identity_namespace: requiredString(concept.identity_namespace, 'identity_namespace'),
    normalized_name: requiredString(concept.normalized_name, 'normalized_name'),
    source_locator: requiredString(concept.source_locator, 'source_locator'),
  })).sort((a, b) => compareCodePoints(conceptKey(a), conceptKey(b)));
  const byId = new Map<string, typeof orderedConcepts[number]>();
  for (const concept of orderedConcepts) {
    if (byId.has(concept.source_concept_id)) throw new Error(`duplicate or cross-namespace source_concept_id: ${concept.source_concept_id}`);
    byId.set(concept.source_concept_id, concept);
  }
  for (const split of input.pending_splits) {
    if (!byId.has(split.source_concept_id)) throw new Error(`unknown pending split concept: ${split.source_concept_id}`);
    for (const alternative of split.alternatives) {
      if (alternative.proposed_member_ids.some((member) => !byId.has(member))) throw new Error('pending split references unknown concept');
    }
  }
  for (const ambiguity of input.history_ambiguities) {
    if (!byId.has(ambiguity.source_concept_id)) throw new Error(`unknown history ambiguity concept: ${ambiguity.source_concept_id}`);
  }
  const uf = new UnionFind();
  for (const concept of orderedConcepts) uf.add(concept.source_concept_id);
  const byName = new Map<string, string>();
  for (const concept of orderedConcepts) {
    const existing = byName.get(concept.normalized_name);
    if (existing) uf.union(existing, concept.source_concept_id);
    else byName.set(concept.normalized_name, concept.source_concept_id);
  }
  const aliases = [...input.reviewed_aliases].sort((a, b) => compareCodePoints(`${a.left}\0${a.right}\0${a.review_id}`, `${b.left}\0${b.right}\0${b.review_id}`));
  if (new Set(aliases.map((item) => `${item.left}\0${item.right}\0${item.review_id}`)).size !== aliases.length) throw new Error('duplicate reviewed alias evidence');
  for (const alias of aliases) {
    if (alias.decision !== 'ACCEPT') throw new Error('only explicitly reviewed ACCEPT aliases are valid hard equivalence');
    requiredString(alias.review_id, 'alias.review_id');
    validateDigest(alias.evidence_digest, 'alias.evidence_digest');
    uf.union(alias.left, alias.right);
  }

  const groups = new Map<string, string[]>();
  for (const concept of orderedConcepts) {
    const root = uf.find(concept.source_concept_id);
    groups.set(root, [...(groups.get(root) ?? []), concept.source_concept_id]);
  }
  const anchorMap = new Map(inventory.anchors.records.map((anchor) => [anchor.anchor_id, anchor]));
  for (const anchor of inventory.anchors.records) validateAnchor(anchor);
  const bindingMap = new Map<string, string[]>();
  for (const binding of input.anchor_bindings) {
    if (!byId.has(binding.source_concept_id)) throw new Error(`unknown anchor binding concept: ${binding.source_concept_id}`);
    if (!anchorMap.has(binding.anchor_id)) throw new Error(`anchor binding does not resolve to accepted inventory anchor: ${binding.anchor_id}`);
    bindingMap.set(binding.source_concept_id, [...(bindingMap.get(binding.source_concept_id) ?? []), binding.anchor_id]);
  }

  const componentByMember = new Map<string, string>();
  const components = [...groups.values()].map((members) => {
    const memberIds = sortUnique(members);
    const exactEvidence = orderedConcepts.filter((item) => memberIds.includes(item.source_concept_id)).map((item) => ({
      source_concept_id: item.source_concept_id,
      identity_namespace: item.identity_namespace,
      normalized_name: item.normalized_name,
      source_locator: item.source_locator,
    }));
    const aliasEvidence = aliases.filter((item) => memberIds.includes(item.left) && memberIds.includes(item.right));
    const signature = { members: memberIds, exact_name_evidence: exactEvidence, reviewed_alias_evidence: aliasEvidence };
    const componentId = taggedDigest('knowledge-identity-component/v1', canonicalJson(signature as unknown as Json));
    for (const member of memberIds) componentByMember.set(member, componentId);
    const anchorIds = sortUnique(memberIds.flatMap((member) => bindingMap.get(member) ?? []));
    const pendingSplits = input.pending_splits.filter((split) => memberIds.includes(split.source_concept_id)).map((split) => {
      validateDigest(split.evidence_digest, 'pending_split.evidence_digest');
      const alternativeIds = new Set(split.alternatives.map((alternative) => alternative.alternative_id));
      if (alternativeIds.size !== split.alternatives.length || split.alternatives.length === 0) throw new Error('pending split alternatives must be non-empty and unique');
      for (const alternative of split.alternatives) {
        if (alternative.proposed_member_ids.some((member) => !memberIds.includes(member))) throw new Error('pending split must remain internal to its current component');
      }
      return split;
    }).sort((a, b) => compareCodePoints(a.review_id, b.review_id));
    const historyAmbiguities = input.history_ambiguities.filter((item) => memberIds.includes(item.source_concept_id)).map((item) => {
      const split = pendingSplits.find((candidate) => candidate.source_concept_id === item.source_concept_id);
      const valid = new Set(split?.alternatives.map((alternative) => alternative.alternative_id) ?? []);
      if (item.candidate_alternative_ids.length === 0 || item.candidate_alternative_ids.some((id) => !valid.has(id))) throw new Error('history ambiguity must reference internal pending split alternatives');
      return item;
    }).sort((a, b) => compareCodePoints(`${a.source_concept_id}\0${a.history_locator}`, `${b.source_concept_id}\0${b.history_locator}`));
    return {
      component_id: componentId,
      indivisible: true,
      members: memberIds,
      exact_name_evidence: exactEvidence,
      reviewed_alias_evidence: aliasEvidence,
      pending_splits: pendingSplits,
      history_ambiguities: historyAmbiguities,
      scope_anchor_evidence: anchorIds.length > 0
        ? { status: 'resolved', anchor_ids: anchorIds }
        : { status: 'missing', finding: 'SCOPE_ANCHOR_EVIDENCE_MISSING' },
    };
  }).sort((a, b) => compareCodePoints(a.component_id, b.component_id));

  const edgeKeys = new Set<string>();
  const nearSimilarEdges = input.near_similar.map((edge) => {
    validateDigest(edge.evidence_digest, 'near_similar.evidence_digest');
    const left = componentByMember.get(edge.left);
    const right = componentByMember.get(edge.right);
    if (!left || !right) throw new Error('near-similar edge references unknown concept');
    if (left === right) throw new Error('near-similar edge must connect distinct components');
    const [leftComponentId, rightComponentId] = [left, right].sort(compareCodePoints);
    const key = `${leftComponentId}\0${rightComponentId}\0${edge.review_id}`;
    if (edgeKeys.has(key)) throw new Error('duplicate near-similar review edge');
    edgeKeys.add(key);
    return { edge_id: taggedDigest('knowledge-near-similar-edge/v1', key), left_component_id: leftComponentId!, right_component_id: rightComponentId!, review_id: edge.review_id, evidence_digest: edge.evidence_digest, algorithm_version: edge.algorithm_version };
  }).sort((a, b) => compareCodePoints(a.edge_id, b.edge_id));

  const drift: Drift[] = [
    { code: 'OBSERVED_COUNT', scope: 'concepts', expected: input.expected.concept_count, observed: orderedConcepts.length },
    { code: 'OBSERVED_COUNT', scope: 'reviewed_aliases', expected: input.expected.reviewed_alias_count, observed: aliases.length },
    { code: 'OBSERVED_COUNT', scope: 'near_similar', expected: input.expected.near_similar_count, observed: input.near_similar.length },
  ].filter((item) => item.expected !== item.observed);
  const current = { components, near_similar_review_edges: nearSimilarEdges };
  const base: Record<string, Json> = {
    schema_version: SCHEMA_VERSION,
    algorithm_version: ALGORITHM_VERSION,
    normalization_profile: inventory.normalization_profile,
    source_digests: [
      { source_id: 'identity-candidate-input', digest: semanticInputDigest },
      { source_id: 'input-inventory-file', digest: options.inventoryFileDigest },
      ...inventory.source_digests,
      ...(inventory.database_source_digests ?? []),
    ] as Json[],
    governance_contract_digest: inventory.governance_contract_digest,
    source_snapshot_digest: inventory.source_snapshot_digest,
    upstream_manifest_digests: [{ manifest: inventory.schema_version, expected: input.expected_inventory_digest, observed: inventory.snapshot_digest }],
    observations: {
      expected: input.expected,
      observed: { concept_count: orderedConcepts.length, component_count: components.length, reviewed_alias_count: aliases.length, near_similar_count: nearSimilarEdges.length },
    },
    drift: drift as unknown as Json,
    readiness: drift.length === 0,
    current: drift.length === 0 ? current as unknown as Json : null,
  };
  base.snapshot_digest = taggedDigest(SCHEMA_VERSION, canonicalJson({ ...base, snapshot_digest: null } as unknown as Json));
  return base;
}
