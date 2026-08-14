/**
 * Immutable, snapshot-bound Authority label resolution.
 *
 * Labels are presentation data only.  This module never derives an identity,
 * relation endpoint, teaching mapping, or media key from human-facing text.
 */

import type {
  AuthoritativeV2Evidence,
  AuthoritativeV2MultilingualLabelRecord,
  AuthoritativeV2ProjectionProfileRecord,
} from '@/lib/authoritative-knowledge/contracts';
import type { AuthorityEngineeringObject } from '@/lib/authoritative-knowledge/authority-snapshot';

const ZH_CN = 'zh-CN' as const;
const SHA256 = /^[a-f0-9]{64}$/u;

export interface AuthorityLabelSnapshotBinding {
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly releaseId: string;
}

export interface AuthorityLabelResolverInput {
  readonly snapshot: AuthorityLabelSnapshotBinding;
  readonly objects: readonly Pick<AuthorityEngineeringObject, 'canonicalId' | 'semanticName' | 'payload'>[];
  readonly v2Evidence?: AuthoritativeV2Evidence | null;
}

export interface AuthorityLabelResolverContext {
  readonly snapshot: AuthorityLabelSnapshotBinding;
  readonly runtimeProfile: Readonly<AuthoritativeV2ProjectionProfileRecord> | null;
  readonly objects: readonly Pick<AuthorityEngineeringObject, 'canonicalId' | 'semanticName' | 'payload'>[];
  readonly labels: readonly AuthoritativeV2MultilingualLabelRecord[];
}

export interface AuthorityResolvedLabel {
  readonly status: 'available' | 'unavailable';
  readonly label: string | null;
  readonly aliases: readonly string[];
}

export class AuthorityLabelResolverError extends Error {
  readonly code: 'profile-drift' | 'duplicate-preferred' | 'evidence-invalid';

  constructor(
    code: AuthorityLabelResolverError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'AuthorityLabelResolverError';
    this.code = code;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function immutableClone(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (!value || typeof value !== 'object') return value;
  const prior = seen.get(value);
  if (prior) return prior;
  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const item of value) clone.push(immutableClone(item, seen));
    return Object.freeze(clone);
  }
  const clone: Record<string, unknown> = {};
  seen.set(value, clone);
  for (const [key, item] of Object.entries(value)) clone[key] = immutableClone(item, seen);
  return Object.freeze(clone);
}

/**
 * Human labels may contain Chinese, mathematical notation, or normal prose,
 * but never an opaque identifier, path, digest, release token, or system slug.
 */
export function isSafeAuthorityLabel(value: string | null | undefined): value is string {
  const normalized = text(value);
  if (!normalized) return false;
  if (/^[a-f0-9]{32,}$/iu.test(normalized)) return false;
  if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:){1,2}[A-Za-z0-9:/._-]+$/u.test(normalized)) return false;
  if (/^(?:node|relation|source|target|release|release-set|snapshot|activation|projection|bundle|profile|assertion|term|edition|section|sha256|hash|commit|path)[-_/:\s]/iu.test(normalized)) return false;
  if (/(?:^|[/\\])(?:course-content|src|runtime|releases?|snapshots?|bundles?|artifacts?)(?:[/\\]|$)/iu.test(normalized)) return false;
  if (/^(?:[A-Za-z]:[\\/]|[/\\]|\.\.?(?:[/\\]))/u.test(normalized)) return false;
  if (/^[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)+$/u.test(normalized)) return false;
  if (/(?:sha256|hash|release|snapshot|bundle|profile|projection|activation|commit|path)[=:]/iu.test(normalized)) return false;
  // Multi-token ASCII identifiers such as positive_feedback_inner_loop are
  // machine slugs, while a normal phrase containing spaces remains valid.
  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/iu.test(normalized)) return false;
  if (/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{8}(?:-[a-f0-9]{8}){3,})$/iu.test(normalized)) return false;
  return true;
}

