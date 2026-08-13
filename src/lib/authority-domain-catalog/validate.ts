/**
 * Validators for Authority domain display catalog authoring (#1369).
 */

import {
  AGGREGATE_ENTRY_ID,
  DOMAIN_VISUAL_ROLES,
  PRESENTATION_ROLES,
  REGISTERED_PEER_DOMAIN_IDS,
  isRegisteredPeerDomainId,
  type AggregatePresentationAuthoring,
  type AuthorityDomainCatalogAuthoring,
  type AuthorityNodeEndpoint,
  type DomainMembershipAuthoring,
  type DomainPresentationAuthoring,
  type RegisteredPeerDomainId,
} from './contracts';
import { isSha256Hex } from './hash';

export class DomainCatalogValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainCatalogValidationError';
    this.code = code;
  }
}

const SHA256 = /^[a-f0-9]{64}$/u;
const SNAPSHOT_ID = /^snap-[a-f0-9]{64}$/u;
const CANONICAL_ID_IN_TEXT = /\b(?:ctc|ctf|ctk|ctkg|ctm|ctr):[A-Za-z0-9:._-]+/u;
const RAW_HEX_BLOB = /\b[a-f0-9]{40,64}\b/iu;
const RELEASE_ID_PATTERN = /\bctr:release:[^\s]+\b/iu;
const SNAPSHOT_ID_PATTERN = /\bsnap-[a-f0-9]{64}\b/iu;
const CATALOG_KEY_PATTERN =
  /\b(?:system-modeling|time-domain-analysis|stability-analysis|frequency-domain-analysis|root-locus|classical-control-design|discrete-time-control-analysis|state-space-control-analysis-and-design|control-theory-integration)\b/u;
const RAW_AUTHORITY_ENUM_TOKENS = [
  'domain',
  'aggregate',
  'DomainConcept',
  'Formula',
  'KnowledgeStatement',
  'SystemModel',
  'ModelRepresentation',
  'applies_to',
  'association',
  'derived_from',
  'has_component',
  'has_formula',
  'has_representation',
  'is_a',
  'part_of',
  'used_to_analyze',
  'source_to_target',
  'unordered',
  'GOLD',
  'approved',
  'published',
] as const;
const RAW_AUTHORITY_ENUM_TOKEN = new RegExp(
  `\\b(?:${RAW_AUTHORITY_ENUM_TOKENS.join('|')})\\b`,
  'u',
);

/** Product presentation strings must not embed internal identities or keys. */
export function assertPresentationStringSafe(
  field: string,
  value: string,
): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainCatalogValidationError(
      'presentation-string-empty',
      `${field} must be a non-empty human presentation string`,
    );
  }
  if (CANONICAL_ID_IN_TEXT.test(value)) {
    throw new DomainCatalogValidationError(
      'prohibited-presentation-string',
      `${field} must not contain raw Authority identifiers`,
    );
  }
  if (RELEASE_ID_PATTERN.test(value) || SNAPSHOT_ID_PATTERN.test(value)) {
    throw new DomainCatalogValidationError(
      'prohibited-presentation-string',
      `${field} must not contain release or snapshot identifiers`,
    );
  }
  if (RAW_HEX_BLOB.test(value)) {
    throw new DomainCatalogValidationError(
      'prohibited-presentation-string',
      `${field} must not contain version hashes`,
    );
  }
  if (CATALOG_KEY_PATTERN.test(value)) {
    throw new DomainCatalogValidationError(
      'prohibited-presentation-string',
      `${field} must not contain catalog keys`,
    );
  }
  // Closed vocabulary from the Authority snapshot's object, relation and
  // governance contracts. Product text must use reviewed Chinese wording.
  if (RAW_AUTHORITY_ENUM_TOKEN.test(value)) {
    throw new DomainCatalogValidationError(
      'prohibited-presentation-string',
      `${field} must not be a raw enum value`,
    );
  }
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function assertBinding(binding: AuthorityDomainCatalogAuthoring['authorityBinding']): void {
  if (!binding || typeof binding !== 'object') {
    throw new DomainCatalogValidationError('binding-missing', 'authorityBinding is required');
  }
  if (typeof binding.snapshotId !== 'string' || !SNAPSHOT_ID.test(binding.snapshotId)) {
    throw new DomainCatalogValidationError(
      'binding-snapshot-id-invalid',
      'authorityBinding.snapshotId must be snap-<64-hex>',
    );
  }
  if (typeof binding.snapshotHash !== 'string' || !isSha256Hex(binding.snapshotHash)) {
    throw new DomainCatalogValidationError(
      'binding-snapshot-hash-invalid',
      'authorityBinding.snapshotHash must be 64 lowercase hex characters',
    );
  }
  if (!binding.snapshotId.endsWith(binding.snapshotHash)) {
    throw new DomainCatalogValidationError(
      'binding-snapshot-identity-mismatch',
      'authorityBinding.snapshotId must embed snapshotHash',
    );
  }
  if (typeof binding.releaseId !== 'string' || binding.releaseId.trim().length === 0) {
    throw new DomainCatalogValidationError(
      'binding-release-id-missing',
      'authorityBinding.releaseId is required',
    );
  }
}

