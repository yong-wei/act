/**
 * Selection-bound Authority resource-binding projector.
 *
 * Resolves Teaching Projection resources that share the node-detail shard
 * envelope and returns learner-safe launch descriptors. Never invents routes
 * from Canonical IDs or copies Legacy graph DTOs into the active workspace.
 */

import {
  buildTeachingResourceLaunchMaps,
  resolveConfiguredTeachingProjectionRoot,
} from '@/lib/layered-graph/course-page-context';
import {
  resolveActiveTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '@/lib/teaching-projection/store';
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
} from '@/features/knowledge/active-authority-graph-contracts';

import type { KnowledgeRole } from '@/lib/authoritative-knowledge';
import type { AuthorityNodeDetailShard } from './contracts';

const ROLE_LABEL: Record<TeachingProjectionRole, ActiveResourceBindingRole> = {
  EXPLAINS: '讲解',
  PRACTICES: '练习',
  ASSESSES: '评价',
  COVERS: '引用',
};

const ROLE_ORDER: readonly ActiveResourceBindingRole[] = ['讲解', '练习', '评价', '引用'];

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

export function projectAuthorityNodeResourceBindings(input: {
  nodeId: string;
  bindings: readonly TeachingBindingRuntime[];
  resources: readonly TeachingResourceRuntime[];
  viewerRole?: KnowledgeRole;
}): ActiveNodeResourceBindings {
  const matched = input.bindings.filter((binding) => binding.canonicalId === input.nodeId);
  if (matched.length === 0) {
    return { state: 'empty', message: '暂无已授权系统资源。' };
  }
  const resources = input.resources.filter((resource) =>
    matched.some((binding) => binding.resourceId === resource.resourceId));
  const launchMaps = buildTeachingResourceLaunchMaps(resources);
  const items: ActiveResourceBinding[] = [];
  for (const binding of matched) {
    const resource = resources.find((entry) => entry.resourceId === binding.resourceId);
    const title = resource?.title?.trim() || null;
    if (!title) continue;
    const candidateHref = launchMaps.resourceLaunchTargets[binding.resourceId] ?? null;
    const resolved = resolveSafeLaunchTarget(candidateHref);
    const href = resolved.href
      && !isUnsafeHref(resolved.href, input.nodeId)
      && !isHiddenFromViewer(resolved.href, input.viewerRole)
      ? resolved.href
      : null;
    const kind = href
      ? (launchMaps.resourceRegistryIds[binding.resourceId] ? 'registry-resource' : 'direct-route')
      : 'unavailable';
    items.push({
      title,
      bindingRole: ROLE_LABEL[binding.role],
      resourceKind: resourceKindLabel(resource?.resourceType ?? null),
      availability: href ? 'available' : 'unavailable',
      launch: { kind, href },
    });
  }
  if (items.length === 0) {
    return { state: 'empty', message: '暂无已授权系统资源。' };
  }
  items.sort((left, right) =>
    ROLE_ORDER.indexOf(left.bindingRole) - ROLE_ORDER.indexOf(right.bindingRole)
    || left.title.localeCompare(right.title, 'zh-CN'));
  return { state: 'available', items };
}

export function attachActiveAuthorityResourceBindings(
  shard: AuthorityNodeDetailShard,
  viewerRole?: KnowledgeRole,
): ActiveNodeResourceBindings {
  const teaching = shard.envelope.teaching;
  if (
    shard.envelope.match.teaching !== true
    || teaching.status !== 'available'
    || !teaching.projectionId
    || !teaching.projectionHash
  ) {
    return { state: 'unavailable', message: '当前系统资源暂时不可用。' };
  }
  const active = resolveActiveTeachingProjection(
    resolveTeachingProjectionStorePaths(resolveConfiguredTeachingProjectionRoot()),
  );
  if (active.status !== 'available' || !active.staged?.artifacts.gate.passed) {
    return { state: 'unavailable', message: '当前系统资源暂时不可用。' };
  }
  const authority = shard.envelope.authority;
  const manifest = active.staged.artifacts.manifest;
  if (
    active.staged.projectionId !== teaching.projectionId
    || active.staged.projectionHash !== teaching.projectionHash
    || manifest.authorityReleaseId !== authority.releaseId
    || manifest.authorityReleaseSetId !== authority.releaseSetId
    || manifest.authoritySnapshotId !== authority.snapshotId
    || manifest.authoritySnapshotHash !== authority.snapshotHash
  ) {
    return { state: 'unavailable', message: '当前系统资源与所选对象身份不一致。' };
  }
  return projectAuthorityNodeResourceBindings({
    nodeId: shard.node.id,
    bindings: active.staged.artifacts.bindings,
    resources: active.staged.artifacts.resources,
    viewerRole,
  });
}
