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
import { envelopeByName } from '@/lib/actkg-envelope/composite-envelope-registry';
import { sha256Text } from '@/lib/source-pack/sha256';
import { reviewedNeighborhoodLabelsForSnapshot } from './v018-reviewed-neighborhood-labels';

const ZH_CN = 'zh-CN' as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const DISALLOWED_CONTROL = /[\u0000-\u0009\u000b-\u000c\u000e-\u001f\u007f]/u;
const PLAIN_PATH_DIRECTORY = /^[A-Za-z0-9][A-Za-z0-9 ._\-]*$/u;
const PLAIN_PATH_FILE = /^[A-Za-z0-9][A-Za-z0-9 ._(){}=\-]*$/u;
const PATH_EXTENSION = /\.[A-Za-z][A-Za-z0-9]{0,15}$/u;
const RELATIVE_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/u;
const RELATIVE_PATH_CANDIDATE = /(?<![A-Za-z0-9._-])[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)+(?![A-Za-z0-9._-])/gu;
const PATH_CANDIDATE_BOUNDARY = /[^A-Za-z0-9._-]/u;
const EMBEDDED_URI = /(?:^|[^A-Za-z0-9])(?:[A-Za-z][A-Za-z0-9+.-]*:)(?:\/\/|\/|[A-Za-z0-9][A-Za-z0-9+.-]*[/#?])/u;
const EMBEDDED_DRIVE_PATH = /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]/u;
const EMBEDDED_POSIX_PATH = /(?:^|[^A-Za-z0-9)])\/(?:[A-Za-z0-9._-]+(?:[\\/]|$))/u;
const EMBEDDED_RELATIVE_PATH = /\.{1,2}[\\/]|~[\\/]/u;
const EMBEDDED_UNC_PATH = /(?:^|[^A-Za-z0-9])\\\\([^\s\\/]+)[\\/]([^\s\\/]+)(?:[\\/]|$)/u;
const KNOWN_PATH_DIRECTORY = /(?:^|[^A-Za-z0-9])(?:course-content|src|runtime|releases?|snapshots?|bundles?|artifacts?)(?:[\\/]|$)/iu;

const FORMULA_FALLBACK_PIN_VERSION = 'authority-formula-fallback-pin/v1' as const;
const FORMULA_DOT_BACKSLASH_FAILURE = 'ambiguous-formula-dot-backslash' as const;

type AuthorityLabelFailure =
  | 'empty'
  | 'control'
  | 'line-break'
  | 'identity'
  | 'uri'
  | 'known-directory'
  | 'relative-path'
  | 'absolute-path'
  | 'unc-path'
  | 'bounded-relative-path'
  | 'path-structure'
  | 'separator'
  | 'machine-slug'
  | 'ambiguous-formula-dot-backslash';

interface AuthorityFormulaFallbackPin {
  readonly version: typeof FORMULA_FALLBACK_PIN_VERSION;
  readonly failureClass: typeof FORMULA_DOT_BACKSLASH_FAILURE;
  readonly releaseId: string;
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly profileId: string;
  readonly profileSha256: string;
  readonly canonicalId: string;
  readonly displayNameSha256: string;
}

const FORMULA_FALLBACK_OBJECTS = Object.freeze([
  { canonicalId: 'ctf:1ac3cc48c529fb9bb3fd0532', displayNameSha256: 'cd94968600a453e1d80c30b820fe2c70fe44f51f7754eba28bc54e60097f29df' },
  { canonicalId: 'ctf:224fe8007c92e0365df88c71', displayNameSha256: 'f2b781f2b0d6e66592a7c3a2ab9288c2661b6c29bc07d2ba5dcd744d9e045150' },
  { canonicalId: 'ctf:98056be65217199a1b9bfad7', displayNameSha256: 'fbe598cf6dada43ec35a65c547aed1e5d51f1296cf177bcc2141bab1acc35b7b' },
  { canonicalId: 'ctf:aeac8b41a8dfab7e5ea9be5f', displayNameSha256: 'd262f0f4df05993ae339bc42647713f34b1a3a5d71a98dd9f978c71dccae3cf9' },
  { canonicalId: 'ctkg:v3e-object-0796fedf8fa2a340f1d800ec', displayNameSha256: '191fa7bbe463bfa8ab5ac466295e315d6e46b2abd40ca121cdfc16a43083637a' },
  { canonicalId: 'ctkg:v3e-object-7e93787bebbb427bd59b0d98', displayNameSha256: 'deebfa23fe8a6906620e8a7a7239f7b8a10006436e2ad408e517bf331f39f3c2' },
  { canonicalId: 'ctkg:v3e-object-82b673b7659603ab09a48818', displayNameSha256: '2778af2f5b8a0766c156b324ad6104066bb8453c4e2f4cca4b7cc9f0aba369a1' },
  { canonicalId: 'ctkg:v3e-object-cfd98dee3afa5c44a0f0c44f', displayNameSha256: 'e9e6b5af17afc5947262bd75c21e94a95701478b1f4aa0c6681d17c4c24199ad' },
  { canonicalId: 'ctkg:v3e-object-093e69f52a564305cb43330f', displayNameSha256: '7546ad5f64f1ce5889637afd86e603d7205df7ab557d3892b3afb63bb8b32dd3' },
  { canonicalId: 'ctkg:v3e-object-a006a76a7e0bcccabddd6398', displayNameSha256: '6a06fd3d9b37428327fc549be85f7cc19f804a2ecb1fc672851fba13da15bc6f' },
] as const);