function cloneObject(
  object: Pick<AuthorityEngineeringObject, 'canonicalId' | 'semanticName' | 'payload'>,
): Pick<AuthorityEngineeringObject, 'canonicalId' | 'semanticName' | 'payload'> {
  return Object.freeze({
    canonicalId: object.canonicalId,
    semanticName: object.semanticName,
    payload: immutableClone(object.payload),
  });
}

function cloneLabel(row: AuthoritativeV2MultilingualLabelRecord): AuthoritativeV2MultilingualLabelRecord {
  return Object.freeze({ ...row, payload: immutableClone(row.payload) });
}

function runtimeProfile(
  evidence: AuthoritativeV2Evidence,
  snapshot: AuthorityLabelSnapshotBinding,
): AuthoritativeV2ProjectionProfileRecord {
  if (evidence.protocol !== 'actkg-public-bundle/2' || !Array.isArray(evidence.profiles)) {
    throw new AuthorityLabelResolverError('evidence-invalid', 'Authority label evidence is unavailable.');
  }
  const binding = evidence.admissionBinding;
  if (
    !binding
    || typeof binding !== 'object'
    || binding.protocol !== evidence.protocol
    || binding.releaseId !== snapshot.releaseId
  ) {
    throw new AuthorityLabelResolverError('profile-drift', 'Authority label admission binding drifted.');
  }
  const profileIds = new Set<string>();
  const profileKeys = new Set<string>();
  for (const profile of evidence.profiles) {
    if (!profile || typeof profile !== 'object' || profile.releaseId !== snapshot.releaseId) {
      throw new AuthorityLabelResolverError('profile-drift', 'Authority label profile identity drifted.');
    }
    const profileId = text(profile.profileId);
    const profileKey = text(profile.profileKey);
    if (!profileId || !profileKey || profileIds.has(profileId) || profileKeys.has(profileKey)) {
      throw new AuthorityLabelResolverError('profile-drift', 'Authority label profiles are not uniquely admitted.');
    }
    profileIds.add(profileId);
    profileKeys.add(profileKey);
  }
  const runtime = evidence.profiles.filter((profile) => (
    profile.profileKey === 'runtime' || profile.manifestProfile === 'runtime'
  ));
  if (
    runtime.length !== 1
    || runtime[0]!.profileKey !== 'runtime'
    || runtime[0]!.manifestProfile !== 'runtime'
    || !text(runtime[0]!.profileId)
    || !SHA256.test(runtime[0]!.profileSha256)
  ) {
    throw new AuthorityLabelResolverError('profile-drift', 'Authority label runtime profile is not uniquely admitted.');
  }
  return runtime[0]!;
}

function preferredLabels(
  labels: readonly AuthoritativeV2MultilingualLabelRecord[],
  entityId: string,
): AuthoritativeV2MultilingualLabelRecord[] {
  return labels.filter((row) => row.entityId === entityId && row.language === ZH_CN && row.labelType === 'canonical_preferred');
}

function alternativeLabels(
  labels: readonly AuthoritativeV2MultilingualLabelRecord[],
  entityId: string,
): AuthoritativeV2MultilingualLabelRecord[] {
  return labels.filter((row) => row.entityId === entityId && row.language === ZH_CN && row.labelType === 'alternative');
}

function resolvedAliases(
  labels: readonly AuthoritativeV2MultilingualLabelRecord[],
  entityId: string,
): readonly string[] | null {
  const values = alternativeLabels(labels, entityId).map((row) => text(row.label));
  if (values.some((value) => value === null)) return null;
  const safeValues = values as string[];
  if (safeValues.some((value) => !isSafeAuthorityLabel(value))) return null;
  return Object.freeze(
    safeValues
      .slice()
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
      .filter((value, index, sorted) => sorted.indexOf(value) === index),
  );
}

