/**
 * Pure ACT-owned ReleaseSet Delta calculator.
 *
 * Inputs are already-normalized semantic snapshots; no Prisma/IO here.
 */
import { createHash } from 'node:crypto';

import type {
  ComputedReleaseSetDelta,
  DeltaEvidenceRef,
  DeltaObjectRecord,
  DeltaRelationRecord,
  DeltaSemanticSnapshot,
  DeltaSignalDigestKey,
  DeltaSignalRecord,
  DeltaSignalReason,
  DeltaSignalScope,
  DeltaVocabulary,
  IdentityIntegrityViolation,
  JsonObject,
  ObjectDeltaChanges,
  RelationDeltaChanges,
  ReleaseSetDeltaDetails,
  ReleaseSetDeltaSummary,
  UpstreamCrosscheckResult,
  UpstreamReleaseDiffV1,
} from './release-set-delta-types';
import {
  RELEASE_SET_DELTA_ALGORITHM_VERSION,
  UPSTREAM_RELEASE_DIFF_CONTRACT,
} from './release-set-delta-types';

const SIGNAL_SCOPES = new Set<DeltaSignalScope>([
  'object', 'relation', 'crosswalk', 'component', 'projection', 'vocabulary',
]);
const SIGNAL_ACTIONS = new Set(['candidate', 'invalidation']);
const SIGNAL_REASONS = new Set<DeltaSignalReason>([
  'added', 'removed', 'payload_changed', 'type_changed', 'tier_changed', 'superseded',
  'predicate_changed', 'direction_changed', 'endpoint_changed', 'digest_changed',
  'profile_added', 'profile_removed', 'changed',
]);
const SIGNAL_TOP_KEYS = new Set(['scope', 'identity', 'action', 'reason', 'digests', 'signalDigest']);
const SIGNAL_DIGEST_KEYS = new Set<DeltaSignalDigestKey>([
  'replacement', 'predecessor', 'baseDigest', 'candidateDigest',
]);
const FORBIDDEN_SIGNAL_KEYS = new Set([
  'courseRole', 'course_role', 'resourceRole', 'resource_role',
  'teachingRelation', 'teaching_relation', 'selector', 'selectorMutation',
  'activeSelector', 'legacySelector', 'candidateSelector',
]);

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.keys(value as JsonObject)
        .sort()
        .map((key) => [key, sortJson((value as JsonObject)[key])]),
    );
  }
  return value;
}

export function emptyDetails(): ReleaseSetDeltaDetails {
  return {
    objects: {
      added: [],
      removed: [],
      payloadChanged: [],
      typeChanged: [],
      tierChanged: [],
      superseded: [],
    },
    relations: {
      added: [],
      removed: [],
      predicateChanged: [],
      directionChanged: [],
      tierChanged: [],
      endpointChanged: [],
    },
    crosswalk: { added: [], removed: [] },
    components: { added: [], removed: [], changed: [] },
    projections: { addedProfiles: [], removedProfiles: [], digestChanged: [] },
    vocabulary: {
      addedTypes: [],
      addedPredicates: [],
      removedTypes: [],
      removedPredicates: [],
    },
  };
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function indexBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row);
    if (map.has(key)) {
      throw new Error(`duplicate delta identity ${key}`);
    }
    map.set(key, row);
  }
  return map;
}

/**
 * Material identity is the hard gate under one Canonical ID:
 * canonicalType + semanticName. Display labels and free-form payload fields
 * surface as payload_changed instead.
 */
export function digestObjectMaterialIdentity(input: {
  canonicalId: string;
  canonicalType: string;
  semanticName: string | null;
}): string {
  return sha256Hex(canonicalJson({
    canonicalId: input.canonicalId,
    canonicalType: input.canonicalType,
    semanticName: input.semanticName,
  }));
}