function assertDomainEntry(entry: DomainPresentationAuthoring, seen: Set<string>): void {
  if (!isRegisteredPeerDomainId(entry.domainId)) {
    throw new DomainCatalogValidationError(
      'unregistered-domain',
      `unregistered peer domain ${String(entry.domainId)}`,
    );
  }
  if (seen.has(entry.domainId)) {
    throw new DomainCatalogValidationError(
      'duplicate-domain',
      `duplicate peer domain ${entry.domainId}`,
    );
  }
  seen.add(entry.domainId);

  if (entry.presentationRole !== 'domain') {
    throw new DomainCatalogValidationError(
      'domain-role-invalid',
      `domain ${entry.domainId} presentationRole must be "domain"`,
    );
  }
  const visualRole = entry.visualRole as string;
  if (visualRole === 'aggregate' || !(DOMAIN_VISUAL_ROLES as readonly string[]).includes(visualRole)) {
    throw new DomainCatalogValidationError(
      'domain-visual-role-invalid',
      `domain ${entry.domainId} has invalid visualRole`,
    );
  }
  if (!Number.isInteger(entry.order) || entry.order < 1) {
    throw new DomainCatalogValidationError(
      'domain-order-invalid',
      `domain ${entry.domainId} order must be a positive integer`,
    );
  }
  assertPresentationStringSafe(`domain ${entry.domainId}.displayName`, entry.displayName);
  assertPresentationStringSafe(`domain ${entry.domainId}.summary`, entry.summary);
}

function assertAggregate(entry: AggregatePresentationAuthoring): void {
  if (entry.entryId !== AGGREGATE_ENTRY_ID) {
    throw new DomainCatalogValidationError(
      'aggregate-id-invalid',
      `aggregate entryId must be ${AGGREGATE_ENTRY_ID}`,
    );
  }
  if (entry.presentationRole !== 'aggregate') {
    throw new DomainCatalogValidationError(
      'aggregate-role-invalid',
      'aggregate presentationRole must be "aggregate"',
    );
  }
  if (entry.visualRole !== 'aggregate') {
    throw new DomainCatalogValidationError(
      'aggregate-visual-role-invalid',
      'aggregate visualRole must be "aggregate"',
    );
  }
  if (!Number.isInteger(entry.order) || entry.order < 0) {
    throw new DomainCatalogValidationError(
      'aggregate-order-invalid',
      'aggregate order must be a non-negative integer',
    );
  }
  assertPresentationStringSafe('aggregate.displayName', entry.displayName);
  assertPresentationStringSafe('aggregate.summary', entry.summary);
}

function assertMembership(
  membership: DomainMembershipAuthoring,
  authorityIds: ReadonlySet<string>,
  seenCanonical: Set<string>,
  seenPairs: Set<string>,
): void {
  if (typeof membership.canonicalId !== 'string' || membership.canonicalId.trim().length === 0) {
    throw new DomainCatalogValidationError(
      'membership-canonical-id-missing',
      'membership canonicalId is required',
    );
  }
  if (seenCanonical.has(membership.canonicalId)) {
    throw new DomainCatalogValidationError(
      'duplicate-membership-identity',
      `duplicate membership identity ${membership.canonicalId}`,
    );
  }
  seenCanonical.add(membership.canonicalId);

  if (!authorityIds.has(membership.canonicalId)) {
    throw new DomainCatalogValidationError(
      'membership-endpoint-missing',
      `membership ${membership.canonicalId} is not present in the bound Authority selection`,
    );
  }

  if (!Array.isArray(membership.domainIds) || membership.domainIds.length === 0) {
    throw new DomainCatalogValidationError(
      'membership-domains-empty',
      `membership ${membership.canonicalId} requires at least one domain`,
    );
  }

  const localDomains = new Set<string>();
  for (const domainId of membership.domainIds) {
    if (!isRegisteredPeerDomainId(domainId)) {
      throw new DomainCatalogValidationError(
        'unregistered-domain',
        `membership ${membership.canonicalId} references unregistered domain ${String(domainId)}`,
      );
    }
    if (localDomains.has(domainId)) {
      throw new DomainCatalogValidationError(
        'duplicate-membership',
        `membership ${membership.canonicalId} repeats domain ${domainId}`,
      );
    }
    localDomains.add(domainId);
    const pairKey = `${membership.canonicalId}\u001f${domainId}`;
    if (seenPairs.has(pairKey)) {
      throw new DomainCatalogValidationError(
        'duplicate-membership',
        `duplicate membership pair ${membership.canonicalId} @ ${domainId}`,
      );
    }
    seenPairs.add(pairKey);
  }

  if (!isRegisteredPeerDomainId(membership.preferredDomainId)) {
    throw new DomainCatalogValidationError(
      'preferred-domain-unregistered',
      `membership ${membership.canonicalId} preferredDomainId is unregistered`,
    );
  }
  if (!localDomains.has(membership.preferredDomainId)) {
    throw new DomainCatalogValidationError(
      'preferred-domain-mismatch',
      `membership ${membership.canonicalId} preferredDomainId must be one of its domainIds`,
    );
  }
}

