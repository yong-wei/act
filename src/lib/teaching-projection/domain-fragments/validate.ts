/**
 * Domain fragment and composition validation (#1370).
 *
 * Validity failures (identity drift, dangling endpoints, duplicates, REQUIRED
 * cycles) block the candidate publication. Coverage states never do.
 */

import {
  isRegisteredPeerDomainId,
  type RegisteredPeerDomainId,
} from '@/lib/authority-domain-catalog/contracts';
import type { AuthorityNodeIndexEntry, PrerequisiteStrength } from '../contracts';
import { projectionDigest } from '../hash';
import {
  ACT_TEACHING_LAYER,
  DOMAIN_FRAGMENT_CORE_CARD_POLICIES,
  DOMAIN_FRAGMENT_CORE_SOURCE_KINDS,
  DOMAIN_TEACHING_AUTHORITY_ENVELOPE_CONTRACT,
  isRegisteredTeachingRelationType,
  type DomainFragmentAuthorityBinding,
  type DomainFragmentAuthorityBindingComplete,
  type DomainFragmentAuthoritySelection,
  type DomainFragmentCoreNodeAuthoring,
  type DomainFragmentRelationAuthoring,
  type DomainFragmentRelationPublished,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingCompositionGateFinding,
  type DomainTeachingExpectedAuthority,
  type DomainTeachingFragmentAuthoring,
  type RegisteredTeachingRelationType,
} from './contracts';
import { resolveTeachingRelationPresentation } from './presentation';

export class DomainFragmentValidationError extends Error {
  readonly code: string;
  readonly findings: DomainTeachingCompositionGateFinding[];

  constructor(
    code: string,
    message: string,
    findings: DomainTeachingCompositionGateFinding[] = [],
  ) {
    super(message);
    this.name = 'DomainFragmentValidationError';
    this.code = code;
    this.findings = findings;
  }
}

const SNAPSHOT_HASH = /^[a-f0-9]{64}$/u;
const COMMIT_SHA = /^[a-f0-9]{40}$/u;

/**
 * Require a complete coherent Authority binding.
 * snapshotId must equal `snap-${snapshotHash}`; no field may be null/empty/unbound.
 */
function requireBindingField(
  value: string | null | undefined,
  fieldLabel: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainFragmentValidationError(
      'authority-binding-incomplete',
      `${fieldLabel} is required for a complete Authority binding`,
    );
  }
  return value.trim();
}

export function assertCompleteAuthorityBinding(
  binding: DomainFragmentAuthorityBinding | null | undefined,
  label = 'authorityBinding',
): DomainFragmentAuthorityBindingComplete {
  if (!binding || typeof binding !== 'object') {
    throw new DomainFragmentValidationError(
      'authority-binding-incomplete',
      `${label} is required`,
    );
  }
  const releaseId = requireBindingField(binding.releaseId, `${label}.releaseId`);
  const releaseSetId = requireBindingField(
    binding.releaseSetId,
    `${label}.releaseSetId`,
  );
  const snapshotHash = requireBindingField(
    binding.snapshotHash,
    `${label}.snapshotHash`,
  );
  const snapshotId = requireBindingField(
    binding.snapshotId,
    `${label}.snapshotId`,
  );

  if (!SNAPSHOT_HASH.test(snapshotHash)) {
    throw new DomainFragmentValidationError(
      'authority-binding-incoherent',
      `${label}.snapshotHash must be 64 lowercase hex characters`,
    );
  }
  const expectedSnapshotId = `snap-${snapshotHash}`;
  if (snapshotId !== expectedSnapshotId) {
    throw new DomainFragmentValidationError(
      'authority-binding-incoherent',
      `${label}.snapshotId must equal snap-\${snapshotHash}`,
    );
  }
  if (releaseId === 'unbound' || releaseSetId === 'unbound') {
    throw new DomainFragmentValidationError(
      'authority-binding-incomplete',
      `${label} must not use fabricated unbound identity`,
    );
  }

  return { releaseId, releaseSetId, snapshotId, snapshotHash };
}

