/**
 * Selection-bound Authority resource-binding projector.
 *
 * Resolves Teaching Projection resources that share the node-detail shard
 * envelope and returns learner-safe launch descriptors. Never invents routes
 * from Canonical IDs or copies Legacy graph DTOs into the active workspace.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  anchorDisplayLabel,
  buildTeachingResourceLaunchMaps,
  resolveAnchoredLaunchHref,
  type LaunchableResource,
} from '@/lib/layered-graph/teaching-resource-launch-maps';
import type { AnchoredBindingRuntime, AnchoredResourceRuntime } from '@/lib/resource-binding-release/contracts';
import { loadResourceBindingRelease } from '@/lib/resource-binding-release/store';
import {
  readAgreedLiveResourceBindingRelease,
  resolveConfiguredTeachingProjectionRoot,
} from '@/lib/teaching-projection/live-course-pointer';
import { humanTitleFromResourceId } from '@/lib/teaching-projection/resource-title';
import {
  loadStagedTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '@/lib/teaching-projection/store';
import {
  DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
  resolveDomainTeachingRuntimePaths,
} from './teaching';
import type {
  TeachingBindingRuntime,
  TeachingProjectionRole,
  TeachingResourceRuntime,
  TeachingResourceType,
} from '@/lib/teaching-projection/contracts';
import { resolveSafeLaunchTarget } from '@/features/knowledge/launch-target';
import type {
  ActiveNodeResourceBindings,
  ActiveResourceBinding,
  ActiveResourceBindingRole,
  ActiveResourceViewerContent,
} from '@/features/knowledge/active-authority-graph-contracts';

import type { KnowledgeRole } from '@/lib/authoritative-knowledge';
import type { AuthorityNodeDetailShard } from './contracts';
import { resolveBindingViewerContent } from './binding-viewer-content';

const ROLE_LABEL: Record<TeachingProjectionRole, ActiveResourceBindingRole> = {
  EXPLAINS: '讲解',
  PRACTICES: '练习',
  ASSESSES: '评价',
  COVERS: '引用',
};

const ROLE_ORDER: readonly ActiveResourceBindingRole[] = ['讲解', '练习', '评价', '引用'];

export { humanTitleFromResourceId };

function resourceKindLabel(resourceType: TeachingResourceType | null): string {
  switch (resourceType) {
    case 'lesson':
      return '课程';
    case 'handout':
      return '讲义';
    case 'step':
      return '步骤';
    case 'textbook':
    case 'textbook-chapter':
    case 'textbook-section':
      return '教材';
    case 'card':
      return '知识卡';
    case 'video':
      return '视频';
    case 'audio':
    case 'podcast':
      return '音频';
    case 'exercise':
      return '练习';
    case 'simulation':
      return '仿真';
    case 'infographic':
      return '信息图';
    default:
      return '教学资源';
  }
}

function isUnsafeHref(href: string, nodeId: string): boolean {
  return href.includes(nodeId)
    || href.startsWith('file:')
    || href.includes('course-content/')
    || href.includes('\\')
    || /(?:^|\/)\.+\//.test(href);
}

function isHiddenFromViewer(href: string, role: KnowledgeRole | undefined): boolean {
  if (role !== 'STUDENT') return false;
  return /^(?:\/teacher|\/admin|\/api\/teacher|\/api\/admin)(?:\/|$)/.test(href);
}

/** Either a course-projection binding (legacy B′) or an anchored binding-release binding. */
export type ProjectableBinding = TeachingBindingRuntime | AnchoredBindingRuntime;
export type ProjectableResource = LaunchableResource & Pick<TeachingResourceRuntime, 'title' | 'sourcePath'>;

function isAnchoredBinding(binding: ProjectableBinding): binding is AnchoredBindingRuntime {
  return 'anchor' in binding && typeof binding.anchor === 'object' && binding.anchor !== null;
}