/**
 * Validate authoring against the registered domain set and one Authority endpoint index.
 * Fail closed on any schema, membership, aggregate-role, or presentation-string violation.
 */
export function validateAuthorityDomainCatalogAuthoring(
  authoring: AuthorityDomainCatalogAuthoring,
  authorityNodes: readonly AuthorityNodeEndpoint[],
): void {
  if (!authoring || typeof authoring !== 'object') {
    throw new DomainCatalogValidationError('schema-invalid', 'authoring document is required');
  }
  if (authoring.contract !== 'act-authority-domain-display-catalog-authoring/v1') {
    throw new DomainCatalogValidationError(
      'schema-invalid',
      `unsupported authoring contract ${String(authoring.contract)}`,
    );
  }
  if (typeof authoring.catalogVersion !== 'string' || authoring.catalogVersion.trim().length === 0) {
    throw new DomainCatalogValidationError('schema-invalid', 'catalogVersion is required');
  }
  if (authoring.reviewStatus !== 'reviewed' && authoring.reviewStatus !== 'draft') {
    throw new DomainCatalogValidationError('schema-invalid', 'reviewStatus is invalid');
  }

  assertBinding(authoring.authorityBinding);

  if (!Array.isArray(authoring.domains)) {
    throw new DomainCatalogValidationError('schema-invalid', 'domains must be an array');
  }
  if (authoring.domains.length !== REGISTERED_PEER_DOMAIN_IDS.length) {
    throw new DomainCatalogValidationError(
      'domain-set-size-invalid',
      `catalog must contain exactly ${REGISTERED_PEER_DOMAIN_IDS.length} peer domains`,
    );
  }

  const seenDomains = new Set<string>();
  for (const domain of authoring.domains) {
    assertDomainEntry(domain, seenDomains);
  }
  for (const required of REGISTERED_PEER_DOMAIN_IDS) {
    if (!seenDomains.has(required)) {
      throw new DomainCatalogValidationError(
        'domain-set-incomplete',
        `missing required peer domain ${required}`,
      );
    }
  }

  // Aggregate must not appear as a peer domain.
  if (seenDomains.has(AGGREGATE_ENTRY_ID)) {
    throw new DomainCatalogValidationError(
      'aggregate-promoted-to-peer',
      'aggregate entry must not be listed among peer domains',
    );
  }
  assertAggregate(authoring.aggregate);

  const orders = authoring.domains.map((d) => d.order);
  if (new Set(orders).size !== orders.length) {
    throw new DomainCatalogValidationError('domain-order-duplicate', 'domain order values must be unique');
  }

  const authorityIds = new Set(authorityNodes.map((n) => n.canonicalId));
  const seenCanonical = new Set<string>();
  const seenPairs = new Set<string>();
  if (!Array.isArray(authoring.memberships)) {
    throw new DomainCatalogValidationError('schema-invalid', 'memberships must be an array');
  }
  for (const membership of authoring.memberships) {
    assertMembership(membership, authorityIds, seenCanonical, seenPairs);
  }

  // Defensive: presentation roles vocabulary is closed.
  for (const role of PRESENTATION_ROLES) {
    if (typeof role !== 'string') {
      throw new DomainCatalogValidationError('schema-invalid', 'presentation role vocabulary corrupted');
    }
  }
}

export function sortDomainIds(domainIds: readonly RegisteredPeerDomainId[]): RegisteredPeerDomainId[] {
  return [...domainIds].sort(compareCodePoint) as RegisteredPeerDomainId[];
}