export function authorityBindingsEqual(
  left: DomainFragmentAuthorityBindingComplete,
  right: DomainFragmentAuthorityBindingComplete,
): boolean {
  return (
    left.releaseId === right.releaseId
    && left.releaseSetId === right.releaseSetId
    && left.snapshotId === right.snapshotId
    && left.snapshotHash === right.snapshotHash
  );
}

export function authorityBindingMismatchFields(
  left: DomainFragmentAuthorityBindingComplete,
  right: DomainFragmentAuthorityBindingComplete,
): string[] {
  const fields: string[] = [];
  if (left.releaseId !== right.releaseId) fields.push('releaseId');
  if (left.releaseSetId !== right.releaseSetId) fields.push('releaseSetId');
  if (left.snapshotId !== right.snapshotId) fields.push('snapshotId');
  if (left.snapshotHash !== right.snapshotHash) fields.push('snapshotHash');
  return fields;
}

export function authoritySelectionMismatchFields(
  left: DomainFragmentAuthoritySelection,
  right: DomainFragmentAuthoritySelection,
): string[] {
  const fields = authorityBindingMismatchFields(
    left.authorityBinding,
    right.authorityBinding,
  ).map((field) => `authorityBinding.${field}`);
  if (left.sourceDatasetHash !== right.sourceDatasetHash) {
    fields.push('sourceDatasetHash');
  }
  if (left.captureRevision !== right.captureRevision) {
    fields.push('captureRevision');
  }
  if (left.nodeIndexDigest !== right.nodeIndexDigest) {
    fields.push('nodeIndexDigest');
  }
  return fields;
}

export function canonicalAuthorityNodeIndexDigest(
  nodes: readonly AuthorityNodeIndexEntry[],
): string {
  const entries = [...nodes]
    .map((node) => ({
      canonicalId: String(node.canonicalId ?? '').trim(),
      lifecycleStatus: String(node.lifecycleStatus ?? ''),
      successorCanonicalId: node.successorCanonicalId ?? null,
    }))
    .sort((left, right) => compareCodePoint(left.canonicalId, right.canonicalId));
  return projectionDigest({
    kind: 'act-domain-teaching-authority-node-index',
    nodes: entries,
  });
}

export function computeImmutableAuthorityDigest(input: {
  binding: DomainFragmentAuthorityBindingComplete;
  sourceDatasetHash: string;
  captureRevision: string;
  authoringRevision: string;
  nodeIndexDigest: string;
}): string {
  return projectionDigest({
    kind: 'act-domain-teaching-authority-identity',
    binding: input.binding,
    sourceDatasetHash: input.sourceDatasetHash,
    captureRevision: input.captureRevision,
    authoringRevision: input.authoringRevision,
    nodeIndexDigest: input.nodeIndexDigest,
  });
}

function requireSha256(value: string | null | undefined, label: string): string {
  const hash = requireBindingField(value, label);
  if (!SNAPSHOT_HASH.test(hash)) {
    throw new DomainFragmentValidationError(
      'authority-envelope-malformed',
      `authority-envelope-malformed: ${label} must be 64 lowercase hex characters`,
    );
  }
  return hash;
}

export function requireCommitSha(value: string | null | undefined, label: string): string {
  const revision = assertNonEmpty(value, label);
  if (!COMMIT_SHA.test(revision)) {
    throw new DomainFragmentValidationError(
      'authority-envelope-malformed',
      `${label} must be a 40-character lowercase Git SHA`,
    );
  }
  return revision;
}

/**
 * Build the canonical Authority envelope. nodeIndexDigest is recomputed from
 * normalized node identities and is never trusted from the caller.
 */