export function projectAuthorityNodeResourceBindings(input: {
  nodeId: string;
  bindings: readonly ProjectableBinding[];
  resources: readonly ProjectableResource[];
  viewerRole?: KnowledgeRole;
  resolveViewerContent?: (
    resource: ProjectableResource,
  ) => ActiveResourceViewerContent | null;
}): ActiveNodeResourceBindings {
  const matched = input.bindings.filter((binding) => binding.canonicalId === input.nodeId);
  if (matched.length === 0) {
    return { state: 'empty', message: '暂无已授权系统资源。' };
  }
  const resources = input.resources.filter((resource) =>
    matched.some((binding) => binding.resourceId === resource.resourceId));
  const launchMaps = buildTeachingResourceLaunchMaps(resources);
  const resolveViewer = input.resolveViewerContent ?? resolveBindingViewerContent;
  const items: ActiveResourceBinding[] = [];
  for (const binding of matched) {
    const resource = resources.find((entry) => entry.resourceId === binding.resourceId);
    const title = resource?.title?.trim()
      || (resource ? humanTitleFromResourceId(resource.resourceId) : null);
    if (!title) continue;
    const baseHref = launchMaps.resourceLaunchTargets[binding.resourceId] ?? null;
    const anchored = isAnchoredBinding(binding) ? binding : null;
    const candidateHref = anchored && resource
      ? resolveAnchoredLaunchHref(resource, anchored.anchor, baseHref)
      : baseHref;
    const resolved = resource?.resourceType === 'textbook-section' && candidateHref
      ? { href: candidateHref }
      : resolveSafeLaunchTarget(candidateHref);
    const href = resolved.href
      && !isUnsafeHref(resolved.href, input.nodeId)
      && !isHiddenFromViewer(resolved.href, input.viewerRole)
      ? resolved.href
      : null;
    const viewerShell = launchMaps.resourceRegistryIds[binding.resourceId] === 'viewer-shell';
    const viewer = resource && viewerShell ? resolveViewer(resource) : undefined;
    const kind = viewerShell
      ? (viewer ? 'viewer-shell' : 'unavailable')
      : href
      ? (launchMaps.resourceRegistryIds[binding.resourceId] ? 'registry-resource' : 'direct-route')
      : 'unavailable';
    const item: ActiveResourceBinding = {
      resourceId: binding.resourceId,
      title,
      bindingRole: ROLE_LABEL[binding.role],
      resourceKind: resourceKindLabel(resource?.resourceType ?? null),
      availability: href || (viewerShell && viewer) ? 'available' : 'unavailable',
      launch: { kind, href: viewerShell ? null : href },
    };
    if (viewer) item.viewer = viewer;
    if (anchored) {
      item.anchorLabel = anchorDisplayLabel(anchored.anchor);
      item.appearance = anchored.appearance;
      item.unitId = anchored.teachingOrder?.unitId ?? null;
    }
    items.push(item);
  }
  if (items.length === 0) {
    return { state: 'empty', message: '暂无已授权系统资源。' };
  }
  const appearanceRank = (item: ActiveResourceBinding) =>
    item.appearance === 'first' ? 0 : item.appearance === 'revisit' ? 1 : 2;
  items.sort((left, right) =>
    appearanceRank(left) - appearanceRank(right)
    || (left.unitId ?? '').localeCompare(right.unitId ?? '')
    || ROLE_ORDER.indexOf(left.bindingRole) - ROLE_ORDER.indexOf(right.bindingRole)
    || left.title.localeCompare(right.title, 'zh-CN')
    || (left.anchorLabel ?? '').localeCompare(right.anchorLabel ?? '', 'zh-CN'));
  return { state: 'available', items };
}

type TeachingProjectionMatch = {
  status: 'unavailable' | 'mismatch' | 'available';
  authoringRevision: string | null;
  projectionId?: string;
  projectionHash?: string;
  scopeId?: string;
  /** Anchored resource binding release the resources came from; null when falling back to B′ bindings. */
  bindingReleaseId?: string | null;
  bindingHash?: string | null;
  bindings?: readonly ProjectableBinding[];
  resources?: readonly ProjectableResource[];
};

const availableTeachingProjectionMatch = new Map<string, TeachingProjectionMatch>();