function formulaFallbackPinsForEnvelope(name: string): AuthorityFormulaFallbackPin[] {
  const envelope = envelopeByName(name);
  if (!envelope.runtimeProfileSha256) {
    throw new Error(`composite envelope ${name} is missing a runtime profile hash`);
  }
  return FORMULA_FALLBACK_OBJECTS.map((row) => ({
    version: FORMULA_FALLBACK_PIN_VERSION,
    failureClass: FORMULA_DOT_BACKSLASH_FAILURE,
    releaseId: envelope.authorityReleaseId,
    snapshotId: envelope.authoritySnapshotId,
    snapshotHash: envelope.authoritySnapshotHash,
    profileId: envelope.profileId,
    profileSha256: envelope.runtimeProfileSha256!,
    canonicalId: row.canonicalId,
    displayNameSha256: row.displayNameSha256,
  }));
}

const AUTHORITY_FORMULA_FALLBACK_PINS: readonly AuthorityFormulaFallbackPin[] = Object.freeze([
  ...formulaFallbackPinsForEnvelope('control-theory-engineering-v0.18'),
  ...formulaFallbackPinsForEnvelope('control-theory-engineering-v0.22'),
]);

export interface AuthorityLabelSnapshotBinding {
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly releaseId: string;
}

export interface AuthorityLabelResolverInput {
  readonly snapshot: AuthorityLabelSnapshotBinding;
  readonly objects: readonly Pick<AuthorityEngineeringObject, 'canonicalId' | 'canonicalType' | 'semanticName' | 'payload'>[];
  readonly v2Evidence?: AuthoritativeV2Evidence | null;
  readonly reviewedOverlayLabels?: readonly AuthoritativeV2MultilingualLabelRecord[];
}

