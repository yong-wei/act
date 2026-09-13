import { createHash } from 'node:crypto';
import {
  createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { buildTeachingResourceLaunchMaps } from './layered-graph/teaching-resource-launch-maps';
import { getAllRegisteredResourceMetadata, getRegisteredResourceMetadata } from './resource-registry-metadata';
import { ARENA_CHALLENGE_OBJECTS, ARENA_CHALLENGE_TASKS, getArenaChallengeObject, getArenaChallengeTask } from '@/features/arena/domain';
import { TEXTBOOK_ID_ALIASES } from './engineering-textbook-mapping/aliases';
import { resolveLegacyTextbookResource } from './engineering-textbook-mapping/legacy-resource-resolutions';
import { fromResourceIdToken } from './teaching-projection/textbook-locators/identity';
import { humanTitleFromResourceId } from './teaching-projection/resource-title';
import { readAgreedLiveCourseProjection, readAgreedLiveResourceBindingRelease, resolveConfiguredTeachingProjectionRoot } from './teaching-projection/live-course-pointer';
import { loadResourceBindingRelease } from './resource-binding-release/store';
import { loadStagedTeachingProjection, resolveTeachingProjectionStorePaths } from './teaching-projection/store';
import { resolveActiveEngineeringGraphAuthority, resolveConfiguredAuthorityRoot } from './authoritative-knowledge/engineering-authority-consumers';
import { resolveAuthorityStorePaths } from './authoritative-knowledge/authority-store';
import { resolveActiveShardIdentity } from './authority-domain-shards/identity';
import { createPublishedInfographReferenceIndex, readPublishedLearnerCardByToken } from './authority-domain-shards/learning-content';
import { resolveRuntimeSourceObjectKey, type RuntimeReleaseFileIndex } from '@/features/personalization/path-planning/adaptive-path-runtime-binding';
import type { AnyActRuntimeReleaseManifest } from './runtime-release';
import { isStudentVisiblePathTarget } from './student-visible-path-target';
import type { TeachingProjectionArtifacts, TeachingResourceRuntime, TeachingResourceType } from './teaching-projection/contracts';
import type { AuthorityEngineeringBody } from './authoritative-knowledge/authority-snapshot';
import type { PublishedResourceBackend, PublishedResourceFeature, PublishedResourceFeatureIndex, PublishedResourceIdentity } from './published-resource-reference';

const INDEX_VERSION = 'published-resource-features/v1';
const INDEX_IMPLEMENTATION_REVISION = 14;
const indexPromises = new Map<string, Promise<PublishedResourceFeatureIndex>>();
const ESTIMATED_MINUTES: Record<TeachingResourceType, number> = {
  card: 5, infographic: 3, handout: 12, video: 8, audio: 15, podcast: 15,
  exercise: 12, simulation: 20, lesson: 45, step: 10,
  slides: 12, project: 60,
  textbook: 30, 'textbook-chapter': 25, 'textbook-section': 12,
};
const AUTHORING_MEDIA_PATH_PATTERN = /^authoring:(lessons\/[^/]+\/media\/)(?:processed\/)?(.+)$/u;
const CONTENT_KEY_PATTERN = /^content:([a-f0-9]{64})$/u;
const MEDIA_RESOURCE_TYPES = new Set<TeachingResourceType>(['video', 'audio', 'podcast']);
const RUNTIME_MEDIA_SUFFIXES = {
  video: /\.(?:mp4|webm)$/iu,
  audio: /\.(?:m4a|mp3|wav)$/iu,
} as const;
// Keep this boundary identical to runtime-active-release without importing its
// server-only module into the pure index builder used by Vitest and clients.
const RUNTIME_MEDIA_PATH = /^lessons\/[^/]+\/media\/[^/]+\.(?:mp4|webm|m4a|mp3|wav|pdf|png|jpe?g|webp|svg|gif)$/iu;
const CARD_SOURCE_ROOTS = [
  'course-content/runtime/knowledge/cards/nodes',
  'course-content/runtime/knowledge/cards/authority/nodes',
] as const;
const INFOGRAPH_SOURCE_ROOTS = [
  'knowledge/infographs/nodes',
  'knowledge/infographs/authority/nodes',
] as const;
const TEXTBOOK_RUNTIME_RELATIVE = 'resources/textbooks-v2' as const;
type RuntimeMediaPathValidator = (runtimePath: string) => boolean;

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sha256Bytes(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function cacheRoot(): string {
  return join(tmpdir(), 'act-resource-features', digest(process.cwd()).slice(0, 20));
}

function sourceStamp(paths: readonly string[]): string {
  return digest(paths.map((file) => {
    try {
      const stat = statSync(file);
      // CAS Blobs can share size and timestamps; a new link target is still
      // a different publication. Retain metadata checks for mutable files.
      const target = lstatSync(file).isSymbolicLink() ? readlinkSync(file) : null;
      return [file, stat.size, stat.mtimeMs, target];
    } catch {
      return [file, null];
    }
  }));
}

function stableFileBytes(file: string): Buffer | null {
  try {
    const before = lstatSync(file);
    if (!before.isFile() || before.isSymbolicLink()) return null;
    const bytes = readFileSync(file);
    const after = lstatSync(file);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) return null;
    return bytes;
  } catch {
    return null;
  }
}

function stableFileDigest(file: string): string | null {
  const bytes = stableFileBytes(file);
  return bytes ? sha256Bytes(bytes) : null;
}

function listMetadataFiles(root: string, predicate: (file: string) => boolean): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if ((entry.isFile() || entry.isSymbolicLink()) && predicate(file)) files.push(file);
    }
  };
  visit(root);
  return files;
}