export function createDomainTeachingAuthorityEnvelope(input: {
  binding: DomainFragmentAuthorityBinding;
  sourceDatasetHash: string;
  captureRevision: string;
  authoringRevision: string;
  nodes: readonly AuthorityNodeIndexEntry[];
  /** If supplied, must match the recomputed digest. */
  nodeIndexDigest?: string;
  authorityDigest?: string;
}): DomainTeachingAuthorityEnvelope {
  if (!Array.isArray(input.nodes)) {
    throw new DomainFragmentValidationError(
      'authority-envelope-malformed',
      'authority envelope nodes must be an array',
    );
  }
  const binding = assertCompleteAuthorityBinding(input.binding, 'envelope.binding');
  const sourceDatasetHash = requireSha256(
    input.sourceDatasetHash,
    'envelope.sourceDatasetHash',
  );
  const captureRevision = requireCommitSha(
    input.captureRevision,
    'envelope.captureRevision',
  );
  const authoringRevision = requireCommitSha(
    input.authoringRevision,
    'envelope.authoringRevision',
  );
  const nodeIndexDigest = canonicalAuthorityNodeIndexDigest(input.nodes);
  if (input.nodeIndexDigest && input.nodeIndexDigest !== nodeIndexDigest) {
    throw new DomainFragmentValidationError(
      'authority-node-index-drift',
      'authority-node-index-drift: envelope.nodeIndexDigest does not match the normalized Authority node index',
    );
  }
  const authorityDigest = computeImmutableAuthorityDigest({
    binding,
    sourceDatasetHash,
    captureRevision,
    authoringRevision,
    nodeIndexDigest,
  });
  if (input.authorityDigest && input.authorityDigest !== authorityDigest) {
    throw new DomainFragmentValidationError(
      'authority-digest-mismatch',
      'envelope.authorityDigest does not match the recomputed immutable Authority digest',
    );
  }
  return {
    contract: DOMAIN_TEACHING_AUTHORITY_ENVELOPE_CONTRACT,
    binding,
    sourceDatasetHash,
    captureRevision,
    authoringRevision,
    nodeIndexDigest,
    authorityDigest,
    nodes: input.nodes,
  };
}

export function assertDomainTeachingAuthorityEnvelope(
  envelope: DomainTeachingAuthorityEnvelope | null | undefined,
  label = 'authority',
): DomainTeachingAuthorityEnvelope {
  if (!envelope || typeof envelope !== 'object') {
    throw new DomainFragmentValidationError(
      'authority-envelope-malformed',
      `${label} envelope is required`,
    );
  }
  if (envelope.contract !== DOMAIN_TEACHING_AUTHORITY_ENVELOPE_CONTRACT) {
    throw new DomainFragmentValidationError(
      'authority-envelope-malformed',
      `${label} envelope contract is invalid`,
    );
  }
  return createDomainTeachingAuthorityEnvelope(envelope);
}

export function authoritySelectionFromEnvelope(
  envelope: DomainTeachingAuthorityEnvelope,
): DomainFragmentAuthoritySelection {
  return {
    authorityBinding: envelope.binding,
    sourceDatasetHash: envelope.sourceDatasetHash,
    captureRevision: envelope.captureRevision,
    nodeIndexDigest: envelope.nodeIndexDigest,
  };
}

export function expectedAuthorityFromEnvelope(
  envelope: DomainTeachingAuthorityEnvelope,
): DomainTeachingExpectedAuthority {
  return {
    binding: envelope.binding,
    sourceDatasetHash: envelope.sourceDatasetHash,
    captureRevision: envelope.captureRevision,
    authoringRevision: envelope.authoringRevision,
    nodeIndexDigest: envelope.nodeIndexDigest,
    authorityDigest: envelope.authorityDigest,
  };
}

export function assertExpectedAuthority(
  expected: DomainTeachingExpectedAuthority | null | undefined,
  label = 'expectedAuthority',
): Required<DomainTeachingExpectedAuthority> {
  if (!expected || typeof expected !== 'object') {
    throw new DomainFragmentValidationError(
      'authority-envelope-malformed',
      `${label} is required`,
    );
  }
  const binding = assertCompleteAuthorityBinding(expected.binding, `${label}.binding`);
  const sourceDatasetHash = requireSha256(
    expected.sourceDatasetHash,
    `${label}.sourceDatasetHash`,
  );
  const captureRevision = requireCommitSha(
    expected.captureRevision,
    `${label}.captureRevision`,
  );
  const authoringRevision = requireCommitSha(
    expected.authoringRevision,
    `${label}.authoringRevision`,
  );
  const nodeIndexDigest = requireSha256(
    expected.nodeIndexDigest,
    `${label}.nodeIndexDigest`,
  );
  const authorityDigest = computeImmutableAuthorityDigest({
    binding,
    sourceDatasetHash,
    captureRevision,
    authoringRevision,
    nodeIndexDigest,
  });
  if (expected.authorityDigest && expected.authorityDigest !== authorityDigest) {
    throw new DomainFragmentValidationError(
      'authority-digest-mismatch',
      `${label}.authorityDigest does not match the recomputed immutable Authority digest`,
    );
  }
  return {
    binding,
    sourceDatasetHash,
    captureRevision,
    authoringRevision,
    nodeIndexDigest,
    authorityDigest,
  };
}