export function digestPayload(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function buildVocabulary(
  objects: DeltaObjectRecord[],
  relations: DeltaRelationRecord[],
): DeltaVocabulary {
  return {
    objectTypes: sortedUnique(objects.map((row) => row.canonicalType)),
    predicates: sortedUnique(relations.map((row) => row.predicate)),
  };
}

export function computeSemanticCollectionDigest(
  snapshot: Omit<DeltaSemanticSnapshot, 'semanticCollectionDigest'>,
): string {
  return sha256Hex(canonicalJson({
    releaseId: snapshot.releaseId,
    releaseVersion: snapshot.releaseVersion,
    releaseHash: snapshot.releaseHash,
    sourceDatasetHash: snapshot.sourceDatasetHash,
    runtimeProjectionDigest: snapshot.runtimeProjectionDigest,
    objects: snapshot.objects,
    relations: snapshot.relations,
    crosswalk: snapshot.crosswalk,
    components: snapshot.components,
    projections: snapshot.projections,
    vocabulary: snapshot.vocabulary,
  }));
}

export function isPackagingRevisionOnly(
  base: DeltaSemanticSnapshot,
  candidate: DeltaSemanticSnapshot,
): boolean {
  return (
    base.releaseId === candidate.releaseId
    && base.releaseHash === candidate.releaseHash
    && base.sourceDatasetHash === candidate.sourceDatasetHash
    && base.semanticCollectionDigest === candidate.semanticCollectionDigest
  );
}

/**
 * Record every observable field change, then emit identity violations.
 * Violations never suppress the detailed change arrays.
 */
function compareObjects(
  base: Map<string, DeltaObjectRecord>,
  candidate: Map<string, DeltaObjectRecord>,
): { changes: ObjectDeltaChanges; violations: IdentityIntegrityViolation[] } {
  const changes: ObjectDeltaChanges = {
    added: [],
    removed: [],
    payloadChanged: [],
    typeChanged: [],
    tierChanged: [],
    superseded: [],
  };
  const violations: IdentityIntegrityViolation[] = [];

  for (const [id, cand] of candidate) {
    const prev = base.get(id);
    if (!prev) {
      changes.added.push(id);
      continue;
    }

    if (prev.canonicalType !== cand.canonicalType) {
      changes.typeChanged.push(id);
      violations.push({
        code: 'canonical_type_replacement',
        identity: id,
        message: `canonical type changed under ${id} without an accepted supersession identity split (${prev.canonicalType} → ${cand.canonicalType})`,
      });
    }

    if (prev.materialIdentityDigest !== cand.materialIdentityDigest) {
      // Type change already violates; semanticName-only also fails closed.
      if (prev.canonicalType === cand.canonicalType) {
        violations.push({
          code: 'material_identity_replacement',
          identity: id,
          message: `material identity (canonicalType/semanticName) replaced under ${id} without supersession`,
        });
      } else if (!violations.some((row) => row.identity === id && row.code === 'canonical_type_replacement')) {
        violations.push({
          code: 'material_identity_replacement',
          identity: id,
          message: `material identity replaced under ${id} without supersession`,
        });
      }
    }

    if (prev.releaseTier !== cand.releaseTier) {
      changes.tierChanged.push(id);
    }
    if (prev.payloadDigest !== cand.payloadDigest) {
      changes.payloadChanged.push(id);
    }
  }

  for (const [id] of base) {
    if (candidate.has(id)) continue;
    changes.removed.push(id);
    for (const cand of candidate.values()) {
      if (cand.supersedes === id) {
        changes.superseded.push({ from: id, to: cand.canonicalId });
      }
    }
  }

  changes.added = sortedUnique(changes.added);
  changes.removed = sortedUnique(changes.removed);
  changes.payloadChanged = sortedUnique(changes.payloadChanged);
  changes.typeChanged = sortedUnique(changes.typeChanged);
  changes.tierChanged = sortedUnique(changes.tierChanged);
  changes.superseded = [...changes.superseded].sort((a, b) => (
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
  ));

  return { changes, violations };
}

function compareRelations(
  base: Map<string, DeltaRelationRecord>,
  candidate: Map<string, DeltaRelationRecord>,
): { changes: RelationDeltaChanges; violations: IdentityIntegrityViolation[] } {
  const changes: RelationDeltaChanges = {
    added: [],
    removed: [],
    predicateChanged: [],
    directionChanged: [],
    tierChanged: [],
    endpointChanged: [],
  };
  const violations: IdentityIntegrityViolation[] = [];

  for (const [id, cand] of candidate) {
    const prev = base.get(id);
    if (!prev) {
      changes.added.push(id);
      continue;
    }

    const endpointChanged = prev.sourceId !== cand.sourceId || prev.targetId !== cand.targetId;
    const directionChanged = prev.direction !== cand.direction;

    if (endpointChanged) {
      changes.endpointChanged.push(id);
      violations.push({
        code: 'relation_endpoint_replacement',
        identity: id,
        message: `relation ${id} changed endpoints in place; require a new relation identity`,
      });
    }
    if (directionChanged) {
      changes.directionChanged.push(id);
      violations.push({
        code: 'relation_direction_replacement',
        identity: id,
        message: `relation ${id} changed direction in place; require a new relation identity`,
      });
    }
    if (prev.predicate !== cand.predicate) {
      changes.predicateChanged.push(id);
    }
    if (prev.releaseTier !== cand.releaseTier) {
      changes.tierChanged.push(id);
    }
  }

  for (const id of base.keys()) {
    if (!candidate.has(id)) changes.removed.push(id);
  }

  changes.added = sortedUnique(changes.added);
  changes.removed = sortedUnique(changes.removed);
  changes.predicateChanged = sortedUnique(changes.predicateChanged);
  changes.directionChanged = sortedUnique(changes.directionChanged);
  changes.tierChanged = sortedUnique(changes.tierChanged);
  changes.endpointChanged = sortedUnique(changes.endpointChanged);
  return { changes, violations };
}

function compareCrosswalk(
  base: Map<string, { tripleKey: string }>,
  candidate: Map<string, { tripleKey: string }>,
): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  for (const key of candidate.keys()) {
    if (!base.has(key)) added.push(key);
  }
  for (const key of base.keys()) {
    if (!candidate.has(key)) removed.push(key);
  }
  return { added: sortedUnique(added), removed: sortedUnique(removed) };
}