function runtimeMetadataStamp(): string {
  const runtimeRoot = join(process.cwd(), 'course-content/runtime');
  const mediaFiles = listMetadataFiles(join(runtimeRoot, 'lessons'), (file) => {
    const runtimePath = relative(runtimeRoot, file).replaceAll('\\', '/');
    return isSafeRuntimeMediaPath(runtimePath);
  });
  const lessonContentFiles = listMetadataFiles(join(runtimeRoot, 'lessons'), (file) => /\.(?:json|jsonl)$/iu.test(file));
  const infographFiles = INFOGRAPH_SOURCE_ROOTS.flatMap((root) => listMetadataFiles(join(runtimeRoot, root), (file) => file.endsWith('.png')));
  const infographPaths = INFOGRAPH_SOURCE_ROOTS.flatMap((root) => [
    join(runtimeRoot, root),
    ...infographFiles.filter((file) => file.startsWith(join(runtimeRoot, root))),
  ]);
  const textbookAssets = listMetadataFiles(join(runtimeRoot, 'resources/textbooks'), () => true);
  const textbookFiles = listMetadataFiles(join(runtimeRoot, TEXTBOOK_RUNTIME_RELATIVE), (file) => /(?:manifest\.json|\.jsonl)$/iu.test(file));
  const cardFiles = CARD_SOURCE_ROOTS.flatMap((root) => listMetadataFiles(join(/*turbopackIgnore: true*/ process.cwd(), root), (file) => file.endsWith('.md')));
  return digest({
    media: sourceStamp([join(runtimeRoot, 'lessons'), ...mediaFiles]),
    lessonContent: sourceStamp([join(runtimeRoot, 'lessons'), ...lessonContentFiles]),
    infographs: sourceStamp(infographPaths),
    textbooks: sourceStamp([join(runtimeRoot, TEXTBOOK_RUNTIME_RELATIVE), ...textbookFiles,
      join(runtimeRoot, 'resources/textbooks'), ...textbookAssets]),
    backendConfiguration: digest([getAllRegisteredResourceMetadata(), ARENA_CHALLENGE_TASKS, ARENA_CHALLENGE_OBJECTS]),
    cards: sourceStamp([
      join(process.cwd(), 'course-content/runtime/knowledge/authority-learning-content-manifest.json'),
      ...CARD_SOURCE_ROOTS.flatMap((root) => [join(/*turbopackIgnore: true*/ process.cwd(), root)]),
      ...cardFiles,
    ]),
  });
}

function receiptPath(): string {
  return process.env.ACT_RUNTIME_ACTIVE_RECEIPT_PATH?.trim()
    || join(process.cwd(), 'course-content/runtime/act-runtime-active-receipt.json');
}

let runtimeStampMemo: { key: string; value: string } | null = null;

function publishedResourceAppRevision(): string {
  return process.env.APP_REVISION?.trim() || process.env.GIT_SHA?.trim() || '';
}

function runtimeStamp(): string {
  const live = readAgreedLiveCourseProjection();
  const release = sourceStamp([
    receiptPath(),
    join(process.cwd(), 'course-content/runtime/.act-runtime-release.v1.json'),
    join(process.cwd(), 'course-content/runtime/.act-runtime-release.v2.json'),
  ]);
  const key = [
    publishedResourceAppRevision(),
    live?.projectionId ?? '',
    live?.projectionHash ?? '',
    release,
  ].join('|');
  if (runtimeStampMemo?.key === key) return runtimeStampMemo.value;
  // Request path keys the capture to app revision, live projection, and
  // runtime receipt. Lesson/card bytes change with a runtime activate.
  const value = digest({
    app: publishedResourceAppRevision(),
    projectionId: live?.projectionId ?? '',
    projectionHash: live?.projectionHash ?? '',
    release,
  });
  runtimeStampMemo = { key, value };
  return value;
}

function safeTitle(resource: TeachingResourceRuntime): string {
  const title = resource.title?.trim() || humanTitleFromResourceId(resource.resourceId);
  return title && !/^(?:act|cts|ctkg|ctc)(?:[:\s]|$)/.test(title) ? title : '教学资源参考';
}

function decodedSection(resourceId: string): string | null {
  if (!resourceId.startsWith('act:textbook-section:')) return null;
  try { return fromResourceIdToken(resourceId.slice('act:textbook-section:'.length)); }
  catch { return null; }
}

function isSafeRuntimeMediaPath(
  runtimePath: string,
  mediaPathValidator: RuntimeMediaPathValidator = (value) => RUNTIME_MEDIA_PATH.test(value),
): boolean {
  return mediaPathValidator(runtimePath)
    && !runtimePath.startsWith('/')
    && !runtimePath.includes('\\')
    && !/[\u0000-\u001f\u007f]/u.test(runtimePath)
    && !runtimePath.split('/').some((segment) => segment === '.' || segment === '..');
}

function mediaTypeForResource(resourceType: TeachingResourceType): 'video' | 'audio' {
  return resourceType === 'video' ? 'video' : 'audio';
}

function isCompatibleMediaPath(
  runtimePath: string,
  mediaType: 'video' | 'audio',
  mediaPathValidator?: RuntimeMediaPathValidator,
): boolean {
  return isSafeRuntimeMediaPath(runtimePath, mediaPathValidator) && RUNTIME_MEDIA_SUFFIXES[mediaType].test(runtimePath);
}

function mediaHref(runtimePath: string, releaseId?: string): string {
  const encodedPath = runtimePath.split('/').map(encodeURIComponent).join('/');
  return `/api/course-runtime/assets/${encodedPath}${releaseId ? `?releaseId=${encodeURIComponent(releaseId)}` : ''}`;
}

function localMediaResolution(
  runtimePath: string,
  mediaType: 'video' | 'audio',
  runtimeRoot: string,
  mediaPathValidator?: RuntimeMediaPathValidator,
): { backend: Extract<PublishedResourceBackend, { kind: 'media' }>; versionStamp: string } | { reason: string } {
  if (!isCompatibleMediaPath(runtimePath, mediaType, mediaPathValidator)) return { reason: '媒体路径或后缀无效。' };
  try {
    const file = join(runtimeRoot, ...runtimePath.split('/'));
    const details = lstatSync(file);
    if (!details.isFile() || details.isSymbolicLink()) return { reason: '媒体文件尚未发布。' };
    const contentHash = stableFileDigest(file);
    if (!contentHash) return { reason: '媒体文件尚未发布。' };
    return {
      backend: { kind: 'media', mediaType, assetPath: runtimePath, href: mediaHref(runtimePath) },
      versionStamp: `content:${contentHash}`,
    };
  } catch {
    return { reason: '媒体文件尚未发布。' };
  }
}