export function assertPublishedAuthoritySelection(
  selection: DomainFragmentAuthoritySelection | null | undefined,
  expectedBinding: DomainFragmentAuthorityBinding,
  expectedRevision: string,
  label = 'authoritySelection',
): DomainFragmentAuthoritySelection {
  if (!selection || typeof selection !== 'object') {
    throw new DomainFragmentValidationError(
      'authority-selection-incomplete',
      `${label} is required`,
    );
  }
  const authorityBinding = assertCompleteAuthorityBinding(
    selection.authorityBinding,
    `${label}.authorityBinding`,
  );
  const expected = assertCompleteAuthorityBinding(expectedBinding, 'authorityBinding');
  const mismatch = authorityBindingMismatchFields(authorityBinding, expected);
  if (mismatch.length > 0) {
    throw new DomainFragmentValidationError(
      'authority-selection-mismatch',
      `${label}.authorityBinding mismatches authorityBinding on: ${mismatch.join(', ')}`,
    );
  }
  const sourceDatasetHash = requireSha256(
    selection.sourceDatasetHash,
    `${label}.sourceDatasetHash`,
  );
  const captureRevision = requireCommitSha(
    selection.captureRevision,
    `${label}.captureRevision`,
  );
  void expectedRevision;
  const nodeIndexDigest = requireSha256(
    selection.nodeIndexDigest,
    `${label}.nodeIndexDigest`,
  );
  return {
    authorityBinding,
    sourceDatasetHash,
    captureRevision,
    nodeIndexDigest,
  };
}

/**
 * Verify optional authoring claims against the canonical envelope.
 * Endpoints resolve only from envelope.nodes.
 */
export function assertAuthoringMatchesEnvelope(
  authoring: DomainTeachingFragmentAuthoring,
  envelope: DomainTeachingAuthorityEnvelope,
): DomainFragmentAuthoritySelection {
  const sealed = assertDomainTeachingAuthorityEnvelope(envelope, 'build.authority');
  const authoringRevision = requireCommitSha(
    authoring.authoringRevision,
    'authoringRevision',
  );
  if (authoringRevision !== sealed.authoringRevision) {
    throw new DomainFragmentValidationError(
      'source-revision-mismatch',
      'authoringRevision does not match the Authority envelope authoringRevision',
    );
  }
  const binding = assertCompleteAuthorityBinding(
    authoring.authorityBinding,
    'authorityBinding',
  );
  const bindingMismatch = authorityBindingMismatchFields(binding, sealed.binding);
  if (bindingMismatch.length > 0) {
    throw new DomainFragmentValidationError(
      'authority-binding-mismatch',
      `authoring.authorityBinding mismatches envelope on: ${bindingMismatch.join(', ')}`,
    );
  }
  if (
    authoring.captureRevision
    && authoring.captureRevision !== sealed.captureRevision
  ) {
    throw new DomainFragmentValidationError(
      'source-revision-mismatch',
      'authoring.captureRevision does not match the Authority envelope',
    );
  }
  if (
    authoring.sourceDatasetHash
    && authoring.sourceDatasetHash !== sealed.sourceDatasetHash
  ) {
    throw new DomainFragmentValidationError(
      'source-digest-mismatch',
      'authoring.sourceDatasetHash does not match the Authority envelope',
    );
  }
  if (
    authoring.nodeIndexDigest
    && authoring.nodeIndexDigest !== sealed.nodeIndexDigest
  ) {
    throw new DomainFragmentValidationError(
      'authority-node-index-drift',
      'authoring.nodeIndexDigest does not match the recomputed envelope digest',
    );
  }
  if (authoring.authoritySelection) {
    const claimed = assertPublishedAuthoritySelection(
      authoring.authoritySelection,
      sealed.binding,
      sealed.captureRevision,
      'authoring.authoritySelection',
    );
    const selectionMismatch = authoritySelectionMismatchFields(
      claimed,
      authoritySelectionFromEnvelope(sealed),
    );
    if (selectionMismatch.length > 0) {
      throw new DomainFragmentValidationError(
        'authority-selection-mismatch',
        `authoring.authoritySelection mismatches envelope on: ${selectionMismatch.join(', ')}`,
      );
    }
  }
  return authoritySelectionFromEnvelope(sealed);
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortDomainKeys(
  keys: readonly RegisteredPeerDomainId[],
): RegisteredPeerDomainId[] {
  return [...keys].sort(compareCodePoint);
}

export function assertNonEmpty(value: string | null | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainFragmentValidationError(
      'schema-invalid',
      `${label} must be a non-empty string`,
    );
  }
  return value.trim();
}

