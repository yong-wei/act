/**
 * Materialize immutable Authority domain shards from one frozen snapshot (#1375).
 *
 * This is the only path allowed to read engineering.json. Runtime loaders
 * consume the resulting small artifacts exclusively.
 */

import { renameSync } from 'node:fs';
import { join } from 'node:path';

import {
  REGISTERED_PEER_DOMAIN_IDS,
  buildAuthorityDomainRootPresentation,
  type AuthorityDomainCatalogRuntime,
  type RegisteredPeerDomainId,
} from '@/lib/authority-domain-catalog';
import type {
  AuthorityEngineeringBody,
  AuthorityEngineeringObject,
  AuthorityEngineeringRelation,
} from '@/lib/authoritative-knowledge/authority-snapshot';

import {
  AUTHORITY_SHARD_BUILDER_VERSION,
  AUTHORITY_SHARD_CURRENT_CONTRACT,
  AUTHORITY_SHARD_NEIGHBORHOOD_LIMIT,
  AUTHORITY_SHARD_PAYLOAD_BUDGETS,
  AUTHORITY_SHARD_SET_CONTRACT,
  ENGINEERING_LAYER,
  ENGINEERING_RELATION_FAMILIES,
  type AuthorityDomainDefaultShard,
  type AuthorityNodeDetailShard,
  type AuthorityNodeNeighborhoodShard,
  type AuthorityRelationFamilyShard,
  type AuthorityRootShard,
  type AuthorityShardBoundaryRef,
  type AuthorityShardCurrentPointer,
  type AuthorityShardEnvelope,
  type AuthorityShardObject,
  type AuthorityShardRelation,
  type AuthorityShardSetManifest,
  type EngineeringRelationFamily,
} from './contracts';
import { engineeringFamilyForPredicate } from './families';
import { shardDigest, shardSha256 } from './hash';
import {
  createAuthorityLabelResolverContext,
  resolveAuthorityLabel,
  type AuthorityLabelResolverContext,
} from './labels';
import {
  canonicalIdFileToken,
  shardRelativePaths,
  shardSetDir,
  writeJsonFile,
  type AuthorityDomainShardPaths,
} from './store';
import {
  createTeachingOverlay,
  type TeachingOverlay,
} from './teaching';

const SUPPORTED_OBJECT_TYPES = new Set([
  'DomainConcept',
  'Formula',
  'KnowledgeStatement',
  'SystemModel',
  'ModelRepresentation',
]);

const SUPPORTED_PREDICATES = new Set([
  'association',
  'applies_to',
  'derived_from',
  'has_component',
  'has_formula',
  'has_representation',
  'is_a',
  'part_of',
  'used_to_analyze',
]);

const TEACHING_FIELD_NAMES = [
  'concept_kind',
  'formula_latex',
  'formula_role',
  'statement_type',
  'model_kind',
  'temporal_domain',
  'linearity',
  'time_variance',
  'stochasticity',
  'representation_type',
  'represents_model',
] as const;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function safeLabel(payload: JsonObject): string {
  const preferredLabels = Array.isArray(payload.preferred_labels)
    ? payload.preferred_labels.map(asObject)
    : [];
  const preferred = preferredLabels.find((label) => (
    label.language === 'zh-CN' && typeof label.text === 'string'
  )) ?? preferredLabels.find((label) => typeof label.text === 'string');
  if (typeof preferred?.text === 'string' && preferred.text.trim()) return preferred.text.trim();
  // Keep the object available for bounded graph traversal, but never expose
  // its canonical/internal identifier as a product label.
  return '名称暂不可用';
}

export class AuthorityShardMaterializeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthorityShardMaterializeError';
    this.code = code;
  }
}

export interface MaterializeAuthorityDomainShardsInput {
  envelope: AuthorityShardEnvelope;
  catalog: AuthorityDomainCatalogRuntime;
  engineering: AuthorityEngineeringBody;
  teaching?: TeachingOverlay;
  neighborhoodLimit?: number;
  activatedAt?: string;
}

