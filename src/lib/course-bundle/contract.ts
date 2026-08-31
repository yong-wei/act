import { createHash } from 'node:crypto';

/**
 * Immutable course-bundle identity contract shared by capture, session binding,
 * and runtime readers. Pure functions only: this module must stay importable
 * from unit tests without a server runtime.
 */

export const COURSE_BUNDLE_REVISION_QUALIFICATION = 'course-bundle-revision-v1';
/**
 * Identity-only projection of a pure DB BOPPPS plan: the digest pins the
 * creation-time item projection (identity), while item/resource content keeps
 * following the DB BOPPPS lifecycle by design — it is not a runtime content
 * bundle and must never be reported as one.
 */
export const COURSE_BUNDLE_PLAN_PROJECTION_QUALIFICATION = 'course-bundle-plan-projection-v1';
export const COURSE_BUNDLE_IDENTITY_PROJECTION_SCHEMA_VERSION = 'course-bundle-identity-projection.v1';
export const COURSE_BUNDLE_RESOURCE_HASHES_SCHEMA_VERSION = 'course-bundle-resource-hashes.v1';
/** Locator used when no runtime release manifest is mounted (local development). */
export const UNRELEASED_WORKTREE_RELEASE_ID = 'unreleased-worktree';
export const UNRELEASED_WORKTREE_SOURCE_REVISION = 'worktree';
export const GENERATED_COURSEWARE_BUNDLE_PREFIX = 'generated-courseware:';

export type CourseBundleResourceKind =
  | 'lesson'
  | 'graphOverlay'
  | 'interactiveManifest'
  | 'handoutMarkdown'
  | 'handoutPdf'
  | 'mediaIndex'
  | 'knowledgeCards'
  | 'media';

/** Resources that must exist and hash for every qualified ordinary bundle. */
export const REQUIRED_COURSE_BUNDLE_RESOURCE_KINDS: readonly CourseBundleResourceKind[] = ['lesson', 'graphOverlay'];

export interface CourseBundleResourceObjectHash {
  path: string;
  sha256: string | null;
}

export interface CourseBundleResourceHashes {
  schemaVersion: typeof COURSE_BUNDLE_RESOURCE_HASHES_SCHEMA_VERSION;
  /** sha256 of the canonical resource bytes, keyed by kind where present. */
  lesson?: string;
  graphOverlay?: string;
  interactiveManifest?: string;
  handoutMarkdown?: string;
  handoutPdf?: string;
  mediaIndex?: string;
  /** sha256 over the ordered (path, per-card sha256) list of referenced cards that exist. */
  knowledgeCards?: string;
  /** sha256 over the ordered (runtimePath, sha256|null) list of media declared by the index. */
  media?: string;
  /** Per-card detail backing the knowledgeCards aggregate (read-path verification). */
  knowledgeCardFiles?: CourseBundleResourceObjectHash[];
  /** Per-media detail backing the media aggregate (read-path verification). */
  mediaObjects?: CourseBundleResourceObjectHash[];
}

export interface CourseBundleIdentityProjection {
  schemaVersion: typeof COURSE_BUNDLE_IDENTITY_PROJECTION_SCHEMA_VERSION;
  canonicalLessonId: string;
  runtimeLessonDir: string;
  routeSegment: string | null;
  aliasFamily: {
    lessonKeys: readonly string[];
    presetKeys: readonly string[];
    evidenceAliases: readonly string[];
  };
}

export type CourseBundleLocator = {
  runtimeReleaseId: string;
  runtimeTreeSha256: string;
  runtimeManifestSha256: string | null;
  runtimeSourceRevision: string;
  runtimeObjectLocator: Record<string, unknown> | null;
};

export type CourseBundleIdentity = CourseBundleLocator & {
  bundleId: string;
  canonicalLessonId: string;
  bundleDigest: string;
  identityProjectionHash: string;
  manifestHash: string | null;
  resourceHashes: CourseBundleResourceHashes;
  /** Defaults to the runtime revision qualification when omitted. */
  qualification?: string;
};

export type CourseBundleCaptureErrorCode =
  | 'identity-unsupported'
  | 'lesson-json-missing'
  | 'graph-overlay-missing'
  | 'canonical-id-mismatch'
  | 'resource-unreadable';

export class CourseBundleCaptureError extends Error {
  constructor(
    public readonly code: CourseBundleCaptureErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'CourseBundleCaptureError';
  }
}

export type CourseBundleDriftCode =
  | 'session-binding-missing'
  | 'revision-record-missing'
  | 'denormalized-binding-drift'
  | 'resource-hash-drift';

export class CourseBundleDriftError extends Error {
  constructor(
    public readonly code: CourseBundleDriftCode,
    message: string,
  ) {
    super(message);
    this.name = 'CourseBundleDriftError';
  }
}

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }
  return value;
}

/**
 * Digest over the ordered formal-resource tuple list. Absent optional resources
 * are omitted so the digest is stable for identical present-content sets.
 */
export function computeCourseBundleDigest(input: {
  canonicalLessonId: string;
  resourceHashes: CourseBundleResourceHashes;
}): string {
  const entries = ([
    { kind: 'lesson', sha256: input.resourceHashes.lesson },
    { kind: 'graphOverlay', sha256: input.resourceHashes.graphOverlay },
    { kind: 'interactiveManifest', sha256: input.resourceHashes.interactiveManifest },
    { kind: 'handoutMarkdown', sha256: input.resourceHashes.handoutMarkdown },
    { kind: 'handoutPdf', sha256: input.resourceHashes.handoutPdf },
    { kind: 'mediaIndex', sha256: input.resourceHashes.mediaIndex },
    { kind: 'knowledgeCards', sha256: input.resourceHashes.knowledgeCards },
    { kind: 'media', sha256: input.resourceHashes.media },
  ] as Array<{ kind: CourseBundleResourceKind; sha256?: string }>)
    .filter((entry): entry is { kind: CourseBundleResourceKind; sha256: string } =>
      typeof entry.sha256 === 'string' && entry.sha256.length > 0);

  return sha256Hex(canonicalJson({
    canonicalLessonId: input.canonicalLessonId,
    entries,
  }));
}

export function computeCourseBundleIdentityProjectionHash(
  projection: CourseBundleIdentityProjection,
): string {
  return sha256Hex(canonicalJson(projection));
}

export function hashOrderedPathDigest(
  items: Array<{ path: string; sha256: string | null }>,
): string {
  return sha256Hex(canonicalJson(
    items
      .slice()
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
      .map((item) => ({ path: item.path, sha256: item.sha256 })),
  ));
}

export function generatedCoursewareBundleId(publicationRevisionId: string): string {
  return `${GENERATED_COURSEWARE_BUNDLE_PREFIX}${publicationRevisionId}`;
}

export function isGeneratedCoursewareBundleId(bundleId: string): boolean {
  return bundleId.startsWith(GENERATED_COURSEWARE_BUNDLE_PREFIX);
}

/**
 * Read-path view of the binding captured on a session. Runtime readers use
 * this instead of the active release, authoring files, or plan titles.
 */
export interface SessionBundleBinding {
  canonicalLessonId: string;
  runtimeReleaseId: string;
  bundleDigest: string;
  manifestHash: string | null;
  resourceHashes: CourseBundleResourceHashes;
}