function isUsableAuthority(node: AuthorityNodeIndexEntry | undefined): boolean {
  if (!node) return false;
  const lifecycle = String(node.lifecycleStatus ?? '').toLowerCase();
  return lifecycle === 'active' || lifecycle === '';
}

export function domainFragmentEdgeIdentityKey(input: {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  strength: PrerequisiteStrength;
}): string {
  return [
    input.sourceNodeId,
    input.targetNodeId,
    input.relationType,
    input.strength,
  ].join('\u001f');
}

/**
 * Semantic identity of a teaching edge for composition.
 * Domain membership and evidence are excluded so the same edge can be unioned.
 */
export function domainFragmentEdgeSemanticKey(input: {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  strength: PrerequisiteStrength | string;
}): string {
  return [
    input.sourceNodeId,
    input.targetNodeId,
    input.relationType,
    input.strength,
  ].join('\u001f');
}

/**
 * Detect directed cycles among REQUIRED edges. Returns one cycle path each.
 */
export function detectDomainRequiredCycles(
  edges: readonly {
    sourceNodeId: string;
    targetNodeId: string;
    strength: string;
  }[],
): string[][] {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.strength !== 'REQUIRED') continue;
    if (edge.sourceNodeId === edge.targetNodeId) continue;
    const list = adj.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    adj.set(edge.sourceNodeId, list);
  }

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) cycles.push([...stack.slice(idx), node]);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of adj.get(node) ?? []) dfs(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of [...adj.keys()].sort(compareCodePoint)) dfs(node);
  return cycles;
}

export function validateDomainKeys(
  keys: readonly string[],
  label: string,
): RegisteredPeerDomainId[] {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new DomainFragmentValidationError(
      'schema-invalid',
      `${label} must declare at least one registered domain key`,
    );
  }
  const seen = new Set<string>();
  const normalized: RegisteredPeerDomainId[] = [];
  for (const key of keys) {
    if (!isRegisteredPeerDomainId(key)) {
      throw new DomainFragmentValidationError(
        'schema-invalid',
        `${label} contains unregistered domain key: ${key}`,
      );
    }
    if (seen.has(key)) {
      throw new DomainFragmentValidationError(
        'duplicate-domain-key',
        `${label} contains duplicate domain key: ${key}`,
      );
    }
    seen.add(key);
    normalized.push(key);
  }
  return sortDomainKeys(normalized);
}