export interface MaterializedAuthorityDomainShards {
  manifest: AuthorityShardSetManifest;
  pointer: AuthorityShardCurrentPointer;
  root: AuthorityRootShard;
  domainDefaults: Record<RegisteredPeerDomainId, AuthorityDomainDefaultShard>;
  families: Record<string, AuthorityRelationFamilyShard>;
  neighborhoods: Record<string, AuthorityNodeNeighborhoodShard>;
  details: Record<string, AuthorityNodeDetailShard>;
  files: Record<string, unknown>;
}

function membershipsFor(
  catalog: AuthorityDomainCatalogRuntime,
  canonicalId: string,
): AuthorityShardObject['memberships'] {
  const row = catalog.memberships.find((item) => item.canonicalId === canonicalId);
  if (!row) return [];
  const visualByDomain = new Map(
    catalog.domains.map((domain) => [domain.domainId, domain.visualRole]),
  );
  return row.domainIds.map((domainId) => ({
    domainId,
    visualRole: visualByDomain.get(domainId) ?? catalog.domains[0]!.visualRole,
    preferred: domainId === row.preferredDomainId,
  }));
}

export function projectAuthorityObject(
  object: AuthorityEngineeringObject,
  catalog: AuthorityDomainCatalogRuntime,
  labels?: AuthorityLabelResolverContext,
): AuthorityShardObject {
  const payload = asObject(object.payload);
  const resolved = labels ? resolveAuthorityLabel(labels, object.canonicalId) : null;
  if (labels && (!resolved || resolved.status !== 'available' || !resolved.label)) {
    throw new AuthorityShardMaterializeError(
      'label-unavailable',
      'Authority object label is unavailable for the selected snapshot.',
    );
  }
  return {
    id: object.canonicalId,
    canonicalType: object.canonicalType,
    label: resolved?.label ?? safeLabel(payload),
    aliases: resolved?.aliases ?? [],
    description: stringOrNull(payload.description),
    governance: {
      reviewStatus: object.reviewStatus,
      publicationStatus: object.publicationStatus,
      lifecycleStatus: object.lifecycleStatus,
    },
    semanticSupport: {
      supported: SUPPORTED_OBJECT_TYPES.has(object.canonicalType),
      readOnly: true,
    },
    memberships: membershipsFor(catalog, object.canonicalId),
    conceptKind: stringOrNull(payload.concept_kind) ?? stringOrNull(asObject(payload.payload).concept_kind),
  };
}

export function projectAuthorityRelation(
  relation: AuthorityEngineeringRelation,
): AuthorityShardRelation {
  const payload = asObject(relation.payload);
  return {
    id: relation.relationId,
    predicate: relation.relationType,
    sourceId: relation.sourceId,
    targetId: relation.targetId,
    direction: stringOrNull(payload.direction),
    direct: relation.direct,
    qualityTier: relation.qualityTier,
    governance: {
      reviewStatus: relation.reviewStatus,
      publicationStatus: relation.publicationStatus,
    },
    semanticSupport: {
      supported: SUPPORTED_PREDICATES.has(relation.relationType),
      readOnly: true,
    },
    layer: ENGINEERING_LAYER,
    relationFamily: engineeringFamilyForPredicate(relation.relationType),
  };
}

function teachingFields(payload: JsonObject): Record<string, unknown> {
  const nested = asObject(payload.payload);
  const source = { ...nested, ...payload };
  return Object.fromEntries(
    TEACHING_FIELD_NAMES
      .filter((field) => source[field] !== undefined && source[field] !== null)
      .map((field) => [field, source[field]]),
  );
}

function domainMembers(
  catalog: AuthorityDomainCatalogRuntime,
  domainId: RegisteredPeerDomainId,
): Set<string> {
  return new Set(
    catalog.memberships
      .filter((row) => row.domainIds.includes(domainId))
      .map((row) => row.canonicalId),
  );
}

function catalogMemberIds(catalog: AuthorityDomainCatalogRuntime): Set<string> {
  return new Set(catalog.memberships.map((row) => row.canonicalId));
}