function publishedMediaResolution(input: {
  resource: TeachingResourceRuntime;
  runtimeManifest?: AnyActRuntimeReleaseManifest | null;
  runtimeRoot?: string;
  mediaPathValidator?: RuntimeMediaPathValidator;
  localContentMedia?: ReadonlyMap<string, string>;
}): { backend: Extract<PublishedResourceBackend, { kind: 'media' }>; versionStamp: string } | { reason: string } {
  const { resource } = input;
  const mediaType = mediaTypeForResource(resource.resourceType);
  const sourcePath = resource.sourcePath;
  if (!sourcePath) return { reason: '媒体没有已发布来源。' };

  if (!input.runtimeManifest) {
    const hash = CONTENT_KEY_PATTERN.exec(sourcePath)?.[1];
    if (hash) {
      const path = input.localContentMedia?.get(hash);
      if (!path) return { reason: '尚未找到与已发布内容一致的媒体文件。' };
      const local = localMediaResolution(path, mediaType, input.runtimeRoot ?? join(process.cwd(), 'course-content/runtime'), input.mediaPathValidator);
      return 'backend' in local ? { ...local, versionStamp: `content:${hash}` } : local;
    }
    const localPath = AUTHORING_MEDIA_PATH_PATTERN.exec(sourcePath);
    if (!localPath) return { reason: '媒体来源路径未映射。' };
    const runtimePath = `${localPath[1]}${localPath[2]}`;
    return localMediaResolution(runtimePath, mediaType, input.runtimeRoot ?? join(process.cwd(), 'course-content/runtime'), input.mediaPathValidator);
  }

  const manifest = input.runtimeManifest;
  const release: RuntimeReleaseFileIndex = {
    releaseId: manifest.releaseId,
    filesByPath: new Map(manifest.files.map((file) => [file.path, { sha256: file.sha256, objectKey: file.objectKey }])),
    filesBySha256: new Map(manifest.files.map((file) => [file.sha256, { path: file.path }])),
  };
  const resolved = resolveRuntimeSourceObjectKey(sourcePath, release);
  if ('reason' in resolved) return { reason: '媒体来源未包含在已发布 Runtime manifest。' };
  const contentKey = CONTENT_KEY_PATTERN.exec(sourcePath)?.[1];
  const file = contentKey
    ? manifest.files.find((candidate) => candidate.sha256 === contentKey && isCompatibleMediaPath(candidate.path, mediaType, input.mediaPathValidator))
    : manifest.files.find((candidate) => candidate.path === resolved.objectKey);
  if (!file || !isCompatibleMediaPath(file.path, mediaType, input.mediaPathValidator) || (contentKey && file.sha256 !== contentKey)) {
    return { reason: '媒体映射不是当前已发布 Runtime 的有效媒体文件。' };
  }
  return {
    backend: { kind: 'media', mediaType, assetPath: file.path, href: mediaHref(file.path, manifest.releaseId) },
    versionStamp: `content:${file.sha256}`,
  };
}

/** Initial indexing may hash local media; unchanged files reuse their recorded digest. */
export async function buildLocalPublishedMediaIndex(
  resources: readonly TeachingResourceRuntime[],
  runtimeRoot = join(process.cwd(), 'course-content/runtime'),
): Promise<ReadonlyMap<string, string>> {
  const expected = new Set(resources.filter((resource) => MEDIA_RESOURCE_TYPES.has(resource.resourceType))
    .flatMap((resource) => resource.sourcePath?.match(CONTENT_KEY_PATTERN)?.[1] ?? []));
  if (!expected.size) return new Map();
  const types = new Set(resources.filter((resource) => resource.sourcePath && CONTENT_KEY_PATTERN.test(resource.sourcePath)
    && MEDIA_RESOURCE_TYPES.has(resource.resourceType)).map((resource) => mediaTypeForResource(resource.resourceType)));
  const cacheFile = join(cacheRoot(), 'local-media-hashes.json');
  let hashes: Record<string, string> = {};
  try { hashes = JSON.parse(readFileSync(cacheFile, 'utf8')) as Record<string, string>; } catch { /* first index */ }
  const next: Record<string, string> = {};
  const matched = new Map<string, string>();
  const paths = listMetadataFiles(join(runtimeRoot, 'lessons'), (file) => {
    const path = relative(runtimeRoot, file).replaceAll('\\', '/');
    return isSafeRuntimeMediaPath(path) && [...types].some((type) => RUNTIME_MEDIA_SUFFIXES[type].test(path));
  });
  for (const file of paths) {
    if (!lstatSync(file).isFile()) continue;
    const stamp = sourceStamp([file]);
    let hash = hashes[stamp];
    if (!/^[a-f0-9]{64}$/.test(hash ?? '')) {
      const hasher = createHash('sha256');
      for await (const chunk of createReadStream(/*turbopackIgnore: true*/ file)) hasher.update(chunk);
      if (sourceStamp([file]) !== stamp) throw new Error('Media changed while building its feature index');
      hash = hasher.digest('hex');
    }
    next[stamp] = hash;
    if (expected.has(hash)) matched.set(hash, relative(runtimeRoot, file).replaceAll('\\', '/'));
  }
  mkdirSync(cacheRoot(), { recursive: true, mode: 0o700 });
  const temporary = cacheFile + '.' + process.pid + '.tmp';
  writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 });
  renameSync(temporary, cacheFile);
  return matched;
}

type ResourceVersionState = {
  sourceContent: Map<string, string | null>;
  infographicContent: Map<string, string | null>;
  textbookUnits: Map<string, ReadonlyMap<string, string>>;
  runtimeFiles?: ReadonlyMap<string, string>;
};

function runtimeFileHash(file: string, runtimeRoot: string, files: ReadonlyMap<string, string>): string | null {
  const key = relative(runtimeRoot, file).replaceAll('\\', '/');
  return isSafeResourceContentPath(key) ? files.get(key) ?? null : null;
}