export interface AuthorityLabelResolverContext {
  readonly snapshot: AuthorityLabelSnapshotBinding;
  readonly runtimeProfile: Readonly<AuthoritativeV2ProjectionProfileRecord> | null;
  readonly objects: readonly Pick<AuthorityEngineeringObject, 'canonicalId' | 'canonicalType' | 'semanticName' | 'payload'>[];
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

function text(value: unknown, preserveWhitespace = false): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  return preserveWhitespace ? value : normalized;
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
function rootedPathSegments(value: string): readonly string[] {
  return value.replace(/^\\{1,2}/u, '').split(/[\\/]/u).filter(Boolean);
}

function hasPathStructure(value: string): boolean {
  const segments = rootedPathSegments(value);
  if (segments.length < 2) return false;
  const last = segments[segments.length - 1]!;
  const penultimate = segments[segments.length - 2]!;

  // A filename-like tail alone is not enough: it becomes path evidence only
  // with a preceding ordinary directory segment. This retains labels such as
  // `\\alpha.ext`, which are valid reviewed Formula presentation values.
  if (PLAIN_PATH_DIRECTORY.test(penultimate) && PATH_EXTENSION.test(last)) {
    return true;
  }

  if (
    segments.length >= 3
    && segments.slice(0, -1).every((segment) => PLAIN_PATH_DIRECTORY.test(segment))
    && PLAIN_PATH_FILE.test(last)
    && !segments.every((segment) => /^[A-Za-z0-9]$/u.test(segment))
  ) return true;

  // A double-leading separator has unambiguous UNC server/share structure
  // once all of its three components are ordinary path segments.
  return /^\\\\/u.test(value)
    && segments.length >= 2
    && segments.every((segment) => PLAIN_PATH_DIRECTORY.test(segment));
}

function isPathCandidateBoundary(value: string, index: number): boolean {
  const boundary = value[index];
  return boundary === undefined || PATH_CANDIDATE_BOUNDARY.test(boundary);
}

/**
 * Classify only bounded, ordinary relative candidates. Formula separators are
 * intentionally left alone unless the candidate has enough path structure to
 * be meaningful: three non-atomic segments or a two-segment filename. The
 * candidate regex consumes the maximal ASCII path-shaped span; its outer
 * checks use every non-ASCII character as a boundary without enumerating
 * punctuation.
 */
function hasBoundedRelativePathStructure(value: string): boolean {
  for (const match of value.matchAll(RELATIVE_PATH_CANDIDATE)) {
    const candidate = match[0]!;
    const start = match.index;
    const end = start + candidate.length;
    if (!isPathCandidateBoundary(value, start - 1) || !isPathCandidateBoundary(value, end)) continue;

    const segments = candidate.split(/[\\/]/u);
    if (segments.some((segment) => !RELATIVE_PATH_SEGMENT.test(segment))) continue;
    if (segments.length >= 3 && !segments.every((segment) => /^[A-Za-z0-9]$/u.test(segment))) return true;
    if (segments.length === 2 && PATH_EXTENSION.test(segments[1]!)) return true;
  }
  return false;
}

function hasEmbeddedRelativePathStructure(value: string): boolean {
  // Every relative token is path evidence. Formula syntax is handled only by
  // the resolver's record-bound pin after all hard path checks have passed.
  return EMBEDDED_RELATIVE_PATH.test(value);
}

function hasEmbeddedPathStructure(value: string): boolean {
  const unc = EMBEDDED_UNC_PATH.exec(value);
  return EMBEDDED_URI.test(value)
    || EMBEDDED_DRIVE_PATH.test(value)
    || EMBEDDED_POSIX_PATH.test(value)
    || hasEmbeddedRelativePathStructure(value)
    || KNOWN_PATH_DIRECTORY.test(value)
    || (unc !== null && PLAIN_PATH_DIRECTORY.test(unc[1]!) && PLAIN_PATH_DIRECTORY.test(unc[2]!))
    || hasBoundedRelativePathStructure(value)
    || hasPathStructure(value);
}

function classifyAuthorityLabel(
  value: string | null | undefined,
  canonicalType?: string | null,
  trustedRuntimeProfile = false,
): AuthorityLabelFailure | null {
  if (typeof value !== 'string' || value.length === 0) return 'empty';
  if (DISALLOWED_CONTROL.test(value)) return 'control';
  const trustedFormula = canonicalType === 'Formula' && trustedRuntimeProfile;
  if (/\r(?!\n)/u.test(value) || (!trustedFormula && /[\r\n]/u.test(value))) return 'line-break';
  const normalized = text(value);
  if (!normalized) return 'empty';
  if (/^[a-f0-9]{32,}$/iu.test(normalized)) return 'identity';
  if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:){1,2}[A-Za-z0-9:/._-]+$/u.test(normalized)) return 'uri';
  if (/^(?:node|relation|source|target|release|release-set|snapshot|activation|projection|bundle|profile|assertion|term|edition|section|sha256|hash|commit|path)[-_/:\s]/iu.test(normalized)) return 'identity';
  if (/(?:^|[/\\])(?:course-content|src|runtime|releases?|snapshots?|bundles?|artifacts?)(?:[/\\]|$)/iu.test(normalized)) return 'known-directory';
  if (/^~(?:[/\\]|$)/u.test(normalized)) return 'relative-path';
  if (/^(?:[A-Za-z]:[\\/]|\/)/u.test(normalized)) return 'absolute-path';
  if (hasEmbeddedPathStructure(value)) {
    if (EMBEDDED_URI.test(value)) return 'uri';
    if (EMBEDDED_DRIVE_PATH.test(value)) return 'absolute-path';
    if (EMBEDDED_POSIX_PATH.test(value)) return 'absolute-path';
    if (KNOWN_PATH_DIRECTORY.test(value)) return 'known-directory';
    const unc = EMBEDDED_UNC_PATH.exec(value);
    if (unc !== null && PLAIN_PATH_DIRECTORY.test(unc[1]!) && PLAIN_PATH_DIRECTORY.test(unc[2]!)) return 'unc-path';
    if (hasBoundedRelativePathStructure(value)) return 'bounded-relative-path';
    if (hasPathStructure(value)) return 'path-structure';
  }
  for (const match of value.matchAll(/\.{1,2}[\\/]|~[\\/]/gu)) {
    const token = match[0]!;
    if (token === '.\\' && trustedFormula) return FORMULA_DOT_BACKSLASH_FAILURE;
    return 'relative-path';
  }
  if (/^\\/u.test(normalized) || /[\\/]/u.test(normalized)) {
    if (!trustedFormula) return 'separator';
  }
  if (/(?:sha256|hash|release|snapshot|bundle|profile|projection|activation|commit|path)[=:]/iu.test(normalized)) return 'identity';
  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/iu.test(normalized)) return 'machine-slug';
  if (/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{8}(?:-[a-f0-9]{8}){3,})$/iu.test(normalized)) return 'identity';
  return null;
}