function compareComponents(
  base: Map<string, {
    componentReleaseId: string;
    releaseHash: string;
    protocol: string;
    referenceKind: string | null;
    payloadDigest: string;
  }>,
  candidate: Map<string, {
    componentReleaseId: string;
    releaseHash: string;
    protocol: string;
    referenceKind: string | null;
    payloadDigest: string;
  }>,
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [id, cand] of candidate) {
    const prev = base.get(id);
    if (!prev) {
      added.push(id);
      continue;
    }
    if (
      prev.releaseHash !== cand.releaseHash
      || prev.protocol !== cand.protocol
      || prev.referenceKind !== cand.referenceKind
      || prev.payloadDigest !== cand.payloadDigest
    ) {
      changed.push(id);
    }
  }
  for (const id of base.keys()) {
    if (!candidate.has(id)) removed.push(id);
  }
  return {
    added: sortedUnique(added),
    removed: sortedUnique(removed),
    changed: sortedUnique(changed),
  };
}

function compareProjections(
  base: Map<string, { profile: string; versionDigest: string }>,
  candidate: Map<string, { profile: string; versionDigest: string }>,
): ReleaseSetDeltaDetails['projections'] {
  const addedProfiles: string[] = [];
  const removedProfiles: string[] = [];
  const digestChanged: Array<{ profile: string; baseDigest: string; candidateDigest: string }> = [];

  for (const [profile, cand] of candidate) {
    const prev = base.get(profile);
    if (!prev) {
      addedProfiles.push(profile);
      continue;
    }
    if (prev.versionDigest !== cand.versionDigest) {
      digestChanged.push({
        profile,
        baseDigest: prev.versionDigest,
        candidateDigest: cand.versionDigest,
      });
    }
  }
  for (const profile of base.keys()) {
    if (!candidate.has(profile)) removedProfiles.push(profile);
  }

  return {
    addedProfiles: sortedUnique(addedProfiles),
    removedProfiles: sortedUnique(removedProfiles),
    digestChanged: digestChanged.sort((a, b) => a.profile.localeCompare(b.profile)),
  };
}

function compareVocabulary(
  base: DeltaVocabulary,
  candidate: DeltaVocabulary,
): ReleaseSetDeltaDetails['vocabulary'] {
  const baseTypes = new Set(base.objectTypes);
  const candTypes = new Set(candidate.objectTypes);
  const basePreds = new Set(base.predicates);
  const candPreds = new Set(candidate.predicates);
  return {
    addedTypes: sortedUnique([...candTypes].filter((value) => !baseTypes.has(value))),
    addedPredicates: sortedUnique([...candPreds].filter((value) => !basePreds.has(value))),
    removedTypes: sortedUnique([...baseTypes].filter((value) => !candTypes.has(value))),
    removedPredicates: sortedUnique([...basePreds].filter((value) => !candPreds.has(value))),
  };
}

function summarize(details: ReleaseSetDeltaDetails, signalCount: number): ReleaseSetDeltaSummary {
  return {
    objectAdded: details.objects.added.length,
    objectRemoved: details.objects.removed.length,
    objectPayloadChanged: details.objects.payloadChanged.length,
    objectTypeChanged: details.objects.typeChanged.length,
    objectTierChanged: details.objects.tierChanged.length,
    objectSuperseded: details.objects.superseded.length,
    relationAdded: details.relations.added.length,
    relationRemoved: details.relations.removed.length,
    relationPredicateChanged: details.relations.predicateChanged.length,
    relationDirectionChanged: details.relations.directionChanged.length,
    relationTierChanged: details.relations.tierChanged.length,
    relationEndpointChanged: details.relations.endpointChanged.length,
    crosswalkAdded: details.crosswalk.added.length,
    crosswalkRemoved: details.crosswalk.removed.length,
    componentAdded: details.components.added.length,
    componentRemoved: details.components.removed.length,
    componentChanged: details.components.changed.length,
    projectionProfileAdded: details.projections.addedProfiles.length,
    projectionProfileRemoved: details.projections.removedProfiles.length,
    projectionDigestChanged: details.projections.digestChanged.length,
    vocabularyTypeAdded: details.vocabulary.addedTypes.length,
    vocabularyPredicateAdded: details.vocabulary.addedPredicates.length,
    vocabularyTypeRemoved: details.vocabulary.removedTypes.length,
    vocabularyPredicateRemoved: details.vocabulary.removedPredicates.length,
    signalCount,
  };
}