/** Blob views use controlled symlinks; the immutable manifest must own their exact bytes. */
function runtimeFileBytes(file: string, runtimeRoot: string, files?: ReadonlyMap<string, string>): Buffer | null {
  if (!files) return stableFileBytes(file);
  const expected = runtimeFileHash(file, runtimeRoot, files);
  if (!expected) return null;
  try {
    const before = statSync(file);
    if (!before.isFile()) return null;
    const bytes = readFileSync(file);
    const after = statSync(file);
    return before.size === after.size && before.mtimeMs === after.mtimeMs && sha256Bytes(bytes) === expected ? bytes : null;
  } catch { return null; }
}

function isSafeResourceContentPath(value: string): boolean {
  return Boolean(value)
    && !value.startsWith('/')
    && !value.includes('\\')
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && !value.split('/').some((segment) => segment === '.' || segment === '..');
}

function resolveResourceContentFile(pathname: string, runtimeRoot: string): string | null {
  if (!isSafeResourceContentPath(pathname)) return null;
  const base = pathname.startsWith('lessons/') ? runtimeRoot : process.cwd();
  return join(base, ...pathname.split('/'));
}

function sourceFragmentValue(value: unknown, fragment: string): unknown {
  const segments = fragment.startsWith('/')
    ? fragment.slice(1).split('/').filter(Boolean).map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    : value && typeof value === 'object' && fragment in value
      ? [fragment]
      : ['steps', fragment];
  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function sourceContentVersion(
  sourcePath: string | null,
  runtimeRoot: string,
  cache: Map<string, string | null>,
): string | null {
  if (!sourcePath) return null;
  const cached = cache.get(sourcePath);
  if (cache.has(sourcePath)) return cached ?? null;
  const contentKey = CONTENT_KEY_PATTERN.exec(sourcePath)?.[1];
  if (contentKey) {
    const version = `content:${contentKey}`;
    cache.set(sourcePath, version);
    return version;
  }
  const fragmentIndex = sourcePath.indexOf('#');
  const pathname = fragmentIndex >= 0 ? sourcePath.slice(0, fragmentIndex) : sourcePath;
  const fragment = fragmentIndex >= 0 ? sourcePath.slice(fragmentIndex + 1) : null;
  const file = resolveResourceContentFile(pathname, runtimeRoot);
  const bytes = file ? stableFileBytes(file) : null;
  if (!bytes) {
    cache.set(sourcePath, null);
    return null;
  }
  let version: string | null = null;
  if (fragment) {
    try {
      const selected = sourceFragmentValue(JSON.parse(bytes.toString('utf8')) as unknown, fragment);
      if (selected !== undefined) version = `content:${digest(selected)}`;
    } catch {
      version = null;
    }
  } else {
    version = `content:${sha256Bytes(bytes)}`;
  }
  cache.set(sourcePath, version);
  return version;
}

function infographicContentVersion(
  token: string,
  runtimeRoot: string,
  cache: Map<string, string | null>,
): string | null {
  const key = `${runtimeRoot}\0${token}`;
  const cached = cache.get(key);
  if (cache.has(key)) return cached ?? null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,199}$/u.test(token) || token.includes('..')) {
    cache.set(key, null);
    return null;
  }
  for (const root of INFOGRAPH_SOURCE_ROOTS) {
    const file = join(runtimeRoot, root, `${token}.png`);
    const hash = stableFileDigest(file);
    if (hash) {
      cache.set(key, hash);
      return hash;
    }
  }
  cache.set(key, null);
  return null;
}

function textbookAssetDigests(
  markdown: string,
  runtimeRoot: string,
  bookId: string,
  chapterId: string,
  runtimeFiles?: ReadonlyMap<string, string>,
): string[] {
  const refs = [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/gu)]
    .map((match) => match[1])
    .filter((ref): ref is string => Boolean(ref));
  return refs.map((ref) => {
    const assetPath = ref.startsWith('assets/') ? ref.slice('assets/'.length) : ref;
    if (!isSafeResourceContentPath(assetPath)) return `${ref}:invalid`;
    const file = join(runtimeRoot, 'resources/textbooks', bookId, 'assets', chapterId, ...assetPath.split('/'));
    const hash = runtimeFiles ? runtimeFileHash(file, runtimeRoot, runtimeFiles) : stableFileDigest(file);
    return `${ref}:${hash ?? 'missing'}`;
  });
}

function loadTextbookUnitVersions(
  runtimeRoot: string,
  bookId: string,
  runtimeFiles?: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  const file = join(runtimeRoot, TEXTBOOK_RUNTIME_RELATIVE, bookId, 'units.jsonl');
  const bytes = runtimeFileBytes(file, runtimeRoot, runtimeFiles);
  const versions = new Map<string, string>();
  if (!bytes) return versions;
  for (const line of bytes.toString('utf8').split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const unit = JSON.parse(line) as {
        structuralPath?: unknown;
        markdown?: unknown;
        chapterId?: unknown;
      };
      const structuralPath = Array.isArray(unit.structuralPath)
        && unit.structuralPath.every((segment): segment is string => typeof segment === 'string' && isSafeResourceContentPath(segment))
        ? unit.structuralPath
        : null;
      if (!structuralPath || typeof unit.markdown !== 'string') continue;
      const chapterId = typeof unit.chapterId === 'string' ? unit.chapterId : structuralPath[0];
      if (!chapterId || !isSafeResourceContentPath(chapterId)) continue;
      versions.set(structuralPath.join('/'), `content:${digest({
        markdown: unit.markdown,
        assets: textbookAssetDigests(unit.markdown, runtimeRoot, bookId, chapterId, runtimeFiles),
      })}`);
    } catch {
      // A malformed unit leaves that resource without a content identity.
    }
  }
  return versions;
}