export function isSafeAuthorityLabel(
  value: string | null | undefined,
  canonicalType?: string | null,
  trustedRuntimeProfile = false,
): value is string {
  return classifyAuthorityLabel(value, canonicalType, trustedRuntimeProfile) === null;
}

/**
 * Locale presentation text safety (#1741): release language-component rows
 * are learner-facing prose (long statements, math sentences). They may
 * legitimately contain `/` and `\` (N(s)/D(s), composite/has_formula), which
 * the short-label separator rule rejects. The hard boundaries stay: control
 * characters, line breaks, pure hashes, URI/identity-shaped values and
 * path/directory structures must never reach the browser.
 */
export function isSafeLocalePresentationText(
  value: string | null | undefined,
  trustedFormula = false,
): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (DISALLOWED_CONTROL.test(value)) return false;
  // 受治理公式文本（块级 LaTeX 名）允许换行；普通呈现文本不允许。
  if (!trustedFormula && /[\r\n]/u.test(value)) return false;
  if (/^(?:[a-f0-9]{32,})$/iu.test(value.trim())) return false;
  if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:){1,2}[A-Za-z0-9:/._-]+$/u.test(value.trim())) return false;
  if (/^(?:[A-Za-z]:[\\/]|\/|~[/\\])/u.test(value.trim())) return false;
  if (/(?:^|[/\\])(?:course-content|src|runtime|releases?|snapshots?|bundles?|artifacts?)(?:[/\\]|$)/iu.test(value)) return false;
  if (/(?:sha256|hash|release|snapshot|bundle|profile|projection|activation|commit|path)[=:]/iu.test(value.trim())) return false;
  return true;
}

function cloneObject(
  object: Pick<AuthorityEngineeringObject, 'canonicalId' | 'canonicalType' | 'semanticName' | 'payload'>,
): Pick<AuthorityEngineeringObject, 'canonicalId' | 'canonicalType' | 'semanticName' | 'payload'> {
  return Object.freeze({
    canonicalId: object.canonicalId,
    canonicalType: object.canonicalType,
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
    profile.manifestProfile === 'runtime'
  ));
  if (
    runtime.length !== 1
    || runtime[0]!.manifestProfile !== 'runtime'
    || !text(runtime[0]!.profileId)
    || !SHA256.test(runtime[0]!.profileSha256)
  ) {
    throw new AuthorityLabelResolverError('profile-drift', 'Authority label runtime profile is not uniquely admitted.');
  }
  return runtime[0]!;
}