function validateCoreNodeAuthoring(
  node: DomainFragmentCoreNodeAuthoring,
  fragmentDomainKeys: ReadonlySet<RegisteredPeerDomainId>,
  findings: DomainTeachingCompositionGateFinding[],
): void {
  try {
    assertNonEmpty(node.canonicalId, 'coreNodes.canonicalId');
    assertNonEmpty(node.rationale, 'coreNodes.rationale');
  } catch (error) {
    if (error instanceof DomainFragmentValidationError) {
      findings.push({
        code: error.code,
        severity: 'error',
        message: error.message,
        canonicalId: node.canonicalId,
      });
      return;
    }
    throw error;
  }

  if (
    !(DOMAIN_FRAGMENT_CORE_CARD_POLICIES as readonly string[]).includes(
      node.cardPolicy,
    )
  ) {
    findings.push({
      code: 'schema-invalid',
      severity: 'error',
      message: `invalid cardPolicy for ${node.canonicalId}`,
      canonicalId: node.canonicalId,
    });
  }
  if (
    !(DOMAIN_FRAGMENT_CORE_SOURCE_KINDS as readonly string[]).includes(
      node.sourceKind,
    )
  ) {
    findings.push({
      code: 'schema-invalid',
      severity: 'error',
      message: `invalid sourceKind for ${node.canonicalId}`,
      canonicalId: node.canonicalId,
    });
  }
  if (!Array.isArray(node.sourceEvidence) || node.sourceEvidence.length === 0) {
    findings.push({
      code: 'missing-evidence',
      severity: 'error',
      message: `core node ${node.canonicalId} requires sourceEvidence`,
      canonicalId: node.canonicalId,
    });
  }

  let domainKeys: RegisteredPeerDomainId[] = [];
  try {
    domainKeys = validateDomainKeys(node.domainKeys as string[], `core node ${node.canonicalId}`);
  } catch (error) {
    if (error instanceof DomainFragmentValidationError) {
      findings.push({
        code: error.code,
        severity: 'error',
        message: error.message,
        canonicalId: node.canonicalId,
      });
      return;
    }
    throw error;
  }
  for (const domainId of domainKeys) {
    if (!fragmentDomainKeys.has(domainId)) {
      findings.push({
        code: 'domain-key-mismatch',
        severity: 'error',
        message: `core node ${node.canonicalId} domain ${domainId} not declared on fragment`,
        canonicalId: node.canonicalId,
        domainId,
      });
    }
  }
}

function validateRelationAuthoring(
  relation: DomainFragmentRelationAuthoring,
  fragmentDomainKeys: ReadonlySet<RegisteredPeerDomainId>,
  coreNodeIds: ReadonlySet<string>,
  authorityById: ReadonlyMap<string, AuthorityNodeIndexEntry>,
  findings: DomainTeachingCompositionGateFinding[],
): void {
  const source = relation.sourceNodeId?.trim() ?? '';
  const target = relation.targetNodeId?.trim() ?? '';
  if (!source || !target) {
    findings.push({
      code: 'schema-invalid',
      severity: 'error',
      message: 'relation requires sourceNodeId and targetNodeId',
      edgeId: relation.edgeId,
    });
    return;
  }
  if (source === target) {
    findings.push({
      code: 'self-loop',
      severity: 'error',
      message: `self-loop forbidden: ${source}`,
      edgeId: relation.edgeId,
      canonicalId: source,
    });
  }
  if (relation.strength !== 'REQUIRED' && relation.strength !== 'RECOMMENDED') {
    findings.push({
      code: 'schema-invalid',
      severity: 'error',
      message: `invalid strength for ${source}->${target}`,
      edgeId: relation.edgeId,
    });
  }
  if (!isRegisteredTeachingRelationType(relation.relationType)) {
    findings.push({
      code: 'unregistered-relation-type',
      severity: 'error',
      message: `relation type ${relation.relationType} is not registered for teaching presentation`,
      edgeId: relation.edgeId,
    });
  } else {
    const presentation = resolveTeachingRelationPresentation(relation.relationType);
    if (!presentation.supported) {
      findings.push({
        code: 'unsupported-relation-presentation',
        severity: 'error',
        message: `relation type ${relation.relationType} lacks supported presentation`,
        edgeId: relation.edgeId,
      });
    }
  }

  // Endpoint closure: both ends must be in core denominator and Authority.
  if (!coreNodeIds.has(source)) {
    findings.push({
      code: 'dangling-endpoint',
      severity: 'error',
      message: `source ${source} is not a core node in this fragment set`,
      edgeId: relation.edgeId,
      canonicalId: source,
    });
  }
  if (!coreNodeIds.has(target)) {
    findings.push({
      code: 'dangling-endpoint',
      severity: 'error',
      message: `target ${target} is not a core node in this fragment set`,
      edgeId: relation.edgeId,
      canonicalId: target,
    });
  }
  if (!isUsableAuthority(authorityById.get(source))) {
    findings.push({
      code: 'invalid-authority-endpoint',
      severity: 'error',
      message: `source ${source} is not an active Authority object`,
      edgeId: relation.edgeId,
      canonicalId: source,
    });
  }
  if (!isUsableAuthority(authorityById.get(target))) {
    findings.push({
      code: 'invalid-authority-endpoint',
      severity: 'error',
      message: `target ${target} is not an active Authority object`,
      edgeId: relation.edgeId,
      canonicalId: target,
    });
  }

  const evidenceRefs = relation.evidenceRefs ?? [];
  const rationale =
    typeof relation.curatorRationale === 'string'
      ? relation.curatorRationale.trim()
      : '';
  if (evidenceRefs.length === 0 && !rationale) {
    findings.push({
      code: 'missing-evidence',
      severity: 'error',
      message: `relation ${source}->${target} requires evidenceRefs or curatorRationale`,
      edgeId: relation.edgeId,
    });
  }

  let domainKeys: RegisteredPeerDomainId[] = [];
  try {
    domainKeys = validateDomainKeys(
      relation.domainKeys as string[],
      `relation ${source}->${target}`,
    );
  } catch (error) {
    if (error instanceof DomainFragmentValidationError) {
      findings.push({
        code: error.code,
        severity: 'error',
        message: error.message,
        edgeId: relation.edgeId,
      });
      return;
    }
    throw error;
  }
  for (const domainId of domainKeys) {
    if (!fragmentDomainKeys.has(domainId)) {
      findings.push({
        code: 'domain-key-mismatch',
        severity: 'error',
        message: `relation domain ${domainId} not declared on fragment`,
        edgeId: relation.edgeId,
        domainId,
      });
    }
  }
}