function textbookUnitContentVersion(
  resourceId: string,
  runtimeRoot: string,
  cache: Map<string, ReadonlyMap<string, string>>,
  runtimeFiles?: ReadonlyMap<string, string>,
): string | null {
  const legacy = resolveLegacyTextbookResource(resourceId);
  const decoded = legacy ? [legacy.bookId, ...legacy.structuralPath].join(':') : decodedSection(resourceId);
  if (!decoded) return null;
  const segments = decoded.split(':');
  const alias = TEXTBOOK_ID_ALIASES.find((entry) => entry.readerBookId === segments[0]);
  const structuralPath = segments.slice(1);
  if (!alias || structuralPath.length === 0) return null;
  if (legacy) {
    try {
      const manifest = JSON.parse(runtimeFileBytes(join(runtimeRoot, TEXTBOOK_RUNTIME_RELATIVE, alias.readerBookId, 'manifest.json'), runtimeRoot, runtimeFiles)?.toString('utf8') ?? '{}');
      if (manifest.bookId !== alias.readerBookId || manifest.edition !== alias.edition) return null;
    } catch { return null; }
  }
  const fileKey = join(runtimeRoot, TEXTBOOK_RUNTIME_RELATIVE, alias.readerBookId, 'units.jsonl');
  let versions = cache.get(fileKey);
  if (!versions) {
    versions = loadTextbookUnitVersions(runtimeRoot, alias.readerBookId, runtimeFiles);
    cache.set(fileKey, versions);
  }
  const selected = structuralPath.join('/');
  if (!versions.has(selected)) return null;
  if (legacy) {
    const subtree = [...versions.entries()].filter(([key]) => key === selected || key.startsWith(selected + '/'))
      .sort(([left], [right]) => left.localeCompare(right));
    return `content:${digest(subtree)}`;
  }
  return versions.get(selected) ?? null;
}

function backendVersion(backend: PublishedResourceBackend): unknown {
  switch (backend.kind) {
    case 'card': return ['card'];
    case 'infographic': return ['infographic', backend.token];
    case 'route': return ['route', backend.href];
    // Media bytes already identify content; a relocated copy is not a new learning resource.
    case 'media': return ['media', backend.mediaType];
    case 'container': return ['container', [...backend.childResourceIds].sort()];
    case 'reference-only': return ['reference-only', backend.reason];
  }
}