function legacyPreferredLabel(payload: unknown): string | null {
  const preferred = record(payload).preferred_labels;
  const rows: Record<string, unknown>[] = Array.isArray(preferred)
    ? preferred.map((item) => record(item))
    : [];
  const zh = rows.find((row) => row.language === ZH_CN && typeof row.text === 'string');
  const fallback = rows.find((row) => typeof row.text === 'string');
  const selected = zh ?? fallback;
  return typeof selected?.text === 'string' && selected.text.trim()
    ? selected.text.trim()
    : null;
}

function projectionDisplayName(object: Pick<AuthorityEngineeringObject, 'semanticName' | 'payload'>): string | null {
  const payload = record(object.payload);
  const nested = record(payload.payload);
  return text(payload.displayName)
    ?? text(payload.display_name)
    ?? text(nested.displayName)
    ?? text(nested.display_name);
}

function unavailable(): AuthorityResolvedLabel {
  return Object.freeze({ status: 'unavailable', label: null, aliases: Object.freeze([]) });
}

/** Build a detached context; subsequent input mutations cannot change it. */
export function createAuthorityLabelResolverContext(
  input: AuthorityLabelResolverInput,
): AuthorityLabelResolverContext {
  const snapshot = Object.freeze({
    snapshotId: input.snapshot.snapshotId,
    snapshotHash: input.snapshot.snapshotHash,
    releaseId: input.snapshot.releaseId,
  });
  const objects = Object.freeze(input.objects.map(cloneObject));
  const evidence = input.v2Evidence ?? null;
  if (!evidence) {
    return Object.freeze({ snapshot, runtimeProfile: null, objects, labels: Object.freeze([]) });
  }

  const profile = runtimeProfile(evidence, snapshot);
  if (!Array.isArray(evidence.multilingualLabels)) {
    throw new AuthorityLabelResolverError('evidence-invalid', 'Authority label evidence is unavailable.');
  }
  const labels = evidence.multilingualLabels.map(cloneLabel);
  const preferredByEntity = new Set<string>();
  for (const row of labels) {
    if (row.releaseId !== snapshot.releaseId) {
      throw new AuthorityLabelResolverError('profile-drift', 'Authority label row identity drifted.');
    }
    if (row.language !== ZH_CN || row.labelType !== 'canonical_preferred') continue;
    if (preferredByEntity.has(row.entityId)) {
      throw new AuthorityLabelResolverError('duplicate-preferred', 'Authority label index contains duplicate preferred labels.');
    }
    preferredByEntity.add(row.entityId);
  }
  return Object.freeze({
    snapshot,
    runtimeProfile: Object.freeze({ ...profile, payload: immutableClone(profile.payload) }),
    objects,
    labels: Object.freeze(labels),
  });
}

export function resolveAuthorityLabel(
  context: AuthorityLabelResolverContext,
  entityId: string,
): AuthorityResolvedLabel {
  const object = context.objects.find((candidate) => candidate.canonicalId === entityId);
  if (!object) return unavailable();

  if (!context.runtimeProfile) {
    const legacy = legacyPreferredLabel(object.payload);
    // v0.9 deliberately keeps its existing preferred_labels projection.  The
    // bounded placeholder is the historic output when that field is absent;
    // it is not a new machine-identity fallback.
    return Object.freeze({
      status: 'available',
      label: legacy ?? '名称暂不可用',
      aliases: Object.freeze([]),
    });
  }

  const preferred = preferredLabels(context.labels, entityId);
  if (preferred.length > 1) return unavailable();
  if (preferred.length === 1) {
    const label = text(preferred[0]!.label);
    if (!isSafeAuthorityLabel(label)) return unavailable();
    const aliases = resolvedAliases(context.labels, entityId);
    if (!aliases) return unavailable();
    return Object.freeze({ status: 'available', label, aliases });
  }

  const fallback = projectionDisplayName(object);
  if (!isSafeAuthorityLabel(fallback)) return unavailable();
  const aliases = resolvedAliases(context.labels, entityId);
  if (!aliases) return unavailable();
  return Object.freeze({ status: 'available', label: fallback, aliases });
}