export function computeSignalDigest(row: {
  scope: DeltaSignalScope;
  identity: string;
  action: DeltaSignalRecord['action'];
  reason: DeltaSignalReason;
  digests?: Partial<Record<DeltaSignalDigestKey, string>>;
}): string {
  return sha256Hex(canonicalJson({
    scope: row.scope,
    identity: row.identity,
    action: row.action,
    reason: row.reason,
    digests: row.digests ?? null,
  }));
}

function signal(
  scope: DeltaSignalScope,
  identity: string,
  action: DeltaSignalRecord['action'],
  reason: DeltaSignalReason,
  digests?: Partial<Record<DeltaSignalDigestKey, string>>,
): DeltaSignalRecord {
  return {
    scope,
    identity,
    action,
    reason,
    digests,
    signalDigest: computeSignalDigest({ scope, identity, action, reason, digests }),
  };
}

/**
 * Emit stable, deduplicated generic signals.
 */
export function emitDeltaSignals(details: ReleaseSetDeltaDetails): DeltaSignalRecord[] {
  const signals: DeltaSignalRecord[] = [];

  for (const id of details.objects.added) {
    signals.push(signal('object', id, 'candidate', 'added'));
  }
  for (const id of details.objects.removed) {
    signals.push(signal('object', id, 'invalidation', 'removed'));
  }
  for (const id of details.objects.payloadChanged) {
    signals.push(signal('object', id, 'invalidation', 'payload_changed'));
    signals.push(signal('object', id, 'candidate', 'payload_changed'));
  }
  for (const id of details.objects.typeChanged) {
    signals.push(signal('object', id, 'invalidation', 'type_changed'));
    signals.push(signal('object', id, 'candidate', 'type_changed'));
  }
  for (const id of details.objects.tierChanged) {
    signals.push(signal('object', id, 'candidate', 'tier_changed'));
  }
  for (const pair of details.objects.superseded) {
    signals.push(signal('object', pair.from, 'invalidation', 'superseded', { replacement: pair.to }));
    signals.push(signal('object', pair.to, 'candidate', 'superseded', { predecessor: pair.from }));
  }

  for (const id of details.relations.added) {
    signals.push(signal('relation', id, 'candidate', 'added'));
  }
  for (const id of details.relations.removed) {
    signals.push(signal('relation', id, 'invalidation', 'removed'));
  }
  for (const id of details.relations.predicateChanged) {
    signals.push(signal('relation', id, 'invalidation', 'predicate_changed'));
    signals.push(signal('relation', id, 'candidate', 'predicate_changed'));
  }
  for (const id of details.relations.tierChanged) {
    signals.push(signal('relation', id, 'candidate', 'tier_changed'));
  }

  for (const id of details.crosswalk.added) {
    signals.push(signal('crosswalk', id, 'candidate', 'added'));
  }
  for (const id of details.crosswalk.removed) {
    signals.push(signal('crosswalk', id, 'invalidation', 'removed'));
  }

  for (const id of details.components.added) {
    signals.push(signal('component', id, 'candidate', 'added'));
  }
  for (const id of details.components.removed) {
    signals.push(signal('component', id, 'invalidation', 'removed'));
  }
  for (const id of details.components.changed) {
    signals.push(signal('component', id, 'candidate', 'changed'));
  }

  for (const profile of details.projections.addedProfiles) {
    signals.push(signal('projection', profile, 'candidate', 'profile_added'));
  }
  for (const profile of details.projections.removedProfiles) {
    signals.push(signal('projection', profile, 'invalidation', 'profile_removed'));
  }
  for (const row of details.projections.digestChanged) {
    signals.push(signal('projection', row.profile, 'invalidation', 'digest_changed', {
      baseDigest: row.baseDigest,
      candidateDigest: row.candidateDigest,
    }));
    signals.push(signal('projection', row.profile, 'candidate', 'digest_changed', {
      baseDigest: row.baseDigest,
      candidateDigest: row.candidateDigest,
    }));
  }

  for (const type of details.vocabulary.addedTypes) {
    signals.push(signal('vocabulary', `type:${type}`, 'candidate', 'added'));
  }
  for (const predicate of details.vocabulary.addedPredicates) {
    signals.push(signal('vocabulary', `predicate:${predicate}`, 'candidate', 'added'));
  }
  for (const type of details.vocabulary.removedTypes) {
    signals.push(signal('vocabulary', `type:${type}`, 'invalidation', 'removed'));
  }
  for (const predicate of details.vocabulary.removedPredicates) {
    signals.push(signal('vocabulary', `predicate:${predicate}`, 'invalidation', 'removed'));
  }

  const byDigest = new Map<string, DeltaSignalRecord>();
  for (const row of signals) {
    byDigest.set(row.signalDigest, row);
  }
  return [...byDigest.values()].sort((a, b) => (
    a.scope.localeCompare(b.scope)
    || a.identity.localeCompare(b.identity)
    || a.action.localeCompare(b.action)
    || a.reason.localeCompare(b.reason)
  ));
}