function registeredBackendConfiguration(backend: PublishedResourceBackend, registryId?: string): unknown {
  if (backend.kind !== 'route') return null;
  const arenaTaskId = /^\/arena\/challenges\/(task-[^/?#]+)$/u.exec(backend.href)?.[1];
  if (arenaTaskId) {
    const task = getArenaChallengeTask(arenaTaskId);
    return task ? { task, object: getArenaChallengeObject(task.objectId) ?? null } : null;
  }
  const metadata = registryId ? getRegisteredResourceMetadata(registryId) : undefined;
  return metadata ? { id: metadata.id, type: metadata.type, defaultConfig: metadata.defaultConfig ?? null,
    launchTarget: metadata.launchTarget ?? null, renderTarget: metadata.renderTarget ?? null } : null;
}

function resourceConfigurationVersion(resource: TeachingResourceRuntime): unknown {
  return {
    resourceType: resource.resourceType,
    projectionMode: resource.projectionMode,
    scopeId: resource.scopeId,
    title: resource.title,
    legacyCrosswalkRef: resource.legacyCrosswalkRef,
    bindingCount: resource.bindingCount,
    bindingStatus: resource.bindingStatus,
    projectionStatus: resource.projectionStatus,
  };
}

function resourceContentVersion(input: {
  resource: TeachingResourceRuntime;
  backend: PublishedResourceBackend;
  derivedContentVersion: string | null;
  mediaVersionStamp: string | null;
  runtimeRoot: string;
  state: ResourceVersionState;
}): string {
  const { resource, backend, derivedContentVersion, mediaVersionStamp, runtimeRoot, state } = input;
  if (mediaVersionStamp) return mediaVersionStamp;
  const sourceVersion = sourceContentVersion(resource.sourcePath, runtimeRoot, state.sourceContent);
  if (sourceVersion) return sourceVersion;
  if (backend.kind === 'infographic') {
    const hash = infographicContentVersion(backend.token, runtimeRoot, state.infographicContent);
    if (hash) return `content:${hash}`;
  }
  if (resource.resourceType === 'textbook-section' || resource.resourceType === 'textbook-chapter') {
    const version = textbookUnitContentVersion(resource.resourceId, runtimeRoot, state.textbookUnits, state.runtimeFiles);
    if (version) return version;
  }
  if (derivedContentVersion) return `derived:${derivedContentVersion}`;
  // Resources without a local body retain their registered source identity.
  // Route targets and registered backend configuration are hashed separately;
  // reference-only entries remain unavailable for recommendation.
  return `identity:${resource.resourceId}:${resource.sourcePath ?? ''}`;
}

function briefResourceSummary(
  title: string,
  canonicalIds: readonly string[],
  bindingRoles: readonly string[],
  semanticNames: ReadonlyMap<string, string | null>,
): string {
  const names = canonicalIds.map((id) => semanticNames.get(id))
    .filter((name): name is string => Boolean(name?.trim()) && !/^(?:act|ctkg|cts|ctc):/i.test(name!));
  const roleLabels: Record<string, string> = { COVERS: '知识梳理', EXPLAINS: '讲解', PRACTICES: '练习', ASSESSES: '评估' };
  const roles = [...new Set(bindingRoles.map((role) => roleLabels[role]).filter(Boolean))];
  const knowledge = names.length ? '涉及' + names.slice(0, 8).join('、') + (names.length > 8 ? `等 ${names.length} 个知识点` : '') : '';
  return [title, knowledge, roles.length ? '用于' + roles.join('、') : ''].filter(Boolean).join('。');
}

export function buildPublishedResourceFeatureIndex(input: {
  artifacts: TeachingProjectionArtifacts;
  engineering: AuthorityEngineeringBody;
  runtimeReleaseId?: string | null;
  indexSourceStamp?: string;
  cardReader: typeof readPublishedLearnerCardByToken;
  infographTokens: ReadonlySet<string>;
  runtimeManifest?: AnyActRuntimeReleaseManifest | null;
  runtimeRoot?: string;
  runtimeMediaPathValidator?: RuntimeMediaPathValidator;
  localContentMedia?: ReadonlyMap<string, string>;
  now?: Date;
}): PublishedResourceFeatureIndex {
  const { artifacts } = input;
  const manifest = artifacts.manifest;
  if (!artifacts.gate.passed || !manifest.gatePassed || !manifest.authoritySnapshotId || !manifest.authoritySnapshotHash) {
    throw new Error('Published resource index requires a passed, snapshot-bound publication');
  }
  const snapshotId = manifest.authoritySnapshotId;
  const snapshotHash = manifest.authoritySnapshotHash;
  if (input.runtimeManifest && input.runtimeReleaseId && input.runtimeReleaseId !== input.runtimeManifest.releaseId) {
    throw new Error('Published resource index runtime release does not match its manifest');
  }
  const effectiveRuntimeReleaseId = input.runtimeManifest?.releaseId ?? input.runtimeReleaseId ?? null;
  const canonicalIds = new Set(input.engineering.objects.map((node) => node.canonicalId));
  const semanticNames = new Map(input.engineering.objects.map((node) => [node.canonicalId, node.semanticName]));
  const bindings = new Map<string, typeof artifacts.bindings>();
  for (const binding of artifacts.bindings) {
    const list = bindings.get(binding.resourceId) ?? [];
    list.push(binding);
    bindings.set(binding.resourceId, list);
  }
  const launch = buildTeachingResourceLaunchMaps(artifacts.resources);
  const ids = new Set<string>();
  const runtimeRoot = input.runtimeRoot ?? join(process.cwd(), 'course-content/runtime');
  const versionState: ResourceVersionState = {
    sourceContent: new Map(), infographicContent: new Map(), textbookUnits: new Map(),
    runtimeFiles: input.runtimeManifest ? new Map(input.runtimeManifest.files.map((file) => [file.path, file.sha256])) : undefined,
  };
  const resources = artifacts.resources.map((resource): PublishedResourceFeature => {
    if (ids.has(resource.resourceId)) throw new Error('Duplicate published resource identity');
    ids.add(resource.resourceId);
    const matched = bindings.get(resource.resourceId) ?? [];
    const coverage = [...new Set(matched.map((binding) => binding.canonicalId))].sort();
    const bindingValid = canonicalIds.size === 0 || coverage.every((id) => canonicalIds.has(id));
    const registered = resource.resourceType === 'simulation'
      ? getRegisteredResourceMetadata(launch.resourceRegistryIds[resource.resourceId] ?? '')
      : null;
    let title = registered?.label || safeTitle(resource);
    let summary = title;
    let derivedContentVersion: string | null = null;
    let mediaVersionStamp: string | null = null;
    let backend: PublishedResourceBackend;
    const legacyTextbook = resource.resourceType === 'textbook-chapter' || resource.resourceType === 'textbook-section'
      ? resolveLegacyTextbookResource(resource.resourceId) : null;
    if (legacyTextbook) {
      title = legacyTextbook.title;
      const href = launch.resourceLaunchTargets[resource.resourceId];
      backend = href && isStudentVisiblePathTarget(href)
        ? { kind: 'route', href }
        : { kind: 'reference-only', reason: '对应版本的教材单元尚未发布。' };
    } else if (resource.resourceType === 'card') {
      const card = input.cardReader(resource.resourceId.slice('act:card:'.length), resource.sourcePath);
      const href = launch.resourceLaunchTargets[resource.resourceId];
      if (card) {
        title = card.title || title;
        derivedContentVersion = digest(card);
        summary = Array.from(card.summary).slice(0, 400).join('');
        backend = { kind: 'card' };
      } else backend = href && isStudentVisiblePathTarget(href)
        ? { kind: 'route', href }
        : { kind: 'card' };
    } else if (resource.resourceType === 'infographic') {
      const token = resource.resourceId.slice('act:infographic:'.length);
      backend = { kind: 'infographic', token };
    } else if (resource.resourceType === 'textbook') {
      const bookId = resource.resourceId.slice('act:textbook:'.length);
      const alias = TEXTBOOK_ID_ALIASES.find((entry) => entry.sourceDocumentId === bookId);
      const children = alias ? artifacts.resources.filter((entry) =>
        decodedSection(entry.resourceId)?.startsWith(alias.readerBookId + ':')) : [];
      backend = { kind: 'container', childResourceIds: children.map((entry) => entry.resourceId) };
    } else if (resource.resourceType === 'textbook-chapter') {
      backend = { kind: 'reference-only', reason: '该参考章节尚未对应可阅读的教材单元。' };
    } else if (MEDIA_RESOURCE_TYPES.has(resource.resourceType)) {
      const resolved = publishedMediaResolution({ resource, runtimeManifest: input.runtimeManifest, runtimeRoot: input.runtimeRoot,
        mediaPathValidator: input.runtimeMediaPathValidator, localContentMedia: input.localContentMedia });
      if ('reason' in resolved) {
        const href = launch.resourceLaunchTargets[resource.resourceId];
        backend = href && isStudentVisiblePathTarget(href)
          ? { kind: 'route', href }
          : { kind: 'reference-only', reason: resolved.reason };
      } else {
        backend = resolved.backend;
        mediaVersionStamp = resolved.versionStamp;
      }
    } else {
      const href = resource.resourceId === 'act:simulation:control-workbench-free'
        ? '/interactive-learning/control-workbench'
        : launch.resourceLaunchTargets[resource.resourceId];
      backend = href && isStudentVisiblePathTarget(href)
        ? { kind: 'route', href }
        : { kind: 'reference-only', reason: '该参考条目尚未提供可执行的阅读或学习入口。' };
    }
    if (resource.resourceType !== 'card') {
      summary = briefResourceSummary(title, coverage, [...new Set(matched.map((binding) => binding.role))].sort(), semanticNames);
    }
    const executable = backend.kind !== 'container' && backend.kind !== 'reference-only';
    const sourceVersion = resourceContentVersion({
      resource, backend, derivedContentVersion, mediaVersionStamp, runtimeRoot, state: versionState,
    });
    const version = digest([
      resource.resourceId, sourceVersion, backendVersion(backend),
      resourceConfigurationVersion(resource), registeredBackendConfiguration(backend, launch.resourceRegistryIds[resource.resourceId]),
      resource.bindingDigest,
    ]);
    return {
      identity: {
        resourceId: resource.resourceId, projectionId: manifest.projectionId,
        projectionHash: manifest.projectionHash, snapshotId,
        snapshotHash, runtimeReleaseId: effectiveRuntimeReleaseId,
        resourceVersion: version,
      },
      version,
      type: resource.resourceType, title, summary, canonicalIds: coverage,
      bindingIds: matched.map((binding) => binding.bindingId).sort(),
      bindingRoles: [...new Set(matched.map((binding) => binding.role))].sort(),
      sourcePath: resource.sourcePath,
      baselineDifficulty: null,
      estimatedMinutes: ESTIMATED_MINUTES[resource.resourceType],
      estimateSource: 'policy-estimate', executable,
      recommendable: executable && bindingValid && coverage.length > 0 && resource.projectionStatus === 'BOUND',
      limitation: !bindingValid ? '知识绑定与当前图谱不一致。'
        : backend.kind === 'reference-only' ? backend.reason
          : backend.kind === 'container' ? '教材目录作为参考入口，路径使用具体教材节。'
            : coverage.length === 0 ? '该资源未声明教学知识绑定。' : null,
      backend,
    };
  }).sort((a, b) => a.identity.resourceId.localeCompare(b.identity.resourceId));
  const prerequisiteEdges = input.engineering.relations
    .filter((edge) => edge.relationType === 'prerequisite' && edge.direct === true)
    .map((edge) => ({ id: edge.relationId, sourceId: edge.sourceId, targetId: edge.targetId, origin: 'ENGINEERING' as const }))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (prerequisiteEdges.some((edge) => !canonicalIds.has(edge.sourceId) || !canonicalIds.has(edge.targetId))) {
    throw new Error('Engineering prerequisites have an unresolved endpoint');
  }
  const body = {
    contract: INDEX_VERSION as 'published-resource-features/v1',
    projectionId: manifest.projectionId, projectionHash: manifest.projectionHash,
    snapshotId, snapshotHash,
    runtimeReleaseId: effectiveRuntimeReleaseId, authorityReleaseId: manifest.authorityReleaseId,
    resources, prerequisiteEdges,
  };
  return { ...body, indexId: digest(body), generatedAt: (input.now ?? new Date()).toISOString() };
}

function readIndex(file: string): PublishedResourceFeatureIndex | null {
  try {
    const index = JSON.parse(readFileSync(file, 'utf8')) as PublishedResourceFeatureIndex;
    const { indexId, generatedAt: _generatedAt, ...body } = index;
    return index.contract === INDEX_VERSION && Array.isArray(index.resources)
      && Array.isArray(index.prerequisiteEdges) && indexId === digest(body) ? index : null;
  } catch { return null; }
}

function asReferenceOnly(resource: PublishedResourceFeature, reason: string): PublishedResourceFeature {
  return {
    ...resource,
    executable: false,
    recommendable: false,
    limitation: reason,
    backend: { kind: 'reference-only', reason },
  };
}

function retainedIndexPath(ref: Pick<PublishedResourceIdentity, 'projectionId' | 'projectionHash' | 'runtimeReleaseId'>): string {
  return join(cacheRoot(), 'retained-' + digest([ref.projectionId, ref.projectionHash, ref.runtimeReleaseId ?? null]) + '.json');
}

function persistIndex(file: string, index: PublishedResourceFeatureIndex): void {
  mkdirSync(cacheRoot(), { recursive: true, mode: 0o700 });
  const temporary = file + '.' + process.pid + '.tmp';
  writeFileSync(temporary, JSON.stringify(index), { mode: 0o600 });
  renameSync(temporary, file);
}

/** Only index creation reads card bodies; repeated planning consumes this metadata cache. */
export class PublishedResourceSelectionChangedError extends Error {}

export interface PublishedResourceFeatureIndexCapture {
  index: PublishedResourceFeatureIndex;
  assertCurrent: () => void;
}

/**
 * Catalog capture for `/learning-resources` and card/infograph metadata.
 * Binding appearance/anchor labels overlay from `resource-bindings/current.json`
 * when that pointer exists. Do not add new binding consumers that treat B′
 * `bindings.jsonl` as the live resource set.
 */
export async function loadPublishedResourceFeatureIndexCapture(): Promise<PublishedResourceFeatureIndexCapture> {
  const live = readAgreedLiveCourseProjection();
  if (!live) throw new Error('The published teaching resource selection is unavailable');
  const root = resolveConfiguredTeachingProjectionRoot();
  const release = join(root, 'releases', live.projectionId);
  const stamp = sourceStamp(['projection-manifest.json', 'resources.jsonl', 'bindings.jsonl', 'gate.json']
    .map((name) => join(release, name)));
  const runtime = runtimeStamp();
  const capturedEnvelope = resolveActiveShardIdentity().envelope;
  const authorityIdentity = capturedEnvelope.authority;
  const envelopeFingerprint = digest(capturedEnvelope);
  const assertCaptureCurrent = () => {
    const after = readAgreedLiveCourseProjection();
    if (after?.projectionId !== live.projectionId || after.projectionHash !== live.projectionHash || runtimeStamp() !== runtime
      || sourceStamp(['projection-manifest.json', 'resources.jsonl', 'bindings.jsonl', 'gate.json']
        .map((name) => join(release, name))) !== stamp
      || digest(resolveActiveShardIdentity().envelope) !== envelopeFingerprint) {
      throw new PublishedResourceSelectionChangedError('Resource publication changed while indexing');
    }
  };
  const liveBinding = readAgreedLiveResourceBindingRelease();
  const key = digest([INDEX_VERSION, INDEX_IMPLEMENTATION_REVISION, live.projectionId, live.projectionHash,
    liveBinding?.bindingReleaseId ?? '', liveBinding?.bindingHash ?? '',
    envelopeFingerprint, stamp, runtime]);
  const prior = indexPromises.get(key);
  const promise = prior ?? (async () => {
    const file = join(cacheRoot(), key + '.json');
    const cached = readIndex(file);
    if (cached && cached.projectionId === live.projectionId && cached.projectionHash === live.projectionHash) return cached;
    const projection = loadStagedTeachingProjection(
      resolveTeachingProjectionStorePaths(root),
      live.projectionId,
      { verify: false },
    );
    if (projection.projectionHash !== live.projectionHash) throw new Error('Teaching resource publication has drifted');
    const authority = resolveActiveEngineeringGraphAuthority(resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot()));
    if (authority.status !== 'ready' || !authority.engineering) {
      throw new Error('Engineering graph lock is not readable');
    }
    const runtimeReleaseModule = await import('./runtime-active-release');
    const runtimeManifest = await runtimeReleaseModule.readActiveRuntimeReleaseManifest();
    const localContentMedia = runtimeManifest ? undefined : await buildLocalPublishedMediaIndex(projection.artifacts.resources);
    const liveTokens = new Map(projection.artifacts.resources
      .filter((resource) => resource.resourceType === 'infographic')
      .map((resource) => [resource.resourceId.slice('act:infographic:'.length),
        resource.sourcePath?.match(/^content:([a-f0-9]{64})$/)?.[1] ?? null]));
    const index = attachLiveBindingAppearance(buildPublishedResourceFeatureIndex({
      artifacts: projection.artifacts, engineering: authority.engineering,
      runtimeReleaseId: runtimeManifest?.releaseId ?? null, indexSourceStamp: runtime,
      runtimeManifest, localContentMedia, runtimeMediaPathValidator: runtimeReleaseModule.isRuntimeMediaPath,
      cardReader: readPublishedLearnerCardByToken,
      infographTokens: createPublishedInfographReferenceIndex({
        liveInfographicTokens: liveTokens, envelope: capturedEnvelope,
      }),
    }));
    // A concurrent selection change must not label an old capture as current.
    assertCaptureCurrent();
    persistIndex(file, index);
    persistIndex(retainedIndexPath(index), index);
    return index;
  })();
  if (!prior) indexPromises.set(key, promise);
  if (indexPromises.size > 4) indexPromises.delete(indexPromises.keys().next().value!);
  try {
    const index = await promise;
    // This single return boundary covers freshly built, disk and memory results.
    assertCaptureCurrent();
    return { index, assertCurrent: assertCaptureCurrent };
  } catch (error) {
    if (indexPromises.get(key) === promise) indexPromises.delete(key);
    throw error;
  }
}

export async function loadPublishedResourceFeatureIndex(): Promise<PublishedResourceFeatureIndex> {
  return (await loadPublishedResourceFeatureIndexCapture()).index;
}

/** Retained entries are written only after observing an agreed active publication. */
export async function resolvePublishedResourceFeature(ref: PublishedResourceIdentity): Promise<{
  index: PublishedResourceFeatureIndex;
  resource: PublishedResourceFeature;
  current: boolean;
} | null> {
  const live = await loadPublishedResourceFeatureIndex();
  const current = live.projectionId === ref.projectionId && live.projectionHash === ref.projectionHash
    && live.snapshotId === ref.snapshotId && live.snapshotHash === ref.snapshotHash
    && live.runtimeReleaseId === (ref.runtimeReleaseId ?? null);
  const liveResource = live.resources.find((entry) => entry.identity.resourceId === ref.resourceId);
  if (current && ref.resourceVersion && liveResource?.version !== ref.resourceVersion) {
    const reason = '该资源版本已更新。当前引用仅保留元数据，请返回学习路径重新选择。';
    return liveResource ? { index: live, resource: asReferenceOnly(liveResource, reason), current: false } : null;
  }
  const index = current ? live : readIndex(retainedIndexPath(ref));
  if (!index || index.projectionId !== ref.projectionId || index.projectionHash !== ref.projectionHash
    || index.snapshotId !== ref.snapshotId || index.snapshotHash !== ref.snapshotHash
    || index.runtimeReleaseId !== (ref.runtimeReleaseId ?? null)) return null;
  const release = join(resolveConfiguredTeachingProjectionRoot(), 'releases', ref.projectionId, 'projection-manifest.json');
  if (!existsSync(release)) return null;
  const resource = index.resources.find((entry) => entry.identity.resourceId === ref.resourceId);
  if (!resource || (ref.resourceVersion && resource.version !== ref.resourceVersion)) return null;
  return {
    index,
    resource: current ? resource : asReferenceOnly(resource, '该引用来自已保留版本，当前内容已更新。请返回路径重新选择。'),
    current,
  };
}

function attachLiveBindingAppearance(index: PublishedResourceFeatureIndex): PublishedResourceFeatureIndex {
  const live = readAgreedLiveResourceBindingRelease();
  if (!live) return index;
  const loaded = loadResourceBindingRelease(process.cwd(), live.bindingReleaseId);
  const preferred = new Map<string, { appearance: 'first' | 'revisit' | 'reference'; label: string | null }>();
  for (const binding of loaded.bindings) {
    const current = preferred.get(binding.resourceId);
    const rank = binding.appearance === 'first' ? 0 : binding.appearance === 'revisit' ? 1 : 2;
    const currentRank = current?.appearance === 'first' ? 0 : current?.appearance === 'revisit' ? 1 : 2;
    const label = 'label' in binding.anchor ? binding.anchor.label : null;
    if (!current || rank < currentRank) {
      preferred.set(binding.resourceId, { appearance: binding.appearance, label });
    }
  }
  return {
    ...index,
    bindingReleaseId: live.bindingReleaseId,
    bindingHash: live.bindingHash,
    resources: index.resources.map((resource) => {
      const overlay = preferred.get(resource.identity.resourceId);
      if (!overlay) return resource;
      return {
        ...resource,
        appearance: overlay.appearance,
        anchorLabel: overlay.label ?? resource.anchorLabel ?? null,
      };
    }),
  };
}

export function clearPublishedResourceFeatureMemoryCache(): void {
  indexPromises.clear();
  runtimeStampMemo = null;
}