/**
 * Validate a single fragment authoring input (local endpoint + schema checks).
 */
export function validateDomainFragmentAuthoring(
  authoring: DomainTeachingFragmentAuthoring,
  authority: DomainTeachingAuthorityEnvelope,
): DomainTeachingCompositionGateFinding[] {
  const findings: DomainTeachingCompositionGateFinding[] = [];

  let envelope: DomainTeachingAuthorityEnvelope;
  try {
    assertNonEmpty(authoring.fragmentKey, 'fragmentKey');
    assertNonEmpty(authoring.fragmentVersion, 'fragmentVersion');
    assertNonEmpty(authoring.authoringRevision, 'authoringRevision');
    envelope = assertDomainTeachingAuthorityEnvelope(authority, 'authority');
    assertAuthoringMatchesEnvelope(authoring, envelope);
  } catch (error) {
    if (error instanceof DomainFragmentValidationError) {
      findings.push({
        code: error.code,
        severity: 'error',
        message: error.message,
      });
      return findings;
    }
    throw error;
  }

  let fragmentDomainKeys: RegisteredPeerDomainId[] = [];
  try {
    fragmentDomainKeys = validateDomainKeys(
      authoring.domainKeys as string[],
      'fragment.domainKeys',
    );
  } catch (error) {
    if (error instanceof DomainFragmentValidationError) {
      findings.push({
        code: error.code,
        severity: 'error',
        message: error.message,
      });
      return findings;
    }
    throw error;
  }
  const fragmentDomainSet = new Set(fragmentDomainKeys);

  const authorityById = new Map(
    envelope.nodes.map((node) => [node.canonicalId, node]),
  );

  const coreIds = new Set<string>();
  for (const node of authoring.coreNodes ?? []) {
    if (coreIds.has(node.canonicalId)) {
      findings.push({
        code: 'duplicate-core-node',
        severity: 'error',
        message: `duplicate core node ${node.canonicalId}`,
        canonicalId: node.canonicalId,
      });
    }
    coreIds.add(node.canonicalId);
    if (!isUsableAuthority(authorityById.get(node.canonicalId))) {
      findings.push({
        code: 'invalid-authority-endpoint',
        severity: 'error',
        message: `core node ${node.canonicalId} is not an active Authority object`,
        canonicalId: node.canonicalId,
      });
    }
    validateCoreNodeAuthoring(node, fragmentDomainSet, findings);
  }

  const identitySeen = new Map<string, string>();
  for (const relation of authoring.relations ?? []) {
    validateRelationAuthoring(
      relation,
      fragmentDomainSet,
      coreIds,
      authorityById,
      findings,
    );
    if (
      relation.sourceNodeId
      && relation.targetNodeId
      && (relation.strength === 'REQUIRED' || relation.strength === 'RECOMMENDED')
      && isRegisteredTeachingRelationType(relation.relationType)
    ) {
      const key = domainFragmentEdgeIdentityKey({
        sourceNodeId: relation.sourceNodeId,
        targetNodeId: relation.targetNodeId,
        relationType: relation.relationType,
        strength: relation.strength,
      });
      const prior = identitySeen.get(key);
      if (prior) {
        findings.push({
          code: 'duplicate-edge',
          severity: 'error',
          message: `duplicate relation identity ${relation.sourceNodeId}->${relation.targetNodeId}:${relation.relationType}:${relation.strength}`,
          edgeId: relation.edgeId ?? prior,
        });
      } else {
        identitySeen.set(key, relation.edgeId ?? key);
      }
    }
  }

  const requiredCycles = detectDomainRequiredCycles(authoring.relations ?? []);
  for (const cycle of requiredCycles) {
    findings.push({
      code: 'required-cycle',
      severity: 'error',
      message: `REQUIRED-edge cycle: ${cycle.join(' -> ')}`,
    });
  }

  return findings;
}