export function emptyEvidenceRef(): DeltaEvidenceRef {
  return {
    kind: 'none',
    releaseSetId: null,
    releaseId: null,
    releaseVersion: null,
    releaseHash: null,
    sourceDatasetHash: null,
    importReceiptId: null,
    bundleReceiptId: null,
    bundleId: null,
    bundleRevision: null,
    bundleDigest: null,
    runtimeProjectionId: null,
    runtimeProjectionDigest: null,
    evidenceCaptureRevision: null,
    protocol: null,
    acceptedAt: null,
    semanticSnapshotDigest: null,
  };
}

/** Full stable evidence identity for natural keys. */
export function evidenceIdentityPayload(evidence: DeltaEvidenceRef): JsonObject {
  return {
    kind: evidence.kind,
    releaseSetId: evidence.releaseSetId,
    releaseId: evidence.releaseId,
    releaseVersion: evidence.releaseVersion,
    releaseHash: evidence.releaseHash,
    sourceDatasetHash: evidence.sourceDatasetHash,
    importReceiptId: evidence.importReceiptId,
    bundleReceiptId: evidence.bundleReceiptId,
    bundleId: evidence.bundleId,
    bundleRevision: evidence.bundleRevision,
    bundleDigest: evidence.bundleDigest,
    runtimeProjectionId: evidence.runtimeProjectionId,
    runtimeProjectionDigest: evidence.runtimeProjectionDigest,
    evidenceCaptureRevision: evidence.evidenceCaptureRevision,
    protocol: evidence.protocol,
    semanticSnapshotDigest: evidence.semanticSnapshotDigest,
  };
}

export function buildNaturalKey(input: {
  algorithmVersion: string;
  baseEvidence: DeltaEvidenceRef;
  candidateEvidence: DeltaEvidenceRef;
}): string {
  return sha256Hex(canonicalJson({
    algorithmVersion: input.algorithmVersion,
    base: evidenceIdentityPayload(input.baseEvidence),
    candidate: evidenceIdentityPayload(input.candidateEvidence),
  }));
}

export function buildInputDigest(input: {
  algorithmVersion: string;
  baseEvidence: DeltaEvidenceRef;
  candidateEvidence: DeltaEvidenceRef;
  baseSnapshotDigest: string | null;
  candidateSnapshotDigest: string;
}): string {
  return sha256Hex(canonicalJson({
    algorithmVersion: input.algorithmVersion,
    base: evidenceIdentityPayload(input.baseEvidence),
    candidate: evidenceIdentityPayload(input.candidateEvidence),
    baseSnapshotDigest: input.baseSnapshotDigest,
    candidateSnapshotDigest: input.candidateSnapshotDigest,
  }));
}

export function buildOutputDigest(input: {
  classification: string;
  authorizationState: string;
  details: ReleaseSetDeltaDetails;
  summary: ReleaseSetDeltaSummary;
  signals: DeltaSignalRecord[];
  upstream: UpstreamCrosscheckResult;
  identityViolations: IdentityIntegrityViolation[];
}): string {
  return sha256Hex(canonicalJson(input));
}

/**
 * Parse supported upstream actkg-release-diff/1 fields only.
 * Unsupported extra fields are ignored (never drive ACT).
 */