export function matchActiveTeachingProjection(shard: Pick<AuthorityNodeDetailShard, 'envelope'>): TeachingProjectionMatch {
  const teaching = shard.envelope.teaching;
  if (
    shard.envelope.match.teaching !== true
    || teaching.status !== 'available'
    || !teaching.projectionId
    || !teaching.projectionHash
  ) {
    return { status: 'unavailable', authoringRevision: null };
  }
  const liveBinding = readAgreedLiveResourceBindingRelease();
  const cacheKey = `${teaching.projectionId}:${teaching.projectionHash}:${liveBinding?.bindingReleaseId ?? '-'}:${liveBinding?.bindingHash ?? '-'}`;
  const cached = availableTeachingProjectionMatch.get(cacheKey);
  if (cached) return cached;
  const overlay = resolveDomainTeachingRuntimePaths(process.cwd(), DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE);
  const sidecarPath = join(overlay.releasesDir, teaching.projectionId, 'inspector-sidecar.json');
  if (!existsSync(sidecarPath)) {
    return { status: 'unavailable', authoringRevision: null };
  }
  let sidecar: {
    envelopeProjectionId?: string;
    envelopeProjectionHash?: string;
    courseProjectionId?: string;
    courseProjectionHash?: string;
    authorityReleaseId?: string;
    authorityReleaseSetId?: string;
    authoritySnapshotId?: string;
    authoritySnapshotHash?: string;
  };
  try {
    sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as typeof sidecar;
  } catch {
    return { status: 'unavailable', authoringRevision: null };
  }
  if (
    sidecar.envelopeProjectionId !== teaching.projectionId
    || sidecar.envelopeProjectionHash !== teaching.projectionHash
  ) {
    return { status: 'mismatch', authoringRevision: null };
  }
  const authority = shard.envelope.authority;
  if (
    sidecar.authorityReleaseId !== authority.releaseId
    || sidecar.authorityReleaseSetId !== authority.releaseSetId
    || sidecar.authoritySnapshotId !== authority.snapshotId
    || sidecar.authoritySnapshotHash !== authority.snapshotHash
    || !sidecar.courseProjectionId
    || !sidecar.courseProjectionHash
  ) {
    return { status: 'mismatch', authoringRevision: null };
  }
  let staged;
  try {
    staged = loadStagedTeachingProjection(
      resolveTeachingProjectionStorePaths(resolveConfiguredTeachingProjectionRoot()),
      sidecar.courseProjectionId,
      { verify: false },
    );
  } catch {
    return { status: 'unavailable', authoringRevision: null };
  }
  if (
    staged.projectionId !== sidecar.courseProjectionId
    || staged.projectionHash !== sidecar.courseProjectionHash
    || !staged.artifacts.gate.passed
  ) {
    return { status: 'mismatch', authoringRevision: null };
  }
  let bindings: readonly ProjectableBinding[] = staged.artifacts.bindings;
  let resources: readonly ProjectableResource[] = staged.artifacts.resources;
  let bindingReleaseId: string | null = null;
  let bindingHash: string | null = null;
  if (liveBinding && liveBinding.authorityReleaseId === authority.releaseId) {
    try {
      const release = loadResourceBindingRelease(process.cwd(), liveBinding.bindingReleaseId);
      if (release.manifest.bindingHash === liveBinding.bindingHash && release.gate.passed) {
        bindings = release.bindings;
        resources = release.resources.filter((resource: AnchoredResourceRuntime) => resource.bindingStatus === 'BOUND');
        bindingReleaseId = release.manifest.bindingReleaseId;
        bindingHash = release.manifest.bindingHash;
      }
    } catch {
      // A broken staged release must not take the drawer down; B′ bindings remain the fallback.
    }
  }
  const boundIds = new Set(bindings.map((binding) => binding.resourceId));
  const matched: TeachingProjectionMatch = {
    status: 'available',
    projectionId: staged.projectionId,
    projectionHash: staged.projectionHash,
    scopeId: staged.artifacts.manifest.scopeId,
    authoringRevision: staged.artifacts.manifest.authoringRevision,
    bindingReleaseId,
    bindingHash,
    bindings,
    resources: resources.filter((resource) => boundIds.has(resource.resourceId)),
  };
  availableTeachingProjectionMatch.set(cacheKey, matched);
  return matched;
}

export function readActiveTeachingCaptureRevision(
  shard: AuthorityNodeDetailShard,
): string | null {
  const matched = matchActiveTeachingProjection(shard);
  return matched.status === 'available' ? matched.authoringRevision : null;
}

export function attachActiveAuthorityResourceBindings(
  shard: AuthorityNodeDetailShard,
  viewerRole?: KnowledgeRole,
): ActiveNodeResourceBindings {
  const matched = matchActiveTeachingProjection(shard);
  if (matched.status === 'unavailable') {
    return { state: 'unavailable', message: '当前系统资源暂时不可用。' };
  }
  if (matched.status !== 'available' || !matched.bindings || !matched.resources) {
    return { state: 'unavailable', message: '当前系统资源与所选对象身份不一致。' };
  }
  return projectAuthorityNodeResourceBindings({
    nodeId: shard.node.id,
    bindings: matched.bindings,
    resources: matched.resources,
    viewerRole,
  });
}