function compareId(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function boundaryFor(
  object: AuthorityEngineeringObject,
  catalog: AuthorityDomainCatalogRuntime,
  labels?: AuthorityLabelResolverContext,
): AuthorityShardBoundaryRef {
  const presentation = projectAuthorityObject(object, catalog, labels);
  return {
    canonicalId: object.canonicalId,
    label: presentation.label,
    aliases: presentation.aliases,
    canonicalType: object.canonicalType,
    adjacentDomainIds: membershipsFor(catalog, object.canonicalId).map((item) => item.domainId),
  };
}

function assertBudget(shardClass: keyof typeof AUTHORITY_SHARD_PAYLOAD_BUDGETS, value: unknown): void {
  const serialized = `${JSON.stringify(value)}\n`;
  const budget = AUTHORITY_SHARD_PAYLOAD_BUDGETS[shardClass];
  if (Buffer.byteLength(serialized, 'utf8') > budget) {
    throw new AuthorityShardMaterializeError(
      'payload-budget-exceeded',
      `${shardClass} shard exceeds ${budget} bytes`,
    );
  }
}

export function buildAuthorityDomainShards(
  input: MaterializeAuthorityDomainShardsInput,
): MaterializedAuthorityDomainShards {
  const teaching = input.teaching ?? createTeachingOverlay(null);
  const limit = input.neighborhoodLimit ?? AUTHORITY_SHARD_NEIGHBORHOOD_LIMIT;
  const labels = createAuthorityLabelResolverContext({
    snapshot: input.envelope.authority,
    objects: input.engineering.objects,
    v2Evidence: input.engineering.v2Evidence,
  });
  const objectsById = new Map(
    input.engineering.objects.map((object) => [object.canonicalId, object]),
  );
  const memberIds = catalogMemberIds(input.catalog);
  for (const memberId of memberIds) {
    if (!objectsById.has(memberId)) {
      throw new AuthorityShardMaterializeError(
        'catalog-member-missing',
        `catalog member ${memberId} is absent from the Authority snapshot`,
      );
    }
  }

  const rootPresentation = buildAuthorityDomainRootPresentation(input.catalog);
  const root: AuthorityRootShard = {
    shardClass: 'root',
    envelope: input.envelope,
    root: rootPresentation,
  };
  assertBudget('root', root);
  const rootJson = JSON.stringify(root);
  if (/"canonicalId"\s*:/u.test(rootJson) || rootJson.includes('engineering.json')) {
    throw new AuthorityShardMaterializeError(
      'root-leaks-authority-body',
      'root shard must not include canonical object ids or engineering.json',
    );
  }

  const domainDefaults = {} as Record<RegisteredPeerDomainId, AuthorityDomainDefaultShard>;
  const families: Record<string, AuthorityRelationFamilyShard> = {};
  const seedIds = new Set(memberIds);

  for (const domainId of REGISTERED_PEER_DOMAIN_IDS) {
    const members = domainMembers(input.catalog, domainId);
    const objects = [...members]
      .map((id) => projectAuthorityObject(objectsById.get(id)!, input.catalog, labels))
      .sort(compareId);
    const teachingRelations = teaching.relations(domainId).slice().sort(compareId);
    const domainDefault: AuthorityDomainDefaultShard = {
      shardClass: 'domain-default',
      envelope: input.envelope,
      domainId,
      visualRole: input.catalog.domains.find((domain) => domain.domainId === domainId)!.visualRole,
      objects,
      teachingRelations,
      teachingCoverage: teaching.coverage(domainId),
    };
    const serializedDefault = JSON.stringify(domainDefault);
    if (serializedDefault.includes('"media"') || serializedDefault.includes('"cardMarkdown"')) {
      throw new AuthorityShardMaterializeError(
        'default-includes-media',
        'domain-default shard must not include detail media',
      );
    }
    assertBudget('domain-default', domainDefault);
    domainDefaults[domainId] = domainDefault;

    for (const family of ENGINEERING_RELATION_FAMILIES) {
      const incident = input.engineering.relations.filter((relation) => {
        if (engineeringFamilyForPredicate(relation.relationType) !== family) return false;
        return members.has(relation.sourceId) || members.has(relation.targetId);
      });
      const extraIds = new Set<string>();
      for (const relation of incident) {
        if (!members.has(relation.sourceId)) extraIds.add(relation.sourceId);
        if (!members.has(relation.targetId)) extraIds.add(relation.targetId);
        seedIds.add(relation.sourceId);
        seedIds.add(relation.targetId);
      }
      const familyObjects = [...extraIds]
        .map((id) => objectsById.get(id))
        .filter((object): object is AuthorityEngineeringObject => Boolean(object))
        .map((object) => projectAuthorityObject(object, input.catalog, labels))
        .sort(compareId);
      const familyShard: AuthorityRelationFamilyShard = {
        shardClass: 'relation-family',
        envelope: input.envelope,
        domainId,
        family,
        objects: familyObjects,
        relations: incident.map(projectAuthorityRelation).sort(compareId),
        boundaries: familyObjects
          .filter((object) => object.memberships.every((item) => item.domainId !== domainId))
          .map((object) => ({
            canonicalId: object.id,
            label: object.label,
            aliases: object.aliases,
            canonicalType: object.canonicalType,
            adjacentDomainIds: object.memberships.map((item) => item.domainId),
          }))
          .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId)),
      };
      assertBudget('relation-family', familyShard);
      families[`${domainId}:${family}`] = familyShard;
    }
  }

  for (const memberId of memberIds) {
    const incident = input.engineering.relations.filter(
      (relation) => relation.sourceId === memberId || relation.targetId === memberId,
    );
    for (const relation of incident) {
      seedIds.add(relation.sourceId);
      seedIds.add(relation.targetId);
    }
  }

  // Every node that can be returned by a bounded neighborhood shard must have
  // its own follow-on shard. Expand only through the same bounded relation
  // slice used by each neighborhood so this closure remains finite and does
  // not turn materialization into an unbounded graph traversal.
  const pending = [...seedIds].sort();
  for (let index = 0; index < pending.length; index += 1) {
    const nodeId = pending[index]!;
    const incident = input.engineering.relations
      .filter((relation) => relation.sourceId === nodeId || relation.targetId === nodeId)
      .sort((left, right) => left.relationId.localeCompare(right.relationId))
      .slice(0, limit);
    for (const relation of incident) {
      for (const endpoint of [relation.sourceId, relation.targetId]) {
        if (objectsById.has(endpoint) && !seedIds.has(endpoint)) {
          seedIds.add(endpoint);
          pending.push(endpoint);
        }
      }
    }
  }

  const neighborhoods: Record<string, AuthorityNodeNeighborhoodShard> = {};
  const details: Record<string, AuthorityNodeDetailShard> = {};

  for (const nodeId of [...seedIds].sort()) {
    const center = objectsById.get(nodeId);
    if (!center) continue;
    const incident = input.engineering.relations
      .filter((relation) => relation.sourceId === nodeId || relation.targetId === nodeId)
      .sort((left, right) => left.relationId.localeCompare(right.relationId));
    const truncated = incident.length > limit;
    const kept = incident.slice(0, limit);
    const neighborIds = new Set<string>([nodeId]);
    for (const relation of kept) {
      neighborIds.add(relation.sourceId);
      neighborIds.add(relation.targetId);
    }
    const neighborObjects = [...neighborIds]
      .map((id) => objectsById.get(id))
      .filter((object): object is AuthorityEngineeringObject => Boolean(object));
    const neighborhood: AuthorityNodeNeighborhoodShard = {
      shardClass: 'node-neighborhood',
      envelope: input.envelope,
      nodeId,
      limit,
      truncated,
      objects: neighborObjects.map((object) => projectAuthorityObject(object, input.catalog, labels)).sort(compareId),
      relations: kept.map(projectAuthorityRelation).sort(compareId),
      boundaries: neighborObjects
        .filter((object) => object.canonicalId !== nodeId && !memberIds.has(object.canonicalId))
        .map((object) => boundaryFor(object, input.catalog, labels))
        .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId)),
    };
    assertBudget('node-neighborhood', neighborhood);
    neighborhoods[nodeId] = neighborhood;

    const payload = asObject(center.payload);
    const nested = asObject(payload.payload);
    const presentation = projectAuthorityObject(center, input.catalog, labels);
    const detail: AuthorityNodeDetailShard = {
      shardClass: 'node-detail',
      envelope: input.envelope,
      node: {
        id: center.canonicalId,
        canonicalType: center.canonicalType,
        label: presentation.label,
        aliases: presentation.aliases,
        description: stringOrNull(payload.description) ?? stringOrNull(nested.description),
        teachingFields: teachingFields(payload),
        governance: {
          reviewStatus: center.reviewStatus,
          publicationStatus: center.publicationStatus,
          lifecycleStatus: center.lifecycleStatus,
        },
        sources: [],
        media: {
          cardAvailable: false,
          infographAvailable: false,
        },
        semanticSupport: {
          supported: SUPPORTED_OBJECT_TYPES.has(center.canonicalType),
          readOnly: true,
        },
      },
    };
    assertBudget('node-detail', detail);
    details[nodeId] = detail;
  }

  const files: Record<string, unknown> = {
    [shardRelativePaths({}).root]: root,
  };
  for (const domainId of REGISTERED_PEER_DOMAIN_IDS) {
    files[shardRelativePaths({ domainId }).domainDefault!] = domainDefaults[domainId];
    for (const family of ENGINEERING_RELATION_FAMILIES) {
      files[shardRelativePaths({ domainId, family }).family!] = families[`${domainId}:${family}`];
    }
  }
  for (const [nodeId, neighborhood] of Object.entries(neighborhoods)) {
    files[shardRelativePaths({ canonicalId: nodeId }).neighborhood!] = neighborhood;
  }
  for (const [nodeId, detail] of Object.entries(details)) {
    files[shardRelativePaths({ canonicalId: nodeId }).detail!] = detail;
  }

  const fileHashes = Object.fromEntries(
    Object.entries(files)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([relative, value]) => [relative, shardSha256(`${JSON.stringify(value, null, 2)}\n`)]),
  );
  const shardSetHash = shardDigest({
    envelope: input.envelope,
    files: fileHashes,
  });
  const shardSetId = `ads-${shardSetHash}`;
  const manifest: AuthorityShardSetManifest = {
    contract: AUTHORITY_SHARD_SET_CONTRACT,
    builderVersion: AUTHORITY_SHARD_BUILDER_VERSION,
    shardSetId,
    shardSetHash,
    envelope: input.envelope,
    files: fileHashes,
    counts: {
      root: 1,
      domainDefault: REGISTERED_PEER_DOMAIN_IDS.length,
      relationFamily: REGISTERED_PEER_DOMAIN_IDS.length * ENGINEERING_RELATION_FAMILIES.length,
      neighborhood: Object.keys(neighborhoods).length,
      detail: Object.keys(details).length,
    },
  };
  files[shardRelativePaths({}).manifest] = manifest;

  const pointer: AuthorityShardCurrentPointer = {
    contract: AUTHORITY_SHARD_CURRENT_CONTRACT,
    shardSetId,
    shardSetHash,
    snapshotId: input.envelope.authority.snapshotId,
    snapshotHash: input.envelope.authority.snapshotHash,
    releaseId: input.envelope.authority.releaseId,
    catalogId: input.envelope.catalog.catalogId,
    catalogHash: input.envelope.catalog.catalogHash,
    teachingProjectionId: input.envelope.teaching.projectionId,
    teachingProjectionHash: input.envelope.teaching.projectionHash,
    activatedAt: input.activatedAt ?? new Date(0).toISOString(),
  };

  return {
    manifest,
    pointer,
    root,
    domainDefaults,
    families,
    neighborhoods,
    details,
    files,
  };
}

export function writeAuthorityDomainShards(
  paths: AuthorityDomainShardPaths,
  materialized: MaterializedAuthorityDomainShards,
): void {
  const target = shardSetDir(paths, materialized.manifest.shardSetId);
  for (const [relative, value] of Object.entries(materialized.files)) {
    writeJsonFile(join(target, relative), value);
  }
  const temporaryPointerPath = `${paths.currentPath}.tmp-${process.pid}`;
  writeJsonFile(temporaryPointerPath, materialized.pointer);
  renameSync(temporaryPointerPath, paths.currentPath);
}

export function canonicalIdToken(canonicalId: string): string {
  return canonicalIdFileToken(canonicalId);
}