export function parseUpstreamReleaseDiff(raw: unknown): UpstreamReleaseDiffV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('upstream release-diff must be an object');
  }
  const body = raw as JsonObject;
  if (body.contract_version !== UPSTREAM_RELEASE_DIFF_CONTRACT) {
    throw new Error(`unsupported upstream release-diff contract: ${String(body.contract_version)}`);
  }
  const base = body.base_release as JsonObject | undefined;
  const target = body.target_release as JsonObject | undefined;
  const objects = body.objects as JsonObject | undefined;
  const relations = body.relations as JsonObject | undefined;
  const crosswalk = body.crosswalk as JsonObject | undefined;
  const components = body.components as JsonObject | undefined;
  if (!base || !target || !objects || !relations || !crosswalk || !components) {
    throw new Error('upstream release-diff is missing required collections');
  }

  const stringArray = (value: unknown, label: string): string[] => {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
      throw new Error(`upstream release-diff ${label} must be a string array`);
    }
    return sortedUnique(value as string[]);
  };
  const releaseIdentity = (value: JsonObject, label: string) => {
    if (
      typeof value.release_id !== 'string'
      || typeof value.release_version !== 'string'
      || typeof value.release_hash !== 'string'
    ) {
      throw new Error(`upstream release-diff ${label} identity is invalid`);
    }
    return {
      releaseId: value.release_id,
      releaseVersion: value.release_version,
      releaseHash: value.release_hash,
    };
  };

  if (
    typeof crosswalk.added_count !== 'number'
    || typeof crosswalk.removed_count !== 'number'
    || !Number.isInteger(crosswalk.added_count)
    || !Number.isInteger(crosswalk.removed_count)
    || crosswalk.added_count < 0
    || crosswalk.removed_count < 0
  ) {
    throw new Error('upstream release-diff crosswalk counts are invalid');
  }

  return {
    contractVersion: UPSTREAM_RELEASE_DIFF_CONTRACT,
    baseRelease: releaseIdentity(base, 'base_release'),
    targetRelease: releaseIdentity(target, 'target_release'),
    objects: {
      added: stringArray(objects.added, 'objects.added'),
      removed: stringArray(objects.removed, 'objects.removed'),
      changed: stringArray(objects.changed, 'objects.changed'),
    },
    relations: {
      added: stringArray(relations.added, 'relations.added'),
      removed: stringArray(relations.removed, 'relations.removed'),
      changed: stringArray(relations.changed, 'relations.changed'),
    },
    crosswalk: {
      addedCount: crosswalk.added_count,
      removedCount: crosswalk.removed_count,
    },
    components: {
      added: stringArray(components.added, 'components.added'),
      removed: stringArray(components.removed, 'components.removed'),
    },
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  const a = sortedUnique(left);
  const b = sortedUnique(right);
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * Cross-check mutually supported upstream fields against ACT recomputation.
 * Upstream is never calculation authority. Projection is not in actkg-release-diff/1.
 */
export function crossCheckUpstreamDiff(
  details: ReleaseSetDeltaDetails,
  upstream: UpstreamReleaseDiffV1 | null,
  options?: {
    baseReleaseId?: string | null;
    candidateReleaseId?: string | null;
    baseReleaseVersion?: string | null;
    candidateReleaseVersion?: string | null;
    baseReleaseHash?: string | null;
    candidateReleaseHash?: string | null;
  },
): UpstreamCrosscheckResult {
  if (!upstream) {
    return {
      status: 'NOT_REQUIRED',
      details: { reason: 'no required upstream release_diff artifact' },
    };
  }

  const disagreements: string[] = [];

  if (options?.baseReleaseId && upstream.baseRelease.releaseId !== options.baseReleaseId) {
    disagreements.push('base_release.release_id');
  }
  if (options?.candidateReleaseId && upstream.targetRelease.releaseId !== options.candidateReleaseId) {
    disagreements.push('target_release.release_id');
  }
  if (options?.baseReleaseVersion && upstream.baseRelease.releaseVersion !== options.baseReleaseVersion) {
    disagreements.push('base_release.release_version');
  }
  if (
    options?.candidateReleaseVersion
    && upstream.targetRelease.releaseVersion !== options.candidateReleaseVersion
  ) {
    disagreements.push('target_release.release_version');
  }
  if (options?.baseReleaseHash && upstream.baseRelease.releaseHash !== options.baseReleaseHash) {
    disagreements.push('base_release.release_hash');
  }
  if (options?.candidateReleaseHash && upstream.targetRelease.releaseHash !== options.candidateReleaseHash) {
    disagreements.push('target_release.release_hash');
  }

  const actObjectChanged = sortedUnique([
    ...details.objects.payloadChanged,
    ...details.objects.typeChanged,
    ...details.objects.tierChanged,
    ...details.objects.superseded.flatMap((row) => [row.from, row.to]),
  ]);
  const actRelationChanged = sortedUnique([
    ...details.relations.predicateChanged,
    ...details.relations.directionChanged,
    ...details.relations.tierChanged,
    ...details.relations.endpointChanged,
  ]);

  if (!sameStringSet(details.objects.added, upstream.objects.added)) disagreements.push('objects.added');
  if (!sameStringSet(details.objects.removed, upstream.objects.removed)) disagreements.push('objects.removed');
  if (!sameStringSet(actObjectChanged, upstream.objects.changed)) disagreements.push('objects.changed');

  if (!sameStringSet(details.relations.added, upstream.relations.added)) disagreements.push('relations.added');
  if (!sameStringSet(details.relations.removed, upstream.relations.removed)) disagreements.push('relations.removed');
  if (!sameStringSet(actRelationChanged, upstream.relations.changed)) disagreements.push('relations.changed');

  if (details.crosswalk.added.length !== upstream.crosswalk.addedCount) {
    disagreements.push('crosswalk.added_count');
  }
  if (details.crosswalk.removed.length !== upstream.crosswalk.removedCount) {
    disagreements.push('crosswalk.removed_count');
  }

  if (!sameStringSet(details.components.added, upstream.components.added)) disagreements.push('components.added');
  if (!sameStringSet(details.components.removed, upstream.components.removed)) {
    disagreements.push('components.removed');
  }

  if (disagreements.length > 0) {
    return {
      status: 'DISAGREED',
      details: {
        disagreements: sortedUnique(disagreements),
        act: {
          objects: details.objects,
          relations: details.relations,
          crosswalk: {
            added_count: details.crosswalk.added.length,
            removed_count: details.crosswalk.removed.length,
          },
          components: {
            added: details.components.added,
            removed: details.components.removed,
          },
        },
        upstream,
      },
    };
  }

  return {
    status: 'AGREED',
    details: { mutuallySupportedFieldsChecked: true },
  };
}

export interface ComputeDeltaInput {
  candidateSnapshot: DeltaSemanticSnapshot;
  candidateEvidence: DeltaEvidenceRef;
  baseSnapshot?: DeltaSemanticSnapshot | null;
  baseEvidence?: DeltaEvidenceRef | null;
  /** Trusted ACT delta implementation capture revision (40-char Git SHA). */
  captureRevision: string;
  upstreamDiff?: UpstreamReleaseDiffV1 | null;
  upstreamParseError?: string | null;
}

/**
 * Recompute a deterministic ReleaseSet Delta from verified snapshots.
 */
export function computeReleaseSetDelta(input: ComputeDeltaInput): ComputedReleaseSetDelta {
  if (!/^[0-9a-f]{40}$/u.test(input.captureRevision)) {
    throw new Error('delta captureRevision must be a 40-character lowercase Git SHA');
  }

  const candidateEvidence = input.candidateEvidence;
  const baseEvidence = input.baseEvidence ?? emptyEvidenceRef();
  const candidate = input.candidateSnapshot;
  const base = input.baseSnapshot ?? null;

  const naturalKey = buildNaturalKey({
    algorithmVersion: RELEASE_SET_DELTA_ALGORITHM_VERSION,
    baseEvidence,
    candidateEvidence,
  });

  const finish = (
    classification: ComputedReleaseSetDelta['classification'],
    details: ReleaseSetDeltaDetails,
    identityViolations: IdentityIntegrityViolation[],
    upstream: UpstreamCrosscheckResult,
  ): ComputedReleaseSetDelta => {
    let authorizationState: ComputedReleaseSetDelta['authorizationState'] = 'ACCEPTED';
    if (identityViolations.length > 0) {
      authorizationState = 'REJECTED_IDENTITY';
    } else if (upstream.status === 'DISAGREED' || upstream.status === 'PARSE_FAILED') {
      authorizationState = 'REJECTED_UPSTREAM';
    }

    const signals = authorizationState === 'ACCEPTED' ? emitDeltaSignals(details) : [];
    if (authorizationState === 'ACCEPTED') {
      assertSignalsAreGeneric(signals);
    }
    const summary = summarize(details, signals.length);
    const inputDigest = buildInputDigest({
      algorithmVersion: RELEASE_SET_DELTA_ALGORITHM_VERSION,
      baseEvidence,
      candidateEvidence,
      baseSnapshotDigest: base?.semanticCollectionDigest ?? null,
      candidateSnapshotDigest: candidate.semanticCollectionDigest,
    });
    const outputDigest = buildOutputDigest({
      classification,
      authorizationState,
      details,
      summary,
      signals,
      upstream,
      identityViolations,
    });

    return {
      classification,
      authorizationState,
      algorithmVersion: RELEASE_SET_DELTA_ALGORITHM_VERSION,
      baseEvidence,
      candidateEvidence,
      baseSemanticSnapshotDigest: base?.semanticCollectionDigest ?? null,
      candidateSemanticSnapshotDigest: candidate.semanticCollectionDigest,
      details,
      summary,
      signals,
      inputDigest,
      outputDigest,
      naturalKey,
      upstream,
      identityViolations,
      captureRevision: input.captureRevision,
    };
  };

  const resolveUpstream = (
    details: ReleaseSetDeltaDetails,
    options?: { baseline?: boolean },
  ): UpstreamCrosscheckResult => {
    if (input.upstreamParseError) {
      return {
        status: 'PARSE_FAILED',
        details: { error: input.upstreamParseError },
      };
    }
    // BASELINE has no ACT base. A required/present upstream release_diff always
    // declares base_release, which cannot be cross-validated — fail closed.
    if (options?.baseline && input.upstreamDiff) {
      return {
        status: 'DISAGREED',
        details: {
          disagreements: ['base_release.missing_on_baseline'],
          reason: 'BASELINE has no prior ReleaseSet but upstream release_diff declares base_release',
          upstream: input.upstreamDiff,
        },
      };
    }
    return crossCheckUpstreamDiff(details, input.upstreamDiff ?? null, {
      baseReleaseId: base?.releaseId ?? null,
      candidateReleaseId: candidate.releaseId,
      baseReleaseVersion: base?.releaseVersion ?? null,
      candidateReleaseVersion: candidate.releaseVersion,
      baseReleaseHash: base?.releaseHash ?? null,
      candidateReleaseHash: candidate.releaseHash,
    });
  };

  // BASELINE
  if (!base || baseEvidence.kind === 'none') {
    const details = emptyDetails();
    details.objects.added = sortedUnique(candidate.objects.map((row) => row.canonicalId));
    details.relations.added = sortedUnique(candidate.relations.map((row) => row.relationId));
    details.crosswalk.added = sortedUnique(candidate.crosswalk.map((row) => row.tripleKey));
    details.components.added = sortedUnique(candidate.components.map((row) => row.componentReleaseId));
    details.projections.addedProfiles = sortedUnique(candidate.projections.map((row) => row.profile));
    details.vocabulary.addedTypes = [...candidate.vocabulary.objectTypes];
    details.vocabulary.addedPredicates = [...candidate.vocabulary.predicates];
    return finish('BASELINE', details, [], resolveUpstream(details, { baseline: true }));
  }

  // Packaging short-circuit
  if (isPackagingRevisionOnly(base, candidate)) {
    const details = emptyDetails();
    return finish('COMPATIBLE_PACKAGING_REVISION', details, [], resolveUpstream(details));
  }

  const baseObjects = indexBy(base.objects, (row) => row.canonicalId);
  const candObjects = indexBy(candidate.objects, (row) => row.canonicalId);
  const baseRelations = indexBy(base.relations, (row) => row.relationId);
  const candRelations = indexBy(candidate.relations, (row) => row.relationId);
  const baseCrosswalk = indexBy(base.crosswalk, (row) => row.tripleKey);
  const candCrosswalk = indexBy(candidate.crosswalk, (row) => row.tripleKey);
  const baseComponents = indexBy(base.components, (row) => row.componentReleaseId);
  const candComponents = indexBy(candidate.components, (row) => row.componentReleaseId);
  const baseProjections = indexBy(base.projections, (row) => row.profile);
  const candProjections = indexBy(candidate.projections, (row) => row.profile);

  const objectResult = compareObjects(baseObjects, candObjects);
  const relationResult = compareRelations(baseRelations, candRelations);
  const identityViolations = [...objectResult.violations, ...relationResult.violations];

  const details = emptyDetails();
  details.objects = objectResult.changes;
  details.relations = relationResult.changes;
  details.crosswalk = compareCrosswalk(baseCrosswalk, candCrosswalk);
  details.components = compareComponents(baseComponents, candComponents);
  details.projections = compareProjections(baseProjections, candProjections);
  details.vocabulary = compareVocabulary(base.vocabulary, candidate.vocabulary);

  return finish('SEMANTIC_CONTENT_UPDATE', details, identityViolations, resolveUpstream(details));
}

/**
 * Structural whitelist for generic delta signals.
 * Identity string values may legally contain tokens like "active"/"legacy".
 * signalDigest must match the recomputed body digest (not forgeable).
 */
export function assertSignalsAreGeneric(signals: DeltaSignalRecord[]): void {
  for (const row of signals) {
    const keys = Object.keys(row);
    for (const key of keys) {
      if (!SIGNAL_TOP_KEYS.has(key)) {
        throw new Error(`delta signal has unsupported top-level field ${key}`);
      }
      if (FORBIDDEN_SIGNAL_KEYS.has(key)) {
        throw new Error(`delta signal leaked forbidden field ${key}`);
      }
    }
    if (!SIGNAL_SCOPES.has(row.scope)) {
      throw new Error(`delta signal has unsupported scope ${row.scope}`);
    }
    if (!SIGNAL_ACTIONS.has(row.action)) {
      throw new Error(`delta signal has unsupported action ${row.action}`);
    }
    if (!SIGNAL_REASONS.has(row.reason)) {
      throw new Error(`delta signal has unsupported reason ${row.reason}`);
    }
    if (typeof row.identity !== 'string' || row.identity.length === 0) {
      throw new Error('delta signal identity must be a non-empty string');
    }
    if (typeof row.signalDigest !== 'string' || !/^[0-9a-f]{64}$/u.test(row.signalDigest)) {
      throw new Error('delta signal signalDigest must be a sha256 hex digest');
    }
    if (row.digests !== undefined) {
      if (!row.digests || typeof row.digests !== 'object' || Array.isArray(row.digests)) {
        throw new Error('delta signal digests must be an object when present');
      }
      for (const [key, value] of Object.entries(row.digests)) {
        if (!SIGNAL_DIGEST_KEYS.has(key as DeltaSignalDigestKey)) {
          throw new Error(`delta signal digests has unsupported key ${key}`);
        }
        if (typeof value !== 'string' || value.length === 0) {
          throw new Error(`delta signal digests.${key} must be a non-empty string`);
        }
      }
    }
    const expectedDigest = computeSignalDigest({
      scope: row.scope,
      identity: row.identity,
      action: row.action,
      reason: row.reason,
      digests: row.digests,
    });
    if (row.signalDigest !== expectedDigest) {
      throw new Error('delta signal signalDigest does not match recomputed body digest');
    }
  }
}
