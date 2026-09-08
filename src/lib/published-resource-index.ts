import { createHash } from 'node:crypto';
import {
  createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { buildTeachingResourceLaunchMaps } from './layered-graph/teaching-resource-launch-maps';
import { TEXTBOOK_ID_ALIASES } from './engineering-textbook-mapping/aliases';
import { fromResourceIdToken } from './teaching-projection/textbook-locators/identity';
import { humanTitleFromResourceId } from './teaching-projection/resource-title';
import { readAgreedLiveCourseProjection, resolveConfiguredTeachingProjectionRoot } from './teaching-projection/live-course-pointer';
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
const INDEX_IMPLEMENTATION_REVISION = 8;
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
type RuntimeMediaPathValidator = (runtimePath: string) => boolean;

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cacheRoot(): string {
  return join(tmpdir(), 'act-resource-features', digest(process.cwd()).slice(0, 20));
}

function sourceStamp(paths: readonly string[]): string {
  return digest(paths.map((file) => {
    try {
      const stat = statSync(file);
      return [file, stat.size, stat.mtimeMs];
    } catch {
      return [file, null];
    }
  }));
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
  const cardFiles = CARD_SOURCE_ROOTS.flatMap((root) => listMetadataFiles(join(process.cwd(), root), (file) => file.endsWith('.md')));
  return digest({
    media: sourceStamp([join(runtimeRoot, 'lessons'), ...mediaFiles]),
    cards: sourceStamp([
      join(process.cwd(), 'course-content/runtime/knowledge/authority-learning-content-manifest.json'),
      ...CARD_SOURCE_ROOTS.flatMap((root) => [join(process.cwd(), root)]),
      ...cardFiles,
    ]),
  });
}

function receiptPath(): string {
  return process.env.ACT_RUNTIME_ACTIVE_RECEIPT_PATH?.trim()
    || join(process.cwd(), 'course-content/runtime/act-runtime-active-receipt.json');
}

function runtimeStamp(): string {
  return digest({
    release: sourceStamp([
      receiptPath(),
      join(process.cwd(), 'course-content/runtime/.act-runtime-release.v1.json'),
      join(process.cwd(), 'course-content/runtime/.act-runtime-release.v2.json'),
    ]),
    content: runtimeMetadataStamp(),
  });
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
    const details = lstatSync(join(runtimeRoot, ...runtimePath.split('/')));
    if (!details.isFile() || details.isSymbolicLink()) return { reason: '媒体文件尚未发布。' };
    return {
      backend: { kind: 'media', mediaType, assetPath: runtimePath, href: mediaHref(runtimePath) },
      versionStamp: `local:${runtimePath}:${details.size}:${details.mtimeMs}`,
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
    versionStamp: `release:${file.path}:${file.sha256}`,
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
  const resources = artifacts.resources.map((resource): PublishedResourceFeature => {
    if (ids.has(resource.resourceId)) throw new Error('Duplicate published resource identity');
    ids.add(resource.resourceId);
    const matched = bindings.get(resource.resourceId) ?? [];
    const coverage = [...new Set(matched.map((binding) => binding.canonicalId))].sort();
    const bindingValid = coverage.every((id) => canonicalIds.has(id));
    let title = safeTitle(resource);
    let summary = title;
    let derivedContentVersion: string | null = null;
    let mediaVersionStamp: string | null = null;
    let backend: PublishedResourceBackend;
    if (resource.resourceType === 'card') {
      const card = input.cardReader(resource.resourceId.slice('act:card:'.length), resource.sourcePath);
      if (card) {
        title = card.title || title;
        derivedContentVersion = digest(card);
        summary = Array.from(card.summary).slice(0, 400).join('');
        backend = { kind: 'card' };
      } else backend = { kind: 'reference-only', reason: '知识卡内容尚未就绪。' };
    } else if (resource.resourceType === 'infographic') {
      const token = resource.resourceId.slice('act:infographic:'.length);
      backend = input.infographTokens.has(token)
        ? { kind: 'infographic', token }
        : { kind: 'reference-only', reason: '信息图内容尚未就绪。' };
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
      if ('reason' in resolved) backend = { kind: 'reference-only', reason: resolved.reason };
      else {
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
    const sourceVersion = mediaVersionStamp
      ?? (resource.sourcePath?.startsWith('content:')
        ? resource.sourcePath
        : derivedContentVersion ?? [manifest.projectionHash, effectiveRuntimeReleaseId]);
    const version = digest([resource.resourceId, sourceVersion, resource.bindingDigest]);
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
export async function loadPublishedResourceFeatureIndex(): Promise<PublishedResourceFeatureIndex> {
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
      || digest(resolveActiveShardIdentity().envelope) !== envelopeFingerprint) {
      throw new Error('Resource publication changed while indexing');
    }
  };
  const key = digest([INDEX_VERSION, INDEX_IMPLEMENTATION_REVISION, live.projectionId, live.projectionHash,
    envelopeFingerprint, stamp, runtime]);
  const prior = indexPromises.get(key);
  const promise = prior ?? (async () => {
    const file = join(cacheRoot(), key + '.json');
    const cached = readIndex(file);
    if (cached && cached.projectionId === live.projectionId && cached.projectionHash === live.projectionHash) return cached;
    const projection = loadStagedTeachingProjection(resolveTeachingProjectionStorePaths(root), live.projectionId);
    if (projection.projectionHash !== live.projectionHash) throw new Error('Teaching resource publication has drifted');
    const authority = resolveActiveEngineeringGraphAuthority(resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot()));
    const manifest = projection.artifacts.manifest;
    if (authority.status !== 'ready' || !authority.engineering
      || authority.snapshotId !== manifest.authoritySnapshotId || authority.snapshotHash !== manifest.authoritySnapshotHash
      || authority.snapshotId !== authorityIdentity.snapshotId || authority.snapshotHash !== authorityIdentity.snapshotHash) {
      throw new Error('Resource bindings and engineering graph do not share a snapshot');
    }
    const runtimeReleaseModule = await import('./runtime-active-release');
    const runtimeManifest = await runtimeReleaseModule.readActiveRuntimeReleaseManifest();
    const localContentMedia = runtimeManifest ? undefined : await buildLocalPublishedMediaIndex(projection.artifacts.resources);
    const liveTokens = new Map(projection.artifacts.resources
      .filter((resource) => resource.resourceType === 'infographic')
      .map((resource) => [resource.resourceId.slice('act:infographic:'.length),
        resource.sourcePath?.match(/^content:([a-f0-9]{64})$/)?.[1] ?? null]));
    const index = buildPublishedResourceFeatureIndex({
      artifacts: projection.artifacts, engineering: authority.engineering,
      runtimeReleaseId: runtimeManifest?.releaseId ?? null, indexSourceStamp: runtime,
      runtimeManifest, localContentMedia, runtimeMediaPathValidator: runtimeReleaseModule.isRuntimeMediaPath,
      cardReader: readPublishedLearnerCardByToken,
      infographTokens: createPublishedInfographReferenceIndex({
        liveInfographicTokens: liveTokens, envelope: capturedEnvelope,
      }),
    });
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
    return index;
  } catch (error) {
    if (indexPromises.get(key) === promise) indexPromises.delete(key);
    throw error;
  }
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

export function clearPublishedResourceFeatureMemoryCache(): void {
  indexPromises.clear();
}