/**
 * Validate the complete composed candidate: cross-fragment duplicates and
 * global REQUIRED DAG.
 */
export function validateComposedRelations(
  relations: readonly DomainFragmentRelationPublished[],
): DomainTeachingCompositionGateFinding[] {
  const findings: DomainTeachingCompositionGateFinding[] = [];
  const identitySeen = new Map<string, string>();

  for (const relation of relations) {
    if (relation.layer !== ACT_TEACHING_LAYER) {
      findings.push({
        code: 'invalid-layer',
        severity: 'error',
        message: `relation ${relation.edgeId} must use ACT_TEACHING layer`,
        edgeId: relation.edgeId,
      });
    }
    if (!isRegisteredTeachingRelationType(relation.relationType)) {
      findings.push({
        code: 'unregistered-relation-type',
        severity: 'error',
        message: `composed relation ${relation.edgeId} has unregistered type`,
        edgeId: relation.edgeId,
      });
    }
    const key = domainFragmentEdgeIdentityKey({
      sourceNodeId: relation.sourceNodeId,
      targetNodeId: relation.targetNodeId,
      relationType: relation.relationType,
      strength: relation.strength,
    });
    const prior = identitySeen.get(key);
    if (prior && prior !== relation.edgeId) {
      findings.push({
        code: 'duplicate-edge',
        severity: 'error',
        message: `duplicate composed relation identity for ${relation.edgeId} conflicts with ${prior}`,
        edgeId: relation.edgeId,
      });
    } else {
      identitySeen.set(key, relation.edgeId);
    }
  }

  for (const cycle of detectDomainRequiredCycles(relations)) {
    findings.push({
      code: 'required-cycle',
      severity: 'error',
      message: `composed REQUIRED-edge cycle: ${cycle.join(' -> ')}`,
    });
  }

  return findings;
}

export function assertFragmentDigestMatch(
  fragment: { fragmentDigest: string; fragmentId: string },
  recomputedDigest: string,
): void {
  if (fragment.fragmentDigest !== recomputedDigest) {
    throw new DomainFragmentValidationError(
      'fragment-identity-drift',
      `fragment ${fragment.fragmentId} digest does not match recomputed digest`,
      [
        {
          code: 'fragment-identity-drift',
          severity: 'error',
          message: `fragment ${fragment.fragmentId} digest mismatch`,
          fragmentId: fragment.fragmentId,
        },
      ],
    );
  }
}

export type { RegisteredTeachingRelationType };