function pinnedFormulaFallbackLabel(
  context: AuthorityLabelResolverContext,
  object: Pick<AuthorityEngineeringObject, 'canonicalId' | 'canonicalType'>,
  fallback: string | null,
  failure: AuthorityLabelFailure | null,
): string | null {
  if (
    object.canonicalType !== 'Formula'
    || !fallback
    || failure !== FORMULA_DOT_BACKSLASH_FAILURE
  ) return null;

  const profile = context.runtimeProfile;
  if (
    !profile
    || profile.manifestProfile !== 'runtime'
    || profile.releaseId !== context.snapshot.releaseId
    || !SHA256.test(profile.profileSha256)
  ) return null;

  const pin = AUTHORITY_FORMULA_FALLBACK_PINS.find((candidate) => (
    candidate.version === FORMULA_FALLBACK_PIN_VERSION
    && candidate.failureClass === FORMULA_DOT_BACKSLASH_FAILURE
    && candidate.releaseId === context.snapshot.releaseId
    && candidate.snapshotId === context.snapshot.snapshotId
    && candidate.snapshotHash === context.snapshot.snapshotHash
    && candidate.profileId === profile.profileId
    && candidate.profileSha256 === profile.profileSha256
    && candidate.canonicalId === object.canonicalId
    && candidate.displayNameSha256 === sha256Text(fallback)
  ));
  return pin ? fallback : null;
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
  canonicalType: string | null | undefined,
  trustedRuntimeProfile: boolean,
): readonly string[] {
  const preserveWhitespace = canonicalType === 'Formula' && trustedRuntimeProfile;
  // Governed aliases follow the same presentation-safety criteria as the
  // preferred label, but a single unqualified alias must not blank the
  // object's whole presentation — unsafe aliases drop themselves only
  // (alias spec: zh-CN base behavior stays unchanged).
  const values = alternativeLabels(labels, entityId)
    .map((row) => text(row.label, preserveWhitespace))
    .filter((value): value is string => value !== null)
    .filter((value) => isSafeAuthorityLabel(value, canonicalType, trustedRuntimeProfile));
  return Object.freeze(
    values
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

function projectionDisplayName(
  object: Pick<AuthorityEngineeringObject, 'semanticName' | 'payload'>,
  preserveWhitespace = false,
): string | null {
  const payload = record(object.payload);
  const nested = record(payload.payload);
  return text(payload.displayName, preserveWhitespace)
    ?? text(payload.display_name, preserveWhitespace)
    ?? text(nested.displayName, preserveWhitespace)
    ?? text(nested.display_name, preserveWhitespace);
}

function unavailable(): AuthorityResolvedLabel {
  return Object.freeze({ status: 'unavailable', label: null, aliases: Object.freeze([]) });
}

const R4_SEALED_PRESENTATION_LABEL_CONTRACT = 'actkg-r4-sealed-presentation-label/v1' as const;

function isSourceBoundR4PresentationLabel(
  row: AuthoritativeV2MultilingualLabelRecord,
  object: Pick<AuthorityEngineeringObject, 'canonicalId' | 'canonicalType'>,
  label: string,
): boolean {
  const payload = record(row.payload);
  if (
    payload.contract !== R4_SEALED_PRESENTATION_LABEL_CONTRACT
    || payload.entityId !== object.canonicalId
    || payload.labelSha256 !== sha256Text(label)
    || typeof payload.sourceArtifact !== 'string'
    || typeof payload.sourceArtifactSha256 !== 'string'
    || !SHA256.test(payload.sourceArtifactSha256)
    || typeof payload.sourceRecordId !== 'string'
    || typeof payload.sourceRecordHash !== 'string'
    || !SHA256.test(payload.sourceRecordHash)
    || typeof payload.bundleDigest !== 'string'
    || !SHA256.test(payload.bundleDigest)
    || typeof payload.manifestSha256 !== 'string'
    || !SHA256.test(payload.manifestSha256)
  ) return false;

  // The r4 builder admits only sealed public presentation fields.  They may
  // contain mathematical separators or natural-language phrases such as
  // "and/or" that the generic anti-path policy intentionally rejects.  Keep
  // every actual locator, URI, opaque identity, or non-Formula line break
  // rejected; this is a narrow snapshot-bound exception, not a general label
  // sanitizer bypass.
  if (DISALLOWED_CONTROL.test(label)
    || (object.canonicalType !== 'Formula' && /[\r\n]/u.test(label))
    || /^(?:[A-Za-z]:[\\/]|\/)/u.test(label.trim())
    || /(?:^|[^A-Za-z0-9])(?:[A-Za-z][A-Za-z0-9+.-]*:)(?:\/\/|\/)/u.test(label)
    || /(?:^|[/\\])(?:course-content|src|runtime|releases?|snapshots?|bundles?|artifacts?)(?:[/\\]|$)/iu.test(label)
    || (object.canonicalType !== 'Formula' && /(?:^|[^A-Za-z0-9])(?:\.{1,2}|~)[\\/]/u.test(label))
    || (object.canonicalType === 'Formula' && /(?:^|[^A-Za-z0-9])(?:\.\.[\\/]|\.\/|~[\\/])/u.test(label))
    || /^(?:[a-f0-9]{32,}|(?:[A-Za-z][A-Za-z0-9+.-]*:){1,2}[A-Za-z0-9:/._-]+)$/iu.test(label.trim())
    || /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/iu.test(label.trim())) return false;

  if (object.canonicalType === 'Formula') {
    return !/^\\{1,2}(?:server|users|windows|program(?:\s+files)?)(?:\\|$)/iu.test(label.trim());
  }
  // A bare ASCII slash token is still an opaque locator.  Mixed natural
  // language and mathematical text remains eligible after the checks above.
  return !/^[A-Za-z0-9._ -]+[\\/][A-Za-z0-9._ -]+$/u.test(label.trim());
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
  const overlay = input.reviewedOverlayLabels
    ?? reviewedNeighborhoodLabelsForSnapshot(snapshot);
  const overlayPreferred = new Map<string, AuthoritativeV2MultilingualLabelRecord>();
  for (const row of overlay) {
    if (row.language !== ZH_CN || row.labelType !== 'canonical_preferred') continue;
    overlayPreferred.set(row.entityId, row);
  }
  const labels: AuthoritativeV2MultilingualLabelRecord[] = [];
  const preferredEntities = new Set<string>();
  for (const row of evidence.multilingualLabels) {
    if (row.releaseId !== snapshot.releaseId) {
      throw new AuthorityLabelResolverError('profile-drift', 'Authority label row identity drifted.');
    }
    if (row.language === ZH_CN && row.labelType === 'canonical_preferred') {
      const reviewed = overlayPreferred.get(row.entityId);
      if (
        reviewed
        && !isSafeAuthorityLabel(row.label, undefined, true)
        && isSafeAuthorityLabel(reviewed.label, undefined, true)
      ) {
        labels.push(cloneLabel(reviewed));
        preferredEntities.add(row.entityId);
        continue;
      }
    }
    if (
      row.language === ZH_CN
      && row.labelType === 'alternative'
      && overlayPreferred.has(row.entityId)
      && !isSafeAuthorityLabel(row.label, undefined, true)
    ) {
      continue;
    }
    labels.push(cloneLabel(row));
    if (row.language === ZH_CN && row.labelType === 'canonical_preferred') {
      preferredEntities.add(row.entityId);
    }
  }
  for (const row of overlay) {
    if (row.language === ZH_CN && row.labelType === 'canonical_preferred' && preferredEntities.has(row.entityId)) {
      continue;
    }
    if (row.releaseId !== snapshot.releaseId) {
      throw new AuthorityLabelResolverError('profile-drift', 'Authority label row identity drifted.');
    }
    labels.push(cloneLabel(row));
    if (row.language === ZH_CN && row.labelType === 'canonical_preferred') {
      preferredEntities.add(row.entityId);
    }
  }
  const preferredByEntity = new Set<string>();
  for (const row of labels) {
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
      label: legacy && isSafeAuthorityLabel(legacy, object.canonicalType) ? legacy : '名称暂不可用',
      aliases: Object.freeze([]),
    });
  }

  const preferred = preferredLabels(context.labels, entityId);
  if (preferred.length > 1) return unavailable();
  const trustedRuntimeProfile = context.runtimeProfile !== null;
  const preserveFormulaWhitespace = object.canonicalType === 'Formula' && trustedRuntimeProfile;
  if (preferred.length === 1) {
    const preferredRow = preferred[0]!;
    const label = text(preferredRow.label, preserveFormulaWhitespace);
    if (!label || (
      !isSafeAuthorityLabel(label, object.canonicalType, trustedRuntimeProfile)
      && !isSourceBoundR4PresentationLabel(preferredRow, object, label)
    )) return unavailable();
    const aliases = resolvedAliases(context.labels, entityId, object.canonicalType, trustedRuntimeProfile);
    return Object.freeze({ status: 'available', label, aliases });
  }

  const fallback = projectionDisplayName(object, preserveFormulaWhitespace);
  const failure = classifyAuthorityLabel(fallback, object.canonicalType, trustedRuntimeProfile);
  const pinnedFallback = pinnedFormulaFallbackLabel(context, object, fallback, failure);
  if (failure !== null && pinnedFallback === null) return unavailable();
  const aliases = resolvedAliases(context.labels, entityId, object.canonicalType, trustedRuntimeProfile);
  return Object.freeze({ status: 'available', label: pinnedFallback ?? fallback, aliases });
}
